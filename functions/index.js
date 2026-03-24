/**
 * Cloud Functions for Turf Management System
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();

// Import modular functions
const slotLockFunctions = require("./src/slotLockFunctions");
const paymentFunctions = require("./src/paymentFunctions");
const bookingNotificationFunctions = require("./src/bookingNotificationFunctions");
const { sendNotification } = require("./src/helpers/notificationHelpers");
const academyFunctions = require("./src/academyFunctions");
const subscriptionFunctions = require("./src/subscriptionFunctions");
const userCleanupFunctions = require("./src/userCleanupFunctions");
const fraudPreventionFunctions = require("./src/fraudPreventionFunctions");
const bookingCleanupFunctions = require("./src/bookingCleanupFunctions");

// Slot Lock Functions
exports.releaseExpiredSlotLocks = slotLockFunctions.releaseExpiredSlotLocks;

// Payment Functions
exports.checkPaymentTimeouts = paymentFunctions.checkPaymentTimeouts;
exports.sendPaymentVerificationReminders = paymentFunctions.sendPaymentVerificationReminders;
exports.sendPaymentDeadlineReminders = paymentFunctions.sendPaymentDeadlineReminders;

// Booking & Turf Request Notification Functions
exports.onBookingStatusChange = bookingNotificationFunctions.onBookingStatusChange;
exports.onTurfRequestChange = bookingNotificationFunctions.onTurfRequestChange;
exports.onBookingCreated = bookingNotificationFunctions.onBookingCreated;
exports.sendBookingReminders = bookingNotificationFunctions.sendBookingReminders;

// Academy Functions
exports.generateAcademySessions = academyFunctions.generateAcademySessions;
exports.markPastSessionsCompleted = academyFunctions.markPastSessionsCompleted;
exports.onAcademyStatusChange = academyFunctions.onAcademyStatusChange;
exports.sendAcademyRenewalReminders = academyFunctions.sendAcademyRenewalReminders;
exports.expireAcademies = academyFunctions.expireAcademies;
exports.manualGenerateSessions = academyFunctions.manualGenerateSessions;

// User Cleanup Functions
exports.processSuspendedUserDeletion = userCleanupFunctions.processSuspendedUserDeletion;

// Fraud Prevention Functions
exports.cleanupOldTransactions = fraudPreventionFunctions.cleanupOldTransactions;

// Booking Cleanup Functions
exports.autoRejectExpiredPendingBookings = bookingCleanupFunctions.autoRejectExpiredPendingBookings;

// Subscription Functions
exports.checkSubscriptionExpiry = subscriptionFunctions.checkSubscriptionExpiry;
exports.enforceGracePeriod = subscriptionFunctions.enforceGracePeriod;
exports.sendSubscriptionExpiryWarnings = subscriptionFunctions.sendSubscriptionExpiryWarnings;
exports.onSubscriptionPaymentCompleted = subscriptionFunctions.onSubscriptionPaymentCompleted;

/**
 * Test function to verify deployment
 */
exports.testFunction = functions.https.onRequest((req, res) => {
  res.send("Functions are working!");
});

/**
 * Normalize ground ID for comparison (handles legacy formats)
 */
const normalizeGroundId = (groundId) => {
  if (!groundId) return "";
  return groundId.toLowerCase().replace(/[-_]/g, "");
};

/**
 * Expire conflicting negotiations when a booking is created or confirmed
 */
exports.onBookingCreatedOrConfirmed = functions.firestore
  .document("bookings/{bookingId}")
  .onWrite(async (change, context) => {
    const bookingId = context.params.bookingId;
    const afterData = change.after.exists ? change.after.data() : null;
    const beforeData = change.before.exists ? change.before.data() : null;

    const isNewConfirmedBooking = !beforeData && afterData?.status === "confirmed";
    const statusChangedToConfirmed = beforeData?.status !== "confirmed" && afterData?.status === "confirmed";

    if (!isNewConfirmedBooking && !statusChangedToConfirmed) {
      return null;
    }

    const { turfId, groundId, date, startTime, endTime } = afterData;
    const normalizedGroundId = normalizeGroundId(groundId);

    if (afterData.negotiation?.chatId) {
      return null;
    }

    console.log(`Booking ${bookingId}: Expiring conflicting negotiations`);

    let expiredCount = 0;

    try {
      const chatsSnapshot = await db
        .collection("chats")
        .where("hasActiveNegotiation", "==", true)
        .get();

      const batch = db.batch();
      const chatUpdates = new Map();

      for (const chatDoc of chatsSnapshot.docs) {
        const messagesSnapshot = await db
          .collection("chats")
          .doc(chatDoc.id)
          .collection("messages")
          .where("type", "==", "negotiation_card")
          .get();

        for (const messageDoc of messagesSnapshot.docs) {
          const message = messageDoc.data();
          const card = message.negotiationCard;

          if (!card || !["pending", "countered"].includes(card.status)) continue;
          if (card.turfId !== turfId) continue;
          if (normalizeGroundId(card.groundId) !== normalizedGroundId) continue;
          if (card.date !== date) continue;
          if (!(card.startTime < endTime && card.endTime > startTime)) continue;

          batch.update(messageDoc.ref, {
            "negotiationCard.status": "expired",
            "negotiationCard.expiredAt": admin.firestore.FieldValue.serverTimestamp(),
            "negotiationCard.expiredReason": "Slot was booked by another user",
          });

          expiredCount++;
          if (!chatUpdates.has(chatDoc.id)) chatUpdates.set(chatDoc.id, true);
        }
      }

      for (const chatId of chatUpdates.keys()) {
        const remaining = await db
          .collection("chats")
          .doc(chatId)
          .collection("messages")
          .where("type", "==", "negotiation_card")
          .where("negotiationCard.status", "in", ["pending", "countered"])
          .limit(1)
          .get();

        if (remaining.empty) {
          batch.update(db.collection("chats").doc(chatId), {
            hasActiveNegotiation: false,
          });
        }
      }

      if (expiredCount > 0) await batch.commit();
      return { expiredCount };
    } catch (error) {
      console.error(`Error:`, error);
      throw error;
    }
  });

/**
 * Clean up expired negotiations - runs daily at 3 AM IST
 */
exports.cleanupExpiredNegotiations = functions.pubsub
  .schedule("0 3 * * *")
  .timeZone("Asia/Kolkata")
  .onRun(async () => {
    console.log("Starting cleanup...");
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - 24);

    let cleanedCount = 0;
    const chatsSnapshot = await db.collection("chats").get();

    for (const chatDoc of chatsSnapshot.docs) {
      const messagesSnapshot = await db
        .collection("chats")
        .doc(chatDoc.id)
        .collection("messages")
        .where("type", "==", "negotiation_card")
        .where("negotiationCard.status", "==", "expired")
        .get();

      for (const messageDoc of messagesSnapshot.docs) {
        const expiredAt = messageDoc.data().negotiationCard?.expiredAt?.toDate?.();
        if (expiredAt && expiredAt < cutoffDate) {
          await messageDoc.ref.update({
            "negotiationCard.cleaned": true,
            "negotiationCard.cleanedAt": admin.firestore.FieldValue.serverTimestamp(),
          });
          cleanedCount++;
        }
      }
    }

    console.log(`Cleanup complete: ${cleanedCount}`);
    return { cleanedCount };
  });

/**
 * Send notification when maintenance log is created
 */
exports.onMaintenanceLogCreated = functions.firestore
  .document("maintenance_logs/{logId}")
  .onCreate(async (snap, context) => {
    const logId = context.params.logId;
    const logData = snap.data();

    console.log(`Maintenance log ${logId} created`);

    const {
      turfId,
      turfName,
      groundName,
      issueType,
      issueTypeLabel,
      priority,
      priorityLabel,
      reportedByName,
    } = logData;

    if (!turfId) {
      console.log("No turfId on maintenance log, skipping");
      return null;
    }

    try {
      const { notifyTurfManagers } = require("./src/helpers/notificationHelpers");

      await notifyTurfManagers(turfId, {
        type: "maintenance_report",
        title: `New Maintenance Report - ${priorityLabel || priority} Priority`,
        body: `${reportedByName || "Caretaker"} reported a ${issueTypeLabel || issueType} issue at ${groundName} (${turfName}).`,
        data: { logId },
      });

      console.log(`Maintenance notifications sent for log ${logId}`);
      return null;
    } catch (error) {
      console.error("Error sending maintenance notifications:", error);
      throw error;
    }
  });

/**
 * Send notification when maintenance log status changes
 */
exports.onMaintenanceLogStatusChange = functions.firestore
  .document("maintenance_logs/{logId}")
  .onUpdate(async (change, context) => {
    const logId = context.params.logId;
    const beforeData = change.before.data();
    const afterData = change.after.data();

    const beforeStatus = beforeData.status;
    const afterStatus = afterData.status;

    // Only trigger on status change
    if (beforeStatus === afterStatus) {
      return null;
    }

    console.log(`Maintenance log ${logId}: ${beforeStatus} -> ${afterStatus}`);

    const { reportedBy, turfName, groundName, issueTypeLabel } = afterData;

    let notificationTitle = "";
    let notificationBody = "";

    switch (afterStatus) {
      case "in_progress":
        notificationTitle = "Maintenance In Progress";
        notificationBody = `Your ${issueTypeLabel} issue at ${groundName} is being addressed.`;
        break;
      case "resolved":
        notificationTitle = "Issue Resolved";
        notificationBody = `Your ${issueTypeLabel} issue at ${groundName} has been resolved.`;
        break;
      case "rejected":
        notificationTitle = "Report Declined";
        notificationBody = `Your ${issueTypeLabel} report for ${groundName} was declined.`;
        break;
      default:
        return null;
    }

    // Notify the caretaker who reported the issue
    await sendNotification(reportedBy, {
      type: `maintenance_${afterStatus}`,
      title: notificationTitle,
      body: notificationBody,
      data: { logId },
    });

    console.log(`Notification sent to caretaker ${reportedBy}`);
    return { notified: reportedBy };
  });

/**
 * Send notification when negotiation status changes
 */
exports.onNegotiationStatusChange = functions.firestore
  .document("chats/{chatId}/messages/{messageId}")
  .onUpdate(async (change, context) => {
    const { chatId, messageId } = context.params;
    const beforeData = change.before.data();
    const afterData = change.after.data();

    if (afterData.type !== "negotiation_card") return null;

    const beforeStatus = beforeData.negotiationCard?.status;
    const afterStatus = afterData.negotiationCard?.status;

    if (beforeStatus === afterStatus) return null;

    console.log(`Negotiation ${messageId}: ${beforeStatus} -> ${afterStatus}`);

    const chatDoc = await db.collection("chats").doc(chatId).get();
    if (!chatDoc.exists) return null;

    const chatData = chatDoc.data();
    const card = afterData.negotiationCard;

    let notifyUserId = null;
    let notificationTitle = "";
    let notificationBody = "";

    switch (afterStatus) {
      case "accepted":
        notifyUserId = afterData.senderId;
        notificationTitle = "Booking Confirmed!";
        notificationBody = `Your booking for ${card.turfName} on ${card.date} has been confirmed.`;
        break;
      case "rejected":
        notifyUserId = afterData.senderId;
        notificationTitle = "Booking Request Declined";
        notificationBody = `Your booking request for ${card.turfName} was not accepted.`;
        break;
      case "countered":
        notifyUserId = afterData.senderId;
        notificationTitle = "Counter Offer Received";
        notificationBody = `Manager offered ₹${card.counterPrice} for ${card.turfName}.`;
        break;
      case "expired":
        notifyUserId = afterData.senderId;
        notificationTitle = "Booking Request Expired";
        notificationBody = `Your booking request for ${card.turfName} expired.`;
        break;
      default:
        return null;
    }

    if (!notifyUserId) return null;

    await sendNotification(notifyUserId, {
      type: `negotiation_${afterStatus}`,
      title: notificationTitle,
      body: notificationBody,
      data: { chatId },
    });

    return { notified: notifyUserId };
  });

/**
 * Send notification when a new chat message is sent
 */
exports.onNewChatMessage = functions.firestore
  .document("chats/{chatId}/messages/{messageId}")
  .onCreate(async (snap, context) => {
    const { chatId, messageId } = context.params;
    const messageData = snap.data();

    // Only notify for text messages (not negotiation cards, system messages, etc.)
    if (messageData.type && messageData.type !== "text") {
      return null;
    }

    const senderId = messageData.senderId;
    if (!senderId) return null;

    // Get the chat doc to find the other participant
    const chatDoc = await db.collection("chats").doc(chatId).get();
    if (!chatDoc.exists) return null;

    const chatData = chatDoc.data();
    const participants = chatData.participants || [];

    // Find the recipient (the other participant)
    const recipientId = participants.find((id) => id !== senderId);
    if (!recipientId) return null;

    // Don't notify if sender == recipient
    if (senderId === recipientId) return null;

    const senderName = messageData.senderName || "Someone";
    const messageText = messageData.text || "Sent you a message";
    const truncatedText = messageText.length > 80
      ? messageText.substring(0, 80) + "..."
      : messageText;

    await sendNotification(recipientId, {
      type: "chat_message",
      title: `Message from ${senderName}`,
      body: truncatedText,
      data: { chatId },
    });

    return null;
  });
