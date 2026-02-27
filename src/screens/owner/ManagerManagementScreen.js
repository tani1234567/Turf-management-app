import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Share,
  ScrollView,
} from "react-native";
import {
  Text,
  Surface,
  Searchbar,
  Chip,
  IconButton,
  Avatar,
  Badge,
  ActivityIndicator,
  Button,
  Dialog,
  Portal,
  TextInput,
  Checkbox,
  Divider,
  SegmentedButtons,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSelector, useDispatch } from "react-redux";
import { selectCompany, selectInviteCode } from "../../store/slices/companySlice";
import { selectTurfs } from "../../store/slices/ownerSlice";
import { selectUser } from "../../store/slices/authSlice";
import {
  queryDocuments,
  updateDocument,
  addDocument,
  batchWrite,
  serverTimestamp,
  createTimestamp,
} from "../../services/firebase/firestore";
import { formatCodeForDisplay, generateInviteLink } from "../../utils/inviteCodeUtils";

const OWNER_COLOR = "#9C27B0";
const MANAGER_COLOR = "#2196F3";

// Helper to format relative time
const getRelativeTime = (date) => {
  if (!date) return "";
  const now = new Date();
  const past = date instanceof Date ? date : date.toDate ? date.toDate() : new Date(date);
  const diffMs = now - past;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return "1 week ago";
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 60) return "1 month ago";
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} year${Math.floor(diffDays / 365) > 1 ? "s" : ""} ago`;
};

export default function ManagerManagementScreen({ navigation }) {
  const dispatch = useDispatch();
  const company = useSelector(selectCompany);
  const inviteCode = useSelector(selectInviteCode);
  const turfs = useSelector(selectTurfs);
  const currentUser = useSelector(selectUser);
  const companyId = company?.id || company?.companyId;
  const ownerId = currentUser?.userId || currentUser?.id;

  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [loadingManagers, setLoadingManagers] = useState(false);
  const [managers, setManagers] = useState([]);
  const [filterTab, setFilterTab] = useState("all");

  // Modal states
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [editTurfsModalVisible, setEditTurfsModalVisible] = useState(false);
  const [suspendModalVisible, setSuspendModalVisible] = useState(false);
  const [reinstateModalVisible, setReinstateModalVisible] = useState(false);
  const [selectedManager, setSelectedManager] = useState(null);

  // Edit turfs state
  const [selectedTurfIds, setSelectedTurfIds] = useState([]);
  const [savingTurfs, setSavingTurfs] = useState(false);

  // Suspend state
  const [suspendReason, setSuspendReason] = useState("");
  const [suspending, setSuspending] = useState(false);
  const [reinstating, setReinstating] = useState(false);

  // Fetch managers from Firestore
  const fetchManagers = useCallback(
    async ({ showRefresh = false } = {}) => {
      if (!companyId) return;

      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoadingManagers(true);
      }

      try {
        const users = await queryDocuments("users", [
          { field: "companyId", operator: "==", value: companyId },
          { field: "role", operator: "==", value: "manager" },
        ]);

        const managerDocs = users.map((u) => ({
          ...u,
          id: u.id || u.userId,
          assignedTurfIds: u.assignedTurfIds || u.assignedTurfs || [],
        }));

        setManagers(managerDocs);
      } catch (error) {
        console.error("Error fetching managers:", error);
        Alert.alert("Error", "Failed to load managers. Please try again.");
      } finally {
        setRefreshing(false);
        setLoadingManagers(false);
      }
    },
    [companyId]
  );

  useEffect(() => {
    if (companyId) {
      fetchManagers();
    }
  }, [companyId, fetchManagers]);

  const onRefresh = () => fetchManagers({ showRefresh: true });

  // Filter managers by search and status
  const filteredManagers = managers.filter((m) => {
    const matchesSearch =
      m?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m?.phone?.includes(searchQuery);

    if (filterTab === "all") return matchesSearch;
    if (filterTab === "active") return matchesSearch && !m.isSuspended;
    if (filterTab === "suspended") return matchesSearch && m.isSuspended;
    return matchesSearch;
  });

  // Get turf name by ID
  const getTurfName = (turfId) => {
    const turf = turfs.find((t) => t.turfId === turfId || t.id === turfId);
    return turf?.name || "Unknown Turf";
  };

  // Handle card tap - show details modal
  const handleViewDetails = (manager) => {
    setSelectedManager(manager);
    setDetailsModalVisible(true);
  };

  // Handle edit turfs
  const handleEditTurfs = (manager) => {
    setSelectedManager(manager);
    setSelectedTurfIds(manager.assignedTurfIds || []);
    setEditTurfsModalVisible(true);
  };

  // Handle suspend button
  const handleSuspend = (manager) => {
    setSelectedManager(manager);
    setSuspendReason("");
    setSuspendModalVisible(true);
  };

  // Handle reinstate button
  const handleReinstate = (manager) => {
    setSelectedManager(manager);
    setReinstateModalVisible(true);
  };

  // Toggle turf selection
  const toggleTurfSelection = (turfId) => {
    setSelectedTurfIds((prev) =>
      prev.includes(turfId) ? prev.filter((id) => id !== turfId) : [...prev, turfId]
    );
  };

  // Save turf assignments
  const saveTurfAssignments = async () => {
    if (!selectedManager || selectedTurfIds.length === 0) {
      Alert.alert("Error", "Please select at least one turf.");
      return;
    }

    setSavingTurfs(true);

    try {
      const managerId = selectedManager.id || selectedManager.userId;
      const oldTurfIds = selectedManager.assignedTurfIds || [];
      const newTurfIds = selectedTurfIds;

      // Calculate turfs to add and remove manager from
      const turfsToRemove = oldTurfIds.filter((id) => !newTurfIds.includes(id));
      const turfsToAdd = newTurfIds.filter((id) => !oldTurfIds.includes(id));

      const batchOperations = [];

      // Remove manager from old turfs
      for (const turfId of turfsToRemove) {
        const turf = turfs.find((t) => t.turfId === turfId || t.id === turfId);
        if (turf) {
          const currentManagerIds = turf.managerIds || [];
          batchOperations.push({
            type: "update",
            collection: "turfs",
            docId: turf.turfId || turf.id,
            data: {
              managerIds: currentManagerIds.filter((id) => id !== managerId),
            },
          });
        }
      }

      // Add manager to new turfs
      for (const turfId of turfsToAdd) {
        const turf = turfs.find((t) => t.turfId === turfId || t.id === turfId);
        if (turf) {
          const currentManagerIds = turf.managerIds || [];
          if (!currentManagerIds.includes(managerId)) {
            batchOperations.push({
              type: "update",
              collection: "turfs",
              docId: turf.turfId || turf.id,
              data: {
                managerIds: [...currentManagerIds, managerId],
              },
            });
          }
        }
      }

      // Update user document
      batchOperations.push({
        type: "update",
        collection: "users",
        docId: managerId,
        data: {
          assignedTurfIds: newTurfIds,
          selectedTurfId: newTurfIds[0] || null,
        },
      });

      // Log action
      batchOperations.push({
        type: "set",
        collection: "owner_logs",
        docId: `${Date.now()}_${managerId}`,
        data: {
          companyId,
          performedBy: ownerId,
          performedByRole: "owner",
          action: "manager_turfs_updated",
          targetType: "user",
          targetId: managerId,
          details: {
            oldTurfIds,
            newTurfIds,
            turfsAdded: turfsToAdd,
            turfsRemoved: turfsToRemove,
          },
          timestamp: serverTimestamp(),
        },
      });

      await batchWrite(batchOperations);

      // Update local state
      setManagers((prev) =>
        prev.map((m) =>
          (m.id || m.userId) === managerId
            ? { ...m, assignedTurfIds: newTurfIds, selectedTurfId: newTurfIds[0] }
            : m
        )
      );

      setEditTurfsModalVisible(false);
      Alert.alert("Success", "Turf assignments updated successfully.");
    } catch (error) {
      console.error("Error saving turf assignments:", error);
      Alert.alert("Error", "Failed to update turf assignments. Please try again.");
    } finally {
      setSavingTurfs(false);
    }
  };

  // Suspend manager
  const confirmSuspendManager = async () => {
    if (!suspendReason.trim()) {
      Alert.alert("Error", "Please provide a reason for suspension.");
      return;
    }

    setSuspending(true);

    try {
      const managerId = selectedManager.id || selectedManager.userId;
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

      const batchOperations = [
        {
          type: "update",
          collection: "users",
          docId: managerId,
          data: {
            isSuspended: true,
            suspendedAt: serverTimestamp(),
            suspendedBy: ownerId,
            suspensionReason: suspendReason.trim(),
            canBeDeletedAfter: createTimestamp(thirtyDaysMs),
          },
        },
        {
          type: "set",
          collection: "owner_logs",
          docId: `${Date.now()}_suspend_${managerId}`,
          data: {
            companyId,
            performedBy: ownerId,
            performedByRole: "owner",
            action: "manager_suspended",
            targetType: "user",
            targetId: managerId,
            details: { reason: suspendReason.trim() },
            timestamp: serverTimestamp(),
          },
        },
      ];

      await batchWrite(batchOperations);

      // Update local state
      setManagers((prev) =>
        prev.map((m) =>
          (m.id || m.userId) === managerId
            ? {
                ...m,
                isSuspended: true,
                suspendedAt: new Date(),
                suspendedBy: ownerId,
                suspensionReason: suspendReason.trim(),
              }
            : m
        )
      );

      setSuspendModalVisible(false);
      setSuspendReason("");

      Alert.alert(
        "Manager Suspended",
        "Manager suspended. They will lose access immediately. Account can be permanently deleted after 30 days."
      );
    } catch (error) {
      console.error("Error suspending manager:", error);
      Alert.alert("Error", "Failed to suspend manager. Please try again.");
    } finally {
      setSuspending(false);
    }
  };

  // Reinstate manager
  const confirmReinstateManager = async () => {
    setReinstating(true);

    try {
      const managerId = selectedManager.id || selectedManager.userId;

      const batchOperations = [
        {
          type: "update",
          collection: "users",
          docId: managerId,
          data: {
            isSuspended: false,
            suspendedAt: null,
            suspendedBy: null,
            suspensionReason: null,
            canBeDeletedAfter: null,
          },
        },
        {
          type: "set",
          collection: "owner_logs",
          docId: `${Date.now()}_reinstate_${managerId}`,
          data: {
            companyId,
            performedBy: ownerId,
            performedByRole: "owner",
            action: "manager_reinstated",
            targetType: "user",
            targetId: managerId,
            details: {},
            timestamp: serverTimestamp(),
          },
        },
      ];

      await batchWrite(batchOperations);

      // Update local state
      setManagers((prev) =>
        prev.map((m) =>
          (m.id || m.userId) === managerId
            ? {
                ...m,
                isSuspended: false,
                suspendedAt: null,
                suspendedBy: null,
                suspensionReason: null,
                canBeDeletedAfter: null,
              }
            : m
        )
      );

      setReinstateModalVisible(false);
      Alert.alert("Success", "Manager has been reinstated and can access the app again.");
    } catch (error) {
      console.error("Error reinstating manager:", error);
      Alert.alert("Error", "Failed to reinstate manager. Please try again.");
    } finally {
      setReinstating(false);
    }
  };

  // Share invite code
  const shareInviteCode = async () => {
    const code = inviteCode?.code || company?.inviteCode?.code;
    if (!code) {
      Alert.alert("Error", "No invite code available.");
      return;
    }

    try {
      const link = generateInviteLink(code);
      await Share.share({
        message: `Join ${company?.name || "our company"} as a manager on Play Grid!\n\nUse invite code: ${formatCodeForDisplay(code)}\n\nOr tap this link: ${link}`,
        title: "Join Our Team",
      });
    } catch (error) {
      console.error("Error sharing invite code:", error);
    }
  };

  // Manager Card Component
  const ManagerCard = ({ manager }) => {
    const assignedTurfsCount = manager.assignedTurfIds?.length || 0;

    return (
      <Surface style={styles.card} elevation={1}>
        <TouchableOpacity activeOpacity={0.7} onPress={() => handleViewDetails(manager)}>
          <View style={styles.cardHeader}>
            <View style={styles.avatarContainer}>
              {manager.profilePicture ? (
                <Avatar.Image size={56} source={{ uri: manager.profilePicture }} />
              ) : (
                <Avatar.Text
                  size={56}
                  label={manager.name?.substring(0, 2).toUpperCase() || "?"}
                  style={{ backgroundColor: MANAGER_COLOR }}
                />
              )}
              {manager.isSuspended && (
                <Badge style={styles.suspendedBadge} size={18}>
                  !
                </Badge>
              )}
            </View>
            <View style={styles.personInfo}>
              <Text variant="titleMedium" style={styles.personName}>
                {manager.name || "Unknown"}
              </Text>
              <Text variant="bodySmall" style={styles.phoneText}>
                {manager.phone}
              </Text>
              <View style={styles.infoRow}>
                <Chip
                  mode="flat"
                  style={[
                    styles.statusChip,
                    {
                      backgroundColor: manager.isSuspended ? "#FFEBEE" : "#E8F5E9",
                    },
                  ]}
                  textStyle={{
                    color: manager.isSuspended ? "#F44336" : "#4CAF50",
                    fontSize: 11,
                  }}
                >
                  {manager.isSuspended ? "Suspended" : "Active"}
                </Chip>
                <Text variant="bodySmall" style={styles.turfsCount}>
                  {assignedTurfsCount} turf{assignedTurfsCount !== 1 ? "s" : ""}
                </Text>
              </View>
              <Text variant="bodySmall" style={styles.joinedText}>
                Joined {getRelativeTime(manager.createdAt || manager.joinedAt)}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        <Divider style={styles.divider} />

        <View style={styles.cardActions}>
          <Button
            mode="outlined"
            compact
            onPress={() => handleEditTurfs(manager)}
            style={styles.actionButton}
            labelStyle={styles.actionButtonLabel}
          >
            Edit Turfs
          </Button>
          {manager.isSuspended ? (
            <Button
              mode="contained"
              compact
              onPress={() => handleReinstate(manager)}
              style={[styles.actionButton, styles.reinstateButton]}
              labelStyle={styles.actionButtonLabel}
            >
              Reinstate
            </Button>
          ) : (
            <Button
              mode="outlined"
              compact
              onPress={() => handleSuspend(manager)}
              style={[styles.actionButton, styles.suspendButton]}
              labelStyle={[styles.actionButtonLabel, { color: "#F44336" }]}
            >
              Suspend
            </Button>
          )}
        </View>
      </Surface>
    );
  };

  // Empty State Component
  const EmptyState = () => (
    <View style={styles.emptyContainer}>
      {loadingManagers ? (
        <>
          <ActivityIndicator animating color={OWNER_COLOR} size="large" />
          <Text variant="bodyMedium" style={styles.emptyText}>
            Loading managers...
          </Text>
        </>
      ) : (
        <>
          <MaterialCommunityIcons name="account-tie" size={80} color="#ccc" />
          <Text variant="titleLarge" style={styles.emptyTitle}>
            No Managers Yet
          </Text>
          <Text variant="bodyMedium" style={styles.emptyText}>
            Share your invite code to let managers join your company.
          </Text>
          {inviteCode?.code && (
            <View style={styles.inviteCodeContainer}>
              <Text variant="bodySmall" style={styles.inviteCodeLabel}>
                Your Invite Code
              </Text>
              <Text variant="headlineMedium" style={styles.inviteCode}>
                {formatCodeForDisplay(inviteCode.code)}
              </Text>
              <Button
                mode="contained"
                icon="share"
                onPress={shareInviteCode}
                style={styles.shareButton}
                buttonColor={OWNER_COLOR}
              >
                Share Invite Code
              </Button>
            </View>
          )}
        </>
      )}
    </View>
  );

  // Details Modal
  const DetailsModal = () => {
    if (!selectedManager) return null;

    const assignedTurfs = turfs.filter((t) =>
      selectedManager.assignedTurfIds?.includes(t.turfId || t.id)
    );

    return (
      <Portal>
        <Dialog
          visible={detailsModalVisible}
          onDismiss={() => setDetailsModalVisible(false)}
          style={styles.dialog}
        >
          <Dialog.Title>Manager Details</Dialog.Title>
          <Dialog.ScrollArea style={styles.dialogScrollArea}>
            <ScrollView>
              <View style={styles.detailsHeader}>
                {selectedManager.profilePicture ? (
                  <Avatar.Image size={80} source={{ uri: selectedManager.profilePicture }} />
                ) : (
                  <Avatar.Text
                    size={80}
                    label={selectedManager.name?.substring(0, 2).toUpperCase() || "?"}
                    style={{ backgroundColor: MANAGER_COLOR }}
                  />
                )}
                <Text variant="titleLarge" style={styles.detailsName}>
                  {selectedManager.name}
                </Text>
                <Text variant="bodyMedium" style={styles.detailsPhone}>
                  {selectedManager.phone}
                </Text>
                {selectedManager.email && (
                  <Text variant="bodySmall" style={styles.detailsEmail}>
                    {selectedManager.email}
                  </Text>
                )}
                <Chip
                  mode="flat"
                  style={[
                    styles.detailsStatusChip,
                    {
                      backgroundColor: selectedManager.isSuspended ? "#FFEBEE" : "#E8F5E9",
                    },
                  ]}
                  textStyle={{
                    color: selectedManager.isSuspended ? "#F44336" : "#4CAF50",
                  }}
                >
                  {selectedManager.isSuspended ? "Suspended" : "Active"}
                </Chip>
              </View>

              <Divider style={styles.detailsDivider} />

              <Text variant="titleSmall" style={styles.sectionTitle}>
                Assigned Turfs ({assignedTurfs.length})
              </Text>
              {assignedTurfs.length > 0 ? (
                assignedTurfs.map((turf) => (
                  <View key={turf.turfId || turf.id} style={styles.turfItem}>
                    <MaterialCommunityIcons name="soccer-field" size={20} color={MANAGER_COLOR} />
                    <Text variant="bodyMedium" style={styles.turfItemText}>
                      {turf.name}
                    </Text>
                  </View>
                ))
              ) : (
                <Text variant="bodySmall" style={styles.noTurfsText}>
                  No turfs assigned
                </Text>
              )}

              <Divider style={styles.detailsDivider} />

              <Text variant="titleSmall" style={styles.sectionTitle}>
                Performance Stats
              </Text>
              <View style={styles.statsGrid}>
                <View style={styles.statBox}>
                  <Text variant="headlineSmall" style={styles.statValue}>
                    {selectedManager.stats?.bookingsHandled || 0}
                  </Text>
                  <Text variant="bodySmall" style={styles.statLabel}>
                    Bookings This Month
                  </Text>
                </View>
                <View style={styles.statBox}>
                  <Text variant="headlineSmall" style={styles.statValue}>
                    {selectedManager.stats?.revenueGenerated
                      ? `₹${selectedManager.stats.revenueGenerated.toLocaleString()}`
                      : "₹0"}
                  </Text>
                  <Text variant="bodySmall" style={styles.statLabel}>
                    Revenue Generated
                  </Text>
                </View>
              </View>

              {selectedManager.isSuspended && (
                <>
                  <Divider style={styles.detailsDivider} />
                  <Text variant="titleSmall" style={[styles.sectionTitle, { color: "#F44336" }]}>
                    Suspension Details
                  </Text>
                  <Text variant="bodySmall" style={styles.suspensionReason}>
                    Reason: {selectedManager.suspensionReason || "Not specified"}
                  </Text>
                  <Text variant="bodySmall" style={styles.suspensionDate}>
                    Suspended: {getRelativeTime(selectedManager.suspendedAt)}
                  </Text>
                </>
              )}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setDetailsModalVisible(false)}>Close</Button>
            <Button
              onPress={() => {
                setDetailsModalVisible(false);
                handleEditTurfs(selectedManager);
              }}
            >
              Edit Turfs
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    );
  };

  // Edit Turfs Modal
  const EditTurfsModal = () => {
    if (!selectedManager) return null;

    return (
      <Portal>
        <Dialog
          visible={editTurfsModalVisible}
          onDismiss={() => setEditTurfsModalVisible(false)}
          style={styles.dialog}
        >
          <Dialog.Title>Edit Turf Assignments</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={styles.dialogSubtitle}>
              Select turfs for {selectedManager.name}
            </Text>
            <ScrollView style={styles.turfList}>
              {turfs.length > 0 ? (
                turfs.map((turf) => {
                  const turfId = turf.turfId || turf.id;
                  const isSelected = selectedTurfIds.includes(turfId);

                  return (
                    <TouchableOpacity
                      key={turfId}
                      style={styles.turfCheckboxItem}
                      onPress={() => toggleTurfSelection(turfId)}
                    >
                      <Checkbox status={isSelected ? "checked" : "unchecked"} color={MANAGER_COLOR} />
                      <View style={styles.turfCheckboxInfo}>
                        <Text variant="bodyMedium">{turf.name}</Text>
                        {turf.location && (
                          <Text variant="bodySmall" style={styles.turfLocation}>
                            {turf.location.city || turf.location.address || ""}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <Text variant="bodyMedium" style={styles.noTurfsText}>
                  No turfs available. Add turfs first.
                </Text>
              )}
            </ScrollView>
            {selectedTurfIds.length === 0 && (
              <Text variant="bodySmall" style={styles.warningText}>
                Please select at least one turf
              </Text>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setEditTurfsModalVisible(false)}>Cancel</Button>
            <Button
              onPress={saveTurfAssignments}
              loading={savingTurfs}
              disabled={savingTurfs || selectedTurfIds.length === 0}
            >
              Save
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    );
  };

  // Suspend Modal
  const SuspendModal = () => {
    if (!selectedManager) return null;

    return (
      <Portal>
        <Dialog
          visible={suspendModalVisible}
          onDismiss={() => setSuspendModalVisible(false)}
          style={styles.dialog}
        >
          <Dialog.Title>Suspend Manager</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={styles.dialogSubtitle}>
              Are you sure you want to suspend {selectedManager.name}? They will immediately lose
              access to the app.
            </Text>
            <TextInput
              label="Reason for suspension *"
              value={suspendReason}
              onChangeText={setSuspendReason}
              mode="outlined"
              multiline
              numberOfLines={3}
              style={styles.reasonInput}
              placeholder="Enter the reason for suspension..."
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setSuspendModalVisible(false)}>Cancel</Button>
            <Button
              onPress={confirmSuspendManager}
              loading={suspending}
              disabled={suspending || !suspendReason.trim()}
              textColor="#F44336"
            >
              Suspend
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    );
  };

  // Reinstate Modal
  const ReinstateModal = () => {
    if (!selectedManager) return null;

    return (
      <Portal>
        <Dialog
          visible={reinstateModalVisible}
          onDismiss={() => setReinstateModalVisible(false)}
          style={styles.dialog}
        >
          <Dialog.Title>Reinstate Manager</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              Are you sure you want to reinstate {selectedManager.name}? They will regain access to
              the app immediately.
            </Text>
            {selectedManager.suspensionReason && (
              <View style={styles.previousReasonContainer}>
                <Text variant="bodySmall" style={styles.previousReasonLabel}>
                  Previous suspension reason:
                </Text>
                <Text variant="bodySmall" style={styles.previousReason}>
                  {selectedManager.suspensionReason}
                </Text>
              </View>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setReinstateModalVisible(false)}>Cancel</Button>
            <Button
              onPress={confirmReinstateManager}
              loading={reinstating}
              disabled={reinstating}
              textColor="#4CAF50"
            >
              Reinstate
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    );
  };

  // Count stats
  const activeCount = managers.filter((m) => !m.isSuspended).length;
  const suspendedCount = managers.filter((m) => m.isSuspended).length;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <IconButton
            icon="arrow-left"
            size={24}
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          />
          <View style={styles.headerTitleContainer}>
            <Text variant="headlineSmall" style={styles.title}>
              Manager Management
            </Text>
            <Text variant="bodySmall" style={styles.subtitle}>
              {managers.length} manager{managers.length !== 1 ? "s" : ""} • {activeCount} active
            </Text>
          </View>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabContainer}>
        <SegmentedButtons
          value={filterTab}
          onValueChange={setFilterTab}
          buttons={[
            { value: "all", label: `All (${managers.length})` },
            { value: "active", label: `Active (${activeCount})` },
            { value: "suspended", label: `Suspended (${suspendedCount})` },
          ]}
          style={styles.segmentedButtons}
        />
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="Search by name or phone..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
          inputStyle={styles.searchInput}
        />
      </View>

      {/* List */}
      <FlatList
        data={filteredManagers}
        keyExtractor={(item) => item.id || item.userId}
        renderItem={({ item }) => <ManagerCard manager={item} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<EmptyState />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[OWNER_COLOR]} />
        }
        keyboardShouldPersistTaps="handled"
      />

      {/* Modals */}
      <DetailsModal />
      <EditTurfsModal />
      <SuspendModal />
      <ReinstateModal />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    backgroundColor: "#fff",
    paddingHorizontal: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    marginRight: 4,
  },
  headerTitleContainer: {
    flex: 1,
  },
  title: {
    fontWeight: "bold",
    color: "#212121",
  },
  subtitle: {
    color: "#666",
    marginTop: 2,
  },
  tabContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
  },
  segmentedButtons: {
    backgroundColor: "#f5f5f5",
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: "#fff",
  },
  searchbar: {
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    elevation: 0,
  },
  searchInput: {
    fontSize: 14,
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  card: {
    borderRadius: 16,
    backgroundColor: "#fff",
    marginBottom: 12,
    padding: 16,
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
    color: "#212121",
  },
  phoneText: {
    color: "#666",
    marginTop: 2,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  statusChip: {
    height: 24,
    marginRight: 8,
  },
  turfsCount: {
    color: "#666",
  },
  joinedText: {
    color: "#999",
    marginTop: 4,
    fontSize: 12,
  },
  divider: {
    marginVertical: 12,
  },
  cardActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  actionButton: {
    marginLeft: 8,
  },
  actionButtonLabel: {
    fontSize: 12,
  },
  suspendButton: {
    borderColor: "#F44336",
  },
  reinstateButton: {
    backgroundColor: "#4CAF50",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontWeight: "bold",
    marginTop: 16,
    marginBottom: 8,
    color: "#212121",
  },
  emptyText: {
    color: "#666",
    textAlign: "center",
    marginBottom: 24,
  },
  inviteCodeContainer: {
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 24,
    borderRadius: 16,
    width: "100%",
  },
  inviteCodeLabel: {
    color: "#666",
    marginBottom: 8,
  },
  inviteCode: {
    fontWeight: "bold",
    letterSpacing: 4,
    color: OWNER_COLOR,
    marginBottom: 16,
  },
  shareButton: {
    marginTop: 8,
  },
  dialog: {
    maxHeight: "80%",
  },
  dialogScrollArea: {
    paddingHorizontal: 0,
  },
  dialogSubtitle: {
    color: "#666",
    marginBottom: 16,
  },
  detailsHeader: {
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  detailsName: {
    fontWeight: "bold",
    marginTop: 12,
    textAlign: "center",
  },
  detailsPhone: {
    color: "#666",
    marginTop: 4,
  },
  detailsEmail: {
    color: "#999",
    marginTop: 2,
  },
  detailsStatusChip: {
    marginTop: 12,
  },
  detailsDivider: {
    marginVertical: 16,
  },
  sectionTitle: {
    fontWeight: "bold",
    marginBottom: 12,
    paddingHorizontal: 24,
  },
  turfItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 24,
  },
  turfItemText: {
    marginLeft: 12,
  },
  noTurfsText: {
    color: "#999",
    fontStyle: "italic",
    paddingHorizontal: 24,
  },
  statsGrid: {
    flexDirection: "row",
    paddingHorizontal: 24,
  },
  statBox: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    padding: 16,
    borderRadius: 12,
    marginRight: 8,
    alignItems: "center",
  },
  statValue: {
    fontWeight: "bold",
    color: MANAGER_COLOR,
  },
  statLabel: {
    color: "#666",
    marginTop: 4,
    textAlign: "center",
  },
  suspensionReason: {
    color: "#666",
    paddingHorizontal: 24,
    marginBottom: 4,
  },
  suspensionDate: {
    color: "#999",
    paddingHorizontal: 24,
  },
  turfList: {
    maxHeight: 300,
  },
  turfCheckboxItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  turfCheckboxInfo: {
    flex: 1,
    marginLeft: 8,
  },
  turfLocation: {
    color: "#999",
  },
  warningText: {
    color: "#F44336",
    marginTop: 8,
  },
  reasonInput: {
    marginTop: 8,
  },
  previousReasonContainer: {
    backgroundColor: "#FFF3E0",
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  previousReasonLabel: {
    color: "#E65100",
    fontWeight: "500",
  },
  previousReason: {
    color: "#666",
    marginTop: 4,
  },
});
