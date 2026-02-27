import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from "react-native";
import {
  Text,
  Surface,
  Button,
  Menu,
  Divider,
  ActivityIndicator,
  Badge,
  IconButton,
  Chip,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth, useAppSelector, useAppDispatch, useNotifications } from "../../hooks";
import { usePermissions } from "../../hooks";
import {
  queryDocuments,
  getDocument,
  updateDocument,
  subscribeToCollection,
} from "../../services/firebase/firestore";
import { selectUser, selectAssignedTurfIds } from "../../store/slices/authSlice";
import { updateUserProfile } from "../../store/slices/authSlice";
import { COLORS } from "../../constants/theme";

const MANAGER_BLUE = "#2196F3";

// Helper: get today's date string (YYYY-MM-DD)
const getTodayString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Helper: get start of current week (Monday)
const getWeekStartString = () => {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
};

// Helper: format currency
const formatCurrency = (amount) => {
  if (amount >= 1000) {
    return `₹${(amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1)}K`;
  }
  return `₹${amount}`;
};

// Helper: get current time as HH:MM string
const getCurrentTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

// Helper: format time for display
const formatTime = (timeStr) => {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${m} ${ampm}`;
};

// Helper: format activity timestamp
const formatActivityTime = (timestamp) => {
  if (!timestamp) return "";
  let date;
  if (timestamp.toDate) {
    date = timestamp.toDate();
  } else if (timestamp.seconds) {
    date = new Date(timestamp.seconds * 1000);
  } else {
    date = new Date(timestamp);
  }
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

// Activity icon mapping
const getActivityIcon = (type) => {
  switch (type) {
    case "booking_created":
      return { icon: "calendar-plus", color: "#4CAF50" };
    case "booking_approved":
      return { icon: "check-circle", color: "#4CAF50" };
    case "booking_rejected":
      return { icon: "close-circle", color: "#F44336" };
    case "booking_cancelled":
      return { icon: "cancel", color: "#FF9800" };
    case "booking_completed":
      return { icon: "check-all", color: "#2196F3" };
    case "caretaker_assigned":
      return { icon: "account-check", color: "#9C27B0" };
    case "slot_blocked":
      return { icon: "block-helper", color: "#757575" };
    default:
      return { icon: "bell", color: "#757575" };
  }
};

export default function ManagerDashboardScreen({ navigation }) {
  const { user, logout } = useAuth();
  const dispatch = useAppDispatch();
  const permissions = usePermissions();
  const { unreadCount } = useNotifications();
  const reduxUser = useAppSelector(selectUser);
  const assignedTurfIds = useAppSelector(selectAssignedTurfIds);

  // State
  const [turfs, setTurfs] = useState([]);
  const [selectedTurfId, setSelectedTurfId] = useState(null);
  const [turfMenuVisible, setTurfMenuVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // KPI data
  const [pendingCount, setPendingCount] = useState(0);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [weekBookings, setWeekBookings] = useState(0);
  const [utilization, setUtilization] = useState(0);

  // Today's overview
  const [currentBooking, setCurrentBooking] = useState(null);
  const [nextBooking, setNextBooking] = useState(null);

  // Pending bookings preview
  const [pendingBookings, setPendingBookings] = useState([]);

  // Recent activity
  const [activities, setActivities] = useState([]);

  // Turf requests
  const [pendingTurfRequests, setPendingTurfRequests] = useState(0);

  // Refs for cleanup
  const unsubscribeRef = useRef(null);

  // Load assigned turfs
  useEffect(() => {
    const loadTurfs = async () => {
      if (!assignedTurfIds || assignedTurfIds.length === 0) {
        setLoading(false);
        return;
      }

      try {
        const turfPromises = assignedTurfIds.map((id) =>
          getDocument("turfs", id)
        );
        const turfDocs = await Promise.all(turfPromises);
        const validTurfs = turfDocs.filter(Boolean);
        setTurfs(validTurfs);

        // Set selected turf: use persisted or default to first
        const persisted = reduxUser?.selectedTurfId;
        if (persisted && assignedTurfIds.includes(persisted)) {
          setSelectedTurfId(persisted);
        } else if (validTurfs.length > 0) {
          setSelectedTurfId(validTurfs[0].id);
        }
      } catch (error) {
        console.error("Error loading turfs:", error);
      }
    };

    loadTurfs();
  }, [assignedTurfIds, reduxUser?.selectedTurfId]);

  // Fetch pending turf requests count
  useEffect(() => {
    const fetchTurfRequests = async () => {
      if (!reduxUser?.userId) return;
      try {
        const docs = await queryDocuments("turf_requests", [
          { field: "requestedBy", operator: "==", value: reduxUser.userId },
          { field: "status", operator: "==", value: "pending" },
        ]);
        setPendingTurfRequests(docs.length);
      } catch (error) {
        console.error("Error fetching turf requests:", error);
      }
    };
    fetchTurfRequests();
  }, [reduxUser?.userId]);

  // Fetch dashboard data when selected turf changes
  useEffect(() => {
    if (!selectedTurfId) {
      setLoading(false);
      return;
    }
    fetchDashboardData();
    setupRealtimeListeners();

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [selectedTurfId]);

  const setupRealtimeListeners = () => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    // Subscribe to pending bookings for real-time updates
    const unsubscribe = subscribeToCollection(
      "bookings",
      (docs) => {
        const pending = docs.filter((d) => d.status === "pending");
        setPendingCount(pending.length);
        setPendingBookings(pending.slice(0, 3));
      },
      [
        { field: "turfId", operator: "==", value: selectedTurfId },
        { field: "status", operator: "==", value: "pending" },
      ]
    );

    unsubscribeRef.current = unsubscribe;
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const today = getTodayString();
      const weekStart = getWeekStartString();
      const currentTime = getCurrentTime();

      // Fetch turf bookings and activities in parallel
      // Using single-field equality queries to avoid composite index requirements
      const [turfBookings, turfActivities] = await Promise.all([
        queryDocuments("bookings", [
          { field: "turfId", operator: "==", value: selectedTurfId },
        ]),
        queryDocuments("activities", [
          { field: "turfId", operator: "==", value: selectedTurfId },
        ]),
      ]);

      // Filter today's bookings client-side
      const todayBookings = turfBookings.filter((b) => b.date === today);

      // Filter this week's bookings client-side
      const weekBookingsDocs = turfBookings.filter(
        (b) => b.date >= weekStart && b.date <= today
      );

      // Sort activities by createdAt descending, take first 5
      const allActivities = turfActivities
        .sort((a, b) => {
          const aTime = a.createdAt?.seconds || 0;
          const bTime = b.createdAt?.seconds || 0;
          return bTime - aTime;
        })
        .slice(0, 5);

      // Calculate today's revenue
      const revenue = todayBookings
        .filter((b) => b.status === "confirmed" || b.status === "completed")
        .reduce((sum, b) => sum + (b.totalAmount || b.totalPrice || b.payment?.slotAmount || b.amount || 0), 0);
      setTodayRevenue(revenue);

      // Week's booking count (confirmed + completed)
      const weekConfirmed = weekBookingsDocs.filter(
        (b) => b.status === "confirmed" || b.status === "completed"
      );
      setWeekBookings(weekConfirmed.length);

      // Utilization: booked hours vs available hours for today
      const confirmedToday = todayBookings.filter(
        (b) => b.status === "confirmed" || b.status === "completed"
      );
      const bookedHours = confirmedToday.reduce((sum, b) => {
        const duration = b.duration || 1;
        return sum + duration;
      }, 0);
      // Assume 16 available hours (6 AM to 10 PM)
      const availableHours = 16;
      const util =
        availableHours > 0
          ? Math.min(100, Math.round((bookedHours / availableHours) * 100))
          : 0;
      setUtilization(util);

      // Today's overview: current and next booking
      const confirmedSorted = confirmedToday.sort((a, b) =>
        (a.startTime || "").localeCompare(b.startTime || "")
      );
      const current = confirmedSorted.find(
        (b) =>
          (b.startTime || "") <= currentTime &&
          (b.endTime || "") > currentTime
      );
      const next = confirmedSorted.find(
        (b) => (b.startTime || "") > currentTime
      );
      setCurrentBooking(current || null);
      setNextBooking(next || null);

      // Activities
      setActivities(allActivities);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  }, [selectedTurfId]);

  // Turf selection
  const handleTurfSelect = async (turfId) => {
    setTurfMenuVisible(false);
    setSelectedTurfId(turfId);

    // Persist selection
    try {
      if (reduxUser?.userId) {
        await updateDocument("users", reduxUser.userId, {
          selectedTurfId: turfId,
        });
        dispatch(updateUserProfile({ selectedTurfId: turfId }));
      }
    } catch (error) {
      console.error("Error persisting turf selection:", error);
    }
  };

  // Quick approve booking
  const handleApproveBooking = async (booking) => {
    try {
      await updateDocument("bookings", booking.id, {
        status: "confirmed",
        approvedBy: reduxUser?.userId,
        approvedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error approving booking:", error);
      Alert.alert("Error", "Failed to approve booking. Please try again.");
    }
  };

  // Quick reject booking
  const handleRejectBooking = (booking) => {
    Alert.alert(
      "Reject Booking",
      `Reject booking for ${booking.userName || booking.customerName || "customer"}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject",
          style: "destructive",
          onPress: async () => {
            try {
              await updateDocument("bookings", booking.id, {
                status: "rejected",
                rejectedBy: reduxUser?.userId,
                rejectedAt: new Date().toISOString(),
              });
            } catch (error) {
              console.error("Error rejecting booking:", error);
              Alert.alert("Error", "Failed to reject booking.");
            }
          },
        },
      ]
    );
  };

  const selectedTurf = turfs.find((t) => t.id === selectedTurfId);
  const hasMultipleTurfs = turfs.length > 1;

  // KPI config
  const kpiCards = [
    {
      id: "pending",
      label: "Pending Requests",
      value: String(pendingCount),
      icon: "clock-alert-outline",
      color: "#FF9800",
    },
    {
      id: "revenue",
      label: "Today's Revenue",
      value: formatCurrency(todayRevenue),
      icon: "currency-inr",
      color: "#2196F3",
    },
    {
      id: "weekBookings",
      label: "Week's Bookings",
      value: String(weekBookings),
      icon: "calendar-check",
      color: "#4CAF50",
    },
    {
      id: "utilization",
      label: "Utilization",
      value: `${utilization}%`,
      icon: "chart-arc",
      color: "#9C27B0",
    },
  ];

  // Quick actions config
  const quickActions = [
    {
      id: "approve",
      label: "Approve",
      icon: "check-decagram",
      color: "#4CAF50",
      badge: pendingCount > 0 ? pendingCount : null,
      onPress: () => navigation.navigate("ManagerBookings"),
    },
    {
      id: "calendar",
      label: "Calendar",
      icon: "calendar-month",
      color: "#2196F3",
      onPress: () => navigation.navigate("Calendar"),
    },
    {
      id: "academy",
      label: "Academy",
      icon: "school",
      color: "#FF9800",
      onPress: () => navigation.navigate("AcademyManagement"),
    },
    {
      id: "block",
      label: "Block Slots",
      icon: "block-helper",
      color: "#F44336",
      onPress: () => {
        Alert.alert("Coming Soon", "Slot blocking will be available soon.");
      },
    },
    {
      id: "analytics",
      label: "Analytics",
      icon: "chart-bar",
      color: "#795548",
      onPress: () => navigation.navigate("AnalyticsDashboard"),
    },
    {
      id: "expenses",
      label: "Expenses",
      icon: "cash-register",
      color: "#9C27B0",
      onPress: () => navigation.navigate("ExpenseTracking"),
    },
    {
      id: "reviews",
      label: "Reviews",
      icon: "star-outline",
      color: "#FFC107",
      onPress: () => navigation.navigate("ReviewManagement"),
    },
    {
      id: "caretaker",
      label: "Caretakers",
      icon: "account-group",
      color: "#607D8B",
      onPress: () => navigation.navigate("CaretakerAssignment"),
    },
    {
      id: "turfRequest",
      label: "Request Turf",
      icon: "soccer-field",
      color: "#00BCD4",
      badge: pendingTurfRequests > 0 ? pendingTurfRequests : null,
      onPress: () => navigation.navigate("TurfRequestsList"),
    },
  ];

  // --- RENDER ---

  if (loading && turfs.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={MANAGER_BLUE} />
          <Text variant="bodyMedium" style={styles.loadingText}>
            Loading dashboard...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[MANAGER_BLUE]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text variant="bodyMedium" style={styles.greeting}>
              Manager Dashboard
            </Text>
            <Text variant="headlineSmall" style={styles.userName}>
              {user?.name || "Manager"}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TouchableOpacity
              onPress={() => navigation.navigate("Notifications")}
              style={{ position: "relative" }}
            >
              <MaterialCommunityIcons name="bell-outline" size={26} color="#666" />
              {unreadCount > 0 && (
                <Badge
                  size={18}
                  style={{
                    position: "absolute",
                    top: -4,
                    right: -6,
                    backgroundColor: "#F44336",
                  }}
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </Badge>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={logout}>
              <Surface style={styles.avatarContainer} elevation={2}>
                <MaterialCommunityIcons
                  name="account-tie"
                  size={28}
                  color={MANAGER_BLUE}
                />
              </Surface>
            </TouchableOpacity>
          </View>
        </View>

        {/* Turf Selector */}
        {turfs.length > 0 && (
          <View style={styles.turfSelectorContainer}>
            {hasMultipleTurfs ? (
              <View style={styles.turfSelectorRow}>
                <View style={styles.turfSelectorMenuWrapper}>
                  <Menu
                    visible={turfMenuVisible}
                    onDismiss={() => setTurfMenuVisible(false)}
                    anchor={
                      <TouchableOpacity
                        style={styles.turfSelectorButton}
                        onPress={() => setTurfMenuVisible(true)}
                        activeOpacity={0.7}
                      >
                        <MaterialCommunityIcons
                          name="soccer-field"
                          size={20}
                          color={MANAGER_BLUE}
                        />
                        <Text
                          variant="titleSmall"
                          style={styles.turfSelectorText}
                          numberOfLines={1}
                        >
                          {selectedTurf?.name || "Select Turf"}
                        </Text>
                        <MaterialCommunityIcons
                          name="chevron-down"
                          size={20}
                          color="#666"
                        />
                      </TouchableOpacity>
                    }
                    contentStyle={styles.menuContent}
                    style={styles.menuStyle}
                  >
                    {turfs.map((turf) => (
                      <Menu.Item
                        key={turf.id}
                        onPress={() => handleTurfSelect(turf.id)}
                        title={turf.name}
                        leadingIcon={
                          turf.id === selectedTurfId
                            ? "check-circle"
                            : "circle-outline"
                        }
                        titleStyle={
                          turf.id === selectedTurfId
                            ? styles.selectedMenuItem
                            : undefined
                        }
                      />
                    ))}
                  </Menu>
                </View>
                <IconButton
                  icon="arrow-expand"
                  size={20}
                  iconColor={MANAGER_BLUE}
                  style={styles.expandButton}
                  onPress={() => navigation.navigate("TurfSelection")}
                />
              </View>
            ) : (
              <TouchableOpacity
                style={styles.turfSelectorButton}
                activeOpacity={1}
              >
                <MaterialCommunityIcons
                  name="soccer-field"
                  size={20}
                  color={MANAGER_BLUE}
                />
                <Text
                  variant="titleSmall"
                  style={styles.turfSelectorText}
                  numberOfLines={1}
                >
                  {selectedTurf?.name || "No Turf Assigned"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* No Turfs State */}
        {turfs.length === 0 && (
          <Surface style={styles.emptyCard} elevation={1}>
            <MaterialCommunityIcons
              name="soccer-field"
              size={64}
              color="#ccc"
            />
            <Text variant="titleMedium" style={styles.emptyTitle}>
              No Turfs Assigned
            </Text>
            <Text variant="bodyMedium" style={styles.emptySubtext}>
              Ask your owner to assign turfs to your account.
            </Text>
          </Surface>
        )}

        {selectedTurfId && (
          <>
            {/* Today's Overview */}
            <Surface style={styles.overviewCard} elevation={1}>
              <View style={styles.overviewHeader}>
                <MaterialCommunityIcons
                  name="calendar-today"
                  size={20}
                  color={MANAGER_BLUE}
                />
                <Text variant="titleSmall" style={styles.overviewTitle}>
                  Today's Overview
                </Text>
              </View>
              {currentBooking ? (
                <View style={styles.overviewBooking}>
                  <View style={styles.overviewBadge}>
                    <Text style={styles.overviewBadgeText}>NOW</Text>
                  </View>
                  <View style={styles.overviewDetails}>
                    <Text variant="bodyMedium" style={styles.overviewName}>
                      {currentBooking.userName || currentBooking.customerName || "Customer"}
                    </Text>
                    <Text variant="bodySmall" style={styles.overviewTime}>
                      {formatTime(currentBooking.startTime)} -{" "}
                      {formatTime(currentBooking.endTime)}
                      {currentBooking.sport
                        ? ` · ${currentBooking.sport}`
                        : ""}
                    </Text>
                  </View>
                </View>
              ) : nextBooking ? (
                <View style={styles.overviewBooking}>
                  <View
                    style={[
                      styles.overviewBadge,
                      { backgroundColor: "#E3F2FD" },
                    ]}
                  >
                    <Text
                      style={[styles.overviewBadgeText, { color: "#2196F3" }]}
                    >
                      NEXT
                    </Text>
                  </View>
                  <View style={styles.overviewDetails}>
                    <Text variant="bodyMedium" style={styles.overviewName}>
                      {nextBooking.userName || nextBooking.customerName || "Customer"}
                    </Text>
                    <Text variant="bodySmall" style={styles.overviewTime}>
                      {formatTime(nextBooking.startTime)} -{" "}
                      {formatTime(nextBooking.endTime)}
                      {nextBooking.sport ? ` · ${nextBooking.sport}` : ""}
                    </Text>
                  </View>
                </View>
              ) : (
                <Text variant="bodyMedium" style={styles.overviewEmpty}>
                  No more bookings for today
                </Text>
              )}
            </Surface>

            {/* KPI Cards */}
            <View style={styles.kpiGrid}>
              {kpiCards.map((kpi) => (
                <Surface key={kpi.id} style={styles.kpiCard} elevation={1}>
                  <View
                    style={[
                      styles.kpiIconContainer,
                      { backgroundColor: `${kpi.color}15` },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={kpi.icon}
                      size={22}
                      color={kpi.color}
                    />
                  </View>
                  <Text
                    variant="headlineSmall"
                    style={[styles.kpiValue, { color: kpi.color }]}
                  >
                    {kpi.value}
                  </Text>
                  <Text variant="labelSmall" style={styles.kpiLabel}>
                    {kpi.label}
                  </Text>
                </Surface>
              ))}
            </View>

            {/* Quick Actions */}
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Quick Actions
            </Text>
            <View style={styles.actionsGrid}>
              {quickActions.map((action) => (
                <TouchableOpacity
                  key={action.id}
                  style={styles.actionItem}
                  onPress={action.onPress}
                  activeOpacity={0.7}
                >
                  <Surface style={styles.actionIconContainer} elevation={1}>
                    <View
                      style={[
                        styles.actionIconCircle,
                        { backgroundColor: `${action.color}15` },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={action.icon}
                        size={24}
                        color={action.color}
                      />
                    </View>
                    {action.badge && (
                      <Badge style={styles.actionBadge}>{action.badge}</Badge>
                    )}
                  </Surface>
                  <Text variant="labelSmall" style={styles.actionLabel}>
                    {action.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Pending Bookings Preview */}
            <View style={styles.sectionHeader}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Pending Bookings
              </Text>
              {pendingCount > 3 && (
                <Button
                  mode="text"
                  compact
                  onPress={() => navigation.navigate("ManagerBookings")}
                  textColor={MANAGER_BLUE}
                >
                  View All ({pendingCount})
                </Button>
              )}
            </View>

            {pendingBookings.length > 0 ? (
              pendingBookings.map((booking) => (
                <Surface
                  key={booking.id}
                  style={styles.pendingCard}
                  elevation={1}
                >
                  <View style={styles.pendingTop}>
                    <View style={styles.pendingInfo}>
                      <Text variant="titleSmall" style={styles.pendingName}>
                        {booking.userName || booking.customerName || "Customer"}
                      </Text>
                      <Text variant="bodySmall" style={styles.pendingDetails}>
                        {booking.date} · {formatTime(booking.startTime)} -{" "}
                        {formatTime(booking.endTime)}
                      </Text>
                      <View style={styles.pendingChips}>
                        {booking.sport && (
                          <Chip
                            mode="flat"
                            compact
                            textStyle={styles.chipText}
                            style={styles.chip}
                          >
                            {booking.sport}
                          </Chip>
                        )}
                        {booking.groundName && (
                          <Chip
                            mode="flat"
                            compact
                            textStyle={styles.chipText}
                            style={styles.chip}
                          >
                            {booking.groundName}
                          </Chip>
                        )}
                        {(booking.totalAmount || booking.totalPrice || booking.payment?.slotAmount || booking.amount) ? (
                          <Text variant="labelMedium" style={styles.pendingAmount}>
                            ₹{booking.totalAmount || booking.totalPrice || booking.payment?.slotAmount || booking.amount}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  </View>
                  <Divider style={styles.pendingDivider} />
                  <View style={styles.pendingActions}>
                    <Button
                      mode="outlined"
                      compact
                      textColor="#F44336"
                      style={styles.rejectButton}
                      onPress={() => handleRejectBooking(booking)}
                    >
                      Reject
                    </Button>
                    <Button
                      mode="contained"
                      compact
                      buttonColor="#4CAF50"
                      style={styles.approveButton}
                      onPress={() => handleApproveBooking(booking)}
                    >
                      Approve
                    </Button>
                  </View>
                </Surface>
              ))
            ) : (
              <Surface style={styles.emptySmallCard} elevation={1}>
                <MaterialCommunityIcons
                  name="check-circle-outline"
                  size={36}
                  color="#ccc"
                />
                <Text variant="bodyMedium" style={styles.emptySmallText}>
                  No pending bookings
                </Text>
              </Surface>
            )}

            {/* Recent Activity Feed */}
            <Text variant="titleMedium" style={[styles.sectionTitle, { marginTop: 24 }]}>
              Recent Activity
            </Text>
            {activities.length > 0 ? (
              <Surface style={styles.activityCard} elevation={1}>
                {activities.map((activity, index) => {
                  const { icon, color } = getActivityIcon(activity.type);
                  return (
                    <React.Fragment key={activity.id || index}>
                      <View style={styles.activityItem}>
                        <View
                          style={[
                            styles.activityIcon,
                            { backgroundColor: `${color}15` },
                          ]}
                        >
                          <MaterialCommunityIcons
                            name={icon}
                            size={18}
                            color={color}
                          />
                        </View>
                        <View style={styles.activityContent}>
                          <Text
                            variant="bodySmall"
                            style={styles.activityText}
                            numberOfLines={2}
                          >
                            {activity.message || activity.description || "Activity"}
                          </Text>
                          <Text
                            variant="labelSmall"
                            style={styles.activityTime}
                          >
                            {formatActivityTime(activity.createdAt)}
                          </Text>
                        </View>
                      </View>
                      {index < activities.length - 1 && (
                        <Divider style={styles.activityDivider} />
                      )}
                    </React.Fragment>
                  );
                })}
              </Surface>
            ) : (
              <Surface style={styles.emptySmallCard} elevation={1}>
                <MaterialCommunityIcons
                  name="history"
                  size={36}
                  color="#ccc"
                />
                <Text variant="bodyMedium" style={styles.emptySmallText}>
                  No recent activity
                </Text>
              </Surface>
            )}

            {/* Bottom spacing */}
            <View style={{ height: 24 }} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  scrollContent: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    color: "#666",
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    color: "#666",
  },
  userName: {
    fontWeight: "bold",
    color: "#333",
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#E3F2FD",
    justifyContent: "center",
    alignItems: "center",
  },

  // Turf Selector
  turfSelectorContainer: {
    marginBottom: 16,
  },
  turfSelectorRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  turfSelectorMenuWrapper: {
    flex: 1,
  },
  turfSelectorButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  menuStyle: {
    marginTop: 50,
  },
  expandButton: {
    marginLeft: 8,
    backgroundColor: "#E3F2FD",
  },
  turfSelectorText: {
    flex: 1,
    marginLeft: 10,
    color: "#333",
    fontWeight: "600",
  },
  menuContent: {
    backgroundColor: "#fff",
  },
  selectedMenuItem: {
    color: MANAGER_BLUE,
    fontWeight: "bold",
  },

  // Empty state
  emptyCard: {
    padding: 32,
    borderRadius: 16,
    backgroundColor: "#fff",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    marginTop: 16,
    fontWeight: "600",
    color: "#333",
  },
  emptySubtext: {
    marginTop: 8,
    color: "#999",
    textAlign: "center",
  },

  // Today's Overview
  overviewCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  overviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  overviewTitle: {
    marginLeft: 8,
    fontWeight: "600",
    color: "#333",
  },
  overviewBooking: {
    flexDirection: "row",
    alignItems: "center",
  },
  overviewBadge: {
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 12,
  },
  overviewBadgeText: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#4CAF50",
  },
  overviewDetails: {
    flex: 1,
  },
  overviewName: {
    fontWeight: "600",
    color: "#333",
  },
  overviewTime: {
    color: "#666",
    marginTop: 2,
  },
  overviewEmpty: {
    color: "#999",
    fontStyle: "italic",
  },

  // KPI Cards
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
    marginBottom: 24,
  },
  kpiCard: {
    width: "48%",
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#fff",
    margin: "1%",
    alignItems: "center",
  },
  kpiIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  kpiValue: {
    fontWeight: "bold",
    fontSize: 22,
  },
  kpiLabel: {
    color: "#666",
    marginTop: 4,
    textAlign: "center",
  },

  // Section
  sectionTitle: {
    fontWeight: "600",
    marginBottom: 12,
    color: "#333",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 0,
  },

  // Quick Actions Grid
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 24,
  },
  actionItem: {
    width: "33.33%",
    alignItems: "center",
    marginBottom: 16,
  },
  actionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  actionIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  actionBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#F44336",
    fontSize: 10,
  },
  actionLabel: {
    marginTop: 6,
    color: "#555",
    textAlign: "center",
  },

  // Pending Bookings
  pendingCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  pendingTop: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  pendingInfo: {
    flex: 1,
  },
  pendingName: {
    fontWeight: "600",
    color: "#333",
  },
  pendingDetails: {
    color: "#666",
    marginTop: 2,
  },
  pendingChips: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    height: 26,
    backgroundColor: "#F5F5F5",
  },
  chipText: {
    fontSize: 11,
  },
  pendingAmount: {
    color: "#4CAF50",
    fontWeight: "600",
  },
  pendingDivider: {
    marginVertical: 10,
  },
  pendingActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  rejectButton: {
    borderColor: "#F44336",
    borderRadius: 8,
  },
  approveButton: {
    borderRadius: 8,
  },

  // Empty small card
  emptySmallCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    marginBottom: 10,
  },
  emptySmallText: {
    color: "#999",
    marginTop: 8,
  },

  // Activity Feed
  activityCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
  },
  activityItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityText: {
    color: "#333",
  },
  activityTime: {
    color: "#999",
    marginTop: 2,
  },
  activityDivider: {
    marginLeft: 48,
  },
});
