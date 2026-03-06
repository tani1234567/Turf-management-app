import React from "react";
import { createStackNavigator } from "@react-navigation/stack";

import LoginScreen from "../screens/auth/LoginScreen";
import OTPScreen from "../screens/auth/OTPScreen";
import RoleSelectionScreen from "../screens/auth/RoleSelectionScreen";
import ProfileSetupScreen from "../screens/auth/ProfileSetupScreen";
import OwnerSetupScreen from "../screens/auth/OwnerSetupScreen";
import JoinCompanyScreen from "../screens/auth/JoinCompanyScreen";

const Stack = createStackNavigator();

export default function AuthNavigator({ isNewUser = false }) {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: "#F7FFF9" },
      }}
      initialRouteName={isNewUser ? "RoleSelectionScreen" : "LoginScreen"}
    >
      <Stack.Screen name="LoginScreen" component={LoginScreen} />
      <Stack.Screen name="OTPScreen" component={OTPScreen} />
      <Stack.Screen name="RoleSelectionScreen" component={RoleSelectionScreen} />
      <Stack.Screen name="ProfileSetupScreen" component={ProfileSetupScreen} />
      <Stack.Screen name="OwnerSetupScreen" component={OwnerSetupScreen} />
      <Stack.Screen name="JoinCompanyScreen" component={JoinCompanyScreen} />
    </Stack.Navigator>
  );
}
