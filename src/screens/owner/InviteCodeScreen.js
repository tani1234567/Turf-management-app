import React, { useState, useRef } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Share,
  TouchableOpacity,
  Platform,
} from "react-native";
import {
  Text,
  Surface,
  Button,
  IconButton,
  Divider,
  Dialog,
  Portal,
  ActivityIndicator,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSelector, useDispatch } from "react-redux";
import * as Clipboard from "expo-clipboard";

import { selectUser } from "../../store/slices/authSlice";
import {
  selectCompany,
  selectInviteCode,
  setInviteCode,
} from "../../store/slices/companySlice";
import {
  regenerateInviteCodeObject,
  formatCodeForDisplay,
  generateInviteLink,
} from "../../utils/inviteCodeUtils";
import { updateDocument, serverTimestamp, addDocument } from "../../services/firebase/firestore";

// Try to import QR code library (optional)
let QRCode = null;
try {
  QRCode = require("react-native-qrcode-svg").default;
} catch (e) {
  // QR code library not installed
}

const OWNER_COLOR = "#9C27B0";

export default function InviteCodeScreen({ navigation }) {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const company = useSelector(selectCompany);
  const inviteCode = useSelector(selectInviteCode);

  const [regenerateDialogVisible, setRegenerateDialogVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(null);

  const qrRef = useRef(null);

  const currentCode = inviteCode?.code || company?.inviteCode?.code || "--------";
  const currentLink = inviteCode?.link || company?.inviteCode?.link || generateInviteLink(currentCode);
  const displayCode = formatCodeForDisplay(currentCode);
  const companyId = company?.id || company?.companyId;

  // Get statistics
  const managersCount = company?.managers?.length || 0;
  const caretakersCount = (company?.caretakers?.length || 0) + (company?.unassignedCaretakers?.length || 0);
  const lastChangedAt = inviteCode?.lastChangedAt || company?.inviteCode?.lastChangedAt;

  const showCopyFeedback = (type) => {
    setCopyFeedback(type);
    setTimeout(() => setCopyFeedback(null), 2000);
  };

  const handleCopyCode = async () => {
    await Clipboard.setStringAsync(currentCode);
    showCopyFeedback("code");
  };

  const handleCopyLink = async () => {
    await Clipboard.setStringAsync(currentLink);
    showCopyFeedback("link");
  };

  const handleShare = async () => {
    try {
      const result = await Share.share({
        title: "Join My Team",
        message: `Join my turf management team at ${company?.name || "our company"}!\n\nInvite Code: ${currentCode}\n\nOr use this link: ${currentLink}`,
        url: currentLink,
      });

      if (result.action === Share.sharedAction) {
        // Log share action
        if (companyId && user?.userId) {
          await addDocument("owner_logs", {
            companyId,
            ownerId: user.userId,
            action: "invite_code_shared",
            code: currentCode,
            timestamp: serverTimestamp(),
          });
        }
      }
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const handleRegenerateCode = () => {
    setRegenerateDialogVisible(true);
  };

  const confirmRegenerateCode = async () => {
    setRegenerateDialogVisible(false);
    setLoading(true);

    try {
      // Generate new code
      const newCodeObject = regenerateInviteCodeObject(user?.userId);

      // Update Firestore
      if (companyId) {
        await updateDocument("companies", companyId, {
          "inviteCode.code": newCodeObject.code,
          "inviteCode.link": newCodeObject.link,
          "inviteCode.lastChangedAt": serverTimestamp(),
          "inviteCode.lastChangedBy": user?.userId || null,
        });

        // Log the action
        await addDocument("owner_logs", {
          companyId,
          ownerId: user?.userId || null,
          action: "invite_code_regenerated",
          oldCode: currentCode,
          newCode: newCodeObject.code,
          timestamp: serverTimestamp(),
        });
      }

      // Update Redux
      dispatch(setInviteCode(newCodeObject));

      Alert.alert(
        "Code Regenerated",
        "Your new invite code is ready. The old code is no longer valid.",
        [{ text: "OK" }]
      );
    } catch (error) {
      console.error("Error regenerating code:", error);
      Alert.alert("Error", "Failed to regenerate code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return "Never";
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton
          icon="arrow-left"
          size={24}
          onPress={() => navigation.goBack()}
        />
        <Text variant="titleLarge" style={styles.headerTitle}>
          Invite Code
        </Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Main Code Display */}
        <Surface style={styles.codeCard} elevation={2}>
          <Text variant="bodyMedium" style={styles.codeLabel}>
            Your Team Invite Code
          </Text>

          <View style={styles.codeDisplay}>
            <Text variant="displaySmall" style={styles.codeText}>
              {displayCode}
            </Text>
          </View>

          <View style={styles.codeActions}>
            <TouchableOpacity
              style={[
                styles.actionButton,
                copyFeedback === "code" && styles.actionButtonSuccess,
              ]}
              onPress={handleCopyCode}
            >
              <MaterialCommunityIcons
                name={copyFeedback === "code" ? "check" : "content-copy"}
                size={20}
                color={copyFeedback === "code" ? "#4CAF50" : OWNER_COLOR}
              />
              <Text
                variant="bodyMedium"
                style={[
                  styles.actionButtonText,
                  copyFeedback === "code" && styles.actionButtonTextSuccess,
                ]}
              >
                {copyFeedback === "code" ? "Copied!" : "Copy Code"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleShare}
            >
              <MaterialCommunityIcons
                name="share-variant"
                size={20}
                color={OWNER_COLOR}
              />
              <Text variant="bodyMedium" style={styles.actionButtonText}>
                Share
              </Text>
            </TouchableOpacity>
          </View>
        </Surface>

        {/* Invite Link */}
        <Surface style={styles.linkCard} elevation={1}>
          <Text variant="titleSmall" style={styles.sectionTitle}>
            Invite Link
          </Text>

          <View style={styles.linkContainer}>
            <MaterialCommunityIcons name="link" size={20} color="#666" />
            <Text
              variant="bodyMedium"
              style={styles.linkText}
              numberOfLines={1}
              ellipsizeMode="middle"
            >
              {currentLink}
            </Text>
          </View>

          <Button
            mode={copyFeedback === "link" ? "contained" : "outlined"}
            icon={copyFeedback === "link" ? "check" : "content-copy"}
            onPress={handleCopyLink}
            style={styles.copyLinkButton}
            buttonColor={copyFeedback === "link" ? "#4CAF50" : undefined}
          >
            {copyFeedback === "link" ? "Copied!" : "Copy Link"}
          </Button>
        </Surface>

        {/* QR Code Section */}
        <Surface style={styles.qrCard} elevation={1}>
          <Text variant="titleSmall" style={styles.sectionTitle}>
            QR Code
          </Text>
          <Text variant="bodySmall" style={styles.qrSubtitle}>
            Scan to join your team
          </Text>

          <View style={styles.qrContainer}>
            {QRCode ? (
              <QRCode
                value={currentLink}
                size={180}
                color="#000"
                backgroundColor="#fff"
                getRef={(ref) => (qrRef.current = ref)}
              />
            ) : (
              <View style={styles.qrPlaceholder}>
                <MaterialCommunityIcons name="qrcode" size={120} color="#ddd" />
                <Text variant="bodySmall" style={styles.qrPlaceholderText}>
                  Install react-native-qrcode-svg
                </Text>
                <Text variant="bodySmall" style={styles.qrPlaceholderText}>
                  to enable QR codes
                </Text>
              </View>
            )}
          </View>

          {QRCode && (
            <View style={styles.qrActions}>
              <Button
                mode="outlined"
                icon="download"
                onPress={() => {
                  Alert.alert("Coming Soon", "QR download will be available soon.");
                }}
                style={styles.qrButton}
              >
                Download
              </Button>
              <Button
                mode="outlined"
                icon="printer"
                onPress={() => {
                  Alert.alert("Coming Soon", "QR print will be available soon.");
                }}
                style={styles.qrButton}
              >
                Print
              </Button>
            </View>
          )}
        </Surface>

        {/* Statistics */}
        <Surface style={styles.statsCard} elevation={1}>
          <Text variant="titleSmall" style={styles.sectionTitle}>
            Statistics
          </Text>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <MaterialCommunityIcons
                name="account-tie"
                size={24}
                color="#2196F3"
              />
              <Text variant="headlineSmall" style={styles.statValue}>
                {managersCount}
              </Text>
              <Text variant="bodySmall" style={styles.statLabel}>
                Managers Joined
              </Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statItem}>
              <MaterialCommunityIcons
                name="account-hard-hat"
                size={24}
                color="#FF9800"
              />
              <Text variant="headlineSmall" style={styles.statValue}>
                {caretakersCount}
              </Text>
              <Text variant="bodySmall" style={styles.statLabel}>
                Caretakers Joined
              </Text>
            </View>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.lastChangedRow}>
            <MaterialCommunityIcons name="clock-outline" size={16} color="#666" />
            <Text variant="bodySmall" style={styles.lastChangedText}>
              Code last changed: {formatDate(lastChangedAt)}
            </Text>
          </View>
        </Surface>

        {/* Regenerate Code */}
        <Surface style={styles.regenerateCard} elevation={1}>
          <View style={styles.regenerateHeader}>
            <MaterialCommunityIcons name="refresh" size={24} color="#F44336" />
            <View style={styles.regenerateInfo}>
              <Text variant="titleSmall" style={styles.regenerateTitle}>
                Regenerate Code
              </Text>
              <Text variant="bodySmall" style={styles.regenerateSubtitle}>
                Create a new invite code and invalidate the current one
              </Text>
            </View>
          </View>

          <Button
            mode="outlined"
            icon="refresh"
            onPress={handleRegenerateCode}
            loading={loading}
            disabled={loading}
            textColor="#F44336"
            style={styles.regenerateButton}
          >
            Regenerate Code
          </Button>

          <View style={styles.warningBox}>
            <MaterialCommunityIcons
              name="alert-circle-outline"
              size={16}
              color="#FF9800"
            />
            <Text variant="bodySmall" style={styles.warningText}>
              Anyone with the old code won't be able to join after regeneration.
            </Text>
          </View>
        </Surface>

        {/* Instructions */}
        <Surface style={styles.instructionsCard} elevation={1}>
          <Text variant="titleSmall" style={styles.sectionTitle}>
            How to Invite Team Members
          </Text>

          <View style={styles.instructionSection}>
            <View style={styles.instructionHeader}>
              <MaterialCommunityIcons
                name="account-tie"
                size={20}
                color="#2196F3"
              />
              <Text variant="titleSmall" style={styles.instructionTitle}>
                Inviting Managers
              </Text>
            </View>
            <View style={styles.instructionSteps}>
              <Text variant="bodySmall" style={styles.stepText}>
                1. Share the invite code or link with your manager
              </Text>
              <Text variant="bodySmall" style={styles.stepText}>
                2. They select "Manager" role during registration
              </Text>
              <Text variant="bodySmall" style={styles.stepText}>
                3. They enter the invite code to join your company
              </Text>
              <Text variant="bodySmall" style={styles.stepText}>
                4. They select which turfs they'll manage
              </Text>
            </View>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.instructionSection}>
            <View style={styles.instructionHeader}>
              <MaterialCommunityIcons
                name="account-hard-hat"
                size={20}
                color="#FF9800"
              />
              <Text variant="titleSmall" style={styles.instructionTitle}>
                Inviting Caretakers
              </Text>
            </View>
            <View style={styles.instructionSteps}>
              <Text variant="bodySmall" style={styles.stepText}>
                1. Share the invite code or link with your caretaker
              </Text>
              <Text variant="bodySmall" style={styles.stepText}>
                2. They select "Caretaker" role during registration
              </Text>
              <Text variant="bodySmall" style={styles.stepText}>
                3. They enter the invite code to join your company
              </Text>
              <Text variant="bodySmall" style={styles.stepText}>
                4. A manager will assign them to a specific turf
              </Text>
            </View>
          </View>
        </Surface>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Regenerate Confirmation Dialog */}
      <Portal>
        <Dialog
          visible={regenerateDialogVisible}
          onDismiss={() => setRegenerateDialogVisible(false)}
        >
          <Dialog.Icon icon="alert" color="#F44336" />
          <Dialog.Title style={styles.dialogTitle}>
            Regenerate Invite Code?
          </Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={styles.dialogContent}>
              This will create a new invite code and immediately invalidate the
              current one.
            </Text>
            <Text variant="bodyMedium" style={styles.dialogWarning}>
              Anyone with the old code ({currentCode}) will no longer be able to
              join your team.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setRegenerateDialogVisible(false)}>
              Cancel
            </Button>
            <Button
              onPress={confirmRegenerateCode}
              textColor="#F44336"
              loading={loading}
            >
              Regenerate
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Loading Overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={OWNER_COLOR} />
        </View>
      )}
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
    justifyContent: "space-between",
    paddingRight: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  headerTitle: {
    fontWeight: "bold",
  },
  scrollContent: {
    padding: 16,
  },
  codeCard: {
    padding: 24,
    borderRadius: 16,
    backgroundColor: "#fff",
    alignItems: "center",
    marginBottom: 16,
  },
  codeLabel: {
    color: "#666",
    marginBottom: 8,
  },
  codeDisplay: {
    backgroundColor: "#F3E5F5",
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    marginVertical: 16,
  },
  codeText: {
    fontWeight: "bold",
    color: OWNER_COLOR,
    letterSpacing: 8,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  codeActions: {
    flexDirection: "row",
    gap: 16,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: OWNER_COLOR + "15",
    gap: 8,
  },
  actionButtonSuccess: {
    backgroundColor: "#4CAF50" + "15",
  },
  actionButtonText: {
    color: OWNER_COLOR,
    fontWeight: "600",
  },
  actionButtonTextSuccess: {
    color: "#4CAF50",
  },
  linkCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#fff",
    marginBottom: 16,
  },
  sectionTitle: {
    fontWeight: "bold",
    marginBottom: 12,
  },
  linkContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F0FF",
    padding: 12,
    borderRadius: 8,
    gap: 8,
    marginBottom: 12,
  },
  linkText: {
    flex: 1,
    color: "#666",
  },
  copyLinkButton: {
    borderRadius: 8,
  },
  qrCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#fff",
    alignItems: "center",
    marginBottom: 16,
  },
  qrSubtitle: {
    color: "#666",
    marginBottom: 16,
  },
  qrContainer: {
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#eee",
  },
  qrPlaceholder: {
    width: 180,
    height: 180,
    alignItems: "center",
    justifyContent: "center",
  },
  qrPlaceholderText: {
    color: "#999",
    fontSize: 11,
  },
  qrActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  qrButton: {
    flex: 1,
  },
  statsCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#fff",
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
  },
  statDivider: {
    width: 1,
    height: 60,
    backgroundColor: "#eee",
  },
  statValue: {
    fontWeight: "bold",
    marginVertical: 4,
  },
  statLabel: {
    color: "#666",
  },
  divider: {
    marginVertical: 16,
  },
  lastChangedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  lastChangedText: {
    color: "#666",
  },
  regenerateCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#fff",
    marginBottom: 16,
  },
  regenerateHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 16,
  },
  regenerateInfo: {
    flex: 1,
  },
  regenerateTitle: {
    fontWeight: "bold",
    color: "#F44336",
  },
  regenerateSubtitle: {
    color: "#666",
    marginTop: 2,
  },
  regenerateButton: {
    borderColor: "#F44336",
    marginBottom: 12,
  },
  warningBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFF3E0",
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  warningText: {
    flex: 1,
    color: "#E65100",
    lineHeight: 18,
  },
  instructionsCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#fff",
    marginBottom: 16,
  },
  instructionSection: {
    marginBottom: 8,
  },
  instructionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  instructionTitle: {
    fontWeight: "600",
  },
  instructionSteps: {
    marginLeft: 28,
  },
  stepText: {
    color: "#666",
    lineHeight: 22,
  },
  bottomPadding: {
    height: 32,
  },
  dialogTitle: {
    textAlign: "center",
  },
  dialogContent: {
    textAlign: "center",
    marginBottom: 8,
  },
  dialogWarning: {
    textAlign: "center",
    color: "#F44336",
    fontWeight: "500",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
});
