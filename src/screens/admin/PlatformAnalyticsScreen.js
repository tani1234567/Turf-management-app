import React from "react";
import AdminScaffold from "./AdminScaffold";

export default function PlatformAnalyticsScreen({ navigation }) {
  return (
    <AdminScaffold
      title="Platform Analytics"
      section="Analytics"
      priority="P2"
      icon="chart-line"
      navigation={navigation}
      features={[
        "User growth chart (daily/weekly/monthly, by role)",
        "Booking volume chart (bar)",
        "Revenue trend (subscription + estimated GMV)",
        "Company onboarding funnel (registered → trial → paid → retained)",
        "Geographic distribution (companies/bookings by city)",
        "Sport popularity pie chart",
        "Peak hours heatmap (platform-wide)",
        "Cancellation trends over time",
        "Payment method split (UPI vs Cash vs Online)",
      ]}
    />
  );
}
