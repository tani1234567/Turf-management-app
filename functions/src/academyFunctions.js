const functions = require("firebase-functions");
const admin = require("firebase-admin");
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
 * Shared helper: Generate sessions for an academy.
 * Handles both old format (schedule.days as array) and new format (object map with per-day times).
 * Creates academy_sessions docs in batches and marks the academy as sessionsGenerated: true.
 *
 * @param {string} academyId
 * @param {object} academyData - Full academy document data
 * @returns {{ success: boolean, sessionCount: number }}
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
    return { success: false, sessionCount: 0 };
  }

  const isNewFormat = schedule.days && !Array.isArray(schedule.days);
  const scheduledDays = isNewFormat ? Object.keys(schedule.days) : schedule.days;
  const globalStartTime = isNewFormat ? null : schedule.startTime;
  const globalEndTime = isNewFormat ? null : schedule.endTime;
  const { startDate, endDate } = contract;

  if (!scheduledDays || scheduledDays.length === 0 || !startDate || !endDate) {
    console.log(`Academy ${academyId}: Incomplete schedule/contract data, skipping`);
    return { success: false, sessionCount: 0 };
  }

  const sessionDates = generateSessionDates(startDate, endDate, scheduledDays);
  console.log(`Generating ${sessionDates.length} sessions for academy ${academyId} (format: ${isNewFormat ? "per-day" : "global"})`);

  const academyRef = db.collection("academies").doc(academyId);

  if (sessionDates.length === 0) {
    await academyRef.update({
      sessionCount: 0,
      sessionsGenerated: true,
      generatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true, sessionCount: 0 };
  }

  const BATCH_SIZE = 450;
  let totalCreated = 0;

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
        status: "scheduled",
        type: "academy",
        availableForBooking: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();
    totalCreated += chunk.length;
    console.log(`Batch committed: ${totalCreated}/${sessionDates.length}`);
  }

  await academyRef.update({
    sessionCount: totalCreated,
    sessionsGenerated: true,
    generatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`Academy ${academyId}: ${totalCreated} sessions generated`);
  return { success: true, sessionCount: totalCreated };
}

/**
 * Cloud Function: Auto-generate academy sessions when an academy doc is created.
 *
 * Trigger: Firestore onCreate on academies/{academyId}
 */
exports.generateAcademySessions = functions
  .runWith({ timeoutSeconds: 300, memory: "512MB" })
  .firestore.document("academies/{academyId}")
  .onCreate(async (snap, context) => {
    const academyId = context.params.academyId;
    const academy = snap.data();
    console.log(`Academy ${academyId} created: "${academy.name}"`);
    return generateSessionsForAcademy(academyId, academy);
  });

/**
 * Cloud Function: Mark past academy sessions as completed.
 *
 * Runs daily at 1:00 AM IST.
 * Finds all academy_sessions with status "scheduled" where the date is before today,
 * and updates them to "completed".
 */
exports.markPastSessionsCompleted = functions.pubsub
  .schedule("0 1 * * *")
  .timeZone("Asia/Kolkata")
  .onRun(async () => {
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
exports.sendAcademyRenewalReminders = functions.pubsub
  .schedule("0 9 * * *")
  .timeZone("Asia/Kolkata")
  .onRun(async () => {
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
exports.expireAcademies = functions.pubsub
  .schedule("0 2 * * *")
  .timeZone("Asia/Kolkata")
  .onRun(async () => {
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
exports.onAcademyStatusChange = functions
  .runWith({ timeoutSeconds: 300, memory: "512MB" })
  .firestore.document("academies/{academyId}")
  .onUpdate(async (change, context) => {
    const academyId = context.params.academyId;
    const beforeData = change.before.data();
    const afterData = change.after.data();

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
exports.manualGenerateSessions = functions
  .runWith({ timeoutSeconds: 300, memory: "512MB" })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be logged in to generate sessions."
      );
    }

    const { academyId } = data;
    if (!academyId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "academyId is required."
      );
    }

    const academyDoc = await db.collection("academies").doc(academyId).get();
    if (!academyDoc.exists) {
      throw new functions.https.HttpsError(
        "not-found",
        "Academy not found."
      );
    }

    const academyData = academyDoc.data();

    if (academyData.sessionsGenerated === true) {
      return { success: true, sessionCount: academyData.sessionCount || 0, alreadyGenerated: true };
    }

    const result = await generateSessionsForAcademy(academyId, academyData);
    return result;
  });
