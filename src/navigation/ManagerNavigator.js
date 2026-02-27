import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";
import { MaterialCommunityIcons } from "@expo/vector-icons";

// Import tab screens
import ManagerDashboardScreen from "../screens/manager/ManagerDashboardScreen";
import BookingManagementScreen from "../screens/manager/BookingManagementScreen";
import CalendarScreen from "../screens/manager/CalendarScreen";
import ManagerChatListScreen from "../screens/manager/ManagerChatListScreen";
import SettingsScreen from "../screens/manager/SettingsScreen";

// Import stack screens
import CaretakerAssignmentScreen from "../screens/manager/CaretakerAssignmentScreen";
import ManagerCaretakerScreen from "../screens/manager/ManagerCaretakerScreen";
import TurfSelectionScreen from "../screens/manager/TurfSelectionScreen";
import CreateBookingScreen from "../screens/manager/CreateBookingScreen";
import BlockSlotsScreen from "../screens/manager/BlockSlotsScreen";
import ManagerChatScreen from "../screens/manager/ManagerChatScreen";
import AdvancePaymentSettingsScreen from "../screens/manager/AdvancePaymentSettingsScreen";
import VerifyPaymentScreen from "../screens/manager/VerifyPaymentScreen";
import AnalyticsDashboardScreen from "../screens/manager/AnalyticsDashboardScreen";
import ExpenseTrackingScreen from "../screens/manager/ExpenseTrackingScreen";
import ReviewManagementScreen from "../screens/manager/ReviewManagementScreen";
import AcademyManagementScreen from "../screens/manager/AcademyManagementScreen";
import TurfRequestScreen from "../screens/manager/TurfRequestScreen";
import TurfRequestsListScreen from "../screens/manager/TurfRequestsListScreen";
import EditTurfScreen from "../screens/owner/EditTurfScreen";
import NotificationsScreen from "../screens/common/NotificationsScreen";

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function ManagerTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#2196F3",
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
        component={ManagerDashboardScreen}
        options={{
          tabBarLabel: "Dashboard",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="view-dashboard" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ManagerBookings"
        component={BookingManagementScreen}
        options={{
          tabBarLabel: "Bookings",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="calendar-text" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Calendar"
        component={CalendarScreen}
        options={{
          tabBarLabel: "Calendar",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="calendar-month" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ManagerChatList"
        component={ManagerChatListScreen}
        options={{
          tabBarLabel: "Chat",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="chat" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: "Settings",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="cog" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function ManagerNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="ManagerTabs" component={ManagerTabs} />
      <Stack.Screen
        name="CaretakerAssignment"
        component={CaretakerAssignmentScreen}
        options={{
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="ManagerCaretakers"
        component={ManagerCaretakerScreen}
        options={{
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="TurfSelection"
        component={TurfSelectionScreen}
        options={{
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="CreateBooking"
        component={CreateBookingScreen}
        options={{
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="BlockSlots"
        component={BlockSlotsScreen}
        options={{
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="ManagerChatScreen"
        component={ManagerChatScreen}
        options={{
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="AdvancePaymentSettings"
        component={AdvancePaymentSettingsScreen}
        options={{
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="VerifyPayment"
        component={VerifyPaymentScreen}
        options={{
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="AnalyticsDashboard"
        component={AnalyticsDashboardScreen}
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
        name="AcademyManagement"
        component={AcademyManagementScreen}
        options={{
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="TurfRequest"
        component={TurfRequestScreen}
        options={{
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="TurfRequestsList"
        component={TurfRequestsListScreen}
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
        name="Notifications"
        component={NotificationsScreen}
        options={{
          presentation: "card",
        }}
      />
    </Stack.Navigator>
  );
}
