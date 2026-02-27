/**
 * Expense Categories Configuration
 * Caretakers have limited categories; Managers/Owners have full access.
 */

export const EXPENSE_CATEGORIES = {
  caretaker: [
    {
      id: "maintenance",
      label: "Maintenance",
      icon: "tools",
      subcategories: ["ground_repair", "equipment_repair", "facility_repair"],
    },
    {
      id: "cleaning",
      label: "Cleaning Supplies",
      icon: "broom",
      subcategories: ["cleaning_products", "tools"],
    },
    {
      id: "equipment",
      label: "Equipment",
      icon: "soccer",
      subcategories: ["sports_equipment", "safety_gear"],
    },
    {
      id: "utilities_minor",
      label: "Minor Utilities",
      icon: "lightbulb-outline",
      subcategories: ["bulbs", "batteries", "minor_repairs"],
    },
  ],

  managerOwner: [
    {
      id: "maintenance",
      label: "Maintenance",
      icon: "tools",
      subcategories: [
        "ground_repair",
        "equipment_repair",
        "facility_repair",
        "painting",
        "plumbing",
        "electrical",
      ],
    },
    {
      id: "utilities",
      label: "Utilities",
      icon: "flash",
      subcategories: ["electricity", "water", "gas", "internet"],
    },
    {
      id: "staff_salary",
      label: "Staff Salary",
      icon: "cash",
      subcategories: ["caretaker", "security", "cleaner", "other_staff"],
    },
    {
      id: "equipment",
      label: "Equipment",
      icon: "soccer",
      subcategories: ["sports_equipment", "floodlights", "nets", "goals"],
    },
    {
      id: "cleaning",
      label: "Cleaning",
      icon: "broom",
      subcategories: ["cleaning_products", "tools", "service"],
    },
    {
      id: "marketing",
      label: "Marketing",
      icon: "bullhorn",
      subcategories: ["advertising", "promotional_materials", "social_media"],
    },
    {
      id: "rent",
      label: "Rent",
      icon: "home",
      subcategories: [],
    },
    {
      id: "insurance",
      label: "Insurance",
      icon: "shield-check",
      subcategories: [],
    },
    {
      id: "other",
      label: "Other",
      icon: "dots-horizontal",
      subcategories: [],
    },
  ],
};

/**
 * Get categories for a specific role
 * @param {string} role - 'caretaker' | 'manager' | 'owner'
 * @returns {Array} Category list
 */
export function getCategoriesForRole(role) {
  if (role === "caretaker") {
    return EXPENSE_CATEGORIES.caretaker;
  }
  return EXPENSE_CATEGORIES.managerOwner;
}

/**
 * Get category label by ID
 * @param {string} categoryId - Category ID
 * @param {string} role - User role
 * @returns {string} Category label
 */
export function getCategoryLabel(categoryId, role) {
  const categories = getCategoriesForRole(role || "manager");
  const cat = categories.find((c) => c.id === categoryId);
  return cat?.label || categoryId;
}

/**
 * Get category icon by ID
 * @param {string} categoryId - Category ID
 * @param {string} role - User role
 * @returns {string} Icon name
 */
export function getCategoryIcon(categoryId, role) {
  const categories = getCategoriesForRole(role || "manager");
  const cat = categories.find((c) => c.id === categoryId);
  return cat?.icon || "help-circle";
}

/**
 * Format subcategory string for display
 * @param {string} sub - Subcategory ID like "ground_repair"
 * @returns {string} Formatted label like "Ground Repair"
 */
export function formatSubcategory(sub) {
  if (!sub) return "";
  return sub
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
}
