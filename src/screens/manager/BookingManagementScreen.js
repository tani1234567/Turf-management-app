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
} from "../../services/firebase/firestore";

const MANAGER_BLUE = "#2196F3";

// Status colors
const STATUS_COLORS = {
  pending: "#FF9800",
  confirmed: "#2196F3",
  completed: "#4CAF50",
  cancelled: "#F44336",
  rejected: "#F44336",
};

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
  const [sportFilter, setSportFilter] = useState("all");
  const [groundFilter, setGroundFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Ground & Sport options
  const [grounds, setGrounds] = useState([]);
  const [sports, setSports] = useState([]);

  // Reject dialog state
  const [rejectDialogVisible, setRejectDialogVisible] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [customRejectReason, setCustomRejectReason] = useState("");

  // Conflict warning state
  const [conflictWarnings, setConflictWarnings] = useState({});

  // Subscription ref
  const unsubscribeRef = useRef(null);

  // Load grounds from turf data (grounds are embedded in turf document)
  useEffect(() => {
    if (!turfData) {
      setGrounds([]);
      setSports([]);
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

      // Extract unique sports from grounds
      const allSports = new Set();
      groundsWithIds.forEach((g) => {
        if (g.sports && Array.isArray(g.sports)) {
          g.sports.forEach((s) => allSports.add(s));
        }
      });
      setSports([...allSports]);
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

        // Calculate counts
        tabCounts.current = {
          pending: docs.filter((d) => d.status === "pending").length,
          confirmed: docs.filter((d) => d.status === "confirmed").length,
          completed: docs.filter((d) => d.status === "completed").length,
          cancelled: docs.filter((d) => d.status === "cancelled" || d.status === "rejected").length,
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
      filtered = filtered.filter((b) => b.status === "cancelled" || b.status === "rejected");
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

    // Filter by sport
    if (sportFilter !== "all") {
      filtered = filtered.filter((b) => b.sport === sportFilter);
    }

    // Filter by ground
    if (groundFilter !== "all") {
      filtered = filtered.filter((b) => b.groundId === groundFilter);
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
  }, [bookings, activeTab, dateFilter, sportFilter, groundFilter, searchQuery]);

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
      // Check for conflicts with confirmed bookings
      const confirmedBookings = await queryDocuments("bookings", [
        { field: "turfId", operator: "==", value: selectedTurfId },
      ]);

      const conflictingConfirmed = confirmedBookings.filter(
        (b) =>
          b.id !== booking.id &&
          b.status === "confirmed" &&
          b.date === booking.date &&
          // Use normalized comparison for legacy data compatibility
          normalizeGroundId(b.groundId) === normalizedBookingGroundId &&
          hasTimeOverlap(booking.startTime, booking.endTime, b.startTime, b.endTime)
      );

      if (conflictingConfirmed.length > 0) {
        Alert.alert(
          "Slot Conflict",
          "This time slot conflicts with an existing confirmed booking. Please reject this booking or adjust the schedule.",
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
            // Use normalized comparison for legacy data compatibility
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

      // Approve the booking
      await updateDocument("bookings", booking.id, {
        status: "confirmed",
        approvedBy: user?.userId,
        approvedAt: new Date().toISOString(),
      });

      // Auto-reject other conflicting pending bookings
      if (conflictWarnings[booking.id]) {
        for (const conflictId of conflictWarnings[booking.id]) {
          await updateDocument("bookings", conflictId, {
            status: "rejected",
            rejectedBy: user?.userId,
            rejectedAt: new Date().toISOString(),
            rejectionReason: "slot_unavailable",
            rejectionNote: "Auto-rejected due to conflicting booking approval",
          });
        }
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
        <Badge
          size={18}
          style={[
            styles.tabBadge,
            activeTab === value && styles.tabBadgeActive,
          ]}
        >
          {count}
        </Badge>
      )}
    </TouchableOpacity>
  );

  // Booking card component
  const BookingCard = ({ booking }) => {
    const hasConflict = conflictWarnings[booking.id];
    const isLoading = actionLoading === booking.id;

    return (
      <Surface style={styles.bookingCard} elevation={1}>
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
            <Text variant="titleMedium" style={styles.customerName}>
              {booking.userName || booking.customerName || "Customer"}
            </Text>
            <View style={styles.phoneRow}>
              <MaterialCommunityIcons name="phone" size={14} color="#666" />
              <Text variant="bodySmall" style={styles.phoneText}>
                {booking.userPhone || booking.customerPhone || "N/A"}
              </Text>
            </View>
          </View>
          <Chip
            mode="flat"
            textStyle={{ fontSize: 11, color: STATUS_COLORS[booking.status] }}
            style={[styles.statusChip, { backgroundColor: `${STATUS_COLORS[booking.status]}15` }]}
          >
            {booking.status.toUpperCase()}
          </Chip>
        </View>

        {/* Booking details */}
        <View style={styles.detailsGrid}>
          <View style={styles.detailItem}>
            <MaterialCommunityIcons name="calendar" size={16} color="#666" />
            <Text variant="bodySmall" style={styles.detailText}>
              {formatDate(booking.date)}
            </Text>
          </View>
          <View style={styles.detailItem}>
            <MaterialCommunityIcons name="clock-outline" size={16} color="#666" />
            <Text variant="bodySmall" style={styles.detailText}>
              {formatTime(booking.startTime)} - {formatTime(booking.endTime)}
            </Text>
          </View>
          <View style={styles.detailItem}>
            <MaterialCommunityIcons name="soccer-field" size={16} color="#666" />
            <Text variant="bodySmall" style={styles.detailText}>
              {booking.groundName || getGroundName(booking.groundId)}
            </Text>
          </View>
          {booking.sport && (
            <View style={styles.detailItem}>
              <MaterialCommunityIcons name="basketball" size={16} color="#666" />
              <Text variant="bodySmall" style={styles.detailText}>
                {booking.sport}
              </Text>
            </View>
          )}
        </View>

        {/* Amount */}
        <View style={styles.amountRow}>
          <Text variant="bodyMedium" style={styles.amountLabel}>Amount</Text>
          <Text variant="titleMedium" style={styles.amountValue}>
            ₹{booking.totalPrice || booking.totalAmount || booking.amount || 0}
          </Text>
        </View>

        {/* Rejection reason for cancelled */}
        {(booking.status === "rejected" || booking.status === "cancelled") && booking.rejectionNote && (
          <View style={styles.rejectionRow}>
            <MaterialCommunityIcons name="information" size={14} color="#F44336" />
            <Text variant="bodySmall" style={styles.rejectionText}>
              {booking.rejectionNote}
            </Text>
          </View>
        )}

        {/* Actions */}
        {activeTab === "pending" && (
          <>
            <Divider style={styles.divider} />
            <View style={styles.actionRow}>
              {isLoading ? (
                <ActivityIndicator size="small" color={MANAGER_BLUE} />
              ) : (
                <>
                  <Button
                    mode="outlined"
                    compact
                    textColor="#F44336"
                    style={styles.rejectBtn}
                    onPress={() => openRejectDialog(booking)}
                  >
                    Reject
                  </Button>
                  <Button
                    mode="contained"
                    compact
                    buttonColor="#4CAF50"
                    style={styles.approveBtn}
                    onPress={() => handleApprove(booking)}
                  >
                    Approve
                  </Button>
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
                <Button
                  mode="contained"
                  compact
                  buttonColor="#4CAF50"
                  icon="check-all"
                  onPress={() => handleComplete(booking)}
                >
                  Mark Completed
                </Button>
              )}
            </View>
          </>
        )}
      </Surface>
    );
  };

  // Empty state
  const EmptyState = () => (
    <View style={styles.emptyContainer}>
      <Surface style={styles.emptyCard} elevation={1}>
        <MaterialCommunityIcons
          name={
            activeTab === "pending"
              ? "clock-outline"
              : activeTab === "confirmed"
              ? "calendar-check"
              : activeTab === "completed"
              ? "check-circle"
              : "close-circle"
          }
          size={64}
          color="#ccc"
        />
        <Text variant="titleMedium" style={styles.emptyTitle}>
          No {activeTab} bookings
        </Text>
        <Text variant="bodyMedium" style={styles.emptyText}>
          {activeTab === "pending"
            ? "New booking requests will appear here"
            : activeTab === "confirmed"
            ? "Approved bookings will appear here"
            : activeTab === "completed"
            ? "Past bookings will appear here"
            : "Cancelled or rejected bookings will appear here"}
        </Text>
      </Surface>
    </View>
  );

  if (!selectedTurfId) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Surface style={styles.emptyCard} elevation={1}>
            <MaterialCommunityIcons name="soccer-field" size={64} color="#ccc" />
            <Text variant="titleMedium" style={styles.emptyTitle}>
              No Turf Selected
            </Text>
            <Text variant="bodyMedium" style={styles.emptyText}>
              Please select a turf from the dashboard first.
            </Text>
          </Surface>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text variant="headlineSmall" style={styles.title}>
          Manage Bookings
        </Text>
        <IconButton
          icon="filter-variant"
          size={24}
          iconColor={filterVisible || dateFilter !== "all" || sportFilter !== "all" || groundFilter !== "all" ? MANAGER_BLUE : "#666"}
          onPress={() => setFilterVisible(!filterVisible)}
        />
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

          {sports.length > 0 && (
            <View style={styles.filterRow}>
              <Text variant="labelMedium" style={styles.filterLabel}>Sport:</Text>
              <View style={styles.filterChips}>
                <Chip
                  selected={sportFilter === "all"}
                  onPress={() => setSportFilter("all")}
                  mode="outlined"
                  compact
                  style={styles.filterChip}
                >
                  All
                </Chip>
                {sports.map((sport) => (
                  <Chip
                    key={sport}
                    selected={sportFilter === sport}
                    onPress={() => setSportFilter(sport)}
                    mode="outlined"
                    compact
                    style={styles.filterChip}
                  >
                    {sport}
                  </Chip>
                ))}
              </View>
            </View>
          )}

          {grounds.length > 1 && (
            <View style={styles.filterRow}>
              <Text variant="labelMedium" style={styles.filterLabel}>Ground:</Text>
              <View style={styles.filterChips}>
                <Chip
                  selected={groundFilter === "all"}
                  onPress={() => setGroundFilter("all")}
                  mode="outlined"
                  compact
                  style={styles.filterChip}
                >
                  All
                </Chip>
                {grounds.map((ground) => (
                  <Chip
                    key={ground.id}
                    selected={groundFilter === ground.id}
                    onPress={() => setGroundFilter(ground.id)}
                    mode="outlined"
                    compact
                    style={styles.filterChip}
                  >
                    {ground.name}
                  </Chip>
                ))}
              </View>
            </View>
          )}

          <Button
            mode="text"
            compact
            onPress={() => {
              setDateFilter("all");
              setSportFilter("all");
              setGroundFilter("all");
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  title: {
    fontWeight: "bold",
    color: "#333",
  },

  // Search
  searchBar: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 10,
    elevation: 1,
  },
  searchInput: {
    fontSize: 14,
  },

  // Filter panel
  filterPanel: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#fff",
  },
  filterRow: {
    marginBottom: 10,
  },
  filterLabel: {
    color: "#666",
    marginBottom: 6,
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
    gap: 8,
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  tabButtonActive: {
    backgroundColor: MANAGER_BLUE,
    borderColor: MANAGER_BLUE,
  },
  tabButtonText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#666",
  },
  tabButtonTextActive: {
    color: "#fff",
  },
  tabBadge: {
    marginLeft: 4,
    backgroundColor: "#E0E0E0",
  },
  tabBadgeActive: {
    backgroundColor: "#fff",
    color: MANAGER_BLUE,
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
    borderRadius: 12,
    marginBottom: 12,
    overflow: "hidden",
  },
  conflictBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FF9800",
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  conflictText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "500",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 14,
    paddingBottom: 0,
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontWeight: "bold",
    color: "#333",
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    gap: 4,
  },
  phoneText: {
    color: "#666",
  },
  statusChip: {
    height: 24,
  },

  // Details grid
  detailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 14,
    paddingTop: 10,
    gap: 12,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  detailText: {
    color: "#555",
  },

  // Amount
  amountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
  },
  amountLabel: {
    color: "#666",
  },
  amountValue: {
    color: "#4CAF50",
    fontWeight: "bold",
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
    color: "#F44336",
    flex: 1,
  },

  // Actions
  divider: {
    marginHorizontal: 14,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    padding: 10,
    gap: 10,
  },
  rejectBtn: {
    borderColor: "#F44336",
    borderRadius: 8,
  },
  approveBtn: {
    borderRadius: 8,
  },

  // Empty state
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

  // Reject dialog
  dialogSubtitle: {
    marginBottom: 12,
    color: "#666",
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
    borderColor: "#E0E0E0",
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    minHeight: 80,
    textAlignVertical: "top",
  },
});
