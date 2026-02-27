import React from "react";
import AdminScaffold from "./AdminScaffold";

export default function UserDetailScreen({ navigation }) {
  return (
    <AdminScaffold
      title="User Detail"
      section="Users"
      priority="P0"
      icon="account-details"
      navigation={navigation}
      features={[
        "Tab 1: Profile — name, phone, email, role, company, device info",
        "Tab 2: Booking History — all bookings, stats, cancellation rate",
        "Tab 3: Payment History — submissions, verifications, rejections, bans",
        "Tab 4: Chat History — all chats, flagged messages, negotiations",
        "Tab 5: Reviews — all reviews posted, flagged reviews",
        "Tab 6: Activity Log — login history, booking actions, admin actions",
        "Actions: ban (1/7/30 days), permanent ban, unban",
        "Actions: force logout, delete account, merge duplicates, export data",
        "Actions: reset payment rejection count, send notification",
      ]}
    />
  );
}
