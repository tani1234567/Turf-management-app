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
const MANAGER_COLOR = "#3B82F6";
const CARETAKER_COLOR = "#F59E0B";
const SUCCESS_GREEN = "#22C55E";
const DANGER_RED = "#EF4444";

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
    <Surface style={[styles.card, styles.managerCard]} elevation={1}>
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
              <Badge style={styles.suspendedBadge} size={16}>!</Badge>
            )}
          </View>
          <View style={styles.personInfo}>
            <Text style={styles.personName}>{manager.name}</Text>
            <Text style={styles.phoneText}>{manager.phone}</Text>
            <View style={styles.turfChips}>
              {manager.assignedTurfs?.slice(0, 2).map((turfId) => (
                <View key={turfId} style={styles.turfChipPill}>
                  <Text style={styles.turfChipText}>{getTurfName(turfId)}</Text>
                </View>
              ))}
              {manager.assignedTurfs?.length > 2 && (
                <View style={styles.moreChipPill}>
                  <Text style={styles.moreChipText}>+{manager.assignedTurfs.length - 2}</Text>
                </View>
              )}
            </View>
          </View>
          <View style={[
            styles.statusPill,
            {
              backgroundColor: manager.isSuspended ? "#FEE2E2"
                : manager.isActive ? "#DCFCE7"
                : "#FEF3C7",
            },
          ]}>
            <Text style={[
              styles.statusPillText,
              {
                color: manager.isSuspended ? DANGER_RED
                  : manager.isActive ? SUCCESS_GREEN
                  : CARETAKER_COLOR,
              },
            ]}>
              {manager.isSuspended ? "Suspended" : manager.isActive ? "Active" : "Inactive"}
            </Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <MaterialCommunityIcons name="calendar-check" size={16} color="#9CA3AF" />
            <Text style={styles.statText}>{manager.stats?.bookingsHandled || 0} bookings</Text>
          </View>
          <View style={styles.statItem}>
            <MaterialCommunityIcons name="star" size={16} color="#FFC107" />
            <Text style={styles.statText}>{manager.stats?.rating?.toFixed(1) || "N/A"}</Text>
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
    <Surface style={[styles.card, styles.caretakerCard]} elevation={1}>
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
              <Badge style={styles.suspendedBadge} size={16}>!</Badge>
            )}
          </View>
          <View style={styles.personInfo}>
            <Text style={styles.personName}>{caretaker.name}</Text>
            <Text style={styles.phoneText}>{caretaker.phone}</Text>
            {caretaker.isAssigned ? (
              <View style={styles.turfChipPill}>
                <MaterialCommunityIcons name="soccer-field" size={12} color={CARETAKER_COLOR} />
                <Text style={styles.turfChipText}>{getTurfName(caretaker.assignedTurfId)}</Text>
              </View>
            ) : (
              <View style={styles.unassignedBadge}>
                <MaterialCommunityIcons name="clock-outline" size={14} color={CARETAKER_COLOR} />
                <Text style={styles.unassignedText}>Waiting for assignment</Text>
              </View>
            )}
          </View>
          <View style={[
            styles.statusPill,
            {
              backgroundColor: caretaker.isSuspended ? "#FEE2E2"
                : !caretaker.isAssigned ? "#FEF3C7"
                : "#DCFCE7",
            },
          ]}>
            <Text style={[
              styles.statusPillText,
              {
                color: caretaker.isSuspended ? DANGER_RED
                  : !caretaker.isAssigned ? CARETAKER_COLOR
                  : SUCCESS_GREEN,
              },
            ]}>
              {caretaker.isSuspended ? "Suspended" : !caretaker.isAssigned ? "Unassigned" : "Active"}
            </Text>
          </View>
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
          <Text style={styles.emptyText}>Loading team members...</Text>
        </>
      ) : (
        <>
          <View style={styles.emptyIconCircle}>
            <MaterialCommunityIcons
              name={type === "managers" ? "account-tie" : "account-hard-hat"}
              size={40}
              color={OWNER_COLOR}
            />
          </View>
          <Text style={styles.emptyTitle}>
            No {type === "managers" ? "Managers" : "Caretakers"} Yet
          </Text>
          <Text style={styles.emptyText}>
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
            <Text style={styles.title}>Team Management</Text>
            <Text style={styles.subtitle}>
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
    backgroundColor: "#F5F0FF",
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
  alertBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFBEB",
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: CARETAKER_COLOR,
  },
  alertText: {
    flex: 1,
    marginLeft: 8,
    fontFamily: "Ubuntu-Medium",
    fontSize: 13,
    color: "#92400E",
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
  card: {
    borderRadius: 16,
    backgroundColor: "#fff",
    marginBottom: 12,
    padding: 16,
    position: "relative",
    overflow: "hidden",
  },
  managerCard: {
    borderLeftWidth: 4,
    borderLeftColor: MANAGER_COLOR,
  },
  caretakerCard: {
    borderLeftWidth: 4,
    borderLeftColor: CARETAKER_COLOR,
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
    backgroundColor: DANGER_RED,
  },
  personInfo: {
    flex: 1,
    marginLeft: 12,
  },
  personName: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 15,
    color: "#111827",
  },
  phoneText: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  turfChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
    gap: 4,
  },
  turfChipPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    marginRight: 4,
    marginBottom: 4,
  },
  turfChipText: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 11,
    color: "#374151",
  },
  moreChipPill: {
    backgroundColor: "#E5E7EB",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  moreChipText: {
    fontFamily: "Ubuntu-Medium",
    fontSize: 11,
    color: "#6B7280",
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginLeft: 4,
    alignSelf: "flex-start",
  },
  statusPillText: {
    fontFamily: "Ubuntu-Medium",
    fontSize: 11,
  },
  unassignedBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 4,
  },
  unassignedText: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 12,
    color: CARETAKER_COLOR,
  },
  statsRow: {
    flexDirection: "row",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
  },
  statText: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 12,
    color: "#6B7280",
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
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F3E5F5",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 16,
    color: "#111827",
    marginBottom: 8,
  },
  emptyText: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    paddingHorizontal: 32,
  },
});
