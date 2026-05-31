import { useState, useEffect, useCallback, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Image,
  FlatList,
  Linking,
  Share,
  Animated,
  Alert,
} from "react-native";
import {
  Text,
  Surface,
  IconButton,
  Button,
  Divider,
  ActivityIndicator,
  Chip,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { selectUser } from "../../store/slices/authSlice";
import {
  selectIsWishlisted,
  toggleWishlistItem,
} from "../../store/slices/wishlistSlice";
import { getDocument, queryDocuments } from "../../services/firebase/firestore";
import { getOrCreateChat } from "../../services/firebase/chat";
import { getReviewsForTurf } from "../../services/firebase/reviews";
import { getTurfCoupons } from "../../services/firebase/coupons";
import TurfOfferCard from "../../components/coupons/TurfOfferCard";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const USER_COLOR = "#10B981";
const EMERALD_PALE = "#D1FAE5";
const EMERALD_DARK = "#059669";
const PAGE_BG = "#F8FAF9";
const IMAGE_HEIGHT = 280;

// Amenities icons mapping
const AMENITY_ICONS = {
  parking: { icon: "parking", label: "Parking" },
  washroom: { icon: "toilet", label: "Washroom" },
  changing_room: { icon: "door", label: "Changing Room" },
  drinking_water: { icon: "water", label: "Drinking Water" },
  floodlights: { icon: "lightbulb-on", label: "Floodlights" },
  first_aid: { icon: "medical-bag", label: "First Aid" },
  equipment_rental: { icon: "tennis-ball", label: "Equipment Rental" },
  cafeteria: { icon: "food", label: "Cafeteria" },
  wifi: { icon: "wifi", label: "WiFi" },
  seating: { icon: "seat", label: "Seating Area" },
  lockers: { icon: "locker", label: "Lockers" },
  shower: { icon: "shower", label: "Shower" },
};

// Sport icons mapping
const SPORT_ICONS = {
  football: "soccer",
  cricket: "cricket",
  badminton: "badminton",
  tennis: "tennis",
  basketball: "basketball",
  volleyball: "volleyball",
  hockey: "hockey-sticks",
  default: "trophy",
};

// Helper function to get minimum price from a ground's pricing
const getGroundMinPrice = (pricing) => {
  if (!pricing) return null;

  let minPrice = Infinity;

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

  return minPrice === Infinity ? null : minPrice;
};

// Helper function to get pricing range for display
const getPricingRanges = (grounds) => {
  if (!grounds || grounds.length === 0) {
    return { morning: null, afternoon: null, evening: null, weekendMin: null };
  }

  const ranges = {
    morningMin: Infinity,
    morningMax: 0,
    afternoonMin: Infinity,
    afternoonMax: 0,
    eveningMin: Infinity,
    eveningMax: 0,
    weekendDiff: 0,
  };

  grounds.forEach((ground) => {
    const pricing = ground.pricing;
    if (!pricing) return;

    // Weekday rates
    if (pricing.weekday?.morning?.rate) {
      ranges.morningMin = Math.min(ranges.morningMin, pricing.weekday.morning.rate);
      ranges.morningMax = Math.max(ranges.morningMax, pricing.weekday.morning.rate);
    }
    if (pricing.weekday?.afternoon?.rate) {
      ranges.afternoonMin = Math.min(ranges.afternoonMin, pricing.weekday.afternoon.rate);
      ranges.afternoonMax = Math.max(ranges.afternoonMax, pricing.weekday.afternoon.rate);
    }
    if (pricing.weekday?.evening?.rate) {
      ranges.eveningMin = Math.min(ranges.eveningMin, pricing.weekday.evening.rate);
      ranges.eveningMax = Math.max(ranges.eveningMax, pricing.weekday.evening.rate);
    }

    // Calculate weekend difference
    if (pricing.weekend?.morning?.rate && pricing.weekday?.morning?.rate) {
      const diff = pricing.weekend.morning.rate - pricing.weekday.morning.rate;
      if (diff > ranges.weekendDiff) ranges.weekendDiff = diff;
    }
  });

  return {
    morning: ranges.morningMin !== Infinity ?
      (ranges.morningMin === ranges.morningMax ? `₹${ranges.morningMin}` : `₹${ranges.morningMin} - ₹${ranges.morningMax}`) : null,
    afternoon: ranges.afternoonMin !== Infinity ?
      (ranges.afternoonMin === ranges.afternoonMax ? `₹${ranges.afternoonMin}` : `₹${ranges.afternoonMin} - ₹${ranges.afternoonMax}`) : null,
    evening: ranges.eveningMin !== Infinity ?
      (ranges.eveningMin === ranges.eveningMax ? `₹${ranges.eveningMin}` : `₹${ranges.eveningMin} - ₹${ranges.eveningMax}`) : null,
    weekendDiff: ranges.weekendDiff > 0 ? ranges.weekendDiff : null,
    startingFrom: Math.min(
      ranges.morningMin !== Infinity ? ranges.morningMin : Infinity,
      ranges.afternoonMin !== Infinity ? ranges.afternoonMin : Infinity,
      ranges.eveningMin !== Infinity ? ranges.eveningMin : Infinity
    ),
  };
};

export default function TurfDetailScreen({ navigation, route }) {
  const { turfId } = route.params || {};
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const isFavorite = useSelector(selectIsWishlisted(turfId));
  const scrollY = useRef(new Animated.Value(0)).current;

  // State
  const [turf, setTurf] = useState(null);
  const [grounds, setGrounds] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [coupons, setCoupons] = useState([]);

  // Fetch turf details
  const fetchTurfDetails = useCallback(async () => {
    if (!turfId) return;

    try {
      setLoading(true);

      // Fetch turf data
      const turfData = await getDocument("turfs", turfId);
      if (turfData) {
        setTurf({
          ...turfData,
          id: turfId,
          rating: turfData.rating || 0,
          reviewCount: turfData.reviewCount || 0,
          images: turfData.images || (turfData.coverImage ? [turfData.coverImage] : []),
        });

        // Grounds are embedded in the turf document
        const groundsData = turfData.grounds || [];
        setGrounds(groundsData.map((g, index) => ({
          ...g,
          id: g.id || `ground-${index}`,
        })));
      }

      // Fetch active coupons for this turf
      if (turfData.companyId) {
        try {
          const couponDocs = await getTurfCoupons(turfId, turfData.companyId);
          setCoupons(couponDocs);
        } catch (err) {
          console.error("Error fetching turf coupons:", err);
        }
      }

      // Fetch real reviews
      try {
        const reviewDocs = await getReviewsForTurf(turfId, { status: "active" });
        setReviews(reviewDocs);
      } catch (err) {
        console.error("Error fetching reviews:", err);
        setReviews([]);
      }
    } catch (error) {
      console.error("Error fetching turf details:", error);
    } finally {
      setLoading(false);
    }
  }, [turfId]);

  useEffect(() => {
    fetchTurfDetails();
  }, [fetchTurfDetails]);

  // Format location
  const formatLocation = (location) => {
    if (!location) return "Location not specified";
    if (typeof location === "string") return location;
    const parts = [location.address, location.city, location.state].filter(Boolean);
    return parts.join(", ") || "Location not specified";
  };

  // Format operating hours
  const formatOperatingHours = (hours) => {
    if (!hours) return "6:00 AM - 11:00 PM";
    return `${hours.open || "6:00 AM"} - ${hours.close || "11:00 PM"}`;
  };

  // Handle share
  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out ${turf?.name} on Turf App!\n\nLocation: ${formatLocation(turf?.location)}`,
        title: turf?.name,
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  // Handle favorite toggle
  const toggleFavorite = () => {
    if (user?.userId && turfId) {
      dispatch(toggleWishlistItem({ userId: user.userId, turfId }));
    }
  };

  // Handle get directions
  const handleGetDirections = () => {
    const location = turf?.location;
    if (location?.googleMapsLink) {
      Linking.openURL(location.googleMapsLink);
    } else if (location?.latitude && location?.longitude) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${location.latitude},${location.longitude}`;
      Linking.openURL(url);
    } else if (location?.address) {
      const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.address)}`;
      Linking.openURL(url);
    }
  };

  // Handle check availability
  const handleCheckAvailability = () => {
    navigation.navigate("Booking", { turfId, turf });
  };

  // Handle chat with manager
  const handleChatWithManager = async () => {
    if (!user?.userId) {
      Alert.alert("Login Required", "Please login to chat with the manager.");
      return;
    }

    if (!turf?.companyId) {
      Alert.alert("Error", "Unable to start chat. Company information not available.");
      return;
    }

    setIsChatLoading(true);
    try {
      const chat = await getOrCreateChat(
        user.userId,
        turf.companyId,
        { name: user.name || "User", phone: user.phone || "" },
        { name: turf.companyName || turf.name || "Turf Manager" }
      );

      navigation.navigate("ChatScreen", {
        chatId: chat.id,
        companyName: turf.companyName || turf.name,
        companyId: turf.companyId,
      });
    } catch (error) {
      console.error("Error starting chat:", error);
      Alert.alert("Error", "Failed to start chat. Please try again.");
    } finally {
      setIsChatLoading(false);
    }
  };

  // Render image indicator dots
  const renderImageDots = () => {
    const images = turf?.images || [];
    if (images.length <= 1) return null;

    return (
      <View style={styles.dotsContainer}>
        {images.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              currentImageIndex === index && styles.activeDot,
            ]}
          />
        ))}
      </View>
    );
  };

  // Render image gallery
  const renderImageGallery = () => {
    const images = turf?.images || [];
    const hasImages = images.length > 0;

    return (
      <View style={styles.imageGalleryContainer}>
        {hasImages ? (
          <FlatList
            data={images}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
              setCurrentImageIndex(index);
            }}
            renderItem={({ item }) => (
              <Image source={{ uri: item }} style={styles.galleryImage} />
            )}
            keyExtractor={(item, index) => index.toString()}
          />
        ) : (
          <View style={[styles.galleryImage, styles.placeholderImage]}>
            <MaterialCommunityIcons name="soccer-field" size={80} color="#ccc" />
            <Text style={styles.placeholderText}>No images available</Text>
          </View>
        )}

        {/* Back button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="#111827" />
        </TouchableOpacity>

        {/* Action buttons */}
        <View style={styles.imageActions}>
          <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
            <MaterialCommunityIcons name="share-variant" size={22} color="#111827" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={toggleFavorite}>
            <MaterialCommunityIcons
              name={isFavorite ? "heart" : "heart-outline"}
              size={22}
              color={isFavorite ? "#FF5252" : "#111827"}
            />
          </TouchableOpacity>
        </View>

        {renderImageDots()}
      </View>
    );
  };

  // Render basic info section
  const renderBasicInfo = () => (
    <View style={styles.section}>
      <View style={styles.titleRow}>
        <View style={styles.titleLeft}>
          <Text variant="headlineSmall" style={styles.turfName}>
            {turf?.name}
          </Text>
          <View style={styles.locationRow}>
            <MaterialCommunityIcons name="map-marker" size={16} color="#666" />
            <Text variant="bodyMedium" style={styles.locationText}>
              {formatLocation(turf?.location)}
            </Text>
          </View>
        </View>
        <View style={styles.ratingContainer}>
          <View style={styles.ratingBadge}>
            <MaterialCommunityIcons name="star" size={18} color="#FFD700" />
            <Text style={styles.ratingText}>{turf?.rating || "New"}</Text>
          </View>
          <Text variant="bodySmall" style={styles.reviewCount}>
            {turf?.reviewCount || 0} review{(turf?.reviewCount || 0) !== 1 ? "s" : ""}
          </Text>
        </View>
      </View>

      {/* Operating hours */}
      <View style={styles.infoRow}>
        <MaterialCommunityIcons name="clock-outline" size={18} color={USER_COLOR} />
        <Text variant="bodyMedium" style={styles.infoText}>
          {formatOperatingHours(turf?.operatingHours)}
        </Text>
        <Chip
          mode="flat"
          style={[
            styles.statusChip,
            { backgroundColor: USER_COLOR + "20" },
          ]}
          textStyle={{ color: USER_COLOR, fontSize: 12 }}
        >
          Open Now
        </Chip>
      </View>

      {/* Sports offered */}
      <View style={styles.sportsRow}>
        {(turf?.sports || []).map((sport, index) => (
          <Chip
            key={index}
            style={styles.sportChip}
            textStyle={styles.sportChipText}
            icon={() => (
              <MaterialCommunityIcons
                name={SPORT_ICONS[sport.toLowerCase()] || SPORT_ICONS.default}
                size={16}
                color={USER_COLOR}
              />
            )}
          >
            {sport}
          </Chip>
        ))}
      </View>
    </View>
  );

  // Render grounds section
  const renderGroundsSection = () => (
    <View style={styles.section}>
      <Text variant="titleMedium" style={styles.sectionTitle}>
        Available Grounds ({grounds.length})
      </Text>
      {grounds.length === 0 ? (
        <Text variant="bodyMedium" style={styles.emptyText}>
          No grounds available
        </Text>
      ) : (
        grounds.map((ground, index) => (
          <Surface key={ground.id || index} style={styles.groundCard} elevation={1}>
            <View style={styles.groundHeader}>
              <Text variant="titleSmall" style={styles.groundName}>
                {ground.name || `Ground ${index + 1}`}
              </Text>
              <Text variant="bodySmall" style={styles.groundSize}>
                {ground.size || "Standard"} size
              </Text>
            </View>
            <View style={styles.groundDetails}>
              <View style={styles.groundInfo}>
                <MaterialCommunityIcons name="account-group" size={14} color="#666" />
                <Text variant="bodySmall" style={styles.groundInfoText}>
                  {ground.capacity || "10-14"} players
                </Text>
              </View>
              {getGroundMinPrice(ground.pricing) && (
                <View style={styles.groundInfo}>
                  <MaterialCommunityIcons name="currency-inr" size={14} color={USER_COLOR} />
                  <Text variant="bodySmall" style={[styles.groundInfoText, { color: USER_COLOR }]}>
                    From ₹{getGroundMinPrice(ground.pricing)}/hr
                  </Text>
                </View>
              )}
            </View>
            {ground.sports && ground.sports.length > 0 && (
              <View style={styles.groundSports}>
                {ground.sports.map((sport, idx) => (
                  <View key={idx} style={styles.groundSportTag}>
                    <Text style={styles.groundSportText}>{sport}</Text>
                  </View>
                ))}
              </View>
            )}
          </Surface>
        ))
      )}
    </View>
  );

  // Render pricing preview
  const renderPricingPreview = () => {
    const pricingRanges = getPricingRanges(grounds);
    const hasAnyPricing = pricingRanges.morning || pricingRanges.afternoon || pricingRanges.evening;

    if (!hasAnyPricing) {
      return (
        <View style={styles.section}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Pricing
          </Text>
          <Text variant="bodyMedium" style={styles.emptyText}>
            Contact turf for pricing details
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.section}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Pricing
        </Text>
        <Surface style={styles.pricingCard} elevation={1}>
          {pricingRanges.morning && (
            <>
              <View style={styles.pricingRow}>
                <Text variant="bodyMedium" style={styles.pricingLabel}>Morning (6AM - 12PM)</Text>
                <Text variant="bodyMedium" style={styles.pricingValue}>{pricingRanges.morning}/hr</Text>
              </View>
              <Divider style={styles.pricingDivider} />
            </>
          )}
          {pricingRanges.afternoon && (
            <>
              <View style={styles.pricingRow}>
                <Text variant="bodyMedium" style={styles.pricingLabel}>Afternoon (12PM - 5PM)</Text>
                <Text variant="bodyMedium" style={styles.pricingValue}>{pricingRanges.afternoon}/hr</Text>
              </View>
              <Divider style={styles.pricingDivider} />
            </>
          )}
          {pricingRanges.evening && (
            <>
              <View style={styles.pricingRow}>
                <Text variant="bodyMedium" style={styles.pricingLabel}>Evening (5PM - 11PM)</Text>
                <Text variant="bodyMedium" style={styles.pricingValue}>{pricingRanges.evening}/hr</Text>
              </View>
              {pricingRanges.weekendDiff && <Divider style={styles.pricingDivider} />}
            </>
          )}
          {pricingRanges.weekendDiff && (
            <View style={styles.pricingRow}>
              <Text variant="bodyMedium" style={styles.pricingLabel}>Weekend Surcharge</Text>
              <Text variant="bodyMedium" style={styles.pricingValue}>+₹{pricingRanges.weekendDiff}/hr</Text>
            </View>
          )}
        </Surface>
        <Text variant="bodySmall" style={styles.pricingNote}>
          * Prices vary based on ground selection
        </Text>
      </View>
    );
  };

  // Render amenities section
  const renderAmenitiesSection = () => {
    const amenities = turf?.amenities || [];
    if (amenities.length === 0) return null;

    return (
      <View style={styles.section}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Amenities
        </Text>
        <View style={styles.amenitiesGrid}>
          {amenities.map((amenity, index) => {
            const amenityInfo = AMENITY_ICONS[amenity] || { icon: "check-circle", label: amenity };
            return (
              <View key={index} style={styles.amenityItem}>
                <View style={styles.amenityIcon}>
                  <MaterialCommunityIcons name={amenityInfo.icon} size={24} color={USER_COLOR} />
                </View>
                <Text variant="bodySmall" style={styles.amenityLabel}>
                  {amenityInfo.label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  // Render location section
  const renderLocationSection = () => (
    <View style={styles.section}>
      <Text variant="titleMedium" style={styles.sectionTitle}>
        Location
      </Text>
      <Surface style={styles.locationCard} elevation={1}>
        {/* Map placeholder */}
        <TouchableOpacity style={styles.mapPreview} onPress={handleGetDirections}>
          <MaterialCommunityIcons name="map" size={48} color="#ccc" />
          <Text variant="bodySmall" style={styles.mapPlaceholderText}>
            Tap to open in Maps
          </Text>
        </TouchableOpacity>
        <View style={styles.locationDetails}>
          <View style={styles.addressRow}>
            <MaterialCommunityIcons name="map-marker" size={18} color={USER_COLOR} />
            <Text variant="bodyMedium" style={styles.addressText}>
              {formatLocation(turf?.location)}
            </Text>
          </View>
          <Button
            mode="outlined"
            icon="directions"
            onPress={handleGetDirections}
            style={styles.directionsButton}
            textColor={USER_COLOR}
          >
            Get Directions
          </Button>
        </View>
      </Surface>
    </View>
  );

  // Format review date
  const formatReviewDate = (dateValue) => {
    if (!dateValue) return "";
    let date;
    if (dateValue.toDate) {
      date = dateValue.toDate();
    } else if (dateValue.seconds) {
      date = new Date(dateValue.seconds * 1000);
    } else {
      date = new Date(dateValue);
    }
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? "s" : ""} ago`;
    return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  };

  // Render reviews section
  const renderReviewsSection = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Reviews
        </Text>
      </View>

      {/* Rating summary */}
      <View style={styles.ratingSummary}>
        <View style={styles.ratingBig}>
          <Text style={styles.ratingBigNumber}>{turf?.rating || 0}</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <MaterialCommunityIcons
                key={star}
                name={star <= Math.floor(turf?.rating || 0) ? "star" : "star-outline"}
                size={16}
                color="#FFD700"
              />
            ))}
          </View>
          <Text variant="bodySmall" style={styles.totalReviews}>
            {turf?.reviewCount || reviews.length} review{(turf?.reviewCount || reviews.length) !== 1 ? "s" : ""}
          </Text>
        </View>
      </View>

      {/* Recent reviews */}
      {reviews.length > 0 ? (
        reviews.slice(0, 3).map((review) => (
          <Surface key={review.id} style={styles.reviewCard} elevation={1}>
            <View style={styles.reviewHeader}>
              <View style={styles.reviewUser}>
                <View style={styles.reviewAvatar}>
                  <MaterialCommunityIcons name="account" size={20} color="#666" />
                </View>
                <View>
                  <Text variant="titleSmall" style={styles.reviewUserName}>
                    {review.userName || "Anonymous"}
                  </Text>
                  <Text variant="bodySmall" style={styles.reviewDate}>
                    {formatReviewDate(review.createdAt)}
                  </Text>
                </View>
              </View>
              <View style={styles.reviewRating}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <MaterialCommunityIcons
                    key={star}
                    name={star <= review.rating ? "star" : "star-outline"}
                    size={14}
                    color="#FFD700"
                  />
                ))}
              </View>
            </View>
            <Text variant="bodyMedium" style={styles.reviewComment}>
              {review.comment}
            </Text>
            {review.response && (
              <View style={{ marginTop: 8, padding: 10, backgroundColor: "#F5F5F5", borderRadius: 8 }}>
                <Text variant="labelSmall" style={{ color: USER_COLOR, fontWeight: "600", marginBottom: 4 }}>
                  Response from Management
                </Text>
                <Text variant="bodySmall" style={{ color: "#555" }}>
                  {review.response}
                </Text>
              </View>
            )}
          </Surface>
        ))
      ) : (
        <Text variant="bodyMedium" style={{ color: "#999", textAlign: "center", paddingVertical: 16 }}>
          No reviews yet. Be the first to review!
        </Text>
      )}
    </View>
  );

  const renderOffersSection = () => {
    if (coupons.length === 0) return null;
    return (
      <View>
        <View style={styles.section}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Offers & Deals
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingLeft: 16, paddingRight: 4, gap: 10 }}
          >
            {coupons.map((coupon) => (
              <TurfOfferCard key={coupon.id} coupon={coupon} />
            ))}
          </ScrollView>
        </View>
        <Divider />
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={USER_COLOR} />
        <Text variant="bodyMedium" style={styles.loadingText}>
          Loading turf details...
        </Text>
      </SafeAreaView>
    );
  }

  if (!turf) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <MaterialCommunityIcons name="alert-circle" size={64} color="#ccc" />
        <Text variant="titleMedium" style={styles.errorTitle}>
          Turf not found
        </Text>
        <Button mode="contained" onPress={() => navigation.goBack()}>
          Go Back
        </Button>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {renderImageGallery()}
        {renderBasicInfo()}
        <Divider />
        {renderGroundsSection()}
        <Divider />
        {renderPricingPreview()}
        <Divider />
        {renderOffersSection()}
        {renderAmenitiesSection()}
        <Divider />
        {renderLocationSection()}
        <Divider />
        {renderReviewsSection()}
        {/* Bottom padding for CTA */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Fixed bottom CTA */}
      <Surface style={styles.bottomCTA} elevation={8}>
        <View style={styles.ctaContent}>
          <View>
            <Text variant="bodySmall" style={styles.ctaLabel}>Starting from</Text>
            <Text variant="titleMedium" style={styles.ctaPrice}>
              {getPricingRanges(grounds).startingFrom && getPricingRanges(grounds).startingFrom !== Infinity
                ? `₹${getPricingRanges(grounds).startingFrom}/hr`
                : "Contact for price"}
            </Text>
          </View>
          <View style={styles.ctaButtons}>
            <IconButton
              icon="chat-outline"
              mode="outlined"
              size={24}
              onPress={handleChatWithManager}
              loading={isChatLoading}
              disabled={isChatLoading}
              style={styles.chatButton}
              iconColor={USER_COLOR}
            />
            <Button
              mode="contained"
              onPress={handleCheckAvailability}
              buttonColor={USER_COLOR}
              style={styles.ctaButton}
            >
              Check Availability
            </Button>
          </View>
        </View>
      </Surface>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },
  scrollView: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: PAGE_BG,
  },
  loadingText: {
    marginTop: 12,
    color: "#666",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 20,
  },
  errorTitle: {
    marginVertical: 16,
    color: "#666",
  },

  // Image Gallery
  imageGalleryContainer: {
    height: IMAGE_HEIGHT,
    position: "relative",
  },
  galleryImage: {
    width: SCREEN_WIDTH,
    height: IMAGE_HEIGHT,
    resizeMode: "cover",
  },
  placeholderImage: {
    backgroundColor: "#f5f5f5",
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    marginTop: 8,
    color: "#999",
  },
  backButton: {
    position: "absolute",
    top: 12,
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.92)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  imageActions: {
    position: "absolute",
    top: 12,
    right: 16,
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.92)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  dotsContainer: {
    position: "absolute",
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.5)",
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: "#fff",
    width: 24,
  },

  // Section
  section: {
    padding: 16,
    backgroundColor: "#fff",
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 16,
    color: "#111827",
    marginBottom: 12,
  },
  seeAllText: {
    color: USER_COLOR,
    fontWeight: "600",
  },

  // Basic Info
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  titleLeft: {
    flex: 1,
    marginRight: 12,
  },
  turfName: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 22,
    color: "#111827",
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  locationText: {
    color: "#666",
    marginLeft: 4,
    flex: 1,
  },
  ratingContainer: {
    alignItems: "center",
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  ratingText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginLeft: 4,
  },
  reviewCount: {
    color: "#666",
    marginTop: 2,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  infoText: {
    color: "#333",
    marginLeft: 8,
    flex: 1,
  },
  statusChip: {
    height: 28,
  },
  sportsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  sportChip: {
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: EMERALD_PALE,
    borderRadius: 20,
  },
  sportChipText: {
    color: USER_COLOR,
    fontFamily: "Ubuntu-Medium",
    fontSize: 13,
  },

  // Grounds
  groundCard: {
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#F0FDF4",
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  groundHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  groundName: {
    fontWeight: "600",
    color: "#333",
  },
  groundSize: {
    color: "#666",
  },
  groundDetails: {
    flexDirection: "row",
    marginBottom: 8,
  },
  groundInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
  },
  groundInfoText: {
    marginLeft: 4,
    color: "#666",
  },
  groundSports: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  groundSportTag: {
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
  },
  groundSportText: {
    fontSize: 12,
    color: "#666",
  },

  // Pricing
  pricingCard: {
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#F0FDF4",
  },
  pricingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  pricingLabel: {
    fontFamily: "Ubuntu-Regular",
    color: "#4B5563",
    fontSize: 14,
  },
  pricingValue: {
    fontFamily: "Ubuntu-Bold",
    color: USER_COLOR,
    fontSize: 15,
  },
  pricingDivider: {
    marginHorizontal: 12,
  },
  pricingNote: {
    marginTop: 8,
    color: "#999",
    fontStyle: "italic",
  },

  // Amenities
  amenitiesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  amenityItem: {
    width: "25%",
    alignItems: "center",
    marginBottom: 18,
  },
  amenityIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: EMERALD_PALE,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  amenityLabel: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 11,
    color: "#4B5563",
    textAlign: "center",
  },

  // Location
  locationCard: {
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  mapPreview: {
    height: 150,
    backgroundColor: "#f5f5f5",
    justifyContent: "center",
    alignItems: "center",
  },
  mapPlaceholderText: {
    marginTop: 8,
    color: "#999",
  },
  locationDetails: {
    padding: 12,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  addressText: {
    flex: 1,
    marginLeft: 8,
    color: "#333",
  },
  directionsButton: {
    borderColor: USER_COLOR,
  },

  // Reviews
  ratingSummary: {
    alignItems: "center",
    paddingVertical: 16,
    marginBottom: 12,
  },
  ratingBig: {
    alignItems: "center",
  },
  ratingBigNumber: {
    fontSize: 48,
    fontWeight: "bold",
    color: "#333",
  },
  starsRow: {
    flexDirection: "row",
    marginVertical: 4,
  },
  totalReviews: {
    color: "#666",
  },
  reviewCard: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: "#fff",
  },
  reviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  reviewUser: {
    flexDirection: "row",
    alignItems: "center",
  },
  reviewAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  reviewUserName: {
    fontWeight: "600",
    color: "#333",
  },
  reviewDate: {
    color: "#999",
  },
  reviewRating: {
    flexDirection: "row",
  },
  reviewComment: {
    color: "#666",
    lineHeight: 20,
  },
  emptyText: {
    color: "#999",
    textAlign: "center",
    paddingVertical: 20,
  },

  // Bottom CTA
  bottomCTA: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 16,
  },
  ctaContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
  },
  ctaLabel: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 12,
    color: "#9CA3AF",
  },
  ctaPrice: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 22,
    color: USER_COLOR,
  },
  ctaButton: {
    borderRadius: 12,
    paddingHorizontal: 4,
  },
  ctaButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  chatButton: {
    borderColor: USER_COLOR,
    borderWidth: 1.5,
    margin: 0,
    borderRadius: 24,
  },
});
