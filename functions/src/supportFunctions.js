const admin = require("firebase-admin");
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { sendNotification } = require("./helpers/notificationHelpers");

const db = admin.firestore();

// ─── onTicketCreated ─────────────────────────────────────────────────────────
// Generates TKT-XXXX ticket number and sends confirmation push to user.

exports.onTicketCreated = onDocumentCreated(
  "support_tickets/{ticketId}",
  async (event) => {
    const ticketId = event.params.ticketId;
    const data = event.data.data();

    // Generate ticket number using total count (simple, good enough for one-admin setup)
    const countSnap = await db.collection("support_tickets").count().get();
    const total = countSnap.data().count;
    const ticketNumber = "TKT-" + String(total).padStart(4, "0");

    await event.data.ref.update({ ticketNumber });

    console.log(`[Support] Ticket ${ticketId} assigned ${ticketNumber}`);

    if (!data.userId) return null;

    await sendNotification(data.userId, {
      type: "ticket_created",
      title: "Support Request Received",
      body: `We got your message (${ticketNumber}). We'll get back to you soon.`,
      data: { ticketId, ticketNumber },
    });

    return null;
  }
);

// ─── onTicketMessageCreated ───────────────────────────────────────────────────
// Fires when any message is added to the thread.
// If the sender is admin → push notification to the user.
// Always bumps the parent ticket's updatedAt.

exports.onTicketMessageCreated = onDocumentCreated(
  "support_tickets/{ticketId}/messages/{messageId}",
  async (event) => {
    const { ticketId } = event.params;
    const message = event.data.data();

    const ticketRef = db.collection("support_tickets").doc(ticketId);

    // Always bump updatedAt on the parent ticket
    await ticketRef.update({
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Only push to user when admin replies
    if (message.senderType !== "admin") return null;

    const ticketSnap = await ticketRef.get();
    if (!ticketSnap.exists) return null;

    const ticket = ticketSnap.data();
    if (!ticket.userId) return null;

    const ticketNumber = ticket.ticketNumber || ticketId.slice(0, 8);
    const truncated =
      message.text && message.text.length > 80
        ? message.text.slice(0, 80) + "…"
        : message.text || "New message";

    await sendNotification(ticket.userId, {
      type: "ticket_reply",
      title: `Reply on ${ticketNumber}`,
      body: truncated,
      data: { ticketId, ticketNumber },
    });

    console.log(`[Support] Admin replied on ${ticketNumber}, pushed to ${ticket.userId}`);
    return null;
  }
);

// ─── onTicketStatusChanged ────────────────────────────────────────────────────
// Sends push when admin moves the ticket to resolved, closed, or waiting_user.

exports.onTicketStatusChanged = onDocumentUpdated(
  "support_tickets/{ticketId}",
  async (event) => {
    const { ticketId } = event.params;
    const before = event.data.before.data();
    const after = event.data.after.data();

    if (before.status === after.status) return null;

    const { userId, ticketNumber: tn } = after;
    if (!userId) return null;

    const label = tn || ticketId.slice(0, 8);

    let title, body;
    switch (after.status) {
      case "resolved":
        title = "Issue Resolved";
        body = `Your support request ${label} has been resolved. Let us know if you need anything else.`;
        break;
      case "closed":
        title = "Ticket Closed";
        body = `Your ticket ${label} has been closed.`;
        break;
      case "waiting_user":
        title = "Response Needed";
        body = `We need more info from you on ${label}. Please reply to your ticket.`;
        break;
      default:
        return null;
    }

    await sendNotification(userId, {
      type: "ticket_status_changed",
      title,
      body,
      data: { ticketId, ticketNumber: tn || "" },
    });

    console.log(`[Support] Ticket ${label}: ${before.status} → ${after.status}, pushed to ${userId}`);
    return null;
  }
);

// ─── onDisputeResolved ────────────────────────────────────────────────────────
// Fires when a dispute status changes to resolved_*.
// Creates a refunds doc automatically if resolvedAmount > 0 and decision = user_favor.

exports.onDisputeResolved = onDocumentUpdated(
  "disputes/{disputeId}",
  async (event) => {
    const { disputeId } = event.params;
    const before = event.data.before.data();
    const after = event.data.after.data();

    if (before.status === after.status) return null;

    const resolvedStatuses = ["resolved_user_favor", "resolved_company_favor"];
    if (!resolvedStatuses.includes(after.status)) return null;

    const { userId, resolvedAmount, resolution, bookingId, userName, companyId, turfId, turfName } = after;
    if (!userId) return null;

    const isUserFavor = after.status === "resolved_user_favor";

    // Auto-create refund record when resolved in user's favor with an amount
    if (isUserFavor && resolvedAmount > 0) {
      const now = admin.firestore.FieldValue.serverTimestamp();
      await db.collection("refunds").add({
        bookingId: bookingId || null,
        disputeId,
        userId,
        userName: userName || "",
        companyId: companyId || null,
        turfId: turfId || null,
        turfName: turfName || "",
        amount: resolvedAmount,
        reason: `Dispute resolution: ${resolution || ""}`,
        status: "pending",
        initiatedBy: after.resolvedBy || "system",
        initiatedByEmail: after.resolvedByEmail || null,
        initiatedAt: now,
        completedBy: null,
        completedAt: null,
        completionNote: null,
        failureReason: null,
        paymentRef: null,
      });
      console.log(`[Support] Refund doc created for dispute ${disputeId}, amount ₹${resolvedAmount}`);
    }

    // Push notification to user
    let title, body;
    if (isUserFavor) {
      title = "Dispute Resolved in Your Favor";
      body =
        resolvedAmount > 0
          ? `Your dispute has been resolved. ₹${resolvedAmount} refund will be processed shortly.`
          : `Your dispute has been resolved in your favor.`;
    } else {
      title = "Dispute Reviewed";
      body = resolution
        ? `Your dispute has been reviewed: ${resolution.slice(0, 80)}`
        : "Your dispute has been reviewed. No refund will be issued.";
    }

    await sendNotification(userId, {
      type: "dispute_resolved",
      title,
      body,
      data: { disputeId, bookingId: bookingId || "" },
    });

    console.log(`[Support] Dispute ${disputeId} resolved (${after.status}), pushed to ${userId}`);
    return null;
  }
);

// ─── onRefundStatusChanged ────────────────────────────────────────────────────
// Fires when finance marks a refund completed or failed.

exports.onRefundStatusChanged = onDocumentUpdated(
  "refunds/{refundId}",
  async (event) => {
    const { refundId } = event.params;
    const before = event.data.before.data();
    const after = event.data.after.data();

    if (before.status === after.status) return null;
    if (!["completed", "failed"].includes(after.status)) return null;

    const { userId, amount, paymentRef } = after;
    if (!userId) return null;

    let title, body, type;
    if (after.status === "completed") {
      type = "refund_completed";
      title = "Refund Processed";
      body = paymentRef
        ? `Your refund of ₹${amount} has been processed. Ref: ${paymentRef}`
        : `Your refund of ₹${amount} has been processed successfully.`;
    } else {
      type = "refund_failed";
      title = "Refund Failed";
      body = "We were unable to process your refund. Please contact support.";
    }

    await sendNotification(userId, {
      type,
      title,
      body,
      data: { refundId, amount: String(amount || 0) },
    });

    console.log(`[Support] Refund ${refundId} ${after.status}, pushed to ${userId}`);
    return null;
  }
);
