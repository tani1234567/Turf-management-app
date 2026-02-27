import { Linking } from "react-native";

/**
 * UPI Payment Utilities
 * Handles UPI deep links and app integrations for payments
 */

/**
 * Generate UPI deep link URL
 * @param {Object} params - Payment parameters
 * @param {string} params.upiId - Payee UPI ID (e.g., business@ybl)
 * @param {string} params.name - Payee display name
 * @param {number} params.amount - Payment amount
 * @param {string} [params.transactionNote] - Optional transaction note
 * @param {string} [params.bookingId] - Booking ID for reference
 * @returns {string} UPI deep link URL
 */
export function generateUpiUrl({ upiId, name, amount, transactionNote, bookingId }) {
  const params = new URLSearchParams({
    pa: upiId,                                        // Payee UPI ID
    pn: name,                                         // Payee Name
    am: amount.toString(),                            // Amount
    cu: "INR",                                        // Currency
    tn: transactionNote || `Booking ${bookingId}`,    // Transaction Note
    tr: bookingId || "",                              // Transaction Reference
  });
  return `upi://pay?${params.toString()}`;
}

/**
 * Check if device can open UPI apps
 * @returns {Promise<boolean>} True if UPI apps are available
 */
export async function canOpenUpi() {
  try {
    const upiUrl = "upi://pay?pa=test@upi&am=1";
    return await Linking.canOpenURL(upiUrl);
  } catch (error) {
    console.error("Error checking UPI availability:", error);
    return false;
  }
}

/**
 * Open UPI app with pre-filled payment details
 * @param {Object} params - Payment parameters
 * @param {string} params.upiId - Payee UPI ID
 * @param {string} params.name - Payee display name
 * @param {number} params.amount - Payment amount
 * @param {string} [params.transactionNote] - Optional transaction note
 * @param {string} [params.bookingId] - Booking ID for reference
 * @returns {Promise<{success: boolean, error?: string}>} Result object
 */
export async function openUpiApp({ upiId, name, amount, transactionNote, bookingId }) {
  const upiUrl = generateUpiUrl({ upiId, name, amount, transactionNote, bookingId });

  try {
    const canOpen = await Linking.canOpenURL(upiUrl);
    if (canOpen) {
      await Linking.openURL(upiUrl);
      return { success: true };
    }
    return { success: false, error: "NO_UPI_APP" };
  } catch (error) {
    console.error("Error opening UPI app:", error);
    return { success: false, error: "OPEN_FAILED" };
  }
}

/**
 * Get UPI error message for display
 * @param {string} errorCode - Error code from openUpiApp
 * @returns {string} User-friendly error message
 */
export function getUpiErrorMessage(errorCode) {
  switch (errorCode) {
    case "NO_UPI_APP":
      return "No UPI app found on your device. Please install Google Pay, PhonePe, or Paytm.";
    case "OPEN_FAILED":
      return "Failed to open UPI app. Please try again or use the QR code.";
    default:
      return "Something went wrong. Please try again.";
  }
}

/**
 * Generate unique transaction reference
 * @param {string} [prefix='TXN'] - Prefix for the reference (e.g., 'SUB', 'BKG')
 * @returns {string} Unique transaction reference string
 */
export function generateTransactionRef(prefix = "TXN") {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  return `${prefix}_${timestamp}_${random}`;
}
