import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { Text, Surface, TextInput, IconButton, ActivityIndicator } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSelector } from "react-redux";
import { selectUser, selectUserRole } from "../../store/slices/authSlice";
import { selectCompanyName, selectCompanyId } from "../../store/slices/companySlice";
import { createBusinessTicket } from "../../services/firebase/support";

// ─── Role Config ──────────────────────────────────────────────────────────────

const ROLE_CONFIG = {
  manager: {
    accent: "#3B82F6",
    pale: "#EFF6FF",
    navy: "#1E40AF",
    label: "Business Manager",
    priorityLabel: "Standard · 24 hr response",
    priorityIcon: "clock-outline",
    priorityColor: "#3B82F6",
    priorityBg: "#EFF6FF",
  },
  owner: {
    accent: "#9C27B0",
    pale: "#F3E5F5",
    navy: "#4A148C",
    label: "Turf Owner",
    priorityLabel: "Priority · 4 hr response",
    priorityIcon: "star-circle",
    priorityColor: "#9C27B0",
    priorityBg: "#F3E5F5",
  },
  caretaker: {
    accent: "#F97316",
    pale: "#FFF7ED",
    navy: "#7C2D12",
    label: "Caretaker",
    priorityLabel: "Standard · 48 hr response",
    priorityIcon: "clock-outline",
    priorityColor: "#F97316",
    priorityBg: "#FFF7ED",
  },
};

const DEFAULT_CONFIG = ROLE_CONFIG.manager;

// ─── Role-specific categories ─────────────────────────────────────────────────

const CATEGORIES = {
  owner: [
    { value: "subscription",    label: "Subscription & Billing", icon: "credit-card-outline" },
    { value: "platform",        label: "Platform Issue",         icon: "monitor-cellphone" },
    { value: "team_management", label: "Team",                   icon: "account-group-outline" },
    { value: "turf_management", label: "Turf Config",            icon: "soccer-field" },
    { value: "account",         label: "Account",                icon: "account-circle-outline" },
    { value: "other",           label: "Other",                  icon: "dots-horizontal-circle-outline" },
  ],
  manager: [
    { value: "booking_management", label: "Bookings",  icon: "calendar-check-outline" },
    { value: "pricing_slots",      label: "Pricing",   icon: "tag-outline" },
    { value: "staff_management",   label: "Staff",     icon: "account-group-outline" },
    { value: "payment_collection", label: "Payments",  icon: "cash-check" },
    { value: "technical",          label: "Technical", icon: "wrench-outline" },
    { value: "other",              label: "Other",     icon: "dots-horizontal-circle-outline" },
  ],
  caretaker: [
    { value: "access_issues",      label: "Access",    icon: "lock-open-outline" },
    { value: "turf_assignment",    label: "Assignment",icon: "soccer-field" },
    { value: "booking_handling",   label: "Bookings",  icon: "calendar-outline" },
    { value: "payment_collection", label: "Payments",  icon: "cash-check" },
    { value: "technical",          label: "Technical", icon: "wrench-outline" },
    { value: "other",              label: "Other",     icon: "dots-horizontal-circle-outline" },
  ],
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function BusinessNewTicketScreen({ navigation }) {
  const user = useSelector(selectUser);
  const role = useSelector(selectUserRole) || "manager";
  const companyName = useSelector(selectCompanyName);
  const companyId = useSelector(selectCompanyId);

  const userId = user?.id || user?.userId || user?.uid;
  const cfg = ROLE_CONFIG[role] || DEFAULT_CONFIG;
  const categories = CATEGORIES[role] || CATEGORIES.manager;

  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState(categories[0].value);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!subject.trim()) {
      Alert.alert("Subject required", "Please enter a brief summary of your issue.");
      return;
    }
    if (!description.trim() || description.trim().length < 20) {
      Alert.alert("Description too short", "Please describe your issue in at least 20 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const ticketId = await createBusinessTicket({
        subject,
        category,
        description,
        userId,
        userName: user?.name || cfg.label,
        userPhone: user?.phone || "",
        userEmail: user?.email || null,
        senderRole: role,
        companyId: companyId || null,
        companyName: companyName || null,
      });

      Alert.alert(
        "Ticket Submitted",
        "We received your request. You'll get a notification when we reply.",
        [
          {
            text: "View Ticket",
            onPress: () =>
              navigation.replace("BusinessTicketDetail", { ticketId }),
          },
        ]
      );
    } catch (e) {
      console.error("[BusinessNewTicket] error:", e);
      Alert.alert("Error", "Failed to submit ticket. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const descLen = description.trim().length;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: cfg.pale }]}>
          <IconButton
            icon="arrow-left"
            size={24}
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            iconColor={cfg.navy}
          />
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: cfg.navy }]}>New Support Ticket</Text>
            <Text style={styles.headerSub}>Describe your issue and we'll get right on it</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Priority info chip */}
          <View style={[styles.priorityChip, { backgroundColor: cfg.priorityBg, borderColor: cfg.accent + "30" }]}>
            <MaterialCommunityIcons name={cfg.priorityIcon} size={14} color={cfg.priorityColor} />
            <Text style={[styles.priorityChipText, { color: cfg.priorityColor }]}>
              {cfg.priorityLabel}
            </Text>
          </View>

          {/* Category */}
          <Surface style={styles.formCard} elevation={1}>
            <View style={styles.formCardHeader}>
              <MaterialCommunityIcons name="tag-outline" size={16} color={cfg.accent} />
              <Text style={styles.formCardTitle}>Category</Text>
            </View>
            <View style={styles.chipRow}>
              {categories.map((c) => {
                const active = category === c.value;
                return (
                  <TouchableOpacity
                    key={c.value}
                    style={[
                      styles.chip,
                      active && { backgroundColor: cfg.accent, borderColor: cfg.accent },
                    ]}
                    onPress={() => setCategory(c.value)}
                    activeOpacity={0.75}
                  >
                    <MaterialCommunityIcons
                      name={c.icon}
                      size={14}
                      color={active ? "#fff" : "#6B7280"}
                    />
                    <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                      {c.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Surface>

          {/* Subject */}
          <Surface style={styles.formCard} elevation={1}>
            <View style={styles.formCardHeader}>
              <MaterialCommunityIcons name="text-short" size={16} color={cfg.accent} />
              <Text style={styles.formCardTitle}>Subject</Text>
            </View>
            <TextInput
              mode="outlined"
              placeholder="Brief summary of your issue"
              value={subject}
              onChangeText={setSubject}
              maxLength={120}
              style={styles.input}
              outlineColor="#E5E7EB"
              activeOutlineColor={cfg.accent}
            />
          </Surface>

          {/* Description */}
          <Surface style={styles.formCard} elevation={1}>
            <View style={styles.formCardHeader}>
              <MaterialCommunityIcons name="text-long" size={16} color={cfg.accent} />
              <Text style={styles.formCardTitle}>Description</Text>
            </View>
            <TextInput
              mode="outlined"
              placeholder="Describe the issue in detail — what happened, when it started, and what you expected."
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={6}
              style={[styles.input, styles.textarea]}
              outlineColor="#E5E7EB"
              activeOutlineColor={cfg.accent}
            />
            <Text style={[styles.charHint, descLen >= 20 && { color: cfg.accent }]}>
              {descLen < 20 ? `${descLen}/20 characters minimum` : `${descLen} characters`}
            </Text>
          </Surface>

          <TouchableOpacity
            style={[
              styles.submitButton,
              { backgroundColor: cfg.accent, shadowColor: cfg.accent },
              submitting && { opacity: 0.7 },
            ]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <MaterialCommunityIcons name="send" size={18} color="#fff" />
                <Text style={styles.submitText}>Submit Ticket</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FB" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 16,
    paddingLeft: 4,
    padding: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
  },
  backButton: { margin: 0 },
  headerCenter: { flex: 1, gap: 1 },
  headerTitle: { fontSize: 17, fontFamily: "Ubuntu-Bold" },
  headerSub: { fontSize: 12, fontFamily: "Ubuntu-Regular", color: "#9CA3AF" },

  scroll: { padding: 16, gap: 12 },

  priorityChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 4,
  },
  priorityChipText: { fontSize: 12, fontFamily: "Ubuntu-Medium" },

  formCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
  },
  formCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  formCardTitle: { fontSize: 13, fontFamily: "Ubuntu-Bold", color: "#374151" },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  chipLabel: { fontSize: 12, fontFamily: "Ubuntu-Medium", color: "#6B7280" },
  chipLabelActive: { color: "#fff" },

  input: { backgroundColor: "#fff" },
  textarea: { minHeight: 120, paddingTop: 10 },
  charHint: {
    fontSize: 11,
    fontFamily: "Ubuntu-Regular",
    color: "#9CA3AF",
    marginTop: 6,
    textAlign: "right",
  },

  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    paddingVertical: 15,
    gap: 8,
    marginTop: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  submitText: { color: "#fff", fontSize: 15, fontFamily: "Ubuntu-Bold" },
});
