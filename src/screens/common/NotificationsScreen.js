import React, { useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { Text, Surface, ActivityIndicator, IconButton } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNotifications } from "../../hooks";

// Map notification type to icon and color
const getNotificationIcon = (type) => {
  switch (type) {
    // Payment
    case "payment_verification_pending":
      return { icon: "cash-clock", color: "#FF9800" };
    case "payment_verification_escalation":
      return { icon: "alert-circle", color: "#F44336" };
    case "payment_verified":
      return { icon: "cash-check", color: "#4CAF50" };
    case "payment_rejected":
      return { icon: "cash-remove", color: "#F44336" };
    case "payment_reminder":
      return { icon: "clock-alert", color: "#FF9800" };

    // Booking
    case "booking_awaiting_payment":
      return { icon: "credit-card-clock", color: "#2196F3" };
    case "booking_expired":
      return { icon: "calendar-remove", color: "#F44336" };
    case "booking_request":
      return { icon: "calendar-plus", color: "#4CAF50" };
    case "booking_confirmed":
      return { icon: "calendar-check", color: "#4CAF50" };
    case "booking_reminder":
      return { icon: "calendar-clock", color: "#FF9800" };

    // Maintenance
    case "maintenance_report":
      return { icon: "wrench", color: "#FF9800" };
    case "maintenance_in_progress":
      return { icon: "progress-wrench", color: "#2196F3" };
    case "maintenance_resolved":
      return { icon: "check-circle", color: "#4CAF50" };
    case "maintenance_rejected":
      return { icon: "close-circle", color: "#F44336" };

    // Negotiation
    case "negotiation_accepted":
      return { icon: "handshake", color: "#4CAF50" };
    case "negotiation_rejected":
      return { icon: "handshake-outline", color: "#F44336" };
    case "negotiation_countered":
      return { icon: "swap-horizontal", color: "#FF9800" };
    case "negotiation_expired":
      return { icon: "timer-off", color: "#757575" };

    // Chat
    case "chat_message":
      return { icon: "message-text", color: "#2196F3" };

    // Turf requests
    case "turf_request_created":
      return { icon: "soccer-field", color: "#2196F3" };
    case "turf_request_approved":
      return { icon: "check-decagram", color: "#4CAF50" };
    case "turf_request_rejected":
      return { icon: "close-octagon", color: "#F44336" };

    default:
      return { icon: "bell", color: "#757575" };
  }
};

// Format timestamp to relative time string
const formatTimeAgo = (timestamp) => {
  if (!timestamp) return "";

  let date;
  if (timestamp.toDate) {
    date = timestamp.toDate();
  } else if (timestamp.seconds) {
    date = new Date(timestamp.seconds * 1000);
  } else {
    date = new Date(timestamp);
  }

  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
};

function NotificationItem({ notification, onPress, onDelete }) {
  const { icon, color } = getNotificationIcon(notification.type);
  const isUnread = !notification.isRead;

  return (
    <TouchableOpacity onPress={() => onPress(notification)} activeOpacity={0.7}>
      <Surface
        style={[
          styles.notificationCard,
          isUnread && styles.unreadCard,
        ]}
        elevation={isUnread ? 2 : 1}
      >
        <View style={[styles.iconContainer, { backgroundColor: color + "20" }]}>
          <MaterialCommunityIcons name={icon} size={24} color={color} />
        </View>
        <View style={styles.contentContainer}>
          <View style={styles.headerRow}>
            <Text
              style={[styles.title, isUnread && styles.unreadTitle]}
              numberOfLines={1}
            >
              {notification.title}
            </Text>
            <Text style={styles.timeText}>
              {formatTimeAgo(notification.createdAt)}
            </Text>
          </View>
          <Text style={styles.body} numberOfLines={2}>
            {notification.body}
          </Text>
        </View>
        {isUnread && <View style={styles.unreadDot} />}
        <IconButton
          icon="delete-outline"
          size={18}
          iconColor="#999"
          style={styles.deleteButton}
          onPress={() => onDelete(notification.id)}
        />
      </Surface>
    </TouchableOpacity>
  );
}

function EmptyState() {
  return (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons name="bell-off-outline" size={64} color="#ccc" />
      <Text style={styles.emptyTitle}>No notifications</Text>
      <Text style={styles.emptySubtitle}>
        You're all caught up! New notifications will appear here.
      </Text>
    </View>
  );
}

export default function NotificationsScreen({ navigation }) {
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
  } = useNotifications();

  const handleNotificationPress = useCallback(
    async (notification) => {
      // Mark as read
      if (!notification.isRead) {
        await markAsRead(notification.id);
      }

      // Navigate to the relevant screen based on action
      const action = notification.action;
      if (action?.screen) {
        try {
          // Handle nested tab screens that can't be navigated to directly
          const NESTED_TAB_SCREENS = {
            Bookings: { parent: "UserTabs", tab: "Bookings" },
            ManagerBookings: { parent: "ManagerTabs", tab: "ManagerBookings" },
          };

          const nested = NESTED_TAB_SCREENS[action.screen];
          if (nested) {
            navigation.navigate(nested.parent, {
              screen: nested.tab,
              params: action.params || {},
            });
          } else {
            navigation.navigate(action.screen, action.params || {});
          }
        } catch (error) {
          // Screen might not exist in current navigator, just mark as read
          console.log("[Notifications] Could not navigate to:", action.screen);
        }
      }
    },
    [markAsRead, navigation]
  );

  const handleDelete = useCallback(
    async (notificationId) => {
      if (deleteNotification) {
        await deleteNotification(notificationId);
      }
    },
    [deleteNotification]
  );

  const renderItem = useCallback(
    ({ item }) => (
      <NotificationItem
        notification={item}
        onPress={handleNotificationPress}
        onDelete={handleDelete}
      />
    ),
    [handleNotificationPress, handleDelete]
  );

  const keyExtractor = useCallback((item) => item.id, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <IconButton
            icon="arrow-left"
            size={24}
            onPress={() => navigation.goBack()}
          />
          <Text style={styles.headerTitle}>Notifications</Text>
          <View style={{ width: 48 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <IconButton
          icon="arrow-left"
          size={24}
          onPress={() => navigation.goBack()}
        />
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.headerActions}>
          {unreadCount > 0 && (
            <TouchableOpacity
              onPress={markAllAsRead}
              style={styles.markAllButton}
            >
              <Text style={styles.markAllText}>Mark all read</Text>
            </TouchableOpacity>
          )}
          {notifications.length > 0 && (
            <TouchableOpacity
              onPress={clearAllNotifications}
              style={styles.markAllButton}
            >
              <Text style={[styles.markAllText, { color: "#F44336" }]}>Clear all</Text>
            </TouchableOpacity>
          )}
          {notifications.length === 0 && unreadCount === 0 && (
            <View style={{ width: 48 }} />
          )}
        </View>
      </View>

      <FlatList
        data={notifications}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={[
          styles.listContent,
          notifications.length === 0 && styles.emptyList,
        ]}
        ListEmptyComponent={EmptyState}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={() => {}} />
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingVertical: 8,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#212121",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  markAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  markAllText: {
    fontSize: 13,
    color: "#2196F3",
    fontWeight: "600",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    padding: 12,
    paddingBottom: 24,
  },
  emptyList: {
    flex: 1,
  },
  notificationCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: "#fff",
  },
  unreadCard: {
    backgroundColor: "#E3F2FD",
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  contentContainer: {
    flex: 1,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: "500",
    color: "#212121",
    flex: 1,
    marginRight: 8,
  },
  unreadTitle: {
    fontWeight: "700",
  },
  timeText: {
    fontSize: 12,
    color: "#999",
  },
  body: {
    fontSize: 13,
    color: "#666",
    lineHeight: 18,
  },
  deleteButton: {
    margin: 0,
    marginLeft: 4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#2196F3",
    marginLeft: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#999",
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#bbb",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
});
