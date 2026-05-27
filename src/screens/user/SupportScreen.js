import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { Text, Surface, ActivityIndicator, IconButton } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useSelector } from "react-redux";
import { selectUser } from "../../store/slices/authSlice";
import { getMyTickets, getMyDisputes } from "../../services/firebase/support";
import TicketStatusBadge from "../../components/support/TicketStatusBadge";

const USER_COLOR = "#10B981";
const PAGE_BG = "#F8FAF9";
const EMERALD_PALE = "#D1FAE5";

const DISPUTE_TYPE_LABELS = {
  refund: "Refund",
  service_quality: "Service Quality",
  overcharge: "Overcharge",
  cancellation: "Cancellation",
  other: "Other",
};

const DISPUTE_STATUS_CONFIG = {
  open:                   { label: "Open",                  bg: "#DBEAFE", text: "#1D4ED8", border: "#BFDBFE", icon: "clock-outline" },
  under_review:           { label: "Under Review",          bg: "#FEF3C7", text: "#D97706", border: "#FDE68A", icon: "eye-outline" },
  resolved_user_favor:    { label: "Resolved — Your Favor", bg: "#D1FAE5", text: "#065F46", border: "#6EE7B7", icon: "check-circle-outline" },
  resolved_company_favor: { label: "Resolved",              bg: "#F3F4F6", text: "#6B7280", border: "#E5E7EB", icon: "close-circle-outline" },
  closed:                 { label: "Closed",                bg: "#F3F4F6", text: "#6B7280", border: "#E5E7EB", icon: "lock-outline" },
};

function formatDate(timestamp) {
  if (!timestamp) return "";
  let date;
  if (timestamp.toDate) date = timestamp.toDate();
  else if (timestamp.seconds) date = new Date(timestamp.seconds * 1000);
  else date = new Date(timestamp);
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function DisputeStatusBadge({ status }) {
  const cfg = DISPUTE_STATUS_CONFIG[status] || DISPUTE_STATUS_CONFIG.open;
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
      <MaterialCommunityIcons name={cfg.icon} size={10} color={cfg.text} />
      <Text style={[styles.badgeText, { color: cfg.text }]}>{cfg.label}</Text>
    </View>
  );
}

function SectionHeader({ icon, title, count }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIconWrap}>
        <MaterialCommunityIcons name={icon} size={16} color={USER_COLOR} />
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
      {count > 0 && (
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{count}</Text>
        </View>
      )}
    </View>
  );
}

function TicketRow({ ticket, onPress }) {
  return (
    <TouchableOpacity onPress={() => onPress(ticket)} activeOpacity={0.75}>
      <Surface style={styles.rowCard} elevation={1}>
        <View style={styles.accentStrip} />
        <View style={styles.rowContent}>
          <View style={styles.rowTop}>
            <Text style={styles.ticketNumber}>{ticket.ticketNumber || "—"}</Text>
            <TicketStatusBadge status={ticket.status} />
          </View>
          <Text style={styles.rowSubject} numberOfLines={2}>{ticket.subject}</Text>
          <View style={styles.rowFooter}>
            <MaterialCommunityIcons name="calendar-outline" size={12} color="#9CA3AF" />
            <Text style={styles.rowDate}>{formatDate(ticket.createdAt)}</Text>
          </View>
        </View>
      </Surface>
    </TouchableOpacity>
  );
}

function DisputeRow({ dispute, onPress }) {
  return (
    <TouchableOpacity onPress={() => onPress(dispute)} activeOpacity={0.75}>
      <Surface style={styles.rowCard} elevation={1}>
        <View style={[styles.accentStrip, { backgroundColor: "#EF4444" }]} />
        <View style={styles.rowContent}>
          <View style={styles.rowTop}>
            <Text style={styles.disputeType}>
              {DISPUTE_TYPE_LABELS[dispute.type] || dispute.type}
            </Text>
            <DisputeStatusBadge status={dispute.status} />
          </View>
          <Text style={styles.rowSubject} numberOfLines={1}>
            {dispute.turfName || dispute.companyName || "—"}
          </Text>
          <View style={styles.rowFooter}>
            <MaterialCommunityIcons name="calendar-outline" size={12} color="#9CA3AF" />
            <Text style={styles.rowDate}>{formatDate(dispute.createdAt)}</Text>
          </View>
        </View>
      </Surface>
    </TouchableOpacity>
  );
}

function SectionEmpty({ icon, label }) {
  return (
    <View style={styles.emptySection}>
      <MaterialCommunityIcons name={icon} size={36} color="#E5E7EB" />
      <Text style={styles.emptySectionText}>{label}</Text>
    </View>
  );
}

export default function SupportScreen({ navigation }) {
  const user = useSelector(selectUser);
  const userId = user?.id || user?.userId || user?.uid;

  const [tickets, setTickets] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const [t, d] = await Promise.all([getMyTickets(userId), getMyDisputes(userId)]);
      setTickets(t);
      setDisputes(d);
    } catch (e) {
      console.error("[Support] load error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const onRefresh = () => { setRefreshing(true); load(); };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton
          icon="arrow-left"
          size={24}
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        />
        <Text style={styles.headerTitle}>Help & Support</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[USER_COLOR]} />
        }
      >
        {/* Hero CTA */}
        <Surface style={styles.heroBanner} elevation={2}>
          <View style={styles.heroLeft}>
            <View style={styles.heroIconWrap}>
              <MaterialCommunityIcons name="lifebuoy" size={28} color={USER_COLOR} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>Need help?</Text>
              <Text style={styles.heroSubtitle}>
                Our support team usually responds within 24 hours.
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.newTicketButton}
            onPress={() => navigation.navigate("NewTicket")}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="plus" size={18} color="#fff" />
            <Text style={styles.newTicketText}>New Ticket</Text>
          </TouchableOpacity>
        </Surface>

        {loading ? (
          <ActivityIndicator color={USER_COLOR} style={{ marginTop: 48 }} />
        ) : (
          <>
            {/* Tickets section */}
            <SectionHeader icon="ticket-outline" title="My Tickets" count={tickets.length} />
            {tickets.length === 0 ? (
              <SectionEmpty icon="ticket-outline" label="No support tickets yet" />
            ) : (
              tickets.map((t) => (
                <TicketRow
                  key={t.id}
                  ticket={t}
                  onPress={() => navigation.navigate("TicketDetail", { ticketId: t.id })}
                />
              ))
            )}

            {/* Disputes section */}
            <SectionHeader icon="gavel" title="My Disputes" count={disputes.length} />
            {disputes.length === 0 ? (
              <SectionEmpty icon="gavel" label="No disputes raised" />
            ) : (
              disputes.map((d) => (
                <DisputeRow
                  key={d.id}
                  dispute={d}
                  onPress={() => navigation.navigate("DisputeDetail", { disputeId: d.id })}
                />
              ))
            )}

            <View style={{ height: 40 }} />
          </>
        )}
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
    paddingBottom: 8,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  backButton: { margin: 0 },
  headerTitle: { fontSize: 18, fontFamily: "Ubuntu-Bold", color: "#111827", flex: 1 },

  scroll: { padding: 16, gap: 0 },

  heroBanner: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: EMERALD_PALE,
  },
  heroLeft: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 14 },
  heroIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: EMERALD_PALE,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: { fontSize: 16, fontFamily: "Ubuntu-Bold", color: "#111827", marginBottom: 3 },
  heroSubtitle: { fontSize: 12, fontFamily: "Ubuntu-Regular", color: "#6B7280", lineHeight: 17 },
  newTicketButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: USER_COLOR,
    borderRadius: 12,
    paddingVertical: 12,
    gap: 6,
    shadowColor: USER_COLOR,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  newTicketText: { color: "#fff", fontSize: 14, fontFamily: "Ubuntu-Bold" },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
    marginTop: 4,
  },
  sectionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: EMERALD_PALE,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: { fontSize: 15, fontFamily: "Ubuntu-Bold", color: "#111827", flex: 1 },
  countBadge: {
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countText: { fontSize: 12, fontFamily: "Ubuntu-Medium", color: "#6B7280" },

  rowCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    marginBottom: 10,
    flexDirection: "row",
    overflow: "hidden",
  },
  accentStrip: {
    width: 4,
    backgroundColor: USER_COLOR,
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
  },
  rowContent: { flex: 1, padding: 14 },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  ticketNumber: { fontSize: 11, fontFamily: "Ubuntu-Medium", color: "#9CA3AF", letterSpacing: 0.3 },
  disputeType: { fontSize: 13, fontFamily: "Ubuntu-Bold", color: "#374151" },
  rowSubject: { fontSize: 14, fontFamily: "Ubuntu-Medium", color: "#111827", marginBottom: 6, lineHeight: 20 },
  rowFooter: { flexDirection: "row", alignItems: "center", gap: 4 },
  rowDate: { fontSize: 11, fontFamily: "Ubuntu-Regular", color: "#9CA3AF" },

  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  badgeText: { fontSize: 10, fontFamily: "Ubuntu-Medium" },

  emptySection: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 8,
    marginBottom: 16,
  },
  emptySectionText: {
    fontSize: 13,
    fontFamily: "Ubuntu-Regular",
    color: "#9CA3AF",
  },
});
