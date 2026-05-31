import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Animated,
  Pressable,
  Modal,
  ScrollView,
  Alert,
  RefreshControl,
  Linking,
  Dimensions,
} from "react-native";
import {
  Text,
  SegmentedButtons,
  Surface,
  Button,
  IconButton,
  Divider,
  TextInput,
  ActivityIndicator,
  Chip,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSelector } from "react-redux";

import { selectUser } from "../../store/slices/authSlice";
import {
  subscribeToCollection,
  updateDocument,
  queryDocuments,
  getDocument,
  autoRejectExpiredPendingBookings,
} from "../../services/firebase/firestore";
import { formatPrice, formatDuration } from "../../utils/priceUtils";
import { FONTS } from "../../constants/theme";
import SkeletonBookingList from "../../components/user/SkeletonLoader";
import CouponVoucherCard from "../../components/coupons/CouponVoucherCard";

const USER_COLOR = "#10B981";
const EMERALD_PALE = "#D1FAE5";
const PAGE_BG = "#F8FAF9";
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const TAB_ORDER = ["upcoming", "completed", "cancelled"];

// ──────────────────────────────────────────────
// Status config
// ──────────────────────────────────────────────
const STATUS_CONFIG = {
  pending: {
    label: "Pending Approval",
    color: "#FF9800",
    bg: "#FFF3E0",
    icon: "clock-outline",
  },
  pending_payment: {
    label: "Payment Required",
    color: "#9C27B0",
    bg: "#F3E5F5",
    icon: "cash",
  },
  payment_submitted: {
    label: "Verifying Payment",
    color: "#673AB7",
    bg: "#EDE7F6",
    icon: "clock-check-outline",
  },
  awaiting_payment: {
    label: "Pay Now",
    color: "#FF5722",
    bg: "#FBE9E7",
    icon: "alert-circle-outline",
  },
  payment_rejected: {
    label: "Payment Failed",
    color: "#F44336",
    bg: "#FFEBEE",
    icon: "close-circle-outline",
  },
  expired: {
    label: "Expired",
    color: "#9E9E9E",
    bg: "#F5F5F5",
    icon: "clock-remove-outline",
  },
  confirmed: {
    label: "Confirmed",
    color: "#10B981",
    bg: "#D1FAE5",
    icon: "check-circle-outline",
  },
  in_progress: {
    label: "In Progress",
    color: "#00BCD4",
    bg: "#E0F7FA",
    icon: "play-circle-outline",
  },
  completed: {
    label: "Completed",
    color: "#2196F3",
    bg: "#E3F2FD",
    icon: "check-all",
  },
  rejected: {
    label: "Rejected",
    color: "#F44336",
    bg: "#FFEBEE",
    icon: "close-circle-outline",
  },
  cancelled: {
    label: "Cancelled",
    color: "#9E9E9E",
    bg: "#F5F5F5",
    icon: "cancel",
  },
};

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
const formatTimeLabel = (timeStr) => {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const display = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${display}:${m.toString().padStart(2, "0")} ${period}`;
};

const formatDateLabel = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const day = d.getDate();
  const month = d.toLocaleString("default", { month: "short" });
  const weekday = d.toLocaleString("default", { weekday: "short" });
  return `${weekday}, ${day} ${month}`;
};

const UPCOMING_STATUSES = [
  "pending",
  "confirmed",
  "pending_payment",
  "payment_submitted",
  "awaiting_payment",
  "payment_rejected",
];

const isUpcoming = (booking) => {
  if (!UPCOMING_STATUSES.includes(booking.status)) return false;
  const now = new Date();
  const bookingDate = new Date(booking.date);
  bookingDate.setHours(23, 59, 59, 999);
  return bookingDate >= now;
};

/** Hours remaining until booking start */
const hoursUntilBooking = (booking) => {
  const now = new Date();
  const [h, m] = (booking.startTime || "00:00").split(":").map(Number);
  const bookingStart = new Date(booking.date);
  bookingStart.setHours(h, m, 0, 0);
  return (bookingStart - now) / (1000 * 60 * 60);
};

// ──────────────────────────────────────────────
// StatusBadge
// ──────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
      <MaterialCommunityIcons name={cfg.icon} size={13} color={cfg.color} />
      <Text style={[styles.statusText, { color: cfg.color, fontFamily: FONTS.medium }]}>
        {cfg.label}
      </Text>
    </View>
  );
};

// ──────────────────────────────────────────────
// BookingCard
// ──────────────────────────────────────────────
const BookingCard = ({ booking, onPress, onCancel, onReview, onContact, onPayment, onDispute }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () =>
    Animated.spring(scale, { toValue: 0.975, speed: 20, bounciness: 4, useNativeDriver: true }).start();
  const pressOut = () =>
    Animated.spring(scale, { toValue: 1, speed: 20, bounciness: 4, useNativeDriver: true }).start();

  const upcoming = isUpcoming(booking);
  const isCompleted = booking.status === "completed";
  const isCancelled = booking.status === "cancelled";
  const statusCfg = STATUS_CONFIG[booking.status] || STATUS_CONFIG.pending;
  const needsPayment =
    booking.status === "awaiting_payment" ||
    booking.status === "pending_payment" ||
    booking.status === "payment_rejected";

  // Get payment deadline info for awaiting_payment
  const getPaymentDeadlineText = () => {
    const deadline = booking.payment?.advance?.paymentDeadline;
    if (!deadline) return null;
    const deadlineDate = typeof deadline === "string" ? new Date(deadline) : deadline?.toDate?.() || new Date(deadline);
    const remaining = Math.max(0, Math.floor((deadlineDate - new Date()) / 60000));
    if (remaining <= 0) return "Deadline passed";
    return `Pay within ${remaining} min`;
  };

  return (
    <Pressable
      style={styles.card}
      onPress={() => onPress(booking)}
      onPressIn={pressIn}
      onPressOut={pressOut}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
      <Surface style={styles.cardSurface} elevation={1}>
        {/* Left status accent strip */}
        <View style={[styles.accentStrip, { backgroundColor: statusCfg.color }]} />

        {/* Top row: venue + status */}
        <View style={styles.cardHeader}>
          <View style={styles.cardVenue}>
            <Text style={styles.cardVenueName} numberOfLines={1}>
              {booking.turfName || "Turf"}
            </Text>
            <Text variant="bodySmall" style={styles.cardGround} numberOfLines={1}>
              {booking.groundName || "Ground"} • {booking.sport || "Sport"}
            </Text>
          </View>
          <StatusBadge status={booking.status} />
        </View>

        <Divider style={styles.cardDivider} />

        {/* Middle: date, time, price */}
        <View style={styles.cardBody}>
          <View style={styles.cardInfoRow}>
            <MaterialCommunityIcons name="calendar" size={16} color="#666" />
            <Text variant="bodySmall" style={styles.cardInfoText}>
              {formatDateLabel(booking.date)}
            </Text>
          </View>
          <View style={styles.cardInfoRow}>
            <MaterialCommunityIcons name="clock-outline" size={16} color="#666" />
            <Text variant="bodySmall" style={styles.cardInfoText}>
              {formatTimeLabel(booking.startTime)} – {formatTimeLabel(booking.endTime)}
            </Text>
          </View>
          <View style={styles.cardInfoRow}>
            <MaterialCommunityIcons name="currency-inr" size={16} color="#666" />
            <Text variant="bodySmall" style={styles.cardInfoText}>
              {formatPrice(booking.totalAmount || booking.totalPrice || booking.payment?.slotAmount || 0)}
            </Text>
          </View>
        </View>

        {/* Payment action buttons for payment statuses */}
        {needsPayment && (
          <>
            <Divider style={styles.cardDivider} />
            <View style={styles.paymentActionSection}>
              {booking.status === "awaiting_payment" && (
                <Text variant="bodySmall" style={styles.deadlineText}>
                  {getPaymentDeadlineText()}
                </Text>
              )}
              {booking.status === "payment_rejected" && (
                <Text variant="bodySmall" style={styles.paymentErrorText}>
                  Payment verification failed.{" "}
                  {(booking.paymentAttempts?.length || 0) < 3
                    ? `${3 - (booking.paymentAttempts?.length || 0)} attempts remaining.`
                    : "Max attempts reached."}
                </Text>
              )}
              {(booking.paymentAttempts?.length || 0) < 3 && (
                <Button
                  mode="contained"
                  compact
                  buttonColor={booking.status === "payment_rejected" ? "#FF5722" : USER_COLOR}
                  style={styles.paymentActionBtn}
                  onPress={() => onPayment(booking)}
                  icon="cash"
                >
                  {booking.status === "payment_rejected"
                    ? "Retry Payment"
                    : booking.status === "pending_payment"
                    ? "Continue Payment"
                    : `Pay ₹${booking.payment?.advanceAmount || 0}`}
                </Button>
              )}
            </View>
          </>
        )}

        {/* Payment submitted info */}
        {booking.status === "payment_submitted" && (
          <>
            <Divider style={styles.cardDivider} />
            <View style={styles.paymentInfoBanner}>
              <MaterialCommunityIcons name="clock-check-outline" size={16} color="#673AB7" />
              <Text variant="bodySmall" style={styles.paymentInfoText}>
                Payment proof submitted. Awaiting verification.
              </Text>
            </View>
          </>
        )}

        {/* Standard actions */}
        {(upcoming || isCompleted) && !needsPayment && booking.status !== "payment_submitted" && (
          <>
            <Divider style={styles.cardDivider} />
            <View style={styles.cardActions}>
              {upcoming && (
                <Button
                  mode="outlined"
                  compact
                  textColor="#F44336"
                  style={styles.actionBtn}
                  onPress={() => onCancel(booking)}
                  icon="close-circle-outline"
                >
                  Cancel
                </Button>
              )}
              {isCompleted && !booking.hasReview && (
                <Button
                  mode="outlined"
                  compact
                  textColor={USER_COLOR}
                  style={styles.actionBtn}
                  onPress={() => onReview(booking)}
                  icon="star-outline"
                >
                  Review
                </Button>
              )}
              {isCompleted && (
                <Button
                  mode="text"
                  compact
                  textColor="#EF4444"
                  style={styles.actionBtn}
                  onPress={() => onDispute(booking)}
                  icon="alert-circle-outline"
                >
                  Dispute
                </Button>
              )}
              <Button
                mode="text"
                compact
                textColor="#666"
                style={styles.actionBtn}
                onPress={() => onContact(booking)}
                icon="phone-outline"
              >
                Contact
              </Button>
            </View>
          </>
        )}

        {/* Dispute button for cancelled bookings */}
        {isCancelled && (
          <>
            <Divider style={styles.cardDivider} />
            <View style={styles.cardActions}>
              <Button
                mode="text"
                compact
                textColor="#EF4444"
                style={styles.actionBtn}
                onPress={() => onDispute(booking)}
                icon="alert-circle-outline"
              >
                Raise a Dispute
              </Button>
            </View>
          </>
        )}
      </Surface>
      </Animated.View>
    </Pressable>
  );
};

// ──────────────────────────────────────────────
// BookingDetailsModal
// ──────────────────────────────────────────────
const BookingDetailsModal = ({ visible, booking, onDismiss, onCancel, onReview }) => {
  if (!booking) return null;

  const upcoming = isUpcoming(booking);
  const isCompleted = booking.status === "completed";
  const cfg = STATUS_CONFIG[booking.status] || STATUS_CONFIG.pending;

  // Status timeline
  const timelineSteps = [
    {
      label: "Booked",
      icon: "calendar-plus",
      done: true,
      time: booking.createdAt,
    },
    {
      label: "Confirmed",
      icon: "check-circle",
      done: ["confirmed", "completed"].includes(booking.status),
      time: booking.confirmedAt,
    },
    {
      label: "Completed",
      icon: "check-all",
      done: booking.status === "completed",
      time: booking.completedAt,
    },
  ];

  if (booking.status === "cancelled") {
    timelineSteps.push({
      label: "Cancelled",
      icon: "close-circle",
      done: true,
      time: booking.cancelledAt,
      color: "#F44336",
    });
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Handle bar */}
          <View style={styles.modalHandle} />

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text variant="titleLarge" style={styles.modalTitle}>
                Booking Details
              </Text>
              <IconButton icon="close" size={24} onPress={onDismiss} />
            </View>

            {/* Booking ID + status */}
            <View style={styles.modalIdRow}>
              <Text variant="bodySmall" style={styles.modalIdLabel}>
                Booking ID
              </Text>
              <Text variant="titleSmall" style={styles.modalIdValue}>
                #{booking.id?.slice(-8).toUpperCase() || "N/A"}
              </Text>
              <StatusBadge status={booking.status} />
            </View>

            <Divider style={styles.modalDivider} />

            {/* Venue */}
            <View style={styles.modalSection}>
              <Text variant="titleSmall" style={styles.sectionTitle}>
                Venue
              </Text>
              <View style={styles.detailRow}>
                <MaterialCommunityIcons name="map-marker" size={20} color={USER_COLOR} />
                <View style={styles.detailContent}>
                  <Text variant="bodyMedium" style={styles.detailValue}>
                    {booking.turfName || "Turf"}
                  </Text>
                  <Text variant="bodySmall" style={styles.detailSub}>
                    {booking.groundName || "Ground"}
                  </Text>
                </View>
              </View>
            </View>

            {/* Schedule */}
            <View style={styles.modalSection}>
              <Text variant="titleSmall" style={styles.sectionTitle}>
                Schedule
              </Text>
              <View style={styles.detailRow}>
                <MaterialCommunityIcons name="calendar" size={20} color={USER_COLOR} />
                <Text variant="bodyMedium" style={styles.detailValue}>
                  {formatDateLabel(booking.date)}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <MaterialCommunityIcons name="clock-outline" size={20} color={USER_COLOR} />
                <Text variant="bodyMedium" style={styles.detailValue}>
                  {formatTimeLabel(booking.startTime)} – {formatTimeLabel(booking.endTime)}
                  {booking.duration ? `  (${formatDuration(booking.duration)})` : ""}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <MaterialCommunityIcons name="soccer" size={20} color={USER_COLOR} />
                <Text variant="bodyMedium" style={styles.detailValue}>
                  {booking.sport || "Sport"}
                </Text>
              </View>
            </View>

            {/* Payment */}
            <View style={styles.modalSection}>
              <Text variant="titleSmall" style={styles.sectionTitle}>
                Payment
              </Text>
              <View style={styles.paymentRow}>
                <Text variant="bodyMedium" style={styles.paymentLabel}>Total Amount</Text>
                <Text variant="titleMedium" style={styles.paymentValue}>
                  {formatPrice(booking.totalAmount || booking.totalPrice || booking.payment?.slotAmount || 0)}
                </Text>
              </View>
              {booking.payment?.advanceAmount > 0 && (
                <View style={styles.paymentRow}>
                  <Text variant="bodySmall" style={styles.paymentLabel}>Advance Paid</Text>
                  <Text variant="bodyMedium" style={{ color: "#10B981", fontWeight: "500" }}>
                    {formatPrice(booking.payment.advanceAmount)}
                  </Text>
                </View>
              )}
              {booking.payment?.remainingAmount != null && booking.payment?.advanceAmount > 0 && (
                <View style={styles.paymentRow}>
                  <Text variant="bodySmall" style={styles.paymentLabel}>Remaining</Text>
                  <Text variant="bodyMedium" style={{ color: "#FF9800", fontWeight: "500" }}>
                    {formatPrice(booking.payment.remainingAmount)}
                  </Text>
                </View>
              )}
              <View style={styles.paymentRow}>
                <Text variant="bodySmall" style={styles.paymentLabel}>Payment Status</Text>
                <Chip
                  compact
                  style={{
                    backgroundColor:
                      booking.payment?.isFullyPaid ? "#D1FAE5" : "#FFF3E0",
                  }}
                  textStyle={{
                    fontSize: 11,
                    color:
                      booking.payment?.isFullyPaid ? "#10B981" : "#FF9800",
                  }}
                >
                  {booking.payment?.isFullyPaid ? "PAID" : (booking.payment?.advance?.status === "verified" ? "ADVANCE PAID" : "PENDING")}
                </Chip>
              </View>
            </View>

            {/* Coupon Voucher / Discount Info */}
            {booking.coupon?.applied && (
              <View style={styles.modalSection}>
                <Text variant="titleSmall" style={styles.sectionTitle}>
                  Discount Applied
                </Text>
                <CouponVoucherCard
                  coupon={booking.coupon}
                  isVenue={!booking.payment?.advanceAmount || booking.payment.advanceAmount === 0}
                />
              </View>
            )}

            {/* Special Requests */}
            {booking.specialRequests ? (
              <View style={styles.modalSection}>
                <Text variant="titleSmall" style={styles.sectionTitle}>
                  Special Requests
                </Text>
                <Text variant="bodyMedium" style={styles.specialRequestText}>
                  {booking.specialRequests}
                </Text>
              </View>
            ) : null}

            {/* Status Timeline */}
            <View style={styles.modalSection}>
              <Text variant="titleSmall" style={styles.sectionTitle}>
                Status Timeline
              </Text>
              <View style={styles.timeline}>
                {timelineSteps.map((step, index) => {
                  const stepColor = step.color || (step.done ? USER_COLOR : "#ccc");
                  const isLast = index === timelineSteps.length - 1;

                  return (
                    <View key={step.label} style={styles.timelineStep}>
                      <View style={styles.timelineLeft}>
                        <View
                          style={[
                            styles.timelineDot,
                            { backgroundColor: stepColor },
                          ]}
                        >
                          <MaterialCommunityIcons
                            name={step.done ? step.icon : "circle-outline"}
                            size={14}
                            color="#fff"
                          />
                        </View>
                        {!isLast && (
                          <View
                            style={[
                              styles.timelineLine,
                              { backgroundColor: step.done ? stepColor : "#e0e0e0" },
                            ]}
                          />
                        )}
                      </View>
                      <View style={styles.timelineContent}>
                        <Text
                          variant="bodyMedium"
                          style={[
                            styles.timelineLabel,
                            !step.done && { color: "#999" },
                          ]}
                        >
                          {step.label}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Cancellation info */}
            {booking.status === "cancelled" && booking.cancellationReason && (
              <View style={styles.modalSection}>
                <Text variant="titleSmall" style={styles.sectionTitle}>
                  Cancellation Reason
                </Text>
                <Text variant="bodyMedium" style={styles.specialRequestText}>
                  {booking.cancellationReason}
                </Text>
                {booking.refundAmount != null && (
                  <Text variant="bodySmall" style={{ color: USER_COLOR, marginTop: 8 }}>
                    Refund: {formatPrice(booking.refundAmount)}
                  </Text>
                )}
              </View>
            )}

            {/* Bottom actions */}
            <View style={styles.modalActions}>
              {upcoming && (
                <Button
                  mode="contained"
                  buttonColor="#F44336"
                  onPress={() => {
                    onDismiss();
                    onCancel(booking);
                  }}
                  style={styles.modalActionBtn}
                  icon="close-circle-outline"
                >
                  Cancel Booking
                </Button>
              )}
              {isCompleted && !booking.hasReview && (
                <Button
                  mode="contained"
                  buttonColor={USER_COLOR}
                  onPress={() => {
                    onDismiss();
                    onReview(booking);
                  }}
                  style={styles.modalActionBtn}
                  icon="star-outline"
                >
                  Write Review
                </Button>
              )}
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// ──────────────────────────────────────────────
// CancelBookingModal
// ──────────────────────────────────────────────
const CancelBookingModal = ({ visible, booking, onDismiss, onConfirmCancel }) => {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  if (!booking) return null;

  const hours = hoursUntilBooking(booking);
  let refundPercent = 0;
  let refundLabel = "";

  if (hours >= 24) {
    refundPercent = 100;
    refundLabel = "Full refund (24+ hours before)";
  } else if (hours >= 2) {
    refundPercent = 50;
    refundLabel = "50% refund (2–24 hours before)";
  } else {
    refundPercent = 0;
    refundLabel = "No refund (less than 2 hours)";
  }

  // Calculate refund based on what was actually paid
  // If advance payment was made, refund only the advance amount (not the full booking)
  const advancePaid = booking.payment?.advance?.status === "paid" && booking.payment?.advanceAmount > 0;
  const refundableAmount = advancePaid
    ? booking.payment.advanceAmount
    : (booking.totalAmount || booking.totalPrice || booking.payment?.slotAmount || 0);

  const refundAmount = Math.round((refundableAmount * refundPercent) / 100);

  const handleCancel = async () => {
    setLoading(true);
    await onConfirmCancel(booking, reason.trim(), refundAmount, refundPercent);
    setLoading(false);
    setReason("");
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.modalOverlay}>
        <Surface style={styles.cancelDialog} elevation={8}>
          <Text variant="titleLarge" style={styles.cancelTitle}>
            Cancel Booking?
          </Text>

          {/* Booking info */}
          <View style={styles.cancelInfo}>
            <Text variant="bodyMedium" style={styles.cancelVenue}>
              {booking.turfName} – {booking.groundName}
            </Text>
            <Text variant="bodySmall" style={styles.cancelDate}>
              {formatDateLabel(booking.date)} • {formatTimeLabel(booking.startTime)} – {formatTimeLabel(booking.endTime)}
            </Text>
          </View>

          <Divider style={{ marginVertical: 12 }} />

          {/* Refund policy */}
          <View style={styles.refundSection}>
            <Text variant="titleSmall" style={styles.refundTitle}>
              Refund Policy
            </Text>
            <View style={styles.refundPolicyItem}>
              <MaterialCommunityIcons name="check-circle" size={16} color="#10B981" />
              <Text variant="bodySmall" style={styles.refundPolicyText}>
                Free cancellation 24+ hours before
              </Text>
            </View>
            <View style={styles.refundPolicyItem}>
              <MaterialCommunityIcons name="clock-alert-outline" size={16} color="#FF9800" />
              <Text variant="bodySmall" style={styles.refundPolicyText}>
                50% refund within 2–24 hours
              </Text>
            </View>
            <View style={styles.refundPolicyItem}>
              <MaterialCommunityIcons name="close-circle" size={16} color="#F44336" />
              <Text variant="bodySmall" style={styles.refundPolicyText}>
                No refund within 2 hours
              </Text>
            </View>

            <View style={styles.refundResult}>
              <Text variant="bodyMedium" style={styles.refundResultLabel}>
                {refundLabel}
              </Text>
              <Text variant="titleMedium" style={styles.refundResultAmount}>
                Refund: {formatPrice(refundAmount)}
              </Text>
            </View>
          </View>

          {/* Reason */}
          <TextInput
            mode="outlined"
            label="Reason for cancellation (optional)"
            value={reason}
            onChangeText={setReason}
            multiline
            numberOfLines={2}
            style={styles.cancelReasonInput}
            outlineColor="#ddd"
            activeOutlineColor="#F44336"
          />

          {/* Actions */}
          <View style={styles.cancelActions}>
            <Button
              mode="outlined"
              onPress={() => {
                setReason("");
                onDismiss();
              }}
              style={styles.cancelActionBtn}
              disabled={loading}
            >
              Keep Booking
            </Button>
            <Button
              mode="contained"
              buttonColor="#F44336"
              onPress={handleCancel}
              style={styles.cancelActionBtn}
              loading={loading}
              disabled={loading}
            >
              Confirm Cancel
            </Button>
          </View>
        </Surface>
      </View>
    </Modal>
  );
};

// ──────────────────────────────────────────────
// Main Screen
// ──────────────────────────────────────────────
export default function BookingsScreen({ navigation }) {
  const user = useSelector(selectUser);
  const userId = user?.id || user?.userId || user?.uid;

  const [selectedTab, setSelectedTab] = useState("upcoming");
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const scrollRef = useRef(null);
  const currentPageRef = useRef(0);

  // Modal state
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showCancel, setShowCancel] = useState(false);

  // Real-time subscription
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    // Silently reject any stale pending bookings for this user before loading
    autoRejectExpiredPendingBookings([
      { field: "userId", operator: "==", value: userId },
    ]);

    setLoading(true);
    const unsubscribe = subscribeToCollection(
      "bookings",
      (docs) => {
        setBookings(docs);
        setLoading(false);
        setRefreshing(false);
      },
      [{ field: "userId", operator: "==", value: userId }]
    );

    return () => unsubscribe();
  }, [userId]);

  // Per-tab sorted lists (all computed together so swipe pages are ready)
  const upcomingBookings = useMemo(() => {
    const filtered = bookings.filter(isUpcoming);
    filtered.sort((a, b) => {
      const diff = a.date.localeCompare(b.date);
      return diff !== 0 ? diff : (a.startTime || "").localeCompare(b.startTime || "");
    });
    return filtered;
  }, [bookings]);

  const completedBookings = useMemo(() => {
    const filtered = bookings.filter((b) => b.status === "completed");
    filtered.sort((a, b) => b.date.localeCompare(a.date));
    return filtered;
  }, [bookings]);

  const cancelledBookings = useMemo(() => {
    const filtered = bookings.filter(
      (b) => b.status === "cancelled" || b.status === "rejected" || b.status === "expired"
    );
    filtered.sort((a, b) => b.date.localeCompare(a.date));
    return filtered;
  }, [bookings]);

  // Actions
  const handlePress = (booking) => {
    setSelectedBooking(booking);
    setShowDetails(true);
  };

  const handleCancel = (booking) => {
    setSelectedBooking(booking);
    setShowCancel(true);
  };

  const handleConfirmCancel = useCallback(
    async (booking, reason, refundAmount, refundPercent) => {
      try {
        await updateDocument("bookings", booking.id, {
          status: "cancelled",
          cancellationReason: reason || "",
          cancelledAt: new Date().toISOString(),
          refundAmount,
          refundPercent,
        });
        setShowCancel(false);
        Alert.alert(
          "Booking Cancelled",
          refundAmount > 0
            ? `Your booking has been cancelled. A refund of ${formatPrice(refundAmount)} will be processed.`
            : "Your booking has been cancelled."
        );
      } catch (error) {
        console.error("Cancel error:", error);
        Alert.alert("Error", "Failed to cancel booking. Please try again.");
      }
    },
    []
  );

  const handleReview = (booking) => {
    navigation.navigate("WriteReview", {
      bookingId: booking.id,
      turfId: booking.turfId,
      turfName: booking.turfName || "Turf",
      companyId: booking.companyId || null,
    });
  };

  const handleDispute = async (booking) => {
    let companyId = booking.companyId || "";
    let companyName = booking.companyName || "";

    try {
      // companyId missing on some booking docs — look it up from the turf
      if (!companyId && booking.turfId) {
        const turf = await getDocument("turfs", booking.turfId);
        companyId = turf?.companyId || "";
      }
      // fetch company name once we have the id
      if (companyId && !companyName) {
        const company = await getDocument("companies", companyId);
        companyName = company?.name || "";
      }
    } catch (e) {
      // proceed with whatever we have
    }

    navigation.navigate("NewDispute", {
      bookingId: booking.id,
      companyId,
      companyName,
      turfName: booking.turfName || "",
      turfId: booking.turfId || "",
    });
  };

  const handlePayment = (booking) => {
    const lockExpiry =
      booking.slotLock?.lockExpiry
        ? new Date(booking.slotLock.lockExpiry).getTime()
        : booking.payment?.advance?.paymentDeadline
        ? new Date(booking.payment.advance.paymentDeadline).getTime()
        : new Date().getTime() + 10 * 60 * 1000;

    navigation.navigate("CashfreePayment", {
      bookingId: booking.id,
      amount: booking.payment?.advanceAmount || 0,
      customerPhone: booking.userPhone || "",
      customerName: booking.userName || "",
      turfName: booking.turfName || "Turf",
      lockExpiry,
    });
  };

  const handleContact = async (booking) => {
    const companyId = booking.companyId;
    const turfId = booking.turfId;

    if (!companyId || !turfId) {
      Alert.alert("Contact", "Contact information not available for this turf.");
      return;
    }

    try {
      const [managers, caretakers] = await Promise.all([
        queryDocuments("users", [
          { field: "companyId", operator: "==", value: companyId },
          { field: "role", operator: "==", value: "manager" },
        ]),
        queryDocuments("users", [
          { field: "companyId", operator: "==", value: companyId },
          { field: "role", operator: "==", value: "caretaker" },
        ]),
      ]);

      const turfManagers = managers.filter((m) =>
        (m.assignedTurfIds || m.assignedTurfs || []).includes(turfId)
      );
      const turfCaretakers = caretakers.filter((c) =>
        c.assignedTurfId === turfId ||
        (c.assignedTurfIds || c.assignedTurfs || []).includes(turfId)
      );

      const contacts = [];
      turfManagers.forEach((m) => {
        if (m.phone) contacts.push({ name: m.name || "Manager", phone: m.phone, role: "Manager" });
      });
      turfCaretakers.forEach((c) => {
        if (c.phone) contacts.push({ name: c.name || "Caretaker", phone: c.phone, role: "Caretaker" });
      });

      if (contacts.length === 0) {
        Alert.alert("Contact", "No contact numbers available for this turf.");
        return;
      }

      const buttons = contacts.map((c) => ({
        text: `${c.role}: ${c.name} (${c.phone})`,
        onPress: () => Linking.openURL(`tel:${c.phone}`),
      }));
      buttons.push({ text: "Cancel", style: "cancel" });

      Alert.alert("Contact Turf", booking.turfName || "Turf", buttons);
    } catch (error) {
      console.error("Error fetching contacts:", error);
      Alert.alert("Error", "Failed to load contact information.");
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    // The subscription will fire automatically, but we set refreshing flag
    // It will be reset when subscription delivers data
    setTimeout(() => setRefreshing(false), 3000); // Safety timeout
  };

  // Pager handlers
  const handleTabPress = (tabValue) => {
    const index = TAB_ORDER.indexOf(tabValue);
    currentPageRef.current = index;
    scrollRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
    setSelectedTab(tabValue);
  };

  const handleScroll = (event) => {
    const x = event.nativeEvent.contentOffset.x;
    const index = Math.round(x / SCREEN_WIDTH);
    if (index >= 0 && index < TAB_ORDER.length && index !== currentPageRef.current) {
      currentPageRef.current = index;
      setSelectedTab(TAB_ORDER[index]);
    }
  };

  // Count badges
  const upcomingCount = useMemo(() => bookings.filter(isUpcoming).length, [bookings]);
  const completedCount = useMemo(
    () => bookings.filter((b) => b.status === "completed").length,
    [bookings]
  );
  const cancelledCount = useMemo(
    () => bookings.filter(
      (b) => b.status === "cancelled" || b.status === "rejected" || b.status === "expired"
    ).length,
    [bookings]
  );

  // Empty states
  const emptyConfig = {
    upcoming: {
      icon: "calendar-clock",
      title: "No Upcoming Bookings",
      subtitle: "Book a turf to see your upcoming games here",
      action: "Browse Turfs",
    },
    completed: {
      icon: "calendar-check",
      title: "No Completed Bookings",
      subtitle: "Your past bookings will appear here",
    },
    cancelled: {
      icon: "calendar-remove",
      title: "No Cancelled Bookings",
      subtitle: "Cancelled bookings will show up here",
    },
  };

  const renderEmpty = (tab) => {
    const cfg = emptyConfig[tab];
    return (
      <View style={styles.emptyContainer}>
        <Surface style={styles.emptyCard} elevation={1}>
          <MaterialCommunityIcons name={cfg.icon} size={64} color="#ccc" />
          <Text variant="titleMedium" style={styles.emptyTitle}>
            {cfg.title}
          </Text>
          <Text variant="bodyMedium" style={styles.emptyText}>
            {cfg.subtitle}
          </Text>
          {cfg.action && (
            <Button
              mode="contained"
              buttonColor={USER_COLOR}
              style={{ marginTop: 16, borderRadius: 8 }}
              onPress={() => navigation.navigate("Home")}
            >
              {cfg.action}
            </Button>
          )}
        </Surface>
      </View>
    );
  };

  const renderBookingCard = ({ item }) => (
    <BookingCard
      booking={item}
      onPress={handlePress}
      onCancel={handleCancel}
      onReview={handleReview}
      onContact={handleContact}
      onPayment={handlePayment}
      onDispute={handleDispute}
    />
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.headerWrapper}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.title}>My Bookings</Text>
          </View>
        </View>
        <SkeletonBookingList count={4} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header + Tabs unified */}
      <View style={styles.headerWrapper}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.title}>My Bookings</Text>
          {bookings.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{bookings.length}</Text>
            </View>
          )}
        </View>

        <View style={styles.tabContainer}>
          {[
            { value: "upcoming", label: "Upcoming", count: upcomingCount },
            { value: "completed", label: "Completed", count: completedCount },
            { value: "cancelled", label: "Cancelled", count: cancelledCount },
          ].map((tab) => {
            const isActive = selectedTab === tab.value;
            return (
              <TouchableOpacity
                key={tab.value}
                style={[styles.tab, isActive && styles.tabActive]}
                onPress={() => handleTabPress(tab.value)}
              >
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                  {tab.label}
                </Text>
                {tab.count > 0 && (
                  <View style={[styles.tabBadge, isActive && styles.tabBadgeActive]}>
                    <Text style={[styles.tabBadgeText, isActive && styles.tabBadgeTextActive]}>
                      {tab.count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Swipeable pages */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={50}
        style={styles.pager}
      >
        {[
          { key: "upcoming", data: upcomingBookings },
          { key: "completed", data: completedBookings },
          { key: "cancelled", data: cancelledBookings },
        ].map(({ key, data }) => (
          <View key={key} style={styles.pagerPage}>
            {data.length === 0 ? (
              renderEmpty(key)
            ) : (
              <FlatList
                data={data}
                keyExtractor={(item) => item.id}
                renderItem={renderBookingCard}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    colors={[USER_COLOR]}
                    tintColor={USER_COLOR}
                  />
                }
              />
            )}
          </View>
        ))}
      </ScrollView>

      {/* Modals */}
      <BookingDetailsModal
        visible={showDetails}
        booking={selectedBooking}
        onDismiss={() => setShowDetails(false)}
        onCancel={handleCancel}
        onReview={handleReview}
      />
      <CancelBookingModal
        visible={showCancel}
        booking={selectedBooking}
        onDismiss={() => setShowCancel(false)}
        onConfirmCancel={handleConfirmCancel}
      />
    </SafeAreaView>
  );
}

// ──────────────────────────────────────────────
// Styles
// ──────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: PAGE_BG,
  },
  loadingText: {
    marginTop: 12,
    color: "#666",
  },


  // Header + Tabs unified block
  headerWrapper: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#ebebeb",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 4,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 22,
    color: "#111",
    letterSpacing: -0.3,
  },
  countBadge: {
    backgroundColor: USER_COLOR + "18",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  countBadgeText: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: USER_COLOR,
  },

  // Tabs (inside header)
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#f0f0f0",
    borderRadius: 12,
    padding: 3,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: "#fff",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  tabText: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: "#888",
  },
  tabTextActive: {
    color: USER_COLOR,
    fontFamily: FONTS.bold,
  },
  tabBadge: {
    marginLeft: 6,
    backgroundColor: "#d0d0d0",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  tabBadgeActive: {
    backgroundColor: USER_COLOR,
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#666",
  },
  tabBadgeTextActive: {
    color: "#fff",
  },

  // Pager
  pager: {
    flex: 1,
  },
  pagerPage: {
    width: SCREEN_WIDTH,
    flex: 1,
  },

  // List
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 24,
  },

  // Booking Card
  card: {
    marginBottom: 12,
  },
  cardSurface: {
    borderRadius: 12,
    backgroundColor: "#fff",
    overflow: "hidden",
    // Softer shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  accentStrip: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 14,
    paddingLeft: 18,   // indent past accent strip
    paddingBottom: 10,
  },
  cardVenue: {
    flex: 1,
    marginRight: 12,
  },
  cardVenueName: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: "#1a1a1a",
  },
  cardGround: {
    fontFamily: FONTS.regular,
    color: "#777",
    marginTop: 2,
    fontSize: 12,
  },
  cardDivider: {
    backgroundColor: "#f0f0f0",
  },
  cardBody: {
    padding: 14,
    paddingLeft: 18,    // indent past accent strip
    paddingTop: 10,
    paddingBottom: 10,
  },
  cardInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
  },
  cardInfoText: {
    marginLeft: 8,
    color: "#555",
    fontFamily: FONTS.regular,
    fontSize: 13,
  },
  cardActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    padding: 8,
    paddingTop: 4,
    gap: 4,
  },
  actionBtn: {
    borderRadius: 8,
  },
  paymentActionSection: {
    padding: 12,
  },
  deadlineText: {
    color: "#FF5722",
    fontWeight: "600",
    marginBottom: 8,
  },
  paymentErrorText: {
    color: "#F44336",
    marginBottom: 8,
  },
  paymentActionBtn: {
    borderRadius: 8,
  },
  paymentInfoBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 8,
  },
  paymentInfoText: {
    color: "#673AB7",
    flex: 1,
  },

  // Status Badge
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 14,
    gap: 4,
  },
  statusText: {
    fontSize: 11,
    fontFamily: FONTS.medium,
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    padding: 16,
  },
  emptyCard: {
    padding: 32,
    borderRadius: 16,
    backgroundColor: "#fff",
    alignItems: "center",
  },
  emptyTitle: {
    marginTop: 16,
    fontWeight: "600",
    color: "#333",
  },
  emptyText: {
    marginTop: 8,
    color: "#999",
    textAlign: "center",
  },

  // ─── Details Modal ───
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
    paddingBottom: 20,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#ddd",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingLeft: 20,
    paddingRight: 8,
  },
  modalTitle: {
    fontWeight: "600",
    color: "#333",
  },
  modalIdRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 12,
    gap: 8,
  },
  modalIdLabel: {
    color: "#999",
  },
  modalIdValue: {
    color: USER_COLOR,
    fontWeight: "600",
    flex: 1,
  },
  modalDivider: {
    backgroundColor: "#eee",
    marginHorizontal: 20,
  },
  modalSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  sectionTitle: {
    fontWeight: "600",
    color: "#333",
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  detailContent: {
    marginLeft: 12,
  },
  detailValue: {
    color: "#333",
    fontWeight: "500",
    marginLeft: 12,
  },
  detailSub: {
    color: "#999",
  },

  // Payment
  paymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  paymentLabel: {
    color: "#666",
  },
  paymentValue: {
    fontWeight: "bold",
    color: USER_COLOR,
  },

  specialRequestText: {
    color: "#555",
    lineHeight: 20,
    backgroundColor: "#f9f9f9",
    padding: 12,
    borderRadius: 8,
  },

  // Timeline
  timeline: {
    paddingLeft: 4,
  },
  timelineStep: {
    flexDirection: "row",
    minHeight: 48,
  },
  timelineLeft: {
    alignItems: "center",
    width: 32,
  },
  timelineDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginVertical: 2,
  },
  timelineContent: {
    flex: 1,
    paddingLeft: 12,
    paddingTop: 4,
  },
  timelineLabel: {
    fontWeight: "500",
    color: "#333",
  },

  // Modal actions
  modalActions: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  modalActionBtn: {
    borderRadius: 10,
    marginBottom: 8,
  },

  // ─── Cancel Modal ───
  cancelDialog: {
    marginHorizontal: 20,
    borderRadius: 16,
    backgroundColor: "#fff",
    padding: 20,
    maxHeight: "80%",
  },
  cancelTitle: {
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  cancelInfo: {
    marginBottom: 4,
  },
  cancelVenue: {
    fontWeight: "500",
    color: "#333",
  },
  cancelDate: {
    color: "#666",
    marginTop: 4,
  },
  refundSection: {
    backgroundColor: "#f9f9f9",
    padding: 14,
    borderRadius: 10,
    marginBottom: 12,
  },
  refundTitle: {
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  refundPolicyItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  refundPolicyText: {
    marginLeft: 8,
    color: "#555",
    flex: 1,
  },
  refundResult: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  refundResultLabel: {
    color: "#666",
    marginBottom: 4,
  },
  refundResultAmount: {
    fontWeight: "bold",
    color: USER_COLOR,
  },
  cancelReasonInput: {
    marginBottom: 16,
    backgroundColor: "#fff",
  },
  cancelActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  cancelActionBtn: {
    flex: 1,
    borderRadius: 8,
  },
});
