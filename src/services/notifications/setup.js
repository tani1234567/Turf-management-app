import { Platform } from "react-native";
import { updateDocument, getDocument } from "../firebase/firestore";

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

// Configure how notifications appear when app is in foreground
if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

/**
 * Request notification permissions from the user
 * @returns {boolean} Whether permissions were granted
 */
export async function requestPermissions() {
  if (Platform.OS === "web" || !Notifications) {
    return false;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();

  if (existingStatus === "granted") {
    return true;
  }

  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

/**
 * Get the device push token (Expo push token for FCM)
 * @returns {string|null} The push token or null
 */
export async function getPushToken() {
  if (Platform.OS === "web" || !Notifications) {
    return null;
  }

  try {
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      console.log("[Notifications] Permission not granted");
      return null;
    }

    // Get the device push token (FCM on Android, APNs on iOS)
    const tokenData = await Notifications.getDevicePushTokenAsync();
    console.log("[Notifications] Push token:", tokenData.data);
    return tokenData.data;
  } catch (error) {
    // SERVICE_NOT_AVAILABLE is expected on emulators or when Google Play
    // Services is temporarily unreachable — not a real error.
    const msg = error?.message || "";
    if (msg.includes("SERVICE_NOT_AVAILABLE")) {
      console.log("[Notifications] FCM unavailable (emulator or no Play Services) — push notifications disabled");
    } else {
      console.warn("[Notifications] Could not get push token:", msg);
    }
    return null;
  }
}

/**
 * Save FCM token to the user's document in Firestore
 * @param {string} userId - The user's ID
 * @param {string} token - The FCM token
 */
export async function saveFCMToken(userId, token) {
  if (!userId || !token) return;

  try {
    const userData = await getDocument("users", userId);
    const existingTokens = userData?.fcmTokens || [];

    // Don't add duplicate tokens
    if (existingTokens.includes(token)) {
      return;
    }

    await updateDocument("users", userId, {
      fcmTokens: [...existingTokens, token],
    });
    console.log("[Notifications] FCM token saved for user:", userId);
  } catch (error) {
    console.error("[Notifications] Error saving FCM token:", error);
  }
}

/**
 * Remove FCM token from the user's document (on logout)
 * @param {string} userId - The user's ID
 * @param {string} token - The FCM token to remove
 */
export async function removeFCMToken(userId, token) {
  if (!userId || !token) return;

  try {
    const userData = await getDocument("users", userId);
    const existingTokens = userData?.fcmTokens || [];
    const updatedTokens = existingTokens.filter((t) => t !== token);

    await updateDocument("users", userId, {
      fcmTokens: updatedTokens,
    });
    console.log("[Notifications] FCM token removed for user:", userId);
  } catch (error) {
    console.error("[Notifications] Error removing FCM token:", error);
  }
}

/**
 * Set the badge count on the app icon
 * @param {number} count - Badge count
 */
export async function setBadgeCount(count) {
  if (Platform.OS === "web" || !Notifications) return;

  try {
    await Notifications.setBadgeCountAsync(count);
  } catch (error) {
    // Badge count not supported on all platforms
  }
}
