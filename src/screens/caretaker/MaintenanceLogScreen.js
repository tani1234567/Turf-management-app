import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  TextInput as RNTextInput,
} from "react-native";
import {
  Text,
  Surface,
  TextInput,
  Button,
  Menu,
  ActivityIndicator,
  IconButton,
  Portal,
  Dialog,
  RadioButton,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSelector } from "react-redux";
import * as ImagePicker from "expo-image-picker";
import {
  selectUser,
  selectAssignedTurfId,
} from "../../store/slices/authSlice";
import {
  addDocument,
  getDocument,
  subscribeToCollection,
  updateDocument,
} from "../../services/firebase/firestore";

// ─── Constants ────────────────────────────────────────────────────────────────

const CARETAKER_ORANGE = "#F97316";
const PALE_ORANGE      = "#FFF7ED";
const NAVY_ORANGE      = "#7C2D12";
const SUCCESS_GREEN    = "#22C55E";
const DANGER_RED       = "#EF4444";

const ISSUE_TYPES = [
  { id: "lighting",         label: "Lighting",         icon: "lightbulb-outline",    color: "#F59E0B" },
  { id: "ground_condition", label: "Ground Condition",  icon: "grass",                color: "#4CAF50" },
  { id: "equipment",        label: "Equipment",         icon: "tools",                color: "#2196F3" },
  { id: "safety",           label: "Safety",            icon: "shield-alert-outline", color: "#F44336" },
  { id: "other",            label: "Other",             icon: "help-circle-outline",  color: "#9E9E9E" },
];

const PRIORITY_LEVELS = [
  { value: "low",    label: "Low",    color: "#4CAF50", icon: "arrow-down"    },
  { value: "medium", label: "Medium", color: "#FF9800", icon: "minus"         },
  { value: "high",   label: "High",   color: "#F44336", icon: "arrow-up-bold" },
];

const STATUS_CONFIG = {
  pending:     { label: "Pending",     color: "#F59E0B", bg: "#FFFBEB", icon: "clock-outline"   },
  in_progress: { label: "In Progress", color: "#2196F3", bg: "#EFF6FF", icon: "progress-wrench" },
  resolved:    { label: "Resolved",    color: "#4CAF50", bg: "#F0FDF4", icon: "check-circle"    },
  rejected:    { label: "Rejected",    color: "#F44336", bg: "#FEF2F2", icon: "close-circle"    },
};

// Status updates the caretaker can initiate
const CARETAKER_STATUS_OPTIONS = [
  { value: "in_progress", label: "Mark as In Progress", icon: "progress-wrench", color: "#2196F3", desc: "I've started working on this issue" },
  { value: "resolved",    label: "Mark as Resolved",    icon: "check-circle",    color: "#4CAF50", desc: "I've fixed this issue myself"     },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (ts) => {
  if (!ts) return "N/A";
  const d = ts?.toDate?.() || new Date(ts);
  return d.toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MaintenanceLogScreen({ navigation }) {
  const user           = useSelector(selectUser);
  const assignedTurfId = useSelector(selectAssignedTurfId);

  const [activeTab, setActiveTab] = useState("report");

  // ── Form state ──────────────────────────────────────────────────────────
  const [selectedGround,   setSelectedGround]   = useState(null);
  const [issueType,        setIssueType]        = useState(null);
  const [description,      setDescription]      = useState("");
  const [priority,         setPriority]         = useState("medium");
  const [photos,           setPhotos]           = useState([]);
  const [submitting,       setSubmitting]       = useState(false);

  const [grounds,          setGrounds]          = useState([]);
  const [groundMenuVisible,setGroundMenuVisible]= useState(false);
  const [loadingGrounds,   setLoadingGrounds]   = useState(true);

  // ── My Reports state ────────────────────────────────────────────────────
  const [myReports,        setMyReports]        = useState([]);
  const [loadingReports,   setLoadingReports]   = useState(true);
  const [refreshing,       setRefreshing]       = useState(false);

  // ── Status update dialog ────────────────────────────────────────────────
  const [updateDialog,     setUpdateDialog]     = useState(null); // report object
  const [updateStatus,     setUpdateStatus]     = useState("in_progress");
  const [updateNotes,      setUpdateNotes]      = useState("");
  const [updateLoading,    setUpdateLoading]    = useState(false);

  // ── Detail expand ───────────────────────────────────────────────────────
  const [expandedId,       setExpandedId]       = useState(null);

  // ── Turf info ───────────────────────────────────────────────────────────
  const [turfName,         setTurfName]         = useState("");
  const [managerId,        setManagerId]        = useState(null);

  // ── Fetch turf data ─────────────────────────────────────────────────────
  useEffect(() => {
    const turfId = assignedTurfId || user?.assignedTurfId;
    if (!turfId) { setLoadingGrounds(false); return; }

    getDocument("turfs", turfId)
      .then((turf) => {
        if (turf) {
          setTurfName(turf.name || "");
          setGrounds(turf.grounds || []);
          if (turf.managerIds?.length > 0) setManagerId(turf.managerIds[0]);
        }
      })
      .catch(console.error)
      .finally(() => setLoadingGrounds(false));
  }, [assignedTurfId, user?.assignedTurfId]);

  // ── Subscribe to my reports ─────────────────────────────────────────────
  useEffect(() => {
    const turfId      = assignedTurfId || user?.assignedTurfId;
    const caretakerId = user?.userId || user?.uid;
    if (!turfId || !caretakerId) { setLoadingReports(false); return; }

    const unsub = subscribeToCollection(
      "maintenance_logs",
      (logs) => {
        const sorted = [...logs].sort((a, b) => {
          const da = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
          const db = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
          return db - da;
        });
        setMyReports(sorted);
        setLoadingReports(false);
        setRefreshing(false);
      },
      [
        { field: "turfId",      operator: "==", value: turfId      },
        { field: "reportedBy",  operator: "==", value: caretakerId },
      ]
    );

    return () => unsub?.();
  }, [assignedTurfId, user?.assignedTurfId, user?.userId, user?.uid]);

  const onRefresh = useCallback(() => setRefreshing(true), []);

  // ── Photo pickers ───────────────────────────────────────────────────────
  const pickImage = async () => {
    if (photos.length >= 5) { Alert.alert("Limit Reached", "You can only upload up to 5 photos."); return; }
    const p = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!p.granted) { Alert.alert("Permission Required", "Please allow access to your photo library."); return; }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [4, 3], quality: 0.7 });
    if (!r.canceled) setPhotos([...photos, r.assets[0].uri]);
  };

  const takePhoto = async () => {
    if (photos.length >= 5) { Alert.alert("Limit Reached", "You can only upload up to 5 photos."); return; }
    const p = await ImagePicker.requestCameraPermissionsAsync();
    if (!p.granted) { Alert.alert("Permission Required", "Please allow access to your camera."); return; }
    const r = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [4, 3], quality: 0.7 });
    if (!r.canceled) setPhotos([...photos, r.assets[0].uri]);
  };

  const removePhoto = (i) => setPhotos(photos.filter((_, idx) => idx !== i));

  // ── Form validation & submit ────────────────────────────────────────────
  const validateForm = () => {
    if (!selectedGround) { Alert.alert("Required", "Please select a ground."); return false; }
    if (!issueType)      { Alert.alert("Required", "Please select an issue type."); return false; }
    if (!description.trim() || description.trim().length < 10) {
      Alert.alert("Required", "Please provide a description of at least 10 characters.");
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    const turfId = assignedTurfId || user?.assignedTurfId;
    if (!turfId) { Alert.alert("Error", "No turf assigned. Please contact your manager."); return; }

    Alert.alert("Submit Report", "Are you sure you want to submit this maintenance report?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Submit",
        onPress: async () => {
          setSubmitting(true);
          try {
            const issueInfo    = ISSUE_TYPES.find((t) => t.id === issueType);
            const priorityInfo = PRIORITY_LEVELS.find((p) => p.value === priority);

            const logId = await addDocument("maintenance_logs", {
              turfId,
              turfName,
              groundId:       selectedGround.groundId || selectedGround.id,
              groundName:     selectedGround.name,
              issueType,
              issueTypeLabel: issueInfo?.label || issueType,
              description:    description.trim(),
              priority,
              priorityLabel:  priorityInfo?.label || priority,
              photos,
              status:         "pending",
              reportedBy:     user?.userId || user?.uid,
              reportedByName: user?.name || "Caretaker",
              reportedByPhone:user?.phone || null,
              resolvedBy:     null,
              resolvedByName: null,
              resolvedAt:     null,
              resolutionNotes:null,
            });

            if (managerId) {
              await addDocument("notifications", {
                userId:      managerId,
                type:        "maintenance_report",
                title:       "New Maintenance Report",
                body:        `${user?.name || "Caretaker"} reported a ${priorityInfo?.label || priority} priority ${issueInfo?.label || issueType} issue at ${selectedGround.name}.`,
                relatedId:   logId,
                relatedType: "maintenance_log",
                turfId,
                turfName,
                isRead:      false,
              });
            }

            setSelectedGround(null);
            setIssueType(null);
            setDescription("");
            setPriority("medium");
            setPhotos([]);

            Alert.alert(
              "Report Submitted",
              "Your maintenance report has been submitted. The manager will be notified.",
              [
                { text: "View My Reports", onPress: () => setActiveTab("my_reports") },
                { text: "OK" },
              ]
            );
          } catch (err) {
            console.error("[MaintenanceLog] submit error:", err);
            Alert.alert("Error", "Failed to submit report. Please try again.");
          } finally {
            setSubmitting(false);
          }
        },
      },
    ]);
  };

  // ── Status update ───────────────────────────────────────────────────────
  const openUpdateDialog = (report) => {
    const defaultStatus = report.status === "pending" ? "in_progress" : "resolved";
    setUpdateStatus(defaultStatus);
    setUpdateNotes("");
    setUpdateDialog(report);
  };

  const handleStatusUpdate = async () => {
    if (!updateDialog) return;
    setUpdateLoading(true);
    try {
      const userId = user?.userId || user?.uid;
      const updates = { status: updateStatus };

      if (updateStatus === "resolved") {
        updates.resolvedBy     = userId;
        updates.resolvedByName = user?.name || "Caretaker";
        updates.resolvedAt     = new Date().toISOString();
        updates.resolutionNotes = updateNotes.trim() || null;
        updates.selfResolved   = true;
      }
      if (updateNotes.trim() && updateStatus === "in_progress") {
        updates.caretakerNotes = updateNotes.trim();
      }

      await updateDocument("maintenance_logs", updateDialog.id, updates);
      setUpdateDialog(null);
    } catch (err) {
      console.error("[MaintenanceLog] status update error:", err);
      Alert.alert("Error", "Failed to update status. Please try again.");
    } finally {
      setUpdateLoading(false);
    }
  };

  // ── Render: Report Form ─────────────────────────────────────────────────
  const renderReportForm = () => (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Turf banner */}
      <Surface style={styles.turfBanner} elevation={1}>
        <View style={styles.turfBannerIcon}>
          <MaterialCommunityIcons name="soccer-field" size={22} color={SUCCESS_GREEN} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.turfBannerLabel}>Reporting for</Text>
          <Text style={styles.turfBannerName}>{turfName || "Loading…"}</Text>
        </View>
      </Surface>

      {/* Ground */}
      <Surface style={styles.section} elevation={1}>
        <Text style={styles.sectionTitle}>Select Ground *</Text>
        <Menu
          visible={groundMenuVisible}
          onDismiss={() => setGroundMenuVisible(false)}
          anchor={
            <TouchableOpacity
              style={styles.dropdownBtn}
              onPress={() => setGroundMenuVisible(true)}
            >
              <View style={styles.dropdownContent}>
                <MaterialCommunityIcons name="soccer-field" size={18} color={selectedGround ? CARETAKER_ORANGE : "#9CA3AF"} />
                <Text style={[styles.dropdownText, !selectedGround && styles.dropdownPlaceholder]}>
                  {selectedGround?.name || "Select a ground"}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-down" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          }
        >
          {loadingGrounds ? (
            <Menu.Item title="Loading…" disabled />
          ) : grounds.length === 0 ? (
            <Menu.Item title="No grounds available" disabled />
          ) : (
            grounds.map((g) => (
              <Menu.Item
                key={g.groundId || g.id}
                onPress={() => { setSelectedGround(g); setGroundMenuVisible(false); }}
                title={g.name}
                leadingIcon="soccer-field"
              />
            ))
          )}
        </Menu>
      </Surface>

      {/* Issue Type */}
      <Surface style={styles.section} elevation={1}>
        <Text style={styles.sectionTitle}>Issue Type *</Text>
        <View style={styles.issueGrid}>
          {ISSUE_TYPES.map((type) => (
            <TouchableOpacity
              key={type.id}
              style={[
                styles.issueCard,
                issueType === type.id && { borderColor: type.color, backgroundColor: type.color + "10" },
              ]}
              onPress={() => setIssueType(type.id)}
            >
              <View style={[styles.issueIconWrap, { backgroundColor: (issueType === type.id ? type.color : "#9CA3AF") + "20" }]}>
                <MaterialCommunityIcons
                  name={type.icon}
                  size={22}
                  color={issueType === type.id ? type.color : "#9CA3AF"}
                />
              </View>
              <Text style={[styles.issueLabel, issueType === type.id && { color: type.color, fontFamily: "Ubuntu-Bold" }]}>
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Surface>

      {/* Description */}
      <Surface style={styles.section} elevation={1}>
        <Text style={styles.sectionTitle}>Description *</Text>
        <TextInput
          mode="outlined"
          placeholder="Describe the issue in detail…"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          style={styles.textArea}
          outlineColor="#E5E7EB"
          activeOutlineColor={CARETAKER_ORANGE}
        />
        <Text style={styles.charHint}>{description.length} characters (min 10)</Text>
      </Surface>

      {/* Priority */}
      <Surface style={styles.section} elevation={1}>
        <Text style={styles.sectionTitle}>Priority Level</Text>
        <View style={styles.priorityRow}>
          {PRIORITY_LEVELS.map((lv) => (
            <TouchableOpacity
              key={lv.value}
              style={[
                styles.priorityBtn,
                priority === lv.value && { borderColor: lv.color, backgroundColor: lv.color + "14" },
              ]}
              onPress={() => setPriority(lv.value)}
            >
              <MaterialCommunityIcons name={lv.icon} size={18} color={priority === lv.value ? lv.color : "#9CA3AF"} />
              <Text style={[styles.priorityLabel, priority === lv.value && { color: lv.color, fontFamily: "Ubuntu-Bold" }]}>
                {lv.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Surface>

      {/* Photos */}
      <Surface style={styles.section} elevation={1}>
        <Text style={styles.sectionTitle}>Photos ({photos.length}/5)</Text>
        <Text style={styles.photoHint}>Add photos to illustrate the issue</Text>
        <View style={styles.photoGrid}>
          {photos.map((uri, i) => (
            <View key={i} style={styles.photoWrap}>
              <Image source={{ uri }} style={styles.photoPreview} />
              <IconButton
                icon="close-circle"
                size={18}
                style={styles.photoRemoveBtn}
                iconColor={DANGER_RED}
                containerColor="#fff"
                onPress={() => removePhoto(i)}
              />
            </View>
          ))}
          {photos.length < 5 && (
            <View style={styles.photoAddRow}>
              <TouchableOpacity style={styles.photoAddBtn} onPress={pickImage}>
                <MaterialCommunityIcons name="image-plus" size={26} color="#9CA3AF" />
                <Text style={styles.photoAddText}>Gallery</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.photoAddBtn} onPress={takePhoto}>
                <MaterialCommunityIcons name="camera-plus" size={26} color="#9CA3AF" />
                <Text style={styles.photoAddText}>Camera</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Surface>

      <TouchableOpacity
        style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
        onPress={handleSubmit}
        disabled={submitting}
        activeOpacity={0.85}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <>
            <MaterialCommunityIcons name="send" size={18} color="#fff" />
            <Text style={styles.submitBtnText}>Submit Report</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );

  // ── Render: My Reports ──────────────────────────────────────────────────
  const renderMyReports = () => (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[CARETAKER_ORANGE]} />
      }
    >
      {loadingReports ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={CARETAKER_ORANGE} />
          <Text style={styles.loadingText}>Loading reports…</Text>
        </View>
      ) : myReports.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyCircle}>
            <MaterialCommunityIcons name="clipboard-text-outline" size={36} color={CARETAKER_ORANGE} />
          </View>
          <Text style={styles.emptyTitle}>No Reports Yet</Text>
          <Text style={styles.emptySub}>You haven't submitted any maintenance reports.</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => setActiveTab("report")}>
            <MaterialCommunityIcons name="plus" size={16} color="#fff" />
            <Text style={styles.emptyBtnText}>Report an Issue</Text>
          </TouchableOpacity>
        </View>
      ) : (
        myReports.map((report) => {
          const statusInfo   = STATUS_CONFIG[report.status] || STATUS_CONFIG.pending;
          const issueInfo    = ISSUE_TYPES.find((t) => t.id === report.issueType);
          const priorityInfo = PRIORITY_LEVELS.find((p) => p.value === report.priority);
          const isTerminal   = report.status === "resolved" || report.status === "rejected";
          const isExpanded   = expandedId === report.id;
          const canUpdate    = !isTerminal;

          return (
            <View key={report.id} style={styles.reportCard}>
              {/* Status stripe */}
              <View style={[styles.reportStripe, { backgroundColor: statusInfo.color }]} />

              <View style={styles.reportBody}>
                {/* Top row */}
                <TouchableOpacity
                  style={styles.reportTop}
                  onPress={() => setExpandedId(isExpanded ? null : report.id)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.reportIssueIcon, { backgroundColor: (issueInfo?.color || "#9E9E9E") + "18" }]}>
                    <MaterialCommunityIcons
                      name={issueInfo?.icon || "help-circle-outline"}
                      size={20}
                      color={issueInfo?.color || "#9E9E9E"}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reportIssueName}>
                      {report.issueTypeLabel || issueInfo?.label || report.issueType}
                    </Text>
                    <Text style={styles.reportGroundName}>{report.groundName}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
                      <MaterialCommunityIcons name={statusInfo.icon} size={12} color={statusInfo.color} />
                      <Text style={[styles.statusLabel, { color: statusInfo.color }]}>{statusInfo.label}</Text>
                    </View>
                    <MaterialCommunityIcons
                      name={isExpanded ? "chevron-up" : "chevron-down"}
                      size={16}
                      color="#9CA3AF"
                    />
                  </View>
                </TouchableOpacity>

                {/* Priority + Date row */}
                <View style={styles.reportMeta}>
                  <View style={[styles.priorityChip, { backgroundColor: (priorityInfo?.color || "#FF9800") + "15" }]}>
                    <MaterialCommunityIcons name={priorityInfo?.icon || "minus"} size={12} color={priorityInfo?.color || "#FF9800"} />
                    <Text style={[styles.priorityChipText, { color: priorityInfo?.color || "#FF9800" }]}>
                      {report.priorityLabel || report.priority} Priority
                    </Text>
                  </View>
                  <Text style={styles.reportDate}>{formatDate(report.createdAt)}</Text>
                </View>

                {/* Expanded content */}
                {isExpanded && (
                  <View style={styles.expandedContent}>
                    {/* Description */}
                    <Text style={styles.expandedDesc}>{report.description}</Text>

                    {/* Photos */}
                    {report.photos?.length > 0 && (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                        <View style={{ flexDirection: "row", gap: 8 }}>
                          {report.photos.map((uri, i) => (
                            <Image key={i} source={{ uri }} style={styles.reportPhoto} />
                          ))}
                        </View>
                      </ScrollView>
                    )}

                    {/* Resolution / rejection feedback from manager */}
                    {report.status === "resolved" && (report.resolutionNotes || report.resolvedByName) && (
                      <View style={styles.feedbackBox}>
                        <View style={styles.feedbackHeader}>
                          <MaterialCommunityIcons name="check-circle-outline" size={14} color="#059669" />
                          <Text style={styles.feedbackHeaderText}>
                            {report.selfResolved ? "Resolved by you" : `Resolved by ${report.resolvedByName}`}
                          </Text>
                        </View>
                        {report.resolutionNotes ? (
                          <Text style={styles.feedbackNote}>{report.resolutionNotes}</Text>
                        ) : null}
                      </View>
                    )}

                    {report.status === "rejected" && report.rejectionReason && (
                      <View style={[styles.feedbackBox, { backgroundColor: "#FEF2F2" }]}>
                        <View style={styles.feedbackHeader}>
                          <MaterialCommunityIcons name="close-circle-outline" size={14} color="#DC2626" />
                          <Text style={[styles.feedbackHeaderText, { color: "#DC2626" }]}>
                            Rejected by {report.rejectedByName || "Manager"}
                          </Text>
                        </View>
                        <Text style={styles.feedbackNote}>{report.rejectionReason}</Text>
                      </View>
                    )}

                    {/* Caretaker notes */}
                    {report.caretakerNotes && (
                      <View style={[styles.feedbackBox, { backgroundColor: PALE_ORANGE }]}>
                        <View style={styles.feedbackHeader}>
                          <MaterialCommunityIcons name="note-outline" size={14} color={CARETAKER_ORANGE} />
                          <Text style={[styles.feedbackHeaderText, { color: CARETAKER_ORANGE }]}>Your notes</Text>
                        </View>
                        <Text style={styles.feedbackNote}>{report.caretakerNotes}</Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Update status button */}
                {canUpdate && (
                  <TouchableOpacity
                    style={styles.updateBtn}
                    onPress={() => openUpdateDialog(report)}
                  >
                    <MaterialCommunityIcons name="update" size={14} color={CARETAKER_ORANGE} />
                    <Text style={styles.updateBtnText}>Update Status</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );

  // ── Main render ──────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton
          icon="arrow-left"
          size={22}
          onPress={() => navigation.goBack()}
          style={styles.headerBack}
          iconColor="#374151"
        />
        <Text style={styles.headerTitle}>Maintenance Log</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "report" && styles.tabActive]}
          onPress={() => setActiveTab("report")}
        >
          <MaterialCommunityIcons
            name="plus-circle-outline"
            size={16}
            color={activeTab === "report" ? CARETAKER_ORANGE : "#9CA3AF"}
          />
          <Text style={[styles.tabLabel, activeTab === "report" && styles.tabLabelActive]}>Report Issue</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "my_reports" && styles.tabActive]}
          onPress={() => setActiveTab("my_reports")}
        >
          <MaterialCommunityIcons
            name="clipboard-list-outline"
            size={16}
            color={activeTab === "my_reports" ? CARETAKER_ORANGE : "#9CA3AF"}
          />
          <Text style={[styles.tabLabel, activeTab === "my_reports" && styles.tabLabelActive]}>My Reports</Text>
          {myReports.filter((r) => r.status === "pending").length > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>
                {myReports.filter((r) => r.status === "pending").length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        {activeTab === "report" ? renderReportForm() : renderMyReports()}
      </KeyboardAvoidingView>

      {/* Status Update Dialog */}
      <Portal>
        <Dialog
          visible={!!updateDialog}
          onDismiss={() => !updateLoading && setUpdateDialog(null)}
          style={{ borderRadius: 16 }}
        >
          <Dialog.Title style={{ fontFamily: "Ubuntu-Bold", color: NAVY_ORANGE }}>
            Update Report Status
          </Dialog.Title>
          <Dialog.Content>
            {updateDialog && (
              <View style={styles.updateDialogChip}>
                <MaterialCommunityIcons
                  name={ISSUE_TYPES.find((t) => t.id === updateDialog.issueType)?.icon || "tools"}
                  size={14}
                  color={CARETAKER_ORANGE}
                />
                <Text style={styles.updateDialogChipText} numberOfLines={1}>
                  {updateDialog.issueTypeLabel || updateDialog.issueType} — {updateDialog.groundName}
                </Text>
              </View>
            )}

            <Text style={styles.updateDialogFieldLabel}>New Status</Text>
            <RadioButton.Group onValueChange={setUpdateStatus} value={updateStatus}>
              {CARETAKER_STATUS_OPTIONS
                .filter((opt) => {
                  if (updateDialog?.status === "in_progress") return opt.value === "resolved";
                  return true;
                })
                .map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={styles.updateRadioRow}
                    onPress={() => setUpdateStatus(opt.value)}
                  >
                    <RadioButton value={opt.value} color={opt.color} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.updateRadioLabel, { color: opt.color }]}>{opt.label}</Text>
                      <Text style={styles.updateRadioDesc}>{opt.desc}</Text>
                    </View>
                  </TouchableOpacity>
                ))
              }
            </RadioButton.Group>

            <Text style={[styles.updateDialogFieldLabel, { marginTop: 14 }]}>
              {updateStatus === "resolved" ? "Resolution notes (optional)" : "Notes (optional)"}
            </Text>
            <RNTextInput
              style={styles.updateNotesInput}
              placeholder={
                updateStatus === "resolved"
                  ? "Describe how you fixed the issue…"
                  : "Add any notes for the manager…"
              }
              value={updateNotes}
              onChangeText={setUpdateNotes}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              placeholderTextColor="#9CA3AF"
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setUpdateDialog(null)} disabled={updateLoading}>Cancel</Button>
            <Button
              onPress={handleStatusUpdate}
              loading={updateLoading}
              disabled={updateLoading}
              textColor={CARETAKER_ORANGE}
            >
              Update
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFBEB" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
    paddingRight: 8,
  },
  headerBack:  { margin: 0 },
  headerTitle: { fontFamily: "Ubuntu-Bold", fontSize: 17, color: "#111827" },

  tabBar: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
    paddingHorizontal: 16,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive:      { borderBottomColor: CARETAKER_ORANGE },
  tabLabel:       { fontFamily: "Ubuntu-Medium", fontSize: 13, color: "#9CA3AF" },
  tabLabelActive: { fontFamily: "Ubuntu-Bold", color: CARETAKER_ORANGE },
  tabBadge: {
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: CARETAKER_ORANGE,
    justifyContent: "center", alignItems: "center", paddingHorizontal: 4,
  },
  tabBadgeText: { fontFamily: "Ubuntu-Bold", fontSize: 10, color: "#fff" },

  scrollContent: { padding: 16, paddingBottom: 36, gap: 14 },

  // Turf banner
  turfBanner: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#fff", borderRadius: 14, padding: 14,
  },
  turfBannerIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: "#D1FAE5",
    justifyContent: "center", alignItems: "center",
  },
  turfBannerLabel: { fontFamily: "Ubuntu-Regular", fontSize: 11, color: "#9CA3AF" },
  turfBannerName:  { fontFamily: "Ubuntu-Bold",    fontSize: 15, color: "#111827" },

  // Sections
  section:      { backgroundColor: "#fff", borderRadius: 14, padding: 14 },
  sectionTitle: { fontFamily: "Ubuntu-Bold", fontSize: 14, color: "#374151", marginBottom: 12 },

  // Dropdown
  dropdownBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 12, borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10, backgroundColor: "#F9FAFB",
  },
  dropdownContent:     { flexDirection: "row", alignItems: "center", gap: 10 },
  dropdownText:        { fontFamily: "Ubuntu-Regular", fontSize: 14, color: "#111827" },
  dropdownPlaceholder: { color: "#9CA3AF" },

  // Issue grid
  issueGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  issueCard: {
    width: "30%", alignItems: "center", padding: 12,
    borderRadius: 12, borderWidth: 2, borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
  },
  issueIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: "center", alignItems: "center", marginBottom: 6,
  },
  issueLabel: { fontFamily: "Ubuntu-Medium", fontSize: 11, color: "#9CA3AF", textAlign: "center" },

  // Text area
  textArea: { backgroundColor: "#fff", minHeight: 100 },
  charHint: { fontFamily: "Ubuntu-Regular", fontSize: 11, color: "#9CA3AF", marginTop: 4, textAlign: "right" },

  // Priority
  priorityRow: { flexDirection: "row", gap: 10 },
  priorityBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, padding: 12, borderRadius: 10, borderWidth: 2, borderColor: "#E5E7EB", backgroundColor: "#F9FAFB",
  },
  priorityLabel: { fontFamily: "Ubuntu-Medium", fontSize: 13, color: "#9CA3AF" },

  // Photos
  photoHint:    { fontFamily: "Ubuntu-Regular", fontSize: 12, color: "#9CA3AF", marginBottom: 10 },
  photoGrid:    { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  photoWrap:    { position: "relative" },
  photoPreview: { width: 78, height: 78, borderRadius: 10 },
  photoRemoveBtn: { position: "absolute", top: -8, right: -8, margin: 0 },
  photoAddRow: { flexDirection: "row", gap: 10 },
  photoAddBtn: {
    width: 78, height: 78, borderRadius: 10,
    borderWidth: 2, borderColor: "#E5E7EB", borderStyle: "dashed",
    justifyContent: "center", alignItems: "center", backgroundColor: "#F9FAFB",
  },
  photoAddText: { fontFamily: "Ubuntu-Regular", fontSize: 11, color: "#9CA3AF", marginTop: 4 },

  // Submit
  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: CARETAKER_ORANGE, borderRadius: 14,
    paddingVertical: 15, gap: 8,
    shadowColor: CARETAKER_ORANGE, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },
  submitBtnText: { fontFamily: "Ubuntu-Bold", fontSize: 15, color: "#fff" },

  // States
  center:      { flex: 1, justifyContent: "center", alignItems: "center", gap: 10, paddingTop: 60 },
  loadingText: { fontFamily: "Ubuntu-Regular", fontSize: 14, color: "#9CA3AF" },
  emptyCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: PALE_ORANGE, justifyContent: "center", alignItems: "center", marginBottom: 4,
  },
  emptyTitle: { fontFamily: "Ubuntu-Bold", fontSize: 15, color: "#374151" },
  emptySub:   { fontFamily: "Ubuntu-Regular", fontSize: 13, color: "#9CA3AF", textAlign: "center" },
  emptyBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginTop: 16, backgroundColor: CARETAKER_ORANGE,
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10,
  },
  emptyBtnText: { fontFamily: "Ubuntu-Bold", fontSize: 13, color: "#fff" },

  // Report cards
  reportCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#F3F4F6",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  reportStripe: { width: 4 },
  reportBody:   { flex: 1, padding: 12 },

  reportTop: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 8 },
  reportIssueIcon: { width: 38, height: 38, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  reportIssueName: { fontFamily: "Ubuntu-Bold", fontSize: 14, color: "#111827" },
  reportGroundName:{ fontFamily: "Ubuntu-Regular", fontSize: 12, color: "#6B7280", marginTop: 2 },

  statusBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  statusLabel: { fontFamily: "Ubuntu-Bold", fontSize: 11 },

  reportMeta: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4,
  },
  priorityChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  priorityChipText: { fontFamily: "Ubuntu-Medium", fontSize: 11 },
  reportDate:       { fontFamily: "Ubuntu-Regular", fontSize: 11, color: "#9CA3AF" },

  expandedContent: { marginTop: 8, borderTopWidth: 1, borderTopColor: "#F3F4F6", paddingTop: 10, gap: 8 },
  expandedDesc:    { fontFamily: "Ubuntu-Regular", fontSize: 13, color: "#374151", lineHeight: 19 },
  reportPhoto:     { width: 80, height: 80, borderRadius: 8 },

  feedbackBox: {
    backgroundColor: "#F0FDF4", borderRadius: 8, padding: 10, gap: 4,
  },
  feedbackHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  feedbackHeaderText: { fontFamily: "Ubuntu-Bold", fontSize: 12, color: "#059669" },
  feedbackNote:       { fontFamily: "Ubuntu-Regular", fontSize: 12, color: "#374151", lineHeight: 18 },

  updateBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginTop: 10, paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: PALE_ORANGE, borderRadius: 8,
    borderWidth: 1, borderColor: "#FED7AA",
    alignSelf: "flex-start",
  },
  updateBtnText: { fontFamily: "Ubuntu-Medium", fontSize: 12, color: CARETAKER_ORANGE },

  // Update dialog
  updateDialogChip: {
    flexDirection: "row", alignItems: "center", gap: 7,
    backgroundColor: PALE_ORANGE, borderRadius: 8,
    padding: 10, marginBottom: 14,
  },
  updateDialogChipText:  { fontFamily: "Ubuntu-Medium", fontSize: 13, color: NAVY_ORANGE, flex: 1 },
  updateDialogFieldLabel:{ fontFamily: "Ubuntu-Medium", fontSize: 13, color: "#374151", marginBottom: 8 },
  updateRadioRow: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 6 },
  updateRadioLabel: { fontFamily: "Ubuntu-Bold", fontSize: 13 },
  updateRadioDesc:  { fontFamily: "Ubuntu-Regular", fontSize: 12, color: "#9CA3AF", marginTop: 1 },
  updateNotesInput: {
    borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, fontFamily: "Ubuntu-Regular", color: "#111827",
    backgroundColor: "#F9FAFB", minHeight: 80,
  },
});
