const admin = require("firebase-admin");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { notifyCompanyOwners } = require("./helpers/notificationHelpers");

const db = admin.firestore();

// Grace period duration in days
const GRACE_PERIOD_DAYS = 7;

/**
 * Cloud Function: Check for expired active subscriptions and move them to grace_period.
 *
 * Runs daily at 2:30 AM IST.
 * Finds companies with active subscriptions whose subscriptionEndDate has passed,
 * transitions them to grace_period, and notifies company owners.
 */
exports.checkSubscriptionExpiry = onSchedule(
  {
    schedule: "30 2 * * *",
    timeZone: "Asia/Kolkata",
  },
  async () => {
    console.log("Checking for expired subscriptions...");

    const now = admin.firestore.Timestamp.now();

    try {
      // Find active subscriptions that have expired
      const snapshot = await db
        .collection("companies")
        .where("subscription.status", "==", "active")
        .where("subscription.subscriptionEndDate", "<", now)
        .get();

      if (snapshot.empty) {
        console.log("No expired subscriptions found");
        return { processed: 0 };
      }

      console.log(`Found ${snapshot.size} expired subscriptions`);

      // Calculate grace period end date
      const gracePeriodEnd = new Date();
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() + GRACE_PERIOD_DAYS);

      let processed = 0;

      for (const doc of snapshot.docs) {
        const company = doc.data();

        await doc.ref.update({
          "subscription.status": "grace_period",
          "subscription.gracePeriodEndDate": admin.firestore.Timestamp.fromDate(gracePeriodEnd),
          "subscription.updatedAt": admin.firestore.FieldValue.serverTimestamp(),
        });

        await notifyCompanyOwners(doc.id, {
          type: "subscription_expired",
          title: "Subscription Expired - Grace Period Started",
          body: `Your subscription has expired. You have ${GRACE_PERIOD_DAYS} days to renew before your turfs are deactivated.`,
          data: { companyId: doc.id },
        });

        processed++;
        console.log(`Company ${doc.id}: active -> grace_period (ends ${gracePeriodEnd.toISOString()})`);
      }

      console.log(`Moved ${processed} companies to grace period`);
      return { processed };
    } catch (error) {
      console.error("Error checking subscription expiry:", error);
      throw error;
    }
  });

/**
 * Cloud Function: Deactivate turfs for companies whose grace period has ended.
 *
 * Runs daily at 3:30 AM IST.
 * Finds companies in grace_period whose gracePeriodEndDate has passed,
 * deactivates all subscribed turfs, and sets subscription status to "expired".
 */
exports.enforceGracePeriod = onSchedule(
  {
    schedule: "30 3 * * *",
    timeZone: "Asia/Kolkata",
  },
  async () => {
    console.log("Enforcing grace period deadlines...");

    const now = admin.firestore.Timestamp.now();

    try {
      // Find companies past grace period
      const snapshot = await db
        .collection("companies")
        .where("subscription.status", "==", "grace_period")
        .where("subscription.gracePeriodEndDate", "<", now)
        .get();

      if (snapshot.empty) {
        console.log("No companies past grace period");
        return { deactivated: 0 };
      }

      console.log(`Found ${snapshot.size} companies past grace period`);

      let deactivated = 0;

      for (const doc of snapshot.docs) {
        const company = doc.data();
        const turfIds = company.subscription?.subscribedTurfIds || [];

        // Deactivate all subscribed turfs
        const BATCH_SIZE = 450;
        for (let i = 0; i < turfIds.length; i += BATCH_SIZE) {
          const chunk = turfIds.slice(i, i + BATCH_SIZE);
          const batch = db.batch();

          for (const turfId of chunk) {
            batch.update(db.collection("turfs").doc(turfId), {
              isActive: false,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }

          await batch.commit();
        }

        // Update subscription status to expired
        await doc.ref.update({
          "subscription.status": "expired",
          "subscription.updatedAt": admin.firestore.FieldValue.serverTimestamp(),
        });

        await notifyCompanyOwners(doc.id, {
          type: "subscription_deactivated",
          title: "Turfs Deactivated",
          body: `Your grace period has ended and ${turfIds.length} turf${turfIds.length !== 1 ? "s have" : " has"} been deactivated. Renew your subscription to reactivate.`,
          data: { companyId: doc.id },
        });

        deactivated++;
        console.log(`Company ${doc.id}: grace_period -> expired, ${turfIds.length} turfs deactivated`);
      }

      console.log(`Deactivated turfs for ${deactivated} companies`);
      return { deactivated };
    } catch (error) {
      console.error("Error enforcing grace period:", error);
      throw error;
    }
  });

/**
 * Cloud Function: Send subscription expiry warning notifications.
 *
 * Runs daily at 9:00 AM IST.
 * Sends warnings to company owners at 7, 3, and 1 day(s) before subscription expiry.
 */
exports.sendSubscriptionExpiryWarnings = onSchedule(
  {
    schedule: "0 9 * * *",
    timeZone: "Asia/Kolkata",
  },
  async () => {
    console.log("Checking for subscription expiry warnings...");

    const now = admin.firestore.Timestamp.now();

    // Look 8 days ahead to capture all 7/3/1 day warnings
    const eightDaysFromNow = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);
    const cutoff = admin.firestore.Timestamp.fromDate(eightDaysFromNow);

    try {
      // Query active subscriptions expiring within the next 8 days
      const snapshot = await db
        .collection("companies")
        .where("subscription.status", "==", "active")
        .where("subscription.subscriptionEndDate", ">", now)
        .where("subscription.subscriptionEndDate", "<=", cutoff)
        .get();

      if (snapshot.empty) {
        console.log("No subscriptions expiring within 8 days");
        return { warned: 0 };
      }

      console.log(`Found ${snapshot.size} subscriptions expiring soon`);

      const warningDays = [7, 3, 1];
      let warned = 0;

      // Normalize today to start-of-day for accurate day counting
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      for (const doc of snapshot.docs) {
        const company = doc.data();
        const endDate = company.subscription?.subscriptionEndDate?.toDate();
        if (!endDate) continue;

        // Normalize end date to start-of-day
        const endDateStart = new Date(endDate);
        endDateStart.setHours(0, 0, 0, 0);

        const daysRemaining = Math.round(
          (endDateStart.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (!warningDays.includes(daysRemaining)) continue;

        let title, body;
        if (daysRemaining === 1) {
          title = "Subscription Expires Tomorrow!";
          body = "Your subscription expires tomorrow. Renew now to avoid service disruption.";
        } else {
          title = `Subscription Expires in ${daysRemaining} Days`;
          body = `Your subscription expires in ${daysRemaining} days. Renew to keep your turfs active.`;
        }

        await notifyCompanyOwners(doc.id, {
          type: "subscription_expiry_warning",
          title,
          body,
          data: { companyId: doc.id, daysRemaining: String(daysRemaining) },
        });

        warned++;
        console.log(`Sent ${daysRemaining}-day expiry warning for company ${doc.id}`);
      }

      console.log(`Sent ${warned} expiry warnings`);
      return { warned };
    } catch (error) {
      console.error("Error sending expiry warnings:", error);
      throw error;
    }
  });

/**
 * Cloud Function: Handle subscription payment completion.
 *
 * Trigger: Firestore onUpdate on pending_subscription_payments/{paymentId}
 *
 * When a payment status changes to "completed":
 * - Ensures all subscribed turfs are reactivated (safety net)
 * - Sends confirmation notification to company owners
 */
exports.onSubscriptionPaymentCompleted = onDocumentUpdated("pending_subscription_payments/{paymentId}", async (event) => {
    const paymentId = event.params.paymentId;
    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();

    // Only handle transition to "completed"
    if (beforeData.status === afterData.status) return null;
    if (afterData.status !== "completed") return null;

    console.log(`Subscription payment ${paymentId} completed for company ${afterData.companyId}`);

    const companyId = afterData.companyId;
    if (!companyId) return null;

    try {
      const companyDoc = await db.collection("companies").doc(companyId).get();
      if (!companyDoc.exists) {
        console.log(`Company ${companyId} not found`);
        return null;
      }

      const company = companyDoc.data();
      const turfIds = afterData.selectedTurfIds || [];
      const months = afterData.months || 1;

      // Safety net: ensure turfs are reactivated
      // (verifySubscriptionPayment on client already does this,
      // but this covers partial failures or race conditions)
      const subscriptionEndDate = company.subscription?.subscriptionEndDate;
      if (subscriptionEndDate && turfIds.length > 0) {
        const BATCH_SIZE = 450;
        for (let i = 0; i < turfIds.length; i += BATCH_SIZE) {
          const chunk = turfIds.slice(i, i + BATCH_SIZE);
          const batch = db.batch();

          for (const turfId of chunk) {
            batch.update(db.collection("turfs").doc(turfId), {
              isActive: true,
              subscriptionEndDate: subscriptionEndDate,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }

          await batch.commit();
        }

        console.log(`Safety net: ensured ${turfIds.length} turfs are active`);
      }

      // Send confirmation notification to owners
      await notifyCompanyOwners(companyId, {
        type: "subscription_reactivated",
        title: "Subscription Activated!",
        body: `Your subscription for ${turfIds.length} turf${turfIds.length !== 1 ? "s" : ""} has been activated for ${months} month${months !== 1 ? "s" : ""}.`,
        data: { companyId },
      });

      console.log(`Reactivation notification sent for company ${companyId}`);
      return { companyId, months, turfCount: turfIds.length };
    } catch (error) {
      console.error("Error handling subscription payment completion:", error);
      throw error;
    }
  });
