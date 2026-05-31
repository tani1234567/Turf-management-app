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
  Divider,
  Dialog,
  Portal,
  TextInput,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSelector, useDispatch } from "react-redux";
import * as Clipboard from "expo-clipboard";

import { selectUser, updateUserProfile } from "../../store/slices/authSlice";
import { useAuth } from "../../hooks/useAuth";
import { updateDocument } from "../../services/firebase/firestore";
import {
  selectCompany,
  selectInviteCode,
  selectSubscription,
  selectSubscriptionStatus,
  setInviteCode,
} from "../../store/slices/companySlice";
import {
  regenerateInviteCodeObject,
  formatCodeForDisplay,
  generateInviteLink,
} from "../../utils/inviteCodeUtils";

const OWNER_PURPLE = "#9C27B0";
const PALE_PURPLE  = "#F3E5F5";
const NAVY_PURPLE  = "#4A148C";
const SUCCESS_GREEN = "#22C55E";
const WARN_ORANGE  = "#F59E0B";
const DANGER_RED   = "#EF4444";

// Settings sections
const SETTINGS_SECTIONS = [
  {
    title: "Company",
    items: [
      { id: "company",    icon: "office-building",          label: "Company Details",       color: OWNER_PURPLE  },
      { id: "inviteCode", icon: "account-key",              label: "Invite Codes",          color: "#3B82F6"     },
      { id: "payments",   icon: "credit-card-settings",     label: "Payment Settings",      color: "#10B981"     },
      { id: "ops",        icon: "shield-account",           label: "Operational Permissions", color: "#8B5CF6"   },
    ],
  },
  {
    title: "Business",
    items: [
      { id: "turfs",      icon: "soccer-field",             label: "Turf Management",       color: "#4CAF50"     },
      { id: "holiday",    icon: "calendar-star",            label: "Holiday Schedule",       color: "#10B981"     },
      { id: "team",       icon: "account-group",            label: "Team Management",       color: WARN_ORANGE   },
      { id: "sub",        icon: "credit-card",              label: "Subscription",          color: "#F97316"     },
      { id: "analytics",  icon: "chart-bar",                label: "Analytics",             color: "#3B82F6"     },
      { id: "coupons",    icon: "tag-multiple-outline",     label: "Offers & Coupons",      color: "#10B981"     },
      { id: "phonebook",  icon: "book-account",             label: "Customer Directory",     color: "#10B981"     },
    ],
  },
  {
    title: "Support",
    items: [
      { id: "notifications", icon: "bell",                  label: "Notifications",         color: WARN_ORANGE   },
      { id: "help",          icon: "help-circle",           label: "Help & Support",        color: "#00BCD4"     },
      { id: "about",         icon: "information",           label: "About",                 color: "#607D8B"     },
    ],
  },
];

export default function OwnerSettingsScreen({ navigation }) {
  const dispatch = useDispatch();
  const { logout } = useAuth();
  const user = useSelector(selectUser);
  const company = useSelector(selectCompany);
  const inviteCode = useSelector(selectInviteCode);
  const subscriptionStatus = useSelector(selectSubscriptionStatus);
  const subscription = useSelector(selectSubscription);

  const getDaysRemaining = (dateValue) => {
    if (!dateValue) return null;
    const endDate = dateValue?.toDate ? dateValue.toDate() : new Date(dateValue);
    if (isNaN(endDate.getTime())) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);
    return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

  const subscriptionDaysLeft = getDaysRemaining(subscription?.subscriptionEndDate);
  const trialDaysLeft = getDaysRemaining(subscription?.trialEndDate);
  const graceDaysLeft = getDaysRemaining(subscription?.gracePeriodEndDate);

  const formatDateDisplay = (dateValue) => {
    if (!dateValue) return "";
    const d = dateValue?.toDate ? dateValue.toDate() : new Date(dateValue);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  };

  const [regenerateDialogVisible, setRegenerateDialogVisible] = useState(false);
  const [editCompanyDialogVisible, setEditCompanyDialogVisible] = useState(false);
  const [companyName, setCompanyName] = useState(company?.name || "");

  const [editProfileDialogVisible, setEditProfileDialogVisible] = useState(false);
  const [editName, setEditName] = useState(user?.name || "");
  const [editEmail, setEditEmail] = useState(user?.email || "");
  const [savingProfile, setSavingProfile] = useState(false);

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

  const confirmRegenerateCode = async () => {
    setRegenerateDialogVisible(false);
    const newCodeObject = regenerateInviteCodeObject(user?.userId);
    dispatch(setInviteCode(newCodeObject));
    Alert.alert("Code Regenerated", "Your new invite code is ready to share.");
  };

  const handleUpdateProfile = async () => {
    if (!editName.trim()) {
      Alert.alert("Error", "Name cannot be empty.");
      return;
    }
    const userId = user?.userId || user?.uid;
    if (!userId) {
      Alert.alert("Error", "User session expired. Please log in again.");
      return;
    }
    setSavingProfile(true);
    try {
      const updates = { name: editName.trim() };
      if (editEmail.trim()) updates.email = editEmail.trim();
      await updateDocument("users", userId, updates);
      dispatch(updateUserProfile(updates));
      setEditProfileDialogVisible(false);
      Alert.alert("Updated", "Your profile has been updated.");
    } catch (error) {
      console.error("Error updating profile:", error);
      Alert.alert("Error", "Failed to update profile. Please try again.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUpdateCompanyName = async () => {
    if (!companyName.trim()) {
      Alert.alert("Error", "Company name cannot be empty.");
      return;
    }
    const companyId = company?.id || company?.companyId;
    if (!companyId) return;
    try {
      await updateDocument("companies", companyId, { name: companyName.trim() });
      setEditCompanyDialogVisible(false);
      Alert.alert("Updated", "Company name has been updated.");
    } catch (error) {
      console.error("Error updating company:", error);
      Alert.alert("Error", "Failed to update company name.");
    }
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

  const handleMenuPress = (itemId) => {
    switch (itemId) {
      case "company":       setEditCompanyDialogVisible(true); break;
      case "inviteCode":    navigation.navigate("InviteCode"); break;
      case "payments":      navigation.navigate("PaymentSettings"); break;
      case "ops":           navigation.navigate("OperationalSettings"); break;
      case "turfs":         navigation.navigate("Turfs"); break;
      case "holiday":       navigation.navigate("TurfSelection", { nextScreen: "HolidaySchedule" }); break;
      case "team":          navigation.navigate("Team"); break;
      case "sub":           navigation.navigate("SubscriptionPayment"); break;
      case "analytics":     navigation.navigate("OwnerAnalyticsDashboard"); break;
      case "coupons":       navigation.navigate("CompanyCouponToggle"); break;
      case "phonebook":     navigation.navigate("CustomerPhonebook"); break;
      case "notifications": break;
      case "help":          break;
      case "about":         break;
      default:              break;
    }
  };

  const displayCode = formatCodeForDisplay(inviteCode?.code || "DEMO1234");

  const getSubStatusColor = () => {
    switch (subscriptionStatus) {
      case "active":       return SUCCESS_GREEN;
      case "trial":        return "#3B82F6";
      case "grace_period": return WARN_ORANGE;
      case "expired":      return DANGER_RED;
      default:             return "#9CA3AF";
    }
  };

  const MenuItem = ({ item }) => (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={() => handleMenuPress(item.id)}
      activeOpacity={0.7}
    >
      <View style={[styles.menuIconContainer, { backgroundColor: `${item.color}18` }]}>
        <MaterialCommunityIcons name={item.icon} size={20} color={item.color} />
      </View>
      <Text style={styles.menuLabel}>{item.label}</Text>
      <MaterialCommunityIcons name="chevron-right" size={18} color="#D1D5DB" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
        </View>

        {/* Profile Card */}
        <Surface style={styles.profileCard} elevation={2}>
          <View style={styles.profileBanner}>
            <View style={styles.avatarContainer}>
              <Text style={styles.avatarInitials}>
                {user?.name?.substring(0, 2).toUpperCase() || "OW"}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{user?.name || "Owner Name"}</Text>
              <View style={styles.rolePill}>
                <Text style={styles.rolePillText}>Turf Owner</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.editProfileBtn}
              onPress={() => {
                setEditName(user?.name || "");
                setEditEmail(user?.email || "");
                setEditProfileDialogVisible(true);
              }}
            >
              <MaterialCommunityIcons name="pencil-outline" size={18} color={OWNER_PURPLE} />
            </TouchableOpacity>
          </View>
          {user?.phone && (
            <View style={styles.profilePhoneRow}>
              <MaterialCommunityIcons name="phone-outline" size={14} color="#9CA3AF" />
              <Text style={styles.profilePhone}>{user.phone}</Text>
            </View>
          )}
        </Surface>

        {/* Invite Code Box */}
        <View style={styles.sectionTitleRow}>
          <View style={styles.sectionTitleAccent} />
          <Text style={styles.sectionTitle}>INVITE CODE</Text>
        </View>

        <Surface style={styles.inviteCard} elevation={2}>
          <Text style={styles.inviteSubtitle}>Share with managers &amp; caretakers to join your team</Text>
          <View style={styles.codeBox}>
            <Text style={styles.codeText}>{displayCode}</Text>
          </View>
          <View style={styles.codeActions}>
            <TouchableOpacity style={styles.codeActionBtn} onPress={handleCopyInviteCode}>
              <MaterialCommunityIcons name="content-copy" size={18} color={OWNER_PURPLE} />
              <Text style={[styles.codeActionText, { color: OWNER_PURPLE }]}>Copy</Text>
            </TouchableOpacity>
            <View style={styles.codeActionDivider} />
            <TouchableOpacity style={styles.codeActionBtn} onPress={handleShareInviteCode}>
              <MaterialCommunityIcons name="share-variant" size={18} color={SUCCESS_GREEN} />
              <Text style={[styles.codeActionText, { color: SUCCESS_GREEN }]}>Share</Text>
            </TouchableOpacity>
            <View style={styles.codeActionDivider} />
            <TouchableOpacity
              style={styles.codeActionBtn}
              onPress={() => navigation.navigate("InviteCode")}
            >
              <MaterialCommunityIcons name="arrow-right-circle-outline" size={18} color="#6B7280" />
              <Text style={[styles.codeActionText, { color: "#6B7280" }]}>Manage</Text>
            </TouchableOpacity>
          </View>
        </Surface>

        {/* Subscription */}
        <View style={styles.sectionTitleRow}>
          <View style={styles.sectionTitleAccent} />
          <Text style={styles.sectionTitle}>SUBSCRIPTION</Text>
        </View>

        <Surface style={styles.subCard} elevation={2}>
          <View style={styles.subRow}>
            <View style={{ flex: 1 }}>
              {subscriptionStatus === "trial" && (
                <>
                  <Text style={styles.subStatusLabel}>Free Trial</Text>
                  <Text style={styles.subStatusDetail}>
                    {trialDaysLeft !== null && trialDaysLeft >= 0
                      ? `${trialDaysLeft} day${trialDaysLeft !== 1 ? "s" : ""} remaining`
                      : "Trial period"}
                  </Text>
                </>
              )}
              {subscriptionStatus === "active" && (
                <>
                  <Text style={styles.subStatusLabel}>Active Plan</Text>
                  <Text style={styles.subStatusDetail}>
                    {subscriptionDaysLeft !== null
                      ? subscriptionDaysLeft <= 7
                        ? `Expires in ${subscriptionDaysLeft} day${subscriptionDaysLeft !== 1 ? "s" : ""}`
                        : `Expires ${formatDateDisplay(subscription?.subscriptionEndDate)}`
                      : "Your subscription is active"}
                  </Text>
                </>
              )}
              {subscriptionStatus === "grace_period" && (
                <>
                  <Text style={[styles.subStatusLabel, { color: WARN_ORANGE }]}>Grace Period</Text>
                  <Text style={[styles.subStatusDetail, { color: "#B45309" }]}>
                    {graceDaysLeft !== null && graceDaysLeft >= 0
                      ? `${graceDaysLeft} day${graceDaysLeft !== 1 ? "s" : ""} left to renew`
                      : "Renew now to keep turfs active"}
                  </Text>
                </>
              )}
              {subscriptionStatus === "expired" && (
                <>
                  <Text style={[styles.subStatusLabel, { color: DANGER_RED }]}>Expired</Text>
                  <Text style={[styles.subStatusDetail, { color: DANGER_RED }]}>
                    Turfs deactivated — renew to reactivate
                  </Text>
                </>
              )}
            </View>
            <View style={[styles.subPill, { backgroundColor: `${getSubStatusColor()}20` }]}>
              <Text style={[styles.subPillText, { color: getSubStatusColor() }]}>
                {subscriptionStatus === "active" ? "Active"
                  : subscriptionStatus === "trial" ? "Trial"
                  : subscriptionStatus === "grace_period" ? "Grace"
                  : "Expired"}
              </Text>
            </View>
          </View>

          {subscriptionStatus === "grace_period" && (
            <View style={styles.subWarningBanner}>
              <MaterialCommunityIcons name="alert-circle" size={18} color={WARN_ORANGE} />
              <Text style={styles.subWarningText}>
                {graceDaysLeft !== null && graceDaysLeft >= 0
                  ? `${graceDaysLeft} day${graceDaysLeft !== 1 ? "s" : ""} to renew before turfs are deactivated.`
                  : "Renew immediately to avoid deactivation."}
              </Text>
            </View>
          )}

          {subscriptionStatus === "expired" && (
            <View style={styles.subErrorBanner}>
              <MaterialCommunityIcons name="close-circle" size={18} color={DANGER_RED} />
              <Text style={styles.subErrorText}>
                Turfs are no longer visible to users. Renew to reactivate.
              </Text>
            </View>
          )}

          {subscriptionStatus === "active" && subscriptionDaysLeft !== null && subscriptionDaysLeft <= 7 && subscriptionDaysLeft >= 0 && (
            <View style={styles.subWarningBanner}>
              <MaterialCommunityIcons name="clock-alert-outline" size={18} color={WARN_ORANGE} />
              <Text style={styles.subWarningText}>Renew soon to avoid service disruption.</Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.subActionBtn,
              (subscriptionStatus === "expired" || subscriptionStatus === "grace_period")
                ? { backgroundColor: DANGER_RED }
                : { backgroundColor: OWNER_PURPLE },
            ]}
            onPress={() => navigation.navigate("SubscriptionPayment")}
          >
            <MaterialCommunityIcons
              name={subscriptionStatus === "expired" || subscriptionStatus === "grace_period" ? "refresh" : "credit-card"}
              size={16}
              color="#fff"
            />
            <Text style={styles.subActionBtnText}>
              {subscriptionStatus === "expired" || subscriptionStatus === "grace_period"
                ? "Renew Subscription"
                : "Manage Subscription"}
            </Text>
          </TouchableOpacity>
        </Surface>

        {/* Settings Sections */}
        {SETTINGS_SECTIONS.map((section) => (
          <View key={section.title}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionTitleAccent} />
              <Text style={styles.sectionTitle}>{section.title.toUpperCase()}</Text>
            </View>
            <Surface style={styles.menuCard} elevation={2}>
              {section.items.map((item, index) => (
                <React.Fragment key={item.id}>
                  <MenuItem item={item} />
                  {index < section.items.length - 1 && (
                    <Divider style={styles.divider} />
                  )}
                </React.Fragment>
              ))}
            </Surface>
          </View>
        ))}

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <MaterialCommunityIcons name="logout" size={18} color={DANGER_RED} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Turf Management System v2.0</Text>
      </ScrollView>

      {/* Edit Profile Dialog */}
      <Portal>
        <Dialog visible={editProfileDialogVisible} onDismiss={() => setEditProfileDialogVisible(false)}>
          <Dialog.Title>Edit Profile</Dialog.Title>
          <Dialog.Content>
            <TextInput
              mode="outlined"
              label="Full Name"
              value={editName}
              onChangeText={setEditName}
              style={styles.dialogInput}
              autoCapitalize="words"
            />
            <TextInput
              mode="outlined"
              label="Email (optional)"
              value={editEmail}
              onChangeText={setEditEmail}
              style={[styles.dialogInput, { marginTop: 12 }]}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </Dialog.Content>
          <Dialog.Actions>
            <TouchableOpacity onPress={() => setEditProfileDialogVisible(false)} style={styles.dialogBtn}>
              <Text style={styles.dialogBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleUpdateProfile} style={styles.dialogBtn} disabled={savingProfile}>
              <Text style={[styles.dialogBtnText, { color: OWNER_PURPLE }]}>
                {savingProfile ? "Saving..." : "Save"}
              </Text>
            </TouchableOpacity>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Regenerate Code Dialog */}
      <Portal>
        <Dialog visible={regenerateDialogVisible} onDismiss={() => setRegenerateDialogVisible(false)}>
          <Dialog.Title>Regenerate Invite Code?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              This will create a new invite code and invalidate the current one. Team members who
              haven't joined yet will need the new code.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <TouchableOpacity onPress={() => setRegenerateDialogVisible(false)} style={styles.dialogBtn}>
              <Text style={styles.dialogBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={confirmRegenerateCode} style={styles.dialogBtn}>
              <Text style={[styles.dialogBtnText, { color: DANGER_RED }]}>Regenerate</Text>
            </TouchableOpacity>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Edit Company Dialog */}
      <Portal>
        <Dialog visible={editCompanyDialogVisible} onDismiss={() => setEditCompanyDialogVisible(false)}>
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
            <TouchableOpacity onPress={() => setEditCompanyDialogVisible(false)} style={styles.dialogBtn}>
              <Text style={styles.dialogBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleUpdateCompanyName} style={styles.dialogBtn}>
              <Text style={[styles.dialogBtnText, { color: OWNER_PURPLE }]}>Save</Text>
            </TouchableOpacity>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F0FF",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },

  // Header
  header: {
    marginBottom: 16,
    paddingTop: 4,
  },
  title: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 26,
    color: NAVY_PURPLE,
    letterSpacing: -0.3,
  },

  // Profile Card
  profileCard: {
    borderRadius: 16,
    backgroundColor: "#fff",
    marginBottom: 24,
    overflow: "hidden",
  },
  profileBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    paddingBottom: 14,
    backgroundColor: PALE_PURPLE,
    gap: 12,
  },
  avatarContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: `${OWNER_PURPLE}40`,
  },
  avatarInitials: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 18,
    color: OWNER_PURPLE,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 16,
    color: NAVY_PURPLE,
  },
  rolePill: {
    marginTop: 4,
    backgroundColor: `${OWNER_PURPLE}20`,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  rolePillText: {
    fontSize: 11,
    fontFamily: "Ubuntu-Medium",
    color: OWNER_PURPLE,
  },
  editProfileBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  profilePhoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  profilePhone: {
    fontSize: 13,
    color: "#6B7280",
    fontFamily: "Ubuntu-Regular",
  },

  // Section title
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    marginLeft: 2,
    gap: 8,
  },
  sectionTitleAccent: {
    width: 3,
    height: 14,
    borderRadius: 2,
    backgroundColor: OWNER_PURPLE,
  },
  sectionTitle: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 11,
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  // Invite Code Card
  inviteCard: {
    borderRadius: 14,
    backgroundColor: "#fff",
    marginBottom: 24,
    padding: 16,
    overflow: "hidden",
  },
  inviteSubtitle: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 12,
  },
  codeBox: {
    backgroundColor: PALE_PURPLE,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 14,
  },
  codeText: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 28,
    color: OWNER_PURPLE,
    letterSpacing: 6,
  },
  codeActions: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    paddingTop: 12,
  },
  codeActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 6,
  },
  codeActionDivider: {
    width: 1,
    backgroundColor: "#F3F4F6",
  },
  codeActionText: {
    fontFamily: "Ubuntu-Medium",
    fontSize: 13,
  },

  // Subscription Card
  subCard: {
    borderRadius: 14,
    backgroundColor: "#fff",
    marginBottom: 24,
    padding: 16,
  },
  subRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  subStatusLabel: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 14,
    color: "#111827",
  },
  subStatusDetail: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  subPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginLeft: 8,
  },
  subPillText: {
    fontFamily: "Ubuntu-Medium",
    fontSize: 12,
  },
  subWarningBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#FFFBEB",
    borderRadius: 10,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: WARN_ORANGE,
    marginBottom: 12,
  },
  subWarningText: {
    flex: 1,
    fontFamily: "Ubuntu-Regular",
    fontSize: 12,
    color: "#92400E",
    lineHeight: 18,
  },
  subErrorBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: DANGER_RED,
    marginBottom: 12,
  },
  subErrorText: {
    flex: 1,
    fontFamily: "Ubuntu-Regular",
    fontSize: 12,
    color: "#B91C1C",
    lineHeight: 18,
  },
  subActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 10,
    paddingVertical: 11,
  },
  subActionBtnText: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 14,
    color: "#fff",
  },

  // Menu card
  menuCard: {
    borderRadius: 14,
    backgroundColor: "#fff",
    marginBottom: 20,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  menuIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  menuLabel: {
    flex: 1,
    fontFamily: "Ubuntu-Medium",
    fontSize: 14,
    color: "#111827",
  },
  divider: {
    marginLeft: 66,
    backgroundColor: "#F3F4F6",
  },

  // Logout
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#FCA5A5",
    backgroundColor: "#FEF2F2",
    marginTop: 4,
    marginBottom: 4,
  },
  logoutText: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 14,
    color: DANGER_RED,
  },

  // Footer
  version: {
    textAlign: "center",
    color: "#9CA3AF",
    marginTop: 16,
    marginBottom: 8,
    fontSize: 12,
    fontFamily: "Ubuntu-Regular",
  },

  // Dialog
  dialogBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dialogBtnText: {
    fontFamily: "Ubuntu-Medium",
    fontSize: 14,
    color: "#374151",
  },
  dialogInput: {
    backgroundColor: "#fff",
  },
});
