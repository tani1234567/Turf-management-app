import React from "react";
import AdminScaffold from "./AdminScaffold";

export default function AdminManagementScreen({ navigation }) {
  return (
    <AdminScaffold
      title="Admin Management"
      section="Admin"
      priority="P2"
      icon="shield-account"
      navigation={navigation}
      features={[
        "List all admin users with role and status",
        "Create new admin (Super Admin only)",
        "Set admin role: super_admin, support_admin, finance_admin, read_only",
        "Configure granular permissions per admin",
        "Deactivate/reactivate admin accounts",
        "View admin activity log (actions performed)",
        "Last login timestamp per admin",
      ]}
    />
  );
}
