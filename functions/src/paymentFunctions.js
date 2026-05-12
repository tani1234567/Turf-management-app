const admin = require("firebase-admin");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const {
  sendNotification,
  notifyTurfManagers,
  notifyCompanyOwners,
} = require("./helpers/notificationHelpers");

/**
 * Check payment timeouts for "awaiting_payment" bookings where user didn't pay in time
 * Runs every 5 minutes
 */
exports.checkPaymentTimeouts = onSchedule(
  {
    schedule: "*/5 * * * *",
    timeZone: "Asia/Kolkata",
  },
  async (context) => {
    const now = admin.firestore.Timestamp.now();

    // Find bookings awaiting payment with expired deadline
    const expiredPayments = await admin.firestore()
      .collection("bookings")
      .where("status", "==", "awaiting_payment")
      .where("payment.advance.paymentDeadline", "<=", now)
      .get();

    console.log(`Found ${expiredPayments.size} expired payment deadlines`);

    for (const doc of expiredPayments.docs) {
      const booking = doc.data();

      // Update status to expired and release lock
      await doc.ref.update({
        status: "expired",
        "payment.advance.isExpired": true,
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
          reason: "Payment timeout - slot released",
        }),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Notify user
      await sendNotification(booking.userId, {
        type: "booking_expired",
        title: "Booking Expired",
        body: `Your booking for ${booking.turfName} expired. The slot is now available for others.`,
        data: { bookingId: doc.id },
      });

      // Notify manager
      await notifyTurfManagers(booking.turfId, {
        type: "booking_expired",
        title: "Booking Payment Expired",
        body: `${booking.userName}'s booking expired due to payment timeout.`,
        data: { bookingId: doc.id },
      });

      console.log(`Expired booking ${doc.id} due to payment timeout`);
    }

    return null;
  });

/**
 * Send reminders to managers for payments submitted > 30 mins ago and not yet verified
 * Escalates to owner after 2 hours
 * Runs every 30 minutes
 */
exports.sendPaymentVerificationReminders = onSchedule(
  {
    schedule: "*/30 * * * *",
    timeZone: "Asia/Kolkata",
  },
  async (context) => {
    const thirtyMinsAgo = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() - 30 * 60 * 1000)
    );

    // Find bookings submitted > 30 mins ago and not yet verified
    const pendingVerifications = await admin.firestore()
      .collection("bookings")
      .where("status", "==", "payment_submitted")
      .where("payment.advance.submittedAt", "<=", thirtyMinsAgo)
      .get();

    console.log(`Found ${pendingVerifications.size} pending payment verifications`);

    for (const doc of pendingVerifications.docs) {
      const booking = doc.data();
      const submittedAt = booking.payment.advance.submittedAt.toDate();
      const minutesPending = Math.floor(
        (Date.now() - submittedAt.getTime()) / (1000 * 60)
      );

      // Send reminder to managers
      await notifyTurfManagers(booking.turfId, {
        type: "payment_verification_pending",
        title: "Payment Needs Verification",
        body: `${booking.userName}'s payment of ${booking.payment.advanceAmount} pending for ${minutesPending} mins`,
        data: { bookingId: doc.id },
      });

      // After 2 hours, escalate to owner
      if (minutesPending >= 120) {
        await notifyCompanyOwners(booking.companyId, {
          type: "payment_verification_escalation",
          title: "Urgent: Payment Verification Overdue",
          body: `${booking.userName}'s payment pending for over 2 hours`,
          data: { bookingId: doc.id },
        });
      }

      console.log(
        `Sent verification reminder for booking ${doc.id} (${minutesPending} mins pending)`
      );
    }

    return null;
  });

/**
 * Send reminders to users about upcoming payment deadlines
 * Sends at 60, 30, and 10 minutes before deadline
 * Runs every 10 minutes
 */
exports.sendPaymentDeadlineReminders = onSchedule(
  {
    schedule: "*/10 * * * *",
    timeZone: "Asia/Kolkata",
  },
  async (context) => {
    const now = Date.now();

    const awaitingPayment = await admin.firestore()
      .collection("bookings")
      .where("status", "==", "awaiting_payment")
      .get();

    console.log(`Checking ${awaitingPayment.size} bookings for deadline reminders`);

    for (const doc of awaitingPayment.docs) {
      const booking = doc.data();
      const deadline = booking.payment?.advance?.paymentDeadline?.toDate();
      if (!deadline) continue;

      const minsRemaining = Math.floor(
        (deadline.getTime() - now) / (1000 * 60)
      );

      // Send reminders at 60, 30, 10 minutes before deadline
      if (minsRemaining === 60 || minsRemaining === 30 || minsRemaining === 10) {
        await sendNotification(booking.userId, {
          type: "payment_reminder",
          title: `${minsRemaining} minutes left to pay`,
          body: `Complete payment for your ${booking.turfName} booking before it expires.`,
          data: { bookingId: doc.id },
        });

        console.log(
          `Sent ${minsRemaining}-min deadline reminder for booking ${doc.id}`
        );
      }
    }

    return null;
  });
