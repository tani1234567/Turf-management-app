import React, { memo, useState, useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { Text, Button, Surface, Chip } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS } from "../../constants/theme";

const MANAGER_COLOR = "#2196F3";
const USER_COLOR = "#10B981";

const formatDate = (dateStr) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-IN", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
};

const formatTimeRange = (startTime, endTime) => {
  if (!startTime || !endTime) return "";
  return `${startTime} - ${endTime}`;
};

const getStatusInfo = (status) => {
  switch (status) {
    case "pending":
      return { color: "#F59E0B", icon: "clock-outline", label: "Awaiting Payment" };
    case "paid":
      return { color: USER_COLOR, icon: "check-circle", label: "Submitted" };
    case "approved_without_payment":
      return { color: MANAGER_COLOR, icon: "check-decagram", label: "Approved" };
    case "expired":
      return { color: "#9CA3AF", icon: "timer-off", label: "Expired" };
    default:
      return { color: COLORS.textSecondary, icon: "help-circle", label: "Payment Request" };
  }
};

const formatCountdown = (deadlineIso) => {
  if (!deadlineIso) return null;
  const diff = new Date(deadlineIso).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  return `${minutes}m remaining`;
};

/**
 * PaymentRequestCard — shown in both manager and user chat
 *
 * @param {object} props.message - Full message object (must have paymentRequestCard field)
 * @param {boolean} props.isOwn - Whether sent by the current viewer
 * @param {"manager"|"user"} props.viewerType
 * @param {function} [props.onPayNow] - User: (messageId, card) => void
 * @param {function} [props.onApproveWithoutPayment] - Manager: (messageId, card) => void
 */
const PaymentRequestCard = ({
  message,
  isOwn,
  viewerType,
  onPayNow,
  onApproveWithoutPayment,
}) => {
  const card = message?.paymentRequestCard;
  const statusInfo = getStatusInfo(card?.status);
  const [countdown, setCountdown] = useState(() => formatCountdown(card?.paymentDeadline));
  const [isLoading, setIsLoading] = useState(false);

  const isManager = viewerType === "manager";
  const isPending = card?.status === "pending";
  const isDeadlineExpired = countdown === "Expired";

  // Refresh countdown every minute while pending
  useEffect(() => {
    if (!isPending || !card?.paymentDeadline) return;
    const timer = setInterval(() => {
      setCountdown(formatCountdown(card.paymentDeadline));
    }, 60000);
    return () => clearInterval(timer);
  }, [isPending, card?.paymentDeadline]);

  const handlePayNow = async () => {
    if (!onPayNow) return;
    setIsLoading(true);
    try {
      await onPayNow(message.id, card);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveWithoutPayment = async () => {
    if (!onApproveWithoutPayment) return;
    setIsLoading(true);
    try {
      await onApproveWithoutPayment(message.id, card);
    } finally {
      setIsLoading(false);
    }
  };

  if (!card) return null;

  return (
    <View style={[styles.container, isOwn ? styles.ownContainer : styles.otherContainer]}>
      <Surface style={styles.card} elevation={2}>

        {/* ── Header row ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <MaterialCommunityIcons name="cash-clock" size={20} color="#F59E0B" />
            <Text variant="titleSmall" style={styles.headerTitle}>
              Payment Request
            </Text>
          </View>
          <Chip
            icon={() => (
              <MaterialCommunityIcons name={statusInfo.icon} size={14} color={statusInfo.color} />
            )}
            textStyle={[styles.statusText, { color: statusInfo.color }]}
            style={[styles.statusChip, { borderColor: statusInfo.color }]}
            mode="outlined"
            compact
          >
            {statusInfo.label}
          </Chip>
        </View>

        {/* ── Turf & Ground info ── */}
        <View style={styles.infoSection}>
          <Text variant="titleMedium" style={styles.turfName}>
            {card.turfName || "Turf"}
          </Text>
          {(card.groundName || card.sport) && (
            <Text variant="bodySmall" style={styles.groundName}>
              {[card.groundName, card.sport].filter(Boolean).join(" · ")}
            </Text>
          )}
        </View>

        {/* ── Date & Time ── */}
        {(card.date || card.startTime) && (
          <View style={styles.detailsRow}>
            {card.date && (
              <View style={styles.detailItem}>
                <MaterialCommunityIcons name="calendar" size={16} color={COLORS.textSecondary} />
                <Text variant="bodyMedium" style={styles.detailText}>
                  {formatDate(card.date)}
                </Text>
              </View>
            )}
            {card.startTime && (
              <View style={styles.detailItem}>
                <MaterialCommunityIcons name="clock-outline" size={16} color={COLORS.textSecondary} />
                <Text variant="bodyMedium" style={styles.detailText}>
                  {formatTimeRange(card.startTime, card.endTime)}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ── Amount box ── */}
        <View style={styles.amountSection}>
          <Text variant="bodySmall" style={styles.amountLabel}>
            Advance Amount
          </Text>
          <Text variant="titleLarge" style={styles.amountValue}>
            ₹{card.advanceAmount?.toLocaleString()}
          </Text>
          {card.totalAmount && card.totalAmount !== card.advanceAmount && (
            <Text variant="bodySmall" style={styles.totalHint}>
              Total booking: ₹{card.totalAmount?.toLocaleString()}
            </Text>
          )}
        </View>

        {/* ── Deadline (user-only, while pending) ── */}
        {!isManager && isPending && (
          <View style={[styles.deadlineRow, isDeadlineExpired && styles.deadlineRowExpired]}>
            <MaterialCommunityIcons
              name="timer-outline"
              size={15}
              color={isDeadlineExpired ? "#9CA3AF" : "#F59E0B"}
            />
            <Text variant="bodySmall" style={[styles.deadlineText, isDeadlineExpired && styles.deadlineExpiredText]}>
              {isDeadlineExpired
                ? "Payment window has closed"
                : countdown
                ? `Pay within ${countdown}`
                : "Complete payment to confirm booking"}
            </Text>
          </View>
        )}

        {/* ── UPI info (user-only, while pending) ── */}
        {!isManager && isPending && card.upiId && (
          <View style={styles.upiRow}>
            <MaterialCommunityIcons name="bank-outline" size={15} color={COLORS.textSecondary} />
            <Text variant="bodySmall" style={styles.upiText} numberOfLines={1}>
              Pay to: {card.upiHolderName ? `${card.upiHolderName} · ` : ""}{card.upiId}
            </Text>
          </View>
        )}

        {/* ── User action: Pay Now ── */}
        {!isManager && isPending && (
          <View style={styles.actionsSection}>
            <Button
              mode="contained"
              onPress={handlePayNow}
              loading={isLoading}
              disabled={isLoading || isDeadlineExpired}
              buttonColor={USER_COLOR}
              style={styles.payBtn}
              contentStyle={styles.btnContent}
              icon="cash"
            >
              Pay Now
            </Button>
          </View>
        )}

        {/* ── Manager action: Approve without payment ── */}
        {isManager && isPending && (
          <View style={styles.actionsSection}>
            <Button
              mode="outlined"
              onPress={handleApproveWithoutPayment}
              loading={isLoading}
              disabled={isLoading}
              textColor={MANAGER_COLOR}
              style={styles.approveBtn}
              contentStyle={styles.btnContent}
              icon="check"
            >
              Approve Without Payment
            </Button>
          </View>
        )}

        {/* ── Status messages for non-pending states ── */}
        {!isPending && card.status === "paid" && !isManager && (
          <View style={styles.statusMessage}>
            <MaterialCommunityIcons name="check-circle" size={16} color={USER_COLOR} />
            <Text variant="bodySmall" style={[styles.statusMessageText, { color: USER_COLOR }]}>
              Payment submitted — awaiting verification
            </Text>
          </View>
        )}
        {!isPending && card.status === "approved_without_payment" && (
          <View style={styles.statusMessage}>
            <MaterialCommunityIcons name="check-decagram" size={16} color={MANAGER_COLOR} />
            <Text variant="bodySmall" style={[styles.statusMessageText, { color: MANAGER_COLOR }]}>
              Booking approved without advance payment
            </Text>
          </View>
        )}

        {/* ── Timestamp ── */}
        <Text variant="labelSmall" style={styles.timestamp}>
          {message.timestamp instanceof Date
            ? message.timestamp.toLocaleTimeString("en-IN", {
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

  // Header
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
    flex: 1,
    marginRight: 8,
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

  // Turf info
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

  // Date & time
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

  // Amount box
  amountSection: {
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    marginBottom: 10,
  },
  amountLabel: {
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  amountValue: {
    fontWeight: "700",
    color: USER_COLOR,
  },
  totalHint: {
    color: COLORS.textSecondary,
    marginTop: 4,
  },

  // Deadline
  deadlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFBEB",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    marginBottom: 8,
  },
  deadlineRowExpired: {
    backgroundColor: "#F3F4F6",
  },
  deadlineText: {
    color: "#B45309",
    fontSize: 12,
    fontWeight: "500",
    flex: 1,
  },
  deadlineExpiredText: {
    color: "#9CA3AF",
  },

  // UPI row
  upiRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  upiText: {
    color: COLORS.textSecondary,
    flex: 1,
    fontSize: 12,
  },

  // Actions
  actionsSection: {
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingTop: 12,
    marginTop: 8,
  },
  payBtn: {
    borderRadius: 8,
  },
  approveBtn: {
    borderRadius: 8,
    borderColor: MANAGER_COLOR,
  },
  btnContent: {
    paddingVertical: 4,
  },

  // Status messages (non-pending)
  statusMessage: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#f8f9fa",
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  statusMessageText: {
    fontWeight: "500",
    flex: 1,
  },

  // Timestamp
  timestamp: {
    color: COLORS.textSecondary,
    textAlign: "right",
    marginTop: 8,
  },
});

export default memo(PaymentRequestCard);
