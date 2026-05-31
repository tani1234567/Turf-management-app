import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Tab screens
import OwnerDashboardScreen from "../screens/owner/OwnerDashboardScreen";
import TurfManagementScreen from "../screens/owner/TurfManagementScreen";
import TeamManagementScreen from "../screens/owner/TeamManagementScreen";
import OwnerSettingsScreen from "../screens/owner/OwnerSettingsScreen";

// Stack screens
import AddTurfScreen from "../screens/owner/AddTurfScreen";
import EditTurfScreen from "../screens/owner/EditTurfScreen";
import InviteCodeScreen from "../screens/owner/InviteCodeScreen";
import ManagerManagementScreen from "../screens/owner/ManagerManagementScreen";
import CaretakerManagementScreen from "../screens/owner/CaretakerManagementScreen";
import OperationalSettingsScreen from "../screens/owner/OperationalSettingsScreen";
import PaymentSettingsScreen from "../screens/owner/PaymentSettingsScreen";
import SubscriptionPaymentScreen from "../screens/owner/SubscriptionPaymentScreen";
import OwnerAnalyticsDashboardScreen from "../screens/owner/OwnerAnalyticsDashboardScreen";
import ExpenseTrackingScreen from "../screens/owner/ExpenseTrackingScreen";
import ReviewManagementScreen from "../screens/owner/ReviewManagementScreen";
import PendingTurfRequestsScreen from "../screens/owner/PendingTurfRequestsScreen";
import TurfEditLogsScreen from "../screens/owner/TurfEditLogsScreen";
import OperationsModeNavigator from "../navigation/OperationsModeNavigator";
import NotificationsScreen from "../screens/common/NotificationsScreen";
import CustomerPhonebookScreen from "../screens/shared/CustomerPhonebookScreen";
import HolidayScheduleScreen from "../screens/manager/HolidayScheduleScreen";
import CompanyCouponToggleScreen from "../screens/owner/CompanyCouponToggleScreen";

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const OWNER_COLOR = "#9C27B0";

function OwnerTabs() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = 60 + insets.bottom;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: OWNER_COLOR,
        tabBarInactiveTintColor: "#9CA3AF",
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopWidth: 1,
          borderTopColor: "#eee",
          paddingBottom: insets.bottom + 6,
          paddingTop: 8,
          height: tabBarHeight,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 4,
          elevation: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontFamily: "Ubuntu-Medium",
        },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          switch (route.name) {
            case "Dashboard":
              iconName = focused ? "view-dashboard" : "view-dashboard-outline";
              break;
            case "Turfs":
              iconName = focused ? "soccer-field" : "soccer-field";
              break;
            case "Team":
              iconName = focused ? "account-group" : "account-group-outline";
              break;
            case "Settings":
              iconName = focused ? "cog" : "cog-outline";
              break;
            default:
              iconName = "help-circle";
          }

          return (
            <MaterialCommunityIcons name={iconName} size={size} color={color} />
          );
        },
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={OwnerDashboardScreen}
        options={{
          tabBarLabel: "Dashboard",
        }}
      />
      <Tab.Screen
        name="Turfs"
        component={TurfManagementScreen}
        options={{
          tabBarLabel: "Turfs",
        }}
      />
      <Tab.Screen
        name="Team"
        component={TeamManagementScreen}
        options={{
          tabBarLabel: "Team",
        }}
      />
      <Tab.Screen
        name="Settings"
        component={OwnerSettingsScreen}
        options={{
          tabBarLabel: "Settings",
        }}
      />
    </Tab.Navigator>
  );
}

export default function OwnerNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="OwnerTabs" component={OwnerTabs} />
      <Stack.Screen
        name="AddTurf"
        component={AddTurfScreen}
        options={{
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="EditTurf"
        component={EditTurfScreen}
        options={{
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="InviteCode"
        component={InviteCodeScreen}
        options={{
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="ManagerManagement"
        component={ManagerManagementScreen}
        options={{
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="CaretakerManagement"
        component={CaretakerManagementScreen}
        options={{
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="OperationalSettings"
        component={OperationalSettingsScreen}
        options={{
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="PaymentSettings"
        component={PaymentSettingsScreen}
        options={{
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="SubscriptionPayment"
        component={SubscriptionPaymentScreen}
        options={{
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="OwnerAnalyticsDashboard"
        component={OwnerAnalyticsDashboardScreen}
        options={{
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="ExpenseTracking"
        component={ExpenseTrackingScreen}
        options={{
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="ReviewManagement"
        component={ReviewManagementScreen}
        options={{
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="TurfEditLogs"
        component={TurfEditLogsScreen}
        options={{
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="PendingTurfRequests"
        component={PendingTurfRequestsScreen}
        options={{
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="OperationsMode"
        component={OperationsModeNavigator}
        options={{
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ presentation: "card" }}
      />
      <Stack.Screen
        name="CustomerPhonebook"
        component={CustomerPhonebookScreen}
        options={{ presentation: "card" }}
      />
      <Stack.Screen
        name="HolidaySchedule"
        component={HolidayScheduleScreen}
        options={{ presentation: "card" }}
      />
      <Stack.Screen
        name="CompanyCouponToggle"
        component={CompanyCouponToggleScreen}
        options={{ presentation: "card" }}
      />
    </Stack.Navigator>
  );
}
