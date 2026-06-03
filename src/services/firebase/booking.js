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

// Always use the web Firebase SDK — native @react-native-firebase/firestore
// has a separate auth context and causes permission-denied errors when auth
// state lives in the web SDK (AsyncStorage-backed).
const nativeFirestore = null;
const hasNativeFirestore = false;

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
        // 1. Check for conflicting bookings, but also look for existing pending booking from this negotiation
        const bookingsRef = nativeFirestore().collection("bookings");
        const conflictingBookings = await bookingsRef
          .where("turfId", "==", turfId)
          .where("date", "==", date)
          .where("status", "in", ["pending", "confirmed", "in_progress"])
          .get();

        let existingBookingDoc = null;

        const hasConflict = conflictingBookings.docs.some((docRef) => {
          const booking = docRef.data();
          if (normalizeGroundId(booking.groundId) !== normalizedNewGroundId) return false;
          const overlaps = booking.startTime < endTime && booking.endTime > startTime;
          if (!overlaps) return false;
          // If this is OUR pending booking from the same negotiation, update it instead
          if (booking.status === "pending" && booking.negotiation?.negotiationCardId === messageId) {
            existingBookingDoc = docRef;
            return false; // not a real conflict
          }
          return true;
        });

        if (hasConflict) {
          return {
            success: false,
            message: "This time slot is no longer available. Someone else booked it.",
          };
        }

        let bookingId;

        if (existingBookingDoc) {
          // Update existing pending booking to confirmed
          bookingId = existingBookingDoc.id;
          transaction.update(existingBookingDoc.ref, {
            status: "confirmed",
            totalAmount: requestedPrice || originalPrice || 0,
            totalPrice: requestedPrice || originalPrice || 0,
            "negotiation.finalPrice": requestedPrice || originalPrice || 0,
            "payment.remainingAmount": requestedPrice || originalPrice || 0,
            statusHistory: [
              ...(existingBookingDoc.data().statusHistory || []),
              {
                status: "confirmed",
                timestamp: new Date(),
                changedBy: respondedBy,
                changedByRole: "manager",
                reason: "Accepted via negotiation",
              },
            ],
            confirmedAt: nativeFirestore.FieldValue.serverTimestamp(),
            updatedAt: nativeFirestore.FieldValue.serverTimestamp(),
          });
        } else {
          // 2. Create a new booking
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
            createdAt: nativeFirestore.FieldValue.serverTimestamp(),
            requestedAt: nativeFirestore.FieldValue.serverTimestamp(),
            confirmedAt: nativeFirestore.FieldValue.serverTimestamp(),
            updatedAt: nativeFirestore.FieldValue.serverTimestamp(),
          };

          const newBookingRef = bookingsRef.doc();
          transaction.set(newBookingRef, bookingData);
          bookingId = newBookingRef.id;
        }

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
          "negotiationCard.bookingId": bookingId,
        });

        // 4. Update chat metadata
        const chatRef = nativeFirestore().collection("chats").doc(chatId);
        transaction.update(chatRef, {
          "lastMessage.text": "Booking confirmed!",
          hasActiveNegotiation: false,
          updatedAt: nativeFirestore.FieldValue.serverTimestamp(),
        });

        return { success: true, bookingId };
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

      let existingBookingDoc = null;

      const hasConflict = conflictingBookings.docs.some((docSnap) => {
        const booking = docSnap.data();
        if (normalizeGroundId(booking.groundId) !== normalizedNewGroundId) return false;
        const overlaps = booking.startTime < endTime && booking.endTime > startTime;
        if (!overlaps) return false;
        if (booking.status === "pending" && booking.negotiation?.negotiationCardId === messageId) {
          existingBookingDoc = docSnap;
          return false;
        }
        return true;
      });

      if (hasConflict) {
        return {
          success: false,
          message: "This time slot is no longer available. Someone else booked it.",
        };
      }

      let bookingId;

      if (existingBookingDoc) {
        // Update existing pending booking to confirmed
        bookingId = existingBookingDoc.id;
        const existingRef = doc(db, "bookings", bookingId);
        transaction.update(existingRef, {
          status: "confirmed",
          totalAmount: requestedPrice || originalPrice || 0,
          totalPrice: requestedPrice || originalPrice || 0,
          "negotiation.finalPrice": requestedPrice || originalPrice || 0,
          "payment.remainingAmount": requestedPrice || originalPrice || 0,
          statusHistory: [
            ...(existingBookingDoc.data().statusHistory || []),
            {
              status: "confirmed",
              timestamp: new Date(),
              changedBy: respondedBy,
              changedByRole: "manager",
              reason: "Accepted via negotiation",
            },
          ],
          confirmedAt: webServerTimestamp(),
          updatedAt: webServerTimestamp(),
        });
      } else {
        // 2. Create a new booking
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
        bookingId = newBookingRef.id;
      }

      // 3. Update the negotiation card status
      const messageRef = doc(db, "chats", chatId, "messages", messageId);
      transaction.update(messageRef, {
        "negotiationCard.status": "accepted",
        "negotiationCard.respondedBy": respondedBy,
        "negotiationCard.respondedByName": respondedByName,
        "negotiationCard.respondedAt": webServerTimestamp(),
        "negotiationCard.bookingId": bookingId,
      });

      // 4. Update chat metadata
      const chatRef = doc(db, "chats", chatId);
      transaction.update(chatRef, {
        "lastMessage.text": "Booking confirmed!",
        hasActiveNegotiation: false,
        updatedAt: webServerTimestamp(),
      });

      return { success: true, bookingId };
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
 * Create a booking from a negotiation card AND set it to "pending_payment"
 * with a 5-hour advance payment deadline. Mirrors createBookingFromNegotiation
 * but wires in the advance payment fields.
 *
 * @param {object} negotiationCard
 * @param {string} chatId
 * @param {string} messageId
 * @param {string} respondedBy
 * @param {string} respondedByName
 * @param {{ advanceAmount: number, upiId: string, upiHolderName: string }} advancePaymentData
 */
export const createBookingFromNegotiationWithPaymentRequest = async (
  negotiationCard,
  chatId,
  messageId,
  respondedBy,
  respondedByName,
  advancePaymentData
) => {
  const {
    turfId, turfName, groundId, groundName, sport,
    date, startTime, endTime, originalPrice, requestedPrice,
    senderId, senderName, senderPhone, senderEmail, companyId, duration,
  } = negotiationCard;

  if (!turfId || !groundId || !date || !startTime || !endTime) {
    return { success: false, message: "Missing required booking information." };
  }

  const userId = senderId || "unknown_user";
  const userName = senderName || "User";
  const userPhone = senderPhone || "";
  const userEmail = senderEmail || "";
  const bookingCompanyId = companyId || null;
  const bookingDuration = duration || calculateDuration(startTime, endTime);
  const normalizedNewGroundId = normalizeGroundId(groundId);
  const finalPrice = requestedPrice || originalPrice || 0;
  const { advanceAmount, upiId, upiHolderName } = advancePaymentData;

  // Payment deadline = 5 hours from now
  const paymentDeadline = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString();

  const buildBookingData = (tsFunc) => ({
    userId, userName, userPhone, userEmail,
    companyId: bookingCompanyId,
    turfId, turfName: turfName || "Unknown Turf",
    groundId, groundName: groundName || "Unknown Ground",
    bookingType: "regular",
    sport: sport || "Unknown",
    date, startTime, endTime,
    timeSlots: [{
      startTime, endTime,
      duration: bookingDuration,
      hourlyRate: originalPrice ? originalPrice / bookingDuration : 0,
      amount: finalPrice,
    }],
    totalDuration: bookingDuration,
    baseAmount: originalPrice || 0,
    totalAmount: finalPrice,
    totalPrice: finalPrice,
    status: "pending_payment",
    statusHistory: [
      { status: "pending", timestamp: new Date(), changedBy: userId, changedByRole: "user", reason: "Booking request created via negotiation" },
      { status: "pending_payment", timestamp: new Date(), changedBy: respondedBy, changedByRole: "manager", reason: "Advance payment requested via chat" },
    ],
    negotiation: {
      isNegotiated: true,
      requestedPrice: finalPrice,
      finalPrice,
      chatId,
      negotiationCardId: messageId,
    },
    payment: {
      slotAmount: finalPrice,
      advanceAmount,
      remainingAmount: finalPrice - advanceAmount,
      advancePaid: false,
      remainingPaid: false,
      advanceConfig: {
        isRequired: true,
        percentage: finalPrice > 0 ? Math.round((advanceAmount / finalPrice) * 100) : 0,
        paymentTiming: "after_approval",
        paymentTimeout: 300,
      },
      advance: {
        status: "pending",
        method: "upi",
        upiId,
        upiHolderName,
        paymentDeadline,
        submittedAt: null,
        verification: null,
        isExpired: false,
      },
      totalPaid: 0,
      totalPending: finalPrice,
      isFullyPaid: false,
    },
    slotLock: {
      isLocked: true,
      lockType: "soft",
      lockedAt: new Date().toISOString(),
      lockExpiry: paymentDeadline,
      lockReason: "awaiting_advance_payment",
    },
    createdAt: tsFunc(),
    requestedAt: tsFunc(),
    updatedAt: tsFunc(),
  });

  try {
    if (hasNativeFirestore) {
      return await nativeFirestore().runTransaction(async (transaction) => {
        const bookingsRef = nativeFirestore().collection("bookings");
        const conflictingBookings = await bookingsRef
          .where("turfId", "==", turfId)
          .where("date", "==", date)
          .where("status", "in", ["pending", "confirmed", "in_progress", "pending_payment"])
          .get();

        const hasConflict = conflictingBookings.docs.some((docRef) => {
          const booking = docRef.data();
          if (normalizeGroundId(booking.groundId) !== normalizedNewGroundId) return false;
          return booking.startTime < endTime && booking.endTime > startTime;
        });

        if (hasConflict) {
          return { success: false, message: "This time slot is no longer available." };
        }

        const newBookingRef = bookingsRef.doc();
        transaction.set(newBookingRef, buildBookingData(() => nativeFirestore.FieldValue.serverTimestamp()));
        const bookingId = newBookingRef.id;

        const messageRef = nativeFirestore().collection("chats").doc(chatId).collection("messages").doc(messageId);
        transaction.update(messageRef, {
          "negotiationCard.status": "accepted",
          "negotiationCard.respondedBy": respondedBy,
          "negotiationCard.respondedByName": respondedByName,
          "negotiationCard.respondedAt": nativeFirestore.FieldValue.serverTimestamp(),
          "negotiationCard.bookingId": bookingId,
        });

        const chatRef = nativeFirestore().collection("chats").doc(chatId);
        transaction.update(chatRef, {
          "lastMessage.text": "Advance payment requested",
          hasActiveNegotiation: false,
          updatedAt: nativeFirestore.FieldValue.serverTimestamp(),
        });

        return { success: true, bookingId, paymentDeadline };
      });
    }

    // Web SDK
    return await webRunTransaction(db, async (transaction) => {
      const bookingsRef = collection(db, "bookings");
      const q = query(
        bookingsRef,
        where("turfId", "==", turfId),
        where("date", "==", date),
        where("status", "in", ["pending", "confirmed", "in_progress", "pending_payment"])
      );
      const conflictingBookings = await getDocs(q);

      const hasConflict = conflictingBookings.docs.some((docSnap) => {
        const booking = docSnap.data();
        if (normalizeGroundId(booking.groundId) !== normalizedNewGroundId) return false;
        return booking.startTime < endTime && booking.endTime > startTime;
      });

      if (hasConflict) {
        return { success: false, message: "This time slot is no longer available." };
      }

      const newBookingRef = doc(collection(db, "bookings"));
      transaction.set(newBookingRef, buildBookingData(webServerTimestamp));
      const bookingId = newBookingRef.id;

      const messageRef = doc(db, "chats", chatId, "messages", messageId);
      transaction.update(messageRef, {
        "negotiationCard.status": "accepted",
        "negotiationCard.respondedBy": respondedBy,
        "negotiationCard.respondedByName": respondedByName,
        "negotiationCard.respondedAt": webServerTimestamp(),
        "negotiationCard.bookingId": bookingId,
      });

      const chatRef = doc(db, "chats", chatId);
      transaction.update(chatRef, {
        "lastMessage.text": "Advance payment requested",
        hasActiveNegotiation: false,
        updatedAt: webServerTimestamp(),
      });

      return { success: true, bookingId, paymentDeadline };
    });
  } catch (error) {
    console.error("Error creating booking with payment request:", error);
    return { success: false, message: "An error occurred. Please try again." };
  }
};

/**
 * Approve a booking (from pending_payment state) without requiring advance payment.
 * @param {string} bookingId
 * @param {string} approvedBy
 * @param {string} approvedByName
 */
export const approveBookingWithoutAdvancePayment = async (bookingId, approvedBy, approvedByName) => {
  try {
    const updateFields = {
      status: "confirmed",
      "payment.advance.status": "not_required",
      "slotLock.isLocked": true,
      "slotLock.lockType": "hard",
      "slotLock.lockExpiry": null,
      "slotLock.lockReason": "approved_without_advance",
      confirmedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (hasNativeFirestore) {
      await nativeFirestore().collection("bookings").doc(bookingId).update(updateFields);
      return { success: true };
    }

    const bookingRef = doc(db, "bookings", bookingId);
    await updateDoc(bookingRef, updateFields);
    return { success: true };
  } catch (error) {
    console.error("Error approving booking without advance payment:", error);
    return { success: false, message: error.message };
  }
};

/**
 * Update an existing booking's payment fields when a chat-initiated advance
 * payment request is sent for a booking that was already created (e.g. user
 * accepted a counter-offer before the manager requested advance payment).
 *
 * @param {string} bookingId
 * @param {number} totalAmount - booking's total price
 * @param {number} advanceAmount - requested advance amount
 * @param {{ upiId, upiHolderName, paymentDeadline }} advancePaymentData
 */
export const updateBookingWithAdvancePayment = async (
  bookingId,
  totalAmount,
  advanceAmount,
  advancePaymentData
) => {
  const { upiId, upiHolderName, paymentDeadline } = advancePaymentData;
  const remainingAmount = totalAmount - advanceAmount;
  const advancePercentage = totalAmount > 0 ? Math.round((advanceAmount / totalAmount) * 100) : 0;

  const updateFields = {
    status: "pending_payment",
    "payment.advanceAmount": advanceAmount,
    "payment.remainingAmount": remainingAmount,
    "payment.advancePaid": false,
    "payment.advanceConfig": {
      isRequired: true,
      percentage: advancePercentage,
      paymentTiming: "after_approval",
      paymentTimeout: 300, // 5 hours in minutes
    },
    "payment.advance.status": "pending",
    "payment.advance.method": "upi",
    "payment.advance.upiId": upiId || null,
    "payment.advance.upiHolderName": upiHolderName || null,
    "payment.advance.paymentDeadline": paymentDeadline,
    "payment.advance.submittedAt": null,
    "payment.advance.verification": null,
    "slotLock.isLocked": true,
    "slotLock.lockType": "soft",
    "slotLock.lockedAt": new Date().toISOString(),
    "slotLock.lockExpiry": paymentDeadline,
    "slotLock.lockReason": "awaiting_advance_payment",
    updatedAt: serverTimestamp(),
  };

  try {
    if (hasNativeFirestore) {
      await nativeFirestore().collection("bookings").doc(bookingId).update(updateFields);
      return { success: true };
    }
    const bookingRef = doc(db, "bookings", bookingId);
    await updateDoc(bookingRef, updateFields);
    return { success: true };
  } catch (error) {
    console.error("Error updating booking with advance payment:", error);
    return { success: false, message: error.message };
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
