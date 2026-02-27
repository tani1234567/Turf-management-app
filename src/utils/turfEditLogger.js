import { addDocument, serverTimestamp } from "../services/firebase/firestore";

/**
 * Log a turf edit to the turf_edit_logs collection.
 */
export async function logTurfEdit(
  turfId,
  companyId,
  userId,
  userRole,
  userName,
  editType,
  changes
) {
  try {
    await addDocument("turf_edit_logs", {
      turfId,
      companyId,
      editedBy: userId,
      editedByRole: userRole,
      editedByName: userName,
      editType,
      changes,
      editedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Failed to log turf edit:", error);
  }
}

/**
 * Compare before/after turf data and return an array of detected changes.
 * Each change has: { type, field, oldValue?, newValue?, summary }
 */
export function detectTurfChanges(before, after) {
  if (!before || !after) return [];
  const changes = [];

  // Name
  if ((before.name || "") !== (after.name || "")) {
    changes.push({
      type: "details_update",
      field: "name",
      oldValue: before.name || "",
      newValue: after.name || "",
      summary: `Name changed from "${before.name}" to "${after.name}"`,
    });
  }

  // Description
  if ((before.description || "") !== (after.description || "")) {
    changes.push({
      type: "details_update",
      field: "description",
      oldValue: before.description || "",
      newValue: after.description || "",
      summary: "Description updated",
    });
  }

  // Cover image
  if ((before.coverImage || "") !== (after.coverImage || "")) {
    changes.push({
      type: "details_update",
      field: "coverImage",
      summary: after.coverImage ? "Cover image updated" : "Cover image removed",
    });
  }

  // Location
  const locBefore = before.location || {};
  const locAfter = after.location || {};
  const locFields = ["address", "city", "state", "pincode", "googleMapsLink"];
  const locChanges = locFields.filter(
    (f) => (locBefore[f] || "") !== (locAfter[f] || "")
  );
  if (locChanges.length > 0) {
    changes.push({
      type: "details_update",
      field: "location",
      oldValue: locChanges.map((f) => `${f}: ${locBefore[f] || ""}`).join(", "),
      newValue: locChanges.map((f) => `${f}: ${locAfter[f] || ""}`).join(", "),
      summary: `Location updated (${locChanges.join(", ")})`,
    });
  }

  // Operating hours
  if (
    JSON.stringify(before.operatingHours || {}) !==
    JSON.stringify(after.operatingHours || {})
  ) {
    const changedDays = findChangedDays(
      before.operatingHours || {},
      after.operatingHours || {}
    );
    changes.push({
      type: "timing_update",
      field: "operatingHours",
      summary:
        changedDays.length > 0
          ? `Operating hours updated for ${changedDays.join(", ")}`
          : "Operating hours updated",
    });
  }

  // Grounds - count changes
  const beforeGrounds = before.grounds || [];
  const afterGrounds = after.grounds || [];

  if (afterGrounds.length > beforeGrounds.length) {
    const diff = afterGrounds.length - beforeGrounds.length;
    changes.push({
      type: "ground_added",
      field: "grounds",
      oldValue: beforeGrounds.length,
      newValue: afterGrounds.length,
      summary: `${diff} ground${diff > 1 ? "s" : ""} added (total: ${afterGrounds.length})`,
    });
  } else if (afterGrounds.length < beforeGrounds.length) {
    const diff = beforeGrounds.length - afterGrounds.length;
    changes.push({
      type: "ground_removed",
      field: "grounds",
      oldValue: beforeGrounds.length,
      newValue: afterGrounds.length,
      summary: `${diff} ground${diff > 1 ? "s" : ""} removed (total: ${afterGrounds.length})`,
    });
  }

  // Grounds - pricing/sports/amenities changes
  if (
    afterGrounds.length === beforeGrounds.length &&
    JSON.stringify(beforeGrounds) !== JSON.stringify(afterGrounds)
  ) {
    const pricingChanged = beforeGrounds.some((bg, i) => {
      const ag = afterGrounds[i];
      if (!ag) return false;
      return JSON.stringify(bg.pricing || {}) !== JSON.stringify(ag.pricing || {});
    });
    const sportsChanged = beforeGrounds.some((bg, i) => {
      const ag = afterGrounds[i];
      if (!ag) return false;
      return JSON.stringify(bg.sports || []) !== JSON.stringify(ag.sports || []);
    });
    const amenitiesChanged = beforeGrounds.some((bg, i) => {
      const ag = afterGrounds[i];
      if (!ag) return false;
      return JSON.stringify(bg.amenities || []) !== JSON.stringify(ag.amenities || []);
    });

    if (pricingChanged) {
      changes.push({
        type: "pricing_update",
        field: "grounds.pricing",
        summary: "Ground pricing updated",
      });
    }
    if (sportsChanged) {
      changes.push({
        type: "details_update",
        field: "grounds.sports",
        summary: "Ground sports selection updated",
      });
    }
    if (amenitiesChanged) {
      changes.push({
        type: "details_update",
        field: "grounds.amenities",
        summary: "Ground amenities updated",
      });
    }
  }

  // Advance payment
  if (
    JSON.stringify(before.advancePayment || {}) !==
    JSON.stringify(after.advancePayment || {})
  ) {
    changes.push({
      type: "advance_settings",
      field: "advancePayment",
      summary: "Advance payment settings updated",
    });
  }

  return changes;
}

/**
 * Find which days had operating hours changed.
 */
function findChangedDays(before, after) {
  const days = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];
  return days.filter(
    (day) => JSON.stringify(before[day] || {}) !== JSON.stringify(after[day] || {})
  );
}
