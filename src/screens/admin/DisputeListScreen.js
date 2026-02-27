import React from "react";
import AdminScaffold from "./AdminScaffold";

export default function DisputeListScreen({ navigation }) {
  return (
    <AdminScaffold
      title="Booking Disputes"
      section="Disputes"
      priority="P1"
      icon="scale-balance"
      navigation={navigation}
      features={[
        "All booking disputes with status filters (open/investigating/resolved)",
        "Filter by dispute type (payment, double charge, wrong slot, no-show, refund)",
        "Filter by date range, company, assigned admin",
        "Columns: booking ID, user, type, status, raised at, assigned to",
        "Summary cards: open count, avg resolution time, escalated count",
        "Tap to open DisputeDetailScreen",
      ]}
    />
  );
}
