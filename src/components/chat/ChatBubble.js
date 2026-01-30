import React, { memo } from "react";
import { View, StyleSheet } from "react-native";
import { Text } from "react-native-paper";
import { COLORS } from "../../constants/theme";

/**
 * Format timestamp to time string
 */
const formatTime = (timestamp) => {
  if (!timestamp) return "";
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

/**
 * ChatBubble component for displaying text messages
 * @param {object} props
 * @param {object} props.message - Message data
 * @param {boolean} props.isOwn - Whether this message is from the current user
 * @param {boolean} props.showSenderName - Whether to show sender name (for group chats)
 * @param {string} props.accentColor - Accent color for own messages
 */
const ChatBubble = ({ message, isOwn, showSenderName = false, accentColor = COLORS.primary }) => {
  return (
    <View style={[styles.container, isOwn ? styles.ownContainer : styles.otherContainer]}>
      {showSenderName && !isOwn && (
        <Text variant="labelSmall" style={styles.senderName}>
          {message.senderName}
        </Text>
      )}
      <View
        style={[
          styles.bubble,
          isOwn ? [styles.ownBubble, { backgroundColor: accentColor }] : styles.otherBubble,
        ]}
      >
        <Text
          variant="bodyMedium"
          style={[styles.messageText, isOwn ? styles.ownText : styles.otherText]}
        >
          {message.text}
        </Text>
        <Text
          variant="labelSmall"
          style={[styles.timestamp, isOwn ? styles.ownTimestamp : styles.otherTimestamp]}
        >
          {formatTime(message.timestamp)}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    maxWidth: "85%",
  },
  ownContainer: {
    alignSelf: "flex-end",
  },
  otherContainer: {
    alignSelf: "flex-start",
  },
  senderName: {
    color: COLORS.textSecondary,
    marginBottom: 2,
    marginLeft: 8,
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  ownBubble: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: "#f0f0f0",
    borderBottomLeftRadius: 4,
  },
  messageText: {
    lineHeight: 20,
  },
  ownText: {
    color: "#fff",
  },
  otherText: {
    color: COLORS.text,
  },
  timestamp: {
    marginTop: 4,
    alignSelf: "flex-end",
  },
  ownTimestamp: {
    color: "rgba(255, 255, 255, 0.7)",
  },
  otherTimestamp: {
    color: COLORS.textSecondary,
  },
});

export default memo(ChatBubble);
