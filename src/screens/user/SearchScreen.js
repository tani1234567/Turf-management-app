import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Image,
  ScrollView,
} from "react-native";
import {
  Text,
  Searchbar,
  Chip,
  Surface,
  ActivityIndicator,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { queryDocuments } from "../../services/firebase/firestore";
import { FONTS } from "../../constants/theme";

const USER_COLOR = "#4CAF50";

const SPORTS_FILTERS = [
  { id: "all", label: "All", icon: "apps" },
  { id: "football", label: "Football", icon: "soccer" },
  { id: "cricket", label: "Cricket", icon: "cricket" },
  { id: "badminton", label: "Badminton", icon: "badminton" },
  { id: "tennis", label: "Tennis", icon: "tennis" },
  { id: "basketball", label: "Basketball", icon: "basketball" },
  { id: "volleyball", label: "Volleyball", icon: "volleyball" },
];

const formatLocationText = (location) => {
  if (!location) return "";
  if (typeof location === "string") return location;
  const parts = [location.area, location.city].filter(Boolean);
  if (parts.length > 0) return parts.join(", ");
  return location.address || "";
};

const getMinPriceFromGrounds = (grounds) => {
  if (!grounds || grounds.length === 0) return null;
  let minPrice = Infinity;
  grounds.forEach((ground) => {
    const pricing = ground.pricing;
    if (!pricing) return;
    if (pricing.allDayRate && pricing.allDayRate < minPrice) {
      minPrice = pricing.allDayRate;
    }
    if (pricing.weekday) {
      ["morning", "afternoon", "evening"].forEach((slot) => {
        const rate = pricing.weekday[slot]?.rate;
        if (rate && rate < minPrice) minPrice = rate;
      });
    }
    if (pricing.weekend) {
      ["morning", "afternoon", "evening"].forEach((slot) => {
        const rate = pricing.weekend[slot]?.rate;
        if (rate && rate < minPrice) minPrice = rate;
      });
    }
  });
  return minPrice === Infinity ? null : minPrice;
};

export default function SearchScreen({ navigation }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [turfs, setTurfs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Ref for search to avoid keyboard dismiss
  const searchQueryRef = useRef("");

  const handleSearchChange = useCallback((text) => {
    searchQueryRef.current = text;
    setSearchQuery(text);
  }, []);

  // Fetch and filter turfs
  const fetchTurfs = useCallback(async ({ refresh = false } = {}) => {
    try {
      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const constraints = [
        { field: "isActive", operator: "==", value: true },
      ];

      const turfsData = await queryDocuments("turfs", constraints);

      let mapped = turfsData.map((doc) => {
        const minPrice = getMinPriceFromGrounds(doc.grounds);
        return {
          id: doc.id,
          ...doc,
          locationText: formatLocationText(doc.location),
          rating: doc.rating || 4.0,
          reviewCount: doc.reviewCount || 0,
          pricePerHour: minPrice || doc.pricePerHour || 0,
          imageUrl: doc.imageUrl || doc.coverImage || null,
        };
      });

      // Sport filter (case-insensitive, checks turf.sports + grounds[].sports)
      if (selectedFilter !== "all") {
        mapped = mapped.filter((turf) => {
          const turfSports = (turf.sports || []).map((s) => s.toLowerCase());
          const groundSports = (turf.grounds || [])
            .flatMap((g) => g.sports || [])
            .map((s) => s.toLowerCase());
          const allSports = [...new Set([...turfSports, ...groundSports])];
          return allSports.includes(selectedFilter.toLowerCase());
        });
      }

      // Search filter
      const currentSearch = searchQueryRef.current.trim();
      if (currentSearch) {
        const query = currentSearch.toLowerCase();
        mapped = mapped.filter((turf) => {
          const matchesName = turf.name?.toLowerCase().includes(query);
          const matchesLocation = (turf.locationText || "").toLowerCase().includes(query);
          const matchesSport = (turf.sports || []).some((s) =>
            s.toLowerCase().includes(query)
          );
          return matchesName || matchesLocation || matchesSport;
        });
      }

      // Sort by rating
      mapped.sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating));

      setTurfs(mapped);
    } catch (error) {
      console.error("Error fetching turfs:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedFilter]);

  // Initial fetch
  useEffect(() => {
    fetchTurfs();
  }, []);

  // Refetch when sport filter changes
  useEffect(() => {
    fetchTurfs({ refresh: true });
  }, [selectedFilter]);

  // Submit search
  const handleSearchSubmit = useCallback(() => {
    fetchTurfs({ refresh: true });
  }, [fetchTurfs]);

  const onRefresh = useCallback(() => {
    fetchTurfs({ refresh: true });
  }, [fetchTurfs]);

  // Render turf card
  const renderTurfCard = ({ item }) => (
    <TouchableOpacity
      style={styles.turfCard}
      onPress={() => navigation.navigate("TurfDetails", { turfId: item.id })}
      activeOpacity={0.8}
    >
      <Surface style={styles.cardSurface} elevation={2}>
        <View style={styles.cardRow}>
          {/* Image */}
          <View style={styles.cardImageContainer}>
            {item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} style={styles.cardImage} />
            ) : (
              <View style={[styles.cardImage, styles.placeholderImage]}>
                <MaterialCommunityIcons name="soccer-field" size={32} color="#ccc" />
              </View>
            )}
          </View>

          {/* Content */}
          <View style={styles.cardContent}>
            <Text variant="titleSmall" style={styles.turfName} numberOfLines={1}>
              {item.name}
            </Text>

            <View style={styles.locationRow}>
              <MaterialCommunityIcons name="map-marker" size={14} color="#666" />
              <Text variant="bodySmall" style={styles.locationText} numberOfLines={1}>
                {item.locationText || "Location not specified"}
              </Text>
            </View>

            {/* Sports */}
            <View style={styles.sportsList}>
              {(item.sports || []).slice(0, 3).map((sport, idx) => (
                <View key={idx} style={styles.sportTag}>
                  <Text style={styles.sportTagText}>{sport}</Text>
                </View>
              ))}
            </View>

            <View style={styles.bottomRow}>
              <View style={styles.ratingRow}>
                <MaterialCommunityIcons name="star" size={14} color="#FFD700" />
                <Text variant="bodySmall" style={styles.ratingText}>
                  {item.rating} ({item.reviewCount})
                </Text>
              </View>
              <View style={styles.priceRow}>
                <Text variant="titleSmall" style={styles.priceText}>
                  ₹{item.pricePerHour}
                </Text>
                <Text variant="bodySmall" style={styles.perHourText}>/hr</Text>
              </View>
            </View>
          </View>
        </View>
      </Surface>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Surface style={styles.emptyCard} elevation={1}>
        <MaterialCommunityIcons name="soccer-field" size={64} color="#ccc" />
        <Text variant="titleMedium" style={styles.emptyTitle}>
          {searchQueryRef.current.trim() || selectedFilter !== "all"
            ? "No turfs found"
            : "Search for Turfs"}
        </Text>
        <Text variant="bodyMedium" style={styles.emptyText}>
          {searchQueryRef.current.trim() || selectedFilter !== "all"
            ? "Try a different search or filter"
            : "Enter a location or turf name to find available turfs near you"}
        </Text>
      </Surface>
    </View>
  );

  const renderHeader = () => (
    <>
      {/* Results count */}
      {!loading && turfs.length > 0 && (
        <View style={styles.resultsHeader}>
          <Text variant="bodyMedium" style={styles.resultsCount}>
            {turfs.length} turf{turfs.length !== 1 ? "s" : ""} found
          </Text>
        </View>
      )}
    </>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.headerWrapper}>
        <Text style={styles.title}>Find a Turf</Text>
        <Text style={styles.subtitle}>Discover & book sports grounds near you</Text>
        <Searchbar
          placeholder="Search by name or location..."
          value={searchQuery}
          onChangeText={handleSearchChange}
          onSubmitEditing={handleSearchSubmit}
          style={styles.searchbar}
          inputStyle={styles.searchInput}
          icon="magnify"
        />
      </View>

      {/* Sport Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersContainer}
        contentContainerStyle={styles.filtersList}
      >
        {SPORTS_FILTERS.map((item) => (
          <Chip
            key={item.id}
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
                size={18}
                color={selectedFilter === item.id ? "#fff" : "#666"}
              />
            )}
            compact
          >
            {item.label}
          </Chip>
        ))}
      </ScrollView>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={USER_COLOR} />
          <Text variant="bodyMedium" style={styles.loadingText}>
            Finding turfs...
          </Text>
        </View>
      ) : (
        <FlatList
          data={turfs}
          renderItem={renderTurfCard}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader()}
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[USER_COLOR]}
              tintColor={USER_COLOR}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  headerWrapper: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#ebebeb",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 4,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 22,
    color: "#111",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: "#888",
    marginTop: 2,
  },
  searchbar: {
    marginTop: 12,
    borderRadius: 12,
    elevation: 0,
    backgroundColor: "#f5f5f5",
    borderWidth: 1,
    borderColor: "#e8e8e8",
    maxHeight: 40,
    alignContent: "center",
    alignItems: "center",
    
  },
  searchInput: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    paddingVertical: 0,
    textAlignVertical: "center",
    alignSelf: "center",
  },
  filtersContainer: {
    marginTop: 8,
    marginBottom: 0,
    maxHeight: 44,
  },
  filtersList: {
    paddingHorizontal: 16,
    alignItems: "center",
  },
  filterChip: {
    marginRight: 8,
    backgroundColor: "#fff",
    height: 32,
  },
  filterChipSelected: {
    backgroundColor: USER_COLOR,
  },
  filterText: {
    color: "#666",
  },
  filterTextSelected: {
    color: "#fff",
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
  listContent: {
    paddingBottom: 16,
  },
  resultsHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  resultsCount: {
    color: "#666",
  },
  turfCard: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  cardSurface: {
    borderRadius: 10,
    backgroundColor: "#fff",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#efefef",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 5,
  },
  cardRow: {
    flexDirection: "row",
  },
  cardImageContainer: {
    width: 110,
    height: 120,
  },
  cardImage: {
    width: "100%",
    height: "100%",
  },
  placeholderImage: {
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
  },
  cardContent: {
    flex: 1,
    padding: 10,
    justifyContent: "space-between",
  },
  turfName: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: "#1a1a1a",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
  },
  locationText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: "#888",
    marginLeft: 3,
    flex: 1,
  },
  sportsList: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 5,
    gap: 4,
  },
  sportTag: {
    backgroundColor: "#10B98114",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  sportTagText: {
    color: "#10B981",
    fontFamily: FONTS.medium,
    fontSize: 10,
    textTransform: "capitalize",
  },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  ratingText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: "#555",
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 1,
  },
  priceText: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: "#10B981",
  },
  perHourText: {
    fontFamily: FONTS.regular,
    color: "#999",
    fontSize: 11,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    padding: 16,
    paddingTop: 40,
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
