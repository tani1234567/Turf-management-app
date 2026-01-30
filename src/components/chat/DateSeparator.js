import React, { memo } from "react";
import { View, StyleSheet } from "react-native";
import { Text } from "react-native-paper";
import { COLORS } from "../../constants/theme";

/**
 * Format date to readable string
 */
const formatDate = (date) => {
  if (!date) return "";

  const messageDate = date instanceof Date ? date : new Date(date);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // Check if same day as today
  if (
    messageDate.getDate() === today.getDate() &&
    messageDate.getMonth() === today.getMonth() &&
    messageDate.getFullYear() === today.getFullYear()
  ) {
    return "Today";
  }

  // Check if yesterday
  if (
    messageDate.getDate() === yesterday.getDate() &&
    messageDate.getMonth() === yesterday.getMonth() &&
    messageDate.getFullYear() === yesterday.getFullYear()
  ) {
    return "Yesterday";
  }

  // Check if same year
  if (messageDate.getFullYear() === today.getFullYear()) {
    return messageDate.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  }

  // Different year
  return messageDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

/**
 * DateSeparator component for grouping messages by date
 * @param {object} props
 * @param {Date|string} props.date - Date to display
 */
const DateSeparator = ({ date }) => {
  return (
    <View style={styles.container}>
      <View style={styles.line} />
      <View style={styles.dateContainer}>
        <Text variant="labelSmall" style={styles.dateText}>
          {formatDate(date)}
        </Text>
      </View>
      <View style={styles.line} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: "#e0e0e0",
  },
  dateContainer: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: "#f0f0f0",
    borderRadius: 12,
  },
  dateText: {
    color: COLORS.textSecondary,
    fontWeight: "500",
  },
});

export default memo(DateSeparator);
