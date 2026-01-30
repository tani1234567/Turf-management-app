import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Modal,
  Animated,
  Easing,
} from "react-native";
import {
  Text,
  Button,
  Surface,
  IconButton,
} from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";

const USER_COLOR = "#4CAF50";
const COUNTDOWN_DURATION = 5; // 5 seconds

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function ConfirmationDialog({
  visible,
  onDismiss,
  onConfirm,
  bookingDetails,
  isLoading = false,
}) {
  const [countdown, setCountdown] = useState(COUNTDOWN_DURATION);
  const [canConfirm, setCanConfirm] = useState(false);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const countdownInterval = useRef(null);

  useEffect(() => {
    if (visible) {
      // Reset state when dialog opens
      setCountdown(COUNTDOWN_DURATION);
      setCanConfirm(false);
      progressAnim.setValue(0);

      // Start countdown
      countdownInterval.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownInterval.current);
            setCanConfirm(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Animate progress circle
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: COUNTDOWN_DURATION * 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start();
    } else {
      // Cleanup on close
      if (countdownInterval.current) {
        clearInterval(countdownInterval.current);
      }
    }

    return () => {
      if (countdownInterval.current) {
        clearInterval(countdownInterval.current);
      }
    };
  }, [visible, progressAnim]);

  const handleConfirmNow = () => {
    // Skip countdown and enable confirm immediately
    if (countdownInterval.current) {
      clearInterval(countdownInterval.current);
    }
    setCountdown(0);
    setCanConfirm(true);
    progressAnim.setValue(1);
  };

  const { turf, ground, date, sport, startTime, endTime, totalPrice } = bookingDetails || {};

  // Circle progress calculations
  const size = 100;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;

  const strokeDashoffset = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <Surface style={styles.dialog} elevation={8}>
          {/* Header */}
          <View style={styles.header}>
            <Text variant="titleLarge" style={styles.title}>
              Confirm Booking
            </Text>
            <IconButton
              icon="close"
              size={24}
              onPress={onDismiss}
              disabled={isLoading}
            />
          </View>

          {/* Circular Progress Timer */}
          <View style={styles.timerContainer}>
            <Svg width={size} height={size} style={styles.progressCircle}>
              {/* Background circle */}
              <Circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke="#e0e0e0"
                strokeWidth={strokeWidth}
                fill="transparent"
              />
              {/* Progress circle */}
              <AnimatedCircle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={USER_COLOR}
                strokeWidth={strokeWidth}
                fill="transparent"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              />
            </Svg>
            <View style={styles.timerContent}>
              {canConfirm ? (
                <MaterialCommunityIcons name="check" size={40} color={USER_COLOR} />
              ) : (
                <Text style={styles.countdownText}>{countdown}</Text>
              )}
            </View>
            <Text variant="bodySmall" style={styles.timerLabel}>
              {canConfirm ? "Ready to confirm!" : "Please review your booking"}
            </Text>
          </View>

          {/* Booking Summary */}
          <View style={styles.summary}>
            <Text variant="titleSmall" style={styles.summaryTitle}>
              Booking Summary
            </Text>

            {/* Venue */}
            <View style={styles.summaryRow}>
              <MaterialCommunityIcons name="map-marker" size={20} color="#666" />
              <View style={styles.summaryContent}>
                <Text variant="bodySmall" style={styles.summaryLabel}>Venue</Text>
                <Text variant="bodyMedium" style={styles.summaryValue}>
                  {turf?.name || "Turf"} - {ground?.name || "Ground"}
                </Text>
              </View>
            </View>

            {/* Date */}
            <View style={styles.summaryRow}>
              <MaterialCommunityIcons name="calendar" size={20} color="#666" />
              <View style={styles.summaryContent}>
                <Text variant="bodySmall" style={styles.summaryLabel}>Date</Text>
                <Text variant="bodyMedium" style={styles.summaryValue}>
                  {date?.weekday}, {date?.day} {date?.month}
                </Text>
              </View>
            </View>

            {/* Time */}
            <View style={styles.summaryRow}>
              <MaterialCommunityIcons name="clock-outline" size={20} color="#666" />
              <View style={styles.summaryContent}>
                <Text variant="bodySmall" style={styles.summaryLabel}>Time</Text>
                <Text variant="bodyMedium" style={styles.summaryValue}>
                  {startTime?.label} - {endTime?.label}
                </Text>
              </View>
            </View>

            {/* Sport */}
            <View style={styles.summaryRow}>
              <MaterialCommunityIcons name="soccer" size={20} color="#666" />
              <View style={styles.summaryContent}>
                <Text variant="bodySmall" style={styles.summaryLabel}>Sport</Text>
                <Text variant="bodyMedium" style={styles.summaryValue}>
                  {sport || "Sport"}
                </Text>
              </View>
            </View>

            {/* Total Price */}
            <View style={styles.priceRow}>
              <Text variant="titleMedium" style={styles.priceLabel}>Total Amount</Text>
              <Text variant="headlineSmall" style={styles.priceValue}>
                ₹{totalPrice || 0}
              </Text>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <Button
              mode="outlined"
              onPress={onDismiss}
              style={styles.cancelButton}
              disabled={isLoading}
            >
              Cancel
            </Button>
            {!canConfirm ? (
              <Button
                mode="text"
                onPress={handleConfirmNow}
                style={styles.skipButton}
                disabled={isLoading}
                textColor={USER_COLOR}
              >
                Confirm Now
              </Button>
            ) : (
              <Button
                mode="contained"
                onPress={onConfirm}
                style={styles.confirmButton}
                buttonColor={USER_COLOR}
                loading={isLoading}
                disabled={isLoading}
              >
                {isLoading ? "Confirming..." : "Confirm Booking"}
              </Button>
            )}
          </View>
        </Surface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  dialog: {
    width: "100%",
    maxWidth: 400,
    borderRadius: 16,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  title: {
    fontWeight: "600",
    color: "#333",
  },

  // Timer
  timerContainer: {
    alignItems: "center",
    paddingVertical: 20,
  },
  progressCircle: {
    transform: [{ rotate: "0deg" }],
  },
  timerContent: {
    position: "absolute",
    top: 20,
    left: 0,
    right: 0,
    height: 100,
    justifyContent: "center",
    alignItems: "center",
  },
  countdownText: {
    fontSize: 36,
    fontWeight: "bold",
    color: USER_COLOR,
  },
  timerLabel: {
    color: "#666",
    marginTop: 8,
  },

  // Summary
  summary: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  summaryTitle: {
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  summaryContent: {
    marginLeft: 12,
    flex: 1,
  },
  summaryLabel: {
    color: "#999",
    marginBottom: 2,
  },
  summaryValue: {
    color: "#333",
    fontWeight: "500",
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  priceLabel: {
    color: "#333",
    fontWeight: "600",
  },
  priceValue: {
    color: USER_COLOR,
    fontWeight: "bold",
  },

  // Actions
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    backgroundColor: "#f9f9f9",
  },
  cancelButton: {
    borderColor: "#999",
    minWidth: 100,
  },
  skipButton: {
    minWidth: 120,
  },
  confirmButton: {
    minWidth: 140,
    borderRadius: 8,
  },
});
