import React from "react";
import AdminScaffold from "./AdminScaffold";

export default function CompanyListScreen({ navigation }) {
  return (
    <AdminScaffold
      title="Company Management"
      section="Companies"
      priority="P0"
      icon="domain"
      showBack={false}
      navigation={navigation}
      features={[
        "Search by company name, owner name, phone",
        "Filter by status (Active/Trial/Expired/Suspended), city, ground count",
        "Filter by UPI configured (Yes/No)",
        "Sortable columns (name, turfs, grounds, bookings, revenue, date)",
        "Pagination for large lists",
        "Tap to open CompanyDetailScreen",
      ]}
    />
  );
}
