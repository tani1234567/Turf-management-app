import React, { useState } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";

const ACCENT = "#10B981";
const EMERALD_DARK = "#059669";

/**
 * TurfOfferCard — horizontally scrollable card shown in TurfDetailScreen's
 * "Offers & Deals" section. Displays a single turf coupon with a copy-code button.
 */
export default function TurfOfferCard({ coupon }) {
  const [copied, setCopied] = useState(false);

  const validTo = coupon.validTo?.toDate
    ? coupon.validTo.toDate()
    : new Date(coupon.validTo);
  const daysLeft = Math.max(
    0,
    Math.ceil((validTo - new Date()) / (1000 * 60 * 60 * 24))
  );

  const discountLabel =
    coupon.discountType === "flat"
      ? `₹${coupon.discountValue} OFF`
      : `${coupon.discountValue}% OFF${
          coupon.maxDiscountAmount ? ` · Max ₹${coupon.maxDiscountAmount}` : ""
        }`;

  const handleCopy = async () => {
    await Clipboard.setStringAsync(coupon.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="tag-outline" size={15} color={ACCENT} />
        <Text style={styles.code}>{coupon.code}</Text>
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {coupon.title}
      </Text>
      <Text style={styles.discount}>{discountLabel}</Text>
      {coupon.minBookingAmount > 0 && (
        <Text style={styles.meta}>Min. ₹{coupon.minBookingAmount}</Text>
      )}
      <Text style={styles.meta}>
        {daysLeft > 0
          ? `Valid for ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`
          : "Last day!"}
      </Text>
      <TouchableOpacity
        style={[styles.copyBtn, copied && styles.copyBtnDone]}
        onPress={handleCopy}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons
          name={copied ? "check" : "content-copy"}
          size={13}
          color={copied ? "#fff" : ACCENT}
        />
        <Text style={[styles.copyText, copied && { color: "#fff" }]}>
          {copied ? "Copied!" : "Copy Code"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 168,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    gap: 4,
    borderWidth: 1.5,
    borderColor: ACCENT + "30",
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  code: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 13,
    color: ACCENT,
    letterSpacing: 0.5,
  },
  title: {
    fontFamily: "Ubuntu-Medium",
    fontSize: 12,
    color: "#1E293B",
    lineHeight: 17,
  },
  discount: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 13,
    color: EMERALD_DARK,
  },
  meta: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 11,
    color: "#94A3B8",
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    marginTop: 6,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: ACCENT,
    backgroundColor: ACCENT + "12",
  },
  copyBtnDone: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  copyText: {
    fontSize: 12,
    fontFamily: "Ubuntu-Bold",
    color: ACCENT,
  },
});
