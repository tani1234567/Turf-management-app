import React from "react";
import AdminScaffold from "./AdminScaffold";

export default function SupportTicketListScreen({ navigation }) {
  return (
    <AdminScaffold
      title="Support Tickets"
      section="Support"
      priority="P1"
      icon="lifebuoy"
      navigation={navigation}
      features={[
        "All support tickets with priority/status filters",
        "Filter by category, assignee, SLA status (on-track/breached)",
        "Sort by priority, created date, SLA deadline",
        "Summary cards: open count by priority, avg response time",
        "SLA breach indicators (color-coded)",
        "Customer satisfaction score from resolved tickets",
        "Tap to open SupportTicketDetailScreen",
      ]}
    />
  );
}
