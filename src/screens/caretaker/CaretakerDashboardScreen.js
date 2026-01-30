import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Text, Surface, Card, Chip, Divider } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSelector } from "react-redux";
import {
  selectUser,
  selectAssignedTurfId,
} from "../../store/slices/authSlice";
import { getTodayBookingsForCaretaker } from "../../services/firebase/firestore";

const CARETAKER_COLOR = "#FF9800";

export default function CaretakerDashboardScreen({ navigation }) {
  const user = useSelector(selectUser);
  const assignedTurfId = useSelector(selectAssignedTurfId);

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

  const today = new Date();

  const formatDate = () => {
    return today.toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  };

  const fetchDashboardData = async () => {
    console.log("CaretakerDashboard - fetchDashboardData called");
    console.log("CaretakerDashboard - assignedTurfId:", assignedTurfId);
    console.log("CaretakerDashboard - user:", user);

    if (!assignedTurfId) {
      console.log("CaretakerDashboard - No assignedTurfId, checking user.assignedTurfId");
      // Try to get from user object directly
      const userTurfId = user?.assignedTurfId;
      console.log("CaretakerDashboard - user.assignedTurfId:", userTurfId);

      if (!userTurfId) {
        console.error("CaretakerDashboard - No turf assigned to this caretaker");
        setLoading(false);
        Alert.alert(
          "No Turf Assigned",
          "You haven't been assigned to a turf yet. Please contact your manager.",
          [{ text: "OK" }]
        );
        return;
      }

      // Use the user's assignedTurfId directly
      try {
        const result = await getTodayBookingsForCaretaker(userTurfId);
        console.log("CaretakerDashboard - Result:", result);

        if (result.success) {
          setTurfName(result.turfName || "Unknown Turf");
          setBookings(result.bookings || []);
          calculateStats(result.bookings || []);
        } else {
          console.error("Error fetching bookings:", result.message);
          Alert.alert("Error", result.message || "Failed to load dashboard data");
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
        Alert.alert("Error", "Failed to load dashboard data. Please try again.");
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      console.log("CaretakerDashboard - Fetching bookings for turf:", assignedTurfId);
      const result = await getTodayBookingsForCaretaker(assignedTurfId);
      console.log("CaretakerDashboard - Result:", result);

      if (result.success) {
        setTurfName(result.turfName || "Unknown Turf");
        setBookings(result.bookings || []);
        calculateStats(result.bookings || []);
      } else {
        console.error("Error fetching bookings:", result.message);
        Alert.alert("Error", result.message || "Failed to load dashboard data");
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      Alert.alert("Error", "Failed to load dashboard data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (bookingsList) => {
    const completed = bookingsList.filter((b) => b.status === "completed").length;
    const inProgress = bookingsList.filter((b) => b.status === "in_progress").length;
    const pending = bookingsList.filter((b) => b.status === "pending").length;

    // Count bookings with pending payment
    const pendingPayment = bookingsList.filter((b) => {
      const payment = b.payment || {};
      return !payment.remainingPaid || payment.remainingAmount > 0;
    }).length;

    // Calculate cash collection (completed bookings with cash payment)
    const totalCashCollection = bookingsList
      .filter((b) => b.status === "completed" && b.payment?.remainingPaid)
      .reduce((sum, b) => {
        const payment = b.payment || {};
        if (payment.paymentMethod === "cash") {
          return sum + (payment.remainingAmount || 0);
        }
        return sum;
      }, 0);

    // Calculate online collection
    const totalOnlineCollection = bookingsList
      .filter((b) => b.status === "completed" && b.payment?.remainingPaid)
      .reduce((sum, b) => {
        const payment = b.payment || {};
        if (payment.paymentMethod === "online" || payment.paymentMethod === "upi") {
          return sum + (payment.remainingAmount || 0);
        }
        return sum;
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
    console.log("CaretakerDashboard - useEffect triggered");
    fetchDashboardData();
  }, [assignedTurfId, user?.assignedTurfId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "completed":
        return "#4CAF50";
      case "in_progress":
        return "#2196F3";
      case "pending":
        return "#FF9800";
      case "confirmed":
        return "#00BCD4";
      default:
        return "#999999";
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case "in_progress":
        return "In Progress";
      case "pending":
        return "Pending";
      case "confirmed":
        return "Confirmed";
      case "completed":
        return "Completed";
      default:
        return status;
    }
  };

  const formatTime = (time) => {
    if (!time) return "";
    return time;
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[CARETAKER_COLOR]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text variant="bodyMedium" style={styles.dateText}>
              {formatDate()}
            </Text>
            <Text variant="headlineSmall" style={styles.greeting}>
              Hello, {user?.name || "Caretaker"}
            </Text>
          </View>
          <Surface style={styles.avatarContainer} elevation={2}>
            <MaterialCommunityIcons
              name="account-hard-hat"
              size={28}
              color={CARETAKER_COLOR}
            />
          </Surface>
        </View>

        {/* Assigned Turf Card */}
        <Surface style={styles.turfCard} elevation={2}>
          <View style={styles.turfCardContent}>
            <MaterialCommunityIcons
              name="soccer-field"
              size={32}
              color="#4CAF50"
            />
            <View style={styles.turfInfo}>
              <Text variant="bodySmall" style={styles.turfLabel}>
                Assigned Turf
              </Text>
              <Text variant="titleLarge" style={styles.turfName}>
                {turfName || "Loading..."}
              </Text>
            </View>
          </View>
        </Surface>

        {/* Quick Stats */}
        <View style={styles.statsGrid}>
          <Surface style={styles.statCard} elevation={1}>
            <MaterialCommunityIcons
              name="calendar-check"
              size={24}
              color="#4CAF50"
            />
            <Text variant="headlineMedium" style={[styles.statValue, { color: "#4CAF50" }]}>
              {stats.completed}
            </Text>
            <Text variant="bodySmall" style={styles.statLabel}>
              Completed
            </Text>
          </Surface>

          <Surface style={styles.statCard} elevation={1}>
            <MaterialCommunityIcons
              name="clock-alert-outline"
              size={24}
              color="#FF9800"
            />
            <Text variant="headlineMedium" style={[styles.statValue, { color: "#FF9800" }]}>
              {stats.pendingPayment}
            </Text>
            <Text variant="bodySmall" style={styles.statLabel}>
              Pending Payment
            </Text>
          </Surface>
        </View>

        {/* Today's Earnings */}
        <Surface style={styles.earningsCard} elevation={2}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Today's Earnings
          </Text>
          <Divider style={styles.divider} />

          <View style={styles.earningsRow}>
            <View style={styles.earningsItem}>
              <View style={styles.earningsIconContainer}>
                <MaterialCommunityIcons name="cash" size={28} color="#4CAF50" />
              </View>
              <View style={styles.earningsInfo}>
                <Text variant="bodySmall" style={styles.earningsLabel}>
                  Cash Collection
                </Text>
                <Text variant="headlineSmall" style={[styles.earningsValue, { color: "#4CAF50" }]}>
                  ₹{stats.totalCashCollection}
                </Text>
              </View>
            </View>

            <View style={styles.earningsDivider} />

            <View style={styles.earningsItem}>
              <View style={styles.earningsIconContainer}>
                <MaterialCommunityIcons name="credit-card" size={28} color="#2196F3" />
              </View>
              <View style={styles.earningsInfo}>
                <Text variant="bodySmall" style={styles.earningsLabel}>
                  Online Collection
                </Text>
                <Text variant="headlineSmall" style={[styles.earningsValue, { color: "#2196F3" }]}>
                  ₹{stats.totalOnlineCollection}
                </Text>
              </View>
            </View>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.totalEarningsRow}>
            <Text variant="titleMedium" style={styles.totalEarningsLabel}>
              Total Collection
            </Text>
            <Text variant="headlineMedium" style={styles.totalEarningsValue}>
              ₹{stats.totalCashCollection + stats.totalOnlineCollection}
            </Text>
          </View>
        </Surface>

        {/* Today's Bookings Overview */}
        <Text variant="titleMedium" style={styles.sectionHeader}>
          Today's Bookings
        </Text>
        <View style={styles.bookingStatsRow}>
          <Chip
            icon="calendar-today"
            style={styles.chip}
            textStyle={styles.chipText}
          >
            Total: {stats.total}
          </Chip>
          <Chip
            icon="progress-clock"
            style={styles.chip}
            textStyle={styles.chipText}
          >
            In Progress: {stats.inProgress}
          </Chip>
          <Chip
            icon="clock-outline"
            style={styles.chip}
            textStyle={styles.chipText}
          >
            Pending: {stats.pending}
          </Chip>
        </View>

        {/* Quick Actions */}
        <Text variant="titleMedium" style={styles.sectionHeader}>
          Quick Actions
        </Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity style={styles.actionCard}>
            <Surface style={styles.actionCardSurface} elevation={1}>
              <MaterialCommunityIcons name="cash" size={32} color="#4CAF50" />
              <Text variant="bodySmall" style={styles.actionText}>
                Collect Payment
              </Text>
            </Surface>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard}>
            <Surface style={styles.actionCardSurface} elevation={1}>
              <MaterialCommunityIcons
                name="check-circle"
                size={32}
                color="#2196F3"
              />
              <Text variant="bodySmall" style={styles.actionText}>
                Mark Complete
              </Text>
            </Surface>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard}>
            <Surface style={styles.actionCardSurface} elevation={1}>
              <MaterialCommunityIcons
                name="clock-plus-outline"
                size={32}
                color="#FF9800"
              />
              <Text variant="bodySmall" style={styles.actionText}>
                Extend Time
              </Text>
            </Surface>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard}>
            <Surface style={styles.actionCardSurface} elevation={1}>
              <MaterialCommunityIcons
                name="alert-circle"
                size={32}
                color="#F44336"
              />
              <Text variant="bodySmall" style={styles.actionText}>
                Report Issue
              </Text>
            </Surface>
          </TouchableOpacity>
        </View>

        {/* Upcoming Bookings */}
        <Text variant="titleMedium" style={styles.sectionHeader}>
          Upcoming Bookings
        </Text>
        {nextBookings.length > 0 ? (
          nextBookings.map((booking, index) => (
            <TouchableOpacity
              key={booking.id || index}
              onPress={() => navigation.navigate("PaymentCollection", { booking })}
            >
              <Card style={styles.bookingCard}>
                <Card.Content>
                <View style={styles.bookingHeader}>
                  <View style={styles.bookingTimeContainer}>
                    <MaterialCommunityIcons
                      name="clock-outline"
                      size={20}
                      color={CARETAKER_COLOR}
                    />
                    <Text variant="titleMedium" style={styles.bookingTime}>
                      {formatTime(booking.startTime)} - {formatTime(booking.endTime)}
                    </Text>
                  </View>
                  <Chip
                    style={[
                      styles.statusChip,
                      { backgroundColor: getStatusColor(booking.status) + "20" },
                    ]}
                    textStyle={[
                      styles.statusChipText,
                      { color: getStatusColor(booking.status) },
                    ]}
                  >
                    {getStatusLabel(booking.status)}
                  </Chip>
                </View>

                <View style={styles.bookingDetails}>
                  <View style={styles.bookingRow}>
                    <MaterialCommunityIcons
                      name="account"
                      size={16}
                      color="#666"
                    />
                    <Text variant="bodyMedium" style={styles.bookingDetailText}>
                      {booking.userName || "Unknown User"}
                    </Text>
                  </View>

                  <View style={styles.bookingRow}>
                    <MaterialCommunityIcons
                      name="soccer"
                      size={16}
                      color="#666"
                    />
                    <Text variant="bodyMedium" style={styles.bookingDetailText}>
                      {booking.sport || "N/A"}
                    </Text>
                  </View>

                  <View style={styles.bookingRow}>
                    <MaterialCommunityIcons
                      name="map-marker"
                      size={16}
                      color="#666"
                    />
                    <Text variant="bodyMedium" style={styles.bookingDetailText}>
                      {booking.groundName || "N/A"}
                    </Text>
                  </View>
                </View>

                <View style={styles.bookingFooter}>
                  <View style={styles.priceContainer}>
                    <Text variant="bodySmall" style={styles.priceLabel}>
                      Amount:
                    </Text>
                    <Text variant="titleMedium" style={styles.priceValue}>
                      ₹{booking.totalAmount || 0}
                    </Text>
                  </View>

                  {booking.payment?.remainingPaid ? (
                    <Chip
                      icon="check-circle"
                      style={styles.paidChip}
                      textStyle={styles.paidChipText}
                    >
                      Paid
                    </Chip>
                  ) : (
                    <Chip
                      icon="clock-outline"
                      style={styles.unpaidChip}
                      textStyle={styles.unpaidChipText}
                    >
                      Payment Pending
                    </Chip>
                  )}
                </View>
              </Card.Content>
            </Card>
            </TouchableOpacity>
          ))
        ) : (
          <Card style={styles.emptyCard}>
            <Card.Content style={styles.emptyState}>
              <MaterialCommunityIcons
                name="calendar-blank"
                size={48}
                color="#ccc"
              />
              <Text variant="bodyMedium" style={styles.emptyText}>
                No upcoming bookings
              </Text>
            </Card.Content>
          </Card>
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
    paddingBottom: 32,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  headerLeft: {
    flex: 1,
  },
  dateText: {
    color: "#666",
  },
  greeting: {
    fontWeight: "bold",
    color: "#333",
    marginTop: 4,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFF3E0",
    justifyContent: "center",
    alignItems: "center",
  },
  turfCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#fff",
    marginBottom: 16,
  },
  turfCardContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  turfInfo: {
    marginLeft: 12,
    flex: 1,
  },
  turfLabel: {
    color: "#666",
    marginBottom: 4,
  },
  turfName: {
    fontWeight: "bold",
    color: "#333",
  },
  statsGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#fff",
    alignItems: "center",
  },
  statValue: {
    fontWeight: "bold",
    marginTop: 8,
  },
  statLabel: {
    color: "#666",
    marginTop: 4,
    textAlign: "center",
  },
  earningsCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#fff",
    marginBottom: 20,
  },
  sectionTitle: {
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  divider: {
    marginVertical: 12,
  },
  earningsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  earningsItem: {
    flex: 1,
    alignItems: "center",
  },
  earningsIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#f5f5f5",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  earningsInfo: {
    alignItems: "center",
  },
  earningsLabel: {
    color: "#666",
    marginBottom: 4,
  },
  earningsValue: {
    fontWeight: "bold",
  },
  earningsDivider: {
    width: 1,
    height: 60,
    backgroundColor: "#E0E0E0",
  },
  totalEarningsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalEarningsLabel: {
    fontWeight: "600",
    color: "#333",
  },
  totalEarningsValue: {
    fontWeight: "bold",
    color: CARETAKER_COLOR,
  },
  sectionHeader: {
    fontWeight: "600",
    marginBottom: 12,
    color: "#333",
  },
  bookingStatsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
  },
  chip: {
    backgroundColor: "#E3F2FD",
  },
  chipText: {
    fontSize: 12,
    color: "#1976D2",
  },
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
    marginBottom: 20,
  },
  actionCard: {
    width: "48%",
    padding: 4,
  },
  actionCardSurface: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#fff",
    alignItems: "center",
  },
  actionText: {
    marginTop: 8,
    color: "#666",
    textAlign: "center",
  },
  bookingCard: {
    marginBottom: 12,
    borderRadius: 12,
  },
  bookingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  bookingTimeContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  bookingTime: {
    fontWeight: "600",
    color: "#333",
    marginLeft: 8,
  },
  statusChip: {
    height: 28,
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  bookingDetails: {
    marginBottom: 12,
  },
  bookingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  bookingDetailText: {
    color: "#666",
    marginLeft: 8,
  },
  bookingFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  priceContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  priceLabel: {
    color: "#666",
    marginRight: 8,
  },
  priceValue: {
    fontWeight: "bold",
    color: "#333",
  },
  paidChip: {
    backgroundColor: "#E8F5E9",
    height: 28,
  },
  paidChipText: {
    color: "#4CAF50",
    fontSize: 12,
  },
  unpaidChip: {
    backgroundColor: "#FFF3E0",
    height: 28,
  },
  unpaidChipText: {
    color: "#FF9800",
    fontSize: 12,
  },
  emptyCard: {
    borderRadius: 12,
  },
  emptyState: {
    alignItems: "center",
    padding: 24,
  },
  emptyText: {
    color: "#999",
    marginTop: 8,
  },
});
