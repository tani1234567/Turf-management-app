import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import {
  Text,
  Surface,
  Searchbar,
  Chip,
  IconButton,
  Menu,
  SegmentedButtons,
  Avatar,
  Badge,
  ActivityIndicator,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSelector } from "react-redux";
import { selectUnassignedCaretakers, selectCompany } from "../../store/slices/companySlice";
import { selectTurfs } from "../../store/slices/ownerSlice";
import { queryDocuments } from "../../services/firebase/firestore";

const OWNER_COLOR = "#9C27B0";
const MANAGER_COLOR = "#2196F3";
const CARETAKER_COLOR = "#FF9800";

export default function TeamManagementScreen({ navigation }) {
  const company = useSelector(selectCompany);
  const unassignedCaretakers = useSelector(selectUnassignedCaretakers);
  const turfs = useSelector(selectTurfs);
  const companyId = company?.id || company?.companyId;

  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState("managers");
  const [menuVisible, setMenuVisible] = useState(null);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [managerProfiles, setManagerProfiles] = useState([]);
  const [caretakerProfiles, setCaretakerProfiles] = useState([]);

  const fetchTeam = async ({ showRefresh = false } = {}) => {
    if (!companyId) return;

    if (showRefresh) {
      setRefreshing(true);
    } else {
      setLoadingTeam(true);
    }

    try {
      const users = await queryDocuments("users", [
        { field: "companyId", operator: "==", value: companyId },
      ]);

      const managerDocs = users
        .filter((u) => u.role === "manager")
        .map((u) => ({
          ...u,
          assignedTurfs: u.assignedTurfs || u.assignedTurfIds || [],
        }));

      const caretakerDocs = users
        .filter((u) => u.role === "caretaker")
        .map((u) => ({
          ...u,
          isAssigned:
            typeof u.isAssigned === "boolean"
              ? u.isAssigned
              : !unassignedCaretakers.includes(u.id || u.userId),
        }));

      setManagerProfiles(managerDocs);
      setCaretakerProfiles(caretakerDocs);
    } catch (error) {
      console.error("Error fetching team:", error);
    } finally {
      setRefreshing(false);
      setLoadingTeam(false);
    }
  };

  useEffect(() => {
    if (companyId) {
      fetchTeam();
    }
  }, [companyId]);

  const onRefresh = () => fetchTeam({ showRefresh: true });

  const displayManagers = managerProfiles;
  const displayCaretakers = caretakerProfiles;

  const filteredManagers = displayManagers.filter(
    (m) =>
      m?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m?.phone?.includes(searchQuery)
  );

  const filteredCaretakers = displayCaretakers.filter(
    (c) =>
      c?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c?.phone?.includes(searchQuery)
  );

  const getTurfName = (turfId) => {
    const turf = turfs.find((t) => t.turfId === turfId || t.id === turfId);
    return turf?.name || "Unknown Turf";
  };

  const ManagerCard = ({ manager }) => (
    <Surface style={styles.card} elevation={1}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => {
          // TODO: Navigate to manager details
        }}
      >
        <View style={styles.cardHeader}>
          <View style={styles.avatarContainer}>
            <Avatar.Text
              size={48}
              label={manager.name?.substring(0, 2).toUpperCase() || "?"}
              style={{ backgroundColor: MANAGER_COLOR }}
            />
            {manager.isSuspended && (
              <Badge style={styles.suspendedBadge} size={16}>
                !
              </Badge>
            )}
          </View>
          <View style={styles.personInfo}>
            <Text variant="titleMedium" style={styles.personName}>
              {manager.name}
            </Text>
            <Text variant="bodySmall" style={styles.phoneText}>
              {manager.phone}
            </Text>
            <View style={styles.turfChips}>
              {manager.assignedTurfs?.slice(0, 2).map((turfId, index) => (
                <Chip
                  key={turfId}
                  mode="outlined"
                  style={styles.turfChip}
                  textStyle={styles.turfChipText}
                >
                  {getTurfName(turfId)}
                </Chip>
              ))}
              {manager.assignedTurfs?.length > 2 && (
                <Chip mode="flat" style={styles.moreChip} textStyle={styles.moreChipText}>
                  +{manager.assignedTurfs.length - 2}
                </Chip>
              )}
            </View>
          </View>
          <Chip
            mode="flat"
            style={[
              styles.statusChip,
              {
                backgroundColor: manager.isSuspended
                  ? "#FFEBEE"
                  : manager.isActive
                  ? "#E8F5E9"
                  : "#FFF3E0",
              },
            ]}
            textStyle={{
              color: manager.isSuspended
                ? "#F44336"
                : manager.isActive
                ? "#4CAF50"
                : "#FF9800",
              fontSize: 11,
            }}
          >
            {manager.isSuspended ? "Suspended" : manager.isActive ? "Active" : "Inactive"}
          </Chip>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <MaterialCommunityIcons name="calendar-check" size={16} color="#666" />
            <Text variant="bodySmall" style={styles.statText}>
              {manager.stats?.bookingsHandled || 0} bookings
            </Text>
          </View>
          <View style={styles.statItem}>
            <MaterialCommunityIcons name="star" size={16} color="#FFC107" />
            <Text variant="bodySmall" style={styles.statText}>
              {manager.stats?.rating?.toFixed(1) || "N/A"}
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      <View style={styles.menuContainer}>
        <Menu
          visible={menuVisible === manager.id}
          onDismiss={() => setMenuVisible(null)}
          anchor={
            <IconButton
              icon="dots-vertical"
              size={20}
              onPress={() => setMenuVisible(manager.id)}
            />
          }
        >
          <Menu.Item
            leadingIcon="pencil"
            onPress={() => {
              setMenuVisible(null);
              // TODO: Edit turf assignments
            }}
            title="Edit Assignments"
          />
          <Menu.Item
            leadingIcon={manager.isSuspended ? "account-check" : "account-cancel"}
            onPress={() => {
              setMenuVisible(null);
              // TODO: Toggle suspension
            }}
            title={manager.isSuspended ? "Unsuspend" : "Suspend"}
          />
          <Menu.Item
            leadingIcon="delete"
            onPress={() => {
              setMenuVisible(null);
              // TODO: Remove from company
            }}
            title="Remove"
            titleStyle={{ color: "#F44336" }}
          />
        </Menu>
      </View>
    </Surface>
  );

  const CaretakerCard = ({ caretaker }) => (
    <Surface style={styles.card} elevation={1}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => {
          // TODO: Navigate to caretaker details
        }}
      >
        <View style={styles.cardHeader}>
          <View style={styles.avatarContainer}>
            <Avatar.Text
              size={48}
              label={caretaker.name?.substring(0, 2).toUpperCase() || "?"}
              style={{ backgroundColor: CARETAKER_COLOR }}
            />
            {caretaker.isSuspended && (
              <Badge style={styles.suspendedBadge} size={16}>
                !
              </Badge>
            )}
          </View>
          <View style={styles.personInfo}>
            <Text variant="titleMedium" style={styles.personName}>
              {caretaker.name}
            </Text>
            <Text variant="bodySmall" style={styles.phoneText}>
              {caretaker.phone}
            </Text>
            {caretaker.isAssigned ? (
              <Chip
                mode="outlined"
                style={styles.turfChip}
                textStyle={styles.turfChipText}
                icon="soccer-field"
              >
                {getTurfName(caretaker.assignedTurfId)}
              </Chip>
            ) : (
              <View style={styles.unassignedBadge}>
                <MaterialCommunityIcons name="clock-outline" size={14} color="#FF9800" />
                <Text variant="bodySmall" style={styles.unassignedText}>
                  Waiting for assignment
                </Text>
              </View>
            )}
          </View>
          <Chip
            mode="flat"
            style={[
              styles.statusChip,
              {
                backgroundColor: caretaker.isSuspended
                  ? "#FFEBEE"
                  : !caretaker.isAssigned
                  ? "#FFF3E0"
                  : "#E8F5E9",
              },
            ]}
            textStyle={{
              color: caretaker.isSuspended
                ? "#F44336"
                : !caretaker.isAssigned
                ? "#FF9800"
                : "#4CAF50",
              fontSize: 11,
            }}
          >
            {caretaker.isSuspended
              ? "Suspended"
              : !caretaker.isAssigned
              ? "Unassigned"
              : "Active"}
          </Chip>
        </View>
      </TouchableOpacity>

      <View style={styles.menuContainer}>
        <Menu
          visible={menuVisible === caretaker.id}
          onDismiss={() => setMenuVisible(null)}
          anchor={
            <IconButton
              icon="dots-vertical"
              size={20}
              onPress={() => setMenuVisible(caretaker.id)}
            />
          }
        >
          {!caretaker.isAssigned && (
            <Menu.Item
              leadingIcon="account-arrow-right"
              onPress={() => {
                setMenuVisible(null);
                // TODO: Navigate to assignment screen
              }}
              title="Assign to Turf"
            />
          )}
          {caretaker.isAssigned && (
            <Menu.Item
              leadingIcon="swap-horizontal"
              onPress={() => {
                setMenuVisible(null);
                // TODO: Reassign turf
              }}
              title="Change Assignment"
            />
          )}
          <Menu.Item
            leadingIcon={caretaker.isSuspended ? "account-check" : "account-cancel"}
            onPress={() => {
              setMenuVisible(null);
              // TODO: Toggle suspension
            }}
            title={caretaker.isSuspended ? "Unsuspend" : "Suspend"}
          />
          <Menu.Item
            leadingIcon="delete"
            onPress={() => {
              setMenuVisible(null);
              // TODO: Remove from company
            }}
            title="Remove"
            titleStyle={{ color: "#F44336" }}
          />
        </Menu>
      </View>
    </Surface>
  );

  const EmptyState = ({ type }) => (
    <View style={styles.emptyContainer}>
      {loadingTeam ? (
        <>
          <ActivityIndicator animating color={OWNER_COLOR} />
          <Text variant="bodyMedium" style={styles.emptyText}>
            Loading team members...
          </Text>
        </>
      ) : (
        <>
          <MaterialCommunityIcons
            name={type === "managers" ? "account-tie" : "account-hard-hat"}
            size={64}
            color="#ccc"
          />
          <Text variant="titleMedium" style={styles.emptyTitle}>
            No {type === "managers" ? "Managers" : "Caretakers"} Yet
          </Text>
          <Text variant="bodyMedium" style={styles.emptyText}>
            Share your invite code to let {type === "managers" ? "managers" : "caretakers"} join your company.
          </Text>
        </>
      )}
    </View>
  );

  const unassignedCount = displayCaretakers.filter((c) => !c?.isAssigned).length;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerTitles}>
            <Text variant="headlineSmall" style={styles.title}>
              Team Management
            </Text>
            <Text variant="bodyMedium" style={styles.subtitle}>
              {displayManagers.length} manager{displayManagers.length !== 1 ? "s" : ""} •{" "}
              {displayCaretakers.length} caretaker{displayCaretakers.length !== 1 ? "s" : ""}
            </Text>
          </View>
          {selectedTab === "managers" && displayManagers.length > 0 && (
            <IconButton
              icon="account-cog"
              size={24}
              iconColor={OWNER_COLOR}
              onPress={() => navigation.navigate("ManagerManagement")}
            />
          )}
          {selectedTab === "caretakers" && displayCaretakers.length > 0 && (
            <IconButton
              icon="account-hard-hat"
              size={24}
              iconColor={OWNER_COLOR}
              onPress={() => navigation.navigate("CaretakerManagement")}
            />
          )}
        </View>
      </View>

      {/* Unassigned Alert */}
      {unassignedCount > 0 && (
        <TouchableOpacity
          style={styles.alertBanner}
          onPress={() => setSelectedTab("caretakers")}
        >
          <MaterialCommunityIcons name="alert-circle" size={20} color="#E65100" />
          <Text variant="bodyMedium" style={styles.alertText}>
            {unassignedCount} caretaker{unassignedCount > 1 ? "s" : ""} waiting for assignment
          </Text>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#E65100" />
        </TouchableOpacity>
      )}

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <SegmentedButtons
          value={selectedTab}
          onValueChange={setSelectedTab}
          buttons={[
            {
              value: "managers",
              label: `Managers (${displayManagers.length})`,
              icon: "account-tie",
            },
            {
              value: "caretakers",
              label: `Caretakers (${displayCaretakers.length})`,
              icon: "account-hard-hat",
            },
          ]}
          style={styles.segmentedButtons}
        />
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Searchbar
          placeholder={`Search ${selectedTab}...`}
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
          inputStyle={styles.searchInput}
        />
      </View>

      {/* List */}
      <FlatList
        data={selectedTab === "managers" ? filteredManagers : filteredCaretakers}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) =>
          selectedTab === "managers" ? (
            <ManagerCard manager={item} />
          ) : (
            <CaretakerCard caretaker={item} />
          )
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<EmptyState type={selectedTab} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[OWNER_COLOR]}
          />
        }
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
    padding: 16,
    paddingBottom: 8,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerTitles: {
    flex: 1,
  },
  title: {
    fontWeight: "bold",
  },
  subtitle: {
    color: "#666",
    marginTop: 4,
  },
  alertBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF3E0",
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  alertText: {
    flex: 1,
    marginLeft: 8,
    color: "#E65100",
    fontWeight: "500",
  },
  tabContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  segmentedButtons: {
    backgroundColor: "#fff",
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  searchbar: {
    backgroundColor: "#fff",
    borderRadius: 12,
    elevation: 0,
  },
  searchInput: {
    fontSize: 14,
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
  },
  card: {
    borderRadius: 16,
    backgroundColor: "#fff",
    marginBottom: 12,
    padding: 16,
    position: "relative",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  avatarContainer: {
    position: "relative",
  },
  suspendedBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#F44336",
  },
  personInfo: {
    flex: 1,
    marginLeft: 12,
  },
  personName: {
    fontWeight: "bold",
  },
  phoneText: {
    color: "#666",
    marginTop: 2,
  },
  turfChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
  },
  turfChip: {
    height: 28,
    marginRight: 4,
    marginBottom: 4,
  },
  turfChipText: {
    fontSize: 11,
  },
  moreChip: {
    height: 28,
    backgroundColor: "#E0E0E0",
  },
  moreChipText: {
    fontSize: 11,
    color: "#666",
  },
  statusChip: {
    height: 24,
  },
  unassignedBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  unassignedText: {
    color: "#FF9800",
    marginLeft: 4,
    fontSize: 12,
  },
  statsRow: {
    flexDirection: "row",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
  },
  statText: {
    color: "#666",
    marginLeft: 4,
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
    fontWeight: "bold",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    color: "#666",
    textAlign: "center",
    paddingHorizontal: 32,
  },
});
