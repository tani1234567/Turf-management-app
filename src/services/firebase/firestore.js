import { Platform } from "react-native";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp as webServerTimestamp,
  writeBatch,
  Timestamp,
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

const snapshotExists = (docSnap) => {
  if (typeof docSnap?.exists === "function") {
    return docSnap.exists();
  }
  return !!docSnap?.exists;
};

// Normalize ground ID for comparison (handles legacy "ground-0" vs "ground_0" formats)
const normalizeGroundId = (groundId) => {
  if (!groundId) return "";
  return groundId.toLowerCase().replace(/[-_]/g, "");
};

export const serverTimestamp = () => {
  if (hasNativeFirestore) {
    return nativeFirestore.FieldValue.serverTimestamp();
  }
  return webServerTimestamp();
};

/**
 * Get a single document by ID
 * @param {string} collectionName - Collection name
 * @param {string} docId - Document ID
 * @returns {Promise<object|null>} - Document data or null
 */
export const getDocument = async (collectionName, docId) => {
  try {
    if (hasNativeFirestore) {
      const docSnap = await nativeFirestore()
        .collection(collectionName)
        .doc(docId)
        .get();
      if (snapshotExists(docSnap)) {
        return { id: docSnap.id, ...docSnap.data() };
      }
      return null;
    }

    const docRef = doc(db, collectionName, docId);
    const docSnap = await getDoc(docRef);
    if (snapshotExists(docSnap)) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (error) {
    console.error("Error getting document:", error);
    throw error;
  }
};

/**
 * Get all documents from a collection
 * @param {string} collectionName - Collection name
 * @returns {Promise<array>} - Array of documents
 */
export const getCollection = async (collectionName) => {
  try {
    if (hasNativeFirestore) {
      const querySnapshot = await nativeFirestore().collection(collectionName).get();
      return querySnapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
    }

    const querySnapshot = await getDocs(collection(db, collectionName));
    return querySnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    }));
  } catch (error) {
    console.error("Error getting collection:", error);
    throw error;
  }
};

/**
 * Query documents with conditions
 * @param {string} collectionName - Collection name
 * @param {array} conditions - Array of where conditions [{field, operator, value}]
 * @param {object} options - Optional {orderByField, orderDirection, limitCount}
 * @returns {Promise<array>} - Array of documents
 */
export const queryDocuments = async (collectionName, conditions = [], options = {}) => {
  try {
    if (hasNativeFirestore) {
      let q = nativeFirestore().collection(collectionName);

      // Add where conditions
      conditions.forEach(({ field, operator, value }) => {
        q = q.where(field, operator, value);
      });

      // Add orderBy if specified
      if (options.orderByField) {
        q = q.orderBy(options.orderByField, options.orderDirection || "asc");
      }

      // Add limit if specified
      if (options.limitCount) {
        q = q.limit(options.limitCount);
      }

      const querySnapshot = await q.get();
      return querySnapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
    }

    let q = collection(db, collectionName);
    const constraints = [];

    // Add where conditions
    conditions.forEach(({ field, operator, value }) => {
      constraints.push(where(field, operator, value));
    });

    // Add orderBy if specified
    if (options.orderByField) {
      constraints.push(orderBy(options.orderByField, options.orderDirection || "asc"));
    }

    // Add limit if specified
    if (options.limitCount) {
      constraints.push(limit(options.limitCount));
    }

    q = query(q, ...constraints);
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    }));
  } catch (error) {
    console.error("Error querying documents:", error);
    throw error;
  }
};

/**
 * Add a new document with auto-generated ID
 * @param {string} collectionName - Collection name
 * @param {object} data - Document data
 * @returns {Promise<string>} - New document ID
 */
export const addDocument = async (collectionName, data) => {
  try {
    if (hasNativeFirestore) {
      const docRef = await nativeFirestore().collection(collectionName).add({
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return docRef.id;
    }

    const docRef = await addDoc(collection(db, collectionName), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error("Error adding document:", error);
    throw error;
  }
};

/**
 * Set a document with specific ID (creates or overwrites)
 * @param {string} collectionName - Collection name
 * @param {string} docId - Document ID
 * @param {object} data - Document data
 * @param {boolean} merge - Merge with existing data (default: false)
 * @returns {Promise<void>}
 */
export const setDocument = async (collectionName, docId, data, merge = false) => {
  try {
    if (hasNativeFirestore) {
      await nativeFirestore()
        .collection(collectionName)
        .doc(docId)
        .set(
          {
            ...data,
            updatedAt: serverTimestamp(),
          },
          { merge }
        );
      return;
    }

    const docRef = doc(db, collectionName, docId);
    await setDoc(
      docRef,
      {
        ...data,
        updatedAt: serverTimestamp(),
      },
      { merge }
    );
  } catch (error) {
    console.error("Error setting document:", error);
    throw error;
  }
};

/**
 * Update specific fields in a document
 * @param {string} collectionName - Collection name
 * @param {string} docId - Document ID
 * @param {object} data - Fields to update
 * @returns {Promise<void>}
 */
export const updateDocument = async (collectionName, docId, data) => {
  try {
    if (hasNativeFirestore) {
      await nativeFirestore()
        .collection(collectionName)
        .doc(docId)
        .update({
          ...data,
          updatedAt: serverTimestamp(),
        });
      return;
    }

    const docRef = doc(db, collectionName, docId);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error updating document:", error);
    throw error;
  }
};

/**
 * Delete a document
 * @param {string} collectionName - Collection name
 * @param {string} docId - Document ID
 * @returns {Promise<void>}
 */
export const deleteDocument = async (collectionName, docId) => {
  try {
    if (hasNativeFirestore) {
      await nativeFirestore().collection(collectionName).doc(docId).delete();
      return;
    }

    const docRef = doc(db, collectionName, docId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting document:", error);
    throw error;
  }
};

/**
 * Subscribe to real-time updates on a document
 * @param {string} collectionName - Collection name
 * @param {string} docId - Document ID
 * @param {function} callback - Callback function receiving document data
 * @returns {function} - Unsubscribe function
 */
export const subscribeToDocument = (collectionName, docId, callback) => {
  if (hasNativeFirestore) {
    const docRef = nativeFirestore().collection(collectionName).doc(docId);
    return docRef.onSnapshot((docSnap) => {
      if (snapshotExists(docSnap)) {
        callback({ id: docSnap.id, ...docSnap.data() });
      } else {
        callback(null);
      }
    });
  }

  const docRef = doc(db, collectionName, docId);
  return onSnapshot(docRef, (docSnap) => {
    if (snapshotExists(docSnap)) {
      callback({ id: docSnap.id, ...docSnap.data() });
    } else {
      callback(null);
    }
  });
};

/**
 * Subscribe to real-time updates on a collection/query
 * @param {string} collectionName - Collection name
 * @param {function} callback - Callback function receiving array of documents
 * @param {array} conditions - Optional where conditions
 * @returns {function} - Unsubscribe function
 */
export const subscribeToCollection = (collectionName, callback, conditions = []) => {
  if (hasNativeFirestore) {
    let q = nativeFirestore().collection(collectionName);

    if (conditions.length > 0) {
      conditions.forEach(({ field, operator, value }) => {
        q = q.where(field, operator, value);
      });
    }

    return q.onSnapshot((querySnapshot) => {
      const docs = querySnapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      callback(docs);
    });
  }

  let q = collection(db, collectionName);

  if (conditions.length > 0) {
    const constraints = conditions.map(({ field, operator, value }) =>
      where(field, operator, value)
    );
    q = query(q, ...constraints);
  }

  return onSnapshot(q, (querySnapshot) => {
    const docs = querySnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    }));
    callback(docs);
  });
};

/**
 * Create a Firestore Timestamp from a Date or milliseconds in future
 * @param {Date|number} dateOrMs - Date object or milliseconds to add to now
 * @returns {Timestamp} - Firestore Timestamp
 */
export const createTimestamp = (dateOrMs) => {
  if (hasNativeFirestore) {
    if (typeof dateOrMs === "number") {
      return nativeFirestore.Timestamp.fromDate(new Date(Date.now() + dateOrMs));
    }
    return nativeFirestore.Timestamp.fromDate(dateOrMs);
  }
  if (typeof dateOrMs === "number") {
    return Timestamp.fromDate(new Date(Date.now() + dateOrMs));
  }
  return Timestamp.fromDate(dateOrMs);
};

/**
 * Execute multiple write operations atomically using batch
 * @param {array} operations - Array of operations: [{type: 'update'|'set'|'delete', collection, docId, data?, merge?}]
 * @returns {Promise<void>}
 */
export const batchWrite = async (operations) => {
  try {
    if (hasNativeFirestore) {
      const batch = nativeFirestore().batch();

      operations.forEach((op) => {
        const docRef = nativeFirestore().collection(op.collection).doc(op.docId);

        switch (op.type) {
          case "set":
            batch.set(
              docRef,
              {
                ...op.data,
                updatedAt: serverTimestamp(),
              },
              { merge: op.merge || false }
            );
            break;
          case "update":
            batch.update(docRef, {
              ...op.data,
              updatedAt: serverTimestamp(),
            });
            break;
          case "delete":
            batch.delete(docRef);
            break;
          default:
            console.warn(`Unknown batch operation type: ${op.type}`);
        }
      });

      await batch.commit();
      return;
    }

    // Web SDK
    const batch = writeBatch(db);

    operations.forEach((op) => {
      const docRef = doc(db, op.collection, op.docId);

      switch (op.type) {
        case "set":
          batch.set(
            docRef,
            {
              ...op.data,
              updatedAt: serverTimestamp(),
            },
            { merge: op.merge || false }
          );
          break;
        case "update":
          batch.update(docRef, {
            ...op.data,
            updatedAt: serverTimestamp(),
          });
          break;
        case "delete":
          batch.delete(docRef);
          break;
        default:
          console.warn(`Unknown batch operation type: ${op.type}`);
      }
    });

    await batch.commit();
  } catch (error) {
    console.error("Error executing batch write:", error);
    throw error;
  }
};

/**
 * Run a Firestore transaction
 * @param {function} updateFunction - Function that receives transaction object
 * @returns {Promise<any>} - Result of the transaction
 */
export const runTransaction = async (updateFunction) => {
  try {
    if (hasNativeFirestore) {
      return await nativeFirestore().runTransaction(updateFunction);
    }
    return await webRunTransaction(db, updateFunction);
  } catch (error) {
    console.error("Error running transaction:", error);
    throw error;
  }
};

/**
 * Check ground availability including blocked slots
 * @param {string} turfId - Turf ID
 * @param {string} groundId - Ground ID (or "all" for all grounds)
 * @param {string} date - Date string (YYYY-MM-DD)
 * @param {string} startTime - Start time (HH:MM)
 * @param {string} endTime - End time (HH:MM)
 * @returns {Promise<{available: boolean, conflicts: array, blocks: array}>}
 */
export const checkGroundAvailability = async (turfId, groundId, date, startTime, endTime) => {
  const normalizedGroundId = normalizeGroundId(groundId);
  const dayOfWeek = new Date(date).toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();

  try {
    // Check for booking conflicts
    const bookings = await queryDocuments("bookings", [
      { field: "turfId", operator: "==", value: turfId },
      { field: "date", operator: "==", value: date },
    ]);

    const conflictingBookings = bookings.filter((booking) => {
      if (!["pending", "confirmed", "in_progress"].includes(booking.status)) return false;
      if (groundId !== "all" && normalizeGroundId(booking.groundId) !== normalizedGroundId) return false;
      // Check time overlap
      return booking.startTime < endTime && booking.endTime > startTime;
    });

    // Check for blocked slots
    const blockedSlots = await queryDocuments("blocked_slots", [
      { field: "turfId", operator: "==", value: turfId },
    ]);

    const activeBlocks = blockedSlots.filter((block) => {
      // Check ground match
      if (groundId !== "all" && block.groundId !== "all") {
        if (normalizeGroundId(block.groundId) !== normalizedGroundId) return false;
      }

      // Check date match based on block type
      if (block.blockType === "recurring") {
        // Check if date is within recurring range
        if (date < block.startDate || date > (block.recurringEndDate || block.endDate)) return false;
        // Check if day matches recurring days
        if (!block.recurringDays || !block.recurringDays.includes(dayOfWeek)) return false;
      } else if (block.blockType === "range") {
        // Check if date is within range
        if (date < block.startDate || date > block.endDate) return false;
      } else {
        // Single day block
        if (date !== block.startDate) return false;
      }

      // Check time overlap
      const blockStart = block.allDay ? "06:00" : block.startTime;
      const blockEnd = block.allDay ? "23:00" : block.endTime;
      return blockStart < endTime && blockEnd > startTime;
    });

    return {
      available: conflictingBookings.length === 0 && activeBlocks.length === 0,
      conflicts: conflictingBookings,
      blocks: activeBlocks,
    };
  } catch (error) {
    console.error("Error checking ground availability:", error);
    throw error;
  }
};

/**
 * Get blocked slots for a specific date range
 * @param {string} turfId - Turf ID
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Promise<array>} - Array of dates with their blocked slots
 */
export const getBlockedDates = async (turfId, startDate, endDate) => {
  try {
    const blockedSlots = await queryDocuments("blocked_slots", [
      { field: "turfId", operator: "==", value: turfId },
    ]);

    const blockedDates = {};
    const currentDate = new Date(startDate);
    const end = new Date(endDate);

    while (currentDate <= end) {
      const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}-${String(currentDate.getDate()).padStart(2, "0")}`;
      const dayOfWeek = currentDate.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();

      const blocksForDate = blockedSlots.filter((block) => {
        if (block.blockType === "recurring") {
          if (dateStr < block.startDate || dateStr > (block.recurringEndDate || block.endDate)) return false;
          if (!block.recurringDays || !block.recurringDays.includes(dayOfWeek)) return false;
          return true;
        } else if (block.blockType === "range") {
          return dateStr >= block.startDate && dateStr <= block.endDate;
        } else {
          return dateStr === block.startDate;
        }
      });

      if (blocksForDate.length > 0) {
        blockedDates[dateStr] = blocksForDate;
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return blockedDates;
  } catch (error) {
    console.error("Error getting blocked dates:", error);
    throw error;
  }
};

// Helper function to check if slot is blocked
const isSlotBlocked = (blockedSlots, groundId, date, startTime, endTime) => {
  const normalizedGroundId = normalizeGroundId(groundId);
  const dayOfWeek = new Date(date).toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();

  return blockedSlots.some((block) => {
    // Check ground match (block.groundId === "all" blocks all grounds)
    if (block.groundId !== "all") {
      if (normalizeGroundId(block.groundId) !== normalizedGroundId) return false;
    }

    // Check date match based on block type
    if (block.blockType === "recurring") {
      if (date < block.startDate || date > (block.recurringEndDate || block.endDate)) return false;
      if (!block.recurringDays || !block.recurringDays.includes(dayOfWeek)) return false;
    } else if (block.blockType === "range") {
      if (date < block.startDate || date > block.endDate) return false;
    } else {
      if (date !== block.startDate) return false;
    }

    // Check time overlap
    const blockStart = block.allDay ? "06:00" : block.startTime;
    const blockEnd = block.allDay ? "23:00" : block.endTime;
    return blockStart < endTime && blockEnd > startTime;
  });
};

/**
 * Create a booking with transaction to handle race conditions
 * Verifies slot availability (including blocked slots) before creating the booking
 * @param {object} bookingData - Booking details
 * @returns {Promise<{success: boolean, bookingId?: string, message?: string}>}
 */
export const createBookingWithTransaction = async (bookingData) => {
  const { turfId, groundId, date, startTime, endTime } = bookingData;
  const normalizedNewGroundId = normalizeGroundId(groundId);

  try {
    if (hasNativeFirestore) {
      // React Native Firebase transaction
      const result = await nativeFirestore().runTransaction(async (transaction) => {
        // Query for conflicting bookings - fetch all bookings for this turf/date
        // then filter by ground ID in code to handle legacy ID format differences
        const bookingsRef = nativeFirestore().collection("bookings");
        const conflictingBookings = await bookingsRef
          .where("turfId", "==", turfId)
          .where("date", "==", date)
          .where("status", "in", ["pending", "confirmed", "in_progress"])
          .get();

        // Check for time overlap with normalized ground ID comparison
        const hasBookingConflict = conflictingBookings.docs.some((doc) => {
          const booking = doc.data();
          // Use normalized comparison to handle legacy data with different ID formats
          // (e.g., "ground-0" vs "ground_0")
          if (normalizeGroundId(booking.groundId) !== normalizedNewGroundId) {
            return false;
          }
          // Check if time ranges overlap
          // Conflict exists if: existingStart < newEnd AND existingEnd > newStart
          return booking.startTime < endTime && booking.endTime > startTime;
        });

        if (hasBookingConflict) {
          return { success: false, message: "This time slot is no longer available" };
        }

        // Check for blocked slots
        const blockedSlotsRef = nativeFirestore().collection("blocked_slots");
        const blockedSlotsSnapshot = await blockedSlotsRef
          .where("turfId", "==", turfId)
          .get();

        const blockedSlots = blockedSlotsSnapshot.docs.map((doc) => doc.data());
        if (isSlotBlocked(blockedSlots, groundId, date, startTime, endTime)) {
          return { success: false, message: "This time slot is blocked for maintenance or private event" };
        }

        // Create the booking
        const newBookingRef = bookingsRef.doc();
        transaction.set(newBookingRef, {
          ...bookingData,
          createdAt: nativeFirestore.FieldValue.serverTimestamp(),
          updatedAt: nativeFirestore.FieldValue.serverTimestamp(),
        });

        return { success: true, bookingId: newBookingRef.id };
      });

      return result;
    }

    // Web SDK transaction
    const result = await webRunTransaction(db, async (transaction) => {
      // Query for conflicting bookings - fetch all bookings for this turf/date
      // then filter by ground ID in code to handle legacy ID format differences
      const bookingsRef = collection(db, "bookings");
      const q = query(
        bookingsRef,
        where("turfId", "==", turfId),
        where("date", "==", date),
        where("status", "in", ["pending", "confirmed", "in_progress"])
      );

      const conflictingBookings = await getDocs(q);

      // Check for time overlap with normalized ground ID comparison
      const hasBookingConflict = conflictingBookings.docs.some((docSnap) => {
        const booking = docSnap.data();
        // Use normalized comparison to handle legacy data with different ID formats
        // (e.g., "ground-0" vs "ground_0")
        if (normalizeGroundId(booking.groundId) !== normalizedNewGroundId) {
          return false;
        }
        // Check if time ranges overlap
        return booking.startTime < endTime && booking.endTime > startTime;
      });

      if (hasBookingConflict) {
        return { success: false, message: "This time slot is no longer available" };
      }

      // Check for blocked slots
      const blockedSlotsRef = collection(db, "blocked_slots");
      const blockedQ = query(blockedSlotsRef, where("turfId", "==", turfId));
      const blockedSlotsSnapshot = await getDocs(blockedQ);

      const blockedSlots = blockedSlotsSnapshot.docs.map((docSnap) => docSnap.data());
      if (isSlotBlocked(blockedSlots, groundId, date, startTime, endTime)) {
        return { success: false, message: "This time slot is blocked for maintenance or private event" };
      }

      // Create the booking
      const newBookingRef = doc(collection(db, "bookings"));
      transaction.set(newBookingRef, {
        ...bookingData,
        createdAt: webServerTimestamp(),
        updatedAt: webServerTimestamp(),
      });

      return { success: true, bookingId: newBookingRef.id };
    });

    return result;
  } catch (error) {
    console.error("Error creating booking with transaction:", error);
    return {
      success: false,
      message: "An error occurred while creating your booking. Please try again.",
    };
  }
};

/**
 * Get today's bookings for a caretaker (assigned turf only)
 * @param {string} turfId - Assigned turf ID
 * @returns {Promise<{success: boolean, turfName?: string, bookings?: array, message?: string}>}
 */
export const getTodayBookingsForCaretaker = async (turfId) => {
  try {
    console.log("getTodayBookingsForCaretaker - turfId:", turfId);

    if (!turfId) {
      console.log("getTodayBookingsForCaretaker - No turfId provided");
      return {
        success: false,
        message: "No turf assigned",
      };
    }

    // Get today's date in YYYY-MM-DD format
    const today = new Date();
    const todayString = today.toISOString().split("T")[0];
    console.log("getTodayBookingsForCaretaker - Today's date:", todayString);

    if (hasNativeFirestore) {
      console.log("getTodayBookingsForCaretaker - Using native Firestore");
      // Get turf name
      const turfDoc = await nativeFirestore()
        .collection("turfs")
        .doc(turfId)
        .get();

      console.log("getTodayBookingsForCaretaker - Turf doc exists:", turfDoc.exists);
      const turfName = turfDoc.exists ? turfDoc.data().name : "Unknown Turf";
      console.log("getTodayBookingsForCaretaker - Turf name:", turfName);

      // Get today's bookings for this turf
      const bookingsSnapshot = await nativeFirestore()
        .collection("bookings")
        .where("turfId", "==", turfId)
        .where("date", "==", todayString)
        .orderBy("startTime", "asc")
        .get();

      console.log("getTodayBookingsForCaretaker - Bookings count:", bookingsSnapshot.docs.length);

      const bookings = bookingsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      return {
        success: true,
        turfName,
        bookings,
      };
    }

    // Web SDK
    console.log("getTodayBookingsForCaretaker - Using web SDK");
    // Get turf name
    const turfDocRef = doc(db, "turfs", turfId);
    const turfDoc = await getDoc(turfDocRef);

    console.log("getTodayBookingsForCaretaker - Turf doc exists:", snapshotExists(turfDoc));
    const turfName = snapshotExists(turfDoc) ? turfDoc.data().name : "Unknown Turf";
    console.log("getTodayBookingsForCaretaker - Turf name:", turfName);

    // Get today's bookings for this turf
    const bookingsRef = collection(db, "bookings");
    const q = query(
      bookingsRef,
      where("turfId", "==", turfId),
      where("date", "==", todayString),
      orderBy("startTime", "asc")
    );

    const bookingsSnapshot = await getDocs(q);
    const bookings = bookingsSnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    }));

    console.log("getTodayBookingsForCaretaker - Bookings count:", bookings.length);
    console.log("getTodayBookingsForCaretaker - Returning success with turf name:", turfName);

    return {
      success: true,
      turfName,
      bookings,
    };
  } catch (error) {
    console.error("Error fetching today's bookings for caretaker:", error);
    console.error("Error details:", error.message, error.stack);
    return {
      success: false,
      message: "Failed to fetch bookings. Please try again.",
      error: error.message,
    };
  }
};

/**
 * Get bookings for a specific date by caretaker (assigned turf only)
 * @param {string} turfId - Assigned turf ID
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Promise<{success: boolean, bookings?: array, message?: string}>}
 */
export const getBookingsForDateByCaretaker = async (turfId, date) => {
  try {
    if (!turfId) {
      return {
        success: false,
        message: "No turf assigned",
      };
    }

    if (!date) {
      return {
        success: false,
        message: "Date is required",
      };
    }

    if (hasNativeFirestore) {
      // Get bookings for this turf on the specified date
      const bookingsSnapshot = await nativeFirestore()
        .collection("bookings")
        .where("turfId", "==", turfId)
        .where("date", "==", date)
        .orderBy("startTime", "asc")
        .get();

      const bookings = bookingsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      return {
        success: true,
        bookings,
      };
    }

    // Web SDK
    const bookingsRef = collection(db, "bookings");
    const q = query(
      bookingsRef,
      where("turfId", "==", turfId),
      where("date", "==", date),
      orderBy("startTime", "asc")
    );

    const bookingsSnapshot = await getDocs(q);
    const bookings = bookingsSnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    }));

    return {
      success: true,
      bookings,
    };
  } catch (error) {
    console.error("Error fetching bookings for date:", error);
    return {
      success: false,
      message: "Failed to fetch bookings. Please try again.",
    };
  }
};

/**
 * Collect payment for a booking
 * @param {string} bookingId - Booking ID
 * @param {object} paymentData - Payment details
 * @returns {Promise<{success: boolean, message?: string}>}
 */
export const collectPayment = async (bookingId, paymentData) => {
  try {
    console.log("collectPayment - bookingId:", bookingId);
    console.log("collectPayment - paymentData:", paymentData);

    if (!bookingId) {
      return {
        success: false,
        message: "Booking ID is required",
      };
    }

    const {
      cashAmount = 0,
      onlineAmount = 0,
      totalAmount = 0,
      isFullPayment = false,
      isPartialPayment = false,
      partialPaymentNotes = "",
      collectedBy,
      collectedByName,
      collectedAt,
    } = paymentData;

    if (hasNativeFirestore) {
      const bookingRef = nativeFirestore().collection("bookings").doc(bookingId);
      const bookingDoc = await bookingRef.get();

      if (!bookingDoc.exists) {
        return {
          success: false,
          message: "Booking not found",
        };
      }

      const booking = bookingDoc.data();

      // Determine payment method
      let paymentMethod = "cash";
      if (cashAmount > 0 && onlineAmount > 0) {
        paymentMethod = "both";
      } else if (onlineAmount > 0) {
        paymentMethod = "online";
      }

      // Update booking with payment details
      await bookingRef.update({
        "payment.remainingPaid": isFullPayment,
        "payment.remainingAmount": isFullPayment ? 0 : (booking.payment?.remainingAmount || 0) - totalAmount,
        "payment.paymentMethod": paymentMethod,
        "payment.cashAmount": cashAmount,
        "payment.onlineAmount": onlineAmount,
        "payment.paidAt": nativeFirestore.FieldValue.serverTimestamp(),
        "payment.collectedBy": collectedBy,
        "payment.collectedByName": collectedByName,
        "payment.isPartialPayment": isPartialPayment,
        "payment.partialPaymentNotes": partialPaymentNotes,
        status: isFullPayment ? "completed" : booking.status,
        statusHistory: [
          ...(booking.statusHistory || []),
          {
            status: isFullPayment ? "completed" : booking.status,
            timestamp: new Date(),
            changedBy: collectedBy,
            changedByRole: "caretaker",
            reason: isFullPayment
              ? "Payment collected - booking completed"
              : `Partial payment collected: ₹${totalAmount}`,
          },
        ],
        updatedAt: nativeFirestore.FieldValue.serverTimestamp(),
      });

      console.log("collectPayment - Payment collected successfully");
      return {
        success: true,
        message: "Payment collected successfully",
      };
    }

    // Web SDK
    const bookingRef = doc(db, "bookings", bookingId);
    const bookingDoc = await getDoc(bookingRef);

    if (!snapshotExists(bookingDoc)) {
      return {
        success: false,
        message: "Booking not found",
      };
    }

    const booking = bookingDoc.data();

    // Determine payment method
    let paymentMethod = "cash";
    if (cashAmount > 0 && onlineAmount > 0) {
      paymentMethod = "both";
    } else if (onlineAmount > 0) {
      paymentMethod = "online";
    }

    // Update booking with payment details
    await updateDoc(bookingRef, {
      "payment.remainingPaid": isFullPayment,
      "payment.remainingAmount": isFullPayment ? 0 : (booking.payment?.remainingAmount || 0) - totalAmount,
      "payment.paymentMethod": paymentMethod,
      "payment.cashAmount": cashAmount,
      "payment.onlineAmount": onlineAmount,
      "payment.paidAt": webServerTimestamp(),
      "payment.collectedBy": collectedBy,
      "payment.collectedByName": collectedByName,
      "payment.isPartialPayment": isPartialPayment,
      "payment.partialPaymentNotes": partialPaymentNotes,
      status: isFullPayment ? "completed" : booking.status,
      statusHistory: [
        ...(booking.statusHistory || []),
        {
          status: isFullPayment ? "completed" : booking.status,
          timestamp: new Date(),
          changedBy: collectedBy,
          changedByRole: "caretaker",
          reason: isFullPayment
            ? "Payment collected - booking completed"
            : `Partial payment collected: ₹${totalAmount}`,
        },
      ],
      updatedAt: webServerTimestamp(),
    });

    console.log("collectPayment - Payment collected successfully");
    return {
      success: true,
      message: "Payment collected successfully",
    };
  } catch (error) {
    console.error("Error collecting payment:", error);
    return {
      success: false,
      message: "Failed to collect payment. Please try again.",
      error: error.message,
    };
  }
};

/**
 * Mark booking as no-show
 * @param {string} bookingId - Booking ID
 * @param {string} markedBy - User ID who marked as no-show
 * @param {string} markedByName - Name of user who marked as no-show
 * @returns {Promise<{success: boolean, message?: string}>}
 */
export const markBookingAsNoShow = async (bookingId, markedBy, markedByName) => {
  try {
    console.log("markBookingAsNoShow - bookingId:", bookingId);

    if (!bookingId) {
      return {
        success: false,
        message: "Booking ID is required",
      };
    }

    if (hasNativeFirestore) {
      const bookingRef = nativeFirestore().collection("bookings").doc(bookingId);
      const bookingDoc = await bookingRef.get();

      if (!bookingDoc.exists) {
        return {
          success: false,
          message: "Booking not found",
        };
      }

      const booking = bookingDoc.data();

      // Update booking status to no-show
      await bookingRef.update({
        status: "no_show",
        noShowMarkedBy: markedBy,
        noShowMarkedByName: markedByName,
        noShowMarkedAt: nativeFirestore.FieldValue.serverTimestamp(),
        statusHistory: [
          ...(booking.statusHistory || []),
          {
            status: "no_show",
            timestamp: new Date(),
            changedBy: markedBy,
            changedByRole: "caretaker",
            reason: "Customer did not show up",
          },
        ],
        updatedAt: nativeFirestore.FieldValue.serverTimestamp(),
      });

      console.log("markBookingAsNoShow - Marked as no-show successfully");
      return {
        success: true,
        message: "Booking marked as no-show",
      };
    }

    // Web SDK
    const bookingRef = doc(db, "bookings", bookingId);
    const bookingDoc = await getDoc(bookingRef);

    if (!snapshotExists(bookingDoc)) {
      return {
        success: false,
        message: "Booking not found",
      };
    }

    const booking = bookingDoc.data();

    // Update booking status to no-show
    await updateDoc(bookingRef, {
      status: "no_show",
      noShowMarkedBy: markedBy,
      noShowMarkedByName: markedByName,
      noShowMarkedAt: webServerTimestamp(),
      statusHistory: [
        ...(booking.statusHistory || []),
        {
          status: "no_show",
          timestamp: new Date(),
          changedBy: markedBy,
          changedByRole: "caretaker",
          reason: "Customer did not show up",
        },
      ],
      updatedAt: webServerTimestamp(),
    });

    console.log("markBookingAsNoShow - Marked as no-show successfully");
    return {
      success: true,
      message: "Booking marked as no-show",
    };
  } catch (error) {
    console.error("Error marking booking as no-show:", error);
    return {
      success: false,
      message: "Failed to mark as no-show. Please try again.",
      error: error.message,
    };
  }
};

/**
 * Extend booking time
 * @param {string} bookingId - Booking ID
 * @param {object} extensionData - Extension details
 * @returns {Promise<{success: boolean, message?: string}>}
 */
export const extendBookingTime = async (bookingId, extensionData) => {
  try {
    console.log("extendBookingTime - bookingId:", bookingId);
    console.log("extendBookingTime - extensionData:", extensionData);

    if (!bookingId) {
      return {
        success: false,
        message: "Booking ID is required",
      };
    }

    const {
      extensionDuration = 0,
      newEndTime,
      extensionCharge = 0,
      extendedBy,
      extendedByName,
      extendedAt,
    } = extensionData;

    if (!newEndTime || extensionDuration <= 0) {
      return {
        success: false,
        message: "Invalid extension data",
      };
    }

    if (hasNativeFirestore) {
      const bookingRef = nativeFirestore().collection("bookings").doc(bookingId);
      const bookingDoc = await bookingRef.get();

      if (!bookingDoc.exists) {
        return {
          success: false,
          message: "Booking not found",
        };
      }

      const booking = bookingDoc.data();

      // Calculate new total amount
      const currentExtensionAmount = booking.extensionAmount || 0;
      const newExtensionAmount = currentExtensionAmount + extensionCharge;
      const currentTotalAmount = booking.totalAmount || booking.baseAmount || 0;
      const newTotalAmount = currentTotalAmount + extensionCharge;

      // Add extension time slot
      const extensionTimeSlot = {
        startTime: booking.endTime,
        endTime: newEndTime,
        duration: extensionDuration,
        hourlyRate: extensionCharge / extensionDuration,
        amount: extensionCharge,
        isExtension: true,
      };

      // Update remaining amount if payment not yet completed
      const currentRemainingAmount = booking.payment?.remainingAmount || 0;
      const newRemainingAmount = booking.payment?.remainingPaid
        ? currentRemainingAmount
        : currentRemainingAmount + extensionCharge;

      // Update booking with extension details
      await bookingRef.update({
        endTime: newEndTime,
        totalDuration: (booking.totalDuration || 0) + extensionDuration,
        extensionAmount: newExtensionAmount,
        totalAmount: newTotalAmount,
        timeSlots: [...(booking.timeSlots || []), extensionTimeSlot],
        "payment.remainingAmount": newRemainingAmount,
        extensionHistory: [
          ...(booking.extensionHistory || []),
          {
            extensionDuration,
            oldEndTime: booking.endTime,
            newEndTime,
            extensionCharge,
            extendedBy,
            extendedByName,
            extendedAt: extendedAt || new Date(),
          },
        ],
        updatedAt: nativeFirestore.FieldValue.serverTimestamp(),
      });

      console.log("extendBookingTime - Booking extended successfully");
      return {
        success: true,
        message: "Booking extended successfully",
      };
    }

    // Web SDK
    const bookingRef = doc(db, "bookings", bookingId);
    const bookingDoc = await getDoc(bookingRef);

    if (!snapshotExists(bookingDoc)) {
      return {
        success: false,
        message: "Booking not found",
      };
    }

    const booking = bookingDoc.data();

    // Calculate new total amount
    const currentExtensionAmount = booking.extensionAmount || 0;
    const newExtensionAmount = currentExtensionAmount + extensionCharge;
    const currentTotalAmount = booking.totalAmount || booking.baseAmount || 0;
    const newTotalAmount = currentTotalAmount + extensionCharge;

    // Add extension time slot
    const extensionTimeSlot = {
      startTime: booking.endTime,
      endTime: newEndTime,
      duration: extensionDuration,
      hourlyRate: extensionCharge / extensionDuration,
      amount: extensionCharge,
      isExtension: true,
    };

    // Update remaining amount if payment not yet completed
    const currentRemainingAmount = booking.payment?.remainingAmount || 0;
    const newRemainingAmount = booking.payment?.remainingPaid
      ? currentRemainingAmount
      : currentRemainingAmount + extensionCharge;

    // Update booking with extension details
    await updateDoc(bookingRef, {
      endTime: newEndTime,
      totalDuration: (booking.totalDuration || 0) + extensionDuration,
      extensionAmount: newExtensionAmount,
      totalAmount: newTotalAmount,
      timeSlots: [...(booking.timeSlots || []), extensionTimeSlot],
      "payment.remainingAmount": newRemainingAmount,
      extensionHistory: [
        ...(booking.extensionHistory || []),
        {
          extensionDuration,
          oldEndTime: booking.endTime,
          newEndTime,
          extensionCharge,
          extendedBy,
          extendedByName,
          extendedAt: extendedAt || new Date(),
        },
      ],
      updatedAt: webServerTimestamp(),
    });

    console.log("extendBookingTime - Booking extended successfully");
    return {
      success: true,
      message: "Booking extended successfully",
    };
  } catch (error) {
    console.error("Error extending booking time:", error);
    return {
      success: false,
      message: "Failed to extend booking. Please try again.",
      error: error.message,
    };
  }
};
