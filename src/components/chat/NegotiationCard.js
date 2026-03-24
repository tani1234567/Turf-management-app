import React, { memo, useState } from "react";
import { View, StyleSheet } from "react-native";
import { Text, Button, Surface, Chip, TextInput, IconButton } from "react-native-paper";
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
      return { color: COLORS.warning, icon: "clock-outline", label: "Pending" };
    case "accepted":
      return { color: COLORS.success, icon: "check-circle", label: "Accepted" };
    case "rejected":
      return { color: COLORS.error, icon: "close-circle", label: "Rejected" };
    case "countered":
      return { color: COLORS.secondary, icon: "swap-horizontal", label: "Counter Offer" };
    case "expired":
      return { color: "#999", icon: "timer-off", label: "Expired" };
    default:
      return { color: COLORS.textSecondary, icon: "help-circle", label: status };
  }
};

/**
 * NegotiationCard component for displaying booking requests in chat
 * @param {object} props
 * @param {object} props.message - Message data with negotiationCard
 * @param {boolean} props.isOwn - Whether this message is from the current user
 * @param {string} props.viewerType - "user" | "manager"
 * @param {function} props.onAccept - Accept handler (manager only)
 * @param {function} props.onReject - Reject handler (manager only)
 * @param {function} props.onCounter - Counter offer handler (manager only)
 * @param {function} props.onAcceptCounter - Accept counter offer handler (user only)
 * @param {function} props.onRejectCounter - Reject counter offer handler (user only)
 */
const NegotiationCard = ({
  message,
  isOwn,
  viewerType,
  onAccept,
  onReject,
  onCounter,
  onAcceptCounter,
  onRejectCounter,
  onSendPaymentRequest,
}) => {
  const card = message.negotiationCard;
  const statusInfo = getStatusInfo(card?.status);
  const [showCounterInput, setShowCounterInput] = useState(false);
  const [counterPrice, setCounterPrice] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const isManager = viewerType === "manager";
  const isPending = card?.status === "pending";
  const isCountered = card?.status === "countered";
  const isAccepted = card?.status === "accepted";
  const canRespond = isManager && isPending && !isOwn;
  const canRespondToCounter = !isManager && isCountered && isOwn;
  const canRequestPayment = isManager && isAccepted && !!card?.bookingId && !!onSendPaymentRequest;

  const handleAccept = async () => {
    if (!onAccept) return;
    setIsLoading(true);
    try {
      await onAccept(message.id, card);
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

  const handleCounter = async () => {
    if (!onCounter || !counterPrice) return;
    setIsLoading(true);
    try {
      await onCounter(message.id, card, parseFloat(counterPrice));
      setShowCounterInput(false);
      setCounterPrice("");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptCounterOffer = async () => {
    if (!onAcceptCounter) return;
    setIsLoading(true);
    try {
      await onAcceptCounter(message.id, card);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRejectCounterOffer = async () => {
    if (!onRejectCounter) return;
    setIsLoading(true);
    try {
      await onRejectCounter(message.id, card);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={[styles.container, isOwn ? styles.ownContainer : styles.otherContainer]}>
      <Surface style={styles.card} elevation={2}>
        {/* Header with status */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <MaterialCommunityIcons
              name="calendar-clock"
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
          <Text variant="bodySmall" style={styles.groundName}>
            {card?.groundName || "Ground"} - {card?.sport}
          </Text>
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

        {/* Pricing */}
        <View style={styles.pricingSection}>
          <View style={styles.priceRow}>
            <Text variant="bodySmall" style={styles.priceLabel}>
              Original Price:
            </Text>
            <Text variant="bodyMedium" style={styles.originalPrice}>
              ₹{card?.originalPrice}
            </Text>
          </View>
          <View style={styles.priceRow}>
            <Text variant="bodySmall" style={styles.priceLabel}>
              Requested Price:
            </Text>
            <Text
              variant="titleMedium"
              style={[
                styles.requestedPrice,
                card?.requestedPrice < card?.originalPrice && styles.discountPrice,
              ]}
            >
              ₹{card?.requestedPrice}
            </Text>
          </View>
          {!!card?.counterPrice && (
            <View style={styles.priceRow}>
              <Text variant="bodySmall" style={styles.priceLabel}>
                Counter Offer:
              </Text>
              <Text variant="titleMedium" style={styles.counterPrice}>
                ₹{card?.counterPrice}
              </Text>
            </View>
          )}
        </View>

        {/* User's message if any */}
        {!!card?.message && (
          <View style={styles.messageSection}>
            <Text variant="bodySmall" style={styles.messageLabel}>
              Note:
            </Text>
            <Text variant="bodyMedium" style={styles.messageText}>
              "{card.message}"
            </Text>
          </View>
        )}

        {/* Manager Actions */}
        {canRespond && (
          <View style={styles.actionsSection}>
            {showCounterInput ? (
              <View style={styles.counterInputContainer}>
                <View style={styles.counterInputRow}>
                  <TextInput
                    mode="outlined"
                    label="Your Price"
                    value={counterPrice}
                    onChangeText={setCounterPrice}
                    keyboardType="numeric"
                    left={<TextInput.Affix text="₹" />}
                    style={styles.counterInput}
                    dense
                  />
                  <Button
                    mode="contained"
                    onPress={handleCounter}
                    loading={isLoading}
                    disabled={!counterPrice || isLoading}
                    style={styles.sendCounterButton}
                    compact
                    icon="send"
                  >
                    Send
                  </Button>
                </View>
                <Button
                  mode="text"
                  onPress={() => setShowCounterInput(false)}
                  style={styles.cancelButton}
                  compact
                  textColor={COLORS.textSecondary}
                >
                  Cancel
                </Button>
              </View>
            ) : (
              <View style={styles.actionButtonsContainer}>
                {/* Primary row: Accept and Counter */}
                <View style={styles.primaryActions}>
                  <Button
                    mode="contained"
                    onPress={handleAccept}
                    loading={isLoading}
                    disabled={isLoading}
                    buttonColor={COLORS.success}
                    style={styles.primaryButton}
                    icon="check"
                    compact
                  >
                    Accept
                  </Button>
                  <Button
                    mode="outlined"
                    onPress={() => setShowCounterInput(true)}
                    disabled={isLoading}
                    style={styles.primaryButton}
                    icon="swap-horizontal"
                    compact
                  >
                    Counter
                  </Button>
                </View>
                {/* Secondary row: Reject */}
                <Button
                  mode="text"
                  onPress={handleReject}
                  loading={isLoading}
                  disabled={isLoading}
                  textColor={COLORS.error}
                  style={styles.rejectButton}
                  icon="close"
                  compact
                >
                  Reject Request
                </Button>
              </View>
            )}
          </View>
        )}

        {/* User response to counter offer */}
        {canRespondToCounter && (
          <View style={styles.actionsSection}>
            <Text variant="bodySmall" style={styles.counterOfferText}>
              Manager's counter offer: ₹{card?.counterPrice}
            </Text>
            <View style={styles.counterResponseContainer}>
              <Button
                mode="contained"
                onPress={handleAcceptCounterOffer}
                loading={isLoading}
                disabled={isLoading}
                buttonColor={COLORS.success}
                style={styles.acceptCounterButton}
                icon="check"
                compact
              >
                Accept
              </Button>
              <Button
                mode="text"
                onPress={handleRejectCounterOffer}
                loading={isLoading}
                disabled={isLoading}
                textColor={COLORS.error}
                style={styles.declineButton}
                icon="close"
                compact
              >
                Decline
              </Button>
            </View>
          </View>
        )}

        {/* Manager: send payment request for an accepted negotiation */}
        {canRequestPayment && (
          <View style={styles.actionsSection}>
            <Button
              mode="outlined"
              onPress={() => onSendPaymentRequest(message.id, card)}
              disabled={isLoading}
              style={styles.paymentRequestButton}
              icon="cash-clock"
              compact
              textColor="#F59E0B"
            >
              Send Payment Request
            </Button>
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
    lineHeight: 14,
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  infoSection: {
    marginBottom: 10,
  },
  turfName: {
    fontWeight: "600",
    color: COLORS.text,
  },
  groundName: {
    color: COLORS.textSecondary,
    marginTop: 2,
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
  pricingSection: {
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  priceLabel: {
    color: COLORS.textSecondary,
  },
  originalPrice: {
    color: COLORS.textSecondary,
    textDecorationLine: "line-through",
  },
  requestedPrice: {
    fontWeight: "700",
    color: COLORS.text,
  },
  discountPrice: {
    color: COLORS.success,
  },
  counterPrice: {
    fontWeight: "700",
    color: COLORS.secondary,
  },
  messageSection: {
    marginBottom: 10,
    padding: 8,
    backgroundColor: "#fff8e1",
    borderRadius: 6,
  },
  messageLabel: {
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  messageText: {
    color: COLORS.text,
    fontStyle: "italic",
  },
  actionsSection: {
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingTop: 12,
    marginTop: 4,
  },
  actionButtonsContainer: {
    gap: 8,
  },
  primaryActions: {
    flexDirection: "row",
    gap: 8,
  },
  primaryButton: {
    flex: 1,
  },
  rejectButton: {
    alignSelf: "center",
    marginTop: 4,
  },
  counterInputContainer: {
    gap: 8,
  },
  counterInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  counterInput: {
    flex: 1,
    backgroundColor: "#fff",
  },
  sendCounterButton: {
    backgroundColor: COLORS.secondary,
  },
  cancelButton: {
    alignSelf: "center",
  },
  counterOfferText: {
    color: COLORS.secondary,
    marginBottom: 10,
    textAlign: "center",
    fontWeight: "600",
  },
  counterResponseContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  acceptCounterButton: {
    flex: 1,
  },
  declineButton: {
    flex: 1,
  },
  timestamp: {
    color: COLORS.textSecondary,
    textAlign: "right",
    marginTop: 8,
  },
  paymentRequestButton: {
    borderColor: "#F59E0B",
  },
});

export default memo(NegotiationCard);
