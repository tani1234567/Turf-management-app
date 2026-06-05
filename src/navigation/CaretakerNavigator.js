import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSelector } from "react-redux";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Platform } from "react-native";
import { selectIsCaretakerAssigned } from "../store/slices/authSlice";

// Import screens
import CaretakerDashboardScreen from "../screens/caretaker/CaretakerDashboardScreen";
import CaretakerCalendarScreen from "../screens/caretaker/CaretakerCalendarScreen";
import CaretakerProfileScreen from "../screens/caretaker/CaretakerProfileScreen";
import WaitingForAssignmentScreen from "../screens/caretaker/WaitingForAssignmentScreen";
import PaymentCollectionScreen from "../screens/caretaker/PaymentCollectionScreen";
import CaretakerCreateBookingScreen from "../screens/caretaker/CaretakerCreateBookingScreen";
import MaintenanceLogScreen from "../screens/caretaker/MaintenanceLogScreen";
import ExpenseTrackingScreen from "../screens/caretaker/ExpenseTrackingScreen";
import NotificationsScreen from "../screens/common/NotificationsScreen";

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Tab Navigator Component
function CaretakerTabs() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = Platform.OS === "ios" ? 45 + insets.bottom : 72;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#F97316",
        tabBarInactiveTintColor: "#9CA3AF",
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopWidth: 1,
          borderTopColor: "#F3F4F6",
          height: tabBarHeight,
          paddingBottom: Platform.OS === "ios" ? insets.bottom + 6 : 8,
          paddingTop: 8,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          elevation: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: "Ubuntu-Medium",
        },
      }}
    >
      <Tab.Screen
        name="Today"
        component={CaretakerDashboardScreen}
        options={{
          tabBarLabel: "Dashboard",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="view-dashboard" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="CaretakerCalendar"
        component={CaretakerCalendarScreen}
        options={{
          tabBarLabel: "Calendar",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="calendar-month" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="CaretakerProfile"
        component={CaretakerProfileScreen}
        options={{
          tabBarLabel: "Profile",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// Main Caretaker Navigator with Stack
export default function CaretakerNavigator() {
  const isAssigned = useSelector(selectIsCaretakerAssigned);

  // If caretaker is not assigned to any turf, show waiting screen
  if (!isAssigned) {
    return <WaitingForAssignmentScreen />;
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="CaretakerTabs" component={CaretakerTabs} />
      <Stack.Screen
        name="PaymentCollection"
        component={PaymentCollectionScreen}
        options={{
          headerShown: true,
          headerTitle: "Collect Payment",
          headerBackTitle: "Back",
        }}
      />
      <Stack.Screen
        name="MaintenanceLog"
        component={MaintenanceLogScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="ExpenseTracking"
        component={ExpenseTrackingScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="CaretakerCreateBooking"
        component={CaretakerCreateBookingScreen}
        options={{
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
}
