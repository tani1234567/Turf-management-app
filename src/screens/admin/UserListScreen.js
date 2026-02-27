import React from "react";
import AdminScaffold from "./AdminScaffold";

export default function UserListScreen({ navigation }) {
  return (
    <AdminScaffold
      title="User Management"
      section="Users"
      priority="P0"
      icon="account-group"
      showBack={false}
      navigation={navigation}
      features={[
        "Search by name, phone number, email, user ID",
        "Filter by role (User/Owner/Manager/Caretaker)",
        "Filter by status (Active/Suspended/Banned)",
        "Filter by city, registration date, has bookings",
        "Filter by payment rejection count",
        "Pagination for large lists",
        "Tap to open UserDetailScreen",
      ]}
    />
  );
}
