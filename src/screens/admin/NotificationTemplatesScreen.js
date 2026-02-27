import React from "react";
import AdminScaffold from "./AdminScaffold";

export default function NotificationTemplatesScreen({ navigation }) {
  return (
    <AdminScaffold
      title="Notification Templates"
      section="Platform Config"
      priority="P2"
      icon="bell-cog"
      navigation={navigation}
      features={[
        "Editable templates for all notification types",
        "Push notification: title + body templates",
        "SMS text templates",
        "Variable placeholders: {{userName}}, {{turfName}}, {{date}}, {{amount}}",
        "Preview rendered template before saving",
        "Separate templates per notification event type",
        "Template versioning (rollback support)",
      ]}
    />
  );
}
