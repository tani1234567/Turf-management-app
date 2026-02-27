const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { sendNotification } = require("./helpers/notificationHelpers");

/**
 * Release expired soft locks (pending_payment bookings where user didn't complete payment in 10 mins)
 * Runs every 2 minutes
 */
exports.releaseExpiredSlotLocks = functions.pubsub
  .schedule("*/2 * * * *")
  .timeZone("Asia/Kolkata")
  .onRun(async (context) => {
    const now = admin.firestore.Timestamp.now();

    // Find bookings with expired soft locks (pending_payment status)
    const expiredSoftLocks = await admin.firestore()
      .collection("bookings")
      .where("status", "==", "pending_payment")
      .where("slotLock.lockExpiry", "<=", now)
      .get();

    console.log(`Found ${expiredSoftLocks.size} expired soft locks`);

    for (const doc of expiredSoftLocks.docs) {
      const booking = doc.data();

      // Update status to expired and release lock
      await doc.ref.update({
        status: "expired",
        slotLock: {
          isLocked: false,
          lockType: null,
          lockedAt: null,
          lockExpiry: null,
          lockReason: null,
        },
        statusHistory: admin.firestore.FieldValue.arrayUnion({
          status: "expired",
          timestamp: new Date().toISOString(),
          changedBy: "system",
          changedByRole: "system",
          reason: "Payment not completed within 10 minutes - slot released",
        }),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Notify user
      await sendNotification(booking.userId, {
        type: "booking_expired",
        title: "Booking Expired",
        body: "Payment was not completed in time. The slot is now available for others.",
        data: { bookingId: doc.id },
      });

      console.log(`Released soft lock for booking ${doc.id}`);
    }

    return null;
  });
