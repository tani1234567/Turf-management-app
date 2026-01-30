import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { Text, Surface, Button, Avatar, Chip } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSelector, useDispatch } from "react-redux";
import { selectUser } from "../../store/slices/authSlice";
import { selectCompany, selectSubscription } from "../../store/slices/companySlice";
import { selectTurfs, selectPendingActions } from "../../store/slices/ownerSlice";

const OWNER_COLOR = "#9C27B0";

export default function OwnerDashboardScreen({ navigation }) {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const company = useSelector(selectCompany);
  const subscription = useSelector(selectSubscription);
  const turfs = useSelector(selectTurfs);
  const pendingActions = useSelector(selectPendingActions);

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    // TODO: Fetch fresh data from Firestore
    setTimeout(() => setRefreshing(false), 1000);
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
          <TouchableOpacity onPress={() => navigation.navigate("Settings")}>
            <Avatar.Text
              size={48}
              label={user?.name?.charAt(0)?.toUpperCase() || "O"}
              style={{ backgroundColor: OWNER_COLOR }}
            />
          </TouchableOpacity>
        </View>

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
            value={`₹${company?.stats?.totalRevenue?.toLocaleString() || 0}`}
            color="#4CAF50"
          />
          <StatCard
            icon="calendar-check"
            label="Bookings"
            value={company?.stats?.totalBookings || 0}
            color="#2196F3"
          />
          <StatCard
            icon="soccer-field"
            label="Turfs"
            value={company?.stats?.totalTurfs || turfs.length || 0}
            color={OWNER_COLOR}
            onPress={() => navigation.navigate("Turfs")}
          />
          <StatCard
            icon="account-group"
            label="Team"
            value={
              (company?.managers?.length || 0) +
              (company?.caretakers?.length || 0)
            }
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
          onPress={() => {}}
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
});
