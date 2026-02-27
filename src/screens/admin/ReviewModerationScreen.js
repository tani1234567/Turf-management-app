import React from "react";
import AdminScaffold from "./AdminScaffold";

export default function ReviewModerationScreen({ navigation }) {
  return (
    <AdminScaffold
      title="Review Moderation"
      section="Content Moderation"
      priority="P1"
      icon="star-check"
      navigation={navigation}
      features={[
        "Queue of flagged reviews (by managers + keyword auto-flag)",
        "Review details: user, turf, rating, text, date",
        "Actions: approve review (remove flag)",
        "Actions: hide review (not visible to public, user notified)",
        "Actions: delete review (permanent, user notified)",
        "Actions: ban user from posting reviews",
        "Actions: contact user or company about review",
        "Configurable bad-word list for auto-flagging",
      ]}
    />
  );
}
