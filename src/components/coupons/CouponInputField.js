import React from "react";
import { View, StyleSheet } from "react-native";
import { Text, TextInput, Button } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";

/**
 * CouponInputField — reusable coupon entry + apply/remove UI.
 *
 * Props:
 *   couponInput       string         current text in the input
 *   setCouponInput    fn(string)     update input value
 *   appliedCoupon     object|null    the applied coupon object
 *   couponError       string|null    validation error message
 *   couponLoading     boolean        spinner on Apply button
 *   savingLabel       string|null    e.g. "You save ₹200" shown when applied
 *   onApply           fn()           called when Apply is tapped
 *   onRemove          fn()           called when Remove is tapped
 *   accentColor       string         defaults to #10B981
 */
export default function CouponInputField({
  couponInput,
  setCouponInput,
  appliedCoupon,
  couponError,
  couponLoading,
  savingLabel,
  onApply,
  onRemove,
  accentColor = "#10B981",
}) {
  return (
    <View style={styles.wrapper}>
      {appliedCoupon ? (
        <View style={[styles.appliedRow, { backgroundColor: accentColor + "12" }]}>
          <MaterialCommunityIcons name="check-circle" size={20} color={accentColor} />
          <View style={styles.appliedInfo}>
            <Text style={[styles.appliedCode, { color: accentColor }]}>
              {appliedCoupon.code} applied
            </Text>
            {savingLabel ? (
              <Text style={styles.appliedSaving}>{savingLabel}</Text>
            ) : null}
          </View>
          <Text style={styles.removeBtn} onPress={onRemove}>
            Remove
          </Text>
        </View>
      ) : (
        <View style={styles.inputRow}>
          <TextInput
            mode="outlined"
            placeholder="Enter coupon code"
            value={couponInput}
            onChangeText={(t) => {
              setCouponInput(t.toUpperCase());
              if (couponError) setCouponInput(t.toUpperCase()); // clear error handled by parent
            }}
            autoCapitalize="characters"
            autoCorrect={false}
            style={styles.input}
            outlineColor="#ddd"
            activeOutlineColor={accentColor}
            dense
          />
          <Button
            mode="contained"
            onPress={onApply}
            loading={couponLoading}
            disabled={!couponInput.trim() || couponLoading}
            buttonColor={accentColor}
            style={styles.applyBtn}
            contentStyle={{ paddingVertical: 2 }}
          >
            Apply
          </Button>
        </View>
      )}

      {couponError ? (
        <Text style={styles.errorText}>{couponError}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 4 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: "#fff",
  },
  applyBtn: {
    borderRadius: 8,
  },
  appliedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 10,
  },
  appliedInfo: { flex: 1, gap: 2 },
  appliedCode: {
    fontSize: 14,
    fontWeight: "700",
  },
  appliedSaving: {
    fontSize: 12,
    color: "#64748B",
  },
  removeBtn: {
    fontSize: 13,
    color: "#F44336",
    fontWeight: "600",
  },
  errorText: {
    fontSize: 13,
    color: "#F44336",
  },
});
