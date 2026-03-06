import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Linking,
  Platform,
} from "react-native";
import {
  Card,
  Button,
  TextInput,
  RadioButton,
  Surface,
  Checkbox,
  Chip,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useSelector, useDispatch } from "react-redux";
import { selectCompany } from "../../store/slices/companySlice";
import { selectTurfs, setTurfs } from "../../store/slices/ownerSlice";
import { queryDocuments } from "../../services/firebase/firestore";
import {
  PRICING_TIERS,
  DURATION_DISCOUNTS,
  calculateSubscriptionPrice,
  calculateTotalGrounds,
  formatPrice,
} from "../../utils/subscriptionPricing";
import {
  initiateSubscriptionPayment,
  uploadSubscriptionPaymentProof,
  getPendingSubscriptionPayment,
} from "../../services/firebase/subscriptionPayments";

const OWNER_COLOR = "#9C27B0";

export default function SubscriptionPaymentScreen({ navigation }) {
  const dispatch = useDispatch();
  const company = useSelector(selectCompany);
  const turfs = useSelector(selectTurfs);

  // Step: turfs → duration → initiated → proof
  const [paymentStep, setPaymentStep] = useState("turfs");
  const [loadingTurfs, setLoadingTurfs] = useState(false);

  // Turf selection
  const [selectedTurfIds, setSelectedTurfIds] = useState([]);

  // Duration selection
  const [selectedDuration, setSelectedDuration] = useState(1);

  // Payment state
  const [transactionRef, setTransactionRef] = useState("");
  const [upiLink, setUpiLink] = useState("");
  const [loading, setLoading] = useState(false);

  // Proof upload
  const [proofImage, setProofImage] = useState(null);
  const [transactionId, setTransactionId] = useState("");
  const [paidFrom, setPaidFrom] = useState("");
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);

  // Pending payment check
  const [pendingPayment, setPendingPayment] = useState(null);

  useEffect(() => {
    loadPendingPayment();
    // Ensure turfs are loaded (in case user navigated here without visiting Turfs tab)
    if (turfs.length === 0) {
      fetchTurfs();
    }
  }, []);

  const fetchTurfs = async () => {
    const companyId = company?.id || company?.companyId;
    if (!companyId) return;
    setLoadingTurfs(true);
    try {
      const fetchedTurfs = await queryDocuments("turfs", [
        { field: "companyId", operator: "==", value: companyId },
      ]);
      dispatch(setTurfs(fetchedTurfs));
    } catch (error) {
      console.error("Error fetching turfs:", error);
    } finally {
      setLoadingTurfs(false);
    }
  };

  // Calculate pricing whenever selection changes
  const totalGrounds = useMemo(
    () => calculateTotalGrounds(turfs, selectedTurfIds),
    [turfs, selectedTurfIds]
  );

  const pricing = useMemo(
    () => calculateSubscriptionPrice(totalGrounds, selectedDuration),
    [totalGrounds, selectedDuration]
  );

  const loadPendingPayment = async () => {
    const companyId = company?.id || company?.companyId;
    if (!companyId) return;
    try {
      const pending = await getPendingSubscriptionPayment(companyId);
      if (pending) {
        setPendingPayment(pending);
      }
    } catch (error) {
      console.error("Error loading pending payment:", error);
    }
  };

  const toggleTurfSelection = (turfId) => {
    setSelectedTurfIds((prev) =>
      prev.includes(turfId)
        ? prev.filter((id) => id !== turfId)
        : [...prev, turfId]
    );
  };

  const selectAllTurfs = () => {
    if (selectedTurfIds.length === turfs.length) {
      setSelectedTurfIds([]);
    } else {
      setSelectedTurfIds(turfs.map((t) => t.id || t.turfId));
    }
  };

  const handleInitiatePayment = async () => {
    const companyId = company?.id || company?.companyId;
    if (!companyId) {
      Alert.alert("Error", "Company information not available.");
      return;
    }
    if (selectedTurfIds.length === 0) {
      Alert.alert("Error", "Please select at least one turf.");
      return;
    }

    setLoading(true);
    try {
      const result = await initiateSubscriptionPayment(
        companyId,
        selectedTurfIds,
        totalGrounds,
        selectedDuration,
        pricing
      );

      setTransactionRef(result.transactionRef);
      setUpiLink(result.upiLink);
      setPaymentStep("initiated");

      const canOpen = await Linking.canOpenURL(result.upiLink);
      if (canOpen) {
        await Linking.openURL(result.upiLink);
      } else {
        Alert.alert(
          "UPI App Not Found",
          "Please install a UPI app (Google Pay, PhonePe, Paytm, etc.) to make payment."
        );
      }
    } catch (error) {
      console.error("Error initiating payment:", error);
      Alert.alert("Error", "Failed to initiate payment. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Please grant photo library access to upload payment proof."
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setProofImage(result.assets[0].uri);
    }
  };

  const handleSubmitProof = async () => {
    if (!proofImage) {
      Alert.alert("Error", "Please upload a payment screenshot.");
      return;
    }

    setUploading(true);
    try {
      await uploadSubscriptionPaymentProof(transactionRef, proofImage, {
        transactionId,
        paidFrom,
        notes,
      });

      Alert.alert(
        "Success",
        "Payment proof submitted! Your subscription will be activated once admin verifies the payment (usually within 24 hours).",
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error("Error submitting proof:", error);
      Alert.alert("Error", "Failed to submit payment proof. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  // ── Pending payment banner ──
  const renderPendingPaymentBanner = () => {
    if (!pendingPayment) return null;
    return (
      <Card style={styles.pendingCard}>
        <Card.Content>
          <View style={styles.pendingHeader}>
            <MaterialCommunityIcons name="clock-outline" size={24} color="#FF9800" />
            <Text style={styles.pendingTitle}>Payment Pending Verification</Text>
          </View>
          <Text style={styles.pendingAmount}>
            {formatPrice(pendingPayment.amount || pendingPayment.pricingDetails?.finalAmount || 0)}{" "}
            for {pendingPayment.months} month(s)
            {pendingPayment.totalGrounds
              ? ` | ${pendingPayment.totalGrounds} grounds`
              : ""}
          </Text>
          <Text style={styles.pendingStatus}>
            Status:{" "}
            {pendingPayment.status === "proof_submitted"
              ? "Proof Submitted - Awaiting Verification"
              : "Initiated - Complete Payment"}
          </Text>
          <Text style={styles.pendingNote}>
            You'll be notified once your subscription is activated.
          </Text>
        </Card.Content>
      </Card>
    );
  };

  // ── Step 1: Turf selection ──
  const renderTurfSelection = () => (
    <Card style={styles.card}>
      <Card.Title title="Select Turfs to Subscribe" titleStyle={styles.cardTitle} />
      <Card.Content>
        {loadingTurfs ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptySubtext}>Loading turfs...</Text>
          </View>
        ) : turfs.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="soccer-field" size={48} color="#ccc" />
            <Text style={styles.emptyText}>No turfs added yet.</Text>
            <Text style={styles.emptySubtext}>
              Add turfs first before subscribing.
            </Text>
          </View>
        ) : (
          <>
            <TouchableOpacity style={styles.selectAllRow} onPress={selectAllTurfs}>
              <Checkbox
                status={
                  selectedTurfIds.length === turfs.length
                    ? "checked"
                    : selectedTurfIds.length > 0
                    ? "indeterminate"
                    : "unchecked"
                }
                color={OWNER_COLOR}
                onPress={selectAllTurfs}
              />
              <Text style={styles.selectAllLabel}>
                Select All ({turfs.length} turfs)
              </Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            {turfs.map((turf) => {
              const turfId = turf.id || turf.turfId;
              const isSelected = selectedTurfIds.includes(turfId);
              const groundCount = turf.totalGrounds || turf.grounds?.length || 0;

              return (
                <TouchableOpacity
                  key={turfId}
                  style={[styles.turfRow, isSelected && styles.turfRowSelected]}
                  onPress={() => toggleTurfSelection(turfId)}
                >
                  <Checkbox
                    status={isSelected ? "checked" : "unchecked"}
                    color={OWNER_COLOR}
                    onPress={() => toggleTurfSelection(turfId)}
                  />
                  <View style={styles.turfInfo}>
                    <Text style={styles.turfName}>{turf.name}</Text>
                    <Text style={styles.turfDetails}>
                      {groundCount} ground{groundCount !== 1 ? "s" : ""}
                      {turf.location?.city ? ` | ${turf.location.city}` : ""}
                    </Text>
                  </View>
                  {turf.isActive && (
                    <Chip
                      mode="flat"
                      textStyle={{ fontSize: 10, color: "#4CAF50" }}
                      style={styles.activeBadge}
                    >
                      Active
                    </Chip>
                  )}
                </TouchableOpacity>
              );
            })}

            {/* Pricing tier info */}
            {selectedTurfIds.length > 0 && (
              <Surface style={styles.tierInfoBox} elevation={1}>
                <Text style={styles.tierInfoTitle}>Pricing Summary</Text>
                <View style={styles.tierRow}>
                  <Text style={styles.tierLabel}>Selected turfs:</Text>
                  <Text style={styles.tierValue}>{selectedTurfIds.length}</Text>
                </View>
                <View style={styles.tierRow}>
                  <Text style={styles.tierLabel}>Total grounds:</Text>
                  <Text style={styles.tierValue}>{totalGrounds}</Text>
                </View>
                <View style={styles.tierRow}>
                  <Text style={styles.tierLabel}>Your tier:</Text>
                  <Text style={[styles.tierValue, { color: OWNER_COLOR }]}>
                    {pricing.tierInfo?.label || "-"}
                  </Text>
                </View>
                <View style={styles.tierRow}>
                  <Text style={styles.tierLabel}>Price per ground:</Text>
                  <Text style={[styles.tierValue, { fontWeight: "bold" }]}>
                    {formatPrice(pricing.pricePerGround)}/month
                  </Text>
                </View>
                {pricing.tierDiscount > 0 && (
                  <View style={styles.tierRow}>
                    <Text style={styles.tierLabel}>Tier discount:</Text>
                    <Text style={[styles.tierValue, { color: "#4CAF50" }]}>
                      {pricing.tierDiscount}% off base price
                    </Text>
                  </View>
                )}

                {/* Tier reference table */}
                <View style={styles.tierTableContainer}>
                  <Text style={styles.tierTableTitle}>All Pricing Tiers:</Text>
                  {PRICING_TIERS.map((tier, index) => {
                    const isCurrentTier =
                      pricing.tierInfo &&
                      tier.min === pricing.tierInfo.min;
                    return (
                      <View
                        key={index}
                        style={[
                          styles.tierTableRow,
                          isCurrentTier && styles.tierTableRowActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.tierTableLabel,
                            isCurrentTier && styles.tierTableLabelActive,
                          ]}
                        >
                          {tier.label}
                        </Text>
                        <Text
                          style={[
                            styles.tierTablePrice,
                            isCurrentTier && styles.tierTablePriceActive,
                          ]}
                        >
                          {formatPrice(tier.pricePerGround)}/mo
                          {tier.discount > 0 ? ` (${tier.discount}% off)` : ""}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </Surface>
            )}

            <Button
              mode="contained"
              onPress={() => setPaymentStep("duration")}
              style={styles.payButton}
              buttonColor={OWNER_COLOR}
              disabled={selectedTurfIds.length === 0}
            >
              Continue - Select Duration
            </Button>
          </>
        )}
      </Card.Content>
    </Card>
  );

  // ── Step 2: Duration selection ──
  const renderDurationSelector = () => (
    <Card style={styles.card}>
      <Card.Title title="Select Subscription Duration" titleStyle={styles.cardTitle} />
      <Card.Content>
        {/* Selection summary chip */}
        <Surface style={styles.selectionSummary} elevation={1}>
          <Text style={styles.selectionSummaryText}>
            {selectedTurfIds.length} turf(s) | {totalGrounds} grounds |{" "}
            {pricing.tierInfo?.label} tier @ {formatPrice(pricing.pricePerGround)}
            /ground/month
          </Text>
        </Surface>

        <RadioButton.Group
          onValueChange={(value) => setSelectedDuration(parseInt(value))}
          value={selectedDuration.toString()}
        >
          {DURATION_DISCOUNTS.map((option) => (
            <TouchableOpacity
              key={option.months}
              style={[
                styles.radioRow,
                option.months === 12 && styles.bestValueRow,
              ]}
              onPress={() => setSelectedDuration(option.months)}
            >
              <RadioButton
                value={option.months.toString()}
                color={OWNER_COLOR}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.radioLabel}>{option.label}</Text>
              </View>
              {option.months === 12 && (
                <View style={styles.bestBadge}>
                  <Text style={styles.bestBadgeText}>BEST</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </RadioButton.Group>

        {/* Detailed pricing breakdown */}
        <Surface style={styles.pricingSummary} elevation={2}>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>
              {totalGrounds} grounds x {formatPrice(pricing.pricePerGround)}/mo
            </Text>
            <Text style={styles.priceValue}>
              {formatPrice(pricing.monthlyPrice)}/mo
            </Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>
              x {selectedDuration} month(s)
            </Text>
            <Text style={styles.priceValue}>
              {formatPrice(pricing.totalBeforeDiscount)}
            </Text>
          </View>
          {pricing.durationDiscount > 0 && (
            <View style={styles.priceRow}>
              <Text style={styles.discountLabel}>
                Duration discount ({pricing.durationDiscount}%):
              </Text>
              <Text style={styles.discountValue}>
                -{formatPrice(pricing.discountAmount)}
              </Text>
            </View>
          )}
          <View style={styles.divider} />
          <View style={styles.priceRow}>
            <Text style={styles.totalLabel}>Total Amount:</Text>
            <Text style={styles.totalAmount}>
              {formatPrice(pricing.finalAmount)}
            </Text>
          </View>
          <Text style={styles.validityText}>
            Valid for {selectedDuration} month(s)
          </Text>
        </Surface>

        <View style={styles.durationButtonRow}>
          <Button
            mode="outlined"
            onPress={() => setPaymentStep("turfs")}
            style={[styles.durationBtn, { marginRight: 8 }]}
            textColor="#666"
          >
            Back
          </Button>
          <Button
            mode="contained"
            onPress={handleInitiatePayment}
            style={[styles.durationBtn, { flex: 2 }]}
            buttonColor={OWNER_COLOR}
            loading={loading}
            disabled={loading}
          >
            Pay {formatPrice(pricing.finalAmount)}
          </Button>
        </View>
      </Card.Content>
    </Card>
  );

  // ── Step 3: Payment instructions ──
  const renderPaymentInstructions = () => (
    <Card style={styles.card}>
      <Card.Title title="Payment Instructions" titleStyle={styles.cardTitle} />
      <Card.Content>
        <View style={styles.instructionsList}>
          {[
            "We've opened your UPI app",
            `Complete the payment of ${formatPrice(pricing.finalAmount)}`,
            "Take a screenshot of the successful payment",
            "Upload the screenshot below",
            "Your subscription will be activated after verification",
          ].map((text, index) => (
            <View key={index} style={styles.instructionItem}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{index + 1}</Text>
              </View>
              <Text style={styles.instructionText}>{text}</Text>
            </View>
          ))}
        </View>

        <Surface style={styles.refBox} elevation={1}>
          <Text style={styles.refLabel}>Transaction Reference:</Text>
          <Text style={styles.refValue}>{transactionRef}</Text>
          <Text style={styles.refNote}>Keep this for your records</Text>
        </Surface>

        <Button
          mode="outlined"
          onPress={() => Linking.openURL(upiLink)}
          style={styles.retryButton}
          textColor={OWNER_COLOR}
          icon="open-in-app"
        >
          Open UPI App Again
        </Button>

        <Button
          mode="contained"
          onPress={() => setPaymentStep("proof")}
          style={styles.nextButton}
          buttonColor={OWNER_COLOR}
          icon="check-circle"
        >
          I've Completed Payment
        </Button>
      </Card.Content>
    </Card>
  );

  // ── Step 4: Proof upload ──
  const renderProofUpload = () => (
    <Card style={styles.card}>
      <Card.Title title="Upload Payment Proof" titleStyle={styles.cardTitle} />
      <Card.Content>
        <Text style={styles.fieldLabel}>Payment Screenshot *</Text>
        <TouchableOpacity style={styles.imagePicker} onPress={handlePickImage}>
          {proofImage ? (
            <Image source={{ uri: proofImage }} style={styles.proofImage} />
          ) : (
            <View style={styles.imagePickerPlaceholder}>
              <MaterialCommunityIcons name="camera-plus" size={48} color="#999" />
              <Text style={styles.imagePickerText}>Tap to upload screenshot</Text>
            </View>
          )}
        </TouchableOpacity>

        <TextInput
          label="UPI Transaction ID (Optional)"
          value={transactionId}
          onChangeText={setTransactionId}
          style={styles.input}
          mode="outlined"
          placeholder="e.g., 234567890123"
          outlineColor="#ddd"
          activeOutlineColor={OWNER_COLOR}
        />

        <TextInput
          label="Paid From UPI ID (Optional)"
          value={paidFrom}
          onChangeText={setPaidFrom}
          style={styles.input}
          mode="outlined"
          placeholder="e.g., yourname@paytm"
          outlineColor="#ddd"
          activeOutlineColor={OWNER_COLOR}
        />

        <TextInput
          label="Additional Notes (Optional)"
          value={notes}
          onChangeText={setNotes}
          style={styles.input}
          mode="outlined"
          multiline
          numberOfLines={3}
          outlineColor="#ddd"
          activeOutlineColor={OWNER_COLOR}
        />

        <Surface style={styles.verificationNote} elevation={1}>
          <View style={styles.verificationNoteHeader}>
            <MaterialCommunityIcons name="clock-fast" size={20} color="#1565C0" />
            <Text style={styles.noteTitle}>Verification Time</Text>
          </View>
          <Text style={styles.noteText}>
            Admin will verify your payment within 24 hours. You'll receive a
            notification once your subscription is activated.
          </Text>
        </Surface>

        <Button
          mode="contained"
          onPress={handleSubmitProof}
          loading={uploading}
          disabled={!proofImage || uploading}
          style={styles.submitButton}
          buttonColor={OWNER_COLOR}
          icon="send"
        >
          Submit Payment Proof
        </Button>

        <Button
          mode="text"
          onPress={() => setPaymentStep("initiated")}
          disabled={uploading}
          textColor="#666"
        >
          Back
        </Button>
      </Card.Content>
    </Card>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Subscription Payment</Text>
          <Text style={styles.headerSubtitle}>
            {company?.name || "My Company"}
          </Text>
        </View>
        {/* Step indicator */}
        <View style={styles.stepIndicator}>
          {["turfs", "duration", "initiated", "proof"].map((step, i) => (
            <View
              key={step}
              style={[
                styles.stepDot,
                (paymentStep === step ||
                  ["turfs", "duration", "initiated", "proof"].indexOf(paymentStep) >= i) &&
                  styles.stepDotActive,
              ]}
            />
          ))}
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {renderPendingPaymentBanner()}

        {paymentStep === "turfs" && renderTurfSelection()}
        {paymentStep === "duration" && renderDurationSelector()}
        {paymentStep === "initiated" && renderPaymentInstructions()}
        {paymentStep === "proof" && renderProofUpload()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F0FF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  backButton: {
    marginRight: 16,
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#666",
    marginTop: 2,
  },
  stepIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ddd",
  },
  stepDotActive: {
    backgroundColor: OWNER_COLOR,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  card: {
    margin: 16,
    borderRadius: 12,
  },
  cardTitle: {
    fontWeight: "bold",
  },
  // Pending payment
  pendingCard: {
    margin: 16,
    marginBottom: 0,
    borderRadius: 12,
    backgroundColor: "#FFF8E1",
  },
  pendingHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  pendingTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#F57C00",
    marginLeft: 8,
  },
  pendingAmount: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  pendingStatus: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  pendingNote: {
    fontSize: 12,
    color: "#999",
    fontStyle: "italic",
  },
  // Turf selection
  emptyState: {
    alignItems: "center",
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#999",
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#bbb",
    marginTop: 4,
  },
  selectAllRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  selectAllLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  turfRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 8,
    marginBottom: 4,
  },
  turfRowSelected: {
    backgroundColor: "#F3E5F5",
  },
  turfInfo: {
    flex: 1,
    marginLeft: 4,
  },
  turfName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
  turfDetails: {
    fontSize: 13,
    color: "#666",
    marginTop: 2,
  },
  activeBadge: {
    backgroundColor: "#E8F5E9",
    height: 24,
  },
  // Tier info
  tierInfoBox: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#fff",
    marginTop: 16,
  },
  tierInfoTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 12,
  },
  tierRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  tierLabel: {
    fontSize: 14,
    color: "#666",
  },
  tierValue: {
    fontSize: 14,
    color: "#333",
    fontWeight: "500",
  },
  tierTableContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  tierTableTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
    marginBottom: 8,
  },
  tierTableRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginBottom: 2,
  },
  tierTableRowActive: {
    backgroundColor: "#F3E5F5",
  },
  tierTableLabel: {
    fontSize: 13,
    color: "#666",
  },
  tierTableLabelActive: {
    color: OWNER_COLOR,
    fontWeight: "600",
  },
  tierTablePrice: {
    fontSize: 13,
    color: "#333",
  },
  tierTablePriceActive: {
    color: OWNER_COLOR,
    fontWeight: "bold",
  },
  // Selection summary
  selectionSummary: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#F3E5F5",
    marginBottom: 16,
  },
  selectionSummaryText: {
    fontSize: 13,
    color: OWNER_COLOR,
    fontWeight: "500",
    textAlign: "center",
  },
  // Duration / radio
  radioRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  radioLabel: {
    fontSize: 16,
    color: "#333",
  },
  bestValueRow: {
    backgroundColor: "#F3E5F5",
    borderRadius: 8,
    marginTop: 4,
  },
  bestBadge: {
    backgroundColor: OWNER_COLOR,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  bestBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
  },
  // Pricing summary
  pricingSummary: {
    padding: 16,
    marginTop: 16,
    borderRadius: 12,
    backgroundColor: "#fff",
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  priceLabel: {
    fontSize: 14,
    color: "#666",
  },
  priceValue: {
    fontSize: 14,
    color: "#333",
  },
  discountLabel: {
    fontSize: 14,
    color: "#4CAF50",
  },
  discountValue: {
    fontSize: 14,
    color: "#4CAF50",
    fontWeight: "500",
  },
  divider: {
    height: 1,
    backgroundColor: "#e0e0e0",
    marginVertical: 8,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: "bold",
    color: OWNER_COLOR,
  },
  validityText: {
    textAlign: "center",
    color: "#666",
    marginTop: 8,
    fontSize: 12,
  },
  payButton: {
    marginTop: 20,
    borderRadius: 8,
  },
  durationButtonRow: {
    flexDirection: "row",
    marginTop: 20,
  },
  durationBtn: {
    flex: 1,
    borderRadius: 8,
  },
  // Instructions
  instructionsList: {
    marginBottom: 16,
  },
  instructionItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: OWNER_COLOR,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  stepNumberText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
  },
  instructionText: {
    fontSize: 15,
    color: "#333",
    flex: 1,
  },
  refBox: {
    padding: 16,
    borderRadius: 8,
    marginVertical: 16,
    backgroundColor: "#F5F0FF",
  },
  refLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  refValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  refNote: {
    fontSize: 10,
    color: "#999",
    marginTop: 4,
  },
  retryButton: {
    marginBottom: 12,
    borderRadius: 8,
    borderColor: OWNER_COLOR,
  },
  nextButton: {
    borderRadius: 8,
  },
  // Proof upload
  fieldLabel: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#333",
  },
  imagePicker: {
    marginBottom: 16,
  },
  imagePickerPlaceholder: {
    height: 200,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#ccc",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fafafa",
  },
  imagePickerText: {
    marginTop: 8,
    color: "#999",
    fontSize: 14,
  },
  proofImage: {
    width: "100%",
    height: 300,
    borderRadius: 12,
  },
  input: {
    marginBottom: 12,
    backgroundColor: "#fff",
  },
  verificationNote: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#E3F2FD",
    marginVertical: 16,
  },
  verificationNoteHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1565C0",
    marginLeft: 8,
  },
  noteText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#333",
  },
  submitButton: {
    marginVertical: 8,
    borderRadius: 8,
  },
});
