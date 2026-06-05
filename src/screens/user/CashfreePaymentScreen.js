import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  BackHandler,
  Linking,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { ActivityIndicator, Button, Text, TextInput } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../services/firebase/config";
import { useCashfreePayment } from "../../hooks/useCashfreePayment";
import { releaseSlotLock } from "../../services/firebase/payments";
import { validateCouponForBooking, applyCouponToExistingBooking } from "../../services/firebase/coupons";
import { calculateDiscount } from "../../utils/couponUtils";
import { auth } from "../../services/firebase/config";

const USER_COLOR = "#10B981";
const RETURN_URL = "https://payment-done.playgrid.local";

const UPI_SCHEMES = [
  "upi://", "intent://", "phonepe://", "paytmmp://",
  "tez://", "bhim://", "gpay://", "credpay://",
];

const CF_MODE = __DEV__ ? "sandbox" : "production";

const buildCheckoutHtml = (paymentSessionId) => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #f5f5f5; font-family: sans-serif; }
  </style>
</head>
<body>
  <script src="https://sdk.cashfree.com/js/v3/cashfree.js"></script>
  <script>
    window.onload = function() {
      try {
        const cashfree = Cashfree({ mode: "${CF_MODE}" });
        cashfree.checkout({
          paymentSessionId: "${paymentSessionId}",
          returnUrl: "${RETURN_URL}",
          redirectTarget: "_self",
        }).catch(function(err) {
          try {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: "CF_ERROR",
              message: err && err.message ? err.message : "Checkout failed to start",
            }));
          } catch(e) {}
        });
      } catch(err) {
        try {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: "CF_ERROR",
            message: err && err.message ? err.message : "SDK load error",
          }));
        } catch(e) {}
      }
    };
  </script>
</body>
</html>
`;

const PHASE = {
  COUPON: "coupon",     // negotiated bookings: coupon input before order creation
  INIT: "init",
  CHECKOUT: "checkout",
  VERIFYING: "verifying",
  SUCCESS: "success",
  FAILED: "failed",
};

export default function CashfreePaymentScreen({ navigation, route }) {
  const {
    bookingId,
    amount,
    customerPhone,
    customerName,
    turfName,
    lockExpiry,
    turf,
    ground,
    date,
    startTime,
    endTime,
    // Coupon-step params (negotiated bookings only)
    totalAmount = null,
    isNegotiatedBooking = false,
    companyId = null,
    turfId = null,
  } = route.params || {};

  const showCouponStep = isNegotiatedBooking && totalAmount > 0;
  const initialPhase = showCouponStep ? PHASE.COUPON : PHASE.INIT;

  const [phase, setPhase] = useState(initialPhase);
  const [paymentSessionId, setPaymentSessionId] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(600);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const unsubscribeRef = useRef(null);
  const timerRef = useRef(null);
  const verifyTimeoutRef = useRef(null);
  const phaseRef = useRef(initialPhase);
  const orderIdRef = useRef(null);

  // Coupon state (negotiated bookings)
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [discountedAmount, setDiscountedAmount] = useState(amount);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);

  const { createOrder, verifyOrder } = useCashfreePayment();

  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // ── Countdown timer ─────────────────────────────────────────────────────────
  useEffect(() => {
    const getRemaining = () => {
      if (!lockExpiry) return 600;
      const expiry =
        typeof lockExpiry === "object" && lockExpiry.toDate
          ? lockExpiry.toDate().getTime()
          : typeof lockExpiry === "number"
          ? lockExpiry
          : new Date(lockExpiry).getTime();
      return Math.max(0, Math.floor((expiry - Date.now()) / 1000));
    };
    setTimeRemaining(getRemaining());
    timerRef.current = setInterval(() => setTimeRemaining(getRemaining()), 1000);
    return () => clearInterval(timerRef.current);
  }, [lockExpiry]);

  // Pulse for urgent timer
  useEffect(() => {
    if (timeRemaining > 0 && timeRemaining < 60) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.4, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
    pulseAnim.setValue(1);
  }, [timeRemaining < 60]);

  // ── Cleanup ─────────────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    unsubscribeRef.current?.();
    clearInterval(timerRef.current);
    clearTimeout(verifyTimeoutRef.current);
  }, []);

  // ── Firestore listener — activated after checkout ────────────────────────────
  const startBookingListener = useCallback(() => {
    unsubscribeRef.current = onSnapshot(doc(db, "bookings", bookingId), (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();

        if (data.status === "confirmed" && data.paymentStatus === "paid") {
          cleanup();
          setPhase(PHASE.SUCCESS);
          navigation.replace("BookingSuccess", {
            bookingId,
            booking: { ...data, id: bookingId },
            turf, ground, date, startTime, endTime,
          });
        } else if (data.status === "cancelled") {
          cleanup();
          setPhase(PHASE.FAILED);
          Alert.alert(
            "Payment Failed",
            "Your payment could not be processed. Your slot has been released.",
            [{ text: "OK", onPress: () => navigation.goBack() }]
          );
        }
      });
  }, [bookingId]);

  // Statuses from Cashfree that definitively mean payment did not succeed
  const FAILED_STATUSES = ["FAILED", "CANCELLED", "EXPIRED", "USER_DROPPED", "VOID"];

  const handleReleaseAndFail = useCallback(async () => {
    cleanup();
    await releaseSlotLock(bookingId);
    setPhase(PHASE.FAILED);
  }, [bookingId, cleanup]);

  // ── Called when Cashfree redirects to RETURN_URL ─────────────────────────────
  const handleCheckoutReturn = useCallback(async () => {
    if (phaseRef.current === PHASE.VERIFYING || phaseRef.current === PHASE.SUCCESS) return;

    setPhase(PHASE.VERIFYING);
    startBookingListener(); // listen for webhook-driven success/cancel update

    // 60s safety-net: if still verifying, release and show failure
    verifyTimeoutRef.current = setTimeout(async () => {
      if (phaseRef.current === PHASE.VERIFYING) {
        await handleReleaseAndFail();
      }
    }, 60000);

    // Actively verify — don't rely solely on webhook
    try {
      const orderId = orderIdRef.current;
      if (!orderId) return;

      const result = await verifyOrder({ orderId, bookingId });

      if (result && FAILED_STATUSES.includes(result.status)) {
        // Payment definitively failed — release slot immediately
        await handleReleaseAndFail();
      }
      // PAID → Firestore listener handles navigation
      // ACTIVE / unknown → wait for webhook + timeout safety-net above
    } catch (err) {
      console.warn("verifyCashfreeOrder error:", err.message);
      // On verify error, keep waiting — timeout will clean up if needed
    }
  }, [bookingId, startBookingListener, verifyOrder, handleReleaseAndFail]);

  // ── Create Cashfree order (called explicitly, not on mount for coupon step) ──
  const createPaymentOrder = useCallback(async (payAmount) => {
    setPhase(PHASE.INIT);
    try {
      const order = await createOrder({
        bookingId, amount: payAmount, customerPhone, customerName,
      });
      orderIdRef.current = order.orderId;
      setPaymentSessionId(order.paymentSessionId);
      setPhase(PHASE.CHECKOUT);
    } catch (err) {
      Alert.alert("Payment Error", err.message, [
        { text: "Go Back", onPress: () => navigation.goBack() },
      ]);
    }
  }, [bookingId, customerPhone, customerName, createOrder, navigation]);

  // ── On mount: skip to INIT immediately unless coupon step is shown ──────────
  useEffect(() => {
    if (!showCouponStep) {
      createPaymentOrder(amount);
    }
    return cleanup;
  }, []);

  // ── Coupon: validate code ────────────────────────────────────────────────────
  const handleApplyCoupon = useCallback(async () => {
    if (!couponInput.trim()) return;
    setCouponLoading(true);
    setCouponError(null);

    const userId = auth.currentUser?.uid || "";
    const result = await validateCouponForBooking(couponInput, {
      userId,
      turfId: turfId || "",
      companyId: companyId || "",
      totalAmount,
      isNegotiatedBooking: true,
    });

    setCouponLoading(false);

    if (result.valid) {
      const { discountAmount } = calculateDiscount(result.coupon, totalAmount);
      // Advance is a proportional share of the total discount
      const advanceRatio = totalAmount > 0 ? amount / totalAmount : 1;
      const newAdvance = Math.max(1, Math.round(amount - discountAmount * advanceRatio));
      setAppliedCoupon(result.coupon);
      setDiscountedAmount(newAdvance);
      setCouponError(null);
    } else {
      setCouponError(result.error);
      setAppliedCoupon(null);
      setDiscountedAmount(amount);
    }
  }, [couponInput, turfId, companyId, totalAmount, amount]);

  const handleRemoveCoupon = useCallback(() => {
    setAppliedCoupon(null);
    setCouponInput("");
    setCouponError(null);
    setDiscountedAmount(amount);
  }, [amount]);

  // ── Coupon: skip step entirely — pay original amount with no coupon ─────────
  const handleSkipCoupon = useCallback(() => {
    createPaymentOrder(amount);
  }, [amount, createPaymentOrder]);

  // ── Coupon: proceed to payment (apply to booking then create order) ──────────
  const handleProceedFromCoupon = useCallback(async () => {
    setIsApplyingCoupon(true);
    try {
      if (appliedCoupon) {
        const userId = auth.currentUser?.uid || "";
        const { discountAmount } = calculateDiscount(appliedCoupon, totalAmount);
        const finalAmount = totalAmount - discountAmount;

        const result = await applyCouponToExistingBooking(appliedCoupon, bookingId, {
          userId,
          companyId: companyId || "",
          turfId: turfId || "",
          originalAmount: totalAmount,
          discountAmount,
          finalAmount,
          advanceAmount: discountedAmount,
        });

        if (!result.success) {
          Alert.alert("Coupon Error", result.message);
          setIsApplyingCoupon(false);
          return;
        }
      }
      createPaymentOrder(discountedAmount);
    } catch (err) {
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setIsApplyingCoupon(false);
    }
  }, [appliedCoupon, bookingId, companyId, turfId, totalAmount, discountedAmount, createPaymentOrder]);

  // ── Hardware back button ─────────────────────────────────────────────────────
  useEffect(() => {
    const handler = BackHandler.addEventListener("hardwareBackPress", () => {
      if (phase === PHASE.VERIFYING || phase === PHASE.SUCCESS) return true;
      Alert.alert(
        "Cancel Payment?",
        "If you leave now, your slot hold will be released.",
        [
          { text: "Stay", style: "cancel" },
          {
            text: "Leave",
            style: "destructive",
            onPress: () => {
              releaseSlotLock(bookingId);
              cleanup();
              navigation.goBack();
            },
          },
        ]
      );
      return true;
    });
    return () => handler.remove();
  }, [phase]);

  // ── WebView handlers ─────────────────────────────────────────────────────────
  const handleShouldStartLoad = useCallback(({ url }) => {
    if (url.startsWith(RETURN_URL)) {
      handleCheckoutReturn();
      return false;
    }
    if (UPI_SCHEMES.some((s) => url.startsWith(s))) {
      Linking.openURL(url).catch(() =>
        Alert.alert("No UPI App", "Could not open UPI app. Install GPay, PhonePe, or Paytm.")
      );
      return false;
    }
    return true;
  }, [handleCheckoutReturn]);

  const handleWebViewMessage = useCallback((event) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === "CF_ERROR") {
        Alert.alert("Checkout Error", msg.message || "Payment could not be started.", [
          { text: "Go Back", onPress: () => navigation.goBack() },
        ]);
      }
    } catch {}
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const formatTime = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const isUrgent = timeRemaining > 0 && timeRemaining < 60;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Timer strip */}
      {timeRemaining > 0 && phase !== PHASE.SUCCESS && (
        <Animated.View
          style={[
            styles.timerStrip,
            { backgroundColor: isUrgent ? "#F44336" : "#FF9800" },
            isUrgent && { opacity: pulseAnim },
          ]}
        >
          <MaterialCommunityIcons name="clock-outline" size={16} color="#fff" />
          <Text style={styles.timerText}>
            Slot held · {formatTime(timeRemaining)} remaining
          </Text>
        </Animated.View>
      )}

      {/* ── Coupon Step (negotiated bookings only) ─────────────────────────── */}
      {phase === PHASE.COUPON && (
        <ScrollView
          contentContainerStyle={styles.couponScroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.couponCard}>
            <MaterialCommunityIcons name="tag-outline" size={28} color={USER_COLOR} />
            <Text style={styles.couponHeading}>Have a PlayGrid Coupon?</Text>
            <Text style={styles.couponSub}>
              Only PlayGrid platform coupons apply to negotiated bookings.
            </Text>

            {appliedCoupon ? (
              <View style={styles.couponAppliedRow}>
                <MaterialCommunityIcons name="check-circle" size={20} color={USER_COLOR} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.couponAppliedCode}>{appliedCoupon.code} applied</Text>
                  <Text style={styles.couponAppliedSaving}>
                    Advance: ₹{amount} → ₹{discountedAmount}
                  </Text>
                </View>
                <Text style={styles.couponRemove} onPress={handleRemoveCoupon}>
                  Remove
                </Text>
              </View>
            ) : (
              <View style={styles.couponInputRow}>
                <TextInput
                  mode="outlined"
                  placeholder="Enter coupon code"
                  value={couponInput}
                  onChangeText={(t) => {
                    setCouponInput(t.toUpperCase());
                    if (couponError) setCouponError(null);
                  }}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  style={styles.couponInput}
                  outlineColor="#ddd"
                  activeOutlineColor={USER_COLOR}
                  dense
                />
                <Button
                  mode="contained"
                  onPress={handleApplyCoupon}
                  loading={couponLoading}
                  disabled={!couponInput.trim() || couponLoading}
                  buttonColor={USER_COLOR}
                  style={styles.couponApplyBtn}
                  contentStyle={{ paddingVertical: 2 }}
                >
                  Apply
                </Button>
              </View>
            )}

            {couponError ? (
              <Text style={styles.couponError}>{couponError}</Text>
            ) : null}

            {/* Payment summary */}
            <View style={styles.couponSummary}>
              <View style={styles.couponSummaryRow}>
                <Text style={styles.couponSummaryLabel}>Advance to pay</Text>
                <Text style={[styles.couponSummaryValue, { color: USER_COLOR, fontWeight: "700" }]}>
                  ₹{discountedAmount}
                </Text>
              </View>
              {appliedCoupon && discountedAmount < amount && (
                <View style={styles.couponSummaryRow}>
                  <Text style={[styles.couponSummaryLabel, { color: USER_COLOR }]}>
                    You save
                  </Text>
                  <Text style={[styles.couponSummaryValue, { color: USER_COLOR }]}>
                    ₹{amount - discountedAmount}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.couponActions}>
              <Button
                mode="outlined"
                onPress={handleSkipCoupon}
                disabled={isApplyingCoupon}
                textColor="#666"
                style={[styles.couponBtn, { borderColor: "#ddd" }]}
              >
                Skip
              </Button>
              <Button
                mode="contained"
                onPress={handleProceedFromCoupon}
                loading={isApplyingCoupon}
                disabled={isApplyingCoupon}
                buttonColor={USER_COLOR}
                style={styles.couponBtn}
              >
                Pay ₹{discountedAmount}
              </Button>
            </View>
          </View>
        </ScrollView>
      )}

      {/* Content area */}
      {phase === PHASE.INIT && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color={USER_COLOR} />
          <Text style={styles.overlayText}>Setting up payment...</Text>
        </View>
      )}

      {phase === PHASE.CHECKOUT && paymentSessionId && (
        <WebView
          source={{
            html: buildCheckoutHtml(paymentSessionId),
            baseUrl: CF_MODE === "sandbox"
              ? "https://sandbox.cashfree.com"
              : "https://www.cashfree.com",
          }}
          style={styles.webview}
          javaScriptEnabled
          domStorageEnabled
          mixedContentMode="always"
          setSupportMultipleWindows={false}
          allowsInlineMediaPlayback
          onShouldStartLoadWithRequest={handleShouldStartLoad}
          onMessage={handleWebViewMessage}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.overlay}>
              <ActivityIndicator size="large" color={USER_COLOR} />
              <Text style={styles.overlayText}>Loading checkout...</Text>
            </View>
          )}
        />
      )}

      {phase === PHASE.VERIFYING && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color={USER_COLOR} />
          <Text style={styles.overlayText}>Verifying payment...</Text>
          <Text style={styles.overlaySubtext}>
            Confirming with Cashfree. This takes a few seconds.
          </Text>
          <Button
            mode="outlined"
            textColor="#F44336"
            style={styles.cancelVerifyBtn}
            onPress={() =>
              Alert.alert(
                "Haven't Paid?",
                "This will release your slot hold and cancel the booking.",
                [
                  { text: "Wait", style: "cancel" },
                  {
                    text: "Release Slot",
                    style: "destructive",
                    onPress: handleReleaseAndFail,
                  },
                ]
              )
            }
          >
            I haven't paid / Cancel
          </Button>
        </View>
      )}

      {phase === PHASE.FAILED && (
        <View style={styles.overlay}>
          <MaterialCommunityIcons name="close-circle-outline" size={56} color="#F44336" />
          <Text style={[styles.overlayText, { color: "#F44336" }]}>Payment Failed</Text>
          <Text style={styles.overlaySubtext}>Your slot has been released.</Text>
          <Button
            mode="contained"
            buttonColor={USER_COLOR}
            style={styles.backHomeBtn}
            icon="home"
            onPress={() => navigation.reset({ index: 0, routes: [{ name: "UserTabs" }] })}
          >
            Back to Home
          </Button>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  timerStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  timerText: { color: "#fff", fontWeight: "bold", fontSize: 13 },
  webview: { flex: 1 },
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 32,
  },
  overlayText: { fontSize: 18, fontWeight: "600", color: "#333", textAlign: "center" },
  overlaySubtext: { fontSize: 14, color: "#666", textAlign: "center", lineHeight: 20 },
  cancelVerifyBtn: { marginTop: 8, borderColor: "#F44336" },
  backHomeBtn: { marginTop: 16, borderRadius: 10, minWidth: 180 },

  // Coupon step styles
  couponScroll: { flexGrow: 1, justifyContent: "center", padding: 20 },
  couponCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  couponHeading: { fontSize: 18, fontWeight: "700", color: "#1E293B", textAlign: "center" },
  couponSub: { fontSize: 13, color: "#94A3B8", textAlign: "center", lineHeight: 18 },
  couponInputRow: { flexDirection: "row", alignItems: "center", gap: 8, width: "100%" },
  couponInput: { flex: 1, backgroundColor: "#fff" },
  couponApplyBtn: { borderRadius: 8 },
  couponAppliedRow: {
    flexDirection: "row", alignItems: "center",
    gap: 10, width: "100%",
    backgroundColor: USER_COLOR + "12",
    padding: 12, borderRadius: 10,
  },
  couponAppliedCode: { fontSize: 14, fontWeight: "700", color: USER_COLOR },
  couponAppliedSaving: { fontSize: 12, color: "#64748B", marginTop: 2 },
  couponRemove: { fontSize: 13, color: "#F44336", fontWeight: "600" },
  couponError: { fontSize: 13, color: "#F44336", alignSelf: "flex-start" },
  couponSummary: {
    width: "100%", backgroundColor: "#F8FAFC",
    borderRadius: 10, padding: 14, gap: 8,
  },
  couponSummaryRow: { flexDirection: "row", justifyContent: "space-between" },
  couponSummaryLabel: { fontSize: 14, color: "#64748B" },
  couponSummaryValue: { fontSize: 14, color: "#1E293B" },
  couponActions: { flexDirection: "row", gap: 10, width: "100%", marginTop: 4 },
  couponBtn: { flex: 1, borderRadius: 10 },
});
