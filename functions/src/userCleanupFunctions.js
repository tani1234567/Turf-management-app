const admin = require("firebase-admin");
const { onSchedule } = require("firebase-functions/v2/scheduler");

const db = admin.firestore();

/**
 * Cloud Function: processSuspendedUserDeletion
 *
 * Runs daily at 2:00 AM IST.
 * Finds suspended users whose 30-day grace period has passed (canBeDeletedAfter <= now),
 * cleans up all references in companies and turfs, then deletes the user document.
 *
 * Cleanup steps per user:
 * 1. Remove userId from company.managers[] or company.caretakers[] array
 * 2. Remove userId from turf.managerIds[] or turf.caretakerIds[] array
 * 3. Delete the user document from users collection
 * 4. Log the deletion to admin_logs collection
 */
exports.processSuspendedUserDeletion = onSchedule(
  {
    schedule: "0 2 * * *",
    timeZone: "Asia/Kolkata",
  },
  async () => {
    console.log("Starting suspended user cleanup...");

    const now = admin.firestore.Timestamp.now();

    try {
      // Find suspended users past the 30-day deletion mark
      const snapshot = await db
        .collection("users")
        .where("isSuspended", "==", true)
        .where("canBeDeletedAfter", "<=", now)
        .get();

      if (snapshot.empty) {
        console.log("No suspended users eligible for deletion");
        return { deleted: 0 };
      }

      console.log(`Found ${snapshot.size} suspended user(s) eligible for deletion`);

      let deleted = 0;
      let errors = 0;

      for (const userDoc of snapshot.docs) {
        const userData = userDoc.data();
        const userId = userDoc.id;
        const userRole = userData.role;
        const companyId = userData.companyId;

        console.log(
          `Processing user ${userId} (role: ${userRole}, company: ${companyId || "none"})`
        );

        try {
          const batch = db.batch();

          // Step 1: Remove from company arrays
          if (companyId) {
            const companyRef = db.collection("companies").doc(companyId);
            const companyDoc = await companyRef.get();

            if (companyDoc.exists) {
              const companyData = companyDoc.data();

              if (userRole === "manager") {
                const managers = companyData.managers || [];
                if (managers.includes(userId)) {
                  batch.update(companyRef, {
                    managers: admin.firestore.FieldValue.arrayRemove(userId),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                  });
                  console.log(`  Removed from company ${companyId} managers array`);
                }
              } else if (userRole === "caretaker") {
                const caretakers = companyData.caretakers || [];
                if (caretakers.includes(userId)) {
                  batch.update(companyRef, {
                    caretakers: admin.firestore.FieldValue.arrayRemove(userId),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                  });
                  console.log(`  Removed from company ${companyId} caretakers array`);
                }
              }
            }
          }

          // Step 2: Remove from turf arrays (managerIds / caretakerIds)
          if (companyId) {
            const turfsSnapshot = await db
              .collection("turfs")
              .where("companyId", "==", companyId)
              .get();

            for (const turfDoc of turfsSnapshot.docs) {
              const turfData = turfDoc.data();

              if (userRole === "manager") {
                const managerIds = turfData.managerIds || [];
                if (managerIds.includes(userId)) {
                  batch.update(turfDoc.ref, {
                    managerIds: admin.firestore.FieldValue.arrayRemove(userId),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                  });
                  console.log(`  Removed from turf ${turfDoc.id} managerIds`);
                }
              } else if (userRole === "caretaker") {
                const caretakerIds = turfData.caretakerIds || [];
                if (caretakerIds.includes(userId)) {
                  batch.update(turfDoc.ref, {
                    caretakerIds: admin.firestore.FieldValue.arrayRemove(userId),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                  });
                  console.log(`  Removed from turf ${turfDoc.id} caretakerIds`);
                }
              }
            }
          }

          // Step 3: Delete the user document
          batch.delete(userDoc.ref);

          // Step 4: Log the deletion
          const logRef = db.collection("admin_logs").doc();
          batch.set(logRef, {
            adminId: "system",
            adminName: "Automated Cleanup",
            action: "suspended_user_deleted",
            category: "user",
            targetType: "user",
            targetId: userId,
            targetDescription: `${userData.name || "Unknown"} (${userRole || "unknown role"})`,
            changes: {
              field: "user_document",
              oldValue: "suspended",
              newValue: "deleted",
              reason: "30-day suspension period expired",
            },
            relatedCompanyId: companyId || null,
            suspendedAt: userData.suspendedAt || null,
            suspendedBy: userData.suspendedBy || null,
            suspensionReason: userData.suspensionReason || null,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
          });

          await batch.commit();

          deleted++;
          console.log(`  User ${userId} deleted successfully`);
        } catch (userError) {
          errors++;
          console.error(`  Error processing user ${userId}:`, userError);
          // Continue with next user — don't let one failure stop the batch
        }
      }

      console.log(
        `Suspended user cleanup complete: ${deleted} deleted, ${errors} errors`
      );
      return { deleted, errors };
    } catch (error) {
      console.error("Error in processSuspendedUserDeletion:", error);
      throw error;
    }
  });
