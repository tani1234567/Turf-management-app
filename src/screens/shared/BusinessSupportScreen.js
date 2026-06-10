import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  LayoutAnimation,
  UIManager,
  Platform,
  Linking,
} from "react-native";
import { Text, Surface, ActivityIndicator, IconButton } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useSelector } from "react-redux";
import { selectUser, selectUserRole } from "../../store/slices/authSlice";
import { selectCompanyName, selectCompanyId } from "../../store/slices/companySlice";
import { getMyBusinessTickets } from "../../services/firebase/support";
import TicketStatusBadge from "../../components/support/TicketStatusBadge";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Role Config ─────────────────────────────────────────────────────────────

const ROLE_CONFIG = {
  manager: {
    accent: "#3B82F6",
    pale: "#EFF6FF",
    navy: "#1E40AF",
    label: "Business Manager",
    responseTime: "We respond within 24 hours.",
    priority: null,
  },
  owner: {
    accent: "#9C27B0",
    pale: "#F3E5F5",
    navy: "#4A148C",
    label: "Turf Owner",
    responseTime: "Priority support — we respond within 4 hours.",
    priority: "PRIORITY",
  },
  caretaker: {
    accent: "#F97316",
    pale: "#FFF7ED",
    navy: "#7C2D12",
    label: "Caretaker",
    responseTime: "We respond within 48 hours.",
    priority: null,
  },
};

const DEFAULT_CONFIG = ROLE_CONFIG.manager;

// ─── Role-specific FAQs ───────────────────────────────────────────────────────

const FAQS = {
  owner: [
    { q: "How do I renew my subscription?", a: "Go to Settings → Subscription and tap 'Manage Subscription'. You can renew before expiry or during the grace period." },
    { q: "Why are my turfs not showing to users?", a: "Turfs are hidden when your subscription expires. Renew your plan to reactivate them immediately." },
    { q: "How do I add managers or caretakers?", a: "Go to Settings → Invite Codes. Share the code with your team. They use it to join your company during sign-up." },
    { q: "My subscription payment was debited but status shows expired — what do I do?", a: "Raise a support ticket with the payment reference and amount. Our team will resolve it within 4 hours." },
    { q: "How do I view revenue and booking analytics?", a: "Go to Settings → Analytics for revenue reports, booking trends, and turf performance breakdowns." },
  ],
  manager: [
    { q: "How do I manage incoming booking requests?", a: "Go to the Bookings tab. Pending requests show at the top. Tap any booking to approve or reject." },
    { q: "How do I update turf pricing or slot timings?", a: "Go to Settings → My Turfs, select the turf, and edit pricing and slot configuration." },
    { q: "How do I assign caretakers to turfs?", a: "Go to Settings → Caretakers. You'll see a list of your team. Tap any caretaker to assign them a turf." },
    { q: "A payment is stuck — how do I verify it?", a: "Open the booking and tap 'Verify Payment'. Enter the UPI transaction ID and our system will verify within minutes." },
    { q: "How do I block slots for maintenance or holidays?", a: "Use Settings → Holiday Schedule to block full days, or go to a turf's calendar to block individual slots." },
  ],
  caretaker: [
    { q: "How do I check today's bookings?", a: "The Dashboard tab shows all bookings for your assigned turf today, sorted by time." },
    { q: "How do I collect payment for a walk-in booking?", a: "On the Calendar tab, tap the time slot and select 'Collect Payment'. Enter the amount and mark it as received." },
    { q: "I'm not seeing my assigned turf — what should I do?", a: "Contact your manager. If the issue persists after 24 hours, raise a support ticket below." },
    { q: "How do I log a maintenance issue?", a: "Go to Dashboard → Maintenance Log. Tap 'Add Log' to report the issue with photos if needed." },
    { q: "How do I log an expense?", a: "Open the Dashboard and tap 'Expense Tracking'. Add the amount, category, and any notes." },
  ],
};

// ─── Helper ──────────────────────────────────────────────────────────────────

function formatDate(timestamp) {
  if (!timestamp) return "";
  let date;
  if (timestamp.toDate) date = timestamp.toDate();
  else if (timestamp.seconds) date = new Date(timestamp.seconds * 1000);
  else date = new Date(timestamp);
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TicketRow({ ticket, accent, onPress }) {
  return (
    <TouchableOpacity onPress={() => onPress(ticket)} activeOpacity={0.75}>
      <Surface style={styles.rowCard} elevation={1}>
        <View style={[styles.accentStrip, { backgroundColor: accent }]} />
        <View style={styles.rowContent}>
          <View style={styles.rowTop}>
            <Text style={styles.ticketNumber}>{ticket.ticketNumber || "Pending…"}</Text>
            <TicketStatusBadge status={ticket.status} />
          </View>
          <Text style={styles.rowSubject} numberOfLines={2}>{ticket.subject}</Text>
          <View style={styles.rowFooter}>
            <MaterialCommunityIcons name="calendar-outline" size={12} color="#9CA3AF" />
            <Text style={styles.rowDate}>{formatDate(ticket.createdAt)}</Text>
          </View>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={18} color="#D1D5DB" style={styles.rowChevron} />
      </Surface>
    </TouchableOpacity>
  );
}

function FAQItem({ item, accent, pale }) {
  const [open, setOpen] = useState(false);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((v) => !v);
  };

  return (
    <View style={styles.faqItem}>
      <TouchableOpacity onPress={toggle} activeOpacity={0.75} style={styles.faqQuestion}>
        <Text style={styles.faqQuestionText} numberOfLines={open ? undefined : 2}>{item.q}</Text>
        <MaterialCommunityIcons name={open ? "chevron-up" : "chevron-down"} size={18} color="#9CA3AF" />
      </TouchableOpacity>
      {open && (
        <View style={[styles.faqAnswer, { borderLeftColor: accent, backgroundColor: pale }]}>
          <Text style={styles.faqAnswerText}>{item.a}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function BusinessSupportScreen({ navigation }) {
  const user = useSelector(selectUser);
  const role = useSelector(selectUserRole) || "manager";
  const companyName = useSelector(selectCompanyName);
  const companyId = useSelector(selectCompanyId);

  const userId = user?.id || user?.userId || user?.uid;
  const cfg = ROLE_CONFIG[role] || DEFAULT_CONFIG;
  const faqs = FAQS[role] || FAQS.manager;

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const t = await getMyBusinessTickets(userId);
      setTickets(t);
    } catch (e) {
      console.error("[BusinessSupport] load error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: cfg.pale }]}>
        <IconButton
          icon="arrow-left"
          size={24}
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          iconColor={cfg.navy}
        />
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: cfg.navy }]}>Help & Support</Text>
          {companyName ? (
            <Text style={styles.headerSub}>{companyName}</Text>
          ) : null}
        </View>
        {cfg.priority ? (
          <View style={[styles.priorityPill, { backgroundColor: cfg.pale, borderColor: cfg.accent + "40" }]}>
            <MaterialCommunityIcons name="star-circle" size={12} color={cfg.accent} />
            <Text style={[styles.priorityText, { color: cfg.accent }]}>{cfg.priority}</Text>
          </View>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[cfg.accent]} />
        }
      >
        {/* Hero CTA card */}
        <Surface style={[styles.heroBanner, { borderColor: cfg.pale }]} elevation={2}>
          <View style={[styles.heroIconWrap, { backgroundColor: cfg.pale }]}>
            <MaterialCommunityIcons name="lifebuoy" size={30} color={cfg.accent} />
          </View>
          <View style={styles.heroTextBlock}>
            <Text style={[styles.heroTitle, { color: cfg.navy }]}>Need help?</Text>
            <Text style={styles.heroSubtitle}>{cfg.responseTime}</Text>
          </View>
          <TouchableOpacity
            style={[styles.newTicketBtn, { backgroundColor: cfg.accent, shadowColor: cfg.accent }]}
            onPress={() => navigation.navigate("BusinessNewTicket")}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="plus" size={18} color="#fff" />
            <Text style={styles.newTicketText}>New Ticket</Text>
          </TouchableOpacity>
        </Surface>

        {/* My Tickets */}
        <View style={styles.sectionRow}>
          <View style={[styles.sectionAccent, { backgroundColor: cfg.accent }]} />
          <Text style={styles.sectionTitle}>MY TICKETS</Text>
          {tickets.length > 0 && (
            <View style={[styles.countBadge, { backgroundColor: cfg.pale }]}>
              <Text style={[styles.countText, { color: cfg.accent }]}>{tickets.length}</Text>
            </View>
          )}
        </View>

        {loading ? (
          <ActivityIndicator color={cfg.accent} style={{ marginVertical: 32 }} />
        ) : tickets.length === 0 ? (
          <View style={styles.emptyWrap}>
            <MaterialCommunityIcons name="ticket-outline" size={40} color="#E5E7EB" />
            <Text style={styles.emptyTitle}>No tickets yet</Text>
            <Text style={styles.emptySub}>Tap "New Ticket" above if you need assistance.</Text>
          </View>
        ) : (
          tickets.map((t) => (
            <TicketRow
              key={t.id}
              ticket={t}
              accent={cfg.accent}
              onPress={() => navigation.navigate("BusinessTicketDetail", { ticketId: t.id })}
            />
          ))
        )}

        {/* Quick Help / FAQs */}
        <View style={[styles.sectionRow, { marginTop: 20 }]}>
          <View style={[styles.sectionAccent, { backgroundColor: cfg.accent }]} />
          <Text style={styles.sectionTitle}>QUICK HELP</Text>
        </View>

        <Surface style={styles.faqCard} elevation={1}>
          {faqs.map((item, i) => (
            <View key={i}>
              <FAQItem item={item} accent={cfg.accent} pale={cfg.pale} />
              {i < faqs.length - 1 && <View style={styles.faqDivider} />}
            </View>
          ))}
        </Surface>

        {/* Email fallback */}
        <TouchableOpacity
          style={[styles.emailFallback, { borderColor: cfg.accent + "30" }]}
          activeOpacity={0.7}
          onPress={() => Linking.openURL("mailto:support@sportsphere.com")}
        >
          <MaterialCommunityIcons name="email-outline" size={18} color={cfg.accent} />
          <Text style={[styles.emailFallbackText, { color: cfg.accent }]}>
            Email us at support@sportsphere.com
          </Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FB" },

  header: {
    flexDirection: "row",
    paddingRight: 16,
    paddingLeft: 4,
    paddingVertical: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
  },
  backButton: { margin: 0 },
  headerTitle: { fontSize: 18, fontFamily: "Ubuntu-Bold" },
  headerSub: {
    fontSize: 12,
    fontFamily: "Ubuntu-Regular",
    color: "#9CA3AF",
    marginTop: 1,
  },
  priorityPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  priorityText: { fontSize: 10, fontFamily: "Ubuntu-Bold", letterSpacing: 0.4 },

  scroll: { padding: 16 },

  heroBanner: {
    backgroundColor: "#fff",
    borderRadius: 18,
    alignItems: "center",
    alignContent: "center",
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    gap: 14,
  },
  heroIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  heroTextBlock: { gap: 3 },
  heroTitle: { fontSize: 17, fontFamily: "Ubuntu-Bold", alignSelf: "center" },
  heroSubtitle: {
    fontSize: 12,
    fontFamily: "Ubuntu-Regular",
    color: "#6B7280",
    lineHeight: 17,
    alignSelf: "center",
  },
  newTicketBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    borderRadius: 12,
    paddingVertical: 13,
    gap: 6,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  newTicketText: { color: "#fff", fontSize: 14, fontFamily: "Ubuntu-Bold" },

  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  sectionAccent: {
    width: 3,
    height: 14,
    borderRadius: 2,
  },
  sectionTitle: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 11,
    color: "#6B7280",
    letterSpacing: 0.8,
    flex: 1,
  },
  countBadge: {
    paddingHorizontal: 9,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countText: { fontSize: 12, fontFamily: "Ubuntu-Bold" },

  rowCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  accentStrip: {
    width: 4,
    alignSelf: "stretch",
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
  },
  rowContent: { flex: 1, padding: 14 },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 5,
  },
  ticketNumber: {
    fontSize: 11,
    fontFamily: "Ubuntu-Medium",
    color: "#9CA3AF",
    letterSpacing: 0.3,
  },
  rowSubject: {
    fontSize: 14,
    fontFamily: "Ubuntu-Medium",
    color: "#111827",
    marginBottom: 6,
    lineHeight: 20,
  },
  rowFooter: { flexDirection: "row", alignItems: "center", gap: 4 },
  rowDate: { fontSize: 11, fontFamily: "Ubuntu-Regular", color: "#9CA3AF" },
  rowChevron: { marginRight: 12 },

  emptyWrap: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 8,
    marginBottom: 8,
  },
  emptyTitle: { fontSize: 15, fontFamily: "Ubuntu-Medium", color: "#9CA3AF" },
  emptySub: {
    fontSize: 12,
    fontFamily: "Ubuntu-Regular",
    color: "#D1D5DB",
    textAlign: "center",
  },

  faqCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
  },
  faqItem: { paddingHorizontal: 16 },
  faqQuestion: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    gap: 10,
  },
  faqQuestionText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Ubuntu-Medium",
    color: "#374151",
    lineHeight: 20,
  },
  faqAnswer: {
    borderLeftWidth: 3,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  faqAnswerText: {
    fontSize: 13,
    fontFamily: "Ubuntu-Regular",
    color: "#4B5563",
    lineHeight: 20,
  },
  faqDivider: { height: 1, backgroundColor: "#F3F4F6" },

  emailFallback: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: "#fff",
    marginTop: 4,
  },
  emailFallbackText: { fontSize: 13, fontFamily: "Ubuntu-Medium" },
});
