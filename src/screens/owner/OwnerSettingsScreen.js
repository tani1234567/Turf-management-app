import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Share,
} from "react-native";
import {
  Text,
  Surface,
  List,
  Divider,
  Button,
  Dialog,
  Portal,
  TextInput,
  Avatar,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSelector, useDispatch } from "react-redux";
import * as Clipboard from "expo-clipboard";

import { selectUser } from "../../store/slices/authSlice";
import { useAuth } from "../../hooks/useAuth";
import {
  selectCompany,
  selectInviteCode,
  selectSubscriptionStatus,
  setInviteCode,
} from "../../store/slices/companySlice";
import {
  regenerateInviteCodeObject,
  formatCodeForDisplay,
  generateInviteLink,
} from "../../utils/inviteCodeUtils";

const OWNER_COLOR = "#9C27B0";

export default function OwnerSettingsScreen({ navigation }) {
  const dispatch = useDispatch();
  const { logout } = useAuth();
  const user = useSelector(selectUser);
  const company = useSelector(selectCompany);
  const inviteCode = useSelector(selectInviteCode);
  const subscriptionStatus = useSelector(selectSubscriptionStatus);

  const [regenerateDialogVisible, setRegenerateDialogVisible] = useState(false);
  const [editCompanyDialogVisible, setEditCompanyDialogVisible] = useState(false);
  const [companyName, setCompanyName] = useState(company?.name || "");

  const handleCopyInviteCode = async () => {
    const code = inviteCode?.code || "DEMO1234";
    await Clipboard.setStringAsync(code);
    Alert.alert("Copied!", "Invite code copied to clipboard.");
  };

  const handleShareInviteCode = async () => {
    const code = inviteCode?.code || "DEMO1234";
    const link = inviteCode?.link || generateInviteLink(code);
    try {
      await Share.share({
        message: `Join my turf management team!\n\nInvite Code: ${code}\n\nOr use this link: ${link}`,
        title: "Join My Team",
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const handleRegenerateCode = () => {
    setRegenerateDialogVisible(true);
  };

  const confirmRegenerateCode = async () => {
    setRegenerateDialogVisible(false);
    // Generate new code
    const newCodeObject = regenerateInviteCodeObject(user?.userId);
    dispatch(setInviteCode(newCodeObject));
    // TODO: Update Firestore
    Alert.alert("Code Regenerated", "Your new invite code is ready to share.");
  };

  const handleUpdateCompanyName = async () => {
    if (!companyName.trim()) {
      Alert.alert("Error", "Company name cannot be empty.");
      return;
    }
    setEditCompanyDialogVisible(false);
    // TODO: Update Firestore
    Alert.alert("Updated", "Company name has been updated.");
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          try {
            await logout();
          } catch (error) {
            console.error("Logout error:", error);
            Alert.alert("Error", "Failed to logout. Please try again.");
          }
        },
      },
    ]);
  };

  const displayCode = formatCodeForDisplay(inviteCode?.code || "DEMO1234");

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <Text variant="headlineSmall" style={styles.title}>
            Settings
          </Text>
        </View>

        {/* Profile Section */}
        <Surface style={styles.section} elevation={1}>
          <View style={styles.profileHeader}>
            <Avatar.Text
              size={64}
              label={user?.name?.substring(0, 2).toUpperCase() || "OW"}
              style={{ backgroundColor: OWNER_COLOR }}
            />
            <View style={styles.profileInfo}>
              <Text variant="titleLarge" style={styles.profileName}>
                {user?.name || "Owner Name"}
              </Text>
              <Text variant="bodyMedium" style={styles.profileRole}>
                Turf Owner
              </Text>
              <Text variant="bodySmall" style={styles.profilePhone}>
                {user?.phone || "+91 98765 43210"}
              </Text>
            </View>
          </View>
          <Button
            mode="outlined"
            onPress={() => {
              // TODO: Navigate to edit profile
            }}
            style={styles.editButton}
          >
            Edit Profile
          </Button>
        </Surface>

        {/* Company Section */}
        <Surface style={styles.section} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Company
          </Text>
          <TouchableOpacity
            style={styles.companyRow}
            onPress={() => setEditCompanyDialogVisible(true)}
          >
            <MaterialCommunityIcons name="office-building" size={24} color={OWNER_COLOR} />
            <View style={styles.companyInfo}>
              <Text variant="titleSmall">{company?.name || "My Turf Company"}</Text>
              <Text variant="bodySmall" style={styles.companySubtext}>
                Tap to edit company details
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color="#999" />
          </TouchableOpacity>
        </Surface>

        {/* Invite Code Section */}
        <Surface style={styles.section} elevation={1}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Invite Code
              </Text>
              <Text variant="bodySmall" style={styles.sectionSubtitle}>
                Share this code with managers and caretakers
              </Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate("InviteCode")}>
              <Text variant="bodySmall" style={styles.viewAllLink}>
                View All
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.codeContainer}
            onPress={() => navigation.navigate("InviteCode")}
            activeOpacity={0.7}
          >
            <Text variant="headlineMedium" style={styles.codeText}>
              {displayCode}
            </Text>
            <MaterialCommunityIcons name="chevron-right" size={24} color={OWNER_COLOR} />
          </TouchableOpacity>

          <View style={styles.codeActions}>
            <Button
              mode="contained"
              icon="content-copy"
              onPress={handleCopyInviteCode}
              style={styles.codeButton}
              buttonColor={OWNER_COLOR}
            >
              Copy
            </Button>
            <Button
              mode="contained"
              icon="share-variant"
              onPress={handleShareInviteCode}
              style={styles.codeButton}
              buttonColor="#4CAF50"
            >
              Share
            </Button>
          </View>
        </Surface>

        {/* Subscription Section */}
        <Surface style={styles.section} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Subscription
          </Text>
          <View style={styles.subscriptionRow}>
            <View style={styles.subscriptionInfo}>
              <Text variant="titleSmall">
                {subscriptionStatus === "trial" ? "Free Trial" : "Active Plan"}
              </Text>
              <Text variant="bodySmall" style={styles.subscriptionSubtext}>
                {subscriptionStatus === "trial"
                  ? "14 days remaining"
                  : "Your subscription is active"}
              </Text>
            </View>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor:
                    subscriptionStatus === "active" ? "#E8F5E9" : "#FFF3E0",
                },
              ]}
            >
              <Text
                style={{
                  color: subscriptionStatus === "active" ? "#4CAF50" : "#FF9800",
                  fontSize: 12,
                  fontWeight: "600",
                }}
              >
                {subscriptionStatus === "active" ? "Active" : "Trial"}
              </Text>
            </View>
          </View>
          <Button
            mode="outlined"
            onPress={() => {
              // TODO: Navigate to subscription management
            }}
            style={styles.subscriptionButton}
          >
            Manage Subscription
          </Button>
        </Surface>

        {/* Permissions Section */}
        <Surface style={styles.section} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Permissions
          </Text>
          <TouchableOpacity
            style={styles.permissionRow}
            onPress={() => navigation.navigate("OperationalSettings")}
          >
            <View style={styles.permissionInfo}>
              <Text variant="titleSmall">Operational Permissions</Text>
              <Text variant="bodySmall" style={styles.permissionSubtext}>
                {user?.hasOperationalPermissions
                  ? "Enabled - You can perform manager tasks"
                  : "Disabled - View-only mode"}
              </Text>
            </View>
            <View style={styles.permissionStatus}>
              <View
                style={[
                  styles.permissionBadge,
                  {
                    backgroundColor: user?.hasOperationalPermissions ? "#E8F5E9" : "#FFEBEE",
                  },
                ]}
              >
                <Text
                  style={{
                    color: user?.hasOperationalPermissions ? "#4CAF50" : "#F44336",
                    fontSize: 11,
                    fontWeight: "600",
                  }}
                >
                  {user?.hasOperationalPermissions ? "ON" : "OFF"}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color="#999" />
            </View>
          </TouchableOpacity>
        </Surface>

        {/* Other Settings */}
        <Surface style={styles.section} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Other
          </Text>
          <List.Item
            title="Notifications"
            description="Configure notification preferences"
            left={(props) => <List.Icon {...props} icon="bell-outline" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => {
              // TODO: Navigate to notifications settings
            }}
          />
          <Divider />
          <List.Item
            title="Help & Support"
            description="FAQ, contact support"
            left={(props) => <List.Icon {...props} icon="help-circle-outline" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => {
              // TODO: Navigate to help
            }}
          />
          <Divider />
          <List.Item
            title="About"
            description="App version, terms, privacy"
            left={(props) => <List.Icon {...props} icon="information-outline" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => {
              // TODO: Navigate to about
            }}
          />
        </Surface>

        {/* Logout Button */}
        <Button
          mode="outlined"
          onPress={handleLogout}
          style={styles.logoutButton}
          textColor="#F44336"
          icon="logout"
        >
          Logout
        </Button>

        <View style={styles.footer}>
          <Text variant="bodySmall" style={styles.footerText}>
            Turf Management System v2.0
          </Text>
        </View>
      </ScrollView>

      {/* Regenerate Code Dialog */}
      <Portal>
        <Dialog
          visible={regenerateDialogVisible}
          onDismiss={() => setRegenerateDialogVisible(false)}
        >
          <Dialog.Title>Regenerate Invite Code?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              This will create a new invite code and invalidate the current one. Team
              members who haven't joined yet will need the new code.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setRegenerateDialogVisible(false)}>Cancel</Button>
            <Button onPress={confirmRegenerateCode} textColor="#F44336">
              Regenerate
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Edit Company Dialog */}
      <Portal>
        <Dialog
          visible={editCompanyDialogVisible}
          onDismiss={() => setEditCompanyDialogVisible(false)}
        >
          <Dialog.Title>Edit Company</Dialog.Title>
          <Dialog.Content>
            <TextInput
              mode="outlined"
              label="Company Name"
              value={companyName}
              onChangeText={setCompanyName}
              style={styles.dialogInput}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setEditCompanyDialogVisible(false)}>Cancel</Button>
            <Button onPress={handleUpdateCompanyName}>Save</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    padding: 16,
    paddingBottom: 8,
  },
  title: {
    fontWeight: "bold",
  },
  section: {
    margin: 16,
    marginTop: 0,
    marginBottom: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#fff",
  },
  sectionTitle: {
    fontWeight: "bold",
    marginBottom: 4,
  },
  sectionSubtitle: {
    color: "#666",
    marginBottom: 12,
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  profileInfo: {
    marginLeft: 16,
    flex: 1,
  },
  profileName: {
    fontWeight: "bold",
  },
  profileRole: {
    color: OWNER_COLOR,
    fontWeight: "500",
  },
  profilePhone: {
    color: "#666",
    marginTop: 2,
  },
  editButton: {
    borderRadius: 8,
  },
  companyRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  companyInfo: {
    flex: 1,
    marginLeft: 12,
  },
  companySubtext: {
    color: "#666",
    marginTop: 2,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  viewAllLink: {
    color: OWNER_COLOR,
    fontWeight: "600",
  },
  codeContainer: {
    backgroundColor: "#F3E5F5",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginVertical: 12,
    flexDirection: "row",
    justifyContent: "center",
  },
  codeText: {
    fontWeight: "bold",
    color: OWNER_COLOR,
    letterSpacing: 4,
    flex: 1,
    textAlign: "center",
  },
  codeActions: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 8,
  },
  codeButton: {
    marginHorizontal: 8,
    borderRadius: 8,
  },
  warningText: {
    color: "#999",
    textAlign: "center",
    marginTop: 4,
  },
  subscriptionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 12,
  },
  subscriptionInfo: {
    flex: 1,
  },
  subscriptionSubtext: {
    color: "#666",
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  subscriptionButton: {
    borderRadius: 8,
  },
  permissionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  permissionInfo: {
    flex: 1,
    marginRight: 12,
  },
  permissionSubtext: {
    color: "#666",
    marginTop: 4,
    lineHeight: 18,
  },
  permissionStatus: {
    flexDirection: "row",
    alignItems: "center",
  },
  permissionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  logoutButton: {
    margin: 16,
    marginTop: 8,
    borderRadius: 8,
    borderColor: "#F44336",
  },
  footer: {
    alignItems: "center",
    paddingVertical: 24,
  },
  footerText: {
    color: "#999",
  },
  dialogInput: {
    backgroundColor: "#fff",
  },
});
