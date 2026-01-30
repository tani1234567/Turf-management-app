import React from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { Text, Surface, Button, Divider, Switch, Badge } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSelector } from "react-redux";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../../hooks";
import { selectUnassignedCaretakers } from "../../store/slices/companySlice";

const SETTINGS_SECTIONS = [
  {
    title: "Turf Management",
    items: [
      { id: "turfs", icon: "soccer-field", label: "My Turfs", color: "#4CAF50" },
      { id: "pricing", icon: "currency-inr", label: "Pricing & Slots", color: "#2196F3" },
      { id: "caretakers", icon: "account-group", label: "Caretakers", color: "#9C27B0" },
    ],
  },
  {
    title: "Account",
    items: [
      { id: "profile", icon: "account-edit", label: "Edit Profile", color: "#607D8B" },
      { id: "bank", icon: "bank", label: "Bank Details", color: "#795548" },
      { id: "notifications", icon: "bell", label: "Notifications", color: "#FF9800" },
    ],
  },
  {
    title: "Support",
    items: [
      { id: "help", icon: "help-circle", label: "Help & Support", color: "#00BCD4" },
      { id: "about", icon: "information", label: "About", color: "#607D8B" },
    ],
  },
];

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const navigation = useNavigation();
  const unassignedCaretakers = useSelector(selectUnassignedCaretakers);
  const unassignedCount = unassignedCaretakers?.length || 0;

  const handleMenuPress = (itemId) => {
    switch (itemId) {
      case "caretakers":
        navigation.navigate("ManagerCaretakers");
        break;
      case "turfs":
        // TODO: Navigate to turfs management
        break;
      case "pricing":
        // TODO: Navigate to pricing settings
        break;
      case "profile":
        // TODO: Navigate to edit profile
        break;
      case "bank":
        // TODO: Navigate to bank details
        break;
      case "notifications":
        // TODO: Navigate to notifications settings
        break;
      case "help":
        // TODO: Navigate to help
        break;
      case "about":
        // TODO: Navigate to about
        break;
      default:
        break;
    }
  };

  const MenuItem = ({ item }) => (
    <TouchableOpacity style={styles.menuItem} onPress={() => handleMenuPress(item.id)}>
      <View style={[styles.menuIconContainer, { backgroundColor: `${item.color}15` }]}>
        <MaterialCommunityIcons name={item.icon} size={22} color={item.color} />
      </View>
      <Text variant="bodyLarge" style={styles.menuLabel}>
        {item.label}
      </Text>
      {item.id === "caretakers" && unassignedCount > 0 && (
        <Badge style={styles.badge}>{unassignedCount}</Badge>
      )}
      <MaterialCommunityIcons name="chevron-right" size={24} color="#ccc" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text variant="headlineSmall" style={styles.title}>
            Settings
          </Text>
        </View>

        {/* Profile Card */}
        <Surface style={styles.profileCard} elevation={1}>
          <View style={styles.avatarContainer}>
            <MaterialCommunityIcons name="account-tie" size={32} color="#2196F3" />
          </View>
          <View style={styles.profileInfo}>
            <Text variant="titleMedium" style={styles.userName}>
              {user?.name || "Manager"}
            </Text>
            <Text variant="bodySmall" style={styles.userRole}>
              Business Manager
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color="#ccc" />
        </Surface>

        {/* Settings Sections */}
        {SETTINGS_SECTIONS.map((section) => (
          <View key={section.title}>
            <Text variant="titleSmall" style={styles.sectionTitle}>
              {section.title}
            </Text>
            <Surface style={styles.menuCard} elevation={1}>
              {section.items.map((item, index) => (
                <React.Fragment key={item.id}>
                  <MenuItem item={item} />
                  {index < section.items.length - 1 && (
                    <Divider style={styles.divider} />
                  )}
                </React.Fragment>
              ))}
            </Surface>
          </View>
        ))}

        {/* Logout Button */}
        <Button
          mode="outlined"
          onPress={logout}
          style={styles.logoutButton}
          icon="logout"
          textColor="#F44336"
        >
          Logout
        </Button>

        {/* Version */}
        <Text variant="bodySmall" style={styles.version}>
          Version 1.0.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontWeight: "bold",
    color: "#333",
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#fff",
    marginBottom: 24,
  },
  avatarContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#E3F2FD",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  profileInfo: {
    flex: 1,
  },
  userName: {
    fontWeight: "bold",
    color: "#333",
  },
  userRole: {
    color: "#666",
    marginTop: 2,
  },
  sectionTitle: {
    color: "#666",
    marginBottom: 8,
    marginLeft: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  menuCard: {
    borderRadius: 16,
    backgroundColor: "#fff",
    marginBottom: 24,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  menuLabel: {
    flex: 1,
    color: "#333",
  },
  divider: {
    marginLeft: 68,
  },
  badge: {
    backgroundColor: "#FF9800",
    marginRight: 8,
  },
  logoutButton: {
    borderRadius: 8,
    borderColor: "#F44336",
  },
  version: {
    textAlign: "center",
    color: "#999",
    marginTop: 24,
    marginBottom: 16,
  },
});
