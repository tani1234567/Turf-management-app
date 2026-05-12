import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  BackHandler,
  Linking,
  StyleSheet,
  View,
} from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import firestore from "@react-native-firebase/firestore";
import { useCashfreePayment } from "../../hooks/useCashfreePayment";
import { releaseSlotLock } from "../../services/firebase/payments";

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
  } = route.params || {};

  const [phase, setPhase] = useState(PHASE.INIT);
  const [paymentSessionId, setPaymentSessionId] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(600);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const unsubscribeRef = useRef(null);
  const timerRef = useRef(null);
  const phaseRef = useRef(PHASE.INIT);
  const orderIdRef = useRef(null); // stores orderId after order creation

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
  }, []);

  // ── Firestore listener — activated after checkout ────────────────────────────
  const startBookingListener = useCallback(() => {
    unsubscribeRef.current = firestore()
      .collection("bookings")
      .doc(bookingId)
      .onSnapshot((snap) => {
        if (!snap.exists) return;
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

  // ── Called when Cashfree redirects to RETURN_URL ─────────────────────────────
  const handleCheckoutReturn = useCallback(async () => {
    if (phaseRef.current === PHASE.VERIFYING || phaseRef.current === PHASE.SUCCESS) return;

    setPhase(PHASE.VERIFYING);
    startBookingListener(); // listen for webhook-driven update

    // Also actively verify — don't wait for webhook alone
    try {
      const orderId = orderIdRef.current;
      if (!orderId) return;

      const result = await verifyOrder({ orderId, bookingId });

      // If Cashfree says PAID, Firestore listener will fire (we updated it in the CF).
      // If not PAID yet, webhook will eventually arrive.
      if (result && result.status !== "PAID") {
        console.log("verifyCashfreeOrder: status =", result.status, "— waiting for webhook");
      }
    } catch (err) {
      // Verification failed — webhook is still our fallback
      console.warn("verifyCashfreeOrder error:", err.message);
    }
  }, [bookingId, startBookingListener, verifyOrder]);

  // ── Create order on mount ────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const order = await createOrder({ bookingId, amount, customerPhone, customerName });
        orderIdRef.current = order.orderId;
        setPaymentSessionId(order.paymentSessionId);
        setPhase(PHASE.CHECKOUT);
      } catch (err) {
        Alert.alert("Payment Error", err.message, [
          { text: "Go Back", onPress: () => navigation.goBack() },
        ]);
      }
    };
    init();
    return cleanup;
  }, []);

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
        </View>
      )}

      {phase === PHASE.FAILED && (
        <View style={styles.overlay}>
          <MaterialCommunityIcons name="close-circle-outline" size={56} color="#F44336" />
          <Text style={[styles.overlayText, { color: "#F44336" }]}>Payment Failed</Text>
          <Text style={styles.overlaySubtext}>Your slot has been released.</Text>
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
});
