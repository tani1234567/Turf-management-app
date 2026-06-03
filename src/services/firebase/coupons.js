import { Platform } from "react-native";
import {
  collection,
  doc,
  getDocs,
  updateDoc,
  query,
  where,
  limit,
  serverTimestamp as webServerTimestamp,
  runTransaction as webRunTransaction,
  increment as webIncrement,
} from "firebase/firestore";
import { db } from "./config";
import { isCouponEffectivelyActive } from "../../utils/couponUtils";

// Always use the web Firebase SDK — native @react-native-firebase/firestore
// has a separate auth context and causes permission-denied errors when auth
// state lives in the web SDK (AsyncStorage-backed).
const nativeFirestore = null;
const hasNativeFirestore = false;

const serverTimestamp = () => {
  if (hasNativeFirestore) return nativeFirestore.FieldValue.serverTimestamp();
  return webServerTimestamp();
};

const toDate = (ts) => (ts?.toDate ? ts.toDate() : new Date(ts));

/**
 * Validate a coupon code for a specific booking context.
 * Performs all client-side checks: existence, active status, date validity,
 * turf/company match, negotiation restriction, min amount, total usage limit,
 * and per-user usage limit.
 *
 * Returns { valid: true, coupon } or { valid: false, error: string }.
 *
 * NOTE: The booking transaction re-checks usageCount inside Firestore to handle
 * race conditions on limited coupons — this is the pre-validation for UX.
 */
export const validateCouponForBooking = async (couponCode, context) => {
  const {
    userId,
    turfId,
    companyId,
    totalAmount,
    isNegotiatedBooking = false,
  } = context;

  if (!couponCode?.trim()) {
    return { valid: false, error: "Enter a coupon code" };
  }

  const code = couponCode.trim().toUpperCase();

  try {
    let coupon = null;

    if (hasNativeFirestore) {
      const snap = await nativeFirestore()
        .collection("coupons")
        .where("code", "==", code)
        .limit(1)
        .get();
      if (!snap.empty) {
        coupon = { id: snap.docs[0].id, ...snap.docs[0].data() };
      }
    } else {
      const q = query(
        collection(db, "coupons"),
        where("code", "==", code),
        limit(1)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        coupon = { id: snap.docs[0].id, ...snap.docs[0].data() };
      }
    }

    if (!coupon) return { valid: false, error: "Invalid coupon code" };

    if (!isCouponEffectivelyActive(coupon)) {
      return { valid: false, error: "This coupon is no longer active" };
    }

    const now = new Date();
    if (now < toDate(coupon.validFrom)) {
      return { valid: false, error: "This coupon is not yet active" };
    }
    if (now > toDate(coupon.validTo)) {
      return { valid: false, error: "This coupon has expired" };
    }

    if (coupon.channel === "turf") {
      if (coupon.companyId && coupon.companyId !== companyId) {
        return { valid: false, error: "Coupon not valid for this turf" };
      }
      if (
        coupon.turfIds?.length > 0 &&
        !coupon.turfIds.includes(turfId)
      ) {
        return { valid: false, error: "Coupon not valid for this turf" };
      }
    }

    if (isNegotiatedBooking && !coupon.applicableToNegotiated) {
      return {
        valid: false,
        error: "Coupon cannot be applied to negotiated bookings",
      };
    }

    if (totalAmount < (coupon.minBookingAmount || 0)) {
      return {
        valid: false,
        error: `Minimum booking amount ₹${coupon.minBookingAmount} required`,
      };
    }

    if (
      coupon.totalUsageLimit != null &&
      coupon.usageCount >= coupon.totalUsageLimit
    ) {
      return { valid: false, error: "Coupon usage limit has been reached" };
    }

    const perUserLimit = coupon.perUserLimit ?? 1;
    let userUsageCount = 0;

    if (hasNativeFirestore) {
      const snap = await nativeFirestore()
        .collection("couponUsages")
        .where("couponId", "==", coupon.id)
        .where("userId", "==", userId)
        .get();
      userUsageCount = snap.size;
    } else {
      const q = query(
        collection(db, "couponUsages"),
        where("couponId", "==", coupon.id),
        where("userId", "==", userId)
      );
      const snap = await getDocs(q);
      userUsageCount = snap.size;
    }

    if (userUsageCount >= perUserLimit) {
      return { valid: false, error: "You have already used this coupon" };
    }

    return { valid: true, coupon };
  } catch (error) {
    console.error("Error validating coupon:", error);
    return { valid: false, error: "Could not validate coupon. Please try again." };
  }
};

/**
 * Fetch active, non-expired turf coupons for a specific turf (for Discover /
 * TurfDetailScreen "Offers & Deals" section).
 */
export const getTurfCoupons = async (turfId, companyId) => {
  try {
    const now = new Date();

    const filterValid = (coupons) =>
      coupons.filter((c) => {
        const turfMatch =
          !c.turfIds || c.turfIds.length === 0 || c.turfIds.includes(turfId);
        return (
          turfMatch &&
          now >= toDate(c.validFrom) &&
          now <= toDate(c.validTo)
        );
      });

    if (hasNativeFirestore) {
      const snap = await nativeFirestore()
        .collection("coupons")
        .where("channel", "==", "turf")
        .where("companyId", "==", companyId)
        .where("status", "==", "active")
        .where("companyStatus", "==", "active")
        .get();
      return filterValid(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }

    const q = query(
      collection(db, "coupons"),
      where("channel", "==", "turf"),
      where("companyId", "==", companyId),
      where("status", "==", "active"),
      where("companyStatus", "==", "active")
    );
    const snap = await getDocs(q);
    return filterValid(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  } catch (error) {
    console.error("Error fetching turf coupons:", error);
    return [];
  }
};

/**
 * Fetch all coupons assigned to a company (any status) for the owner/manager
 * toggle screen. Company can see all assigned coupons and toggle companyStatus.
 */
export const getCompanyCoupons = async (companyId) => {
  try {
    if (hasNativeFirestore) {
      const snap = await nativeFirestore()
        .collection("coupons")
        .where("channel", "==", "turf")
        .where("companyId", "==", companyId)
        .get();
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }

    const q = query(
      collection(db, "coupons"),
      where("channel", "==", "turf"),
      where("companyId", "==", companyId)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error("Error fetching company coupons:", error);
    return [];
  }
};

/**
 * Toggle a turf coupon's company-controlled active/paused state.
 * Only writes `companyStatus` — all other coupon fields are admin-only.
 * The admin's `status` field always takes precedence over this value.
 */
export const setCompanyCouponStatus = async (couponId, companyId, status) => {
  if (!["active", "paused"].includes(status)) {
    throw new Error("Invalid status. Must be 'active' or 'paused'.");
  }

  try {
    const updates = { companyStatus: status, updatedAt: serverTimestamp() };

    if (hasNativeFirestore) {
      await nativeFirestore()
        .collection("coupons")
        .doc(couponId)
        .update(updates);
      return { success: true };
    }

    await updateDoc(doc(db, "coupons", couponId), updates);
    return { success: true };
  } catch (error) {
    console.error("Error setting coupon status:", error);
    return { success: false, message: error.message };
  }
};

/**
 * Atomically apply a coupon to an already-existing booking (chat / negotiated flow).
 * Used when the booking was created before the coupon step (unlike regular bookings
 * where the coupon is recorded inside the creation transaction).
 *
 * Transaction does:
 *   1. Re-validates coupon status + usage limit
 *   2. Verifies coupon not already applied to this booking
 *   3. Increments coupon usageCount
 *   4. Creates couponUsages document
 *   5. Updates booking coupon + payment fields
 */
export const applyCouponToExistingBooking = async (
  coupon,
  bookingId,
  { userId, companyId, turfId, originalAmount, discountAmount, finalAmount, advanceAmount }
) => {
  try {
    if (hasNativeFirestore) {
      return await nativeFirestore().runTransaction(async (transaction) => {
        const couponRef = nativeFirestore().collection("coupons").doc(coupon.id);
        const bookingRef = nativeFirestore().collection("bookings").doc(bookingId);

        const couponSnap = await transaction.get(couponRef);
        const bookingSnap = await transaction.get(bookingRef);

        if (!couponSnap.exists) return { success: false, message: "Coupon no longer exists." };
        const cd = couponSnap.data();
        if (cd.status !== "active") return { success: false, message: "Coupon is no longer active." };
        if (cd.totalUsageLimit != null && cd.usageCount >= cd.totalUsageLimit) {
          return { success: false, message: "Coupon usage limit has been reached." };
        }

        if (!bookingSnap.exists) return { success: false, message: "Booking not found." };
        if (bookingSnap.data().coupon?.applied) {
          return { success: false, message: "A coupon is already applied to this booking." };
        }

        // Writes
        transaction.update(couponRef, {
          usageCount: nativeFirestore.FieldValue.increment(1),
          updatedAt: nativeFirestore.FieldValue.serverTimestamp(),
        });

        const usageRef = nativeFirestore().collection("couponUsages").doc();
        transaction.set(usageRef, {
          couponId: coupon.id, couponCode: coupon.code,
          userId, bookingId, companyId, turfId, channel: coupon.channel,
          originalAmount, discountAmount, finalAmount, advanceAmount,
          usedAt: nativeFirestore.FieldValue.serverTimestamp(),
        });

        transaction.update(bookingRef, {
          "coupon.applied": true,
          "coupon.code": coupon.code,
          "coupon.couponId": coupon.id,
          "coupon.channel": coupon.channel,
          "coupon.discountType": coupon.discountType,
          "coupon.discountValue": coupon.discountValue,
          "coupon.discountAmount": discountAmount,
          "coupon.originalAmount": originalAmount,
          "payment.discountAmount": discountAmount,
          "payment.finalAmount": finalAmount,
          "payment.advanceAmount": advanceAmount,
          updatedAt: nativeFirestore.FieldValue.serverTimestamp(),
        });

        return { success: true };
      });
    }

    // Web SDK
    return await webRunTransaction(db, async (transaction) => {
      const couponRef = doc(db, "coupons", coupon.id);
      const bookingRef = doc(db, "bookings", bookingId);

      const couponSnap = await transaction.get(couponRef);
      const bookingSnap = await transaction.get(bookingRef);

      if (!couponSnap.exists()) return { success: false, message: "Coupon no longer exists." };
      const cd = couponSnap.data();
      if (cd.status !== "active") return { success: false, message: "Coupon is no longer active." };
      if (cd.totalUsageLimit != null && cd.usageCount >= cd.totalUsageLimit) {
        return { success: false, message: "Coupon usage limit has been reached." };
      }

      if (!bookingSnap.exists()) return { success: false, message: "Booking not found." };
      if (bookingSnap.data().coupon?.applied) {
        return { success: false, message: "A coupon is already applied to this booking." };
      }

      // Writes
      transaction.update(couponRef, {
        usageCount: webIncrement(1),
        updatedAt: webServerTimestamp(),
      });

      const usageRef = doc(collection(db, "couponUsages"));
      transaction.set(usageRef, {
        couponId: coupon.id, couponCode: coupon.code,
        userId, bookingId, companyId, turfId, channel: coupon.channel,
        originalAmount, discountAmount, finalAmount, advanceAmount,
        usedAt: webServerTimestamp(),
      });

      transaction.update(bookingRef, {
        "coupon.applied": true,
        "coupon.code": coupon.code,
        "coupon.couponId": coupon.id,
        "coupon.channel": coupon.channel,
        "coupon.discountType": coupon.discountType,
        "coupon.discountValue": coupon.discountValue,
        "coupon.discountAmount": discountAmount,
        "coupon.originalAmount": originalAmount,
        "payment.discountAmount": discountAmount,
        "payment.finalAmount": finalAmount,
        "payment.advanceAmount": advanceAmount,
        updatedAt: webServerTimestamp(),
      });

      return { success: true };
    });
  } catch (error) {
    console.error("Error applying coupon to booking:", error);
    return { success: false, message: "Failed to apply coupon. Please try again." };
  }
};
