import React, { useState, useCallback, useMemo } from "react";
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
  IconButton,
  Button,
  TextInput,
  Divider,
  ActivityIndicator,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSelector } from "react-redux";

import { selectUser } from "../../store/slices/authSlice";
import { ConfirmationDialog } from "../../components/booking";
import { createBookingWithTransaction } from "../../services/firebase/firestore";
import {
  calculateBookingPrice,
  calculateDuration,
  formatPrice,
} from "../../utils/priceUtils";

const USER_COLOR = "#4CAF50";

export default function BookingConfirmationScreen({ navigation, route }) {
  const {
    turfId,
    turf,
    ground,
    date,
    sport,
    startTime,
    endTime,
    totalPrice,
  } = route.params || {};

  const user = useSelector(selectUser);

  // State
  const [specialRequests, setSpecialRequests] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Calculate duration in hours
  const duration = useMemo(() => {
    if (!startTime || !endTime) return 0;
    return calculateDuration(startTime.time, endTime.time);
  }, [startTime, endTime]);

  // Calculate price breakdown using priceUtils
  const priceBreakdown = useMemo(() => {
    if (!ground?.pricing || !startTime || !endTime || !date) {
      return { slots: [], subtotal: totalPrice || 0, convenienceFee: 0, total: totalPrice || 0 };
    }

    const result = calculateBookingPrice(
      ground,
      sport,
      date.dateString,
      startTime.time,
      endTime.time
    );

    // Map slots to display format
    const slots = result.slots.map((s) => ({
      name: s.name,
      rate: s.rate,
      duration: s.durationHours,
      price: s.amount,
    }));

    const convenienceFee = 0; // Can add platform fee here

    return {
      slots,
      subtotal: result.subtotal,
      convenienceFee,
      total: result.subtotal + convenienceFee,
    };
  }, [ground, startTime, endTime, date, sport, totalPrice]);

  // Get user ID (handles different property names: id, userId, uid)
  const getUserId = () => user?.id || user?.userId || user?.uid;

  // Handle booking confirmation
  const handleConfirmBooking = useCallback(async () => {
    const currentUserId = getUserId();
    if (!currentUserId) {
      Alert.alert("Error", "Please login to make a booking");
      return;
    }

    setIsLoading(true);

    try {
      const bookingData = {
        turfId,
        turfName: turf?.name || "",
        groundId: ground?.id,
        groundName: ground?.name || "",
        userId: currentUserId,
        userName: user?.name || user?.displayName || "",
        userEmail: user?.email || "",
        userPhone: user?.phone || user?.phoneNumber || "",
        date: date.dateString,
        startTime: startTime.time,
        endTime: endTime.time,
        sport,
        duration,
        totalPrice: priceBreakdown.total,
        specialRequests: specialRequests.trim(),
        status: "pending",
        paymentStatus: "pending",
      };

      // Create booking with transaction to handle race conditions
      const result = await createBookingWithTransaction(bookingData);

      if (result.success) {
        setShowConfirmDialog(false);
        // Navigate to success screen
        navigation.replace("BookingSuccess", {
          bookingId: result.bookingId,
          booking: {
            ...bookingData,
            id: result.bookingId,
          },
          turf,
          ground,
          date,
          startTime,
          endTime,
        });
      } else {
        Alert.alert(
          "Booking Failed",
          result.message || "This slot is no longer available. Please try another time.",
          [
            {
              text: "Try Again",
              onPress: () => {
                setShowConfirmDialog(false);
                navigation.goBack();
              },
            },
          ]
        );
      }
    } catch (error) {
      console.error("Booking error:", error);
      Alert.alert(
        "Error",
        "An error occurred while creating your booking. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  }, [
    user,
    turfId,
    turf,
    ground,
    date,
    startTime,
    endTime,
    sport,
    duration,
    priceBreakdown,
    specialRequests,
    navigation,
  ]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton icon="arrow-left" onPress={() => navigation.goBack()} />
        <View style={styles.headerTitle}>
          <Text variant="titleMedium" style={styles.headerText}>
            Booking Summary
          </Text>
        </View>
        <View style={{ width: 48 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Venue Details Card */}
          <Surface style={styles.card} elevation={1}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="map-marker" size={24} color={USER_COLOR} />
              <Text variant="titleMedium" style={styles.cardTitle}>
                Venue Details
              </Text>
            </View>
            <Divider style={styles.divider} />
            <View style={styles.venueInfo}>
              <Text variant="titleSmall" style={styles.venueName}>
                {turf?.name || "Turf"}
              </Text>
              <Text variant="bodyMedium" style={styles.groundName}>
                {ground?.name || "Ground"} • {ground?.size || "Standard"}
              </Text>
              {turf?.location?.address && (
                <Text variant="bodySmall" style={styles.address}>
                  {turf.location.address}
                </Text>
              )}
            </View>
          </Surface>

          {/* Booking Details Card */}
          <Surface style={styles.card} elevation={1}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="calendar-clock" size={24} color={USER_COLOR} />
              <Text variant="titleMedium" style={styles.cardTitle}>
                Booking Details
              </Text>
            </View>
            <Divider style={styles.divider} />

            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <MaterialCommunityIcons name="calendar" size={20} color="#666" />
              </View>
              <View style={styles.detailContent}>
                <Text variant="bodySmall" style={styles.detailLabel}>Date</Text>
                <Text variant="bodyMedium" style={styles.detailValue}>
                  {date?.weekday}, {date?.day} {date?.month}
                </Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <MaterialCommunityIcons name="clock-outline" size={20} color="#666" />
              </View>
              <View style={styles.detailContent}>
                <Text variant="bodySmall" style={styles.detailLabel}>Time</Text>
                <Text variant="bodyMedium" style={styles.detailValue}>
                  {startTime?.label} - {endTime?.label} ({duration} hr{duration !== 1 ? "s" : ""})
                </Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <MaterialCommunityIcons name="soccer" size={20} color="#666" />
              </View>
              <View style={styles.detailContent}>
                <Text variant="bodySmall" style={styles.detailLabel}>Sport</Text>
                <Text variant="bodyMedium" style={styles.detailValue}>
                  {sport || "Sport"}
                </Text>
              </View>
            </View>
          </Surface>

          {/* Price Breakdown Card */}
          <Surface style={styles.card} elevation={1}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="receipt" size={24} color={USER_COLOR} />
              <Text variant="titleMedium" style={styles.cardTitle}>
                Price Breakdown
              </Text>
            </View>
            <Divider style={styles.divider} />

            {priceBreakdown.slots.map((slot, index) => (
              <View key={index} style={styles.priceRow}>
                <Text variant="bodyMedium" style={styles.priceLabel}>
                  {slot.name} ({slot.duration} hr{slot.duration !== 1 ? "s" : ""})
                </Text>
                <Text variant="bodyMedium" style={styles.priceAmount}>
                  ₹{Math.round(slot.price)}
                </Text>
              </View>
            ))}

            <Divider style={styles.priceDivider} />

            <View style={styles.priceRow}>
              <Text variant="bodyMedium" style={styles.priceLabel}>Subtotal</Text>
              <Text variant="bodyMedium" style={styles.priceAmount}>
                ₹{priceBreakdown.subtotal}
              </Text>
            </View>

            {priceBreakdown.convenienceFee > 0 && (
              <View style={styles.priceRow}>
                <Text variant="bodyMedium" style={styles.priceLabel}>Convenience Fee</Text>
                <Text variant="bodyMedium" style={styles.priceAmount}>
                  ₹{priceBreakdown.convenienceFee}
                </Text>
              </View>
            )}

            <Divider style={styles.priceDivider} />

            <View style={styles.totalRow}>
              <Text variant="titleMedium" style={styles.totalLabel}>Total Amount</Text>
              <Text variant="headlineSmall" style={styles.totalAmount}>
                ₹{priceBreakdown.total}
              </Text>
            </View>
          </Surface>

          {/* Special Requests Card */}
          <Surface style={styles.card} elevation={1}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="text-box-outline" size={24} color={USER_COLOR} />
              <Text variant="titleMedium" style={styles.cardTitle}>
                Special Requests
              </Text>
              <Text variant="bodySmall" style={styles.optionalLabel}>(Optional)</Text>
            </View>
            <Divider style={styles.divider} />
            <TextInput
              mode="outlined"
              placeholder="Add any special requests or notes..."
              value={specialRequests}
              onChangeText={setSpecialRequests}
              multiline
              numberOfLines={3}
              style={styles.requestsInput}
              outlineColor="#ddd"
              activeOutlineColor={USER_COLOR}
            />
          </Surface>

          {/* Cancellation Policy Card */}
          <Surface style={styles.card} elevation={1}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="information-outline" size={24} color="#FF9800" />
              <Text variant="titleMedium" style={styles.cardTitle}>
                Cancellation Policy
              </Text>
            </View>
            <Divider style={styles.divider} />
            <View style={styles.policyContent}>
              <View style={styles.policyItem}>
                <MaterialCommunityIcons name="check-circle" size={18} color={USER_COLOR} />
                <Text variant="bodySmall" style={styles.policyText}>
                  Free cancellation up to 24 hours before the booking
                </Text>
              </View>
              <View style={styles.policyItem}>
                <MaterialCommunityIcons name="clock-alert-outline" size={18} color="#FF9800" />
                <Text variant="bodySmall" style={styles.policyText}>
                  50% refund for cancellation within 24 hours
                </Text>
              </View>
              <View style={styles.policyItem}>
                <MaterialCommunityIcons name="close-circle" size={18} color="#F44336" />
                <Text variant="bodySmall" style={styles.policyText}>
                  No refund for no-shows or cancellation within 2 hours
                </Text>
              </View>
            </View>
          </Surface>

          {/* Bottom spacing */}
          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom Action */}
      <Surface style={styles.bottomAction} elevation={8}>
        <View style={styles.bottomContent}>
          <View style={styles.bottomPrice}>
            <Text variant="bodySmall" style={styles.bottomPriceLabel}>Total</Text>
            <Text variant="headlineSmall" style={styles.bottomPriceValue}>
              ₹{priceBreakdown.total}
            </Text>
          </View>
          <Button
            mode="contained"
            onPress={() => setShowConfirmDialog(true)}
            buttonColor={USER_COLOR}
            style={styles.confirmButton}
            contentStyle={styles.confirmButtonContent}
          >
            Proceed to Confirm
          </Button>
        </View>
      </Surface>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        visible={showConfirmDialog}
        onDismiss={() => setShowConfirmDialog(false)}
        onConfirm={handleConfirmBooking}
        bookingDetails={{
          turf,
          ground,
          date,
          sport,
          startTime,
          endTime,
          totalPrice: priceBreakdown.total,
        }}
        isLoading={isLoading}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  flex: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  headerTitle: {
    flex: 1,
    alignItems: "center",
  },
  headerText: {
    fontWeight: "600",
    color: "#333",
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },

  // Cards
  card: {
    borderRadius: 12,
    backgroundColor: "#fff",
    marginBottom: 16,
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    paddingBottom: 12,
  },
  cardTitle: {
    fontWeight: "600",
    color: "#333",
    marginLeft: 12,
    flex: 1,
  },
  optionalLabel: {
    color: "#999",
  },
  divider: {
    backgroundColor: "#eee",
  },

  // Venue Info
  venueInfo: {
    padding: 16,
    paddingTop: 12,
  },
  venueName: {
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  groundName: {
    color: "#666",
    marginBottom: 4,
  },
  address: {
    color: "#999",
  },

  // Detail Rows
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f5f5f5",
  },
  detailIcon: {
    width: 32,
    alignItems: "center",
  },
  detailContent: {
    flex: 1,
    marginLeft: 8,
  },
  detailLabel: {
    color: "#999",
    marginBottom: 2,
  },
  detailValue: {
    color: "#333",
    fontWeight: "500",
  },

  // Price Breakdown
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  priceLabel: {
    color: "#666",
  },
  priceAmount: {
    color: "#333",
    fontWeight: "500",
  },
  priceDivider: {
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: "#eee",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    paddingTop: 8,
    backgroundColor: USER_COLOR + "10",
  },
  totalLabel: {
    fontWeight: "600",
    color: "#333",
  },
  totalAmount: {
    fontWeight: "bold",
    color: USER_COLOR,
  },

  // Special Requests
  requestsInput: {
    margin: 16,
    marginTop: 12,
    backgroundColor: "#fff",
  },

  // Policy
  policyContent: {
    padding: 16,
    paddingTop: 12,
  },
  policyItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  policyText: {
    color: "#666",
    marginLeft: 10,
    flex: 1,
    lineHeight: 18,
  },

  // Bottom Action
  bottomAction: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  bottomContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    paddingBottom: 32,
  },
  bottomPrice: {
    flex: 1,
  },
  bottomPriceLabel: {
    color: "#666",
  },
  bottomPriceValue: {
    fontWeight: "bold",
    color: "#333",
  },
  confirmButton: {
    borderRadius: 8,
    minWidth: 180,
  },
  confirmButtonContent: {
    paddingVertical: 4,
  },
});
