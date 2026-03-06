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
  Avatar,
  Badge,
  ActivityIndicator,
  Button,
  Dialog,
  Portal,
  TextInput,
  Divider,
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
import { selectUser, selectAssignedTurfIds } from "../../store/slices/authSlice";
import {
  queryDocuments,
  batchWrite,
  serverTimestamp,
  createTimestamp,
} from "../../services/firebase/firestore";

const MANAGER_COLOR = "#2196F3";
const CARETAKER_COLOR = "#FF9800";
const SUCCESS_COLOR = "#4CAF50";
const DANGER_COLOR = "#F44336";

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

// ── Sub-components ───────────────────────────────────────────────────────────

function StatTile({ count, label, color, icon }) {
  return (
    <View style={styles.statTile}>
      <View style={[styles.statIconBg, { backgroundColor: color + "18" }]}>
        <MaterialCommunityIcons name={icon} size={18} color={color} />
      </View>
      <Text style={[styles.statCount, { color }]}>{count}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SectionHeader({ title, count, icon, color, expanded, onToggle }) {
  return (
    <TouchableOpacity
      style={styles.sectionHeader}
      onPress={onToggle}
      activeOpacity={0.8}
    >
      <View style={[styles.sectionIconWrap, { backgroundColor: color + "18" }]}>
        <MaterialCommunityIcons name={icon} size={18} color={color} />
      </View>
      <Text style={styles.sectionHeaderTitle}>{title}</Text>
      <View style={[styles.sectionBadge, { backgroundColor: color + "18" }]}>
        <Text style={[styles.sectionBadgeText, { color }]}>{count}</Text>
      </View>
      <MaterialCommunityIcons
        name={expanded ? "chevron-up" : "chevron-down"}
        size={20}
        color="#9E9E9E"
        style={{ marginLeft: 8 }}
      />
    </TouchableOpacity>
  );
}

function ActionChip({ icon, label, color, filled, onPress }) {
  return (
    <TouchableOpacity
      style={[
        styles.actionChip,
        { borderColor: color + "50" },
        filled && { backgroundColor: color, borderColor: color },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <MaterialCommunityIcons
        name={icon}
        size={13}
        color={filled ? "#fff" : color}
      />
      <Text style={[styles.actionChipText, { color: filled ? "#fff" : color }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────────────

export default function ManagerCaretakerScreen({ navigation }) {
  const dispatch = useDispatch();
  const company = useSelector(selectCompany);
  const currentUser = useSelector(selectUser);
  const assignedTurfIds = useSelector(selectAssignedTurfIds) || currentUser?.assignedTurfIds || [];
  const reduxUnassignedCaretakers = useSelector(selectUnassignedCaretakers);
  const companyId = company?.id || company?.companyId;
  const managerId = currentUser?.userId || currentUser?.id;

  // State
  const [refreshing, setRefreshing] = useState(false);
  const [loadingCaretakers, setLoadingCaretakers] = useState(false);
  const [caretakers, setCaretakers] = useState([]);
  const [allTurfs, setAllTurfs] = useState([]);

  // Filter turfs to only those assigned to this manager
  const turfs = allTurfs.filter(
    (turf) =>
      assignedTurfIds.includes(turf.turfId) ||
      assignedTurfIds.includes(turf.id)
  );

  // Collapsible sections
  const [unassignedExpanded, setUnassignedExpanded] = useState(true);
  const [assignedExpanded, setAssignedExpanded] = useState(true);
  const [suspendedExpanded, setSuspendedExpanded] = useState(false);
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

  // Fetch turfs and caretakers from Firestore
  const fetchData = useCallback(
    async ({ showRefresh = false } = {}) => {
      if (!companyId) return;

      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoadingCaretakers(true);
      }

      try {
        const turfsData = await queryDocuments("turfs", [
          { field: "companyId", operator: "==", value: companyId },
        ]);

        const turfDocs = turfsData.map((t) => ({
          ...t,
          id: t.id || t.turfId,
        }));
        setAllTurfs(turfDocs);

        const managerTurfs = turfDocs.filter(
          (turf) =>
            assignedTurfIds.includes(turf.turfId) ||
            assignedTurfIds.includes(turf.id)
        );

        const turfIds = {};
        managerTurfs.forEach((t) => {
          turfIds[t.turfId || t.id] = true;
        });
        setExpandedTurfs(turfIds);

        const users = await queryDocuments("users", [
          { field: "companyId", operator: "==", value: companyId },
          { field: "role", operator: "==", value: "caretaker" },
        ]);

        const caretakerDocs = users.map((u) => ({
          ...u,
          id: u.id || u.userId,
        }));

        setCaretakers(caretakerDocs);
      } catch (error) {
        console.error("Error fetching data:", error);
        Alert.alert("Error", "Failed to load data. Please try again.");
      } finally {
        setRefreshing(false);
        setLoadingCaretakers(false);
      }
    },
    [companyId, assignedTurfIds]
  );

  useEffect(() => {
    if (companyId) {
      fetchData();
    }
  }, [companyId, fetchData]);

  const onRefresh = () => fetchData({ showRefresh: true });

  // Split caretakers
  const unassignedCaretakers = caretakers.filter(
    (c) => !c.isAssigned && !c.isSuspended
  );

  const assignedCaretakers = caretakers.filter(
    (c) =>
      c.isAssigned &&
      !c.isSuspended &&
      assignedTurfIds.includes(c.assignedTurfId)
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

  const getTurfName = (turfId) => {
    const turf = allTurfs.find((t) => t.turfId === turfId || t.id === turfId);
    return turf?.name || "Unknown Turf";
  };

  // Handlers
  const handleAssign = (caretaker) => {
    setSelectedCaretaker(caretaker);
    setSelectedTurfId(null);
    setIsReassign(false);
    setAssignModalVisible(true);
  };

  const handleReassign = (caretaker) => {
    setSelectedCaretaker(caretaker);
    setSelectedTurfId(caretaker.assignedTurfId);
    setIsReassign(true);
    setAssignModalVisible(true);
  };

  const handleUnassign = (caretaker) => {
    setSelectedCaretaker(caretaker);
    setUnassignModalVisible(true);
  };

  const handleSuspend = (caretaker) => {
    setSelectedCaretaker(caretaker);
    setSuspendReason("");
    setSuspendModalVisible(true);
  };

  const handleReinstate = (caretaker) => {
    setSelectedCaretaker(caretaker);
    setReinstateModalVisible(true);
  };

  const toggleTurfExpanded = (turfId) => {
    setExpandedTurfs((prev) => ({
      ...prev,
      [turfId]: !prev[turfId],
    }));
  };

  const confirmAssign = async () => {
    if (!selectedCaretaker || !selectedTurfId) {
      Alert.alert("Error", "Please select a turf.");
      return;
    }

    setAssigning(true);

    try {
      const caretakerId = selectedCaretaker.id || selectedCaretaker.userId;
      const oldTurfId = selectedCaretaker.assignedTurfId;
      const newTurf = allTurfs.find(
        (t) => t.turfId === selectedTurfId || t.id === selectedTurfId
      );

      const batchOperations = [];

      if (isReassign && oldTurfId && oldTurfId !== selectedTurfId) {
        const oldTurf = allTurfs.find(
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

      batchOperations.push({
        type: "update",
        collection: "users",
        docId: caretakerId,
        data: {
          assignedTurfId: selectedTurfId,
          isAssigned: true,
          assignedAt: serverTimestamp(),
          assignedBy: managerId,
        },
      });

      batchOperations.push({
        type: "set",
        collection: "owner_logs",
        docId: `${Date.now()}_${isReassign ? "reassign" : "assign"}_${caretakerId}`,
        data: {
          companyId,
          performedBy: managerId,
          performedByRole: "manager",
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

      setAllTurfs((prev) =>
        prev.map((turf) => {
          const turfId = turf.turfId || turf.id;
          if (isReassign && oldTurfId && turfId === oldTurfId) {
            return {
              ...turf,
              caretakerIds: (turf.caretakerIds || []).filter((id) => id !== caretakerId),
            };
          }
          if (turfId === selectedTurfId) {
            const currentIds = turf.caretakerIds || [];
            if (!currentIds.includes(caretakerId)) {
              return {
                ...turf,
                caretakerIds: [...currentIds, caretakerId],
              };
            }
          }
          return turf;
        })
      );

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

  const confirmUnassign = async () => {
    if (!selectedCaretaker) return;

    setUnassigning(true);

    try {
      const caretakerId = selectedCaretaker.id || selectedCaretaker.userId;
      const turfId = selectedCaretaker.assignedTurfId;
      const turf = allTurfs.find((t) => t.turfId === turfId || t.id === turfId);

      const batchOperations = [];

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

      batchOperations.push({
        type: "update",
        collection: "users",
        docId: caretakerId,
        data: {
          assignedTurfId: null,
          isAssigned: false,
          unassignedAt: serverTimestamp(),
          unassignedBy: managerId,
        },
      });

      batchOperations.push({
        type: "set",
        collection: "owner_logs",
        docId: `${Date.now()}_unassign_${caretakerId}`,
        data: {
          companyId,
          performedBy: managerId,
          performedByRole: "manager",
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

      setCaretakers((prev) =>
        prev.map((c) =>
          (c.id || c.userId) === caretakerId
            ? { ...c, assignedTurfId: null, isAssigned: false }
            : c
        )
      );

      if (turfId) {
        setAllTurfs((prev) =>
          prev.map((t) => {
            const currentTurfId = t.turfId || t.id;
            if (currentTurfId === turfId) {
              return {
                ...t,
                caretakerIds: (t.caretakerIds || []).filter((id) => id !== caretakerId),
              };
            }
            return t;
          })
        );
      }

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

  const confirmSuspend = async () => {
    if (!suspendReason.trim()) {
      Alert.alert("Error", "Please provide a reason for suspension.");
      return;
    }

    setSuspending(true);

    try {
      const caretakerId = selectedCaretaker.id || selectedCaretaker.userId;
      const turfId = selectedCaretaker.assignedTurfId;
      const turf = allTurfs.find((t) => t.turfId === turfId || t.id === turfId);
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

      const batchOperations = [];

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

      batchOperations.push({
        type: "update",
        collection: "users",
        docId: caretakerId,
        data: {
          isSuspended: true,
          suspendedAt: serverTimestamp(),
          suspendedBy: managerId,
          suspensionReason: suspendReason.trim(),
          canBeDeletedAfter: createTimestamp(thirtyDaysMs),
          assignedTurfId: null,
          isAssigned: false,
        },
      });

      batchOperations.push({
        type: "set",
        collection: "owner_logs",
        docId: `${Date.now()}_suspend_${caretakerId}`,
        data: {
          companyId,
          performedBy: managerId,
          performedByRole: "manager",
          action: "caretaker_suspended",
          targetType: "user",
          targetId: caretakerId,
          details: {
            reason: suspendReason.trim(),
            ...(selectedCaretaker.isAssigned && { previousTurfId: turfId }),
          },
          timestamp: serverTimestamp(),
        },
      });

      await batchWrite(batchOperations);

      setCaretakers((prev) =>
        prev.map((c) =>
          (c.id || c.userId) === caretakerId
            ? {
                ...c,
                isSuspended: true,
                suspendedAt: new Date(),
                suspensionReason: suspendReason.trim(),
                isAssigned: false,
                assignedTurfId: null,
              }
            : c
        )
      );

      if (selectedCaretaker.isAssigned && turfId) {
        setAllTurfs((prev) =>
          prev.map((t) => {
            const currentTurfId = t.turfId || t.id;
            if (currentTurfId === turfId) {
              return {
                ...t,
                caretakerIds: (t.caretakerIds || []).filter((id) => id !== caretakerId),
              };
            }
            return t;
          })
        );
      }

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
            performedBy: managerId,
            performedByRole: "manager",
            action: "caretaker_reinstated",
            targetType: "user",
            targetId: caretakerId,
            details: {},
            timestamp: serverTimestamp(),
          },
        },
      ];

      await batchWrite(batchOperations);

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

  // ── Card Component ─────────────────────────────────────────────────────────

  const CaretakerCard = ({ caretaker, showActions = true }) => {
    const statusColor = caretaker.isSuspended
      ? DANGER_COLOR
      : caretaker.isAssigned
      ? SUCCESS_COLOR
      : CARETAKER_COLOR;

    const statusLabel = caretaker.isSuspended
      ? "Suspended"
      : caretaker.isAssigned
      ? "Active"
      : "Unassigned";

    const statusBg = caretaker.isSuspended
      ? "#FFEBEE"
      : caretaker.isAssigned
      ? "#E8F5E9"
      : "#FFF3E0";

    return (
      <Surface style={styles.card} elevation={1}>
        <View style={styles.cardHeader}>
          <View style={[styles.avatarRing, { borderColor: statusColor + "60" }]}>
            {caretaker.profilePicture ? (
              <Avatar.Image size={44} source={{ uri: caretaker.profilePicture }} />
            ) : (
              <Avatar.Text
                size={44}
                label={caretaker.name?.substring(0, 2).toUpperCase() || "?"}
                style={{ backgroundColor: CARETAKER_COLOR }}
              />
            )}
            {caretaker.isSuspended && (
              <Badge style={styles.suspendedBadge} size={14}>!</Badge>
            )}
          </View>

          <View style={styles.personInfo}>
            <Text style={styles.personName}>{caretaker.name || "Unknown"}</Text>
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="phone-outline" size={11} color="#BDBDBD" />
              <Text style={styles.phoneText}>{caretaker.phone}</Text>
            </View>
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="clock-outline" size={11} color="#BDBDBD" />
              <Text style={styles.dateText}>
                {caretaker.isAssigned
                  ? `Assigned ${getRelativeTime(caretaker.assignedAt)}`
                  : `Joined ${getRelativeTime(caretaker.createdAt || caretaker.joinedAt)}`}
              </Text>
            </View>
          </View>

          <View style={[styles.statusPill, { backgroundColor: statusBg }]}>
            <Text style={[styles.statusPillText, { color: statusColor }]}>
              {statusLabel}
            </Text>
          </View>
        </View>

        {showActions && (
          <>
            <View style={styles.cardDivider} />
            <View style={styles.actionRow}>
              {caretaker.isSuspended ? (
                <ActionChip
                  icon="account-reactivate"
                  label="Reinstate"
                  color={SUCCESS_COLOR}
                  filled
                  onPress={() => handleReinstate(caretaker)}
                />
              ) : caretaker.isAssigned ? (
                <>
                  <ActionChip
                    icon="swap-horizontal"
                    label="Reassign"
                    color={MANAGER_COLOR}
                    onPress={() => handleReassign(caretaker)}
                  />
                  <ActionChip
                    icon="link-off"
                    label="Unassign"
                    color="#757575"
                    onPress={() => handleUnassign(caretaker)}
                  />
                  <ActionChip
                    icon="account-cancel"
                    label="Suspend"
                    color={DANGER_COLOR}
                    onPress={() => handleSuspend(caretaker)}
                  />
                </>
              ) : (
                <>
                  <ActionChip
                    icon="account-plus"
                    label="Assign to Turf"
                    color={CARETAKER_COLOR}
                    filled
                    onPress={() => handleAssign(caretaker)}
                  />
                  <ActionChip
                    icon="account-cancel"
                    label="Suspend"
                    color={DANGER_COLOR}
                    onPress={() => handleSuspend(caretaker)}
                  />
                </>
              )}
            </View>
          </>
        )}
      </Surface>
    );
  };

  // ── Empty States ───────────────────────────────────────────────────────────

  const FullEmptyState = () => (
    <View style={styles.emptyContainer}>
      {loadingCaretakers ? (
        <>
          <ActivityIndicator animating color={MANAGER_COLOR} size="large" />
          <Text style={styles.emptyText}>Loading caretakers…</Text>
        </>
      ) : (
        <>
          <View style={styles.emptyIconCircle}>
            <MaterialCommunityIcons name="account-hard-hat" size={48} color={CARETAKER_COLOR} />
          </View>
          <Text style={styles.emptyTitle}>No Caretakers Yet</Text>
          <Text style={styles.emptyText}>
            Caretakers will appear here once they join your company using the invite code.
          </Text>
        </>
      )}
    </View>
  );

  const SectionEmpty = ({ icon, color, text }) => (
    <View style={styles.sectionEmptyContainer}>
      <MaterialCommunityIcons name={icon} size={32} color={color + "60"} />
      <Text style={styles.sectionEmptyText}>{text}</Text>
    </View>
  );

  // ── Modals ─────────────────────────────────────────────────────────────────

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
              Select Turf (Your Assigned Turfs)
            </Text>

            {turfs.length === 0 ? (
              <View style={styles.noTurfsContainer}>
                <MaterialCommunityIcons name="soccer-field" size={40} color="#ccc" />
                <Text variant="bodyMedium" style={styles.noTurfsText}>
                  You don't have any assigned turfs.
                </Text>
              </View>
            ) : (
              <ScrollView style={styles.turfSelectList} keyboardShouldPersistTaps="handled">
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
                        size={22}
                        color={isSelected ? MANAGER_COLOR : "#BDBDBD"}
                      />
                      <View style={styles.turfSelectInfo}>
                        <Text variant="bodyMedium" style={isSelected && { fontWeight: "600", color: MANAGER_COLOR }}>
                          {turf.name}
                        </Text>
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
            )}

            <View style={styles.noteContainer}>
              <MaterialCommunityIcons name="information-outline" size={15} color={MANAGER_COLOR} />
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
              disabled={assigning || !selectedTurfId || turfs.length === 0}
            >
              {isReassign ? "Reassign" : "Assign"}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    );
  };

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
              textColor={DANGER_COLOR}
            >
              Unassign
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    );
  };

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
              textColor={DANGER_COLOR}
            >
              Suspend
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    );
  };

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
              textColor={SUCCESS_COLOR}
            >
              Reinstate
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialCommunityIcons name="arrow-left" size={22} color="#212121" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Caretaker Management</Text>
          <Text style={styles.headerSubtitle}>
            {unassignedCaretakers.length + assignedCaretakers.length} active
            {suspendedCaretakers.length > 0
              ? ` · ${suspendedCaretakers.length} suspended`
              : ""}
          </Text>
        </View>
      </View>

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <StatTile
          count={assignedCaretakers.length}
          label="Active"
          color={SUCCESS_COLOR}
          icon="account-check"
        />
        <View style={styles.statsDivider} />
        <StatTile
          count={unassignedCaretakers.length}
          label="Unassigned"
          color={CARETAKER_COLOR}
          icon="clock-outline"
        />
        <View style={styles.statsDivider} />
        <StatTile
          count={suspendedCaretakers.length}
          label="Suspended"
          color={DANGER_COLOR}
          icon="account-cancel"
        />
      </View>

      {caretakers.length === 0 && !loadingCaretakers ? (
        <FullEmptyState />
      ) : loadingCaretakers ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator animating color={MANAGER_COLOR} size="large" />
          <Text style={styles.loadingText}>Loading caretakers…</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[MANAGER_COLOR]}
            />
          }
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Unassigned Section ── */}
          <SectionHeader
            title="Waiting for Assignment"
            count={unassignedCaretakers.length}
            icon="clock-outline"
            color={CARETAKER_COLOR}
            expanded={unassignedExpanded}
            onToggle={() => setUnassignedExpanded((v) => !v)}
          />
          {unassignedExpanded && (
            <View style={styles.sectionContent}>
              {unassignedCaretakers.length > 0 ? (
                unassignedCaretakers.map((caretaker) => (
                  <CaretakerCard
                    key={caretaker.id || caretaker.userId}
                    caretaker={caretaker}
                  />
                ))
              ) : (
                <SectionEmpty
                  icon="account-check"
                  color={SUCCESS_COLOR}
                  text="No caretakers waiting for assignment"
                />
              )}
            </View>
          )}

          <View style={styles.sectionSeparator} />

          {/* ── Assigned by Turf Section ── */}
          <SectionHeader
            title="My Turfs' Caretakers"
            count={assignedCaretakers.length}
            icon="account-check"
            color={SUCCESS_COLOR}
            expanded={assignedExpanded}
            onToggle={() => setAssignedExpanded((v) => !v)}
          />
          {assignedExpanded && (
            <View style={styles.sectionContent}>
              {assignedCaretakers.length === 0 ? (
                <SectionEmpty
                  icon="account-question"
                  color="#9E9E9E"
                  text="No caretakers assigned to your turfs yet"
                />
              ) : (
                Object.entries(caretakersByTurf).map(([turfId, { turf, caretakers: turfCaretakers }]) => {
                  if (turfCaretakers.length === 0) return null;
                  const isExpanded = expandedTurfs[turfId];

                  return (
                    <View key={turfId} style={styles.turfGroup}>
                      <TouchableOpacity
                        style={styles.turfGroupHeader}
                        onPress={() => toggleTurfExpanded(turfId)}
                        activeOpacity={0.8}
                      >
                        <View style={styles.turfGroupIconWrap}>
                          <MaterialCommunityIcons
                            name="soccer-field"
                            size={16}
                            color={MANAGER_COLOR}
                          />
                        </View>
                        <Text style={styles.turfGroupTitle}>{turf.name}</Text>
                        <View style={styles.turfGroupBadge}>
                          <Text style={styles.turfGroupBadgeText}>
                            {turfCaretakers.length}
                          </Text>
                        </View>
                        <MaterialCommunityIcons
                          name={isExpanded ? "chevron-up" : "chevron-down"}
                          size={18}
                          color="#9E9E9E"
                        />
                      </TouchableOpacity>
                      {isExpanded && (
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
                })
              )}
            </View>
          )}

          {/* ── Suspended Section ── */}
          {suspendedCaretakers.length > 0 && (
            <>
              <View style={styles.sectionSeparator} />
              <SectionHeader
                title="Suspended"
                count={suspendedCaretakers.length}
                icon="account-cancel"
                color={DANGER_COLOR}
                expanded={suspendedExpanded}
                onToggle={() => setSuspendedExpanded((v) => !v)}
              />
              {suspendedExpanded && (
                <View style={styles.sectionContent}>
                  {suspendedCaretakers.map((caretaker) => (
                    <CaretakerCard
                      key={caretaker.id || caretaker.userId}
                      caretaker={caretaker}
                    />
                  ))}
                </View>
              )}
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

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F0F4F8",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EBEBEB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 3,
    gap: 4,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F5F5F5",
    justifyContent: "center",
    alignItems: "center",
  },
  headerCenter: {
    flex: 1,
    marginLeft: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#212121",
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#9E9E9E",
    marginTop: 1,
  },

  // Stats Bar
  statsBar: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#EBEBEB",
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  statTile: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  statIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  statCount: {
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 24,
  },
  statLabel: {
    fontSize: 11,
    color: "#9E9E9E",
    fontWeight: "500",
  },
  statsDivider: {
    width: 1,
    backgroundColor: "#EBEBEB",
    marginVertical: 4,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: "#9E9E9E",
  },

  // Scroll
  scrollContent: {
    flex: 1,
  },

  // Section Headers
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  sectionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  sectionHeaderTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#212121",
  },
  sectionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    minWidth: 26,
    alignItems: "center",
  },
  sectionBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },

  // Section separator
  sectionSeparator: {
    height: 8,
    backgroundColor: "#F0F4F8",
  },

  // Section Content
  sectionContent: {
    paddingHorizontal: 12,
    paddingBottom: 4,
    backgroundColor: "#F0F4F8",
  },

  // Caretaker Card
  card: {
    borderRadius: 12,
    backgroundColor: "#fff",
    marginTop: 10,
    padding: 14,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarRing: {
    borderRadius: 26,
    borderWidth: 2,
    padding: 1,
    position: "relative",
  },
  suspendedBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    backgroundColor: DANGER_COLOR,
  },
  personInfo: {
    flex: 1,
    gap: 3,
  },
  personName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#212121",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  phoneText: {
    fontSize: 12,
    color: "#757575",
  },
  dateText: {
    fontSize: 11,
    color: "#BDBDBD",
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "600",
  },
  cardDivider: {
    height: 1,
    backgroundColor: "#F5F5F5",
    marginTop: 12,
    marginBottom: 10,
    marginHorizontal: -14,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },

  // Action Chip
  actionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  actionChipText: {
    fontSize: 12,
    fontWeight: "600",
  },

  // Turf Group
  turfGroup: {
    marginTop: 10,
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
  },
  turfGroupHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    paddingHorizontal: 14,
    gap: 10,
    backgroundColor: "#fff",
  },
  turfGroupIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: MANAGER_COLOR + "18",
    justifyContent: "center",
    alignItems: "center",
  },
  turfGroupTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: "#212121",
  },
  turfGroupBadge: {
    backgroundColor: MANAGER_COLOR + "18",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  turfGroupBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: MANAGER_COLOR,
  },
  turfGroupContent: {
    paddingHorizontal: 8,
    paddingBottom: 10,
    paddingTop: 2,
    backgroundColor: "#F8F9FB",
    borderTopWidth: 1,
    borderTopColor: "#F0F4F8",
  },

  // Empty States
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    paddingBottom: 60,
    gap: 12,
  },
  emptyIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: CARETAKER_COLOR + "18",
    justifyContent: "center",
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#212121",
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14,
    color: "#9E9E9E",
    textAlign: "center",
    lineHeight: 22,
  },
  sectionEmptyContainer: {
    alignItems: "center",
    paddingVertical: 28,
    gap: 8,
  },
  sectionEmptyText: {
    fontSize: 13,
    color: "#9E9E9E",
    textAlign: "center",
  },

  // Modal
  dialog: {
    maxHeight: "80%",
  },
  modalCaretakerInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
  },
  modalCaretakerDetails: {
    flex: 1,
  },
  modalDivider: {
    marginBottom: 16,
  },
  selectTurfLabel: {
    fontWeight: "600",
    marginBottom: 12,
    color: "#212121",
  },
  turfSelectList: {
    maxHeight: 200,
  },
  turfSelectItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 4,
    gap: 10,
  },
  turfSelectItemSelected: {
    backgroundColor: "#E3F2FD",
  },
  turfSelectInfo: {
    flex: 1,
  },
  turfLocation: {
    color: "#BDBDBD",
    marginTop: 2,
    fontSize: 12,
  },
  noteContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E3F2FD",
    padding: 10,
    borderRadius: 8,
    marginTop: 14,
    gap: 8,
  },
  noteText: {
    color: MANAGER_COLOR,
    flex: 1,
    fontSize: 12,
  },
  noTurfsContainer: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 8,
  },
  noTurfsText: {
    color: "#9E9E9E",
    fontSize: 13,
  },
  warningBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFF3E0",
    padding: 12,
    borderRadius: 8,
    marginTop: 14,
    gap: 8,
  },
  warningText: {
    color: "#E65100",
    flex: 1,
    lineHeight: 18,
  },
  reasonInput: {
    marginTop: 14,
  },
  previousReasonContainer: {
    backgroundColor: "#FFF3E0",
    padding: 12,
    borderRadius: 8,
    marginTop: 14,
  },
  previousReasonLabel: {
    color: "#E65100",
    fontWeight: "600",
    marginBottom: 4,
  },
  previousReason: {
    color: "#757575",
  },
  bottomPadding: {
    height: 32,
  },
});
