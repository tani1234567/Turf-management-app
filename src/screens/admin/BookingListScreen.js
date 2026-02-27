import React from "react";
import AdminScaffold from "./AdminScaffold";

export default function BookingListScreen({ navigation }) {
  return (
    <AdminScaffold
      title="Booking Management"
      section="Bookings"
      priority="P0"
      icon="calendar-text"
      showBack={false}
      navigation={navigation}
      features={[
        "Filter by all V2.1 statuses (pending, confirmed, completed, cancelled, etc.)",
        "Filter by date range, company, turf, sport, amount range",
        "Filter by payment method, has dispute",
        "Search by booking ID, user name, user phone",
        "Sortable columns",
        "Pagination for large lists",
        "Tap to open BookingDetailScreen",
      ]}
    />
  );
}
