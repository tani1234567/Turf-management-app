import React, { useState } from "react";
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
  TextInput,
  Button,
  Surface,
  ActivityIndicator,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppDispatch } from "../../hooks";
import { setUser, setLoading } from "../../store/slices/authSlice";
import {
  setDocument,
  queryDocuments,
  updateDocument,
  serverTimestamp,
} from "../../services/firebase/firestore";
import {
  validateInviteCodeFormat,
  formatInviteCode,
  extractCodeFromLink,
} from "../../utils/inviteCodeUtils";

export default function JoinCompanyScreen({ route, navigation }) {
  const dispatch = useAppDispatch();
  const { userId, phoneNumber, name, email, profilePicture, role } = route.params;

  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoadingState] = useState(false);
  const [validating, setValidating] = useState(false);
  const [company, setCompany] = useState(null);
  const [availableTurfs, setAvailableTurfs] = useState([]);
  const [selectedTurfs, setSelectedTurfs] = useState([]);
  const [error, setError] = useState("");

  const getRoleColor = () => {
    return role === "manager" ? "#2196F3" : "#FF9800";
  };

  const handleCodeChange = (text) => {
    // Check if it's a link and extract code
    const extractedCode = extractCodeFromLink(text);
    if (extractedCode) {
      setInviteCode(extractedCode);
    } else {
      setInviteCode(formatInviteCode(text));
    }
    setError("");
    setCompany(null);
    setAvailableTurfs([]);
    setSelectedTurfs([]);
  };

  const handleValidateCode = async () => {
    if (!validateInviteCodeFormat(inviteCode)) {
      setError("Invalid code format. Must be 8 alphanumeric characters.");
      return;
    }

    setValidating(true);
    setError("");

    try {
      // Query companies with this invite code
      const companies = await queryDocuments("companies", [
        { field: "inviteCode.code", operator: "==", value: inviteCode.toUpperCase() },
      ]);

      if (companies.length === 0) {
        setError("Invalid invite code. Please check and try again.");
        setValidating(false);
        return;
      }

      const companyData = companies[0];
      setCompany(companyData);

      // For managers, fetch available turfs
      if (role === "manager") {
        const turfs = await queryDocuments("turfs", [
          { field: "companyId", operator: "==", value: companyData.id },
        ]);
        setAvailableTurfs(turfs);
      }
    } catch (err) {
      console.error("Error validating code:", err);
      setError("Failed to validate code. Please try again.");
    } finally {
      setValidating(false);
    }
  };

  const toggleTurfSelection = (turfId) => {
    if (selectedTurfs.includes(turfId)) {
      setSelectedTurfs(selectedTurfs.filter((id) => id !== turfId));
    } else {
      setSelectedTurfs([...selectedTurfs, turfId]);
    }
  };

  const handleJoinCompany = async () => {
    if (!company) return;

    // Manager must select at least one turf
    if (role === "manager" && selectedTurfs.length === 0) {
      Alert.alert("Select Turfs", "Please select at least one turf to manage.");
      return;
    }

    setLoadingState(true);
    dispatch(setLoading(true));

    try {
      // Create user document
      const userData = {
        userId,
        phone: phoneNumber,
        name,
        email: email || null,
        role,
        profilePicture: profilePicture || null,
        companyId: company.id,
        isActive: true,
        isSuspended: false,
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
        fcmTokens: [],
      };

      if (role === "manager") {
        userData.assignedTurfIds = selectedTurfs;
        userData.selectedTurfId = selectedTurfs[0] || null;
      } else {
        // Caretaker
        userData.assignedTurfId = null;
        userData.isAssigned = false;
      }

      // Save user document
      await setDocument("users", userId, userData);

      // Update company document
      if (role === "manager") {
        // Add to managers array
        const updatedManagers = [...(company.managers || []), userId];
        await updateDocument("companies", company.id, {
          managers: updatedManagers,
        });

        // Add manager to each selected turf
        for (const turfId of selectedTurfs) {
          const turf = availableTurfs.find((t) => t.id === turfId);
          if (turf) {
            const updatedManagerIds = [...(turf.managerIds || []), userId];
            await updateDocument("turfs", turfId, {
              managerIds: updatedManagerIds,
            });
          }
        }
      } else {
        // Caretaker - add to caretakers and unassignedCaretakers
        const updatedCaretakers = [...(company.caretakers || []), userId];
        const updatedUnassigned = [...(company.unassignedCaretakers || []), userId];
        await updateDocument("companies", company.id, {
          caretakers: updatedCaretakers,
          unassignedCaretakers: updatedUnassigned,
        });
      }

      // Update Redux state
      dispatch(setUser(userData));

      // Show success message
      Alert.alert(
        "Welcome!",
        role === "manager"
          ? `You've joined ${company.name}. You can now manage the selected turfs.`
          : `You've joined ${company.name}. Please wait for a manager to assign you to a turf.`,
        [{ text: "OK" }]
      );
    } catch (err) {
      console.error("Error joining company:", err);
      Alert.alert("Error", "Failed to join company. Please try again.");
    } finally {
      setLoadingState(false);
      dispatch(setLoading(false));
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <MaterialCommunityIcons
              name={role === "manager" ? "briefcase" : "account-hard-hat"}
              size={48}
              color={getRoleColor()}
            />
            <Text variant="headlineSmall" style={styles.title}>
              Join a Company
            </Text>
            <Text variant="bodyMedium" style={styles.subtitle}>
              Enter the invite code shared by your Turf Owner
            </Text>
          </View>

          {/* Invite Code Input */}
          <Surface style={styles.codeContainer} elevation={1}>
            <TextInput
              mode="outlined"
              label="Invite Code"
              placeholder="e.g., GREEN123"
              value={inviteCode}
              onChangeText={handleCodeChange}
              autoCapitalize="characters"
              maxLength={8}
              left={<TextInput.Icon icon="key" />}
              right={
                inviteCode.length === 8 && (
                  <TextInput.Icon
                    icon={company ? "check-circle" : "help-circle"}
                    color={company ? "#4CAF50" : "#999"}
                  />
                )
              }
              style={styles.codeInput}
              error={!!error}
            />
            {error && (
              <Text variant="bodySmall" style={styles.errorText}>
                {error}
              </Text>
            )}

            {!company && (
              <Button
                mode="contained"
                onPress={handleValidateCode}
                loading={validating}
                disabled={validating || inviteCode.length !== 8}
                style={styles.validateButton}
                buttonColor={getRoleColor()}
              >
                {validating ? "Validating..." : "Validate Code"}
              </Button>
            )}
          </Surface>

          {/* Company Info */}
          {company && (
            <Surface style={styles.companyCard} elevation={2}>
              <View style={styles.companyHeader}>
                <MaterialCommunityIcons
                  name="office-building"
                  size={32}
                  color="#9C27B0"
                />
                <View style={styles.companyInfo}>
                  <Text variant="titleMedium" style={styles.companyName}>
                    {company.name}
                  </Text>
                  <Text variant="bodySmall" style={styles.companyStats}>
                    {company.stats?.totalTurfs || 0} turfs •{" "}
                    {(company.managers?.length || 0) + (company.caretakers?.length || 0)} team members
                  </Text>
                </View>
                <MaterialCommunityIcons
                  name="check-circle"
                  size={24}
                  color="#4CAF50"
                />
              </View>
            </Surface>
          )}

          {/* Turf Selection (Manager Only) */}
          {company && role === "manager" && (
            <View style={styles.turfSection}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Select Turfs to Manage
              </Text>
              <Text variant="bodySmall" style={styles.sectionSubtitle}>
                Owner can modify your assignments later
              </Text>

              {availableTurfs.length === 0 ? (
                <Surface style={styles.emptyCard} elevation={1}>
                  <MaterialCommunityIcons
                    name="alert-circle-outline"
                    size={32}
                    color="#FF9800"
                  />
                  <Text variant="bodyMedium" style={styles.emptyText}>
                    No turfs available yet. The owner needs to add turfs first.
                  </Text>
                </Surface>
              ) : (
                availableTurfs.map((turf) => (
                  <Surface
                    key={turf.id}
                    style={[
                      styles.turfCard,
                      selectedTurfs.includes(turf.id) && styles.turfCardSelected,
                    ]}
                    elevation={1}
                    onTouchEnd={() => toggleTurfSelection(turf.id)}
                  >
                    <View style={styles.turfInfo}>
                      <Text variant="titleSmall" style={styles.turfName}>
                        {turf.name}
                      </Text>
                      <Text variant="bodySmall" style={styles.turfLocation}>
                        {turf.location?.city || "Location not set"}
                      </Text>
                      <Text variant="bodySmall" style={styles.turfGrounds}>
                        {turf.totalGrounds || turf.grounds?.length || 0} grounds
                      </Text>
                    </View>
                    <MaterialCommunityIcons
                      name={
                        selectedTurfs.includes(turf.id)
                          ? "checkbox-marked-circle"
                          : "checkbox-blank-circle-outline"
                      }
                      size={24}
                      color={selectedTurfs.includes(turf.id) ? "#2196F3" : "#999"}
                    />
                  </Surface>
                ))
              )}
            </View>
          )}

          {/* Caretaker Info */}
          {company && role === "caretaker" && (
            <View style={styles.caretakerInfo}>
              <MaterialCommunityIcons
                name="information-outline"
                size={24}
                color="#FF9800"
              />
              <View style={styles.caretakerInfoText}>
                <Text variant="titleSmall" style={styles.caretakerInfoTitle}>
                  Waiting for Assignment
                </Text>
                <Text variant="bodySmall" style={styles.caretakerInfoDesc}>
                  After joining, you'll see a "Waiting for Assignment" screen.
                  A manager or owner will assign you to a specific turf.
                </Text>
              </View>
            </View>
          )}

          {/* Join Button */}
          {company && (
            <Button
              mode="contained"
              onPress={handleJoinCompany}
              loading={loading}
              disabled={
                loading || (role === "manager" && selectedTurfs.length === 0)
              }
              style={styles.joinButton}
              contentStyle={styles.buttonContent}
              buttonColor={getRoleColor()}
            >
              {loading ? "Joining..." : "Join Company"}
            </Button>
          )}
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
    padding: 20,
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
    marginTop: 12,
  },
  title: {
    fontWeight: "bold",
    marginTop: 12,
    marginBottom: 8,
  },
  subtitle: {
    color: "#666",
    textAlign: "center",
  },
  codeContainer: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#fff",
  },
  codeInput: {
    backgroundColor: "#fff",
    fontSize: 18,
    letterSpacing: 2,
  },
  errorText: {
    color: "#F44336",
    marginTop: 8,
  },
  validateButton: {
    marginTop: 16,
    borderRadius: 8,
  },
  companyCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#fff",
    marginTop: 16,
  },
  companyHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  companyInfo: {
    flex: 1,
    marginLeft: 12,
  },
  companyName: {
    fontWeight: "bold",
  },
  companyStats: {
    color: "#666",
    marginTop: 2,
  },
  turfSection: {
    marginTop: 24,
  },
  sectionTitle: {
    fontWeight: "bold",
    marginBottom: 4,
  },
  sectionSubtitle: {
    color: "#666",
    marginBottom: 12,
  },
  emptyCard: {
    padding: 24,
    borderRadius: 16,
    backgroundColor: "#fff",
    alignItems: "center",
  },
  emptyText: {
    color: "#666",
    textAlign: "center",
    marginTop: 12,
  },
  turfCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#fff",
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "transparent",
  },
  turfCardSelected: {
    borderColor: "#2196F3",
    backgroundColor: "#E3F2FD",
  },
  turfInfo: {
    flex: 1,
  },
  turfName: {
    fontWeight: "600",
  },
  turfLocation: {
    color: "#666",
    marginTop: 2,
  },
  turfGrounds: {
    color: "#999",
    marginTop: 2,
  },
  caretakerInfo: {
    flexDirection: "row",
    backgroundColor: "#FFF3E0",
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  caretakerInfoText: {
    flex: 1,
    marginLeft: 12,
  },
  caretakerInfoTitle: {
    fontWeight: "600",
    color: "#E65100",
  },
  caretakerInfoDesc: {
    color: "#666",
    marginTop: 4,
    lineHeight: 18,
  },
  joinButton: {
    marginTop: 24,
    borderRadius: 8,
  },
  buttonContent: {
    height: 50,
  },
});
