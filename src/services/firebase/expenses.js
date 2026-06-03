import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "./config";
import {
  queryDocuments,
  addDocument,
  updateDocument,
  deleteDocument,
} from "./firestore";

// Always use the web Firebase SDK for Storage so it shares the same auth
// context as the web SDK auth instance (AsyncStorage-backed).
const nativeStorage = null;
const hasNativeStorage = false;

/**
 * Add a new expense
 * @param {Object} expenseData - Expense fields (companyId, turfId, category, amount, etc.)
 * @param {Object} user - Current user object
 * @returns {Promise<{success: boolean, expenseId: string}>}
 */
export async function addExpense(expenseData, user) {
  const expense = {
    ...expenseData,
    addedBy: user.userId || user.uid || user.id,
    addedByRole: user.role,
    addedByName: user.name || user.displayName || "User",
  };

  const expenseId = await addDocument("expenses", expense);
  return { success: true, expenseId };
}

/**
 * Upload receipt image(s) to Firebase Storage
 * @param {string} expenseId - Expense document ID
 * @param {Array<string>} imageUris - Array of local image URIs
 * @returns {Promise<Array<string>>} Array of download URLs
 */
export async function uploadReceiptImages(expenseId, imageUris) {
  if (!imageUris || imageUris.length === 0) return [];

  const urls = [];

  for (let i = 0; i < imageUris.length; i++) {
    const uri = imageUris[i];
    const storagePath = `expenses/${expenseId}/receipt_${Date.now()}_${i}.jpg`;

    const response = await fetch(uri);
    const blob = await response.blob();
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, blob);
    const downloadURL = await getDownloadURL(storageRef);
    urls.push(downloadURL);
  }

  return urls;
}

/**
 * Update an expense
 * @param {string} expenseId - Expense document ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<{success: boolean}>}
 */
export async function updateExpense(expenseId, updates) {
  await updateDocument("expenses", expenseId, updates);
  return { success: true };
}

/**
 * Delete an expense
 * @param {string} expenseId - Expense document ID
 * @returns {Promise<{success: boolean}>}
 */
export async function deleteExpense(expenseId) {
  await deleteDocument("expenses", expenseId);
  return { success: true };
}

/**
 * Get expenses for a specific turf
 * @param {string} turfId - Turf ID
 * @param {Object} filters - Optional filters {addedBy, category, startDate, endDate}
 * @returns {Promise<Array>} Array of expense documents
 */
export async function getExpensesForTurf(turfId, filters = {}) {
  const conditions = [{ field: "turfId", operator: "==", value: turfId }];

  if (filters.addedBy) {
    conditions.push({ field: "addedBy", operator: "==", value: filters.addedBy });
  }
  if (filters.category) {
    conditions.push({ field: "category", operator: "==", value: filters.category });
  }

  const expenses = await queryDocuments("expenses", conditions, {
    orderByField: "date",
    orderDirection: "desc",
  });

  // Client-side date filtering (Firestore compound queries limited)
  let filtered = expenses;
  if (filters.startDate) {
    filtered = filtered.filter((e) => e.date >= filters.startDate);
  }
  if (filters.endDate) {
    filtered = filtered.filter((e) => e.date <= filters.endDate);
  }

  return filtered;
}

/**
 * Get all expenses for a company (owner view)
 * @param {string} companyId - Company ID
 * @param {Object} filters - Optional filters {turfId, category, startDate, endDate}
 * @returns {Promise<Array>} Array of expense documents
 */
export async function getExpensesForCompany(companyId, filters = {}) {
  const conditions = [{ field: "companyId", operator: "==", value: companyId }];

  if (filters.turfId) {
    conditions.push({ field: "turfId", operator: "==", value: filters.turfId });
  }
  if (filters.category) {
    conditions.push({ field: "category", operator: "==", value: filters.category });
  }

  const expenses = await queryDocuments("expenses", conditions, {
    orderByField: "date",
    orderDirection: "desc",
  });

  let filtered = expenses;
  if (filters.startDate) {
    filtered = filtered.filter((e) => e.date >= filters.startDate);
  }
  if (filters.endDate) {
    filtered = filtered.filter((e) => e.date <= filters.endDate);
  }

  return filtered;
}

/**
 * Calculate expense summary from an array of expenses
 * @param {Array} expenses - Array of expense objects
 * @returns {Object} Summary with total, byCategory, byMonth, byRole
 */
export function calculateExpenseSummary(expenses) {
  const summary = {
    total: 0,
    byCategory: {},
    byMonth: {},
    byRole: {
      caretaker: 0,
      manager: 0,
      owner: 0,
    },
  };

  expenses.forEach((expense) => {
    const amount = expense.amount || 0;
    summary.total += amount;

    // By category
    const cat = expense.category || "other";
    summary.byCategory[cat] = (summary.byCategory[cat] || 0) + amount;

    // By month (YYYY-MM)
    const month = (expense.date || "").substring(0, 7);
    if (month) {
      summary.byMonth[month] = (summary.byMonth[month] || 0) + amount;
    }

    // By role
    const role = expense.addedByRole;
    if (role && summary.byRole[role] !== undefined) {
      summary.byRole[role] += amount;
    }
  });

  return summary;
}
