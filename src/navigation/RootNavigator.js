import React from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { createStackNavigator } from "@react-navigation/stack";

import { useAuth } from "../hooks";
import AuthNavigator from "./AuthNavigator";
import UserNavigator from "./UserNavigator";
import OwnerNavigator from "./OwnerNavigator";
import ManagerNavigator from "./ManagerNavigator";
import CaretakerNavigator from "./CaretakerNavigator";

const Stack = createStackNavigator();

// Loading Screen
function LoadingScreen() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#4CAF50" />
    </View>
  );
}

// Get main navigator based on user role
function getMainNavigator(role) {
  switch (role) {
    case "owner":
      return OwnerNavigator;
    case "manager":
      return ManagerNavigator;
    case "caretaker":
      return CaretakerNavigator;
    case "user":
    default:
      return UserNavigator;
  }
}

// Wrapper to pass isNewUser prop to AuthNavigator
function AuthNavigatorWithProps({ isNewUser }) {
  return function WrappedAuthNavigator() {
    return <AuthNavigator isNewUser={isNewUser} />;
  };
}

/**
 * Root Navigator
 * Handles authentication state and routes to appropriate navigator based on:
 * 1. Authentication status
 * 2. Profile completion status (isNewUser)
 * 3. User role (user, manager, caretaker)
 */
export default function RootNavigator() {
  const { isAuthenticated, isLoading, user, userRole } = useAuth({ subscribe: true });

  // Show loading screen while checking auth state
  if (isLoading) {
    return <LoadingScreen />;
  }

  // Determine if user needs to complete profile setup
  const isNewUser = user?.isNewUser === true;

  // Get appropriate navigator based on role
  const MainNavigator = getMainNavigator(userRole);
  const AuthWithProps = AuthNavigatorWithProps({ isNewUser });

  console.log(
    "[RootNavigator] isAuthenticated:",
    isAuthenticated,
    "isNewUser:",
    isNewUser,
    "role:",
    userRole
  );

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: true,
      }}
    >
      {!isAuthenticated || isNewUser ? (
        // Auth flow (login or profile completion for new users)
        <Stack.Screen
          name="Auth"
          component={AuthWithProps}
          options={{
            animationTypeForReplace: !isAuthenticated ? "pop" : "push",
          }}
        />
      ) : (
        // Main app flow based on role
        <Stack.Screen
          name="Main"
          component={MainNavigator}
          options={{
            animationTypeForReplace: "push",
          }}
        />
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
