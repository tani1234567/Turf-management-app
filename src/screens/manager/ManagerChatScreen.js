import React, { useCallback, useMemo, useRef, useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Linking,
  Modal,
} from "react-native";
import { Text, Avatar, IconButton, ActivityIndicator, Snackbar, TextInput, Button, Surface } from "react-native-paper";
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
  PaymentRequestCard,
} from "../../components/chat";
import {
  updateNegotiationStatus,
  updateBookingCardStatus,
  sendLocationMessage,
  uploadChatImage,
  sendImageMessage,
  sendPaymentRequestCard,
  updatePaymentRequestCardStatus,
} from "../../services/firebase/chat";
import {
  createBookingFromNegotiation,
  createBookingFromNegotiationWithPaymentRequest,
  updateBookingWithAdvancePayment,
  confirmPendingBooking,
  expireConflictingNegotiations,
  approveBookingWithoutAdvancePayment,
} from "../../services/firebase/booking";
import { getDocument, queryDocuments } from "../../services/firebase/firestore";
import { COLORS } from "../../constants/theme";

const MANAGER_COLOR = "#2196F3";

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

export default function ManagerChatScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { chatId, userName, userId } = route.params || {};
  const flatListRef = useRef(null);

  const { user } = useAuth();
  const {
    messages,
    isLoading,
    chatData,
    sendTextMessage,
    markAsRead,
  } = useChat(chatId, user?.userId, "manager");

  const [snackbar, setSnackbar] = useState({ visible: false, message: "" });
  const [turfsData, setTurfsData] = useState({});
  const [companyPaymentConfig, setCompanyPaymentConfig] = useState(null);

  // Advance payment picker state
  const [advancePicker, setAdvancePicker] = useState({
    visible: false,
    card: null,        // negotiation card data
    messageId: null,
    amount: "",        // string for TextInput
    isSending: false,
    // for "send payment request" on an already-accepted card (no booking creation needed)
    existingBookingId: null,
  });

  // Load turfs data and company payment config
  useEffect(() => {
    const loadData = async () => {
      if (!user?.companyId) return;
      try {
        const [turfs, companyDoc] = await Promise.all([
          queryDocuments("turfs", [
            { field: "companyId", operator: "==", value: user.companyId },
          ]),
          getDocument("companies", user.companyId),
        ]);

        const turfsMap = {};
        turfs.forEach((turf) => {
          turfsMap[turf.turfId || turf.id] = turf;
        });
        setTurfsData(turfsMap);

        if (companyDoc?.paymentConfig) {
          setCompanyPaymentConfig(companyDoc.paymentConfig);
        }
      } catch (error) {
        console.error("Error loading data:", error);
      }
    };
    loadData();
  }, [user?.companyId]);

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
        await sendTextMessage(text, user?.name || "Manager");
      } catch (error) {
        console.error("Error sending message:", error);
        setSnackbar({ visible: true, message: "Failed to send message" });
      }
    },
    [sendTextMessage, user?.name]
  );

  const handleSendImage = useCallback(
    async (imageUri) => {
      try {
        const imageUrl = await uploadChatImage(chatId, imageUri);
        await sendImageMessage(chatId, {
          imageUrl,
          senderId: user?.userId,
          senderType: "manager",
          senderName: user?.name || "Manager",
        });
      } catch (error) {
        console.error("Error sending image:", error);
        setSnackbar({ visible: true, message: "Failed to send image" });
      }
    },
    [chatId, user]
  );

  // Accept negotiation — offers two options: approve directly or request advance payment
  const handleAcceptNegotiation = useCallback(
    (messageId, card) => {
      const turf = turfsData[card.turfId];
      const hasAdvanceConfig = turf?.advancePayment?.isRequired;
      const suggestedAmount = hasAdvanceConfig
        ? Math.round((card.requestedPrice * turf.advancePayment.percentage) / 100)
        : 0;

      Alert.alert(
        "Accept Booking Request",
        `Accept booking for ${card.turfName} at ₹${card.requestedPrice}?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Approve Directly",
            onPress: async () => {
              try {
                const result = await createBookingFromNegotiation(
                  card,
                  chatId,
                  messageId,
                  user?.userId,
                  user?.name || "Manager"
                );
                if (result.success) {
                  await expireConflictingNegotiations(
                    card.turfId, card.groundId, card.date,
                    card.startTime, card.endTime, chatId
                  );
                  setSnackbar({ visible: true, message: "Booking confirmed!" });
                } else {
                  setSnackbar({ visible: true, message: result.message || "Failed to create booking" });
                }
              } catch (error) {
                console.error("Error accepting negotiation:", error);
                setSnackbar({ visible: true, message: "Failed to accept request" });
              }
            },
          },
          {
            text: "Request Advance Payment",
            onPress: () => {
              setAdvancePicker({
                visible: true,
                card,
                messageId,
                amount: suggestedAmount > 0 ? String(suggestedAmount) : "",
                isSending: false,
                existingBookingId: null,
              });
            },
          },
        ]
      );
    },
    [chatId, user?.userId, user?.name, turfsData]
  );

  // Send payment request for an already-accepted negotiation (user accepted counter-offer)
  const handleSendPaymentRequest = useCallback(
    (messageId, card) => {
      const turf = turfsData[card.turfId];
      const suggestedAmount = turf?.advancePayment?.isRequired
        ? Math.round(((card.counterPrice || card.requestedPrice || card.originalPrice) * turf.advancePayment.percentage) / 100)
        : 0;

      setAdvancePicker({
        visible: true,
        card,
        messageId,
        amount: suggestedAmount > 0 ? String(suggestedAmount) : "",
        isSending: false,
        existingBookingId: card.bookingId || null,
      });
    },
    [turfsData]
  );

  // Confirm and send the payment request (from the picker modal)
  const handleConfirmPaymentRequest = useCallback(async () => {
    const { card, messageId, amount, existingBookingId } = advancePicker;
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid advance payment amount.");
      return;
    }

    // UPI details come from the company payment config (same as normal booking flow)
    const upiId = companyPaymentConfig?.upiId || null;
    const upiHolderName = companyPaymentConfig?.upiHolderName || null;
    const qrCodeUrl = companyPaymentConfig?.upiQrCode || null;
    const paymentDeadline = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString();

    setAdvancePicker((prev) => ({ ...prev, isSending: true }));

    try {
      let bookingId = existingBookingId;

      if (!bookingId) {
        // Create booking with pending_payment status
        const result = await createBookingFromNegotiationWithPaymentRequest(
          card,
          chatId,
          messageId,
          user?.userId,
          user?.name || "Manager",
          { advanceAmount: numAmount, upiId, upiHolderName }
        );

        if (!result.success) {
          setSnackbar({ visible: true, message: result.message || "Failed to create booking" });
          setAdvancePicker((prev) => ({ ...prev, isSending: false }));
          return;
        }

        bookingId = result.bookingId;

        await expireConflictingNegotiations(
          card.turfId, card.groundId, card.date,
          card.startTime, card.endTime, chatId
        );
      } else {
        // Existing booking (e.g. user accepted counter-offer): update its payment fields
        const totalAmount = card.requestedPrice || card.counterPrice || card.originalPrice || 0;
        await updateBookingWithAdvancePayment(
          bookingId,
          totalAmount,
          numAmount,
          { upiId, upiHolderName, paymentDeadline }
        );
      }

      // Send the payment request card in chat
      await sendPaymentRequestCard(chatId, {
        senderId: user?.userId,
        senderName: user?.name || "Manager",
        bookingId,
        turfId: card.turfId,
        turfName: card.turfName,
        groundId: card.groundId,
        groundName: card.groundName,
        sport: card.sport,
        date: card.date,
        startTime: card.startTime,
        endTime: card.endTime,
        totalAmount: card.requestedPrice || card.counterPrice || card.originalPrice,
        advanceAmount: numAmount,
        paymentDeadline,
        upiId,
        upiHolderName,
        qrCodeUrl,
        companyId: card.companyId || user?.companyId,
      });

      setAdvancePicker({ visible: false, card: null, messageId: null, amount: "", isSending: false, existingBookingId: null });
      setSnackbar({ visible: true, message: "Payment request sent to customer!" });
    } catch (error) {
      console.error("Error sending payment request:", error);
      setSnackbar({ visible: true, message: "Failed to send payment request" });
      setAdvancePicker((prev) => ({ ...prev, isSending: false }));
    }
  }, [advancePicker, chatId, user, companyPaymentConfig]);

  // Manager: approve booking without advance payment (from PaymentRequestCard)
  const handleApproveWithoutPayment = useCallback(
    async (messageId, card) => {
      Alert.alert(
        "Approve Without Payment",
        "Confirm this booking without requiring advance payment?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Approve",
            onPress: async () => {
              try {
                await approveBookingWithoutAdvancePayment(
                  card.bookingId,
                  user?.userId,
                  user?.name || "Manager"
                );
                await updatePaymentRequestCardStatus(chatId, messageId, "approved_without_payment", {
                  respondedBy: user?.userId,
                  respondedByName: user?.name || "Manager",
                });
                setSnackbar({ visible: true, message: "Booking approved!" });
              } catch (error) {
                console.error("Error approving without payment:", error);
                setSnackbar({ visible: true, message: "Failed to approve booking" });
              }
            },
          },
        ]
      );
    },
    [chatId, user?.userId, user?.name]
  );

  // Reject negotiation
  const handleRejectNegotiation = useCallback(
    async (messageId, card) => {
      Alert.alert(
        "Reject Booking Request",
        "Are you sure you want to reject this booking request?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Reject",
            style: "destructive",
            onPress: async () => {
              try {
                await updateNegotiationStatus(chatId, messageId, "rejected", {
                  respondedBy: user?.userId,
                  respondedByName: user?.name || "Manager",
                  rejectionReason: "Manager declined",
                });
                setSnackbar({ visible: true, message: "Booking request rejected" });
              } catch (error) {
                console.error("Error rejecting negotiation:", error);
                setSnackbar({ visible: true, message: "Failed to reject request" });
              }
            },
          },
        ]
      );
    },
    [chatId, user?.userId, user?.name]
  );

  // Counter offer
  const handleCounterOffer = useCallback(
    async (messageId, card, counterPrice) => {
      try {
        await updateNegotiationStatus(chatId, messageId, "countered", {
          counterPrice,
          respondedBy: user?.userId,
          respondedByName: user?.name || "Manager",
        });
        setSnackbar({ visible: true, message: `Counter offer of ₹${counterPrice} sent!` });
      } catch (error) {
        console.error("Error sending counter offer:", error);
        setSnackbar({ visible: true, message: "Failed to send counter offer" });
      }
    },
    [chatId, user?.userId, user?.name]
  );

  // Quick Confirm - confirm pending booking from chat
  const handleConfirmBooking = useCallback(
    async (messageId, card) => {
      Alert.alert(
        "Confirm Booking",
        `Confirm booking for ${card.turfName}?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Confirm",
            onPress: async () => {
              try {
                const result = await confirmPendingBooking(
                  card.bookingId,
                  user?.userId,
                  user?.name || "Manager"
                );

                if (result.success) {
                  // Update the booking card in chat
                  await updateBookingCardStatus(chatId, messageId, "confirmed", {
                    respondedBy: user?.userId,
                    respondedByName: user?.name || "Manager",
                  });
                  setSnackbar({ visible: true, message: "Booking confirmed!" });
                } else {
                  setSnackbar({ visible: true, message: result.message || "Failed to confirm" });
                }
              } catch (error) {
                console.error("Error confirming booking:", error);
                setSnackbar({ visible: true, message: "Failed to confirm booking" });
              }
            },
          },
        ]
      );
    },
    [chatId, user?.userId, user?.name]
  );

  // Reject pending booking
  const handleRejectBooking = useCallback(
    async (messageId, card) => {
      Alert.alert(
        "Reject Booking",
        "Are you sure you want to reject this booking?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Reject",
            style: "destructive",
            onPress: async () => {
              try {
                await updateBookingCardStatus(chatId, messageId, "rejected", {
                  respondedBy: user?.userId,
                  respondedByName: user?.name || "Manager",
                });
                setSnackbar({ visible: true, message: "Booking rejected" });
              } catch (error) {
                console.error("Error rejecting booking:", error);
                setSnackbar({ visible: true, message: "Failed to reject booking" });
              }
            },
          },
        ]
      );
    },
    [chatId, user?.userId, user?.name]
  );

  // Share turf location
  const handleShareLocation = useCallback(
    async (card) => {
      const turfId = card.turfId;
      const turf = turfsData[turfId];

      if (!turf || !turf.location) {
        setSnackbar({ visible: true, message: "Location not available for this turf" });
        return;
      }

      try {
        await sendLocationMessage(chatId, {
          senderId: user?.userId,
          senderType: "manager",
          senderName: user?.name || "Manager",
          turfId: turf.turfId || turf.id,
          turfName: turf.name,
          address: turf.location.address,
          city: turf.location.city,
          googleMapsLink: turf.location.googleMapsLink,
          coordinates: turf.location.coordinates,
          recipientId: chatData?.participants?.user?.userId,
        });
        setSnackbar({ visible: true, message: "Location shared!" });
      } catch (error) {
        console.error("Error sharing location:", error);
        setSnackbar({ visible: true, message: "Failed to share location" });
      }
    },
    [chatId, user, turfsData, chatData]
  );

  const renderMessage = useCallback(
    ({ item }) => {
      if (item.type === "date_separator") {
        return <DateSeparator date={item.date} />;
      }

      const isOwn = item.senderId === user?.userId;

      // Negotiation card with transaction-based accept
      if (item.type === "negotiation_card") {
        return (
          <NegotiationCard
            message={item}
            isOwn={isOwn}
            viewerType="manager"
            onAccept={handleAcceptNegotiation}
            onReject={handleRejectNegotiation}
            onCounter={handleCounterOffer}
            onSendPaymentRequest={handleSendPaymentRequest}
          />
        );
      }

      // Payment request card
      if (item.type === "payment_request_card") {
        return (
          <PaymentRequestCard
            message={item}
            isOwn={isOwn}
            viewerType="manager"
            onApproveWithoutPayment={handleApproveWithoutPayment}
          />
        );
      }

      // Booking card with Quick Confirm and Location Share
      if (item.type === "booking_card") {
        return (
          <BookingCard
            message={item}
            isOwn={isOwn}
            viewerType="manager"
            onConfirm={handleConfirmBooking}
            onReject={handleRejectBooking}
            onShareLocation={handleShareLocation}
          />
        );
      }

      // Location card
      if (item.type === "location") {
        return <LocationCard message={item} isOwn={isOwn} />;
      }

      // Default text message
      return <ChatBubble message={item} isOwn={isOwn} accentColor={MANAGER_COLOR} />;
    },
    [
      user?.userId,
      handleAcceptNegotiation,
      handleRejectNegotiation,
      handleCounterOffer,
      handleSendPaymentRequest,
      handleApproveWithoutPayment,
      handleConfirmBooking,
      handleRejectBooking,
      handleShareLocation,
    ]
  );

  const keyExtractor = useCallback((item) => item.id, []);

  const userAvatar = chatData?.participants?.user?.avatar;
  const displayName = userName || chatData?.participants?.user?.name || "Customer";
  const userPhone = chatData?.participants?.user?.phone;

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
          {userAvatar ? (
            <Avatar.Image size={40} source={{ uri: userAvatar }} />
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
            {userPhone && (
              <Text variant="bodySmall" style={styles.headerSubtitle}>
                {userPhone}
              </Text>
            )}
          </View>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          <IconButton
            icon="phone"
            size={22}
            iconColor={COLORS.text}
            onPress={() => {
              const phone = chatData?.participants?.user?.phone;
              if (phone) {
                Linking.openURL(`tel:${phone}`);
              } else {
                Alert.alert("Contact", "Phone number not available for this user.");
              }
            }}
          />
          <IconButton
            icon="dots-vertical"
            size={22}
            iconColor={COLORS.text}
            onPress={() => {
              // TODO: Show chat options menu
            }}
          />
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Messages List */}
        {isLoading && messages.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={MANAGER_COLOR} />
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

        {/* Chat Input (no request booking for managers) */}
        <ChatInput
          onSend={handleSendMessage}
          onSendImage={handleSendImage}
          showRequestBooking={false}
          accentColor={MANAGER_COLOR}
          placeholder="Message"
        />
      </KeyboardAvoidingView>

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

      {/* Advance Payment Amount Picker Modal */}
      <Modal
        visible={advancePicker.visible}
        transparent
        animationType="fade"
        onRequestClose={() => !advancePicker.isSending && setAdvancePicker((p) => ({ ...p, visible: false }))}
      >
        <View style={styles.modalOverlay}>
          <Surface style={styles.pickerCard} elevation={4}>
            <View style={styles.pickerHeader}>
              <MaterialCommunityIcons name="cash-clock" size={22} color={MANAGER_COLOR} />
              <Text variant="titleMedium" style={styles.pickerTitle}>
                Request Advance Payment
              </Text>
            </View>

            <Text variant="bodySmall" style={styles.pickerSubtitle}>
              Set the advance amount the customer must pay to confirm this booking. They will have 5 hours to complete the payment.
            </Text>

            <TextInput
              mode="outlined"
              label="Advance Amount (₹)"
              value={advancePicker.amount}
              onChangeText={(v) => setAdvancePicker((p) => ({ ...p, amount: v.replace(/[^0-9]/g, "") }))}
              keyboardType="numeric"
              left={<TextInput.Affix text="₹" />}
              style={styles.pickerInput}
              outlineColor="#E0E0E0"
              activeOutlineColor={MANAGER_COLOR}
              disabled={advancePicker.isSending}
            />

            {advancePicker.card && (
              <Text variant="bodySmall" style={styles.pickerHint}>
                Total: ₹{advancePicker.card.requestedPrice || advancePicker.card.counterPrice || advancePicker.card.originalPrice}
              </Text>
            )}

            {companyPaymentConfig?.upiId ? (
              <View style={styles.pickerUpiInfo}>
                <MaterialCommunityIcons name="bank-outline" size={14} color="#6B7280" />
                <Text variant="bodySmall" style={styles.pickerUpiText}>
                  Payment to: {companyPaymentConfig.upiHolderName ? `${companyPaymentConfig.upiHolderName} · ` : ""}{companyPaymentConfig.upiId}
                </Text>
              </View>
            ) : (
              <View style={styles.pickerUpiWarning}>
                <MaterialCommunityIcons name="alert-outline" size={14} color="#F59E0B" />
                <Text variant="bodySmall" style={styles.pickerUpiWarningText}>
                  No UPI configured. Set it up in Payment Settings.
                </Text>
              </View>
            )}

            <View style={styles.pickerActions}>
              <Button
                mode="outlined"
                onPress={() => setAdvancePicker((p) => ({ ...p, visible: false }))}
                disabled={advancePicker.isSending}
                style={styles.pickerCancelBtn}
                textColor={COLORS.textSecondary}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleConfirmPaymentRequest}
                loading={advancePicker.isSending}
                disabled={!advancePicker.amount || advancePicker.isSending}
                buttonColor={MANAGER_COLOR}
                style={styles.pickerSendBtn}
                icon="send"
              >
                Send Request
              </Button>
            </View>
          </Surface>
        </View>
      </Modal>
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
    backgroundColor: COLORS.primary,
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
    transform: [{ scaleY: -1 }],
  },
  emptyText: {
    marginTop: 12,
    color: COLORS.textSecondary,
  },
  // Advance payment picker modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  pickerCard: {
    width: "100%",
    borderRadius: 16,
    padding: 20,
    backgroundColor: "#fff",
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  pickerTitle: {
    fontWeight: "700",
    color: "#111827",
  },
  pickerSubtitle: {
    color: "#6B7280",
    marginBottom: 16,
    lineHeight: 18,
  },
  pickerInput: {
    backgroundColor: "#fff",
    marginBottom: 6,
  },
  pickerHint: {
    color: "#6B7280",
    marginBottom: 20,
    textAlign: "right",
  },
  pickerActions: {
    flexDirection: "row",
    gap: 12,
  },
  pickerCancelBtn: {
    flex: 1,
    borderColor: "#E0E0E0",
  },
  pickerSendBtn: {
    flex: 1,
  },
  pickerUpiInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 20,
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  pickerUpiText: {
    color: "#374151",
    flex: 1,
  },
  pickerUpiWarning: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 20,
    backgroundColor: "#FFFBEB",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  pickerUpiWarningText: {
    color: "#92400E",
    flex: 1,
  },
});
