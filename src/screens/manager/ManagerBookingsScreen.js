import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { Text, SegmentedButtons, Surface, FAB } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export default function ManagerBookingsScreen() {
  const [selectedTab, setSelectedTab] = useState("pending");

  const EmptyState = ({ icon, title, subtitle }) => (
    <View style={styles.emptyContainer}>
      <Surface style={styles.emptyCard} elevation={1}>
        <MaterialCommunityIcons name={icon} size={64} color="#ccc" />
        <Text variant="titleMedium" style={styles.emptyTitle}>
          {title}
        </Text>
        <Text variant="bodyMedium" style={styles.emptyText}>
          {subtitle}
        </Text>
      </Surface>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text variant="headlineSmall" style={styles.title}>
          Manage Bookings
        </Text>
      </View>

      {/* Tabs */}
      <SegmentedButtons
        value={selectedTab}
        onValueChange={setSelectedTab}
        buttons={[
          { value: "pending", label: "Pending" },
          { value: "confirmed", label: "Confirmed" },
          { value: "completed", label: "Completed" },
        ]}
        style={styles.tabs}
      />

      {/* Content */}
      {selectedTab === "pending" && (
        <EmptyState
          icon="clock-outline"
          title="No Pending Bookings"
          subtitle="New booking requests will appear here"
        />
      )}
      {selectedTab === "confirmed" && (
        <EmptyState
          icon="calendar-check"
          title="No Confirmed Bookings"
          subtitle="Confirmed bookings will show up here"
        />
      )}
      {selectedTab === "completed" && (
        <EmptyState
          icon="check-circle"
          title="No Completed Bookings"
          subtitle="Past bookings will appear here"
        />
      )}

      {/* FAB */}
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => console.log("Add manual booking")}
        label="Add Booking"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    padding: 16,
    paddingBottom: 8,
  },
  title: {
    fontWeight: "bold",
    color: "#333",
  },
  tabs: {
    marginHorizontal: 16,
    marginTop: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    padding: 16,
  },
  emptyCard: {
    padding: 32,
    borderRadius: 16,
    backgroundColor: "#fff",
    alignItems: "center",
  },
  emptyTitle: {
    marginTop: 16,
    fontWeight: "600",
    color: "#333",
  },
  emptyText: {
    marginTop: 8,
    color: "#999",
    textAlign: "center",
  },
  fab: {
    position: "absolute",
    right: 16,
    bottom: 16,
    backgroundColor: "#2196F3",
  },
});
