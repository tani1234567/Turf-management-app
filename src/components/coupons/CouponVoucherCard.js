import React from "react";
import { View, StyleSheet } from "react-native";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";

const ACCENT = "#10B981";

/**
 * CouponVoucherCard — shown inside BookingDetailsModal for pay-at-venue bookings
 * where a coupon was applied. User shows this screen to the turf staff to claim
 * their discount.
 *
 * For advance-payment bookings the discount is already baked into the amount paid,
 * so this card is informational only (isVenue = false).
 */
export default function CouponVoucherCard({ coupon, isVenue = false }) {
  if (!coupon?.applied) return null;

  const discountLabel =
    coupon.discountType === "flat"
      ? `₹${coupon.discountValue} OFF`
      : `${coupon.discountValue}% OFF`;

  const savedAmount = coupon.discountAmount || 0;

  if (isVenue) {
    return (
      <View style={styles.voucherCard}>
        <View style={styles.voucherHeader}>
          <MaterialCommunityIcons name="ticket-percent" size={20} color={ACCENT} />
          <Text style={styles.voucherTitle}>Coupon Applied</Text>
        </View>
        <Text style={styles.voucherCode}>{coupon.code}</Text>
        <Text style={styles.voucherDiscount}>
          {discountLabel}
          {savedAmount > 0 ? ` — ₹${savedAmount} saved` : ""}
        </Text>
        <View style={styles.voucherInstructionRow}>
          <MaterialCommunityIcons name="information-outline" size={14} color="#64748B" />
          <Text style={styles.voucherInstruction}>
            Show this screen at the venue to claim your discount.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.infoRow}>
      <MaterialCommunityIcons name="tag-outline" size={16} color={ACCENT} />
      <Text style={styles.infoText}>
        {coupon.code} applied
        {savedAmount > 0 ? ` — ₹${savedAmount} saved` : ""}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  voucherCard: {
    backgroundColor: ACCENT + "0E",
    borderWidth: 1.5,
    borderColor: ACCENT + "40",
    borderRadius: 12,
    padding: 14,
    gap: 6,
    marginTop: 8,
  },
  voucherHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  voucherTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: ACCENT,
  },
  voucherCode: {
    fontSize: 20,
    fontWeight: "800",
    color: ACCENT,
    letterSpacing: 1,
  },
  voucherDiscount: {
    fontSize: 13,
    color: "#1E293B",
    fontWeight: "500",
  },
  voucherInstructionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: 4,
  },
  voucherInstruction: {
    fontSize: 12,
    color: "#64748B",
    flex: 1,
    lineHeight: 16,
  },

  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
  },
  infoText: {
    fontSize: 13,
    color: ACCENT,
    fontWeight: "500",
  },
});
