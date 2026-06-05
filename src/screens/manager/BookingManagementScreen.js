import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput as RNTextInput,
} from "react-native";
import {
  Text,
  Surface,
  Button,
  Badge,
  Chip,
  Divider,
  ActivityIndicator,
  Portal,
  Dialog,
  RadioButton,
  IconButton,
  Menu,
  Searchbar,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSelectedTurf } from "../../hooks/useSelectedTurf";
import { useAppSelector } from "../../hooks";
import { selectUser } from "../../store/slices/authSlice";
import {
  queryDocuments,
  updateDocument,
  subscribeToCollection,
  getDocument,
  autoRejectExpiredPendingBookings,
} from "../../services/firebase/firestore";
import { useCashfreePayment } from "../../hooks/useCashfreePayment";

const MANAGER_BLUE = "#3B82F6";
const PALE_BLUE = "#DBEAFE";
const SUCCESS_GREEN = "#22C55E";
const WARN_ORANGE = "#F59E0B";
const DANGER_RED = "#EF4444";
const NAVY_BLUE = "#1E40AF";

// Status colors
const STATUS_COLORS = {
  pending: "#F59E0B",
  pending_payment: "#8B5CF6",
  payment_submitted: "#6D28D9",
  awaiting_payment: "#F97316",
  payment_rejected: "#EF4444",
  expired: "#9CA3AF",
  confirmed: "#3B82F6",
  in_progress: "#06B6D4",
  completed: "#22C55E",
  cancelled: "#9CA3AF",
  rejected: "#EF4444",
};

// Cancellation reasons (for confirmed bookings)
const CANCEL_REASONS = [
  { value: "maintenance", label: "Turf under maintenance" },
  { value: "weather", label: "Severe weather conditions" },
  { value: "emergency", label: "Emergency closure" },
  { value: "double_booking", label: "Double booking error" },
  { value: "facility_issue", label: "Facility issue" },
  { value: "other", label: "Other reason" },
];

// Rejection reasons
const REJECTION_REASONS = [
  { value: "slot_unavailable", label: "Time slot unavailable" },
  { value: "maintenance", label: "Turf under maintenance" },
  { value: "weather", label: "Weather conditions" },
  { value: "double_booking", label: "Double booking detected" },
  { value: "payment_issue", label: "Payment verification failed" },
  { value: "other", label: "Other reason" },
];

// Helper functions
const formatDate = (dateStr) => {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${parseInt(day)} ${months[parseInt(month) - 1]}`;
};

const formatTime = (timeStr) => {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${m} ${ampm}`;
};

const getTodayString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Check if two time ranges overlap
const hasTimeOverlap = (start1, end1, start2, end2) => {
  return start1 < end2 && end1 > start2;
};

// Normalize ground ID for comparison (handles legacy "ground-0" vs "ground_0" formats)
const normalizeGroundId = (groundId) => {
  if (!groundId) return "";
  return groundId.toLowerCase().replace(/[-_]/g, "");
};

export default function BookingManagementScreen({ navigation }) {
  const { selectedTurfId, turfData } = useSelectedTurf();
  const user = useAppSelector(selectUser);

  // Tab state
  const [activeTab, setActiveTab] = useState("pending");
  const tabCounts = useRef({ pending: 0, confirmed: 0, completed: 0, cancelled: 0 });

  // Data state
  const [bookings, setBookings] = useState([]);
  const [filteredBookings, setFilteredBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  // Filter state
  const [filterVisible, setFilterVisible] = useState(false);
  const [dateFilter, setDateFilter] = useState("all"); // all, today, week, custom
  const [searchQuery, setSearchQuery] = useState("");

  // Ground options (used for display names)
  const [grounds, setGrounds] = useState([]);

  // Reject dialog state
  const [rejectDialogVisible, setRejectDialogVisible] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [customRejectReason, setCustomRejectReason] = useState("");

  // Cancel confirmed booking dialog state
  const [cancelDialogVisible, setCancelDialogVisible] = useState(false);
  const [cancelBookingTarget, setCancelBookingTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [customCancelReason, setCustomCancelReason] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);

  const { cancelBooking } = useCashfreePayment();

  // Conflict warning state
  const [conflictWarnings, setConflictWarnings] = useState({});

  // Subscription ref
  const unsubscribeRef = useRef(null);

  // Load grounds from turf data (grounds are embedded in turf document)
  useEffect(() => {
    if (!turfData) {
      setGrounds([]);
      return;
    }

    try {
      // Grounds are stored as an array within the turf document
      const groundsData = turfData.grounds || [];

      // Map grounds with proper IDs
      const groundsWithIds = groundsData.map((g, index) => ({
        ...g,
        id: g.id || `ground_${index}`,
      }));

      setGrounds(groundsWithIds);
    } catch (error) {
      console.error("Error loading grounds:", error);
    }
  }, [turfData]);

  // Subscribe to bookings
  useEffect(() => {
    if (!selectedTurfId) {
      setLoading(false);
      return;
    }

    // Silently reject any stale pending bookings for this turf before loading
    autoRejectExpiredPendingBookings([
      { field: "turfId", operator: "==", value: selectedTurfId },
    ]);

    setLoading(true);

    const unsubscribe = subscribeToCollection(
      "bookings",
      (docs) => {
        // Sort by date desc, then startTime
        const sorted = docs.sort((a, b) => {
          if (a.date !== b.date) return b.date.localeCompare(a.date);
          return (a.startTime || "").localeCompare(b.startTime || "");
        });

        setBookings(sorted);

        // Calculate counts (include payment statuses in pending tab)
        tabCounts.current = {
          pending: docs.filter(
            (d) => d.status === "pending" || d.status === "payment_submitted" ||
                   d.status === "pending_payment" || d.status === "awaiting_payment"
          ).length,
          confirmed: docs.filter((d) => d.status === "confirmed").length,
          completed: docs.filter((d) => d.status === "completed").length,
          cancelled: docs.filter(
            (d) => d.status === "cancelled" || d.status === "rejected" ||
                   d.status === "payment_rejected" || d.status === "expired"
          ).length,
        };

        // Detect conflicts among pending bookings
        detectConflicts(docs.filter((d) => d.status === "pending"));

        setLoading(false);
        setRefreshing(false);
      },
      [{ field: "turfId", operator: "==", value: selectedTurfId }]
    );

    unsubscribeRef.current = unsubscribe;

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [selectedTurfId]);

  // Filter bookings when tab or filters change
  useEffect(() => {
    let filtered = bookings;

    // Filter by status (tab)
    if (activeTab === "cancelled") {
      filtered = filtered.filter(
        (b) => b.status === "cancelled" || b.status === "rejected" ||
               b.status === "payment_rejected" || b.status === "expired"
      );
    } else if (activeTab === "pending") {
      // Include all payment-related pending statuses
      filtered = filtered.filter(
        (b) => b.status === "pending" || b.status === "payment_submitted" ||
               b.status === "pending_payment" || b.status === "awaiting_payment"
      );
    } else {
      filtered = filtered.filter((b) => b.status === activeTab);
    }

    // Filter by date
    const today = getTodayString();
    if (dateFilter === "today") {
      filtered = filtered.filter((b) => b.date === today);
    } else if (dateFilter === "week") {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekAgoStr = `${weekAgo.getFullYear()}-${String(weekAgo.getMonth() + 1).padStart(2, "0")}-${String(weekAgo.getDate()).padStart(2, "0")}`;
      filtered = filtered.filter((b) => b.date >= weekAgoStr);
    } else if (dateFilter === "upcoming") {
      filtered = filtered.filter((b) => b.date >= today);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (b) =>
          (b.userName || b.customerName || "").toLowerCase().includes(query) ||
          (b.userPhone || b.customerPhone || "").includes(query) ||
          (b.sport || "").toLowerCase().includes(query)
      );
    }

    setFilteredBookings(filtered);
  }, [bookings, activeTab, dateFilter, searchQuery]);

  // Detect conflicts among pending bookings
  const detectConflicts = (pendingBookings) => {
    const conflicts = {};

    for (let i = 0; i < pendingBookings.length; i++) {
      const booking = pendingBookings[i];
      const conflicting = [];
      const normalizedBookingGroundId = normalizeGroundId(booking.groundId);

      for (let j = 0; j < pendingBookings.length; j++) {
        if (i === j) continue;
        const other = pendingBookings[j];

        // Same date and ground (using normalized comparison for legacy data compatibility)
        if (
          booking.date === other.date &&
          normalizeGroundId(other.groundId) === normalizedBookingGroundId &&
          hasTimeOverlap(booking.startTime, booking.endTime, other.startTime, other.endTime)
        ) {
          conflicting.push(other.id);
        }
      }

      if (conflicting.length > 0) {
        conflicts[booking.id] = conflicting;
      }
    }

    setConflictWarnings(conflicts);
  };

  // Approve booking with transaction
  const handleApprove = async (booking) => {
    setActionLoading(booking.id);
    const normalizedBookingGroundId = normalizeGroundId(booking.groundId);

    try {
      // Check for conflicts with confirmed/locked bookings
      const allBookings = await queryDocuments("bookings", [
        { field: "turfId", operator: "==", value: selectedTurfId },
      ]);

      const blockingStatuses = [
        "confirmed", "in_progress", "awaiting_payment", "payment_submitted",
      ];
      const conflictingConfirmed = allBookings.filter(
        (b) =>
          b.id !== booking.id &&
          blockingStatuses.includes(b.status) &&
          b.date === booking.date &&
          normalizeGroundId(b.groundId) === normalizedBookingGroundId &&
          hasTimeOverlap(booking.startTime, booking.endTime, b.startTime, b.endTime)
      );

      if (conflictingConfirmed.length > 0) {
        Alert.alert(
          "Slot Conflict",
          "This time slot conflicts with an existing confirmed or locked booking. Please reject this booking or adjust the schedule.",
          [{ text: "OK" }]
        );
        setActionLoading(null);
        return;
      }

      // Check for academy sessions (if applicable)
      try {
        const academySessions = await queryDocuments("academy_sessions", [
          { field: "turfId", operator: "==", value: selectedTurfId },
        ]);

        const conflictingSession = academySessions.find(
          (s) =>
            s.date === booking.date &&
            normalizeGroundId(s.groundId) === normalizedBookingGroundId &&
            hasTimeOverlap(booking.startTime, booking.endTime, s.startTime, s.endTime)
        );

        if (conflictingSession) {
          Alert.alert(
            "Academy Session Conflict",
            "This time slot conflicts with a scheduled academy session.",
            [{ text: "OK" }]
          );
          setActionLoading(null);
          return;
        }
      } catch (e) {
        // Academy sessions collection might not exist, continue
      }

      // Determine approval flow based on advance payment config
      const paymentTiming = booking.payment?.advanceConfig?.paymentTiming;
      const isAdvanceRequired = booking.payment?.advanceConfig?.isRequired;
      const paymentTimeout = booking.payment?.advanceConfig?.paymentTimeout || 120;

      if (isAdvanceRequired && paymentTiming === "after_approval") {
        // AFTER APPROVAL FLOW: Set to awaiting_payment with hard lock + deadline
        const paymentDeadline = new Date(Date.now() + paymentTimeout * 60 * 1000);

        await updateDocument("bookings", booking.id, {
          status: "awaiting_payment",
          approvedBy: user?.userId,
          approvedAt: new Date().toISOString(),
          "slotLock.isLocked": true,
          "slotLock.lockType": "hard",
          "slotLock.lockedAt": new Date().toISOString(),
          "slotLock.lockExpiry": paymentDeadline.toISOString(),
          "slotLock.lockReason": "awaiting_payment",
          "payment.advance.paymentDeadline": paymentDeadline.toISOString(),
        });
      } else {
        // NORMAL or BEFORE APPROVAL (already paid) flow: Confirm directly
        await updateDocument("bookings", booking.id, {
          status: "confirmed",
          approvedBy: user?.userId,
          approvedAt: new Date().toISOString(),
          "slotLock.isLocked": true,
          "slotLock.lockType": "hard",
          "slotLock.lockedAt": new Date().toISOString(),
          "slotLock.lockExpiry": null,
          "slotLock.lockReason": "approved",
        });
      }

      // Auto-reject other conflicting pending bookings for the same slot
      const conflictingPending = allBookings.filter(
        (b) =>
          b.id !== booking.id &&
          (b.status === "pending" || b.status === "pending_payment") &&
          b.date === booking.date &&
          normalizeGroundId(b.groundId) === normalizedBookingGroundId &&
          hasTimeOverlap(booking.startTime, booking.endTime, b.startTime, b.endTime)
      );

      for (const conflict of conflictingPending) {
        await updateDocument("bookings", conflict.id, {
          status: "rejected",
          rejectedBy: user?.userId,
          rejectedAt: new Date().toISOString(),
          rejectionReason: "slot_unavailable",
          rejectionNote: "Auto-rejected: slot assigned to another booking",
          "slotLock.isLocked": false,
          "slotLock.lockType": null,
          "slotLock.lockExpiry": null,
          "slotLock.lockReason": null,
        });
      }
    } catch (error) {
      console.error("Error approving booking:", error);
      Alert.alert("Error", "Failed to approve booking. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  // Open reject dialog
  const openRejectDialog = (booking) => {
    setSelectedBooking(booking);
    setRejectReason("");
    setCustomRejectReason("");
    setRejectDialogVisible(true);
  };

  // Confirm rejection
  const handleReject = async () => {
    if (!rejectReason) {
      Alert.alert("Required", "Please select a rejection reason.");
      return;
    }

    if (rejectReason === "other" && !customRejectReason.trim()) {
      Alert.alert("Required", "Please provide a reason for rejection.");
      return;
    }

    setRejectDialogVisible(false);
    setActionLoading(selectedBooking.id);

    try {
      await updateDocument("bookings", selectedBooking.id, {
        status: "rejected",
        rejectedBy: user?.userId,
        rejectedAt: new Date().toISOString(),
        rejectionReason: rejectReason,
        rejectionNote: rejectReason === "other" ? customRejectReason : REJECTION_REASONS.find((r) => r.value === rejectReason)?.label,
      });
    } catch (error) {
      console.error("Error rejecting booking:", error);
      Alert.alert("Error", "Failed to reject booking. Please try again.");
    } finally {
      setActionLoading(null);
      setSelectedBooking(null);
    }
  };

  // Open cancel dialog for confirmed bookings
  const openCancelDialog = (booking) => {
    setCancelBookingTarget(booking);
    setCancelReason("");
    setCustomCancelReason("");
    setCancelDialogVisible(true);
  };

  // Cancel confirmed booking (with optional Cashfree refund)
  const handleCancelConfirmed = async () => {
    const finalReason = cancelReason === "other"
      ? customCancelReason.trim()
      : CANCEL_REASONS.find((r) => r.value === cancelReason)?.label || cancelReason;

    if (!finalReason) {
      Alert.alert("Required", "Please select or enter a cancellation reason.");
      return;
    }

    setCancelLoading(true);
    try {
      const result = await cancelBooking({
        bookingId: cancelBookingTarget.id,
        reason: finalReason,
        cancelledByRole: user?.role || "manager",
      });

      setCancelDialogVisible(false);

      if (result?.refundInitiated) {
        Alert.alert(
          "Booking Cancelled",
          `Booking cancelled. Advance payment of ₹${result.refundAmount} refund has been initiated. It will reach the customer in 5–7 business days.`
        );
      } else if (result?.refundAmount > 0 && !result?.refundInitiated) {
        Alert.alert(
          "Booking Cancelled",
          "Booking cancelled. The advance payment refund could not be initiated automatically. Please process it manually."
        );
      } else {
        Alert.alert("Booking Cancelled", "The booking has been cancelled and the customer has been notified.");
      }
    } catch (err) {
      Alert.alert("Error", err.message || "Failed to cancel booking. Please try again.");
    } finally {
      setCancelLoading(false);
      setCancelBookingTarget(null);
    }
  };

  // Mark as completed
  const handleComplete = async (booking) => {
    setActionLoading(booking.id);

    try {
      await updateDocument("bookings", booking.id, {
        status: "completed",
        completedAt: new Date().toISOString(),
        completedBy: user?.userId,
      });
    } catch (error) {
      console.error("Error completing booking:", error);
      Alert.alert("Error", "Failed to mark booking as completed.");
    } finally {
      setActionLoading(null);
    }
  };

  // Refresh
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // The subscription will auto-update, just set refreshing
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  // Get ground name
  const getGroundName = (groundId) => {
    const ground = grounds.find((g) => g.id === groundId);
    return ground?.name || "Ground";
  };

  // Tab button component
  const TabButton = ({ value, label, count }) => (
    <TouchableOpacity
      style={[styles.tabButton, activeTab === value && styles.tabButtonActive]}
      onPress={() => setActiveTab(value)}
    >
      <Text
        style={[styles.tabButtonText, activeTab === value && styles.tabButtonTextActive]}
      >
        {label}
      </Text>
      {count > 0 && (
        <View style={[styles.tabBadge, activeTab === value && styles.tabBadgeActive]}>
          <Text style={[styles.tabBadgeText, activeTab === value && styles.tabBadgeTextActive]}>
            {count}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  // Booking card component
  const BookingCard = ({ booking }) => {
    const hasConflict = conflictWarnings[booking.id];
    const isLoading = actionLoading === booking.id;
    const statusColor = STATUS_COLORS[booking.status] || "#9CA3AF";

    // Determine left border color by tab
    const borderColor =
      activeTab === "pending" ? WARN_ORANGE :
      activeTab === "confirmed" ? MANAGER_BLUE :
      activeTab === "completed" ? SUCCESS_GREEN : "#9CA3AF";

    return (
      <View style={[styles.bookingCard, { borderLeftColor: borderColor }]}>
        {/* Conflict warning */}
        {hasConflict && activeTab === "pending" && (
          <View style={styles.conflictBanner}>
            <MaterialCommunityIcons name="alert" size={16} color="#fff" />
            <Text style={styles.conflictText}>
              Conflicts with {hasConflict.length} other pending request(s)
            </Text>
          </View>
        )}

        {/* Card header */}
        <View style={styles.cardHeader}>
          <View style={styles.customerInfo}>
            <Text style={styles.customerName}>
              {booking.userName || booking.customerName || "Customer"}
            </Text>
            <View style={styles.phoneRow}>
              <MaterialCommunityIcons name="phone" size={14} color="#6B7280" />
              <Text style={styles.phoneText}>
                {booking.userPhone || booking.customerPhone || "N/A"}
              </Text>
            </View>
          </View>
          <View style={[styles.statusPill, { backgroundColor: `${statusColor}18` }]}>
            <Text style={[styles.statusPillText, { color: statusColor }]}>
              {booking.status.replace(/_/g, " ").toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Booking details */}
        <View style={styles.detailsGrid}>
          <View style={styles.detailItem}>
            <MaterialCommunityIcons name="calendar" size={15} color={MANAGER_BLUE} />
            <Text style={styles.detailText}>
              {formatDate(booking.date)}
            </Text>
          </View>
          <View style={styles.detailItem}>
            <MaterialCommunityIcons name="clock-outline" size={15} color={MANAGER_BLUE} />
            <Text style={styles.detailText}>
              {formatTime(booking.startTime)} – {formatTime(booking.endTime)}
            </Text>
          </View>
          <View style={styles.detailItem}>
            <MaterialCommunityIcons name="soccer-field" size={15} color={MANAGER_BLUE} />
            <Text style={styles.detailText}>
              {booking.groundName || getGroundName(booking.groundId)}
            </Text>
          </View>
          {booking.sport && (
            <View style={styles.detailItem}>
              <MaterialCommunityIcons name="basketball" size={15} color={MANAGER_BLUE} />
              <Text style={styles.detailText}>
                {booking.sport}
              </Text>
            </View>
          )}
        </View>

        {/* Amount */}
        <View style={styles.amountRow}>
          <Text style={styles.amountLabel}>Total Amount</Text>
          <Text style={styles.amountValue}>
            ₹{booking.totalAmount || booking.totalPrice || booking.payment?.slotAmount || booking.amount || 0}
          </Text>
        </View>
        {booking.payment?.advanceAmount > 0 && (
          <View style={styles.amountRow}>
            <Text style={[styles.amountLabel, { fontSize: 12 }]}>
              Advance ({booking.payment?.advanceConfig?.percentage || 0}%)
            </Text>
            <Text style={{ color: booking.payment?.advance?.status === "verified" ? SUCCESS_GREEN : WARN_ORANGE, fontWeight: "600", fontSize: 13 }}>
              ₹{booking.payment.advanceAmount} {booking.payment?.advance?.status === "verified" ? "✓" : ""}
            </Text>
          </View>
        )}
        {booking.payment?.remainingAmount > 0 && (
          <View style={styles.amountRow}>
            <Text style={[styles.amountLabel, { fontSize: 12 }]}>Remaining</Text>
            <Text style={{ color: WARN_ORANGE, fontWeight: "600", fontSize: 13 }}>
              ₹{booking.payment.remainingAmount}
            </Text>
          </View>
        )}

        {/* Rejection reason for cancelled */}
        {(booking.status === "rejected" || booking.status === "cancelled") && booking.rejectionNote && (
          <View style={styles.rejectionRow}>
            <MaterialCommunityIcons name="information" size={14} color={DANGER_RED} />
            <Text style={styles.rejectionText}>
              {booking.rejectionNote}
            </Text>
          </View>
        )}

        {/* Actions */}

        {activeTab === "pending" && booking.status === "awaiting_payment" && (
          <>
            <Divider style={styles.divider} />
            <View style={[styles.paymentPendingBanner, { backgroundColor: "#FFF7ED" }]}>
              <MaterialCommunityIcons name="alert-circle" size={16} color="#F97316" />
              <Text style={[styles.paymentPendingText, { color: "#F97316" }]}>
                Approved — waiting for user to pay advance
              </Text>
            </View>
          </>
        )}

        {activeTab === "pending" && (booking.status === "pending" || booking.status === "pending_payment") && (
          <>
            <Divider style={styles.divider} />
            {booking.status === "pending_payment" && (
              <View style={[styles.paymentPendingBanner, { backgroundColor: "#F5F3FF" }]}>
                <MaterialCommunityIcons name="clock-outline" size={16} color="#8B5CF6" />
                <Text style={[styles.paymentPendingText, { color: "#8B5CF6" }]}>
                  Waiting for user to pay advance
                </Text>
              </View>
            )}
            <View style={styles.actionRow}>
              {isLoading ? (
                <ActivityIndicator size="small" color={MANAGER_BLUE} />
              ) : (
                <>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.rejectBtn]}
                    onPress={() => openRejectDialog(booking)}
                  >
                    <MaterialCommunityIcons name="close" size={16} color={DANGER_RED} />
                    <Text style={[styles.actionBtnText, { color: DANGER_RED }]}>Reject</Text>
                  </TouchableOpacity>
                  {booking.status === "pending" && (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: SUCCESS_GREEN }]}
                      onPress={() => handleApprove(booking)}
                    >
                      <MaterialCommunityIcons name="check" size={16} color="#fff" />
                      <Text style={styles.actionBtnText}>Approve</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          </>
        )}

        {activeTab === "confirmed" && (
          <>
            <Divider style={styles.divider} />
            <View style={styles.actionRow}>
              {isLoading ? (
                <ActivityIndicator size="small" color={MANAGER_BLUE} />
              ) : (
                <>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.rejectBtn]}
                    onPress={() => openCancelDialog(booking)}
                  >
                    <MaterialCommunityIcons name="close-circle-outline" size={16} color={DANGER_RED} />
                    <Text style={[styles.actionBtnText, { color: DANGER_RED }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: SUCCESS_GREEN }]}
                    onPress={() => handleComplete(booking)}
                  >
                    <MaterialCommunityIcons name="check-all" size={16} color="#fff" />
                    <Text style={styles.actionBtnText}>Mark Completed</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </>
        )}
      </View>
    );
  };

  // Empty state
  const EmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyCard}>
        <View style={styles.emptyIconCircle}>
          <MaterialCommunityIcons
            name={
              activeTab === "pending" ? "clock-outline" :
              activeTab === "confirmed" ? "calendar-check" :
              activeTab === "completed" ? "check-circle" : "close-circle"
            }
            size={40}
            color={MANAGER_BLUE}
          />
        </View>
        <Text style={styles.emptyTitle}>No {activeTab} bookings</Text>
        <Text style={styles.emptyText}>
          {activeTab === "pending"
            ? "New booking requests will appear here"
            : activeTab === "confirmed"
            ? "Approved bookings will appear here"
            : activeTab === "completed"
            ? "Past bookings will appear here"
            : "Cancelled or rejected bookings will appear here"}
        </Text>
      </View>
    </View>
  );

  if (!selectedTurfId) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.emptyContainer}>
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <MaterialCommunityIcons name="soccer-field" size={40} color={MANAGER_BLUE} />
            </View>
            <Text style={styles.emptyTitle}>No Turf Selected</Text>
            <Text style={styles.emptyText}>Please select a turf from the dashboard first.</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Manage Bookings</Text>
          <Text style={styles.subtitle}>{turfData?.name || "All bookings"}</Text>
        </View>
        <TouchableOpacity
          style={[styles.filterBtn, (filterVisible || dateFilter !== "all") && styles.filterBtnActive]}
          onPress={() => setFilterVisible(!filterVisible)}
        >
          <MaterialCommunityIcons
            name="filter-variant"
            size={20}
            color={filterVisible || dateFilter !== "all" ? "#fff" : MANAGER_BLUE}
          />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <Searchbar
        placeholder="Search customer name or phone..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        style={styles.searchBar}
        inputStyle={styles.searchInput}
      />

      {/* Filter panel */}
      {filterVisible && (
        <Surface style={styles.filterPanel} elevation={2}>
          <View style={styles.filterRow}>
            <Text variant="labelMedium" style={styles.filterLabel}>Date:</Text>
            <View style={styles.filterChips}>
              {[
                { value: "all", label: "All" },
                { value: "today", label: "Today" },
                { value: "upcoming", label: "Upcoming" },
                { value: "week", label: "Past Week" },
              ].map((opt) => (
                <Chip
                  key={opt.value}
                  selected={dateFilter === opt.value}
                  onPress={() => setDateFilter(opt.value)}
                  mode="outlined"
                  compact
                  style={styles.filterChip}
                >
                  {opt.label}
                </Chip>
              ))}
            </View>
          </View>

          <Button
            mode="text"
            compact
            onPress={() => {
              setDateFilter("all");
            }}
          >
            Clear Filters
          </Button>
        </Surface>
      )}

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TabButton value="pending" label="Pending" count={tabCounts.current.pending} />
        <TabButton value="confirmed" label="Confirmed" count={tabCounts.current.confirmed} />
        <TabButton value="completed" label="Completed" count={tabCounts.current.completed} />
        <TabButton value="cancelled" label="Cancelled" count={tabCounts.current.cancelled} />
      </View>

      {/* Booking list */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={MANAGER_BLUE} />
        </View>
      ) : filteredBookings.length === 0 ? (
        <EmptyState />
      ) : (
        <FlatList
          data={filteredBookings}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <BookingCard booking={item} />}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[MANAGER_BLUE]}
            />
          }
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      )}

      {/* Reject Dialog */}
      <Portal>
        <Dialog visible={rejectDialogVisible} onDismiss={() => setRejectDialogVisible(false)}>
          <Dialog.Title>Reject Booking</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={styles.dialogSubtitle}>
              Please select a reason for rejection:
            </Text>
            <RadioButton.Group onValueChange={setRejectReason} value={rejectReason}>
              {REJECTION_REASONS.map((reason) => (
                <TouchableOpacity
                  key={reason.value}
                  style={styles.radioRow}
                  onPress={() => setRejectReason(reason.value)}
                >
                  <RadioButton value={reason.value} color={MANAGER_BLUE} />
                  <Text variant="bodyMedium" style={styles.radioLabel}>
                    {reason.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </RadioButton.Group>

            {rejectReason === "other" && (
              <RNTextInput
                style={styles.customReasonInput}
                placeholder="Enter reason..."
                value={customRejectReason}
                onChangeText={setCustomRejectReason}
                multiline
                numberOfLines={3}
              />
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setRejectDialogVisible(false)}>Cancel</Button>
            <Button onPress={handleReject} textColor="#F44336">
              Reject
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Cancel Confirmed Booking Dialog */}
      <Portal>
        <Dialog
          visible={cancelDialogVisible}
          onDismiss={() => !cancelLoading && setCancelDialogVisible(false)}
        >
          <Dialog.Title>Cancel Booking</Dialog.Title>
          <Dialog.Content>
            {cancelBookingTarget?.paymentStatus === "paid" && (
              <View style={styles.refundNotice}>
                <MaterialCommunityIcons name="cash-refund" size={18} color="#6D28D9" />
                <Text style={styles.refundNoticeText}>
                  Advance of ₹{cancelBookingTarget?.payment?.advanceAmount || cancelBookingTarget?.advanceAmount || 0} will be refunded to the customer (5–7 business days).
                </Text>
              </View>
            )}
            <Text variant="bodyMedium" style={styles.dialogSubtitle}>
              Select a reason for cancellation:
            </Text>
            <RadioButton.Group onValueChange={setCancelReason} value={cancelReason}>
              {CANCEL_REASONS.map((reason) => (
                <TouchableOpacity
                  key={reason.value}
                  style={styles.radioRow}
                  onPress={() => setCancelReason(reason.value)}
                >
                  <RadioButton value={reason.value} color={DANGER_RED} />
                  <Text variant="bodyMedium" style={styles.radioLabel}>
                    {reason.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </RadioButton.Group>

            {cancelReason === "other" && (
              <RNTextInput
                style={styles.customReasonInput}
                placeholder="Enter reason..."
                value={customCancelReason}
                onChangeText={setCustomCancelReason}
                multiline
                numberOfLines={3}
              />
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => setCancelDialogVisible(false)}
              disabled={cancelLoading}
            >
              Keep Booking
            </Button>
            <Button
              onPress={handleCancelConfirmed}
              textColor={DANGER_RED}
              loading={cancelLoading}
              disabled={cancelLoading}
            >
              Confirm Cancel
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F0F4F8",
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  title: {
    fontSize: 18,
    fontFamily: "Ubuntu-Bold",
    color: "#111827",
  },
  subtitle: {
    fontSize: 12,
    fontFamily: "Ubuntu-Regular",
    color: "#6B7280",
    marginTop: 1,
  },
  filterBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: PALE_BLUE,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBtnActive: {
    backgroundColor: MANAGER_BLUE,
  },

  // Search
  searchBar: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    elevation: 0,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  searchInput: {
    fontSize: 14,
    fontFamily: "Ubuntu-Regular",
  },

  // Filter panel
  filterPanel: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  filterRow: {
    marginBottom: 10,
  },
  filterLabel: {
    color: "#6B7280",
    fontSize: 12,
    fontFamily: "Ubuntu-Medium",
    marginBottom: 8,
  },
  filterChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  filterChip: {
    marginRight: 4,
    marginBottom: 4,
  },

  // Tabs
  tabsContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 6,
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
  },
  tabButtonActive: {
    backgroundColor: MANAGER_BLUE,
    borderColor: MANAGER_BLUE,
  },
  tabButtonText: {
    fontSize: 11,
    fontFamily: "Ubuntu-Medium",
    color: "#6B7280",
  },
  tabButtonTextActive: {
    color: "#fff",
    fontFamily: "Ubuntu-Bold",
  },
  tabBadge: {
    marginLeft: 3,
    backgroundColor: "#E5E7EB",
    height: 16,
    minWidth: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  tabBadgeActive: {
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  tabBadgeText: {
    fontSize: 9,
    fontFamily: "Ubuntu-Medium",
    color: "#6B7280",
  },
  tabBadgeTextActive: {
    color: "#fff",
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  // List
  listContent: {
    padding: 16,
    paddingTop: 4,
  },

  // Booking card
  bookingCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    marginBottom: 12,
    overflow: "hidden",
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  conflictBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: WARN_ORANGE,
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 6,
  },
  conflictText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Ubuntu-Medium",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 14,
    paddingBottom: 6,
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 15,
    fontFamily: "Ubuntu-Bold",
    color: "#111827",
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
    gap: 4,
  },
  phoneText: {
    fontSize: 12,
    fontFamily: "Ubuntu-Regular",
    color: "#6B7280",
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusPillText: {
    fontSize: 10,
    fontFamily: "Ubuntu-Bold",
    letterSpacing: 0.3,
  },

  // Details grid
  detailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 14,
    paddingTop: 6,
    gap: 10,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  detailText: {
    fontSize: 13,
    fontFamily: "Ubuntu-Regular",
    color: "#374151",
  },

  // Amount
  amountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
  },
  amountLabel: {
    fontSize: 13,
    fontFamily: "Ubuntu-Regular",
    color: "#6B7280",
  },
  amountValue: {
    fontSize: 16,
    fontFamily: "Ubuntu-Bold",
    color: SUCCESS_GREEN,
  },

  // Rejection info
  rejectionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingBottom: 10,
    gap: 6,
  },
  rejectionText: {
    fontSize: 12,
    fontFamily: "Ubuntu-Regular",
    color: DANGER_RED,
    flex: 1,
  },

  // Actions
  divider: {
    marginHorizontal: 14,
    backgroundColor: "#F3F4F6",
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    padding: 10,
    gap: 8,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    gap: 5,
  },
  rejectBtn: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  actionBtnText: {
    fontSize: 13,
    fontFamily: "Ubuntu-Medium",
    color: "#fff",
  },
  paymentPendingBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 8,
  },
  paymentPendingText: {
    fontSize: 12,
    fontFamily: "Ubuntu-Regular",
    flex: 1,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    padding: 16,
  },
  emptyCard: {
    padding: 36,
    borderRadius: 16,
    backgroundColor: "#fff",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: PALE_BLUE,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: "Ubuntu-Bold",
    color: "#111827",
    marginBottom: 6,
    textTransform: "capitalize",
  },
  emptyText: {
    fontSize: 13,
    fontFamily: "Ubuntu-Regular",
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 20,
  },

  // Reject dialog
  dialogSubtitle: {
    marginBottom: 12,
    color: "#6B7280",
  },
  radioRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 4,
  },
  radioLabel: {
    flex: 1,
  },
  customReasonInput: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
    minHeight: 80,
    textAlignVertical: "top",
    fontFamily: "Ubuntu-Regular",
    fontSize: 14,
    color: "#111827",
  },
  refundNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#F5F3FF",
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    gap: 8,
  },
  refundNoticeText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Ubuntu-Regular",
    color: "#5B21B6",
    lineHeight: 19,
  },
});
