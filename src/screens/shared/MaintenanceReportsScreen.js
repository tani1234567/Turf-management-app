import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  TextInput as RNTextInput,
  RefreshControl,
} from "react-native";
import {
  Text,
  ActivityIndicator,
  Portal,
  Dialog,
  Button,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSelector } from "react-redux";
import { selectUser, selectUserRole } from "../../store/slices/authSlice";
import {
  subscribeToCollection,
  updateDocument,
  addDocument,
} from "../../services/firebase/firestore";
import { useSelectedTurf } from "../../hooks/useSelectedTurf";

// ─── Config ───────────────────────────────────────────────────────────────────

const ISSUE_TYPES = [
  { id: "lighting",         label: "Lighting",         icon: "lightbulb-outline",    color: "#F59E0B" },
  { id: "ground_condition", label: "Ground Condition",  icon: "grass",                color: "#10B981" },
  { id: "equipment",        label: "Equipment",         icon: "tools",                color: "#3B82F6" },
  { id: "safety",           label: "Safety",            icon: "shield-alert-outline", color: "#EF4444" },
  { id: "other",            label: "Other",             icon: "help-circle-outline",  color: "#9CA3AF" },
];

const PRIORITY_CONFIG = {
  high:   { label: "High",   color: "#EF4444", bg: "#FEF2F2", icon: "arrow-up-bold"  },
  medium: { label: "Medium", color: "#F59E0B", bg: "#FFFBEB", icon: "minus"          },
  low:    { label: "Low",    color: "#10B981", bg: "#F0FDF4", icon: "arrow-down"     },
};

const STATUS_CONFIG = {
  pending:     { label: "Pending",     color: "#F59E0B", bg: "#FFFBEB", icon: "clock-outline"    },
  in_progress: { label: "In Progress", color: "#3B82F6", bg: "#EFF6FF", icon: "progress-wrench"  },
  resolved:    { label: "Resolved",    color: "#10B981", bg: "#F0FDF4", icon: "check-circle"      },
  rejected:    { label: "Rejected",    color: "#EF4444", bg: "#FEF2F2", icon: "close-circle"      },
};

const STATUS_FILTERS = [
  { key: "all",         label: "All"         },
  { key: "pending",     label: "Pending"     },
  { key: "in_progress", label: "In Progress" },
  { key: "resolved",    label: "Resolved"    },
  { key: "rejected",    label: "Rejected"    },
];

const ROLE_CFG = {
  manager: { accent: "#3B82F6", pale: "#EFF6FF", navy: "#1E40AF" },
  owner:   { accent: "#9C27B0", pale: "#F3E5F5", navy: "#4A148C" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (ts) => {
  if (!ts) return "";
  const d = ts?.toDate?.() || new Date(ts);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MaintenanceReportsScreen({ navigation }) {
  const user   = useSelector(selectUser);
  const role   = useSelector(selectUserRole);
  const cfg    = ROLE_CFG[role] || ROLE_CFG.manager;

  const { allTurfs, selectedTurfId } = useSelectedTurf();
  const [activeTurfId, setActiveTurfId]   = useState(null);
  const [reports, setReports]             = useState([]);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [statusFilter, setStatusFilter]   = useState("all");

  // Action dialog
  const [actionDialog, setActionDialog]   = useState(null); // { type, report }
  const [actionNotes, setActionNotes]     = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Seed activeTurfId from hook
  useEffect(() => {
    if (selectedTurfId && !activeTurfId) setActiveTurfId(selectedTurfId);
  }, [selectedTurfId]);

  // Subscribe to maintenance logs for active turf
  useEffect(() => {
    if (!activeTurfId) return;
    setLoading(true);

    const unsub = subscribeToCollection(
      "maintenance_logs",
      (logs) => {
        const sorted = [...logs].sort((a, b) => {
          const da = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
          const db = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
          return db - da;
        });
        setReports(sorted);
        setLoading(false);
        setRefreshing(false);
      },
      [{ field: "turfId", operator: "==", value: activeTurfId }]
    );

    return () => unsub?.();
  }, [activeTurfId]);

  const filteredReports =
    statusFilter === "all"
      ? reports
      : reports.filter((r) => r.status === statusFilter);

  const pendingCount    = reports.filter((r) => r.status === "pending").length;
  const activeTurf      = allTurfs.find((t) => t.id === activeTurfId);

  // ── Action handlers ──────────────────────────────────────────────────────

  const openDialog = (type, report) => {
    setActionNotes("");
    setActionDialog({ type, report });
  };

  const handleConfirmAction = async () => {
    if (!actionDialog) return;
    const { type, report } = actionDialog;
    const userId = user?.userId || user?.uid;

    if (type === "reject" && !actionNotes.trim()) {
      Alert.alert("Reason required", "Please enter a reason for rejection.");
      return;
    }

    setActionLoading(true);
    try {
      const now = new Date().toISOString();
      let updates = {};
      let notifTitle = "";
      let notifBody  = "";

      if (type === "progress") {
        updates      = { status: "in_progress" };
        notifTitle   = "Report Under Review";
        notifBody    = `Your ${report.issueTypeLabel || report.issueType} report for ${report.groundName} is now being reviewed.`;
      } else if (type === "resolve") {
        updates = {
          status: "resolved",
          resolvedBy: userId,
          resolvedByName: user?.name || role,
          resolvedAt: now,
          resolutionNotes: actionNotes.trim() || null,
        };
        notifTitle = "Issue Resolved ✓";
        notifBody  = `Your maintenance report for ${report.groundName} has been marked as resolved.`;
      } else if (type === "reject") {
        updates = {
          status: "rejected",
          rejectedBy: userId,
          rejectedByName: user?.name || role,
          rejectedAt: now,
          rejectionReason: actionNotes.trim(),
        };
        notifTitle = "Report Rejected";
        notifBody  = `Your report for ${report.groundName} was rejected. Reason: ${actionNotes.trim()}`;
      }

      await updateDocument("maintenance_logs", report.id, updates);

      if (report.reportedBy) {
        await addDocument("notifications", {
          userId:      report.reportedBy,
          type:        "maintenance_update",
          title:       notifTitle,
          body:        notifBody,
          relatedId:   report.id,
          relatedType: "maintenance_log",
          turfId:      report.turfId,
          turfName:    report.turfName,
          isRead:      false,
        });
      }

      setActionDialog(null);
    } catch (err) {
      console.error("[MaintenanceReports] action error:", err);
      Alert.alert("Error", "Failed to update report. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  // ── Render report card ───────────────────────────────────────────────────

  const renderReport = ({ item: report }) => {
    const issue    = ISSUE_TYPES.find((t) => t.id === report.issueType);
    const priority = PRIORITY_CONFIG[report.priority] || PRIORITY_CONFIG.medium;
    const status   = STATUS_CONFIG[report.status]   || STATUS_CONFIG.pending;
    const isTerminal = report.status === "resolved" || report.status === "rejected";

    return (
      <View style={styles.card}>
        {/* Top row: icon | info | priority */}
        <View style={styles.cardTop}>
          <View style={[styles.issueIcon, { backgroundColor: (issue?.color || "#9CA3AF") + "18" }]}>
            <MaterialCommunityIcons
              name={issue?.icon || "help-circle-outline"}
              size={22}
              color={issue?.color || "#9CA3AF"}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.issueName}>
              {report.issueTypeLabel || issue?.label || report.issueType}
            </Text>
            <View style={styles.metaRow}>
              <MaterialCommunityIcons name="soccer-field" size={12} color="#9CA3AF" />
              <Text style={styles.metaText}>{report.groundName}</Text>
              <View style={styles.metaDot} />
              <MaterialCommunityIcons name="account-outline" size={12} color="#9CA3AF" />
              <Text style={styles.metaText}>{report.reportedByName || "Caretaker"}</Text>
            </View>
          </View>
          <View style={[styles.priorityBadge, { backgroundColor: priority.bg }]}>
            <MaterialCommunityIcons name={priority.icon} size={12} color={priority.color} />
            <Text style={[styles.priorityLabel, { color: priority.color }]}>{priority.label}</Text>
          </View>
        </View>

        {/* Description */}
        <Text style={styles.description}>{report.description}</Text>

        {/* Photos */}
        {report.photos?.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 12 }}
          >
            <View style={{ flexDirection: "row", gap: 8 }}>
              {report.photos.map((uri, i) => (
                <Image key={i} source={{ uri }} style={styles.photo} />
              ))}
            </View>
          </ScrollView>
        )}

        {/* Status row */}
        <View style={styles.statusRow}>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <MaterialCommunityIcons name={status.icon} size={13} color={status.color} />
            <Text style={[styles.statusLabel, { color: status.color }]}>{status.label}</Text>
          </View>
          <Text style={styles.dateText}>{formatDate(report.createdAt)}</Text>
        </View>

        {/* Resolution notes */}
        {report.status === "resolved" && (report.resolutionNotes || report.resolvedByName) && (
          <View style={styles.resolutionBox}>
            <MaterialCommunityIcons name="check-circle-outline" size={14} color="#059669" />
            <View style={{ flex: 1 }}>
              {report.resolutionNotes ? (
                <Text style={styles.resolutionNote}>{report.resolutionNotes}</Text>
              ) : null}
              {report.resolvedByName ? (
                <Text style={styles.resolvedBy}>Resolved by {report.resolvedByName}</Text>
              ) : null}
            </View>
          </View>
        )}

        {/* Rejection reason */}
        {report.status === "rejected" && report.rejectionReason && (
          <View style={styles.rejectionBox}>
            <MaterialCommunityIcons name="close-circle-outline" size={14} color="#DC2626" />
            <Text style={styles.rejectionNote}>{report.rejectionReason}</Text>
          </View>
        )}

        {/* Action buttons */}
        {!isTerminal && (
          <View style={styles.actionRow}>
            {report.status === "pending" && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" }]}
                onPress={() => openDialog("progress", report)}
              >
                <MaterialCommunityIcons name="progress-wrench" size={14} color="#3B82F6" />
                <Text style={[styles.actionLabel, { color: "#3B82F6" }]}>In Review</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0", flex: 1 }]}
              onPress={() => openDialog("resolve", report)}
            >
              <MaterialCommunityIcons name="check-circle-outline" size={14} color="#16A34A" />
              <Text style={[styles.actionLabel, { color: "#16A34A" }]}>Resolve</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}
              onPress={() => openDialog("reject", report)}
            >
              <MaterialCommunityIcons name="close-circle-outline" size={14} color="#DC2626" />
              <Text style={[styles.actionLabel, { color: "#DC2626" }]}>Reject</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  // ── Dialog label helpers ─────────────────────────────────────────────────

  const dialogTitle =
    actionDialog?.type === "resolve"  ? "Resolve Issue"    :
    actionDialog?.type === "reject"   ? "Reject Report"    :
                                        "Mark as In Review";

  // ── Main render ──────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#374151" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Maintenance Reports</Text>
          {activeTurf && (
            <Text style={styles.headerSub} numberOfLines={1}>{activeTurf.name}</Text>
          )}
        </View>
        {pendingCount > 0 && (
          <View style={[styles.pendingBadge, { backgroundColor: cfg.accent }]}>
            <Text style={styles.pendingBadgeText}>{pendingCount} pending</Text>
          </View>
        )}
      </View>

      {/* Turf tabs — shown only when owner has multiple turfs */}
      {allTurfs.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.turfTabsScroll}
          contentContainerStyle={styles.turfTabs}
        >
          {allTurfs.map((t) => {
            const active = t.id === activeTurfId;
            return (
              <TouchableOpacity
                key={t.id}
                style={[styles.turfTab, active && { backgroundColor: cfg.accent, borderColor: cfg.navy }]}
                onPress={() => setActiveTurfId(t.id)}
              >
                <Text
                  style={[styles.turfTabText, active && { color: "#fff" }]}
                  numberOfLines={1}
                >
                  {t.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Status filter bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterRow}
      >
        {STATUS_FILTERS.map((f) => {
          const count  = f.key === "all" ? reports.length : reports.filter((r) => r.status === f.key).length;
          const active = statusFilter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterChip, active && { backgroundColor: cfg.accent, borderColor: cfg.navy }]}
              onPress={() => setStatusFilter(f.key)}
            >
              <Text style={[styles.filterChipText, active && { color: "#fff" }]}>{f.label}</Text>
              {count > 0 && (
                <View style={[styles.filterCount, active && { backgroundColor: "rgba(255,255,255,0.25)" }]}>
                  <Text style={[styles.filterCountText, active && { color: "#fff" }]}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Body */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={cfg.accent} />
          <Text style={styles.loadingText}>Loading reports…</Text>
        </View>
      ) : filteredReports.length === 0 ? (
        <View style={styles.center}>
          <View style={[styles.emptyCircle, { backgroundColor: cfg.pale }]}>
            <MaterialCommunityIcons name="clipboard-check-outline" size={36} color={cfg.accent} />
          </View>
          <Text style={styles.emptyTitle}>
            {statusFilter === "all" ? "No reports yet" : `No ${STATUS_CONFIG[statusFilter]?.label || statusFilter} reports`}
          </Text>
          <Text style={styles.emptySub}>
            {statusFilter === "all"
              ? "Caretakers haven't submitted any maintenance reports for this turf."
              : "Nothing here — all caught up!"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredReports}
          keyExtractor={(item) => item.id}
          renderItem={renderReport}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => setRefreshing(true)}
              colors={[cfg.accent]}
            />
          }
        />
      )}

      {/* Action Dialog */}
      <Portal>
        <Dialog
          visible={!!actionDialog}
          onDismiss={() => !actionLoading && setActionDialog(null)}
          style={{ borderRadius: 16 }}
        >
          <Dialog.Title style={{ fontFamily: "Ubuntu-Bold" }}>{dialogTitle}</Dialog.Title>
          <Dialog.Content>
            {actionDialog?.report && (
              <View style={styles.dialogReportChip}>
                <MaterialCommunityIcons
                  name={ISSUE_TYPES.find((t) => t.id === actionDialog.report.issueType)?.icon || "tools"}
                  size={14}
                  color="#6B7280"
                />
                <Text style={styles.dialogReportLabel} numberOfLines={1}>
                  {actionDialog.report.issueTypeLabel || actionDialog.report.issueType} — {actionDialog.report.groundName}
                </Text>
              </View>
            )}

            {actionDialog?.type === "progress" ? (
              <Text style={styles.dialogHint}>
                This will mark the report as "In Review" and notify the caretaker that you're looking into it.
              </Text>
            ) : (
              <View>
                <Text style={styles.dialogFieldLabel}>
                  {actionDialog?.type === "resolve"
                    ? "Resolution notes (optional)"
                    : "Rejection reason *"}
                </Text>
                <RNTextInput
                  style={styles.dialogTextInput}
                  placeholder={
                    actionDialog?.type === "resolve"
                      ? "Describe how the issue was resolved…"
                      : "Explain why this report is being rejected…"
                  }
                  value={actionNotes}
                  onChangeText={setActionNotes}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setActionDialog(null)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button
              onPress={handleConfirmAction}
              loading={actionLoading}
              disabled={actionLoading}
              textColor={actionDialog?.type === "reject" ? "#DC2626" : "#16A34A"}
            >
              Confirm
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FB" },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: "#F3F4F6",
    justifyContent: "center", alignItems: "center",
  },
  headerTitle: { fontFamily: "Ubuntu-Bold", fontSize: 17, color: "#111827" },
  headerSub:   { fontFamily: "Ubuntu-Regular", fontSize: 12, color: "#6B7280", marginTop: 1 },
  pendingBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  pendingBadgeText: { fontFamily: "Ubuntu-Bold", fontSize: 12, color: "#fff" },

  // Turf tabs
  turfTabsScroll: { maxHeight: 52, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  turfTabs: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  turfTab: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1.5, borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
  },
  turfTabText: { fontFamily: "Ubuntu-Medium", fontSize: 13, color: "#374151" },

  // Filter bar
  filterScroll: { maxHeight: 52, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  filterRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  filterChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 13, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1.5, borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
  },
  filterChipText:  { fontFamily: "Ubuntu-Medium", fontSize: 13, color: "#374151" },
  filterCount:     { minWidth: 20, height: 20, borderRadius: 10, justifyContent: "center", alignItems: "center", paddingHorizontal: 4 },
  filterCountText: { fontFamily: "Ubuntu-Bold", fontSize: 11, color: "#6B7280" },

  // States
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, paddingHorizontal: 32 },
  loadingText: { fontFamily: "Ubuntu-Regular", fontSize: 14, color: "#6B7280" },
  emptyCircle: { width: 72, height: 72, borderRadius: 36, justifyContent: "center", alignItems: "center", marginBottom: 4 },
  emptyTitle:  { fontFamily: "Ubuntu-Bold", fontSize: 16, color: "#374151" },
  emptySub:    { fontFamily: "Ubuntu-Regular", fontSize: 13, color: "#9CA3AF", textAlign: "center", lineHeight: 19 },

  list: { padding: 16, paddingBottom: 28 },

  // Card
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  issueIcon: { width: 42, height: 42, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  issueName: { fontFamily: "Ubuntu-Bold", fontSize: 14, color: "#111827", marginBottom: 3 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap" },
  metaText: { fontFamily: "Ubuntu-Regular", fontSize: 12, color: "#9CA3AF" },
  metaDot:  { width: 3, height: 3, borderRadius: 2, backgroundColor: "#D1D5DB", marginHorizontal: 2 },
  priorityBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  priorityLabel: { fontFamily: "Ubuntu-Bold", fontSize: 11 },

  description: { fontFamily: "Ubuntu-Regular", fontSize: 13, color: "#374151", lineHeight: 19, marginBottom: 12 },

  photo: { width: 72, height: 72, borderRadius: 8 },

  statusRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginBottom: 10,
  },
  statusBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
  },
  statusLabel: { fontFamily: "Ubuntu-Bold", fontSize: 12 },
  dateText:    { fontFamily: "Ubuntu-Regular", fontSize: 12, color: "#9CA3AF" },

  resolutionBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: "#F0FDF4", borderRadius: 8, padding: 10, marginBottom: 8,
  },
  resolutionNote: { fontFamily: "Ubuntu-Regular", fontSize: 12, color: "#374151" },
  resolvedBy:     { fontFamily: "Ubuntu-Regular", fontSize: 11, color: "#6B7280", marginTop: 2, fontStyle: "italic" },

  rejectionBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: "#FEF2F2", borderRadius: 8, padding: 10, marginBottom: 8,
  },
  rejectionNote: { fontFamily: "Ubuntu-Regular", fontSize: 12, color: "#374151", flex: 1 },

  actionRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  actionBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 8, borderWidth: 1,
  },
  actionLabel: { fontFamily: "Ubuntu-Medium", fontSize: 12 },

  // Dialog
  dialogReportChip: {
    flexDirection: "row", alignItems: "center", gap: 7,
    backgroundColor: "#F3F4F6", borderRadius: 8, padding: 10, marginBottom: 12,
  },
  dialogReportLabel: { fontFamily: "Ubuntu-Medium", fontSize: 13, color: "#374151", flex: 1 },
  dialogHint:        { fontFamily: "Ubuntu-Regular", fontSize: 13, color: "#6B7280", lineHeight: 19 },
  dialogFieldLabel:  { fontFamily: "Ubuntu-Medium", fontSize: 13, color: "#374151", marginBottom: 8 },
  dialogTextInput: {
    borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, fontFamily: "Ubuntu-Regular", color: "#111827",
    backgroundColor: "#F9FAFB", minHeight: 100,
  },
});
