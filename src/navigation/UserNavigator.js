import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";
import { MaterialCommunityIcons } from "@expo/vector-icons";

// Tab screens
import HomeScreen from "../screens/user/HomeScreen";
import SearchScreen from "../screens/user/SearchScreen";
import BookingsScreen from "../screens/user/BookingsScreen";
import ChatListScreen from "../screens/user/ChatListScreen";
import ProfileScreen from "../screens/user/ProfileScreen";

// Stack screens
import TurfDetailScreen from "../screens/user/TurfDetailScreen";
import BookingScreen from "../screens/user/BookingScreen";
import BookingConfirmationScreen from "../screens/user/BookingConfirmationScreen";
import BookingSuccessScreen from "../screens/user/BookingSuccessScreen";
import ChatScreen from "../screens/user/ChatScreen";
// import NotificationsScreen from "../screens/user/NotificationsScreen";

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const USER_COLOR = "#4CAF50";

function UserTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: USER_COLOR,
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
        name="Search"
        component={SearchScreen}
        options={{
          tabBarLabel: "Search",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="magnify" size={size} color={color} />
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
      {/* Stack screens for nested navigation - uncomment as screens are created */}
      {/*
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          presentation: "card",
        }}
      />
      */}
    </Stack.Navigator>
  );
}
