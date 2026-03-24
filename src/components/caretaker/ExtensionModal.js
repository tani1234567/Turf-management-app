import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import {
  Text,
  Surface,
  Button,
  TextInput,
  Divider,
  RadioButton,
} from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSelector } from "react-redux";
import { selectUser } from "../../store/slices/authSlice";
import { checkSlotAvailability } from "../../services/firebase/booking";
import { extendBookingTime } from "../../services/firebase/firestore";

const CARETAKER_COLOR = "#FF9800";

// Extension options in hours
const EXTENSION_OPTIONS = [
  { label: "30 Minutes", value: 0.5, icon: "clock-outline" },
  { label: "1 Hour", value: 1, icon: "clock-outline" },
  { label: "1.5 Hours", value: 1.5, icon: "clock-outline" },
  { label: "2 Hours", value: 2, icon: "clock-outline" },
  { label: "Custom", value: "custom", icon: "clock-edit-outline" },
];

export default function ExtensionModal({
  visible,
  onDismiss,
  booking,
  onExtensionSuccess,
}) {
  const user = useSelector(selectUser);

  const [selectedExtension, setSelectedExtension] = useState(0.5);
  const [customHours, setCustomHours] = useState("");
  const [customMinutes, setCustomMinutes] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState(null);
  const [extensionCharge, setExtensionCharge] = useState(null);
  const [chargeCalculationFailed, setChargeCalculationFailed] = useState(false);
  const [manualCharge, setManualCharge] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setSelectedExtension(0.5);
      setCustomHours("");
      setCustomMinutes("");
      setIsAvailable(null);
      setExtensionCharge(null);
      setChargeCalculationFailed(false);
      setManualCharge("");
    }
  }, [visible]);

  // Calculate extension duration based on selection
  const getExtensionDuration = () => {
    if (selectedExtension === "custom") {
      const hours = parseFloat(customHours) || 0;
      const minutes = parseFloat(customMinutes) || 0;
      return hours + minutes / 60;
    }
    return selectedExtension;
  };

  // Calculate new end time
  const calculateNewEndTime = (endTime, extensionDuration) => {
    if (!endTime || !extensionDuration) return null;

    const [hours, minutes] = endTime.split(":").map(Number);
    const totalMinutes = hours * 60 + minutes + extensionDuration * 60;
    const newHours = Math.floor(totalMinutes / 60) % 24;
    const newMinutes = Math.floor(totalMinutes % 60);

    return `${String(newHours).padStart(2, "0")}:${String(newMinutes).padStart(2, "0")}`;
  };

  // Calculate extension charge based on hourly rate. Returns null if rate cannot be determined.
  const calculateExtensionCharge = () => {
    if (!booking) return null;

    const extensionDuration = getExtensionDuration();
    if (extensionDuration <= 0) return null;

    const hourlyRate =
      booking.timeSlots?.[0]?.hourlyRate ||
      (booking.baseAmount != null && booking.totalDuration
        ? booking.baseAmount / booking.totalDuration
        : null);

    if (!hourlyRate || !isFinite(hourlyRate) || hourlyRate <= 0) return null;

    const charge = Math.round(hourlyRate * extensionDuration);
    return isFinite(charge) && charge > 0 ? charge : null;
  };

  // Check if extension is possible
  const checkExtensionAvailability = async () => {
    const extensionDuration = getExtensionDuration();

    if (extensionDuration <= 0) {
      Alert.alert("Error", "Please enter a valid extension duration");
      return;
    }

    if (selectedExtension === "custom") {
      const hours = parseFloat(customHours) || 0;
      const minutes = parseFloat(customMinutes) || 0;

      if (hours === 0 && minutes === 0) {
        Alert.alert("Error", "Please enter hours or minutes for custom extension");
        return;
      }

      if (minutes >= 60) {
        Alert.alert("Error", "Minutes should be less than 60");
        return;
      }
    }

    setIsChecking(true);
    setIsAvailable(null);
    setExtensionCharge(null);
    setChargeCalculationFailed(false);
    setManualCharge("");

    try {
      const newEndTime = calculateNewEndTime(booking.endTime, extensionDuration);

      console.log("ExtensionModal - Checking availability:");
      console.log("  - turfId:", booking.turfId);
      console.log("  - groundId:", booking.groundId);
      console.log("  - date:", booking.date);
      console.log("  - startTime (current endTime):", booking.endTime);
      console.log("  - newEndTime:", newEndTime);
      console.log("  - current bookingId:", booking.id);

      // Check if the extended slot is available
      const result = await checkSlotAvailability(
        booking.turfId,
        booking.groundId,
        booking.date,
        booking.endTime, // Start from current end time
        newEndTime,
        booking.groundName
      );

      console.log("ExtensionModal - Availability result:", result);
      console.log("  - available:", result.available);
      console.log("  - conflicts count:", result.conflicts?.length);
      if (result.conflicts && result.conflicts.length > 0) {
        console.log("  - conflicts:", JSON.stringify(result.conflicts, null, 2));
      }

      // Filter out the current booking from conflicts (if it appears)
      const actualConflicts = result.conflicts?.filter(
        (conflict) => conflict.id !== booking.id
      ) || [];

      console.log("ExtensionModal - Actual conflicts (excluding current booking):", actualConflicts.length);

      const isActuallyAvailable = actualConflicts.length === 0;
      setIsAvailable(isActuallyAvailable);

      if (isActuallyAvailable) {
        const charge = calculateExtensionCharge();
        if (charge !== null) {
          setExtensionCharge(charge);
          setChargeCalculationFailed(false);
        } else {
          setExtensionCharge(null);
          setChargeCalculationFailed(true);
        }
      } else {
        // Show details about conflicting bookings
        const conflictDetails = actualConflicts
          .map((c) => `${c.startTime} - ${c.endTime} (${c.userName || "Unknown"})`)
          .join("\n");

        Alert.alert(
          "Slot Not Available",
          `The requested extension time is not available. Another booking exists in this slot:\n\n${conflictDetails}`,
          [{ text: "OK" }]
        );
      }
    } catch (error) {
      console.error("Error checking availability:", error);
      Alert.alert("Error", "Failed to check availability. Please try again.");
    } finally {
      setIsChecking(false);
    }
  };

  const handleConfirmExtension = async () => {
    if (!isAvailable) {
      Alert.alert("Error", "Please check availability first");
      return;
    }

    const finalCharge = chargeCalculationFailed
      ? parseFloat(manualCharge) || 0
      : extensionCharge;

    if (!finalCharge || finalCharge <= 0) {
      Alert.alert("Error", "Please enter a valid extension charge amount");
      return;
    }

    const extensionDuration = getExtensionDuration();
    const newEndTime = calculateNewEndTime(booking.endTime, extensionDuration);

    Alert.alert(
      "Confirm Extension",
      `Extend booking by ${extensionDuration} hour(s)?\n\n` +
        `New End Time: ${newEndTime}\n` +
        `Extension Charge: ₹${finalCharge}\n\n` +
        `This will be added to the amount due.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            setSubmitting(true);
            try {
              const extensionData = {
                extensionDuration,
                newEndTime,
                extensionCharge: finalCharge,
                extendedBy: user?.userId || user?.uid,
                extendedByName: user?.name || "Caretaker",
                extendedAt: new Date(),
              };

              const result = await extendBookingTime(booking.id, extensionData);

              if (result.success) {
                Alert.alert("Success", "Booking extended successfully!", [
                  {
                    text: "OK",
                    onPress: () => {
                      onDismiss();
                      if (onExtensionSuccess) {
                        onExtensionSuccess();
                      }
                    },
                  },
                ]);
              } else {
                Alert.alert("Error", result.message || "Failed to extend booking");
              }
            } catch (error) {
              console.error("Error extending booking:", error);
              Alert.alert("Error", "Failed to extend booking. Please try again.");
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  if (!booking) return null;

  const extensionDuration = getExtensionDuration();
  const newEndTime = calculateNewEndTime(booking.endTime, extensionDuration);
  const autoPreviewCharge = calculateExtensionCharge();
  const previewCharge = isAvailable
    ? (chargeCalculationFailed ? null : extensionCharge)
    : autoPreviewCharge;
  const canConfirm = isAvailable && (
    chargeCalculationFailed ? (parseFloat(manualCharge) > 0) : (extensionCharge !== null && extensionCharge > 0)
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onDismiss}
    >
      <View style={styles.modalOverlay}>
        <Surface style={styles.modalContent} elevation={5}>
          <ScrollView>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <MaterialCommunityIcons
                  name="clock-plus-outline"
                  size={28}
                  color={CARETAKER_COLOR}
                />
                <Text variant="headlineSmall" style={styles.title}>
                  Extend Time
                </Text>
              </View>
              <TouchableOpacity onPress={onDismiss}>
                <MaterialCommunityIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <Divider style={styles.divider} />

            {/* Booking Info */}
            <View style={styles.bookingInfo}>
              <Text variant="titleMedium" style={styles.bookingInfoTitle}>
                {booking.userName}
              </Text>
              <Text variant="bodyMedium" style={styles.bookingInfoText}>
                {booking.sport} • {booking.groundName}
              </Text>
              <Text variant="bodyMedium" style={styles.bookingInfoText}>
                Current Time: {booking.startTime} - {booking.endTime}
              </Text>
            </View>

            <Divider style={styles.divider} />

            {/* Extension Options */}
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Select Extension Duration
            </Text>

            <RadioButton.Group
              onValueChange={(value) => setSelectedExtension(value)}
              value={selectedExtension}
            >
              {EXTENSION_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.optionCard,
                    selectedExtension === option.value && styles.optionCardSelected,
                  ]}
                  onPress={() => setSelectedExtension(option.value)}
                >
                  <View style={styles.optionContent}>
                    <MaterialCommunityIcons
                      name={option.icon}
                      size={24}
                      color={
                        selectedExtension === option.value
                          ? CARETAKER_COLOR
                          : "#666"
                      }
                    />
                    <Text
                      variant="bodyLarge"
                      style={[
                        styles.optionLabel,
                        selectedExtension === option.value &&
                          styles.optionLabelSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </View>
                  <RadioButton value={option.value} color={CARETAKER_COLOR} />
                </TouchableOpacity>
              ))}
            </RadioButton.Group>

            {/* Custom Duration Input */}
            {selectedExtension === "custom" && (
              <View style={styles.customInputContainer}>
                <Text variant="bodyMedium" style={styles.inputLabel}>
                  Custom Duration
                </Text>
                <View style={styles.customInputRow}>
                  <View style={styles.customInputWrapper}>
                    <TextInput
                      mode="outlined"
                      value={customHours}
                      onChangeText={setCustomHours}
                      keyboardType="numeric"
                      placeholder="0"
                      label="Hours"
                      style={styles.customInput}
                      outlineColor="#E0E0E0"
                      activeOutlineColor={CARETAKER_COLOR}
                    />
                  </View>
                  <Text variant="bodyLarge" style={styles.customInputSeparator}>
                    :
                  </Text>
                  <View style={styles.customInputWrapper}>
                    <TextInput
                      mode="outlined"
                      value={customMinutes}
                      onChangeText={setCustomMinutes}
                      keyboardType="numeric"
                      placeholder="0"
                      label="Minutes"
                      style={styles.customInput}
                      outlineColor="#E0E0E0"
                      activeOutlineColor={CARETAKER_COLOR}
                    />
                  </View>
                </View>
              </View>
            )}

            {/* Extension Preview */}
            <Surface style={styles.previewCard} elevation={1}>
              <Text variant="titleMedium" style={styles.previewTitle}>
                Extension Preview
              </Text>

              <View style={styles.previewRow}>
                <Text variant="bodyMedium" style={styles.previewLabel}>
                  Current End Time:
                </Text>
                <Text variant="bodyMedium" style={styles.previewValue}>
                  {booking.endTime}
                </Text>
              </View>

              <View style={styles.previewRow}>
                <Text variant="bodyMedium" style={styles.previewLabel}>
                  Extension Duration:
                </Text>
                <Text variant="bodyMedium" style={styles.previewValue}>
                  {extensionDuration} hour(s)
                </Text>
              </View>

              <Divider style={styles.previewDivider} />

              <View style={styles.previewRow}>
                <Text variant="titleMedium" style={styles.previewLabel}>
                  New End Time:
                </Text>
                <Text
                  variant="titleMedium"
                  style={[styles.previewValue, { color: CARETAKER_COLOR }]}
                >
                  {newEndTime || "--:--"}
                </Text>
              </View>

              <View style={styles.previewRow}>
                <Text variant="titleMedium" style={styles.previewLabel}>
                  Extension Charge:
                </Text>
                {chargeCalculationFailed ? (
                  <TextInput
                    mode="outlined"
                    value={manualCharge}
                    onChangeText={(v) => setManualCharge(v.replace(/[^0-9]/g, ""))}
                    keyboardType="numeric"
                    placeholder="Enter amount"
                    dense
                    style={styles.chargeInput}
                    outlineColor="#E0E0E0"
                    activeOutlineColor={CARETAKER_COLOR}
                    left={<TextInput.Affix text="₹" />}
                  />
                ) : (
                  <Text
                    variant="titleMedium"
                    style={[styles.previewValue, { color: CARETAKER_COLOR }]}
                  >
                    {previewCharge !== null ? `₹${previewCharge}` : "—"}
                  </Text>
                )}
              </View>
              {chargeCalculationFailed && (
                <View style={styles.chargeWarning}>
                  <MaterialCommunityIcons name="alert-circle-outline" size={14} color="#F59E0B" />
                  <Text style={styles.chargeWarningText}>
                    Could not calculate rate automatically. Please enter the charge manually.
                  </Text>
                </View>
              )}

              {/* Availability Status */}
              {isAvailable !== null && (
                <View
                  style={[
                    styles.availabilityStatus,
                    {
                      backgroundColor: isAvailable
                        ? "#E8F5E9"
                        : "#FFEBEE",
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={isAvailable ? "check-circle" : "close-circle"}
                    size={20}
                    color={isAvailable ? "#4CAF50" : "#F44336"}
                  />
                  <Text
                    variant="bodyMedium"
                    style={[
                      styles.availabilityText,
                      { color: isAvailable ? "#4CAF50" : "#F44336" },
                    ]}
                  >
                    {isAvailable ? "Slot Available" : "Slot Not Available"}
                  </Text>
                </View>
              )}
            </Surface>

            {/* Action Buttons */}
            <View style={styles.actionsContainer}>
              <Button
                mode="outlined"
                onPress={checkExtensionAvailability}
                loading={isChecking}
                disabled={isChecking || submitting || extensionDuration <= 0}
                style={styles.checkButton}
                icon="magnify"
              >
                Check Availability
              </Button>

              <Button
                mode="contained"
                onPress={handleConfirmExtension}
                loading={submitting}
                disabled={!canConfirm || isChecking || submitting}
                style={styles.confirmButton}
                buttonColor={CARETAKER_COLOR}
                icon="check"
              >
                Confirm Extension
              </Button>

              <Button
                mode="text"
                onPress={onDismiss}
                disabled={submitting}
                style={styles.cancelButton}
              >
                Cancel
              </Button>
            </View>
          </ScrollView>
        </Surface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
    padding: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  title: {
    fontWeight: "bold",
    marginLeft: 12,
    color: "#333",
  },
  divider: {
    marginVertical: 16,
  },
  bookingInfo: {
    marginBottom: 8,
  },
  bookingInfoTitle: {
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  bookingInfoText: {
    color: "#666",
    marginTop: 2,
  },
  sectionTitle: {
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  optionCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderWidth: 2,
    borderColor: "#E0E0E0",
    borderRadius: 12,
    marginBottom: 8,
  },
  optionCardSelected: {
    borderColor: CARETAKER_COLOR,
    backgroundColor: "#FFF3E0",
  },
  optionContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  optionLabel: {
    marginLeft: 12,
    color: "#666",
  },
  optionLabelSelected: {
    color: CARETAKER_COLOR,
    fontWeight: "600",
  },
  customInputContainer: {
    marginTop: 16,
    marginBottom: 16,
  },
  inputLabel: {
    color: "#666",
    marginBottom: 8,
  },
  customInputRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  customInputWrapper: {
    flex: 1,
  },
  customInput: {
    backgroundColor: "#fff",
  },
  customInputSeparator: {
    marginHorizontal: 8,
    fontWeight: "bold",
    color: "#666",
  },
  previewCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#F5F5F5",
    marginTop: 16,
    marginBottom: 16,
  },
  previewTitle: {
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  previewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  previewLabel: {
    color: "#666",
  },
  previewValue: {
    color: "#333",
    fontWeight: "500",
  },
  previewDivider: {
    marginVertical: 12,
  },
  chargeInput: {
    flex: 1,
    maxWidth: 140,
    backgroundColor: "#fff",
    height: 40,
  },
  chargeWarning: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFBEB",
    borderRadius: 6,
    padding: 8,
    marginTop: 4,
  },
  chargeWarningText: {
    fontSize: 12,
    color: "#92400E",
    flex: 1,
  },
  availabilityStatus: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  availabilityText: {
    marginLeft: 8,
    fontWeight: "600",
  },
  actionsContainer: {
    marginTop: 8,
  },
  checkButton: {
    borderRadius: 8,
    marginBottom: 12,
    borderColor: CARETAKER_COLOR,
  },
  confirmButton: {
    borderRadius: 8,
    marginBottom: 12,
  },
  cancelButton: {
    borderRadius: 8,
  },
});
