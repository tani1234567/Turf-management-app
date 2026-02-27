import storage from "@react-native-firebase/storage";
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";

// ─── Fraud Prevention Constants ──────────────────────────────
const CONSECUTIVE_REJECTION_BAN_THRESHOLD = 3;
const TEMP_BAN_DAYS = 7;

// ─── Fraud Prevention Helpers ────────────────────────────────

/**
 * Update user's payment history after a verification or rejection.
 * On rejection, auto-bans the user if consecutive rejections >= threshold.
 *
 * @param {string} userId - The user whose history to update
 * @param {boolean} isVerified - true if payment was verified, false if rejected
 * @returns {Promise<{autoBanned: boolean}>}
 */
async function updateUserPaymentHistory(userId, isVerified) {
  if (!userId) return { autoBanned: false };

  try {
    const userRef = firestore().collection("users").doc(userId);

    if (isVerified) {
      await userRef.update({
        "paymentHistory.totalSubmissions": firestore.FieldValue.increment(1),
        "paymentHistory.verifiedPayments": firestore.FieldValue.increment(1),
        "paymentHistory.consecutiveRejections": 0,
      });
      return { autoBanned: false };
    }

    // Rejection: read current state to check threshold
    const userSnap = await userRef.get();
    const userData = userSnap.exists ? userSnap.data() : {};
    const currentConsecutive =
      userData?.paymentHistory?.consecutiveRejections || 0;
    const newConsecutive = currentConsecutive + 1;

    const updateData = {
      "paymentHistory.totalSubmissions": firestore.FieldValue.increment(1),
      "paymentHistory.rejectedPayments": firestore.FieldValue.increment(1),
      "paymentHistory.consecutiveRejections": newConsecutive,
      "paymentHistory.lastRejectionDate":
        firestore.FieldValue.serverTimestamp(),
    };

    // Auto-ban after threshold consecutive rejections
    if (newConsecutive >= CONSECUTIVE_REJECTION_BAN_THRESHOLD) {
      const banEnd = new Date();
      banEnd.setDate(banEnd.getDate() + TEMP_BAN_DAYS);

      updateData["paymentHistory.isBanned"] = true;
      updateData["paymentHistory.banReason"] =
        "Multiple failed payment verifications";
      updateData["paymentHistory.banStartDate"] =
        firestore.FieldValue.serverTimestamp();
      updateData["paymentHistory.banEndDate"] =
        firestore.Timestamp.fromDate(banEnd);
      updateData["paymentHistory.bannedBy"] = "system";
    }

    await userRef.update(updateData);
    return { autoBanned: newConsecutive >= CONSECUTIVE_REJECTION_BAN_THRESHOLD };
  } catch (error) {
    console.error("[Fraud] Error updating payment history:", error);
    return { autoBanned: false };
  }
}

/**
 * Record a verified transaction ID on the company document.
 * Used to prevent duplicate transaction ID reuse.
 *
 * @param {string} companyId - Company that received the payment
 * @param {Object} txnRecord - Transaction record
 */
async function trackVerifiedTransaction(companyId, txnRecord) {
  if (!companyId || !txnRecord?.txnId) return;

  try {
    const companyRef = firestore().collection("companies").doc(companyId);
    await companyRef.update({
      verifiedTransactions: firestore.FieldValue.arrayUnion({
        txnId: txnRecord.txnId,
        date: (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })(),
        amount: txnRecord.amount || 0,
        bookingId: txnRecord.bookingId || "",
      }),
    });
  } catch (error) {
    console.error("[Fraud] Error tracking verified transaction:", error);
  }
}

// ─── Exported Fraud Prevention Utilities ─────────────────────

/**
 * Check if a transaction ID has already been used for a given company.
 *
 * @param {string} companyId - The company to check against
 * @param {string} transactionId - The UPI transaction ID to check
 * @returns {Promise<{isDuplicate: boolean}>}
 */
export async function checkTransactionIdReuse(companyId, transactionId) {
  if (!companyId || !transactionId) return { isDuplicate: false };

  try {
    const companyRef = firestore().collection("companies").doc(companyId);
    const companySnap = await companyRef.get();

    if (!companySnap.exists) return { isDuplicate: false };

    const companyData = companySnap.data();
    const verifiedTransactions = companyData?.verifiedTransactions || [];
    const isDuplicate = verifiedTransactions.some(
      (t) => t.txnId === transactionId
    );

    return { isDuplicate };
  } catch (error) {
    console.error("[Fraud] Error checking transaction reuse:", error);
    return { isDuplicate: false };
  }
}

/**
 * Check if a user is allowed to book based on their payment ban status.
 *
 * @param {Object} user - User object (from Redux / Firestore)
 * @returns {{allowed: boolean, reason?: string}}
 */
export function canUserBook(user) {
  if (!user?.paymentHistory?.isBanned) return { allowed: true };

  // Permanent ban (banEndDate is null)
  if (user.paymentHistory.banEndDate === null) {
    return {
      allowed: false,
      reason:
        "Your account has been permanently banned from making bookings due to payment violations.",
    };
  }

  // Check if temporary ban is still active
  const banEnd = user.paymentHistory.banEndDate?.toDate
    ? user.paymentHistory.banEndDate.toDate()
    : new Date(user.paymentHistory.banEndDate);

  if (banEnd > new Date()) {
    const dateStr = banEnd.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    return {
      allowed: false,
      reason: `Your account is temporarily banned from making bookings until ${dateStr}. Reason: ${user.paymentHistory.banReason || "Payment violations"}.`,
    };
  }

  // Ban has expired
  return { allowed: true };
}

// ─── Payment Operations ──────────────────────────────────────

/**
 * Upload payment proof screenshot to Firebase Storage
 * Uses React Native Firebase Storage for proper auth integration
 * @param {string} bookingId - The booking ID
 * @param {string} imageUri - Local URI of the image
 * @returns {Promise<string>} Download URL of uploaded image
 */
export async function uploadPaymentProof(bookingId, imageUri) {
  try {
    // Check if user is authenticated using React Native Firebase Auth
    const currentUser = auth().currentUser;
    console.log("Upload auth check - currentUser:", currentUser?.uid || "NOT LOGGED IN");

    if (!currentUser) {
      throw new Error("User not authenticated. Please log in again.");
    }

    const fileName = `payment_proof_${Date.now()}.jpg`;
    const storagePath = `bookings/${bookingId}/${fileName}`;

    console.log("Uploading to:", storagePath);

    // Use React Native Firebase Storage
    const reference = storage().ref(storagePath);
    await reference.putFile(imageUri);

    // Get download URL
    const downloadUrl = await reference.getDownloadURL();
    console.log("Upload successful, URL:", downloadUrl);

    return downloadUrl;
  } catch (error) {
    console.error("Error uploading payment proof:", error);
    throw error;
  }
}

/**
 * Submit payment for verification.
 * Checks for transaction ID reuse before accepting.
 *
 * @param {string} bookingId - The booking ID
 * @param {Object} paymentDetails - Payment details object
 * @param {string} paymentDetails.transactionId - UPI transaction ID
 * @param {string} paymentDetails.paidToUpiId - UPI ID payment was made to
 * @param {number} paymentDetails.amount - Amount paid
 * @param {Date} paymentDetails.paidAt - When payment was made
 * @param {string} paymentDetails.screenshotUrl - URL of payment proof screenshot
 */
export async function submitPaymentForVerification(bookingId, paymentDetails) {
  try {
    // Check auth state
    const currentUser = auth().currentUser;
    console.log("Firestore auth check - currentUser:", currentUser?.uid || "NOT LOGGED IN");

    if (!currentUser) {
      throw new Error("User not authenticated. Please log in again.");
    }

    const bookingRef = firestore().collection("bookings").doc(bookingId);

    // Get current booking to determine attempt number + companyId
    const bookingSnap = await bookingRef.get();
    const bookingData = bookingSnap.data();
    const currentAttempts = bookingData?.paymentAttempts?.length || 0;
    const companyId = bookingData?.companyId;

    // Transaction ID reuse check
    if (paymentDetails.transactionId && companyId) {
      const { isDuplicate } = await checkTransactionIdReuse(
        companyId,
        paymentDetails.transactionId
      );
      if (isDuplicate) {
        throw new Error(
          "This transaction ID has already been used. Please enter a different transaction ID."
        );
      }
    }

    const paymentAttempt = {
      attemptNumber: currentAttempts + 1,
      transactionId: paymentDetails.transactionId || "",
      screenshotUrl: paymentDetails.screenshotUrl || "",
      submittedAt: new Date().toISOString(),
      status: "submitted",
    };

    await bookingRef.update({
      status: "payment_submitted",
      "payment.advance.status": "submitted",
      "payment.advance.upiDetails": {
        transactionId: paymentDetails.transactionId || "",
        paidToUpiId: paymentDetails.paidToUpiId || "",
        paidFromUpiId: paymentDetails.paidFromUpiId || null,
        amount: paymentDetails.amount || 0,
        paidAt: paymentDetails.paidAt || new Date().toISOString(),
        screenshotUrl: paymentDetails.screenshotUrl || "",
      },
      "payment.advance.submittedAt": firestore.FieldValue.serverTimestamp(),
      // Convert soft lock to hard lock
      "slotLock.isLocked": true,
      "slotLock.lockType": "hard",
      "slotLock.lockedAt": new Date().toISOString(),
      "slotLock.lockExpiry": null,
      "slotLock.lockReason": "payment_submitted",
      paymentAttempts: firestore.FieldValue.arrayUnion(paymentAttempt),
      statusHistory: firestore.FieldValue.arrayUnion({
        status: "payment_submitted",
        timestamp: new Date().toISOString(),
        changedBy: "user",
        reason: "Payment proof submitted for verification",
      }),
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });

    return { success: true, attemptNumber: currentAttempts + 1 };
  } catch (error) {
    console.error("Error submitting payment for verification:", error);
    throw error;
  }
}

/**
 * Get booking payment status
 * @param {string} bookingId - The booking ID
 * @returns {Promise<Object>} Payment status object
 */
export async function getBookingPaymentStatus(bookingId) {
  try {
    const bookingRef = firestore().collection("bookings").doc(bookingId);
    const bookingSnap = await bookingRef.get();

    if (!bookingSnap.exists) {
      throw new Error("Booking not found");
    }

    const booking = bookingSnap.data();
    return {
      status: booking.status,
      payment: booking.payment,
      paymentAttempts: booking.paymentAttempts || [],
    };
  } catch (error) {
    console.error("Error getting booking payment status:", error);
    throw error;
  }
}

/**
 * Verify payment (Manager action).
 * Also updates user's payment history (resets consecutive rejections)
 * and records the transaction ID to prevent reuse.
 *
 * @param {string} bookingId - The booking ID
 * @param {string} verifierId - ID of the manager/owner verifying
 * @param {string} verifierRole - Role of the verifier ("manager" | "owner")
 * @param {string} [note] - Optional verification note
 * @param {boolean} [autoApprove] - Auto-confirm the booking (default true)
 */
export async function verifyPayment(bookingId, verifierId, verifierRole, note = "", autoApprove = true) {
  try {
    const bookingRef = firestore().collection("bookings").doc(bookingId);
    const bookingSnap = await bookingRef.get();
    const bookingData = bookingSnap.data();

    // Auto-approve: set status to confirmed directly after payment verification
    const nextStatus = autoApprove ? "confirmed" : "pending";

    // Calculate updated payment totals after advance verification
    const advanceAmount = bookingData?.payment?.advanceAmount || 0;
    const slotAmount = bookingData?.totalAmount || bookingData?.payment?.slotAmount || 0;
    const previousTotalPaid = bookingData?.payment?.totalPaid || 0;
    const newTotalPaid = previousTotalPaid + advanceAmount;
    const newRemainingAmount = Math.max(0, slotAmount - advanceAmount);

    await bookingRef.update({
      status: nextStatus,
      "payment.advance.status": "verified",
      "payment.advance.verification": {
        isVerified: true,
        verifiedBy: verifierId,
        verifiedByRole: verifierRole,
        verifiedAt: firestore.FieldValue.serverTimestamp(),
        verificationNote: note,
      },
      // Update remaining amount after advance is verified
      "payment.remainingAmount": newRemainingAmount,
      // Update V2.1 aggregate payment fields
      "payment.totalPaid": newTotalPaid,
      "payment.totalPending": Math.max(0, slotAmount - newTotalPaid),
      "payment.isFullyPaid": newTotalPaid >= slotAmount,
      // Hard lock on verification (confirmed)
      "slotLock.isLocked": true,
      "slotLock.lockType": "hard",
      "slotLock.lockedAt": new Date().toISOString(),
      "slotLock.lockExpiry": null,
      "slotLock.lockReason": autoApprove ? "approved" : "payment_submitted",
      // Add approval details if auto-approved
      ...(autoApprove && {
        approvedBy: verifierId,
        approvedAt: new Date().toISOString(),
      }),
      statusHistory: firestore.FieldValue.arrayUnion({
        status: "payment_verified",
        timestamp: new Date().toISOString(),
        changedBy: verifierId,
        reason: "Payment verified",
      }),
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });

    // Add confirmed status to history if auto-approved
    if (autoApprove) {
      await bookingRef.update({
        statusHistory: firestore.FieldValue.arrayUnion({
          status: "confirmed",
          timestamp: new Date().toISOString(),
          changedBy: verifierId,
          reason: "Auto-approved after payment verification",
        }),
      });
    }

    // Fraud tracking: update user payment history (reset consecutive rejections)
    const userId = bookingData?.userId;
    if (userId) {
      await updateUserPaymentHistory(userId, true);
    }

    // Track verified transaction ID to prevent reuse
    const companyId = bookingData?.companyId;
    const transactionId = bookingData?.payment?.advance?.upiDetails?.transactionId;
    if (companyId && transactionId) {
      await trackVerifiedTransaction(companyId, {
        txnId: transactionId,
        amount: advanceAmount,
        bookingId,
      });
    }

    return { success: true, newStatus: nextStatus };
  } catch (error) {
    console.error("Error verifying payment:", error);
    throw error;
  }
}

/**
 * Release a slot lock (cancel pending payment booking)
 * Called when user leaves the UPI payment screen or timer expires
 * @param {string} bookingId - The booking ID
 */
export async function releaseSlotLock(bookingId) {
  try {
    const bookingRef = firestore().collection("bookings").doc(bookingId);
    const bookingSnap = await bookingRef.get();

    if (!bookingSnap.exists) return;

    const bookingData = bookingSnap.data();

    // Only release if booking is still in pending_payment status
    if (bookingData.status !== "pending_payment") return;

    await bookingRef.update({
      status: "cancelled",
      "payment.advance.status": "expired",
      "payment.advance.isExpired": true,
      // Release slot lock
      "slotLock.isLocked": false,
      "slotLock.lockType": null,
      "slotLock.lockExpiry": null,
      "slotLock.lockReason": null,
      statusHistory: firestore.FieldValue.arrayUnion({
        status: "cancelled",
        timestamp: new Date().toISOString(),
        changedBy: "system",
        reason: "Payment timeout - slot lock released",
      }),
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error("Error releasing slot lock:", error);
  }
}

/**
 * Reject payment (Manager action).
 * Also updates user's payment history and may auto-ban the user
 * if consecutive rejections exceed the threshold.
 *
 * @param {string} bookingId - The booking ID
 * @param {string} verifierId - ID of the manager/owner rejecting
 * @param {string} verifierRole - Role of the verifier ("manager" | "owner")
 * @param {string} reason - Rejection reason
 */
export async function rejectPayment(bookingId, verifierId, verifierRole, reason) {
  try {
    const bookingRef = firestore().collection("bookings").doc(bookingId);
    const bookingSnap = await bookingRef.get();
    const bookingData = bookingSnap.data();

    const currentAttempts = bookingData?.paymentAttempts?.length || 0;

    // Update the latest payment attempt status
    const updatedAttempts = [...(bookingData.paymentAttempts || [])];
    if (updatedAttempts.length > 0) {
      updatedAttempts[updatedAttempts.length - 1].status = "rejected";
      updatedAttempts[updatedAttempts.length - 1].rejectionReason = reason;
    }

    await bookingRef.update({
      status: "payment_rejected",
      "payment.advance.status": "rejected",
      "payment.advance.verification": {
        isVerified: false,
        verifiedBy: verifierId,
        verifiedByRole: verifierRole,
        verifiedAt: firestore.FieldValue.serverTimestamp(),
        rejectionReason: reason,
        attemptNumber: currentAttempts,
      },
      // Release lock on payment rejection (user can retry)
      "slotLock.isLocked": false,
      "slotLock.lockType": null,
      "slotLock.lockExpiry": null,
      "slotLock.lockReason": null,
      paymentAttempts: updatedAttempts,
      statusHistory: firestore.FieldValue.arrayUnion({
        status: "payment_rejected",
        timestamp: new Date().toISOString(),
        changedBy: verifierId,
        reason: `Payment rejected: ${reason}`,
      }),
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });

    // Fraud tracking: update user payment history (increment consecutive rejections)
    const userId = bookingData?.userId;
    let autoBanned = false;
    if (userId) {
      const result = await updateUserPaymentHistory(userId, false);
      autoBanned = result.autoBanned;
    }

    return { success: true, attemptNumber: currentAttempts, autoBanned };
  } catch (error) {
    console.error("Error rejecting payment:", error);
    throw error;
  }
}
