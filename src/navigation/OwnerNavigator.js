import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";
import { MaterialCommunityIcons } from "@expo/vector-icons";

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

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const OWNER_COLOR = "#9C27B0";

function OwnerTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: OWNER_COLOR,
        tabBarInactiveTintColor: "#999",
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopWidth: 1,
          borderTopColor: "#eee",
          paddingBottom: 8,
          paddingTop: 8,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "500",
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
    </Stack.Navigator>
  );
}
