const admin = require("firebase-admin");
const https = require("https");
const crypto = require("crypto");
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");

const db = admin.firestore();

// ── Config ──────────────────────────────────────────────────────────────────

const CASHFREE_ENV = process.env.CASHFREE_ENV || "TEST";
const IS_PROD = CASHFREE_ENV === "PRODUCTION";

const CASHFREE_APP_ID = IS_PROD
  ? process.env.CASHFREE_APP_ID_PROD
  : process.env.CASHFREE_APP_ID_TEST;

const CASHFREE_SECRET = IS_PROD
  ? process.env.CASHFREE_SECRET_KEY_PROD
  : process.env.CASHFREE_SECRET_KEY_TEST;

const CF_HOSTNAME = IS_PROD ? "api.cashfree.com" : "sandbox.cashfree.com";
const CF_API_VERSION = "2023-08-01";

const FIREBASE_PROJECT = "sportsphere-1701";
const WEBHOOK_URL = `https://us-central1-${FIREBASE_PROJECT}.cloudfunctions.net/cashfreeWebhook`;

// ── Cashfree REST helper (no axios needed) ───────────────────────────────────

function cashfreeRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;

    const options = {
      hostname: CF_HOSTNAME,
      path,
      method,
      headers: {
        "x-client-id": CASHFREE_APP_ID,
        "x-client-secret": CASHFREE_SECRET,
        "x-api-version": CF_API_VERSION,
        "Content-Type": "application/json",
      },
    };

    if (payload) {
      options.headers["Content-Length"] = Buffer.byteLength(payload);
    }

    const req = https.request(options, (res) => {
      let raw = "";
      res.on("data", (chunk) => { raw += chunk; });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(raw);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(parsed.message || `Cashfree error ${res.statusCode}: ${raw}`));
          }
        } catch {
          reject(new Error(`Cashfree non-JSON response (${res.statusCode}): ${raw}`));
        }
      });
    });

    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ── Cloud Function 1: createCashfreeOrder (callable) ────────────────────────

exports.createCashfreeOrder = onCall(async (request) => {
  const { data, auth } = request;
  if (!auth) {
    throw new HttpsError("unauthenticated", "User must be logged in");
  }

  const { bookingId, amount, customerPhone, customerName } = data;

  if (!bookingId || !amount || !customerPhone) {
    throw new HttpsError(
      "invalid-argument",
      "bookingId, amount, and customerPhone are required"
    );
  }

  // Fetch booking
  const bookingRef = db.collection("bookings").doc(bookingId);
  const bookingSnap = await bookingRef.get();

  if (!bookingSnap.exists) {
    throw new HttpsError("not-found", "Booking not found");
  }
  const booking = bookingSnap.data();

  // Idempotency: return existing session if still pending
  if (booking.cashfreeOrderId) {
    const existing = await db.collection("payments")
      .where("orderId", "==", booking.cashfreeOrderId)
      .limit(1)
      .get();

    if (!existing.empty) {
      const pd = existing.docs[0].data();
      if (pd.status === "pending") {
        return {
          success: true,
          paymentSessionId: pd.paymentSessionId,
          orderId: pd.orderId,
          paymentId: existing.docs[0].id,
        };
      }
    }
  }

  const orderId = `TRF_${bookingId}_${Date.now()}`;

  // Create Cashfree order
  let cfOrder;
  try {
    cfOrder = await cashfreeRequest("POST", "/pg/orders", {
      order_id: orderId,
      order_amount: amount,
      order_currency: "INR",
      customer_details: {
        customer_id: auth.uid,
        customer_phone: customerPhone,
        customer_name: customerName || "Customer",
      },
      order_meta: {
        notify_url: WEBHOOK_URL,
      },
      order_note: `Advance for ${booking.turfName || "turf"} - ${booking.date || ""}`,
    });
  } catch (err) {
    console.error("Cashfree order creation failed:", err.message);
    throw new HttpsError("internal", `Payment order failed: ${err.message}`);
  }

  const paymentSessionId = cfOrder.payment_session_id;
  if (!paymentSessionId) {
    throw new HttpsError("internal", "Cashfree did not return a payment session ID");
  }

  // Persist payment doc
  const paymentRef = db.collection("payments").doc();
  await paymentRef.set({
    bookingId,
    userId: auth.uid,
    turfId: booking.turfId || "",
    amount,
    orderId,
    paymentSessionId,
    status: "pending",
    gateway: "cashfree",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    metadata: {
      date: booking.date || "",
      turfName: booking.turfName || "",
      groundName: booking.groundName || "",
    },
  });

  await bookingRef.update({
    cashfreeOrderId: orderId,
    cashfreePaymentId: paymentRef.id,
  });

  return {
    success: true,
    paymentSessionId,
    orderId,
    paymentId: paymentRef.id,
  };
});

// ── Cloud Function 2: cancelBookingWithRefund (callable) ────────────────────
// Called by manager/caretaker to cancel a confirmed booking.
// Automatically initiates Cashfree refund if advance was paid.

exports.cancelBookingWithRefund = onCall(async (request) => {
  const { data, auth } = request;
  if (!auth) {
    throw new HttpsError("unauthenticated", "User must be logged in");
  }

  const { bookingId, reason, cancelledByRole } = data;

  if (!bookingId || !reason) {
    throw new HttpsError("invalid-argument", "bookingId and reason are required");
  }

  const bookingRef = db.collection("bookings").doc(bookingId);
  const bookingSnap = await bookingRef.get();

  if (!bookingSnap.exists) {
    throw new HttpsError("not-found", "Booking not found");
  }

  const booking = bookingSnap.data();

  // Only cancel bookings that are cancellable
  const cancellableStatuses = ["confirmed", "pending", "pending_payment", "awaiting_payment"];
  if (!cancellableStatuses.includes(booking.status)) {
    throw new HttpsError(
      "failed-precondition",
      `Booking cannot be cancelled (status: ${booking.status})`
    );
  }

  const advancePaid = booking.paymentStatus === "paid" && booking.cashfreeOrderId;
  const refundAmount = booking.payment?.advanceAmount || 0;
  let refundStatus = "not_required";
  let cfRefundId = null;

  // Initiate Cashfree refund if advance was paid
  if (advancePaid && refundAmount > 0) {
    cfRefundId = `REFUND_${bookingId}_${Date.now()}`;
    try {
      await cashfreeRequest("POST", `/pg/orders/${booking.cashfreeOrderId}/refunds`, {
        refund_amount: refundAmount,
        refund_id: cfRefundId,
        refund_note: `Cancelled by ${cancelledByRole || "manager"}: ${reason}`,
      });
      refundStatus = "initiated";
      console.log(`Refund initiated: ${cfRefundId} for ₹${refundAmount}`);
    } catch (err) {
      console.error("Cashfree refund failed:", err.message);
      // Don't block cancellation — flag for manual refund
      refundStatus = "failed";
    }
  }

  // Cancel the booking
  await bookingRef.update({
    status: "cancelled",
    cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
    cancelledBy: auth.uid,
    cancelledByRole: cancelledByRole || "manager",
    cancelledReason: reason,
    "slotLock.isLocked": false,
    "slotLock.lockType": null,
    "slotLock.lockExpiry": null,
    "slotLock.lockReason": null,
    "payment.refund.isRequired": advancePaid && refundAmount > 0,
    "payment.refund.refundAmount": refundAmount,
    "payment.refund.refundReason": reason,
    "payment.refund.refundStatus": refundStatus,
    "payment.refund.refundMethod": advancePaid ? "cashfree_upi" : "not_applicable",
    "payment.refund.refundedBy": auth.uid,
    "payment.refund.refundedAt": admin.firestore.FieldValue.serverTimestamp(),
    "payment.refund.cfRefundId": cfRefundId,
  });

  // Notify the customer
  try {
    const userDoc = await db.collection("users").doc(booking.userId).get();
    const fcmToken = userDoc.exists && userDoc.data().fcmToken;
    if (fcmToken) {
      const refundLine = advancePaid && refundAmount > 0 && refundStatus === "initiated"
        ? ` Your advance of ₹${refundAmount} will be refunded within 5-7 days.`
        : "";

      await admin.messaging().send({
        token: fcmToken,
        notification: {
          title: "Booking Cancelled",
          body: `Your booking at ${booking.turfName || "turf"} on ${booking.date || ""} has been cancelled by the manager.${refundLine}`,
        },
        data: { type: "booking_cancelled", bookingId },
      });
    }
  } catch (notifErr) {
    console.warn("FCM send failed:", notifErr.message);
  }

  return {
    success: true,
    refundInitiated: refundStatus === "initiated",
    refundAmount: advancePaid ? refundAmount : 0,
    refundStatus,
  };
});

// ── Cloud Function 3: verifyCashfreeOrder (callable) ────────────────────────
// Called from the app immediately after checkout returns.
// Checks Cashfree API directly — doesn't wait for webhook.

exports.verifyCashfreeOrder = onCall(async (request) => {
  const { data, auth } = request;
  if (!auth) {
    throw new HttpsError("unauthenticated", "User must be logged in");
  }

  const { orderId, bookingId } = data;
  if (!orderId || !bookingId) {
    throw new HttpsError("invalid-argument", "orderId and bookingId are required");
  }

  // Fetch order status directly from Cashfree
  let cfOrder;
  try {
    cfOrder = await cashfreeRequest("GET", `/pg/orders/${orderId}`);
  } catch (err) {
    console.error("verifyCashfreeOrder: Cashfree fetch failed:", err.message);
    throw new HttpsError("internal", `Could not verify order: ${err.message}`);
  }

  const orderStatus = cfOrder.order_status; // PAID | ACTIVE | EXPIRED
  console.log(`verifyCashfreeOrder: order=${orderId} status=${orderStatus}`);

  if (orderStatus === "PAID") {
    // Find payment doc
    const paymentsSnap = await db.collection("payments")
      .where("orderId", "==", orderId)
      .limit(1)
      .get();

    if (!paymentsSnap.empty) {
      const paymentDoc = paymentsSnap.docs[0];
      const paymentData = paymentDoc.data();
      const bookingRef = db.collection("bookings").doc(paymentData.bookingId);

      await db.runTransaction(async (txn) => {
        const bookingSnap = await txn.get(bookingRef);
        if (!bookingSnap.exists) throw new Error("Booking not found");
        if (bookingSnap.data().status === "confirmed") return; // already confirmed

        txn.update(paymentDoc.ref, {
          status: "success",
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
          verifiedVia: "active_check",
        });

        txn.update(bookingRef, {
          status: "confirmed",
          "payment.advance.status": "paid",
          "payment.advance.method": "cashfree_upi",
          "payment.advance.submittedAt": admin.firestore.FieldValue.serverTimestamp(),
          "payment.totalPaid": paymentData.amount,
          "payment.isFullyPaid": false,
          paymentStatus: "paid",
          confirmedAt: admin.firestore.FieldValue.serverTimestamp(),
          "slotLock.isLocked": false,
          "slotLock.lockType": null,
          "slotLock.lockExpiry": null,
          "slotLock.lockReason": null,
        });
      });

      // FCM notification
      try {
        const userDoc = await db.collection("users").doc(paymentData.userId).get();
        const fcmToken = userDoc.exists && userDoc.data().fcmToken;
        if (fcmToken) {
          await admin.messaging().send({
            token: fcmToken,
            notification: {
              title: "Booking Confirmed!",
              body: `Your slot at ${paymentData.metadata.turfName || "turf"} on ${paymentData.metadata.date || ""} is confirmed.`,
            },
            data: { type: "booking_confirmed", bookingId: paymentData.bookingId },
          });
        }
      } catch (notifErr) {
        console.warn("FCM send failed:", notifErr.message);
      }
    }
  }

  return { status: orderStatus };
});

// ── Cloud Function 3: cashfreeWebhook (HTTP) ─────────────────────────────────

exports.cashfreeWebhook = onRequest(async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  // Verify HMAC-SHA256 signature
  const receivedSig = req.headers["x-webhook-signature"];
  const timestamp = req.headers["x-webhook-timestamp"];

  if (!receivedSig || !timestamp) {
    console.error("Webhook: missing signature headers");
    return res.status(401).send("Missing signature");
  }

  const rawBody = JSON.stringify(req.body);
  const computedSig = crypto
    .createHmac("sha256", CASHFREE_SECRET)
    .update(`${timestamp}${rawBody}`)
    .digest("base64");

  if (receivedSig !== computedSig) {
    console.error("Webhook: invalid signature");
    return res.status(401).send("Invalid signature");
  }

  const eventType = req.body.type;
  const orderData = req.body.data && req.body.data.order;

  if (!orderData) {
    console.error("Webhook: no order data in payload");
    return res.status(200).send("OK"); // ack to avoid retries
  }

  const orderId = orderData.order_id;
  const orderStatus = orderData.order_status; // PAID | EXPIRED | ACTIVE

  console.log(`Webhook: order=${orderId} status=${orderStatus} event=${eventType}`);

  // Find the payment document
  const paymentsSnap = await db.collection("payments")
    .where("orderId", "==", orderId)
    .limit(1)
    .get();

  if (paymentsSnap.empty) {
    console.error(`Webhook: no payment doc for order ${orderId}`);
    return res.status(200).send("OK");
  }

  const paymentDoc = paymentsSnap.docs[0];
  const paymentData = paymentDoc.data();
  const bookingRef = db.collection("bookings").doc(paymentData.bookingId);

  if (orderStatus === "PAID") {
    await db.runTransaction(async (txn) => {
      const bookingSnap = await txn.get(bookingRef);
      if (!bookingSnap.exists) throw new Error("Booking not found");
      if (bookingSnap.data().status === "confirmed") return; // idempotent

      const cfPayment = (req.body.data && req.body.data.payment) || {};

      txn.update(paymentDoc.ref, {
        status: "success",
        cfReferenceId: cfPayment.cf_payment_id || "",
        paymentMode: cfPayment.payment_group || "upi",
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      txn.update(bookingRef, {
        status: "confirmed",
        "payment.advance.status": "paid",
        "payment.advance.method": "cashfree_upi",
        "payment.advance.submittedAt": admin.firestore.FieldValue.serverTimestamp(),
        "payment.totalPaid": paymentData.amount,
        "payment.isFullyPaid": false,
        paymentStatus: "paid",
        confirmedAt: admin.firestore.FieldValue.serverTimestamp(),
        "slotLock.isLocked": false,
        "slotLock.lockType": null,
        "slotLock.lockExpiry": null,
        "slotLock.lockReason": null,
      });
    });

    // FCM notification
    try {
      const userDoc = await db.collection("users").doc(paymentData.userId).get();
      const fcmToken = userDoc.exists && userDoc.data().fcmToken;
      if (fcmToken) {
        await admin.messaging().send({
          token: fcmToken,
          notification: {
            title: "Booking Confirmed!",
            body: `Your slot at ${paymentData.metadata.turfName || "turf"} on ${paymentData.metadata.date || ""} is confirmed.`,
          },
          data: { type: "booking_confirmed", bookingId: paymentData.bookingId },
        });
      }
    } catch (notifErr) {
      console.warn("FCM send failed:", notifErr.message);
    }

    console.log(`Webhook: booking ${paymentData.bookingId} confirmed`);

  } else if (orderStatus === "EXPIRED" || eventType === "PAYMENT_FAILED_WEBHOOK") {
    await db.runTransaction(async (txn) => {
      txn.update(paymentDoc.ref, {
        status: "failed",
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      txn.update(bookingRef, {
        status: "cancelled",
        cancelledReason: "Payment failed or expired",
        "payment.advance.status": "failed",
        "slotLock.isLocked": false,
        "slotLock.lockType": null,
        "slotLock.lockExpiry": null,
        "slotLock.lockReason": null,
      });
    });
    console.log(`Webhook: booking ${paymentData.bookingId} cancelled`);
  }

  return res.status(200).send("OK");
});
