import React from "react";
import AdminScaffold from "./AdminScaffold";

export default function ManualSubscriptionScreen({ navigation }) {
  return (
    <AdminScaffold
      title="Manual Subscription Update"
      section="Subscriptions"
      priority="P0"
      icon="pencil-plus"
      navigation={navigation}
      features={[
        "Select company from list or search",
        "Set subscription start and end dates",
        "Set payment amount and method (cash/bank transfer/UPI/other)",
        "Upload payment receipt or reference number",
        "Add admin notes",
        "Preview subscription details before confirming",
        "Auto-activates company turfs on confirmation",
        "Logged in admin_logs with full audit trail",
      ]}
    />
  );
}
