import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { Text, Surface, Button, Avatar, Chip, Badge, FAB } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSelector, useDispatch } from "react-redux";
import { selectUser } from "../../store/slices/authSlice";
import { selectCompany, selectSubscription, selectManagers, selectCaretakers } from "../../store/slices/companySlice";
import { selectTurfs, selectPendingActions, setTurfs } from "../../store/slices/ownerSlice";
import { queryDocuments } from "../../services/firebase/firestore";
import { useNotifications } from "../../hooks";

const OWNER_COLOR = "#9C27B0";

export default function OwnerDashboardScreen({ navigation }) {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const { unreadCount } = useNotifications();
  const company = useSelector(selectCompany);
  const subscription = useSelector(selectSubscription);
  const reduxTurfs = useSelector(selectTurfs);
  const pendingActions = useSelector(selectPendingActions);
  const managers = useSelector(selectManagers);
  const caretakers = useSelector(selectCaretakers);

  const [refreshing, setRefreshing] = useState(false);
  const [pendingTurfRequests, setPendingTurfRequests] = useState([]);
  const [liveStats, setLiveStats] = useState({
    totalRevenue: 0,
    totalBookings: 0,
    totalTurfs: 0,
  });
  const [localTurfs, setLocalTurfs] = useState([]);

  const turfs = reduxTurfs && reduxTurfs.length > 0 ? reduxTurfs : localTurfs;

  // Fetch real stats on mount and when company changes
  useEffect(() => {
    fetchLiveStats();
  }, [company]);

  const fetchLiveStats = useCallback(async () => {
    const companyId = company?.id || company?.companyId;
    if (!companyId) return;

    try {
      // Fetch turfs if Redux is empty
      let turfList = reduxTurfs && reduxTurfs.length > 0 ? reduxTurfs : [];
      if (turfList.length === 0) {
        turfList = await queryDocuments("turfs", [
          { field: "companyId", operator: "==", value: companyId },
        ]);
        setLocalTurfs(turfList);
        if (turfList.length > 0) {
          dispatch(setTurfs(turfList));
        }
      }

      // Fetch bookings across all turfs to compute real stats
      let totalRevenue = 0;
      let totalBookings = 0;
      for (const turf of turfList) {
        const turfId = turf.id || turf.turfId;
        const bookings = await queryDocuments("bookings", [
          { field: "turfId", operator: "==", value: turfId },
        ]);
        const confirmed = bookings.filter(
          (b) => b.status === "confirmed" || b.status === "completed"
        );
        totalBookings += confirmed.length;
        totalRevenue += confirmed.reduce(
          (sum, b) => sum + (b.totalAmount || b.totalPrice || b.payment?.slotAmount || b.amount || 0),
          0
        );
      }

      setLiveStats({
        totalRevenue,
        totalBookings,
        totalTurfs: turfList.length,
      });

      // Fetch pending turf requests
      const turfReqs = await queryDocuments("turf_requests", [
        { field: "companyId", operator: "==", value: companyId },
        { field: "status", operator: "==", value: "pending" },
      ]);
      setPendingTurfRequests(turfReqs);
    } catch (error) {
      console.error("Error fetching live stats:", error);
    }
  }, [company, reduxTurfs]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchLiveStats();
    setRefreshing(false);
  };

  const getSubscriptionStatusColor = () => {
    switch (subscription?.status) {
      case "trial":
        return "#FF9800";
      case "active":
        return "#4CAF50";
      case "expired":
        return "#F44336";
      case "grace_period":
        return "#FF5722";
      default:
        return "#999";
    }
  };

  const getSubscriptionStatusText = () => {
    switch (subscription?.status) {
      case "trial":
        return "Trial";
      case "active":
        return "Active";
      case "expired":
        return "Expired";
      case "grace_period":
        return "Grace Period";
      default:
        return "Unknown";
    }
  };

  const getDaysRemaining = () => {
    if (!subscription?.trialEndDate && !subscription?.subscriptionEndDate) return 0;
    const endDate = new Date(subscription.trialEndDate || subscription.subscriptionEndDate);
    const today = new Date();
    const diff = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  };

  const StatCard = ({ icon, label, value, color, onPress }) => (
    <TouchableOpacity
      style={styles.statCard}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={[styles.statIconContainer, { backgroundColor: `${color}20` }]}>
        <MaterialCommunityIcons name={icon} size={24} color={color} />
      </View>
      <Text variant="headlineSmall" style={styles.statValue}>
        {value}
      </Text>
      <Text variant="bodySmall" style={styles.statLabel}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const QuickActionCard = ({ icon, label, description, onPress, color }) => (
    <TouchableOpacity
      style={styles.quickActionCard}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.quickActionIcon, { backgroundColor: `${color}20` }]}>
        <MaterialCommunityIcons name={icon} size={28} color={color} />
      </View>
      <View style={styles.quickActionContent}>
        <Text variant="titleSmall" style={styles.quickActionLabel}>
          {label}
        </Text>
        <Text variant="bodySmall" style={styles.quickActionDesc}>
          {description}
        </Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={24} color="#999" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[OWNER_COLOR]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text variant="titleLarge" style={styles.greeting}>
              Welcome back,
            </Text>
            <Text variant="headlineSmall" style={styles.userName}>
              {user?.name || "Owner"}
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
            <TouchableOpacity onPress={() => navigation.navigate("Settings")}>
              <Avatar.Text
                size={48}
                label={user?.name?.charAt(0)?.toUpperCase() || "O"}
                style={{ backgroundColor: OWNER_COLOR }}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* UPI Warning Banner */}
        {!company?.paymentConfig?.upiEnabled && (
          <TouchableOpacity
            style={styles.warningBanner}
            onPress={() => navigation.navigate("PaymentSettings")}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="alert-circle" size={24} color="#E65100" />
            <View style={styles.warningContent}>
              <Text variant="titleSmall" style={styles.warningTitle}>
                Configure UPI to receive advance payments
              </Text>
              <Text variant="bodySmall" style={styles.warningSubtext}>
                Tap to set up payment settings
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color="#E65100" />
          </TouchableOpacity>
        )}

        {/* Company Card */}
        <Surface style={styles.companyCard} elevation={2}>
          <View style={styles.companyHeader}>
            <View style={styles.companyInfo}>
              <Text variant="titleMedium" style={styles.companyName}>
                {company?.name || "Your Company"}
              </Text>
              <Chip
                mode="flat"
                style={[
                  styles.statusChip,
                  { backgroundColor: `${getSubscriptionStatusColor()}20` },
                ]}
                textStyle={{ color: getSubscriptionStatusColor(), fontSize: 12 }}
              >
                {getSubscriptionStatusText()}
              </Chip>
            </View>
            {subscription?.status === "trial" && (
              <View style={styles.trialInfo}>
                <Text variant="bodySmall" style={styles.trialDays}>
                  {getDaysRemaining()} days left
                </Text>
              </View>
            )}
          </View>
        </Surface>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <StatCard
            icon="currency-inr"
            label="Revenue"
            value={`₹${liveStats.totalRevenue.toLocaleString()}`}
            color="#4CAF50"
            onPress={() => navigation.navigate("OwnerAnalyticsDashboard")}
          />
          <StatCard
            icon="calendar-check"
            label="Bookings"
            value={liveStats.totalBookings}
            color="#2196F3"
            onPress={() => navigation.navigate("OwnerAnalyticsDashboard")}
          />
          <StatCard
            icon="soccer-field"
            label="Turfs"
            value={liveStats.totalTurfs || turfs.length || 0}
            color={OWNER_COLOR}
            onPress={() => navigation.navigate("Turfs")}
          />
          <StatCard
            icon="account-group"
            label="Team"
            value={(managers?.length || 0) + (caretakers?.length || 0)}
            color="#FF9800"
            onPress={() => navigation.navigate("Team")}
          />
        </View>

        {/* Pending Actions */}
        {(pendingActions.unassignedCaretakers > 0 ||
          pendingActions.bookingRequests > 0) && (
          <Surface style={styles.alertCard} elevation={1}>
            <View style={styles.alertHeader}>
              <MaterialCommunityIcons
                name="alert-circle"
                size={24}
                color="#FF9800"
              />
              <Text variant="titleSmall" style={styles.alertTitle}>
                Pending Actions
              </Text>
            </View>
            {pendingActions.unassignedCaretakers > 0 && (
              <View style={styles.alertItem}>
                <Text variant="bodyMedium">
                  {pendingActions.unassignedCaretakers} unassigned caretaker(s)
                </Text>
                <Button
                  mode="text"
                  compact
                  onPress={() => navigation.navigate("Team")}
                >
                  Assign
                </Button>
              </View>
            )}
            {pendingActions.bookingRequests > 0 && (
              <View style={styles.alertItem}>
                <Text variant="bodyMedium">
                  {pendingActions.bookingRequests} pending booking(s)
                </Text>
                <Button mode="text" compact>
                  Review
                </Button>
              </View>
            )}
          </Surface>
        )}

        {/* Pending Turf Requests */}
        {pendingTurfRequests.length > 0 && (
          <Surface style={styles.turfRequestsCard} elevation={1}>
            <TouchableOpacity
              onPress={() => navigation.navigate("PendingTurfRequests")}
              activeOpacity={0.7}
            >
              <View style={styles.turfRequestsHeader}>
                <View style={styles.turfRequestsIconContainer}>
                  <MaterialCommunityIcons name="soccer-field" size={24} color={OWNER_COLOR} />
                </View>
                <View style={styles.turfRequestsInfo}>
                  <Text variant="titleSmall" style={styles.turfRequestsTitle}>
                    Pending Turf Requests ({pendingTurfRequests.length})
                  </Text>
                  <Text variant="bodySmall" style={styles.turfRequestsSubtext}>
                    Managers have requested new turfs
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={24} color="#999" />
              </View>
              {pendingTurfRequests.slice(0, 2).map((req) => (
                <View key={req.id} style={styles.turfRequestPreview}>
                  <Text variant="bodyMedium" style={styles.turfRequestName} numberOfLines={1}>
                    {req.turfName || req.turfData?.name || "Unnamed"}
                  </Text>
                  <Text variant="bodySmall" style={styles.turfRequestMeta}>
                    by {req.requestedByName || "Manager"} · {req.turfData?.location?.city || ""}
                  </Text>
                </View>
              ))}
              {pendingTurfRequests.length > 2 && (
                <Text variant="bodySmall" style={styles.turfRequestMore}>
                  +{pendingTurfRequests.length - 2} more
                </Text>
              )}
            </TouchableOpacity>
          </Surface>
        )}

        {/* Quick Actions */}
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Quick Actions
        </Text>

        <QuickActionCard
          icon="plus-circle"
          label="Add New Turf"
          description="Create a new turf location"
          color={OWNER_COLOR}
          onPress={() => navigation.navigate("Turfs", { action: "add" })}
        />

        <QuickActionCard
          icon="account-plus"
          label="Invite Team Member"
          description="Share invite code with managers & caretakers"
          color="#2196F3"
          onPress={() => navigation.navigate("Settings", { screen: "InviteCode" })}
        />

        <QuickActionCard
          icon="chart-line"
          label="View Analytics"
          description="Company-wide performance reports"
          color="#4CAF50"
          onPress={() => navigation.navigate("OwnerAnalyticsDashboard")}
        />

        <QuickActionCard
          icon="cash-register"
          label="Track Expenses"
          description="View & manage company-wide expenses"
          color="#F44336"
          onPress={() => navigation.navigate("ExpenseTracking")}
        />

        <QuickActionCard
          icon="star-outline"
          label="Manage Reviews"
          description="View & moderate customer reviews"
          color="#FFC107"
          onPress={() => navigation.navigate("ReviewManagement")}
        />

        <QuickActionCard
          icon="file-document-check-outline"
          label="Turf Requests"
          description="Review manager turf requests"
          color="#00BCD4"
          onPress={() => navigation.navigate("PendingTurfRequests")}
        />

        <QuickActionCard
          icon="credit-card"
          label="Manage Subscription"
          description="View plan & payment history"
          color="#FF9800"
          onPress={() => navigation.navigate("Settings", { screen: "Subscription" })}
        />

        {/* Empty State for No Turfs */}
        {(!turfs || turfs.length === 0) && (
          <Surface style={styles.emptyCard} elevation={1}>
            <MaterialCommunityIcons
              name="soccer-field"
              size={48}
              color="#ccc"
            />
            <Text variant="titleMedium" style={styles.emptyTitle}>
              No Turfs Yet
            </Text>
            <Text variant="bodyMedium" style={styles.emptyText}>
              Add your first turf to start accepting bookings
            </Text>
            <Button
              mode="contained"
              onPress={() => navigation.navigate("Turfs", { action: "add" })}
              style={styles.emptyButton}
              buttonColor={OWNER_COLOR}
            >
              Add First Turf
            </Button>
          </Surface>
        )}
      </ScrollView>

      {/* Operations Mode FAB */}
      {user?.hasOperationalPermissions && (
        <FAB
          icon="briefcase-clock"
          label="Operations"
          style={styles.fab}
          color="#fff"
          customSize={52}
          onPress={() => navigation.navigate("OperationsMode")}
        />
      )}
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
  warningBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF3E0",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#FFE0B2",
  },
  warningContent: {
    flex: 1,
    marginLeft: 12,
  },
  warningTitle: {
    fontWeight: "600",
    color: "#E65100",
  },
  warningSubtext: {
    color: "#F57C00",
    marginTop: 2,
  },
  companyCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#fff",
    marginBottom: 16,
  },
  companyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  companyInfo: {
    flex: 1,
  },
  companyName: {
    fontWeight: "bold",
    marginBottom: 8,
  },
  statusChip: {
    alignSelf: "flex-start",
  },
  trialInfo: {
    alignItems: "flex-end",
  },
  trialDays: {
    color: "#FF9800",
    fontWeight: "600",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -6,
    marginBottom: 16,
  },
  statCard: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    margin: 4,
    alignItems: "center",
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  statValue: {
    fontWeight: "bold",
    color: "#333",
  },
  statLabel: {
    color: "#666",
    marginTop: 4,
  },
  alertCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#FFF3E0",
    marginBottom: 16,
  },
  alertHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  alertTitle: {
    marginLeft: 8,
    fontWeight: "600",
    color: "#E65100",
  },
  alertItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  sectionTitle: {
    fontWeight: "bold",
    marginBottom: 12,
    marginTop: 8,
  },
  quickActionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  quickActionContent: {
    flex: 1,
    marginLeft: 12,
  },
  quickActionLabel: {
    fontWeight: "600",
  },
  quickActionDesc: {
    color: "#666",
    marginTop: 2,
  },
  turfRequestsCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#F3E5F5",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E1BEE7",
  },
  turfRequestsHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  turfRequestsIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E1BEE7",
    justifyContent: "center",
    alignItems: "center",
  },
  turfRequestsInfo: {
    flex: 1,
    marginLeft: 12,
  },
  turfRequestsTitle: {
    fontWeight: "bold",
    color: OWNER_COLOR,
  },
  turfRequestsSubtext: {
    color: "#7B1FA2",
    marginTop: 1,
  },
  turfRequestPreview: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  turfRequestName: {
    fontWeight: "600",
  },
  turfRequestMeta: {
    color: "#666",
    marginTop: 2,
  },
  turfRequestMore: {
    color: OWNER_COLOR,
    fontWeight: "600",
    marginTop: 8,
    textAlign: "center",
  },
  emptyCard: {
    padding: 32,
    borderRadius: 16,
    backgroundColor: "#fff",
    alignItems: "center",
    marginTop: 16,
  },
  emptyTitle: {
    fontWeight: "bold",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    color: "#666",
    textAlign: "center",
    marginBottom: 16,
  },
  emptyButton: {
    borderRadius: 8,
  },
  fab: {
    position: "absolute",
    right: 16,
    bottom: 16,
    backgroundColor: "#00796B",
    borderRadius: 28,
  },
});
