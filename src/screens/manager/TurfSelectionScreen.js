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

const MANAGER_BLUE = "#3B82F6";
const PALE_BLUE = "#DBEAFE";
const SUCCESS_GREEN = "#22C55E";
const WARN_ORANGE = "#F59E0B";

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
        activeOpacity={0.85}
        onPress={() => handleSelect(turf.id)}
        style={[styles.turfCard, isSelected && styles.turfCardSelected]}
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
              <MaterialCommunityIcons name="soccer-field" size={48} color="#9CA3AF" />
            </View>
          )}
          {isSelected && (
            <View style={styles.selectedBadge}>
              <MaterialCommunityIcons name="check-circle" size={22} color="#fff" />
              <Text style={styles.selectedBadgeText}>Active</Text>
            </View>
          )}
          {/* Gradient overlay for text readability */}
          <View style={styles.imageOverlay} />
        </View>

        {/* Turf Info */}
        <View style={styles.turfInfo}>
          <Text style={styles.turfName} numberOfLines={1}>{turf.name}</Text>

          {(turf.location || turf.address) && (
            <View style={styles.locationRow}>
              <MaterialCommunityIcons name="map-marker-outline" size={13} color="#6B7280" />
              <Text style={styles.locationText} numberOfLines={1}>
                {typeof turf.location === "object"
                  ? turf.location.address || `${turf.location.city || ""}, ${turf.location.state || ""}`.trim().replace(/^,\s*|,\s*$/g, "")
                  : turf.location || turf.address}
              </Text>
            </View>
          )}

          {/* Today's Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statPill}>
              <MaterialCommunityIcons name="calendar-check" size={14} color={SUCCESS_GREEN} />
              <Text style={[styles.statText, { color: SUCCESS_GREEN }]}>
                {statsLoading ? "—" : stats.todayBookings || 0} booked
              </Text>
            </View>
            <View style={styles.statPill}>
              <MaterialCommunityIcons name="clock-alert-outline" size={14} color={WARN_ORANGE} />
              <Text style={[styles.statText, { color: WARN_ORANGE }]}>
                {statsLoading ? "—" : stats.pendingRequests || 0} pending
              </Text>
            </View>
            <View style={styles.statPill}>
              <MaterialCommunityIcons name="currency-inr" size={14} color={MANAGER_BLUE} />
              <Text style={[styles.statText, { color: MANAGER_BLUE }]}>
                {statsLoading ? "—" : `₹${stats.todayRevenue || 0}`}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={MANAGER_BLUE} />
          <Text style={styles.loadingText}>Loading turfs...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (allTurfs.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={22} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.title}>Select Turf</Text>
        </View>
        <View style={styles.emptyContainer}>
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <MaterialCommunityIcons name="soccer-field" size={40} color={MANAGER_BLUE} />
            </View>
            <Text style={styles.emptyTitle}>No Turfs Assigned</Text>
            <Text style={styles.emptySubtext}>
              Contact your owner to get turfs assigned to your account.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#374151" />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.title}>Select Turf</Text>
          <Text style={styles.subtitle}>Choose which turf to manage</Text>
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
    backgroundColor: "#F0F4F8",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontFamily: "Ubuntu-Regular",
    fontSize: 14,
    color: "#6B7280",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTextContainer: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontFamily: "Ubuntu-Bold",
    color: "#111827",
  },
  subtitle: {
    fontSize: 12,
    fontFamily: "Ubuntu-Regular",
    color: "#6B7280",
    marginTop: 1,
  },

  // List
  listContent: {
    padding: 16,
    paddingTop: 12,
  },

  // Turf Card
  turfCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  turfCardSelected: {
    borderColor: MANAGER_BLUE,
  },

  // Image
  imageContainer: {
    height: 150,
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
    backgroundColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
  },
  imageOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
    backgroundColor: "rgba(0,0,0,0.1)",
  },
  selectedBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: MANAGER_BLUE,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 4,
  },
  selectedBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Ubuntu-Bold",
  },

  // Info
  turfInfo: {
    padding: 14,
  },
  turfName: {
    fontSize: 16,
    fontFamily: "Ubuntu-Bold",
    color: "#111827",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 4,
  },
  locationText: {
    fontSize: 12,
    fontFamily: "Ubuntu-Regular",
    color: "#6B7280",
    flex: 1,
  },

  // Stats
  statsRow: {
    flexDirection: "row",
    marginTop: 12,
    gap: 8,
  },
  statPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4,
  },
  statText: {
    fontSize: 12,
    fontFamily: "Ubuntu-Medium",
  },

  // Empty
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    padding: 16,
  },
  emptyCard: {
    padding: 36,
    borderRadius: 16,
    backgroundColor: "#fff",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: PALE_BLUE,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: "Ubuntu-Bold",
    color: "#111827",
    marginBottom: 6,
  },
  emptySubtext: {
    fontSize: 13,
    fontFamily: "Ubuntu-Regular",
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 20,
  },
});
