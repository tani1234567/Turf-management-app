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
  TextInput,
  Button,
  Surface,
  IconButton,
  Checkbox,
  ProgressBar,
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

const STEPS = [
  { id: 1, title: "Company Info", icon: "office-building" },
  { id: 2, title: "Business Details", icon: "file-document" },
  { id: 3, title: "Preferences", icon: "cog" },
];

export default function OwnerSetupScreen({ route, navigation }) {
  const dispatch = useAppDispatch();
  const { userId, phoneNumber, name, email, profilePicture } = route.params;

  // Step tracking
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1: Company Info
  const [companyName, setCompanyName] = useState("");
  const [companyLogo, setCompanyLogo] = useState(null);
  const [companyDescription, setCompanyDescription] = useState("");
  const [companyPhone, setCompanyPhone] = useState(phoneNumber || "");
  const [companyEmail, setCompanyEmail] = useState(email || "");

  // Step 2: Business Details
  const [gstNumber, setGstNumber] = useState("");
  const [panNumber, setPanNumber] = useState("");

  // Step 3: Preferences
  const [hasOperationalPermissions, setHasOperationalPermissions] = useState(false);

  // Loading and errors
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
      // GST validation (optional but must be valid format if provided)
      if (gstNumber && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstNumber.toUpperCase())) {
        newErrors.gstNumber = "Invalid GST format (e.g., 27XXXXX1234X1ZX)";
      }

      // PAN validation (optional but must be valid format if provided)
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
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handlePickLogo = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Please allow access to your photos to upload a company logo."
        );
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
      console.error("Error picking image:", error);
      Alert.alert("Error", "Failed to pick image. Please try again.");
    }
  };

  const handleCreateCompany = async () => {
    // Validate required params
    if (!userId) {
      Alert.alert("Error", "User ID is missing. Please try logging in again.");
      return;
    }

    setLoadingState(true);
    dispatch(setLoading(true));

    try {
      // Generate invite code
      const inviteCode = createInviteCodeObject(userId);

      // Calculate trial end date (30 days from now)
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 30);

      // Create company document
      const companyData = {
        name: companyName.trim(),
        ownerUserIds: [userId],
        phone: companyPhone.trim() || null,
        email: companyEmail.trim() || null,
        logo: companyLogo || null, // TODO: Upload to Firebase Storage
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

      // Add company to Firestore (addDocument returns the ID string directly)
      const companyId = await addDocument("companies", companyData);

      // Update user document with owner fields
      const userData = {
        userId,
        phone: phoneNumber || null,
        name: name || "Owner",
        email: email || null,
        role: "owner",
        profilePicture: profilePicture || null,
        companyId: companyId,
        hasOperationalPermissions: hasOperationalPermissions,
        managedTurfIds: [], // Empty means all turfs
        isActive: true,
        isSuspended: false,
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
        fcmTokens: [],
      };

      await setDocument("users", userId, userData);

      // Update Redux state
      dispatch(setUser(userData));
      dispatch(setCompany({ ...companyData, companyId, id: companyId }));

      // Navigation will be handled by RootNavigator based on role
      Alert.alert(
        "Welcome!",
        `Your company "${companyName}" has been created successfully. You have a 30-day free trial.`,
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
    <View style={styles.stepIndicator}>
      <View style={styles.stepsRow}>
        {STEPS.map((step, index) => (
          <React.Fragment key={step.id}>
            <View style={styles.stepItem}>
              <View
                style={[
                  styles.stepCircle,
                  currentStep >= step.id && styles.stepCircleActive,
                  currentStep > step.id && styles.stepCircleCompleted,
                ]}
              >
                {currentStep > step.id ? (
                  <MaterialCommunityIcons name="check" size={18} color="#fff" />
                ) : (
                  <MaterialCommunityIcons
                    name={step.icon}
                    size={18}
                    color={currentStep >= step.id ? "#fff" : "#999"}
                  />
                )}
              </View>
              <Text
                variant="bodySmall"
                style={[
                  styles.stepTitle,
                  currentStep >= step.id && styles.stepTitleActive,
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
      <ProgressBar
        progress={currentStep / STEPS.length}
        color="#9C27B0"
        style={styles.progressBar}
      />
    </View>
  );

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text variant="titleMedium" style={styles.sectionTitle}>
        Company Information
      </Text>

      {/* Company Logo */}
      <View style={styles.logoSection}>
        <TouchableOpacity onPress={handlePickLogo} activeOpacity={0.7}>
          {companyLogo ? (
            <View style={styles.logoContainer}>
              <Image source={{ uri: companyLogo }} style={styles.logoImage} />
              <IconButton
                icon="close-circle"
                size={24}
                iconColor="#F44336"
                style={styles.removeButton}
                onPress={() => setCompanyLogo(null)}
              />
            </View>
          ) : (
            <View style={styles.logoPlaceholder}>
              <MaterialCommunityIcons name="camera-plus" size={32} color="#999" />
              <Text variant="bodySmall" style={styles.logoText}>
                Add Logo
              </Text>
            </View>
          )}
        </TouchableOpacity>
        <Text variant="bodySmall" style={styles.optionalText}>
          (Optional)
        </Text>
      </View>

      <Surface style={styles.formContainer} elevation={1}>
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
          style={styles.input}
        />
        {errors.companyName && (
          <Text variant="bodySmall" style={styles.errorText}>
            {errors.companyName}
          </Text>
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
          style={styles.input}
        />
        {errors.companyEmail && (
          <Text variant="bodySmall" style={styles.errorText}>
            {errors.companyEmail}
          </Text>
        )}
      </Surface>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text variant="titleMedium" style={styles.sectionTitle}>
        Business Details
      </Text>
      <Text variant="bodySmall" style={styles.sectionSubtitle}>
        Optional - You can add these later
      </Text>

      <Surface style={styles.formContainer} elevation={1}>
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
          style={styles.input}
        />
        {errors.gstNumber && (
          <Text variant="bodySmall" style={styles.errorText}>
            {errors.gstNumber}
          </Text>
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
          style={styles.input}
        />
        {errors.panNumber && (
          <Text variant="bodySmall" style={styles.errorText}>
            {errors.panNumber}
          </Text>
        )}
      </Surface>

      <View style={styles.infoContainer}>
        <MaterialCommunityIcons name="information-outline" size={18} color="#2196F3" />
        <Text variant="bodySmall" style={styles.infoText}>
          GST and PAN details help generate proper invoices for your customers.
          You can add these later from company settings.
        </Text>
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <Text variant="titleMedium" style={styles.sectionTitle}>
        Operational Preferences
      </Text>

      <Surface style={styles.formContainer} elevation={1}>
        <TouchableOpacity
          style={styles.checkboxContainer}
          onPress={() => setHasOperationalPermissions(!hasOperationalPermissions)}
          activeOpacity={0.7}
        >
          <Checkbox
            status={hasOperationalPermissions ? "checked" : "unchecked"}
            onPress={() => setHasOperationalPermissions(!hasOperationalPermissions)}
            color="#9C27B0"
          />
          <View style={styles.checkboxContent}>
            <Text variant="bodyLarge" style={styles.checkboxTitle}>
              I want to manage day-to-day operations
            </Text>
            <Text variant="bodySmall" style={styles.checkboxDescription}>
              Enable this to approve bookings, respond to chats, assign
              caretakers, and perform other manager tasks yourself.
            </Text>
          </View>
        </TouchableOpacity>

        {hasOperationalPermissions && (
          <View style={styles.permissionsInfo}>
            <Text variant="bodySmall" style={styles.permissionsTitle}>
              With operational permissions, you can:
            </Text>
            {[
              "Approve or reject booking requests",
              "Respond to customer chats",
              "Assign caretakers to turfs",
              "Create and manage academies",
              "Block time slots for maintenance",
            ].map((item, index) => (
              <View key={index} style={styles.permissionItem}>
                <MaterialCommunityIcons name="check" size={16} color="#9C27B0" />
                <Text variant="bodySmall" style={styles.permissionText}>
                  {item}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Surface>

      <View style={styles.infoContainer}>
        <MaterialCommunityIcons name="lightbulb-outline" size={18} color="#FF9800" />
        <Text variant="bodySmall" style={styles.infoText}>
          You can change this setting anytime from Settings. If disabled, you'll
          need to hire managers to handle daily operations.
        </Text>
      </View>

      {/* Trial Info */}
      <Surface style={styles.trialCard} elevation={2}>
        <View style={styles.trialHeader}>
          <MaterialCommunityIcons name="gift" size={24} color="#9C27B0" />
          <Text variant="titleMedium" style={styles.trialTitle}>
            30-Day Free Trial
          </Text>
        </View>
        <Text variant="bodySmall" style={styles.trialText}>
          Start with a free 30-day trial. Add unlimited turfs and explore all
          features. After the trial, pay only ₹299/ground/month.
        </Text>
      </Surface>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          {currentStep > 1 && (
            <IconButton
              icon="arrow-left"
              size={24}
              onPress={handleBack}
              style={styles.backButton}
            />
          )}
          <Text variant="headlineSmall" style={styles.title}>
            Create Your Company
          </Text>
        </View>

        {renderStepIndicator()}

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}

          {/* Navigation Buttons */}
          <View style={styles.buttonContainer}>
            {currentStep > 1 && (
              <Button
                mode="outlined"
                onPress={handleBack}
                style={styles.backBtn}
                contentStyle={styles.buttonContent}
              >
                Back
              </Button>
            )}
            <Button
              mode="contained"
              onPress={handleNext}
              loading={loading}
              disabled={loading || (currentStep === 1 && !companyName.trim())}
              style={[styles.nextButton, currentStep === 1 && styles.fullWidth]}
              contentStyle={styles.buttonContent}
              buttonColor="#9C27B0"
            >
              {currentStep === STEPS.length
                ? loading
                  ? "Creating..."
                  : "Create Company"
                : "Continue"}
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  backButton: {
    marginLeft: -8,
  },
  title: {
    fontWeight: "bold",
    flex: 1,
    textAlign: "center",
    marginRight: 40,
  },
  stepIndicator: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  stepsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  stepItem: {
    alignItems: "center",
  },
  stepCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#e0e0e0",
    justifyContent: "center",
    alignItems: "center",
  },
  stepCircleActive: {
    backgroundColor: "#9C27B0",
  },
  stepCircleCompleted: {
    backgroundColor: "#4CAF50",
  },
  stepTitle: {
    marginTop: 4,
    color: "#999",
    fontSize: 11,
  },
  stepTitleActive: {
    color: "#9C27B0",
    fontWeight: "600",
  },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: "#e0e0e0",
    marginHorizontal: 8,
    marginBottom: 20,
  },
  stepLineActive: {
    backgroundColor: "#4CAF50",
  },
  progressBar: {
    marginTop: 16,
    borderRadius: 4,
    height: 4,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 0,
  },
  stepContent: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontWeight: "bold",
    marginBottom: 4,
  },
  sectionSubtitle: {
    color: "#666",
    marginBottom: 16,
  },
  logoSection: {
    alignItems: "center",
    marginVertical: 16,
  },
  logoContainer: {
    position: "relative",
  },
  logoImage: {
    width: 100,
    height: 100,
    borderRadius: 16,
  },
  removeButton: {
    position: "absolute",
    top: -10,
    right: -10,
    backgroundColor: "#fff",
    margin: 0,
  },
  logoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 16,
    backgroundColor: "#e0e0e0",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#ccc",
    borderStyle: "dashed",
  },
  logoText: {
    color: "#999",
    marginTop: 4,
  },
  optionalText: {
    color: "#999",
    marginTop: 8,
  },
  formContainer: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#fff",
  },
  input: {
    marginBottom: 4,
    backgroundColor: "#fff",
  },
  errorText: {
    color: "#F44336",
    marginBottom: 12,
    marginLeft: 4,
  },
  infoContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#E3F2FD",
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  infoText: {
    flex: 1,
    marginLeft: 8,
    color: "#666",
    lineHeight: 18,
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  checkboxContent: {
    flex: 1,
    marginLeft: 8,
  },
  checkboxTitle: {
    fontWeight: "600",
  },
  checkboxDescription: {
    color: "#666",
    marginTop: 4,
    lineHeight: 18,
  },
  permissionsInfo: {
    backgroundColor: "#F3E5F5",
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  permissionsTitle: {
    fontWeight: "600",
    marginBottom: 8,
    color: "#7B1FA2",
  },
  permissionItem: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 4,
  },
  permissionText: {
    marginLeft: 8,
    color: "#666",
  },
  trialCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#fff",
    marginTop: 16,
  },
  trialHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  trialTitle: {
    marginLeft: 8,
    fontWeight: "bold",
    color: "#9C27B0",
  },
  trialText: {
    color: "#666",
    lineHeight: 20,
  },
  buttonContainer: {
    flexDirection: "row",
    marginTop: 24,
    gap: 12,
  },
  backBtn: {
    flex: 1,
    borderRadius: 8,
  },
  nextButton: {
    flex: 2,
    borderRadius: 8,
  },
  fullWidth: {
    flex: 1,
  },
  buttonContent: {
    height: 50,
  },
});
