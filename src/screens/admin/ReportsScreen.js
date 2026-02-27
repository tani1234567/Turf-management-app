import React from "react";
import AdminScaffold from "./AdminScaffold";

export default function ReportsScreen({ navigation }) {
  return (
    <AdminScaffold
      title="Reports"
      section="Analytics"
      priority="P2"
      icon="file-chart"
      navigation={navigation}
      features={[
        "Monthly Business Report (PDF/Excel, auto-generated 1st of month)",
        "Subscription Revenue Report (on demand)",
        "Company Performance Ranking (on demand)",
        "User Activity Report (CSV, on demand)",
        "Payment Verification Report (weekly auto)",
        "Dispute Resolution Report (monthly auto)",
        "System Cost Report (monthly auto)",
        "Download/share generated reports",
      ]}
    />
  );
}
