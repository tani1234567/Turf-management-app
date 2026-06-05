import React, { useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Animated,
  Easing,
  Share,
  ScrollView,
} from "react-native";
import {
  Text,
  Surface,
  Button,
  Divider,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";

const USER_COLOR = "#10B981";
const EMERALD_PALE = "#D1FAE5";

export default function BookingSuccessScreen({ navigation, route }) {
  const {
    bookingId,
    booking,
    turf,
    ground,
    date,
    startTime,
    endTime,
  } = route.params || {};

  // Animations
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    // Animate success checkmark
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 3,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [scaleAnim, fadeAnim, slideAnim]);

  const handleShare = async () => {
    try {
      const message = `I just booked ${ground?.name || "a ground"} at ${turf?.name || "the turf"} for ${date?.weekday}, ${date?.day} ${date?.month} from ${startTime?.label} to ${endTime?.label}. See you there!`;

      await Share.share({
        message,
        title: "Booking Confirmed!",
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const handleViewBookings = () => {
    navigation.reset({
      index: 0,
      routes: [
        {
          name: "UserTabs",
          state: {
            index: 2, // Bookings tab
            routes: [
              { name: "Home" },
              { name: "Search" },
              { name: "Bookings" },
              { name: "ChatList" },
              { name: "Profile" },
            ],
          },
        },
      ],
    });
  };

  const handleBackToHome = () => {
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
        bounces={false}
      >
      {/* Success Animation */}
      <View style={styles.successContainer}>
        <Animated.View
          style={[
            styles.successCircle,
            { transform: [{ scale: scaleAnim }] },
          ]}
        >
          <MaterialCommunityIcons name="check" size={64} color="#fff" />
        </Animated.View>

        <Animated.View
          style={[
            styles.textContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Text variant="headlineSmall" style={styles.successTitle}>
            Booking Confirmed!
          </Text>
          <Text variant="bodyMedium" style={styles.successSubtitle}>
            Your booking has been successfully created
          </Text>
        </Animated.View>
      </View>

      {/* Booking Details Card */}
      <Animated.View
        style={[
          styles.cardContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <Surface style={styles.card} elevation={2}>
          {/* Booking ID */}
          <View style={styles.bookingIdContainer}>
            <Text variant="bodySmall" style={styles.bookingIdLabel}>
              Booking ID
            </Text>
            <Text variant="titleMedium" style={styles.bookingIdValue}>
              #{bookingId?.slice(-8).toUpperCase() || "N/A"}
            </Text>
          </View>

          <Divider style={styles.divider} />

          {/* Venue */}
          <View style={styles.detailRow}>
            <MaterialCommunityIcons name="map-marker" size={20} color={USER_COLOR} />
            <View style={styles.detailContent}>
              <Text variant="bodySmall" style={styles.detailLabel}>Venue</Text>
              <Text variant="bodyMedium" style={styles.detailValue}>
                {turf?.name || "Turf"} - {ground?.name || "Ground"}
              </Text>
            </View>
          </View>

          {/* Date & Time */}
          <View style={styles.detailRow}>
            <MaterialCommunityIcons name="calendar-clock" size={20} color={USER_COLOR} />
            <View style={styles.detailContent}>
              <Text variant="bodySmall" style={styles.detailLabel}>Date & Time</Text>
              <Text variant="bodyMedium" style={styles.detailValue}>
                {date?.weekday}, {date?.day} {date?.month}
              </Text>
              <Text variant="bodyMedium" style={styles.detailValue}>
                {startTime?.label} - {endTime?.label}
              </Text>
            </View>
          </View>

          {/* Status */}
          <View style={styles.statusRow}>
            <View style={styles.statusBadge}>
              <MaterialCommunityIcons name="clock-outline" size={16} color="#FF9800" />
              <Text style={styles.statusText}>Pending Confirmation</Text>
            </View>
            <Text variant="bodySmall" style={styles.statusNote}>
              The venue will confirm your booking shortly
            </Text>
          </View>

          <Divider style={styles.divider} />

          {/* Total */}
          <View style={styles.totalRow}>
            <Text variant="titleMedium" style={styles.totalLabel}>Total Paid</Text>
            <Text variant="headlineSmall" style={styles.totalValue}>
              ₹{booking?.totalAmount || booking?.totalPrice || booking?.payment?.slotAmount || 0}
            </Text>
          </View>
        </Surface>
      </Animated.View>

      {/* Actions */}
      <Animated.View
        style={[
          styles.actionsContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <Button
          mode="contained"
          onPress={handleViewBookings}
          buttonColor={USER_COLOR}
          style={styles.primaryButton}
          icon="calendar-check"
        >
          View My Bookings
        </Button>

        <View style={styles.secondaryActions}>
          <Button
            mode="outlined"
            onPress={handleShare}
            style={styles.secondaryButton}
            icon="share-variant"
          >
            Share
          </Button>
          <Button
            mode="outlined"
            onPress={handleBackToHome}
            style={styles.secondaryButton}
            icon="home"
          >
            Home
          </Button>
        </View>
      </Animated.View>

      {/* Footer Note */}
      <Animated.View
        style={[
          styles.footerNote,
          { opacity: fadeAnim },
        ]}
      >
        <MaterialCommunityIcons name="information-outline" size={16} color="#999" />
        <Text variant="bodySmall" style={styles.footerText}>
          A confirmation message will be sent to your registered email and phone number
        </Text>
      </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },

  // Success Animation
  successContainer: {
    alignItems: "center",
    marginTop: 40,
    marginBottom: 32,
  },
  successCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: USER_COLOR,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: USER_COLOR,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  textContainer: {
    alignItems: "center",
    marginTop: 24,
  },
  successTitle: {
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  successSubtitle: {
    color: "#666",
    textAlign: "center",
  },

  // Card
  cardContainer: {
    marginBottom: 24,
  },
  card: {
    borderRadius: 16,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  bookingIdContainer: {
    alignItems: "center",
    padding: 16,
    backgroundColor: USER_COLOR + "10",
  },
  bookingIdLabel: {
    color: "#666",
    marginBottom: 4,
  },
  bookingIdValue: {
    fontWeight: "bold",
    color: USER_COLOR,
    letterSpacing: 1,
  },
  divider: {
    backgroundColor: "#eee",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f5f5f5",
  },
  detailContent: {
    marginLeft: 12,
    flex: 1,
  },
  detailLabel: {
    color: "#999",
    marginBottom: 4,
  },
  detailValue: {
    color: "#333",
    fontWeight: "500",
  },
  statusRow: {
    padding: 16,
    alignItems: "center",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF3E0",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 8,
  },
  statusText: {
    marginLeft: 6,
    color: "#FF9800",
    fontWeight: "600",
    fontSize: 13,
  },
  statusNote: {
    color: "#999",
    textAlign: "center",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#f9f9f9",
  },
  totalLabel: {
    fontWeight: "600",
    color: "#333",
  },
  totalValue: {
    fontWeight: "bold",
    color: USER_COLOR,
  },

  // Actions
  actionsContainer: {
    marginBottom: 16,
  },
  primaryButton: {
    borderRadius: 12,
    marginBottom: 12,
  },
  secondaryActions: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  secondaryButton: {
    flex: 1,
    marginHorizontal: 4,
    borderRadius: 12,
    borderColor: "#ddd",
  },

  // Footer
  footerNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  footerText: {
    color: "#999",
    marginLeft: 8,
    textAlign: "center",
    flex: 1,
  },
});
