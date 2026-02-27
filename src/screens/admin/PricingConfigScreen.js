import React from "react";
import AdminScaffold from "./AdminScaffold";

export default function PricingConfigScreen({ navigation }) {
  return (
    <AdminScaffold
      title="Pricing Configuration"
      section="Platform Config"
      priority="P2"
      icon="tag-multiple"
      navigation={navigation}
      features={[
        "Edit subscription pricing tiers (ground count ranges, price per ground)",
        "Edit volume discounts per tier",
        "Edit trial period duration (days)",
        "Edit grace period duration (days)",
        "Edit duration discounts (3/6/12 month plans)",
        "Preview pricing table before saving",
        "Changes take effect immediately",
        "All changes logged to admin_logs",
      ]}
    />
  );
}
