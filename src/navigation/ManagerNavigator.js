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
          fontWeight: "500",
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
    </Stack.Navigator>
  );
}
