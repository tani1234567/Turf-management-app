import { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
} from "react-native";
import {
  Text,
  Surface,
  Button,
  Chip,
  Portal,
  Dialog,
  ActivityIndicator,
  IconButton,
  FAB,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSelectedTurf } from "../../hooks/useSelectedTurf";
import {
  queryDocuments,
  subscribeToCollection,
} from "../../services/firebase/firestore";

const SCREEN_WIDTH = Dimensions.get("window").width;
const MANAGER_BLUE = "#2196F3";

// Calendar view types
const VIEW_TYPES = {
  DAY: "day",
  WEEK: "week",
  MONTH: "month",
};

// Status colors for bookings
const STATUS_COLORS = {
  pending: { bg: "#FFF3E0", color: "#FF9800", label: "Pending" },
  confirmed: { bg: "#E3F2FD", color: "#2196F3", label: "Confirmed" },
  in_progress: { bg: "#E8F5E9", color: "#4CAF50", label: "In Progress" },
  completed: { bg: "#F5F5F5", color: "#9E9E9E", label: "Completed" },
  academy: { bg: "#FFF3E0", color: "#FF5722", label: "Academy" },
  blocked: { bg: "#EEEEEE", color: "#757575", label: "Blocked" },
  cancelled: { bg: "#FFEBEE", color: "#F44336", label: "Cancelled" },
  rejected: { bg: "#FFEBEE", color: "#F44336", label: "Rejected" },
};

// Time slots for day view (6 AM to 11 PM)
const TIME_SLOTS = [];
for (let i = 6; i <= 23; i++) {
  TIME_SLOTS.push(`${String(i).padStart(2, "0")}:00`);
}

// Days of week
const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

// Helper functions
const getTodayString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const getDateString = (date) => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const formatTime = (timeStr) => {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${m} ${ampm}`;
};

const formatDateHeader = (date) => {
  return date.toLocaleDateString("en-IN", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
};

const formatFullDate = (date) => {
  return date.toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const parseTime = (timeStr) => {
  const [h, m] = timeStr.split(":");
  return parseInt(h, 10) * 60 + parseInt(m, 10);
};

const getWeekDates = (date) => {
  const week = [];
  const startOfWeek = new Date(date);
  const day = startOfWeek.getDay();
  startOfWeek.setDate(startOfWeek.getDate() - day);

  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(d.getDate() + i);
    week.push(d);
  }
  return week;
};

const getMonthDates = (date) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const days = [];

  // Add days from previous month to fill the first week
  const startDay = firstDay.getDay();
  for (let i = startDay - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    days.push({ date: d, isCurrentMonth: false });
  }

  // Add days of current month
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push({ date: new Date(year, month, i), isCurrentMonth: true });
  }

  // Add days from next month to complete the last week
  const remainingDays = 42 - days.length; // 6 rows * 7 days
  for (let i = 1; i <= remainingDays; i++) {
    days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
  }

  return days;
};

export default function CalendarScreen({ navigation }) {
  const { selectedTurfId, turfData } = useSelectedTurf();

  // View state
  const [viewType, setViewType] = useState(VIEW_TYPES.DAY);
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Data state
  const [bookings, setBookings] = useState([]);
  const [academySessions, setAcademySessions] = useState([]);
  const [blockedSlots, setBlockedSlots] = useState([]);
  const [grounds, setGrounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filter state
  const [groundFilter, setGroundFilter] = useState("all");

  // Dialog state
  const [legendVisible, setLegendVisible] = useState(false);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);

  // Subscription ref
  const unsubscribeRef = useRef(null);

  // Load grounds from turf data (grounds are embedded in turf document)
  useEffect(() => {
    if (!turfData) {
      setGrounds([]);
      return;
    }

    try {
      // Grounds are stored as an array within the turf document
      const groundsData = turfData.grounds || [];

      // Map grounds with proper IDs
      const groundsWithIds = groundsData.map((g, index) => ({
        ...g,
        id: g.id || `ground_${index}`,
      }));

      setGrounds(groundsWithIds);
    } catch (error) {
      console.error("Error loading grounds:", error);
    }
  }, [turfData]);

  // Subscribe to bookings
  useEffect(() => {
    if (!selectedTurfId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribe = subscribeToCollection(
      "bookings",
      (docs) => {
        setBookings(docs);
        setLoading(false);
        setRefreshing(false);
      },
      [{ field: "turfId", operator: "==", value: selectedTurfId }]
    );

    unsubscribeRef.current = unsubscribe;

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [selectedTurfId]);

  // Load academy sessions
  useEffect(() => {
    if (!selectedTurfId) return;

    const loadAcademySessions = async () => {
      try {
        const sessions = await queryDocuments("academy_sessions", [
          { field: "turfId", operator: "==", value: selectedTurfId },
        ]);
        setAcademySessions(sessions);
      } catch (error) {
        // Academy sessions might not exist
        setAcademySessions([]);
      }
    };

    loadAcademySessions();
  }, [selectedTurfId]);

  // Subscribe to blocked slots (real-time updates)
  useEffect(() => {
    if (!selectedTurfId) {
      setBlockedSlots([]);
      return;
    }

    const unsubscribe = subscribeToCollection(
      "blocked_slots",
      (docs) => {
        setBlockedSlots(docs);
      },
      [{ field: "turfId", operator: "==", value: selectedTurfId }]
    );

    return () => unsubscribe();
  }, [selectedTurfId]);

  // Get bookings for a specific date
  const getBookingsForDate = useCallback((dateStr) => {
    let filtered = bookings.filter((b) => b.date === dateStr);

    // Apply ground filter
    if (groundFilter !== "all") {
      filtered = filtered.filter((b) => b.groundId === groundFilter);
    }

    return filtered;
  }, [bookings, groundFilter]);

  // Get academy sessions for a specific date
  const getAcademyForDate = useCallback((dateStr) => {
    let filtered = academySessions.filter((s) => s.date === dateStr);

    if (groundFilter !== "all") {
      filtered = filtered.filter((s) => s.groundId === groundFilter);
    }

    return filtered;
  }, [academySessions, groundFilter]);

  // Get blocked slots for a specific date (handles single, range, and recurring blocks)
  const getBlockedForDate = useCallback((dateStr) => {
    const dayOfWeek = new Date(dateStr).toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();

    let filtered = blockedSlots.filter((block) => {
      // Check date match based on block type
      if (block.blockType === "recurring") {
        // Check if date is within recurring range
        if (dateStr < block.startDate || dateStr > (block.recurringEndDate || block.endDate)) return false;
        // Check if day matches recurring days
        if (!block.recurringDays || !block.recurringDays.includes(dayOfWeek)) return false;
        return true;
      } else if (block.blockType === "range") {
        // Check if date is within range
        return dateStr >= block.startDate && dateStr <= block.endDate;
      } else {
        // Single day block (or legacy format without blockType)
        return block.date === dateStr || block.startDate === dateStr;
      }
    });

    if (groundFilter !== "all") {
      filtered = filtered.filter((b) => b.groundId === groundFilter || b.groundId === "all");
    }

    return filtered;
  }, [blockedSlots, groundFilter]);

  // Get all events for a date (combined)
  const getEventsForDate = useCallback((dateStr) => {
    const events = [];

    // Add bookings
    getBookingsForDate(dateStr).forEach((b) => {
      events.push({
        ...b,
        type: "booking",
        displayStatus: b.status === "in_progress" ? "in_progress" : b.status,
      });
    });

    // Add academy sessions
    getAcademyForDate(dateStr).forEach((s) => {
      events.push({
        ...s,
        type: "academy",
        displayStatus: "academy",
      });
    });

    // Add blocked slots
    getBlockedForDate(dateStr).forEach((b) => {
      events.push({
        ...b,
        type: "blocked",
        displayStatus: "blocked",
      });
    });

    return events;
  }, [getBookingsForDate, getAcademyForDate, getBlockedForDate]);

  // Navigation handlers
  const goToToday = () => {
    setSelectedDate(new Date());
  };

  const navigateDate = (direction) => {
    const newDate = new Date(selectedDate);
    if (viewType === VIEW_TYPES.DAY) {
      newDate.setDate(newDate.getDate() + direction);
    } else if (viewType === VIEW_TYPES.WEEK) {
      newDate.setDate(newDate.getDate() + (7 * direction));
    } else {
      newDate.setMonth(newDate.getMonth() + direction);
    }
    setSelectedDate(newDate);
  };

  // Refresh handler
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  // View booking details
  const viewBookingDetails = (booking) => {
    setSelectedBooking(booking);
    setDetailsVisible(true);
  };

  // Get ground name
  const getGroundName = (groundId) => {
    const ground = grounds.find((g) => g.id === groundId);
    return ground?.name || "Ground";
  };

  // Calculate booking position for day view
  const getBookingStyle = (booking) => {
    const startMinutes = parseTime(booking.startTime);
    const endMinutes = parseTime(booking.endTime);
    const duration = endMinutes - startMinutes;

    const startOffset = startMinutes - 360; // 6:00 AM = 360 minutes
    const top = (startOffset / 60) * 60; // 60px per hour
    const height = (duration / 60) * 60;

    return { top: Math.max(0, top), height: Math.max(30, height) };
  };

  // Render view type selector
  const ViewTypeSelector = () => (
    <View style={styles.viewSelector}>
      {Object.entries(VIEW_TYPES).map(([key, value]) => (
        <TouchableOpacity
          key={key}
          style={[
            styles.viewTypeButton,
            viewType === value && styles.viewTypeButtonActive,
          ]}
          onPress={() => setViewType(value)}
        >
          <Text
            style={[
              styles.viewTypeText,
              viewType === value && styles.viewTypeTextActive,
            ]}
          >
            {key.charAt(0) + key.slice(1).toLowerCase()}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // Render ground filter
  const GroundFilter = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.groundFilterContainer}
      contentContainerStyle={styles.groundFilterContent}
    >
      <Chip
        selected={groundFilter === "all"}
        onPress={() => setGroundFilter("all")}
        mode="outlined"
        style={styles.groundChip}
        compact
      >
        All Grounds
      </Chip>
      {grounds.map((ground) => (
        <Chip
          key={ground.id}
          selected={groundFilter === ground.id}
          onPress={() => setGroundFilter(ground.id)}
          mode="outlined"
          style={styles.groundChip}
          compact
        >
          {ground.name}
        </Chip>
      ))}
    </ScrollView>
  );

  // Render booking block
  const BookingBlock = ({ booking, compact = false }) => {
    const statusInfo = STATUS_COLORS[booking.displayStatus] || STATUS_COLORS.pending;

    return (
      <TouchableOpacity
        style={[
          styles.bookingBlock,
          { backgroundColor: statusInfo.bg, borderLeftColor: statusInfo.color },
          compact && styles.bookingBlockCompact,
          booking.displayStatus === "blocked" && styles.blockedBlock,
        ]}
        onPress={() => viewBookingDetails(booking)}
      >
        {booking.displayStatus === "blocked" && (
          <View style={styles.stripedOverlay}>
            {[...Array(10)].map((_, i) => (
              <View key={i} style={styles.stripe} />
            ))}
          </View>
        )}
        <View style={styles.bookingBlockContent}>
          {!compact && (
            <Text style={[styles.bookingTime, { color: statusInfo.color }]} numberOfLines={1}>
              {formatTime(booking.startTime)} - {formatTime(booking.endTime)}
            </Text>
          )}
          <Text style={styles.bookingName} numberOfLines={1}>
            {booking.type === "academy"
              ? booking.sessionName || "Academy Session"
              : booking.type === "blocked"
              ? booking.reason || "Blocked"
              : booking.userName || booking.customerName || "Customer"}
          </Text>
          {!compact && booking.groundName && (
            <Text style={styles.bookingGround} numberOfLines={1}>
              {booking.groundName || getGroundName(booking.groundId)}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Render Day View
  const DayView = () => {
    const dateStr = getDateString(selectedDate);
    const events = getEventsForDate(dateStr);

    return (
      <ScrollView
        style={styles.dayViewContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[MANAGER_BLUE]} />
        }
      >
        <View style={styles.timeGrid}>
          {TIME_SLOTS.map((time) => (
            <View key={time} style={styles.timeRow}>
              <Text style={styles.timeLabel}>{formatTime(time)}</Text>
              <View style={styles.timeSlotLine} />
            </View>
          ))}

          {/* Render bookings */}
          <View style={styles.eventsContainer}>
            {events.map((event, index) => {
              const position = getBookingStyle(event);
              return (
                <View
                  key={event.id || index}
                  style={[
                    styles.eventWrapper,
                    { top: position.top, height: position.height },
                  ]}
                >
                  <BookingBlock booking={event} />
                </View>
              );
            })}
          </View>
        </View>

        {events.length === 0 && (
          <View style={styles.noEventsDay}>
            <MaterialCommunityIcons name="calendar-blank" size={48} color="#ccc" />
            <Text style={styles.noEventsText}>No bookings for this day</Text>
          </View>
        )}
      </ScrollView>
    );
  };

  // Render Week View
  const WeekView = () => {
    const weekDates = getWeekDates(selectedDate);
    const todayStr = getTodayString();

    return (
      <ScrollView
        style={styles.weekViewContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[MANAGER_BLUE]} />
        }
      >
        {/* Week header */}
        <View style={styles.weekHeader}>
          {weekDates.map((date, index) => {
            const dateStr = getDateString(date);
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === getDateString(selectedDate);

            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.weekDayHeader,
                  isToday && styles.weekDayHeaderToday,
                  isSelected && styles.weekDayHeaderSelected,
                ]}
                onPress={() => setSelectedDate(date)}
              >
                <Text style={[styles.weekDayName, isToday && styles.weekDayNameToday]}>
                  {DAYS_SHORT[date.getDay()]}
                </Text>
                <Text style={[styles.weekDayDate, isToday && styles.weekDayDateToday]}>
                  {date.getDate()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Week grid */}
        <View style={styles.weekGrid}>
          {weekDates.map((date, index) => {
            const dateStr = getDateString(date);
            const events = getEventsForDate(dateStr);

            return (
              <View key={index} style={styles.weekDayColumn}>
                {events.slice(0, 5).map((event, eventIndex) => (
                  <BookingBlock key={event.id || eventIndex} booking={event} compact />
                ))}
                {events.length > 5 && (
                  <TouchableOpacity
                    style={styles.moreEventsButton}
                    onPress={() => {
                      setSelectedDate(date);
                      setViewType(VIEW_TYPES.DAY);
                    }}
                  >
                    <Text style={styles.moreEventsText}>+{events.length - 5} more</Text>
                  </TouchableOpacity>
                )}
                {events.length === 0 && (
                  <Text style={styles.noEventsWeek}>-</Text>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    );
  };

  // Render Month View
  const MonthView = () => {
    const monthDates = getMonthDates(selectedDate);
    const todayStr = getTodayString();

    return (
      <ScrollView
        style={styles.monthViewContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[MANAGER_BLUE]} />
        }
      >
        {/* Month header */}
        <View style={styles.monthDaysHeader}>
          {DAYS_SHORT.map((day) => (
            <Text key={day} style={styles.monthDayHeaderText}>
              {day}
            </Text>
          ))}
        </View>

        {/* Month grid */}
        <View style={styles.monthGrid}>
          {monthDates.map((item, index) => {
            const dateStr = getDateString(item.date);
            const events = getEventsForDate(dateStr);
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === getDateString(selectedDate);

            // Count by status
            const statusCounts = {};
            events.forEach((e) => {
              const status = e.displayStatus;
              statusCounts[status] = (statusCounts[status] || 0) + 1;
            });

            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.monthDay,
                  !item.isCurrentMonth && styles.monthDayOther,
                  isToday && styles.monthDayToday,
                  isSelected && styles.monthDaySelected,
                ]}
                onPress={() => {
                  setSelectedDate(item.date);
                  setViewType(VIEW_TYPES.DAY);
                }}
              >
                <Text
                  style={[
                    styles.monthDayText,
                    !item.isCurrentMonth && styles.monthDayTextOther,
                    isToday && styles.monthDayTextToday,
                  ]}
                >
                  {item.date.getDate()}
                </Text>

                {/* Status dots */}
                {events.length > 0 && (
                  <View style={styles.statusDots}>
                    {Object.entries(statusCounts).slice(0, 3).map(([status]) => (
                      <View
                        key={status}
                        style={[
                          styles.statusDot,
                          { backgroundColor: STATUS_COLORS[status]?.color || "#999" },
                        ]}
                      />
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    );
  };

  // Render legend dialog
  const LegendDialog = () => (
    <Portal>
      <Dialog visible={legendVisible} onDismiss={() => setLegendVisible(false)}>
        <Dialog.Title>Calendar Legend</Dialog.Title>
        <Dialog.Content>
          {Object.entries(STATUS_COLORS).map(([key, value]) => (
            <View key={key} style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: value.color }]} />
              <Text style={styles.legendLabel}>{value.label}</Text>
            </View>
          ))}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={() => setLegendVisible(false)}>Close</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );

  // Render booking details dialog
  const BookingDetailsDialog = () => (
    <Portal>
      <Dialog visible={detailsVisible} onDismiss={() => setDetailsVisible(false)}>
        <Dialog.Title>
          {selectedBooking?.type === "academy"
            ? "Academy Session"
            : selectedBooking?.type === "blocked"
            ? "Blocked Slot"
            : "Booking Details"}
        </Dialog.Title>
        <Dialog.Content>
          {selectedBooking && (
            <View>
              {selectedBooking.type === "booking" && (
                <>
                  <DetailRow
                    icon="account"
                    label="Customer"
                    value={selectedBooking.userName || selectedBooking.customerName || "N/A"}
                  />
                  <DetailRow
                    icon="phone"
                    label="Phone"
                    value={selectedBooking.userPhone || selectedBooking.customerPhone || "N/A"}
                  />
                </>
              )}
              {selectedBooking.type === "academy" && (
                <DetailRow
                  icon="school"
                  label="Session"
                  value={selectedBooking.sessionName || "Academy Session"}
                />
              )}
              <DetailRow
                icon="calendar"
                label="Date"
                value={selectedBooking.date}
              />
              <DetailRow
                icon="clock-outline"
                label="Time"
                value={`${formatTime(selectedBooking.startTime)} - ${formatTime(selectedBooking.endTime)}`}
              />
              <DetailRow
                icon="soccer-field"
                label="Ground"
                value={selectedBooking.groundName || getGroundName(selectedBooking.groundId)}
              />
              {selectedBooking.sport && (
                <DetailRow
                  icon="basketball"
                  label="Sport"
                  value={selectedBooking.sport}
                />
              )}
              {selectedBooking.type === "booking" && (
                <>
                  <DetailRow
                    icon="tag"
                    label="Status"
                    value={selectedBooking.status?.toUpperCase()}
                    valueColor={STATUS_COLORS[selectedBooking.status]?.color}
                  />
                  <DetailRow
                    icon="currency-inr"
                    label="Amount"
                    value={`₹${selectedBooking.totalAmount || selectedBooking.totalPrice || selectedBooking.payment?.slotAmount || selectedBooking.amount || 0}`}
                  />
                </>
              )}
              {selectedBooking.type === "blocked" && selectedBooking.reason && (
                <DetailRow
                  icon="information"
                  label="Reason"
                  value={selectedBooking.reason}
                />
              )}
            </View>
          )}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={() => setDetailsVisible(false)}>Close</Button>
          {selectedBooking?.type === "booking" && (
            <Button
              onPress={() => {
                setDetailsVisible(false);
                navigation.navigate("ManagerBookings");
              }}
            >
              Manage
            </Button>
          )}
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );

  // Detail row component
  const DetailRow = ({ icon, label, value, valueColor }) => (
    <View style={styles.detailRow}>
      <MaterialCommunityIcons name={icon} size={18} color="#666" />
      <Text style={styles.detailLabel}>{label}:</Text>
      <Text style={[styles.detailValue, valueColor && { color: valueColor }]}>
        {value}
      </Text>
    </View>
  );

  if (!selectedTurfId) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Surface style={styles.emptyCard} elevation={1}>
            <MaterialCommunityIcons name="soccer-field" size={64} color="#ccc" />
            <Text variant="titleMedium" style={styles.emptyTitle}>
              No Turf Selected
            </Text>
            <Text variant="bodyMedium" style={styles.emptyText}>
              Please select a turf from the dashboard first.
            </Text>
          </Surface>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text variant="headlineSmall" style={styles.title}>
            Calendar
          </Text>
          <Text variant="bodySmall" style={styles.turfName}>
            {turfData?.name || "Loading..."}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <IconButton
            icon="calendar-lock"
            size={22}
            onPress={() => navigation.navigate("BlockSlots")}
          />
          <IconButton
            icon="information-outline"
            size={22}
            onPress={() => setLegendVisible(true)}
          />
        </View>
      </View>

      {/* View type selector */}
      <ViewTypeSelector />

      {/* Date navigation */}
      <View style={styles.dateNav}>
        <IconButton
          icon="chevron-left"
          size={24}
          onPress={() => navigateDate(-1)}
        />
        <TouchableOpacity onPress={goToToday} style={styles.dateDisplay}>
          <Text variant="titleMedium" style={styles.dateText}>
            {viewType === VIEW_TYPES.MONTH
              ? `${MONTHS[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`
              : viewType === VIEW_TYPES.WEEK
              ? `Week of ${formatDateHeader(getWeekDates(selectedDate)[0])}`
              : formatFullDate(selectedDate)}
          </Text>
          {getDateString(selectedDate) !== getTodayString() && (
            <Text style={styles.goTodayText}>Tap to go to today</Text>
          )}
        </TouchableOpacity>
        <IconButton
          icon="chevron-right"
          size={24}
          onPress={() => navigateDate(1)}
        />
      </View>

      {/* Ground filter */}
      {grounds.length > 1 && <GroundFilter />}

      {/* Calendar view */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={MANAGER_BLUE} />
        </View>
      ) : (
        <>
          {viewType === VIEW_TYPES.DAY && <DayView />}
          {viewType === VIEW_TYPES.WEEK && <WeekView />}
          {viewType === VIEW_TYPES.MONTH && <MonthView />}
        </>
      )}

      {/* Quick action FAB */}
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => {
          navigation.navigate("CreateBooking");
        }}
        label="New Booking"
      />

      {/* Dialogs */}
      <LegendDialog />
      <BookingDetailsDialog />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: "row",
  },
  title: {
    fontWeight: "bold",
    color: "#333",
  },
  turfName: {
    color: "#666",
    marginTop: 2,
  },

  // View type selector
  viewSelector: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: "#E3E3E3",
    borderRadius: 8,
    padding: 4,
  },
  viewTypeButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: "center",
  },
  viewTypeButtonActive: {
    backgroundColor: "#fff",
    elevation: 2,
  },
  viewTypeText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
  },
  viewTypeTextActive: {
    color: MANAGER_BLUE,
  },

  // Date navigation
  dateNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  dateDisplay: {
    flex: 1,
    alignItems: "center",
  },
  dateText: {
    fontWeight: "600",
    color: "#333",
  },
  goTodayText: {
    fontSize: 11,
    color: MANAGER_BLUE,
    marginTop: 2,
  },

  // Ground filter
  groundFilterContainer: {
    maxHeight: 44,
    paddingVertical: 4,
  },
  groundFilterContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  groundChip: {
    marginRight: 4,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  // Day view
  dayViewContainer: {
    flex: 1,
  },
  timeGrid: {
    position: "relative",
    paddingLeft: 60,
    paddingRight: 16,
    minHeight: TIME_SLOTS.length * 60,
  },
  timeRow: {
    height: 60,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  timeLabel: {
    position: "absolute",
    left: -52,
    width: 48,
    fontSize: 11,
    color: "#999",
    textAlign: "right",
  },
  timeSlotLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E0E0E0",
    marginTop: 8,
  },
  eventsContainer: {
    position: "absolute",
    top: 0,
    left: 68,
    right: 16,
  },
  eventWrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    paddingVertical: 2,
  },
  noEventsDay: {
    alignItems: "center",
    paddingVertical: 40,
  },
  noEventsText: {
    marginTop: 12,
    color: "#999",
  },

  // Booking block
  bookingBlock: {
    borderRadius: 6,
    borderLeftWidth: 4,
    padding: 8,
    marginVertical: 1,
    flex: 1,
    overflow: "hidden",
  },
  bookingBlockCompact: {
    padding: 4,
    marginBottom: 4,
  },
  bookingBlockContent: {
    zIndex: 1,
  },
  bookingTime: {
    fontSize: 11,
    fontWeight: "600",
  },
  bookingName: {
    fontSize: 12,
    fontWeight: "500",
    color: "#333",
    marginTop: 2,
  },
  bookingGround: {
    fontSize: 10,
    color: "#666",
    marginTop: 1,
  },
  blockedBlock: {
    position: "relative",
    overflow: "hidden",
  },
  stripedOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    opacity: 0.3,
  },
  stripe: {
    width: 10,
    height: "100%",
    backgroundColor: "#999",
    marginRight: 10,
    transform: [{ skewX: "-15deg" }],
  },

  // Week view
  weekViewContainer: {
    flex: 1,
  },
  weekHeader: {
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  weekDayHeader: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 8,
  },
  weekDayHeaderToday: {
    backgroundColor: "#E3F2FD",
  },
  weekDayHeaderSelected: {
    borderWidth: 2,
    borderColor: MANAGER_BLUE,
  },
  weekDayName: {
    fontSize: 11,
    color: "#666",
    fontWeight: "500",
  },
  weekDayNameToday: {
    color: MANAGER_BLUE,
  },
  weekDayDate: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginTop: 2,
  },
  weekDayDateToday: {
    color: MANAGER_BLUE,
  },
  weekGrid: {
    flexDirection: "row",
    paddingHorizontal: 8,
    minHeight: 300,
  },
  weekDayColumn: {
    flex: 1,
    paddingHorizontal: 2,
  },
  moreEventsButton: {
    padding: 4,
    alignItems: "center",
  },
  moreEventsText: {
    fontSize: 10,
    color: MANAGER_BLUE,
    fontWeight: "500",
  },
  noEventsWeek: {
    textAlign: "center",
    color: "#ccc",
    fontSize: 12,
    paddingVertical: 20,
  },

  // Month view
  monthViewContainer: {
    flex: 1,
  },
  monthDaysHeader: {
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  monthDayHeaderText: {
    flex: 1,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
  },
  monthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 8,
  },
  monthDay: {
    width: (SCREEN_WIDTH - 16) / 7,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
  },
  monthDayOther: {
    opacity: 0.4,
  },
  monthDayToday: {
    backgroundColor: "#E3F2FD",
  },
  monthDaySelected: {
    borderWidth: 2,
    borderColor: MANAGER_BLUE,
  },
  monthDayText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
  },
  monthDayTextOther: {
    color: "#999",
  },
  monthDayTextToday: {
    color: MANAGER_BLUE,
    fontWeight: "bold",
  },
  statusDots: {
    flexDirection: "row",
    marginTop: 2,
    gap: 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  // Legend
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 6,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 4,
    marginRight: 12,
  },
  legendLabel: {
    fontSize: 14,
    color: "#333",
  },

  // Details dialog
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 6,
    gap: 8,
  },
  detailLabel: {
    fontSize: 13,
    color: "#666",
    width: 70,
  },
  detailValue: {
    flex: 1,
    fontSize: 14,
    color: "#333",
    fontWeight: "500",
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    padding: 16,
  },
  emptyCard: {
    padding: 32,
    borderRadius: 16,
    backgroundColor: "#fff",
    alignItems: "center",
  },
  emptyTitle: {
    marginTop: 16,
    fontWeight: "600",
    color: "#333",
  },
  emptyText: {
    marginTop: 8,
    color: "#999",
    textAlign: "center",
  },

  // FAB
  fab: {
    position: "absolute",
    right: 16,
    bottom: 16,
    backgroundColor: MANAGER_BLUE,
  },
});
