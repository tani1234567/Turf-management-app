import React from "react";
import { View, StyleSheet } from "react-native";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";

const STATUS_CONFIG = {
  open:         { label: "Open",           bg: "#EFF6FF", text: "#2563EB", border: "#BFDBFE", icon: "clock-outline" },
  in_progress:  { label: "In Progress",    bg: "#FFFBEB", text: "#D97706", border: "#FDE68A", icon: "progress-clock" },
  waiting_user: { label: "Awaiting Reply", bg: "#F5F3FF", text: "#7C3AED", border: "#DDD6FE", icon: "message-reply-outline" },
  resolved:     { label: "Resolved",       bg: "#F0FDF4", text: "#16A34A", border: "#BBF7D0", icon: "check-circle-outline" },
  closed:       { label: "Closed",         bg: "#F9FAFB", text: "#6B7280", border: "#E5E7EB", icon: "lock-outline" },
};

export default function TicketStatusBadge({ status, style }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.open;
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg, borderColor: cfg.border }, style]}>
      <MaterialCommunityIcons name={cfg.icon} size={11} color={cfg.text} />
      <Text style={[styles.label, { color: cfg.text }]}>{cfg.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  label: {
    fontSize: 11,
    fontFamily: "Ubuntu-Medium",
    letterSpacing: 0.2,
  },
});
