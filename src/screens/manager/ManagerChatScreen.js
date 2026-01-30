import React, { useCallback, useMemo, useRef, useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  Alert,
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
} from "../../components/chat";
import {
  updateNegotiationStatus,
  updateBookingCardStatus,
  sendLocationMessage,
} from "../../services/firebase/chat";
import {
  createBookingFromNegotiation,
  confirmPendingBooking,
  expireConflictingNegotiations,
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

  // Load turfs data for location sharing
  useEffect(() => {
    const loadTurfsData = async () => {
      if (!user?.companyId) return;
      try {
        const turfs = await queryDocuments("turfs", [
          { field: "companyId", operator: "==", value: user.companyId },
        ]);
        const turfsMap = {};
        turfs.forEach((turf) => {
          turfsMap[turf.turfId || turf.id] = turf;
        });
        setTurfsData(turfsMap);
      } catch (error) {
        console.error("Error loading turfs:", error);
      }
    };
    loadTurfsData();
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

  // Accept negotiation - creates booking with transaction
  const handleAcceptNegotiation = useCallback(
    async (messageId, card) => {
      Alert.alert(
        "Accept Booking Request",
        `Accept booking for ${card.turfName} at ₹${card.requestedPrice}?\n\nThis will create a confirmed booking.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Accept & Confirm",
            onPress: async () => {
              try {
                // Use transaction to create booking and handle race conditions
                const result = await createBookingFromNegotiation(
                  card,
                  chatId,
                  messageId,
                  user?.userId,
                  user?.name || "Manager"
                );

                if (result.success) {
                  // Expire other conflicting negotiations
                  await expireConflictingNegotiations(
                    card.turfId,
                    card.groundId,
                    card.date,
                    card.startTime,
                    card.endTime,
                    chatId
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
              // TODO: Implement call functionality
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
        showRequestBooking={false}
        accentColor={MANAGER_COLOR}
        placeholder="Type a reply..."
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
});
