import React from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { Text, Surface, Button, Divider } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../../hooks";

const MENU_ITEMS = [
  { id: "edit", icon: "account-edit", label: "Edit Profile", color: "#4CAF50" },
  { id: "bookings", icon: "calendar-text", label: "Booking History", color: "#2196F3" },
  { id: "payments", icon: "credit-card", label: "Payment Methods", color: "#9C27B0" },
  { id: "notifications", icon: "bell", label: "Notifications", color: "#FF9800" },
  { id: "help", icon: "help-circle", label: "Help & Support", color: "#607D8B" },
  { id: "about", icon: "information", label: "About", color: "#795548" },
];

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  const MenuItem = ({ item }) => (
    <TouchableOpacity style={styles.menuItem}>
      <View style={[styles.menuIconContainer, { backgroundColor: `${item.color}15` }]}>
        <MaterialCommunityIcons name={item.icon} size={22} color={item.color} />
      </View>
      <Text variant="bodyLarge" style={styles.menuLabel}>
        {item.label}
      </Text>
      <MaterialCommunityIcons name="chevron-right" size={24} color="#ccc" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Header */}
        <Surface style={styles.profileCard} elevation={1}>
          <View style={styles.avatarContainer}>
            {user?.profilePicture ? (
              <Image source={{ uri: user.profilePicture }} style={styles.avatar} />
            ) : (
              <MaterialCommunityIcons name="account" size={40} color="#4CAF50" />
            )}
          </View>
          <View style={styles.profileInfo}>
            <Text variant="titleLarge" style={styles.userName}>
              {user?.name || "User"}
            </Text>
            <Text variant="bodyMedium" style={styles.userPhone}>
              {user?.phone || "Phone not set"}
            </Text>
            <View style={styles.roleChip}>
              <Text variant="bodySmall" style={styles.roleText}>
                {(user?.role || "user").toUpperCase()}
              </Text>
            </View>
          </View>
        </Surface>

        {/* Menu Items */}
        <Surface style={styles.menuCard} elevation={1}>
          {MENU_ITEMS.map((item, index) => (
            <React.Fragment key={item.id}>
              <MenuItem item={item} />
              {index < MENU_ITEMS.length - 1 && <Divider style={styles.divider} />}
            </React.Fragment>
          ))}
        </Surface>

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
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    borderRadius: 16,
    backgroundColor: "#fff",
    marginBottom: 16,
  },
  avatarContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#E8F5E9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  profileInfo: {
    flex: 1,
  },
  userName: {
    fontWeight: "bold",
    color: "#333",
  },
  userPhone: {
    color: "#666",
    marginTop: 2,
  },
  roleChip: {
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: "flex-start",
    marginTop: 8,
  },
  roleText: {
    color: "#4CAF50",
    fontWeight: "600",
    fontSize: 10,
  },
  menuCard: {
    borderRadius: 16,
    backgroundColor: "#fff",
    marginBottom: 16,
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
