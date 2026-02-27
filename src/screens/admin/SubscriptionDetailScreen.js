import React from "react";
import AdminScaffold from "./AdminScaffold";

export default function SubscriptionDetailScreen({ navigation }) {
  return (
    <AdminScaffold
      title="Subscription Detail"
      section="Subscriptions"
      priority="P0"
      icon="card-account-details-star"
      navigation={navigation}
      features={[
        "Company info with current subscription status",
        "Full payment history (all payments, method, date, amount)",
        "Actions: manually activate (for offline payments)",
        "Actions: extend trial (days + reason)",
        "Actions: apply custom discount (%, duration, reason)",
        "Actions: pause subscription (freeze N days)",
        "Actions: force expire (immediate deactivation)",
        "Actions: change plan/pricing, waive payment",
        "Actions: generate invoice (PDF), send payment reminder",
        "Actions: log offline payment (cash/bank transfer with receipt)",
      ]}
    />
  );
}
