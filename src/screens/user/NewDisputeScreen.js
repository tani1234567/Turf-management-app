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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSelector } from "react-redux";
import { selectUser } from "../../store/slices/authSlice";
import { createDispute } from "../../services/firebase/support";

const USER_COLOR = "#10B981";
const PAGE_BG = "#F8FAF9";
const EMERALD_PALE = "#D1FAE5";

const DISPUTE_TYPES = [
  { value: "refund",          label: "Refund",          icon: "cash-refund" },
  { value: "service_quality", label: "Service Quality", icon: "star-off-outline" },
  { value: "overcharge",      label: "Overcharge",      icon: "currency-inr" },
  { value: "cancellation",    label: "Cancellation",    icon: "calendar-remove-outline" },
  { value: "other",           label: "Other",           icon: "dots-horizontal-circle-outline" },
];

export default function NewDisputeScreen({ navigation, route }) {
  const {
    bookingId,
    companyId,
    companyName,
    turfName,
    turfId,
  } = route.params || {};

  const user = useSelector(selectUser);
  const insets = useSafeAreaInsets();

  const [type, setType] = useState("refund");
  const [description, setDescription] = useState("");
  const [requestedAmount, setRequestedAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!description.trim() || description.trim().length < 20) {
      Alert.alert("More detail needed", "Please describe your issue in at least 20 characters.");
      return;
    }

    const amount = requestedAmount.trim() ? parseFloat(requestedAmount.trim()) : null;

    if (requestedAmount.trim() && (isNaN(amount) || amount <= 0)) {
      Alert.alert("Invalid amount", "Please enter a valid refund amount, or leave it blank.");
      return;
    }

    setSubmitting(true);
    try {
      await createDispute({
        bookingId,
        userId: user?.id || user?.uid,
        userName: user?.name || "User",
        userPhone: user?.phone || "",
        companyId: companyId || "",
        companyName: companyName || "",
        turfName: turfName || "",
        turfId: turfId || "",
        type,
        description,
        requestedAmount: amount,
      });

      Alert.alert(
        "Dispute Raised",
        "Your dispute has been submitted. Our team will review it and get back to you.",
        [{ text: "OK", onPress: () => navigation.navigate("Support") }]
      );
    } catch (e) {
      if (e.code === "dispute_exists") {
        Alert.alert(
          "Dispute Already Exists",
          "You already have an open dispute for this booking. View it in Help & Support.",
          [
            { text: "View", onPress: () => navigation.navigate("Support") },
            { text: "Cancel", style: "cancel" },
          ]
        );
      } else {
        console.error("[NewDispute] error:", e);
        Alert.alert("Error", "Failed to submit dispute. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        {/* Header */}
        <View style={styles.header}>
          <IconButton icon="arrow-left" size={24} onPress={() => navigation.goBack()} style={styles.backButton} />
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Raise a Dispute</Text>
            <Text style={styles.headerSub}>We'll review and respond within 24–48 hours</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} scrollEnabled={true}>
          {/* Context row */}
          {turfName ? (
            <View style={styles.contextRow}>
              <View style={styles.contextChip}>
                <MaterialCommunityIcons name="soccer-field" size={14} color={USER_COLOR} />
                <Text style={styles.contextChipText}>{turfName}</Text>
              </View>
              {companyName ? (
                <View style={[styles.contextChip, { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" }]}>
                  <MaterialCommunityIcons name="office-building-outline" size={14} color="#2563EB" />
                  <Text style={[styles.contextChipText, { color: "#2563EB" }]}>{companyName}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Info banner */}
          <View style={styles.infoBanner}>
            <View style={styles.infoBannerIcon}>
              <MaterialCommunityIcons name="shield-check-outline" size={18} color="#2563EB" />
            </View>
            <Text style={styles.infoText}>
              Disputes are reviewed by our support team. Refunds, if applicable, are processed within 5–7 business days.
            </Text>
          </View>

          {/* Dispute Type */}
          <Surface style={styles.formCard} elevation={1}>
            <View style={styles.formCardHeader}>
              <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#EF4444" />
              <Text style={styles.formCardTitle}>Dispute Type</Text>
            </View>
            <View style={styles.chipRow}>
              {DISPUTE_TYPES.map((t) => {
                const active = type === t.value;
                return (
                  <TouchableOpacity
                    key={t.value}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setType(t.value)}
                    activeOpacity={0.75}
                  >
                    <MaterialCommunityIcons
                      name={t.icon}
                      size={15}
                      color={active ? "#fff" : "#6B7280"}
                    />
                    <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Surface>

          {/* Description */}
          <Surface style={styles.formCard} elevation={1}>
            <View style={styles.formCardHeader}>
              <MaterialCommunityIcons name="text-long" size={16} color="#EF4444" />
              <Text style={styles.formCardTitle}>Describe Your Issue</Text>
            </View>
            <TextInput
              mode="outlined"
              placeholder="What happened? Include relevant dates, amounts, and what you expected."
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={6}
              style={[styles.input, styles.textarea]}
              outlineColor="#E5E7EB"
              activeOutlineColor="#EF4444"
            />
            <Text style={styles.charHint}>{description.trim().length}/20 characters minimum</Text>
          </Surface>

          {/* Amount */}
          <Surface style={styles.formCard} elevation={1}>
            <View style={styles.formCardHeader}>
              <MaterialCommunityIcons name="currency-inr" size={16} color="#D97706" />
              <Text style={styles.formCardTitle}>Refund Amount Requested</Text>
              <Text style={styles.optionalTag}>optional</Text>
            </View>
            <TextInput
              mode="outlined"
              placeholder="0"
              value={requestedAmount}
              onChangeText={setRequestedAmount}
              keyboardType="numeric"
              style={styles.input}
              outlineColor="#E5E7EB"
              activeOutlineColor={USER_COLOR}
              left={<TextInput.Icon icon="currency-inr" />}
            />
            <Text style={styles.charHint}>Leave blank if you don't know the exact amount.</Text>
          </Surface>

          <TouchableOpacity
            style={[styles.submitButton, submitting && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <MaterialCommunityIcons name="gavel" size={18} color="#fff" />
                <Text style={styles.submitText}>Submit Dispute</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 + insets.bottom }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 16,
    paddingVertical: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  backButton: { margin: 0 },
  headerCenter: { flex: 1, gap: 1 },
  headerTitle: { fontSize: 17, fontFamily: "Ubuntu-Bold", color: "#111827" },
  headerSub: { fontSize: 12, fontFamily: "Ubuntu-Regular", color: "#9CA3AF" },

  scroll: { padding: 16, gap: 12 },

  contextRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  contextChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: EMERALD_PALE,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#6EE7B7",
  },
  contextChipText: { fontSize: 12, fontFamily: "Ubuntu-Medium", color: USER_COLOR },

  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  infoBannerIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  infoText: { flex: 1, fontSize: 13, fontFamily: "Ubuntu-Regular", color: "#1D4ED8", lineHeight: 19 },

  formCard: { backgroundColor: "#fff", borderRadius: 14, padding: 14 },
  formCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  formCardTitle: { fontSize: 13, fontFamily: "Ubuntu-Bold", color: "#374151", flex: 1 },
  optionalTag: { fontSize: 11, fontFamily: "Ubuntu-Regular", color: "#9CA3AF" },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  chipActive: { backgroundColor: "#EF4444", borderColor: "#EF4444" },
  chipLabel: { fontSize: 13, fontFamily: "Ubuntu-Medium", color: "#6B7280" },
  chipLabelActive: { color: "#fff" },

  input: { backgroundColor: "#fff" },
  textarea: { minHeight: 120, paddingTop: 8 },
  charHint: { fontSize: 11, fontFamily: "Ubuntu-Regular", color: "#9CA3AF", marginTop: 6 },

  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EF4444",
    borderRadius: 14,
    paddingVertical: 15,
    gap: 8,
    marginTop: 8,
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  submitText: { color: "#fff", fontSize: 15, fontFamily: "Ubuntu-Bold" },
});
