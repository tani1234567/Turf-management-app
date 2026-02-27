import React from "react";
import AdminScaffold from "./AdminScaffold";

export default function BookingConfigScreen({ navigation }) {
  return (
    <AdminScaffold
      title="Booking Configuration"
      section="Platform Config"
      priority="P2"
      icon="cog"
      navigation={navigation}
      features={[
        "Soft lock duration (minutes)",
        "Max advance booking days",
        "Min booking duration (minutes)",
        "Booking interval (minutes)",
        "Max payment attempts",
        "Max payment timeout (minutes)",
        "Cancellation policy: free cancellation hours, late refund %",
        "No-cancellation window (hours before booking)",
        "All changes logged and take effect immediately",
      ]}
    />
  );
}
