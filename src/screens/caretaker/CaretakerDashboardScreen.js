import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Text, Surface, Divider, Badge } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSelector } from "react-redux";
import {
  selectUser,
  selectAssignedTurfId,
} from "../../store/slices/authSlice";
import { getTodayBookingsForCaretaker } from "../../services/firebase/firestore";
import { useNotifications } from "../../hooks";

const CARETAKER_ORANGE = "#F97316";
const CARETAKER_DARK   = "#EA580C";
const PALE_ORANGE      = "#FFF7ED";
const NAVY_ORANGE      = "#7C2D12";
const SUCCESS_GREEN    = "#22C55E";
const WARN_AMBER       = "#F59E0B";
const DANGER_RED       = "#EF4444";
const MANAGER_BLUE     = "#3B82F6";

export default function CaretakerDashboardScreen({ navigation }) {
  const user = useSelector(selectUser);
  const assignedTurfId = useSelector(selectAssignedTurfId);
  const { unreadCount } = useNotifications();

  const [turfName, setTurfName] = useState("");
  const [bookings, setBookings] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    inProgress: 0,
    pending: 0,
    pendingPayment: 0,
    totalCashCollection: 0,
    totalOnlineCollection: 0,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning,";
    if (h < 17) return "Good afternoon,";
    return "Good evening,";
  };

  const fetchDashboardData = async () => {
    if (!assignedTurfId) {
      const userTurfId = user?.assignedTurfId;
      if (!userTurfId) {
        setLoading(false);
        Alert.alert(
          "No Turf Assigned",
          "You haven't been assigned to a turf yet. Please contact your manager.",
          [{ text: "OK" }]
        );
        return;
      }
      try {
        const result = await getTodayBookingsForCaretaker(userTurfId);
        if (result.success) {
          setTurfName(result.turfName || "Unknown Turf");
          setBookings(result.bookings || []);
          calculateStats(result.bookings || []);
        } else {
          Alert.alert("Error", result.message || "Failed to load dashboard data");
        }
      } catch (error) {
        Alert.alert("Error", "Failed to load dashboard data. Please try again.");
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      const result = await getTodayBookingsForCaretaker(assignedTurfId);
      if (result.success) {
        setTurfName(result.turfName || "Unknown Turf");
        setBookings(result.bookings || []);
        calculateStats(result.bookings || []);
      } else {
        Alert.alert("Error", result.message || "Failed to load dashboard data");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to load dashboard data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (bookingsList) => {
    const completed = bookingsList.filter((b) => b.status === "completed").length;
    const inProgress = bookingsList.filter((b) => b.status === "in_progress").length;
    const pending = bookingsList.filter((b) => b.status === "pending").length;

    const pendingPayment = bookingsList.filter((b) => {
      if (b.status === "cancelled" || b.status === "rejected") return false;
      const payment = b.payment || {};
      return !payment.isFullyPaid && !payment.remainingPaid;
    }).length;

    const totalCashCollection = bookingsList
      .filter((b) => b.status === "completed")
      .reduce((sum, b) => {
        const payment = b.payment || {};
        return sum + (payment.onGround?.cashAmount || payment.cashAmount || 0);
      }, 0);

    const totalOnlineCollection = bookingsList
      .filter((b) => b.status === "completed")
      .reduce((sum, b) => {
        const payment = b.payment || {};
        const advancePaid = payment.advance?.status === "verified" ? (payment.advanceAmount || 0) : 0;
        const onlineOnGround = payment.onGround?.onlineAmount || payment.onlineAmount || 0;
        return sum + advancePaid + onlineOnGround;
      }, 0);

    setStats({
      total: bookingsList.length,
      completed,
      inProgress,
      pending,
      pendingPayment,
      totalCashCollection,
      totalOnlineCollection,
    });
  };

  useEffect(() => {
    fetchDashboardData();
  }, [assignedTurfId, user?.assignedTurfId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "completed":   return SUCCESS_GREEN;
      case "in_progress": return MANAGER_BLUE;
      case "pending":     return CARETAKER_ORANGE;
      case "confirmed":   return MANAGER_BLUE;
      default:            return "#9CA3AF";
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case "in_progress": return "In Progress";
      case "pending":     return "Pending";
      case "confirmed":   return "Confirmed";
      case "completed":   return "Completed";
      default:            return status;
    }
  };

  const getNextBookings = () => {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;

    return bookings
      .filter(
        (b) =>
          b.startTime >= currentTime &&
          ["confirmed", "pending"].includes(b.status)
      )
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
      .slice(0, 3);
  };

  const nextBookings = getNextBookings();

  // KPI config
  const kpiCards = [
    { id: "completed", label: "Completed", value: String(stats.completed), icon: "calendar-check", color: SUCCESS_GREEN },
    { id: "pendingPay", label: "Pending Payment", value: String(stats.pendingPayment), icon: "clock-alert-outline", color: CARETAKER_ORANGE },
    { id: "inProgress", label: "In Progress", value: String(stats.inProgress), icon: "progress-clock", color: MANAGER_BLUE },
    { id: "total", label: "Total Bookings", value: String(stats.total), icon: "calendar-month", color: "#8B5CF6" },
  ];

  // Quick actions config
  const quickActions = [
    { id: "quickbook", label: "Quick Booking", icon: "calendar-plus", color: CARETAKER_ORANGE, onPress: () => navigation.navigate("CaretakerCreateBooking") },
    { id: "payment", label: "Collect Payment", icon: "cash", color: SUCCESS_GREEN, onPress: () => {} },
    { id: "complete", label: "Mark Complete", icon: "check-circle", color: MANAGER_BLUE, onPress: () => {} },
    { id: "extend", label: "Extend Time", icon: "clock-plus-outline", color: WARN_AMBER, onPress: () => {} },
    { id: "issue", label: "Report Issue", icon: "alert-circle", color: DANGER_RED, onPress: () => navigation.navigate("MaintenanceLog") },
    { id: "expenses", label: "Expenses", icon: "cash-register", color: "#8B5CF6", onPress: () => navigation.navigate("ExpenseTracking") },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[CARETAKER_ORANGE]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.userName}>{user?.name || "Caretaker"}</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <TouchableOpacity
              onPress={() => navigation.navigate("Notifications")}
              style={styles.iconBtn}
            >
              <MaterialCommunityIcons name="bell-outline" size={22} color="#374151" />
              {unreadCount > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <View style={styles.avatarBtn}>
              <MaterialCommunityIcons
                name="account-hard-hat"
                size={22}
                color={CARETAKER_ORANGE}
              />
            </View>
          </View>
        </View>

        {/* KPI Cards */}
        <View style={styles.kpiGrid}>
          {kpiCards.map((kpi) => (
            <Surface key={kpi.id} style={styles.kpiCard} elevation={2}>
              <View style={[styles.kpiAccentBar, { backgroundColor: kpi.color }]} />
              <View style={styles.kpiBody}>
                <View style={[styles.kpiIconContainer, { backgroundColor: `${kpi.color}18` }]}>
                  <MaterialCommunityIcons name={kpi.icon} size={20} color={kpi.color} />
                </View>
                <Text style={[styles.kpiValue, { color: kpi.color }]}>
                  {kpi.value}
                </Text>
                <Text style={styles.kpiLabel}>{kpi.label}</Text>
              </View>
            </Surface>
          ))}
        </View>

        {/* Today's Earnings */}
        <Surface style={styles.earningsCard} elevation={2}>
          <View style={styles.sectionTitleRow}>
            <View style={[styles.sectionTitleAccent, { backgroundColor: CARETAKER_ORANGE }]} />
            <Text style={styles.sectionTitleText}>TODAY'S EARNINGS</Text>
          </View>

          <View style={styles.earningsRow}>
            <View style={styles.earningsItem}>
              <View style={[styles.earningsIconContainer, { backgroundColor: `${SUCCESS_GREEN}15` }]}>
                <MaterialCommunityIcons name="cash" size={24} color={SUCCESS_GREEN} />
              </View>
              <Text style={styles.earningsLabel}>Cash</Text>
              <Text style={[styles.earningsValue, { color: SUCCESS_GREEN }]}>
                ₹{stats.totalCashCollection}
              </Text>
            </View>

            <View style={styles.earningsDivider} />

            <View style={styles.earningsItem}>
              <View style={[styles.earningsIconContainer, { backgroundColor: `${MANAGER_BLUE}15` }]}>
                <MaterialCommunityIcons name="credit-card" size={24} color={MANAGER_BLUE} />
              </View>
              <Text style={styles.earningsLabel}>Online</Text>
              <Text style={[styles.earningsValue, { color: MANAGER_BLUE }]}>
                ₹{stats.totalOnlineCollection}
              </Text>
            </View>

            <View style={styles.earningsDivider} />

            <View style={styles.earningsItem}>
              <View style={[styles.earningsIconContainer, { backgroundColor: `${CARETAKER_ORANGE}15` }]}>
                <MaterialCommunityIcons name="currency-inr" size={24} color={CARETAKER_ORANGE} />
              </View>
              <Text style={styles.earningsLabel}>Total</Text>
              <Text style={[styles.earningsValue, { color: CARETAKER_ORANGE }]}>
                ₹{stats.totalCashCollection + stats.totalOnlineCollection}
              </Text>
            </View>
          </View>
        </Surface>

        {/* Today's Bookings Overview */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Today's Bookings</Text>
          <View style={styles.pillsRow}>
            <View style={styles.pill}>
              <Text style={styles.pillText}>Total: {stats.total}</Text>
            </View>
            <View style={styles.pill}>
              <Text style={styles.pillText}>In Progress: {stats.inProgress}</Text>
            </View>
            <View style={styles.pill}>
              <Text style={styles.pillText}>Pending: {stats.pending}</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
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
              </Surface>
              <Text style={styles.actionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Upcoming Bookings */}
        <Text style={styles.sectionTitle}>Upcoming Bookings</Text>
        {nextBookings.length > 0 ? (
          nextBookings.map((booking, index) => {
            const statusColor = getStatusColor(booking.status);
            return (
              <TouchableOpacity
                key={booking.id || index}
                onPress={() => navigation.navigate("PaymentCollection", { booking })}
              >
                <Surface
                  style={[styles.bookingCard, { borderLeftColor: statusColor }]}
                  elevation={2}
                >
                  <View style={styles.bookingHeader}>
                    <View style={styles.bookingTimeContainer}>
                      <MaterialCommunityIcons name="clock-outline" size={18} color={statusColor} />
                      <Text style={styles.bookingTime}>
                        {booking.startTime} - {booking.endTime}
                      </Text>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: `${statusColor}18` }]}>
                      <Text style={[styles.statusPillText, { color: statusColor }]}>
                        {getStatusLabel(booking.status)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.bookingDetails}>
                    <View style={styles.bookingRow}>
                      <MaterialCommunityIcons name="account" size={14} color="#9CA3AF" />
                      <Text style={styles.bookingDetailText}>
                        {booking.userName || "Unknown User"}
                      </Text>
                    </View>
                    <View style={styles.bookingRow}>
                      <MaterialCommunityIcons name="soccer" size={14} color="#9CA3AF" />
                      <Text style={styles.bookingDetailText}>{booking.sport || "N/A"}</Text>
                    </View>
                    <View style={styles.bookingRow}>
                      <MaterialCommunityIcons name="map-marker" size={14} color="#9CA3AF" />
                      <Text style={styles.bookingDetailText}>{booking.groundName || "N/A"}</Text>
                    </View>
                  </View>

                  <View style={styles.bookingFooter}>
                    <View style={styles.priceContainer}>
                      <Text style={styles.priceLabel}>Total:</Text>
                      <Text style={styles.priceValue}>
                        ₹{booking.totalAmount || booking.payment?.slotAmount || 0}
                      </Text>
                    </View>

                    {booking.payment?.isFullyPaid || booking.payment?.remainingPaid ? (
                      <View style={styles.paidPill}>
                        <MaterialCommunityIcons name="check-circle" size={12} color={SUCCESS_GREEN} />
                        <Text style={[styles.payPillText, { color: SUCCESS_GREEN }]}>Paid</Text>
                      </View>
                    ) : booking.payment?.advance?.status === "verified" ? (
                      <View style={styles.duePill}>
                        <Text style={[styles.payPillText, { color: CARETAKER_ORANGE }]}>
                          Due: ₹{booking.payment?.remainingAmount || 0}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.duePill}>
                        <Text style={[styles.payPillText, { color: CARETAKER_ORANGE }]}>
                          Pending: ₹{booking.payment?.remainingAmount ?? (booking.totalAmount || booking.payment?.slotAmount || 0)}
                        </Text>
                      </View>
                    )}
                  </View>
                </Surface>
              </TouchableOpacity>
            );
          })
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <MaterialCommunityIcons name="calendar-blank" size={36} color={CARETAKER_ORANGE} />
            </View>
            <Text style={styles.emptyTitle}>No upcoming bookings</Text>
            <Text style={styles.emptySubtext}>You're all caught up for today</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFBEB",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingVertical: 4,
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    fontSize: 13,
    color: "#6B7280",
    fontFamily: "Ubuntu-Regular",
  },
  userName: {
    fontSize: 22,
    fontFamily: "Ubuntu-Bold",
    color: NAVY_ORANGE,
    letterSpacing: -0.3,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  notifBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: DANGER_RED,
    justifyContent: "center",
    alignItems: "center",
  },
  notifBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "700",
  },
  avatarBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: PALE_ORANGE,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: CARETAKER_ORANGE + "40",
  },

  // KPI Grid
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  kpiCard: {
    width: "47.5%",
    borderRadius: 14,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  kpiAccentBar: {
    height: 4,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  kpiBody: {
    padding: 14,
    alignItems: "center",
  },
  kpiIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  kpiValue: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 24,
    letterSpacing: -0.5,
  },
  kpiLabel: {
    color: "#6B7280",
    marginTop: 4,
    textAlign: "center",
    fontSize: 11,
    fontFamily: "Ubuntu-Regular",
  },

  // Earnings Card
  earningsCard: {
    borderRadius: 14,
    backgroundColor: "#fff",
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: CARETAKER_ORANGE,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    gap: 8,
  },
  sectionTitleAccent: {
    width: 3,
    height: 14,
    borderRadius: 2,
  },
  sectionTitleText: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 11,
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  earningsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  earningsItem: {
    flex: 1,
    alignItems: "center",
  },
  earningsIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  earningsLabel: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 11,
    color: "#6B7280",
    marginBottom: 2,
  },
  earningsValue: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 18,
  },
  earningsDivider: {
    width: 1,
    height: 60,
    backgroundColor: "#F3F4F6",
  },

  // Section Header
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 15,
    color: NAVY_ORANGE,
    letterSpacing: 0.1,
    marginBottom: 10,
  },
  pillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  pill: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  pillText: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 12,
    color: "#374151",
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
    paddingVertical: 10,
  },
  actionIconContainer: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  actionIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
  },
  actionLabel: {
    marginTop: 6,
    color: "#374151",
    textAlign: "center",
    fontSize: 11,
    fontFamily: "Ubuntu-Medium",
  },

  // Booking Cards
  bookingCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
  },
  bookingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  bookingTimeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  bookingTime: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 14,
    color: "#111827",
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
  },
  statusPillText: {
    fontFamily: "Ubuntu-Medium",
    fontSize: 11,
  },
  bookingDetails: {
    marginBottom: 10,
    gap: 4,
  },
  bookingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  bookingDetailText: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 13,
    color: "#6B7280",
  },
  bookingFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  priceContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  priceLabel: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 12,
    color: "#6B7280",
  },
  priceValue: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 14,
    color: "#111827",
  },
  paidPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  duePill: {
    backgroundColor: PALE_ORANGE,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  payPillText: {
    fontFamily: "Ubuntu-Medium",
    fontSize: 11,
  },

  // Empty state
  emptyState: {
    alignItems: "center",
    paddingVertical: 32,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: PALE_ORANGE,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 15,
    color: "#374151",
    marginBottom: 4,
  },
  emptySubtext: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 13,
    color: "#9CA3AF",
  },
});
