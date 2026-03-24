// Safely import expo-notifications (native module may not be available in Expo Go)
let Notifications = null;
try {
  Notifications = require("expo-notifications");
} catch (e) {
  console.warn(
    "[Notifications] expo-notifications native module not available:",
    e.message
  );
}

// Navigation reference for deep linking from notifications
let navigationRef = null;

/**
 * Set the navigation reference for notification deep linking
 * @param {object} ref - React Navigation ref
 */
export function setNavigationRef(ref) {
  navigationRef = ref;
}

/**
 * Map notification type to screen name and params
 */
function getNavigationTarget(type, data) {
  switch (type) {
    // Payment-related
    case "booking_awaiting_payment":
      return { screen: "UpiPayment", params: { bookingId: data?.bookingId } };
    case "payment_reminder":
      return { screen: "UpiPayment", params: { bookingId: data?.bookingId } };
    case "payment_verified":
      return { screen: "Bookings", params: { bookingId: data?.bookingId } };
    case "payment_rejected":
      return { screen: "Bookings", params: { bookingId: data?.bookingId } };
    case "booking_expired":
      return { screen: "Bookings", params: { bookingId: data?.bookingId } };

    // Manager payment verification
    case "payment_verification_pending":
      return { screen: "VerifyPayment", params: { bookingId: data?.bookingId } };
    case "payment_verification_escalation":
      return { screen: "Dashboard", params: { bookingId: data?.bookingId } };

    // Maintenance
    case "maintenance_report":
    case "maintenance_in_progress":
    case "maintenance_resolved":
    case "maintenance_rejected":
      return { screen: "MaintenanceLog", params: { logId: data?.logId } };

    // Negotiation / Chat
    case "negotiation_accepted":
    case "negotiation_rejected":
    case "negotiation_countered":
    case "negotiation_expired":
      return { screen: "ChatScreen", params: { chatId: data?.chatId } };

    // Turf requests
    case "turf_request_created":
      return { screen: "Dashboard", params: { requestId: data?.requestId } };
    case "turf_request_approved":
    case "turf_request_rejected":
      return { screen: "Dashboard", params: { requestId: data?.requestId } };

    // Booking
    case "booking_request":
      return { screen: "ManagerBookings", params: { bookingId: data?.bookingId } };
    case "booking_confirmed":
      return { screen: "Bookings", params: { bookingId: data?.bookingId } };
    case "booking_rejected":
      return { screen: "Bookings", params: { bookingId: data?.bookingId } };
    case "booking_reminder":
      return { screen: "Bookings", params: { bookingId: data?.bookingId } };

    // Chat message
    case "chat_message":
      return { screen: "ChatScreen", params: { chatId: data?.chatId } };

    // Academy
    case "academy_renewal_reminder":
      return { screen: "AcademyManagement", params: { academyId: data?.academyId } };

    // Subscription
    case "subscription_expiry_warning":
    case "subscription_expired":
    case "subscription_deactivated":
    case "subscription_reactivated":
      return { screen: "OwnerSettings", params: { companyId: data?.companyId } };

    default:
      return null;
  }
}

/**
 * Handle notification received while app is in foreground
 * This is called by the notification handler set in setup.js
 */
export function handleNotificationReceived(notification) {
  const { title, body } = notification.request.content;
  const data = notification.request.content.data;
  console.log("[Notifications] Foreground notification:", title, data?.type);
}

/**
 * Handle user tapping on a notification
 * Navigate to the relevant screen
 */
export function handleNotificationResponse(response) {
  const data = response.notification.request.content.data;
  const type = data?.type;

  if (!type || !navigationRef) {
    return;
  }

  const target = getNavigationTarget(type, data);
  if (target) {
    try {
      // Handle nested tab screens that can't be navigated to directly
      const NESTED_TAB_SCREENS = {
        ManagerBookings: { parent: "ManagerTabs", tab: "ManagerBookings" },
      };

      const nested = NESTED_TAB_SCREENS[target.screen];
      if (nested) {
        navigationRef.navigate(nested.parent, {
          screen: nested.tab,
          params: target.params,
        });
      } else {
        navigationRef.navigate(target.screen, target.params);
      }
    } catch (error) {
      console.error("[Notifications] Navigation error:", error);
    }
  }
}

/**
 * Handle cold-start notification tap (app was fully closed when notification arrived)
 * Call this in NavigationContainer onReady, after setNavigationRef()
 */
export async function handleInitialNotification() {
  if (!Notifications) return;
  try {
    const response = await Notifications.getLastNotificationResponseAsync();
    if (response) handleNotificationResponse(response);
  } catch (error) {
    console.error("[Notifications] Error handling initial notification:", error);
  }
}

/**
 * Register notification listeners
 * @returns {function} Cleanup function to remove listeners
 */
export function registerNotificationListeners() {
  if (!Notifications) {
    return () => {};
  }

  const receivedSubscription = Notifications.addNotificationReceivedListener(
    handleNotificationReceived
  );

  const responseSubscription =
    Notifications.addNotificationResponseReceivedListener(
      handleNotificationResponse
    );

  return () => {
    receivedSubscription.remove();
    responseSubscription.remove();
  };
}
