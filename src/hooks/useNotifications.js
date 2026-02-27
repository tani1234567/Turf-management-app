import { useState, useEffect, useCallback, useRef } from "react";
import { Platform } from "react-native";
import { useAppSelector } from "./useAppSelector";
import { selectUser } from "../store/slices/authSlice";
import {
  subscribeToCollection,
  updateDocument,
  deleteDocument,
} from "../services/firebase/firestore";
import {
  getPushToken,
  saveFCMToken,
  removeFCMToken,
  setBadgeCount,
} from "../services/notifications/setup";

/**
 * Custom hook for managing notifications
 * - Subscribes to real-time notifications from Firestore
 * - Manages FCM token registration
 * - Provides mark as read / clear actions
 */
export const useNotifications = () => {
  const user = useAppSelector(selectUser);
  const userId = user?.userId;
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const tokenRef = useRef(null);

  // Register FCM token when user is authenticated
  useEffect(() => {
    if (!userId || Platform.OS === "web") return;

    const registerToken = async () => {
      try {
        const token = await getPushToken();
        if (token) {
          tokenRef.current = token;
          await saveFCMToken(userId, token);
        }
      } catch (error) {
        console.error("[useNotifications] Token registration error:", error);
      }
    };

    registerToken();
  }, [userId]);

  // Subscribe to notifications collection in real-time
  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribe = subscribeToCollection(
      "notifications",
      (docs) => {
        // Sort by createdAt descending (newest first)
        const sorted = docs.sort((a, b) => {
          const aTime = a.createdAt?.seconds || 0;
          const bTime = b.createdAt?.seconds || 0;
          return bTime - aTime;
        });
        setNotifications(sorted);
        setLoading(false);

        // Update badge count
        const unreadCount = sorted.filter((n) => !n.isRead).length;
        setBadgeCount(unreadCount);
      },
      [{ field: "userId", operator: "==", value: userId }]
    );

    return () => unsubscribe();
  }, [userId]);

  // Computed unread count
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // Mark a single notification as read
  const markAsRead = useCallback(async (notificationId) => {
    try {
      await updateDocument("notifications", notificationId, { isRead: true });
    } catch (error) {
      console.error("[useNotifications] Error marking as read:", error);
    }
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    try {
      const unread = notifications.filter((n) => !n.isRead);
      const promises = unread.map((n) =>
        updateDocument("notifications", n.id, { isRead: true })
      );
      await Promise.all(promises);
      setBadgeCount(0);
    } catch (error) {
      console.error("[useNotifications] Error marking all as read:", error);
    }
  }, [notifications]);

  // Delete a single notification
  const deleteNotification = useCallback(async (notificationId) => {
    try {
      await deleteDocument("notifications", notificationId);
    } catch (error) {
      console.error("[useNotifications] Error deleting notification:", error);
    }
  }, []);

  // Clear all notifications for the user
  const clearAllNotifications = useCallback(async () => {
    try {
      const promises = notifications.map((n) =>
        deleteDocument("notifications", n.id)
      );
      await Promise.all(promises);
      setBadgeCount(0);
    } catch (error) {
      console.error("[useNotifications] Error clearing notifications:", error);
    }
  }, [notifications]);

  // Remove FCM token (call on logout)
  const cleanupToken = useCallback(async () => {
    if (userId && tokenRef.current) {
      try {
        await removeFCMToken(userId, tokenRef.current);
        tokenRef.current = null;
      } catch (error) {
        console.error("[useNotifications] Error cleaning up token:", error);
      }
    }
  }, [userId]);

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    cleanupToken,
  };
};

export default useNotifications;
