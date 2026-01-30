import React, { useState } from "react";
import { View, StyleSheet, FlatList } from "react-native";
import { Text, Searchbar, Chip, Surface } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";

const SPORTS_FILTERS = [
  { id: "all", label: "All", icon: "soccer" },
  { id: "football", label: "Football", icon: "soccer" },
  { id: "cricket", label: "Cricket", icon: "cricket" },
  { id: "badminton", label: "Badminton", icon: "badminton" },
  { id: "tennis", label: "Tennis", icon: "tennis" },
];

export default function SearchScreen() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("all");

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text variant="headlineSmall" style={styles.title}>
          Find a Turf
        </Text>
      </View>

      {/* Search Bar */}
      <Searchbar
        placeholder="Search by name or location..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        style={styles.searchbar}
        inputStyle={styles.searchInput}
      />

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={SPORTS_FILTERS}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Chip
              selected={selectedFilter === item.id}
              onPress={() => setSelectedFilter(item.id)}
              style={[
                styles.filterChip,
                selectedFilter === item.id && styles.filterChipSelected,
              ]}
              textStyle={[
                styles.filterText,
                selectedFilter === item.id && styles.filterTextSelected,
              ]}
              icon={() => (
                <MaterialCommunityIcons
                  name={item.icon}
                  size={16}
                  color={selectedFilter === item.id ? "#fff" : "#666"}
                />
              )}
            >
              {item.label}
            </Chip>
          )}
          contentContainerStyle={styles.filtersList}
        />
      </View>

      {/* Empty State */}
      <View style={styles.emptyContainer}>
        <Surface style={styles.emptyCard} elevation={1}>
          <MaterialCommunityIcons name="soccer-field" size={64} color="#ccc" />
          <Text variant="titleMedium" style={styles.emptyTitle}>
            Search for Turfs
          </Text>
          <Text variant="bodyMedium" style={styles.emptyText}>
            Enter a location or turf name to find available turfs near you
          </Text>
        </Surface>
      </View>
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
  searchbar: {
    marginHorizontal: 16,
    borderRadius: 12,
    elevation: 2,
  },
  searchInput: {
    fontSize: 14,
  },
  filtersContainer: {
    marginTop: 16,
  },
  filtersList: {
    paddingHorizontal: 16,
  },
  filterChip: {
    marginRight: 8,
    backgroundColor: "#fff",
  },
  filterChipSelected: {
    backgroundColor: "#4CAF50",
  },
  filterText: {
    color: "#666",
  },
  filterTextSelected: {
    color: "#fff",
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
});
