import { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
  Image,
  ScrollView,
} from "react-native";
import {
  Text,
  Surface,
  Searchbar,
  Chip,
  IconButton,
  Dialog,
  Portal,
  Button,
  Divider,
  Badge,
  ActivityIndicator,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSelector } from "react-redux";

import { selectUser } from "../../store/slices/authSlice";
import { queryDocuments } from "../../services/firebase/firestore";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const USER_COLOR = "#4CAF50";
const CARD_MARGIN = 8;
const GRID_CARD_WIDTH = (SCREEN_WIDTH - 48 - CARD_MARGIN) / 2;

// Sports options for filter
const SPORTS = [
  { id: "all", label: "All", icon: "apps" },
  { id: "football", label: "Football", icon: "soccer" },
  { id: "cricket", label: "Cricket", icon: "cricket" },
  { id: "badminton", label: "Badminton", icon: "badminton" },
  { id: "tennis", label: "Tennis", icon: "tennis" },
  { id: "basketball", label: "Basketball", icon: "basketball" },
  { id: "volleyball", label: "Volleyball", icon: "volleyball" },
];

// Amenities for filter
const AMENITIES = [
  { id: "parking", label: "Parking", icon: "parking" },
  { id: "washroom", label: "Washroom", icon: "toilet" },
  { id: "changing_room", label: "Changing Room", icon: "door" },
  { id: "drinking_water", label: "Drinking Water", icon: "water" },
  { id: "floodlights", label: "Floodlights", icon: "lightbulb-on" },
  { id: "first_aid", label: "First Aid", icon: "medical-bag" },
  { id: "equipment_rental", label: "Equipment", icon: "tennis-ball" },
  { id: "cafeteria", label: "Cafeteria", icon: "food" },
];

const ITEMS_PER_PAGE = 10;

const formatLocationText = (location) => {
  if (!location) return "";
  if (typeof location === "string") return location;
  const parts = [location.city, location.state].filter(Boolean);
  if (parts.length > 0) return parts.join(", ");
  return location.address || location.googleMapsLink || "";
};

// Calculate minimum price from grounds pricing
const getMinPriceFromGrounds = (grounds) => {
  if (!grounds || grounds.length === 0) return null;

  let minPrice = Infinity;

  grounds.forEach((ground) => {
    const pricing = ground.pricing;
    if (!pricing) return;

    // Check all day rate
    if (pricing.allDayRate && pricing.allDayRate < minPrice) {
      minPrice = pricing.allDayRate;
    }

    // Check weekday rates
    if (pricing.weekday) {
      ["morning", "afternoon", "evening"].forEach((slot) => {
        const rate = pricing.weekday[slot]?.rate;
        if (rate && rate < minPrice) {
          minPrice = rate;
        }
      });
    }

    // Check weekend rates
    if (pricing.weekend) {
      ["morning", "afternoon", "evening"].forEach((slot) => {
        const rate = pricing.weekend[slot]?.rate;
        if (rate && rate < minPrice) {
          minPrice = rate;
        }
      });
    }
  });

  return minPrice === Infinity ? null : minPrice;
};

export default function HomeScreen({ navigation }) {
  const user = useSelector(selectUser);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState(["Football near me", "Cricket turf", "Weekend booking"]);
  const [showRecentSearches, setShowRecentSearches] = useState(false);

  // View state
  const [viewMode, setViewMode] = useState("grid"); // "grid" or "list"

  // Filter state
  const [selectedSport, setSelectedSport] = useState("all");
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [priceRange, setPriceRange] = useState([0, 5000]);
  const [selectedAmenities, setSelectedAmenities] = useState([]);
  const [minRating, setMinRating] = useState(0);
  const [maxDistance, setMaxDistance] = useState(50);
  const [activeFiltersCount, setActiveFiltersCount] = useState(0);

  // Data state
  const [turfs, setTurfs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Location state
  const [userLocation, setUserLocation] = useState("Detecting location...");

  // Calculate active filters count
  useEffect(() => {
    let count = 0;
    if (priceRange[0] > 0 || priceRange[1] < 5000) count++;
    if (selectedAmenities.length > 0) count++;
    if (minRating > 0) count++;
    if (maxDistance < 50) count++;
    setActiveFiltersCount(count);
  }, [priceRange, selectedAmenities, minRating, maxDistance]);

  // Fetch turfs from Firestore
  const fetchTurfs = useCallback(async ({ refresh = false } = {}) => {
    try {
      if (refresh) {
        setRefreshing(true);
        setPage(1);
      } else if (!refresh && page === 1) {
        setLoading(true);
      }

      // Build query constraints
      const constraints = [
        { field: "isActive", operator: "==", value: true },
      ];

      // Add sport filter
      if (selectedSport !== "all") {
        constraints.push({
          field: "sports",
          operator: "array-contains",
          value: selectedSport,
        });
      }

      const turfsData = await queryDocuments("turfs", constraints);

      // Filter turfs locally for additional criteria
      let filteredTurfs = turfsData.map(doc => {
        // Get actual minimum price from grounds
        const minPrice = getMinPriceFromGrounds(doc.grounds);

        return {
          id: doc.id,
          ...doc,
          locationText: formatLocationText(doc.location),
          // Use actual data or defaults for display
          rating: doc.rating || 4.0,
          reviewCount: doc.reviewCount || 0,
          distance: doc.distance || null,
          pricePerHour: minPrice || doc.pricePerHour || 0,
          imageUrl: doc.imageUrl || doc.coverImage || null,
        };
      });

      // Apply local filters
      filteredTurfs = filteredTurfs.filter(turf => {
        // Price filter
        const price = turf.pricePerHour || 0;
        if (price < priceRange[0] || price > priceRange[1]) return false;

        // Rating filter
        const rating = parseFloat(turf.rating) || 0;
        if (rating < minRating) return false;

        // Amenities filter
        if (selectedAmenities.length > 0) {
          const turfAmenities = turf.amenities || [];
          const hasAllAmenities = selectedAmenities.every(a => turfAmenities.includes(a));
          if (!hasAllAmenities) return false;
        }

        // Search filter
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          const matchesName = turf.name?.toLowerCase().includes(query);
          const matchesLocation = (turf.locationText || "")
            .toLowerCase()
            .includes(query);
          const matchesSport = turf.sports?.some(s => s.toLowerCase().includes(query));
          if (!matchesName && !matchesLocation && !matchesSport) return false;
        }

        return true;
      });

      // Sort by rating
      filteredTurfs.sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating));

      // Pagination
      const startIndex = 0;
      const endIndex = page * ITEMS_PER_PAGE;
      const paginatedTurfs = filteredTurfs.slice(startIndex, endIndex);

      setTurfs(paginatedTurfs);
      setHasMore(paginatedTurfs.length < filteredTurfs.length);
    } catch (error) {
      console.error("Error fetching turfs:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [selectedSport, priceRange, minRating, selectedAmenities, searchQuery, page]);

  // Initial fetch
  useEffect(() => {
    fetchTurfs();
    // Simulate location detection
    setTimeout(() => {
      setUserLocation("Mumbai, Maharashtra");
    }, 1000);
  }, []);

  // Refetch when filters change
  useEffect(() => {
    setPage(1);
    fetchTurfs({ refresh: true });
  }, [selectedSport, priceRange, minRating, selectedAmenities]);

  // Handle search
  const handleSearch = useCallback(() => {
    if (searchQuery.trim()) {
      // Add to recent searches
      setRecentSearches(prev => {
        const updated = [searchQuery, ...prev.filter(s => s !== searchQuery)].slice(0, 5);
        return updated;
      });
      setShowRecentSearches(false);
      setPage(1);
      fetchTurfs({ refresh: true });
    }
  }, [searchQuery, fetchTurfs]);

  // Load more turfs
  const loadMoreTurfs = useCallback(() => {
    if (!loadingMore && hasMore) {
      setLoadingMore(true);
      setPage(prev => prev + 1);
    }
  }, [loadingMore, hasMore]);

  useEffect(() => {
    if (page > 1) {
      fetchTurfs();
    }
  }, [page]);

  // Handle refresh
  const onRefresh = useCallback(() => {
    fetchTurfs({ refresh: true });
  }, [fetchTurfs]);

  // Toggle amenity selection
  const toggleAmenity = (amenityId) => {
    setSelectedAmenities(prev =>
      prev.includes(amenityId)
        ? prev.filter(a => a !== amenityId)
        : [...prev, amenityId]
    );
  };

  // Clear all filters
  const clearFilters = () => {
    setPriceRange([0, 5000]);
    setSelectedAmenities([]);
    setMinRating(0);
    setMaxDistance(50);
    setSelectedSport("all");
    setSearchQuery("");
  };

  // Apply filters
  const applyFilters = () => {
    setFilterModalVisible(false);
    setPage(1);
    fetchTurfs({ refresh: true });
  };

  // Render turf card
  const renderTurfCard = ({ item, index }) => {
    const isGrid = viewMode === "grid";

    return (
      <TouchableOpacity
        style={[
          styles.turfCard,
          isGrid ? styles.gridCard : styles.listCard,
        ]}
        onPress={() => navigation.navigate("TurfDetails", { turfId: item.id })}
        activeOpacity={0.8}
      >
        <Surface style={[styles.cardSurface, isGrid && styles.gridCardSurface]} elevation={2}>
          {/* Image */}
          <View style={[styles.cardImageContainer, isGrid && styles.gridImageContainer]}>
            {item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} style={styles.cardImage} />
            ) : (
              <View style={[styles.cardImage, styles.placeholderImage]}>
                <MaterialCommunityIcons name="soccer-field" size={isGrid ? 32 : 48} color="#ccc" />
              </View>
            )}
            {/* Rating badge */}
            <View style={styles.ratingBadge}>
              <MaterialCommunityIcons name="star" size={12} color="#FFD700" />
              <Text style={styles.ratingText}>{item.rating}</Text>
            </View>
            {/* Sport badges */}
            <View style={styles.sportBadges}>
              {(item.sports || []).slice(0, 2).map((sport, idx) => (
                <View key={idx} style={styles.sportBadge}>
                  <Text style={styles.sportBadgeText}>{sport}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Content */}
          <View style={[styles.cardContent, isGrid && styles.gridCardContent]}>
            <Text
              variant={isGrid ? "titleSmall" : "titleMedium"}
              style={styles.turfName}
              numberOfLines={1}
            >
              {item.name}
            </Text>

            <View style={styles.locationRow}>
              <MaterialCommunityIcons name="map-marker" size={14} color="#666" />
              <Text variant="bodySmall" style={styles.locationText} numberOfLines={1}>
                {item.locationText || "Location not specified"}
              </Text>
            </View>

            {!isGrid && (
              <>
                <View style={styles.detailsRow}>
                  <View style={styles.detailItem}>
                    <MaterialCommunityIcons name="map-marker-distance" size={14} color={USER_COLOR} />
                    <Text variant="bodySmall" style={styles.detailText}>{item.distance} km</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <MaterialCommunityIcons name="star" size={14} color="#FFD700" />
                    <Text variant="bodySmall" style={styles.detailText}>
                      {item.rating} ({item.reviewCount})
                    </Text>
                  </View>
                </View>

                {/* Amenities preview */}
                <View style={styles.amenitiesPreview}>
                  {(item.amenities || []).slice(0, 4).map((amenity, idx) => {
                    const amenityData = AMENITIES.find(a => a.id === amenity);
                    return amenityData ? (
                      <MaterialCommunityIcons
                        key={idx}
                        name={amenityData.icon}
                        size={14}
                        color="#666"
                        style={styles.amenityIcon}
                      />
                    ) : null;
                  })}
                  {(item.amenities || []).length > 4 && (
                    <Text variant="labelSmall" style={styles.moreAmenities}>
                      +{item.amenities.length - 4}
                    </Text>
                  )}
                </View>
              </>
            )}

            <View style={styles.priceRow}>
              <Text variant={isGrid ? "titleSmall" : "titleMedium"} style={styles.priceText}>
                ₹{item.pricePerHour}
              </Text>
              <Text variant="bodySmall" style={styles.perHourText}>/hr</Text>
            </View>
          </View>
        </Surface>
      </TouchableOpacity>
    );
  };

  // Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons name="soccer-field" size={80} color="#ddd" />
      <Text variant="titleMedium" style={styles.emptyTitle}>
        No turfs found
      </Text>
      <Text variant="bodyMedium" style={styles.emptySubtitle}>
        Try adjusting your filters or search query
      </Text>
      <Button
        mode="outlined"
        onPress={clearFilters}
        style={styles.clearFiltersButton}
      >
        Clear Filters
      </Button>
    </View>
  );

  // Render footer (loading indicator for pagination)
  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={USER_COLOR} />
        <Text variant="bodySmall" style={styles.loadingMoreText}>
          Loading more turfs...
        </Text>
      </View>
    );
  };

  // Render header
  const renderHeader = () => (
    <>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text variant="bodyMedium" style={styles.greeting}>
            Welcome back,
          </Text>
          <Text variant="headlineSmall" style={styles.userName}>
            {user?.name || "User"}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.locationButton}>
            <MaterialCommunityIcons name="map-marker" size={16} color={USER_COLOR} />
            <Text variant="bodySmall" style={styles.locationButtonText} numberOfLines={1}>
              {userLocation}
            </Text>
            <MaterialCommunityIcons name="chevron-down" size={16} color="#666" />
          </TouchableOpacity>
          <IconButton
            icon="bell-outline"
            size={24}
            onPress={() => navigation.navigate("Notifications")}
          />
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="Search turfs, sports, locations..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
          onFocus={() => setShowRecentSearches(true)}
          onBlur={() => setTimeout(() => setShowRecentSearches(false), 200)}
          style={styles.searchbar}
          inputStyle={styles.searchInput}
          icon="magnify"
        />
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setFilterModalVisible(true)}
        >
          <MaterialCommunityIcons name="tune-variant" size={24} color="#fff" />
          {activeFiltersCount > 0 && (
            <Badge style={styles.filterBadge}>{activeFiltersCount}</Badge>
          )}
        </TouchableOpacity>
      </View>

      {/* Recent Searches Dropdown */}
      {showRecentSearches && recentSearches.length > 0 && (
        <Surface style={styles.recentSearchesContainer} elevation={3}>
          <Text variant="labelMedium" style={styles.recentSearchesTitle}>
            Recent Searches
          </Text>
          {recentSearches.map((search, index) => (
            <TouchableOpacity
              key={index}
              style={styles.recentSearchItem}
              onPress={() => {
                setSearchQuery(search);
                setShowRecentSearches(false);
                handleSearch();
              }}
            >
              <MaterialCommunityIcons name="history" size={16} color="#666" />
              <Text variant="bodyMedium" style={styles.recentSearchText}>
                {search}
              </Text>
            </TouchableOpacity>
          ))}
        </Surface>
      )}

      {/* Sport Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.sportsFilterContainer}
        contentContainerStyle={styles.sportsFilterContent}
      >
        {SPORTS.map((sport) => (
          <Chip
            key={sport.id}
            selected={selectedSport === sport.id}
            onPress={() => setSelectedSport(sport.id)}
            style={[
              styles.sportChip,
              selectedSport === sport.id && styles.selectedSportChip,
            ]}
            textStyle={[
              styles.sportChipText,
              selectedSport === sport.id && styles.selectedSportChipText,
            ]}
            icon={() => (
              <MaterialCommunityIcons
                name={sport.icon}
                size={18}
                color={selectedSport === sport.id ? "#fff" : "#666"}
              />
            )}
          >
            {sport.label}
          </Chip>
        ))}
      </ScrollView>

      {/* Results Header */}
      <View style={styles.resultsHeader}>
        <Text variant="titleSmall" style={styles.resultsCount}>
          {turfs.length} turfs found
        </Text>
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[styles.viewButton, viewMode === "grid" && styles.activeViewButton]}
            onPress={() => setViewMode("grid")}
          >
            <MaterialCommunityIcons
              name="view-grid"
              size={20}
              color={viewMode === "grid" ? USER_COLOR : "#999"}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewButton, viewMode === "list" && styles.activeViewButton]}
            onPress={() => setViewMode("list")}
          >
            <MaterialCommunityIcons
              name="view-list"
              size={20}
              color={viewMode === "list" ? USER_COLOR : "#999"}
            />
          </TouchableOpacity>
        </View>
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.container}>
      {loading && page === 1 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={USER_COLOR} />
          <Text variant="bodyMedium" style={styles.loadingText}>
            Finding turfs near you...
          </Text>
        </View>
      ) : (
        <FlatList
          data={turfs}
          renderItem={renderTurfCard}
          keyExtractor={(item) => item.id}
          numColumns={viewMode === "grid" ? 2 : 1}
          key={viewMode} // Re-render when view mode changes
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmptyState}
          ListFooterComponent={renderFooter}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[USER_COLOR]}
              tintColor={USER_COLOR}
            />
          }
          onEndReached={loadMoreTurfs}
          onEndReachedThreshold={0.5}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Filter Modal */}
      <Portal>
        <Dialog
          visible={filterModalVisible}
          onDismiss={() => setFilterModalVisible(false)}
          style={styles.filterDialog}
        >
          <Dialog.Title>Filter Turfs</Dialog.Title>
          <Dialog.ScrollArea style={styles.dialogScrollArea}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Price Range */}
              <View style={styles.filterSection}>
                <Text variant="titleSmall" style={styles.filterSectionTitle}>
                  Price Range (per hour)
                </Text>
                <View style={styles.priceOptions}>
                  {[
                    { label: "Any", range: [0, 5000] },
                    { label: "₹0-500", range: [0, 500] },
                    { label: "₹500-1000", range: [500, 1000] },
                    { label: "₹1000-2000", range: [1000, 2000] },
                    { label: "₹2000+", range: [2000, 5000] },
                  ].map((option) => {
                    const isSelected = priceRange[0] === option.range[0] && priceRange[1] === option.range[1];
                    return (
                      <TouchableOpacity
                        key={option.label}
                        style={[
                          styles.priceOption,
                          isSelected && styles.selectedPriceOption,
                        ]}
                        onPress={() => setPriceRange(option.range)}
                      >
                        <Text
                          style={[
                            styles.priceOptionText,
                            isSelected && styles.selectedPriceOptionText,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <Divider style={styles.filterDivider} />

              {/* Minimum Rating */}
              <View style={styles.filterSection}>
                <Text variant="titleSmall" style={styles.filterSectionTitle}>
                  Minimum Rating
                </Text>
                <View style={styles.ratingOptions}>
                  {[0, 3, 3.5, 4, 4.5].map((rating) => (
                    <TouchableOpacity
                      key={rating}
                      style={[
                        styles.ratingOption,
                        minRating === rating && styles.selectedRatingOption,
                      ]}
                      onPress={() => setMinRating(rating)}
                    >
                      <MaterialCommunityIcons
                        name="star"
                        size={16}
                        color={minRating === rating ? "#fff" : "#FFD700"}
                      />
                      <Text
                        style={[
                          styles.ratingOptionText,
                          minRating === rating && styles.selectedRatingOptionText,
                        ]}
                      >
                        {rating === 0 ? "Any" : `${rating}+`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <Divider style={styles.filterDivider} />

              {/* Distance */}
              <View style={styles.filterSection}>
                <Text variant="titleSmall" style={styles.filterSectionTitle}>
                  Maximum Distance
                </Text>
                <View style={styles.distanceOptions}>
                  {[
                    { label: "Any", value: 50 },
                    { label: "2 km", value: 2 },
                    { label: "5 km", value: 5 },
                    { label: "10 km", value: 10 },
                    { label: "25 km", value: 25 },
                  ].map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.distanceOption,
                        maxDistance === option.value && styles.selectedDistanceOption,
                      ]}
                      onPress={() => setMaxDistance(option.value)}
                    >
                      <Text
                        style={[
                          styles.distanceOptionText,
                          maxDistance === option.value && styles.selectedDistanceOptionText,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <Divider style={styles.filterDivider} />

              {/* Amenities */}
              <View style={styles.filterSection}>
                <Text variant="titleSmall" style={styles.filterSectionTitle}>
                  Amenities
                </Text>
                <View style={styles.amenitiesGrid}>
                  {AMENITIES.map((amenity) => (
                    <Chip
                      key={amenity.id}
                      selected={selectedAmenities.includes(amenity.id)}
                      onPress={() => toggleAmenity(amenity.id)}
                      style={[
                        styles.amenityChip,
                        selectedAmenities.includes(amenity.id) && styles.selectedAmenityChip,
                      ]}
                      textStyle={[
                        styles.amenityChipText,
                        selectedAmenities.includes(amenity.id) && styles.selectedAmenityChipText,
                      ]}
                      icon={() => (
                        <MaterialCommunityIcons
                          name={amenity.icon}
                          size={16}
                          color={selectedAmenities.includes(amenity.id) ? "#fff" : "#666"}
                        />
                      )}
                    >
                      {amenity.label}
                    </Chip>
                  ))}
                </View>
              </View>
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={clearFilters}>Clear All</Button>
            <Button mode="contained" onPress={applyFilters} buttonColor={USER_COLOR}>
              Apply Filters
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
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
  listContent: {
    paddingBottom: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    color: "#666",
  },
  userName: {
    fontWeight: "bold",
    color: "#333",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  locationButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    maxWidth: 150,
  },
  locationButtonText: {
    color: "#333",
    marginHorizontal: 4,
    flex: 1,
  },
  searchContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginBottom: 12,
    alignItems: "center",
  },
  searchbar: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: "#fff",
    elevation: 2,
  },
  searchInput: {
    fontSize: 14,
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: USER_COLOR,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  filterBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#FF5722",
    size: 18,
  },
  recentSearchesContainer: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#fff",
  },
  recentSearchesTitle: {
    color: "#666",
    marginBottom: 8,
  },
  recentSearchItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  recentSearchText: {
    marginLeft: 8,
    color: "#333",
  },
  sportsFilterContainer: {
    marginBottom: 12,
  },
  sportsFilterContent: {
    paddingHorizontal: 16,
  },
  sportChip: {
    marginRight: 8,
    backgroundColor: "#fff",
  },
  selectedSportChip: {
    backgroundColor: USER_COLOR,
  },
  sportChipText: {
    color: "#666",
  },
  selectedSportChipText: {
    color: "#fff",
  },
  resultsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  resultsCount: {
    color: "#666",
  },
  viewToggle: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 2,
  },
  viewButton: {
    padding: 6,
    borderRadius: 6,
  },
  activeViewButton: {
    backgroundColor: "#E8F5E9",
  },
  turfCard: {
    marginHorizontal: 8,
    marginBottom: 12,
  },
  gridCard: {
    width: GRID_CARD_WIDTH,
  },
  listCard: {
    marginHorizontal: 16,
  },
  cardSurface: {
    borderRadius: 12,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  gridCardSurface: {
    height: 220,
  },
  cardImageContainer: {
    height: 120,
    position: "relative",
  },
  gridImageContainer: {
    height: 100,
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
  ratingBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  ratingText: {
    color: "#fff",
    fontSize: 12,
    marginLeft: 2,
    fontWeight: "600",
  },
  sportBadges: {
    position: "absolute",
    bottom: 8,
    left: 8,
    flexDirection: "row",
  },
  sportBadge: {
    backgroundColor: USER_COLOR,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 4,
  },
  sportBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  cardContent: {
    padding: 12,
  },
  gridCardContent: {
    padding: 8,
  },
  turfName: {
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  locationText: {
    color: "#666",
    marginLeft: 4,
    flex: 1,
  },
  detailsRow: {
    flexDirection: "row",
    marginVertical: 4,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
  },
  detailText: {
    color: "#666",
    marginLeft: 4,
  },
  amenitiesPreview: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 4,
  },
  amenityIcon: {
    marginRight: 8,
  },
  moreAmenities: {
    color: "#999",
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: 4,
  },
  priceText: {
    fontWeight: "bold",
    color: USER_COLOR,
  },
  perHourText: {
    color: "#666",
    marginLeft: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyTitle: {
    marginTop: 16,
    color: "#666",
    fontWeight: "600",
  },
  emptySubtitle: {
    marginTop: 4,
    color: "#999",
    textAlign: "center",
    paddingHorizontal: 40,
  },
  clearFiltersButton: {
    marginTop: 16,
    borderColor: USER_COLOR,
  },
  footerLoader: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 16,
  },
  loadingMoreText: {
    marginLeft: 8,
    color: "#666",
  },
  filterDialog: {
    maxHeight: "80%",
  },
  dialogScrollArea: {
    paddingHorizontal: 0,
  },
  filterSection: {
    padding: 16,
  },
  filterSectionTitle: {
    fontWeight: "600",
    marginBottom: 12,
    color: "#333",
  },
  filterDivider: {
    marginVertical: 0,
  },
  priceOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  priceOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f5f5f5",
    marginRight: 8,
    marginBottom: 8,
  },
  selectedPriceOption: {
    backgroundColor: USER_COLOR,
  },
  priceOptionText: {
    color: "#333",
    fontSize: 13,
  },
  selectedPriceOptionText: {
    color: "#fff",
  },
  distanceOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  distanceOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f5f5f5",
    marginRight: 8,
    marginBottom: 8,
  },
  selectedDistanceOption: {
    backgroundColor: USER_COLOR,
  },
  distanceOptionText: {
    color: "#333",
    fontSize: 13,
  },
  selectedDistanceOptionText: {
    color: "#fff",
  },
  ratingOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  ratingOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f5f5f5",
    marginRight: 8,
    marginBottom: 8,
  },
  selectedRatingOption: {
    backgroundColor: USER_COLOR,
  },
  ratingOptionText: {
    marginLeft: 4,
    color: "#333",
  },
  selectedRatingOptionText: {
    color: "#fff",
  },
  amenitiesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  amenityChip: {
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: "#f5f5f5",
  },
  selectedAmenityChip: {
    backgroundColor: USER_COLOR,
  },
  amenityChipText: {
    color: "#666",
    fontSize: 12,
  },
  selectedAmenityChipText: {
    color: "#fff",
  },
});
