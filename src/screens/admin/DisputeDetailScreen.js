import React from "react";
import AdminScaffold from "./AdminScaffold";

export default function DisputeDetailScreen({ navigation }) {
  return (
    <AdminScaffold
      title="Dispute Detail"
      section="Disputes"
      priority="P1"
      icon="gavel"
      navigation={navigation}
      features={[
        "Dispute info: type, description, evidence/screenshots",
        "Related booking detail (inline summary)",
        "User and company info",
        "Communication log (admin ↔ user ↔ company messages)",
        "Actions: assign to admin, change status",
        "Actions: request more evidence from user/company",
        "Resolution form: decision (refund/side with company/partial/no action)",
        "Resolution: amount, note, close dispute",
        "Link to related support ticket (if any)",
      ]}
    />
  );
}
