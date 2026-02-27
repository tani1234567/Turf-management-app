import React from "react";
import AdminScaffold from "./AdminScaffold";

export default function CompanyDetailScreen({ navigation }) {
  return (
    <AdminScaffold
      title="Company Detail"
      section="Companies"
      priority="P0"
      icon="domain"
      navigation={navigation}
      features={[
        "Tab 1: Overview — name, logo, GST, PAN, owners, invite code",
        "Tab 2: Turfs & Grounds — all turfs with ground count, sports, status",
        "Tab 3: Team — managers, caretakers, assigned turfs, statuses",
        "Tab 4: Financials — subscription history, revenue, payment config",
        "Tab 5: Bookings — all bookings (paginated, filterable by date/status)",
        "Tab 6: Activity Log — owner actions, turf edits, admin actions",
        "Actions: verify, suspend, reactivate, manual subscription update",
        "Actions: reset invite code, transfer ownership, send notification",
      ]}
    />
  );
}
