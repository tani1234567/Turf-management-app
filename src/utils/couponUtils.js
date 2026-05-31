/**
 * Returns true only when both admin-controlled `status` and company-controlled
 * `companyStatus` are active. Admin status overrides — if admin pauses, the
 * company toggle has no effect.
 */
export const isCouponEffectivelyActive = (coupon) => {
  if (coupon.status !== "active") return false;
  if (coupon.channel === "turf" && coupon.companyStatus !== "active") return false;
  return true;
};

/**
 * Calculate the discount amount for a given coupon and booking total.
 * - Flat coupons are clamped to totalAmount (discount can never exceed total).
 * - Percentage coupons are floored to whole rupees and capped at maxDiscountAmount.
 */
export const calculateDiscount = (coupon, totalAmount) => {
  if (!coupon || totalAmount <= 0) {
    return { discountAmount: 0, finalAmount: totalAmount };
  }

  let discountAmount;

  if (coupon.discountType === "flat") {
    discountAmount = Math.min(coupon.discountValue, totalAmount);
  } else {
    discountAmount = (coupon.discountValue / 100) * totalAmount;
    if (coupon.maxDiscountAmount != null) {
      discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
    }
    discountAmount = Math.floor(discountAmount);
  }

  return { discountAmount, finalAmount: totalAmount - discountAmount };
};

/**
 * Build the coupon sub-object to embed in the booking document when a coupon
 * has been successfully applied and recorded.
 */
export const buildCouponBookingPayload = (coupon, discountAmount, originalAmount) => ({
  applied: true,
  code: coupon.code,
  couponId: coupon.id,
  channel: coupon.channel,
  discountType: coupon.discountType,
  discountValue: coupon.discountValue,
  discountAmount,
  originalAmount,
});

/**
 * Default empty coupon object for booking documents where no coupon was applied.
 * Always include this in new bookings so the schema is consistent.
 */
export const buildEmptyCoupon = () => ({
  applied: false,
  code: null,
  couponId: null,
  channel: null,
  discountType: null,
  discountValue: null,
  discountAmount: 0,
  originalAmount: null,
});
