import { useState, useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import {
  Text,
  Surface,
  Button,
  Chip,
  TextInput,
  IconButton,
  Divider,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { updateDocument } from "../../services/firebase/firestore";

const MANAGER_BLUE = "#3B82F6";

const MONTH_NAMES_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const getMonthOptionsFrom = (startDateStr) => {
  const [y, m] = startDateStr.split("-").map(Number);
  return Array.from({ length: 3 }, (_, i) => {
    const t = new Date(y, m - 1 + i, 1);
    const key = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`;
    return { key, label: `${MONTH_NAMES_FULL[t.getMonth()]} ${t.getFullYear()}` };
  });
};

const getLastDayOfMonth = (monthKey) => {
  const [y, m] = monthKey.split("-").map(Number);
  const last = new Date(y, m, 0);
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
};

const getTodayString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const formatDate = (dateStr) => {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${parseInt(day)} ${months[parseInt(month) - 1]} ${year}`;
};

const addMonthsToDate = (dateStr, months) => {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const date = new Date(y, mo - 1 + months, d);
  const targetMonth = (mo - 1 + months) % 12;
  if (date.getMonth() !== targetMonth) date.setDate(0);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const getDayOfWeek = (dateStr) => {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const date = new Date(y, mo - 1, d);
  return ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"][date.getDay()];
};

const generateSessionDates = (startDate, endDate, scheduledDays) => {
  const dates = [];
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  const current = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  while (current <= end) {
    const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`;
    if (scheduledDays.includes(getDayOfWeek(dateStr))) dates.push(dateStr);
    current.setDate(current.getDate() + 1);
  }
  return dates;
};

const computeInitialStartDate = (academy) => {
  const oldEnd = academy?.contract?.endDate;
  const today = getTodayString();
  if (!oldEnd || oldEnd < today) return today;
  const [y, m, d] = oldEnd.split("-").map(Number);
  const next = new Date(y, m - 1, d + 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
};

export default function RenewAcademyScreen({ navigation, route }) {
  const { academy } = route.params || {};

  const [startDate] = useState(() => computeInitialStartDate(academy));
  const monthOptions = useMemo(() => getMonthOptionsFrom(startDate), [startDate]);
  const [selectedMonths, setSelectedMonths] = useState(() => [getMonthOptionsFrom(computeInitialStartDate(academy))[0].key]);
  const [totalAmount, setTotalAmount] = useState(String(academy?.payment?.totalAmount || ""));
  const [cashAmount, setCashAmount] = useState(String(academy?.payment?.cashAmount || ""));
  const [submitting, setSubmitting] = useState(false);

  const toggleMonth = useCallback((key) => {
    setSelectedMonths((prev) => {
      if (prev.includes(key)) {
        if (prev.length === 1) return prev;
        return prev.filter((k) => k !== key).sort();
      }
      return [...prev, key].sort();
    });
  }, []);

  const endDate = useMemo(() => {
    const sorted = [...selectedMonths].sort();
    return getLastDayOfMonth(sorted[sorted.length - 1]);
  }, [selectedMonths]);

  const scheduledDays = useMemo(() => {
    const sched = academy?.schedule?.days;
    return Array.isArray(sched) ? sched : (sched ? Object.keys(sched) : []);
  }, [academy]);

  const sessionCount = useMemo(
    () => scheduledDays.length === 0 ? 0 : generateSessionDates(startDate, endDate, scheduledDays).length,
    [startDate, endDate, scheduledDays]
  );

  const onlineAmount = useMemo(
    () => Math.max(0, (parseFloat(totalAmount) || 0) - (parseFloat(cashAmount) || 0)),
    [totalAmount, cashAmount]
  );

  const handleSubmit = useCallback(async () => {
    const total = parseFloat(totalAmount) || 0;
    const cash = parseFloat(cashAmount) || 0;

    if (total <= 0) { Alert.alert("Invalid", "Please enter a valid total amount."); return; }
    if (cash > total) { Alert.alert("Invalid", "Cash amount cannot exceed total amount."); return; }
    if (sessionCount === 0) { Alert.alert("No Sessions", "The selected schedule produces no sessions in this period."); return; }

    setSubmitting(true);
    try {
      await updateDocument("academies", academy.id, {
        "contract.startDate": startDate,
        "contract.endDate": endDate,
        "contract.selectedMonths": selectedMonths,
        "payment.totalAmount": total,
        "payment.cashAmount": cash,
        "payment.onlineAmount": total - cash,
        status: "active",
        sessionsGenerated: false,
        renewalReminderSent: false,
        renewedAt: new Date(),
        renewalHistory: [
          ...(academy.renewalHistory || []),
          {
            previousStartDate: academy.contract?.startDate,
            previousEndDate: academy.contract?.endDate,
            newStartDate: startDate,
            newEndDate: endDate,
            selectedMonths,
            amount: total,
            renewedAt: new Date().toISOString(),
          },
        ],
      });
      Alert.alert(
        "Academy Renewed",
        `"${academy.name}" has been renewed. ${sessionCount} new sessions are being generated.`,
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      Alert.alert("Error", "Failed to renew academy. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [academy, startDate, endDate, selectedMonths, totalAmount, cashAmount, sessionCount, navigation]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton icon="arrow-left" onPress={() => navigation.goBack()} disabled={submitting} />
        <Text variant="titleLarge" style={styles.headerTitle}>Renew Academy</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Academy info card */}
          <Surface style={styles.infoCard} elevation={1}>
            <Text style={styles.academyName}>{academy?.name}</Text>
            <Text style={styles.infoText}>{academy?.sport} · {academy?.groundName}</Text>
            <Text style={styles.infoText}>
              Previous: {formatDate(academy?.contract?.startDate)} – {formatDate(academy?.contract?.endDate)}
            </Text>
            {scheduledDays.length > 0 && (
              <Text style={styles.infoText}>
                Days: {scheduledDays.map((d) => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(", ")}
              </Text>
            )}
          </Surface>

          {/* Month selection */}
          <Text style={styles.fieldLabel}>Renew For Months (select one or more)</Text>
          <View style={styles.chipGroup}>
            {monthOptions.map((opt) => (
              <Chip
                key={opt.key}
                selected={selectedMonths.includes(opt.key)}
                onPress={() => toggleMonth(opt.key)}
                mode="outlined"
                style={styles.chip}
                selectedColor={MANAGER_BLUE}
              >
                {opt.label}
              </Chip>
            ))}
          </View>

          {/* Contract Summary */}
          <Surface style={styles.summaryCard} elevation={1}>
            <Text style={styles.summaryTitle}>New Contract Period</Text>
            {[
              { icon: "calendar-start", label: "Start:", value: formatDate(startDate) },
              { icon: "calendar-end",   label: "End:",   value: formatDate(endDate) },
              {
                icon: "calendar-month", label: "Months:", value: (() => {
                  const sel = monthOptions.filter((o) => selectedMonths.includes(o.key));
                  if (sel.length === 1) return sel[0].label;
                  if (sel.length === monthOptions.length) return `${sel[0].label} – ${sel[sel.length - 1].label}`;
                  return sel.map((o) => o.label).join(", ");
                })(),
              },
            ].map(({ icon, label, value }) => (
              <View key={label} style={styles.summaryRow}>
                <MaterialCommunityIcons name={icon} size={18} color="#666" />
                <Text style={styles.summaryLabel}>{label}</Text>
                <Text style={styles.summaryValue}>{value}</Text>
              </View>
            ))}
            <View style={styles.summaryRow}>
              <MaterialCommunityIcons name="counter" size={18} color="#666" />
              <Text style={styles.summaryLabel}>Sessions:</Text>
              <Text style={[styles.summaryValue, { color: MANAGER_BLUE, fontWeight: "700" }]}>{sessionCount}</Text>
            </View>
          </Surface>

          {/* Payment */}
          <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Payment</Text>
          <TextInput
            label="Total Amount (₹) *"
            value={totalAmount}
            onChangeText={setTotalAmount}
            mode="outlined"
            style={styles.input}
            keyboardType="numeric"
            outlineColor="#ddd"
            activeOutlineColor={MANAGER_BLUE}
          />
          <TextInput
            label="Cash Amount (₹)"
            value={cashAmount}
            onChangeText={setCashAmount}
            mode="outlined"
            style={styles.input}
            keyboardType="numeric"
            outlineColor="#ddd"
            activeOutlineColor={MANAGER_BLUE}
          />

          <Surface style={styles.paymentCard} elevation={1}>
            <Text style={styles.summaryTitle}>Payment Breakdown</Text>
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>Total</Text>
              <Text style={styles.paymentValue}>₹{parseFloat(totalAmount) || 0}</Text>
            </View>
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>Cash</Text>
              <Text style={styles.paymentValue}>₹{parseFloat(cashAmount) || 0}</Text>
            </View>
            <Divider style={{ marginVertical: 8 }} />
            <View style={styles.paymentRow}>
              <Text style={[styles.paymentLabel, { fontWeight: "700" }]}>Online</Text>
              <Text style={[styles.paymentValue, { color: MANAGER_BLUE, fontWeight: "700" }]}>₹{onlineAmount}</Text>
            </View>
            {sessionCount > 0 && parseFloat(totalAmount) > 0 && (
              <>
                <Divider style={{ marginVertical: 8 }} />
                <View style={styles.paymentRow}>
                  <Text style={styles.paymentLabel}>Per Session</Text>
                  <Text style={styles.paymentValue}>₹{(parseFloat(totalAmount) / sessionCount).toFixed(0)}</Text>
                </View>
              </>
            )}
          </Surface>

          <View style={{ height: 24 }} />
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <Button
            mode="outlined"
            onPress={() => navigation.goBack()}
            style={styles.footerBtn}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            mode="contained"
            onPress={handleSubmit}
            style={[styles.footerBtn, { flex: 1 }]}
            buttonColor="#4CAF50"
            loading={submitting}
            disabled={submitting}
            icon="refresh"
          >
            Renew Academy
          </Button>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F0F4F8" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingRight: 4,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  headerTitle: { fontWeight: "bold", color: "#333", flex: 1 },

  content: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },

  infoCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#E3F2FD",
    marginBottom: 20,
    gap: 4,
  },
  academyName: { fontSize: 17, fontWeight: "700", color: "#1a1a2e", marginBottom: 2 },
  infoText: { fontSize: 13, color: "#555" },

  fieldLabel: { fontSize: 14, fontWeight: "600", color: "#444", marginBottom: 8, marginTop: 4 },

  dateNav: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  dateDisplay: {
    flex: 1, alignItems: "center", paddingVertical: 12,
    backgroundColor: "#fff", borderRadius: 8, borderWidth: 1, borderColor: "#ddd",
  },
  dateDisplayText: { fontSize: 16, fontWeight: "600", color: "#333" },

  chipGroup: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  chip: { marginBottom: 4 },

  summaryCard: { padding: 16, borderRadius: 12, backgroundColor: "#fff", marginBottom: 4 },
  summaryTitle: { fontSize: 15, fontWeight: "700", color: "#212121", marginBottom: 12 },
  summaryRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  summaryLabel: { fontSize: 13, color: "#666", width: 70 },
  summaryValue: { fontSize: 14, color: "#333", fontWeight: "500", flex: 1 },

  input: { marginBottom: 12, backgroundColor: "#fff" },

  paymentCard: { padding: 16, borderRadius: 12, backgroundColor: "#fff", marginBottom: 4 },
  paymentRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  paymentLabel: { fontSize: 14, color: "#666" },
  paymentValue: { fontSize: 14, color: "#333", fontWeight: "500" },

  footer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  footerBtn: { minWidth: 100 },
});
