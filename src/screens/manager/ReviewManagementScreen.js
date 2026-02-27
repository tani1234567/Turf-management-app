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
  Menu,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSelector } from "react-redux";
import { selectUser, selectAssignedTurfIds } from "../../store/slices/authSlice";
import {
  getReviewsForTurf,
  respondToReview,
  flagReview,
  calculateReviewStats,
} from "../../services/firebase/reviews";
import { getDocument } from "../../services/firebase/firestore";
import ReviewCard from "../../components/ReviewCard";

const MANAGER_COLOR = "#2196F3";

export default function ManagerReviewManagementScreen({ navigation }) {
  const user = useSelector(selectUser);
  const assignedTurfIds = useSelector(selectAssignedTurfIds);

  // Turf state
  const [turfs, setTurfs] = useState([]);
  const [selectedTurfId, setSelectedTurfId] = useState(null);
  const [turfMenuVisible, setTurfMenuVisible] = useState(false);

  // Reviews state
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState({ average: 0, count: 0, distribution: {} });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filter
  const [filterStatus, setFilterStatus] = useState("all"); // all, active, flagged

  // Load turfs
  useEffect(() => {
    const loadTurfs = async () => {
      if (!assignedTurfIds || assignedTurfIds.length === 0) {
        setLoading(false);
        return;
      }
      try {
        const turfPromises = assignedTurfIds.map((id) => getDocument("turfs", id));
        const turfDocs = await Promise.all(turfPromises);
        const validTurfs = turfDocs.filter(Boolean);
        setTurfs(validTurfs);
        if (validTurfs.length > 0) {
          setSelectedTurfId(validTurfs[0].id);
        }
      } catch (error) {
        console.error("Error loading turfs:", error);
        setLoading(false);
      }
    };
    loadTurfs();
  }, [assignedTurfIds]);

  // Fetch reviews
  const fetchReviews = useCallback(async () => {
    if (!selectedTurfId) {
      setLoading(false);
      return;
    }

    try {
      const options = {};
      if (filterStatus !== "all") {
        options.status = filterStatus;
      }
      const data = await getReviewsForTurf(selectedTurfId, options);
      setReviews(data);
      setStats(calculateReviewStats(data));
    } catch (error) {
      console.error("Error fetching reviews:", error);
      Alert.alert("Error", "Failed to load reviews.");
    } finally {
      setLoading(false);
    }
  }, [selectedTurfId, filterStatus]);

  useEffect(() => {
    if (selectedTurfId) {
      setLoading(true);
      fetchReviews();
    }
  }, [selectedTurfId, filterStatus, fetchReviews]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchReviews();
    setRefreshing(false);
  }, [fetchReviews]);

  // Handle respond
  const handleRespond = async (reviewId, responseText) => {
    try {
      await respondToReview(reviewId, responseText, user);
      Alert.alert("Success", "Response posted successfully.");
      await fetchReviews();
    } catch (error) {
      console.error("Error responding:", error);
      Alert.alert("Error", "Failed to post response.");
    }
  };

  // Handle flag
  const handleFlag = (reviewId) => {
    Alert.alert(
      "Flag Review",
      "Select a reason for flagging this review:",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Inappropriate Content",
          onPress: async () => {
            try {
              await flagReview(reviewId, "Inappropriate content", user);
              Alert.alert("Flagged", "Review has been flagged for moderation.");
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
              Alert.alert("Flagged", "Review has been flagged for moderation.");
              await fetchReviews();
            } catch (error) {
              Alert.alert("Error", "Failed to flag review.");
            }
          },
        },
      ]
    );
  };

  const selectedTurf = turfs.find((t) => t.id === selectedTurfId);
  const hasMultipleTurfs = turfs.length > 1;

  // Render rating distribution
  const renderDistribution = () => {
    const maxCount = Math.max(...Object.values(stats.distribution || {}), 1);

    return (
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
                        { width: `${width}%`, backgroundColor: MANAGER_COLOR },
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
    );
  };

  // Render header with stats + filters
  const renderHeader = () => (
    <View>
      {renderDistribution()}

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScrollView}
      >
        <View style={styles.filterRow}>
          {[
            { key: "all", label: "All Reviews" },
            { key: "active", label: "Active" },
            { key: "flagged", label: "Flagged" },
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

  // Empty state
  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons name="star-outline" size={64} color="#ccc" />
      <Text variant="titleMedium" style={styles.emptyTitle}>
        No Reviews Yet
      </Text>
      <Text variant="bodyMedium" style={styles.emptyText}>
        Reviews from customers will appear here.
      </Text>
    </View>
  );

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <IconButton icon="arrow-left" onPress={() => navigation.goBack()} />
          <Text variant="titleLarge" style={styles.headerTitle}>
            Reviews
          </Text>
          <View style={{ width: 48 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={MANAGER_COLOR} />
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
          Reviews
        </Text>
        <View style={{ width: 48 }} />
      </View>

      {/* Turf Selector */}
      {turfs.length > 0 && (
        <View style={styles.turfSelectorContainer}>
          {hasMultipleTurfs ? (
            <Menu
              visible={turfMenuVisible}
              onDismiss={() => setTurfMenuVisible(false)}
              anchor={
                <TouchableOpacity
                  style={styles.turfSelectorButton}
                  onPress={() => setTurfMenuVisible(true)}
                >
                  <MaterialCommunityIcons
                    name="soccer-field"
                    size={18}
                    color={MANAGER_COLOR}
                  />
                  <Text
                    variant="titleSmall"
                    style={styles.turfSelectorText}
                    numberOfLines={1}
                  >
                    {selectedTurf?.name || "Select Turf"}
                  </Text>
                  <MaterialCommunityIcons
                    name="chevron-down"
                    size={18}
                    color="#666"
                  />
                </TouchableOpacity>
              }
              contentStyle={{ backgroundColor: "#fff" }}
            >
              {turfs.map((turf) => (
                <Menu.Item
                  key={turf.id}
                  onPress={() => {
                    setSelectedTurfId(turf.id);
                    setTurfMenuVisible(false);
                  }}
                  title={turf.name}
                  leadingIcon={
                    turf.id === selectedTurfId ? "check-circle" : "circle-outline"
                  }
                />
              ))}
            </Menu>
          ) : (
            <View style={styles.turfSelectorButton}>
              <MaterialCommunityIcons
                name="soccer-field"
                size={18}
                color={MANAGER_COLOR}
              />
              <Text
                variant="titleSmall"
                style={styles.turfSelectorText}
                numberOfLines={1}
              >
                {selectedTurf?.name || "No Turf"}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Reviews list */}
      <FlatList
        data={reviews}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ReviewCard
            review={item}
            accentColor={MANAGER_COLOR}
            showActions
            onRespond={handleRespond}
            onFlag={handleFlag}
          />
        )}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[MANAGER_COLOR]}
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
    backgroundColor: "#f5f5f5",
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

  // Turf Selector
  turfSelectorContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  turfSelectorButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E3F2FD",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  turfSelectorText: {
    flex: 1,
    color: "#333",
    fontWeight: "600",
  },

  // Stats
  statsCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#fff",
    marginBottom: 16,
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
    borderColor: MANAGER_COLOR,
    backgroundColor: "#fff",
  },
  filterChipSelected: {
    backgroundColor: MANAGER_COLOR,
    borderColor: MANAGER_COLOR,
  },
  filterChipText: {
    color: MANAGER_COLOR,
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
