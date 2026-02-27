import {
  queryDocuments,
  addDocument,
  updateDocument,
  getDocument,
} from "./firestore";

/**
 * Add a new review
 * @param {Object} reviewData - Review fields
 * @param {Object} user - Current user object
 * @returns {Promise<{success: boolean, reviewId: string}>}
 */
export async function addReview(reviewData, user) {
  const review = {
    ...reviewData,
    userId: user.userId || user.uid || user.id,
    userName: user.name || user.displayName || "User",
    status: "active", // active | flagged | removed
    response: null,
    respondedBy: null,
    respondedByName: null,
    respondedAt: null,
  };

  const reviewId = await addDocument("reviews", review);

  // Update turf average rating
  await updateTurfRating(reviewData.turfId);

  // Mark booking as reviewed
  if (reviewData.bookingId) {
    try {
      await updateDocument("bookings", reviewData.bookingId, {
        hasReview: true,
        reviewId,
      });
    } catch (error) {
      console.error("Error marking booking as reviewed:", error);
    }
  }

  return { success: true, reviewId };
}

/**
 * Get reviews for a turf
 * @param {string} turfId - Turf ID
 * @param {Object} options - Optional {limit, status}
 * @returns {Promise<Array>}
 */
export async function getReviewsForTurf(turfId, options = {}) {
  const conditions = [
    { field: "turfId", operator: "==", value: turfId },
  ];

  if (options.status) {
    conditions.push({ field: "status", operator: "==", value: options.status });
  }

  const reviews = await queryDocuments("reviews", conditions, {
    orderByField: "createdAt",
    orderDirection: "desc",
  });

  return reviews;
}

/**
 * Get reviews for a company (all turfs)
 * @param {string} companyId - Company ID
 * @returns {Promise<Array>}
 */
export async function getReviewsForCompany(companyId) {
  const reviews = await queryDocuments("reviews", [
    { field: "companyId", operator: "==", value: companyId },
  ], {
    orderByField: "createdAt",
    orderDirection: "desc",
  });

  return reviews;
}

/**
 * Get reviews written by a specific user
 * @param {string} userId - User ID
 * @returns {Promise<Array>}
 */
export async function getReviewsByUser(userId) {
  const reviews = await queryDocuments("reviews", [
    { field: "userId", operator: "==", value: userId },
  ], {
    orderByField: "createdAt",
    orderDirection: "desc",
  });

  return reviews;
}

/**
 * Add a manager/owner response to a review
 * @param {string} reviewId - Review document ID
 * @param {string} responseText - Response text
 * @param {Object} responder - Manager/owner user object
 * @returns {Promise<{success: boolean}>}
 */
export async function respondToReview(reviewId, responseText, responder) {
  await updateDocument("reviews", reviewId, {
    response: responseText,
    respondedBy: responder.userId || responder.uid || responder.id,
    respondedByName: responder.name || responder.displayName || "Manager",
    respondedByRole: responder.role || "manager",
    respondedAt: new Date().toISOString(),
  });

  return { success: true };
}

/**
 * Flag a review as inappropriate
 * @param {string} reviewId - Review document ID
 * @param {string} reason - Reason for flagging
 * @param {Object} flagger - User who flagged
 * @returns {Promise<{success: boolean}>}
 */
export async function flagReview(reviewId, reason, flagger) {
  await updateDocument("reviews", reviewId, {
    status: "flagged",
    flaggedBy: flagger.userId || flagger.uid || flagger.id,
    flaggedByName: flagger.name || flagger.displayName || "User",
    flaggedByRole: flagger.role || "manager",
    flagReason: reason,
    flaggedAt: new Date().toISOString(),
  });

  return { success: true };
}

/**
 * Remove a flagged review (owner action)
 * @param {string} reviewId - Review document ID
 * @returns {Promise<{success: boolean}>}
 */
export async function removeReview(reviewId) {
  await updateDocument("reviews", reviewId, {
    status: "removed",
  });

  // Re-calculate turf rating after removal
  const review = await getDocument("reviews", reviewId);
  if (review?.turfId) {
    await updateTurfRating(review.turfId);
  }

  return { success: true };
}

/**
 * Restore a flagged review
 * @param {string} reviewId - Review document ID
 * @returns {Promise<{success: boolean}>}
 */
export async function restoreReview(reviewId) {
  await updateDocument("reviews", reviewId, {
    status: "active",
    flaggedBy: null,
    flaggedByName: null,
    flaggedByRole: null,
    flagReason: null,
    flaggedAt: null,
  });

  const review = await getDocument("reviews", reviewId);
  if (review?.turfId) {
    await updateTurfRating(review.turfId);
  }

  return { success: true };
}

/**
 * Recalculate and update a turf's average rating
 * @param {string} turfId - Turf ID
 * @returns {Promise<{averageRating: number, reviewCount: number}>}
 */
export async function updateTurfRating(turfId) {
  const reviews = await queryDocuments("reviews", [
    { field: "turfId", operator: "==", value: turfId },
    { field: "status", operator: "==", value: "active" },
  ]);

  const reviewCount = reviews.length;
  const totalRating = reviews.reduce((sum, r) => sum + (r.rating || 0), 0);
  const averageRating = reviewCount > 0 ? Math.round((totalRating / reviewCount) * 10) / 10 : 0;

  await updateDocument("turfs", turfId, {
    rating: averageRating,
    reviewCount,
  });

  return { averageRating, reviewCount };
}

/**
 * Calculate review stats for a turf
 * @param {Array} reviews - Array of review objects
 * @returns {Object} Stats with average, count, distribution
 */
export function calculateReviewStats(reviews) {
  const active = reviews.filter((r) => r.status === "active");
  const count = active.length;
  const total = active.reduce((sum, r) => sum + (r.rating || 0), 0);
  const average = count > 0 ? Math.round((total / count) * 10) / 10 : 0;

  const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  active.forEach((r) => {
    const star = Math.min(5, Math.max(1, Math.round(r.rating || 0)));
    distribution[star] = (distribution[star] || 0) + 1;
  });

  return { average, count, distribution };
}
