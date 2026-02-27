import React from "react";
import AdminScaffold from "./AdminScaffold";

export default function PaymentVerificationQueueScreen({ navigation }) {
  return (
    <AdminScaffold
      title="Payment Verification Queue"
      section="Payments"
      priority="P0"
      icon="credit-card-check"
      navigation={navigation}
      features={[
        "All pending payment verifications across the platform",
        "Columns: booking ID, user, amount, UPI txn ID, screenshot",
        "Columns: submitted at, time waiting, turf name, manager name",
        "Actions: verify payment (on behalf of manager)",
        "Actions: reject payment (with reason)",
        "Actions: contact manager, contact user (send notification)",
        "Actions: escalate to owner",
        "Sort by time waiting (oldest first)",
      ]}
    />
  );
}
