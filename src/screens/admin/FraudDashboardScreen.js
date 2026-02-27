import React from "react";
import AdminScaffold from "./AdminScaffold";

export default function FraudDashboardScreen({ navigation }) {
  return (
    <AdminScaffold
      title="Fraud Detection"
      section="Payments"
      priority="P1"
      icon="shield-alert"
      navigation={navigation}
      features={[
        "Auto-flagged users: 3+ consecutive payment rejections",
        "Duplicate transaction IDs across bookings",
        "High cancellation rate (>50%) users",
        "Rapid booking-cancel pattern users (>5 in 24 hours)",
        "Actions: review user's payment history",
        "Actions: temporarily ban (1/7/30 days)",
        "Actions: permanently ban",
        "Actions: clear flag (false positive)",
        "Actions: add internal watchlist note",
      ]}
    />
  );
}
