const admin = require("firebase-admin");
const { onSchedule } = require("firebase-functions/v2/scheduler");

const db = admin.firestore();

const TRANSACTION_RETENTION_DAYS = 90;

/**
 * Cloud Function: cleanupOldTransactions
 *
 * Runs daily at 4:00 AM IST.
 * Removes entries from each company's verifiedTransactions array
 * that are older than 90 days.
 */
exports.cleanupOldTransactions = onSchedule(
  {
    schedule: "0 4 * * *",
    timeZone: "Asia/Kolkata",
  },
  async () => {
    console.log("Starting old transaction cleanup...");

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - TRANSACTION_RETENTION_DAYS);
    const cutoffStr = cutoffDate.toISOString().split("T")[0];

    let companiesProcessed = 0;
    let transactionsRemoved = 0;

    try {
      const companiesSnapshot = await db.collection("companies").get();

      for (const companyDoc of companiesSnapshot.docs) {
        const companyData = companyDoc.data();
        const transactions = companyData.verifiedTransactions || [];

        if (transactions.length === 0) continue;

        const oldTransactions = transactions.filter(
          (t) => t.date && t.date < cutoffStr
        );

        if (oldTransactions.length === 0) continue;

        // Remove old entries using arrayRemove
        for (const txn of oldTransactions) {
          await companyDoc.ref.update({
            verifiedTransactions:
              admin.firestore.FieldValue.arrayRemove(txn),
          });
        }

        companiesProcessed++;
        transactionsRemoved += oldTransactions.length;

        console.log(
          `Company ${companyDoc.id}: removed ${oldTransactions.length} old transactions`
        );
      }

      console.log(
        `Transaction cleanup complete: ${transactionsRemoved} removed from ${companiesProcessed} companies`
      );
      return { companiesProcessed, transactionsRemoved };
    } catch (error) {
      console.error("Error in cleanupOldTransactions:", error);
      throw error;
    }
  });
