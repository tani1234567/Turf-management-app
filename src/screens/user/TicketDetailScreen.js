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
import { selectUser } from "../../store/slices/authSlice";
import {
  subscribeToTicket,
  subscribeToTicketMessages,
  sendTicketReply,
} from "../../services/firebase/support";
import TicketStatusBadge from "../../components/support/TicketStatusBadge";
import TicketMessageBubble from "../../components/support/TicketMessageBubble";

const USER_COLOR = "#10B981";
const EMERALD_PALE = "#D1FAE5";
const CLOSED_STATUSES = ["resolved", "closed"];

export default function TicketDetailScreen({ navigation, route }) {
  const { ticketId } = route.params;
  const user = useSelector(selectUser);
  const insets = useSafeAreaInsets();
  const userId = user?.id || user?.uid;

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
    return () => { unsubTicket(); unsubMessages(); };
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
      });
    } catch (e) {
      console.error("[TicketDetail] send error:", e);
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
        <View style={styles.header}>
          <IconButton icon="arrow-left" size={24} onPress={() => navigation.goBack()} style={styles.backButton} />
          <Text style={styles.headerTitle}>Loading…</Text>
        </View>
        <ActivityIndicator color={USER_COLOR} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (!ticket) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <IconButton icon="arrow-left" size={24} onPress={() => navigation.goBack()} style={styles.backButton} />
          <Text style={styles.headerTitle}>Ticket not found</Text>
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
        <View style={styles.header}>
          <IconButton icon="arrow-left" size={24} onPress={() => navigation.goBack()} style={styles.backButton} />
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>{ticket.subject}</Text>
            <View style={styles.headerMeta}>
              {ticket.ticketNumber ? (
                <View style={styles.ticketNumberChip}>
                  <Text style={styles.ticketNumberText}>{ticket.ticketNumber}</Text>
                </View>
              ) : null}
              <TicketStatusBadge status={ticket.status} />
            </View>
          </View>
        </View>

        {/* Description banner */}
        {ticket.description ? (
          <View style={styles.descriptionBanner}>
            <View style={styles.descriptionBannerHeader}>
              <MaterialCommunityIcons name="text-box-outline" size={14} color={USER_COLOR} />
              <Text style={styles.descriptionLabel}>Your original message</Text>
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
              <View style={styles.emptyIcon}>
                <MaterialCommunityIcons name="chat-outline" size={32} color={USER_COLOR} />
              </View>
              <Text style={styles.emptyThreadTitle}>No messages yet</Text>
              <Text style={styles.emptyThreadSub}>
                Our support team will reply here soon. Typical response time is under 24 hours.
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
              This ticket is {ticket.status}. Open a new ticket if you need more help.
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
              style={[styles.sendButton, (!replyText.trim() || sending) && styles.sendButtonDisabled]}
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
  container: { flex: 1, backgroundColor: "#F8FAF9" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 12,
    paddingBottom: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  backButton: { margin: 0 },
  headerCenter: { flex: 1, gap: 5 },
  headerTitle: { fontSize: 15, fontFamily: "Ubuntu-Bold", color: "#111827" },
  headerMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  ticketNumberChip: {
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  ticketNumberText: { fontSize: 11, fontFamily: "Ubuntu-Medium", color: "#6B7280", letterSpacing: 0.3 },

  descriptionBanner: {
    backgroundColor: "#F0FDF4",
    borderBottomWidth: 1,
    borderBottomColor: "#BBF7D0",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  descriptionBannerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 5,
  },
  descriptionLabel: { fontSize: 11, fontFamily: "Ubuntu-Bold", color: USER_COLOR, letterSpacing: 0.3 },
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
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F0FDF4",
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
    fontSize: 14,
    fontFamily: "Ubuntu-Regular",
    color: "#111827",
    maxHeight: 100,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: USER_COLOR,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: USER_COLOR,
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
