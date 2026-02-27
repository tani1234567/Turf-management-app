import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  BackHandler,
  Animated,
} from "react-native";
import { Text, Surface, Button, ActivityIndicator } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { openUpiApp, getUpiErrorMessage } from "../../utils/upiUtils";
import { releaseSlotLock } from "../../services/firebase/payments";

const USER_COLOR = "#4CAF50";
const TIMER_NORMAL_COLOR = "#FF9800";
const TIMER_URGENT_COLOR = "#F44336";

export default function UpiPaymentScreen({ navigation, route }) {
  const {
    bookingId,
    amount,
    upiId,
    upiHolderName,
    qrCodeUrl,
    turfName,
    lockExpiry,
  } = route.params || {};

  const [isOpening, setIsOpening] = useState(false);
  const [copiedField, setCopiedField] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Countdown Timer
  useEffect(() => {
    const calculateRemaining = () => {
      if (!lockExpiry) return 600; // Default 10 minutes if no expiry provided
      const now = new Date().getTime();
      // Handle both Firestore Timestamp and regular Date/number
      const expiryTime =
        typeof lockExpiry === "object" && lockExpiry.toDate
          ? lockExpiry.toDate().getTime()
          : typeof lockExpiry === "number"
          ? lockExpiry
          : new Date(lockExpiry).getTime();
      const remaining = Math.max(0, Math.floor((expiryTime - now) / 1000));
      return remaining;
    };

    setTimeRemaining(calculateRemaining());

    const interval = setInterval(() => {
      const remaining = calculateRemaining();
      setTimeRemaining(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        Alert.alert(
          "Time Expired",
          "Your slot hold has expired. Please try booking again.",
          [{ text: "OK", onPress: () => navigation.navigate("Home") }]
        );
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lockExpiry]);

  // Pulse animation when timer is urgent (<60s)
  useEffect(() => {
    if (timeRemaining > 0 && timeRemaining < 60) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.6,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [timeRemaining < 60]);

  // Format time as MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  // Handle Back Press
  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        Alert.alert(
          "Cancel Payment?",
          "If you leave, your slot hold will be released and others can book it.",
          [
            { text: "Stay", style: "cancel" },
            {
              text: "Leave",
              style: "destructive",
              onPress: () => {
                releaseSlotLock(bookingId);
                navigation.goBack();
              },
            },
          ]
        );
        return true;
      }
    );

    return () => backHandler.remove();
  }, [bookingId]);

  const handleBackPress = () => {
    Alert.alert(
      "Cancel Payment?",
      "If you leave, your slot hold will be released and others can book it.",
      [
        { text: "Stay", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: () => {
            releaseSlotLock(bookingId);
            navigation.goBack();
          },
        },
      ]
    );
  };

  const handlePayViaUpi = async () => {
    setIsOpening(true);

    const result = await openUpiApp({
      upiId,
      name: upiHolderName || turfName,
      amount,
      transactionNote: `Advance payment for ${turfName}`,
      bookingId,
    });

    setIsOpening(false);

    if (result.success) {
      // Show confirmation dialog after a delay
      setTimeout(() => {
        Alert.alert(
          "Payment Completed?",
          "Did you complete the payment in your UPI app?",
          [
            {
              text: "No, Try Again",
              style: "cancel",
            },
            {
              text: "Yes, I Paid",
              onPress: () => handlePaymentConfirmation(),
            },
          ]
        );
      }, 1000);
    } else {
      Alert.alert("Error", getUpiErrorMessage(result.error));
    }
  };

  const handlePaymentConfirmation = () => {
    navigation.navigate("PaymentConfirmation", {
      bookingId,
      amount,
      upiId,
      upiHolderName,
      turfName,
      paymentMethod: "upi",
    });
  };

  const handleCopy = async (text, field) => {
    await Clipboard.setStringAsync(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const UpiAppButton = ({ name, iconName, color }) => (
    <TouchableOpacity
      style={styles.appButton}
      onPress={handlePayViaUpi}
      activeOpacity={0.7}
    >
      <View style={[styles.appIconContainer, { backgroundColor: `${color}15` }]}>
        <MaterialCommunityIcons name={iconName} size={28} color={color} />
      </View>
      <Text variant="labelSmall" style={styles.appName}>
        {name}
      </Text>
    </TouchableOpacity>
  );

  const isUrgent = timeRemaining > 0 && timeRemaining < 60;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBackPress}
          style={styles.backButton}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <Text variant="titleLarge" style={styles.headerTitle}>
          Pay via UPI
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Countdown Timer Banner */}
        {timeRemaining > 0 && (
          <Animated.View
            style={[
              styles.timerBanner,
              {
                backgroundColor: isUrgent
                  ? TIMER_URGENT_COLOR
                  : TIMER_NORMAL_COLOR,
              },
              isUrgent && { opacity: pulseAnim },
            ]}
          >
            <MaterialCommunityIcons
              name="clock-outline"
              size={20}
              color="#fff"
            />
            <View style={styles.timerTextContainer}>
              <Text style={styles.timerText}>
                Complete payment in {formatTime(timeRemaining)}
              </Text>
              <Text style={styles.timerSubtext}>
                Slot will be released after timeout
              </Text>
            </View>
          </Animated.View>
        )}

        {/* Amount Card */}
        <Surface style={styles.amountCard} elevation={2}>
          <Text variant="bodyLarge" style={styles.payText}>
            Pay
          </Text>
          <Text variant="displaySmall" style={styles.amount}>
            ₹{amount?.toLocaleString()}
          </Text>
          <Text variant="bodyMedium" style={styles.turfName}>
            to {turfName}
          </Text>
        </Surface>

        {/* Primary UPI Button */}
        <Button
          mode="contained"
          onPress={handlePayViaUpi}
          style={styles.primaryButton}
          contentStyle={styles.primaryButtonContent}
          buttonColor={USER_COLOR}
          loading={isOpening}
          disabled={isOpening}
          icon="cellphone"
        >
          Pay ₹{amount?.toLocaleString()} via UPI
        </Button>
        <Text variant="bodySmall" style={styles.primaryHint}>
          Opens your default UPI app
        </Text>

        {/* App Buttons */}
        <Text variant="bodyMedium" style={styles.orText}>
          Or pay using
        </Text>
        <View style={styles.appButtonsRow}>
          <UpiAppButton name="GPay" iconName="google" color="#4285F4" />
          <UpiAppButton name="PhonePe" iconName="alpha-p-circle" color="#5F259F" />
          <UpiAppButton name="Paytm" iconName="wallet" color="#00BAF2" />
        </View>

        {/* QR Code Section */}
        <View style={styles.dividerContainer}>
          <View style={styles.dividerLine} />
          <Text variant="bodySmall" style={styles.dividerText}>
            OR SCAN QR
          </Text>
          <View style={styles.dividerLine} />
        </View>

        {qrCodeUrl ? (
          <Surface style={styles.qrContainer} elevation={1}>
            <Image
              source={{ uri: qrCodeUrl }}
              style={styles.qrImage}
              resizeMode="contain"
            />
            <Text variant="bodySmall" style={styles.qrHint}>
              Scan with any UPI app
            </Text>
          </Surface>
        ) : (
          <Surface style={styles.qrContainer} elevation={1}>
            <View style={styles.qrPlaceholder}>
              <MaterialCommunityIcons name="qrcode" size={80} color="#ccc" />
              <Text variant="bodySmall" style={styles.qrUnavailable}>
                QR code not available
              </Text>
            </View>
          </Surface>
        )}

        {/* Manual Details */}
        <View style={styles.manualSection}>
          <Text variant="titleSmall" style={styles.manualTitle}>
            Manual Details
          </Text>

          <Surface style={styles.detailRow} elevation={1}>
            <View style={styles.detailInfo}>
              <Text variant="bodySmall" style={styles.detailLabel}>
                UPI ID
              </Text>
              <Text variant="bodyLarge" style={styles.detailValue}>
                {upiId}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.copyButton}
              onPress={() => handleCopy(upiId, "upi")}
            >
              <MaterialCommunityIcons
                name={copiedField === "upi" ? "check" : "content-copy"}
                size={20}
                color={copiedField === "upi" ? USER_COLOR : "#666"}
              />
              <Text
                variant="labelSmall"
                style={[
                  styles.copyText,
                  copiedField === "upi" && { color: USER_COLOR },
                ]}
              >
                {copiedField === "upi" ? "Copied" : "Copy"}
              </Text>
            </TouchableOpacity>
          </Surface>

          <Surface style={styles.detailRow} elevation={1}>
            <View style={styles.detailInfo}>
              <Text variant="bodySmall" style={styles.detailLabel}>
                Amount
              </Text>
              <Text variant="bodyLarge" style={styles.detailValue}>
                ₹{amount?.toLocaleString()}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.copyButton}
              onPress={() => handleCopy(amount?.toString(), "amount")}
            >
              <MaterialCommunityIcons
                name={copiedField === "amount" ? "check" : "content-copy"}
                size={20}
                color={copiedField === "amount" ? USER_COLOR : "#666"}
              />
              <Text
                variant="labelSmall"
                style={[
                  styles.copyText,
                  copiedField === "amount" && { color: USER_COLOR },
                ]}
              >
                {copiedField === "amount" ? "Copied" : "Copy"}
              </Text>
            </TouchableOpacity>
          </Surface>
        </View>

        {/* Confirmation Button */}
        <Button
          mode="contained"
          onPress={handlePaymentConfirmation}
          style={styles.confirmButton}
          contentStyle={styles.confirmButtonContent}
          buttonColor="#333"
          icon="check-circle"
        >
          I've Made the Payment
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontWeight: "bold",
    color: "#333",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  // Timer Banner
  timerBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
    gap: 12,
  },
  timerTextContainer: {
    flex: 1,
  },
  timerText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  timerSubtext: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    marginTop: 2,
  },
  // Amount Card
  amountCard: {
    padding: 24,
    borderRadius: 16,
    backgroundColor: "#fff",
    alignItems: "center",
    marginBottom: 24,
  },
  payText: {
    color: "#666",
  },
  amount: {
    fontWeight: "bold",
    color: USER_COLOR,
    marginVertical: 8,
  },
  turfName: {
    color: "#333",
  },
  primaryButton: {
    borderRadius: 12,
  },
  primaryButtonContent: {
    paddingVertical: 8,
  },
  primaryHint: {
    textAlign: "center",
    color: "#666",
    marginTop: 8,
    marginBottom: 24,
  },
  orText: {
    textAlign: "center",
    color: "#666",
    marginBottom: 16,
  },
  appButtonsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 24,
    marginBottom: 24,
  },
  appButton: {
    alignItems: "center",
  },
  appIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  appName: {
    color: "#333",
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#ddd",
  },
  dividerText: {
    color: "#999",
    marginHorizontal: 16,
  },
  qrContainer: {
    padding: 24,
    borderRadius: 16,
    backgroundColor: "#fff",
    alignItems: "center",
    marginBottom: 24,
  },
  qrImage: {
    width: 200,
    height: 200,
    marginBottom: 12,
  },
  qrHint: {
    color: "#666",
  },
  qrPlaceholder: {
    alignItems: "center",
    padding: 24,
  },
  qrUnavailable: {
    color: "#999",
    marginTop: 8,
  },
  manualSection: {
    marginBottom: 24,
  },
  manualTitle: {
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#fff",
    marginBottom: 8,
  },
  detailInfo: {
    flex: 1,
  },
  detailLabel: {
    color: "#666",
    marginBottom: 4,
  },
  detailValue: {
    fontWeight: "600",
    color: "#333",
  },
  copyButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#f5f5f5",
    gap: 4,
  },
  copyText: {
    color: "#666",
  },
  confirmButton: {
    borderRadius: 12,
  },
  confirmButtonContent: {
    paddingVertical: 8,
  },
});
