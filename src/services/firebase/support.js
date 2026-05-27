import { Platform } from "react-native";
import {
  collection,
  doc,
  addDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp as webServerTimestamp,
} from "firebase/firestore";
import { db } from "./config";

let nativeFirestore = null;
let hasNativeFirestore = false;

if (Platform.OS !== "web") {
  try {
    nativeFirestore = require("@react-native-firebase/firestore").default;
    hasNativeFirestore = true;
  } catch (e) {
    // fall back to web SDK
  }
}

const serverTimestamp = () => {
  if (hasNativeFirestore) return nativeFirestore.FieldValue.serverTimestamp();
  return webServerTimestamp();
};

// ─── Support Tickets ────────────────────────────────────────────────────────

/**
 * Create a new support ticket written by the user from mobile.
 * ticketNumber is patched in by the onTicketCreated Cloud Function (~1s).
 */
export const createTicket = async ({
  subject,
  category,
  description,
  userId,
  userName,
  userPhone,
  userEmail = null,
  relatedBookingId = null,
}) => {
  const now = serverTimestamp();
  const ticketData = {
    subject: subject.trim(),
    category,
    priority: "medium",
    status: "open",
    userId,
    userName,
    userPhone,
    userEmail,
    relatedBookingId,
    relatedCompanyId: null,
    description: description.trim(),
    source: "mobile",
    ticketNumber: null,
    assignedTo: null,
    assignedToEmail: null,
    resolvedAt: null,
    resolvedBy: null,
    closedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  if (hasNativeFirestore) {
    const ref = await nativeFirestore().collection("support_tickets").add(ticketData);
    return ref.id;
  }

  const ref = await addDoc(collection(db, "support_tickets"), ticketData);
  return ref.id;
};

/**
 * Fetch all tickets for a user (one-time read, newest first).
 */
export const getMyTickets = async (userId) => {
  if (hasNativeFirestore) {
    const snap = await nativeFirestore()
      .collection("support_tickets")
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc")
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  const q = query(
    collection(db, "support_tickets"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

/**
 * Real-time subscription to a single ticket doc.
 * Returns an unsubscribe function.
 */
export const subscribeToTicket = (ticketId, callback) => {
  if (hasNativeFirestore) {
    return nativeFirestore()
      .collection("support_tickets")
      .doc(ticketId)
      .onSnapshot((snap) => {
        if (snap.exists) callback({ id: snap.id, ...snap.data() });
        else callback(null);
      });
  }

  return onSnapshot(doc(db, "support_tickets", ticketId), (snap) => {
    if (snap.exists()) callback({ id: snap.id, ...snap.data() });
    else callback(null);
  });
};

/**
 * Real-time subscription to a ticket's message thread (oldest first).
 * Returns an unsubscribe function.
 */
export const subscribeToTicketMessages = (ticketId, callback) => {
  if (hasNativeFirestore) {
    return nativeFirestore()
      .collection("support_tickets")
      .doc(ticketId)
      .collection("messages")
      .orderBy("createdAt", "asc")
      .onSnapshot((snap) => {
        callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      });
  }

  const q = query(
    collection(db, "support_tickets", ticketId, "messages"),
    orderBy("createdAt", "asc")
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
};

/**
 * Send a reply message from the user side.
 * The onTicketMessageCreated Cloud Function handles push notifications and
 * updates the parent ticket's updatedAt automatically.
 */
export const sendTicketReply = async (ticketId, { userId, userName, text }) => {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Message cannot be empty");

  const messageData = {
    senderId: userId,
    senderType: "user",
    senderName: userName,
    senderEmail: null,
    text: trimmed,
    createdAt: serverTimestamp(),
  };

  if (hasNativeFirestore) {
    await nativeFirestore()
      .collection("support_tickets")
      .doc(ticketId)
      .collection("messages")
      .add(messageData);
    return;
  }

  await addDoc(
    collection(db, "support_tickets", ticketId, "messages"),
    messageData
  );
};

// ─── Disputes ───────────────────────────────────────────────────────────────

/**
 * Create a dispute for a booking.
 * Throws "dispute_exists" if the user already has a dispute for this booking.
 */
export const createDispute = async ({
  bookingId,
  userId,
  userName,
  userPhone,
  companyId,
  companyName,
  turfName,
  type,
  description,
  requestedAmount = null,
}) => {
  // One dispute per booking — check first
  if (hasNativeFirestore) {
    const existing = await nativeFirestore()
      .collection("disputes")
      .where("bookingId", "==", bookingId)
      .where("userId", "==", userId)
      .get();
    if (!existing.empty) {
      const err = new Error("You already have an open dispute for this booking.");
      err.code = "dispute_exists";
      throw err;
    }
  } else {
    const q = query(
      collection(db, "disputes"),
      where("bookingId", "==", bookingId),
      where("userId", "==", userId)
    );
    const existing = await getDocs(q);
    if (!existing.empty) {
      const err = new Error("You already have an open dispute for this booking.");
      err.code = "dispute_exists";
      throw err;
    }
  }

  const now = serverTimestamp();
  const disputeData = {
    bookingId,
    userId,
    userName,
    userPhone,
    companyId,
    companyName,
    turfName,
    type,
    description: description.trim(),
    requestedAmount: requestedAmount ?? null,
    source: "mobile",
    status: "open",
    resolution: null,
    resolvedAmount: null,
    resolvedAt: null,
    resolvedBy: null,
    resolvedByEmail: null,
    createdAt: now,
    updatedAt: now,
  };

  if (hasNativeFirestore) {
    const ref = await nativeFirestore().collection("disputes").add(disputeData);
    return ref.id;
  }

  const ref = await addDoc(collection(db, "disputes"), disputeData);
  return ref.id;
};

/**
 * Fetch all disputes for a user (one-time read, newest first).
 */
export const getMyDisputes = async (userId) => {
  if (hasNativeFirestore) {
    const snap = await nativeFirestore()
      .collection("disputes")
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc")
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  const q = query(
    collection(db, "disputes"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

/**
 * Real-time subscription to a single dispute doc.
 * Returns an unsubscribe function.
 */
export const subscribeToDispute = (disputeId, callback) => {
  if (hasNativeFirestore) {
    return nativeFirestore()
      .collection("disputes")
      .doc(disputeId)
      .onSnapshot((snap) => {
        if (snap.exists) callback({ id: snap.id, ...snap.data() });
        else callback(null);
      });
  }

  return onSnapshot(doc(db, "disputes", disputeId), (snap) => {
    if (snap.exists()) callback({ id: snap.id, ...snap.data() });
    else callback(null);
  });
};
