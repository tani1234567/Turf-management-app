import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import {
  Text,
  Surface,
  TextInput,
  Button,
  Switch,
  Divider,
  IconButton,
  ActivityIndicator,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSelector, useDispatch } from "react-redux";
import * as ImagePicker from "expo-image-picker";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

import { storage } from "../../services/firebase/config";
import { selectUser } from "../../store/slices/authSlice";
import { selectCompany, setCompany } from "../../store/slices/companySlice";
import { updateDocument, getDocument } from "../../services/firebase/firestore";

const OWNER_COLOR = "#9C27B0";

export default function PaymentSettingsScreen({ navigation }) {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const company = useSelector(selectCompany);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingQR, setUploadingQR] = useState(false);

  // UPI Settings
  const [upiEnabled, setUpiEnabled] = useState(false);
  const [upiId, setUpiId] = useState("");
  const [upiHolderName, setUpiHolderName] = useState("");
  const [upiQrCode, setUpiQrCode] = useState(null);
  const [upiQrCodeUrl, setUpiQrCodeUrl] = useState(null);

  // Bank Details (Optional)
  const [accountNumber, setAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [bankName, setBankName] = useState("");

  // Preferred payment method
  const [preferredPaymentMethod, setPreferredPaymentMethod] = useState("upi");

  // Load existing payment config
  useEffect(() => {
    const loadPaymentConfig = async () => {
      try {
        const companyId = company?.id || company?.companyId;
        if (!companyId) {
          setLoading(false);
          return;
        }

        const companyDoc = await getDocument("companies", companyId);
        if (companyDoc?.paymentConfig) {
          const config = companyDoc.paymentConfig;
          setUpiEnabled(config.upiEnabled || false);
          setUpiId(config.upiId || "");
          setUpiHolderName(config.upiHolderName || "");
          setUpiQrCodeUrl(config.upiQrCode || null);
          setPreferredPaymentMethod(config.preferredPaymentMethod || "upi");

          if (config.bankDetails) {
            setAccountNumber(config.bankDetails.accountNumber || "");
            setIfscCode(config.bankDetails.ifscCode || "");
            setAccountHolderName(config.bankDetails.accountHolderName || "");
            setBankName(config.bankDetails.bankName || "");
          }
        }
      } catch (error) {
        console.error("Error loading payment config:", error);
        Alert.alert("Error", "Failed to load payment settings.");
      } finally {
        setLoading(false);
      }
    };

    loadPaymentConfig();
  }, [company]);

  const validateUpiId = (id) => {
    if (!id) return false;
    // UPI ID must contain @
    return id.includes("@") && id.length >= 5;
  };

  const pickQRCode = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert("Permission Required", "Please allow access to your photo library.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setUpiQrCode(result.assets[0].uri);
    }
  };

  const uploadQRCode = async () => {
    if (!upiQrCode) return null;

    // If it's already a Firebase URL, return it
    if (upiQrCode.startsWith("https://") || upiQrCode.startsWith("gs://")) {
      return upiQrCodeUrl;
    }

    const companyId = company?.id || company?.companyId;
    if (!companyId) {
      throw new Error("Company ID not found");
    }

    setUploadingQR(true);

    try {
      // Create a reference to the file location
      const storageRef = ref(storage, `companies/${companyId}/upi_qr.png`);

      // Fetch the image and convert to blob
      const response = await fetch(upiQrCode);
      const blob = await response.blob();

      // Upload the blob
      await uploadBytes(storageRef, blob);

      // Get the download URL
      const downloadUrl = await getDownloadURL(storageRef);
      return downloadUrl;
    } catch (error) {
      console.error("Error uploading QR code:", error);
      throw error;
    } finally {
      setUploadingQR(false);
    }
  };

  const validateForm = () => {
    if (upiEnabled) {
      if (!upiId.trim()) {
        Alert.alert("Required", "Please enter your UPI ID.");
        return false;
      }
      if (!validateUpiId(upiId)) {
        Alert.alert("Invalid UPI ID", "UPI ID must contain @ (e.g., yourname@upi)");
        return false;
      }
      if (!upiHolderName.trim()) {
        Alert.alert("Required", "Please enter the UPI holder name.");
        return false;
      }
      if (upiHolderName.trim().length < 3) {
        Alert.alert("Invalid Name", "UPI holder name must be at least 3 characters.");
        return false;
      }
      if (!upiQrCode && !upiQrCodeUrl) {
        Alert.alert("Required", "Please upload your UPI QR code.");
        return false;
      }
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    const companyId = company?.id || company?.companyId;
    if (!companyId) {
      Alert.alert("Error", "Company information not found.");
      return;
    }

    setSaving(true);

    try {
      // Upload QR code if new one selected
      let qrCodeUrl = upiQrCodeUrl;
      if (upiQrCode && upiQrCode !== upiQrCodeUrl) {
        qrCodeUrl = await uploadQRCode();
      }

      const paymentConfig = {
        upiEnabled,
        upiId: upiEnabled ? upiId.trim() : "",
        upiHolderName: upiEnabled ? upiHolderName.trim() : "",
        upiQrCode: upiEnabled ? qrCodeUrl : null,
        bankDetails: {
          accountNumber: accountNumber.trim(),
          ifscCode: ifscCode.trim().toUpperCase(),
          accountHolderName: accountHolderName.trim(),
          bankName: bankName.trim(),
        },
        preferredPaymentMethod,
        updatedAt: new Date(),
        updatedBy: user?.userId || user?.uid,
      };

      await updateDocument("companies", companyId, { paymentConfig });

      // Update local state
      const updatedCompany = {
        ...company,
        paymentConfig,
      };
      dispatch(setCompany(updatedCompany));

      setUpiQrCodeUrl(qrCodeUrl);
      setUpiQrCode(null);

      Alert.alert("Success", "Payment settings saved successfully!", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error("Error saving payment settings:", error);
      Alert.alert("Error", "Failed to save payment settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={OWNER_COLOR} />
          <Text variant="bodyMedium" style={styles.loadingText}>
            Loading payment settings...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton icon="arrow-left" onPress={() => navigation.goBack()} />
        <Text variant="titleLarge" style={styles.headerTitle}>
          Payment Settings
        </Text>
        <View style={{ width: 48 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.content}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Info Card */}
          <Surface style={styles.infoCard} elevation={1}>
            <MaterialCommunityIcons name="information-outline" size={24} color="#2196F3" />
            <Text variant="bodyMedium" style={styles.infoText}>
              Configure your UPI details to receive advance payments directly from customers.
              This enables zero-fee direct payments.
            </Text>
          </Surface>

          {/* UPI Configuration Section */}
          <Surface style={styles.section} elevation={1}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <MaterialCommunityIcons name="cellphone" size={24} color={OWNER_COLOR} />
                <Text variant="titleMedium" style={styles.sectionTitle}>
                  UPI Configuration
                </Text>
              </View>
              <Switch
                value={upiEnabled}
                onValueChange={setUpiEnabled}
                color={OWNER_COLOR}
              />
            </View>
            <Text variant="bodySmall" style={styles.sectionSubtitle}>
              Enable UPI payments from customers
            </Text>

            {upiEnabled && (
              <>
                <Divider style={styles.divider} />

                {/* UPI ID */}
                <View style={styles.inputContainer}>
                  <Text variant="bodyMedium" style={styles.inputLabel}>
                    UPI ID *
                  </Text>
                  <TextInput
                    mode="outlined"
                    value={upiId}
                    onChangeText={setUpiId}
                    placeholder="yourname@upi"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={styles.input}
                    outlineColor="#E0E0E0"
                    activeOutlineColor={OWNER_COLOR}
                    left={<TextInput.Icon icon="at" />}
                    error={upiId.length > 0 && !validateUpiId(upiId)}
                  />
                  {upiId.length > 0 && !validateUpiId(upiId) && (
                    <Text variant="bodySmall" style={styles.errorText}>
                      UPI ID must contain @ symbol
                    </Text>
                  )}
                </View>

                {/* UPI Holder Name */}
                <View style={styles.inputContainer}>
                  <Text variant="bodyMedium" style={styles.inputLabel}>
                    Display Name *
                  </Text>
                  <TextInput
                    mode="outlined"
                    value={upiHolderName}
                    onChangeText={setUpiHolderName}
                    placeholder="e.g., Green Sports Arena"
                    style={styles.input}
                    outlineColor="#E0E0E0"
                    activeOutlineColor={OWNER_COLOR}
                    left={<TextInput.Icon icon="account" />}
                  />
                  <Text variant="bodySmall" style={styles.hintText}>
                    This name will be shown to customers
                  </Text>
                </View>

                {/* QR Code Upload */}
                <View style={styles.inputContainer}>
                  <Text variant="bodyMedium" style={styles.inputLabel}>
                    UPI QR Code *
                  </Text>
                  <Text variant="bodySmall" style={styles.hintText}>
                    Upload your UPI QR code for customers to scan
                  </Text>

                  <TouchableOpacity
                    style={styles.qrUploadContainer}
                    onPress={pickQRCode}
                    disabled={uploadingQR}
                  >
                    {uploadingQR ? (
                      <View style={styles.qrPlaceholder}>
                        <ActivityIndicator size="large" color={OWNER_COLOR} />
                        <Text variant="bodySmall" style={styles.qrPlaceholderText}>
                          Uploading...
                        </Text>
                      </View>
                    ) : upiQrCode || upiQrCodeUrl ? (
                      <View style={styles.qrPreviewContainer}>
                        <Image
                          source={{ uri: upiQrCode || upiQrCodeUrl }}
                          style={styles.qrPreview}
                          resizeMode="contain"
                        />
                        <View style={styles.qrOverlay}>
                          <MaterialCommunityIcons
                            name="camera-flip"
                            size={24}
                            color="#fff"
                          />
                          <Text variant="bodySmall" style={styles.qrOverlayText}>
                            Tap to change
                          </Text>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.qrPlaceholder}>
                        <MaterialCommunityIcons
                          name="qrcode-scan"
                          size={48}
                          color="#999"
                        />
                        <Text variant="bodyMedium" style={styles.qrPlaceholderText}>
                          Tap to upload QR Code
                        </Text>
                        <Text variant="bodySmall" style={styles.qrPlaceholderHint}>
                          PNG or JPG, square format recommended
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </Surface>

          {/* Bank Details Section (Optional) */}
          <Surface style={styles.section} elevation={1}>
            <View style={styles.sectionTitleRow}>
              <MaterialCommunityIcons name="bank" size={24} color={OWNER_COLOR} />
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Bank Details
              </Text>
            </View>
            <Text variant="bodySmall" style={styles.sectionSubtitle}>
              Optional: For reference and manual transfers
            </Text>

            <Divider style={styles.divider} />

            {/* Account Number */}
            <View style={styles.inputContainer}>
              <Text variant="bodyMedium" style={styles.inputLabel}>
                Account Number
              </Text>
              <TextInput
                mode="outlined"
                value={accountNumber}
                onChangeText={setAccountNumber}
                placeholder="Enter account number"
                keyboardType="numeric"
                style={styles.input}
                outlineColor="#E0E0E0"
                activeOutlineColor={OWNER_COLOR}
              />
            </View>

            {/* IFSC Code */}
            <View style={styles.inputContainer}>
              <Text variant="bodyMedium" style={styles.inputLabel}>
                IFSC Code
              </Text>
              <TextInput
                mode="outlined"
                value={ifscCode}
                onChangeText={(text) => setIfscCode(text.toUpperCase())}
                placeholder="e.g., HDFC0001234"
                autoCapitalize="characters"
                maxLength={11}
                style={styles.input}
                outlineColor="#E0E0E0"
                activeOutlineColor={OWNER_COLOR}
              />
            </View>

            {/* Account Holder Name */}
            <View style={styles.inputContainer}>
              <Text variant="bodyMedium" style={styles.inputLabel}>
                Account Holder Name
              </Text>
              <TextInput
                mode="outlined"
                value={accountHolderName}
                onChangeText={setAccountHolderName}
                placeholder="e.g., Green Sports Arena Pvt Ltd"
                style={styles.input}
                outlineColor="#E0E0E0"
                activeOutlineColor={OWNER_COLOR}
              />
            </View>

            {/* Bank Name */}
            <View style={styles.inputContainer}>
              <Text variant="bodyMedium" style={styles.inputLabel}>
                Bank Name
              </Text>
              <TextInput
                mode="outlined"
                value={bankName}
                onChangeText={setBankName}
                placeholder="e.g., HDFC Bank"
                style={styles.input}
                outlineColor="#E0E0E0"
                activeOutlineColor={OWNER_COLOR}
              />
            </View>
          </Surface>

          {/* Save Button */}
          <Button
            mode="contained"
            onPress={handleSave}
            loading={saving}
            disabled={saving || uploadingQR}
            style={styles.saveButton}
            buttonColor={OWNER_COLOR}
            icon="content-save"
          >
            Save Payment Settings
          </Button>

          <View style={styles.footer}>
            <Text variant="bodySmall" style={styles.footerText}>
              Payment details are stored securely and shown to customers during booking.
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#666",
    marginTop: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingRight: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  headerTitle: {
    fontWeight: "bold",
    color: "#333",
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  infoCard: {
    flexDirection: "row",
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#E3F2FD",
    marginBottom: 16,
    alignItems: "flex-start",
  },
  infoText: {
    flex: 1,
    marginLeft: 12,
    color: "#1565C0",
    lineHeight: 20,
  },
  section: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#fff",
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  sectionTitle: {
    fontWeight: "600",
    color: "#333",
    marginLeft: 10,
  },
  sectionSubtitle: {
    color: "#666",
    marginTop: 4,
  },
  divider: {
    marginVertical: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontWeight: "500",
    color: "#333",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#fff",
  },
  hintText: {
    color: "#666",
    marginTop: 4,
  },
  errorText: {
    color: "#F44336",
    marginTop: 4,
  },
  qrUploadContainer: {
    marginTop: 8,
    borderWidth: 2,
    borderColor: "#E0E0E0",
    borderStyle: "dashed",
    borderRadius: 12,
    overflow: "hidden",
  },
  qrPlaceholder: {
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FAFAFA",
  },
  qrPlaceholderText: {
    color: "#666",
    marginTop: 12,
  },
  qrPlaceholderHint: {
    color: "#999",
    marginTop: 4,
  },
  qrPreviewContainer: {
    position: "relative",
    width: "100%",
    aspectRatio: 1,
    maxHeight: 250,
  },
  qrPreview: {
    width: "100%",
    height: "100%",
  },
  qrOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  qrOverlayText: {
    color: "#fff",
    marginLeft: 8,
  },
  saveButton: {
    marginTop: 8,
    borderRadius: 8,
    paddingVertical: 4,
  },
  footer: {
    marginTop: 16,
    alignItems: "center",
  },
  footerText: {
    color: "#999",
    textAlign: "center",
    lineHeight: 18,
  },
});
