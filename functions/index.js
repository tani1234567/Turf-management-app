/**
 * Cloud Functions for Turf Management System
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();

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

    await db.collection("notifications").add({
      userId: notifyUserId,
      type: `negotiation_${afterStatus}`,
      title: notificationTitle,
      body: notificationBody,
      relatedId: chatId,
      isRead: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { notified: notifyUserId };
  });
