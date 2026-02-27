import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  Image,
  Linking,
} from "react-native";
import {
  Text,
  Surface,
  Button,
  Divider,
  TextInput,
  IconButton,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../../hooks";
import { useDispatch } from "react-redux";
import { updateUserProfile } from "../../store/slices/authSlice";
import { updateDocument } from "../../services/firebase/firestore";

const USER_COLOR = "#4CAF50";

const MENU_ITEMS = [
  { id: "edit", icon: "account-edit", label: "Edit Profile", color: "#4CAF50" },
  { id: "bookings", icon: "calendar-text", label: "Booking History", color: "#2196F3" },
  { id: "notifications", icon: "bell", label: "Notifications", color: "#FF9800" },
  { id: "help", icon: "help-circle", label: "Help & Support", color: "#607D8B" },
  { id: "about", icon: "information", label: "About", color: "#795548" },
];

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
            activeOutlineColor={USER_COLOR}
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
            activeOutlineColor={USER_COLOR}
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
              buttonColor={USER_COLOR}
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
            <MaterialCommunityIcons name="soccer-field" size={48} color={USER_COLOR} />
          </View>
          <Text variant="headlineSmall" style={styles.aboutAppName}>
            Play Grid
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

        <Button mode="contained" buttonColor={USER_COLOR} onPress={onDismiss} style={{ borderRadius: 8 }}>
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
                <MaterialCommunityIcons name={item.icon} size={22} color={USER_COLOR} />
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
              "How do I book a turf?",
              "How do I cancel a booking?",
              "How do refunds work?",
              "How do I contact the turf manager?",
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
          <Button mode="contained" buttonColor={USER_COLOR} onPress={onDismiss} style={{ borderRadius: 8 }}>
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
export default function ProfileScreen({ navigation }) {
  const { user, logout } = useAuth();
  const dispatch = useDispatch();

  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const userId = user?.id || user?.userId || user?.uid;

  const handleMenuPress = (itemId) => {
    switch (itemId) {
      case "edit":
        setShowEditProfile(true);
        break;
      case "bookings":
        navigation.navigate("Bookings");
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
    <TouchableOpacity style={styles.menuItem} onPress={() => handleMenuPress(item.id)}>
      <View style={[styles.menuIconContainer, { backgroundColor: `${item.color}15` }]}>
        <MaterialCommunityIcons name={item.icon} size={22} color={item.color} />
      </View>
      <Text variant="bodyLarge" style={styles.menuLabel}>
        {item.label}
      </Text>
      <MaterialCommunityIcons name="chevron-right" size={24} color="#ccc" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Header */}
        <Surface style={styles.profileCard} elevation={1}>
          <View style={styles.avatarContainer}>
            {user?.profilePicture ? (
              <Image source={{ uri: user.profilePicture }} style={styles.avatar} />
            ) : (
              <MaterialCommunityIcons name="account" size={40} color="#4CAF50" />
            )}
          </View>
          <View style={styles.profileInfo}>
            <Text variant="titleLarge" style={styles.userName}>
              {user?.name || "User"}
            </Text>
            <Text variant="bodyMedium" style={styles.userPhone}>
              {user?.phone || "Phone not set"}
            </Text>
            <View style={styles.roleChip}>
              <Text variant="bodySmall" style={styles.roleText}>
                {(user?.role || "user").toUpperCase()}
              </Text>
            </View>
          </View>
        </Surface>

        {/* Menu Items */}
        <Surface style={styles.menuCard} elevation={1}>
          {MENU_ITEMS.map((item, index) => (
            <React.Fragment key={item.id}>
              <MenuItem item={item} />
              {index < MENU_ITEMS.length - 1 && <Divider style={styles.divider} />}
            </React.Fragment>
          ))}
        </Surface>

        {/* Logout Button */}
        <Button
          mode="outlined"
          onPress={logout}
          style={styles.logoutButton}
          icon="logout"
          textColor="#F44336"
        >
          Logout
        </Button>

        {/* Version */}
        <Text variant="bodySmall" style={styles.version}>
          Version 1.0.0
        </Text>
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
    backgroundColor: "#f5f5f5",
  },
  scrollContent: {
    padding: 16,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    borderRadius: 16,
    backgroundColor: "#fff",
    marginBottom: 16,
  },
  avatarContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#E8F5E9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  profileInfo: {
    flex: 1,
  },
  userName: {
    fontWeight: "bold",
    color: "#333",
  },
  userPhone: {
    color: "#666",
    marginTop: 2,
  },
  roleChip: {
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: "flex-start",
    marginTop: 8,
  },
  roleText: {
    color: "#4CAF50",
    fontWeight: "600",
    fontSize: 10,
  },
  menuCard: {
    borderRadius: 16,
    backgroundColor: "#fff",
    marginBottom: 16,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  menuLabel: {
    flex: 1,
    color: "#333",
  },
  divider: {
    marginLeft: 68,
  },
  logoutButton: {
    borderRadius: 8,
    borderColor: "#F44336",
  },
  version: {
    textAlign: "center",
    color: "#999",
    marginTop: 24,
    marginBottom: 16,
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
    borderRadius: 40,
    backgroundColor: "#E8F5E9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
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
