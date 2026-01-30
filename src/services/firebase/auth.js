import {
  PhoneAuthProvider,
  signInWithCredential,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from "firebase/auth";
import { auth } from "./config";

/**
 * Firebase Auth Error Codes and user-friendly messages
 */
const AUTH_ERROR_MESSAGES = {
  "auth/invalid-phone-number": "Invalid phone number format.",
  "auth/too-many-requests": "Too many attempts. Please try again later.",
  "auth/quota-exceeded": "SMS quota exceeded. Please try again later.",
  "auth/captcha-check-failed": "Verification failed. Please try again.",
  "auth/missing-phone-number": "Phone number is required.",
  "auth/user-disabled": "This account has been disabled.",
  "auth/operation-not-allowed": "Phone authentication is not enabled.",
  "auth/invalid-verification-code": "Invalid OTP code. Please check and try again.",
  "auth/invalid-verification-id": "Verification expired. Please request a new OTP.",
  "auth/code-expired": "OTP has expired. Please request a new one.",
  "auth/missing-verification-code": "Please enter the OTP code.",
  "auth/missing-verification-id": "Verification session expired. Please try again.",
  "auth/network-request-failed": "Network error. Please check your connection.",
};

/**
 * Get user-friendly error message
 */
const getAuthErrorMessage = (error) => {
  const code = error.code || "";
  return AUTH_ERROR_MESSAGES[code] || error.message || "An error occurred. Please try again.";
};

/**
 * Send OTP to phone number
 * @param {string} phoneNumber - Phone number with country code (e.g., +91XXXXXXXXXX)
 * @param {object} recaptchaVerifier - RecaptchaVerifier instance
 * @returns {Promise<string>} - Verification ID
 */
export const sendOTP = async (phoneNumber, recaptchaVerifier) => {
  try {
    if (!phoneNumber) {
      throw { code: "auth/missing-phone-number", message: "Phone number is required" };
    }

    if (!recaptchaVerifier) {
      throw { code: "auth/captcha-check-failed", message: "reCAPTCHA verifier not initialized" };
    }

    console.log("[Auth] Initiating OTP send to:", phoneNumber);

    const phoneProvider = new PhoneAuthProvider(auth);
    const verificationId = await phoneProvider.verifyPhoneNumber(
      phoneNumber,
      recaptchaVerifier
    );

    console.log("[Auth] OTP sent successfully");
    return verificationId;
  } catch (error) {
    console.error("[Auth] Error sending OTP:", error.code, error.message);

    // Enhance error with user-friendly message
    error.friendlyMessage = getAuthErrorMessage(error);
    throw error;
  }
};

/**
 * Verify OTP and sign in user
 * @param {string} verificationId - Verification ID from sendOTP
 * @param {string} code - OTP code entered by user
 * @returns {Promise<object>} - User credential
 */
export const verifyOTP = async (verificationId, code) => {
  try {
    if (!verificationId) {
      throw { code: "auth/missing-verification-id", message: "Verification ID is missing" };
    }

    if (!code || code.length !== 6) {
      throw { code: "auth/missing-verification-code", message: "Please enter a valid 6-digit OTP" };
    }

    console.log("[Auth] Verifying OTP...");

    const credential = PhoneAuthProvider.credential(verificationId, code);
    const userCredential = await signInWithCredential(auth, credential);

    console.log("[Auth] OTP verified successfully, user:", userCredential.user.uid);
    return userCredential;
  } catch (error) {
    console.error("[Auth] Error verifying OTP:", error.code, error.message);

    // Enhance error with user-friendly message
    error.friendlyMessage = getAuthErrorMessage(error);
    throw error;
  }
};

/**
 * Sign out current user
 * @returns {Promise<void>}
 */
export const signOut = async () => {
  try {
    console.log("[Auth] Signing out user...");
    await firebaseSignOut(auth);
    console.log("[Auth] User signed out successfully");
  } catch (error) {
    console.error("[Auth] Error signing out:", error.code, error.message);
    error.friendlyMessage = getAuthErrorMessage(error);
    throw error;
  }
};

/**
 * Subscribe to auth state changes
 * @param {function} callback - Callback function receiving user object
 * @returns {function} - Unsubscribe function
 */
export const subscribeToAuthState = (callback) => {
  return onAuthStateChanged(auth, callback);
};

/**
 * Get current user
 * @returns {object|null} - Current user or null
 */
export const getCurrentUser = () => {
  return auth.currentUser;
};
