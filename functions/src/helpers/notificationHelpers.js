const admin = require("firebase-admin");

/**
 * Map notification type to the screen and related type for navigation
 */
function getNotificationMeta(type, data) {
  switch (type) {
    // Payment-related
    case "booking_awaiting_payment":
      return { screen: "UpiPayment", relatedType: "booking" };
    case "payment_reminder":
      return { screen: "UpiPayment", relatedType: "booking" };
    case "payment_verified":
      return { screen: "Bookings", relatedType: "booking" };
    case "payment_rejected":
      return { screen: "Bookings", relatedType: "booking" };
    case "payment_verification_pending":
      return { screen: "VerifyPayment", relatedType: "booking" };
    case "payment_verification_escalation":
      return { screen: "Dashboard", relatedType: "booking" };
    case "booking_expired":
      return { screen: "Bookings", relatedType: "booking" };

    // Maintenance
    case "maintenance_report":
    case "maintenance_in_progress":
    case "maintenance_resolved":
    case "maintenance_rejected":
      return { screen: "MaintenanceLog", relatedType: "maintenance_log" };

    // Negotiation
    case "negotiation_accepted":
    case "negotiation_rejected":
    case "negotiation_countered":
    case "negotiation_expired":
      return { screen: "ChatScreen", relatedType: "chat" };

    // Turf requests
    case "turf_request_created":
      return { screen: "Dashboard", relatedType: "turf_request" };
    case "turf_request_approved":
    case "turf_request_rejected":
      return { screen: "Dashboard", relatedType: "turf_request" };

    // Booking
    case "booking_request":
      return { screen: "ManagerBookings", relatedType: "booking" };
    case "booking_confirmed":
      return { screen: "Bookings", relatedType: "booking" };
    case "booking_reminder":
      return { screen: "Bookings", relatedType: "booking" };

    // Chat
    case "chat_message":
      return { screen: "ChatScreen", relatedType: "chat" };

    // Academy
    case "academy_renewal_reminder":
      return { screen: "AcademyManagement", relatedType: "academy" };

    // Subscription
    case "subscription_expiry_warning":
    case "subscription_expired":
    case "subscription_deactivated":
    case "subscription_reactivated":
      return { screen: "OwnerSettings", relatedType: "subscription" };

    default:
      return { screen: "Dashboard", relatedType: "booking" };
  }
}

/**
 * Send notification to a specific user (creates Firestore doc + FCM push)
 */
async function sendNotification(userId, notification) {
  const userDoc = await admin.firestore().collection("users").doc(userId).get();
  const userData = userDoc.data();

  if (!userData) return;

  const meta = getNotificationMeta(notification.type, notification.data);
  const relatedId =
    notification.data?.bookingId ||
    notification.data?.logId ||
    notification.data?.requestId ||
    notification.data?.chatId ||
    notification.data?.academyId ||
    notification.data?.companyId ||
    null;

  // Create notification document
  await admin.firestore().collection("notifications").add({
    userId,
    userRole: userData.role,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    relatedId,
    relatedType: meta.relatedType,
    action: {
      screen: meta.screen,
      params: notification.data || {},
    },
    isRead: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Send FCM push notification
  if (userData.fcmTokens && userData.fcmTokens.length > 0) {
    try {
      await admin.messaging().sendMulticast({
        tokens: userData.fcmTokens,
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: {
          type: notification.type,
          ...Object.fromEntries(
            Object.entries(notification.data || {}).map(([k, v]) => [k, String(v)])
          ),
        },
      });
    } catch (error) {
      console.error("FCM send error:", error);
    }
  }
}

/**
 * Send notification to all managers of a turf
 */
async function notifyTurfManagers(turfId, notification) {
  const turfDoc = await admin.firestore().collection("turfs").doc(turfId).get();
  const turf = turfDoc.data();

  if (!turf || !turf.managerIds) return;

  for (const managerId of turf.managerIds) {
    await sendNotification(managerId, notification);
  }
}

/**
 * Send notification to all owners of a company
 */
async function notifyCompanyOwners(companyId, notification) {
  const companyDoc = await admin.firestore().collection("companies").doc(companyId).get();
  const company = companyDoc.data();

  if (!company || !company.ownerUserIds) return;

  for (const ownerId of company.ownerUserIds) {
    await sendNotification(ownerId, notification);
  }
}

module.exports = { sendNotification, notifyTurfManagers, notifyCompanyOwners };
