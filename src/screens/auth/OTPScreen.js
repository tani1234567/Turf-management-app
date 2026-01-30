import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TextInput as RNTextInput,
} from "react-native";
import {
  Text,
  Button,
  Surface,
  IconButton,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { PhoneAuthProvider, signInWithCredential } from "firebase/auth";
import { auth } from "../../services/firebase/config";
import { useAppDispatch } from "../../hooks";
import { setUser, setLoading, setError } from "../../store/slices/authSlice";
import { getDocument } from "../../services/firebase/firestore";

const OTP_LENGTH = 6;
const RESEND_TIMER = 30;

export default function OTPScreen({ route, navigation }) {
  const dispatch = useAppDispatch();
  const { verificationId, phoneNumber, isWeb } = route.params;

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoadingState] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [resendTimer, setResendTimer] = useState(RESEND_TIMER);
  const [canResend, setCanResend] = useState(false);

  const inputRefs = useRef([]);

  // Resend timer countdown
  useEffect(() => {
    let interval;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    } else {
      setCanResend(true);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  // Auto-verify when all digits entered
  useEffect(() => {
    const otpString = otp.join("");
    if (otpString.length === OTP_LENGTH) {
      handleVerifyOTP();
    }
  }, [otp]);

  const handleOtpChange = (value, index) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setErrorMessage("");

    // Move to next input
    if (value && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e, index) => {
    // Handle backspace
    if (e.nativeEvent.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      const newOtp = [...otp];
      newOtp[index - 1] = "";
      setOtp(newOtp);
    }
  };

  const handleVerifyOTP = async () => {
    const otpString = otp.join("");
    if (otpString.length !== OTP_LENGTH) {
      setErrorMessage("Please enter the complete OTP");
      return;
    }

    setLoadingState(true);
    dispatch(setLoading(true));
    setErrorMessage("");

    try {
      let userCredential;

      if (Platform.OS === "web" || isWeb) {
        // Web: Use Firebase JS SDK
        if (window.confirmationResult) {
          userCredential = await window.confirmationResult.confirm(otpString);
        } else {
          // Fallback to credential-based verification
          const credential = PhoneAuthProvider.credential(verificationId, otpString);
          userCredential = await signInWithCredential(auth, credential);
        }
      } else {
        // Native: Use @react-native-firebase confirmation
        if (global.phoneAuthConfirmation) {
          userCredential = await global.phoneAuthConfirmation.confirm(otpString);
        } else {
          throw new Error("Phone authentication session expired. Please try again.");
        }
      }

      const userId = userCredential.user.uid;
      console.log("[OTP] Verification successful, userId:", userId);

      // Check if user exists in Firestore
      const userData = await getDocument("users", userId);

      if (userData && userData.role) {
        // Existing user with role - go to main app
        dispatch(setUser(userData));
        // Navigation will be handled by AppNavigator based on auth state
      } else {
        // New user or user without role - go to role selection
        dispatch(
          setUser({
            userId,
            phone: phoneNumber,
            isNewUser: true,
          })
        );
        navigation.replace("RoleSelectionScreen", { userId, phoneNumber });
      }
    } catch (error) {
      console.error("[OTP] Error verifying OTP:", error);

      let friendlyMessage = "Invalid OTP. Please try again.";
      if (error.code === "auth/invalid-verification-code") {
        friendlyMessage = "Invalid OTP code. Please check and try again.";
      } else if (error.code === "auth/code-expired") {
        friendlyMessage = "OTP has expired. Please request a new one.";
      } else if (error.message) {
        friendlyMessage = error.message;
      }

      setErrorMessage(friendlyMessage);
      dispatch(setError(error.message));
      // Clear OTP on error
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setLoadingState(false);
      dispatch(setLoading(false));
    }
  };

  const handleResendOTP = () => {
    // Clear the global confirmation object
    if (Platform.OS !== "web") {
      global.phoneAuthConfirmation = null;
    }
    // Go back to login to resend OTP
    navigation.goBack();
  };

  const formatPhoneNumber = (phone) => {
    // Format: +91 98765 43210
    const digits = phone.replace(/\D/g, "");
    const last10 = digits.slice(-10);
    return `+91 ${last10.slice(0, 5)} ${last10.slice(5)}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        {/* Back Button */}
        <IconButton
          icon="arrow-left"
          size={24}
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        />

        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Text variant="headlineSmall" style={styles.title}>
              Verify Phone Number
            </Text>
            <Text variant="bodyMedium" style={styles.subtitle}>
              Enter the 6-digit code sent to
            </Text>
            <Text variant="bodyLarge" style={styles.phoneNumber}>
              {formatPhoneNumber(phoneNumber)}
            </Text>
          </View>

          {/* OTP Input */}
          <Surface style={styles.otpContainer} elevation={1}>
            <View style={styles.otpInputsRow}>
              {otp.map((digit, index) => (
                <RNTextInput
                  key={index}
                  ref={(ref) => (inputRefs.current[index] = ref)}
                  style={[
                    styles.otpInput,
                    digit ? styles.otpInputFilled : null,
                    errorMessage ? styles.otpInputError : null,
                  ]}
                  value={digit}
                  onChangeText={(value) => handleOtpChange(value, index)}
                  onKeyPress={(e) => handleKeyPress(e, index)}
                  keyboardType="number-pad"
                  maxLength={1}
                  selectTextOnFocus
                />
              ))}
            </View>

            {errorMessage ? (
              <Text variant="bodySmall" style={styles.errorText}>
                {errorMessage}
              </Text>
            ) : null}

            <Button
              mode="contained"
              onPress={handleVerifyOTP}
              loading={loading}
              disabled={loading || otp.join("").length !== OTP_LENGTH}
              style={styles.verifyButton}
              contentStyle={styles.buttonContent}
            >
              {loading ? "Verifying..." : "Verify OTP"}
            </Button>

            {/* Resend OTP */}
            <View style={styles.resendContainer}>
              {canResend ? (
                <Button
                  mode="text"
                  onPress={handleResendOTP}
                  style={styles.resendButton}
                >
                  Resend OTP
                </Button>
              ) : (
                <Text variant="bodyMedium" style={styles.timerText}>
                  Resend OTP in {resendTimer}s
                </Text>
              )}
            </View>
          </Surface>

          {/* Help Text */}
          <Text variant="bodySmall" style={styles.helpText}>
            Didn't receive the code? Make sure you entered the correct phone
            number and check your SMS inbox.
          </Text>
        </View>
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
  backButton: {
    alignSelf: "flex-start",
    margin: 8,
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  title: {
    fontWeight: "bold",
    marginBottom: 8,
  },
  subtitle: {
    color: "#666",
  },
  phoneNumber: {
    fontWeight: "600",
    color: "#333",
    marginTop: 4,
  },
  otpContainer: {
    padding: 24,
    borderRadius: 16,
    backgroundColor: "#fff",
    alignItems: "center",
  },
  otpInputsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
  },
  otpInput: {
    width: 45,
    height: 55,
    borderWidth: 2,
    borderColor: "#ddd",
    borderRadius: 12,
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    backgroundColor: "#fafafa",
  },
  otpInputFilled: {
    borderColor: "#4CAF50",
    backgroundColor: "#E8F5E9",
  },
  otpInputError: {
    borderColor: "#F44336",
    backgroundColor: "#FFEBEE",
  },
  errorText: {
    color: "#F44336",
    marginTop: 16,
    textAlign: "center",
  },
  verifyButton: {
    marginTop: 24,
    width: "100%",
    borderRadius: 8,
  },
  buttonContent: {
    height: 50,
  },
  resendContainer: {
    marginTop: 20,
    alignItems: "center",
  },
  resendButton: {
    marginTop: -8,
  },
  timerText: {
    color: "#666",
  },
  helpText: {
    textAlign: "center",
    color: "#999",
    marginTop: 24,
    lineHeight: 18,
    paddingHorizontal: 20,
  },
});
