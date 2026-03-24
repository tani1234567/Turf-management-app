import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import {
  Text,
  Surface,
  Button,
  TextInput,
  ActivityIndicator,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import {
  uploadPaymentProof,
  submitPaymentForVerification,
} from "../../services/firebase/payments";
import { updatePaymentRequestCardStatus } from "../../services/firebase/chat";

const USER_COLOR = "#10B981";

const HELP_APPS = [
  { name: "GPay", icon: "google", color: "#4285F4" },
  { name: "PhonePe", icon: "alpha-p-circle", color: "#5F259F" },
  { name: "Paytm", icon: "wallet", color: "#00BAF2" },
];

export default function PaymentConfirmationScreen({ navigation, route }) {
  const {
    bookingId,
    amount,
    upiId,
    upiHolderName,
    turfName,
    chatId,
    paymentCardMessageId,
  } = route.params || {};

  const [transactionId, setTransactionId] = useState("");
  const [screenshot, setScreenshot] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const validateTransactionId = (value) => {
    if (!value || value.trim().length === 0) {
      return "Transaction ID is required";
    }
    if (value.length < 10) {
      return "Transaction ID must be at least 10 characters";
    }
    if (value.length > 35) {
      return "Transaction ID is too long";
    }
    return null;
  };

  const handleTransactionIdChange = (value) => {
    // Auto-capitalize and remove spaces
    const formatted = value.toUpperCase().replace(/\s/g, "");
    setTransactionId(formatted);
    setErrors((prev) => ({ ...prev, transactionId: null }));
  };

  const pickImage = async (useCamera) => {
    try {
      const permissionMethod = useCamera
        ? ImagePicker.requestCameraPermissionsAsync
        : ImagePicker.requestMediaLibraryPermissionsAsync;

      const { status } = await permissionMethod();
      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          `Please grant ${useCamera ? "camera" : "gallery"} access to upload payment proof.`
        );
        return;
      }

      const pickerMethod = useCamera
        ? ImagePicker.launchCameraAsync
        : ImagePicker.launchImageLibraryAsync;

      const result = await pickerMethod({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]) {
        setScreenshot(result.assets[0]);
        setErrors((prev) => ({ ...prev, screenshot: null }));
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "Failed to select image. Please try again.");
    }
  };

  const handleSubmit = async () => {
    // Validate
    const txnError = validateTransactionId(transactionId);
    if (txnError || !screenshot) {
      setErrors({
        transactionId: txnError,
        screenshot: !screenshot ? "Payment screenshot is required" : null,
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Upload screenshot
      const screenshotUrl = await uploadPaymentProof(bookingId, screenshot.uri);

      // Submit payment for verification
      await submitPaymentForVerification(bookingId, {
        transactionId: transactionId.trim(),
        paidToUpiId: upiId,
        amount,
        paidAt: new Date().toISOString(),
        screenshotUrl,
      });

      // If this payment came from a chat payment request card, update its status
      if (chatId && paymentCardMessageId) {
        try {
          await updatePaymentRequestCardStatus(chatId, paymentCardMessageId, "paid");
        } catch (cardError) {
          console.warn("Could not update payment request card status:", cardError);
        }
      }

      // Navigate to success screen
      navigation.replace("PaymentSubmitted", {
        bookingId,
        amount,
        turfName,
        transactionId: transactionId.trim(),
      });
    } catch (error) {
      console.error("Error submitting payment:", error);
      const isDuplicateTxn = error.message?.includes("already been used");
      Alert.alert(
        isDuplicateTxn ? "Duplicate Transaction ID" : "Submission Failed",
        isDuplicateTxn
          ? error.message
          : "Failed to submit payment proof. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const AppHelpButton = ({ app }) => (
    <TouchableOpacity style={styles.helpAppButton} activeOpacity={0.7}>
      <View style={[styles.helpAppIcon, { backgroundColor: `${app.color}15` }]}>
        <MaterialCommunityIcons name={app.icon} size={20} color={app.color} />
      </View>
      <Text variant="labelSmall" style={styles.helpAppName}>
        {app.name}
      </Text>
    </TouchableOpacity>
  );

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
          Confirm Payment
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Success Message */}
          <Surface style={styles.successBanner} elevation={1}>
            <MaterialCommunityIcons
              name="check-circle"
              size={24}
              color={USER_COLOR}
            />
            <Text variant="bodyMedium" style={styles.successText}>
              Great! Now verify your payment
            </Text>
          </Surface>

          {/* Transaction ID Input */}
          <View style={styles.section}>
            <Text variant="titleSmall" style={styles.sectionTitle}>
              UPI Transaction ID *
            </Text>
            <TextInput
              mode="outlined"
              placeholder="Enter 12-digit transaction ID"
              value={transactionId}
              onChangeText={handleTransactionIdChange}
              style={styles.input}
              outlineColor={errors.transactionId ? "#F44336" : "#ddd"}
              activeOutlineColor={errors.transactionId ? "#F44336" : USER_COLOR}
              autoCapitalize="characters"
              maxLength={35}
            />
            {errors.transactionId && (
              <Text variant="bodySmall" style={styles.errorText}>
                {errors.transactionId}
              </Text>
            )}
            <View style={styles.hintRow}>
              <MaterialCommunityIcons name="lightbulb" size={16} color="#FF9800" />
              <Text variant="bodySmall" style={styles.hintText}>
                Find in UPI app → Transaction History
              </Text>
            </View>

            {/* App Help Buttons */}
            <Text variant="bodySmall" style={styles.helpTitle}>
              Where to find Transaction ID?
            </Text>
            <View style={styles.helpAppsRow}>
              {HELP_APPS.map((app) => (
                <AppHelpButton key={app.name} app={app} />
              ))}
            </View>
          </View>

          {/* Screenshot Upload */}
          <View style={styles.section}>
            <Text variant="titleSmall" style={styles.sectionTitle}>
              Payment Screenshot *
            </Text>

            <View style={styles.uploadButtonsRow}>
              <TouchableOpacity
                style={[
                  styles.uploadButton,
                  errors.screenshot && styles.uploadButtonError,
                ]}
                onPress={() => pickImage(true)}
              >
                <MaterialCommunityIcons name="camera" size={24} color="#666" />
                <Text variant="bodyMedium" style={styles.uploadButtonText}>
                  Take Photo
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.uploadButton,
                  errors.screenshot && styles.uploadButtonError,
                ]}
                onPress={() => pickImage(false)}
              >
                <MaterialCommunityIcons name="image" size={24} color="#666" />
                <Text variant="bodyMedium" style={styles.uploadButtonText}>
                  Gallery
                </Text>
              </TouchableOpacity>
            </View>

            {errors.screenshot && (
              <Text variant="bodySmall" style={styles.errorText}>
                {errors.screenshot}
              </Text>
            )}

            <View style={styles.hintRow}>
              <MaterialCommunityIcons name="camera" size={16} color="#666" />
              <Text variant="bodySmall" style={styles.hintText}>
                Must show: Amount, UPI ID, Transaction ID
              </Text>
            </View>

            {/* Screenshot Preview */}
            {screenshot && (
              <View style={styles.previewContainer}>
                <Image
                  source={{ uri: screenshot.uri }}
                  style={styles.previewImage}
                  resizeMode="contain"
                />
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => setScreenshot(null)}
                >
                  <MaterialCommunityIcons name="close" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Payment Summary */}
          <Surface style={styles.summaryCard} elevation={1}>
            <Text variant="titleSmall" style={styles.summaryTitle}>
              Payment Summary
            </Text>
            <View style={styles.summaryRow}>
              <Text variant="bodyMedium" style={styles.summaryLabel}>
                Amount Paid
              </Text>
              <Text variant="bodyLarge" style={styles.summaryValue}>
                ₹{amount?.toLocaleString()}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text variant="bodyMedium" style={styles.summaryLabel}>
                Paid To
              </Text>
              <Text variant="bodyMedium" style={styles.summaryValue}>
                {upiHolderName || turfName}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text variant="bodyMedium" style={styles.summaryLabel}>
                UPI ID
              </Text>
              <Text variant="bodyMedium" style={styles.summaryValue}>
                {upiId}
              </Text>
            </View>
          </Surface>

          {/* Submit Button */}
          <Button
            mode="contained"
            onPress={handleSubmit}
            style={styles.submitButton}
            contentStyle={styles.submitButtonContent}
            buttonColor={USER_COLOR}
            loading={isSubmitting}
            disabled={isSubmitting}
            icon="check-circle"
          >
            Submit for Verification
          </Button>

          {/* Warning */}
          <View style={styles.warningRow}>
            <MaterialCommunityIcons name="alert" size={16} color="#FF9800" />
            <Text variant="bodySmall" style={styles.warningText}>
              Submitting false details may result in account suspension
            </Text>
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
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#D1FAE5",
    marginBottom: 24,
    gap: 12,
  },
  successText: {
    color: USER_COLOR,
    fontWeight: "500",
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  input: {
    backgroundColor: "#fff",
  },
  errorText: {
    color: "#F44336",
    marginTop: 4,
  },
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 6,
  },
  hintText: {
    color: "#666",
  },
  helpTitle: {
    color: "#666",
    marginTop: 16,
    marginBottom: 8,
  },
  helpAppsRow: {
    flexDirection: "row",
    gap: 16,
  },
  helpAppButton: {
    alignItems: "center",
  },
  helpAppIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  helpAppName: {
    color: "#666",
  },
  uploadButtonsRow: {
    flexDirection: "row",
    gap: 12,
  },
  uploadButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    borderStyle: "dashed",
    gap: 8,
  },
  uploadButtonError: {
    borderColor: "#F44336",
  },
  uploadButtonText: {
    color: "#666",
  },
  previewContainer: {
    marginTop: 16,
    position: "relative",
  },
  previewImage: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    backgroundColor: "#f0f0f0",
  },
  removeButton: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  summaryCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#fff",
    marginBottom: 24,
  },
  summaryTitle: {
    fontWeight: "600",
    color: "#333",
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  summaryLabel: {
    color: "#666",
  },
  summaryValue: {
    color: "#333",
    fontWeight: "500",
  },
  submitButton: {
    borderRadius: 12,
    marginBottom: 16,
  },
  submitButtonContent: {
    paddingVertical: 8,
  },
  warningRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  warningText: {
    color: "#666",
    textAlign: "center",
  },
});
