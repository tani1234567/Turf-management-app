import React from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { Text, Surface } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

// ── Tab Screens ──────────────────────────────────────────────
import AdminDashboardScreen from "../screens/admin/AdminDashboardScreen";
import CompanyListScreen from "../screens/admin/CompanyListScreen";
import UserListScreen from "../screens/admin/UserListScreen";
import BookingListScreen from "../screens/admin/BookingListScreen";

// ── Stack Screens — Companies ────────────────────────────────
import CompanyDetailScreen from "../screens/admin/CompanyDetailScreen";

// ── Stack Screens — Users ────────────────────────────────────
import UserDetailScreen from "../screens/admin/UserDetailScreen";

// ── Stack Screens — Bookings ─────────────────────────────────
import BookingDetailScreen from "../screens/admin/BookingDetailScreen";

// ── Stack Screens — Payments ─────────────────────────────────
import PaymentVerificationQueueScreen from "../screens/admin/PaymentVerificationQueueScreen";
import RefundTrackerScreen from "../screens/admin/RefundTrackerScreen";
import FraudDashboardScreen from "../screens/admin/FraudDashboardScreen";

// ── Stack Screens — Subscriptions ────────────────────────────
import SubscriptionListScreen from "../screens/admin/SubscriptionListScreen";
import SubscriptionDetailScreen from "../screens/admin/SubscriptionDetailScreen";
import ManualSubscriptionScreen from "../screens/admin/ManualSubscriptionScreen";

// ── Stack Screens — Support & Disputes ───────────────────────
import SupportTicketListScreen from "../screens/admin/SupportTicketListScreen";
import SupportTicketDetailScreen from "../screens/admin/SupportTicketDetailScreen";
import DisputeListScreen from "../screens/admin/DisputeListScreen";
import DisputeDetailScreen from "../screens/admin/DisputeDetailScreen";

// ── Stack Screens — Content Moderation ───────────────────────
import ReviewModerationScreen from "../screens/admin/ReviewModerationScreen";

// ── Stack Screens — System Monitoring ────────────────────────
import SystemHealthScreen from "../screens/admin/SystemHealthScreen";
import ErrorLogsScreen from "../screens/admin/ErrorLogsScreen";
import CostTrackerScreen from "../screens/admin/CostTrackerScreen";

// ── Stack Screens — Analytics ────────────────────────────────
import PlatformAnalyticsScreen from "../screens/admin/PlatformAnalyticsScreen";
import ReportsScreen from "../screens/admin/ReportsScreen";

// ── Stack Screens — Platform Config ──────────────────────────
import PricingConfigScreen from "../screens/admin/PricingConfigScreen";
import BookingConfigScreen from "../screens/admin/BookingConfigScreen";
import NotificationTemplatesScreen from "../screens/admin/NotificationTemplatesScreen";
import FeatureFlagsScreen from "../screens/admin/FeatureFlagsScreen";

// ── Stack Screens — Admin & Audit ────────────────────────────
import AdminManagementScreen from "../screens/admin/AdminManagementScreen";
import AuditLogScreen from "../screens/admin/AuditLogScreen";
import BulkOperationsScreen from "../screens/admin/BulkOperationsScreen";

// ── Common ───────────────────────────────────────────────────
import NotificationsScreen from "../screens/common/NotificationsScreen";

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const ADMIN_COLOR = "#F44336";

// ─────────────────────────────────────────────────────────────
// "More" hub tab — links to all non-tab sections
// ─────────────────────────────────────────────────────────────
function AdminMoreScreen() {
  const navigation = useNavigation();

  const sections = [
    {
      title: "Payment Management",
      items: [
        {
          label: "Verification Queue",
          icon: "credit-card-check",
          route: "PaymentVerificationQueue",
          priority: "P0",
        },
        {
          label: "Refund Tracker",
          icon: "cash-refund",
          route: "RefundTracker",
          priority: "P0",
        },
        {
          label: "Fraud Detection",
          icon: "shield-alert",
          route: "FraudDashboard",
          priority: "P1",
        },
      ],
    },
    {
      title: "Subscriptions",
      items: [
        {
          label: "Subscription List",
          icon: "card-account-details",
          route: "SubscriptionList",
          priority: "P0",
        },
        {
          label: "Manual Subscription",
          icon: "pencil-plus",
          route: "ManualSubscription",
          priority: "P0",
        },
      ],
    },
    {
      title: "Support & Disputes",
      items: [
        {
          label: "Support Tickets",
          icon: "lifebuoy",
          route: "SupportTicketList",
          priority: "P1",
        },
        {
          label: "Booking Disputes",
          icon: "scale-balance",
          route: "DisputeList",
          priority: "P1",
        },
      ],
    },
    {
      title: "Content Moderation",
      items: [
        {
          label: "Review Moderation",
          icon: "star-check",
          route: "ReviewModeration",
          priority: "P1",
        },
      ],
    },
    {
      title: "Analytics & Reports",
      items: [
        {
          label: "Platform Analytics",
          icon: "chart-line",
          route: "PlatformAnalytics",
          priority: "P2",
        },
        {
          label: "Reports",
          icon: "file-chart",
          route: "Reports",
          priority: "P2",
        },
      ],
    },
    {
      title: "System Monitoring",
      items: [
        {
          label: "System Health",
          icon: "server",
          route: "SystemHealth",
          priority: "P2",
        },
        {
          label: "Error Logs",
          icon: "bug",
          route: "ErrorLogs",
          priority: "P2",
        },
        {
          label: "Cost Tracker",
          icon: "currency-inr",
          route: "CostTracker",
          priority: "P2",
        },
      ],
    },
    {
      title: "Platform Configuration",
      items: [
        {
          label: "Pricing Config",
          icon: "tag-multiple",
          route: "PricingConfig",
          priority: "P2",
        },
        {
          label: "Booking Config",
          icon: "cog",
          route: "BookingConfig",
          priority: "P2",
        },
        {
          label: "Notification Templates",
          icon: "bell-cog",
          route: "NotificationTemplates",
          priority: "P2",
        },
        {
          label: "Feature Flags",
          icon: "toggle-switch",
          route: "FeatureFlags",
          priority: "P2",
        },
      ],
    },
    {
      title: "Administration",
      items: [
        {
          label: "Admin Management",
          icon: "shield-account",
          route: "AdminManagement",
          priority: "P2",
        },
        {
          label: "Audit Trail",
          icon: "history",
          route: "AuditLog",
          priority: "P2",
        },
        {
          label: "Bulk Operations",
          icon: "lightning-bolt",
          route: "BulkOperations",
          priority: "P3",
        },
      ],
    },
  ];

  const PRIORITY_COLORS = {
    P0: "#C62828",
    P1: "#E65100",
    P2: "#1565C0",
    P3: "#6A1B9A",
  };

  return (
    <SafeAreaView style={moreStyles.container}>
      <ScrollView contentContainerStyle={moreStyles.scrollContent}>
        <Text variant="headlineSmall" style={moreStyles.title}>
          Admin Panel
        </Text>

        {sections.map((section) => (
          <View key={section.title} style={moreStyles.section}>
            <Text variant="labelLarge" style={moreStyles.sectionTitle}>
              {section.title}
            </Text>
            <Surface style={moreStyles.card} elevation={1}>
              {section.items.map((item, index) => (
                <React.Fragment key={item.route}>
                  <TouchableOpacity
                    style={moreStyles.linkItem}
                    onPress={() => navigation.navigate(item.route)}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons
                      name={item.icon}
                      size={22}
                      color={ADMIN_COLOR}
                    />
                    <Text variant="bodyMedium" style={moreStyles.linkLabel}>
                      {item.label}
                    </Text>
                    <Text
                      style={[
                        moreStyles.priorityTag,
                        { color: PRIORITY_COLORS[item.priority] },
                      ]}
                    >
                      {item.priority}
                    </Text>
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={20}
                      color="#ccc"
                    />
                  </TouchableOpacity>
                  {index < section.items.length - 1 && (
                    <View style={moreStyles.divider} />
                  )}
                </React.Fragment>
              ))}
            </Surface>
          </View>
        ))}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const moreStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  scrollContent: {
    padding: 16,
  },
  title: {
    fontWeight: "bold",
    color: "#333",
    marginBottom: 16,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    color: "#999",
    fontWeight: "600",
    marginBottom: 8,
    marginLeft: 4,
    textTransform: "uppercase",
    fontSize: 11,
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
  },
  linkItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
  },
  linkLabel: {
    flex: 1,
    marginLeft: 14,
    color: "#333",
  },
  priorityTag: {
    fontSize: 10,
    fontWeight: "bold",
    marginRight: 8,
  },
  divider: {
    height: 1,
    backgroundColor: "#f0f0f0",
    marginLeft: 50,
  },
});

// ─────────────────────────────────────────────────────────────
// Tab Navigator — 5 main tabs
// ─────────────────────────────────────────────────────────────
function AdminTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ADMIN_COLOR,
        tabBarInactiveTintColor: "#999",
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopWidth: 1,
          borderTopColor: "#eee",
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: "Ubuntu-Medium",
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={AdminDashboardScreen}
        options={{
          tabBarLabel: "Home",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="view-dashboard"
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Companies"
        component={CompanyListScreen}
        options={{
          tabBarLabel: "Companies",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="domain" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Users"
        component={UserListScreen}
        options={{
          tabBarLabel: "Users",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="account-group"
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Bookings"
        component={BookingListScreen}
        options={{
          tabBarLabel: "Bookings",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="calendar-text"
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="AdminMore"
        component={AdminMoreScreen}
        options={{
          tabBarLabel: "More",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="menu" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// ─────────────────────────────────────────────────────────────
// Stack Navigator — wraps tabs + all detail/sub-screens
// ─────────────────────────────────────────────────────────────
export default function AdminNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      {/* Tab Navigator */}
      <Stack.Screen name="AdminTabs" component={AdminTabs} />

      {/* ── Company Screens ─────────────────────── */}
      <Stack.Screen
        name="CompanyDetail"
        component={CompanyDetailScreen}
        options={{ presentation: "card" }}
      />

      {/* ── User Screens ────────────────────────── */}
      <Stack.Screen
        name="UserDetail"
        component={UserDetailScreen}
        options={{ presentation: "card" }}
      />

      {/* ── Booking Screens ─────────────────────── */}
      <Stack.Screen
        name="BookingDetail"
        component={BookingDetailScreen}
        options={{ presentation: "card" }}
      />

      {/* ── Payment Screens ─────────────────────── */}
      <Stack.Screen
        name="PaymentVerificationQueue"
        component={PaymentVerificationQueueScreen}
        options={{ presentation: "card" }}
      />
      <Stack.Screen
        name="RefundTracker"
        component={RefundTrackerScreen}
        options={{ presentation: "card" }}
      />
      <Stack.Screen
        name="FraudDashboard"
        component={FraudDashboardScreen}
        options={{ presentation: "card" }}
      />

      {/* ── Subscription Screens ────────────────── */}
      <Stack.Screen
        name="SubscriptionList"
        component={SubscriptionListScreen}
        options={{ presentation: "card" }}
      />
      <Stack.Screen
        name="SubscriptionDetail"
        component={SubscriptionDetailScreen}
        options={{ presentation: "card" }}
      />
      <Stack.Screen
        name="ManualSubscription"
        component={ManualSubscriptionScreen}
        options={{ presentation: "card" }}
      />

      {/* ── Support & Dispute Screens ───────────── */}
      <Stack.Screen
        name="SupportTicketList"
        component={SupportTicketListScreen}
        options={{ presentation: "card" }}
      />
      <Stack.Screen
        name="SupportTicketDetail"
        component={SupportTicketDetailScreen}
        options={{ presentation: "card" }}
      />
      <Stack.Screen
        name="DisputeList"
        component={DisputeListScreen}
        options={{ presentation: "card" }}
      />
      <Stack.Screen
        name="DisputeDetail"
        component={DisputeDetailScreen}
        options={{ presentation: "card" }}
      />

      {/* ── Content Moderation ──────────────────── */}
      <Stack.Screen
        name="ReviewModeration"
        component={ReviewModerationScreen}
        options={{ presentation: "card" }}
      />

      {/* ── System Monitoring ───────────────────── */}
      <Stack.Screen
        name="SystemHealth"
        component={SystemHealthScreen}
        options={{ presentation: "card" }}
      />
      <Stack.Screen
        name="ErrorLogs"
        component={ErrorLogsScreen}
        options={{ presentation: "card" }}
      />
      <Stack.Screen
        name="CostTracker"
        component={CostTrackerScreen}
        options={{ presentation: "card" }}
      />

      {/* ── Analytics ───────────────────────────── */}
      <Stack.Screen
        name="PlatformAnalytics"
        component={PlatformAnalyticsScreen}
        options={{ presentation: "card" }}
      />
      <Stack.Screen
        name="Reports"
        component={ReportsScreen}
        options={{ presentation: "card" }}
      />

      {/* ── Platform Configuration ──────────────── */}
      <Stack.Screen
        name="PricingConfig"
        component={PricingConfigScreen}
        options={{ presentation: "card" }}
      />
      <Stack.Screen
        name="BookingConfig"
        component={BookingConfigScreen}
        options={{ presentation: "card" }}
      />
      <Stack.Screen
        name="NotificationTemplates"
        component={NotificationTemplatesScreen}
        options={{ presentation: "card" }}
      />
      <Stack.Screen
        name="FeatureFlags"
        component={FeatureFlagsScreen}
        options={{ presentation: "card" }}
      />

      {/* ── Admin & Audit ───────────────────────── */}
      <Stack.Screen
        name="AdminManagement"
        component={AdminManagementScreen}
        options={{ presentation: "card" }}
      />
      <Stack.Screen
        name="AuditLog"
        component={AuditLogScreen}
        options={{ presentation: "card" }}
      />
      <Stack.Screen
        name="BulkOperations"
        component={BulkOperationsScreen}
        options={{ presentation: "card" }}
      />

      {/* ── Common ──────────────────────────────── */}
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ presentation: "card" }}
      />
    </Stack.Navigator>
  );
}
