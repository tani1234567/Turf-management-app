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
import { Text, Surface, Card, Button, Chip, Banner } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSelector } from "react-redux";
import { selectAssignedTurfId } from "../../store/slices/authSlice";
import { getBookingsForDateByCaretaker, getAcademySessionsForDate } from "../../services/firebase/firestore";
import ExtensionModal from "../../components/caretaker/ExtensionModal";

const CARETAKER_COLOR = "#FF9800";

// Status color mapping
const STATUS_COLORS = {
  confirmed: "#2196F3",
  in_progress: "#4CAF50",
  completed: "#9E9E9E",
  no_show: "#F44336",
  academy: "#FF9800",
};

export default function CaretakerCalendarScreen({ navigation }) {
  const assignedTurfId = useSelector(selectAssignedTurfId);

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
            // TODO: Implement mark attendance
            Alert.alert("Success", "Attendance marked as present");
          },
        },
        {
          text: "No-Show",
          style: "destructive",
          onPress: () => {
            // TODO: Implement no-show
            Alert.alert("Success", "Marked as no-show");
          },
        },
      ]
    );
  };

  const handleCollectPayment = (booking) => {
    navigation.navigate("PaymentCollection", { booking });
  };

  const handleExtendTime = (booking) => {
    setSelectedBookingForExtension(booking);
    setExtensionModalVisible(true);
  };

  const handleExtensionSuccess = () => {
    // Refresh bookings after successful extension
    fetchBookings(selectedDate);
  };

  const getStatusColor = (booking) => {
    if (booking.bookingType === "academy") {
      return STATUS_COLORS.academy;
    }
    return STATUS_COLORS[booking.status] || "#999999";
  };

  const getStatusLabel = (booking) => {
    if (booking.bookingType === "academy") {
      return "Academy";
    }
    switch (booking.status) {
      case "in_progress":
        return "In Progress";
      case "no_show":
        return "No Show";
      default:
        return booking.status.charAt(0).toUpperCase() + booking.status.slice(1);
    }
  };

  const renderFullBookingCard = (booking) => {
    const isAcademy = booking.bookingType === "academy";

    return (
      <Card key={booking.id} style={styles.bookingCard}>
        <Card.Content>
          {/* Header */}
          <View style={styles.bookingHeader}>
            <View style={styles.timeContainer}>
              <MaterialCommunityIcons
                name="clock-outline"
                size={20}
                color={getStatusColor(booking)}
              />
              <Text variant="titleMedium" style={styles.timeText}>
                {booking.startTime} - {booking.endTime}
              </Text>
            </View>
            <Chip
              style={[
                styles.statusChip,
                { backgroundColor: getStatusColor(booking) + "20" },
              ]}
              textStyle={[
                styles.statusChipText,
                { color: getStatusColor(booking) },
              ]}
            >
              {getStatusLabel(booking)}
            </Chip>
          </View>

          {/* Customer/Academy Info */}
          {isAcademy ? (
            <View style={styles.infoSection}>
              <View style={styles.infoRow}>
                <MaterialCommunityIcons
                  name="school"
                  size={18}
                  color="#666"
                />
                <Text variant="bodyLarge" style={styles.infoText}>
                  {booking.academyName || "Academy Session"}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.infoSection}>
              <View style={styles.infoRow}>
                <MaterialCommunityIcons
                  name="account"
                  size={18}
                  color="#666"
                />
                <Text variant="bodyLarge" style={styles.infoText}>
                  {booking.userName || "Unknown User"}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <MaterialCommunityIcons
                  name="phone"
                  size={18}
                  color="#666"
                />
                <Text variant="bodyMedium" style={styles.infoText}>
                  {booking.userPhone || "N/A"}
                </Text>
                {booking.userPhone && (
                  <TouchableOpacity
                    style={styles.callButton}
                    onPress={() => handleCallCustomer(booking.userPhone)}
                  >
                    <MaterialCommunityIcons
                      name="phone"
                      size={16}
                      color="#4CAF50"
                    />
                    <Text style={styles.callButtonText}>Call</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* Booking Details */}
          <View style={styles.detailsSection}>
            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="soccer" size={16} color="#666" />
              <Text variant="bodySmall" style={styles.detailText}>
                {booking.sport || "N/A"}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <MaterialCommunityIcons
                name="map-marker"
                size={16}
                color="#666"
              />
              <Text variant="bodySmall" style={styles.detailText}>
                {booking.groundName || "N/A"}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <MaterialCommunityIcons
                name="currency-inr"
                size={16}
                color="#666"
              />
              <Text variant="bodySmall" style={styles.detailText}>
                ₹{booking.totalAmount || booking.payment?.slotAmount || 0}
              </Text>
            </View>
          </View>

          {/* Action Buttons - Only for non-academy bookings */}
          {!isAcademy && booking.status !== "completed" && (
            <View style={styles.actionsSection}>
              <Button
                mode="outlined"
                icon="check-circle"
                onPress={() => handleMarkAttendance(booking)}
                style={styles.actionButton}
                compact
              >
                Attendance
              </Button>
              <Button
                mode="outlined"
                icon="cash"
                onPress={() => handleCollectPayment(booking)}
                style={styles.actionButton}
                compact
              >
                Payment
              </Button>
              <Button
                mode="outlined"
                icon="clock-plus-outline"
                onPress={() => handleExtendTime(booking)}
                style={styles.actionButton}
                compact
              >
                Extend
              </Button>
            </View>
          )}
        </Card.Content>
      </Card>
    );
  };

  const renderLimitedBookingCard = (booking) => {
    const isAcademy = booking.bookingType === "academy";

    return (
      <Card key={booking.id} style={styles.bookingCard}>
        <Card.Content>
          {/* Header - Time Hidden */}
          <View style={styles.bookingHeader}>
            <View style={styles.timeContainer}>
              <MaterialCommunityIcons
                name="lock"
                size={20}
                color="#999"
              />
              <Text variant="titleMedium" style={styles.hiddenText}>
                🔒 Hidden
              </Text>
            </View>
            <Chip
              style={[
                styles.statusChip,
                { backgroundColor: getStatusColor(booking) + "20" },
              ]}
              textStyle={[
                styles.statusChipText,
                { color: getStatusColor(booking) },
              ]}
            >
              {getStatusLabel(booking)}
            </Chip>
          </View>

          {/* Customer/Academy Info */}
          {isAcademy ? (
            <View style={styles.infoSection}>
              <View style={styles.infoRow}>
                <MaterialCommunityIcons
                  name="school"
                  size={18}
                  color="#666"
                />
                <Text variant="bodyLarge" style={styles.infoText}>
                  {booking.academyName || "Academy Session"}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.infoSection}>
              <View style={styles.infoRow}>
                <MaterialCommunityIcons
                  name="account"
                  size={18}
                  color="#666"
                />
                <Text variant="bodyLarge" style={styles.infoText}>
                  {booking.userName || "Unknown User"}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <MaterialCommunityIcons
                  name="lock"
                  size={18}
                  color="#999"
                />
                <Text variant="bodyMedium" style={styles.hiddenText}>
                  🔒 Hidden
                </Text>
              </View>
            </View>
          )}

          {/* Booking Details - Only Amount Visible */}
          <View style={styles.detailsSection}>
            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="soccer" size={16} color="#666" />
              <Text variant="bodySmall" style={styles.detailText}>
                {booking.sport || "N/A"}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <MaterialCommunityIcons
                name="map-marker"
                size={16}
                color="#666"
              />
              <Text variant="bodySmall" style={styles.detailText}>
                {booking.groundName || "N/A"}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <MaterialCommunityIcons
                name="currency-inr"
                size={16}
                color="#666"
              />
              <Text variant="bodySmall" style={styles.detailText}>
                ₹{booking.totalAmount || booking.payment?.slotAmount || 0}
              </Text>
            </View>
          </View>

          {/* No Action Buttons for Future Dates */}
        </Card.Content>
      </Card>
    );
  };

  const showTodayBookings = isToday(selectedDate);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text variant="headlineSmall" style={styles.title}>
          Schedule
        </Text>
        <Text variant="bodyMedium" style={styles.dateText}>
          {formatDate(selectedDate)}
        </Text>
      </View>

      {/* Week Navigation */}
      <View style={styles.weekNavigation}>
        <TouchableOpacity onPress={handlePrevWeek} style={styles.navButton}>
          <MaterialCommunityIcons
            name="chevron-left"
            size={24}
            color={CARETAKER_COLOR}
          />
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
                  variant="bodySmall"
                  style={[
                    styles.dayName,
                    day.isSelected && styles.dayNameActive,
                  ]}
                >
                  {day.day}
                </Text>
                <Text
                  variant="titleMedium"
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
          <MaterialCommunityIcons
            name="chevron-right"
            size={24}
            color={CARETAKER_COLOR}
          />
        </TouchableOpacity>
      </View>

      {/* Future Date Info Banner */}
      {!showTodayBookings && (
        <Banner
          visible={true}
          icon="information"
          style={styles.infoBanner}
        >
          <Text variant="bodySmall" style={styles.bannerText}>
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
            colors={[CARETAKER_COLOR]}
          />
        }
      >
        <Text variant="titleMedium" style={styles.sectionTitle}>
          {showTodayBookings ? "Today's Bookings" : `Bookings for ${formatDate(selectedDate)}`}
        </Text>

        {loading ? (
          <Surface style={styles.emptyCard} elevation={1}>
            <MaterialCommunityIcons
              name="loading"
              size={48}
              color="#ccc"
            />
            <Text variant="bodyMedium" style={styles.emptyText}>
              Loading bookings...
            </Text>
          </Surface>
        ) : bookings.length > 0 ? (
          bookings.map((booking) =>
            showTodayBookings
              ? renderFullBookingCard(booking)
              : renderLimitedBookingCard(booking)
          )
        ) : (
          <Surface style={styles.emptyCard} elevation={1}>
            <MaterialCommunityIcons
              name="calendar-blank"
              size={48}
              color="#ccc"
            />
            <Text variant="bodyMedium" style={styles.emptyText}>
              No bookings scheduled
            </Text>
            <Text variant="bodySmall" style={styles.emptySubtext}>
              {showTodayBookings
                ? "You have no bookings for today"
                : "No bookings found for this date"}
            </Text>
          </Surface>
        )}
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
    backgroundColor: "#f5f5f5",
  },
  header: {
    padding: 16,
    paddingBottom: 8,
  },
  title: {
    fontWeight: "bold",
    color: "#333",
  },
  dateText: {
    color: "#666",
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
    minWidth: 44,
    position: "relative",
  },
  dayItemActive: {
    backgroundColor: CARETAKER_COLOR,
  },
  dayName: {
    color: "#666",
    fontSize: 11,
  },
  dayNameActive: {
    color: "#fff",
  },
  dayDate: {
    fontWeight: "600",
    color: "#333",
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
    backgroundColor: CARETAKER_COLOR,
  },
  infoBanner: {
    backgroundColor: "#E3F2FD",
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
  },
  bannerText: {
    color: "#1565C0",
  },
  scheduleContainer: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontWeight: "600",
    marginBottom: 12,
    color: "#333",
  },
  bookingCard: {
    marginBottom: 12,
    borderRadius: 12,
  },
  bookingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  timeContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  timeText: {
    fontWeight: "600",
    color: "#333",
    marginLeft: 8,
  },
  hiddenText: {
    color: "#999",
    marginLeft: 8,
  },
  statusChip: {
    height: 28,
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  infoSection: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  infoText: {
    marginLeft: 8,
    flex: 1,
    color: "#333",
  },
  callButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#E8F5E9",
    borderRadius: 16,
    marginLeft: 8,
  },
  callButtonText: {
    color: "#4CAF50",
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4,
  },
  detailsSection: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
    marginBottom: 4,
  },
  detailText: {
    color: "#666",
    marginLeft: 4,
  },
  actionsSection: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    minWidth: 100,
    borderRadius: 8,
  },
  emptyCard: {
    padding: 32,
    borderRadius: 16,
    backgroundColor: "#fff",
    alignItems: "center",
  },
  emptyText: {
    marginTop: 12,
    color: "#999",
  },
  emptySubtext: {
    marginTop: 4,
    color: "#bbb",
    textAlign: "center",
  },
});
