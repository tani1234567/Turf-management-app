import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Text,
} from "react-native";
import {
  TextInput,
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

const BRAND_GREEN = "#16A34A";
const BRAND_DARK = "#14532D";
const PALE_GREEN = "#F0FDF4";
const DANGER_RED = "#EF4444";
const GRAY_TEXT = "#6B7280";

const ROLE_CONFIG = {
  manager: { color: "#3B82F6", icon: "briefcase", label: "Manager" },
  caretaker: { color: "#F97316", icon: "account-hard-hat", label: "Caretaker" },
};

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

  const roleConfig = ROLE_CONFIG[role] || ROLE_CONFIG.manager;

  const handleCodeChange = (text) => {
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
    if (role === "manager" && selectedTurfs.length === 0) {
      Alert.alert("Select Turfs", "Please select at least one turf to manage.");
      return;
    }

    setLoadingState(true);
    dispatch(setLoading(true));

    try {
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
        userData.assignedTurfId = null;
        userData.isAssigned = false;
      }

      await setDocument("users", userId, userData);

      if (role === "manager") {
        const updatedManagers = [...(company.managers || []), userId];
        await updateDocument("companies", company.id, { managers: updatedManagers });
        for (const turfId of selectedTurfs) {
          const turf = availableTurfs.find((t) => t.id === turfId);
          if (turf) {
            const updatedManagerIds = [...(turf.managerIds || []), userId];
            await updateDocument("turfs", turfId, { managerIds: updatedManagerIds });
          }
        }
      } else {
        const updatedCaretakers = [...(company.caretakers || []), userId];
        const updatedUnassigned = [...(company.unassignedCaretakers || []), userId];
        await updateDocument("companies", company.id, {
          caretakers: updatedCaretakers,
          unassignedCaretakers: updatedUnassigned,
        });
      }

      dispatch(setUser(userData));

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
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="arrow-left" size={22} color="#374151" />
          </TouchableOpacity>
          <View style={[styles.roleIconCircle, { backgroundColor: roleConfig.color + "18" }]}>
            <MaterialCommunityIcons name={roleConfig.icon} size={22} color={roleConfig.color} />
          </View>
          <Text style={styles.headerTitle}>{roleConfig.label}</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Page heading */}
          <Text style={styles.pageTitle}>Join a Company</Text>
          <Text style={styles.pageSubtitle}>
            Enter the invite code shared by your Turf Owner
          </Text>

          {/* Invite Code Card */}
          <Surface style={styles.codeCard} elevation={2}>
            {/* Accent bar */}
            <View style={styles.accentRow}>
              <View style={styles.accentBar} />
              <Text style={styles.accentLabel}>INVITE CODE</Text>
            </View>
            <Text style={styles.codeHint}>Paste or type your 8-character code</Text>

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
                inviteCode.length === 8 ? (
                  <TextInput.Icon
                    icon={company ? "check-circle" : "help-circle"}
                    color={company ? BRAND_GREEN : "#9CA3AF"}
                  />
                ) : null
              }
              outlineColor="#E5E7EB"
              activeOutlineColor={BRAND_GREEN}
              contentStyle={{
                fontFamily: "Ubuntu-Bold",
                fontSize: 18,
                letterSpacing: 4,
              }}
              style={styles.codeInput}
              error={!!error}
            />
            {error && (
              <View style={styles.errorCard}>
                <Text style={styles.errorCardText}>{error}</Text>
              </View>
            )}

            {!company && (
              <TouchableOpacity
                style={[
                  styles.validateBtn,
                  (validating || inviteCode.length !== 8) && styles.validateBtnDisabled,
                ]}
                onPress={handleValidateCode}
                disabled={validating || inviteCode.length !== 8}
                activeOpacity={0.8}
              >
                {validating ? (
                  <ActivityIndicator color={BRAND_GREEN} size="small" />
                ) : (
                  <Text style={styles.validateBtnText}>Validate Code</Text>
                )}
              </TouchableOpacity>
            )}
          </Surface>

          {/* Company reveal card */}
          {company && (
            <Surface style={styles.companyCard} elevation={1}>
              <View style={styles.companyRow}>
                <MaterialCommunityIcons name="check-circle" size={20} color={BRAND_GREEN} />
                <View style={styles.companyInfo}>
                  <Text style={styles.companyName}>{company.name}</Text>
                  <Text style={styles.companyMeta}>
                    Turfs: {company.stats?.totalTurfs || 0} · Team:{" "}
                    {(company.managers?.length || 0) + (company.caretakers?.length || 0)}
                  </Text>
                </View>
              </View>
            </Surface>
          )}

          {/* Turf Selection — Manager only */}
          {company && role === "manager" && (
            <View style={styles.turfSection}>
              <Text style={styles.turfSectionTitle}>Select Turfs to Manage</Text>
              <Text style={styles.turfSectionSub}>Owner can modify your assignments later</Text>

              {availableTurfs.length === 0 ? (
                <Surface style={styles.emptyCard} elevation={1}>
                  <MaterialCommunityIcons name="alert-circle-outline" size={32} color="#F97316" />
                  <Text style={styles.emptyText}>
                    No turfs available yet. The owner needs to add turfs first.
                  </Text>
                </Surface>
              ) : (
                availableTurfs.map((turf) => {
                  const selected = selectedTurfs.includes(turf.id);
                  return (
                    <TouchableOpacity
                      key={turf.id}
                      style={[styles.turfCard, selected && styles.turfCardSelected]}
                      onPress={() => toggleTurfSelection(turf.id)}
                      activeOpacity={0.75}
                    >
                      <View style={styles.turfInfo}>
                        <Text style={styles.turfName}>{turf.name}</Text>
                        <Text style={styles.turfLocation}>
                          {turf.location?.city || "Location not set"}
                        </Text>
                        <Text style={styles.turfGrounds}>
                          {turf.totalGrounds || turf.grounds?.length || 0} grounds
                        </Text>
                      </View>
                      {selected && (
                        <View style={styles.turfCheckBadge}>
                          <MaterialCommunityIcons name="check" size={12} color="#fff" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          )}

          {/* Caretaker info banner */}
          {company && role === "caretaker" && (
            <View style={styles.caretakerBanner}>
              <MaterialCommunityIcons name="information-outline" size={18} color={BRAND_DARK} />
              <Text style={styles.caretakerBannerText}>
                After joining, you'll see a "Waiting for Assignment" screen. A manager or owner will assign you to a specific turf.
              </Text>
            </View>
          )}

          {/* Join Button */}
          {company && (
            <TouchableOpacity
              style={[
                styles.joinButton,
                { backgroundColor: roleConfig.color },
                (loading || (role === "manager" && selectedTurfs.length === 0)) && styles.joinButtonDisabled,
              ]}
              onPress={handleJoinCompany}
              disabled={loading || (role === "manager" && selectedTurfs.length === 0)}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.joinButtonText}>Join Company</Text>
              )}
            </TouchableOpacity>
          )}
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
    paddingBottom: 8,
    gap: 12,
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
  roleIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 18,
    color: BRAND_DARK,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  pageTitle: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 22,
    color: BRAND_DARK,
    marginBottom: 4,
  },
  pageSubtitle: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 14,
    color: GRAY_TEXT,
    marginBottom: 20,
  },
  codeCard: {
    borderRadius: 16,
    backgroundColor: "#fff",
    padding: 16,
    marginBottom: 16,
  },
  accentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  accentBar: {
    width: 3,
    height: 16,
    backgroundColor: BRAND_GREEN,
    borderRadius: 2,
  },
  accentLabel: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 11,
    color: GRAY_TEXT,
    letterSpacing: 1,
  },
  codeHint: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 13,
    color: GRAY_TEXT,
    marginBottom: 12,
  },
  codeInput: {
    backgroundColor: "#fff",
  },
  errorCard: {
    borderLeftWidth: 4,
    borderLeftColor: DANGER_RED,
    backgroundColor: "#FEF2F2",
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  errorCardText: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 13,
    color: DANGER_RED,
  },
  validateBtn: {
    marginTop: 14,
    borderRadius: 10,
    height: 44,
    borderWidth: 1.5,
    borderColor: BRAND_GREEN,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  validateBtnDisabled: {
    opacity: 0.5,
  },
  validateBtnText: {
    fontFamily: "Ubuntu-Medium",
    fontSize: 14,
    color: BRAND_GREEN,
  },
  companyCard: {
    borderRadius: 14,
    backgroundColor: PALE_GREEN,
    borderLeftWidth: 4,
    borderLeftColor: BRAND_GREEN,
    padding: 14,
    marginBottom: 20,
  },
  companyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  companyInfo: {
    flex: 1,
  },
  companyName: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 15,
    color: BRAND_DARK,
  },
  companyMeta: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 12,
    color: GRAY_TEXT,
    marginTop: 2,
  },
  turfSection: {
    marginBottom: 20,
  },
  turfSectionTitle: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 16,
    color: BRAND_DARK,
    marginBottom: 2,
  },
  turfSectionSub: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 13,
    color: GRAY_TEXT,
    marginBottom: 12,
  },
  emptyCard: {
    padding: 24,
    borderRadius: 14,
    backgroundColor: "#fff",
    alignItems: "center",
  },
  emptyText: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 14,
    color: GRAY_TEXT,
    textAlign: "center",
    marginTop: 10,
    lineHeight: 20,
  },
  turfCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#fff",
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
  },
  turfCardSelected: {
    borderColor: BRAND_GREEN,
    backgroundColor: PALE_GREEN,
  },
  turfInfo: {
    flex: 1,
  },
  turfName: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 14,
    color: BRAND_DARK,
  },
  turfLocation: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 13,
    color: GRAY_TEXT,
    marginTop: 2,
  },
  turfGrounds: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 2,
  },
  turfCheckBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: BRAND_GREEN,
    justifyContent: "center",
    alignItems: "center",
  },
  caretakerBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: PALE_GREEN,
    borderRadius: 12,
    padding: 14,
    gap: 10,
    marginBottom: 20,
  },
  caretakerBannerText: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 13,
    color: BRAND_DARK,
    flex: 1,
    lineHeight: 18,
  },
  joinButton: {
    borderRadius: 12,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  joinButtonDisabled: {
    opacity: 0.5,
  },
  joinButtonText: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 15,
    color: "#fff",
  },
});
