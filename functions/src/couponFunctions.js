const admin = require("firebase-admin");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");

const db = admin.firestore();
const { notifyCompanyOwners } = require("./helpers/notificationHelpers");

// ─── 1. expireCoupons — scheduled daily at 12:00 AM IST ──────────────────────

/**
 * Expire all coupons whose validTo has passed.
 * Applies to both "active" and "paused" coupons so admin-paused coupons
 * that silently age past their validTo also get cleaned up.
 * Runs daily at 12:00 AM IST.
 */
exports.expireCoupons = onSchedule(
  { schedule: "0 0 * * *", timeZone: "Asia/Kolkata" },
  async () => {
    const now = admin.firestore.Timestamp.now();
    console.log("[expireCoupons] Running...");

    const snap = await db
      .collection("coupons")
      .where("validTo", "<", now)
      .where("status", "in", ["active", "paused"])
      .get();

    if (snap.empty) {
      console.log("[expireCoupons] Nothing to expire.");
      return null;
    }

    console.log(`[expireCoupons] Expiring ${snap.size} coupon(s)...`);

    // Batch in chunks of 400 (Firestore batch limit is 500; keep headroom)
    const CHUNK = 400;
    const docs = snap.docs;

    for (let i = 0; i < docs.length; i += CHUNK) {
      const batch = db.batch();
      for (const docSnap of docs.slice(i, i + CHUNK)) {
        batch.update(docSnap.ref, {
          status: "expired",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
    }

    console.log(`[expireCoupons] Done — expired ${snap.size} coupon(s).`);
    return { expired: snap.size };
  }
);

// ─── 2. onCouponUsageCreate — notify company owners when their coupon is used ──

/**
 * Fires when a couponUsage document is created.
 * Only notifies for turf-channel coupons — platform coupons are PlayGrid's cost,
 * not the company's, so no notification is needed there.
 */
exports.onCouponUsageCreate = onDocumentCreated(
  "couponUsages/{usageId}",
  async (event) => {
    const usage = event.data.data();

    if (usage.channel !== "turf") return null;
    if (!usage.companyId) return null;

    const code = usage.couponCode || "coupon";
    const discountAmount = usage.discountAmount || 0;
    const originalAmount = usage.originalAmount || 0;

    console.log(
      `[onCouponUsageCreate] Turf coupon ${code} used — notifying owners of company ${usage.companyId}`
    );

    // Fetch turfName and userName for a richer notification body
    let turfName = "a turf";
    let userName = "A customer";

    try {
      const [turfDoc, userDoc] = await Promise.all([
        usage.turfId
          ? db.collection("turfs").doc(usage.turfId).get()
          : Promise.resolve(null),
        usage.userId
          ? db.collection("users").doc(usage.userId).get()
          : Promise.resolve(null),
      ]);

      if (turfDoc?.exists) turfName = turfDoc.data().name || turfName;
      if (userDoc?.exists) userName = userDoc.data().name || userDoc.data().displayName || userName;
    } catch (fetchErr) {
      console.warn("[onCouponUsageCreate] Could not fetch turf/user details:", fetchErr.message);
    }

    try {
      await notifyCompanyOwners(usage.companyId, {
        type: "coupon_used",
        title: `Coupon ${code} Used`,
        body: `${userName} saved ₹${discountAmount} on a ₹${originalAmount} booking at ${turfName}.`,
        data: {
          couponId: usage.couponId,
          couponCode: code,
          companyId: usage.companyId,
        },
      });
      return { notified: usage.companyId };
    } catch (err) {
      console.error("[onCouponUsageCreate] Notification error:", err);
      return null;
    }
  }
);

// ─── 3. validateCouponHTTPS — server-side coupon validation callable ──────────

/**
 * HTTPS Callable: validate a coupon code server-side.
 * Moving validation here prevents client-side spoofing of usage counts.
 *
 * Input:  { couponCode, userId, turfId, companyId, totalAmount, isNegotiatedBooking }
 * Output: { valid: true, coupon: <stripped> }
 *       | { valid: false, error: <string> }
 *
 * "stripped" coupon contains only what the app needs to display and calculate —
 * no admin-only fields (createdBy, lastEditedBy, etc.).
 */
exports.validateCouponHTTPS = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in to validate a coupon.");
  }

  const {
    couponCode,
    userId,
    turfId,
    companyId,
    totalAmount,
    isNegotiatedBooking = false,
  } = request.data || {};

  if (!couponCode?.trim()) {
    return { valid: false, error: "Enter a coupon code" };
  }

  const code = couponCode.trim().toUpperCase();

  try {
    // ── Fetch coupon by code ──────────────────────────────────────────────────
    const snap = await db
      .collection("coupons")
      .where("code", "==", code)
      .limit(1)
      .get();

    if (snap.empty) return { valid: false, error: "Invalid coupon code" };

    const docSnap = snap.docs[0];
    const c = docSnap.data();
    const couponId = docSnap.id;

    // ── Effective status ──────────────────────────────────────────────────────
    if (c.status !== "active") {
      return { valid: false, error: "This coupon is no longer active" };
    }
    if (c.channel === "turf" && c.companyStatus !== "active") {
      return { valid: false, error: "This coupon is no longer active" };
    }

    // ── Date validity ─────────────────────────────────────────────────────────
    const now = Date.now();
    const validFrom = c.validFrom?.toDate ? c.validFrom.toDate().getTime() : new Date(c.validFrom).getTime();
    const validTo = c.validTo?.toDate ? c.validTo.toDate().getTime() : new Date(c.validTo).getTime();

    if (now < validFrom) return { valid: false, error: "This coupon is not yet active" };
    if (now > validTo)   return { valid: false, error: "This coupon has expired" };

    // ── Turf/company match (turf coupons only) ────────────────────────────────
    if (c.channel === "turf") {
      if (c.companyId && c.companyId !== companyId) {
        return { valid: false, error: "Coupon not valid for this turf" };
      }
      if (c.turfIds?.length > 0 && !c.turfIds.includes(turfId)) {
        return { valid: false, error: "Coupon not valid for this turf" };
      }
    }

    // ── Negotiation restriction ───────────────────────────────────────────────
    if (isNegotiatedBooking && !c.applicableToNegotiated) {
      return { valid: false, error: "Coupon cannot be applied to negotiated bookings" };
    }

    // ── Minimum booking amount ────────────────────────────────────────────────
    if (totalAmount < (c.minBookingAmount || 0)) {
      return {
        valid: false,
        error: `Minimum booking amount ₹${c.minBookingAmount} required`,
      };
    }

    // ── Total usage limit ─────────────────────────────────────────────────────
    if (c.totalUsageLimit != null && c.usageCount >= c.totalUsageLimit) {
      return { valid: false, error: "Coupon usage limit has been reached" };
    }

    // ── Per-user limit ────────────────────────────────────────────────────────
    const perUserLimit = c.perUserLimit ?? 1;
    const usageSnap = await db
      .collection("couponUsages")
      .where("couponId", "==", couponId)
      .where("userId", "==", userId)
      .limit(perUserLimit + 1) // only fetch what we need to check the limit
      .get();

    if (usageSnap.size >= perUserLimit) {
      return { valid: false, error: "You have already used this coupon" };
    }

    // ── Return stripped coupon (app-facing fields only) ───────────────────────
    return {
      valid: true,
      coupon: {
        id: couponId,
        code: c.code,
        title: c.title,
        description: c.description || null,
        channel: c.channel,
        discountType: c.discountType,
        discountValue: c.discountValue,
        maxDiscountAmount: c.maxDiscountAmount ?? null,
        minBookingAmount: c.minBookingAmount ?? 0,
        applicableToNegotiated: c.applicableToNegotiated,
        applicableToNoAdvance: c.applicableToNoAdvance,
        validTo: validTo,
      },
    };
  } catch (err) {
    console.error("[validateCouponHTTPS] Error:", err);
    throw new HttpsError("internal", "Could not validate coupon. Please try again.");
  }
});
