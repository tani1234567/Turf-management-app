import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Image,
  Alert,
} from "react-native";
import {
  Text,
  Surface,
  FAB,
  Searchbar,
  Chip,
  IconButton,
  Menu,
  ActivityIndicator,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSelector, useDispatch } from "react-redux";
import { selectTurfs, setTurfs, updateTurf } from "../../store/slices/ownerSlice";
import { selectCompany } from "../../store/slices/companySlice";
import { queryDocuments, updateDocument } from "../../services/firebase/firestore";
import { isRemoteImageUri } from "../../services/firebase/turfImages";

const OWNER_COLOR = "#9C27B0";
const PALE_PURPLE = "#F3E5F5";
const SUCCESS_GREEN = "#22C55E";

export default function TurfManagementScreen({ navigation, route }) {
  const dispatch = useDispatch();
  const turfs = useSelector(selectTurfs);
  const company = useSelector(selectCompany);
  const companyId = company?.id || company?.companyId;

  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [menuVisible, setMenuVisible] = useState(null);
  const [loadingTurfs, setLoadingTurfs] = useState(false);

  useEffect(() => {
    // Handle navigation params for adding turf
    if (route.params?.action === "add") {
      handleAddTurf();
    }
  }, [route.params]);

  const fetchTurfs = async ({ showRefresh = false } = {}) => {
    if (!companyId) return;

    if (showRefresh) {
      setRefreshing(true);
    } else {
      setLoadingTurfs(true);
    }

    try {
      const fetchedTurfs = await queryDocuments("turfs", [
        { field: "companyId", operator: "==", value: companyId },
      ]);
      dispatch(setTurfs(fetchedTurfs));
    } catch (error) {
      console.error("Error fetching turfs:", error);
      Alert.alert("Error", "Failed to load turfs. Please try again.");
    } finally {
      setRefreshing(false);
      setLoadingTurfs(false);
    }
  };

  useEffect(() => {
    if (companyId) {
      fetchTurfs();
    }
  }, [companyId]);

  const onRefresh = () => fetchTurfs({ showRefresh: true });

  const handleAddTurf = () => {
    navigation.navigate("AddTurf");
  };

  const handleEditTurf = (turfId) => {
    navigation.navigate("EditTurf", { turfId });
  };

  const handleToggleActive = async (turf) => {
    const newStatus = !turf.isActive;
    const action = newStatus ? "activate" : "deactivate";

    Alert.alert(
      `${action.charAt(0).toUpperCase() + action.slice(1)} Turf`,
      `Are you sure you want to ${action} "${turf.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: action.charAt(0).toUpperCase() + action.slice(1),
          onPress: async () => {
            try {
              await updateDocument("turfs", turf.turfId || turf.id, {
                isActive: newStatus,
              });
              dispatch(updateTurf({
                turfId: turf.turfId || turf.id,
                isActive: newStatus,
              }));
              Alert.alert("Success", `Turf has been ${action}d.`);
            } catch (error) {
              console.error("Error toggling turf status:", error);
              Alert.alert("Error", `Failed to ${action} turf.`);
            }
          },
        },
      ]
    );
  };

  const filteredTurfs = (turfs || []).filter((turf) =>
    turf.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    turf.location?.city?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const TurfCard = ({ turf }) => (
    <Surface style={styles.turfCard} elevation={1}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => handleEditTurf(turf.turfId || turf.id)}
        onLongPress={() => setMenuVisible(turf.turfId || turf.id)}
      >
        {/* Cover Image */}
        {isRemoteImageUri(turf.coverImage) && (
          <Image
            source={{ uri: turf.coverImage }}
            style={styles.coverImage}
            resizeMode="cover"
          />
        )}

        <View style={styles.cardContent}>
          <View style={styles.turfHeader}>
            <View style={styles.turfInfo}>
              <Text style={styles.turfName}>{turf.name}</Text>
              <View style={styles.turfLocation}>
                <MaterialCommunityIcons name="map-marker" size={14} color="#6B7280" />
                <Text style={styles.locationText}>
                  {turf.location?.city || "Location not set"}
                </Text>
              </View>
            </View>
            <View style={[
              styles.statusPill,
              { backgroundColor: turf.isActive ? "#DCFCE7" : "#FEE2E2" },
            ]}>
              <Text style={[
                styles.statusPillText,
                { color: turf.isActive ? SUCCESS_GREEN : "#EF4444" },
              ]}>
                {turf.isActive ? "Active" : "Inactive"}
              </Text>
            </View>
          </View>

          <View style={styles.turfStats}>
            <View style={styles.statItem}>
              <MaterialCommunityIcons name="soccer-field" size={16} color="#9CA3AF" />
              <Text style={styles.statText}>
                {turf.totalGrounds || turf.grounds?.length || 0} grounds
              </Text>
            </View>
            <View style={styles.statItem}>
              <MaterialCommunityIcons name="account-tie" size={16} color="#9CA3AF" />
              <Text style={styles.statText}>
                {turf.managerIds?.length || 0} managers
              </Text>
            </View>
            <View style={styles.statItem}>
              <MaterialCommunityIcons name="calendar-check" size={16} color="#9CA3AF" />
              <Text style={styles.statText}>{turf.stats?.todayBookings || 0} today</Text>
            </View>
          </View>

          <View style={styles.turfFooter}>
            <Text style={styles.revenueLabel}>Revenue this month</Text>
            <Text style={styles.revenueValue}>
              ₹{(turf.stats?.monthlyRevenue || 0).toLocaleString()}
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Actions Menu */}
      <View style={styles.menuContainer}>
        <Menu
          visible={menuVisible === (turf.turfId || turf.id)}
          onDismiss={() => setMenuVisible(null)}
          anchor={
            <IconButton
              icon="dots-vertical"
              size={20}
              onPress={() => setMenuVisible(turf.turfId || turf.id)}
            />
          }
        >
          <Menu.Item
            leadingIcon="pencil"
            onPress={() => {
              setMenuVisible(null);
              handleEditTurf(turf.turfId || turf.id);
            }}
            title="Edit Turf"
          />
          <Menu.Item
            leadingIcon="chart-line"
            onPress={() => {
              setMenuVisible(null);
              // TODO: Navigate to analytics
              Alert.alert("Coming Soon", "Analytics feature coming soon!");
            }}
            title="View Analytics"
          />
          <Menu.Item
            leadingIcon="history"
            onPress={() => {
              setMenuVisible(null);
              navigation.navigate("TurfEditLogs", {
                turfId: turf.turfId || turf.id,
                turfName: turf.name,
              });
            }}
            title="View Edit Logs"
          />
          <Menu.Item
            leadingIcon={turf.isActive ? "close-circle" : "check-circle"}
            onPress={() => {
              setMenuVisible(null);
              handleToggleActive(turf);
            }}
            title={turf.isActive ? "Deactivate" : "Activate"}
          />
        </Menu>
      </View>
    </Surface>
  );

  const EmptyState = () => (
    <View style={styles.emptyContainer}>
      {loadingTurfs ? (
        <>
          <ActivityIndicator animating color={OWNER_COLOR} />
          <Text variant="bodyMedium" style={styles.emptyText}>
            Loading your turfs...
          </Text>
        </>
      ) : (
        <>
          <MaterialCommunityIcons name="soccer-field" size={64} color="#ccc" />
          <Text variant="titleMedium" style={styles.emptyTitle}>
            No Turfs Yet
          </Text>
          <Text variant="bodyMedium" style={styles.emptyText}>
            Add your first turf to start accepting bookings from customers.
          </Text>
        </>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Turf Management</Text>
        <Text style={styles.subtitle}>
          {turfs.length} turf{turfs.length !== 1 ? "s" : ""} •{" "}
          {company?.stats?.totalGrounds || 0} grounds
        </Text>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="Search turfs..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
          inputStyle={styles.searchInput}
        />
      </View>

      {/* Turfs List */}
      <FlatList
        data={filteredTurfs}
        keyExtractor={(item) => item.turfId || item.id}
        renderItem={({ item }) => <TurfCard turf={item} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={EmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[OWNER_COLOR]}
          />
        }
      />

      {/* FAB */}
      <FAB
        icon="plus"
        style={styles.fab}
        color="#fff"
        onPress={handleAddTurf}
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
    padding: 16,
    paddingBottom: 8,
  },
  title: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 22,
    color: "#4A148C",
  },
  subtitle: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 13,
    color: "#6B7280",
    marginTop: 4,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  searchbar: {
    backgroundColor: "#fff",
    borderRadius: 12,
    elevation: 0,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  searchInput: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 14,
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
  },
  turfCard: {
    borderRadius: 16,
    backgroundColor: "#fff",
    marginBottom: 12,
    overflow: "hidden",
    position: "relative",
    borderLeftWidth: 4,
    borderLeftColor: OWNER_COLOR,
  },
  coverImage: {
    width: "100%",
    height: 120,
  },
  cardContent: {
    padding: 16,
  },
  turfHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  turfInfo: {
    flex: 1,
  },
  turfName: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 15,
    color: "#111827",
  },
  turfLocation: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  locationText: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 12,
    color: "#6B7280",
    marginLeft: 4,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    marginLeft: 8,
  },
  statusPillText: {
    fontFamily: "Ubuntu-Medium",
    fontSize: 11,
  },
  turfStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  statText: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 12,
    color: "#6B7280",
    marginLeft: 4,
  },
  turfFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },
  revenueLabel: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 12,
    color: "#6B7280",
  },
  revenueValue: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 14,
    color: SUCCESS_GREEN,
  },
  menuContainer: {
    position: "absolute",
    top: 8,
    right: 8,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
  },
  emptyTitle: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 16,
    color: "#111827",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    paddingHorizontal: 32,
  },
  fab: {
    position: "absolute",
    right: 16,
    bottom: 16,
    backgroundColor: OWNER_COLOR,
  },
});
