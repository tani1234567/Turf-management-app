import React from "react";
import AdminScaffold from "./AdminScaffold";

export default function BookingDetailScreen({ navigation }) {
  return (
    <AdminScaffold
      title="Booking Detail"
      section="Bookings"
      priority="P0"
      icon="calendar-check"
      navigation={navigation}
      features={[
        "Full booking details (user, turf, ground, sport, date, time, amount)",
        "Complete status history timeline (visual)",
        "Payment breakdown: advance config, advance paid, on-ground, total",
        "Payment proof screenshot viewer (if UPI)",
        "Negotiation details (if chat booking)",
        "Cancellation and extension details",
        "Actions: override status, force confirm, force cancel",
        "Actions: mark payment verified, initiate refund, add admin note",
        "Actions: re-assign ground, extend/release slot lock",
      ]}
    />
  );
}
