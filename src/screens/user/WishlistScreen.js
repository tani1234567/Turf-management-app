import { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Dimensions,
  Pressable,
  Animated,
} from "react-native";
import { Text, ActivityIndicator } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useDispatch, useSelector } from "react-redux";

import { selectUser } from "../../store/slices/authSlice";
import {
  selectWishlistIds,
  toggleWishlistItem,
} from "../../store/slices/wishlistSlice";
import { getDocument } from "../../services/firebase/firestore";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const USER_COLOR = "#4CAF50";
const CARD_WIDTH = (SCREEN_WIDTH - 48) / 2;

export default function WishlistScreen({ navigation }) {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const wishlistIds = useSelector(selectWishlistIds);

  const [turfs, setTurfs] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchWishlistedTurfs = useCallback(async () => {
    if (!wishlistIds || wishlistIds.length === 0) {
      setTurfs([]);
      return;
    }
    setLoading(true);
    try {
      const results = await Promise.all(
        wishlistIds.map(async (id) => {
          const data = await getDocument("turfs", id);
          if (!data) return null;
          const firstGround = data.grounds?.[0];
          const price =
            firstGround?.pricing?.weekday?.morning?.rate ||
            firstGround?.pricing?.allDayRate ||
            data.pricePerHour ||
            0;
          return {
            id,
            name: data.name,
            imageUrl: data.imageUrl || data.coverImage || null,
            location: data.location,
            sports: data.sports || [],
            rating: data.rating || 0,
            reviewCount: data.reviewCount || 0,
            price,
          };
        })
      );
      setTurfs(results.filter(Boolean));
    } catch (err) {
      console.error("Error fetching wishlisted turfs:", err);
    } finally {
      setLoading(false);
    }
  }, [wishlistIds]);

  useEffect(() => {
    fetchWishlistedTurfs();
  }, [fetchWishlistedTurfs]);

  const handleRemove = (turfId) => {
    if (user?.userId) {
      dispatch(toggleWishlistItem({ userId: user.userId, turfId }));
    }
  };

  const formatLocation = (location) => {
    if (!location) return "Location not specified";
    if (typeof location === "string") return location;
    const parts = [location.city, location.state].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : location.address || "Location not specified";
  };

  const renderCard = ({ item }) => (
    <View style={styles.card}>
      <Pressable
        onPress={() => navigation.navigate("TurfDetails", { turfId: item.id })}
        style={styles.cardPressable}
      >
        <View style={styles.imageContainer}>
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.cardImage} />
          ) : (
            <View style={[styles.cardImage, styles.placeholder]}>
              <MaterialCommunityIcons name="soccer-field" size={36} color="#ccc" />
            </View>
          )}

          {/* Remove from wishlist */}
          <TouchableOpacity
            style={styles.heartButton}
            onPress={() => handleRemove(item.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialCommunityIcons name="heart" size={20} color="#FF4444" />
          </TouchableOpacity>

          {/* Sport chips */}
          {item.sports.length > 0 && (
            <View style={styles.sportChip}>
              <Text style={styles.sportChipText}>{item.sports[0]}</Text>
            </View>
          )}
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.cardName} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.locationRow}>
            <MaterialCommunityIcons name="map-marker-outline" size={12} color="#999" />
            <Text style={styles.locationText} numberOfLines={1}>
              {formatLocation(item.location)}
            </Text>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.ratingGroup}>
              <MaterialCommunityIcons name="star" size={12} color="#F59E0B" />
              <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
              <Text style={styles.reviewText}>({item.reviewCount})</Text>
            </View>
            <Text style={styles.priceText}>
              ₹{item.price}
              <Text style={styles.perHour}>/hr</Text>
            </Text>
          </View>
        </View>
      </Pressable>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons name="heart-outline" size={72} color="#e0e0e0" />
      <Text style={styles.emptyTitle}>Your wishlist is empty</Text>
      <Text style={styles.emptySubtitle}>
        Tap the heart icon on any turf to save it here for quick access.
      </Text>
      <TouchableOpacity
        style={styles.exploreButton}
        onPress={() => navigation.navigate("Home")}
      >
        <Text style={styles.exploreButtonText}>Explore Turfs</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Wishlist</Text>
        {turfs.length > 0 && (
          <Text style={styles.headerCount}>{turfs.length} saved</Text>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={USER_COLOR} />
        </View>
      ) : (
        <FlatList
          data={turfs}
          renderItem={renderCard}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={
            turfs.length === 0 ? styles.emptyListContent : styles.listContent
          }
          ListEmptyComponent={renderEmpty}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  headerTitle: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 22,
    color: "#0A0F1E",
  },
  headerCount: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 13,
    color: "#999",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  emptyListContent: {
    flex: 1,
  },
  columnWrapper: {
    gap: 16,
    marginBottom: 16,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: "#fff",
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
  },
  cardPressable: {
    flex: 1,
  },
  imageContainer: {
    width: "100%",
    height: 120,
    position: "relative",
    backgroundColor: "#f0f0f0",
  },
  cardImage: {
    width: "100%",
    height: "100%",
  },
  placeholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  heartButton: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderRadius: 20,
    padding: 5,
  },
  sportChip: {
    position: "absolute",
    bottom: 8,
    left: 8,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  sportChipText: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 10,
    color: "#fff",
    textTransform: "capitalize",
  },
  cardBody: {
    padding: 10,
    gap: 4,
  },
  cardName: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 13,
    color: "#111827",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  locationText: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 11,
    color: "#9CA3AF",
    flex: 1,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  ratingGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  ratingText: {
    fontFamily: "Ubuntu-Medium",
    fontSize: 11,
    color: "#374151",
  },
  reviewText: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 10,
    color: "#9CA3AF",
  },
  priceText: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 12,
    color: USER_COLOR,
  },
  perHour: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 10,
    color: "#9CA3AF",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 18,
    color: "#374151",
    textAlign: "center",
  },
  emptySubtitle: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 13,
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 20,
  },
  exploreButton: {
    marginTop: 8,
    backgroundColor: USER_COLOR,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  exploreButtonText: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 14,
    color: "#fff",
  },
});
