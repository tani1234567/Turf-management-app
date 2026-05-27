import React, { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { Text, Surface, ActivityIndicator, IconButton, Divider } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { subscribeToDispute } from "../../services/firebase/support";

const PAGE_BG = "#F8FAF9";
const USER_COLOR = "#10B981";

const TYPE_LABELS = {
  refund:          "Refund",
  service_quality: "Service Quality",
  overcharge:      "Overcharge",
  cancellation:    "Cancellation",
  other:           "Other",
};

const STATUS_CONFIG = {
  open: {
    label: "Open",
    color: "#1D4ED8",
    bg: "#DBEAFE",
    border: "#BFDBFE",
    icon: "clock-outline",
    description: "Your dispute has been received and is awaiting review.",
  },
  under_review: {
    label: "Under Review",
    color: "#D97706",
    bg: "#FEF3C7",
    border: "#FDE68A",
    icon: "eye-outline",
    description: "Our team is actively reviewing your dispute.",
  },
  resolved_user_favor: {
    label: "Resolved in Your Favor",
    color: "#065F46",
    bg: "#D1FAE5",
    border: "#6EE7B7",
    icon: "check-circle-outline",
    description: "Your dispute has been resolved in your favor.",
  },
  resolved_company_favor: {
    label: "Resolved",
    color: "#6B7280",
    bg: "#F3F4F6",
    border: "#E5E7EB",
    icon: "close-circle-outline",
    description: "Your dispute has been reviewed and closed.",
  },
  closed: {
    label: "Closed",
    color: "#6B7280",
    bg: "#F3F4F6",
    border: "#E5E7EB",
    icon: "lock-outline",
    description: "This dispute has been closed.",
  },
};

function formatDate(timestamp) {
  if (!timestamp) return "";
  let date;
  if (timestamp.toDate) date = timestamp.toDate();
  else if (timestamp.seconds) date = new Date(timestamp.seconds * 1000);
  else date = new Date(timestamp);
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

function InfoRow({ icon, label, value, iconColor }) {
  return (
    <View style={styles.infoRow}>
      <View style={[styles.infoIconWrap, { backgroundColor: (iconColor || "#6B7280") + "18" }]}>
        <MaterialCommunityIcons name={icon} size={15} color={iconColor || "#6B7280"} />
      </View>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export default function DisputeDetailScreen({ navigation, route }) {
  const { disputeId } = route.params;
  const [dispute, setDispute] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToDispute(disputeId, (d) => {
      setDispute(d);
      setLoading(false);
    });
    return unsub;
  }, [disputeId]);

  const statusCfg = dispute ? (STATUS_CONFIG[dispute.status] || STATUS_CONFIG.open) : null;
  const isResolved =
    dispute?.status === "resolved_user_favor" || dispute?.status === "resolved_company_favor";

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <IconButton icon="arrow-left" size={24} onPress={() => navigation.goBack()} style={styles.backButton} />
          <Text style={styles.headerTitle}>Dispute</Text>
        </View>
        <ActivityIndicator color={USER_COLOR} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (!dispute) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <IconButton icon="arrow-left" size={24} onPress={() => navigation.goBack()} style={styles.backButton} />
          <Text style={styles.headerTitle}>Dispute not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton icon="arrow-left" size={24} onPress={() => navigation.goBack()} style={styles.backButton} />
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Dispute</Text>
          <Text style={styles.headerSub}>
            {TYPE_LABELS[dispute.type] || dispute.type} · {formatDate(dispute.createdAt)}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Status card */}
        <Surface style={[styles.statusCard, { borderLeftColor: statusCfg.color }]} elevation={1}>
          <View style={styles.statusRow}>
            <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg, borderColor: statusCfg.border }]}>
              <MaterialCommunityIcons name={statusCfg.icon} size={13} color={statusCfg.color} />
              <Text style={[styles.statusLabel, { color: statusCfg.color }]}>{statusCfg.label}</Text>
            </View>
          </View>
          <Text style={styles.statusDescription}>{statusCfg.description}</Text>
        </Surface>

        {/* Details card */}
        <Surface style={styles.card} elevation={1}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="format-list-bulleted" size={16} color={USER_COLOR} />
            <Text style={styles.cardTitle}>Details</Text>
          </View>
          <InfoRow
            icon="soccer-field"
            label="Turf"
            value={dispute.turfName || dispute.companyName || "—"}
            iconColor={USER_COLOR}
          />
          <Divider style={styles.divider} />
          <InfoRow
            icon="alert-circle-outline"
            label="Type"
            value={TYPE_LABELS[dispute.type] || dispute.type}
            iconColor="#EF4444"
          />
          {dispute.requestedAmount ? (
            <>
              <Divider style={styles.divider} />
              <InfoRow
                icon="currency-inr"
                label="Amount requested"
                value={`₹${dispute.requestedAmount}`}
                iconColor="#D97706"
              />
            </>
          ) : null}
        </Surface>

        {/* Description card */}
        <Surface style={styles.card} elevation={1}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="text-long" size={16} color="#6B7280" />
            <Text style={styles.cardTitle}>Your Description</Text>
          </View>
          <Text style={styles.descriptionText}>{dispute.description}</Text>
        </Surface>

        {/* Resolution card — only when resolved */}
        {isResolved && (
          <Surface
            style={[styles.card, styles.resolutionCard, { borderColor: statusCfg.color + "40" }]}
            elevation={1}
          >
            <View style={styles.resolutionHeaderRow}>
              <View style={[styles.resolutionIconWrap, { backgroundColor: statusCfg.bg }]}>
                <MaterialCommunityIcons name="gavel" size={16} color={statusCfg.color} />
              </View>
              <Text style={[styles.cardTitle, { color: statusCfg.color, marginBottom: 0 }]}>
                Resolution
              </Text>
            </View>

            {dispute.resolution ? (
              <Text style={styles.resolutionText}>{dispute.resolution}</Text>
            ) : null}

            {dispute.resolvedAmount > 0 && dispute.status === "resolved_user_favor" && (
              <View style={styles.refundChip}>
                <MaterialCommunityIcons name="cash-refund" size={16} color="#065F46" />
                <Text style={styles.refundChipText}>
                  ₹{dispute.resolvedAmount} refund will be processed within 5–7 business days
                </Text>
              </View>
            )}

            {dispute.resolvedAt && (
              <Text style={styles.resolvedDate}>
                Resolved on {formatDate(dispute.resolvedAt)}
              </Text>
            )}
          </Surface>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 16,
    paddingBottom: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  backButton: { margin: 0 },
  headerCenter: { flex: 1, gap: 2 },
  headerTitle: { fontSize: 18, fontFamily: "Ubuntu-Bold", color: "#111827" },
  headerSub: { fontSize: 12, fontFamily: "Ubuntu-Regular", color: "#9CA3AF" },

  scroll: { padding: 16, gap: 12 },

  statusCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    borderLeftWidth: 4,
  },
  statusRow: { marginBottom: 10 },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  statusLabel: { fontSize: 13, fontFamily: "Ubuntu-Bold" },
  statusDescription: { fontSize: 13, fontFamily: "Ubuntu-Regular", color: "#374151", lineHeight: 19 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 13,
    fontFamily: "Ubuntu-Bold",
    color: "#374151",
  },

  infoRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7 },
  infoIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  infoLabel: { fontSize: 13, fontFamily: "Ubuntu-Regular", color: "#6B7280", flex: 1 },
  infoValue: { fontSize: 13, fontFamily: "Ubuntu-Bold", color: "#111827" },
  divider: { marginVertical: 2, marginLeft: 38 },

  descriptionText: { fontSize: 14, fontFamily: "Ubuntu-Regular", color: "#374151", lineHeight: 21 },

  resolutionCard: { borderWidth: 1 },
  resolutionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  resolutionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  resolutionText: {
    fontSize: 14,
    fontFamily: "Ubuntu-Regular",
    color: "#374151",
    lineHeight: 21,
    marginBottom: 14,
  },
  refundChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#D1FAE5",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 10,
  },
  refundChipText: { fontSize: 13, fontFamily: "Ubuntu-Medium", color: "#065F46", flex: 1, lineHeight: 18 },
  resolvedDate: { fontSize: 11, fontFamily: "Ubuntu-Regular", color: "#9CA3AF", marginTop: 4 },
});
