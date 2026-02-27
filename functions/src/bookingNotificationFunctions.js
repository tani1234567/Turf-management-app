const functions = require("firebase-functions");
const admin = require("firebase-admin");
const {
  sendNotification,
  notifyTurfManagers,
} = require("./helpers/notificationHelpers");

const db = admin.firestore();

/**
 * Send notifications when booking status changes
 * Covers V2.1 notification types:
 * - booking_awaiting_payment: User, after manager approves booking
 * - payment_verified: User, after manager verifies payment
 * - payment_rejected: User, after manager rejects payment
 */
exports.onBookingStatusChange = functions.firestore
  .document("bookings/{bookingId}")
  .onUpdate(async (change, context) => {
    const bookingId = context.params.bookingId;
    const beforeData = change.before.data();
    const afterData = change.after.data();

    const beforeStatus = beforeData.status;
    const afterStatus = afterData.status;

    // Only trigger on status change
    if (beforeStatus === afterStatus) {
      return null;
    }

    console.log(`Booking ${bookingId}: ${beforeStatus} -> ${afterStatus}`);

    const {
      userId,
      turfId,
      turfName,
      userName,
    } = afterData;

    // Booking approved → awaiting payment
    if (
      (beforeStatus === "pending" || beforeStatus === "approved") &&
      afterStatus === "awaiting_payment"
    ) {
      await sendNotification(userId, {
        type: "booking_awaiting_payment",
        title: "Booking Approved - Pay Now",
        body: `Your booking for ${turfName} has been approved. Complete payment before the deadline.`,
        data: { bookingId },
      });
      console.log(`Sent booking_awaiting_payment notification to user ${userId}`);
    }

    // Payment verified (payment_submitted → confirmed)
    if (
      beforeStatus === "payment_submitted" &&
      afterStatus === "confirmed" &&
      afterData.payment?.advance?.status === "verified"
    ) {
      await sendNotification(userId, {
        type: "payment_verified",
        title: "Payment Verified",
        body: `Your payment for ${turfName} has been verified. Booking confirmed!`,
        data: { bookingId },
      });
      console.log(`Sent payment_verified notification to user ${userId}`);
    }

    // Payment rejected
    if (
      beforeStatus === "payment_submitted" &&
      afterStatus === "payment_rejected"
    ) {
      const rejectionReason =
        afterData.payment?.advance?.verification?.rejectionReason || "Please contact the manager";

      await sendNotification(userId, {
        type: "payment_rejected",
        title: "Payment Not Verified",
        body: `Your payment for ${turfName} was not verified. Reason: ${rejectionReason}`,
        data: { bookingId },
      });
      console.log(`Sent payment_rejected notification to user ${userId}`);
    }

    return null;
  });

/**
 * Send notifications when turf requests are created or status changes
 * Covers V2.1 notification types:
 * - turf_request_created: Owner, manager requested turf
 * - turf_request_approved: Manager, turf request approved
 * - turf_request_rejected: Manager, turf request rejected
 */
exports.onTurfRequestChange = functions.firestore
  .document("turf_requests/{requestId}")
  .onWrite(async (change, context) => {
    const requestId = context.params.requestId;
    const afterData = change.after.exists ? change.after.data() : null;
    const beforeData = change.before.exists ? change.before.data() : null;

    if (!afterData) return null;

    // New turf request created
    if (!beforeData) {
      const { companyId, requestedBy, requestedByName, turfName } = afterData;

      if (companyId) {
        const { notifyCompanyOwners } = require("./helpers/notificationHelpers");
        await notifyCompanyOwners(companyId, {
          type: "turf_request_created",
          title: "New Turf Request",
          body: `${requestedByName || "A manager"} requested to add ${turfName || "a new turf"}.`,
          data: { requestId },
        });
        console.log(`Sent turf_request_created notification for request ${requestId}`);
      }
      return null;
    }

    // Status change
    const beforeStatus = beforeData.status;
    const afterStatus = afterData.status;

    if (beforeStatus === afterStatus) return null;

    const { requestedBy, turfName } = afterData;

    if (afterStatus === "approved" && requestedBy) {
      await sendNotification(requestedBy, {
        type: "turf_request_approved",
        title: "Turf Request Approved",
        body: `Your request for ${turfName || "the turf"} has been approved.`,
        data: { requestId },
      });
      console.log(`Sent turf_request_approved to ${requestedBy}`);
    }

    if (afterStatus === "rejected" && requestedBy) {
      const rejectionReason = afterData.rejectionReason || "";
      await sendNotification(requestedBy, {
        type: "turf_request_rejected",
        title: "Turf Request Rejected",
        body: `Your request for ${turfName || "the turf"} was rejected.${rejectionReason ? ` Reason: ${rejectionReason}` : ""}`,
        data: { requestId },
      });
      console.log(`Sent turf_request_rejected to ${requestedBy}`);
    }

    return null;
  });

/**
 * Send notification to turf managers when a new booking is created
 * Covers: booking_request notification type
 */
exports.onBookingCreated = functions.firestore
  .document("bookings/{bookingId}")
  .onCreate(async (snap, context) => {
    const bookingId = context.params.bookingId;
    const bookingData = snap.data();

    // Only notify for pending bookings (direct bookings, not from negotiations)
    if (bookingData.status !== "pending") {
      return null;
    }

    const { turfId, turfName, userName, date, startTime, endTime } = bookingData;

    if (!turfId) {
      console.log("No turfId on booking, skipping notification");
      return null;
    }

    console.log(`New booking ${bookingId} created for turf ${turfId}`);

    await notifyTurfManagers(turfId, {
      type: "booking_request",
      title: "New Booking Request",
      body: `${userName || "A user"} requested a booking for ${turfName || "your turf"} on ${date} (${startTime} - ${endTime}).`,
      data: { bookingId },
    });

    console.log(`Sent booking_request notifications for booking ${bookingId}`);
    return null;
  });

/**
 * Send booking reminders to users 1-2 hours before their booking
 * Runs every 30 minutes
 */
exports.sendBookingReminders = functions.pubsub
  .schedule("every 30 minutes")
  .timeZone("Asia/Kolkata")
  .onRun(async () => {
    console.log("Starting booking reminder check...");

    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
    const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    // Get today's date in YYYY-MM-DD format (IST)
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffset);
    const todayStr = istNow.toISOString().split("T")[0];

    // Format times as HH:MM for comparison
    const pad = (n) => String(n).padStart(2, "0");
    const istOneHour = new Date(oneHourFromNow.getTime() + istOffset);
    const istTwoHours = new Date(twoHoursFromNow.getTime() + istOffset);
    const windowStart = `${pad(istOneHour.getUTCHours())}:${pad(istOneHour.getUTCMinutes())}`;
    const windowEnd = `${pad(istTwoHours.getUTCHours())}:${pad(istTwoHours.getUTCMinutes())}`;

    try {
      const bookingsSnapshot = await db
        .collection("bookings")
        .where("date", "==", todayStr)
        .where("status", "==", "confirmed")
        .where("startTime", ">=", windowStart)
        .where("startTime", "<=", windowEnd)
        .get();

      let reminderCount = 0;

      for (const bookingDoc of bookingsSnapshot.docs) {
        const booking = bookingDoc.data();

        // Skip if reminder already sent
        if (booking.reminderSent) continue;

        await sendNotification(booking.userId, {
          type: "booking_reminder",
          title: "Upcoming Booking",
          body: `Your booking at ${booking.turfName || "the turf"} starts at ${booking.startTime}. Don't forget!`,
          data: { bookingId: bookingDoc.id },
        });

        // Mark reminder as sent
        await bookingDoc.ref.update({ reminderSent: true });
        reminderCount++;
      }

      console.log(`Sent ${reminderCount} booking reminder(s)`);
      return { reminderCount };
    } catch (error) {
      console.error("Error sending booking reminders:", error);
      throw error;
    }
  });
