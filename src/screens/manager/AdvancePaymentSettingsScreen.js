import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import {
  Text,
  Surface,
  Switch,
  Button,
  Chip,
  RadioButton,
  Divider,
  IconButton,
  ActivityIndicator,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSelector } from "react-redux";
import {
  selectUser,
  selectAssignedTurfIds,
  selectUserRole,
  selectHasOperationalPermissions,
} from "../../store/slices/authSlice";
import {
  getDocument,
  updateDocument,
  addDocument,
} from "../../services/firebase/firestore";

const MANAGER_BLUE = "#2196F3";

const PERCENTAGE_OPTIONS = [
  { value: 10, label: "10%" },
  { value: 25, label: "25%" },
  { value: 50, label: "50%" },
  { value: 100, label: "100%" },
];

const TIMEOUT_OPTIONS = [
  { value: 30, label: "30 min" },
  { value: 60, label: "60 min" },
  { value: 90, label: "90 min" },
  { value: 120, label: "120 min" },
];

const DEFAULT_ADVANCE_PAYMENT = {
  isRequired: false,
  percentage: 50,
  paymentTiming: "before_approval",
  paymentTimeout: 120,
  allowedMethods: ["upi", "cash_at_venue"],
  lastUpdatedBy: null,
  lastUpdatedAt: null,
};

export default function AdvancePaymentSettingsScreen({ navigation, route }) {
  const user = useSelector(selectUser);
  const userRole = useSelector(selectUserRole);
  const assignedTurfIds = useSelector(selectAssignedTurfIds);
  const hasOperationalPermissions = useSelector(selectHasOperationalPermissions);

  // Get turf ID from route params or fallback
  const turfId = route?.params?.turfId;

  // State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [turf, setTurf] = useState(null);

  // Settings state
  const [isRequired, setIsRequired] = useState(false);
  const [percentage, setPercentage] = useState(50);
  const [paymentTiming, setPaymentTiming] = useState("before_approval");
  const [paymentTimeout, setPaymentTimeout] = useState(120);

  // Access control check
  const canEdit = () => {
    // Owner with operational permissions can edit any turf
    if (userRole === "owner" && hasOperationalPermissions) {
      return true;
    }
    // Manager can only edit assigned turfs
    if (userRole === "manager" && assignedTurfIds?.includes(turfId)) {
      return true;
    }
    return false;
  };

  // Load turf data
  useEffect(() => {
    const loadTurfData = async () => {
      if (!turfId) {
        Alert.alert("Error", "No turf selected.", [
          { text: "OK", onPress: () => navigation.goBack() },
        ]);
        return;
      }

      try {
        const turfDoc = await getDocument("turfs", turfId);
        if (!turfDoc) {
          Alert.alert("Error", "Turf not found.", [
            { text: "OK", onPress: () => navigation.goBack() },
          ]);
          return;
        }

        setTurf(turfDoc);

        // Load existing settings or use defaults
        const settings = turfDoc.advancePayment || DEFAULT_ADVANCE_PAYMENT;
        setIsRequired(settings.isRequired || false);
        setPercentage(settings.percentage || 50);
        setPaymentTiming(settings.paymentTiming || "before_approval");
        setPaymentTimeout(settings.paymentTimeout || 120);
      } catch (error) {
        console.error("Error loading turf:", error);
        Alert.alert("Error", "Failed to load turf settings.");
      } finally {
        setLoading(false);
      }
    };

    loadTurfData();
  }, [turfId]);

  const handleSave = async () => {
    if (!canEdit()) {
      Alert.alert("Permission Denied", "You don't have permission to edit this turf's settings.");
      return;
    }

    setSaving(true);

    try {
      const advancePaymentSettings = {
        isRequired,
        percentage: isRequired ? percentage : 0,
        paymentTiming: isRequired ? paymentTiming : "before_approval",
        paymentTimeout: isRequired && paymentTiming === "after_approval" ? paymentTimeout : 120,
        allowedMethods: ["upi", "cash_at_venue"],
        lastUpdatedBy: user?.userId || user?.uid,
        lastUpdatedAt: new Date(),
      };

      // Update turf document
      await updateDocument("turfs", turfId, {
        advancePayment: advancePaymentSettings,
      });

      // Log the change
      await addDocument("turf_edit_logs", {
        turfId,
        turfName: turf?.name,
        companyId: turf?.companyId || null,
        editType: "advance_payment_settings",
        editedBy: user?.userId || user?.uid,
        editedByName: user?.name || "Unknown",
        editedByRole: userRole,
        changes: {
          type: "advance_settings",
          field: "advancePayment",
          summary: "Advance payment settings updated",
          oldValue: turf?.advancePayment || DEFAULT_ADVANCE_PAYMENT,
          newValue: advancePaymentSettings,
        },
        editedAt: new Date(),
      });

      Alert.alert("Success", "Advance payment settings saved successfully!", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error("Error saving settings:", error);
      Alert.alert("Error", "Failed to save settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={MANAGER_BLUE} />
          <Text variant="bodyMedium" style={styles.loadingText}>
            Loading settings...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!canEdit()) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <IconButton icon="arrow-left" onPress={() => navigation.goBack()} />
          <Text variant="titleLarge" style={styles.headerTitle}>
            Advance Payment Settings
          </Text>
          <View style={{ width: 48 }} />
        </View>
        <View style={styles.permissionDeniedContainer}>
          <MaterialCommunityIcons name="lock" size={64} color="#ccc" />
          <Text variant="titleMedium" style={styles.permissionDeniedTitle}>
            Access Denied
          </Text>
          <Text variant="bodyMedium" style={styles.permissionDeniedText}>
            You don't have permission to edit this turf's settings.
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
        <View style={styles.headerContent}>
          <Text variant="titleLarge" style={styles.headerTitle}>
            Advance Payment Settings
          </Text>
          <Text variant="bodySmall" style={styles.headerSubtitle} numberOfLines={1}>
            {turf?.name || "Turf"}
          </Text>
        </View>
        <View style={{ width: 48 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.content}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Main Toggle Section */}
          <Surface style={styles.section} elevation={1}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleContent}>
                <Text variant="titleMedium" style={styles.toggleTitle}>
                  Require Advance Payment
                </Text>
                <Text variant="bodySmall" style={styles.toggleDescription}>
                  {isRequired
                    ? "Customers must pay advance to confirm booking"
                    : "Advance payment is optional"}
                </Text>
              </View>
              <Switch
                value={isRequired}
                onValueChange={setIsRequired}
                color={MANAGER_BLUE}
              />
            </View>

            {/* Info Box */}
            <View style={styles.infoBox}>
              <MaterialCommunityIcons
                name="information-outline"
                size={20}
                color="#1976D2"
              />
              <Text variant="bodySmall" style={styles.infoText}>
                When enabled, customers must pay the specified advance amount to confirm
                their booking. The payment goes directly to your UPI account.
              </Text>
            </View>
          </Surface>

          {/* Conditional Settings - Only show if isRequired */}
          {isRequired && (
            <>
              {/* Advance Percentage */}
              <Surface style={styles.section} elevation={1}>
                <Text variant="titleMedium" style={styles.sectionTitle}>
                  Advance Percentage
                </Text>
                <Text variant="bodySmall" style={styles.sectionSubtitle}>
                  How much of the total amount should be paid in advance?
                </Text>

                <View style={styles.chipContainer}>
                  {PERCENTAGE_OPTIONS.map((option) => (
                    <Chip
                      key={option.value}
                      mode={percentage === option.value ? "flat" : "outlined"}
                      selected={percentage === option.value}
                      onPress={() => setPercentage(option.value)}
                      style={[
                        styles.percentageChip,
                        percentage === option.value && styles.percentageChipSelected,
                      ]}
                      textStyle={[
                        styles.percentageChipText,
                        percentage === option.value && styles.percentageChipTextSelected,
                      ]}
                      showSelectedCheck={false}
                    >
                      {option.label}
                    </Chip>
                  ))}
                </View>

                {/* Example Calculation */}
                <View style={styles.exampleBox}>
                  <Text variant="bodySmall" style={styles.exampleText}>
                    Example: For a ₹1000 booking, customer pays{" "}
                    <Text style={styles.exampleHighlight}>₹{(1000 * percentage) / 100}</Text> advance
                  </Text>
                </View>
              </Surface>

              {/* Payment Timing */}
              <Surface style={styles.section} elevation={1}>
                <Text variant="titleMedium" style={styles.sectionTitle}>
                  When should customer pay?
                </Text>

                <RadioButton.Group
                  onValueChange={setPaymentTiming}
                  value={paymentTiming}
                >
                  {/* Before Approval */}
                  <View style={styles.radioOption}>
                    <RadioButton.Item
                      label="Before you approve"
                      value="before_approval"
                      position="leading"
                      labelStyle={styles.radioLabel}
                      style={styles.radioItem}
                      color={MANAGER_BLUE}
                    />
                    <Text variant="bodySmall" style={styles.radioDescription}>
                      Customer pays first, then you approve/reject. Payment is refunded
                      automatically if you reject.
                    </Text>
                  </View>

                  <Divider style={styles.radioDivider} />

                  {/* After Approval */}
                  <View style={styles.radioOption}>
                    <RadioButton.Item
                      label="After you approve"
                      value="after_approval"
                      position="leading"
                      labelStyle={styles.radioLabel}
                      style={styles.radioItem}
                      color={MANAGER_BLUE}
                    />
                    <Text variant="bodySmall" style={styles.radioDescription}>
                      You approve first, then customer has limited time to pay. Booking
                      expires if not paid in time.
                    </Text>
                  </View>
                </RadioButton.Group>
              </Surface>

              {/* Payment Timeout - Only show if after_approval */}
              {paymentTiming === "after_approval" && (
                <Surface style={styles.section} elevation={1}>
                  <Text variant="titleMedium" style={styles.sectionTitle}>
                    Payment Timeout
                  </Text>
                  <Text variant="bodySmall" style={styles.sectionSubtitle}>
                    How long does customer have to pay after approval?
                  </Text>

                  <View style={styles.chipContainer}>
                    {TIMEOUT_OPTIONS.map((option) => (
                      <Chip
                        key={option.value}
                        mode={paymentTimeout === option.value ? "flat" : "outlined"}
                        selected={paymentTimeout === option.value}
                        onPress={() => setPaymentTimeout(option.value)}
                        style={[
                          styles.timeoutChip,
                          paymentTimeout === option.value && styles.timeoutChipSelected,
                        ]}
                        textStyle={[
                          styles.timeoutChipText,
                          paymentTimeout === option.value && styles.timeoutChipTextSelected,
                        ]}
                        showSelectedCheck={false}
                      >
                        {option.label}
                      </Chip>
                    ))}
                  </View>

                  {/* Warning Info */}
                  <View style={styles.warningBox}>
                    <MaterialCommunityIcons
                      name="alert-outline"
                      size={20}
                      color="#E65100"
                    />
                    <Text variant="bodySmall" style={styles.warningText}>
                      Booking will be automatically cancelled if customer doesn't pay
                      within {paymentTimeout} minutes after your approval.
                    </Text>
                  </View>
                </Surface>
              )}
            </>
          )}

          {/* Summary Card */}
          <Surface style={styles.summaryCard} elevation={1}>
            <Text variant="titleSmall" style={styles.summaryTitle}>
              Current Settings Summary
            </Text>
            <Divider style={styles.summaryDivider} />

            <View style={styles.summaryRow}>
              <Text variant="bodyMedium" style={styles.summaryLabel}>
                Advance Payment
              </Text>
              <Text
                variant="bodyMedium"
                style={[
                  styles.summaryValue,
                  { color: isRequired ? "#4CAF50" : "#999" },
                ]}
              >
                {isRequired ? "Required" : "Not Required"}
              </Text>
            </View>

            {isRequired && (
              <>
                <View style={styles.summaryRow}>
                  <Text variant="bodyMedium" style={styles.summaryLabel}>
                    Advance Amount
                  </Text>
                  <Text variant="bodyMedium" style={styles.summaryValue}>
                    {percentage}% of total
                  </Text>
                </View>

                <View style={styles.summaryRow}>
                  <Text variant="bodyMedium" style={styles.summaryLabel}>
                    Payment Timing
                  </Text>
                  <Text variant="bodyMedium" style={styles.summaryValue}>
                    {paymentTiming === "before_approval"
                      ? "Before approval"
                      : "After approval"}
                  </Text>
                </View>

                {paymentTiming === "after_approval" && (
                  <View style={styles.summaryRow}>
                    <Text variant="bodyMedium" style={styles.summaryLabel}>
                      Payment Timeout
                    </Text>
                    <Text variant="bodyMedium" style={styles.summaryValue}>
                      {paymentTimeout} minutes
                    </Text>
                  </View>
                )}
              </>
            )}
          </Surface>

          {/* Save Button */}
          <Button
            mode="contained"
            onPress={handleSave}
            loading={saving}
            disabled={saving}
            style={styles.saveButton}
            buttonColor={MANAGER_BLUE}
            icon="content-save"
          >
            Save Settings
          </Button>

          <View style={{ height: 32 }} />
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
  permissionDeniedContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  permissionDeniedTitle: {
    fontWeight: "600",
    color: "#333",
    marginTop: 16,
  },
  permissionDeniedText: {
    color: "#666",
    textAlign: "center",
    marginTop: 8,
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
  headerContent: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontWeight: "bold",
    color: "#333",
  },
  headerSubtitle: {
    color: "#666",
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#fff",
    marginBottom: 16,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  toggleContent: {
    flex: 1,
    marginRight: 16,
  },
  toggleTitle: {
    fontWeight: "600",
    color: "#333",
  },
  toggleDescription: {
    color: "#666",
    marginTop: 4,
  },
  infoBox: {
    flexDirection: "row",
    backgroundColor: "#E3F2FD",
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    alignItems: "flex-start",
  },
  infoText: {
    flex: 1,
    marginLeft: 10,
    color: "#1565C0",
    lineHeight: 18,
  },
  sectionTitle: {
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  sectionSubtitle: {
    color: "#666",
    marginBottom: 16,
  },
  chipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  percentageChip: {
    borderColor: "#E0E0E0",
    backgroundColor: "#fff",
  },
  percentageChipSelected: {
    backgroundColor: MANAGER_BLUE,
    borderColor: MANAGER_BLUE,
  },
  percentageChipText: {
    color: "#666",
  },
  percentageChipTextSelected: {
    color: "#fff",
  },
  exampleBox: {
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  exampleText: {
    color: "#666",
  },
  exampleHighlight: {
    color: MANAGER_BLUE,
    fontWeight: "600",
  },
  radioOption: {
    marginBottom: 8,
  },
  radioItem: {
    paddingLeft: 0,
  },
  radioLabel: {
    fontWeight: "500",
    color: "#333",
  },
  radioDescription: {
    color: "#666",
    marginLeft: 48,
    marginTop: -4,
    lineHeight: 18,
  },
  radioDivider: {
    marginVertical: 12,
  },
  timeoutChip: {
    borderColor: "#E0E0E0",
    backgroundColor: "#fff",
  },
  timeoutChipSelected: {
    backgroundColor: MANAGER_BLUE,
    borderColor: MANAGER_BLUE,
  },
  timeoutChipText: {
    color: "#666",
  },
  timeoutChipTextSelected: {
    color: "#fff",
  },
  warningBox: {
    flexDirection: "row",
    backgroundColor: "#FFF3E0",
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    alignItems: "flex-start",
  },
  warningText: {
    flex: 1,
    marginLeft: 10,
    color: "#E65100",
    lineHeight: 18,
  },
  summaryCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#E3F2FD",
    marginBottom: 16,
  },
  summaryTitle: {
    fontWeight: "600",
    color: "#1565C0",
  },
  summaryDivider: {
    marginVertical: 12,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  summaryLabel: {
    color: "#666",
  },
  summaryValue: {
    fontWeight: "500",
    color: "#333",
  },
  saveButton: {
    borderRadius: 8,
    paddingVertical: 4,
  },
});
