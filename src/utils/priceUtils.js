/**
 * Price Calculation Engine for Turf Management System
 *
 * Handles pricing calculations for bookings including:
 * - Weekday/weekend detection
 * - Period-based pricing (morning, afternoon, evening)
 * - Cross-period bookings
 * - Duration calculation
 * - Extension pricing
 * - Price formatting
 *
 * Supports two pricing formats:
 * 1. PricingConfigurator format: { morning: { start, end, hourlyRate } }
 * 2. Ground pricing format:     { morning: { rate } }
 */

// ──────────────────────────────────────────────
// Pricing period boundaries (canonical source)
// ──────────────────────────────────────────────
const PRICING_PERIODS = [
  { name: "Morning", key: "morning", startHour: 6, endHour: 10 },
  { name: "Afternoon", key: "afternoon", startHour: 10, endHour: 18 },
  { name: "Evening", key: "evening", startHour: 18, endHour: 23 },
];

// ──────────────────────────────────────────────
// Helper Functions
// ──────────────────────────────────────────────

/**
 * Check if a date string (YYYY-MM-DD) or Date falls on a weekend
 * @param {string|Date} dateStr
 * @returns {boolean}
 */
export function isWeekend(dateStr) {
  const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  const day = d.getDay();
  return day === 0 || day === 6;
}

/**
 * Convert "HH:MM" string to total minutes from midnight
 * @param {string} timeStr - e.g. "14:30"
 * @returns {number} - e.g. 870
 */
export function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Convert total minutes from midnight to "HH:MM" string
 * @param {number} minutes - e.g. 870
 * @returns {string} - e.g. "14:30"
 */
export function minutesToTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

/**
 * Calculate duration between two times in hours
 * @param {string} startTime - "HH:MM"
 * @param {string} endTime   - "HH:MM"
 * @returns {number} - duration in hours (e.g. 1.5)
 */
export function calculateDuration(startTime, endTime) {
  const startMin = timeToMinutes(startTime);
  const endMin = timeToMinutes(endTime);
  return (endMin - startMin) / 60;
}

/**
 * Format a price amount as Indian currency string
 * @param {number} amount - e.g. 1500
 * @returns {string} - e.g. "₹1,500"
 */
export function formatPrice(amount) {
  if (amount == null || isNaN(amount)) return "₹0";
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

/**
 * Format a duration in hours to a human-readable string
 * @param {number} hours - e.g. 1.5
 * @returns {string} - e.g. "1h 30m"
 */
export function formatDuration(hours) {
  if (!hours || hours <= 0) return "0m";
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// ──────────────────────────────────────────────
// Period helpers
// ──────────────────────────────────────────────

/**
 * Determine the pricing period for a given hour
 * @param {number} hour - 0-23
 * @returns {{ name: string, key: string, startHour: number, endHour: number } | null}
 */
function getPeriodForHour(hour) {
  return PRICING_PERIODS.find((p) => hour >= p.startHour && hour < p.endHour) || null;
}

/**
 * Get the hourly rate from a period pricing object.
 * Supports both `hourlyRate` (PricingConfigurator) and `rate` (ground.pricing) fields.
 * @param {object|undefined} periodPricing - e.g. { rate: 1000 } or { hourlyRate: 1000 }
 * @param {number} fallback - fallback rate (e.g. allDayRate)
 * @returns {number}
 */
function getRate(periodPricing, fallback = 0) {
  if (!periodPricing) return fallback;
  return periodPricing.hourlyRate ?? periodPricing.rate ?? fallback;
}

// ──────────────────────────────────────────────
// Core: breakdownTimeIntoSlots
// ──────────────────────────────────────────────

/**
 * Break a time range into pricing-period segments with their rates.
 * Handles cross-period bookings (e.g. 09:00 - 19:00 spans morning → afternoon → evening).
 *
 * @param {string} startTime  - "HH:MM"
 * @param {string} endTime    - "HH:MM"
 * @param {object} dayPricing - { morning: { rate|hourlyRate, ... }, afternoon: { ... }, evening: { ... } }
 * @param {number} [allDayRate=0] - fallback rate when period rate is missing
 * @returns {Array<{ name: string, key: string, startTime: string, endTime: string, durationHours: number, rate: number, amount: number }>}
 */
export function breakdownTimeIntoSlots(startTime, endTime, dayPricing, allDayRate = 0) {
  const startMin = timeToMinutes(startTime);
  const endMin = timeToMinutes(endTime);

  if (endMin <= startMin) return [];

  const slots = [];
  let cursor = startMin;

  while (cursor < endMin) {
    const currentHour = Math.floor(cursor / 60);
    const period = getPeriodForHour(currentHour);

    if (!period) {
      // Outside all defined periods — advance by 30 min
      cursor += 30;
      continue;
    }

    const periodEndMin = period.endHour * 60;
    const slotEnd = Math.min(periodEndMin, endMin);
    const slotDurationMin = slotEnd - cursor;

    if (slotDurationMin <= 0) {
      cursor += 30;
      continue;
    }

    const durationHours = slotDurationMin / 60;
    const rate = getRate(dayPricing?.[period.key], allDayRate);
    const amount = rate * durationHours;

    slots.push({
      name: period.name,
      key: period.key,
      startTime: minutesToTime(cursor),
      endTime: minutesToTime(slotEnd),
      durationHours,
      rate,
      amount: Math.round(amount),
    });

    cursor = slotEnd;
  }

  return slots;
}

// ──────────────────────────────────────────────
// Core: calculateBookingPrice
// ──────────────────────────────────────────────

/**
 * Calculate the full booking price with breakdown.
 *
 * @param {object} ground    - Ground object with .pricing
 * @param {string} sport     - Sport name (currently unused — pricing is per-ground, not per-sport)
 * @param {string|Date} date - Date string (YYYY-MM-DD) or Date object
 * @param {string} startTime - "HH:MM"
 * @param {string} endTime   - "HH:MM"
 * @returns {{ slots: Array, subtotal: number, total: number, duration: number, isWeekend: boolean }}
 */
export function calculateBookingPrice(ground, sport, date, startTime, endTime) {
  const pricing = ground?.pricing;
  if (!pricing) {
    return { slots: [], subtotal: 0, total: 0, duration: 0, isWeekend: false };
  }

  const weekend = isWeekend(date);
  const dayType = weekend ? "weekend" : "weekday";
  const dayPricing = pricing[dayType] || pricing.weekday;
  const allDayRate = pricing.allDayRate || 0;

  const slots = breakdownTimeIntoSlots(startTime, endTime, dayPricing, allDayRate);

  const subtotal = slots.reduce((sum, slot) => sum + slot.amount, 0);
  const duration = calculateDuration(startTime, endTime);

  return {
    slots,
    subtotal,
    total: subtotal,
    duration,
    isWeekend: weekend,
  };
}

// ──────────────────────────────────────────────
// Extension pricing
// ──────────────────────────────────────────────

/**
 * Calculate the price for extending an existing booking.
 *
 * @param {object} originalBooking - The original booking document
 *   Expects: { endTime: "HH:MM", date: "YYYY-MM-DD" }
 * @param {number} extensionMinutes - How many minutes to extend by (e.g. 30, 60)
 * @param {object} ground - Ground object with .pricing
 * @returns {{ slots: Array, subtotal: number, total: number, newEndTime: string, extensionDuration: number }}
 */
export function calculateExtensionPrice(originalBooking, extensionMinutes, ground) {
  const { endTime, date } = originalBooking;
  const pricing = ground?.pricing;

  if (!pricing || !endTime || extensionMinutes <= 0) {
    return {
      slots: [],
      subtotal: 0,
      total: 0,
      newEndTime: endTime || "",
      extensionDuration: 0,
    };
  }

  const endMin = timeToMinutes(endTime);
  const newEndMin = endMin + extensionMinutes;
  const newEndTime = minutesToTime(newEndMin);

  const weekend = isWeekend(date);
  const dayType = weekend ? "weekend" : "weekday";
  const dayPricing = pricing[dayType] || pricing.weekday;
  const allDayRate = pricing.allDayRate || 0;

  const slots = breakdownTimeIntoSlots(endTime, newEndTime, dayPricing, allDayRate);
  const subtotal = slots.reduce((sum, slot) => sum + slot.amount, 0);

  return {
    slots,
    subtotal,
    total: subtotal,
    newEndTime,
    extensionDuration: extensionMinutes / 60,
  };
}

// ──────────────────────────────────────────────
// Legacy helper – per-slot (30 min) price
// Used by BookingScreen's grid display
// ──────────────────────────────────────────────

/**
 * Get the hourly rate for a specific time slot on a given ground.
 * Mirrors the logic previously inlined in BookingScreen.
 *
 * @param {string} timeStr   - "HH:MM"
 * @param {object} ground    - Ground object with .pricing
 * @param {boolean} weekend  - true if the date is a weekend
 * @returns {number} - hourly rate
 */
export function getSlotHourlyRate(timeStr, ground, weekend = false) {
  const pricing = ground?.pricing;
  if (!pricing) return 0;

  const dayType = weekend ? "weekend" : "weekday";
  const dayPricing = pricing[dayType] || pricing.weekday;
  if (!dayPricing) return pricing.allDayRate || 0;

  const hour = parseInt(timeStr.split(":")[0], 10);
  const period = getPeriodForHour(hour);
  if (!period) return pricing.allDayRate || 0;

  return getRate(dayPricing[period.key], pricing.allDayRate || 0);
}

// ──────────────────────────────────────────────────────────────────────────────
// Operating Hours → Time Slot Generator
// ──────────────────────────────────────────────────────────────────────────────

const _DAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

const _fmtLabel = (h, m) => {
  const period = h >= 12 ? "PM" : "AM";
  const dh = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${dh}:${m.toString().padStart(2, "0")} ${period}`;
};

/**
 * Generate 30-min time slots respecting turf operating hours for a given day.
 * Returns array of { time, hour, minute, label }.
 * Falls back to 06:00–23:00 when operatingHours/date not provided.
 * Returns [] if the turf is closed on that day (isOpen === false).
 *
 * @param {object} operatingHours  turf.operatingHours keyed by lowercase day name
 * @param {string|Date} date       "YYYY-MM-DD" string or Date object
 */
export const generateOperatingSlots = (operatingHours, date) => {
  let openMins = 6 * 60;   // default 06:00
  let closeMins = 23 * 60; // default 23:00

  if (operatingHours && date) {
    const d = date instanceof Date
      ? date
      : new Date(String(date).length === 10 ? date + "T00:00:00" : date);
    const dayKey = _DAY_KEYS[d.getDay()];
    const dayHours = operatingHours[dayKey];
    if (dayHours) {
      if (!dayHours.isOpen) return [];
      const [oh, om] = (dayHours.openTime  || "06:00").split(":").map(Number);
      const [ch, cm] = (dayHours.closeTime || "23:00").split(":").map(Number);
      openMins  = oh * 60 + (om || 0);
      closeMins = ch * 60 + (cm || 0);
    }
  }

  const slots = [];
  for (let mins = openMins; mins <= closeMins; mins += 30) {
    const hour   = Math.floor(mins / 60);
    const minute = mins % 60;
    if (hour > 23) break;
    const time = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
    slots.push({ time, hour, minute, label: _fmtLabel(hour, minute) });
  }
  return slots;
};

export default {
  isWeekend,
  timeToMinutes,
  minutesToTime,
  calculateDuration,
  formatPrice,
  formatDuration,
  breakdownTimeIntoSlots,
  calculateBookingPrice,
  calculateExtensionPrice,
  getSlotHourlyRate,
  generateOperatingSlots,
};
