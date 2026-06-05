import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Platform } from "react-native";

// Tab screens
import HomeScreen from "../screens/user/HomeScreen";
import DiscoverScreen from "../screens/user/DiscoverScreen";
import BookingsScreen from "../screens/user/BookingsScreen";
import WishlistScreen from "../screens/user/WishlistScreen";
import ChatListScreen from "../screens/user/ChatListScreen";
import ProfileScreen from "../screens/user/ProfileScreen";

// Stack screens
import TurfDetailScreen from "../screens/user/TurfDetailScreen";
import BookingScreen from "../screens/user/BookingScreen";
import BookingConfirmationScreen from "../screens/user/BookingConfirmationScreen";
import BookingSuccessScreen from "../screens/user/BookingSuccessScreen";
import ChatScreen from "../screens/user/ChatScreen";
import CashfreePaymentScreen from "../screens/user/CashfreePaymentScreen";
import WriteReviewScreen from "../screens/user/WriteReviewScreen";
import NotificationsScreen from "../screens/common/NotificationsScreen";
import SupportScreen from "../screens/user/SupportScreen";
import NewTicketScreen from "../screens/user/NewTicketScreen";
import TicketDetailScreen from "../screens/user/TicketDetailScreen";
import NewDisputeScreen from "../screens/user/NewDisputeScreen";
import DisputeDetailScreen from "../screens/user/DisputeDetailScreen";

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const USER_COLOR = "#10B981";

function UserTabs() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = Platform.OS === "ios" ? 45 + insets.bottom : 72;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: USER_COLOR,
        tabBarInactiveTintColor: "#9CA3AF",
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopWidth: 1,
          borderTopColor: "#F0F0F0",
          height: tabBarHeight,
          paddingBottom: Platform.OS === "ios" ? insets.bottom + 6 : 8,
          paddingTop: 8,
          shadowColor: "#10B981",
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
          elevation: 10,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: "Ubuntu-Medium",
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: "Home",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Discover"
        component={DiscoverScreen}
        options={{
          tabBarLabel: "Discover",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="compass-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Bookings"
        component={BookingsScreen}
        options={{
          tabBarLabel: "Bookings",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="calendar-check" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ChatList"
        component={ChatListScreen}
        options={{
          tabBarLabel: "Chat",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="chat" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
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

export default function UserNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="UserTabs" component={UserTabs} />
      <Stack.Screen
        name="TurfDetails"
        component={TurfDetailScreen}
        options={{
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="Booking"
        component={BookingScreen}
        options={{
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="BookingConfirmation"
        component={BookingConfirmationScreen}
        options={{
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="BookingSuccess"
        component={BookingSuccessScreen}
        options={{
          presentation: "card",
          gestureEnabled: false, // Prevent going back from success screen
        }}
      />
      <Stack.Screen
        name="ChatScreen"
        component={ChatScreen}
        options={{
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="CashfreePayment"
        component={CashfreePaymentScreen}
        options={{
          presentation: "card",
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="WriteReview"
        component={WriteReviewScreen}
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
      <Stack.Screen
        name="Wishlist"
        component={WishlistScreen}
        options={{
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="Support"
        component={SupportScreen}
        options={{ presentation: "card" }}
      />
      <Stack.Screen
        name="NewTicket"
        component={NewTicketScreen}
        options={{ presentation: "card" }}
      />
      <Stack.Screen
        name="TicketDetail"
        component={TicketDetailScreen}
        options={{ presentation: "card" }}
      />
      <Stack.Screen
        name="NewDispute"
        component={NewDisputeScreen}
        options={{ presentation: "card" }}
      />
      <Stack.Screen
        name="DisputeDetail"
        component={DisputeDetailScreen}
        options={{ presentation: "card" }}
      />
    </Stack.Navigator>
  );
}
