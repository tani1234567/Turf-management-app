import React, { memo } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { Text, Avatar, Badge } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS } from "../../constants/theme";

/**
 * Format timestamp to readable string
 */
const formatTimestamp = (timestamp) => {
  if (!timestamp) return "";

  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    // Today - show time
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    // Within a week - show day name
    return date.toLocaleDateString("en-US", { weekday: "short" });
  } else {
    // Older - show date
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }
};

/**
 * Truncate text with ellipsis
 */
const truncateText = (text, maxLength = 40) => {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
};

/**
 * ChatListItem component for displaying a chat in the list
 * @param {object} props
 * @param {object} props.chat - Chat data
 * @param {string} props.viewerType - "user" | "manager"
 * @param {string} props.viewerId - Current viewer's user ID
 * @param {function} props.onPress - Press handler
 */
const ChatListItem = ({ chat, viewerType, viewerId, onPress }) => {
  // Determine display name and avatar based on viewer type
  const isUserViewer = viewerType === "user";
  const displayName = isUserViewer
    ? chat.participants?.company?.name || "Company"
    : chat.participants?.user?.name || "User";
  const avatarUri = isUserViewer
    ? chat.participants?.company?.avatar
    : chat.participants?.user?.avatar;

  // Get unread count based on viewer type
  const unreadCount = isUserViewer
    ? chat.unreadCount?.[viewerId] || 0
    : chat.unreadCount?.company || 0;

  // Format last message
  const lastMessage = chat.lastMessage;
  let lastMessageText = "No messages yet";
  let lastMessageIcon = null;

  if (lastMessage) {
    if (lastMessage.type === "negotiation_card") {
      lastMessageText = lastMessage.text || "Booking request";
      lastMessageIcon = "calendar-clock";
    } else if (lastMessage.type === "booking_card") {
      lastMessageText = "Booking confirmation";
      lastMessageIcon = "calendar-check";
    } else if (lastMessage.type === "location") {
      lastMessageText = "Location shared";
      lastMessageIcon = "map-marker";
    } else if (lastMessage.type === "image") {
      lastMessageText = "Image";
      lastMessageIcon = "image";
    } else {
      lastMessageText = lastMessage.text || "";
    }

    // Prefix with sender if it's not the viewer
    const isOwnMessage = lastMessage.senderId === viewerId;
    if (isOwnMessage && lastMessage.type === "text") {
      lastMessageText = `You: ${lastMessageText}`;
    }
  }

  // Check for active negotiation
  const hasActiveNegotiation = chat.hasActiveNegotiation;

  // Get initials for avatar fallback
  const getInitials = (name) => {
    if (!name) return "?";
    const words = name.split(" ");
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <TouchableOpacity
      style={[styles.container, unreadCount > 0 && styles.unreadContainer]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Avatar */}
      <View style={styles.avatarContainer}>
        {avatarUri ? (
          <Avatar.Image size={52} source={{ uri: avatarUri }} />
        ) : (
          <Avatar.Text
            size={52}
            label={getInitials(displayName)}
            style={[
              styles.avatarFallback,
              { backgroundColor: isUserViewer ? COLORS.secondary : COLORS.primary },
            ]}
          />
        )}
        {/* Online indicator could go here */}
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text
            variant="titleMedium"
            style={[styles.name, unreadCount > 0 && styles.unreadName]}
            numberOfLines={1}
          >
            {displayName}
          </Text>
          <Text
            variant="bodySmall"
            style={[styles.timestamp, unreadCount > 0 && styles.unreadTimestamp]}
          >
            {formatTimestamp(chat.updatedAt || chat.lastMessage?.timestamp)}
          </Text>
        </View>

        <View style={styles.messageRow}>
          <View style={styles.messageContent}>
            {lastMessageIcon && (
              <MaterialCommunityIcons
                name={lastMessageIcon}
                size={16}
                color={unreadCount > 0 ? COLORS.text : COLORS.textSecondary}
                style={styles.messageIcon}
              />
            )}
            <Text
              variant="bodyMedium"
              style={[styles.message, unreadCount > 0 && styles.unreadMessage]}
              numberOfLines={1}
            >
              {truncateText(lastMessageText)}
            </Text>
          </View>

          <View style={styles.indicators}>
            {/* Negotiation indicator */}
            {hasActiveNegotiation && (
              <View style={styles.negotiationBadge}>
                <MaterialCommunityIcons
                  name="handshake-outline"
                  size={16}
                  color={COLORS.warning}
                />
              </View>
            )}

            {/* Unread badge */}
            {unreadCount > 0 && (
              <Badge style={styles.unreadBadge} size={22}>
                {unreadCount > 99 ? "99+" : unreadCount}
              </Badge>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    padding: 12,
    paddingHorizontal: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  unreadContainer: {
    backgroundColor: "#f8f9ff",
  },
  avatarContainer: {
    marginRight: 12,
    position: "relative",
  },
  avatarFallback: {
    backgroundColor: COLORS.primary,
  },
  content: {
    flex: 1,
    justifyContent: "center",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  name: {
    flex: 1,
    fontWeight: "600",
    color: COLORS.text,
    marginRight: 8,
  },
  unreadName: {
    fontWeight: "bold",
  },
  timestamp: {
    color: COLORS.textSecondary,
  },
  unreadTimestamp: {
    color: COLORS.primary,
    fontWeight: "600",
  },
  messageRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  messageContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginRight: 8,
  },
  messageIcon: {
    marginRight: 4,
  },
  message: {
    flex: 1,
    color: COLORS.textSecondary,
  },
  unreadMessage: {
    color: COLORS.text,
    fontWeight: "500",
  },
  indicators: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  negotiationBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FFF3E0",
    justifyContent: "center",
    alignItems: "center",
  },
  unreadBadge: {
    backgroundColor: COLORS.primary,
    color: "#fff",
  },
});

export default memo(ChatListItem);
