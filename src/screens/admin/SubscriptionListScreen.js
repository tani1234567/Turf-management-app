import React from "react";
import AdminScaffold from "./AdminScaffold";

export default function SubscriptionListScreen({ navigation }) {
  return (
    <AdminScaffold
      title="Subscription Management"
      section="Subscriptions"
      priority="P0"
      icon="card-account-details"
      navigation={navigation}
      features={[
        "Dashboard: active/trial/grace/expired counts with revenue",
        "Filter by status, ground count range, monthly fee range",
        "Filter by payment method, city, expiring within N days",
        "Columns: company, owner, grounds, fee, status, expiry, last payment",
        "Tap to open SubscriptionDetailScreen",
        "MRR, churn rate, ARPU summary cards",
      ]}
    />
  );
}
