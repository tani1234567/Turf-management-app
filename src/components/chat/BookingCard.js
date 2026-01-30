import React, { memo, useState } from "react";
import { View, StyleSheet } from "react-native";
import { Text, Button, Surface, Chip } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS } from "../../constants/theme";

/**
 * Format date to readable string
 */
const formatDate = (dateStr) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
};

/**
 * Format time range
 */
const formatTimeRange = (startTime, endTime) => {
  if (!startTime || !endTime) return "";
  return `${startTime} - ${endTime}`;
};

/**
 * Get status color and icon
 */
const getStatusInfo = (status) => {
  switch (status) {
    case "pending":
      return { color: COLORS.warning, icon: "clock-outline", label: "Pending Approval" };
    case "confirmed":
      return { color: COLORS.success, icon: "check-circle", label: "Confirmed" };
    case "rejected":
      return { color: COLORS.error, icon: "close-circle", label: "Rejected" };
    case "cancelled":
      return { color: "#999", icon: "cancel", label: "Cancelled" };
    default:
      return { color: COLORS.textSecondary, icon: "help-circle", label: status };
  }
};

/**
 * Get icon name for sport
 */
const getSportIcon = (sport) => {
  const icons = {
    cricket: "cricket",
    football: "soccer",
    badminton: "badminton",
    tennis: "tennis",
    basketball: "basketball",
    volleyball: "volleyball",
    pickleball: "racquet",
    hockey: "hockey-sticks",
  };
  return icons[sport?.toLowerCase()] || "run";
};

/**
 * BookingCard component for displaying booking requests/confirmations in chat
 * @param {object} props
 * @param {object} props.message - Message data with bookingCard
 * @param {boolean} props.isOwn - Whether this message is from the current user
 * @param {string} props.viewerType - "user" | "manager"
 * @param {function} props.onConfirm - Confirm handler (manager only)
 * @param {function} props.onReject - Reject handler (manager only)
 * @param {function} props.onShareLocation - Share location handler (manager only, after confirmation)
 */
const BookingCard = ({
  message,
  isOwn,
  viewerType,
  onConfirm,
  onReject,
  onShareLocation,
}) => {
  const card = message.bookingCard;
  const statusInfo = getStatusInfo(card?.status);
  const [isLoading, setIsLoading] = useState(false);

  const isManager = viewerType === "manager";
  const isPending = card?.status === "pending";
  const isConfirmed = card?.status === "confirmed";
  const canRespond = isManager && isPending && !isOwn;
  const canShareLocation = isManager && isConfirmed;

  const handleConfirm = async () => {
    if (!onConfirm) return;
    setIsLoading(true);
    try {
      await onConfirm(message.id, card);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async () => {
    if (!onReject) return;
    setIsLoading(true);
    try {
      await onReject(message.id, card);
    } finally {
      setIsLoading(false);
    }
  };

  const handleShareLocation = () => {
    if (onShareLocation) {
      onShareLocation(card);
    }
  };

  return (
    <View style={[styles.container, isOwn ? styles.ownContainer : styles.otherContainer]}>
      <Surface style={styles.card} elevation={2}>
        {/* Header with status */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <MaterialCommunityIcons
              name="calendar-check"
              size={20}
              color={COLORS.primary}
            />
            <Text variant="titleSmall" style={styles.headerTitle}>
              Booking Request
            </Text>
          </View>
          <Chip
            icon={() => (
              <MaterialCommunityIcons
                name={statusInfo.icon}
                size={14}
                color={statusInfo.color}
              />
            )}
            textStyle={[styles.statusText, { color: statusInfo.color }]}
            style={[styles.statusChip, { borderColor: statusInfo.color }]}
            mode="outlined"
            compact
          >
            {statusInfo.label}
          </Chip>
        </View>

        {/* Turf & Ground Info */}
        <View style={styles.infoSection}>
          <Text variant="titleMedium" style={styles.turfName}>
            {card?.turfName || "Turf"}
          </Text>
          <View style={styles.groundRow}>
            <Text variant="bodySmall" style={styles.groundName}>
              {card?.groundName || "Ground"}
            </Text>
            {card?.sport && (
              <Chip
                icon={getSportIcon(card.sport)}
                textStyle={styles.sportChipText}
                style={styles.sportChip}
                compact
              >
                {card.sport.charAt(0).toUpperCase() + card.sport.slice(1)}
              </Chip>
            )}
          </View>
        </View>

        {/* Date & Time */}
        <View style={styles.detailsRow}>
          <View style={styles.detailItem}>
            <MaterialCommunityIcons name="calendar" size={16} color={COLORS.textSecondary} />
            <Text variant="bodyMedium" style={styles.detailText}>
              {formatDate(card?.date)}
            </Text>
          </View>
          <View style={styles.detailItem}>
            <MaterialCommunityIcons name="clock-outline" size={16} color={COLORS.textSecondary} />
            <Text variant="bodyMedium" style={styles.detailText}>
              {formatTimeRange(card?.startTime, card?.endTime)}
            </Text>
          </View>
        </View>

        {/* Price */}
        <View style={styles.priceSection}>
          <Text variant="bodySmall" style={styles.priceLabel}>
            Total Amount
          </Text>
          <Text variant="titleLarge" style={styles.priceValue}>
            ₹{card?.totalAmount}
          </Text>
        </View>

        {/* Manager Actions - Confirm/Reject for pending bookings */}
        {canRespond && (
          <View style={styles.actionsSection}>
            <View style={styles.actionButtons}>
              <Button
                mode="contained"
                onPress={handleConfirm}
                loading={isLoading}
                disabled={isLoading}
                buttonColor={COLORS.success}
                style={styles.actionButton}
                icon="check"
                compact
              >
                Confirm
              </Button>
              <Button
                mode="outlined"
                onPress={handleReject}
                loading={isLoading}
                disabled={isLoading}
                textColor={COLORS.error}
                style={[styles.actionButton, styles.rejectButton]}
                icon="close"
                compact
              >
                Reject
              </Button>
            </View>
          </View>
        )}

        {/* Share Location button for confirmed bookings */}
        {canShareLocation && (
          <View style={styles.actionsSection}>
            <Button
              mode="outlined"
              onPress={handleShareLocation}
              icon="map-marker"
              style={styles.locationButton}
              contentStyle={styles.locationButtonContent}
            >
              Share Turf Location
            </Button>
          </View>
        )}

        {/* Confirmation message for user */}
        {isConfirmed && !isManager && (
          <View style={styles.confirmationMessage}>
            <MaterialCommunityIcons name="check-circle" size={16} color={COLORS.success} />
            <Text variant="bodySmall" style={styles.confirmationText}>
              Your booking has been confirmed!
            </Text>
          </View>
        )}

        {/* Timestamp */}
        <Text variant="labelSmall" style={styles.timestamp}>
          {message.timestamp instanceof Date
            ? message.timestamp.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })
            : ""}
        </Text>
      </Surface>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    maxWidth: "90%",
  },
  ownContainer: {
    alignSelf: "flex-end",
  },
  otherContainer: {
    alignSelf: "flex-start",
  },
  card: {
    borderRadius: 12,
    padding: 14,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerTitle: {
    fontWeight: "600",
    color: COLORS.text,
  },
  statusChip: {
    height: 26,
    backgroundColor: "transparent",
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  infoSection: {
    marginBottom: 10,
  },
  turfName: {
    fontWeight: "600",
    color: COLORS.text,
  },
  groundRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 8,
  },
  groundName: {
    color: COLORS.textSecondary,
  },
  sportChip: {
    height: 24,
    backgroundColor: "#e8f5e9",
  },
  sportChipText: {
    fontSize: 11,
    color: COLORS.primary,
  },
  detailsRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  detailText: {
    color: COLORS.text,
  },
  priceSection: {
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    marginBottom: 4,
  },
  priceLabel: {
    color: COLORS.textSecondary,
  },
  priceValue: {
    fontWeight: "700",
    color: COLORS.primary,
    marginTop: 2,
  },
  actionsSection: {
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingTop: 12,
    marginTop: 8,
  },
  actionButtons: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    flex: 1,
  },
  rejectButton: {
    borderColor: COLORS.error,
  },
  locationButton: {
    borderColor: COLORS.secondary,
  },
  locationButtonContent: {
    height: 40,
  },
  confirmationMessage: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#e8f5e9",
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  confirmationText: {
    color: COLORS.success,
    fontWeight: "500",
  },
  timestamp: {
    color: COLORS.textSecondary,
    textAlign: "right",
    marginTop: 8,
  },
});

export default memo(BookingCard);
