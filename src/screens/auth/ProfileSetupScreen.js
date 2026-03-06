import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Text,
} from "react-native";
import { TextInput, Surface } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useAppDispatch } from "../../hooks";
import { setUser, setLoading, setError } from "../../store/slices/authSlice";
import { setDocument, serverTimestamp } from "../../services/firebase/firestore";

const BRAND_GREEN = "#16A34A";
const BRAND_DARK = "#14532D";
const PALE_GREEN = "#F0FDF4";
const DANGER_RED = "#EF4444";
const GRAY_TEXT = "#6B7280";

const ROLE_CONFIG = {
  user: {
    color: "#4CAF50",
    icon: "account",
    label: "User",
    message: "Set up your profile to start booking turfs and managing your games.",
  },
  owner: {
    color: "#9C27B0",
    icon: "office-building",
    label: "Turf Owner",
    message: "Next, you'll create your company and get an invite code to share with your team.",
  },
  manager: {
    color: "#3B82F6",
    icon: "briefcase",
    label: "Manager",
    message: "Next, you'll enter an invite code from a Turf Owner to join their company.",
  },
  caretaker: {
    color: "#F97316",
    icon: "account-hard-hat",
    label: "Caretaker",
    message: "Next, you'll enter an invite code to join a company. A manager will assign you to a turf.",
  },
};

export default function ProfileSetupScreen({ route, navigation }) {
  const dispatch = useAppDispatch();
  const { userId, phoneNumber, role } = route.params;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [profileImage, setProfileImage] = useState(null);
  const [loading, setLoadingState] = useState(false);
  const [errors, setErrors] = useState({});

  const roleConfig = ROLE_CONFIG[role] || ROLE_CONFIG.user;

  const validateEmail = (val) => {
    if (!val) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  };

  const validateForm = () => {
    const newErrors = {};
    if (!name.trim()) {
      newErrors.name = "Name is required";
    } else if (name.trim().length < 2) {
      newErrors.name = "Name must be at least 2 characters";
    }
    if (email && !validateEmail(email)) {
      newErrors.email = "Please enter a valid email";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePickImage = async () => {
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
        setProfileImage(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to pick image. Please try again.");
    }
  };

  const handleRemoveImage = () => setProfileImage(null);

  const handleSaveProfile = async () => {
    if (!validateForm()) return;

    if (role === "owner") {
      navigation.navigate("OwnerSetupScreen", {
        userId,
        phoneNumber,
        name: name.trim(),
        email: email.trim() || null,
        profilePicture: profileImage,
      });
      return;
    }

    if (role === "manager" || role === "caretaker") {
      navigation.navigate("JoinCompanyScreen", {
        userId,
        phoneNumber,
        name: name.trim(),
        email: email.trim() || null,
        profilePicture: profileImage,
        role,
      });
      return;
    }

    setLoadingState(true);
    dispatch(setLoading(true));

    try {
      const userData = {
        userId,
        phone: phoneNumber,
        name: name.trim(),
        email: email.trim() || null,
        role,
        profilePicture: profileImage || null,
        isActive: true,
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
        fcmTokens: [],
        favorites: [],
      };
      await setDocument("users", userId, userData);
      dispatch(setUser(userData));
    } catch (error) {
      console.error("Error saving profile:", error);
      dispatch(setError(error.message));
      Alert.alert("Error", "Failed to save profile. Please try again.");
    } finally {
      setLoadingState(false);
      dispatch(setLoading(false));
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="arrow-left" size={22} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <View style={{ position: "relative" }}>
            <TouchableOpacity onPress={handlePickImage} activeOpacity={0.7}>
              {profileImage ? (
                <Image source={{ uri: profileImage }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <MaterialCommunityIcons
                    name="account-circle"
                    size={48}
                    color={BRAND_GREEN + "60"}
                  />
                </View>
              )}
            </TouchableOpacity>

            {/* Camera badge */}
            <View style={styles.cameraBadge}>
              <MaterialCommunityIcons name="camera" size={14} color={BRAND_GREEN} />
            </View>

            {/* Remove button */}
            {profileImage && (
              <TouchableOpacity
                style={styles.removeBtn}
                onPress={handleRemoveImage}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="close" size={12} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.avatarHint}>Tap to add photo</Text>
        </View>

        {/* Form Card */}
        <Surface style={styles.formCard} elevation={2}>
          <TextInput
            mode="outlined"
            label="Full Name *"
            placeholder="Enter your name"
            value={name}
            onChangeText={(text) => {
              setName(text);
              if (errors.name) setErrors({ ...errors, name: null });
            }}
            error={!!errors.name}
            left={<TextInput.Icon icon="account" />}
            outlineColor="#E5E7EB"
            activeOutlineColor={BRAND_GREEN}
            contentStyle={{ fontFamily: "Ubuntu-Regular" }}
            style={styles.input}
          />
          {errors.name && (
            <Text style={styles.errorText}>{errors.name}</Text>
          )}

          <TextInput
            mode="outlined"
            label="Email (Optional)"
            placeholder="Enter your email"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (errors.email) setErrors({ ...errors, email: null });
            }}
            error={!!errors.email}
            keyboardType="email-address"
            autoCapitalize="none"
            left={<TextInput.Icon icon="email" />}
            outlineColor="#E5E7EB"
            activeOutlineColor={BRAND_GREEN}
            contentStyle={{ fontFamily: "Ubuntu-Regular" }}
            style={styles.input}
          />
          {errors.email && (
            <Text style={styles.errorText}>{errors.email}</Text>
          )}

          {/* Phone row */}
          <View style={styles.phoneRow}>
            <MaterialCommunityIcons name="phone-check" size={20} color={BRAND_GREEN} />
            <Text style={styles.phoneNumber}>{phoneNumber}</Text>
            <View style={styles.verifiedBadge}>
              <MaterialCommunityIcons name="check" size={12} color={BRAND_GREEN} />
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          </View>
        </Surface>

        {/* Role Info Card */}
        <Surface
          style={[styles.roleCard, { borderLeftColor: roleConfig.color }]}
          elevation={1}
        >
          <View style={styles.roleCardRow}>
            <View style={[styles.roleIconCircle, { backgroundColor: roleConfig.color + "18" }]}>
              <MaterialCommunityIcons name={roleConfig.icon} size={20} color={roleConfig.color} />
            </View>
            <Text style={styles.roleCardText}>{roleConfig.message}</Text>
          </View>
        </Surface>

        {/* Continue Button */}
        <TouchableOpacity
          style={[
            styles.saveButton,
            { backgroundColor: roleConfig.color },
            (loading || !name.trim()) && styles.saveButtonDisabled,
          ]}
          onPress={handleSaveProfile}
          disabled={loading || !name.trim()}
          activeOpacity={0.85}
        >
          <Text style={styles.saveButtonText}>
            {loading
              ? "Saving..."
              : role === "user"
              ? "Complete Setup"
              : "Continue"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7FFF9",
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
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  avatarSection: {
    alignItems: "center",
    marginVertical: 20,
  },
  avatarImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  avatarPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: PALE_GREEN,
    borderWidth: 2,
    borderColor: BRAND_GREEN + "60",
    justifyContent: "center",
    alignItems: "center",
  },
  cameraBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
  },
  removeBtn: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: DANGER_RED,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarHint: {
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
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    padding: 14,
    marginTop: 8,
    gap: 10,
  },
  phoneNumber: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 15,
    color: "#374151",
    flex: 1,
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: PALE_GREEN,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  verifiedText: {
    fontFamily: "Ubuntu-Medium",
    fontSize: 11,
    color: BRAND_GREEN,
  },
  roleCard: {
    borderRadius: 14,
    backgroundColor: "#fff",
    borderLeftWidth: 4,
    padding: 14,
    marginBottom: 20,
  },
  roleCardRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  roleIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  roleCardText: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 13,
    color: GRAY_TEXT,
    flex: 1,
    lineHeight: 18,
  },
  saveButton: {
    borderRadius: 12,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 15,
    color: "#fff",
  },
});
