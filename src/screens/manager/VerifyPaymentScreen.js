import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Linking,
  Modal,
  Dimensions,
  Alert,
} from "react-native";
import {
  Text,
  Surface,
  Button,
  ActivityIndicator,
  Portal,
  Dialog,
  RadioButton,
  TextInput,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSelector } from "react-redux";
import { selectUser } from "../../store/slices/authSlice";
import { verifyPayment, rejectPayment } from "../../services/firebase/payments";
import firestore from "@react-native-firebase/firestore";

const MANAGER_COLOR = "#2196F3";
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const REJECTION_REASONS = [
  { id: "not_found", label: "Transaction ID not found" },
  { id: "wrong_amount", label: "Wrong amount received" },
  { id: "wrong_upi", label: "Payment to wrong UPI ID" },
  { id: "unclear", label: "Screenshot unclear" },
  { id: "other", label: "Other reason" },
];

export default function VerifyPaymentScreen({ navigation, route }) {
  const { bookingId, booking: initialBooking } = route.params || {};
  const user = useSelector(selectUser);

  const [booking, setBooking] = useState(initialBooking);
  const [isLoading, setIsLoading] = useState(!initialBooking);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedReason, setSelectedReason] = useState("not_found");
  const [otherReason, setOtherReason] = useState("");

  // Fetch booking if not provided
  useEffect(() => {
    if (!initialBooking && bookingId) {
      fetchBooking();
    }
  }, [bookingId, initialBooking]);

  const fetchBooking = async () => {
    try {
      setIsLoading(true);
      const doc = await firestore().collection("bookings").doc(bookingId).get();
      if (doc.exists) {
        setBooking({ id: doc.id, ...doc.data() });
      }
    } catch (error) {
      console.error("Error fetching booking:", error);
      Alert.alert("Error", "Failed to load booking details");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCall = () => {
    const phone = booking?.userPhone;
    if (phone) {
      Linking.openURL(`tel:${phone}`);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const formatTime = (time) => {
    if (!time) return "";
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const getTimeAgo = (timestamp) => {
    if (!timestamp) return "Unknown";

    let date;
    if (timestamp?.toDate) {
      date = timestamp.toDate();
    } else if (timestamp?.seconds) {
      date = new Date(timestamp.seconds * 1000);
    } else {
      date = new Date(timestamp);
    }

    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} mins ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    return `${diffDays} days ago`;
  };

  // Check if time ranges overlap
  const hasTimeOverlap = (start1, end1, start2, end2) => {
    return start1 < end2 && end1 > start2;
  };

  // Check for slot conflicts
  const checkSlotAvailability = async () => {
    try {
      // Check for other confirmed bookings on same date/ground/time
      const confirmedBookings = await firestore()
        .collection("bookings")
        .where("turfId", "==", booking.turfId)
        .where("date", "==", booking.date)
        .where("status", "==", "confirmed")
        .get();

      const conflictingBooking = confirmedBookings.docs.find((doc) => {
        const b = doc.data();
        if (doc.id === bookingId) return false; // Skip self
        if (b.groundId !== booking.groundId) return false; // Different ground
        return hasTimeOverlap(booking.startTime, booking.endTime, b.startTime, b.endTime);
      });

      if (conflictingBooking) {
        return {
          available: false,
          reason: "This slot is already booked by another confirmed booking.",
        };
      }

      // Check for blocked slots
      try {
        const blockedSlots = await firestore()
          .collection("blocked_slots")
          .where("turfId", "==", booking.turfId)
          .where("date", "==", booking.date)
          .get();

        const conflictingBlock = blockedSlots.docs.find((doc) => {
          const block = doc.data();
          if (block.groundId && block.groundId !== booking.groundId) return false;
          return hasTimeOverlap(booking.startTime, booking.endTime, block.startTime, block.endTime);
        });

        if (conflictingBlock) {
          return {
            available: false,
            reason: "This slot is blocked. Please unblock before approving.",
          };
        }
      } catch (e) {
        // blocked_slots collection might not exist, continue
      }

      return { available: true };
    } catch (error) {
      console.error("Error checking slot availability:", error);
      return { available: true }; // Proceed if check fails
    }
  };

  const handleVerify = async () => {
    Alert.alert(
      "Verify & Approve Booking",
      "Are you sure you want to verify this payment? The booking will be automatically confirmed if the slot is available.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Verify & Approve",
          onPress: async () => {
            setIsVerifying(true);
            try {
              // Check slot availability first
              const slotCheck = await checkSlotAvailability();

              if (!slotCheck.available) {
                Alert.alert(
                  "Slot Not Available",
                  `${slotCheck.reason}\n\nPlease reject this payment and ask the customer to book another slot, or resolve the conflict first.`,
                  [{ text: "OK" }]
                );
                setIsVerifying(false);
                return;
              }

              const managerId = user?.id || user?.uid || user?.userId;
              await verifyPayment(bookingId, managerId, "manager", "", true);
              Alert.alert(
                "Booking Confirmed!",
                "Payment verified and booking has been automatically confirmed.",
                [{ text: "OK", onPress: () => navigation.goBack() }]
              );
            } catch (error) {
              console.error("Error verifying payment:", error);
              Alert.alert("Error", "Failed to verify payment. Please try again.");
            } finally {
              setIsVerifying(false);
            }
          },
        },
      ]
    );
  };

  const handleReject = () => {
    setShowRejectModal(true);
  };

  const confirmReject = async () => {
    const reason =
      selectedReason === "other"
        ? otherReason.trim() || "Other reason"
        : REJECTION_REASONS.find((r) => r.id === selectedReason)?.label;

    if (selectedReason === "other" && !otherReason.trim()) {
      Alert.alert("Error", "Please enter a reason for rejection");
      return;
    }

    setShowRejectModal(false);
    setIsRejecting(true);

    try {
      const managerId = user?.id || user?.uid || user?.userId;
      const result = await rejectPayment(bookingId, managerId, "manager", reason);

      const attemptNumber = result.attemptNumber || 1;
      const maxAttempts = 3;

      if (attemptNumber >= maxAttempts) {
        Alert.alert(
          "Booking Cancelled",
          `Maximum payment attempts (${maxAttempts}) reached. The booking has been cancelled.`,
          [{ text: "OK", onPress: () => navigation.goBack() }]
        );
      } else {
        Alert.alert(
          "Payment Rejected",
          `Payment rejected. The user has ${maxAttempts - attemptNumber} attempt(s) remaining.`,
          [{ text: "OK", onPress: () => navigation.goBack() }]
        );
      }
    } catch (error) {
      console.error("Error rejecting payment:", error);
      Alert.alert("Error", "Failed to reject payment. Please try again.");
    } finally {
      setIsRejecting(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={MANAGER_COLOR} />
          <Text style={styles.loadingText}>Loading booking details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!booking) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons name="alert-circle" size={64} color="#F44336" />
          <Text variant="titleMedium" style={styles.errorText}>
            Booking not found
          </Text>
          <Button mode="contained" onPress={() => navigation.goBack()}>
            Go Back
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const paymentDetails = booking?.payment?.advance?.upiDetails || {};
  const screenshotUrl = paymentDetails.screenshotUrl;
  const attemptCount = booking?.paymentAttempts?.length || 0;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <Text variant="titleLarge" style={styles.headerTitle}>
          Verify Payment
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* User Info */}
        <Surface style={styles.userCard} elevation={1}>
          <View style={styles.userInfo}>
            <View style={styles.userAvatar}>
              <MaterialCommunityIcons name="account" size={32} color={MANAGER_COLOR} />
            </View>
            <View style={styles.userDetails}>
              <Text variant="titleMedium" style={styles.userName}>
                {booking.userName || "Unknown User"}
              </Text>
              <Text variant="bodyMedium" style={styles.userPhone}>
                {booking.userPhone || "No phone"}
              </Text>
            </View>
            {booking.userPhone && (
              <TouchableOpacity style={styles.callButton} onPress={handleCall}>
                <MaterialCommunityIcons name="phone" size={20} color="#fff" />
                <Text variant="labelMedium" style={styles.callButtonText}>
                  Call
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </Surface>

        {/* Booking Details */}
        <Surface style={styles.card} elevation={1}>
          <View style={styles.bookingRow}>
            <MaterialCommunityIcons name="calendar" size={18} color="#666" />
            <Text variant="bodyMedium" style={styles.bookingText}>
              {formatDate(booking.date)} • {formatTime(booking.startTime)} - {formatTime(booking.endTime)}
            </Text>
          </View>
          <View style={styles.bookingRow}>
            <MaterialCommunityIcons name="soccer" size={18} color="#666" />
            <Text variant="bodyMedium" style={styles.bookingText}>
              {booking.sport} • {booking.groundName || "Ground"}
            </Text>
          </View>
          <View style={styles.bookingRow}>
            <MaterialCommunityIcons name="currency-inr" size={18} color="#666" />
            <Text variant="bodyMedium" style={styles.bookingText}>
              Total: ₹{(booking.totalAmount || booking.payment?.slotAmount || 0).toLocaleString()}
            </Text>
          </View>
          {booking.payment?.advanceAmount > 0 && (
            <View style={styles.bookingRow}>
              <MaterialCommunityIcons name="cash-fast" size={18} color="#666" />
              <Text variant="bodyMedium" style={styles.bookingText}>
                Advance: ₹{booking.payment.advanceAmount.toLocaleString()} • Remaining: ₹{(booking.payment?.remainingAmount || 0).toLocaleString()}
              </Text>
            </View>
          )}
        </Surface>

        {/* Payment Details */}
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="credit-card" size={20} color={MANAGER_COLOR} />
          <Text variant="titleSmall" style={styles.sectionTitle}>
            PAYMENT DETAILS
          </Text>
        </View>

        <Surface style={styles.card} elevation={1}>
          <View style={styles.paymentRow}>
            <Text variant="bodyMedium" style={styles.paymentLabel}>
              Amount
            </Text>
            <Text variant="titleMedium" style={styles.paymentValue}>
              ₹{paymentDetails.amount?.toLocaleString() || booking.payment?.advanceAmount || 0}
            </Text>
          </View>
          <View style={styles.paymentRow}>
            <Text variant="bodyMedium" style={styles.paymentLabel}>
              UPI ID
            </Text>
            <Text variant="bodyMedium" style={styles.paymentValue}>
              {paymentDetails.paidToUpiId || "N/A"}
            </Text>
          </View>
          <View style={styles.paymentRow}>
            <Text variant="bodyMedium" style={styles.paymentLabel}>
              Transaction ID
            </Text>
            <Text variant="bodyMedium" style={[styles.paymentValue, styles.transactionId]}>
              {paymentDetails.transactionId || "N/A"}
            </Text>
          </View>
          <View style={styles.paymentRow}>
            <Text variant="bodyMedium" style={styles.paymentLabel}>
              Submitted
            </Text>
            <Text variant="bodyMedium" style={styles.paymentValue}>
              {getTimeAgo(booking.payment?.advance?.submittedAt)}
            </Text>
          </View>
          {attemptCount > 0 && (
            <View style={styles.attemptBadge}>
              <MaterialCommunityIcons name="refresh" size={14} color="#FF9800" />
              <Text variant="labelSmall" style={styles.attemptText}>
                Attempt {attemptCount + 1} of 3
              </Text>
            </View>
          )}
        </Surface>

        {/* Payment Proof */}
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="camera" size={20} color={MANAGER_COLOR} />
          <Text variant="titleSmall" style={styles.sectionTitle}>
            PAYMENT PROOF
          </Text>
        </View>

        <Surface style={styles.screenshotCard} elevation={1}>
          {screenshotUrl ? (
            <>
              <TouchableOpacity
                onPress={() => setShowImageModal(true)}
                activeOpacity={0.9}
              >
                <Image
                  source={{ uri: screenshotUrl }}
                  style={styles.screenshot}
                  resizeMode="contain"
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.viewFullButton}
                onPress={() => setShowImageModal(true)}
              >
                <MaterialCommunityIcons name="magnify-plus" size={18} color={MANAGER_COLOR} />
                <Text variant="labelMedium" style={styles.viewFullText}>
                  View Full Size
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.noScreenshot}>
              <MaterialCommunityIcons name="image-off" size={48} color="#ccc" />
              <Text variant="bodyMedium" style={styles.noScreenshotText}>
                No screenshot uploaded
              </Text>
            </View>
          )}
        </Surface>

        {/* Verification Hint */}
        <View style={styles.hintRow}>
          <MaterialCommunityIcons name="check-circle" size={18} color="#4CAF50" />
          <Text variant="bodySmall" style={styles.hintText}>
            Verify the transaction in your UPI app. Booking will be auto-confirmed if slot is available.
          </Text>
        </View>

        {/* Action Buttons */}
        <Button
          mode="contained"
          onPress={handleVerify}
          style={styles.verifyButton}
          contentStyle={styles.buttonContent}
          buttonColor="#4CAF50"
          icon="check-circle"
          loading={isVerifying}
          disabled={isVerifying || isRejecting}
        >
          Verify & Confirm Booking
        </Button>

        <Button
          mode="contained"
          onPress={handleReject}
          style={styles.rejectButton}
          contentStyle={styles.buttonContent}
          buttonColor="#F44336"
          icon="close-circle"
          loading={isRejecting}
          disabled={isVerifying || isRejecting}
        >
          Payment Not Found - Reject
        </Button>

        {/* Warning */}
        <View style={styles.warningRow}>
          <MaterialCommunityIcons name="information" size={16} color="#FF9800" />
          <Text variant="bodySmall" style={styles.warningText}>
            Contact the customer before rejecting the payment
          </Text>
        </View>
      </ScrollView>

      {/* Full Size Image Modal */}
      <Modal
        visible={showImageModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowImageModal(false)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={() => setShowImageModal(false)}
          >
            <MaterialCommunityIcons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          {screenshotUrl && (
            <Image
              source={{ uri: screenshotUrl }}
              style={styles.modalImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

      {/* Rejection Reason Modal */}
      <Portal>
        <Dialog
          visible={showRejectModal}
          onDismiss={() => setShowRejectModal(false)}
          style={styles.dialog}
        >
          <Dialog.Title>Rejection Reason</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={styles.dialogSubtitle}>
              Please select a reason for rejecting this payment:
            </Text>
            <RadioButton.Group
              value={selectedReason}
              onValueChange={setSelectedReason}
            >
              {REJECTION_REASONS.map((reason) => (
                <TouchableOpacity
                  key={reason.id}
                  style={styles.reasonOption}
                  onPress={() => setSelectedReason(reason.id)}
                >
                  <RadioButton.Android value={reason.id} color={MANAGER_COLOR} />
                  <Text variant="bodyMedium" style={styles.reasonLabel}>
                    {reason.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </RadioButton.Group>

            {selectedReason === "other" && (
              <TextInput
                mode="outlined"
                placeholder="Enter reason..."
                value={otherReason}
                onChangeText={setOtherReason}
                style={styles.otherInput}
                multiline
                numberOfLines={2}
              />
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowRejectModal(false)}>Cancel</Button>
            <Button
              onPress={confirmReject}
              textColor="#F44336"
            >
              Reject Payment
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F0F4F8",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  loadingText: {
    color: "#666",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    gap: 16,
  },
  errorText: {
    color: "#666",
    textAlign: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontWeight: "bold",
    color: "#333",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  userCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#fff",
    marginBottom: 16,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${MANAGER_COLOR}15`,
    justifyContent: "center",
    alignItems: "center",
  },
  userDetails: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    fontWeight: "600",
    color: "#333",
  },
  userPhone: {
    color: "#666",
  },
  callButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#4CAF50",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  callButtonText: {
    color: "#fff",
    fontWeight: "500",
  },
  card: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#fff",
    marginBottom: 16,
  },
  bookingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  bookingText: {
    color: "#333",
    flex: 1,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitle: {
    fontWeight: "600",
    color: "#666",
    letterSpacing: 0.5,
  },
  paymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  paymentLabel: {
    color: "#666",
  },
  paymentValue: {
    color: "#333",
    fontWeight: "500",
  },
  transactionId: {
    fontFamily: "monospace",
    fontSize: 13,
  },
  attemptBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF3E0",
    padding: 8,
    borderRadius: 8,
    marginTop: 12,
    gap: 6,
  },
  attemptText: {
    color: "#FF9800",
  },
  screenshotCard: {
    borderRadius: 12,
    backgroundColor: "#fff",
    marginBottom: 16,
    overflow: "hidden",
  },
  screenshot: {
    width: "100%",
    height: 250,
    backgroundColor: "#F0F4F8",
  },
  viewFullButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  viewFullText: {
    color: MANAGER_COLOR,
  },
  noScreenshot: {
    padding: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  noScreenshotText: {
    color: "#999",
    marginTop: 12,
  },
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F5E9",
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
    gap: 8,
  },
  hintText: {
    flex: 1,
    color: "#4CAF50",
  },
  verifyButton: {
    borderRadius: 12,
    marginBottom: 12,
  },
  rejectButton: {
    borderRadius: 12,
    marginBottom: 16,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  warningRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  warningText: {
    color: "#666",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalCloseButton: {
    position: "absolute",
    top: 50,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  modalImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.8,
  },
  dialog: {
    backgroundColor: "#fff",
    borderRadius: 16,
  },
  dialogSubtitle: {
    color: "#666",
    marginBottom: 16,
  },
  reasonOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
  },
  reasonLabel: {
    color: "#333",
    flex: 1,
  },
  otherInput: {
    marginTop: 12,
    backgroundColor: "#fff",
  },
});
