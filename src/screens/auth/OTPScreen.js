import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TextInput as RNTextInput,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { PhoneAuthProvider, signInWithCredential } from "firebase/auth";
import { auth } from "../../services/firebase/config";
import { useAppDispatch } from "../../hooks";

import { setUser, setLoading, setError } from "../../store/slices/authSlice";
import { getDocument } from "../../services/firebase/firestore";

const BRAND_GREEN = "#16A34A";
const BRAND_DARK = "#14532D";
const PALE_GREEN = "#F0FDF4";
const DANGER_RED = "#EF4444";
const GRAY_TEXT = "#6B7280";

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
    if (value && !/^\d$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setErrorMessage("");
    if (value && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e, index) => {
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
        if (window.confirmationResult) {
          userCredential = await window.confirmationResult.confirm(otpString);
        } else {
          const credential = PhoneAuthProvider.credential(verificationId, otpString);
          userCredential = await signInWithCredential(auth, credential);
        }
      } else {
        if (global.phoneAuthConfirmation) {
          try {
            userCredential = await global.phoneAuthConfirmation.confirm(otpString);
          } catch (confirmError) {
            if (confirmError.code === "auth/keychain-error") {
              // iOS simulator (and some EAS builds) can't write to the system
              // keychain. Fall back to the web Firebase SDK which persists
              // auth state via AsyncStorage — no keychain needed.
              console.warn("[OTP] Keychain unavailable — falling back to web SDK auth");
              const { PhoneAuthProvider, signInWithCredential: webSignIn } =
                require("firebase/auth");
              const { auth: webAuth } = require("../../services/firebase/config");
              const credential = PhoneAuthProvider.credential(verificationId, otpString);
              userCredential = await webSignIn(webAuth, credential);
            } else {
              throw confirmError;
            }
          }
        } else {
          throw new Error("Phone authentication session expired. Please try again.");
        }
      }

      const userId = userCredential.user.uid;
      console.log("[OTP] Verification successful, userId:", userId);

      const userData = await getDocument("users", userId);

      if (userData && userData.role) {
        dispatch(setUser(userData));
      } else {
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
      } else if (error.code === "auth/keychain-error") {
        friendlyMessage = "A device security error occurred. Please restart the app and try again.";
      } else if (error.message) {
        friendlyMessage = error.message;
      }

      setErrorMessage(friendlyMessage);
      dispatch(setError(error.message));
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setLoadingState(false);
      dispatch(setLoading(false));
    }
  };

  const handleResendOTP = () => {
    if (Platform.OS !== "web") {
      global.phoneAuthConfirmation = null;
    }
    navigation.goBack();
  };

  const formatPhoneDisplay = (phone) => {
    const digits = phone.replace(/\D/g, "");
    const last10 = digits.slice(-10);
    return `+91 ${last10.slice(0, 5)} ${last10.slice(5)}`;
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        {/* Back Button */}
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="arrow-left" size={22} color="#374151" />
        </TouchableOpacity>

        <View style={styles.content}>
          {/* Brand mark */}
          <View style={styles.brandRow}>
            <Image
              source={require("../../../assets/SS_Logo.png")}
              style={styles.brandLogo}
              resizeMode="cover"
            />
            <Text style={styles.brandName}>SportSwift</Text>
          </View>

          {/* Phone display */}
          <Text style={styles.phoneDisplay}>{formatPhoneDisplay(phoneNumber)}</Text>
          <Text style={styles.subtitle}>We sent a 6-digit code to this number</Text>

          {/* OTP Boxes */}
          <View style={styles.otpRow}>
            {otp.map((digit, index) => (
              <RNTextInput
                key={index}
                ref={(ref) => (inputRefs.current[index] = ref)}
                style={[
                  styles.otpBox,
                  digit ? styles.otpBoxFilled : null,
                  errorMessage ? styles.otpBoxError : null,
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

          {/* Error Card */}
          {!!errorMessage && (
            <View style={styles.errorCard}>
              <Text style={styles.errorCardText}>{errorMessage}</Text>
            </View>
          )}

          {/* Verify Button */}
          <TouchableOpacity
            style={[
              styles.verifyButton,
              (loading || otp.join("").length !== OTP_LENGTH) && styles.verifyButtonDisabled,
            ]}
            onPress={handleVerifyOTP}
            disabled={loading || otp.join("").length !== OTP_LENGTH}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.verifyButtonText}>Verify OTP</Text>
            )}
          </TouchableOpacity>

          {/* Resend Row */}
          <View style={styles.resendRow}>
            {canResend ? (
              <TouchableOpacity onPress={handleResendOTP} activeOpacity={0.7}>
                <Text style={styles.resendText}>
                  <Text style={styles.resendGray}>Didn't receive it? </Text>
                  <Text style={styles.resendLink}>Resend OTP</Text>
                </Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.timerText}>Resend in ({resendTimer}s)</Text>
            )}
          </View>

          {/* Help text */}
          <Text style={styles.helpText}>
            Make sure you entered the correct phone number and check your SMS inbox.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  keyboardView: {
    flex: 1,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 16,
    marginTop: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginBottom: 24,
  },
  brandLogo: {
    width: 20,
    height: 20,
    borderRadius: 5,
  },
  brandName: {
    fontFamily: "Ubuntu-Medium",
    fontSize: 14,
    color: BRAND_DARK,
  },
  phoneDisplay: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 22,
    color: BRAND_DARK,
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 14,
    color: GRAY_TEXT,
    textAlign: "center",
    marginBottom: 32,
  },
  otpRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  otpBox: {
    width: 48,
    height: 56,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    fontFamily: "Ubuntu-Bold",
    fontSize: 24,
    textAlign: "center",
    color: BRAND_DARK,
  },
  otpBoxFilled: {
    borderColor: BRAND_GREEN,
    backgroundColor: PALE_GREEN,
  },
  otpBoxError: {
    borderColor: DANGER_RED,
    backgroundColor: "#FEF2F2",
  },
  errorCard: {
    borderLeftWidth: 4,
    borderLeftColor: DANGER_RED,
    backgroundColor: "#FEF2F2",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorCardText: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 13,
    color: DANGER_RED,
  },
  verifyButton: {
    backgroundColor: BRAND_GREEN,
    borderRadius: 12,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  verifyButtonDisabled: {
    backgroundColor: "#86EFAC",
  },
  verifyButtonText: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 15,
    color: "#fff",
  },
  resendRow: {
    marginTop: 20,
    alignItems: "center",
  },
  timerText: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 14,
    color: GRAY_TEXT,
  },
  resendText: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 14,
  },
  resendGray: {
    color: GRAY_TEXT,
  },
  resendLink: {
    fontFamily: "Ubuntu-Bold",
    color: BRAND_GREEN,
  },
  helpText: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 12,
    color: GRAY_TEXT,
    textAlign: "center",
    marginTop: 12,
    lineHeight: 18,
  },
});
