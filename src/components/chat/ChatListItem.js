import React, { memo, useCallback } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Text, Avatar, Badge } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS, FONTS } from "../../constants/theme";

const USER_COLOR = "#4CAF50";

/**
 * Format timestamp: Today → time, Yesterday → "Yesterday", <7d → weekday, else → "Dec 12"
 */
const formatTimestamp = (timestamp) => {
  if (!timestamp) return "";
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return date.toLocaleDateString("en-US", { weekday: "short" });
  } else {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
};

const getInitials = (name) => {
  if (!name) return "?";
  const words = name.trim().split(" ");
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
};

/**
 * ChatListItem — modern WhatsApp-style conversation row
 */
const ChatListItem = ({ chat, viewerType, viewerId, onPress }) => {
  const isUserViewer = viewerType === "user";
  const displayName = isUserViewer
    ? chat.participants?.company?.name || "Company"
    : chat.participants?.user?.name || "User";
  const avatarUri = isUserViewer
    ? chat.participants?.company?.avatar
    : chat.participants?.user?.avatar;

  const unreadCount = isUserViewer
    ? chat.unreadCount?.[viewerId] || 0
    : chat.unreadCount?.company || 0;

  const hasUnread = unreadCount > 0;
  const hasActiveNegotiation = chat.hasActiveNegotiation;
  const isOnline = chat.participants?.company?.isOnline || false;

  // Build last message preview
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
      lastMessageText = "Photo";
      lastMessageIcon = "image-outline";
    } else {
      const isOwn = lastMessage.senderId === viewerId;
      lastMessageText = isOwn
        ? `You: ${lastMessage.text || ""}`
        : lastMessage.text || "";
    }
  }

  const timestamp = formatTimestamp(chat.updatedAt || chat.lastMessage?.timestamp);

  const handleLongPress = useCallback(() => {
    Alert.alert(displayName, "Options", [
      { text: "Mark as Read", onPress: () => {} },
      { text: "Archive", onPress: () => {} },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [displayName]);

  return (
    <TouchableOpacity
      style={[styles.container, hasUnread ? styles.unreadBg : styles.readBg]}
      onPress={onPress}
      onLongPress={handleLongPress}
      activeOpacity={0.75}
      delayLongPress={400}
    >
      {/* Avatar + online dot */}
      <View style={styles.avatarWrapper}>
        {avatarUri ? (
          <Avatar.Image size={50} source={{ uri: avatarUri }} style={styles.avatar} />
        ) : (
          <Avatar.Text
            size={50}
            label={getInitials(displayName)}
            style={[
              styles.avatarFallback,
              { backgroundColor: isUserViewer ? COLORS.secondary : COLORS.primary },
            ]}
            labelStyle={styles.avatarLabel}
          />
        )}
        {isOnline && <View style={styles.onlineDot} />}
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Row 1: name + timestamp */}
        <View style={styles.topRow}>
          <Text
            style={[styles.name, hasUnread && styles.nameUnread]}
            numberOfLines={1}
          >
            {displayName}
          </Text>
          <Text style={[styles.timestamp, hasUnread && styles.timestampUnread]}>
            {timestamp}
          </Text>
        </View>

        {/* Row 2: message preview + badges */}
        <View style={styles.bottomRow}>
          <View style={styles.previewRow}>
            {lastMessageIcon && (
              <MaterialCommunityIcons
                name={lastMessageIcon}
                size={14}
                color={hasUnread ? COLORS.text : COLORS.textSecondary}
                style={styles.previewIcon}
              />
            )}
            <Text
              style={[styles.preview, hasUnread && styles.previewUnread]}
              numberOfLines={2}
            >
              {lastMessageText}
            </Text>
          </View>

          <View style={styles.badgeRow}>
            {hasActiveNegotiation && (
              <View style={styles.negotiationDot}>
                <MaterialCommunityIcons
                  name="handshake-outline"
                  size={13}
                  color={COLORS.warning}
                />
              </View>
            )}
            {hasUnread && (
              <Badge style={styles.unreadBadge} size={20}>
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
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  unreadBg: {
    backgroundColor: "#fff",
  },
  readBg: {
    backgroundColor: "#fafafa",
  },

  // Avatar
  avatarWrapper: {
    position: "relative",
    marginRight: 14,
  },
  avatar: {},
  avatarFallback: {},
  avatarLabel: {
    fontFamily: FONTS.bold,
    fontSize: 16,
  },
  onlineDot: {
    position: "absolute",
    bottom: 1,
    right: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: USER_COLOR,
    borderWidth: 2,
    borderColor: "#fff",
  },

  // Content
  content: {
    flex: 1,
    justifyContent: "center",
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 3,
  },
  name: {
    flex: 1,
    fontFamily: FONTS.medium,
    fontSize: 15,
    color: COLORS.text,
    marginRight: 8,
  },
  nameUnread: {
    fontFamily: FONTS.bold,
    color: "#111",
  },
  timestamp: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  timestampUnread: {
    color: USER_COLOR,
    fontFamily: FONTS.medium,
  },

  bottomRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  previewRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    marginRight: 8,
  },
  previewIcon: {
    marginRight: 4,
    marginTop: 1,
  },
  preview: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  previewUnread: {
    color: "#444",
    fontFamily: FONTS.medium,
  },

  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 1,
  },
  negotiationDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#FFF3E0",
    justifyContent: "center",
    alignItems: "center",
  },
  unreadBadge: {
    backgroundColor: USER_COLOR,
    color: "#fff",
    fontFamily: FONTS.bold,
  },
});

export default memo(ChatListItem);
