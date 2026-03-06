import React, { useState, useRef, useEffect } from "react";
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Dimensions,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Text,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import { auth } from "../../services/firebase/config";
import { useAppDispatch } from "../../hooks";
import { setError } from "../../store/slices/authSlice";

const BRAND_GREEN = "#16A34A";
const BRAND_DARK = "#14532D";
const PALE_GREEN = "#F0FDF4";
const DANGER_RED = "#EF4444";
const GRAY_TEXT = "#6B7280";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// Import react-native-firebase for native platforms
let nativeFirebaseAuth = null;
if (Platform.OS !== "web") {
  try {
    nativeFirebaseAuth = require("@react-native-firebase/auth").default;
  } catch (e) {
    console.log("[Login] @react-native-firebase/auth not available");
  }
}

export default function LoginScreen({ navigation }) {
  const dispatch = useAppDispatch();
  const recaptchaVerifier = useRef(null);
  const recaptchaContainerRef = useRef(null);

  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoadingState] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [recaptchaReady, setRecaptchaReady] = useState(false);
  const [phoneFocused, setPhoneFocused] = useState(false);

  // Initialize reCAPTCHA for web only
  useEffect(() => {
    if (Platform.OS === "web") {
      const timer = setTimeout(() => {
        try {
          if (!recaptchaVerifier.current) {
            recaptchaVerifier.current = new RecaptchaVerifier(
              auth,
              "recaptcha-container",
              {
                size: "invisible",
                callback: () => {
                  console.log("[Login] reCAPTCHA solved");
                },
                "expired-callback": () => {
                  console.log("[Login] reCAPTCHA expired");
                  setErrorMessage("Verification expired. Please try again.");
                },
              }
            );
            recaptchaVerifier.current.render().then(() => {
              setRecaptchaReady(true);
              console.log("[Login] Web reCAPTCHA ready");
            });
          }
        } catch (error) {
          console.error("[Login] Error initializing reCAPTCHA:", error);
        }
      }, 500);

      return () => {
        clearTimeout(timer);
        if (recaptchaVerifier.current) {
          try {
            recaptchaVerifier.current.clear();
          } catch (e) {}
          recaptchaVerifier.current = null;
        }
      };
    } else {
      setRecaptchaReady(true);
      console.log("[Login] Native Firebase ready (no reCAPTCHA needed)");
    }
  }, []);

  const validatePhoneNumber = (number) => {
    const cleaned = number.replace(/\D/g, "");
    return cleaned.length === 10;
  };

  const getErrorMessage = (error) => {
    const errorCode = error.code || "";
    switch (errorCode) {
      case "auth/invalid-phone-number":
        return "Invalid phone number format. Please check and try again.";
      case "auth/too-many-requests":
        return "Too many attempts. Please try again later.";
      case "auth/quota-exceeded":
        return "SMS quota exceeded. Please try again later.";
      case "auth/captcha-check-failed":
        return "reCAPTCHA verification failed. Please try again.";
      case "auth/missing-phone-number":
        return "Please enter your phone number.";
      case "auth/user-disabled":
        return "This account has been disabled.";
      case "auth/operation-not-allowed":
        return "Phone authentication is not enabled. Please contact support.";
      default:
        if (error.message?.includes("reCAPTCHA")) {
          return "Verification error. Please refresh and try again.";
        }
        if (error.message?.includes("network")) {
          return "Network error. Please check your connection.";
        }
        return error.message || "Failed to send OTP. Please try again.";
    }
  };

  const handleSendOTP = async () => {
    if (!validatePhoneNumber(phoneNumber)) {
      setErrorMessage("Please enter a valid 10-digit phone number");
      return;
    }

    setErrorMessage("");
    setLoadingState(true);

    try {
      const fullPhoneNumber = `+91${phoneNumber.replace(/\D/g, "")}`;
      console.log("[Login] Sending OTP to:", fullPhoneNumber);

      if (Platform.OS === "web") {
        if (!recaptchaVerifier.current) {
          throw new Error("Verification not ready. Please refresh the page.");
        }
        const confirmationResult = await signInWithPhoneNumber(
          auth,
          fullPhoneNumber,
          recaptchaVerifier.current
        );
        console.log("[Login] OTP sent successfully (web)");
        navigation.navigate("OTPScreen", {
          verificationId: confirmationResult.verificationId,
          phoneNumber: fullPhoneNumber,
          isWeb: true,
        });
        window.confirmationResult = confirmationResult;
      } else {
        if (!nativeFirebaseAuth) {
          throw new Error("Firebase Auth not available on this platform.");
        }
        const confirmation = await nativeFirebaseAuth().signInWithPhoneNumber(
          fullPhoneNumber
        );
        console.log("[Login] OTP sent successfully (native)");
        navigation.navigate("OTPScreen", {
          verificationId: confirmation.verificationId,
          phoneNumber: fullPhoneNumber,
          isWeb: false,
        });
        global.phoneAuthConfirmation = confirmation;
      }
    } catch (error) {
      console.error("[Login] Error sending OTP:", error);
      const friendlyMessage = getErrorMessage(error);
      setErrorMessage(friendlyMessage);
      dispatch(setError(error.message));

      if (Platform.OS === "web" && recaptchaVerifier.current) {
        try {
          recaptchaVerifier.current.clear();
          recaptchaVerifier.current = new RecaptchaVerifier(
            auth,
            "recaptcha-container",
            { size: "invisible" }
          );
          recaptchaVerifier.current.render();
        } catch (e) {
          console.error("[Login] Error resetting reCAPTCHA:", e);
        }
      }

      if (Platform.OS !== "web") {
        Alert.alert("OTP Error", friendlyMessage, [{ text: "OK" }]);
      }
    } finally {
      setLoadingState(false);
    }
  };

  const handlePhoneChange = (text) => {
    const cleaned = text.replace(/\D/g, "").slice(0, 10);
    setPhoneNumber(cleaned);
    if (errorMessage) setErrorMessage("");
  };

  const isDisabled = loading || phoneNumber.length !== 10 || !recaptchaReady;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {Platform.OS === "web" && (
        <div
          id="recaptcha-container"
          ref={recaptchaContainerRef}
          style={{ position: "absolute", top: 0, left: 0 }}
        />
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        {/* Hero Section */}
        <View style={styles.hero}>
          <View style={styles.logoWrapper}>
            <Image
              source={require("../../../assets/SS_Logo.png")}
              style={styles.logoImage}
              resizeMode="cover"
            />
          </View>
          <Text style={styles.appName}>
            Sport<Text style={styles.appNameAccent}>Swift</Text>
          </Text>
          <View style={styles.taglineRow}>
            <View style={styles.taglineLine} />
            <Text style={styles.tagline}>BOOK · PLAY · MANAGE</Text>
            <View style={styles.taglineLine} />
          </View>
        </View>

        {/* Form Section */}
        <View style={styles.formSection}>
          <Text style={styles.welcomeTitle}>Welcome back</Text>
          <Text style={styles.welcomeSubtitle}>
            Enter your mobile number to continue
          </Text>

          {/* Phone Input Row */}
          <View style={styles.phoneRow}>
            <View style={styles.countryBadge}>
              <Text style={styles.countryBadgeText}>+91</Text>
            </View>
            <TextInput
              style={[
                styles.phoneInput,
                phoneFocused && styles.phoneInputFocused,
              ]}
              placeholder="9999999999"
              placeholderTextColor="#9CA3AF"
              value={phoneNumber}
              onChangeText={handlePhoneChange}
              keyboardType="phone-pad"
              maxLength={10}
              onFocus={() => setPhoneFocused(true)}
              onBlur={() => setPhoneFocused(false)}
            />
          </View>

          {/* Error Card */}
          {!!errorMessage && (
            <View style={styles.errorCard}>
              <Text style={styles.errorCardText}>{errorMessage}</Text>
            </View>
          )}

          {/* Recaptcha loading */}
          {!recaptchaReady && (
            <View style={styles.recaptchaRow}>
              <ActivityIndicator size="small" color={BRAND_GREEN} />
              <Text style={styles.recaptchaText}>Initializing verification...</Text>
            </View>
          )}

          {/* Send OTP Button */}
          <TouchableOpacity
            style={[styles.otpButton, isDisabled && styles.otpButtonDisabled]}
            onPress={handleSendOTP}
            disabled={isDisabled}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.otpButtonText}>Send OTP</Text>
            )}
          </TouchableOpacity>

          {/* Terms */}
          <Text style={styles.termsText}>
            By continuing, you agree to our{" "}
            <Text style={styles.termsLink}>Terms of Service</Text> and{" "}
            <Text style={styles.termsLink}>Privacy Policy</Text>
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0F1E",
  },
  keyboardView: {
    flex: 1,
  },
  hero: {
    height: SCREEN_HEIGHT * 0.38,
    backgroundColor: "#0A0F1E",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  logoWrapper: {
    padding: 5,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.12)",
    shadowColor: "#4ADE80",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
  },
  logoImage: {
    width: 90,
    height: 90,
    borderRadius: 22,
  },
  appName: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 34,
    color: "#FFFFFF",
    letterSpacing: 1,
    marginTop: 4,
  },
  appNameAccent: {
    color: "#02b443",
  },
  taglineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  taglineLine: {
    width: 28,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  tagline: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.45)",
    letterSpacing: 2.5,
  },
  formSection: {
    backgroundColor: "#FFFFFF",
    flex: 1,
    padding: 28,
    paddingTop: 32,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    marginBottom: -40,
  },
  welcomeTitle: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 23,
    color: "#0A0F1E",
    marginBottom: 6,
  },
  welcomeSubtitle: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 14,
    color: GRAY_TEXT,
    marginBottom: 24,
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  countryBadge: {
    backgroundColor: "#0A0F1E",
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
  },
  countryBadgeText: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 14,
    color: "#fff",
  },
  phoneInput: {
    flex: 1,
    fontFamily: "Ubuntu-Regular",
    fontSize: 16,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 52,
    color: "#111827",
    backgroundColor: "#fff",
  },
  phoneInputFocused: {
    borderColor: BRAND_GREEN,
  },
  errorCard: {
    borderLeftWidth: 4,
    borderLeftColor: DANGER_RED,
    backgroundColor: "#FEF2F2",
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  errorCardText: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 13,
    color: DANGER_RED,
  },
  recaptchaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    gap: 8,
  },
  recaptchaText: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 13,
    color: GRAY_TEXT,
  },
  otpButton: {
    backgroundColor: "#0A0F1E",
    borderRadius: 12,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  otpButtonDisabled: {
    opacity: 0.45,
  },
  otpButtonText: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 15,
    color: "#fff",
  },
  termsText: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 11,
    color: GRAY_TEXT,
    textAlign: "center",
    marginTop: 20,
  },
  termsLink: {
    color: BRAND_GREEN,
  },
});
