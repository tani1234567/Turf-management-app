import React from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { createStackNavigator } from "@react-navigation/stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { useAuth } from "../hooks";
import AuthNavigator from "./AuthNavigator";
import HomeScreen from "../screens/HomeScreen";

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Loading Screen
function LoadingScreen() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#4CAF50" />
    </View>
  );
}

// User Tab Navigator
function UserTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#4CAF50",
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
          fontSize: 12,
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
      {/* Add more tabs as needed */}
    </Tab.Navigator>
  );
}

// Manager Tab Navigator (placeholder for now)
function ManagerTabNavigator() {
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
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={HomeScreen}
        options={{
          tabBarLabel: "Dashboard",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="view-dashboard" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// Caretaker Tab Navigator (placeholder for now)
function CaretakerTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#FF9800",
        tabBarInactiveTintColor: "#999",
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopWidth: 1,
          borderTopColor: "#eee",
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
      }}
    >
      <Tab.Screen
        name="Schedule"
        component={HomeScreen}
        options={{
          tabBarLabel: "Schedule",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="calendar-today" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// Get main navigator based on user role
function getMainNavigator(role) {
  switch (role) {
    case "manager":
      return ManagerTabNavigator;
    case "caretaker":
      return CaretakerTabNavigator;
    case "user":
    default:
      return UserTabNavigator;
  }
}

// Wrapper to pass isNewUser prop to AuthNavigator
function AuthNavigatorWrapper({ isNewUser }) {
  return function WrappedAuthNavigator() {
    return <AuthNavigator isNewUser={isNewUser} />;
  };
}

// Root Stack Navigator
export default function AppNavigator() {
  const { isAuthenticated, isLoading, user, userRole } = useAuth({ subscribe: true });

  // Show loading screen while checking auth state
  if (isLoading) {
    return <LoadingScreen />;
  }

  // Determine if user needs to complete profile setup
  const isNewUser = user?.isNewUser === true;

  // Get appropriate navigator based on role
  const MainNavigator = getMainNavigator(userRole);
  const AuthWithProps = AuthNavigatorWrapper({ isNewUser });

  console.log("[AppNavigator] isAuthenticated:", isAuthenticated, "isNewUser:", isNewUser, "role:", userRole);

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      {!isAuthenticated || isNewUser ? (
        // Auth flow (login or profile completion for new users)
        <Stack.Screen name="Auth" component={AuthWithProps} />
      ) : (
        // Main app flow
        <Stack.Screen name="Main" component={MainNavigator} />
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
});
