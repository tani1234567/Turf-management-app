import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  Linking,
  Image,
} from "react-native";
import {
  Text,
  Surface,
  Button,
  Divider,
  Badge,
  TextInput,
  IconButton,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSelector, useDispatch } from "react-redux";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../../hooks";
import { selectUnassignedCaretakers } from "../../store/slices/companySlice";
import { updateUserProfile } from "../../store/slices/authSlice";
import { updateDocument } from "../../services/firebase/firestore";

const SETTINGS_SECTIONS = [
  {
    title: "Turf Management",
    items: [
      { id: "turfs", icon: "soccer-field", label: "My Turfs", color: "#4CAF50" },
      { id: "pricing", icon: "currency-inr", label: "Pricing & Slots", color: "#2196F3" },
      { id: "advancePayment", icon: "cash-clock", label: "Advance Payment", color: "#FF5722" },
      { id: "holidaySchedule", icon: "calendar-star", label: "Holiday Schedule", color: "#10B981" },
      { id: "caretakers", icon: "account-group", label: "Caretakers", color: "#9C27B0" },
      { id: "coupons", icon: "tag-multiple-outline", label: "Offers & Coupons", color: "#10B981" },
    ],
  },
  {
    title: "Tools",
    items: [
      { id: "phonebook", icon: "book-account", label: "Customer Directory", color: "#10B981" },
    ],
  },
  {
    title: "Account",
    items: [
      { id: "profile", icon: "account-edit", label: "Edit Profile", color: "#607D8B" },
      { id: "notifications", icon: "bell", label: "Notifications", color: "#FF9800" },
    ],
  },
  {
    title: "Support",
    items: [
      { id: "help", icon: "help-circle", label: "Help & Support", color: "#00BCD4" },
      { id: "about", icon: "information", label: "About", color: "#607D8B" },
    ],
  },
];

const MANAGER_ACCENT = "#3B82F6";
const PALE_BLUE = "#DBEAFE";
const NAVY_BLUE = "#1E40AF";

// ──────────────────────────────────────────────
// Edit Profile Modal
// ──────────────────────────────────────────────
const EditProfileModal = ({ visible, user, onDismiss, onSave }) => {
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Error", "Name cannot be empty.");
      return;
    }
    setSaving(true);
    await onSave({ name: name.trim(), email: email.trim() || null });
    setSaving(false);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.modalOverlay}>
        <Surface style={styles.editDialog} elevation={8}>
          <View style={styles.editHeader}>
            <Text variant="titleLarge" style={styles.editTitle}>
              Edit Profile
            </Text>
            <IconButton icon="close" size={24} onPress={onDismiss} />
          </View>

          <TextInput
            mode="outlined"
            label="Name"
            value={name}
            onChangeText={setName}
            style={styles.editInput}
            outlineColor="#ddd"
            activeOutlineColor={MANAGER_ACCENT}
            left={<TextInput.Icon icon="account" />}
          />

          <TextInput
            mode="outlined"
            label="Email (optional)"
            value={email}
            onChangeText={setEmail}
            style={styles.editInput}
            keyboardType="email-address"
            autoCapitalize="none"
            outlineColor="#ddd"
            activeOutlineColor={MANAGER_ACCENT}
            left={<TextInput.Icon icon="email" />}
          />

          <Text variant="bodySmall" style={styles.editNote}>
            Phone number cannot be changed as it is linked to your account.
          </Text>

          <View style={styles.editActions}>
            <Button
              mode="outlined"
              onPress={onDismiss}
              style={styles.editActionBtn}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              buttonColor={MANAGER_ACCENT}
              onPress={handleSave}
              style={styles.editActionBtn}
              loading={saving}
              disabled={saving}
            >
              Save
            </Button>
          </View>
        </Surface>
      </View>
    </Modal>
  );
};

// ──────────────────────────────────────────────
// About Modal
// ──────────────────────────────────────────────
const AboutModal = ({ visible, onDismiss }) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
    <View style={styles.modalOverlay}>
      <Surface style={styles.aboutDialog} elevation={8}>
        <View style={styles.aboutHeader}>
          <View style={styles.aboutIconContainer}>
            <Image
              source={require("../../../assets/SS_Logo.png")}
              style={styles.aboutLogo}
              resizeMode="cover"
            />
          </View>
          <Text variant="headlineSmall" style={styles.aboutAppName}>
            SportSwift
          </Text>
          <Text variant="bodyMedium" style={styles.aboutVersion}>
            Version 1.0.0
          </Text>
        </View>

        <Divider style={{ marginVertical: 16 }} />

        <Text variant="bodyMedium" style={styles.aboutDescription}>
          Your one-stop solution for booking and managing sports turfs. Find, book, and play at the best grounds near you.
        </Text>

        <View style={{ height: 16 }} />

        <Button mode="contained" buttonColor={MANAGER_ACCENT} onPress={onDismiss} style={{ borderRadius: 8 }}>
          Close
        </Button>
      </Surface>
    </View>
  </Modal>
);

// ──────────────────────────────────────────────
// Help & Support Modal
// ──────────────────────────────────────────────
const HelpSupportModal = ({ visible, onDismiss }) => {
  const helpItems = [
    { icon: "email-outline", label: "Email Support", value: "support@playgrid.com", action: () => Linking.openURL("mailto:support@playgrid.com") },
    { icon: "frequently-asked-questions", label: "FAQs", value: "View common questions", action: null },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.modalOverlay}>
        <Surface style={styles.helpDialog} elevation={8}>
          <View style={styles.editHeader}>
            <Text variant="titleLarge" style={styles.editTitle}>
              Help & Support
            </Text>
            <IconButton icon="close" size={24} onPress={onDismiss} />
          </View>

          <View style={styles.helpSection}>
            <Text variant="titleSmall" style={styles.helpSectionTitle}>
              Contact Us
            </Text>
            {helpItems.map((item) => (
              <TouchableOpacity
                key={item.label}
                style={styles.helpItem}
                onPress={item.action}
                disabled={!item.action}
              >
                <MaterialCommunityIcons name={item.icon} size={22} color={MANAGER_ACCENT} />
                <View style={styles.helpItemContent}>
                  <Text variant="bodyMedium" style={styles.helpItemLabel}>
                    {item.label}
                  </Text>
                  <Text variant="bodySmall" style={styles.helpItemValue}>
                    {item.value}
                  </Text>
                </View>
                {item.action && (
                  <MaterialCommunityIcons name="chevron-right" size={20} color="#ccc" />
                )}
              </TouchableOpacity>
            ))}
          </View>

          <Divider style={{ marginVertical: 12 }} />

          <View style={styles.helpSection}>
            <Text variant="titleSmall" style={styles.helpSectionTitle}>
              Common Topics
            </Text>
            {[
              "How do I manage bookings?",
              "How do I assign caretakers?",
              "How do I update pricing?",
              "How do I contact support?",
            ].map((q) => (
              <View key={q} style={styles.faqItem}>
                <MaterialCommunityIcons name="chevron-right" size={16} color="#999" />
                <Text variant="bodyMedium" style={styles.faqText}>
                  {q}
                </Text>
              </View>
            ))}
          </View>

          <View style={{ height: 16 }} />
          <Button mode="contained" buttonColor={MANAGER_ACCENT} onPress={onDismiss} style={{ borderRadius: 8 }}>
            Close
          </Button>
        </Surface>
      </View>
    </Modal>
  );
};

// ──────────────────────────────────────────────
// Main Screen
// ──────────────────────────────────────────────
export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const unassignedCaretakers = useSelector(selectUnassignedCaretakers);
  const unassignedCount = unassignedCaretakers?.length || 0;

  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const userId = user?.id || user?.userId || user?.uid;

  const handleMenuPress = (itemId) => {
    switch (itemId) {
      case "caretakers":
        navigation.navigate("ManagerCaretakers");
        break;
      case "turfs":
        navigation.navigate("TurfSelection", { nextScreen: "EditTurf" });
        break;
      case "pricing":
        navigation.navigate("TurfSelection", { nextScreen: "EditTurf" });
        break;
      case "advancePayment":
        navigation.navigate("TurfSelection", { nextScreen: "AdvancePaymentSettings" });
        break;
      case "holidaySchedule":
        navigation.navigate("TurfSelection", { nextScreen: "HolidaySchedule" });
        break;
      case "profile":
        setShowEditProfile(true);
        break;
      case "coupons":
        navigation.navigate("CompanyCouponToggle");
        break;
      case "phonebook":
        navigation.navigate("CustomerPhonebook");
        break;
      case "notifications":
        navigation.navigate("Notifications");
        break;
      case "help":
        setShowHelp(true);
        break;
      case "about":
        setShowAbout(true);
        break;
      default:
        break;
    }
  };

  const handleSaveProfile = async (updates) => {
    try {
      if (!userId) {
        Alert.alert("Error", "User not found.");
        return;
      }
      await updateDocument("users", userId, updates);
      dispatch(updateUserProfile(updates));
      setShowEditProfile(false);
      Alert.alert("Success", "Profile updated successfully.");
    } catch (error) {
      console.error("Error updating profile:", error);
      Alert.alert("Error", "Failed to update profile. Please try again.");
    }
  };

  const MenuItem = ({ item }) => (
    <TouchableOpacity style={styles.menuItem} onPress={() => handleMenuPress(item.id)} activeOpacity={0.7}>
      <View style={[styles.menuIconContainer, { backgroundColor: `${item.color}18` }]}>
        <MaterialCommunityIcons name={item.icon} size={20} color={item.color} />
      </View>
      <Text style={styles.menuLabel}>{item.label}</Text>
      {item.id === "caretakers" && unassignedCount > 0 && (
        <View style={styles.menuBadge}>
          <Text style={styles.menuBadgeText}>{unassignedCount}</Text>
        </View>
      )}
      <MaterialCommunityIcons name="chevron-right" size={18} color="#D1D5DB" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
        </View>

        {/* Profile Card */}
        <Surface style={styles.profileCard} elevation={2}>
          <View style={styles.profileBanner}>
            <View style={styles.avatarContainer}>
              <MaterialCommunityIcons name="account-tie" size={32} color={MANAGER_ACCENT} />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.userName}>{user?.name || "Manager"}</Text>
              <View style={styles.rolePill}>
                <Text style={styles.rolePillText}>Business Manager</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.editProfileBtn}
              onPress={() => setShowEditProfile(true)}
            >
              <MaterialCommunityIcons name="pencil-outline" size={18} color={MANAGER_ACCENT} />
            </TouchableOpacity>
          </View>
          {user?.phone && (
            <View style={styles.profilePhoneRow}>
              <MaterialCommunityIcons name="phone-outline" size={14} color="#9CA3AF" />
              <Text style={styles.profilePhone}>{user.phone}</Text>
            </View>
          )}
        </Surface>

        {/* Settings Sections */}
        {SETTINGS_SECTIONS.map((section) => (
          <View key={section.title}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionTitleAccent} />
              <Text style={styles.sectionTitle}>{section.title}</Text>
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
        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
          <MaterialCommunityIcons name="logout" size={18} color="#EF4444" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        {/* Version */}
        <Text style={styles.version}>Version 1.0.0</Text>
      </ScrollView>

      {/* Modals */}
      <EditProfileModal
        visible={showEditProfile}
        user={user}
        onDismiss={() => setShowEditProfile(false)}
        onSave={handleSaveProfile}
      />
      <AboutModal
        visible={showAbout}
        onDismiss={() => setShowAbout(false)}
      />
      <HelpSupportModal
        visible={showHelp}
        onDismiss={() => setShowHelp(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F0F4F8",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 16,
    paddingTop: 4,
  },
  title: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 26,
    color: NAVY_BLUE,
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
    backgroundColor: PALE_BLUE,
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
    borderColor: MANAGER_ACCENT + "40",
  },
  profileInfo: {
    flex: 1,
  },
  userName: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 16,
    color: NAVY_BLUE,
  },
  rolePill: {
    marginTop: 4,
    backgroundColor: MANAGER_ACCENT + "20",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  rolePillText: {
    fontSize: 11,
    fontFamily: "Ubuntu-Medium",
    color: MANAGER_ACCENT,
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

  // Sections
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
    backgroundColor: MANAGER_ACCENT,
  },
  sectionTitle: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 12,
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
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
  menuBadge: {
    backgroundColor: "#F59E0B",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 5,
    marginRight: 6,
  },
  menuBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Ubuntu-Bold",
  },
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
    color: "#EF4444",
  },
  version: {
    textAlign: "center",
    color: "#9CA3AF",
    marginTop: 16,
    marginBottom: 8,
    fontSize: 12,
    fontFamily: "Ubuntu-Regular",
  },

  // ─── Modal Common ───
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 20,
  },

  // ─── Edit Profile Modal ───
  editDialog: {
    borderRadius: 16,
    backgroundColor: "#fff",
    padding: 20,
  },
  editHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  editTitle: {
    fontWeight: "600",
    color: "#333",
  },
  editInput: {
    marginBottom: 12,
    backgroundColor: "#fff",
  },
  editNote: {
    color: "#999",
    marginBottom: 16,
    marginLeft: 4,
  },
  editActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  editActionBtn: {
    borderRadius: 8,
    minWidth: 100,
  },

  // ─── About Modal ───
  aboutDialog: {
    borderRadius: 16,
    backgroundColor: "#fff",
    padding: 24,
    alignItems: "center",
  },
  aboutHeader: {
    alignItems: "center",
  },
  aboutIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 12,
  },
  aboutLogo: {
    width: 80,
    height: 80,
    borderRadius: 20,
  },
  aboutAppName: {
    fontWeight: "bold",
    color: "#333",
  },
  aboutVersion: {
    color: "#999",
    marginTop: 4,
  },
  aboutDescription: {
    color: "#555",
    textAlign: "center",
    lineHeight: 22,
  },

  // ─── Help Modal ───
  helpDialog: {
    borderRadius: 16,
    backgroundColor: "#fff",
    padding: 20,
    maxHeight: "80%",
  },
  helpSection: {
    marginBottom: 4,
  },
  helpSectionTitle: {
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  helpItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
  },
  helpItemContent: {
    flex: 1,
  },
  helpItemLabel: {
    color: "#333",
    fontWeight: "500",
  },
  helpItemValue: {
    color: "#999",
    marginTop: 2,
  },
  faqItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    gap: 8,
  },
  faqText: {
    color: "#555",
    flex: 1,
  },
});
