import React from "react";
import AdminScaffold from "./AdminScaffold";

export default function SupportTicketDetailScreen({ navigation }) {
  return (
    <AdminScaffold
      title="Ticket Detail"
      section="Support"
      priority="P1"
      icon="ticket-account"
      navigation={navigation}
      features={[
        "Ticket info: number, category, subject, description, attachments",
        "Requester info: name, phone, role, related entities",
        "Message thread (admin + user messages with timestamps)",
        "Internal notes (visible only to admins)",
        "SLA timer: first response due, resolution due, breach status",
        "Actions: assign to admin, change priority, change status",
        "Actions: reply to user, add internal note",
        "Actions: link to related booking/company/user",
        "Resolution form: decision, note, close ticket",
      ]}
    />
  );
}
