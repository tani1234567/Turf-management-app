import {
  doc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  arrayUnion,
  Timestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage, auth } from "./config";
import { generateUpiUrl, generateTransactionRef } from "../../utils/upiUtils";

const PLATFORM_UPI_ID = "tanmaygharat957-1@oksbi";
const PLATFORM_NAME = "SportSwift Platform";

export async function initiateSubscriptionPayment(
  companyId,
  selectedTurfIds,
  totalGrounds,
  months,
  pricingDetails
) {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("User not authenticated. Please log in again.");

  const transactionRef = generateTransactionRef("SUB");
  const transactionNote = `Subscription ${months}M ${totalGrounds}G - ${companyId.substring(0, 8)}`;

  const upiLink = generateUpiUrl({
    upiId: PLATFORM_UPI_ID,
    name: PLATFORM_NAME,
    amount: pricingDetails.finalAmount,
    transactionNote,
    bookingId: transactionRef,
  });

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
    status: "initiated",
    upiLink,
    transactionNote,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000)),
  };

  await setDoc(doc(db, "pending_subscription_payments", transactionRef), paymentData);

  return { transactionRef, upiLink, amount: pricingDetails.finalAmount, months, totalGrounds };
}

export async function uploadSubscriptionPaymentProof(transactionRef, imageUri, additionalInfo = {}) {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("User not authenticated. Please log in again.");

  try {
    const storagePath = `subscription_payments/${transactionRef}/proof_${Date.now()}.jpg`;

    const response = await fetch(imageUri);
    const blob = await response.blob();
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, blob);
    const downloadURL = await getDownloadURL(storageRef);

    await updateDoc(doc(db, "pending_subscription_payments", transactionRef), {
      status: "proof_submitted",
      paymentProof: downloadURL,
      proofSubmittedAt: serverTimestamp(),
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

export async function checkSubscriptionPaymentStatus(transactionRef) {
  const snapshot = await getDoc(doc(db, "pending_subscription_payments", transactionRef));
  if (!snapshot.exists()) return { status: "not_found" };
  return { id: snapshot.id, ...snapshot.data() };
}

export async function getPendingSubscriptionPayment(companyId) {
  const q = query(
    collection(db, "pending_subscription_payments"),
    where("companyId", "==", companyId),
    where("status", "in", ["initiated", "proof_submitted"]),
    orderBy("createdAt", "desc"),
    limit(1)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const d = snapshot.docs[0];
  return { id: d.id, ...d.data() };
}

export async function verifySubscriptionPayment(transactionRef, adminId, approved, notes = "") {
  const paymentDocRef = doc(db, "pending_subscription_payments", transactionRef);
  const paymentDoc = await getDoc(paymentDocRef);
  if (!paymentDoc.exists()) throw new Error("Payment record not found");

  const payment = paymentDoc.data();

  if (approved) {
    const companyDocRef = doc(db, "companies", payment.companyId);
    const companyDoc = await getDoc(companyDocRef);
    const companyData = companyDoc.data();

    const currentEnd = companyData?.subscription?.subscriptionEndDate?.toDate() || new Date();
    const newEnd = new Date(Math.max(currentEnd.getTime(), Date.now()));
    newEnd.setMonth(newEnd.getMonth() + payment.months);

    await updateDoc(companyDocRef, {
      "subscription.status": "active",
      "subscription.subscriptionEndDate": Timestamp.fromDate(newEnd),
      "subscription.totalGrounds": payment.totalGrounds,
      "subscription.subscribedTurfIds": payment.selectedTurfIds,
      "subscription.lastPaymentDate": serverTimestamp(),
      "subscription.lastPaymentAmount": payment.pricingDetails.finalAmount,
      "subscription.paymentHistory": arrayUnion({
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

    for (const turfId of payment.selectedTurfIds) {
      await updateDoc(doc(db, "turfs", turfId), {
        isActive: true,
        subscriptionEndDate: Timestamp.fromDate(newEnd),
      });
    }

    await updateDoc(paymentDocRef, {
      status: "completed",
      verifiedBy: adminId,
      verifiedAt: serverTimestamp(),
      verificationNotes: notes,
      completedAt: serverTimestamp(),
    });
  } else {
    await updateDoc(paymentDocRef, {
      status: "rejected",
      verifiedBy: adminId,
      verifiedAt: serverTimestamp(),
      verificationNotes: notes || "Payment verification failed",
    });
  }

  return { success: true, approved };
}
