const admin = require("firebase-admin");
const { onSchedule } = require("firebase-functions/v2/scheduler");

const db = admin.firestore();

/**
 * Auto-reject all pending bookings whose date has passed.
 * Runs daily at 1:00 AM IST.
 *
 * Covers both regular pending bookings and chat-negotiation
 * bookings (both stored with status = "pending").
 */
exports.autoRejectExpiredPendingBookings = onSchedule(
  {
    schedule: "0 1 * * *",
    timeZone: "Asia/Kolkata",
  },
  async () => {
    // Build today's date string in YYYY-MM-DD (IST) — dates stored as this format in Firestore
    const nowIST = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
    );
    const todayStr = `${nowIST.getFullYear()}-${String(nowIST.getMonth() + 1).padStart(2, "0")}-${String(nowIST.getDate()).padStart(2, "0")}`;

    console.log(`[autoRejectExpiredPendingBookings] Running for date < ${todayStr}`);

    try {
      const snapshot = await db
        .collection("bookings")
        .where("status", "==", "pending")
        .where("date", "<", todayStr)
        .get();

      console.log(`[autoRejectExpiredPendingBookings] Found ${snapshot.size} expired pending bookings`);

      if (snapshot.empty) return null;

      // Process in chunks of 400 (Firestore batch limit is 500; keep headroom)
      const docs = snapshot.docs;
      const CHUNK = 400;

      for (let i = 0; i < docs.length; i += CHUNK) {
        const chunk = docs.slice(i, i + CHUNK);
        const batch = db.batch();

        for (const doc of chunk) {
          const booking = doc.data();

          batch.update(doc.ref, {
            status: "rejected",
            rejectedAt: admin.firestore.FieldValue.serverTimestamp(),
            rejectionReason: "expired",
            rejectionNote: "Auto-rejected: booking date has passed",
            statusHistory: admin.firestore.FieldValue.arrayUnion({
              status: "rejected",
              timestamp: new Date().toISOString(),
              changedBy: "system",
              changedByRole: "system",
              reason: "Auto-rejected: booking date has passed",
            }),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          // Fire-and-forget notification to the user (non-blocking)
          if (booking.userId) {
            const { sendNotification } = require("./helpers/notificationHelpers");
            sendNotification(booking.userId, {
              type: "booking_rejected",
              title: "Booking Declined",
              body: `Your booking at ${booking.turfName || "the turf"} on ${booking.date} could not be processed and has been declined.`,
              data: { bookingId: doc.id, screen: "Bookings" },
            }).catch(() => {}); // Ignore notification failures
          }
        }

        await batch.commit();
        console.log(`[autoRejectExpiredPendingBookings] Committed chunk ${i / CHUNK + 1} (${chunk.length} bookings)`);
      }

      console.log(`[autoRejectExpiredPendingBookings] Done. Rejected ${docs.length} bookings.`);
      return null;
    } catch (error) {
      console.error("[autoRejectExpiredPendingBookings] Error:", error);
      return null;
    }
  });
