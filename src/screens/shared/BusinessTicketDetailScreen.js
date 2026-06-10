import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { Text, ActivityIndicator, IconButton } from "react-native-paper";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSelector } from "react-redux";
import { selectUser, selectUserRole } from "../../store/slices/authSlice";
import {
  subscribeToTicket,
  subscribeToTicketMessages,
  sendTicketReply,
} from "../../services/firebase/support";
import TicketStatusBadge from "../../components/support/TicketStatusBadge";
import TicketMessageBubble from "../../components/support/TicketMessageBubble";

// ─── Role Config ──────────────────────────────────────────────────────────────

const ROLE_CONFIG = {
  manager:   { accent: "#3B82F6", pale: "#EFF6FF", navy: "#1E40AF", descBg: "#F0F8FF", descBorder: "#BFDBFE" },
  owner:     { accent: "#9C27B0", pale: "#F3E5F5", navy: "#4A148C", descBg: "#FAF5FF", descBorder: "#E9D5FF" },
  caretaker: { accent: "#F97316", pale: "#FFF7ED", navy: "#7C2D12", descBg: "#FFFBEB", descBorder: "#FED7AA" },
};

const DEFAULT_CONFIG = ROLE_CONFIG.manager;
const CLOSED_STATUSES = ["resolved", "closed"];

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function BusinessTicketDetailScreen({ navigation, route }) {
  const { ticketId } = route.params;
  const user = useSelector(selectUser);
  const role = useSelector(selectUserRole) || "manager";
  const insets = useSafeAreaInsets();

  const userId = user?.id || user?.uid;
  const cfg = ROLE_CONFIG[role] || DEFAULT_CONFIG;

  const [ticket, setTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  const flatListRef = useRef(null);

  useEffect(() => {
    const unsubTicket = subscribeToTicket(ticketId, (t) => {
      setTicket(t);
      setLoading(false);
    });
    const unsubMessages = subscribeToTicketMessages(ticketId, (msgs) => {
      setMessages(msgs);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    });
    return () => {
      unsubTicket();
      unsubMessages();
    };
  }, [ticketId]);

  const handleSend = async () => {
    const text = replyText.trim();
    if (!text) return;
    setSending(true);
    setReplyText("");
    try {
      await sendTicketReply(ticketId, {
        userId,
        userName: user?.name || "User",
        text,
        senderRole: role,
      });
    } catch (e) {
      console.error("[BusinessTicketDetail] send error:", e);
      Alert.alert("Error", "Failed to send message. Please try again.");
      setReplyText(text);
    } finally {
      setSending(false);
    }
  };

  const isClosed = ticket ? CLOSED_STATUSES.includes(ticket.status) : false;

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={[styles.header, { borderBottomColor: cfg.pale }]}>
          <IconButton icon="arrow-left" size={24} onPress={() => navigation.goBack()} style={styles.backButton} iconColor={cfg.navy} />
          <Text style={[styles.headerTitle, { color: cfg.navy }]}>Loading…</Text>
        </View>
        <ActivityIndicator color={cfg.accent} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (!ticket) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={[styles.header, { borderBottomColor: cfg.pale }]}>
          <IconButton icon="arrow-left" size={24} onPress={() => navigation.goBack()} style={styles.backButton} iconColor={cfg.navy} />
          <Text style={[styles.headerTitle, { color: cfg.navy }]}>Ticket not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
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
            <Text style={[styles.headerTitle, { color: cfg.navy }]} numberOfLines={1}>
              {ticket.subject}
            </Text>
            <View style={styles.headerMeta}>
              {ticket.ticketNumber ? (
                <View style={[styles.ticketNumberChip, { backgroundColor: cfg.pale }]}>
                  <Text style={[styles.ticketNumberText, { color: cfg.accent }]}>
                    {ticket.ticketNumber}
                  </Text>
                </View>
              ) : null}
              <TicketStatusBadge status={ticket.status} />
            </View>
          </View>
        </View>

        {/* Category + meta banner */}
        <View style={[styles.metaBanner, { backgroundColor: cfg.pale }]}>
          <MaterialCommunityIcons name="tag-outline" size={13} color={cfg.accent} />
          <Text style={[styles.metaText, { color: cfg.accent }]}>
            {ticket.category?.replace(/_/g, " ") || "General"}
          </Text>
          {ticket.companyName ? (
            <>
              <View style={styles.metaDot} />
              <MaterialCommunityIcons name="office-building-outline" size={13} color={cfg.accent} />
              <Text style={[styles.metaText, { color: cfg.accent }]} numberOfLines={1}>
                {ticket.companyName}
              </Text>
            </>
          ) : null}
        </View>

        {/* Description */}
        {ticket.description ? (
          <View style={[styles.descriptionBanner, { backgroundColor: cfg.descBg, borderBottomColor: cfg.descBorder }]}>
            <View style={styles.descriptionHeader}>
              <MaterialCommunityIcons name="text-box-outline" size={13} color={cfg.accent} />
              <Text style={[styles.descriptionLabel, { color: cfg.accent }]}>Your original message</Text>
            </View>
            <Text style={styles.descriptionText}>{ticket.description}</Text>
          </View>
        ) : null}

        {/* Message thread */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => <TicketMessageBubble message={item} />}
          contentContainerStyle={styles.thread}
          ListEmptyComponent={
            <View style={styles.emptyThread}>
              <View style={[styles.emptyIcon, { backgroundColor: cfg.pale }]}>
                <MaterialCommunityIcons name="chat-outline" size={30} color={cfg.accent} />
              </View>
              <Text style={styles.emptyThreadTitle}>No messages yet</Text>
              <Text style={styles.emptyThreadSub}>
                Our support team will reply here. Replies also come as push notifications.
              </Text>
            </View>
          }
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />

        {/* Closed banner or reply input */}
        {isClosed ? (
          <View style={[styles.closedBanner, { paddingBottom: insets.bottom + 12 }]}>
            <View style={styles.closedIconWrap}>
              <MaterialCommunityIcons name="lock-outline" size={16} color="#6B7280" />
            </View>
            <Text style={styles.closedText}>
              This ticket is {ticket.status}. Open a new ticket if you need further assistance.
            </Text>
          </View>
        ) : (
          <View style={[styles.replyBar, { paddingBottom: insets.bottom + 10 }]}>
            <TextInput
              style={styles.replyInput}
              placeholder="Type a message…"
              placeholderTextColor="#9CA3AF"
              value={replyText}
              onChangeText={setReplyText}
              multiline
              maxLength={1000}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                { backgroundColor: cfg.accent, shadowColor: cfg.accent },
                (!replyText.trim() || sending) && styles.sendButtonDisabled,
              ]}
              onPress={handleSend}
              disabled={!replyText.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator color="#fff" size={16} />
              ) : (
                <MaterialCommunityIcons name="send" size={18} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FB" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 12,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
  },
  backButton: { margin: 0 },
  headerCenter: { flex: 1, gap: 5 },
  headerTitle: { fontSize: 15, fontFamily: "Ubuntu-Bold" },
  headerMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  ticketNumberChip: {
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  ticketNumberText: { fontSize: 11, fontFamily: "Ubuntu-Bold", letterSpacing: 0.3 },

  metaBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  metaText: {
    fontSize: 12,
    fontFamily: "Ubuntu-Medium",
    textTransform: "capitalize",
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#1f64cd",
    marginHorizontal: 2,
  },

  descriptionBanner: {
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  descriptionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 5,
  },
  descriptionLabel: { fontSize: 11, fontFamily: "Ubuntu-Bold", letterSpacing: 0.3 },
  descriptionText: { fontSize: 13, fontFamily: "Ubuntu-Regular", color: "#374151", lineHeight: 19 },

  thread: { paddingTop: 14, paddingBottom: 10, flexGrow: 1 },

  emptyThread: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
    paddingHorizontal: 32,
    gap: 10,
  },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyThreadTitle: { fontSize: 15, fontFamily: "Ubuntu-Bold", color: "#374151" },
  emptyThreadSub: {
    fontSize: 13,
    fontFamily: "Ubuntu-Regular",
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 19,
  },

  closedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F9FAFB",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  closedIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  closedText: { flex: 1, fontSize: 13, fontFamily: "Ubuntu-Regular", color: "#6B7280", lineHeight: 18 },

  replyBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingTop: 10,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    gap: 8,
  },
  replyInput: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
    fontSize: 16,
    fontFamily: "Ubuntu-Regular",
    color: "#111827",
    maxHeight: 100,
    paddingVertical: 12,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  sendButtonDisabled: {
    opacity: 0.4,
    shadowOpacity: 0,
    elevation: 0,
  },
});
