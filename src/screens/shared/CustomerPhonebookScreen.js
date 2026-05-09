import { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  Linking,
  Alert,
  RefreshControl,
} from "react-native";
import { Text, ActivityIndicator, Searchbar } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppSelector } from "../../hooks";
import { selectUser } from "../../store/slices/authSlice";
import { selectCompany } from "../../store/slices/companySlice";
import { queryDocuments } from "../../services/firebase/firestore";

// Avatar palette — one colour per letter bucket (26 letters → 8 colours cycling)
const AVATAR_PALETTE = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444",
  "#8B5CF6", "#EC4899", "#14B8A6", "#F97316",
];
const avatarColor = (name) =>
  AVATAR_PALETTE[((name || "?").toUpperCase().charCodeAt(0) - 65 + 26) % AVATAR_PALETTE.length];

const initials = (name) => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    : name.slice(0, 2).toUpperCase();
};

const normalizePhone = (raw) => {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits.length >= 6 ? digits : null;
};

const waUrl = (phone) => {
  const d = normalizePhone(phone);
  return d ? `https://wa.me/91${d}` : null;
};

const telUrl = (phone) => {
  const d = normalizePhone(phone);
  return d ? `tel:${d}` : null;
};

const formatLastDate = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

export default function CustomerPhonebookScreen({ navigation }) {
  const user = useAppSelector(selectUser);
  const company = useAppSelector(selectCompany);

  const isOwner = user?.role === "owner";
  const ACCENT = isOwner ? "#9C27B0" : "#3B82F6";
  const PALE   = isOwner ? "#F3E5F5" : "#DBEAFE";
  const NAVY   = isOwner ? "#4A148C" : "#1E40AF";

  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");

  const loadContacts = useCallback(async () => {
    const companyId = company?.id || user?.companyId;
    if (!companyId) { setLoading(false); return; }

    try {
      const bookings = await queryDocuments("bookings", [
        { field: "companyId", operator: "==", value: companyId },
      ]);

      const map = {};
      bookings.forEach((b) => {
        const phone = b.userPhone || b.customerPhone || "";
        const name  = (b.userName || b.customerName || "").trim();
        if (!phone || !name) return;

        const key = phone;
        if (!map[key]) {
          map[key] = {
            id: key,
            name,
            phone,
            bookingCount: 0,
            lastDate: null,
          };
        } else if (name.length > map[key].name.length) {
          // prefer longer / more complete name
          map[key].name = name;
        }
        map[key].bookingCount += 1;
        const dateStr = b.date || "";
        if (!map[key].lastDate || dateStr > map[key].lastDate) {
          map[key].lastDate = dateStr;
        }
      });

      const list = Object.values(map).sort((a, b) =>
        a.name.localeCompare(b.name, "en", { sensitivity: "base" })
      );
      setContacts(list);
    } catch (err) {
      console.error("CustomerPhonebook load error:", err);
      Alert.alert("Error", "Could not load customer contacts.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [company, user]);

  useEffect(() => { loadContacts(); }, [loadContacts]);

  const onRefresh = () => { setRefreshing(true); loadContacts(); };

  // Filter + group into A-Z sections
  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? contacts.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            (normalizePhone(c.phone) || "").includes(q)
        )
      : contacts;

    const grouped = {};
    filtered.forEach((c) => {
      const letter = c.name[0]?.toUpperCase() || "#";
      const key = /[A-Z]/.test(letter) ? letter : "#";
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(c);
    });

    return Object.keys(grouped)
      .sort((a, b) => (a === "#" ? 1 : b === "#" ? -1 : a.localeCompare(b)))
      .map((title) => ({ title, data: grouped[title] }));
  }, [contacts, query]);

  const totalContacts = contacts.length;
  const totalBookings = useMemo(
    () => contacts.reduce((s, c) => s + c.bookingCount, 0),
    [contacts]
  );

  const openLink = (url, label) => {
    if (!url) { Alert.alert("Unavailable", `No ${label} link for this contact.`); return; }
    Linking.openURL(url).catch(() =>
      Alert.alert("Error", `Could not open ${label}. Make sure the app is installed.`)
    );
  };

  // ── Sub-components ──────────────────────────────────────────────────────────

  const ContactCard = ({ item }) => {
    const bg   = avatarColor(item.name);
    const tel  = telUrl(item.phone);
    const wa   = waUrl(item.phone);
    const last = formatLastDate(item.lastDate);

    return (
      <View style={styles.card}>
        <View style={[styles.avatar, { backgroundColor: bg }]}>
          <Text style={styles.avatarText}>{initials(item.name)}</Text>
        </View>

        {/* Left — name / phone / last date stacked tight */}
        <View style={styles.cardBody}>
          <Text style={styles.contactName} numberOfLines={1}>{item.name}</Text>
          <View style={styles.metaRow}>
            <MaterialCommunityIcons name="phone-outline" size={11} color="#9CA3AF" />
            <Text style={styles.contactPhone}>{item.phone}</Text>
          </View>
          {last && (
            <View style={styles.metaRow}>
              <MaterialCommunityIcons name="calendar-outline" size={11} color="#9CA3AF" />
              <Text style={styles.lastDate}>Last booked {last}</Text>
            </View>
          )}
        </View>

        {/* Right — action buttons on top, booking pill below */}
        <View style={styles.actionsColumn}>
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: PALE }]}
              onPress={() => openLink(tel, "Phone")}
              activeOpacity={0.75}
            >
              <MaterialCommunityIcons name="phone" size={18} color={ACCENT} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: "#DCFCE7" }]}
              onPress={() => openLink(wa, "WhatsApp")}
              activeOpacity={0.75}
            >
              <MaterialCommunityIcons name="whatsapp" size={18} color="#22C55E" />
            </TouchableOpacity>
          </View>
          <View style={[styles.bookingPill, { backgroundColor: PALE }]}>
            <Text style={[styles.bookingPillText, { color: ACCENT }]}>
              {item.bookingCount} {item.bookingCount === 1 ? "booking" : "bookings"}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const SectionHeader = ({ title }) => (
    <View style={[styles.sectionHeader, { borderLeftColor: ACCENT }]}>
      <Text style={[styles.sectionHeaderText, { color: ACCENT }]}>{title}</Text>
    </View>
  );

  const EmptyState = () => (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: PALE }]}>
        <MaterialCommunityIcons name="account-group-outline" size={48} color={ACCENT} />
      </View>
      <Text style={[styles.emptyTitle, { color: NAVY }]}>
        {query ? "No contacts found" : "No customers yet"}
      </Text>
      <Text style={styles.emptySubtitle}>
        {query
          ? "Try a different name or number"
          : "Customer contacts will appear here once bookings are made"}
      </Text>
    </View>
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={NAVY} />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Text style={[styles.title, { color: NAVY }]}>Customer Directory</Text>
          {!loading && (
            <Text style={styles.subtitle}>{totalContacts} unique customers</Text>
          )}
        </View>
      </View>

      {/* Stats strip */}
      {!loading && totalContacts > 0 && (
        <View style={[styles.statsStrip, { backgroundColor: PALE }]}>
          <View style={styles.statItem}>
            <MaterialCommunityIcons name="account-multiple" size={16} color={ACCENT} />
            <Text style={[styles.statValue, { color: ACCENT }]}>{totalContacts}</Text>
            <Text style={styles.statLabel}>Customers</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: ACCENT + "30" }]} />
          <View style={styles.statItem}>
            <MaterialCommunityIcons name="calendar-check" size={16} color={ACCENT} />
            <Text style={[styles.statValue, { color: ACCENT }]}>{totalBookings}</Text>
            <Text style={styles.statLabel}>Total Bookings</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: ACCENT + "30" }]} />
          <View style={styles.statItem}>
            <MaterialCommunityIcons name="chart-bar" size={16} color={ACCENT} />
            <Text style={[styles.statValue, { color: ACCENT }]}>
              {totalContacts > 0 ? (totalBookings / totalContacts).toFixed(1) : "0"}
            </Text>
            <Text style={styles.statLabel}>Avg / Customer</Text>
          </View>
        </View>
      )}

      {/* Search */}
      <View style={styles.searchWrap}>
        <Searchbar
          placeholder="Search by name or number…"
          value={query}
          onChangeText={setQuery}
          style={styles.searchBar}
          inputStyle={styles.searchInput}
          iconColor={ACCENT}
          clearIcon="close-circle"
          elevation={0}
        />
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={ACCENT} />
          <Text style={styles.loadingText}>Loading contacts…</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ContactCard item={item} />}
          renderSectionHeader={({ section }) => <SectionHeader title={section.title} />}
          ListEmptyComponent={<EmptyState />}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={true}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[ACCENT]} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  headerTitle: { flex: 1 },
  title: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 20,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 1,
  },

  // Stats strip
  statsStrip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 14,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  statValue: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 18,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 10,
    color: "#6B7280",
  },
  statDivider: {
    width: 1,
    height: 32,
    marginHorizontal: 8,
  },

  // Search
  searchWrap: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  searchBar: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    height: 46,
  },
  searchInput: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 14,
    marginVertical: -4,
  },

  // List
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },

  // Section header
  sectionHeader: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginTop: 12,
    marginBottom: 4,
    borderLeftWidth: 3,
    borderRadius: 2,
    backgroundColor: "#F8FAFC",
  },
  sectionHeaderText: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 13,
    letterSpacing: 0.5,
  },

  // Contact card
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    marginTop: 2,
  },
  avatarText: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 14,
    color: "#fff",
  },
  cardBody: {
    flex: 1,
    gap: 5,
  },
  actionsColumn: {
    alignItems: "center",
    gap: 6,
    marginLeft: 8,
  },
  contactName: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 16,
    color: "#111827",
    letterSpacing: -0.2,
    flex: 1,
    marginRight: 6,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  contactPhone: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 14,
    color: "#4B5563",
    flex: 1,
  },
  lastDate: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 11,
    color: "#9CA3AF",
  },
  bookingPill: {
    borderRadius: 20,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  bookingPillText: {
    fontFamily: "Ubuntu-Medium",
    fontSize: 10,
  },

  // Action buttons — horizontal pair in the name row
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  // Empty state
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 18,
    textAlign: "center",
  },
  emptySubtitle: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 13,
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 20,
  },

  // Loader
  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 14,
    color: "#9CA3AF",
  },
});
