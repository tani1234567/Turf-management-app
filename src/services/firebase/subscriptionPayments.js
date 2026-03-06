import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";
import { generateUpiUrl, generateTransactionRef } from "../../utils/upiUtils";

// Platform UPI details (replace with your actual UPI)
const PLATFORM_UPI_ID = "tanmaygharat957-1@oksbi";
const PLATFORM_NAME = "SportSwift Platform";

/**
 * Initiate subscription payment via UPI with tiered pricing
 * Creates a pending payment record and returns UPI link
 * @param {string} companyId - Company ID
 * @param {Array<string>} selectedTurfIds - Array of turf IDs to subscribe
 * @param {number} totalGrounds - Total grounds across selected turfs
 * @param {number} months - Subscription duration in months
 * @param {Object} pricingDetails - Calculated pricing breakdown from subscriptionPricing.js
 * @returns {Promise<Object>} Payment initiation result with transactionRef and upiLink
 */
export async function initiateSubscriptionPayment(
  companyId,
  selectedTurfIds,
  totalGrounds,
  months,
  pricingDetails
) {
  const currentUser = auth().currentUser;
  if (!currentUser) {
    throw new Error("User not authenticated. Please log in again.");
  }

  const transactionRef = generateTransactionRef("SUB");
  const transactionNote = `Subscription ${months}M ${totalGrounds}G - ${companyId.substring(0, 8)}`;

  // Generate UPI link
  const upiLink = generateUpiUrl({
    upiId: PLATFORM_UPI_ID,
    name: PLATFORM_NAME,
    amount: pricingDetails.finalAmount,
    transactionNote,
    bookingId: transactionRef,
  });

  // Create pending payment record
  const paymentData = {
    transactionRef,
    companyId,
    initiatedBy: currentUser.uid,
    selectedTurfIds,
    totalGrounds,
    months,
    pricingDetails: {
      monthlyPrice: pricingDetails.monthlyPrice,
      totalBeforeDiscount: pricingDetails.totalBeforeDiscount,
      pricePerGround: pricingDetails.pricePerGround,
      tierDiscount: pricingDetails.tierDiscount,
      durationDiscount: pricingDetails.durationDiscount,
      discountAmount: pricingDetails.discountAmount,
      finalAmount: pricingDetails.finalAmount,
    },
    amount: pricingDetails.finalAmount,
    status: "initiated", // initiated → proof_submitted → verified → completed
    upiLink,
    transactionNote,
    createdAt: firestore.FieldValue.serverTimestamp(),
    expiresAt: firestore.Timestamp.fromDate(
      new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    ),
  };

  await firestore()
    .collection("pending_subscription_payments")
    .doc(transactionRef)
    .set(paymentData);

  return {
    transactionRef,
    upiLink,
    amount: pricingDetails.finalAmount,
    months,
    totalGrounds,
  };
}

/**
 * Upload subscription payment proof screenshot
 * @param {string} transactionRef - Transaction reference
 * @param {string} imageUri - Local URI of the proof image
 * @param {Object} additionalInfo - Additional payment details
 * @param {string} [additionalInfo.transactionId] - UPI transaction ID
 * @param {string} [additionalInfo.paidFrom] - UPI ID used for payment
 * @param {string} [additionalInfo.notes] - Additional notes
 * @returns {Promise<Object>} Upload result
 */
export async function uploadSubscriptionPaymentProof(transactionRef, imageUri, additionalInfo = {}) {
  const currentUser = auth().currentUser;
  if (!currentUser) {
    throw new Error("User not authenticated. Please log in again.");
  }

  try {
    // Upload screenshot to Firebase Storage
    const storagePath = `subscription_payments/${transactionRef}/proof_${Date.now()}.jpg`;
    const reference = storage().ref(storagePath);
    await reference.putFile(imageUri);
    const downloadURL = await reference.getDownloadURL();

    // Update payment record
    await firestore()
      .collection("pending_subscription_payments")
      .doc(transactionRef)
      .update({
        status: "proof_submitted",
        paymentProof: downloadURL,
        proofSubmittedAt: firestore.FieldValue.serverTimestamp(),
        additionalInfo: {
          transactionId: additionalInfo.transactionId || "",
          paidFrom: additionalInfo.paidFrom || "",
          notes: additionalInfo.notes || "",
        },
      });

    return { success: true, proofUrl: downloadURL };
  } catch (error) {
    console.error("Error uploading subscription payment proof:", error);
    throw error;
  }
}

/**
 * Check subscription payment status
 * @param {string} transactionRef - Transaction reference
 * @returns {Promise<Object>} Payment status data
 */
export async function checkSubscriptionPaymentStatus(transactionRef) {
  const snapshot = await firestore()
    .collection("pending_subscription_payments")
    .doc(transactionRef)
    .get();

  if (!snapshot.exists) {
    return { status: "not_found" };
  }

  return { id: snapshot.id, ...snapshot.data() };
}

/**
 * Get pending subscription payment for a company
 * @param {string} companyId - Company ID
 * @returns {Promise<Object|null>} Most recent pending payment or null
 */
export async function getPendingSubscriptionPayment(companyId) {
  const snapshot = await firestore()
    .collection("pending_subscription_payments")
    .where("companyId", "==", companyId)
    .where("status", "in", ["initiated", "proof_submitted"])
    .orderBy("createdAt", "desc")
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() };
}

/**
 * Verify subscription payment (Admin action)
 * Activates subscription for selected turfs and updates company record
 * @param {string} transactionRef - Transaction reference
 * @param {string} adminId - Admin user ID
 * @param {boolean} approved - Whether payment is approved
 * @param {string} [notes] - Verification notes
 */
export async function verifySubscriptionPayment(transactionRef, adminId, approved, notes = "") {
  const paymentDoc = await firestore()
    .collection("pending_subscription_payments")
    .doc(transactionRef)
    .get();

  if (!paymentDoc.exists) {
    throw new Error("Payment record not found");
  }

  const payment = paymentDoc.data();

  if (approved) {
    // Get current company subscription data
    const companyDoc = await firestore()
      .collection("companies")
      .doc(payment.companyId)
      .get();
    const companyData = companyDoc.data();

    // Calculate new subscription end date
    const currentEnd = companyData?.subscription?.subscriptionEndDate?.toDate() || new Date();
    const newEnd = new Date(Math.max(currentEnd.getTime(), Date.now()));
    newEnd.setMonth(newEnd.getMonth() + payment.months);

    // Update company subscription
    await firestore()
      .collection("companies")
      .doc(payment.companyId)
      .update({
        "subscription.status": "active",
        "subscription.subscriptionEndDate": firestore.Timestamp.fromDate(newEnd),
        "subscription.totalGrounds": payment.totalGrounds,
        "subscription.subscribedTurfIds": payment.selectedTurfIds,
        "subscription.lastPaymentDate": firestore.FieldValue.serverTimestamp(),
        "subscription.lastPaymentAmount": payment.pricingDetails.finalAmount,
        "subscription.paymentHistory": firestore.FieldValue.arrayUnion({
          date: new Date().toISOString(),
          amount: payment.pricingDetails.finalAmount,
          method: "upi",
          transactionRef: payment.transactionRef,
          months: payment.months,
          totalGrounds: payment.totalGrounds,
          pricePerGround: payment.pricingDetails.pricePerGround,
          verifiedBy: adminId,
        }),
      });

    // Activate only the selected turfs
    for (const turfId of payment.selectedTurfIds) {
      await firestore()
        .collection("turfs")
        .doc(turfId)
        .update({
          isActive: true,
          subscriptionEndDate: firestore.Timestamp.fromDate(newEnd),
        });
    }

    // Update payment status to completed
    await paymentDoc.ref.update({
      status: "completed",
      verifiedBy: adminId,
      verifiedAt: firestore.FieldValue.serverTimestamp(),
      verificationNotes: notes,
      completedAt: firestore.FieldValue.serverTimestamp(),
    });
  } else {
    // Reject payment
    await paymentDoc.ref.update({
      status: "rejected",
      verifiedBy: adminId,
      verifiedAt: firestore.FieldValue.serverTimestamp(),
      verificationNotes: notes || "Payment verification failed",
    });
  }

  return { success: true, approved };
}
