import React from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { Text, Surface, Button, Card } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../../hooks";

const STATS = [
  { id: "bookings", label: "Today's Bookings", value: "0", icon: "calendar-check", color: "#4CAF50" },
  { id: "revenue", label: "Today's Revenue", value: "₹0", icon: "currency-inr", color: "#2196F3" },
  { id: "pending", label: "Pending", value: "0", icon: "clock-outline", color: "#FF9800" },
  { id: "cancelled", label: "Cancelled", value: "0", icon: "close-circle", color: "#F44336" },
];

export default function DashboardScreen() {
  const { user, logout } = useAuth();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text variant="bodyMedium" style={styles.greeting}>
              Manager Dashboard
            </Text>
            <Text variant="headlineSmall" style={styles.userName}>
              {user?.name || "Manager"}
            </Text>
          </View>
          <Surface style={styles.avatarContainer} elevation={2}>
            <MaterialCommunityIcons name="account-tie" size={28} color="#2196F3" />
          </Surface>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          {STATS.map((stat) => (
            <Surface key={stat.id} style={styles.statCard} elevation={1}>
              <View style={[styles.statIconContainer, { backgroundColor: `${stat.color}15` }]}>
                <MaterialCommunityIcons name={stat.icon} size={24} color={stat.color} />
              </View>
              <Text variant="headlineSmall" style={[styles.statValue, { color: stat.color }]}>
                {stat.value}
              </Text>
              <Text variant="bodySmall" style={styles.statLabel}>
                {stat.label}
              </Text>
            </Surface>
          ))}
        </View>

        {/* Quick Actions */}
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Quick Actions
        </Text>
        <View style={styles.actionsRow}>
          <Button mode="contained" icon="plus" style={styles.actionButton}>
            Add Turf
          </Button>
          <Button mode="outlined" icon="account-plus" style={styles.actionButton}>
            Add Caretaker
          </Button>
        </View>

        {/* Recent Bookings */}
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Recent Bookings
        </Text>
        <Card style={styles.card}>
          <Card.Content style={styles.emptyState}>
            <MaterialCommunityIcons name="calendar-blank" size={48} color="#ccc" />
            <Text variant="bodyMedium" style={styles.emptyText}>
              No bookings yet
            </Text>
            <Text variant="bodySmall" style={styles.emptySubtext}>
              Bookings will appear here once customers start booking
            </Text>
          </Card.Content>
        </Card>

        {/* Logout Button */}
        <Button
          mode="outlined"
          onPress={logout}
          style={styles.logoutButton}
          icon="logout"
        >
          Logout
        </Button>
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  greeting: {
    color: "#666",
  },
  userName: {
    fontWeight: "bold",
    color: "#333",
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#E3F2FD",
    justifyContent: "center",
    alignItems: "center",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
    marginBottom: 24,
  },
  statCard: {
    width: "48%",
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#fff",
    margin: 4,
    alignItems: "center",
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
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
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    borderRadius: 8,
  },
  card: {
    marginBottom: 24,
    borderRadius: 12,
  },
  emptyState: {
    alignItems: "center",
    padding: 24,
  },
  emptyText: {
    color: "#999",
    marginTop: 8,
  },
  emptySubtext: {
    color: "#bbb",
    marginTop: 4,
    textAlign: "center",
  },
  logoutButton: {
    marginTop: 16,
    borderRadius: 8,
  },
});
