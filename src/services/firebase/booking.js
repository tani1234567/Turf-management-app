import { Platform } from "react-native";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  serverTimestamp as webServerTimestamp,
  runTransaction as webRunTransaction,
} from "firebase/firestore";
import { db } from "./config";

let nativeFirestore = null;
let hasNativeFirestore = false;

if (Platform.OS !== "web") {
  try {
    nativeFirestore = require("@react-native-firebase/firestore").default;
    hasNativeFirestore = true;
  } catch (error) {
    // Fall back to web SDK when native module is unavailable.
  }
}

const serverTimestamp = () => {
  if (hasNativeFirestore) {
    return nativeFirestore.FieldValue.serverTimestamp();
  }
  return webServerTimestamp();
};

// Normalize ground ID for comparison (handles legacy "ground-0" vs "ground_0" formats)
const normalizeGroundId = (groundId) => {
  if (!groundId) return "";
  return groundId.toLowerCase().replace(/[-_]/g, "");
};

/**
 * Check if a time slot is available for booking
 * @param {string} turfId - Turf ID
 * @param {string} groundId - Ground ID
 * @param {string} [groundName] - Ground name (optional fallback for legacy IDs)
 * @param {string} date - Date (YYYY-MM-DD)
 * @param {string} startTime - Start time (HH:MM)
 * @param {string} endTime - End time (HH:MM)
 * @returns {Promise<{available: boolean, conflicts: array}>}
 */
export const checkSlotAvailability = async (
  turfId,
  groundId,
  date,
  startTime,
  endTime,
  groundName
) => {
  const normalizedGroundId = normalizeGroundId(groundId);
  const normalizedGroundName = (groundName || "").trim().toLowerCase();

  try {
    if (hasNativeFirestore) {
      const bookingsSnapshot = await nativeFirestore()
        .collection("bookings")
        .where("turfId", "==", turfId)
        .where("date", "==", date)
        .where("status", "in", ["pending", "confirmed", "in_progress"])
        .get();

      const conflicts = bookingsSnapshot.docs.filter((doc) => {
        const booking = doc.data();
        const matchesGroundId =
          normalizeGroundId(booking.groundId) === normalizedGroundId;
        const matchesGroundName =
          normalizedGroundName &&
          (booking.groundName || "").trim().toLowerCase() === normalizedGroundName;
        if (!matchesGroundId && !matchesGroundName) return false;
        return booking.startTime < endTime && booking.endTime > startTime;
      });

      return {
        available: conflicts.length === 0,
        conflicts: conflicts.map((doc) => ({ id: doc.id, ...doc.data() })),
      };
    }

    // Web SDK
    const bookingsRef = collection(db, "bookings");
    const q = query(
      bookingsRef,
      where("turfId", "==", turfId),
      where("date", "==", date),
      where("status", "in", ["pending", "confirmed", "in_progress"])
    );

    const bookingsSnapshot = await getDocs(q);
    const conflicts = bookingsSnapshot.docs.filter((docSnap) => {
      const booking = docSnap.data();
      const matchesGroundId =
        normalizeGroundId(booking.groundId) === normalizedGroundId;
      const matchesGroundName =
        normalizedGroundName &&
        (booking.groundName || "").trim().toLowerCase() === normalizedGroundName;
      if (!matchesGroundId && !matchesGroundName) return false;
      return booking.startTime < endTime && booking.endTime > startTime;
    });

    return {
      available: conflicts.length === 0,
      conflicts: conflicts.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })),
    };
  } catch (error) {
    console.error("Error checking slot availability:", error);
    throw error;
  }
};

/**
 * Create a booking from an accepted negotiation using transaction
 * This handles race conditions and expires other conflicting negotiations
 * @param {object} negotiationCard - The negotiation card data
 * @param {string} chatId - Chat ID where negotiation card exists
 * @param {string} messageId - Message ID of the negotiation card
 * @param {string} respondedBy - User ID of who accepted
 * @param {string} respondedByName - Name of who accepted
 * @returns {Promise<{success: boolean, bookingId?: string, message?: string}>}
 */
export const createBookingFromNegotiation = async (
  negotiationCard,
  chatId,
  messageId,
  respondedBy,
  respondedByName
) => {
  const {
    turfId,
    turfName,
    groundId,
    groundName,
    sport,
    date,
    startTime,
    endTime,
    originalPrice,
    requestedPrice,
    senderId,
    senderName,
    senderPhone,
    senderEmail,
    companyId,
    duration,
  } = negotiationCard;

  // Validate required fields
  if (!turfId || !groundId || !date || !startTime || !endTime) {
    console.error("Missing required fields in negotiation card:", { turfId, groundId, date, startTime, endTime });
    return {
      success: false,
      message: "Missing required booking information.",
    };
  }

  // Use defaults for optional fields that might be missing in older negotiations
  const userId = senderId || "unknown_user";
  const userName = senderName || "User";
  const userPhone = senderPhone || "";
  const userEmail = senderEmail || "";
  const bookingCompanyId = companyId || null;
  const bookingDuration = duration || calculateDuration(startTime, endTime);

  const normalizedNewGroundId = normalizeGroundId(groundId);

  try {
    if (hasNativeFirestore) {
      return await nativeFirestore().runTransaction(async (transaction) => {
        // 1. Check for conflicting bookings
        const bookingsRef = nativeFirestore().collection("bookings");
        const conflictingBookings = await bookingsRef
          .where("turfId", "==", turfId)
          .where("date", "==", date)
          .where("status", "in", ["pending", "confirmed", "in_progress"])
          .get();

        const hasConflict = conflictingBookings.docs.some((doc) => {
          const booking = doc.data();
          if (normalizeGroundId(booking.groundId) !== normalizedNewGroundId) return false;
          return booking.startTime < endTime && booking.endTime > startTime;
        });

        if (hasConflict) {
          return {
            success: false,
            message: "This time slot is no longer available. Someone else booked it.",
          };
        }

        // 2. Create the booking
        const bookingData = {
          // User info
          userId: userId,
          userName: userName,
          userPhone: userPhone,
          userEmail: userEmail,

          // Turf info
          companyId: bookingCompanyId,
          turfId,
          turfName: turfName || "Unknown Turf",
          groundId,
          groundName: groundName || "Unknown Ground",

          // Booking details
          bookingType: "regular",
          sport: sport || "Unknown",
          date,
          startTime,
          endTime,

          // Time slots
          timeSlots: [{
            startTime,
            endTime,
            duration: bookingDuration,
            hourlyRate: originalPrice ? originalPrice / bookingDuration : 0,
            amount: requestedPrice || originalPrice || 0,
          }],

          totalDuration: bookingDuration,

          // Pricing
          baseAmount: originalPrice || 0,
          totalAmount: requestedPrice || originalPrice || 0,
          totalPrice: requestedPrice || originalPrice || 0,

          // Status
          status: "confirmed",
          statusHistory: [
            {
              status: "pending",
              timestamp: new Date(),
              changedBy: userId,
              changedByRole: "user",
              reason: "Booking request created via negotiation",
            },
            {
              status: "confirmed",
              timestamp: new Date(),
              changedBy: respondedBy,
              changedByRole: "manager",
              reason: "Accepted via negotiation",
            },
          ],

          // Negotiation reference
          negotiation: {
            isNegotiated: true,
            requestedPrice: requestedPrice || originalPrice || 0,
            finalPrice: requestedPrice || originalPrice || 0,
            chatId,
            negotiationCardId: messageId,
          },

          // Payment (not paid yet)
          payment: {
            advanceAmount: 0,
            advancePaid: false,
            remainingAmount: requestedPrice || originalPrice || 0,
            remainingPaid: false,
          },

          // Timestamps
          createdAt: nativeFirestore.FieldValue.serverTimestamp(),
          requestedAt: nativeFirestore.FieldValue.serverTimestamp(),
          confirmedAt: nativeFirestore.FieldValue.serverTimestamp(),
          updatedAt: nativeFirestore.FieldValue.serverTimestamp(),
        };

        const newBookingRef = bookingsRef.doc();
        transaction.set(newBookingRef, bookingData);

        // 3. Update the negotiation card status
        const messageRef = nativeFirestore()
          .collection("chats")
          .doc(chatId)
          .collection("messages")
          .doc(messageId);

        transaction.update(messageRef, {
          "negotiationCard.status": "accepted",
          "negotiationCard.respondedBy": respondedBy,
          "negotiationCard.respondedByName": respondedByName,
          "negotiationCard.respondedAt": nativeFirestore.FieldValue.serverTimestamp(),
          "negotiationCard.bookingId": newBookingRef.id,
        });

        // 4. Update chat metadata
        const chatRef = nativeFirestore().collection("chats").doc(chatId);
        transaction.update(chatRef, {
          "lastMessage.text": "Booking confirmed!",
          hasActiveNegotiation: false,
          updatedAt: nativeFirestore.FieldValue.serverTimestamp(),
        });

        return { success: true, bookingId: newBookingRef.id };
      });
    }

    // Web SDK transaction
    return await webRunTransaction(db, async (transaction) => {
      // 1. Check for conflicting bookings
      const bookingsRef = collection(db, "bookings");
      const q = query(
        bookingsRef,
        where("turfId", "==", turfId),
        where("date", "==", date),
        where("status", "in", ["pending", "confirmed", "in_progress"])
      );

      const conflictingBookings = await getDocs(q);

      const hasConflict = conflictingBookings.docs.some((docSnap) => {
        const booking = docSnap.data();
        if (normalizeGroundId(booking.groundId) !== normalizedNewGroundId) return false;
        return booking.startTime < endTime && booking.endTime > startTime;
      });

      if (hasConflict) {
        return {
          success: false,
          message: "This time slot is no longer available. Someone else booked it.",
        };
      }

      // 2. Create the booking
      const bookingData = {
        userId: userId,
        userName: userName,
        userPhone: userPhone,
        userEmail: userEmail,
        companyId: bookingCompanyId,
        turfId,
        turfName: turfName || "Unknown Turf",
        groundId,
        groundName: groundName || "Unknown Ground",
        bookingType: "regular",
        sport: sport || "Unknown",
        date,
        startTime,
        endTime,
        timeSlots: [{
          startTime,
          endTime,
          duration: bookingDuration,
          hourlyRate: originalPrice ? originalPrice / bookingDuration : 0,
          amount: requestedPrice || originalPrice || 0,
        }],
        totalDuration: bookingDuration,
        baseAmount: originalPrice || 0,
        totalAmount: requestedPrice || originalPrice || 0,
        totalPrice: requestedPrice || originalPrice || 0,
        status: "confirmed",
        statusHistory: [
          {
            status: "pending",
            timestamp: new Date(),
            changedBy: userId,
            changedByRole: "user",
            reason: "Booking request created via negotiation",
          },
          {
            status: "confirmed",
            timestamp: new Date(),
            changedBy: respondedBy,
            changedByRole: "manager",
            reason: "Accepted via negotiation",
          },
        ],
        negotiation: {
          isNegotiated: true,
          requestedPrice: requestedPrice || originalPrice || 0,
          finalPrice: requestedPrice || originalPrice || 0,
          chatId,
          negotiationCardId: messageId,
        },
        payment: {
          advanceAmount: 0,
          advancePaid: false,
          remainingAmount: requestedPrice || originalPrice || 0,
          remainingPaid: false,
        },
        createdAt: webServerTimestamp(),
        requestedAt: webServerTimestamp(),
        confirmedAt: webServerTimestamp(),
        updatedAt: webServerTimestamp(),
      };

      const newBookingRef = doc(collection(db, "bookings"));
      transaction.set(newBookingRef, bookingData);

      // 3. Update the negotiation card status
      const messageRef = doc(db, "chats", chatId, "messages", messageId);
      transaction.update(messageRef, {
        "negotiationCard.status": "accepted",
        "negotiationCard.respondedBy": respondedBy,
        "negotiationCard.respondedByName": respondedByName,
        "negotiationCard.respondedAt": webServerTimestamp(),
        "negotiationCard.bookingId": newBookingRef.id,
      });

      // 4. Update chat metadata
      const chatRef = doc(db, "chats", chatId);
      transaction.update(chatRef, {
        "lastMessage.text": "Booking confirmed!",
        hasActiveNegotiation: false,
        updatedAt: webServerTimestamp(),
      });

      return { success: true, bookingId: newBookingRef.id };
    });
  } catch (error) {
    console.error("Error creating booking from negotiation:", error);
    return {
      success: false,
      message: "An error occurred while creating the booking. Please try again.",
    };
  }
};

/**
 * Create a pending booking from Quick Book
 * @param {object} bookingData - Booking details
 * @returns {Promise<{success: boolean, bookingId?: string, message?: string}>}
 */
export const createPendingBooking = async (bookingData) => {
  const { turfId, groundId, date, startTime, endTime } = bookingData;
  const normalizedNewGroundId = normalizeGroundId(groundId);

  try {
    if (hasNativeFirestore) {
      return await nativeFirestore().runTransaction(async (transaction) => {
        // Check availability
        const bookingsRef = nativeFirestore().collection("bookings");
        const conflictingBookings = await bookingsRef
          .where("turfId", "==", turfId)
          .where("date", "==", date)
          .where("status", "in", ["pending", "confirmed", "in_progress"])
          .get();

        const hasConflict = conflictingBookings.docs.some((doc) => {
          const booking = doc.data();
          if (normalizeGroundId(booking.groundId) !== normalizedNewGroundId) return false;
          return booking.startTime < endTime && booking.endTime > startTime;
        });

        if (hasConflict) {
          return {
            success: false,
            message: "This time slot is no longer available.",
          };
        }

        // Create pending booking
        const pendingBookingData = {
          ...bookingData,
          status: "pending",
          statusHistory: [{
            status: "pending",
            timestamp: new Date(),
            changedBy: bookingData.userId,
            changedByRole: "user",
            reason: "Quick booking request from chat",
          }],
          payment: {
            advanceAmount: 0,
            advancePaid: false,
            remainingAmount: bookingData.totalAmount,
            remainingPaid: false,
          },
          createdAt: nativeFirestore.FieldValue.serverTimestamp(),
          requestedAt: nativeFirestore.FieldValue.serverTimestamp(),
          updatedAt: nativeFirestore.FieldValue.serverTimestamp(),
        };

        const newBookingRef = bookingsRef.doc();
        transaction.set(newBookingRef, pendingBookingData);

        return { success: true, bookingId: newBookingRef.id };
      });
    }

    // Web SDK
    return await webRunTransaction(db, async (transaction) => {
      const bookingsRef = collection(db, "bookings");
      const q = query(
        bookingsRef,
        where("turfId", "==", turfId),
        where("date", "==", date),
        where("status", "in", ["pending", "confirmed", "in_progress"])
      );

      const conflictingBookings = await getDocs(q);

      const hasConflict = conflictingBookings.docs.some((docSnap) => {
        const booking = docSnap.data();
        if (normalizeGroundId(booking.groundId) !== normalizedNewGroundId) return false;
        return booking.startTime < endTime && booking.endTime > startTime;
      });

      if (hasConflict) {
        return {
          success: false,
          message: "This time slot is no longer available.",
        };
      }

      const pendingBookingData = {
        ...bookingData,
        status: "pending",
        statusHistory: [{
          status: "pending",
          timestamp: new Date(),
          changedBy: bookingData.userId,
          changedByRole: "user",
          reason: "Quick booking request from chat",
        }],
        payment: {
          advanceAmount: 0,
          advancePaid: false,
          remainingAmount: bookingData.totalAmount,
          remainingPaid: false,
        },
        createdAt: webServerTimestamp(),
        requestedAt: webServerTimestamp(),
        updatedAt: webServerTimestamp(),
      };

      const newBookingRef = doc(collection(db, "bookings"));
      transaction.set(newBookingRef, pendingBookingData);

      return { success: true, bookingId: newBookingRef.id };
    });
  } catch (error) {
    console.error("Error creating pending booking:", error);
    return {
      success: false,
      message: "An error occurred. Please try again.",
    };
  }
};

/**
 * Confirm a pending booking (Quick Confirm from chat)
 * @param {string} bookingId - Booking ID
 * @param {string} respondedBy - User ID of who confirmed
 * @param {string} respondedByName - Name of who confirmed
 * @returns {Promise<{success: boolean, message?: string}>}
 */
export const confirmPendingBooking = async (bookingId, respondedBy, respondedByName) => {
  try {
    if (hasNativeFirestore) {
      return await nativeFirestore().runTransaction(async (transaction) => {
        const bookingRef = nativeFirestore().collection("bookings").doc(bookingId);
        const bookingDoc = await transaction.get(bookingRef);

        if (!bookingDoc.exists) {
          return { success: false, message: "Booking not found" };
        }

        const booking = bookingDoc.data();

        if (booking.status !== "pending") {
          return { success: false, message: "Booking is no longer pending" };
        }

        // Check if slot is still available
        const bookingsRef = nativeFirestore().collection("bookings");
        const conflictingBookings = await bookingsRef
          .where("turfId", "==", booking.turfId)
          .where("date", "==", booking.date)
          .where("status", "in", ["confirmed", "in_progress"])
          .get();

        const normalizedGroundId = normalizeGroundId(booking.groundId);
        const hasConflict = conflictingBookings.docs.some((doc) => {
          if (doc.id === bookingId) return false;
          const b = doc.data();
          if (normalizeGroundId(b.groundId) !== normalizedGroundId) return false;
          return b.startTime < booking.endTime && b.endTime > booking.startTime;
        });

        if (hasConflict) {
          return { success: false, message: "Slot no longer available" };
        }

        // Update booking status
        transaction.update(bookingRef, {
          status: "confirmed",
          statusHistory: [
            ...booking.statusHistory,
            {
              status: "confirmed",
              timestamp: new Date(),
              changedBy: respondedBy,
              changedByRole: "manager",
              reason: "Quick confirmed from chat",
            },
          ],
          confirmedAt: nativeFirestore.FieldValue.serverTimestamp(),
          updatedAt: nativeFirestore.FieldValue.serverTimestamp(),
        });

        return { success: true };
      });
    }

    // Web SDK
    return await webRunTransaction(db, async (transaction) => {
      const bookingRef = doc(db, "bookings", bookingId);
      const bookingDoc = await getDoc(bookingRef);

      if (!bookingDoc.exists()) {
        return { success: false, message: "Booking not found" };
      }

      const booking = bookingDoc.data();

      if (booking.status !== "pending") {
        return { success: false, message: "Booking is no longer pending" };
      }

      // Check if slot is still available
      const bookingsRef = collection(db, "bookings");
      const q = query(
        bookingsRef,
        where("turfId", "==", booking.turfId),
        where("date", "==", booking.date),
        where("status", "in", ["confirmed", "in_progress"])
      );

      const conflictingBookings = await getDocs(q);
      const normalizedGroundId = normalizeGroundId(booking.groundId);
      const hasConflict = conflictingBookings.docs.some((docSnap) => {
        if (docSnap.id === bookingId) return false;
        const b = docSnap.data();
        if (normalizeGroundId(b.groundId) !== normalizedGroundId) return false;
        return b.startTime < booking.endTime && b.endTime > booking.startTime;
      });

      if (hasConflict) {
        return { success: false, message: "Slot no longer available" };
      }

      transaction.update(bookingRef, {
        status: "confirmed",
        statusHistory: [
          ...booking.statusHistory,
          {
            status: "confirmed",
            timestamp: new Date(),
            changedBy: respondedBy,
            changedByRole: "manager",
            reason: "Quick confirmed from chat",
          },
        ],
        confirmedAt: webServerTimestamp(),
        updatedAt: webServerTimestamp(),
      });

      return { success: true };
    });
  } catch (error) {
    console.error("Error confirming booking:", error);
    return {
      success: false,
      message: "An error occurred. Please try again.",
    };
  }
};

/**
 * Expire negotiations for a specific slot (called when slot is booked)
 * @param {string} turfId - Turf ID
 * @param {string} groundId - Ground ID
 * @param {string} date - Date
 * @param {string} startTime - Start time
 * @param {string} endTime - End time
 * @param {string} excludeChatId - Chat ID to exclude (the one that just booked)
 * @returns {Promise<number>} - Number of expired negotiations
 */
export const expireConflictingNegotiations = async (
  turfId,
  groundId,
  date,
  startTime,
  endTime,
  excludeChatId = null
) => {
  const normalizedGroundId = normalizeGroundId(groundId);
  let expiredCount = 0;

  try {
    if (hasNativeFirestore) {
      // Find all chats with active negotiations
      const chatsSnapshot = await nativeFirestore()
        .collection("chats")
        .where("hasActiveNegotiation", "==", true)
        .get();

      for (const chatDoc of chatsSnapshot.docs) {
        if (excludeChatId && chatDoc.id === excludeChatId) continue;

        // Check messages for conflicting negotiations
        const messagesSnapshot = await nativeFirestore()
          .collection("chats")
          .doc(chatDoc.id)
          .collection("messages")
          .where("type", "==", "negotiation_card")
          .get();

        for (const messageDoc of messagesSnapshot.docs) {
          const message = messageDoc.data();
          const card = message.negotiationCard;

          if (!card || !["pending", "countered"].includes(card.status)) continue;
          if (card.turfId !== turfId) continue;
          if (normalizeGroundId(card.groundId) !== normalizedGroundId) continue;
          if (card.date !== date) continue;
          if (!(card.startTime < endTime && card.endTime > startTime)) continue;

          // This negotiation conflicts - expire it
          await nativeFirestore()
            .collection("chats")
            .doc(chatDoc.id)
            .collection("messages")
            .doc(messageDoc.id)
            .update({
              "negotiationCard.status": "expired",
              "negotiationCard.expiredAt": nativeFirestore.FieldValue.serverTimestamp(),
              "negotiationCard.expiredReason": "Slot was booked by another user",
            });

          expiredCount++;
        }

        // Update chat's hasActiveNegotiation flag
        const remainingNegotiations = await nativeFirestore()
          .collection("chats")
          .doc(chatDoc.id)
          .collection("messages")
          .where("type", "==", "negotiation_card")
          .where("negotiationCard.status", "in", ["pending", "countered"])
          .get();

        if (remainingNegotiations.empty) {
          await nativeFirestore()
            .collection("chats")
            .doc(chatDoc.id)
            .update({ hasActiveNegotiation: false });
        }
      }

      return expiredCount;
    }

    // Web SDK implementation
    const chatsRef = collection(db, "chats");
    const chatsQuery = query(chatsRef, where("hasActiveNegotiation", "==", true));
    const chatsSnapshot = await getDocs(chatsQuery);

    for (const chatDoc of chatsSnapshot.docs) {
      if (excludeChatId && chatDoc.id === excludeChatId) continue;

      const messagesRef = collection(db, "chats", chatDoc.id, "messages");
      const messagesQuery = query(messagesRef, where("type", "==", "negotiation_card"));
      const messagesSnapshot = await getDocs(messagesQuery);

      for (const messageDoc of messagesSnapshot.docs) {
        const message = messageDoc.data();
        const card = message.negotiationCard;

        if (!card || !["pending", "countered"].includes(card.status)) continue;
        if (card.turfId !== turfId) continue;
        if (normalizeGroundId(card.groundId) !== normalizedGroundId) continue;
        if (card.date !== date) continue;
        if (!(card.startTime < endTime && card.endTime > startTime)) continue;

        const messageRef = doc(db, "chats", chatDoc.id, "messages", messageDoc.id);
        await updateDoc(messageRef, {
          "negotiationCard.status": "expired",
          "negotiationCard.expiredAt": webServerTimestamp(),
          "negotiationCard.expiredReason": "Slot was booked by another user",
        });

        expiredCount++;
      }

      // Check if chat still has active negotiations
      const remainingQuery = query(
        messagesRef,
        where("type", "==", "negotiation_card"),
        where("negotiationCard.status", "in", ["pending", "countered"])
      );
      const remainingNegotiations = await getDocs(remainingQuery);

      if (remainingNegotiations.empty) {
        const chatRef = doc(db, "chats", chatDoc.id);
        await updateDoc(chatRef, { hasActiveNegotiation: false });
      }
    }

    return expiredCount;
  } catch (error) {
    console.error("Error expiring negotiations:", error);
    return expiredCount;
  }
};

/**
 * Get booking by ID
 * @param {string} bookingId - Booking ID
 * @returns {Promise<object|null>}
 */
export const getBooking = async (bookingId) => {
  try {
    if (hasNativeFirestore) {
      const doc = await nativeFirestore().collection("bookings").doc(bookingId).get();
      if (doc.exists) {
        return { id: doc.id, ...doc.data() };
      }
      return null;
    }

    const bookingRef = doc(db, "bookings", bookingId);
    const bookingDoc = await getDoc(bookingRef);
    if (bookingDoc.exists()) {
      return { id: bookingDoc.id, ...bookingDoc.data() };
    }
    return null;
  } catch (error) {
    console.error("Error getting booking:", error);
    throw error;
  }
};

/**
 * Calculate duration between two times
 */
const calculateDuration = (startTime, endTime) => {
  if (!startTime || !endTime) return 0;
  const [startHour, startMin] = startTime.split(":").map(Number);
  const [endHour, endMin] = endTime.split(":").map(Number);
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  return (endMinutes - startMinutes) / 60;
};
