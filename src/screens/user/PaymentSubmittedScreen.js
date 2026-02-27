import React from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { Text, Surface, Button } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";

const USER_COLOR = "#4CAF50";

export default function PaymentSubmittedScreen({ navigation, route }) {
  const { bookingId, amount, turfName, transactionId } = route.params || {};

  const handleViewBookings = () => {
    navigation.reset({
      index: 0,
      routes: [
        { name: "UserTabs", state: { routes: [{ name: "Bookings" }] } },
      ],
    });
  };

  const handleGoHome = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: "UserTabs" }],
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Success Icon */}
        <View style={styles.iconContainer}>
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons
              name="check-circle"
              size={80}
              color={USER_COLOR}
            />
          </View>
        </View>

        {/* Success Message */}
        <Text variant="headlineSmall" style={styles.title}>
          Payment Submitted!
        </Text>
        <Text variant="bodyLarge" style={styles.subtitle}>
          Your payment proof has been submitted for verification
        </Text>

        {/* Booking Summary */}
        <Surface style={styles.summaryCard} elevation={1}>
          <View style={styles.summaryHeader}>
            <MaterialCommunityIcons
              name="soccer-field"
              size={24}
              color={USER_COLOR}
            />
            <Text variant="titleMedium" style={styles.turfName}>
              {turfName}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.summaryRow}>
            <Text variant="bodyMedium" style={styles.summaryLabel}>
              Amount Paid
            </Text>
            <Text variant="titleMedium" style={styles.summaryAmount}>
              ₹{amount?.toLocaleString()}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text variant="bodyMedium" style={styles.summaryLabel}>
              Transaction ID
            </Text>
            <Text variant="bodyMedium" style={styles.summaryValue}>
              {transactionId}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text variant="bodyMedium" style={styles.summaryLabel}>
              Status
            </Text>
            <View style={styles.statusBadge}>
              <MaterialCommunityIcons
                name="clock-outline"
                size={14}
                color="#FF9800"
              />
              <Text variant="labelMedium" style={styles.statusText}>
                Pending Verification
              </Text>
            </View>
          </View>
        </Surface>

        {/* What Happens Next */}
        <Surface style={styles.infoCard} elevation={1}>
          <Text variant="titleSmall" style={styles.infoTitle}>
            What happens next?
          </Text>

          <View style={styles.stepRow}>
            <View style={styles.stepNumber}>
              <Text variant="labelMedium" style={styles.stepNumberText}>
                1
              </Text>
            </View>
            <View style={styles.stepContent}>
              <Text variant="bodyMedium" style={styles.stepTitle}>
                Manager Verifies Payment
              </Text>
              <Text variant="bodySmall" style={styles.stepDescription}>
                The turf manager will verify your payment details
              </Text>
            </View>
          </View>

          <View style={styles.stepConnector} />

          <View style={styles.stepRow}>
            <View style={styles.stepNumber}>
              <Text variant="labelMedium" style={styles.stepNumberText}>
                2
              </Text>
            </View>
            <View style={styles.stepContent}>
              <Text variant="bodyMedium" style={styles.stepTitle}>
                You Get Notified
              </Text>
              <Text variant="bodySmall" style={styles.stepDescription}>
                We'll send you a notification once verified
              </Text>
            </View>
          </View>

          <View style={styles.stepConnector} />

          <View style={styles.stepRow}>
            <View style={styles.stepNumber}>
              <Text variant="labelMedium" style={styles.stepNumberText}>
                3
              </Text>
            </View>
            <View style={styles.stepContent}>
              <Text variant="bodyMedium" style={styles.stepTitle}>
                Booking Confirmed
              </Text>
              <Text variant="bodySmall" style={styles.stepDescription}>
                Your booking will be confirmed after verification
              </Text>
            </View>
          </View>
        </Surface>

        {/* Time Estimate */}
        <View style={styles.estimateRow}>
          <MaterialCommunityIcons name="clock-fast" size={20} color="#666" />
          <Text variant="bodySmall" style={styles.estimateText}>
            Usually verified within 30 minutes
          </Text>
        </View>

        {/* Action Buttons */}
        <Button
          mode="contained"
          onPress={handleViewBookings}
          style={styles.primaryButton}
          contentStyle={styles.buttonContent}
          buttonColor={USER_COLOR}
          icon="calendar-check"
        >
          View My Bookings
        </Button>

        <Button
          mode="outlined"
          onPress={handleGoHome}
          style={styles.secondaryButton}
          contentStyle={styles.buttonContent}
          textColor="#666"
          icon="home"
        >
          Back to Home
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
  scrollContent: {
    padding: 24,
    alignItems: "center",
  },
  iconContainer: {
    marginTop: 24,
    marginBottom: 24,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#E8F5E9",
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontWeight: "bold",
    color: "#333",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    color: "#666",
    textAlign: "center",
    marginBottom: 32,
  },
  summaryCard: {
    width: "100%",
    padding: 20,
    borderRadius: 16,
    backgroundColor: "#fff",
    marginBottom: 24,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  turfName: {
    fontWeight: "600",
    color: "#333",
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: "#f0f0f0",
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  summaryLabel: {
    color: "#666",
  },
  summaryAmount: {
    fontWeight: "bold",
    color: USER_COLOR,
  },
  summaryValue: {
    color: "#333",
    fontWeight: "500",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF3E0",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    color: "#FF9800",
  },
  infoCard: {
    width: "100%",
    padding: 20,
    borderRadius: 16,
    backgroundColor: "#fff",
    marginBottom: 24,
  },
  infoTitle: {
    fontWeight: "600",
    color: "#333",
    marginBottom: 20,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: USER_COLOR,
    justifyContent: "center",
    alignItems: "center",
  },
  stepNumberText: {
    color: "#fff",
    fontWeight: "bold",
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontWeight: "500",
    color: "#333",
    marginBottom: 2,
  },
  stepDescription: {
    color: "#666",
  },
  stepConnector: {
    width: 2,
    height: 20,
    backgroundColor: "#E8F5E9",
    marginLeft: 13,
    marginVertical: 4,
  },
  estimateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 32,
  },
  estimateText: {
    color: "#666",
  },
  primaryButton: {
    width: "100%",
    borderRadius: 12,
    marginBottom: 12,
  },
  secondaryButton: {
    width: "100%",
    borderRadius: 12,
    borderColor: "#ddd",
  },
  buttonContent: {
    paddingVertical: 8,
  },
});
