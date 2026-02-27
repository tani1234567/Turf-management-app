import React from "react";
import AdminScaffold from "./AdminScaffold";

export default function RefundTrackerScreen({ navigation }) {
  return (
    <AdminScaffold
      title="Refund Tracker"
      section="Payments"
      priority="P0"
      icon="cash-refund"
      navigation={navigation}
      features={[
        "All pending/completed/overdue refunds",
        "Columns: booking ID, user, refund amount, reason",
        "Columns: owner, owner UPI, status, days pending",
        "Actions: mark refund as completed",
        "Actions: send refund reminder to owner",
        "Actions: escalate (if overdue > 7 days)",
        "Actions: waive refund (with reason)",
        "Filter by status (Pending/Completed/Overdue)",
      ]}
    />
  );
}
