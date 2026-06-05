import React from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { Text, Surface, Chip, Button } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Platform } from "react-native";

// Tab screens
import OperationsModeScreen from "../screens/owner/OperationsModeScreen";
import BookingManagementScreen from "../screens/manager/BookingManagementScreen";
import CalendarScreen from "../screens/manager/CalendarScreen";
import ManagerChatListScreen from "../screens/manager/ManagerChatListScreen";

// Stack screens
import CreateBookingScreen from "../screens/manager/CreateBookingScreen";
import BlockSlotsScreen from "../screens/manager/BlockSlotsScreen";
import ManagerChatScreen from "../screens/manager/ManagerChatScreen";
import TurfSelectionScreen from "../screens/manager/TurfSelectionScreen";
import AnalyticsDashboardScreen from "../screens/manager/AnalyticsDashboardScreen";
import ExpenseTrackingScreen from "../screens/manager/ExpenseTrackingScreen";
import ReviewManagementScreen from "../screens/manager/ReviewManagementScreen";
import AcademyManagementScreen from "../screens/manager/AcademyManagementScreen";
import AdvancePaymentSettingsScreen from "../screens/manager/AdvancePaymentSettingsScreen";
import CaretakerAssignmentScreen from "../screens/manager/CaretakerAssignmentScreen";
import ManagerCaretakerScreen from "../screens/manager/ManagerCaretakerScreen";
import EditTurfScreen from "../screens/owner/EditTurfScreen";
import NotificationsScreen from "../screens/common/NotificationsScreen";

import { useSelectedTurf } from "../hooks/useSelectedTurf";

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const OPS_COLOR = "#00796B";
const OWNER_COLOR = "#9C27B0";

/**
 * 5th tab — "More" settings tab for Operations Mode.
 * Provides a way to exit back to owner dashboard and quick links.
 */
function OperationsSettingsTab() {
  const navigation = useNavigation();
  const { turfData, selectedTurfId } = useSelectedTurf();

  const handleBackToOwner = () => {
    // OperationsMode is a stack screen in OwnerNavigator — pop back
    navigation.getParent()?.goBack();
  };

  const quickLinks = [
    {
      id: "advance",
      label: "Advance Payment Settings",
      icon: "cash-fast",
      onPress: () => navigation.navigate("AdvancePaymentSettings", { turfId: selectedTurfId }),
    },
    {
      id: "editTurf",
      label: "Edit Turf",
      icon: "pencil-outline",
      onPress: () =>
        navigation.navigate("EditTurf", { turfId: selectedTurfId }),
    },
    {
      id: "caretakers",
      label: "Caretakers",
      icon: "account-hard-hat",
      onPress: () => navigation.navigate("ManagerCaretakers"),
    },
    {
      id: "analytics",
      label: "Analytics Dashboard",
      icon: "chart-bar",
      onPress: () => navigation.navigate("AnalyticsDashboard"),
    },
    {
      id: "expenses",
      label: "Expense Tracking",
      icon: "cash-register",
      onPress: () => navigation.navigate("ExpenseTracking"),
    },
    {
      id: "reviews",
      label: "Review Management",
      icon: "star-outline",
      onPress: () => navigation.navigate("ReviewManagement"),
    },
  ];

  return (
    <SafeAreaView style={settingsStyles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={settingsStyles.scrollContent}>
        {/* Header */}
        <View style={settingsStyles.header}>
          <Text variant="headlineSmall" style={settingsStyles.title}>
            Operations Settings
          </Text>
          <Chip
            mode="flat"
            style={settingsStyles.ownerBadge}
            textStyle={settingsStyles.ownerBadgeText}
            icon={() => (
              <MaterialCommunityIcons
                name="shield-crown"
                size={14}
                color={OWNER_COLOR}
              />
            )}
          >
            Owner
          </Chip>
        </View>

        {/* Current Turf Info */}
        {turfData && (
          <Surface style={settingsStyles.turfCard} elevation={1}>
            <View style={settingsStyles.turfCardHeader}>
              <MaterialCommunityIcons
                name="soccer-field"
                size={20}
                color={OPS_COLOR}
              />
              <Text variant="titleSmall" style={settingsStyles.turfCardTitle}>
                Current Turf
              </Text>
            </View>
            <Text variant="titleMedium" style={settingsStyles.turfName}>
              {turfData.name || "Unknown Turf"}
            </Text>
            {turfData.address && (
              <Text variant="bodySmall" style={settingsStyles.turfAddress}>
                {turfData.address}
              </Text>
            )}
          </Surface>
        )}

        {/* Back to Owner Dashboard */}
        <Button
          mode="contained"
          icon="arrow-left"
          onPress={handleBackToOwner}
          style={settingsStyles.backButton}
          buttonColor={OWNER_COLOR}
          contentStyle={settingsStyles.backButtonContent}
        >
          Back to Owner Dashboard
        </Button>

        {/* Quick Links */}
        <Text variant="titleMedium" style={settingsStyles.sectionTitle}>
          Quick Links
        </Text>
        <Surface style={settingsStyles.linksCard} elevation={1}>
          {quickLinks.map((link, index) => (
            <React.Fragment key={link.id}>
              <TouchableOpacity
                style={settingsStyles.linkItem}
                onPress={link.onPress}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons
                  name={link.icon}
                  size={22}
                  color={OPS_COLOR}
                />
                <Text variant="bodyMedium" style={settingsStyles.linkLabel}>
                  {link.label}
                </Text>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={20}
                  color="#999"
                />
              </TouchableOpacity>
              {index < quickLinks.length - 1 && (
                <View style={settingsStyles.linkDivider} />
              )}
            </React.Fragment>
          ))}
        </Surface>
      </ScrollView>
    </SafeAreaView>
  );
}

const settingsStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontWeight: "bold",
    color: "#333",
  },
  ownerBadge: {
    backgroundColor: "#F3E5F5",
  },
  ownerBadgeText: {
    color: OWNER_COLOR,
    fontSize: 12,
    fontWeight: "600",
  },
  turfCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  turfCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  turfCardTitle: {
    marginLeft: 8,
    color: "#666",
    fontWeight: "600",
  },
  turfName: {
    fontWeight: "bold",
    color: "#333",
  },
  turfAddress: {
    color: "#999",
    marginTop: 2,
  },
  backButton: {
    marginBottom: 24,
    borderRadius: 12,
  },
  backButtonContent: {
    paddingVertical: 6,
  },
  sectionTitle: {
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  linksCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
  },
  linkItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  linkLabel: {
    flex: 1,
    marginLeft: 14,
    color: "#333",
  },
  linkDivider: {
    height: 1,
    backgroundColor: "#f0f0f0",
    marginLeft: 52,
  },
});

/**
 * Tab Navigator for Operations Mode — mirrors ManagerNavigator tabs
 */
function OperationsModeTabs() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = Platform.OS === "ios" ? 45 + insets.bottom : 72;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: OPS_COLOR,
        tabBarInactiveTintColor: "#999",
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopWidth: 1,
          borderTopColor: "#eee",
          height: tabBarHeight,
          paddingBottom: Platform.OS === "ios" ? insets.bottom + 6 : 8,
          paddingTop: 8,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: "Ubuntu-Medium",
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={OperationsModeScreen}
        options={{
          tabBarLabel: "Dashboard",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="view-dashboard"
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="ManagerBookings"
        component={BookingManagementScreen}
        options={{
          tabBarLabel: "Bookings",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="calendar-text"
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Calendar"
        component={CalendarScreen}
        options={{
          tabBarLabel: "Calendar",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="calendar-month"
              size={size}
              color={color}
            />
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
        name="OpsSettings"
        component={OperationsSettingsTab}
        options={{
          tabBarLabel: "More",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="dots-horizontal"
              size={size}
              color={color}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

/**
 * Full Stack Navigator wrapping the tab navigator + all manager stack screens.
 * Route names match ManagerNavigator so internal navigation resolves correctly.
 */
export default function OperationsModeNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="OperationsModeTabs" component={OperationsModeTabs} />
      <Stack.Screen
        name="CreateBooking"
        component={CreateBookingScreen}
        options={{ presentation: "card" }}
      />
      <Stack.Screen
        name="BlockSlots"
        component={BlockSlotsScreen}
        options={{ presentation: "card" }}
      />
      <Stack.Screen
        name="ManagerChatScreen"
        component={ManagerChatScreen}
        options={{ presentation: "card" }}
      />
      <Stack.Screen
        name="TurfSelection"
        component={TurfSelectionScreen}
        options={{ presentation: "card" }}
      />
      <Stack.Screen
        name="AnalyticsDashboard"
        component={AnalyticsDashboardScreen}
        options={{ presentation: "card" }}
      />
      <Stack.Screen
        name="ExpenseTracking"
        component={ExpenseTrackingScreen}
        options={{ presentation: "card" }}
      />
      <Stack.Screen
        name="ReviewManagement"
        component={ReviewManagementScreen}
        options={{ presentation: "card" }}
      />
      <Stack.Screen
        name="AcademyManagement"
        component={AcademyManagementScreen}
        options={{ presentation: "card" }}
      />
      <Stack.Screen
        name="AdvancePaymentSettings"
        component={AdvancePaymentSettingsScreen}
        options={{ presentation: "card" }}
      />
      <Stack.Screen
        name="CaretakerAssignment"
        component={CaretakerAssignmentScreen}
        options={{ presentation: "card" }}
      />
      <Stack.Screen
        name="ManagerCaretakers"
        component={ManagerCaretakerScreen}
        options={{ presentation: "card" }}
      />
      <Stack.Screen
        name="EditTurf"
        component={EditTurfScreen}
        options={{ presentation: "card" }}
      />
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ presentation: "card" }}
      />
    </Stack.Navigator>
  );
}
