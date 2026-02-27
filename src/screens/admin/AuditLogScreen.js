import React from "react";
import AdminScaffold from "./AdminScaffold";

export default function AuditLogScreen({ navigation }) {
  return (
    <AdminScaffold
      title="Audit Trail"
      section="Audit"
      priority="P2"
      icon="history"
      navigation={navigation}
      features={[
        "All admin actions logged (no exceptions)",
        "Filter by admin, action category, target type, date range",
        "Categories: company, user, booking, payment, subscription, system, support",
        "Each entry: who, what, target, old/new values, reason, timestamp",
        "Related ticket/dispute linkage",
        "Search by target ID or admin name",
        "Export audit log (CSV/Excel)",
      ]}
    />
  );
}
