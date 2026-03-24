import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
  RefreshControl,
} from "react-native";
import { Text, Surface, Button, Banner } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSelector } from "react-redux";
import { selectAssignedTurfId, selectUser } from "../../store/slices/authSlice";
import { getBookingsForDateByCaretaker, getAcademySessionsForDate, updateDocument } from "../../services/firebase/firestore";
import ExtensionModal from "../../components/caretaker/ExtensionModal";

const CARETAKER_ORANGE = "#F97316";
const PALE_ORANGE      = "#FFF7ED";
const NAVY_ORANGE      = "#7C2D12";
const SUCCESS_GREEN    = "#22C55E";
const MANAGER_BLUE     = "#3B82F6";
const DANGER_RED       = "#EF4444";

// Status color mapping
const STATUS_COLORS = {
  confirmed:   MANAGER_BLUE,
  in_progress: SUCCESS_GREEN,
  completed:   "#9CA3AF",
  no_show:     DANGER_RED,
  academy:     CARETAKER_ORANGE,
};

export default function CaretakerCalendarScreen({ navigation }) {
  const assignedTurfId = useSelector(selectAssignedTurfId);
  const user = useSelector(selectUser);

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [extensionModalVisible, setExtensionModalVisible] = useState(false);
  const [selectedBookingForExtension, setSelectedBookingForExtension] = useState(null);
  const today = new Date();

  const formatDate = (date) => {
    return date.toLocaleDateString("en-IN", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatDateString = (date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };

  const isToday = (date) => {
    return formatDateString(date) === formatDateString(today);
  };

  const isSameDay = (date1, date2) => {
    return formatDateString(date1) === formatDateString(date2);
  };

  // Generate week days
  const getWeekDays = () => {
    const days = [];
    const startOfWeek = new Date(selectedDate);
    const dayOfWeek = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek);

    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      days.push({
        day: date.toLocaleDateString("en-IN", { weekday: "short" }),
        date: date.getDate(),
        fullDate: date,
        isToday: isToday(date),
        isSelected: isSameDay(date, selectedDate),
      });
    }
    return days;
  };

  const weekDays = getWeekDays();

  const fetchBookings = async (date) => {
    if (!assignedTurfId) return;

    setLoading(true);
    try {
      const dateStr = formatDateString(date);
      const result = await getBookingsForDateByCaretaker(
        assignedTurfId,
        dateStr
      );

      let allBookings = [];
      if (result.success) {
        allBookings = result.bookings || [];
      } else {
        console.error("Error fetching bookings:", result.message);
      }

      // Also fetch academy sessions and merge them
      const academyResult = await getAcademySessionsForDate(assignedTurfId, dateStr);
      if (academyResult.success && academyResult.sessions?.length > 0) {
        const academySessions = academyResult.sessions.map((s) => ({
          ...s,
          bookingType: "academy",
          userName: s.academyName || "Academy Session",
          groundName: s.groundName,
          status: "academy",
        }));
        allBookings = [...allBookings, ...academySessions];
      }

      // Sort by startTime
      allBookings.sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));
      setBookings(allBookings);
    } catch (error) {
      console.error("Error fetching bookings:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings(selectedDate);
  }, [selectedDate, assignedTurfId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchBookings(selectedDate);
    setRefreshing(false);
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
  };

  const handlePrevWeek = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 7);
    setSelectedDate(newDate);
  };

  const handleNextWeek = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 7);
    setSelectedDate(newDate);
  };

  const handleCallCustomer = (phone) => {
    if (phone && phone !== "🔒 Hidden") {
      Linking.openURL(`tel:${phone}`);
    }
  };

  const handleMarkAttendance = (booking) => {
    Alert.alert(
      "Mark Attendance",
      `Mark attendance for ${booking.userName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Present",
          onPress: () => {
            Alert.alert("Success", "Attendance marked as present");
          },
        },
        {
          text: "No-Show",
          style: "destructive",
          onPress: () => {
            Alert.alert("Success", "Marked as no-show");
          },
        },
      ]
    );
  };

  const handleCollectPayment = (booking) => {
    navigation.navigate("PaymentCollection", { booking });
  };

  const handleCancelBooking = (booking) => {
    Alert.alert(
      "Cancel Booking",
      `Cancel booking for ${booking.userName}?\nThis cannot be undone.`,
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            try {
              await updateDocument("bookings", booking.id, {
                status: "cancelled",
                cancelledAt: new Date().toISOString(),
                cancelledBy: user?.userId,
                cancelledByName: user?.name || "Caretaker",
                cancelledByRole: "caretaker",
                cancellationReason: "Cancelled by caretaker on customer request",
              });
              fetchBookings(selectedDate);
            } catch (e) {
              Alert.alert("Error", "Failed to cancel booking. Please try again.");
            }
          },
        },
      ]
    );
  };

  const handleExtendTime = (booking) => {
    setSelectedBookingForExtension(booking);
    setExtensionModalVisible(true);
  };

  const handleExtensionSuccess = () => {
    fetchBookings(selectedDate);
  };

  const getStatusColor = (booking) => {
    if (booking.bookingType === "academy") {
      return STATUS_COLORS.academy;
    }
    return STATUS_COLORS[booking.status] || "#9CA3AF";
  };

  const getStatusLabel = (booking) => {
    if (booking.bookingType === "academy") {
      return "Academy";
    }
    switch (booking.status) {
      case "in_progress": return "In Progress";
      case "no_show":     return "No Show";
      default:
        return booking.status.charAt(0).toUpperCase() + booking.status.slice(1);
    }
  };

  const renderFullBookingCard = (booking) => {
    const isAcademy = booking.bookingType === "academy";
    const statusColor = getStatusColor(booking);

    return (
      <Surface
        key={booking.id}
        style={[styles.bookingCard, { borderLeftColor: statusColor }]}
        elevation={2}
      >
        {/* Header */}
        <View style={styles.bookingHeader}>
          <View style={styles.timeContainer}>
            <MaterialCommunityIcons name="clock-outline" size={18} color={statusColor} />
            <Text style={styles.timeText}>
              {booking.startTime} - {booking.endTime}
            </Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: `${statusColor}18` }]}>
            <Text style={[styles.statusPillText, { color: statusColor }]}>
              {getStatusLabel(booking)}
            </Text>
          </View>
        </View>

        {/* Customer/Academy Info */}
        {isAcademy ? (
          <View style={styles.infoSection}>
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="school" size={16} color="#9CA3AF" />
              <Text style={styles.infoText}>
                {booking.academyName || "Academy Session"}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.infoSection}>
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="account" size={16} color="#9CA3AF" />
              <Text style={styles.infoText}>
                {booking.userName || "Unknown User"}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="phone" size={16} color="#9CA3AF" />
              <Text style={styles.infoText}>
                {booking.userPhone || "N/A"}
              </Text>
              {booking.userPhone && (
                <TouchableOpacity
                  style={styles.callButton}
                  onPress={() => handleCallCustomer(booking.userPhone)}
                >
                  <MaterialCommunityIcons name="phone" size={14} color={SUCCESS_GREEN} />
                  <Text style={styles.callButtonText}>Call</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Booking Details */}
        <View style={styles.detailsSection}>
          <View style={styles.detailRow}>
            <MaterialCommunityIcons name="soccer" size={14} color="#9CA3AF" />
            <Text style={styles.detailText}>{booking.sport || "N/A"}</Text>
          </View>
          <View style={styles.detailRow}>
            <MaterialCommunityIcons name="map-marker" size={14} color="#9CA3AF" />
            <Text style={styles.detailText}>{booking.groundName || "N/A"}</Text>
          </View>
          <View style={styles.detailRow}>
            <MaterialCommunityIcons name="currency-inr" size={14} color="#9CA3AF" />
            <Text style={styles.detailText}>
              ₹{booking.totalAmount || booking.payment?.slotAmount || 0}
            </Text>
          </View>
        </View>

        {/* Action Buttons - Only for non-academy bookings */}
        {!isAcademy && booking.status !== "completed" && booking.status !== "no_show" && booking.status !== "cancelled" && (
          <View style={styles.actionsSection}>
            <Button
              mode="outlined"
              icon="check-circle"
              onPress={() => handleMarkAttendance(booking)}
              style={styles.actionButton}
              textColor={MANAGER_BLUE}
              compact
              labelStyle={{ fontFamily: "Ubuntu-Medium", fontSize: 12 }}
            >
              Attendance
            </Button>
            <Button
              mode="outlined"
              icon="cash"
              onPress={() => handleCollectPayment(booking)}
              style={[styles.actionButton, { borderColor: SUCCESS_GREEN }]}
              textColor={SUCCESS_GREEN}
              compact
              labelStyle={{ fontFamily: "Ubuntu-Medium", fontSize: 12 }}
            >
              Payment
            </Button>
            <Button
              mode="outlined"
              icon="clock-plus-outline"
              onPress={() => handleExtendTime(booking)}
              style={[styles.actionButton, { borderColor: CARETAKER_ORANGE }]}
              textColor={CARETAKER_ORANGE}
              compact
              labelStyle={{ fontFamily: "Ubuntu-Medium", fontSize: 12 }}
            >
              Extend
            </Button>
            {(booking.status === "confirmed" || booking.status === "pending") && (
              <Button
                mode="outlined"
                icon="close-circle-outline"
                onPress={() => handleCancelBooking(booking)}
                style={[styles.actionButton, { borderColor: DANGER_RED }]}
                textColor={DANGER_RED}
                compact
                labelStyle={{ fontFamily: "Ubuntu-Medium", fontSize: 12 }}
              >
                Cancel
              </Button>
            )}
          </View>
        )}
      </Surface>
    );
  };

  const renderLimitedBookingCard = (booking) => {
    const isAcademy = booking.bookingType === "academy";
    const statusColor = getStatusColor(booking);

    return (
      <Surface
        key={booking.id}
        style={[styles.bookingCard, { borderLeftColor: statusColor }]}
        elevation={2}
      >
        {/* Header - Time Hidden */}
        <View style={styles.bookingHeader}>
          <View style={styles.timeContainer}>
            <MaterialCommunityIcons name="lock" size={18} color="#9CA3AF" />
            <Text style={styles.hiddenText}>🔒 Hidden</Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: `${statusColor}18` }]}>
            <Text style={[styles.statusPillText, { color: statusColor }]}>
              {getStatusLabel(booking)}
            </Text>
          </View>
        </View>

        {/* Customer/Academy Info */}
        {isAcademy ? (
          <View style={styles.infoSection}>
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="school" size={16} color="#9CA3AF" />
              <Text style={styles.infoText}>
                {booking.academyName || "Academy Session"}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.infoSection}>
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="account" size={16} color="#9CA3AF" />
              <Text style={styles.infoText}>
                {booking.userName || "Unknown User"}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="lock" size={16} color="#9CA3AF" />
              <Text style={styles.hiddenText}>🔒 Hidden</Text>
            </View>
          </View>
        )}

        {/* Booking Details */}
        <View style={styles.detailsSection}>
          <View style={styles.detailRow}>
            <MaterialCommunityIcons name="soccer" size={14} color="#9CA3AF" />
            <Text style={styles.detailText}>{booking.sport || "N/A"}</Text>
          </View>
          <View style={styles.detailRow}>
            <MaterialCommunityIcons name="map-marker" size={14} color="#9CA3AF" />
            <Text style={styles.detailText}>{booking.groundName || "N/A"}</Text>
          </View>
          <View style={styles.detailRow}>
            <MaterialCommunityIcons name="currency-inr" size={14} color="#9CA3AF" />
            <Text style={styles.detailText}>
              ₹{booking.totalAmount || booking.payment?.slotAmount || 0}
            </Text>
          </View>
        </View>
      </Surface>
    );
  };

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const isTomorrow = (date) => formatDateString(date) === formatDateString(tomorrow);
  const showTodayBookings = isToday(selectedDate) || isTomorrow(selectedDate);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Schedule</Text>
        <Text style={styles.dateText}>{formatDate(selectedDate)}</Text>
      </View>

      {/* Week Navigation */}
      <View style={styles.weekNavigation}>
        <TouchableOpacity onPress={handlePrevWeek} style={styles.navButton}>
          <MaterialCommunityIcons name="chevron-left" size={24} color={CARETAKER_ORANGE} />
        </TouchableOpacity>

        <Surface style={styles.weekCard} elevation={1}>
          <View style={styles.weekRow}>
            {weekDays.map((day, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => handleDateSelect(day.fullDate)}
                style={[
                  styles.dayItem,
                  day.isSelected && styles.dayItemActive,
                ]}
              >
                <Text
                  style={[
                    styles.dayName,
                    day.isSelected && styles.dayNameActive,
                  ]}
                >
                  {day.day}
                </Text>
                <Text
                  style={[
                    styles.dayDate,
                    day.isSelected && styles.dayDateActive,
                  ]}
                >
                  {day.date}
                </Text>
                {day.isToday && !day.isSelected && (
                  <View style={styles.todayDot} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </Surface>

        <TouchableOpacity onPress={handleNextWeek} style={styles.navButton}>
          <MaterialCommunityIcons name="chevron-right" size={24} color={CARETAKER_ORANGE} />
        </TouchableOpacity>
      </View>

      {/* Future Date Info Banner */}
      {!showTodayBookings && (
        <Banner
          visible={true}
          icon="information"
          style={styles.infoBanner}
        >
          <Text style={styles.bannerText}>
            Phone numbers and exact timings are hidden for future bookings.
            They will be visible on the booking day.
          </Text>
        </Banner>
      )}

      {/* Bookings List */}
      <ScrollView
        style={styles.scheduleContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[CARETAKER_ORANGE]}
          />
        }
      >
        <Text style={styles.sectionTitle}>
          {showTodayBookings ? "Today's Bookings" : `Bookings for ${formatDate(selectedDate)}`}
        </Text>

        {loading ? (
          <View style={styles.emptyCard}>
            <MaterialCommunityIcons name="loading" size={48} color="#D1D5DB" />
            <Text style={styles.emptyText}>Loading bookings...</Text>
          </View>
        ) : bookings.length > 0 ? (
          bookings.map((booking) =>
            showTodayBookings
              ? renderFullBookingCard(booking)
              : renderLimitedBookingCard(booking)
          )
        ) : (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <MaterialCommunityIcons name="calendar-blank" size={36} color={CARETAKER_ORANGE} />
            </View>
            <Text style={styles.emptyTitle}>No bookings scheduled</Text>
            <Text style={styles.emptyText}>
              {showTodayBookings
                ? "You have no bookings for today"
                : "No bookings found for this date"}
            </Text>
          </View>
        )}
        <View style={{ height: 16 }} />
      </ScrollView>

      {/* Extension Modal */}
      <ExtensionModal
        visible={extensionModalVisible}
        onDismiss={() => setExtensionModalVisible(false)}
        booking={selectedBookingForExtension}
        onExtensionSuccess={handleExtensionSuccess}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFBEB",
  },
  header: {
    padding: 16,
    paddingBottom: 8,
  },
  title: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 24,
    color: NAVY_ORANGE,
  },
  dateText: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 13,
    color: "#6B7280",
    marginTop: 4,
  },
  weekNavigation: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  navButton: {
    padding: 8,
  },
  weekCard: {
    flex: 1,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "#fff",
    marginHorizontal: 8,
  },
  weekRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  dayItem: {
    alignItems: "center",
    padding: 8,
    borderRadius: 12,
    minWidth: 40,
    position: "relative",
  },
  dayItemActive: {
    backgroundColor: CARETAKER_ORANGE,
  },
  dayName: {
    fontFamily: "Ubuntu-Regular",
    color: "#6B7280",
    fontSize: 11,
  },
  dayNameActive: {
    color: "#fff",
  },
  dayDate: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 15,
    color: "#111827",
    marginTop: 4,
  },
  dayDateActive: {
    color: "#fff",
  },
  todayDot: {
    position: "absolute",
    bottom: 2,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: CARETAKER_ORANGE,
  },
  infoBanner: {
    backgroundColor: "#E3F2FD",
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
  },
  bannerText: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 12,
    color: "#1565C0",
  },
  scheduleContainer: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 15,
    color: NAVY_ORANGE,
    marginBottom: 12,
  },

  // Booking Cards
  bookingCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
  },
  bookingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  timeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  timeText: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 14,
    color: "#111827",
  },
  hiddenText: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 13,
    color: "#9CA3AF",
    marginLeft: 6,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
  },
  statusPillText: {
    fontFamily: "Ubuntu-Medium",
    fontSize: 11,
  },
  infoSection: {
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    gap: 6,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  infoText: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 14,
    flex: 1,
    color: "#374151",
  },
  callButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "#DCFCE7",
    borderRadius: 16,
    gap: 4,
  },
  callButtonText: {
    fontFamily: "Ubuntu-Medium",
    color: SUCCESS_GREEN,
    fontSize: 12,
  },
  detailsSection: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 10,
    gap: 10,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  detailText: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 12,
    color: "#6B7280",
  },
  actionsSection: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  actionButton: {
    flex: 1,
    minWidth: 90,
    borderRadius: 8,
  },

  // Empty state
  emptyCard: {
    padding: 32,
    borderRadius: 16,
    backgroundColor: "#fff",
    alignItems: "center",
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: PALE_ORANGE,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 15,
    color: "#374151",
    marginBottom: 4,
  },
  emptyText: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 13,
    color: "#9CA3AF",
    textAlign: "center",
  },
});
