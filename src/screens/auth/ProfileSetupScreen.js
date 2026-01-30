import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from "react-native";
import {
  Text,
  TextInput,
  Button,
  Surface,
  Avatar,
  IconButton,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useAppDispatch } from "../../hooks";
import { setUser, setLoading, setError } from "../../store/slices/authSlice";
import { setDocument, serverTimestamp } from "../../services/firebase/firestore";

export default function ProfileSetupScreen({ route, navigation }) {
  const dispatch = useAppDispatch();
  const { userId, phoneNumber, role } = route.params;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [profileImage, setProfileImage] = useState(null);
  const [loading, setLoadingState] = useState(false);
  const [errors, setErrors] = useState({});

  const validateEmail = (email) => {
    if (!email) return true; // Email is optional
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
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
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Please allow access to your photos to upload a profile picture."
        );
        return;
      }

      // Pick image
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
      console.error("Error picking image:", error);
      Alert.alert("Error", "Failed to pick image. Please try again.");
    }
  };

  const handleRemoveImage = () => {
    setProfileImage(null);
  };

  const handleSaveProfile = async () => {
    if (!validateForm()) return;

    // For owner role, navigate to OwnerSetupScreen without saving yet
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

    // For manager and caretaker, navigate to JoinCompanyScreen without saving yet
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

    // For regular user, save profile directly
    setLoadingState(true);
    dispatch(setLoading(true));

    try {
      const userData = {
        userId,
        phone: phoneNumber,
        name: name.trim(),
        email: email.trim() || null,
        role,
        profilePicture: profileImage || null, // TODO: Upload to Firebase Storage
        isActive: true,
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
        fcmTokens: [],
        favorites: [],
      };

      // Save to Firestore
      await setDocument("users", userId, userData);

      // Update Redux state
      dispatch(setUser(userData));

      // Navigation will be handled by AppNavigator based on role
    } catch (error) {
      console.error("Error saving profile:", error);
      dispatch(setError(error.message));
      Alert.alert("Error", "Failed to save profile. Please try again.");
    } finally {
      setLoadingState(false);
      dispatch(setLoading(false));
    }
  };

  const getRoleColor = () => {
    switch (role) {
      case "user":
        return "#4CAF50";
      case "owner":
        return "#9C27B0";
      case "manager":
        return "#2196F3";
      case "caretaker":
        return "#FF9800";
      default:
        return "#4CAF50";
    }
  };

  const getRoleTitle = () => {
    switch (role) {
      case "user":
        return "User";
      case "owner":
        return "Turf Owner";
      case "manager":
        return "Manager";
      case "caretaker":
        return "Caretaker";
      default:
        return "User";
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text variant="headlineSmall" style={styles.title}>
            Complete Your Profile
          </Text>
          <View style={[styles.roleBadge, { backgroundColor: `${getRoleColor()}20` }]}>
            <Text style={[styles.roleText, { color: getRoleColor() }]}>
              {getRoleTitle()}
            </Text>
          </View>
        </View>

        {/* Profile Picture */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={handlePickImage} activeOpacity={0.7}>
            {profileImage ? (
              <View style={styles.avatarContainer}>
                <Image source={{ uri: profileImage }} style={styles.avatarImage} />
                <IconButton
                  icon="close-circle"
                  size={24}
                  iconColor="#F44336"
                  style={styles.removeButton}
                  onPress={handleRemoveImage}
                />
              </View>
            ) : (
              <View style={styles.avatarPlaceholder}>
                <MaterialCommunityIcons
                  name="camera-plus"
                  size={36}
                  color="#999"
                />
                <Text variant="bodySmall" style={styles.avatarText}>
                  Add Photo
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <Text variant="bodySmall" style={styles.optionalText}>
            (Optional)
          </Text>
        </View>

        {/* Form */}
        <Surface style={styles.formContainer} elevation={1}>
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
            style={styles.input}
          />
          {errors.name && (
            <Text variant="bodySmall" style={styles.errorText}>
              {errors.name}
            </Text>
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
            style={styles.input}
          />
          {errors.email && (
            <Text variant="bodySmall" style={styles.errorText}>
              {errors.email}
            </Text>
          )}

          {/* Phone Number Display */}
          <View style={styles.phoneDisplay}>
            <MaterialCommunityIcons name="phone" size={20} color="#666" />
            <Text variant="bodyMedium" style={styles.phoneText}>
              {phoneNumber}
            </Text>
            <MaterialCommunityIcons
              name="check-circle"
              size={18}
              color="#4CAF50"
            />
          </View>
        </Surface>

        {/* Info Note */}
        {role === "owner" && (
          <View style={[styles.infoContainer, { backgroundColor: "#F3E5F5" }]}>
            <MaterialCommunityIcons
              name="information-outline"
              size={18}
              color="#9C27B0"
            />
            <Text variant="bodySmall" style={styles.infoText}>
              Next, you'll create your company and get an invite code to share
              with your managers and caretakers.
            </Text>
          </View>
        )}

        {role === "manager" && (
          <View style={[styles.infoContainer, { backgroundColor: "#E3F2FD" }]}>
            <MaterialCommunityIcons
              name="information-outline"
              size={18}
              color="#2196F3"
            />
            <Text variant="bodySmall" style={styles.infoText}>
              Next, you'll enter an invite code from a Turf Owner to join their
              company and select the turfs you'll manage.
            </Text>
          </View>
        )}

        {role === "caretaker" && (
          <View style={styles.infoContainer}>
            <MaterialCommunityIcons
              name="information-outline"
              size={18}
              color="#FF9800"
            />
            <Text variant="bodySmall" style={styles.infoText}>
              Next, you'll enter an invite code from a Turf Owner to join their
              company. You'll be assigned to a turf by a manager.
            </Text>
          </View>
        )}

        {/* Save Button */}
        <Button
          mode="contained"
          onPress={handleSaveProfile}
          loading={loading}
          disabled={loading || !name.trim()}
          style={styles.saveButton}
          contentStyle={styles.buttonContent}
          buttonColor={getRoleColor()}
        >
          {loading
            ? "Saving..."
            : role === "user"
            ? "Complete Setup"
            : "Continue"}
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
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
    marginBottom: 12,
  },
  roleBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  roleText: {
    fontWeight: "600",
    fontSize: 14,
  },
  avatarSection: {
    alignItems: "center",
    marginBottom: 24,
  },
  avatarContainer: {
    position: "relative",
  },
  avatarImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  removeButton: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: "#fff",
    margin: 0,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#e0e0e0",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#ccc",
    borderStyle: "dashed",
  },
  avatarText: {
    color: "#999",
    marginTop: 4,
  },
  optionalText: {
    color: "#999",
    marginTop: 8,
  },
  formContainer: {
    padding: 20,
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
  phoneDisplay: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    padding: 16,
    borderRadius: 8,
    marginTop: 12,
  },
  phoneText: {
    flex: 1,
    marginLeft: 12,
    color: "#333",
  },
  infoContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFF3E0",
    padding: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  infoText: {
    flex: 1,
    marginLeft: 8,
    color: "#666",
    lineHeight: 18,
  },
  saveButton: {
    marginTop: 24,
    borderRadius: 8,
  },
  buttonContent: {
    height: 50,
  },
});
