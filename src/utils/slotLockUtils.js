import {
  queryDocuments,
  updateDocument,
  createTimestamp,
} from "../services/firebase/firestore";

const SOFT_LOCK_DURATION = 10 * 60 * 1000; // 10 minutes in ms

/**
 * Check if two time ranges overlap
 */
export function timeOverlaps(start1, end1, start2, end2) {
  return start1 < end2 && end1 > start2;
}

/**
 * Normalize ground ID for comparison (handles legacy "ground-0" vs "ground_0" formats)
 */
function normalizeGroundId(groundId) {
  if (!groundId) return "";
  return groundId.toLowerCase().replace(/[-_]/g, "");
}

/**
 * Check if a slot is available (considering locks)
 * @param {string} turfId - Turf ID
 * @param {string} groundId - Ground ID
 * @param {string} date - Date string (YYYY-MM-DD)
 * @param {string} startTime - Start time (HH:mm)
 * @param {string} endTime - End time (HH:mm)
 * @param {string} paymentTiming - "before_approval" | "after_approval"
 * @returns {Promise<{available: boolean, reason?: string, message?: string}>}
 */
export async function checkSlotAvailability(
  turfId,
  groundId,
  date,
  startTime,
  endTime,
  paymentTiming = "before_approval"
) {
  const normalizedGround = normalizeGroundId(groundId);

  try {
    // Statuses that ALWAYS block the slot
    const hardBlockStatuses = [
      "confirmed",
      "in_progress",
      "awaiting_payment",
      "payment_submitted",
    ];

    // Query hard blocks
    const hardBlockBookings = await queryDocuments("bookings", [
      { field: "turfId", operator: "==", value: turfId },
      { field: "date", operator: "==", value: date },
      { field: "status", operator: "in", value: hardBlockStatuses },
    ]);

    for (const booking of hardBlockBookings) {
      if (
        normalizeGroundId(booking.groundId) === normalizedGround &&
        timeOverlaps(startTime, endTime, booking.startTime, booking.endTime)
      ) {
        return {
          available: false,
          reason: "booked",
          message: "This slot is not available",
        };
      }
    }

    // Query soft blocks (pending_payment with active lock)
    const softBlockBookings = await queryDocuments("bookings", [
      { field: "turfId", operator: "==", value: turfId },
      { field: "date", operator: "==", value: date },
      { field: "status", operator: "==", value: "pending_payment" },
    ]);

    for (const booking of softBlockBookings) {
      if (
        normalizeGroundId(booking.groundId) === normalizedGround &&
        timeOverlaps(startTime, endTime, booking.startTime, booking.endTime)
      ) {
        // Check if lock is still active
        const lockExpiry = booking.slotLock?.lockExpiry;
        const expiryTime = lockExpiry?.toDate
          ? lockExpiry.toDate()
          : lockExpiry
          ? new Date(lockExpiry)
          : null;

        if (expiryTime && expiryTime > new Date()) {
          return {
            available: false,
            reason: "being_booked",
            message: "High demand! Try again in some time",
          };
        }
        // Lock expired - slot is available (booking will be cleaned up)
      }
    }

    // For before_approval: check pending bookings with verified payment
    if (paymentTiming === "before_approval") {
      const pendingBookings = await queryDocuments("bookings", [
        { field: "turfId", operator: "==", value: turfId },
        { field: "date", operator: "==", value: date },
        { field: "status", operator: "==", value: "pending" },
      ]);

      for (const booking of pendingBookings) {
        if (
          normalizeGroundId(booking.groundId) === normalizedGround &&
          timeOverlaps(startTime, endTime, booking.startTime, booking.endTime) &&
          booking.payment?.advance?.status === "verified"
        ) {
          return {
            available: false,
            reason: "booked",
            message: "This slot is not available",
          };
        }
      }
    }

    // Check blocked slots
    const blockedSlots = await queryDocuments("blocked_slots", [
      { field: "turfId", operator: "==", value: turfId },
    ]);

    for (const block of blockedSlots) {
      // Check if the ground matches
      if (
        block.groundId &&
        normalizeGroundId(block.groundId) !== normalizedGround
      ) {
        continue;
      }

      // Check if date falls in range
      if (date >= (block.startDate || date) && date <= (block.endDate || date)) {
        const timeSlots = block.timeSlots || [];
        if (block.allDay) {
          return {
            available: false,
            reason: "blocked",
            message: block.reason || "Slot is blocked",
          };
        }
        for (const slot of timeSlots) {
          if (timeOverlaps(startTime, endTime, slot.startTime, slot.endTime)) {
            return {
              available: false,
              reason: "blocked",
              message: block.reason || "Slot is blocked",
            };
          }
        }
      }
    }

    return { available: true };
  } catch (error) {
    console.error("Error checking slot availability:", error);
    // On error, return available to not block users unnecessarily
    // Transaction in createBooking will catch conflicts
    return { available: true };
  }
}

/**
 * Create a soft lock when user initiates payment
 * @param {string} bookingId - Booking ID
 * @returns {Promise<Date>} Lock expiry date
 */
export async function createSoftLock(bookingId) {
  const now = new Date();
  const lockExpiry = new Date(now.getTime() + SOFT_LOCK_DURATION);

  await updateDocument("bookings", bookingId, {
    "slotLock.isLocked": true,
    "slotLock.lockType": "soft",
    "slotLock.lockedAt": now.toISOString(),
    "slotLock.lockExpiry": lockExpiry.toISOString(),
    "slotLock.lockReason": "payment_pending",
  });

  return lockExpiry;
}

/**
 * Convert soft lock to hard lock when payment submitted
 * @param {string} bookingId - Booking ID
 * @param {string} reason - Lock reason
 */
export async function convertToHardLock(
  bookingId,
  reason = "payment_submitted"
) {
  await updateDocument("bookings", bookingId, {
    "slotLock.isLocked": true,
    "slotLock.lockType": "hard",
    "slotLock.lockedAt": new Date().toISOString(),
    "slotLock.lockExpiry": null,
    "slotLock.lockReason": reason,
  });
}

/**
 * Release lock (on cancellation, rejection, expiry)
 * @param {string} bookingId - Booking ID
 */
export async function releaseLock(bookingId) {
  await updateDocument("bookings", bookingId, {
    "slotLock.isLocked": false,
    "slotLock.lockType": null,
    "slotLock.lockedAt": null,
    "slotLock.lockExpiry": null,
    "slotLock.lockReason": null,
  });
}
