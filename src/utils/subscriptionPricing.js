/**
 * Subscription Pricing Utility
 * Tiered pricing based on total grounds + duration discounts
 */

// Pricing tiers based on total grounds
export const PRICING_TIERS = [
  { min: 1, max: 5, pricePerGround: 299, discount: 0, label: "1-5 grounds" },
  { min: 6, max: 10, pricePerGround: 269, discount: 10, label: "6-10 grounds" },
  { min: 11, max: 20, pricePerGround: 254, discount: 15, label: "11-20 grounds" },
  { min: 21, max: Infinity, pricePerGround: 239, discount: 20, label: "21+ grounds" },
];

// Duration discounts
export const DURATION_DISCOUNTS = [
  { months: 1, discount: 0, label: "1 Month" },
  { months: 3, discount: 5, label: "3 Months (5% off)" },
  { months: 6, discount: 10, label: "6 Months (10% off)" },
  { months: 12, discount: 15, label: "12 Months (15% off) - Best Value!" },
];

/**
 * Get pricing tier for given number of grounds
 * @param {number} totalGrounds - Total grounds count
 * @returns {Object} Matching pricing tier
 */
export function getPricingTier(totalGrounds) {
  return PRICING_TIERS.find(
    (tier) => totalGrounds >= tier.min && totalGrounds <= tier.max
  );
}

/**
 * Get duration discount percentage
 * @param {number} months - Duration in months
 * @returns {number} Discount percentage
 */
export function getDurationDiscount(months) {
  const entry = DURATION_DISCOUNTS.find((d) => d.months === months);
  return entry ? entry.discount : 0;
}

/**
 * Calculate subscription price with tiered pricing and duration discounts
 * @param {number} totalGrounds - Total grounds across selected turfs
 * @param {number} months - Subscription duration in months
 * @returns {Object} Detailed pricing breakdown
 */
export function calculateSubscriptionPrice(totalGrounds, months) {
  if (totalGrounds === 0) {
    return {
      monthlyPrice: 0,
      totalBeforeDiscount: 0,
      tierInfo: null,
      tierDiscount: 0,
      durationDiscount: 0,
      discountAmount: 0,
      finalAmount: 0,
      pricePerGround: 0,
    };
  }

  const tier = getPricingTier(totalGrounds);
  const durationDiscount = getDurationDiscount(months);

  const monthlyPrice = totalGrounds * tier.pricePerGround;
  const totalBeforeDiscount = monthlyPrice * months;
  const discountAmount = Math.round((totalBeforeDiscount * durationDiscount) / 100);
  const finalAmount = totalBeforeDiscount - discountAmount;

  return {
    monthlyPrice,
    totalBeforeDiscount,
    tierInfo: tier,
    tierDiscount: tier.discount,
    durationDiscount,
    discountAmount,
    finalAmount,
    pricePerGround: tier.pricePerGround,
  };
}

/**
 * Calculate total grounds across selected turfs
 * @param {Array} turfs - Array of turf objects
 * @param {Array} selectedTurfIds - Array of selected turf IDs
 * @returns {number} Total ground count
 */
export function calculateTotalGrounds(turfs, selectedTurfIds) {
  return turfs
    .filter((turf) => selectedTurfIds.includes(turf.id || turf.turfId))
    .reduce((sum, turf) => sum + (turf.totalGrounds || turf.grounds?.length || 0), 0);
}

/**
 * Format price for display in INR
 * @param {number} amount - Amount to format
 * @returns {string} Formatted price string
 */
export function formatPrice(amount) {
  if (amount === 0) return "Rs.0";
  return `Rs.${amount.toLocaleString("en-IN")}`;
}
