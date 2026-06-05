import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
  Image,
  ScrollView,
  Alert,
  Animated,
  Pressable,
  Modal,
  Platform,
} from "react-native";
import {
  Text,
  Surface,
  Searchbar,
  Chip,
  IconButton,
  Button,
  Divider,
  Badge,
  ActivityIndicator,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";

import { selectUser } from "../../store/slices/authSlice";
import {
  selectWishlistIds,
  loadWishlist,
  toggleWishlistItem,
} from "../../store/slices/wishlistSlice";
import { queryDocuments } from "../../services/firebase/firestore";
import { getTurfCoupons } from "../../services/firebase/coupons";
import { useNotifications } from "../../hooks";
import { FONTS } from "../../constants/theme";
import {
  MUMBAI_AREAS,
  getAreasByZone,
  findNearestArea,
  getAreasWithDistances,
  calculateDistance
} from "../../constants/mumbaiAreas";

/**
 * Calculate distance between two points using the Haversine formula.
 * @returns distance in km
 */
const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const USER_COLOR = "#10B981";
const EMERALD_PALE = "#D1FAE5";
const EMERALD_DARK = "#059669";
const PAGE_BG = "#F8FAF9";
const GRID_CONTAINER_WIDTH = SCREEN_WIDTH * 0.9;
const GRID_GAP = 12;
const GRID_CARD_WIDTH = (GRID_CONTAINER_WIDTH - GRID_GAP) / 2;

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

// Separate TurfCard component to properly use hooks
const TurfCard = ({ item, viewMode, favorites, toggleFavorite, navigation, hasOffers }) => {
  const isGrid = viewMode === "grid";
  const isFavorite = favorites.includes(item.id);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  // Single morning-slot price (clearest signal for the user)
  const firstGround = item.grounds?.[0];
  const morningPrice =
    firstGround?.pricing?.weekday?.morning?.rate ||
    firstGround?.pricing?.allDayRate ||
    item.pricePerHour ||
    0;
  const priceDisplay = morningPrice ? `₹${morningPrice}` : `₹${item.pricePerHour || 0}`;

  return (
    <Animated.View
      style={[
        styles.turfCard,
        isGrid ? styles.gridCard : styles.listCard,
        { transform: [{ scale: scaleAnim }] },
      ]}
    >
      <Pressable
        onPress={() => navigation.navigate("TurfDetails", { turfId: item.id })}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <Surface style={styles.cardSurface} elevation={2}>
          {/* ── Image ─────────────────────────────── */}
          <View style={[styles.cardImageContainer, isGrid && styles.gridImageContainer]}>
            {item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} style={styles.cardImage} />
            ) : (
              <View style={[styles.cardImage, styles.placeholderImage]}>
                <MaterialCommunityIcons
                  name="soccer-field"
                  size={isGrid ? 36 : 52}
                  color="#ccc"
                />
              </View>
            )}

            {/* Bottom-up gradient so sport chips are legible */}
            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.45)"]}
              style={styles.gradientOverlay}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            />

            {/* Favourite */}
            <Pressable
              style={styles.favoriteButton}
              onPress={() => toggleFavorite(item.id)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialCommunityIcons
                name={isFavorite ? "heart" : "heart-outline"}
                size={20}
                color={isFavorite ? "#FF4444" : "#fff"}
              />
            </Pressable>

            {/* Offers badge */}
            {hasOffers && (
              <View style={styles.offersBadge}>
                <MaterialCommunityIcons name="tag" size={11} color="#fff" />
                <Text style={styles.offersBadgeText}>Offers</Text>
              </View>
            )}

            {/* Sport chips — bottom-left over gradient */}
            {(item.sports || []).length > 0 && (
              <View style={styles.sportChipsContainer}>
                {(item.sports || []).slice(0, isGrid ? 1 : 2).map((sport, idx) => (
                  <View key={idx} style={styles.cardSportChip}>
                    <Text style={styles.cardSportChipText}>{sport}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* ── Content ───────────────────────────── */}
          <View style={styles.cardContent}>
            {/* Name */}
            <Text style={styles.cardTurfName} numberOfLines={1}>
              {item.name}
            </Text>

            {/* Location */}
            <View style={styles.cardLocationRow}>
              <MaterialCommunityIcons name="map-marker-outline" size={13} color="#999" />
              <Text style={styles.cardLocationText} numberOfLines={1}>
                {item.locationText || "Location not specified"}
              </Text>
            </View>

            {/* Rating ←→ Price — one compact row, no blank space */}
            <View style={styles.cardStatsRow}>
              <View style={styles.cardRatingGroup}>
                <MaterialCommunityIcons name="star" size={13} color="#F59E0B" />
                <Text style={styles.cardRatingText}>{item.rating.toFixed(1)}</Text>
                <Text style={styles.cardReviewCount}>({item.reviewCount})</Text>
              </View>
              <View style={styles.cardPriceGroup}>
                <Text style={styles.cardPriceText}>{priceDisplay}</Text>
                <Text style={styles.cardPerHour}>/hr</Text>
              </View>
            </View>
          </View>
        </Surface>
      </Pressable>
    </Animated.View>
  );
};

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

// Calculate price range from grounds pricing
const getPriceRangeFromGrounds = (grounds) => {
  if (!grounds || grounds.length === 0) return { min: null, max: null };

  let minPrice = Infinity;
  let maxPrice = -Infinity;

  grounds.forEach((ground) => {
    const pricing = ground.pricing;
    if (!pricing) return;

    // Check all day rate
    if (pricing.allDayRate) {
      minPrice = Math.min(minPrice, pricing.allDayRate);
      maxPrice = Math.max(maxPrice, pricing.allDayRate);
    }

    // Check weekday rates
    if (pricing.weekday) {
      ["morning", "afternoon", "evening"].forEach((slot) => {
        const rate = pricing.weekday[slot]?.rate;
        if (rate) {
          minPrice = Math.min(minPrice, rate);
          maxPrice = Math.max(maxPrice, rate);
        }
      });
    }

    // Check weekend rates
    if (pricing.weekend) {
      ["morning", "afternoon", "evening"].forEach((slot) => {
        const rate = pricing.weekend[slot]?.rate;
        if (rate) {
          minPrice = Math.min(minPrice, rate);
          maxPrice = Math.max(maxPrice, rate);
        }
      });
    }
  });

  return {
    min: minPrice === Infinity ? null : minPrice,
    max: maxPrice === -Infinity ? null : maxPrice,
  };
};

export default function HomeScreen({ navigation }) {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const favorites = useSelector(selectWishlistIds);
  const { unreadCount } = useNotifications();

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
  const [turfIdsWithOffers, setTurfIdsWithOffers] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Location filter state
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [locationSearch, setLocationSearch] = useState("");
  const [selectedAreas, setSelectedAreas] = useState([]); // Array of area IDs for multi-selection
  const [areasWithDistances, setAreasWithDistances] = useState([]); // Mumbai areas with calculated distances
  const [selectedZone, setSelectedZone] = useState("All"); // Zone filter in location modal

  // User GPS location
  const [userCoords, setUserCoords] = useState(null); // { latitude, longitude }
  const [nearestArea, setNearestArea] = useState(null); // Auto-detected nearest area

  // Ref for search query (prevents keyboard dismiss on re-render)
  const searchQueryRef = useRef("");

  // Calculate active filters count
  useEffect(() => {
    let count = 0;
    if (priceRange[0] > 0 || priceRange[1] < 5000) count++;
    if (selectedAmenities.length > 0) count++;
    if (minRating > 0) count++;
    if (maxDistance < 50) count++;
    if (selectedAreas.length > 0) count++;
    setActiveFiltersCount(count);
  }, [priceRange, selectedAmenities, minRating, maxDistance, selectedAreas]);

  // Fetch turfs from Firestore
  const fetchTurfs = useCallback(async ({ refresh = false } = {}) => {
    try {
      if (refresh) {
        setRefreshing(true);
        setPage(1);
      } else if (!refresh && page === 1) {
        setLoading(true);
      }

      // Query all active turfs (sport/location filtering done locally)
      const constraints = [
        { field: "isActive", operator: "==", value: true },
      ];

      const turfsData = await queryDocuments("turfs", constraints);

      // Map turfs to display format and calculate real distance
      let filteredTurfs = turfsData.map(doc => {
        const minPrice = getMinPriceFromGrounds(doc.grounds);
        const priceRange = getPriceRangeFromGrounds(doc.grounds);
        let distance = null;
        if (userCoords && doc.location?.coordinates) {
          const coords = doc.location.coordinates;
          const turfLat = coords.latitude ?? coords.lat;
          const turfLon = coords.longitude ?? coords.lng ?? coords.lon;
          if (turfLat != null && turfLon != null) {
            distance = Math.round(
              haversineDistance(userCoords.latitude, userCoords.longitude, turfLat, turfLon) * 10
            ) / 10; // round to 1 decimal
          } else {
            console.log(`Turf ${doc.name} has null/invalid coordinates:`, coords);
          }
        }
        return {
          id: doc.id,
          ...doc,
          locationText: formatLocationText(doc.location),
          rating: doc.rating || 4.0,
          reviewCount: doc.reviewCount || 0,
          distance,
          pricePerHour: minPrice || doc.pricePerHour || 0,
          priceRange: priceRange,
          imageUrl: doc.imageUrl || doc.coverImage || null,
        };
      });

      // Apply local filters
      filteredTurfs = filteredTurfs.filter(turf => {
        // Sport filter — check top-level sports AND each ground's sports
        if (selectedSport !== "all") {
          const turfSports = (turf.sports || []).map(s => s.toLowerCase());
          const groundSports = (turf.grounds || [])
            .flatMap(g => g.sports || [])
            .map(s => s.toLowerCase());
          const allSports = [...new Set([...turfSports, ...groundSports])];
          if (!allSports.includes(selectedSport.toLowerCase())) return false;
        }

        // Combined Area + Distance Filter (OR logic when both active)
        const hasAreaFilter = selectedAreas.length > 0;
        const hasDistanceFilter = maxDistance < 50 && userCoords;

        if (hasAreaFilter || hasDistanceFilter) {
          let matchesArea = false;
          let matchesDistance = false;

          // Check area filter
          if (hasAreaFilter) {
            const loc = turf.location;
            if (loc && typeof loc !== "string") {
              const turfAreaName = loc.area?.toLowerCase() || "";
              matchesArea = selectedAreas.some(areaId => {
                const area = MUMBAI_AREAS.find(a => a.id === areaId);
                return area && area.name.toLowerCase() === turfAreaName;
              });
            }
          }

          // Check distance filter
          if (hasDistanceFilter && turf.distance != null) {
            matchesDistance = turf.distance <= maxDistance;
          }

          // OR logic: pass if matches EITHER area OR distance
          if (hasAreaFilter && hasDistanceFilter) {
            if (!matchesArea && !matchesDistance) return false;
          } else if (hasAreaFilter) {
            if (!matchesArea) return false;
          } else if (hasDistanceFilter) {
            if (!matchesDistance) return false;
          }
        }

        // Price filter
        const price = turf.pricePerHour || 0;
        if (price < priceRange[0] || price > priceRange[1]) return false;

        // Rating filter
        const rating = parseFloat(turf.rating) || 0;
        if (rating < minRating) return false;

        // Amenities filter
        if (selectedAmenities.length > 0) {
          const turfAmenities = turf.amenities || [];
          if (!selectedAmenities.every(a => turfAmenities.includes(a))) return false;
        }

        // Search filter (read from ref to avoid stale closure)
        const currentSearch = searchQueryRef.current;
        if (currentSearch) {
          const query = currentSearch.toLowerCase();
          const matchesName = turf.name?.toLowerCase().includes(query);
          const matchesLocation = (turf.locationText || "").toLowerCase().includes(query);
          const matchesSport = (turf.sports || []).some(s => s.toLowerCase().includes(query));
          if (!matchesName && !matchesLocation && !matchesSport) return false;
        }

        return true;
      });

      // Sort by rating
      filteredTurfs.sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating));

      // Pagination
      const endIndex = page * ITEMS_PER_PAGE;
      const paginatedTurfs = filteredTurfs.slice(0, endIndex);

      setTurfs(paginatedTurfs);
      setHasMore(paginatedTurfs.length < filteredTurfs.length);

      // Fetch active coupons to show offers badge — one query per unique company
      try {
        const companyIds = [...new Set(paginatedTurfs.map((t) => t.companyId).filter(Boolean))];
        const couponFetches = companyIds.map((cId) =>
          queryDocuments("coupons", [
            { field: "channel", operator: "==", value: "turf" },
            { field: "companyId", operator: "==", value: cId },
            { field: "status", operator: "==", value: "active" },
            { field: "companyStatus", operator: "==", value: "active" },
          ])
        );
        const results = await Promise.all(couponFetches);
        const now = Date.now();
        const ids = new Set();
        results.flat().forEach((coupon) => {
          const validTo = coupon.validTo?.toDate
            ? coupon.validTo.toDate().getTime()
            : new Date(coupon.validTo).getTime();
          if (now > validTo) return;
          const turfIds = coupon.turfIds;
          if (!turfIds || turfIds.length === 0) {
            // applies to all turfs of the company — mark them all
            paginatedTurfs
              .filter((t) => t.companyId === coupon.companyId)
              .forEach((t) => ids.add(t.id));
          } else {
            turfIds.forEach((id) => ids.add(id));
          }
        });
        setTurfIdsWithOffers(ids);
      } catch (err) {
        // Non-critical — badge simply won't show if this fails
        console.warn("[HomeScreen] offers badge fetch failed:", err.message);
      }
    } catch (error) {
      console.error("Error fetching turfs:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [selectedSport, priceRange, minRating, selectedAmenities, selectedAreas, maxDistance, userCoords, page]);

  // Load saved areas from AsyncStorage on mount, and wishlist from Firestore
  useEffect(() => {
    (async () => {
      try {
        const savedAreas = await AsyncStorage.getItem("selectedAreas");
        if (savedAreas) {
          setSelectedAreas(JSON.parse(savedAreas));
        }
      } catch (e) {
        console.log("Error loading saved areas:", e);
      }
    })();
  }, []);

  // Load wishlist from Firestore when user is available
  useEffect(() => {
    if (user?.userId) {
      dispatch(loadWishlist(user.userId));
    }
  }, [user?.userId]);

  // Toggle wishlist status
  const toggleFavorite = useCallback(
    (turfId) => {
      if (user?.userId) {
        dispatch(toggleWishlistItem({ userId: user.userId, turfId }));
      }
    },
    [user?.userId]
  );

  // Request location permission and auto-detect nearest area
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          const coords = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          };
          setUserCoords(coords);

          // Find nearest area
          const nearest = findNearestArea(coords.latitude, coords.longitude);
          setNearestArea(nearest);

          // Calculate distances for all areas
          const withDistances = getAreasWithDistances(coords.latitude, coords.longitude);
          setAreasWithDistances(withDistances);

          // Auto-select nearest area if no areas are currently selected
          if (selectedAreas.length === 0 && nearest) {
            const newSelection = [nearest.id];
            setSelectedAreas(newSelection);
            await AsyncStorage.setItem("selectedAreas", JSON.stringify(newSelection));
          }
        } else {
          // Location not granted - just show all areas without distances
          setAreasWithDistances(MUMBAI_AREAS);
        }
      } catch (e) {
        console.log("Location permission error:", e);
        setAreasWithDistances(MUMBAI_AREAS);
      }
    })();
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchTurfs();
  }, []);

  // Refetch when filters change
  useEffect(() => {
    setPage(1);
    fetchTurfs({ refresh: true });
  }, [selectedSport, priceRange, minRating, selectedAmenities, selectedAreas, maxDistance]);

  // Handle search change (updates ref + state without keyboard dismiss)
  const handleSearchChange = useCallback((text) => {
    searchQueryRef.current = text;
    setSearchQuery(text);
  }, []);

  // Handle search submit
  const handleSearch = useCallback(() => {
    const query = searchQueryRef.current.trim();
    if (query) {
      setRecentSearches(prev => {
        const updated = [query, ...prev.filter(s => s !== query)].slice(0, 5);
        return updated;
      });
      setShowRecentSearches(false);
      setPage(1);
      fetchTurfs({ refresh: true });
    }
  }, [fetchTurfs]);

  // Filter areas by search and zone
  const filteredAreas = useMemo(() => {
    let areas = areasWithDistances;

    // Filter by zone
    if (selectedZone !== "All") {
      areas = areas.filter(area => area.zone === selectedZone);
    }

    // Filter by search query
    if (locationSearch.trim()) {
      const query = locationSearch.toLowerCase();
      areas = areas.filter(area => area.name.toLowerCase().includes(query));
    }

    return areas;
  }, [areasWithDistances, selectedZone, locationSearch]);

  // Toggle area selection (multi-select)
  const toggleAreaSelection = useCallback(async (areaId) => {
    setSelectedAreas(prev => {
      const newSelection = prev.includes(areaId)
        ? prev.filter(id => id !== areaId)
        : [...prev, areaId];

      // Persist to AsyncStorage
      AsyncStorage.setItem("selectedAreas", JSON.stringify(newSelection)).catch(e =>
        console.log("Error saving areas:", e)
      );

      return newSelection;
    });
  }, []);

  const clearAreaSelection = useCallback(async () => {
    setSelectedAreas([]);
    await AsyncStorage.removeItem("selectedAreas").catch(e =>
      console.log("Error clearing areas:", e)
    );
  }, []);

  const closeLocationModal = useCallback(() => {
    setLocationModalVisible(false);
    setLocationSearch("");
    setSelectedZone("All");
  }, []);

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
  const clearFilters = async () => {
    setPriceRange([0, 5000]);
    setSelectedAmenities([]);
    setMinRating(0);
    setMaxDistance(50);
    setSelectedSport("all");
    setSearchQuery("");
    searchQueryRef.current = "";
    setSelectedAreas([]);
    await AsyncStorage.removeItem("selectedAreas").catch(e =>
      console.log("Error clearing areas:", e)
    );
  };

  // Apply filters
  const applyFilters = () => {
    setFilterModalVisible(false);
    setPage(1);
    fetchTurfs({ refresh: true });
  };

  // Render modern interactive turf card
  const renderTurfCard = ({ item, index }) => {
    return (
      <TurfCard
        item={item}
        viewMode={viewMode}
        favorites={favorites}
        toggleFavorite={toggleFavorite}
        navigation={navigation}
        hasOffers={turfIdsWithOffers.has(item.id)}
      />
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

  // Sticky header (greeting + search + filter — all unified)
  const renderStickyHeader = () => (
    <View style={styles.headerWrapper}>
      {/* Greeting row */}
      <View style={styles.headerTopRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.userName}>{user?.name || "User"}</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.locationButton} onPress={() => setLocationModalVisible(true)}>
            <MaterialCommunityIcons name="map-marker" size={15} color={USER_COLOR} />
            <Text style={styles.locationButtonText} numberOfLines={1}>
              {selectedAreas.length === 0
                ? "All Areas"
                : selectedAreas.length === 1
                ? MUMBAI_AREAS.find(a => a.id === selectedAreas[0])?.name || "1 Area"
                : `${selectedAreas.length} Areas`}
            </Text>
            <MaterialCommunityIcons name="chevron-down" size={14} color="#666" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate("Notifications")}
            style={styles.bellBtn}
          >
            <MaterialCommunityIcons name="bell-outline" size={22} color="#444" />
            {unreadCount > 0 && (
              <Badge
                size={16}
                style={{ position: "absolute", top: 0, right: 0, backgroundColor: "#F44336" }}
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </Badge>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Search + filter row */}
      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="Search turfs, sports, locations..."
          value={searchQuery}
          onChangeText={handleSearchChange}
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
          <MaterialCommunityIcons name="tune-variant" size={20} color="#fff" />
          {activeFiltersCount > 0 && (
            <Badge style={styles.filterBadge}>{activeFiltersCount}</Badge>
          )}
        </TouchableOpacity>
      </View>

      {/* Recent searches dropdown */}
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
                searchQueryRef.current = search;
                setSearchQuery(search);
                setShowRecentSearches(false);
                fetchTurfs({ refresh: true });
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
    </View>
  );

  // Render scrollable header content (sport filters, sort, results count)
  const renderHeader = () => (
    <>

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
    <SafeAreaView style={styles.container} edges={["top"]}>
      {renderStickyHeader()}
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
          key={viewMode}
          ListHeaderComponent={renderHeader()}
          ListEmptyComponent={renderEmptyState}
          ListFooterComponent={renderFooter}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={viewMode === "grid" ? styles.gridRow : undefined}
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
      <Modal
        visible={filterModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.filterOverlay}>
          <View style={styles.filterSheet}>
            <View style={styles.filterDialogHeader}>
              <Text variant="titleLarge" style={styles.filterDialogTitle}>Filter Turfs</Text>
              <IconButton
                icon="close"
                size={24}
                onPress={() => setFilterModalVisible(false)}
              />
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={styles.filterScrollArea}>
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
                {maxDistance < 50 && (
                  <View style={styles.distanceHint}>
                    <MaterialCommunityIcons
                      name={userCoords ? "information" : "crosshairs-gps"}
                      size={14}
                      color={userCoords ? "#10B981" : "#FF9800"}
                    />
                    <Text variant="bodySmall" style={[
                      styles.distanceHintText,
                      userCoords && { color: "#10B981" }
                    ]}>
                      {userCoords
                        ? `Filtering turfs within ${maxDistance} km of your location`
                        : "Enable location access for distance filtering"}
                    </Text>
                  </View>
                )}
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
            <View style={styles.filterActions}>
              <Button onPress={clearFilters} textColor={USER_COLOR}>Clear All</Button>
              <Button mode="contained" onPress={applyFilters} buttonColor={USER_COLOR}>
                Apply Filters
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* Enhanced Location Picker Modal */}
      <Modal
        visible={locationModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeLocationModal}
      >
        <View style={styles.locationOverlay}>
          <View style={styles.locationSheet}>
            <View style={styles.locationDialogHeader}>
              <View>
                <Text variant="titleLarge" style={styles.locationDialogTitle}>
                  Select Areas
                </Text>
                {selectedAreas.length > 0 && (
                  <Text variant="bodySmall" style={styles.locationDialogSubtitle}>
                    {selectedAreas.length} area{selectedAreas.length > 1 ? 's' : ''} selected
                  </Text>
                )}
              </View>
              <IconButton
                icon="close"
                size={24}
                onPress={closeLocationModal}
              />
            </View>

            {/* Nearest Area Info */}
            {nearestArea && selectedAreas.length === 0 && (
              <Surface style={styles.nearestAreaBanner} elevation={0}>
                <MaterialCommunityIcons name="crosshairs-gps" size={20} color={USER_COLOR} />
                <View style={styles.nearestAreaInfo}>
                  <Text variant="bodySmall" style={styles.nearestAreaLabel}>
                    Nearest to you
                  </Text>
                  <Text variant="bodyMedium" style={styles.nearestAreaName}>
                    {nearestArea.name} ({nearestArea.distance} km)
                  </Text>
                </View>
                <Button
                  mode="contained"
                  compact
                  onPress={() => toggleAreaSelection(nearestArea.id)}
                  buttonColor={USER_COLOR}
                  labelStyle={styles.nearestAreaButtonLabel}
                >
                  Select
                </Button>
              </Surface>
            )}

            {/* Search Bar */}
            <View style={styles.locationSearchWrapper}>
              <Searchbar
                placeholder="Search Mumbai areas..."
                value={locationSearch}
                onChangeText={setLocationSearch}
                style={styles.locationSearchbar}
                inputStyle={styles.locationSearchInput}
                icon="magnify"
              />
            </View>

            {/* Zone Filter Tabs */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.zoneFilterContainer}
              contentContainerStyle={styles.zoneFilterContent}
            >
              {["All", "Western", "Central", "South", "Eastern"].map((zone) => (
                <Chip
                  key={zone}
                  selected={selectedZone === zone}
                  onPress={() => setSelectedZone(zone)}
                  style={[
                    styles.zoneChip,
                    selectedZone === zone && styles.selectedZoneChip,
                  ]}
                  textStyle={[
                    styles.zoneChipText,
                    selectedZone === zone && styles.selectedZoneChipText,
                  ]}
                >
                  {zone}
                </Chip>
              ))}
            </ScrollView>

            {/* Areas List */}
            <ScrollView style={styles.locationScrollArea} showsVerticalScrollIndicator={false}>
              {/* Clear All Option */}
              {selectedAreas.length > 0 && (
                <>
                  <TouchableOpacity
                    style={styles.locationItem}
                    onPress={clearAreaSelection}
                  >
                    <MaterialCommunityIcons name="earth" size={22} color="#666" />
                    <View style={styles.locationItemContent}>
                      <Text style={styles.locationItemText}>All Areas</Text>
                      <Text style={styles.locationItemType}>Clear selection</Text>
                    </View>
                    <MaterialCommunityIcons name="close-circle" size={20} color="#666" />
                  </TouchableOpacity>
                  <Divider />
                </>
              )}

              {/* Area Items */}
              {filteredAreas.map((area) => {
                const isSelected = selectedAreas.includes(area.id);
                return (
                  <TouchableOpacity
                    key={area.id}
                    style={[
                      styles.locationItem,
                      isSelected && styles.selectedLocationItem,
                    ]}
                    onPress={() => toggleAreaSelection(area.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.areaItemLeft}>
                      <MaterialCommunityIcons
                        name={isSelected ? "checkbox-marked-circle" : "map-marker-outline"}
                        size={22}
                        color={isSelected ? USER_COLOR : "#666"}
                      />
                      <View style={styles.locationItemContent}>
                        <Text style={[
                          styles.locationItemText,
                          isSelected && styles.locationItemActive
                        ]}>
                          {area.name}
                        </Text>
                        <View style={styles.areaMetaRow}>
                          <Text style={styles.locationItemType}>{area.zone}</Text>
                          {area.distance != null && (
                            <>
                              <Text style={styles.dotSeparator}>•</Text>
                              <MaterialCommunityIcons
                                name="map-marker-distance"
                                size={12}
                                color="#999"
                              />
                              <Text style={styles.areaDistance}>{area.distance} km</Text>
                            </>
                          )}
                        </View>
                      </View>
                    </View>
                    {isSelected && (
                      <MaterialCommunityIcons
                        name="check-circle"
                        size={20}
                        color={USER_COLOR}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}

              {filteredAreas.length === 0 && (
                <View style={styles.noLocationsContainer}>
                  <MaterialCommunityIcons name="map-search" size={48} color="#ddd" />
                  <Text style={styles.noLocationsText}>No areas found</Text>
                  <Text style={styles.noLocationsSubtext}>
                    Try adjusting your search or zone filter
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* Action Buttons */}
            <View style={styles.locationDialogActions}>
              <Button onPress={clearAreaSelection} disabled={selectedAreas.length === 0} textColor={USER_COLOR}>
                Clear All
              </Button>
              <Button
                mode="contained"
                onPress={closeLocationModal}
                buttonColor={USER_COLOR}
              >
                Done
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PAGE_BG,
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
  headerWrapper: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#ebebeb",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 4,
    marginBottom: 8,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: "#888",
  },
  userName: {
    fontFamily: FONTS.bold,
    fontSize: 22,
    color: "#111",
    letterSpacing: -0.3,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  locationButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: EMERALD_PALE,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    maxWidth: 150,
  },
  locationButtonText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: "#333",
    marginHorizontal: 4,
    flex: 1,
  },
  bellBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#f5f5f5",
    alignItems: "center",
    justifyContent: "center",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  searchbar: {
    flex: 1,
    borderRadius: 24,
    backgroundColor: "#F3F4F6",
    elevation: 0,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    maxHeight: 44,
  },
  searchInput: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    paddingVertical: 0,
    textAlignVertical: "center",
    alignSelf: "center",
  },
  filterButton: {
    width: 40,
    height: 40,
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
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e8e8e8",
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
    marginBottom: 8,
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
    marginBottom: 5,
    marginLeft: 4,
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
    backgroundColor: EMERALD_PALE,
  },
  // ── Turf Card ──────────────────────────────────
  turfCard: {
    marginHorizontal: 8,
    marginBottom: 14,
  },
  gridCard: {
    width: GRID_CARD_WIDTH,
    marginHorizontal: 0,
  },
  listCard: {
    marginHorizontal: 16,
  },
  cardSurface: {
    borderRadius: 14,
    backgroundColor: "#fff",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#F0F0F0",
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },

  // Image
  cardImageContainer: {
    height: 170,
    position: "relative",
    backgroundColor: "#e8e8e8",
  },
  gridImageContainer: {
    height: 120,
  },
  cardImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  placeholderImage: {
    backgroundColor: "#ececec",
    justifyContent: "center",
    alignItems: "center",
  },
  // Bottom-up gradient — keeps sport chips legible
  gradientOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "55%",
  },
  favoriteButton: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.32)",
    justifyContent: "center",
    alignItems: "center",
  },
  // Offers badge — top-left corner of image
  offersBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#10B981",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  offersBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontFamily: FONTS.bold,
  },

  // Sport chips sit over the gradient at the bottom-left
  sportChipsContainer: {
    position: "absolute",
    bottom: 8,
    left: 10,
    flexDirection: "row",
    gap: 5,
  },
  cardSportChip: {
    backgroundColor: "rgba(16,185,129,0.88)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  cardSportChipText: {
    color: "#fff",
    fontSize: 10,
    fontFamily: FONTS.medium,
    textTransform: "capitalize",
  },

  // Content
  cardContent: {
    padding: 12,
  },
  cardTurfName: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: "#1a1a1a",
    marginBottom: 4,
  },
  cardLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  cardLocationText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: "#888",
    marginLeft: 3,
    flex: 1,
  },
  // Single row: rating left, price right — no blank space
  cardStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardRatingGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  cardRatingText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: "#333",
  },
  cardReviewCount: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: "#aaa",
  },
  cardPriceGroup: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 1,
  },
  cardPriceText: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: "#10B981",
  },
  cardPerHour: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: "#999",
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
  filterOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  filterSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "85%",
  },
  filterScrollArea: {
    paddingHorizontal: 0,
  },
  filterActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 34 : 18,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    gap: 8,
  },
  filterDialogHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingLeft: 24,
    paddingRight: 8,
    paddingTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  filterDialogTitle: {
    fontWeight: "bold",
    color: "#333",
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
  gridRow: {
    justifyContent: "flex-start",
    gap: GRID_GAP,
    paddingHorizontal: SCREEN_WIDTH * 0.05,
  },
  locationOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  locationSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "85%",
    height: "auto"  
  },
  locationDialogHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingLeft: 24,
    paddingRight: 8,
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
    marginBottom: 5,
  },
  locationDialogTitle: {
    fontFamily: "Ubuntu-Bold",
    color: "#333",
  },
  locationDialogSubtitle: {
    color: USER_COLOR,
    marginTop: 2,
  },
  nearestAreaBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: EMERALD_PALE,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  nearestAreaInfo: {
    flex: 1,
  },
  nearestAreaLabel: {
    color: "#666",
  },
  nearestAreaName: {
    fontFamily: "Ubuntu-Medium",
    color: "#333",
    marginTop: 2,
  },
  nearestAreaButtonLabel: {
    fontSize: 12,
  },
  locationSearchWrapper: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  locationSearchbar: {
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    elevation: 0,
  },
  locationSearchInput: {
    fontSize: 14,
    fontFamily: "Ubuntu-Regular",
  },
  zoneFilterContainer: {
    marginBottom: 8,
  },
  zoneFilterContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  zoneChip: {
    backgroundColor: "#f5f5f5",
  },
  selectedZoneChip: {
    backgroundColor: USER_COLOR,
  },
  zoneChipText: {
    color: "#666",
    fontFamily: "Ubuntu-Medium",
    fontSize: 12,
  },
  selectedZoneChipText: {
    color: "#fff",
  },
  locationScrollArea: {
    maxHeight: SCREEN_HEIGHT * 0.42,
    paddingHorizontal: 0,
  },
  locationItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 12,
  },
  selectedLocationItem: {
    backgroundColor: "#F1F8F4",
  },
  areaItemLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  locationItemContent: {
    flex: 1,
  },
  locationItemText: {
    fontSize: 15,
    color: "#333",
    fontFamily: "Ubuntu-Regular",
  },
  locationItemActive: {
    color: USER_COLOR,
    fontFamily: "Ubuntu-Medium",
  },
  areaMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    gap: 4,
  },
  locationItemType: {
    fontSize: 11,
    color: "#999",
    textTransform: "capitalize",
  },
  dotSeparator: {
    color: "#ddd",
    fontSize: 10,
  },
  areaDistance: {
    fontSize: 11,
    color: "#999",
  },
  locationDialogActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 34 : 18,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    gap: 8,
  },
  distanceHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  distanceHintText: {
    color: "#FF9800",
  },
  noLocationsContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
  noLocationsText: {
    color: "#999",
    fontSize: 15,
    fontFamily: "Ubuntu-Medium",
    marginTop: 12,
  },
  noLocationsSubtext: {
    color: "#bbb",
    fontSize: 13,
    marginTop: 4,
    textAlign: "center",
    paddingHorizontal: 32,
  },
});
