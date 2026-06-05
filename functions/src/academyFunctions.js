const admin = require("firebase-admin");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onCall } = require("firebase-functions/v2/https");
const { sendNotification } = require("./helpers/notificationHelpers");

const db = admin.firestore();

/**
 * Get the day-of-week name for a YYYY-MM-DD string
 */
function getDayOfWeek(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const days = [
    "sunday", "monday", "tuesday", "wednesday",
    "thursday", "friday", "saturday",
  ];
  return days[date.getDay()];
}

/**
 * Pad a number to 2 digits
 */
function pad(n) {
  return String(n).padStart(2, "0");
}

/**
 * Format a Date object to YYYY-MM-DD
 */
function toDateStr(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Generate all session dates for a given schedule within a contract period
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @param {string[]} scheduledDays - e.g. ["monday", "wednesday", "friday"]
 * @returns {string[]} Array of YYYY-MM-DD date strings
 */
function generateSessionDates(startDate, endDate, scheduledDays) {
  const dates = [];
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  const current = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);

  while (current <= end) {
    const dateStr = toDateStr(current);
    const dayName = getDayOfWeek(dateStr);
    if (scheduledDays.includes(dayName)) {
      dates.push(dateStr);
    }
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

/**
 * Returns true if two time ranges overlap.
 * Times are "HH:MM" strings compared lexicographically (valid for 24-hour format).
 */
function timesOverlap(s1, e1, s2, e2) {
  if (!s1 || !e1 || !s2 || !e2) return false;
  return s1 < e2 && e1 > s2;
}

/**
 * Shared helper: Generate sessions for an academy.
 * Handles both old format (schedule.days as array) and new format (object map with per-day times).
 * Creates academy_sessions docs in batches and marks the academy as sessionsGenerated: true.
 * Auto-cancels any session that clashes with an existing upcoming booking.
 *
 * @param {string} academyId
 * @param {object} academyData - Full academy document data
 * @returns {{ success: boolean, sessionCount: number, clashCancelled: number }}
 */
async function generateSessionsForAcademy(academyId, academyData) {
  const {
    name,
    sport,
    turfId,
    turfName,
    groundId,
    groundName,
    schedule,
    contract,
  } = academyData;

  if (!schedule || !contract) {
    console.log(`Academy ${academyId}: Missing schedule or contract, skipping session generation`);
    return { success: false, sessionCount: 0, clashCancelled: 0 };
  }

  const isNewFormat = schedule.days && !Array.isArray(schedule.days);
  const scheduledDays = isNewFormat ? Object.keys(schedule.days) : schedule.days;
  const globalStartTime = isNewFormat ? null : schedule.startTime;
  const globalEndTime = isNewFormat ? null : schedule.endTime;
  const { startDate, endDate } = contract;

  if (!scheduledDays || scheduledDays.length === 0 || !startDate || !endDate) {
    console.log(`Academy ${academyId}: Incomplete schedule/contract data, skipping`);
    return { success: false, sessionCount: 0, clashCancelled: 0 };
  }

  let sessionDates = generateSessionDates(startDate, endDate, scheduledDays);
  console.log(`Generating ${sessionDates.length} sessions for academy ${academyId} (format: ${isNewFormat ? "per-day" : "global"})`);

  const academyRef = db.collection("academies").doc(academyId);

  // Dedupe: skip dates that already have a session doc for this academy
  // (prevents duplicate sessions when regenerating on renewal).
  const existingSnap = await db
    .collection("academy_sessions")
    .where("academyId", "==", academyId)
    .get();
  const existingDates = new Set(existingSnap.docs.map((d) => d.data().date));
  if (existingDates.size > 0) {
    const before = sessionDates.length;
    sessionDates = sessionDates.filter((d) => !existingDates.has(d));
    console.log(`Academy ${academyId}: skipped ${before - sessionDates.length} dates that already have sessions`);
  }

  if (sessionDates.length === 0) {
    await academyRef.update({
      sessionCount: existingDates.size,
      sessionsGenerated: true,
      generatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true, sessionCount: 0, clashCancelled: 0 };
  }

  // ── Clash detection ──────────────────────────────────────────────────────────
  // Fetch all existing upcoming bookings for this ground in the session date range
  // upfront (one query), then check clashes in memory per session.
  const clashableStatuses = [
    "confirmed", "pending", "pending_payment",
    "awaiting_payment", "payment_submitted",
  ];

  const bookingSnap = await db
    .collection("bookings")
    .where("turfId", "==", turfId)
    .where("groundId", "==", groundId)
    .where("date", ">=", startDate)
    .where("date", "<=", endDate)
    .get();

  // Build clash map: date → [{ startTime, endTime }]
  const clashMap = {};
  for (const doc of bookingSnap.docs) {
    const b = doc.data();
    if (!clashableStatuses.includes(b.status)) continue;
    if (!b.startTime || !b.endTime) continue;
    if (!clashMap[b.date]) clashMap[b.date] = [];
    clashMap[b.date].push({ startTime: b.startTime, endTime: b.endTime });
  }
  console.log(`Academy ${academyId}: found bookings on ${Object.keys(clashMap).length} dates in range`);
  // ────────────────────────────────────────────────────────────────────────────

  const BATCH_SIZE = 450;
  let totalCreated = 0;
  let clashCancelled = 0;

  for (let i = 0; i < sessionDates.length; i += BATCH_SIZE) {
    const chunk = sessionDates.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const date of chunk) {
      const dayName = getDayOfWeek(date);
      const dayLabel = dayName.charAt(0).toUpperCase() + dayName.slice(1, 3);
      const sessionRef = db.collection("academy_sessions").doc();

      const dayConfig = isNewFormat ? schedule.days[dayName] : null;
      const sessionStartTime = dayConfig ? dayConfig.startTime : globalStartTime;
      const sessionEndTime = dayConfig ? dayConfig.endTime : globalEndTime;

      // Check if any existing booking overlaps with this session slot
      const dayBookings = clashMap[date] || [];
      const clashingBooking = dayBookings.find((b) =>
        timesOverlap(sessionStartTime, sessionEndTime, b.startTime, b.endTime)
      );
      const hasClash = !!clashingBooking;
      if (hasClash) clashCancelled++;

      batch.set(sessionRef, {
        academyId,
        academyName: name,
        sessionName: `${name} - ${dayLabel}`,
        turfId,
        turfName: turfName || "",
        groundId,
        groundName: groundName || "",
        sport: sport || "",
        date,
        startTime: sessionStartTime,
        endTime: sessionEndTime,
        // Auto-cancel clashing sessions so the slot stays bookable
        status: hasClash ? "cancelled" : "scheduled",
        availableForBooking: hasClash,
        ...(hasClash && { cancelReason: "booking_clash" }),
        type: "academy",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();
    totalCreated += chunk.length;
    console.log(`Batch committed: ${totalCreated}/${sessionDates.length}`);
  }

  const finalCount = existingDates.size + totalCreated;
  await academyRef.update({
    sessionCount: finalCount,
    sessionsGenerated: true,
    generatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`Academy ${academyId}: ${totalCreated} new sessions generated (total ${finalCount}), ${clashCancelled} auto-cancelled (booking clash)`);
  return { success: true, sessionCount: totalCreated, clashCancelled };
}

/**
 * Cloud Function: Auto-generate academy sessions when an academy doc is created.
 *
 * Trigger: Firestore onCreate on academies/{academyId}
 */
exports.generateAcademySessions = onDocumentCreated(
  {
    document: "academies/{academyId}",
    timeoutSeconds: 300,
    memory: "512MB",
  },
  async (event) => {
    const academyId = event.params.academyId;
    const academy = event.data.data();
    console.log(`Academy ${academyId} created: "${academy.name}"`);
    return generateSessionsForAcademy(academyId, academy);
  }
);

/**
 * Cloud Function: Mark past academy sessions as completed.
 *
 * Runs daily at 1:00 AM IST.
 * Finds all academy_sessions with status "scheduled" where the date is before today,
 * and updates them to "completed".
 */
exports.markPastSessionsCompleted = onSchedule(
  {
    schedule: "0 1 * * *",
    timeZone: "Asia/Kolkata",
  },
  async () => {
    console.log("Marking past academy sessions as completed...");

    // Get today in IST as YYYY-MM-DD
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffset);
    const todayStr = toDateStr(istNow);

    console.log(`Today (IST): ${todayStr}`);

    try {
      // Query scheduled sessions with date < today
      const snapshot = await db
        .collection("academy_sessions")
        .where("status", "==", "scheduled")
        .where("date", "<", todayStr)
        .get();

      if (snapshot.empty) {
        console.log("No past sessions to mark as completed");
        return { updated: 0 };
      }

      console.log(`Found ${snapshot.size} past sessions to complete`);

      // Batch update
      const BATCH_SIZE = 450;
      let totalUpdated = 0;

      for (let i = 0; i < snapshot.docs.length; i += BATCH_SIZE) {
        const chunk = snapshot.docs.slice(i, i + BATCH_SIZE);
        const batch = db.batch();

        for (const doc of chunk) {
          batch.update(doc.ref, {
            status: "completed",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }

        await batch.commit();
        totalUpdated += chunk.length;
      }

      console.log(`Marked ${totalUpdated} sessions as completed`);
      return { updated: totalUpdated };
    } catch (error) {
      console.error("Error marking past sessions completed:", error);
      throw error;
    }
  });

/**
 * Cloud Function: Send renewal reminders for academies expiring in 5 days.
 *
 * Runs daily at 9:00 AM IST.
 * Finds active academies whose contract.endDate == today + 5 days
 * and sends a notification to the academy creator.
 */
exports.sendAcademyRenewalReminders = onSchedule(
  {
    schedule: "0 9 * * *",
    timeZone: "Asia/Kolkata",
  },
  async () => {
    console.log("Checking for academy renewal reminders...");

    // Get today + 5 days in IST
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffset);
    istNow.setDate(istNow.getDate() + 5);
    const targetDate = toDateStr(istNow);

    console.log(`Looking for academies expiring on: ${targetDate}`);

    try {
      const snapshot = await db
        .collection("academies")
        .where("status", "==", "active")
        .where("contract.endDate", "==", targetDate)
        .get();

      if (snapshot.empty) {
        console.log("No academies expiring in 5 days");
        return { reminded: 0 };
      }

      let reminded = 0;

      for (const doc of snapshot.docs) {
        const academy = doc.data();

        // Skip if already reminded
        if (academy.renewalReminderSent) continue;

        const createdBy = academy.createdBy;
        if (!createdBy) continue;

        await sendNotification(createdBy, {
          type: "academy_renewal_reminder",
          title: "Academy Expiring Soon",
          body: `"${academy.name}" contract expires on ${formatDateForNotification(academy.contract.endDate)}. Renew to continue sessions.`,
          data: { academyId: doc.id },
        });

        await doc.ref.update({ renewalReminderSent: true });
        reminded++;
        console.log(`Sent renewal reminder for academy ${doc.id} to user ${createdBy}`);
      }

      console.log(`Sent ${reminded} renewal reminders`);
      return { reminded };
    } catch (error) {
      console.error("Error sending renewal reminders:", error);
      throw error;
    }
  });

/**
 * Format a YYYY-MM-DD date string for notification display
 */
function formatDateForNotification(dateStr) {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${parseInt(day)} ${months[parseInt(month) - 1]} ${year}`;
}

/**
 * Cloud Function: Automatically expire academies whose contract has ended.
 *
 * Runs daily at 2:00 AM IST (before markPastSessionsCompleted at 1 AM,
 * after sessions are marked completed).
 * Finds active academies whose contract.endDate < today and sets status to "expired".
 */
exports.expireAcademies = onSchedule(
  {
    schedule: "0 2 * * *",
    timeZone: "Asia/Kolkata",
  },
  async () => {
    console.log("Checking for expired academies...");

    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffset);
    const todayStr = toDateStr(istNow);

    console.log(`Today (IST): ${todayStr}`);

    try {
      const snapshot = await db
        .collection("academies")
        .where("status", "==", "active")
        .where("contract.endDate", "<", todayStr)
        .get();

      if (snapshot.empty) {
        console.log("No academies to expire");
        return { expired: 0 };
      }

      console.log(`Found ${snapshot.size} academies to expire`);

      const BATCH_SIZE = 450;
      let totalExpired = 0;

      for (let i = 0; i < snapshot.docs.length; i += BATCH_SIZE) {
        const chunk = snapshot.docs.slice(i, i + BATCH_SIZE);
        const batch = db.batch();

        for (const doc of chunk) {
          batch.update(doc.ref, {
            status: "expired",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }

        await batch.commit();
        totalExpired += chunk.length;
      }

      console.log(`Expired ${totalExpired} academies`);
      return { expired: totalExpired };
    } catch (error) {
      console.error("Error expiring academies:", error);
      throw error;
    }
  });

/**
 * Cloud Function: Handle academy status changes and self-healing.
 *
 * - Self-healing: if sessionsGenerated is still false on an active academy, generate them
 * - On status change to "cancelled": cancel all future scheduled sessions
 * - On renewal (expired -> active): generate new sessions for the updated contract period
 */
exports.onAcademyStatusChange = onDocumentUpdated(
  {
    document: "academies/{academyId}",
    timeoutSeconds: 300,
    memory: "512MB",
  },
  async (event) => {
    const academyId = event.params.academyId;
    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();

    // Renewal detection: renewedAt changed AND sessions need regenerating.
    // This is more reliable than relying on a status transition, because the
    // client may renew an academy whose stored status was already "active".
    const beforeRenewedAt = beforeData.renewedAt?.toMillis?.() ?? beforeData.renewedAt ?? null;
    const afterRenewedAt = afterData.renewedAt?.toMillis?.() ?? afterData.renewedAt ?? null;
    const wasRenewed =
      afterRenewedAt && afterRenewedAt !== beforeRenewedAt &&
      afterData.sessionsGenerated === false;

    if (wasRenewed) {
      console.log(`Academy ${academyId}: renewal detected (renewedAt changed), generating new sessions`);
      return generateSessionsForAcademy(academyId, afterData);
    }

    // Self-healing: if sessions were never generated (onCreate failed), generate them now
    if (afterData.sessionsGenerated === false && afterData.status === "active") {
      console.log(`Academy ${academyId}: self-healing — sessions not yet generated, generating now`);
      await generateSessionsForAcademy(academyId, afterData);
      return;
    }

    const beforeStatus = beforeData.status;
    const afterStatus = afterData.status;

    if (beforeStatus === afterStatus) return null;

    console.log(`Academy ${academyId}: ${beforeStatus} -> ${afterStatus}`);

    // Get today's date in IST
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffset);
    const todayStr = toDateStr(istNow);

    if (afterStatus === "cancelled") {
      // Cancel all future scheduled sessions
      const snapshot = await db
        .collection("academy_sessions")
        .where("academyId", "==", academyId)
        .where("status", "==", "scheduled")
        .where("date", ">=", todayStr)
        .get();

      if (snapshot.empty) {
        console.log("No future sessions to cancel");
        return null;
      }

      const BATCH_SIZE = 450;
      let cancelled = 0;

      for (let i = 0; i < snapshot.docs.length; i += BATCH_SIZE) {
        const chunk = snapshot.docs.slice(i, i + BATCH_SIZE);
        const batch = db.batch();

        for (const doc of chunk) {
          batch.update(doc.ref, {
            status: "cancelled",
            availableForBooking: true,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }

        await batch.commit();
        cancelled += chunk.length;
      }

      console.log(`Cancelled ${cancelled} future sessions for academy ${academyId}`);
      return { cancelled };
    }

    // Handle renewal: expired -> active (uses shared helper)
    if (beforeStatus === "expired" && afterStatus === "active") {
      console.log(`Academy ${academyId}: renewal detected, generating new sessions`);
      return generateSessionsForAcademy(academyId, afterData);
    }

    return null;
  });

/**
 * Callable function: Manually trigger session generation for an academy.
 * Used by the manager UI when sessions were not auto-generated.
 */
exports.manualGenerateSessions = onCall(
  { timeoutSeconds: 300, memory: "512MB" },
  async (request) => {
    const { auth, data } = request;
    if (!auth) {
      throw new Error("Must be logged in to generate sessions.");
    }

    const { academyId } = data;
    if (!academyId) {
      throw new Error("academyId is required.");
    }

    const academyDoc = await db.collection("academies").doc(academyId).get();
    if (!academyDoc.exists) {
      throw new Error("Academy not found.");
    }

    const academyData = academyDoc.data();

    if (academyData.sessionsGenerated === true) {
      return { success: true, sessionCount: academyData.sessionCount || 0, alreadyGenerated: true };
    }

    const result = await generateSessionsForAcademy(academyId, academyData);
    return result;
  });

/**
 * Cloud Function: When a new booking is created, cancel any academy session
 * that clashes with it (same ground, same date, overlapping time).
 *
 * This handles the reverse direction of clash detection: a customer booking a
 * slot that an academy session already occupies. The session is auto-cancelled
 * so the booking is honoured and the slot is not double-held.
 *
 * Trigger: Firestore onCreate on bookings/{bookingId}
 */
exports.cancelClashingSessionsOnBooking = onDocumentCreated(
  {
    document: "bookings/{bookingId}",
    timeoutSeconds: 120,
  },
  async (event) => {
    const booking = event.data.data();
    const bookingId = event.params.bookingId;

    // Only consider live bookings that hold a slot
    const liveStatuses = [
      "confirmed", "pending", "pending_payment",
      "awaiting_payment", "payment_submitted",
    ];
    if (!liveStatuses.includes(booking.status)) return null;
    if (!booking.turfId || !booking.groundId || !booking.date) return null;
    if (!booking.startTime || !booking.endTime) return null;

    // Find scheduled academy sessions on the same ground + date
    const snapshot = await db
      .collection("academy_sessions")
      .where("turfId", "==", booking.turfId)
      .where("groundId", "==", booking.groundId)
      .where("date", "==", booking.date)
      .where("status", "==", "scheduled")
      .get();

    if (snapshot.empty) return null;

    const clashing = snapshot.docs.filter((doc) => {
      const s = doc.data();
      return timesOverlap(s.startTime, s.endTime, booking.startTime, booking.endTime);
    });

    if (clashing.length === 0) return null;

    const batch = db.batch();
    for (const doc of clashing) {
      batch.update(doc.ref, {
        status: "cancelled",
        availableForBooking: true,
        cancelReason: "booking_clash",
        clashingBookingId: bookingId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();

    console.log(`Booking ${bookingId}: auto-cancelled ${clashing.length} clashing academy session(s)`);
    return { cancelled: clashing.length };
  }
);
