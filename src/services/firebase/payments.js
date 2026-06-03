import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  increment,
  arrayUnion,
  Timestamp,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage, auth } from "./config";

// ─── Fraud Prevention Constants ──────────────────────────────
const CONSECUTIVE_REJECTION_BAN_THRESHOLD = 3;
const TEMP_BAN_DAYS = 7;

// ─── Fraud Prevention Helpers ────────────────────────────────

async function updateUserPaymentHistory(userId, isVerified) {
  if (!userId) return { autoBanned: false };

  try {
    const userRef = doc(db, "users", userId);

    if (isVerified) {
      await updateDoc(userRef, {
        "paymentHistory.totalSubmissions": increment(1),
        "paymentHistory.verifiedPayments": increment(1),
        "paymentHistory.consecutiveRejections": 0,
      });
      return { autoBanned: false };
    }

    const userSnap = await getDoc(userRef);
    const userData = userSnap.exists() ? userSnap.data() : {};
    const currentConsecutive = userData?.paymentHistory?.consecutiveRejections || 0;
    const newConsecutive = currentConsecutive + 1;

    const updateData = {
      "paymentHistory.totalSubmissions": increment(1),
      "paymentHistory.rejectedPayments": increment(1),
      "paymentHistory.consecutiveRejections": newConsecutive,
      "paymentHistory.lastRejectionDate": serverTimestamp(),
    };

    if (newConsecutive >= CONSECUTIVE_REJECTION_BAN_THRESHOLD) {
      const banEnd = new Date();
      banEnd.setDate(banEnd.getDate() + TEMP_BAN_DAYS);
      updateData["paymentHistory.isBanned"] = true;
      updateData["paymentHistory.banReason"] = "Multiple failed payment verifications";
      updateData["paymentHistory.banStartDate"] = serverTimestamp();
      updateData["paymentHistory.banEndDate"] = Timestamp.fromDate(banEnd);
      updateData["paymentHistory.bannedBy"] = "system";
    }

    await updateDoc(userRef, updateData);
    return { autoBanned: newConsecutive >= CONSECUTIVE_REJECTION_BAN_THRESHOLD };
  } catch (error) {
    console.error("[Fraud] Error updating payment history:", error);
    return { autoBanned: false };
  }
}

async function trackVerifiedTransaction(companyId, txnRecord) {
  if (!companyId || !txnRecord?.txnId) return;
  try {
    const companyRef = doc(db, "companies", companyId);
    const d = new Date();
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    await updateDoc(companyRef, {
      verifiedTransactions: arrayUnion({
        txnId: txnRecord.txnId,
        date: dateStr,
        amount: txnRecord.amount || 0,
        bookingId: txnRecord.bookingId || "",
      }),
    });
  } catch (error) {
    console.error("[Fraud] Error tracking verified transaction:", error);
  }
}

// ─── Exported Fraud Prevention Utilities ─────────────────────

export async function checkTransactionIdReuse(companyId, transactionId) {
  if (!companyId || !transactionId) return { isDuplicate: false };
  try {
    const companyRef = doc(db, "companies", companyId);
    const companySnap = await getDoc(companyRef);
    if (!companySnap.exists()) return { isDuplicate: false };
    const verifiedTransactions = companySnap.data()?.verifiedTransactions || [];
    return { isDuplicate: verifiedTransactions.some((t) => t.txnId === transactionId) };
  } catch (error) {
    console.error("[Fraud] Error checking transaction reuse:", error);
    return { isDuplicate: false };
  }
}

export function canUserBook(user) {
  if (!user?.paymentHistory?.isBanned) return { allowed: true };

  if (user.paymentHistory.banEndDate === null) {
    return {
      allowed: false,
      reason: "Your account has been permanently banned from making bookings due to payment violations.",
    };
  }

  const banEnd = user.paymentHistory.banEndDate?.toDate
    ? user.paymentHistory.banEndDate.toDate()
    : new Date(user.paymentHistory.banEndDate);

  if (banEnd > new Date()) {
    const dateStr = banEnd.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    return {
      allowed: false,
      reason: `Your account is temporarily banned from making bookings until ${dateStr}. Reason: ${user.paymentHistory.banReason || "Payment violations"}.`,
    };
  }

  return { allowed: true };
}

// ─── Payment Operations ──────────────────────────────────────

export async function uploadPaymentProof(bookingId, imageUri) {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("User not authenticated. Please log in again.");

    const fileName = `payment_proof_${Date.now()}.jpg`;
    const storagePath = `bookings/${bookingId}/${fileName}`;

    // Fetch the local file as a blob (works on both web and React Native)
    const response = await fetch(imageUri);
    const blob = await response.blob();

    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, blob);
    const downloadUrl = await getDownloadURL(storageRef);

    console.log("Upload successful, URL:", downloadUrl);
    return downloadUrl;
  } catch (error) {
    console.error("Error uploading payment proof:", error);
    throw error;
  }
}

export async function submitPaymentForVerification(bookingId, paymentDetails) {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("User not authenticated. Please log in again.");

    const bookingRef = doc(db, "bookings", bookingId);
    const bookingSnap = await getDoc(bookingRef);
    const bookingData = bookingSnap.data();
    const currentAttempts = bookingData?.paymentAttempts?.length || 0;
    const companyId = bookingData?.companyId;

    if (paymentDetails.transactionId && companyId) {
      const { isDuplicate } = await checkTransactionIdReuse(companyId, paymentDetails.transactionId);
      if (isDuplicate) {
        throw new Error("This transaction ID has already been used. Please enter a different transaction ID.");
      }
    }

    const paymentAttempt = {
      attemptNumber: currentAttempts + 1,
      transactionId: paymentDetails.transactionId || "",
      screenshotUrl: paymentDetails.screenshotUrl || "",
      submittedAt: new Date().toISOString(),
      status: "submitted",
    };

    await updateDoc(bookingRef, {
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
      "payment.advance.submittedAt": serverTimestamp(),
      "slotLock.isLocked": true,
      "slotLock.lockType": "hard",
      "slotLock.lockedAt": new Date().toISOString(),
      "slotLock.lockExpiry": null,
      "slotLock.lockReason": "payment_submitted",
      paymentAttempts: arrayUnion(paymentAttempt),
      statusHistory: arrayUnion({
        status: "payment_submitted",
        timestamp: new Date().toISOString(),
        changedBy: "user",
        reason: "Payment proof submitted for verification",
      }),
      updatedAt: serverTimestamp(),
    });

    return { success: true, attemptNumber: currentAttempts + 1 };
  } catch (error) {
    console.error("Error submitting payment for verification:", error);
    throw error;
  }
}

export async function getBookingPaymentStatus(bookingId) {
  try {
    const bookingRef = doc(db, "bookings", bookingId);
    const bookingSnap = await getDoc(bookingRef);
    if (!bookingSnap.exists()) throw new Error("Booking not found");
    const booking = bookingSnap.data();
    return { status: booking.status, payment: booking.payment, paymentAttempts: booking.paymentAttempts || [] };
  } catch (error) {
    console.error("Error getting booking payment status:", error);
    throw error;
  }
}

export async function verifyPayment(bookingId, verifierId, verifierRole, note = "", autoApprove = true) {
  try {
    const bookingRef = doc(db, "bookings", bookingId);
    const bookingSnap = await getDoc(bookingRef);
    const bookingData = bookingSnap.data();
    const nextStatus = autoApprove ? "confirmed" : "pending";

    const advanceAmount = bookingData?.payment?.advanceAmount || 0;
    const slotAmount = bookingData?.totalAmount || bookingData?.payment?.slotAmount || 0;
    const previousTotalPaid = bookingData?.payment?.totalPaid || 0;
    const newTotalPaid = previousTotalPaid + advanceAmount;
    const newRemainingAmount = Math.max(0, slotAmount - advanceAmount);

    await updateDoc(bookingRef, {
      status: nextStatus,
      "payment.advance.status": "verified",
      "payment.advance.verification": {
        isVerified: true,
        verifiedBy: verifierId,
        verifiedByRole: verifierRole,
        verifiedAt: serverTimestamp(),
        verificationNote: note,
      },
      "payment.remainingAmount": newRemainingAmount,
      "payment.totalPaid": newTotalPaid,
      "payment.totalPending": Math.max(0, slotAmount - newTotalPaid),
      "payment.isFullyPaid": newTotalPaid >= slotAmount,
      "slotLock.isLocked": true,
      "slotLock.lockType": "hard",
      "slotLock.lockedAt": new Date().toISOString(),
      "slotLock.lockExpiry": null,
      "slotLock.lockReason": autoApprove ? "approved" : "payment_submitted",
      ...(autoApprove && { approvedBy: verifierId, approvedAt: new Date().toISOString() }),
      statusHistory: arrayUnion({
        status: "payment_verified",
        timestamp: new Date().toISOString(),
        changedBy: verifierId,
        reason: "Payment verified",
      }),
      updatedAt: serverTimestamp(),
    });

    if (autoApprove) {
      await updateDoc(bookingRef, {
        statusHistory: arrayUnion({
          status: "confirmed",
          timestamp: new Date().toISOString(),
          changedBy: verifierId,
          reason: "Auto-approved after payment verification",
        }),
      });
    }

    const userId = bookingData?.userId;
    if (userId) await updateUserPaymentHistory(userId, true);

    const companyId = bookingData?.companyId;
    const transactionId = bookingData?.payment?.advance?.upiDetails?.transactionId;
    if (companyId && transactionId) {
      await trackVerifiedTransaction(companyId, { txnId: transactionId, amount: advanceAmount, bookingId });
    }

    return { success: true, newStatus: nextStatus };
  } catch (error) {
    console.error("Error verifying payment:", error);
    throw error;
  }
}

export async function releaseSlotLock(bookingId) {
  try {
    const bookingRef = doc(db, "bookings", bookingId);
    const bookingSnap = await getDoc(bookingRef);
    if (!bookingSnap.exists()) return;
    const bookingData = bookingSnap.data();
    if (bookingData.status !== "pending_payment") return;

    await updateDoc(bookingRef, {
      status: "cancelled",
      "payment.advance.status": "expired",
      "payment.advance.isExpired": true,
      "slotLock.isLocked": false,
      "slotLock.lockType": null,
      "slotLock.lockExpiry": null,
      "slotLock.lockReason": null,
      statusHistory: arrayUnion({
        status: "cancelled",
        timestamp: new Date().toISOString(),
        changedBy: "system",
        reason: "Payment timeout - slot lock released",
      }),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error releasing slot lock:", error);
  }
}

export async function rejectPayment(bookingId, verifierId, verifierRole, reason) {
  try {
    const bookingRef = doc(db, "bookings", bookingId);
    const bookingSnap = await getDoc(bookingRef);
    const bookingData = bookingSnap.data();
    const currentAttempts = bookingData?.paymentAttempts?.length || 0;

    const updatedAttempts = [...(bookingData.paymentAttempts || [])];
    if (updatedAttempts.length > 0) {
      updatedAttempts[updatedAttempts.length - 1].status = "rejected";
      updatedAttempts[updatedAttempts.length - 1].rejectionReason = reason;
    }

    await updateDoc(bookingRef, {
      status: "payment_rejected",
      "payment.advance.status": "rejected",
      "payment.advance.verification": {
        isVerified: false,
        verifiedBy: verifierId,
        verifiedByRole: verifierRole,
        verifiedAt: serverTimestamp(),
        rejectionReason: reason,
        attemptNumber: currentAttempts,
      },
      "slotLock.isLocked": false,
      "slotLock.lockType": null,
      "slotLock.lockExpiry": null,
      "slotLock.lockReason": null,
      paymentAttempts: updatedAttempts,
      statusHistory: arrayUnion({
        status: "payment_rejected",
        timestamp: new Date().toISOString(),
        changedBy: verifierId,
        reason: `Payment rejected: ${reason}`,
      }),
      updatedAt: serverTimestamp(),
    });

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
