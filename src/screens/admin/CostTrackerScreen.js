import React from "react";
import AdminScaffold from "./AdminScaffold";

export default function CostTrackerScreen({ navigation }) {
  return (
    <AdminScaffold
      title="API Cost Tracker"
      section="System Monitoring"
      priority="P2"
      icon="currency-inr"
      navigation={navigation}
      features={[
        "Monthly cost breakdown: Firestore, Storage, Cloud Functions",
        "Google Maps API, SMS provider costs",
        "Budget vs actual per service",
        "Status indicators (OK/Warning/Critical)",
        "Cost trend chart (monthly comparison)",
        "Total platform operating cost",
      ]}
    />
  );
}
