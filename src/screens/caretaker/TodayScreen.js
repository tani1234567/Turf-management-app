import React from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { Text, Surface, Button, Card } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../../hooks";

export default function TodayScreen() {
  const { user, logout } = useAuth();
  const today = new Date();

  const formatDate = () => {
    return today.toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text variant="bodyMedium" style={styles.dateText}>
              {formatDate()}
            </Text>
            <Text variant="headlineSmall" style={styles.greeting}>
              Hello, {user?.name || "Caretaker"}
            </Text>
          </View>
          <Surface style={styles.avatarContainer} elevation={2}>
            <MaterialCommunityIcons name="account-hard-hat" size={28} color="#FF9800" />
          </Surface>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <Surface style={styles.statCard} elevation={1}>
            <Text variant="headlineMedium" style={[styles.statValue, { color: "#4CAF50" }]}>
              0
            </Text>
            <Text variant="bodySmall" style={styles.statLabel}>
              Today's Bookings
            </Text>
          </Surface>
          <Surface style={styles.statCard} elevation={1}>
            <Text variant="headlineMedium" style={[styles.statValue, { color: "#2196F3" }]}>
              ₹0
            </Text>
            <Text variant="bodySmall" style={styles.statLabel}>
              Collections
            </Text>
          </Surface>
        </View>

        {/* Today's Schedule */}
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Today's Schedule
        </Text>
        <Card style={styles.card}>
          <Card.Content style={styles.emptyState}>
            <MaterialCommunityIcons name="calendar-blank" size={48} color="#ccc" />
            <Text variant="bodyMedium" style={styles.emptyText}>
              No bookings scheduled for today
            </Text>
            <Text variant="bodySmall" style={styles.emptySubtext}>
              Check with your manager for updates
            </Text>
          </Card.Content>
        </Card>

        {/* Quick Actions */}
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Quick Actions
        </Text>
        <View style={styles.actionsGrid}>
          <Surface style={styles.actionCard} elevation={1}>
            <MaterialCommunityIcons name="cash" size={32} color="#4CAF50" />
            <Text variant="bodySmall" style={styles.actionText}>
              Collect Payment
            </Text>
          </Surface>
          <Surface style={styles.actionCard} elevation={1}>
            <MaterialCommunityIcons name="check-circle" size={32} color="#2196F3" />
            <Text variant="bodySmall" style={styles.actionText}>
              Mark Complete
            </Text>
          </Surface>
          <Surface style={styles.actionCard} elevation={1}>
            <MaterialCommunityIcons name="phone" size={32} color="#FF9800" />
            <Text variant="bodySmall" style={styles.actionText}>
              Call Manager
            </Text>
          </Surface>
          <Surface style={styles.actionCard} elevation={1}>
            <MaterialCommunityIcons name="alert-circle" size={32} color="#F44336" />
            <Text variant="bodySmall" style={styles.actionText}>
              Report Issue
            </Text>
          </Surface>
        </View>

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
  dateText: {
    color: "#666",
  },
  greeting: {
    fontWeight: "bold",
    color: "#333",
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFF3E0",
    justifyContent: "center",
    alignItems: "center",
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
  },
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
    marginBottom: 24,
  },
  actionCard: {
    width: "48%",
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#fff",
    alignItems: "center",
    margin: 4,
  },
  actionText: {
    marginTop: 8,
    color: "#666",
    textAlign: "center",
  },
  logoutButton: {
    marginTop: 16,
    borderRadius: 8,
  },
});
