import React from "react";
import AdminScaffold from "./AdminScaffold";

export default function AdminDashboardScreen({ navigation }) {
  return (
    <AdminScaffold
      title="Platform Dashboard"
      section="Dashboard"
      priority="P0"
      icon="view-dashboard"
      showBack={false}
      navigation={navigation}
      features={[
        "Real-time overview cards (companies, turfs, users, bookings, revenue)",
        "Pending payment verifications count",
        "Active chats with unread messages",
        "Unresolved support tickets count",
        "Quick action buttons (verifications, expiring subs, flagged reviews)",
        "Activity feed — last 24 hours of platform events",
      ]}
    />
  );
}
