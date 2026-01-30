import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from "react-native";
import {
  Text,
  Surface,
  Chip,
  IconButton,
  Avatar,
  Badge,
  ActivityIndicator,
  Button,
  Dialog,
  Portal,
  TextInput,
  Divider,
  List,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSelector, useDispatch } from "react-redux";
import {
  selectCompany,
  selectUnassignedCaretakers,
  removeUnassignedCaretaker,
  addUnassignedCaretaker,
} from "../../store/slices/companySlice";
import { selectTurfs } from "../../store/slices/ownerSlice";
import { selectUser } from "../../store/slices/authSlice";
import {
  queryDocuments,
  batchWrite,
  serverTimestamp,
  createTimestamp,
} from "../../services/firebase/firestore";

const OWNER_COLOR = "#9C27B0";
const CARETAKER_COLOR = "#FF9800";

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

export default function CaretakerManagementScreen({ navigation }) {
  const dispatch = useDispatch();
  const company = useSelector(selectCompany);
  const turfs = useSelector(selectTurfs);
  const currentUser = useSelector(selectUser);
  const reduxUnassignedCaretakers = useSelector(selectUnassignedCaretakers);
  const companyId = company?.id || company?.companyId;
  const ownerId = currentUser?.userId || currentUser?.id;
  const hasOperationalPermissions = currentUser?.hasOperationalPermissions;

  // State
  const [refreshing, setRefreshing] = useState(false);
  const [loadingCaretakers, setLoadingCaretakers] = useState(false);
  const [caretakers, setCaretakers] = useState([]);

  // Collapsible sections
  const [unassignedExpanded, setUnassignedExpanded] = useState(true);
  const [assignedExpanded, setAssignedExpanded] = useState(true);
  const [expandedTurfs, setExpandedTurfs] = useState({});

  // Modal states
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [unassignModalVisible, setUnassignModalVisible] = useState(false);
  const [suspendModalVisible, setSuspendModalVisible] = useState(false);
  const [reinstateModalVisible, setReinstateModalVisible] = useState(false);
  const [selectedCaretaker, setSelectedCaretaker] = useState(null);

  // Assign/Reassign state
  const [selectedTurfId, setSelectedTurfId] = useState(null);
  const [assigning, setAssigning] = useState(false);
  const [isReassign, setIsReassign] = useState(false);

  // Suspend state
  const [suspendReason, setSuspendReason] = useState("");
  const [suspending, setSuspending] = useState(false);
  const [reinstating, setReinstating] = useState(false);
  const [unassigning, setUnassigning] = useState(false);

  // Fetch caretakers from Firestore
  const fetchCaretakers = useCallback(
    async ({ showRefresh = false } = {}) => {
      if (!companyId) return;

      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoadingCaretakers(true);
      }

      try {
        const users = await queryDocuments("users", [
          { field: "companyId", operator: "==", value: companyId },
          { field: "role", operator: "==", value: "caretaker" },
        ]);

        const caretakerDocs = users.map((u) => ({
          ...u,
          id: u.id || u.userId,
        }));

        setCaretakers(caretakerDocs);

        // Initialize expanded turfs
        const turfIds = {};
        turfs.forEach((t) => {
          turfIds[t.turfId || t.id] = true;
        });
        setExpandedTurfs(turfIds);
      } catch (error) {
        console.error("Error fetching caretakers:", error);
        Alert.alert("Error", "Failed to load caretakers. Please try again.");
      } finally {
        setRefreshing(false);
        setLoadingCaretakers(false);
      }
    },
    [companyId, turfs]
  );

  useEffect(() => {
    if (companyId && hasOperationalPermissions) {
      fetchCaretakers();
    }
  }, [companyId, hasOperationalPermissions, fetchCaretakers]);

  const onRefresh = () => fetchCaretakers({ showRefresh: true });

  // Split caretakers into unassigned and assigned
  const unassignedCaretakers = caretakers.filter(
    (c) => !c.isAssigned && !c.isSuspended
  );
  const assignedCaretakers = caretakers.filter(
    (c) => c.isAssigned && !c.isSuspended
  );
  const suspendedCaretakers = caretakers.filter((c) => c.isSuspended);

  // Group assigned caretakers by turf
  const caretakersByTurf = {};
  turfs.forEach((turf) => {
    const turfId = turf.turfId || turf.id;
    caretakersByTurf[turfId] = {
      turf,
      caretakers: assignedCaretakers.filter(
        (c) => c.assignedTurfId === turfId
      ),
    };
  });

  // Get turf name by ID
  const getTurfName = (turfId) => {
    const turf = turfs.find((t) => t.turfId === turfId || t.id === turfId);
    return turf?.name || "Unknown Turf";
  };

  // Handle assign button
  const handleAssign = (caretaker) => {
    setSelectedCaretaker(caretaker);
    setSelectedTurfId(null);
    setIsReassign(false);
    setAssignModalVisible(true);
  };

  // Handle reassign button
  const handleReassign = (caretaker) => {
    setSelectedCaretaker(caretaker);
    setSelectedTurfId(caretaker.assignedTurfId);
    setIsReassign(true);
    setAssignModalVisible(true);
  };

  // Handle unassign button
  const handleUnassign = (caretaker) => {
    setSelectedCaretaker(caretaker);
    setUnassignModalVisible(true);
  };

  // Handle suspend button
  const handleSuspend = (caretaker) => {
    setSelectedCaretaker(caretaker);
    setSuspendReason("");
    setSuspendModalVisible(true);
  };

  // Handle reinstate button
  const handleReinstate = (caretaker) => {
    setSelectedCaretaker(caretaker);
    setReinstateModalVisible(true);
  };

  // Toggle turf expansion
  const toggleTurfExpanded = (turfId) => {
    setExpandedTurfs((prev) => ({
      ...prev,
      [turfId]: !prev[turfId],
    }));
  };

  // Confirm assign/reassign
  const confirmAssign = async () => {
    if (!selectedCaretaker || !selectedTurfId) {
      Alert.alert("Error", "Please select a turf.");
      return;
    }

    setAssigning(true);

    try {
      const caretakerId = selectedCaretaker.id || selectedCaretaker.userId;
      const oldTurfId = selectedCaretaker.assignedTurfId;
      const newTurf = turfs.find(
        (t) => t.turfId === selectedTurfId || t.id === selectedTurfId
      );

      const batchOperations = [];

      // If reassigning, remove from old turf
      if (isReassign && oldTurfId && oldTurfId !== selectedTurfId) {
        const oldTurf = turfs.find(
          (t) => t.turfId === oldTurfId || t.id === oldTurfId
        );
        if (oldTurf) {
          const currentCaretakerIds = oldTurf.caretakerIds || [];
          batchOperations.push({
            type: "update",
            collection: "turfs",
            docId: oldTurf.turfId || oldTurf.id,
            data: {
              caretakerIds: currentCaretakerIds.filter((id) => id !== caretakerId),
            },
          });
        }
      }

      // Add to new turf
      if (newTurf) {
        const currentCaretakerIds = newTurf.caretakerIds || [];
        if (!currentCaretakerIds.includes(caretakerId)) {
          batchOperations.push({
            type: "update",
            collection: "turfs",
            docId: newTurf.turfId || newTurf.id,
            data: {
              caretakerIds: [...currentCaretakerIds, caretakerId],
            },
          });
        }
      }

      // Update caretaker document
      batchOperations.push({
        type: "update",
        collection: "users",
        docId: caretakerId,
        data: {
          assignedTurfId: selectedTurfId,
          isAssigned: true,
          assignedAt: serverTimestamp(),
          assignedBy: ownerId,
        },
      });

      // Log action
      batchOperations.push({
        type: "set",
        collection: "owner_logs",
        docId: `${Date.now()}_${isReassign ? "reassign" : "assign"}_${caretakerId}`,
        data: {
          companyId,
          performedBy: ownerId,
          performedByRole: "owner",
          action: isReassign ? "caretaker_reassigned" : "caretaker_assigned",
          targetType: "user",
          targetId: caretakerId,
          details: {
            ...(isReassign && { oldTurfId }),
            newTurfId: selectedTurfId,
            turfName: newTurf?.name,
          },
          timestamp: serverTimestamp(),
        },
      });

      await batchWrite(batchOperations);

      // Update local state
      setCaretakers((prev) =>
        prev.map((c) =>
          (c.id || c.userId) === caretakerId
            ? {
                ...c,
                assignedTurfId: selectedTurfId,
                isAssigned: true,
                assignedAt: new Date(),
              }
            : c
        )
      );

      // Remove from Redux unassigned if was unassigned
      if (!isReassign) {
        dispatch(removeUnassignedCaretaker(caretakerId));
      }

      setAssignModalVisible(false);
      Alert.alert(
        "Success",
        `${selectedCaretaker.name} has been ${isReassign ? "reassigned" : "assigned"} to ${newTurf?.name || "the turf"}.`
      );
    } catch (error) {
      console.error("Error assigning caretaker:", error);
      Alert.alert("Error", "Failed to assign caretaker. Please try again.");
    } finally {
      setAssigning(false);
    }
  };

  // Confirm unassign
  const confirmUnassign = async () => {
    if (!selectedCaretaker) return;

    setUnassigning(true);

    try {
      const caretakerId = selectedCaretaker.id || selectedCaretaker.userId;
      const turfId = selectedCaretaker.assignedTurfId;
      const turf = turfs.find((t) => t.turfId === turfId || t.id === turfId);

      const batchOperations = [];

      // Remove from turf
      if (turf) {
        const currentCaretakerIds = turf.caretakerIds || [];
        batchOperations.push({
          type: "update",
          collection: "turfs",
          docId: turf.turfId || turf.id,
          data: {
            caretakerIds: currentCaretakerIds.filter((id) => id !== caretakerId),
          },
        });
      }

      // Update caretaker document
      batchOperations.push({
        type: "update",
        collection: "users",
        docId: caretakerId,
        data: {
          assignedTurfId: null,
          isAssigned: false,
          unassignedAt: serverTimestamp(),
          unassignedBy: ownerId,
        },
      });

      // Log action
      batchOperations.push({
        type: "set",
        collection: "owner_logs",
        docId: `${Date.now()}_unassign_${caretakerId}`,
        data: {
          companyId,
          performedBy: ownerId,
          performedByRole: "owner",
          action: "caretaker_unassigned",
          targetType: "user",
          targetId: caretakerId,
          details: {
            previousTurfId: turfId,
            previousTurfName: turf?.name,
          },
          timestamp: serverTimestamp(),
        },
      });

      await batchWrite(batchOperations);

      // Update local state
      setCaretakers((prev) =>
        prev.map((c) =>
          (c.id || c.userId) === caretakerId
            ? { ...c, assignedTurfId: null, isAssigned: false }
            : c
        )
      );

      // Add to Redux unassigned
      dispatch(addUnassignedCaretaker(caretakerId));

      setUnassignModalVisible(false);
      Alert.alert(
        "Caretaker Unassigned",
        "The caretaker has been unassigned and will see a 'Waiting for Assignment' screen."
      );
    } catch (error) {
      console.error("Error unassigning caretaker:", error);
      Alert.alert("Error", "Failed to unassign caretaker. Please try again.");
    } finally {
      setUnassigning(false);
    }
  };

  // Confirm suspend
  const confirmSuspend = async () => {
    if (!suspendReason.trim()) {
      Alert.alert("Error", "Please provide a reason for suspension.");
      return;
    }

    setSuspending(true);

    try {
      const caretakerId = selectedCaretaker.id || selectedCaretaker.userId;
      const turfId = selectedCaretaker.assignedTurfId;
      const turf = turfs.find((t) => t.turfId === turfId || t.id === turfId);
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

      const batchOperations = [];

      // If assigned, remove from turf
      if (selectedCaretaker.isAssigned && turf) {
        const currentCaretakerIds = turf.caretakerIds || [];
        batchOperations.push({
          type: "update",
          collection: "turfs",
          docId: turf.turfId || turf.id,
          data: {
            caretakerIds: currentCaretakerIds.filter((id) => id !== caretakerId),
          },
        });
      }

      // Update caretaker document
      batchOperations.push({
        type: "update",
        collection: "users",
        docId: caretakerId,
        data: {
          isSuspended: true,
          suspendedAt: serverTimestamp(),
          suspendedBy: ownerId,
          suspensionReason: suspendReason.trim(),
          canBeDeletedAfter: createTimestamp(thirtyDaysMs),
          // Also unassign
          assignedTurfId: null,
          isAssigned: false,
        },
      });

      // Log action
      batchOperations.push({
        type: "set",
        collection: "owner_logs",
        docId: `${Date.now()}_suspend_${caretakerId}`,
        data: {
          companyId,
          performedBy: ownerId,
          performedByRole: "owner",
          action: "caretaker_suspended",
          targetType: "user",
          targetId: caretakerId,
          details: {
            reason: suspendReason.trim(),
            wasAssigned: selectedCaretaker.isAssigned,
            previousTurfId: turfId,
          },
          timestamp: serverTimestamp(),
        },
      });

      await batchWrite(batchOperations);

      // Update local state
      setCaretakers((prev) =>
        prev.map((c) =>
          (c.id || c.userId) === caretakerId
            ? {
                ...c,
                isSuspended: true,
                suspendedAt: new Date(),
                suspensionReason: suspendReason.trim(),
                assignedTurfId: null,
                isAssigned: false,
              }
            : c
        )
      );

      setSuspendModalVisible(false);
      setSuspendReason("");

      Alert.alert(
        "Caretaker Suspended",
        "Caretaker suspended. They will lose access immediately. Account can be permanently deleted after 30 days."
      );
    } catch (error) {
      console.error("Error suspending caretaker:", error);
      Alert.alert("Error", "Failed to suspend caretaker. Please try again.");
    } finally {
      setSuspending(false);
    }
  };

  // Confirm reinstate
  const confirmReinstate = async () => {
    setReinstating(true);

    try {
      const caretakerId = selectedCaretaker.id || selectedCaretaker.userId;

      const batchOperations = [
        {
          type: "update",
          collection: "users",
          docId: caretakerId,
          data: {
            isSuspended: false,
            suspendedAt: null,
            suspendedBy: null,
            suspensionReason: null,
            canBeDeletedAfter: null,
            // Stays unassigned - needs to be reassigned
            isAssigned: false,
            assignedTurfId: null,
          },
        },
        {
          type: "set",
          collection: "owner_logs",
          docId: `${Date.now()}_reinstate_${caretakerId}`,
          data: {
            companyId,
            performedBy: ownerId,
            performedByRole: "owner",
            action: "caretaker_reinstated",
            targetType: "user",
            targetId: caretakerId,
            details: {},
            timestamp: serverTimestamp(),
          },
        },
      ];

      await batchWrite(batchOperations);

      // Update local state
      setCaretakers((prev) =>
        prev.map((c) =>
          (c.id || c.userId) === caretakerId
            ? {
                ...c,
                isSuspended: false,
                suspendedAt: null,
                suspensionReason: null,
                isAssigned: false,
                assignedTurfId: null,
              }
            : c
        )
      );

      // Add to Redux unassigned
      dispatch(addUnassignedCaretaker(caretakerId));

      setReinstateModalVisible(false);
      Alert.alert(
        "Caretaker Reinstated",
        "The caretaker has been reinstated and is now waiting for assignment."
      );
    } catch (error) {
      console.error("Error reinstating caretaker:", error);
      Alert.alert("Error", "Failed to reinstate caretaker. Please try again.");
    } finally {
      setReinstating(false);
    }
  };

  // Access Control Screen
  if (!hasOperationalPermissions) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <IconButton
            icon="arrow-left"
            size={24}
            onPress={() => navigation.goBack()}
          />
          <Text variant="headlineSmall" style={styles.title}>
            Caretaker Management
          </Text>
        </View>
        <View style={styles.noAccessContainer}>
          <MaterialCommunityIcons
            name="shield-lock-outline"
            size={80}
            color="#ccc"
          />
          <Text variant="titleLarge" style={styles.noAccessTitle}>
            Operational Permissions Required
          </Text>
          <Text variant="bodyMedium" style={styles.noAccessText}>
            Enable operational permissions in settings to manage caretakers
            directly. This allows you to assign, reassign, and manage caretaker
            access.
          </Text>
          <Button
            mode="contained"
            icon="cog"
            onPress={() => navigation.navigate("Settings")}
            style={styles.settingsButton}
            buttonColor={OWNER_COLOR}
          >
            Go to Settings
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  // Caretaker Card Component
  const CaretakerCard = ({ caretaker, showActions = true }) => (
    <Surface style={styles.card} elevation={1}>
      <View style={styles.cardHeader}>
        <View style={styles.avatarContainer}>
          {caretaker.profilePicture ? (
            <Avatar.Image size={48} source={{ uri: caretaker.profilePicture }} />
          ) : (
            <Avatar.Text
              size={48}
              label={caretaker.name?.substring(0, 2).toUpperCase() || "?"}
              style={{ backgroundColor: CARETAKER_COLOR }}
            />
          )}
          {caretaker.isSuspended && (
            <Badge style={styles.suspendedBadge} size={16}>
              !
            </Badge>
          )}
        </View>
        <View style={styles.personInfo}>
          <Text variant="titleMedium" style={styles.personName}>
            {caretaker.name || "Unknown"}
          </Text>
          <Text variant="bodySmall" style={styles.phoneText}>
            {caretaker.phone}
          </Text>
          <Text variant="bodySmall" style={styles.dateText}>
            {caretaker.isAssigned
              ? `Assigned ${getRelativeTime(caretaker.assignedAt)}`
              : `Joined ${getRelativeTime(caretaker.createdAt || caretaker.joinedAt)}`}
          </Text>
        </View>
        <Chip
          mode="flat"
          style={[
            styles.statusChip,
            {
              backgroundColor: caretaker.isSuspended
                ? "#FFEBEE"
                : caretaker.isAssigned
                ? "#E8F5E9"
                : "#FFF3E0",
            },
          ]}
          textStyle={{
            color: caretaker.isSuspended
              ? "#F44336"
              : caretaker.isAssigned
              ? "#4CAF50"
              : "#FF9800",
            fontSize: 11,
          }}
        >
          {caretaker.isSuspended
            ? "Suspended"
            : caretaker.isAssigned
            ? "Active"
            : "Unassigned"}
        </Chip>
      </View>

      {showActions && (
        <>
          <Divider style={styles.divider} />
          <View style={styles.cardActions}>
            {caretaker.isSuspended ? (
              <Button
                mode="contained"
                compact
                onPress={() => handleReinstate(caretaker)}
                style={styles.actionButton}
                labelStyle={styles.actionButtonLabel}
                buttonColor="#4CAF50"
              >
                Reinstate
              </Button>
            ) : caretaker.isAssigned ? (
              <>
                <Button
                  mode="outlined"
                  compact
                  onPress={() => handleReassign(caretaker)}
                  style={styles.actionButton}
                  labelStyle={styles.actionButtonLabel}
                >
                  Reassign
                </Button>
                <Button
                  mode="outlined"
                  compact
                  onPress={() => handleUnassign(caretaker)}
                  style={styles.actionButton}
                  labelStyle={styles.actionButtonLabel}
                >
                  Unassign
                </Button>
                <Button
                  mode="outlined"
                  compact
                  onPress={() => handleSuspend(caretaker)}
                  style={[styles.actionButton, styles.suspendButton]}
                  labelStyle={[styles.actionButtonLabel, { color: "#F44336" }]}
                >
                  Suspend
                </Button>
              </>
            ) : (
              <>
                <Button
                  mode="contained"
                  compact
                  onPress={() => handleAssign(caretaker)}
                  style={styles.actionButton}
                  labelStyle={styles.actionButtonLabel}
                  buttonColor={CARETAKER_COLOR}
                >
                  Assign to Turf
                </Button>
                <Button
                  mode="outlined"
                  compact
                  onPress={() => handleSuspend(caretaker)}
                  style={[styles.actionButton, styles.suspendButton]}
                  labelStyle={[styles.actionButtonLabel, { color: "#F44336" }]}
                >
                  Suspend
                </Button>
              </>
            )}
          </View>
        </>
      )}
    </Surface>
  );

  // Empty State Component
  const EmptyState = () => (
    <View style={styles.emptyContainer}>
      {loadingCaretakers ? (
        <>
          <ActivityIndicator animating color={OWNER_COLOR} size="large" />
          <Text variant="bodyMedium" style={styles.emptyText}>
            Loading caretakers...
          </Text>
        </>
      ) : (
        <>
          <MaterialCommunityIcons name="account-hard-hat" size={80} color="#ccc" />
          <Text variant="titleLarge" style={styles.emptyTitle}>
            No Caretakers Yet
          </Text>
          <Text variant="bodyMedium" style={styles.emptyText}>
            Share your invite code to let caretakers join your company.
          </Text>
        </>
      )}
    </View>
  );

  // Assign Modal
  const AssignModal = () => {
    if (!selectedCaretaker) return null;

    return (
      <Portal>
        <Dialog
          visible={assignModalVisible}
          onDismiss={() => setAssignModalVisible(false)}
          style={styles.dialog}
        >
          <Dialog.Title>
            {isReassign ? "Reassign Caretaker" : "Assign to Turf"}
          </Dialog.Title>
          <Dialog.Content>
            <View style={styles.modalCaretakerInfo}>
              {selectedCaretaker.profilePicture ? (
                <Avatar.Image
                  size={48}
                  source={{ uri: selectedCaretaker.profilePicture }}
                />
              ) : (
                <Avatar.Text
                  size={48}
                  label={selectedCaretaker.name?.substring(0, 2).toUpperCase() || "?"}
                  style={{ backgroundColor: CARETAKER_COLOR }}
                />
              )}
              <View style={styles.modalCaretakerDetails}>
                <Text variant="titleMedium">{selectedCaretaker.name}</Text>
                <Text variant="bodySmall" style={styles.phoneText}>
                  {selectedCaretaker.phone}
                </Text>
              </View>
            </View>

            <Divider style={styles.modalDivider} />

            <Text variant="titleSmall" style={styles.selectTurfLabel}>
              Select Turf
            </Text>

            <ScrollView style={styles.turfSelectList}>
              {turfs.map((turf) => {
                const turfId = turf.turfId || turf.id;
                const isSelected = selectedTurfId === turfId;

                return (
                  <TouchableOpacity
                    key={turfId}
                    style={[
                      styles.turfSelectItem,
                      isSelected && styles.turfSelectItemSelected,
                    ]}
                    onPress={() => setSelectedTurfId(turfId)}
                  >
                    <MaterialCommunityIcons
                      name={isSelected ? "radiobox-marked" : "radiobox-blank"}
                      size={24}
                      color={isSelected ? CARETAKER_COLOR : "#999"}
                    />
                    <View style={styles.turfSelectInfo}>
                      <Text variant="bodyMedium">{turf.name}</Text>
                      {turf.location && (
                        <Text variant="bodySmall" style={styles.turfLocation}>
                          {turf.location.city || turf.location.address || ""}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.noteContainer}>
              <MaterialCommunityIcons name="information-outline" size={16} color="#666" />
              <Text variant="bodySmall" style={styles.noteText}>
                One caretaker is typically assigned to one turf
              </Text>
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setAssignModalVisible(false)}>Cancel</Button>
            <Button
              onPress={confirmAssign}
              loading={assigning}
              disabled={assigning || !selectedTurfId}
            >
              {isReassign ? "Reassign" : "Assign"}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    );
  };

  // Unassign Modal
  const UnassignModal = () => {
    if (!selectedCaretaker) return null;

    return (
      <Portal>
        <Dialog
          visible={unassignModalVisible}
          onDismiss={() => setUnassignModalVisible(false)}
        >
          <Dialog.Title>Unassign Caretaker</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              Are you sure you want to unassign {selectedCaretaker.name} from{" "}
              {getTurfName(selectedCaretaker.assignedTurfId)}?
            </Text>
            <View style={styles.warningBox}>
              <MaterialCommunityIcons name="alert-outline" size={20} color="#E65100" />
              <Text variant="bodySmall" style={styles.warningText}>
                This will remove the caretaker from their turf. They will see a
                "Waiting for Assignment" screen until reassigned.
              </Text>
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setUnassignModalVisible(false)}>Cancel</Button>
            <Button
              onPress={confirmUnassign}
              loading={unassigning}
              disabled={unassigning}
              textColor="#F44336"
            >
              Unassign
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    );
  };

  // Suspend Modal
  const SuspendModal = () => {
    if (!selectedCaretaker) return null;

    return (
      <Portal>
        <Dialog
          visible={suspendModalVisible}
          onDismiss={() => setSuspendModalVisible(false)}
        >
          <Dialog.Title>Suspend Caretaker</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              Are you sure you want to suspend {selectedCaretaker.name}? They will
              immediately lose access to the app.
            </Text>
            {selectedCaretaker.isAssigned && (
              <View style={styles.warningBox}>
                <MaterialCommunityIcons name="alert-outline" size={20} color="#E65100" />
                <Text variant="bodySmall" style={styles.warningText}>
                  This caretaker will also be unassigned from{" "}
                  {getTurfName(selectedCaretaker.assignedTurfId)}.
                </Text>
              </View>
            )}
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
              onPress={confirmSuspend}
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
    if (!selectedCaretaker) return null;

    return (
      <Portal>
        <Dialog
          visible={reinstateModalVisible}
          onDismiss={() => setReinstateModalVisible(false)}
        >
          <Dialog.Title>Reinstate Caretaker</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              Are you sure you want to reinstate {selectedCaretaker.name}? They will
              regain access to the app but will need to be assigned to a turf.
            </Text>
            {selectedCaretaker.suspensionReason && (
              <View style={styles.previousReasonContainer}>
                <Text variant="bodySmall" style={styles.previousReasonLabel}>
                  Previous suspension reason:
                </Text>
                <Text variant="bodySmall" style={styles.previousReason}>
                  {selectedCaretaker.suspensionReason}
                </Text>
              </View>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setReinstateModalVisible(false)}>Cancel</Button>
            <Button
              onPress={confirmReinstate}
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton
          icon="arrow-left"
          size={24}
          onPress={() => navigation.goBack()}
        />
        <View style={styles.headerTitleContainer}>
          <Text variant="headlineSmall" style={styles.title}>
            Caretaker Management
          </Text>
          <Text variant="bodySmall" style={styles.subtitle}>
            {caretakers.filter((c) => !c.isSuspended).length} active •{" "}
            {suspendedCaretakers.length} suspended
          </Text>
        </View>
      </View>

      {caretakers.length === 0 && !loadingCaretakers ? (
        <EmptyState />
      ) : (
        <ScrollView
          style={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[OWNER_COLOR]}
            />
          }
          keyboardShouldPersistTaps="handled"
        >
          {/* Unassigned Section */}
          <List.Accordion
            title={`Waiting for Assignment (${unassignedCaretakers.length})`}
            titleStyle={styles.sectionTitle}
            expanded={unassignedExpanded}
            onPress={() => setUnassignedExpanded(!unassignedExpanded)}
            style={styles.accordionHeader}
            left={(props) => (
              <MaterialCommunityIcons
                {...props}
                name="clock-outline"
                size={24}
                color={CARETAKER_COLOR}
              />
            )}
          >
            <View style={styles.sectionContent}>
              {unassignedCaretakers.length > 0 ? (
                unassignedCaretakers.map((caretaker) => (
                  <CaretakerCard
                    key={caretaker.id || caretaker.userId}
                    caretaker={caretaker}
                  />
                ))
              ) : (
                <View style={styles.emptySectionContainer}>
                  <MaterialCommunityIcons
                    name="account-check"
                    size={40}
                    color="#4CAF50"
                  />
                  <Text variant="bodyMedium" style={styles.emptySectionText}>
                    No caretakers waiting for assignment
                  </Text>
                </View>
              )}
            </View>
          </List.Accordion>

          <Divider />

          {/* Assigned Section - Grouped by Turf */}
          <List.Accordion
            title={`Active Caretakers (${assignedCaretakers.length})`}
            titleStyle={styles.sectionTitle}
            expanded={assignedExpanded}
            onPress={() => setAssignedExpanded(!assignedExpanded)}
            style={styles.accordionHeader}
            left={(props) => (
              <MaterialCommunityIcons
                {...props}
                name="account-check"
                size={24}
                color="#4CAF50"
              />
            )}
          >
            <View style={styles.sectionContent}>
              {Object.entries(caretakersByTurf).map(([turfId, { turf, caretakers: turfCaretakers }]) => {
                if (turfCaretakers.length === 0) return null;

                return (
                  <View key={turfId} style={styles.turfGroup}>
                    <TouchableOpacity
                      style={styles.turfGroupHeader}
                      onPress={() => toggleTurfExpanded(turfId)}
                    >
                      <MaterialCommunityIcons
                        name="soccer-field"
                        size={20}
                        color={OWNER_COLOR}
                      />
                      <Text variant="titleSmall" style={styles.turfGroupTitle}>
                        {turf.name} ({turfCaretakers.length})
                      </Text>
                      <MaterialCommunityIcons
                        name={expandedTurfs[turfId] ? "chevron-up" : "chevron-down"}
                        size={24}
                        color="#666"
                      />
                    </TouchableOpacity>
                    {expandedTurfs[turfId] && (
                      <View style={styles.turfGroupContent}>
                        {turfCaretakers.map((caretaker) => (
                          <CaretakerCard
                            key={caretaker.id || caretaker.userId}
                            caretaker={caretaker}
                          />
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
              {assignedCaretakers.length === 0 && (
                <View style={styles.emptySectionContainer}>
                  <MaterialCommunityIcons
                    name="account-question"
                    size={40}
                    color="#999"
                  />
                  <Text variant="bodyMedium" style={styles.emptySectionText}>
                    No caretakers assigned to turfs yet
                  </Text>
                </View>
              )}
            </View>
          </List.Accordion>

          {/* Suspended Section */}
          {suspendedCaretakers.length > 0 && (
            <>
              <Divider />
              <List.Accordion
                title={`Suspended (${suspendedCaretakers.length})`}
                titleStyle={[styles.sectionTitle, { color: "#F44336" }]}
                style={styles.accordionHeader}
                left={(props) => (
                  <MaterialCommunityIcons
                    {...props}
                    name="account-cancel"
                    size={24}
                    color="#F44336"
                  />
                )}
              >
                <View style={styles.sectionContent}>
                  {suspendedCaretakers.map((caretaker) => (
                    <CaretakerCard
                      key={caretaker.id || caretaker.userId}
                      caretaker={caretaker}
                    />
                  ))}
                </View>
              </List.Accordion>
            </>
          )}

          <View style={styles.bottomPadding} />
        </ScrollView>
      )}

      {/* Modals */}
      <AssignModal />
      <UnassignModal />
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
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingRight: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
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
  scrollContent: {
    flex: 1,
  },
  accordionHeader: {
    backgroundColor: "#fff",
  },
  sectionTitle: {
    fontWeight: "600",
  },
  sectionContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: "#f5f5f5",
  },
  card: {
    borderRadius: 12,
    backgroundColor: "#fff",
    marginTop: 12,
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
  dateText: {
    color: "#999",
    marginTop: 4,
    fontSize: 12,
  },
  statusChip: {
    height: 24,
  },
  divider: {
    marginVertical: 12,
  },
  cardActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  actionButton: {
    marginRight: 0,
  },
  actionButtonLabel: {
    fontSize: 12,
  },
  suspendButton: {
    borderColor: "#F44336",
  },
  emptySectionContainer: {
    alignItems: "center",
    paddingVertical: 32,
  },
  emptySectionText: {
    color: "#666",
    marginTop: 12,
  },
  turfGroup: {
    marginTop: 12,
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
  },
  turfGroupHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#fafafa",
  },
  turfGroupTitle: {
    flex: 1,
    marginLeft: 12,
    fontWeight: "600",
  },
  turfGroupContent: {
    padding: 12,
    paddingTop: 0,
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
  },
  noAccessContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  noAccessTitle: {
    fontWeight: "bold",
    marginTop: 24,
    marginBottom: 12,
    textAlign: "center",
    color: "#212121",
  },
  noAccessText: {
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  settingsButton: {
    marginTop: 8,
  },
  dialog: {
    maxHeight: "80%",
  },
  modalCaretakerInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  modalCaretakerDetails: {
    marginLeft: 12,
  },
  modalDivider: {
    marginBottom: 16,
  },
  selectTurfLabel: {
    fontWeight: "600",
    marginBottom: 12,
  },
  turfSelectList: {
    maxHeight: 200,
  },
  turfSelectItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 4,
  },
  turfSelectItemSelected: {
    backgroundColor: "#FFF3E0",
  },
  turfSelectInfo: {
    marginLeft: 12,
    flex: 1,
  },
  turfLocation: {
    color: "#999",
    marginTop: 2,
  },
  noteContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  noteText: {
    color: "#666",
    marginLeft: 8,
    flex: 1,
  },
  warningBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFF3E0",
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  warningText: {
    color: "#E65100",
    marginLeft: 8,
    flex: 1,
  },
  reasonInput: {
    marginTop: 16,
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
  bottomPadding: {
    height: 24,
  },
});
