import React, { useState, useRef, useEffect } from "react";
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Image,
} from "react-native";
import {
  Text,
  TextInput,
  Button,
  Surface,
  ActivityIndicator,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import { auth, firebaseConfig } from "../../services/firebase/config";
import { useAppDispatch } from "../../hooks";
import { setError } from "../../store/slices/authSlice";

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

  // Initialize reCAPTCHA for web only
  useEffect(() => {
    if (Platform.OS === "web") {
      // Small delay to ensure DOM is ready
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
          } catch (e) {
            // Ignore cleanup errors
          }
          recaptchaVerifier.current = null;
        }
      };
    } else {
      // For native platforms with @react-native-firebase, no reCAPTCHA setup needed
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
    // Validate phone number
    if (!validatePhoneNumber(phoneNumber)) {
      setErrorMessage("Please enter a valid 10-digit phone number");
      return;
    }

    setErrorMessage("");
    setLoadingState(true);
    // Note: Don't dispatch global loading here as it causes RootNavigator to show loading screen
    // and unmount the navigation stack

    try {
      const fullPhoneNumber = `+91${phoneNumber.replace(/\D/g, "")}`;
      console.log("[Login] Sending OTP to:", fullPhoneNumber);

      if (Platform.OS === "web") {
        // Web: Use Firebase JS SDK directly
        if (!recaptchaVerifier.current) {
          throw new Error("Verification not ready. Please refresh the page.");
        }

        const confirmationResult = await signInWithPhoneNumber(
          auth,
          fullPhoneNumber,
          recaptchaVerifier.current
        );

        console.log("[Login] OTP sent successfully (web)");

        // Store confirmation result for verification
        navigation.navigate("OTPScreen", {
          verificationId: confirmationResult.verificationId,
          phoneNumber: fullPhoneNumber,
          isWeb: true,
        });

        // Store for later use
        window.confirmationResult = confirmationResult;
      } else {
        // Native: Use @react-native-firebase/auth
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
          // Pass the confirmation object reference for native
        });

        // Store globally for OTP verification
        global.phoneAuthConfirmation = confirmation;
      }
    } catch (error) {
      console.error("[Login] Error sending OTP:", error);
      const friendlyMessage = getErrorMessage(error);
      setErrorMessage(friendlyMessage);
      dispatch(setError(error.message));

      // Reset reCAPTCHA on web for retry
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

      // Show alert for mobile users
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Web reCAPTCHA Container */}
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
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Play Grid Logo */}
          <View style={styles.logoContainer}>
            <Image
              source={require("../../../assets/PlayGrid_Logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text variant="headlineMedium" style={styles.appName}>
              Play Grid
            </Text>
            <Text variant="bodyMedium" style={styles.tagline}>
              Book your favorite sports turf
            </Text>
          </View>

          {/* Login Form */}
          <Surface style={styles.formContainer} elevation={1}>
            <Text variant="titleLarge" style={styles.title}>
              Login / Sign Up
            </Text>
            <Text variant="bodyMedium" style={styles.subtitle}>
              Enter your phone number to continue
            </Text>

            <View style={styles.phoneInputContainer}>
              <Surface style={styles.countryCode} elevation={0}>
                <Text variant="bodyLarge" style={styles.countryCodeText}>
                  +91
                </Text>
              </Surface>
              <TextInput
                mode="outlined"
                label="Phone Number"
                placeholder="9999999999"
                placeholderTextColor="#BDBDBD"
                value={phoneNumber}
                onChangeText={handlePhoneChange}
                keyboardType="phone-pad"
                maxLength={10}
                style={styles.phoneInput}
                error={!!errorMessage}
                left={<TextInput.Icon icon="phone" />}
              />
            </View>

            {errorMessage ? (
              <Text variant="bodySmall" style={styles.errorText}>
                {errorMessage}
              </Text>
            ) : null}

            {!recaptchaReady && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#4CAF50" />
                <Text variant="bodySmall" style={styles.loadingText}>
                  Initializing verification...
                </Text>
              </View>
            )}

            <Button
              mode="contained"
              onPress={handleSendOTP}
              loading={loading}
              disabled={loading || phoneNumber.length !== 10 || !recaptchaReady}
              style={styles.button}
              contentStyle={styles.buttonContent}
            >
              {loading ? "Sending OTP..." : "Send OTP"}
            </Button>

            <Text variant="bodySmall" style={styles.termsText}>
              By continuing, you agree to our Terms of Service and Privacy
              Policy
            </Text>
          </Surface>
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
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 40,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 16,
  },
  appName: {
    fontFamily: "Ubuntu-Bold",
    color: "#2E7D32",
    marginBottom: 8,
  },
  tagline: {
    fontFamily: "Ubuntu-Regular",
    color: "#666",
    textAlign: "center",
  },
  formContainer: {
    padding: 24,
    borderRadius: 16,
    backgroundColor: "#fff",
  },
  title: {
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    textAlign: "center",
    color: "#666",
    marginBottom: 24,
  },
  phoneInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  countryCode: {
    height: 56,
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
    borderRadius: 4,
    marginRight: 8,
    marginTop: 6,
  },
  countryCodeText: {
    fontWeight: "600",
  },
  phoneInput: {
    flex: 1,
    backgroundColor: "#fff",
  },
  errorText: {
    color: "#F44336",
    marginBottom: 16,
    marginLeft: 4,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  loadingText: {
    marginLeft: 8,
    color: "#666",
  },
  button: {
    marginTop: 16,
    borderRadius: 8,
  },
  buttonContent: {
    height: 50,
  },
  termsText: {
    textAlign: "center",
    color: "#999",
    marginTop: 20,
    lineHeight: 18,
  },
});
