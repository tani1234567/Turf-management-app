import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Linking,
  Modal,
  ScrollView,
} from "react-native";
import {
  Text,
  Surface,
  Searchbar,
  IconButton,
  Menu,
  SegmentedButtons,
  Avatar,
  Badge,
  ActivityIndicator,
  Button,
  Divider,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSelector } from "react-redux";
import { selectUnassignedCaretakers, selectCompany } from "../../store/slices/companySlice";
import { selectTurfs } from "../../store/slices/ownerSlice";
import { queryDocuments, updateDocument } from "../../services/firebase/firestore";

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

  // Detail modal
  const [detailPerson, setDetailPerson] = useState(null);
  const [detailVisible, setDetailVisible] = useState(false);

  // Assignment modal
  const [assignTarget, setAssignTarget] = useState(null);
  const [assignVisible, setAssignVisible] = useState(false);

  const fetchTeam = useCallback(async ({ showRefresh = false } = {}) => {
    if (!companyId) return;
    if (showRefresh) setRefreshing(true);
    else setLoadingTeam(true);

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
  }, [companyId]);

  useEffect(() => {
    if (companyId) fetchTeam();
  }, [companyId]);

  const onRefresh = () => fetchTeam({ showRefresh: true });

  const getTurfName = (turfId) => {
    const turf = turfs.find((t) => t.turfId === turfId || t.id === turfId);
    return turf?.name || "Unknown Turf";
  };

  const handleCall = (phone) => {
    if (!phone) return;
    const cleaned = phone.replace(/\s+/g, "");
    Linking.openURL(`tel:${cleaned}`);
  };

  const handleSuspendToggle = (person) => {
    const action = person.isSuspended ? "Unsuspend" : "Suspend";
    Alert.alert(
      `${action} ${person.name}?`,
      person.isSuspended
        ? "This will restore their access to the app."
        : "This will block their access until unsuspended.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: action,
          style: person.isSuspended ? "default" : "destructive",
          onPress: async () => {
            try {
              const userId = person.id || person.userId;
              await updateDocument("users", userId, {
                isSuspended: !person.isSuspended,
                isActive: person.isSuspended ? true : false,
              });
              fetchTeam();
            } catch (e) {
              Alert.alert("Error", "Failed to update status. Please try again.");
            }
          },
        },
      ]
    );
  };

  const handleRemove = (person) => {
    Alert.alert(
      `Remove ${person.name}?`,
      "They will be removed from your company and lose access to all turfs.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              const userId = person.id || person.userId;
              await updateDocument("users", userId, {
                companyId: null,
                assignedTurfIds: [],
                assignedTurf: null,
                assignedTurfId: null,
                isAssigned: false,
              });
              fetchTeam();
            } catch (e) {
              Alert.alert("Error", "Failed to remove member. Please try again.");
            }
          },
        },
      ]
    );
  };

  const openAssignModal = (person) => {
    setAssignTarget(person);
    setAssignVisible(true);
  };

  const handleAssignTurf = async (turfId) => {
    if (!assignTarget) return;
    try {
      const userId = assignTarget.id || assignTarget.userId;
      if (assignTarget.role === "manager") {
        // Multi-select: toggle turfId in/out of assignedTurfIds array
        const current = assignTarget.assignedTurfs || [];
        const updated = current.includes(turfId)
          ? current.filter((id) => id !== turfId)
          : [...current, turfId];
        await updateDocument("users", userId, { assignedTurfIds: updated });
        // Update local state so toggles reflect immediately without closing
        setAssignTarget((prev) => ({ ...prev, assignedTurfs: updated }));
      } else {
        await updateDocument("users", userId, {
          assignedTurfId: turfId,
          assignedTurf: turfId,
          isAssigned: true,
        });
        setAssignVisible(false);
        setAssignTarget(null);
      }
      fetchTeam();
    } catch (e) {
      Alert.alert("Error", "Failed to update assignment. Please try again.");
    }
  };

  const handleEditAssignments = (manager) => {
    setAssignTarget(manager);
    setAssignVisible(true);
  };

  const openDetail = (person) => {
    setDetailPerson(person);
    setDetailVisible(true);
  };

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

  const ManagerCard = ({ manager }) => (
    <Surface style={[styles.card, styles.managerCard]} elevation={1}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => openDetail(manager)}
        onLongPress={() => openDetail(manager)}
        delayLongPress={400}
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
          <TouchableOpacity
            style={styles.callButton}
            onPress={() => handleCall(manager.phone)}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="phone" size={15} color="#fff" />
            <Text style={styles.callButtonText}>Call</Text>
          </TouchableOpacity>
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
              handleEditAssignments(manager);
            }}
            title="Edit Assignments"
          />
          <Menu.Item
            leadingIcon={manager.isSuspended ? "account-check" : "account-cancel"}
            onPress={() => {
              setMenuVisible(null);
              handleSuspendToggle(manager);
            }}
            title={manager.isSuspended ? "Unsuspend" : "Suspend"}
          />
          <Menu.Item
            leadingIcon="delete"
            onPress={() => {
              setMenuVisible(null);
              handleRemove(manager);
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
        onPress={() => openDetail(caretaker)}
        onLongPress={() => openDetail(caretaker)}
        delayLongPress={400}
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

        <View style={styles.statsRow}>
          <TouchableOpacity
            style={[styles.callButton, { backgroundColor: CARETAKER_COLOR }]}
            onPress={() => handleCall(caretaker.phone)}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="phone" size={15} color="#fff" />
            <Text style={styles.callButtonText}>Call</Text>
          </TouchableOpacity>
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
                openAssignModal(caretaker);
              }}
              title="Assign to Turf"
            />
          )}
          {caretaker.isAssigned && (
            <Menu.Item
              leadingIcon="swap-horizontal"
              onPress={() => {
                setMenuVisible(null);
                openAssignModal(caretaker);
              }}
              title="Change Assignment"
            />
          )}
          <Menu.Item
            leadingIcon={caretaker.isSuspended ? "account-check" : "account-cancel"}
            onPress={() => {
              setMenuVisible(null);
              handleSuspendToggle(caretaker);
            }}
            title={caretaker.isSuspended ? "Unsuspend" : "Suspend"}
          />
          <Menu.Item
            leadingIcon="delete"
            onPress={() => {
              setMenuVisible(null);
              handleRemove(caretaker);
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
  const isManager = detailPerson?.role === "manager";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
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
        </View>
      </View>

      {/* Unassigned Alert */}
      {unassignedCount > 0 && (
        <TouchableOpacity
          style={styles.alertBanner}
          onPress={() => setSelectedTab("caretakers")}
        >
          <MaterialCommunityIcons name="alert-circle" size={20} color="#E65100" />
          <Text style={styles.alertText}>
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
            { value: "managers", label: `Managers (${displayManagers.length})`, icon: "account-tie" },
            { value: "caretakers", label: `Caretakers (${displayCaretakers.length})`, icon: "account-hard-hat" },
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[OWNER_COLOR]} />
        }
      />

      {/* Detail Modal */}
      <Modal
        visible={detailVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {isManager ? "Manager Details" : "Caretaker Details"}
              </Text>
              <IconButton icon="close" size={22} iconColor={OWNER_COLOR} onPress={() => setDetailVisible(false)} />
            </View>

            {detailPerson && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.detailBody}>
                  {/* Avatar + name */}
                  <View style={styles.detailAvatarRow}>
                    <Avatar.Text
                      size={64}
                      label={detailPerson.name?.substring(0, 2).toUpperCase() || "?"}
                      style={{ backgroundColor: isManager ? MANAGER_COLOR : CARETAKER_COLOR }}
                    />
                    <View style={{ marginLeft: 16, flex: 1 }}>
                      <Text style={styles.detailName}>{detailPerson.name}</Text>
                      <Text style={styles.detailRole}>{isManager ? "Manager" : "Caretaker"}</Text>
                      <View style={[
                        styles.statusPill,
                        {
                          marginLeft: 0,
                          marginTop: 6,
                          backgroundColor: detailPerson.isSuspended ? "#FEE2E2"
                            : detailPerson.isActive || detailPerson.isAssigned ? "#DCFCE7"
                            : "#FEF3C7",
                        },
                      ]}>
                        <Text style={[styles.statusPillText, {
                          color: detailPerson.isSuspended ? DANGER_RED
                            : detailPerson.isActive || detailPerson.isAssigned ? SUCCESS_GREEN
                            : CARETAKER_COLOR,
                        }]}>
                          {detailPerson.isSuspended ? "Suspended"
                            : isManager ? (detailPerson.isActive ? "Active" : "Inactive")
                            : (detailPerson.isAssigned ? "Active" : "Unassigned")}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <Divider style={{ marginVertical: 16 }} />

                  {/* Info rows */}
                  <View style={styles.detailRow}>
                    <MaterialCommunityIcons name="phone" size={18} color="#6B7280" />
                    <Text style={styles.detailValue}>{detailPerson.phone || "—"}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <MaterialCommunityIcons name="email-outline" size={18} color="#6B7280" />
                    <Text style={styles.detailValue}>{detailPerson.email || "—"}</Text>
                  </View>

                  {isManager && (
                    <View style={styles.detailRow}>
                      <MaterialCommunityIcons name="soccer-field" size={18} color="#6B7280" />
                      <Text style={styles.detailValue}>
                        {detailPerson.assignedTurfs?.length
                          ? detailPerson.assignedTurfs.map(getTurfName).join(", ")
                          : "No turfs assigned"}
                      </Text>
                    </View>
                  )}

                  {!isManager && (
                    <View style={styles.detailRow}>
                      <MaterialCommunityIcons name="soccer-field" size={18} color="#6B7280" />
                      <Text style={styles.detailValue}>
                        {detailPerson.isAssigned ? getTurfName(detailPerson.assignedTurfId) : "Not assigned"}
                      </Text>
                    </View>
                  )}

                  {isManager && (
                    <>
                      <View style={styles.detailRow}>
                        <MaterialCommunityIcons name="calendar-check" size={18} color="#6B7280" />
                        <Text style={styles.detailValue}>{detailPerson.stats?.bookingsHandled || 0} bookings handled</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <MaterialCommunityIcons name="star" size={18} color="#FFC107" />
                        <Text style={styles.detailValue}>Rating: {detailPerson.stats?.rating?.toFixed(1) || "N/A"}</Text>
                      </View>
                    </>
                  )}

                  <Divider style={{ marginVertical: 16 }} />

                  {/* Action buttons */}
                  <TouchableOpacity
                    style={styles.detailCallBtn}
                    onPress={() => handleCall(detailPerson.phone)}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons name="phone" size={18} color="#fff" />
                    <Text style={styles.detailCallText}>Call {detailPerson.name?.split(" ")[0]}</Text>
                  </TouchableOpacity>

                  <View style={styles.detailActionsRow}>
                    <Button
                      mode="outlined"
                      textColor={detailPerson.isSuspended ? SUCCESS_GREEN : DANGER_RED}
                      style={[styles.detailActionBtn, { borderColor: detailPerson.isSuspended ? SUCCESS_GREEN : DANGER_RED }]}
                      icon={detailPerson.isSuspended ? "account-check" : "account-cancel"}
                      onPress={() => { setDetailVisible(false); handleSuspendToggle(detailPerson); }}
                    >
                      {detailPerson.isSuspended ? "Unsuspend" : "Suspend"}
                    </Button>
                    <Button
                      mode="outlined"
                      textColor={DANGER_RED}
                      style={[styles.detailActionBtn, { borderColor: DANGER_RED }]}
                      icon="delete"
                      onPress={() => { setDetailVisible(false); handleRemove(detailPerson); }}
                    >
                      Remove
                    </Button>
                  </View>

                  <View style={{ height: 16 }} />
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Assign Turf Modal */}
      <Modal
        visible={assignVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAssignVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxHeight: "60%" }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {assignTarget?.role === "manager" ? "Edit Turf Assignments" : "Assign to Turf"}
              </Text>
              <IconButton icon="close" size={22} iconColor={OWNER_COLOR} onPress={() => { setAssignVisible(false); setAssignTarget(null); }} />
            </View>
            {assignTarget?.role === "manager" && (
              <Text style={{ paddingHorizontal: 20, paddingBottom: 8, fontFamily: "Ubuntu-Regular", fontSize: 12, color: "#6B7280" }}>
                Tap to toggle turf assignments for this manager.
              </Text>
            )}
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ padding: 16 }}>
                {turfs.length === 0 ? (
                  <Text style={{ color: "#6B7280", textAlign: "center", padding: 24 }}>No turfs available.</Text>
                ) : (
                  turfs.map((turf) => {
                    const turfId = turf.turfId || turf.id;
                    const isChecked = assignTarget?.role === "manager"
                      ? (assignTarget?.assignedTurfs || []).includes(turfId)
                      : assignTarget?.assignedTurfId === turfId;
                    return (
                      <TouchableOpacity
                        key={turfId}
                        style={[styles.turfOption, isChecked && styles.turfOptionActive]}
                        onPress={() => handleAssignTurf(turfId)}
                        activeOpacity={0.7}
                      >
                        <MaterialCommunityIcons name="soccer-field" size={20} color={isChecked ? OWNER_COLOR : "#6B7280"} />
                        <Text style={[styles.turfOptionText, isChecked && { color: OWNER_COLOR, fontFamily: "Ubuntu-Bold" }]}>
                          {turf.name}
                        </Text>
                        <MaterialCommunityIcons
                          name={isChecked ? "check-circle" : "checkbox-blank-circle-outline"}
                          size={18}
                          color={isChecked ? OWNER_COLOR : "#D1D5DB"}
                        />
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F0FF" },
  header: { padding: 16, paddingBottom: 8 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  headerTitles: { flex: 1 },
  title: { fontFamily: "Ubuntu-Bold", fontSize: 22, color: "#4A148C" },
  subtitle: { fontFamily: "Ubuntu-Regular", fontSize: 13, color: "#6B7280", marginTop: 4 },
  alertBanner: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#FFFBEB",
    marginHorizontal: 16, padding: 12, borderRadius: 10, marginBottom: 8,
    borderLeftWidth: 4, borderLeftColor: CARETAKER_COLOR,
  },
  alertText: { flex: 1, marginLeft: 8, fontFamily: "Ubuntu-Medium", fontSize: 13, color: "#92400E" },
  tabContainer: { paddingHorizontal: 16, paddingVertical: 8 },
  segmentedButtons: { backgroundColor: "#fff" },
  searchContainer: { paddingHorizontal: 16, paddingBottom: 8 },
  searchbar: { backgroundColor: "#fff", borderRadius: 12, elevation: 0, borderWidth: 1, borderColor: "#E5E7EB" },
  searchInput: { fontFamily: "Ubuntu-Regular", fontSize: 14 },
  listContent: { padding: 16, paddingTop: 8 },

  // Card
  card: { borderRadius: 16, backgroundColor: "#fff", marginBottom: 12, padding: 16, position: "relative", overflow: "hidden" },
  managerCard: { borderLeftWidth: 4, borderLeftColor: MANAGER_COLOR },
  caretakerCard: { borderLeftWidth: 4, borderLeftColor: CARETAKER_COLOR },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", paddingRight: 36 },
  avatarContainer: { position: "relative" },
  suspendedBadge: { position: "absolute", bottom: 0, right: 0, backgroundColor: DANGER_RED },
  personInfo: { flex: 1, marginLeft: 12 },
  personName: { fontFamily: "Ubuntu-Bold", fontSize: 15, color: "#111827" },
  phoneText: { fontFamily: "Ubuntu-Regular", fontSize: 12, color: "#6B7280", marginTop: 2 },
  turfChips: { flexDirection: "row", flexWrap: "wrap", marginTop: 8, gap: 4 },
  turfChipPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#F3F4F6", paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 20, marginRight: 4, marginBottom: 4,
  },
  turfChipText: { fontFamily: "Ubuntu-Regular", fontSize: 11, color: "#374151" },
  moreChipPill: { backgroundColor: "#E5E7EB", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  moreChipText: { fontFamily: "Ubuntu-Medium", fontSize: 11, color: "#6B7280" },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginLeft: 4, alignSelf: "flex-start" },
  statusPillText: { fontFamily: "Ubuntu-Medium", fontSize: 11 },
  unassignedBadge: { flexDirection: "row", alignItems: "center", marginTop: 8, gap: 4 },
  unassignedText: { fontFamily: "Ubuntu-Regular", fontSize: 12, color: CARETAKER_COLOR },
  statsRow: {
    flexDirection: "row", alignItems: "center", marginTop: 12, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: "#F3F4F6",
  },
  statItem: { flexDirection: "row", alignItems: "center", marginRight: 16 },
  statText: { fontFamily: "Ubuntu-Regular", fontSize: 12, color: "#6B7280", marginLeft: 4 },
  callButton: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: MANAGER_COLOR, paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 20, marginLeft: "auto",
  },
  callButtonText: { fontFamily: "Ubuntu-Medium", fontSize: 12, color: "#fff" },
  menuContainer: { position: "absolute", top: 8, right: 8 },

  // Empty
  emptyContainer: { alignItems: "center", justifyContent: "center", paddingVertical: 48 },
  emptyIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#F3E5F5", justifyContent: "center", alignItems: "center", marginBottom: 16 },
  emptyTitle: { fontFamily: "Ubuntu-Bold", fontSize: 16, color: "#111827", marginBottom: 8 },
  emptyText: { fontFamily: "Ubuntu-Regular", fontSize: 13, color: "#6B7280", textAlign: "center", paddingHorizontal: 32 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "85%" },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingLeft: 20, paddingRight: 4, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: "#F0F0F0",
  },
  modalTitle: { fontFamily: "Ubuntu-Bold", fontSize: 17, color: "#111827", flex: 1 },

  // Detail modal body
  detailBody: { padding: 20 },
  detailAvatarRow: { flexDirection: "row", alignItems: "flex-start" },
  detailName: { fontFamily: "Ubuntu-Bold", fontSize: 18, color: "#111827" },
  detailRole: { fontFamily: "Ubuntu-Regular", fontSize: 13, color: "#6B7280", marginTop: 2 },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  detailValue: { fontFamily: "Ubuntu-Regular", fontSize: 14, color: "#374151", flex: 1 },
  detailCallBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: MANAGER_COLOR, borderRadius: 12, paddingVertical: 12, marginBottom: 12,
  },
  detailCallText: { fontFamily: "Ubuntu-Bold", fontSize: 15, color: "#fff" },
  detailActionsRow: { flexDirection: "row", gap: 10 },
  detailActionBtn: { flex: 1 },

  // Assign turf
  turfOption: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 14, paddingHorizontal: 16,
    borderRadius: 12, borderWidth: 1, borderColor: "#E5E7EB",
    marginBottom: 8, backgroundColor: "#fff",
  },
  turfOptionActive: { borderColor: OWNER_COLOR, backgroundColor: "#F3E5F5" },
  turfOptionText: { fontFamily: "Ubuntu-Medium", fontSize: 14, color: "#374151", flex: 1 },
});
