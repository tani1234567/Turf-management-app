import React from "react";
import AdminScaffold from "./AdminScaffold";

export default function FeatureFlagsScreen({ navigation }) {
  return (
    <AdminScaffold
      title="Feature Flags"
      section="Platform Config"
      priority="P2"
      icon="toggle-switch"
      navigation={navigation}
      features={[
        "Toggle: chat_negotiation_enabled",
        "Toggle: upi_payments_enabled",
        "Toggle: academy_system_enabled",
        "Toggle: review_system_enabled",
        "Toggle: new_company_registration",
        "Toggle: maintenance_mode (shows maintenance screen to non-admins)",
        "Toggle: force_app_update",
        "Set: min_app_version (minimum supported version)",
        "Changes take effect immediately, logged to admin_logs",
      ]}
    />
  );
}
