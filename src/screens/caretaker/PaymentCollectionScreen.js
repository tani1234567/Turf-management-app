import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import {
  Text,
  Surface,
  TextInput,
  Button,
  Divider,
  Chip,
  RadioButton,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSelector } from "react-redux";
import { selectUser } from "../../store/slices/authSlice";
import {
  collectPayment,
  markBookingAsNoShow,
} from "../../services/firebase/firestore";

const CARETAKER_COLOR = "#FF9800";

export default function PaymentCollectionScreen({ route, navigation }) {
  const { booking } = route.params;
  const user = useSelector(selectUser);

  const [cashAmount, setCashAmount] = useState("");
  const [onlineAmount, setOnlineAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash"); // cash, online, both
  const [partialPaymentNotes, setPartialPaymentNotes] = useState("");
  const [isPartialPayment, setIsPartialPayment] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Calculate amounts
  const normalizeAmount = (value) => {
    const numberValue = typeof value === "string" ? parseFloat(value) : value;
    return Number.isFinite(numberValue) ? numberValue : 0;
  };

  const negotiationFinalPrice =
    booking.negotiation?.finalPrice ?? booking.negotiation?.requestedPrice;
  const hasNegotiation =
    booking.negotiation?.isNegotiated || Number.isFinite(negotiationFinalPrice);

  const extensionAmount = normalizeAmount(booking.extensionAmount) || 0;

  const baseFromSlots = Array.isArray(booking.timeSlots)
    ? booking.timeSlots
        .filter((slot) => !slot.isExtension)
        .reduce(
          (sum, slot) =>
            sum +
            normalizeAmount(slot.totalAmount ?? slot.amount ?? 0),
          0
        )
    : 0;

  const totalAmountRaw = normalizeAmount(booking.totalAmount);
  const baseFromTotal = booking.totalAmount != null
    ? totalAmountRaw - extensionAmount
    : 0;

  const baseAmount = hasNegotiation
    ? normalizeAmount(
        negotiationFinalPrice || baseFromSlots || baseFromTotal || booking.totalAmount || booking.baseAmount
      )
    : normalizeAmount(
        booking.baseAmount || baseFromSlots || baseFromTotal || booking.totalAmount
      );

  const totalAmount = baseAmount + extensionAmount;
  const advancePaid = normalizeAmount(booking.payment?.advanceAmount) || 0;
  const remainingAmount = booking.payment?.remainingAmount;
  const remainingPaid = booking.payment?.remainingPaid;
  const isPaymentComplete = Boolean(remainingPaid) || booking.status === "completed";
  const hasRemainingAmount = Number.isFinite(remainingAmount);
  const amountDue =
    hasRemainingAmount && (remainingPaid || normalizeAmount(remainingAmount) > 0)
      ? Math.max(normalizeAmount(remainingAmount), 0)
      : Math.max(totalAmount - advancePaid, 0);

  useEffect(() => {
    // Pre-fill full amount in cash by default
    setCashAmount(amountDue.toString());
  }, [amountDue]);

  const handlePaymentMethodChange = (method) => {
    setPaymentMethod(method);

    // Auto-fill amounts based on method
    if (method === "cash") {
      setCashAmount(amountDue.toString());
      setOnlineAmount("");
    } else if (method === "online") {
      setCashAmount("");
      setOnlineAmount(amountDue.toString());
    } else {
      // both - clear for manual entry
      setCashAmount("");
      setOnlineAmount("");
    }
  };

  const validatePayment = () => {
    const cash = parseFloat(cashAmount) || 0;
    const online = parseFloat(onlineAmount) || 0;
    const total = cash + online;

    if (total === 0) {
      Alert.alert("Error", "Please enter payment amount");
      return false;
    }

    if (total > amountDue) {
      Alert.alert(
        "Error",
        `Total payment (₹${total}) exceeds amount due (₹${amountDue})`
      );
      return false;
    }

    if (total < amountDue && !isPartialPayment) {
      Alert.alert(
        "Partial Payment",
        `Total payment (₹${total}) is less than amount due (₹${amountDue}). Do you want to accept partial payment?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Accept Partial",
            onPress: () => setIsPartialPayment(true),
          },
        ]
      );
      return false;
    }

    if (isPartialPayment && !partialPaymentNotes.trim()) {
      Alert.alert("Error", "Please add notes for partial payment");
      return false;
    }

    return true;
  };

  const handleCollectPayment = async () => {
    if (!validatePayment()) return;

    const cash = parseFloat(cashAmount) || 0;
    const online = parseFloat(onlineAmount) || 0;
    const totalCollected = cash + online;
    const isFullPayment = totalCollected === amountDue;

    Alert.alert(
      "Confirm Payment Collection",
      `Collect payment of ₹${totalCollected}?\n\n` +
        `Cash: ₹${cash}\n` +
        `Online: ₹${online}\n\n` +
        `${isFullPayment ? "Full payment" : "Partial payment"}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            setSubmitting(true);
            try {
              const paymentData = {
                cashAmount: cash,
                onlineAmount: online,
                totalAmount: totalCollected,
                isFullPayment,
                isPartialPayment: !isFullPayment,
                partialPaymentNotes: isPartialPayment ? partialPaymentNotes : "",
                collectedBy: user?.userId || user?.uid,
                collectedByName: user?.name || "Caretaker",
                collectedAt: new Date(),
              };

              const result = await collectPayment(booking.id, paymentData);

              if (result.success) {
                Alert.alert(
                  "Success",
                  "Payment collected successfully!",
                  [
                    {
                      text: "OK",
                      onPress: () => navigation.goBack(),
                    },
                  ]
                );
              } else {
                Alert.alert("Error", result.message || "Failed to collect payment");
              }
            } catch (error) {
              console.error("Error collecting payment:", error);
              Alert.alert("Error", "Failed to collect payment. Please try again.");
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const handleMarkNoShow = () => {
    Alert.alert(
      "Mark as No-Show",
      `Are you sure ${booking.userName} didn't show up for this booking?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm No-Show",
          style: "destructive",
          onPress: async () => {
            setSubmitting(true);
            try {
              const result = await markBookingAsNoShow(
                booking.id,
                user?.userId || user?.uid,
                user?.name || "Caretaker"
              );

              if (result.success) {
                Alert.alert(
                  "Marked as No-Show",
                  "Booking has been marked as no-show",
                  [
                    {
                      text: "OK",
                      onPress: () => navigation.goBack(),
                    },
                  ]
                );
              } else {
                Alert.alert("Error", result.message || "Failed to mark as no-show");
              }
            } catch (error) {
              console.error("Error marking no-show:", error);
              Alert.alert("Error", "Failed to mark as no-show. Please try again.");
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const calculateDuration = () => {
    if (booking.totalDuration) return booking.totalDuration;

    const [startHour, startMin] = (booking.startTime || "00:00").split(":").map(Number);
    const [endHour, endMin] = (booking.endTime || "00:00").split(":").map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    return (endMinutes - startMinutes) / 60;
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text variant="headlineSmall" style={styles.title}>
              Collect Payment
            </Text>
            <Chip
              icon="clock-outline"
              style={styles.statusChip}
              textStyle={styles.statusChipText}
            >
              {booking.status || "Pending"}
            </Chip>
          </View>

          {/* Booking Details */}
          <Surface style={styles.section} elevation={1}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Booking Details
            </Text>
            <Divider style={styles.divider} />

            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="account" size={20} color="#666" />
              <View style={styles.detailContent}>
                <Text variant="bodySmall" style={styles.detailLabel}>
                  Customer
                </Text>
                <Text variant="bodyLarge" style={styles.detailValue}>
                  {booking.userName || "Unknown"}
                </Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="phone" size={20} color="#666" />
              <View style={styles.detailContent}>
                <Text variant="bodySmall" style={styles.detailLabel}>
                  Phone
                </Text>
                <Text variant="bodyLarge" style={styles.detailValue}>
                  {booking.userPhone || "N/A"}
                </Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="calendar" size={20} color="#666" />
              <View style={styles.detailContent}>
                <Text variant="bodySmall" style={styles.detailLabel}>
                  Date
                </Text>
                <Text variant="bodyLarge" style={styles.detailValue}>
                  {formatDate(booking.date)}
                </Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="clock-outline" size={20} color="#666" />
              <View style={styles.detailContent}>
                <Text variant="bodySmall" style={styles.detailLabel}>
                  Time
                </Text>
                <Text variant="bodyLarge" style={styles.detailValue}>
                  {booking.startTime} - {booking.endTime}
                </Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="timer" size={20} color="#666" />
              <View style={styles.detailContent}>
                <Text variant="bodySmall" style={styles.detailLabel}>
                  Duration
                </Text>
                <Text variant="bodyLarge" style={styles.detailValue}>
                  {calculateDuration()} hours
                </Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="soccer" size={20} color="#666" />
              <View style={styles.detailContent}>
                <Text variant="bodySmall" style={styles.detailLabel}>
                  Sport
                </Text>
                <Text variant="bodyLarge" style={styles.detailValue}>
                  {booking.sport || "N/A"}
                </Text>
              </View>
            </View>
          </Surface>

          {/* Amount Breakdown */}
          <Surface style={styles.section} elevation={1}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Amount Breakdown
            </Text>
            <Divider style={styles.divider} />

            <View style={styles.amountRow}>
              <Text variant="bodyMedium" style={styles.amountLabel}>
                {hasNegotiation ? "Negotiated Amount" : "Base Amount"}
              </Text>
              <Text variant="bodyMedium" style={styles.amountValue}>
                ₹{baseAmount}
              </Text>
            </View>

            {extensionAmount > 0 && (
              <View style={styles.amountRow}>
                <Text variant="bodyMedium" style={styles.amountLabel}>
                  Extension
                </Text>
                <Text variant="bodyMedium" style={[styles.amountValue, { color: CARETAKER_COLOR }]}>
                  +₹{extensionAmount}
                </Text>
              </View>
            )}

            <Divider style={styles.divider} />

            <View style={styles.amountRow}>
              <Text variant="bodyMedium" style={styles.amountLabel}>
                Total Amount
              </Text>
              <Text variant="bodyLarge" style={styles.amountValue}>
                ₹{totalAmount}
              </Text>
            </View>

            {advancePaid > 0 && (
              <View style={styles.amountRow}>
                <Text variant="bodyMedium" style={styles.amountLabel}>
                  Advance Paid
                </Text>
                <Text variant="bodyMedium" style={[styles.amountValue, { color: "#4CAF50" }]}>
                  -₹{advancePaid}
                </Text>
              </View>
            )}

            <Divider style={styles.divider} />

            <View style={styles.amountRow}>
              <Text variant="titleMedium" style={[styles.amountLabel, { fontWeight: "bold" }]}>
                Amount Due
              </Text>
              <Text variant="headlineSmall" style={[styles.amountValue, { color: CARETAKER_COLOR, fontWeight: "bold" }]}>
                ₹{amountDue}
              </Text>
            </View>
          </Surface>

          {/* Payment Collection Form */}
          <Surface style={styles.section} elevation={1}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Collect Payment
            </Text>
            <Divider style={styles.divider} />

            {/* Payment Method Selection */}
            <Text variant="bodyMedium" style={styles.inputLabel}>
              Payment Method
            </Text>
            <RadioButton.Group
              onValueChange={handlePaymentMethodChange}
              value={paymentMethod}
            >
              <View style={styles.radioRow}>
                <RadioButton.Item
                  label="Cash"
                  value="cash"
                  position="leading"
                  style={styles.radioItem}
                />
              </View>
              <View style={styles.radioRow}>
                <RadioButton.Item
                  label="Online (GPay/PhonePe/UPI)"
                  value="online"
                  position="leading"
                  style={styles.radioItem}
                />
              </View>
              <View style={styles.radioRow}>
                <RadioButton.Item
                  label="Both (Cash + Online)"
                  value="both"
                  position="leading"
                  style={styles.radioItem}
                />
              </View>
            </RadioButton.Group>

            {/* Cash Amount */}
            {(paymentMethod === "cash" || paymentMethod === "both") && (
              <View style={styles.inputContainer}>
                <Text variant="bodyMedium" style={styles.inputLabel}>
                  Cash Amount
                </Text>
                <TextInput
                  mode="outlined"
                  value={cashAmount}
                  onChangeText={setCashAmount}
                  keyboardType="numeric"
                  placeholder="0"
                  left={<TextInput.Icon icon="currency-inr" />}
                  style={styles.input}
                  outlineColor="#E0E0E0"
                  activeOutlineColor={CARETAKER_COLOR}
                />
              </View>
            )}

            {/* Online Amount */}
            {(paymentMethod === "online" || paymentMethod === "both") && (
              <View style={styles.inputContainer}>
                <Text variant="bodyMedium" style={styles.inputLabel}>
                  Online Amount (GPay/PhonePe/UPI)
                </Text>
                <TextInput
                  mode="outlined"
                  value={onlineAmount}
                  onChangeText={setOnlineAmount}
                  keyboardType="numeric"
                  placeholder="0"
                  left={<TextInput.Icon icon="cellphone" />}
                  style={styles.input}
                  outlineColor="#E0E0E0"
                  activeOutlineColor={CARETAKER_COLOR}
                />
              </View>
            )}

            {/* Total Collected Display */}
            <View
              style={[
                styles.totalCollectedContainer,
                isPaymentComplete && styles.totalCollectedContainerPaid,
              ]}
            >
              {isPaymentComplete ? (
                <>
                  <Text variant="bodyMedium" style={styles.totalCollectedLabelPaid}>
                    Paid
                  </Text>
                  <Text variant="headlineMedium" style={styles.totalCollectedValuePaid}>
                    ₹{(normalizeAmount(booking.payment?.cashAmount) || 0) +
                      (normalizeAmount(booking.payment?.onlineAmount) || 0) ||
                      totalAmount}
                  </Text>
                </>
              ) : (
                <>
                  <Text variant="bodyMedium" style={styles.totalCollectedLabel}>
                    Total Collecting:
                  </Text>
                  <Text variant="headlineMedium" style={styles.totalCollectedValue}>
                    ₹{(parseFloat(cashAmount) || 0) + (parseFloat(onlineAmount) || 0)}
                  </Text>
                </>
              )}
            </View>

            {/* Partial Payment Notes */}
            {isPartialPayment && (
              <View style={styles.inputContainer}>
                <Text variant="bodyMedium" style={styles.inputLabel}>
                  Partial Payment Notes (Required)
                </Text>
                <TextInput
                  mode="outlined"
                  value={partialPaymentNotes}
                  onChangeText={setPartialPaymentNotes}
                  placeholder="Reason for partial payment..."
                  multiline
                  numberOfLines={3}
                  style={styles.input}
                  outlineColor="#E0E0E0"
                  activeOutlineColor={CARETAKER_COLOR}
                />
              </View>
            )}
          </Surface>

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            <Button
              mode="contained"
              onPress={handleCollectPayment}
              loading={submitting}
              disabled={submitting}
              style={styles.primaryButton}
              buttonColor={CARETAKER_COLOR}
              icon="cash-check"
            >
              Collect Payment
            </Button>

            <Button
              mode="outlined"
              onPress={handleMarkNoShow}
              disabled={submitting}
              style={styles.noShowButton}
              textColor="#F44336"
              icon="account-cancel"
            >
              Mark as No-Show
            </Button>

            <Button
              mode="text"
              onPress={() => navigation.goBack()}
              disabled={submitting}
              style={styles.cancelButton}
            >
              Cancel
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontWeight: "bold",
    color: "#333",
  },
  statusChip: {
    backgroundColor: "#E3F2FD",
  },
  statusChipText: {
    color: "#1976D2",
    fontSize: 12,
  },
  section: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#fff",
    marginBottom: 16,
  },
  sectionTitle: {
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  divider: {
    marginVertical: 12,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  detailContent: {
    marginLeft: 12,
    flex: 1,
  },
  detailLabel: {
    color: "#666",
    marginBottom: 2,
  },
  detailValue: {
    color: "#333",
    fontWeight: "500",
  },
  amountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  amountLabel: {
    color: "#666",
  },
  amountValue: {
    color: "#333",
    fontWeight: "500",
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    color: "#666",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#fff",
  },
  radioRow: {
    marginVertical: 4,
  },
  radioItem: {
    paddingVertical: 4,
  },
  totalCollectedContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFF3E0",
    padding: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  totalCollectedContainerPaid: {
    backgroundColor: "#E8F5E9",
  },
  totalCollectedLabel: {
    color: "#666",
    fontWeight: "600",
  },
  totalCollectedValue: {
    color: CARETAKER_COLOR,
    fontWeight: "bold",
  },
  totalCollectedLabelPaid: {
    color: "#2E7D32",
    fontWeight: "600",
  },
  totalCollectedValuePaid: {
    color: "#2E7D32",
    fontWeight: "bold",
  },
  actionsContainer: {
    marginTop: 8,
  },
  primaryButton: {
    borderRadius: 8,
    marginBottom: 12,
  },
  noShowButton: {
    borderRadius: 8,
    marginBottom: 12,
    borderColor: "#F44336",
  },
  cancelButton: {
    borderRadius: 8,
  },
});
