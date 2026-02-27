import React from "react";
import AdminScaffold from "./AdminScaffold";

export default function ErrorLogsScreen({ navigation }) {
  return (
    <AdminScaffold
      title="Error Logs"
      section="System Monitoring"
      priority="P2"
      icon="bug"
      navigation={navigation}
      features={[
        "Real-time error feed from Cloud Functions",
        "Filter by function name, severity, date",
        "Stack trace viewer",
        "Error count by function (bar chart)",
        "Mark errors as acknowledged/resolved",
        "Alert on spike in error rate",
      ]}
    />
  );
}
