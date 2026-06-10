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
import { createTicket } from "../../services/firebase/support";

const USER_COLOR = "#10B981";
const PAGE_BG = "#F8FAF9";
const EMERALD_PALE = "#D1FAE5";

const CATEGORIES = [
  { value: "booking",   label: "Booking",   icon: "calendar-check" },
  { value: "payment",   label: "Payment",   icon: "credit-card-outline" },
  { value: "account",   label: "Account",   icon: "account-circle-outline" },
  { value: "technical", label: "Technical", icon: "wrench-outline" },
  { value: "other",     label: "Other",     icon: "dots-horizontal-circle-outline" },
];

export default function NewTicketScreen({ navigation, route }) {
  const { relatedBookingId = null } = route.params || {};
  const user = useSelector(selectUser);
  const insets = useSafeAreaInsets();

  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("booking");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!subject.trim()) {
      Alert.alert("Subject required", "Please enter a subject for your ticket.");
      return;
    }
    if (!description.trim() || description.trim().length < 20) {
      Alert.alert("Description too short", "Please describe your issue in at least 20 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const ticketId = await createTicket({
        subject,
        category,
        description,
        userId: user?.id || user?.uid,
        userName: user?.name || "User",
        userPhone: user?.phone || "",
        userEmail: user?.email || null,
        relatedBookingId,
      });

      Alert.alert(
        "Ticket Submitted",
        "We received your request and will get back to you soon.",
        [{ text: "View Ticket", onPress: () => navigation.replace("TicketDetail", { ticketId }) }]
      );
    } catch (e) {
      console.error("[NewTicket] error:", e);
      Alert.alert("Error", "Failed to submit ticket. Please try again.");
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
            <Text style={styles.headerTitle}>New Support Ticket</Text>
            <Text style={styles.headerSub}>Describe your issue and we'll help you out</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} scrollEnabled={true}>
          {relatedBookingId && (
            <View style={styles.bookingChip}>
              <MaterialCommunityIcons name="link-variant" size={14} color={USER_COLOR} />
              <Text style={styles.bookingChipText}>Linked to booking #{relatedBookingId.slice(-6)}</Text>
            </View>
          )}

          {/* Category */}
          <Surface style={styles.formCard} elevation={1}>
            <View style={styles.formCardHeader}>
              <MaterialCommunityIcons name="tag-outline" size={16} color={USER_COLOR} />
              <Text style={styles.formCardTitle}>Category</Text>
            </View>
            <View style={styles.chipRow}>
              {CATEGORIES.map((c) => {
                const active = category === c.value;
                return (
                  <TouchableOpacity
                    key={c.value}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setCategory(c.value)}
                    activeOpacity={0.75}
                  >
                    <MaterialCommunityIcons
                      name={c.icon}
                      size={15}
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
              <MaterialCommunityIcons name="text-short" size={16} color={USER_COLOR} />
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
              activeOutlineColor={USER_COLOR}
              theme={{ fonts: { bodyLarge: { fontFamily: "Ubuntu-Regular" } } }}
            />
          </Surface>

          {/* Description */}
          <Surface style={styles.formCard} elevation={1}>
            <View style={styles.formCardHeader}>
              <MaterialCommunityIcons name="text-long" size={16} color={USER_COLOR} />
              <Text style={styles.formCardTitle}>Description</Text>
            </View>
            <TextInput
              mode="outlined"
              placeholder="Describe your issue in detail — what happened, when, and what you expected."
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={6}
              style={[styles.input, styles.textarea]}
              outlineColor="#E5E7EB"
              activeOutlineColor={USER_COLOR}
            />
            <Text style={styles.charHint}>{description.trim().length}/20 characters minimum</Text>
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
                <MaterialCommunityIcons name="send" size={18} color="#fff" />
                <Text style={styles.submitText}>Submit Ticket</Text>
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

  bookingChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: EMERALD_PALE,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    alignSelf: "flex-start",
    marginBottom: 4,
  },
  bookingChipText: { fontSize: 12, fontFamily: "Ubuntu-Medium", color: USER_COLOR },

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
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  chipActive: { backgroundColor: USER_COLOR, borderColor: USER_COLOR },
  chipLabel: { fontSize: 13, fontFamily: "Ubuntu-Medium", color: "#6B7280" },
  chipLabelActive: { color: "#fff" },

  input: { backgroundColor: "#fff" },
  textarea: { minHeight: 120, paddingTop: 8 },
  charHint: { fontSize: 11, fontFamily: "Ubuntu-Regular", color: "#9CA3AF", marginTop: 6 },

  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: USER_COLOR,
    borderRadius: 14,
    paddingVertical: 15,
    gap: 8,
    marginTop: 8,
    shadowColor: USER_COLOR,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  submitText: { color: "#fff", fontSize: 15, fontFamily: "Ubuntu-Bold" },
});
