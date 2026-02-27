/**
 * Slot Color Utilities — BookMyShow-style time slot color coding
 *
 * Pure utility functions for determining slot status and colors.
 * Used by TimeSlotGrid to show aggregate availability across all grounds
 * for a selected sport at Step 2 (before ground selection).
 */

// Normalize ground ID for comparison (handles legacy "ground-0" vs "ground_0" formats)
const normalizeGroundId = (groundId) => {
  if (!groundId) return "";
  return groundId.toLowerCase().replace(/[-_]/g, "");
};

// ── Status Types ──────────────────────────────────────────────────

export const SLOT_STATUS = {
  AVAILABLE: "available",
  HIGH_DEMAND: "high_demand",
  CONFIRMED: "confirmed",
  ACADEMY: "academy",
  LOCKED: "locked",
  PAST: "past",
  BLOCKED: "blocked",
  PENDING: "pending",
};

// ── Color Definitions ─────────────────────────────────────────────

export const SLOT_COLORS = {
  [SLOT_STATUS.AVAILABLE]: {
    bg: "#E8F5E9",
    border: "#4CAF50",
    text: "#2E7D32",
    hex: "#4CAF50",
  },
  [SLOT_STATUS.HIGH_DEMAND]: {
    bg: "#FFF8E1",
    border: "#FFC107",
    text: "#F57F17",
    hex: "#FFC107",
  },
  [SLOT_STATUS.CONFIRMED]: {
    bg: "#E3F2FD",
    border: "#2196F3",
    text: "#1565C0",
    hex: "#2196F3",
  },
  [SLOT_STATUS.ACADEMY]: {
    bg: "#FFF3E0",
    border: "#FF9800",
    text: "#E65100",
    hex: "#FF9800",
  },
  [SLOT_STATUS.LOCKED]: {
    bg: "#F3E5F5",
    border: "#9C27B0",
    text: "#6A1B9A",
    hex: "#9C27B0",
  },
  [SLOT_STATUS.PAST]: {
    bg: "#F5F5F5",
    border: "#9E9E9E",
    text: "#9E9E9E",
    hex: "#9E9E9E",
  },
  [SLOT_STATUS.BLOCKED]: {
    bg: "#F5F5F5",
    border: "#9E9E9E",
    text: "#9E9E9E",
    hex: "#9E9E9E",
  },
  [SLOT_STATUS.PENDING]: {
    bg: "#FFF8E1",
    border: "#FFC107",
    text: "#F57F17",
    hex: "#FFC107",
  },
};

// ── Labels for legend ─────────────────────────────────────────────

export const SLOT_LABELS = {
  [SLOT_STATUS.AVAILABLE]: "Available",
  [SLOT_STATUS.HIGH_DEMAND]: "High Demand",
  [SLOT_STATUS.CONFIRMED]: "Booked",
  [SLOT_STATUS.ACADEMY]: "Academy",
  [SLOT_STATUS.LOCKED]: "Being Booked",
  [SLOT_STATUS.PAST]: "Past",
  [SLOT_STATUS.BLOCKED]: "Unavailable",
  [SLOT_STATUS.PENDING]: "Pending",
};

// ── Toast messages when tapping disabled slots ────────────────────

export const SLOT_MESSAGES = {
  [SLOT_STATUS.CONFIRMED]: "This slot is already booked on all grounds",
  [SLOT_STATUS.ACADEMY]: "Reserved for academy session",
  [SLOT_STATUS.LOCKED]: "Someone is currently booking this slot",
  [SLOT_STATUS.PAST]: "This time has already passed",
  [SLOT_STATUS.BLOCKED]: "This slot is unavailable",
  [SLOT_STATUS.HIGH_DEMAND]: "Limited availability — some grounds are taken",
};

// ── Selectable flags ──────────────────────────────────────────────

const SELECTABLE = {
  [SLOT_STATUS.AVAILABLE]: true,
  [SLOT_STATUS.HIGH_DEMAND]: true,
  [SLOT_STATUS.CONFIRMED]: false,
  [SLOT_STATUS.ACADEMY]: false,
  [SLOT_STATUS.LOCKED]: false,
  [SLOT_STATUS.PAST]: false,
  [SLOT_STATUS.BLOCKED]: false,
  [SLOT_STATUS.PENDING]: true,
};

// ── Icons for status badges ───────────────────────────────────────

export const SLOT_ICONS = {
  [SLOT_STATUS.LOCKED]: "lock",
  [SLOT_STATUS.CONFIRMED]: "check-circle",
  [SLOT_STATUS.ACADEMY]: "school",
};

// ── Priority order (higher index = higher priority) ───────────────

const STATUS_PRIORITY = {
  [SLOT_STATUS.AVAILABLE]: 0,
  [SLOT_STATUS.PENDING]: 1,
  [SLOT_STATUS.HIGH_DEMAND]: 2,
  [SLOT_STATUS.ACADEMY]: 3,
  [SLOT_STATUS.BLOCKED]: 4,
  [SLOT_STATUS.CONFIRMED]: 5,
  [SLOT_STATUS.LOCKED]: 6,
  [SLOT_STATUS.PAST]: 7,
};

// ── Helper: parse lock expiry safely ──────────────────────────────

function parseLockExpiry(lockExpiry) {
  if (!lockExpiry) return null;
  if (lockExpiry.toDate) return lockExpiry.toDate();
  if (lockExpiry instanceof Date) return lockExpiry;
  const d = new Date(lockExpiry);
  return isNaN(d.getTime()) ? null : d;
}

// ── Helper: check if a blocked slot applies to a given time/ground ──

function isSlotBlockedForGround(timeSlot, groundId, selectedDate, blockedSlots) {
  if (!selectedDate || !blockedSlots?.length) return false;

  const dateStr = selectedDate.dateString || selectedDate;
  const dateObj = selectedDate.date || new Date(dateStr);
  const dayOfWeek = dateObj
    .toLocaleDateString("en-US", { weekday: "long" })
    .toLowerCase();
  const normalizedGid = normalizeGroundId(groundId);

  // We treat the slot as covering [timeSlot.time, nextSlotTime)
  // For simplicity, use 30-min window
  const slotStart = timeSlot.time;
  const [h, m] = slotStart.split(":").map(Number);
  const endMinutes = h * 60 + m + 30;
  const slotEnd = `${Math.floor(endMinutes / 60)
    .toString()
    .padStart(2, "0")}:${(endMinutes % 60).toString().padStart(2, "0")}`;

  return blockedSlots.some((block) => {
    // Check ground match
    if (block.groundId !== "all") {
      if (normalizeGroundId(block.groundId) !== normalizedGid) return false;
    }

    // Check date match
    if (block.blockType === "recurring") {
      if (dateStr < block.startDate || dateStr > (block.recurringEndDate || block.endDate))
        return false;
      if (!block.recurringDays || !block.recurringDays.includes(dayOfWeek))
        return false;
    } else if (block.blockType === "range") {
      if (dateStr < block.startDate || dateStr > block.endDate) return false;
    } else {
      if (dateStr !== block.startDate) return false;
    }

    // Check time overlap
    const blockStart = block.allDay ? "06:00" : block.startTime;
    const blockEnd = block.allDay ? "23:00" : block.endTime;
    return blockStart < slotEnd && blockEnd > slotStart;
  });
}

// ──────────────────────────────────────────────────────────────────
// getSlotStatusForGround
// Determines the status of ONE time slot on ONE ground.
// ──────────────────────────────────────────────────────────────────

export function getSlotStatusForGround(timeSlot, groundId, params) {
  const {
    selectedDate,
    bookings = [],
    academySessions = [],
    blockedSlots = [],
    advancePaymentRequired = false,
  } = params;

  const normalizedGid = normalizeGroundId(groundId);
  const slotStart = timeSlot.time;
  const [h, m] = slotStart.split(":").map(Number);
  const endMinutes = h * 60 + m + 30;
  const slotEnd = `${Math.floor(endMinutes / 60)
    .toString()
    .padStart(2, "0")}:${(endMinutes % 60).toString().padStart(2, "0")}`;

  // 1. Past
  if (selectedDate?.isToday) {
    const now = new Date();
    const slotTime = new Date();
    slotTime.setHours(h, m, 0, 0);
    if (slotTime <= now) return SLOT_STATUS.PAST;
  }

  // Check bookings for this ground + time overlap
  const overlappingBookings = bookings.filter((b) => {
    if (normalizeGroundId(b.groundId) !== normalizedGid) return false;
    return b.startTime < slotEnd && b.endTime > slotStart;
  });

  // 2. Hard lock (payment_submitted / awaiting_payment with hard lock)
  const hardLocked = overlappingBookings.find(
    (b) =>
      b.slotLock?.lockType === "hard" &&
      b.slotLock?.isLocked &&
      ["payment_submitted", "awaiting_payment"].includes(b.status)
  );
  if (hardLocked) return SLOT_STATUS.LOCKED;

  // 3. Soft lock (pending_payment with active lock expiry)
  const softLocked = overlappingBookings.find((b) => {
    if (b.slotLock?.lockType !== "soft" || !b.slotLock?.isLocked) return false;
    if (b.status !== "pending_payment") return false;
    const expiry = parseLockExpiry(b.slotLock?.lockExpiry);
    return expiry && expiry > new Date();
  });
  if (softLocked) return SLOT_STATUS.LOCKED;

  // 4. Confirmed / In-Progress / Completed booking
  const confirmedBooking = overlappingBookings.find((b) =>
    ["confirmed", "in_progress", "completed"].includes(b.status)
  );
  if (confirmedBooking) return SLOT_STATUS.CONFIRMED;

  // 5. Manager blocked
  if (isSlotBlockedForGround(timeSlot, groundId, selectedDate, blockedSlots)) {
    return SLOT_STATUS.BLOCKED;
  }

  // 6. Academy session
  const academyBlocked = academySessions.some((session) => {
    if (normalizeGroundId(session.groundId) !== normalizedGid) return false;
    return session.startTime < slotEnd && session.endTime > slotStart;
  });
  if (academyBlocked) return SLOT_STATUS.ACADEMY;

  // 7. Pending booking (no advance required) — still occupies ground
  const pendingBooking = overlappingBookings.find((b) => b.status === "pending");
  if (pendingBooking) return SLOT_STATUS.PENDING;

  // 8. Default — Available
  return SLOT_STATUS.AVAILABLE;
}

// ──────────────────────────────────────────────────────────────────
// getAggregateSlotStatus
// Aggregates status across ALL grounds for a sport (Step 2 view).
// ──────────────────────────────────────────────────────────────────

export function getAggregateSlotStatus(timeSlot, sportGrounds, params) {
  if (!sportGrounds || sportGrounds.length === 0) {
    return {
      status: SLOT_STATUS.AVAILABLE,
      selectable: true,
      colors: SLOT_COLORS[SLOT_STATUS.AVAILABLE],
      availableCount: 0,
      totalCount: 0,
    };
  }

  // Check past first (same for all grounds)
  if (params.selectedDate?.isToday) {
    const [h, m] = timeSlot.time.split(":").map(Number);
    const now = new Date();
    const slotTime = new Date();
    slotTime.setHours(h, m, 0, 0);
    if (slotTime <= now) {
      return {
        status: SLOT_STATUS.PAST,
        selectable: false,
        colors: SLOT_COLORS[SLOT_STATUS.PAST],
        availableCount: 0,
        totalCount: sportGrounds.length,
      };
    }
  }

  const groundStatuses = sportGrounds.map((ground) => ({
    groundId: ground.id,
    status: getSlotStatusForGround(timeSlot, ground.id, params),
  }));

  const totalCount = groundStatuses.length;
  const selectableStatuses = [SLOT_STATUS.AVAILABLE, SLOT_STATUS.HIGH_DEMAND, SLOT_STATUS.PENDING];
  const availableCount = groundStatuses.filter((gs) =>
    selectableStatuses.includes(gs.status)
  ).length;

  // ALL grounds are non-selectable → return highest-priority blocked status
  if (availableCount === 0) {
    let highestPriority = SLOT_STATUS.BLOCKED;
    let highestPriorityValue = -1;

    for (const gs of groundStatuses) {
      const p = STATUS_PRIORITY[gs.status] ?? 0;
      if (p > highestPriorityValue) {
        highestPriorityValue = p;
        highestPriority = gs.status;
      }
    }

    return {
      status: highestPriority,
      selectable: false,
      colors: SLOT_COLORS[highestPriority],
      availableCount: 0,
      totalCount,
    };
  }

  // SOME grounds blocked but at least 1 available → High Demand (yellow)
  if (availableCount < totalCount) {
    return {
      status: SLOT_STATUS.HIGH_DEMAND,
      selectable: true,
      colors: SLOT_COLORS[SLOT_STATUS.HIGH_DEMAND],
      availableCount,
      totalCount,
    };
  }

  // ALL grounds available → Green
  return {
    status: SLOT_STATUS.AVAILABLE,
    selectable: true,
    colors: SLOT_COLORS[SLOT_STATUS.AVAILABLE],
    availableCount,
    totalCount,
  };
}

// ──────────────────────────────────────────────────────────────────
// computeAllSlotStatuses
// Batch computes status for all time slots.
// ──────────────────────────────────────────────────────────────────

export function computeAllSlotStatuses(timeSlots, sportGrounds, params) {
  const result = {};

  for (const slot of timeSlots) {
    result[slot.time] = getAggregateSlotStatus(slot, sportGrounds, params);
  }

  return result;
}

// ──────────────────────────────────────────────────────────────────
// getActiveLegendItems
// Returns only statuses present in current view. Always includes
// Available and Past as minimums.
// ──────────────────────────────────────────────────────────────────

export function getActiveLegendItems(slotStatusMap) {
  const activeStatuses = new Set();

  // Always show Available
  activeStatuses.add(SLOT_STATUS.AVAILABLE);

  for (const key of Object.keys(slotStatusMap)) {
    const { status } = slotStatusMap[key];
    activeStatuses.add(status);
  }

  // Build ordered legend items
  const order = [
    SLOT_STATUS.AVAILABLE,
    SLOT_STATUS.HIGH_DEMAND,
    SLOT_STATUS.CONFIRMED,
    SLOT_STATUS.ACADEMY,
    SLOT_STATUS.LOCKED,
    SLOT_STATUS.PAST,
    SLOT_STATUS.BLOCKED,
  ];

  return order
    .filter((s) => activeStatuses.has(s))
    .map((s) => ({
      status: s,
      label: SLOT_LABELS[s],
      color: SLOT_COLORS[s].hex,
    }));
}
