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
  Text,
} from "react-native";
import {
  TextInput,
  Surface,
  Checkbox,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useAppDispatch } from "../../hooks";
import { setUser, setLoading } from "../../store/slices/authSlice";
import { setCompany } from "../../store/slices/companySlice";
import {
  setDocument,
  serverTimestamp,
  addDocument,
} from "../../services/firebase/firestore";
import { createInviteCodeObject } from "../../utils/inviteCodeUtils";

const BRAND_GREEN = "#16A34A";
const BRAND_DARK = "#14532D";
const BRAND_MID = "#15803D";
const PALE_GREEN = "#F0FDF4";
const GRAY_TEXT = "#6B7280";
const DANGER_RED = "#EF4444";

const STEPS = [
  { id: 1, title: "Company Info", icon: "office-building" },
  { id: 2, title: "Business Details", icon: "file-document" },
  { id: 3, title: "Preferences", icon: "cog" },
];

export default function OwnerSetupScreen({ route, navigation }) {
  const dispatch = useAppDispatch();
  const { userId, phoneNumber, name, email, profilePicture } = route.params;

  const [currentStep, setCurrentStep] = useState(1);

  // Step 1
  const [companyName, setCompanyName] = useState("");
  const [companyLogo, setCompanyLogo] = useState(null);
  const [companyDescription, setCompanyDescription] = useState("");
  const [companyPhone, setCompanyPhone] = useState(phoneNumber || "");
  const [companyEmail, setCompanyEmail] = useState(email || "");

  // Step 2
  const [gstNumber, setGstNumber] = useState("");
  const [panNumber, setPanNumber] = useState("");

  // Step 3
  const [hasOperationalPermissions, setHasOperationalPermissions] = useState(false);

  const [loading, setLoadingState] = useState(false);
  const [errors, setErrors] = useState({});

  const validateStep = (step) => {
    const newErrors = {};
    if (step === 1) {
      if (!companyName.trim()) {
        newErrors.companyName = "Company name is required";
      } else if (companyName.trim().length < 3) {
        newErrors.companyName = "Company name must be at least 3 characters";
      }
      if (companyEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(companyEmail)) {
        newErrors.companyEmail = "Please enter a valid email";
      }
    }
    if (step === 2) {
      if (gstNumber && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstNumber.toUpperCase())) {
        newErrors.gstNumber = "Invalid GST format (e.g., 27XXXXX1234X1ZX)";
      }
      if (panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panNumber.toUpperCase())) {
        newErrors.panNumber = "Invalid PAN format (e.g., ABCDE1234F)";
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < STEPS.length) {
        setCurrentStep(currentStep + 1);
      } else {
        handleCreateCompany();
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handlePickLogo = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Please allow access to your photos.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (!result.canceled && result.assets[0]) {
        setCompanyLogo(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to pick image. Please try again.");
    }
  };

  const handleCreateCompany = async () => {
    if (!userId) {
      Alert.alert("Error", "User ID is missing. Please try logging in again.");
      return;
    }

    setLoadingState(true);
    dispatch(setLoading(true));

    try {
      const inviteCode = createInviteCodeObject(userId);
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 30);

      const companyData = {
        name: companyName.trim(),
        ownerUserIds: [userId],
        phone: companyPhone.trim() || null,
        email: companyEmail.trim() || null,
        logo: companyLogo || null,
        description: companyDescription.trim() || null,
        gstNumber: gstNumber.trim().toUpperCase() || null,
        panNumber: panNumber.trim().toUpperCase() || null,
        inviteCode: inviteCode,
        subscription: {
          status: "trial",
          trialStartDate: serverTimestamp(),
          trialEndDate: trialEndDate.toISOString(),
          subscriptionStartDate: null,
          subscriptionEndDate: null,
          gracePeriodEndDate: null,
          totalGrounds: 0,
          pricePerGroundMonthly: 299,
          totalMonthlyFee: 0,
          discount: 0,
          lastPaymentDate: null,
          lastPaymentAmount: 0,
          paymentHistory: [],
        },
        managers: [],
        caretakers: [],
        unassignedCaretakers: [],
        stats: {
          totalTurfs: 0,
          totalGrounds: 0,
          totalBookings: 0,
          totalRevenue: 0,
          activeUsers: 0,
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const companyId = await addDocument("companies", companyData);

      const userData = {
        userId,
        phone: phoneNumber || null,
        name: name || "Owner",
        email: email || null,
        role: "owner",
        profilePicture: profilePicture || null,
        companyId: companyId,
        hasOperationalPermissions: hasOperationalPermissions,
        managedTurfIds: [],
        isActive: true,
        isSuspended: false,
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
        fcmTokens: [],
      };

      await setDocument("users", userId, userData);
      dispatch(setUser(userData));
      dispatch(setCompany({ ...companyData, companyId, id: companyId }));

      Alert.alert(
        "Welcome!",
        `Your company "${companyName}" has been created. You have a 30-day free trial.`,
        [{ text: "Get Started", onPress: () => {} }]
      );
    } catch (error) {
      console.error("Error creating company:", error);
      Alert.alert("Error", "Failed to create company. Please try again.");
    } finally {
      setLoadingState(false);
      dispatch(setLoading(false));
    }
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicatorRow}>
      {STEPS.map((step, index) => (
        <React.Fragment key={step.id}>
          <View style={styles.stepItem}>
            <View
              style={[
                styles.stepCircle,
                currentStep >= step.id && styles.stepCircleActive,
              ]}
            >
              {currentStep > step.id ? (
                <MaterialCommunityIcons name="check" size={16} color="#fff" />
              ) : (
                <Text
                  style={[
                    styles.stepNumber,
                    currentStep >= step.id && styles.stepNumberActive,
                  ]}
                >
                  {step.id}
                </Text>
              )}
            </View>
            <Text
              style={[
                styles.stepLabel,
                currentStep >= step.id && styles.stepLabelActive,
              ]}
            >
              {step.title}
            </Text>
          </View>
          {index < STEPS.length - 1 && (
            <View
              style={[
                styles.stepLine,
                currentStep > step.id && styles.stepLineActive,
              ]}
            />
          )}
        </React.Fragment>
      ))}
    </View>
  );

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.sectionTitle}>Company Information</Text>

      {/* Company Logo */}
      <View style={styles.logoSection}>
        <TouchableOpacity onPress={handlePickLogo} activeOpacity={0.7}>
          {companyLogo ? (
            <View style={{ position: "relative" }}>
              <Image source={{ uri: companyLogo }} style={styles.logoImage} />
              <TouchableOpacity
                style={styles.removeLogoBtn}
                onPress={() => setCompanyLogo(null)}
              >
                <MaterialCommunityIcons name="close" size={14} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.logoPlaceholder}>
              <MaterialCommunityIcons name="camera-plus" size={32} color={BRAND_GREEN + "80"} />
              <Text style={styles.logoPlaceholderText}>Add Logo</Text>
            </View>
          )}
        </TouchableOpacity>
        <Text style={styles.optionalText}>(Optional)</Text>
      </View>

      <Surface style={styles.formCard} elevation={1}>
        <TextInput
          mode="outlined"
          label="Company Name *"
          placeholder="e.g., Green Sports Arena"
          value={companyName}
          onChangeText={(text) => {
            setCompanyName(text);
            if (errors.companyName) setErrors({ ...errors, companyName: null });
          }}
          error={!!errors.companyName}
          left={<TextInput.Icon icon="office-building" />}
          outlineColor="#E5E7EB"
          activeOutlineColor={BRAND_GREEN}
          contentStyle={{ fontFamily: "Ubuntu-Regular" }}
          style={styles.input}
        />
        {errors.companyName && (
          <Text style={styles.errorText}>{errors.companyName}</Text>
        )}

        <TextInput
          mode="outlined"
          label="Description (Optional)"
          placeholder="Tell customers about your turfs"
          value={companyDescription}
          onChangeText={setCompanyDescription}
          multiline
          numberOfLines={3}
          left={<TextInput.Icon icon="text" />}
          outlineColor="#E5E7EB"
          activeOutlineColor={BRAND_GREEN}
          contentStyle={{ fontFamily: "Ubuntu-Regular" }}
          style={styles.input}
        />

        <TextInput
          mode="outlined"
          label="Company Phone"
          placeholder="Contact number"
          value={companyPhone}
          onChangeText={setCompanyPhone}
          keyboardType="phone-pad"
          left={<TextInput.Icon icon="phone" />}
          outlineColor="#E5E7EB"
          activeOutlineColor={BRAND_GREEN}
          contentStyle={{ fontFamily: "Ubuntu-Regular" }}
          style={styles.input}
        />

        <TextInput
          mode="outlined"
          label="Company Email (Optional)"
          placeholder="company@example.com"
          value={companyEmail}
          onChangeText={(text) => {
            setCompanyEmail(text);
            if (errors.companyEmail) setErrors({ ...errors, companyEmail: null });
          }}
          error={!!errors.companyEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          left={<TextInput.Icon icon="email" />}
          outlineColor="#E5E7EB"
          activeOutlineColor={BRAND_GREEN}
          contentStyle={{ fontFamily: "Ubuntu-Regular" }}
          style={styles.input}
        />
        {errors.companyEmail && (
          <Text style={styles.errorText}>{errors.companyEmail}</Text>
        )}
      </Surface>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.sectionTitle}>Business Details</Text>
      <Text style={styles.sectionSubtitle}>Optional — You can add these later</Text>

      <Surface style={styles.formCard} elevation={1}>
        <TextInput
          mode="outlined"
          label="GST Number (Optional)"
          placeholder="e.g., 27XXXXX1234X1ZX"
          value={gstNumber}
          onChangeText={(text) => {
            setGstNumber(text.toUpperCase());
            if (errors.gstNumber) setErrors({ ...errors, gstNumber: null });
          }}
          error={!!errors.gstNumber}
          autoCapitalize="characters"
          left={<TextInput.Icon icon="file-document" />}
          outlineColor="#E5E7EB"
          activeOutlineColor={BRAND_GREEN}
          contentStyle={{ fontFamily: "Ubuntu-Regular" }}
          style={styles.input}
        />
        {errors.gstNumber && (
          <Text style={styles.errorText}>{errors.gstNumber}</Text>
        )}

        <TextInput
          mode="outlined"
          label="PAN Number (Optional)"
          placeholder="e.g., ABCDE1234F"
          value={panNumber}
          onChangeText={(text) => {
            setPanNumber(text.toUpperCase());
            if (errors.panNumber) setErrors({ ...errors, panNumber: null });
          }}
          error={!!errors.panNumber}
          autoCapitalize="characters"
          maxLength={10}
          left={<TextInput.Icon icon="card-account-details" />}
          outlineColor="#E5E7EB"
          activeOutlineColor={BRAND_GREEN}
          contentStyle={{ fontFamily: "Ubuntu-Regular" }}
          style={styles.input}
        />
        {errors.panNumber && (
          <Text style={styles.errorText}>{errors.panNumber}</Text>
        )}
      </Surface>

      <View style={styles.tipCard}>
        <View style={styles.tipAccentBar} />
        <View style={styles.tipContent}>
          <MaterialCommunityIcons name="lightbulb-outline" size={16} color={BRAND_MID} />
          <Text style={styles.tipText}>
            GST and PAN details help generate proper invoices for your customers. You can add these later from company settings.
          </Text>
        </View>
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.sectionTitle}>Operational Preferences</Text>

      <Surface style={styles.formCard} elevation={1}>
        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => setHasOperationalPermissions(!hasOperationalPermissions)}
          activeOpacity={0.7}
        >
          <Checkbox
            status={hasOperationalPermissions ? "checked" : "unchecked"}
            onPress={() => setHasOperationalPermissions(!hasOperationalPermissions)}
            color={BRAND_GREEN}
          />
          <View style={styles.checkboxContent}>
            <Text style={styles.checkboxTitle}>I want to manage day-to-day operations</Text>
            <Text style={styles.checkboxDesc}>
              Enable to approve bookings, respond to chats, assign caretakers, and perform manager tasks.
            </Text>
          </View>
        </TouchableOpacity>

        {hasOperationalPermissions && (
          <View style={styles.permissionsList}>
            <Text style={styles.permissionsTitle}>With operational permissions, you can:</Text>
            {[
              "Approve or reject booking requests",
              "Respond to customer chats",
              "Assign caretakers to turfs",
              "Create and manage academies",
              "Block time slots for maintenance",
            ].map((item, i) => (
              <View key={i} style={styles.permissionItem}>
                <MaterialCommunityIcons name="check" size={14} color={BRAND_GREEN} />
                <Text style={styles.permissionText}>{item}</Text>
              </View>
            ))}
          </View>
        )}
      </Surface>

      <View style={styles.tipCard}>
        <View style={styles.tipAccentBar} />
        <View style={styles.tipContent}>
          <MaterialCommunityIcons name="lightbulb-outline" size={16} color={BRAND_MID} />
          <Text style={styles.tipText}>
            You can change this setting anytime from Settings. If disabled, you'll need managers to handle daily operations.
          </Text>
        </View>
      </View>

      {/* Trial info card */}
      <View style={styles.trialCard}>
        <View style={styles.trialHeader}>
          <MaterialCommunityIcons name="gift" size={22} color={BRAND_GREEN} />
          <Text style={styles.trialTitle}>30-Day Free Trial</Text>
        </View>
        <Text style={styles.trialText}>
          Start with a free 30-day trial. Add unlimited turfs and explore all features. After the trial, pay only ₹299/ground/month.
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          {currentStep > 1 ? (
            <TouchableOpacity style={styles.iconBtn} onPress={handleBack} activeOpacity={0.8}>
              <MaterialCommunityIcons name="arrow-left" size={22} color="#374151" />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 40 }} />
          )}
          <Text style={styles.headerTitle}>Create Your Company</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Step Indicator */}
        <View style={styles.stepIndicatorWrapper}>
          {renderStepIndicator()}
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}

          {/* Nav Buttons */}
          <View style={styles.buttonRow}>
            {currentStep > 1 && (
              <TouchableOpacity
                style={styles.backBtn}
                onPress={handleBack}
                activeOpacity={0.8}
              >
                <Text style={styles.backBtnText}>Back</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                styles.nextBtn,
                currentStep === 1 && styles.nextBtnFull,
                (loading || (currentStep === 1 && !companyName.trim())) && styles.nextBtnDisabled,
              ]}
              onPress={handleNext}
              disabled={loading || (currentStep === 1 && !companyName.trim())}
              activeOpacity={0.85}
            >
              <Text style={styles.nextBtnText}>
                {currentStep === STEPS.length
                  ? loading ? "Creating..." : "Create Company"
                  : "Continue"}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7FFF9",
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  headerTitle: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 20,
    color: BRAND_DARK,
    flex: 1,
    textAlign: "center",
  },
  stepIndicatorWrapper: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  stepIndicatorRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "center",
  },
  stepItem: {
    alignItems: "center",
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
  },
  stepCircleActive: {
    backgroundColor: BRAND_GREEN,
  },
  stepNumber: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 14,
    color: "#9CA3AF",
  },
  stepNumberActive: {
    fontFamily: "Ubuntu-Bold",
    color: "#fff",
  },
  stepLabel: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 11,
    color: GRAY_TEXT,
    marginTop: 4,
    textAlign: "center",
  },
  stepLabelActive: {
    color: BRAND_GREEN,
    fontFamily: "Ubuntu-Medium",
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: "#E5E7EB",
    marginHorizontal: 6,
    marginTop: 16,
  },
  stepLineActive: {
    backgroundColor: BRAND_GREEN,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 0,
    paddingBottom: 40,
  },
  stepContent: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 17,
    color: BRAND_DARK,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 13,
    color: GRAY_TEXT,
    marginBottom: 16,
  },
  logoSection: {
    alignItems: "center",
    marginVertical: 16,
  },
  logoImage: {
    width: 100,
    height: 100,
    borderRadius: 16,
  },
  removeLogoBtn: {
    position: "absolute",
    top: -8,
    right: -8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: DANGER_RED,
    justifyContent: "center",
    alignItems: "center",
  },
  logoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 16,
    backgroundColor: PALE_GREEN,
    borderWidth: 2,
    borderColor: BRAND_GREEN + "40",
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
  },
  logoPlaceholderText: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 12,
    color: GRAY_TEXT,
    marginTop: 4,
  },
  optionalText: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 12,
    color: GRAY_TEXT,
    marginTop: 8,
  },
  formCard: {
    borderRadius: 16,
    backgroundColor: "#fff",
    padding: 16,
    marginBottom: 16,
  },
  input: {
    marginBottom: 4,
    backgroundColor: "#fff",
  },
  errorText: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 12,
    color: DANGER_RED,
    marginBottom: 8,
    marginLeft: 4,
  },
  tipCard: {
    borderRadius: 12,
    backgroundColor: PALE_GREEN,
    borderLeftWidth: 3,
    borderLeftColor: BRAND_MID,
    marginBottom: 16,
    overflow: "hidden",
  },
  tipAccentBar: {
    height: 0,
  },
  tipContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
    gap: 8,
  },
  tipText: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 13,
    color: BRAND_DARK,
    flex: 1,
    lineHeight: 18,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  checkboxContent: {
    flex: 1,
    marginLeft: 8,
    paddingTop: 6,
  },
  checkboxTitle: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 14,
    color: BRAND_DARK,
    marginBottom: 4,
  },
  checkboxDesc: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 13,
    color: GRAY_TEXT,
    lineHeight: 18,
  },
  permissionsList: {
    backgroundColor: PALE_GREEN,
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  permissionsTitle: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 13,
    color: BRAND_DARK,
    marginBottom: 8,
  },
  permissionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginVertical: 3,
  },
  permissionText: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 13,
    color: GRAY_TEXT,
  },
  trialCard: {
    borderRadius: 14,
    backgroundColor: PALE_GREEN,
    borderLeftWidth: 4,
    borderLeftColor: BRAND_GREEN,
    padding: 16,
    marginTop: 4,
    marginBottom: 16,
  },
  trialHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  trialTitle: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 15,
    color: BRAND_DARK,
  },
  trialText: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 13,
    color: GRAY_TEXT,
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: "row",
    marginTop: 24,
    gap: 12,
  },
  backBtn: {
    flex: 1,
    borderRadius: 12,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    backgroundColor: "#fff",
  },
  backBtnText: {
    fontFamily: "Ubuntu-Medium",
    fontSize: 15,
    color: GRAY_TEXT,
  },
  nextBtn: {
    flex: 2,
    borderRadius: 12,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BRAND_GREEN,
  },
  nextBtnFull: {
    flex: 1,
  },
  nextBtnDisabled: {
    opacity: 0.5,
  },
  nextBtnText: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 15,
    color: "#fff",
  },
});
