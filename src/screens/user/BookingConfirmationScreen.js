import React, { useState, useCallback, useMemo, useEffect } from "react";
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
  RadioButton,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSelector } from "react-redux";

import { selectUser } from "../../store/slices/authSlice";
import { selectCompany } from "../../store/slices/companySlice";
import { ConfirmationDialog } from "../../components/booking";
import { createBookingWithTransaction, getDocument } from "../../services/firebase/firestore";
import { canUserBook } from "../../services/firebase/payments";
import { checkSlotAvailability } from "../../utils/slotLockUtils";
import {
  calculateBookingPrice,
  calculateDuration,
  formatPrice,
} from "../../utils/priceUtils";

const USER_COLOR = "#10B981";
const EMERALD_PALE = "#D1FAE5";

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
  const company = useSelector(selectCompany);

  // State
  const [specialRequests, setSpecialRequests] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("upi"); // "upi" or "cash_at_venue"
  const [companyPaymentConfig, setCompanyPaymentConfig] = useState(null);

  // Get advance payment settings from turf
  const advancePayment = turf?.advancePayment || {
    isRequired: false,
    percentage: 0,
    paymentTiming: "before_approval",
    paymentTimeout: 120,
    allowedMethods: ["upi", "cash_at_venue"],
  };

  // Fetch company payment config if needed
  useEffect(() => {
    const fetchCompanyPaymentConfig = async () => {
      if (advancePayment.isRequired && turf?.companyId) {
        try {
          const companyDoc = await getDocument("companies", turf.companyId);
          if (companyDoc?.paymentConfig) {
            setCompanyPaymentConfig(companyDoc.paymentConfig);
          }
        } catch (error) {
          console.error("Error fetching company payment config:", error);
        }
      }
    };
    fetchCompanyPaymentConfig();
  }, [advancePayment.isRequired, turf?.companyId]);

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

    // Calculate advance amount if required
    const total = result.subtotal + convenienceFee;
    const advanceAmount = advancePayment.isRequired
      ? Math.round((total * advancePayment.percentage) / 100)
      : 0;
    const remainingAmount = total - advanceAmount;

    return {
      slots,
      subtotal: result.subtotal,
      convenienceFee,
      total,
      advanceAmount,
      remainingAmount,
    };
  }, [ground, startTime, endTime, date, sport, totalPrice, advancePayment]);

  // Get user ID (handles different property names: id, userId, uid)
  const getUserId = () => user?.id || user?.userId || user?.uid;

  // Handle booking confirmation
  const handleConfirmBooking = useCallback(async () => {
    const currentUserId = getUserId();
    if (!currentUserId) {
      Alert.alert("Error", "Please login to make a booking");
      return;
    }

    // Check if user is banned from booking
    const banCheck = canUserBook(user);
    if (!banCheck.allowed) {
      Alert.alert("Booking Restricted", banCheck.reason);
      return;
    }

    // Check if UPI is selected but not configured
    if (
      advancePayment.isRequired &&
      advancePayment.paymentTiming === "before_approval" &&
      paymentMethod === "upi" &&
      !companyPaymentConfig?.upiEnabled
    ) {
      Alert.alert(
        "UPI Not Available",
        "The turf owner hasn't configured UPI payments. Please select 'Pay at Venue' or contact the turf."
      );
      return;
    }

    setIsLoading(true);

    try {
      // Pre-check slot availability (catches soft locks with friendly message)
      const availability = await checkSlotAvailability(
        turfId,
        ground?.id,
        date.dateString,
        startTime.time,
        endTime.time,
        advancePayment.paymentTiming || "before_approval"
      );

      if (!availability.available) {
        setIsLoading(false);
        setShowConfirmDialog(false);
        Alert.alert(
          availability.reason === "being_booked" ? "Slot Currently Unavailable" : "Booking Failed",
          availability.message || "This slot is no longer available.",
          [
            {
              text: "OK",
              onPress: () => navigation.goBack(),
            },
          ]
        );
        return;
      }

      // Determine initial status based on advance payment settings
      let initialStatus = "pending";
      let advanceStatus = "not_required";

      if (advancePayment.isRequired) {
        if (advancePayment.paymentTiming === "before_approval") {
          if (paymentMethod === "upi") {
            initialStatus = "pending_payment";
            advanceStatus = "pending";
          } else {
            // Cash at venue - proceed to pending for approval
            initialStatus = "pending";
            advanceStatus = "cash_at_venue";
          }
        } else {
          // after_approval - normal pending, payment after manager approves
          initialStatus = "pending";
          advanceStatus = "pending";
        }
      }

      // Build slot lock based on payment flow
      const now = new Date();
      const isSoftLock =
        advancePayment.isRequired &&
        advancePayment.paymentTiming === "before_approval" &&
        paymentMethod === "upi";
      const softLockExpiry = new Date(now.getTime() + 10 * 60 * 1000);

      const bookingData = {
        turfId,
        companyId: turf?.companyId || "",
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
        totalAmount: priceBreakdown.total,
        specialRequests: specialRequests.trim(),
        status: initialStatus,
        // Slot Lock
        slotLock: {
          isLocked: isSoftLock,
          lockType: isSoftLock ? "soft" : null,
          lockedAt: isSoftLock ? now.toISOString() : null,
          lockExpiry: isSoftLock ? softLockExpiry.toISOString() : null,
          lockReason: isSoftLock ? "payment_pending" : null,
        },
        // Payment structure following V2.1 schema
        payment: {
          slotAmount: priceBreakdown.total,
          advanceConfig: {
            isRequired: advancePayment.isRequired,
            percentage: advancePayment.percentage,
            paymentTiming: advancePayment.paymentTiming,
            paymentTimeout: advancePayment.paymentTimeout,
          },
          advanceAmount: priceBreakdown.advanceAmount,
          remainingAmount: priceBreakdown.remainingAmount,
          advance: {
            status: advanceStatus,
            method: advancePayment.isRequired ? paymentMethod : "not_applicable",
            upiDetails: null,
            verification: null,
            submittedAt: null,
            paymentDeadline: null,
            isExpired: false,
          },
          onGround: {
            status: "pending",
            cashAmount: 0,
            onlineAmount: 0,
            totalCollected: 0,
            collectedBy: null,
            collectedAt: null,
            notes: "",
          },
          refund: {
            isRequired: false,
            refundAmount: 0,
            refundReason: "",
            refundStatus: "not_required",
            refundMethod: "",
            refundedBy: null,
            refundedAt: null,
            refundNote: "",
          },
          totalPaid: 0,
          totalPending: priceBreakdown.total,
          isFullyPaid: false,
        },
        paymentAttempts: [],
        statusHistory: [
          {
            status: initialStatus,
            timestamp: now.toISOString(),
            changedBy: currentUserId,
            changedByRole: "user",
            reason: isSoftLock
              ? "Booking created, awaiting payment"
              : "Booking request submitted",
          },
        ],
      };

      // Create booking with transaction to handle race conditions
      const result = await createBookingWithTransaction(bookingData);

      if (result.success) {
        setShowConfirmDialog(false);

        // Check if we need to redirect to UPI payment
        if (
          advancePayment.isRequired &&
          advancePayment.paymentTiming === "before_approval" &&
          paymentMethod === "upi"
        ) {
          // Navigate to UPI Payment screen
          navigation.replace("UpiPayment", {
            bookingId: result.bookingId,
            amount: priceBreakdown.advanceAmount,
            upiId: companyPaymentConfig?.upiId,
            upiHolderName: companyPaymentConfig?.upiHolderName,
            qrCodeUrl: companyPaymentConfig?.upiQrCode,
            turfName: turf?.name || "",
            lockExpiry: softLockExpiry.getTime(),
          });
        } else {
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
        }
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
    advancePayment,
    paymentMethod,
    companyPaymentConfig,
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

          {/* Advance Payment Card - Only show if required */}
          {advancePayment.isRequired && priceBreakdown.advanceAmount > 0 && (
            <Surface style={styles.card} elevation={1}>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="cash-clock" size={24} color="#FF5722" />
                <Text variant="titleMedium" style={styles.cardTitle}>
                  Advance Payment
                </Text>
              </View>
              <Divider style={styles.divider} />

              {/* Advance Amount Info */}
              <View style={styles.advanceInfoSection}>
                <View style={styles.advanceAmountRow}>
                  <Text variant="bodyMedium" style={styles.advanceLabel}>
                    Advance Required ({advancePayment.percentage}%)
                  </Text>
                  <Text variant="titleMedium" style={styles.advanceAmount}>
                    ₹{priceBreakdown.advanceAmount}
                  </Text>
                </View>
                <View style={styles.advanceAmountRow}>
                  <Text variant="bodyMedium" style={styles.advanceLabel}>
                    Pay at Venue
                  </Text>
                  <Text variant="bodyMedium" style={styles.remainingAmount}>
                    ₹{priceBreakdown.remainingAmount}
                  </Text>
                </View>

                {/* Payment Timing Info */}
                <View style={styles.timingInfoBox}>
                  <MaterialCommunityIcons
                    name={advancePayment.paymentTiming === "before_approval" ? "clock-alert" : "clock-check"}
                    size={18}
                    color={advancePayment.paymentTiming === "before_approval" ? "#FF5722" : "#10B981"}
                  />
                  <Text variant="bodySmall" style={styles.timingText}>
                    {advancePayment.paymentTiming === "before_approval"
                      ? "Pay advance now to submit your booking request"
                      : `Pay within ${advancePayment.paymentTimeout} minutes after manager approves`}
                  </Text>
                </View>
              </View>

              <Divider style={styles.divider} />

              {/* Payment Method Selection - Only for before_approval */}
              {advancePayment.paymentTiming === "before_approval" && (
                <View style={styles.paymentMethodSection}>
                  <Text variant="titleSmall" style={styles.paymentMethodTitle}>
                    Choose Payment Method
                  </Text>

                  <RadioButton.Group
                    value={paymentMethod}
                    onValueChange={setPaymentMethod}
                  >
                    {advancePayment.allowedMethods?.includes("upi") && (
                      <View style={styles.radioOption}>
                        <RadioButton.Android value="upi" color={USER_COLOR} />
                        <View style={styles.radioContent}>
                          <View style={styles.radioLabelRow}>
                            <MaterialCommunityIcons name="cellphone" size={20} color="#666" />
                            <Text variant="bodyMedium" style={styles.radioLabel}>
                              Pay via UPI
                            </Text>
                            {companyPaymentConfig?.upiEnabled && (
                              <View style={styles.recommendedBadge}>
                                <Text variant="labelSmall" style={styles.recommendedText}>
                                  Recommended
                                </Text>
                              </View>
                            )}
                          </View>
                          <Text variant="bodySmall" style={styles.radioDescription}>
                            Pay ₹{priceBreakdown.advanceAmount} via GPay, PhonePe, Paytm
                          </Text>
                        </View>
                      </View>
                    )}

                    {advancePayment.allowedMethods?.includes("cash_at_venue") && (
                      <View style={styles.radioOption}>
                        <RadioButton.Android value="cash_at_venue" color={USER_COLOR} />
                        <View style={styles.radioContent}>
                          <View style={styles.radioLabelRow}>
                            <MaterialCommunityIcons name="cash" size={20} color="#666" />
                            <Text variant="bodyMedium" style={styles.radioLabel}>
                              Pay at Venue
                            </Text>
                          </View>
                          <Text variant="bodySmall" style={styles.radioDescription}>
                            Pay full amount ₹{priceBreakdown.total} when you arrive
                          </Text>
                        </View>
                      </View>
                    )}
                  </RadioButton.Group>

                  {/* UPI not configured warning */}
                  {paymentMethod === "upi" && !companyPaymentConfig?.upiEnabled && (
                    <View style={styles.warningBox}>
                      <MaterialCommunityIcons name="alert" size={18} color="#FF9800" />
                      <Text variant="bodySmall" style={styles.warningText}>
                        UPI payments not available for this turf. Please select 'Pay at Venue'.
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* After approval info */}
              {advancePayment.paymentTiming === "after_approval" && (
                <View style={styles.afterApprovalInfo}>
                  <MaterialCommunityIcons name="information" size={18} color="#2196F3" />
                  <Text variant="bodySmall" style={styles.afterApprovalText}>
                    Your booking will be sent for approval. Once approved, you'll have {advancePayment.paymentTimeout} minutes to pay the advance.
                  </Text>
                </View>
              )}
            </Surface>
          )}

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
            {advancePayment.isRequired && advancePayment.paymentTiming === "before_approval" && paymentMethod === "upi" ? (
              <>
                <Text variant="bodySmall" style={styles.bottomPriceLabel}>Pay Now</Text>
                <Text variant="headlineSmall" style={[styles.bottomPriceValue, { color: "#FF5722" }]}>
                  ₹{priceBreakdown.advanceAmount}
                </Text>
              </>
            ) : (
              <>
                <Text variant="bodySmall" style={styles.bottomPriceLabel}>Total</Text>
                <Text variant="headlineSmall" style={styles.bottomPriceValue}>
                  ₹{priceBreakdown.total}
                </Text>
              </>
            )}
          </View>
          <Button
            mode="contained"
            onPress={() => setShowConfirmDialog(true)}
            buttonColor={advancePayment.isRequired && advancePayment.paymentTiming === "before_approval" && paymentMethod === "upi" ? "#FF5722" : USER_COLOR}
            style={styles.confirmButton}
            contentStyle={styles.confirmButtonContent}
          >
            {advancePayment.isRequired && advancePayment.paymentTiming === "before_approval" && paymentMethod === "upi"
              ? "Proceed to Pay"
              : "Proceed to Confirm"}
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

  // Advance Payment Section
  advanceInfoSection: {
    padding: 16,
    paddingTop: 12,
  },
  advanceAmountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  advanceLabel: {
    color: "#666",
  },
  advanceAmount: {
    fontWeight: "bold",
    color: "#FF5722",
  },
  remainingAmount: {
    color: "#666",
  },
  timingInfoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFF3E0",
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    gap: 8,
  },
  timingText: {
    flex: 1,
    color: "#666",
    lineHeight: 18,
  },
  paymentMethodSection: {
    padding: 16,
    paddingTop: 12,
  },
  paymentMethodTitle: {
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  radioOption: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  radioContent: {
    flex: 1,
    marginLeft: 4,
    paddingTop: 6,
  },
  radioLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  radioLabel: {
    color: "#333",
    fontWeight: "500",
  },
  radioDescription: {
    color: "#999",
    marginTop: 2,
  },
  recommendedBadge: {
    backgroundColor: "#D1FAE5",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  recommendedText: {
    color: "#10B981",
  },
  warningBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFF8E1",
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    gap: 8,
  },
  warningText: {
    flex: 1,
    color: "#F57C00",
    lineHeight: 18,
  },
  afterApprovalInfo: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 16,
    paddingTop: 12,
    backgroundColor: "#E3F2FD",
    gap: 8,
  },
  afterApprovalText: {
    flex: 1,
    color: "#1976D2",
    lineHeight: 18,
  },
});
