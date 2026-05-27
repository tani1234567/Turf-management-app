import React from "react";
import { View, StyleSheet } from "react-native";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";

const USER_COLOR = "#10B981";

function formatTime(timestamp) {
  if (!timestamp) return "";
  let date;
  if (timestamp.toDate) date = timestamp.toDate();
  else if (timestamp.seconds) date = new Date(timestamp.seconds * 1000);
  else date = new Date(timestamp);
  return (
    date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) +
    "  " +
    date.toLocaleDateString("en-IN", { day: "numeric", month: "short" })
  );
}

export default function TicketMessageBubble({ message }) {
  const isUser = message.senderType === "user";

  return (
    <View style={[styles.row, isUser ? styles.rowRight : styles.rowLeft]}>
      {!isUser && (
        <View style={styles.avatar}>
          <MaterialCommunityIcons name="headset" size={14} color="#fff" />
        </View>
      )}
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.adminBubble]}>
        <Text style={[styles.sender, isUser ? styles.userSender : styles.adminSender]}>
          {isUser ? "You" : message.senderName || "Support Team"}
        </Text>
        <Text style={[styles.text, isUser ? styles.userText : styles.adminText]}>
          {message.text}
        </Text>
        <Text style={[styles.time, isUser ? styles.userTime : styles.adminTime]}>
          {formatTime(message.createdAt)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    marginVertical: 5,
    marginHorizontal: 14,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  rowRight: { justifyContent: "flex-end" },
  rowLeft: { justifyContent: "flex-start" },

  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#6366F1",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },

  bubble: {
    maxWidth: "76%",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userBubble: {
    backgroundColor: USER_COLOR,
    borderBottomRightRadius: 4,
    shadowColor: USER_COLOR,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  adminBubble: {
    backgroundColor: "#fff",
    borderBottomLeftRadius: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },

  sender: {
    fontSize: 10,
    fontFamily: "Ubuntu-Medium",
    marginBottom: 4,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  userSender: { color: "rgba(255,255,255,0.7)" },
  adminSender: { color: "#6366F1" },

  text: {
    fontSize: 14,
    fontFamily: "Ubuntu-Regular",
    lineHeight: 21,
  },
  userText: { color: "#fff" },
  adminText: { color: "#111827" },

  time: {
    fontSize: 10,
    fontFamily: "Ubuntu-Regular",
    marginTop: 5,
  },
  userTime: { color: "rgba(255,255,255,0.55)", textAlign: "right" },
  adminTime: { color: "#9CA3AF" },
});
