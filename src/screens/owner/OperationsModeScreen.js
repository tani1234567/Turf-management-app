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
  Chip,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSelector } from "react-redux";
import { selectUser } from "../../store/slices/authSlice";
import {
  queryDocuments,
  updateDocument,
  subscribeToCollection,
} from "../../services/firebase/firestore";
import { useSelectedTurf } from "../../hooks/useSelectedTurf";

const OWNER_COLOR = "#9C27B0";
const OPS_COLOR = "#00796B"; // Teal for operations mode

// Helper: today's date string
const getTodayString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Helper: format currency
const formatCurrency = (amount) => {
  if (amount >= 1000) {
    return `₹${(amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1)}K`;
  }
  return `₹${amount}`;
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

// Helper: current time as HH:MM
const getCurrentTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export default function OperationsModeScreen({ navigation }) {
  const user = useSelector(selectUser);
  const {
    turfData: selectedTurfData,
    selectedTurfId,
    allTurfs: turfs,
    hasMultipleTurfs,
    isLoading: turfLoading,
    changeTurf,
  } = useSelectedTurf();

  // Turf menu
  const [turfMenuVisible, setTurfMenuVisible] = useState(false);

  // Loading
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // KPIs
  const [pendingCount, setPendingCount] = useState(0);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [paymentsToVerify, setPaymentsToVerify] = useState(0);
  const [todayBookingsCount, setTodayBookingsCount] = useState(0);

  // Pending bookings
  const [pendingBookings, setPendingBookings] = useState([]);

  // Today's schedule
  const [currentBooking, setCurrentBooking] = useState(null);
  const [nextBooking, setNextBooking] = useState(null);

  // Realtime listener ref
  const unsubscribeRef = useRef(null);

  // Fetch data when turf changes
  useEffect(() => {
    if (!selectedTurfId) {
      setLoading(false);
      return;
    }

    fetchOperationsData();
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

    const unsubscribe = subscribeToCollection(
      "bookings",
      (docs) => {
        const pending = docs.filter((d) => d.status === "pending");
        setPendingCount(pending.length);
        setPendingBookings(pending.slice(0, 5));
      },
      [
        { field: "turfId", operator: "==", value: selectedTurfId },
        { field: "status", operator: "==", value: "pending" },
      ]
    );

    unsubscribeRef.current = unsubscribe;
  };

  const fetchOperationsData = async () => {
    try {
      setLoading(true);
      const today = getTodayString();
      const currentTime = getCurrentTime();

      const turfBookings = await queryDocuments("bookings", [
        { field: "turfId", operator: "==", value: selectedTurfId },
      ]);

      // Today's bookings
      const todayBookings = turfBookings.filter((b) => b.date === today);

      // Revenue
      const confirmed = todayBookings.filter(
        (b) => b.status === "confirmed" || b.status === "completed"
      );
      const revenue = confirmed.reduce(
        (sum, b) =>
          sum + (b.totalAmount || b.totalPrice || b.payment?.slotAmount || b.amount || 0),
        0
      );
      setTodayRevenue(revenue);
      setTodayBookingsCount(confirmed.length);

      // Payments to verify
      const paymentsPending = turfBookings.filter(
        (b) => b.status === "payment_submitted"
      );
      setPaymentsToVerify(paymentsPending.length);

      // Current & next booking
      const confirmedSorted = confirmed.sort((a, b) =>
        (a.startTime || "").localeCompare(b.startTime || "")
      );
      const current = confirmedSorted.find(
        (b) =>
          (b.startTime || "") <= currentTime && (b.endTime || "") > currentTime
      );
      const next = confirmedSorted.find(
        (b) => (b.startTime || "") > currentTime
      );
      setCurrentBooking(current || null);
      setNextBooking(next || null);
    } catch (error) {
      console.error("Error fetching operations data:", error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchOperationsData();
    setRefreshing(false);
  }, [selectedTurfId]);

  const handleTurfSelect = (turfId) => {
    setTurfMenuVisible(false);
    changeTurf(turfId);
  };

  const handleApproveBooking = async (booking) => {
    try {
      await updateDocument("bookings", booking.id, {
        status: "confirmed",
        approvedBy: user?.userId,
        approvedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error approving booking:", error);
      Alert.alert("Error", "Failed to approve booking.");
    }
  };

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
                rejectedBy: user?.userId,
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

  const selectedTurf = selectedTurfData || turfs.find(
    (t) => (t.id || t.turfId) === selectedTurfId
  );

  // KPI data
  const kpiCards = [
    {
      id: "pending",
      label: "Pending",
      value: String(pendingCount),
      icon: "clock-alert-outline",
      color: "#FF9800",
      onPress: () => navigation.navigate("ManagerBookings", { turfId: selectedTurfId }),
    },
    {
      id: "revenue",
      label: "Today Revenue",
      value: formatCurrency(todayRevenue),
      icon: "currency-inr",
      color: "#4CAF50",
    },
    {
      id: "payments",
      label: "Verify Payments",
      value: String(paymentsToVerify),
      icon: "credit-card-check-outline",
      color: "#2196F3",
      onPress: paymentsToVerify > 0
        ? () => navigation.navigate("VerifyPayment", { turfId: selectedTurfId })
        : undefined,
    },
    {
      id: "bookings",
      label: "Today Bookings",
      value: String(todayBookingsCount),
      icon: "calendar-check",
      color: OPS_COLOR,
    },
  ];

  // Quick actions
  const quickActions = [
    {
      id: "bookings",
      label: "Bookings",
      icon: "calendar-text",
      color: "#2196F3",
      badge: pendingCount > 0 ? pendingCount : null,
      onPress: () => navigation.navigate("ManagerBookings", { turfId: selectedTurfId }),
    },
    {
      id: "calendar",
      label: "Calendar",
      icon: "calendar-month",
      color: "#4CAF50",
      onPress: () => navigation.navigate("Calendar", { turfId: selectedTurfId }),
    },
    {
      id: "verify",
      label: "Verify Pay",
      icon: "credit-card-check",
      color: "#FF5722",
      badge: paymentsToVerify > 0 ? paymentsToVerify : null,
      onPress: () => navigation.navigate("VerifyPayment", { turfId: selectedTurfId }),
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
      id: "analytics",
      label: "Analytics",
      icon: "chart-bar",
      color: "#795548",
      onPress: () => navigation.navigate("AnalyticsDashboard"),
    },
  ];

  if (loading && turfs.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={OPS_COLOR} />
          <Text variant="bodyMedium" style={styles.loadingText}>
            Loading operations...
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
            colors={[OPS_COLOR]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View>
              <Text variant="titleLarge" style={styles.headerTitle}>
                Operations Mode
              </Text>
              <Text variant="bodySmall" style={styles.headerSubtitle}>
                Manage day-to-day operations
              </Text>
            </View>
          </View>
          <Chip
            mode="flat"
            style={styles.ownerBadge}
            textStyle={styles.ownerBadgeText}
            icon={() => (
              <MaterialCommunityIcons name="shield-crown" size={14} color={OWNER_COLOR} />
            )}
          >
            Owner
          </Chip>
        </View>

        {/* Turf Selector */}
        {turfs.length > 0 && (
          <View style={styles.turfSelectorContainer}>
            {hasMultipleTurfs ? (
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
                      color={OPS_COLOR}
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
                {turfs.map((turf) => {
                  const tid = turf.id || turf.turfId;
                  return (
                    <Menu.Item
                      key={tid}
                      onPress={() => handleTurfSelect(tid)}
                      title={turf.name}
                      leadingIcon={
                        tid === selectedTurfId ? "check-circle" : "circle-outline"
                      }
                      titleStyle={
                        tid === selectedTurfId ? styles.selectedMenuItem : undefined
                      }
                    />
                  );
                })}
              </Menu>
            ) : (
              <View style={styles.turfSelectorButton}>
                <MaterialCommunityIcons
                  name="soccer-field"
                  size={20}
                  color={OPS_COLOR}
                />
                <Text
                  variant="titleSmall"
                  style={styles.turfSelectorText}
                  numberOfLines={1}
                >
                  {selectedTurf?.name || "No Turf"}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* No Turfs */}
        {turfs.length === 0 && (
          <Surface style={styles.emptyCard} elevation={1}>
            <MaterialCommunityIcons name="soccer-field" size={64} color="#ccc" />
            <Text variant="titleMedium" style={styles.emptyTitle}>
              No Turfs Available
            </Text>
            <Text variant="bodyMedium" style={styles.emptySubtext}>
              {user?.managedTurfIds?.length > 0
                ? "Selected turfs may have been removed. Update your operational settings."
                : "Add turfs to your company first."}
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
                  color={OPS_COLOR}
                />
                <Text variant="titleSmall" style={styles.overviewTitle}>
                  Today's Schedule
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
                      {currentBooking.sport ? ` · ${currentBooking.sport}` : ""}
                    </Text>
                  </View>
                </View>
              ) : nextBooking ? (
                <View style={styles.overviewBooking}>
                  <View style={[styles.overviewBadge, { backgroundColor: "#E0F2F1" }]}>
                    <Text style={[styles.overviewBadgeText, { color: OPS_COLOR }]}>
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
                <TouchableOpacity
                  key={kpi.id}
                  style={styles.kpiCard}
                  onPress={kpi.onPress}
                  activeOpacity={kpi.onPress ? 0.7 : 1}
                >
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
                </TouchableOpacity>
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

            {/* Pending Bookings */}
            <View style={styles.sectionHeader}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Pending Bookings
              </Text>
              {pendingCount > 5 && (
                <Button
                  mode="text"
                  compact
                  onPress={() =>
                    navigation.navigate("ManagerBookings", { turfId: selectedTurfId })
                  }
                  textColor={OPS_COLOR}
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
                        {(booking.totalAmount ||
                          booking.totalPrice ||
                          booking.payment?.slotAmount ||
                          booking.amount) && (
                          <Text
                            variant="labelMedium"
                            style={styles.pendingAmount}
                          >
                            ₹
                            {booking.totalAmount ||
                              booking.totalPrice ||
                              booking.payment?.slotAmount ||
                              booking.amount}
                          </Text>
                        )}
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
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  headerTitle: {
    fontWeight: "bold",
    color: OPS_COLOR,
  },
  headerSubtitle: {
    color: "#666",
  },
  ownerBadge: {
    backgroundColor: "#F3E5F5",
  },
  ownerBadgeText: {
    color: OWNER_COLOR,
    fontSize: 12,
    fontWeight: "600",
  },

  // Turf Selector
  turfSelectorContainer: {
    marginBottom: 16,
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
  turfSelectorText: {
    flex: 1,
    marginLeft: 10,
    color: "#333",
    fontWeight: "600",
  },
  menuStyle: {
    marginTop: 50,
  },
  menuContent: {
    backgroundColor: "#fff",
  },
  selectedMenuItem: {
    color: OPS_COLOR,
    fontWeight: "bold",
  },

  // Empty
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

  // Overview
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

  // KPI
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
    elevation: 1,
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

  // Quick Actions
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

  // Empty small
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
});
