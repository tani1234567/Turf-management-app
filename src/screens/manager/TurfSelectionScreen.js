import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
} from "react-native";
import {
  Text,
  Surface,
  ActivityIndicator,
  Button,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSelectedTurf } from "../../hooks/useSelectedTurf";
import { queryDocuments } from "../../services/firebase/firestore";
import { isRemoteImageUri } from "../../services/firebase/turfImages";

const MANAGER_BLUE = "#2196F3";

// Helper: today's date string
const getTodayString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function TurfSelectionScreen({ navigation, route }) {
  const { nextScreen } = route.params || {};
  const {
    allTurfs,
    selectedTurfId,
    hasMultipleTurfs,
    isLoading,
    changeTurf,
  } = useSelectedTurf();

  const [turfStats, setTurfStats] = useState({});
  const [statsLoading, setStatsLoading] = useState(true);

  // Auto-skip if only one turf
  useEffect(() => {
    if (!isLoading && !hasMultipleTurfs && selectedTurfId) {
      if (nextScreen) {
        // Navigate directly to the specified screen with the single turf
        navigation.replace(nextScreen, { turfId: selectedTurfId });
      } else {
        navigation.goBack();
      }
    }
  }, [isLoading, hasMultipleTurfs, selectedTurfId, navigation, nextScreen]);

  // Load today's stats for each turf
  useEffect(() => {
    if (allTurfs.length === 0) return;

    const loadStats = async () => {
      setStatsLoading(true);
      const today = getTodayString();
      const stats = {};

      try {
        const promises = allTurfs.map(async (turf) => {
          const bookings = await queryDocuments("bookings", [
            { field: "turfId", operator: "==", value: turf.id },
          ]);

          const todayBookings = bookings.filter((b) => b.date === today);
          const confirmed = todayBookings.filter(
            (b) => b.status === "confirmed" || b.status === "completed"
          );
          const pending = todayBookings.filter((b) => b.status === "pending");
          const revenue = confirmed.reduce(
            (sum, b) => sum + (b.totalAmount || b.payment?.slotAmount || b.amount || 0),
            0
          );

          stats[turf.id] = {
            todayBookings: confirmed.length,
            pendingRequests: pending.length,
            todayRevenue: revenue,
          };
        });

        await Promise.all(promises);
        setTurfStats(stats);
      } catch (error) {
        console.error("Error loading turf stats:", error);
      } finally {
        setStatsLoading(false);
      }
    };

    loadStats();
  }, [allTurfs]);

  const handleSelect = async (turfId) => {
    await changeTurf(turfId);
    if (nextScreen) {
      // Navigate to the specified screen with selected turf
      navigation.replace(nextScreen, { turfId });
    } else {
      navigation.goBack();
    }
  };

  const renderTurfCard = ({ item: turf }) => {
    const isSelected = turf.id === selectedTurfId;
    const stats = turfStats[turf.id] || {};
    const turfImageUri = [turf.imageUrl, turf.images?.[0]].find((uri) =>
      isRemoteImageUri(uri)
    );

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => handleSelect(turf.id)}
      >
        <Surface
          style={[
            styles.turfCard,
            isSelected && styles.turfCardSelected,
          ]}
          elevation={isSelected ? 3 : 1}
        >
          {/* Turf Image */}
          <View style={styles.imageContainer}>
            {turfImageUri ? (
              <Image
                source={{ uri: turfImageUri }}
                style={styles.turfImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.placeholderImage}>
                <MaterialCommunityIcons
                  name="soccer-field"
                  size={48}
                  color="#bbb"
                />
              </View>
            )}
            {isSelected && (
              <View style={styles.selectedBadge}>
                <MaterialCommunityIcons
                  name="check-circle"
                  size={24}
                  color="#fff"
                />
              </View>
            )}
          </View>

          {/* Turf Info */}
          <View style={styles.turfInfo}>
            <Text variant="titleMedium" style={styles.turfName}>
              {turf.name}
            </Text>

            {(turf.location || turf.address) && (
              <View style={styles.locationRow}>
                <MaterialCommunityIcons
                  name="map-marker-outline"
                  size={14}
                  color="#666"
                />
                <Text
                  variant="bodySmall"
                  style={styles.locationText}
                  numberOfLines={1}
                >
                  {typeof turf.location === "object"
                    ? turf.location.address || `${turf.location.city || ""}, ${turf.location.state || ""}`.trim().replace(/^,\s*|,\s*$/g, "")
                    : turf.location || turf.address}
                </Text>
              </View>
            )}

            {/* Today's Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <MaterialCommunityIcons
                  name="calendar-check"
                  size={16}
                  color="#4CAF50"
                />
                <Text variant="labelSmall" style={styles.statText}>
                  {statsLoading ? "..." : stats.todayBookings || 0} bookings
                </Text>
              </View>

              <View style={styles.statItem}>
                <MaterialCommunityIcons
                  name="clock-alert-outline"
                  size={16}
                  color="#FF9800"
                />
                <Text variant="labelSmall" style={styles.statText}>
                  {statsLoading ? "..." : stats.pendingRequests || 0} pending
                </Text>
              </View>

              <View style={styles.statItem}>
                <MaterialCommunityIcons
                  name="currency-inr"
                  size={16}
                  color="#2196F3"
                />
                <Text variant="labelSmall" style={styles.statText}>
                  {statsLoading
                    ? "..."
                    : `₹${stats.todayRevenue || 0}`}
                </Text>
              </View>
            </View>
          </View>
        </Surface>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={MANAGER_BLUE} />
          <Text variant="bodyMedium" style={styles.loadingText}>
            Loading turfs...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (allTurfs.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <IconHeader navigation={navigation} title="Select Turf" />
        </View>
        <View style={styles.emptyContainer}>
          <Surface style={styles.emptyCard} elevation={1}>
            <MaterialCommunityIcons
              name="soccer-field"
              size={64}
              color="#ccc"
            />
            <Text variant="titleMedium" style={styles.emptyTitle}>
              No Turfs Assigned
            </Text>
            <Text variant="bodyMedium" style={styles.emptySubtext}>
              Contact your owner to get turfs assigned to your account.
            </Text>
          </Surface>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text variant="headlineSmall" style={styles.title}>
            Select Turf
          </Text>
          <Text variant="bodySmall" style={styles.subtitle}>
            Choose which turf to manage
          </Text>
        </View>
      </View>

      {/* Turf List */}
      <FlatList
        data={allTurfs}
        keyExtractor={(item) => item.id}
        renderItem={renderTurfCard}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    color: "#666",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    paddingBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  headerTextContainer: {
    flex: 1,
  },
  title: {
    fontWeight: "bold",
    color: "#333",
  },
  subtitle: {
    color: "#666",
    marginTop: 2,
  },

  // List
  listContent: {
    padding: 16,
    paddingTop: 8,
  },

  // Turf Card
  turfCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
  },
  turfCardSelected: {
    borderColor: MANAGER_BLUE,
  },

  // Image
  imageContainer: {
    height: 140,
    width: "100%",
    position: "relative",
  },
  turfImage: {
    width: "100%",
    height: "100%",
  },
  placeholderImage: {
    width: "100%",
    height: "100%",
    backgroundColor: "#E8E8E8",
    justifyContent: "center",
    alignItems: "center",
  },
  selectedBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: MANAGER_BLUE,
    justifyContent: "center",
    alignItems: "center",
  },

  // Info
  turfInfo: {
    padding: 14,
  },
  turfName: {
    fontWeight: "bold",
    color: "#333",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  locationText: {
    color: "#666",
    marginLeft: 4,
    flex: 1,
  },

  // Stats
  statsRow: {
    flexDirection: "row",
    marginTop: 12,
    gap: 16,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statText: {
    color: "#555",
  },

  // Empty
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
  emptySubtext: {
    marginTop: 8,
    color: "#999",
    textAlign: "center",
  },
});
