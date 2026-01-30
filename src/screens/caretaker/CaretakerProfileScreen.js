import React from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { Text, Surface, Button, Divider } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../../hooks";

const MENU_ITEMS = [
  { id: "earnings", icon: "cash", label: "My Earnings", color: "#4CAF50" },
  { id: "attendance", icon: "calendar-check", label: "Attendance", color: "#2196F3" },
  { id: "notifications", icon: "bell", label: "Notifications", color: "#FF9800" },
  { id: "help", icon: "help-circle", label: "Help & Support", color: "#607D8B" },
];

export default function CaretakerProfileScreen() {
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
            <MaterialCommunityIcons name="account-hard-hat" size={40} color="#FF9800" />
          </View>
          <View style={styles.profileInfo}>
            <Text variant="titleLarge" style={styles.userName}>
              {user?.name || "Caretaker"}
            </Text>
            <Text variant="bodyMedium" style={styles.userPhone}>
              {user?.phone || "Phone not set"}
            </Text>
            <View style={styles.roleChip}>
              <Text variant="bodySmall" style={styles.roleText}>
                CARETAKER
              </Text>
            </View>
          </View>
        </Surface>

        {/* Stats */}
        <View style={styles.statsRow}>
          <Surface style={styles.statCard} elevation={1}>
            <Text variant="headlineMedium" style={[styles.statValue, { color: "#4CAF50" }]}>
              0
            </Text>
            <Text variant="bodySmall" style={styles.statLabel}>
              Total Days
            </Text>
          </Surface>
          <Surface style={styles.statCard} elevation={1}>
            <Text variant="headlineMedium" style={[styles.statValue, { color: "#2196F3" }]}>
              0
            </Text>
            <Text variant="bodySmall" style={styles.statLabel}>
              Bookings Handled
            </Text>
          </Surface>
        </View>

        {/* Assigned Turf */}
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Assigned Turf
        </Text>
        <Surface style={styles.turfCard} elevation={1}>
          <MaterialCommunityIcons name="soccer-field" size={32} color="#FF9800" />
          <View style={styles.turfInfo}>
            <Text variant="bodyMedium" style={styles.noTurfText}>
              No turf assigned yet
            </Text>
            <Text variant="bodySmall" style={styles.noTurfSubtext}>
              Contact your manager for assignment
            </Text>
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
    backgroundColor: "#FFF3E0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
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
    backgroundColor: "#FFF3E0",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: "flex-start",
    marginTop: 8,
  },
  roleText: {
    color: "#FF9800",
    fontWeight: "600",
    fontSize: 10,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#fff",
    alignItems: "center",
  },
  statValue: {
    fontWeight: "bold",
  },
  statLabel: {
    color: "#666",
    marginTop: 4,
  },
  sectionTitle: {
    fontWeight: "600",
    marginBottom: 12,
    color: "#333",
  },
  turfCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#fff",
    marginBottom: 24,
  },
  turfInfo: {
    marginLeft: 12,
    flex: 1,
  },
  noTurfText: {
    color: "#666",
  },
  noTurfSubtext: {
    color: "#999",
    marginTop: 2,
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
