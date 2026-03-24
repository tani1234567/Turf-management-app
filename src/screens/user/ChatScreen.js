import React, { useCallback, useMemo, useRef, useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  Platform,
  Alert,
  Linking,
  KeyboardAvoidingView,
} from "react-native";
import { Text, Avatar, IconButton, ActivityIndicator, Snackbar } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";

import { useAuth } from "../../hooks/useAuth";
import { useChat } from "../../hooks/useChat";
import {
  ChatBubble,
  NegotiationCard,
  ChatInput,
  DateSeparator,
  BookingCard,
  LocationCard,
  NegotiationRequestModal,
  QuickBookModal,
  PaymentRequestCard,
} from "../../components/chat";
import {
  updateNegotiationStatus,
  sendNegotiationCard,
  sendBookingCard,
  uploadChatImage,
  sendImageMessage,
} from "../../services/firebase/chat";
import {
  createBookingFromNegotiation,
  createPendingBooking,
} from "../../services/firebase/booking";
import { getDocument } from "../../services/firebase/firestore";
import { COLORS } from "../../constants/theme";

const USER_COLOR = "#10B981";

/**
 * Check if two dates are on the same day
 */
const isSameDay = (date1, date2) => {
  if (!date1 || !date2) return false;
  const d1 = date1 instanceof Date ? date1 : new Date(date1);
  const d2 = date2 instanceof Date ? date2 : new Date(date2);
  return (
    d1.getDate() === d2.getDate() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getFullYear() === d2.getFullYear()
  );
};

/**
 * Get initials from name
 */
const getInitials = (name) => {
  if (!name) return "?";
  const words = name.split(" ");
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

export default function ChatScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { chatId, companyName, companyId } = route.params || {};
  const flatListRef = useRef(null);

  const { user } = useAuth();
  const {
    messages,
    isLoading,
    chatData,
    sendTextMessage,
    markAsRead,
  } = useChat(chatId, user?.userId, "user");

  // Modal states
  const [showNegotiationModal, setShowNegotiationModal] = useState(false);
  const [showQuickBookModal, setShowQuickBookModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [companyData, setCompanyData] = useState(null);
  const [snackbar, setSnackbar] = useState({ visible: false, message: "" });

  // Load company data for turfs/grounds
  useEffect(() => {
    const loadCompanyData = async () => {
      if (!companyId) return;
      try {
        const company = await getDocument("companies", companyId);
        if (company) {
          // Also load turfs for this company
          const { queryDocuments } = require("../../services/firebase/firestore");
          const turfs = await queryDocuments("turfs", [
            { field: "companyId", operator: "==", value: companyId },
            { field: "isActive", operator: "==", value: true },
          ]);
          setCompanyData({ ...company, turfs });
        }
      } catch (error) {
        console.error("Error loading company data:", error);
      }
    };
    loadCompanyData();
  }, [companyId]);

  // Mark as read when screen is focused
  useEffect(() => {
    if (chatId && user?.userId) {
      markAsRead();
    }
  }, [chatId, user?.userId, markAsRead]);

  // Process messages to add date separators
  const processedMessages = useMemo(() => {
    if (!messages || messages.length === 0) return [];

    const result = [];
    let lastDate = null;

    messages.forEach((message) => {
      const messageDate = message.timestamp;

      if (!isSameDay(messageDate, lastDate)) {
        result.push({
          id: `date-${message.id}`,
          type: "date_separator",
          date: messageDate,
        });
        lastDate = messageDate;
      }

      result.push(message);
    });

    return result.reverse();
  }, [messages]);

  const handleSendMessage = useCallback(
    async (text) => {
      try {
        await sendTextMessage(text, user?.name || "User");
      } catch (error) {
        console.error("Error sending message:", error);
        setSnackbar({ visible: true, message: "Failed to send message" });
      }
    },
    [sendTextMessage, user?.name]
  );

  // Handle sending an image
  const handleSendImage = useCallback(
    async (imageUri) => {
      try {
        const imageUrl = await uploadChatImage(chatId, imageUri);
        await sendImageMessage(chatId, {
          imageUrl,
          senderId: user?.userId,
          senderType: "user",
          senderName: user?.name || "User",
        });
      } catch (error) {
        console.error("Error sending image:", error);
        setSnackbar({ visible: true, message: "Failed to send image" });
      }
    },
    [chatId, user]
  );

  // Open negotiation request modal (for price negotiation)
  const handleRequestBooking = useCallback(() => {
    if (!companyData?.turfs?.length) {
      setSnackbar({ visible: true, message: "No turfs available for this company" });
      return;
    }
    setShowNegotiationModal(true);
  }, [companyData]);

  // Submit negotiation request
  const handleSubmitNegotiation = useCallback(
    async (negotiationData) => {
      setIsSubmitting(true);
      try {
        const messageId = await sendNegotiationCard(chatId, {
          ...negotiationData,
          companyId,
          senderId: user?.userId,
          senderType: "user",
          senderName: user?.name || "User",
          senderPhone: user?.phone || "",
        });

        // Create a pending booking so it appears in Upcoming Bookings
        try {
          await createPendingBooking({
            userId: user?.userId,
            userName: user?.name || "User",
            userPhone: user?.phone || "",
            companyId,
            turfId: negotiationData.turfId,
            turfName: negotiationData.turfName,
            groundId: negotiationData.groundId,
            groundName: negotiationData.groundName,
            sport: negotiationData.sport,
            date: negotiationData.date,
            startTime: negotiationData.startTime,
            endTime: negotiationData.endTime,
            totalAmount: negotiationData.requestedPrice || negotiationData.originalPrice || 0,
            negotiation: {
              isNegotiated: negotiationData.isNegotiation || false,
              requestedPrice: negotiationData.requestedPrice || 0,
              originalPrice: negotiationData.originalPrice || 0,
              chatId,
              negotiationCardId: messageId,
            },
          });
        } catch (bookingError) {
          // Non-critical: booking request was still sent via chat
          console.warn("Could not create pending booking:", bookingError);
        }

        setShowNegotiationModal(false);
        setSnackbar({ visible: true, message: "Booking request sent!" });
      } catch (error) {
        console.error("Error sending negotiation:", error);
        setSnackbar({ visible: true, message: "Failed to send request" });
      } finally {
        setIsSubmitting(false);
      }
    },
    [chatId, companyId, user]
  );

  // Submit quick booking (no negotiation, standard price)
  const handleSubmitQuickBook = useCallback(
    async (bookingData) => {
      setIsSubmitting(true);
      try {
        // Create pending booking
        const result = await createPendingBooking({
          ...bookingData,
          userId: user?.userId,
          userName: user?.name || "User",
          userPhone: user?.phone,
        });

        if (result.success) {
          // Send booking card to chat
          await sendBookingCard(chatId, {
            ...bookingData,
            bookingId: result.bookingId,
            senderId: user?.userId,
            senderType: "user",
            senderName: user?.name || "User",
            status: "pending",
          });
          setShowQuickBookModal(false);
          setSnackbar({ visible: true, message: "Booking request sent!" });
        } else {
          setSnackbar({ visible: true, message: result.message || "Failed to create booking" });
        }
      } catch (error) {
        console.error("Error creating quick booking:", error);
        setSnackbar({ visible: true, message: "Failed to send booking request" });
      } finally {
        setIsSubmitting(false);
      }
    },
    [chatId, user]
  );

  // Handle accepting counter offer from manager
  const handleAcceptCounter = useCallback(
    async (messageId, card) => {
      Alert.alert(
        "Accept Counter Offer",
        `Accept booking at ₹${card.counterPrice}?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Accept",
            onPress: async () => {
              try {
                // Create booking from accepted counter offer
                const result = await createBookingFromNegotiation(
                  { ...card, requestedPrice: card.counterPrice },
                  chatId,
                  messageId,
                  user?.userId,
                  user?.name || "User"
                );

                if (result.success) {
                  setSnackbar({ visible: true, message: "Booking confirmed!" });
                } else {
                  setSnackbar({ visible: true, message: result.message || "Failed to confirm booking" });
                }
              } catch (error) {
                console.error("Error accepting counter offer:", error);
                setSnackbar({ visible: true, message: "Failed to accept counter offer" });
              }
            },
          },
        ]
      );
    },
    [chatId, user]
  );

  // Handle "Pay Now" on a payment request card
  const handlePayNow = useCallback(
    (messageId, card) => {
      navigation.navigate("UpiPayment", {
        bookingId: card.bookingId,
        amount: card.advanceAmount,
        upiId: card.upiId,
        upiHolderName: card.upiHolderName,
        qrCodeUrl: card.qrCodeUrl || null,
        turfName: card.turfName,
        lockExpiry: card.paymentDeadline,
        // Extra context so PaymentConfirmation can update the chat card status
        chatId,
        paymentCardMessageId: messageId,
      });
    },
    [navigation, chatId]
  );

  // Handle rejecting counter offer
  const handleRejectCounter = useCallback(
    async (messageId, card) => {
      Alert.alert(
        "Decline Counter Offer",
        "Are you sure you want to decline this offer?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Decline",
            style: "destructive",
            onPress: async () => {
              try {
                await updateNegotiationStatus(chatId, messageId, "rejected", {
                  respondedBy: user?.userId,
                  respondedByName: user?.name || "User",
                });
                setSnackbar({ visible: true, message: "Offer declined" });
              } catch (error) {
                console.error("Error rejecting counter offer:", error);
                setSnackbar({ visible: true, message: "Failed to decline offer" });
              }
            },
          },
        ]
      );
    },
    [chatId, user]
  );

  const renderMessage = useCallback(
    ({ item }) => {
      // Date separator
      if (item.type === "date_separator") {
        return <DateSeparator date={item.date} />;
      }

      const isOwn = item.senderId === user?.userId;

      // Negotiation card
      if (item.type === "negotiation_card") {
        return (
          <NegotiationCard
            message={item}
            isOwn={isOwn}
            viewerType="user"
            onAcceptCounter={handleAcceptCounter}
            onRejectCounter={handleRejectCounter}
          />
        );
      }

      // Payment request card (from manager)
      if (item.type === "payment_request_card") {
        return (
          <PaymentRequestCard
            message={item}
            isOwn={isOwn}
            viewerType="user"
            onPayNow={handlePayNow}
          />
        );
      }

      // Booking card
      if (item.type === "booking_card") {
        return (
          <BookingCard
            message={item}
            isOwn={isOwn}
            viewerType="user"
          />
        );
      }

      // Location message
      if (item.type === "location") {
        return <LocationCard message={item} isOwn={isOwn} />;
      }

      // Image message or text message
      return <ChatBubble message={item} isOwn={isOwn} accentColor={USER_COLOR} />;
    },
    [user?.userId, handleAcceptCounter, handleRejectCounter, handlePayNow]
  );

  const keyExtractor = useCallback((item) => item.id, []);

  const companyAvatar = chatData?.participants?.company?.avatar;
  const displayName = companyName || chatData?.participants?.company?.name || "Chat";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.text} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.headerInfo} activeOpacity={0.7}>
          {companyAvatar ? (
            <Avatar.Image size={40} source={{ uri: companyAvatar }} />
          ) : (
            <Avatar.Text
              size={40}
              label={getInitials(displayName)}
              style={styles.avatarFallback}
            />
          )}
          <View style={styles.headerText}>
            <Text variant="titleMedium" style={styles.headerName} numberOfLines={1}>
              {displayName}
            </Text>
            <Text variant="bodySmall" style={styles.headerSubtitle}>
              Turf Manager
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          <IconButton
            icon="phone"
            size={22}
            iconColor={COLORS.text}
            onPress={() => {
              const phone =
                chatData?.participants?.company?.phone ||
                companyData?.phone ||
                companyData?.contactPhone;
              if (phone) {
                Linking.openURL(`tel:${phone}`);
              } else {
                Alert.alert("Contact", "Phone number not available for this business.");
              }
            }}
          />
          <IconButton
            icon="information-outline"
            size={22}
            iconColor={COLORS.text}
            onPress={() => {
              const turfs = companyData?.turfs;
              if (turfs && turfs.length > 0) {
                navigation.navigate("TurfDetails", { turfId: turfs[0].id });
              } else {
                Alert.alert("Info", "Turf details not available.");
              }
            }}
          />
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        {/* Messages List */}
        {isLoading && messages.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={USER_COLOR} />
            <Text variant="bodyMedium" style={styles.loadingText}>
              Loading messages...
            </Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={processedMessages}
            renderItem={renderMessage}
            keyExtractor={keyExtractor}
            inverted
            contentContainerStyle={styles.messagesList}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons
                  name="chat-outline"
                  size={48}
                  color="#ccc"
                />
                <Text variant="bodyMedium" style={styles.emptyText}>
                  Start a conversation
                </Text>
              </View>
            }
          />
        )}

        {/* Chat Input */}
        <ChatInput
          onSend={handleSendMessage}
          onSendImage={handleSendImage}
          onRequestBooking={handleRequestBooking}
          showRequestBooking={true}
          accentColor={USER_COLOR}
          placeholder="Message"
        />
      </KeyboardAvoidingView>

      {/* Negotiation Request Modal */}
      <NegotiationRequestModal
        visible={showNegotiationModal}
        onDismiss={() => setShowNegotiationModal(false)}
        onSubmit={handleSubmitNegotiation}
        companyData={companyData}
        userData={user}
        isLoading={isSubmitting}
      />

      {/* Quick Book Modal */}
      <QuickBookModal
        visible={showQuickBookModal}
        onDismiss={() => setShowQuickBookModal(false)}
        onSubmit={handleSubmitQuickBook}
        companyData={companyData}
        userData={user}
        isLoading={isSubmitting}
      />

      {/* Snackbar for feedback */}
      <Snackbar
        visible={snackbar.visible}
        onDismiss={() => setSnackbar({ visible: false, message: "" })}
        duration={3000}
        action={{
          label: "Dismiss",
          onPress: () => setSnackbar({ visible: false, message: "" }),
        }}
      >
        {snackbar.message}
      </Snackbar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  keyboardAvoid: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  backButton: {
    padding: 8,
  },
  headerInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 4,
  },
  avatarFallback: {
    backgroundColor: COLORS.secondary,
  },
  headerText: {
    marginLeft: 10,
    flex: 1,
  },
  headerName: {
    fontWeight: "600",
    color: COLORS.text,
  },
  headerSubtitle: {
    color: COLORS.textSecondary,
  },
  headerActions: {
    flexDirection: "row",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.textSecondary,
  },
  messagesList: {
    flexGrow: 1,
    paddingVertical: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
    transform: [{ scaleY: -1 }], // Flip because of inverted list
  },
  emptyText: {
    marginTop: 12,
    color: COLORS.textSecondary,
  },
});
