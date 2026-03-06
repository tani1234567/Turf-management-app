import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { Text, Surface, Badge, FAB } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSelector, useDispatch } from "react-redux";
import { selectUser } from "../../store/slices/authSlice";
import { selectCompany, selectSubscription, selectManagers, selectCaretakers } from "../../store/slices/companySlice";
import { selectTurfs, selectPendingActions, setTurfs } from "../../store/slices/ownerSlice";
import { queryDocuments } from "../../services/firebase/firestore";
import { useNotifications } from "../../hooks";

const OWNER_PURPLE = "#9C27B0";
const OWNER_DARK   = "#7B1FA2";
const PALE_PURPLE  = "#F3E5F5";
const NAVY_PURPLE  = "#4A148C";
const SUCCESS_GREEN = "#22C55E";
const WARN_ORANGE  = "#F59E0B";
const DANGER_RED   = "#EF4444";

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

  useEffect(() => {
    fetchLiveStats();
  }, [company]);

  const fetchLiveStats = useCallback(async () => {
    const companyId = company?.id || company?.companyId;
    if (!companyId) return;

    try {
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
      case "trial":       return WARN_ORANGE;
      case "active":      return SUCCESS_GREEN;
      case "expired":     return DANGER_RED;
      case "grace_period":return "#F97316";
      default:            return "#9CA3AF";
    }
  };

  const getSubscriptionStatusText = () => {
    switch (subscription?.status) {
      case "trial":        return "Trial";
      case "active":       return "Active";
      case "expired":      return "Expired";
      case "grace_period": return "Grace Period";
      default:             return "Unknown";
    }
  };

  const getDaysRemaining = () => {
    if (!subscription?.trialEndDate && !subscription?.subscriptionEndDate) return 0;
    const endDate = new Date(subscription.trialEndDate || subscription.subscriptionEndDate);
    const today = new Date();
    const diff = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  };

  // KPI cards config
  const kpiCards = [
    {
      id: "revenue",
      label: "Total Revenue",
      value: `₹${liveStats.totalRevenue >= 1000 ? (liveStats.totalRevenue / 1000).toFixed(1) + "K" : liveStats.totalRevenue.toLocaleString()}`,
      icon: "currency-inr",
      color: SUCCESS_GREEN,
      onPress: () => navigation.navigate("OwnerAnalyticsDashboard"),
    },
    {
      id: "bookings",
      label: "Bookings",
      value: String(liveStats.totalBookings),
      icon: "calendar-check",
      color: "#3B82F6",
      onPress: () => navigation.navigate("OwnerAnalyticsDashboard"),
    },
    {
      id: "turfs",
      label: "Turfs",
      value: String(liveStats.totalTurfs || turfs.length || 0),
      icon: "soccer-field",
      color: OWNER_PURPLE,
      onPress: () => navigation.navigate("Turfs"),
    },
    {
      id: "team",
      label: "Team",
      value: String((managers?.length || 0) + (caretakers?.length || 0)),
      icon: "account-group",
      color: WARN_ORANGE,
      onPress: () => navigation.navigate("Team"),
    },
  ];

  // Quick actions grid
  const quickActions = [
    { id: "addTurf",    icon: "plus-circle",             label: "Add Turf",     color: OWNER_PURPLE,   onPress: () => navigation.navigate("Turfs", { action: "add" }) },
    { id: "invite",     icon: "account-plus",            label: "Invite",       color: "#3B82F6",      onPress: () => navigation.navigate("Settings", { screen: "InviteCode" }) },
    { id: "analytics",  icon: "chart-line",              label: "Analytics",    color: SUCCESS_GREEN,  onPress: () => navigation.navigate("OwnerAnalyticsDashboard") },
    { id: "expenses",   icon: "cash-register",           label: "Expenses",     color: DANGER_RED,     onPress: () => navigation.navigate("ExpenseTracking") },
    { id: "reviews",    icon: "star-outline",            label: "Reviews",      color: "#F59E0B",      onPress: () => navigation.navigate("ReviewManagement") },
    { id: "requests",   icon: "file-document-check-outline", label: "Requests", color: "#00BCD4",      onPress: () => navigation.navigate("PendingTurfRequests") },
    { id: "sub",        icon: "credit-card",             label: "Subscription", color: "#F97316",      onPress: () => navigation.navigate("SubscriptionPayment") },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[OWNER_PURPLE]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>Good day,</Text>
            <Text style={styles.userName}>{user?.name || "Owner"}</Text>
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
            <TouchableOpacity
              onPress={() => navigation.navigate("Settings")}
              style={styles.avatarBtn}
            >
              <MaterialCommunityIcons name="briefcase-account" size={22} color={OWNER_PURPLE} />
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
            <MaterialCommunityIcons name="alert-circle" size={20} color="#92400E" />
            <View style={styles.warningContent}>
              <Text style={styles.warningTitle}>Configure UPI to receive advance payments</Text>
              <Text style={styles.warningSubtext}>Tap to set up payment settings</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#92400E" />
          </TouchableOpacity>
        )}

        {/* Company Card */}
        <Surface style={styles.companyCard} elevation={2}>
          <View style={styles.companyCardInner}>
            <View style={styles.companyInfo}>
              <Text style={styles.companyName}>{company?.name || "Your Company"}</Text>
              {subscription?.status === "trial" && (
                <Text style={styles.trialDays}>{getDaysRemaining()} days left in trial</Text>
              )}
            </View>
            <View style={[styles.subPill, { backgroundColor: `${getSubscriptionStatusColor()}20` }]}>
              <Text style={[styles.subPillText, { color: getSubscriptionStatusColor() }]}>
                {getSubscriptionStatusText()}
              </Text>
            </View>
          </View>
        </Surface>

        {/* KPI Grid */}
        <View style={styles.kpiGrid}>
          {kpiCards.map((kpi) => (
            <TouchableOpacity
              key={kpi.id}
              style={styles.kpiCard}
              onPress={kpi.onPress}
              activeOpacity={0.7}
            >
              <View style={[styles.kpiAccentBar, { backgroundColor: kpi.color }]} />
              <View style={styles.kpiBody}>
                <View style={[styles.kpiIconContainer, { backgroundColor: `${kpi.color}18` }]}>
                  <MaterialCommunityIcons name={kpi.icon} size={18} color={kpi.color} />
                </View>
                <Text style={[styles.kpiValue, { color: kpi.color }]}>{kpi.value}</Text>
                <Text style={styles.kpiLabel}>{kpi.label}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Pending Actions */}
        {(pendingActions.unassignedCaretakers > 0 || pendingActions.bookingRequests > 0) && (
          <Surface style={styles.alertCard} elevation={1}>
            <View style={styles.alertAccent} />
            <View style={styles.alertBody}>
              <View style={styles.alertHeader}>
                <MaterialCommunityIcons name="alert-circle" size={20} color={WARN_ORANGE} />
                <Text style={styles.alertTitle}>Pending Actions</Text>
              </View>
              {pendingActions.unassignedCaretakers > 0 && (
                <View style={styles.alertRow}>
                  <Text style={styles.alertText}>
                    {pendingActions.unassignedCaretakers} unassigned caretaker(s)
                  </Text>
                  <TouchableOpacity onPress={() => navigation.navigate("Team")}>
                    <Text style={styles.alertAction}>Assign</Text>
                  </TouchableOpacity>
                </View>
              )}
              {pendingActions.bookingRequests > 0 && (
                <View style={styles.alertRow}>
                  <Text style={styles.alertText}>
                    {pendingActions.bookingRequests} pending booking(s)
                  </Text>
                  <TouchableOpacity>
                    <Text style={styles.alertAction}>Review</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </Surface>
        )}

        {/* Pending Turf Requests */}
        {pendingTurfRequests.length > 0 && (
          <TouchableOpacity
            style={styles.turfRequestsCard}
            onPress={() => navigation.navigate("PendingTurfRequests")}
            activeOpacity={0.7}
          >
            <View style={styles.turfRequestsAccent} />
            <View style={styles.turfRequestsBody}>
              <View style={styles.turfRequestsHeader}>
                <View style={styles.turfRequestsIconWrap}>
                  <MaterialCommunityIcons name="soccer-field" size={20} color={OWNER_PURPLE} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.turfRequestsTitle}>
                    Pending Turf Requests ({pendingTurfRequests.length})
                  </Text>
                  <Text style={styles.turfRequestsSubtext}>Managers have requested new turfs</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color="#9CA3AF" />
              </View>
              {pendingTurfRequests.slice(0, 2).map((req) => (
                <View key={req.id} style={styles.turfRequestPreview}>
                  <Text style={styles.turfRequestName} numberOfLines={1}>
                    {req.turfName || req.turfData?.name || "Unnamed"}
                  </Text>
                  <Text style={styles.turfRequestMeta}>
                    by {req.requestedByName || "Manager"} · {req.turfData?.location?.city || ""}
                  </Text>
                </View>
              ))}
              {pendingTurfRequests.length > 2 && (
                <Text style={styles.turfRequestMore}>+{pendingTurfRequests.length - 2} more</Text>
              )}
            </View>
          </TouchableOpacity>
        )}

        {/* Quick Actions */}
        <View style={styles.sectionTitleRow}>
          <View style={styles.sectionTitleAccent} />
          <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
        </View>

        <View style={styles.actionsGrid}>
          {quickActions.map((action) => (
            <TouchableOpacity
              key={action.id}
              style={styles.actionItem}
              onPress={action.onPress}
              activeOpacity={0.7}
            >
              <Surface style={styles.actionIconContainer} elevation={1}>
                <View style={[styles.actionIconCircle, { backgroundColor: `${action.color}18` }]}>
                  <MaterialCommunityIcons name={action.icon} size={24} color={action.color} />
                </View>
              </Surface>
              <Text style={styles.actionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Empty State for No Turfs */}
        {(!turfs || turfs.length === 0) && (
          <Surface style={styles.emptyCard} elevation={1}>
            <View style={[styles.emptyIconCircle, { backgroundColor: PALE_PURPLE }]}>
              <MaterialCommunityIcons name="soccer-field" size={40} color={OWNER_PURPLE} />
            </View>
            <Text style={styles.emptyTitle}>No Turfs Yet</Text>
            <Text style={styles.emptyText}>Add your first turf to start accepting bookings</Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => navigation.navigate("Turfs", { action: "add" })}
            >
              <Text style={styles.emptyButtonText}>Add First Turf</Text>
            </TouchableOpacity>
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
    backgroundColor: "#F5F0FF",
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
    marginBottom: 16,
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 14,
    color: "#6B7280",
  },
  userName: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 20,
    color: NAVY_PURPLE,
    letterSpacing: -0.3,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  notifBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: DANGER_RED,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 3,
  },
  notifBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontFamily: "Ubuntu-Bold",
  },
  avatarBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: PALE_PURPLE,
    borderWidth: 2,
    borderColor: `${OWNER_PURPLE}40`,
    justifyContent: "center",
    alignItems: "center",
  },

  // Warning Banner
  warningBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFBEB",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: WARN_ORANGE,
    gap: 10,
  },
  warningContent: {
    flex: 1,
  },
  warningTitle: {
    fontFamily: "Ubuntu-Medium",
    fontSize: 13,
    color: "#92400E",
  },
  warningSubtext: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 12,
    color: "#B45309",
    marginTop: 2,
  },

  // Company Card
  companyCard: {
    borderRadius: 14,
    backgroundColor: "#fff",
    marginBottom: 16,
    overflow: "hidden",
    borderLeftWidth: 4,
    borderLeftColor: OWNER_PURPLE,
  },
  companyCardInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
  },
  companyInfo: {
    flex: 1,
  },
  companyName: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 15,
    color: "#111827",
  },
  trialDays: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 12,
    color: WARN_ORANGE,
    marginTop: 2,
  },
  subPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  subPillText: {
    fontFamily: "Ubuntu-Medium",
    fontSize: 12,
  },

  // KPI Grid
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -5,
    marginBottom: 16,
  },
  kpiCard: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 14,
    margin: "1%",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  kpiAccentBar: {
    height: 4,
    width: "100%",
  },
  kpiBody: {
    padding: 14,
    alignItems: "flex-start",
  },
  kpiIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  kpiValue: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 22,
    lineHeight: 26,
  },
  kpiLabel: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 12,
    color: "#6B7280",
    marginTop: 3,
  },

  // Alert Card (Pending Actions)
  alertCard: {
    borderRadius: 14,
    backgroundColor: "#fff",
    marginBottom: 16,
    flexDirection: "row",
    overflow: "hidden",
  },
  alertAccent: {
    width: 4,
    backgroundColor: WARN_ORANGE,
  },
  alertBody: {
    flex: 1,
    padding: 14,
  },
  alertHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  alertTitle: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 14,
    color: "#92400E",
  },
  alertRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  alertText: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 13,
    color: "#374151",
  },
  alertAction: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 13,
    color: OWNER_PURPLE,
  },

  // Turf Requests Card
  turfRequestsCard: {
    borderRadius: 14,
    backgroundColor: "#fff",
    marginBottom: 16,
    flexDirection: "row",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  turfRequestsAccent: {
    width: 4,
    backgroundColor: OWNER_PURPLE,
  },
  turfRequestsBody: {
    flex: 1,
    padding: 14,
  },
  turfRequestsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  turfRequestsIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: PALE_PURPLE,
    justifyContent: "center",
    alignItems: "center",
  },
  turfRequestsTitle: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 14,
    color: NAVY_PURPLE,
  },
  turfRequestsSubtext: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 12,
    color: "#6B7280",
    marginTop: 1,
  },
  turfRequestPreview: {
    backgroundColor: "#F9F5FF",
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  turfRequestName: {
    fontFamily: "Ubuntu-Medium",
    fontSize: 13,
    color: "#111827",
  },
  turfRequestMeta: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  turfRequestMore: {
    fontFamily: "Ubuntu-Medium",
    fontSize: 12,
    color: OWNER_PURPLE,
    marginTop: 8,
    textAlign: "center",
  },

  // Section header
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    marginTop: 4,
    gap: 8,
  },
  sectionTitleAccent: {
    width: 3,
    height: 14,
    borderRadius: 2,
    backgroundColor: OWNER_PURPLE,
  },
  sectionTitle: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 11,
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  // Quick Actions Grid
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
    marginBottom: 20,
  },
  actionItem: {
    width: "31%",
    margin: "1%",
    alignItems: "center",
    marginBottom: 12,
  },
  actionIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  actionIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  actionLabel: {
    fontFamily: "Ubuntu-Medium",
    fontSize: 11,
    color: "#374151",
    textAlign: "center",
  },

  // Empty Card
  emptyCard: {
    padding: 32,
    borderRadius: 16,
    backgroundColor: "#fff",
    alignItems: "center",
    marginTop: 8,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 16,
    color: "#111827",
    marginBottom: 6,
  },
  emptyText: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 20,
  },
  emptyButton: {
    backgroundColor: OWNER_PURPLE,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
  },
  emptyButtonText: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 14,
    color: "#fff",
  },

  fab: {
    position: "absolute",
    right: 16,
    bottom: 16,
    backgroundColor: "#00796B",
    borderRadius: 28,
  },
});
