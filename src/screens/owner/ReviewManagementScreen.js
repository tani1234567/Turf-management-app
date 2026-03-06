import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ScrollView,
} from "react-native";
import {
  Text,
  Surface,
  IconButton,
  ActivityIndicator,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSelector, useDispatch } from "react-redux";
import { selectUser } from "../../store/slices/authSlice";
import { selectCompany } from "../../store/slices/companySlice";
import { selectTurfs, setTurfs } from "../../store/slices/ownerSlice";
import {
  getReviewsForCompany,
  getReviewsForTurf,
  respondToReview,
  flagReview,
  removeReview,
  restoreReview,
  calculateReviewStats,
} from "../../services/firebase/reviews";
import { queryDocuments } from "../../services/firebase/firestore";
import ReviewCard from "../../components/ReviewCard";

const OWNER_COLOR = "#9C27B0";

export default function OwnerReviewManagementScreen({ navigation }) {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const company = useSelector(selectCompany);
  const reduxTurfs = useSelector(selectTurfs);

  // Turf data
  const [localTurfs, setLocalTurfs] = useState([]);
  const turfs = reduxTurfs && reduxTurfs.length > 0 ? reduxTurfs : localTurfs;

  // Filter
  const [selectedTurfId, setSelectedTurfId] = useState(null); // null = all turfs
  const [filterStatus, setFilterStatus] = useState("all");

  // Reviews state
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState({ average: 0, count: 0, distribution: {} });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch turfs if needed
  useEffect(() => {
    const fetchTurfs = async () => {
      if (reduxTurfs && reduxTurfs.length > 0) return;
      const companyId = company?.id || company?.companyId;
      if (!companyId) return;
      try {
        const fetched = await queryDocuments("turfs", [
          { field: "companyId", operator: "==", value: companyId },
        ]);
        setLocalTurfs(fetched);
        if (fetched.length > 0) {
          dispatch(setTurfs(fetched));
        }
      } catch (error) {
        console.error("Error fetching turfs:", error);
      }
    };
    fetchTurfs();
  }, [company, reduxTurfs]);

  // Fetch reviews
  const fetchReviews = useCallback(async () => {
    const companyId = company?.id || company?.companyId;
    if (!companyId) {
      setLoading(false);
      return;
    }

    try {
      let data;
      if (selectedTurfId) {
        const options = {};
        if (filterStatus !== "all") {
          options.status = filterStatus;
        }
        data = await getReviewsForTurf(selectedTurfId, options);
      } else {
        data = await getReviewsForCompany(companyId);
        if (filterStatus !== "all") {
          data = data.filter((r) => r.status === filterStatus);
        }
      }
      setReviews(data);
      setStats(calculateReviewStats(data));
    } catch (error) {
      console.error("Error fetching reviews:", error);
      Alert.alert("Error", "Failed to load reviews.");
    } finally {
      setLoading(false);
    }
  }, [company, selectedTurfId, filterStatus]);

  useEffect(() => {
    setLoading(true);
    fetchReviews();
  }, [fetchReviews]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchReviews();
    setRefreshing(false);
  }, [fetchReviews]);

  // Respond
  const handleRespond = async (reviewId, responseText) => {
    try {
      await respondToReview(reviewId, responseText, user);
      Alert.alert("Success", "Response posted.");
      await fetchReviews();
    } catch (error) {
      Alert.alert("Error", "Failed to post response.");
    }
  };

  // Flag
  const handleFlag = (reviewId) => {
    Alert.alert(
      "Flag Review",
      "Select a reason:",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Inappropriate Content",
          onPress: async () => {
            try {
              await flagReview(reviewId, "Inappropriate content", user);
              Alert.alert("Flagged", "Review flagged for moderation.");
              await fetchReviews();
            } catch (error) {
              Alert.alert("Error", "Failed to flag review.");
            }
          },
        },
        {
          text: "Spam / Fake",
          onPress: async () => {
            try {
              await flagReview(reviewId, "Spam or fake review", user);
              Alert.alert("Flagged", "Review flagged for moderation.");
              await fetchReviews();
            } catch (error) {
              Alert.alert("Error", "Failed to flag review.");
            }
          },
        },
      ]
    );
  };

  // Remove
  const handleRemove = (reviewId) => {
    Alert.alert(
      "Remove Review",
      "This will hide the review from public view and exclude it from ratings. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await removeReview(reviewId);
              Alert.alert("Removed", "Review has been removed.");
              await fetchReviews();
            } catch (error) {
              Alert.alert("Error", "Failed to remove review.");
            }
          },
        },
      ]
    );
  };

  // Restore
  const handleRestore = async (reviewId) => {
    try {
      await restoreReview(reviewId);
      Alert.alert("Restored", "Review has been restored.");
      await fetchReviews();
    } catch (error) {
      Alert.alert("Error", "Failed to restore review.");
    }
  };

  // Render stats
  const renderStats = () => {
    const maxCount = Math.max(...Object.values(stats.distribution || {}), 1);

    // Count by status
    const flaggedCount = reviews.filter((r) => r.status === "flagged").length;
    const removedCount = reviews.filter((r) => r.status === "removed").length;

    return (
      <View>
        <Surface style={styles.statsCard} elevation={1}>
          <View style={styles.statsHeader}>
            <View style={styles.statsOverview}>
              <Text variant="displaySmall" style={styles.avgRating}>
                {stats.average || 0}
              </Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <MaterialCommunityIcons
                    key={star}
                    name={star <= Math.round(stats.average) ? "star" : "star-outline"}
                    size={18}
                    color="#FFC107"
                  />
                ))}
              </View>
              <Text variant="bodySmall" style={styles.totalReviews}>
                {stats.count} review{stats.count !== 1 ? "s" : ""}
              </Text>
            </View>
            <View style={styles.distributionBars}>
              {[5, 4, 3, 2, 1].map((star) => {
                const count = (stats.distribution || {})[star] || 0;
                const width = maxCount > 0 ? (count / maxCount) * 100 : 0;
                return (
                  <View key={star} style={styles.distRow}>
                    <Text variant="bodySmall" style={styles.distStar}>
                      {star}
                    </Text>
                    <MaterialCommunityIcons name="star" size={12} color="#FFC107" />
                    <View style={styles.distBarBg}>
                      <View
                        style={[
                          styles.distBarFill,
                          { width: `${width}%`, backgroundColor: OWNER_COLOR },
                        ]}
                      />
                    </View>
                    <Text variant="bodySmall" style={styles.distCount}>
                      {count}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </Surface>

        {/* Moderation summary */}
        {(flaggedCount > 0 || removedCount > 0) && (
          <Surface style={styles.moderationCard} elevation={1}>
            <Text variant="titleSmall" style={styles.moderationTitle}>
              Moderation
            </Text>
            <View style={styles.moderationRow}>
              {flaggedCount > 0 && (
                <TouchableOpacity
                  style={styles.moderationBadge}
                  onPress={() => setFilterStatus("flagged")}
                >
                  <MaterialCommunityIcons name="flag" size={16} color="#FF9800" />
                  <Text variant="bodySmall" style={{ color: "#FF9800", fontWeight: "600" }}>
                    {flaggedCount} Flagged
                  </Text>
                </TouchableOpacity>
              )}
              {removedCount > 0 && (
                <View style={styles.moderationBadge}>
                  <MaterialCommunityIcons name="close-circle" size={16} color="#F44336" />
                  <Text variant="bodySmall" style={{ color: "#F44336", fontWeight: "600" }}>
                    {removedCount} Removed
                  </Text>
                </View>
              )}
            </View>
          </Surface>
        )}

        {/* Turf filter */}
        {turfs.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScrollView}
          >
            <View style={styles.filterRow}>
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  !selectedTurfId && styles.filterChipSelected,
                ]}
                onPress={() => setSelectedTurfId(null)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    !selectedTurfId && styles.filterChipTextSelected,
                  ]}
                >
                  All Turfs
                </Text>
              </TouchableOpacity>
              {turfs.map((turf) => (
                <TouchableOpacity
                  key={turf.id}
                  style={[
                    styles.filterChip,
                    selectedTurfId === turf.id && styles.filterChipSelected,
                  ]}
                  onPress={() =>
                    setSelectedTurfId(selectedTurfId === turf.id ? null : turf.id)
                  }
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      selectedTurfId === turf.id && styles.filterChipTextSelected,
                    ]}
                    numberOfLines={1}
                  >
                    {turf.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}

        {/* Status filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScrollView}
        >
          <View style={styles.filterRow}>
            {[
              { key: "all", label: "All" },
              { key: "active", label: "Active" },
              { key: "flagged", label: "Flagged" },
              { key: "removed", label: "Removed" },
            ].map((f) => (
              <TouchableOpacity
                key={f.key}
                style={[
                  styles.filterChip,
                  filterStatus === f.key && styles.filterChipSelected,
                ]}
                onPress={() => setFilterStatus(f.key)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    filterStatus === f.key && styles.filterChipTextSelected,
                  ]}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  };

  // Empty
  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons name="star-outline" size={64} color="#ccc" />
      <Text variant="titleMedium" style={styles.emptyTitle}>
        No Reviews Found
      </Text>
      <Text variant="bodyMedium" style={styles.emptyText}>
        {filterStatus !== "all"
          ? "No reviews match the current filter."
          : "No reviews across your turfs yet."}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <IconButton icon="arrow-left" onPress={() => navigation.goBack()} />
          <Text variant="titleLarge" style={styles.headerTitle}>
            All Reviews
          </Text>
          <View style={{ width: 48 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={OWNER_COLOR} />
          <Text variant="bodyMedium" style={styles.loadingText}>
            Loading reviews...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton icon="arrow-left" onPress={() => navigation.goBack()} />
        <Text variant="titleLarge" style={styles.headerTitle}>
          All Reviews
        </Text>
        <View style={{ width: 48 }} />
      </View>

      {/* Reviews list */}
      <FlatList
        data={reviews}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ReviewCard
            review={item}
            accentColor={OWNER_COLOR}
            showActions
            showTurfName
            onRespond={handleRespond}
            onFlag={handleFlag}
            onRemove={handleRemove}
            onRestore={handleRestore}
          />
        )}
        ListHeaderComponent={renderStats}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[OWNER_COLOR]}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F0FF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingRight: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  headerTitle: {
    fontWeight: "bold",
    color: "#333",
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: "#666",
    marginTop: 12,
  },

  // Stats
  statsCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#fff",
    marginBottom: 12,
  },
  statsHeader: {
    flexDirection: "row",
  },
  statsOverview: {
    alignItems: "center",
    paddingRight: 20,
    borderRightWidth: 1,
    borderRightColor: "#eee",
  },
  avgRating: {
    fontWeight: "bold",
    color: "#333",
  },
  starsRow: {
    flexDirection: "row",
    gap: 2,
    marginTop: 4,
  },
  totalReviews: {
    color: "#999",
    marginTop: 4,
  },
  distributionBars: {
    flex: 1,
    paddingLeft: 16,
    justifyContent: "center",
  },
  distRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    gap: 4,
  },
  distStar: {
    width: 12,
    textAlign: "center",
    color: "#666",
    fontSize: 12,
  },
  distBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: "#F0F0F0",
    borderRadius: 4,
    overflow: "hidden",
  },
  distBarFill: {
    height: 8,
    borderRadius: 4,
  },
  distCount: {
    width: 20,
    textAlign: "right",
    color: "#999",
    fontSize: 11,
  },

  // Moderation
  moderationCard: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#fff",
    marginBottom: 12,
  },
  moderationTitle: {
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  moderationRow: {
    flexDirection: "row",
    gap: 12,
  },
  moderationBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "#F5F5F5",
  },

  // Filter
  filterScrollView: {
    marginBottom: 12,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 4,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: OWNER_COLOR,
    backgroundColor: "#fff",
  },
  filterChipSelected: {
    backgroundColor: OWNER_COLOR,
    borderColor: OWNER_COLOR,
  },
  filterChipText: {
    color: OWNER_COLOR,
    fontSize: 13,
    fontWeight: "500",
  },
  filterChipTextSelected: {
    color: "#fff",
  },

  // Empty
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
  },
  emptyTitle: {
    fontWeight: "600",
    color: "#333",
    marginTop: 16,
  },
  emptyText: {
    color: "#666",
    marginTop: 8,
    textAlign: "center",
  },
});
