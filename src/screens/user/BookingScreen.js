import { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  FlatList,
} from "react-native";
import {
  Text,
  Surface,
  IconButton,
  Button,
  Divider,
  ActivityIndicator,
  ProgressBar,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSelector } from "react-redux";

import { selectUser } from "../../store/slices/authSlice";
import { queryDocuments, getDocument } from "../../services/firebase/firestore";
import { getSlotHourlyRate, calculateBookingPrice } from "../../utils/priceUtils";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const USER_COLOR = "#4CAF50";
const DAY_WIDTH = (SCREEN_WIDTH - 32) / 7;

// Sport icons mapping
const SPORT_ICONS = {
  football: "soccer",
  cricket: "cricket",
  badminton: "badminton",
  tennis: "tennis",
  basketball: "basketball",
  volleyball: "volleyball",
  hockey: "hockey-sticks",
  default: "trophy",
};

// Generate time slots from 6 AM to 11 PM in 30-minute intervals
const generateTimeSlots = () => {
  const slots = [];
  for (let hour = 6; hour <= 23; hour++) {
    slots.push({
      time: `${hour.toString().padStart(2, "0")}:00`,
      hour,
      minute: 0,
      label: formatTime(hour, 0),
    });
    if (hour < 23) {
      slots.push({
        time: `${hour.toString().padStart(2, "0")}:30`,
        hour,
        minute: 30,
        label: formatTime(hour, 30),
      });
    }
  }
  return slots;
};

const formatTime = (hour, minute) => {
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${minute.toString().padStart(2, "0")} ${period}`;
};

const TIME_SLOTS = generateTimeSlots();

// Generate next 45 days
const generateDates = () => {
  const dates = [];
  const today = new Date();
  for (let i = 0; i < 45; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    dates.push({
      date,
      day: date.getDate(),
      month: date.toLocaleString("default", { month: "short" }),
      weekday: date.toLocaleString("default", { weekday: "short" }),
      isToday: i === 0,
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
      dateString: date.toISOString().split("T")[0],
    });
  }
  return dates;
};

const BOOKING_STEPS = [
  { key: "date", label: "Date", icon: "calendar" },
  { key: "sport", label: "Sport", icon: "soccer" },
  { key: "time", label: "Time", icon: "clock-outline" },
  { key: "ground", label: "Ground", icon: "soccer-field" },
];

// Normalize ground ID for comparison (handles legacy "ground-0" vs "ground_0" formats)
const normalizeGroundId = (groundId) => {
  if (!groundId) return "";
  return groundId.toLowerCase().replace(/[-_]/g, "");
};

export default function BookingScreen({ navigation, route }) {
  const { turfId, turf: initialTurf } = route.params || {};
  const user = useSelector(selectUser);

  // Steps state
  const [currentStep, setCurrentStep] = useState(0);

  // Data state
  const [turf, setTurf] = useState(initialTurf || null);
  const [grounds, setGrounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]); // Existing bookings for availability
  const [blockedSlots, setBlockedSlots] = useState([]); // Blocked slots for availability

  // Selection state
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSport, setSelectedSport] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);
  const [selectedGround, setSelectedGround] = useState(null);

  // Generated data
  const dates = useMemo(() => generateDates(), []);

  // Fetch turf and grounds data
  const fetchData = useCallback(async () => {
    if (!turfId) return;

    try {
      setLoading(true);

      // If we have turf data passed, use its embedded grounds
      if (initialTurf) {
        const groundsData = initialTurf.grounds || [];
        setGrounds(groundsData.map((g, index) => ({
          ...g,
          id: g.id || `ground_${index}`,
        })));
      } else {
        // Fetch turf data if not passed
        const turfData = await getDocument("turfs", turfId);
        if (turfData) {
          setTurf(turfData);
          const groundsData = turfData.grounds || [];
          setGrounds(groundsData.map((g, index) => ({
            ...g,
            id: g.id || `ground_${index}`,
          })));
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }, [turfId, initialTurf]);

  // Fetch bookings for selected date
  const fetchBookings = useCallback(async () => {
    if (!turfId || !selectedDate) return;

    try {
      const bookingsData = await queryDocuments("bookings", [
        { field: "turfId", operator: "==", value: turfId },
        { field: "date", operator: "==", value: selectedDate.dateString },
      ]);
      const activeBookings = (bookingsData || []).filter((b) =>
        ["pending", "confirmed", "in_progress"].includes(b.status)
      );
      setBookings(activeBookings);
    } catch (error) {
      console.error("Error fetching bookings:", error);
    }
  }, [turfId, selectedDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (selectedDate) {
      fetchBookings();
    }
  }, [selectedDate, fetchBookings]);

  // Fetch blocked slots for the turf
  const fetchBlockedSlots = useCallback(async () => {
    if (!turfId) return;

    try {
      const blockedData = await queryDocuments("blocked_slots", [
        { field: "turfId", operator: "==", value: turfId },
      ]);
      setBlockedSlots(blockedData || []);
    } catch (error) {
      console.error("Error fetching blocked slots:", error);
      setBlockedSlots([]);
    }
  }, [turfId]);

  useEffect(() => {
    if (turfId) {
      fetchBlockedSlots();
    }
  }, [turfId, fetchBlockedSlots]);

  // Get available sports from turf
  const availableSports = useMemo(() => {
    const sports = turf?.sports || [];
    // Get unique sports from all grounds
    const groundSports = grounds.flatMap(g => g.sports || []);
    const allSports = [...new Set([...sports, ...groundSports])];
    return allSports.length > 0 ? allSports : ["Football", "Cricket", "Badminton"];
  }, [turf, grounds]);

  // Get grounds that support selected sport
  const filteredGrounds = useMemo(() => {
    if (!selectedSport) return grounds;
    return grounds.filter(g =>
      (g.sports || []).some(s => s.toLowerCase() === selectedSport.toLowerCase())
    );
  }, [grounds, selectedSport]);

  // Check if a time slot is booked for a ground
  const isSlotBooked = useCallback((groundId, timeSlot) => {
    const normalizedGroundId = normalizeGroundId(groundId);
    return bookings.some(booking => {
      // Use normalized comparison to handle legacy data with different ID formats
      if (normalizeGroundId(booking.groundId) !== normalizedGroundId) return false;
      const bookingStart = booking.startTime;
      const bookingEnd = booking.endTime;
      return timeSlot.time >= bookingStart && timeSlot.time < bookingEnd;
    });
  }, [bookings]);

  // Check if a ground is blocked for the selected time range
  const isGroundBlocked = useCallback((groundId) => {
    if (!startTime || !endTime || !selectedDate) return false;

    const dateStr = selectedDate.dateString;
    const dayOfWeek = selectedDate.date.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
    const normalizedGroundId = normalizeGroundId(groundId);
    const slotStartTime = startTime.time;
    const slotEndTime = endTime.time;

    return blockedSlots.some((block) => {
      // Check ground match (block.groundId === "all" blocks all grounds)
      if (block.groundId !== "all") {
        if (normalizeGroundId(block.groundId) !== normalizedGroundId) return false;
      }

      // Check date match based on block type
      if (block.blockType === "recurring") {
        if (dateStr < block.startDate || dateStr > (block.recurringEndDate || block.endDate)) return false;
        if (!block.recurringDays || !block.recurringDays.includes(dayOfWeek)) return false;
      } else if (block.blockType === "range") {
        if (dateStr < block.startDate || dateStr > block.endDate) return false;
      } else {
        // Single day block
        if (dateStr !== block.startDate) return false;
      }

      // Check time overlap
      const blockStart = block.allDay ? "06:00" : block.startTime;
      const blockEnd = block.allDay ? "23:00" : block.endTime;
      // Time overlap: blockStart < slotEnd AND blockEnd > slotStart
      return blockStart < slotEndTime && blockEnd > slotStartTime;
    });
  }, [blockedSlots, startTime, endTime, selectedDate]);

  // Get blocking reasons for a ground (for UI display)
  const getBlockingReasons = useCallback((groundId) => {
    if (!startTime || !endTime || !selectedDate) return [];

    const dateStr = selectedDate.dateString;
    const dayOfWeek = selectedDate.date.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
    const normalizedGroundId = normalizeGroundId(groundId);
    const slotStartTime = startTime.time;
    const slotEndTime = endTime.time;

    return blockedSlots.filter((block) => {
      // Check ground match
      if (block.groundId !== "all") {
        if (normalizeGroundId(block.groundId) !== normalizedGroundId) return false;
      }

      // Check date match based on block type
      if (block.blockType === "recurring") {
        if (dateStr < block.startDate || dateStr > (block.recurringEndDate || block.endDate)) return false;
        if (!block.recurringDays || !block.recurringDays.includes(dayOfWeek)) return false;
      } else if (block.blockType === "range") {
        if (dateStr < block.startDate || dateStr > block.endDate) return false;
      } else {
        if (dateStr !== block.startDate) return false;
      }

      // Check time overlap
      const blockStart = block.allDay ? "06:00" : block.startTime;
      const blockEnd = block.allDay ? "23:00" : block.endTime;
      return blockStart < slotEndTime && blockEnd > slotStartTime;
    });
  }, [blockedSlots, startTime, endTime, selectedDate]);

  // Check if time slot is in past
  const isSlotPast = useCallback((timeSlot) => {
    if (!selectedDate?.isToday) return false;
    const now = new Date();
    const slotTime = new Date();
    slotTime.setHours(timeSlot.hour, timeSlot.minute, 0, 0);
    return slotTime <= now;
  }, [selectedDate]);

  // Get price for a time slot based on ground's actual pricing
  const getSlotPrice = useCallback((timeSlot, ground, weekend = false) => {
    return getSlotHourlyRate(timeSlot.time, ground, weekend);
  }, []);

  // Calculate total price based on actual ground pricing
  const calculateTotalPrice = useCallback((ground) => {
    if (!startTime || !endTime || !ground) return 0;
    const result = calculateBookingPrice(
      ground,
      selectedSport,
      selectedDate?.dateString,
      startTime.time,
      endTime.time
    );
    return result.total;
  }, [startTime, endTime, selectedDate, selectedSport]);

  // Check ground availability for selected time range (checks both bookings and blocks)
  const isGroundAvailable = useCallback((ground) => {
    if (!startTime || !endTime) return true;

    // First check if blocked
    if (isGroundBlocked(ground.id)) return false;

    // Then check for booking conflicts
    const startIndex = TIME_SLOTS.findIndex(s => s.time === startTime.time);
    const endIndex = TIME_SLOTS.findIndex(s => s.time === endTime.time);

    for (let i = startIndex; i < endIndex; i++) {
      if (isSlotBooked(ground.id, TIME_SLOTS[i])) {
        return false;
      }
    }
    return true;
  }, [startTime, endTime, isSlotBooked, isGroundBlocked]);

  // Handle time slot selection
  const handleTimeSlotPress = (slot) => {
    if (isSlotPast(slot)) return;

    if (!startTime || (startTime && endTime)) {
      // Start new selection
      setStartTime(slot);
      setEndTime(null);
    } else {
      // Complete selection
      const startIndex = TIME_SLOTS.findIndex(s => s.time === startTime.time);
      const slotIndex = TIME_SLOTS.findIndex(s => s.time === slot.time);

      if (slotIndex <= startIndex) {
        // If clicked before start, make this the new start
        setStartTime(slot);
        setEndTime(null);
      } else {
        // Ensure minimum 1 hour (2 slots)
        if (slotIndex - startIndex >= 2) {
          setEndTime(slot);
        } else {
          // Auto-select minimum 1 hour
          const minEndIndex = startIndex + 2;
          if (minEndIndex < TIME_SLOTS.length) {
            setEndTime(TIME_SLOTS[minEndIndex]);
          }
        }
      }
    }
  };

  // Check if slot is in selected range
  const isSlotInRange = (slot) => {
    if (!startTime) return false;
    if (!endTime) return slot.time === startTime.time;

    const slotIndex = TIME_SLOTS.findIndex(s => s.time === slot.time);
    const startIndex = TIME_SLOTS.findIndex(s => s.time === startTime.time);
    const endIndex = TIME_SLOTS.findIndex(s => s.time === endTime.time);

    return slotIndex >= startIndex && slotIndex < endIndex;
  };

  // Navigation functions
  const canGoNext = () => {
    switch (currentStep) {
      case 0: return !!selectedDate;
      case 1: return !!selectedSport;
      case 2: return !!startTime && !!endTime;
      case 3: return !!selectedGround;
      default: return false;
    }
  };

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    } else {
      // Proceed to confirmation
      navigation.navigate("BookingConfirmation", {
        turfId,
        turf,
        ground: selectedGround,
        date: selectedDate,
        sport: selectedSport,
        startTime,
        endTime,
        totalPrice: calculateTotalPrice(selectedGround),
      });
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else {
      navigation.goBack();
    }
  };

  // Render step indicator
  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      <View style={styles.stepsRow}>
        {BOOKING_STEPS.map((step, index) => (
          <View key={step.key} style={styles.stepItem}>
            <View
              style={[
                styles.stepCircle,
                index < currentStep && styles.stepCompleted,
                index === currentStep && styles.stepActive,
              ]}
            >
              {index < currentStep ? (
                <MaterialCommunityIcons name="check" size={16} color="#fff" />
              ) : (
                <MaterialCommunityIcons
                  name={step.icon}
                  size={16}
                  color={index === currentStep ? "#fff" : "#999"}
                />
              )}
            </View>
            <Text
              variant="labelSmall"
              style={[
                styles.stepLabel,
                index === currentStep && styles.stepLabelActive,
              ]}
            >
              {step.label}
            </Text>
          </View>
        ))}
      </View>
      <ProgressBar
        progress={(currentStep + 1) / 4}
        color={USER_COLOR}
        style={styles.progressBar}
      />
    </View>
  );

  // Render date selection (Step 1)
  const renderDateSelection = () => (
    <View style={styles.stepContent}>
      <Text variant="titleMedium" style={styles.stepTitle}>
        Select Date
      </Text>
      <Text variant="bodyMedium" style={styles.stepSubtitle}>
        Choose when you want to play
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.dateScrollView}
        contentContainerStyle={styles.dateScrollContent}
      >
        {dates.map((date, index) => {
          const isSelected = selectedDate?.dateString === date.dateString;
          // Mock availability status (replace with actual data)
          const availability = index % 5 === 0 ? "full" : index % 3 === 0 ? "partial" : "available";

          return (
            <TouchableOpacity
              key={date.dateString}
              style={[
                styles.dateCard,
                isSelected && styles.dateCardSelected,
                date.isToday && styles.dateCardToday,
              ]}
              onPress={() => setSelectedDate(date)}
            >
              <Text
                style={[
                  styles.dateWeekday,
                  isSelected && styles.dateTextSelected,
                ]}
              >
                {date.weekday}
              </Text>
              <Text
                style={[
                  styles.dateDay,
                  isSelected && styles.dateTextSelected,
                ]}
              >
                {date.day}
              </Text>
              <Text
                style={[
                  styles.dateMonth,
                  isSelected && styles.dateTextSelected,
                ]}
              >
                {date.month}
              </Text>
              <View
                style={[
                  styles.availabilityDot,
                  availability === "available" && styles.dotAvailable,
                  availability === "partial" && styles.dotPartial,
                  availability === "full" && styles.dotFull,
                ]}
              />
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.dotAvailable]} />
          <Text variant="bodySmall" style={styles.legendText}>Available</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.dotPartial]} />
          <Text variant="bodySmall" style={styles.legendText}>Partial</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.dotFull]} />
          <Text variant="bodySmall" style={styles.legendText}>Fully Booked</Text>
        </View>
      </View>
    </View>
  );

  // Render sport selection (Step 2)
  const renderSportSelection = () => (
    <View style={styles.stepContent}>
      <Text variant="titleMedium" style={styles.stepTitle}>
        Select Sport
      </Text>
      <Text variant="bodyMedium" style={styles.stepSubtitle}>
        What do you want to play?
      </Text>

      <View style={styles.sportsGrid}>
        {availableSports.map((sport) => {
          const isSelected = selectedSport === sport;
          const icon = SPORT_ICONS[sport.toLowerCase()] || SPORT_ICONS.default;

          return (
            <TouchableOpacity
              key={sport}
              style={[
                styles.sportCard,
                isSelected && styles.sportCardSelected,
              ]}
              onPress={() => setSelectedSport(sport)}
            >
              <View
                style={[
                  styles.sportIconContainer,
                  isSelected && styles.sportIconSelected,
                ]}
              >
                <MaterialCommunityIcons
                  name={icon}
                  size={32}
                  color={isSelected ? "#fff" : USER_COLOR}
                />
              </View>
              <Text
                style={[
                  styles.sportName,
                  isSelected && styles.sportNameSelected,
                ]}
              >
                {sport}
              </Text>
              {isSelected && (
                <MaterialCommunityIcons
                  name="check-circle"
                  size={20}
                  color={USER_COLOR}
                  style={styles.sportCheck}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  // Render time selection (Step 3)
  const renderTimeSelection = () => (
    <View style={styles.stepContent}>
      <Text variant="titleMedium" style={styles.stepTitle}>
        Select Time
      </Text>
      <Text variant="bodyMedium" style={styles.stepSubtitle}>
        Choose start and end time (minimum 1 hour)
      </Text>

      {/* Selected time display */}
      {startTime && (
        <Surface style={styles.selectedTimeCard} elevation={1}>
          <View style={styles.selectedTimeRow}>
            <View style={styles.selectedTimeItem}>
              <Text variant="labelSmall" style={styles.selectedTimeLabel}>Start</Text>
              <Text variant="titleMedium" style={styles.selectedTimeValue}>
                {startTime.label}
              </Text>
            </View>
            <MaterialCommunityIcons name="arrow-right" size={24} color="#999" />
            <View style={styles.selectedTimeItem}>
              <Text variant="labelSmall" style={styles.selectedTimeLabel}>End</Text>
              <Text variant="titleMedium" style={styles.selectedTimeValue}>
                {endTime ? endTime.label : "Select"}
              </Text>
            </View>
            {startTime && endTime && (
              <View style={styles.durationBadge}>
                <Text style={styles.durationText}>
                  {((TIME_SLOTS.findIndex(s => s.time === endTime.time) -
                    TIME_SLOTS.findIndex(s => s.time === startTime.time)) * 0.5).toFixed(1)}h
                </Text>
              </View>
            )}
          </View>
        </Surface>
      )}

      {/* Time slots grid */}
      <ScrollView style={styles.timeSlotsContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.timeSlotsGrid}>
          {TIME_SLOTS.map((slot) => {
            const isPast = isSlotPast(slot);
            const isInRange = isSlotInRange(slot);
            const isStart = startTime?.time === slot.time;
            const isEnd = endTime?.time === slot.time;

            return (
              <TouchableOpacity
                key={slot.time}
                style={[
                  styles.timeSlot,
                  isPast && styles.timeSlotPast,
                  isInRange && styles.timeSlotSelected,
                  isStart && styles.timeSlotStart,
                  isEnd && styles.timeSlotEnd,
                ]}
                onPress={() => handleTimeSlotPress(slot)}
                disabled={isPast}
              >
                <Text
                  style={[
                    styles.timeSlotText,
                    isPast && styles.timeSlotTextPast,
                    isInRange && styles.timeSlotTextSelected,
                  ]}
                >
                  {slot.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );

  // Render ground selection (Step 4)
  const renderGroundSelection = () => (
    <View style={styles.stepContent}>
      <Text variant="titleMedium" style={styles.stepTitle}>
        Select Ground
      </Text>
      <Text variant="bodyMedium" style={styles.stepSubtitle}>
        Available grounds for {selectedSport}
      </Text>

      {/* Booking summary */}
      <Surface style={styles.bookingSummary} elevation={1}>
        <View style={styles.summaryRow}>
          <MaterialCommunityIcons name="calendar" size={18} color={USER_COLOR} />
          <Text variant="bodyMedium" style={styles.summaryText}>
            {selectedDate?.weekday}, {selectedDate?.day} {selectedDate?.month}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <MaterialCommunityIcons name="clock-outline" size={18} color={USER_COLOR} />
          <Text variant="bodyMedium" style={styles.summaryText}>
            {startTime?.label} - {endTime?.label}
          </Text>
        </View>
      </Surface>

      {/* Grounds list */}
      <ScrollView style={styles.groundsContainer} showsVerticalScrollIndicator={false}>
        {filteredGrounds.length === 0 ? (
          <View style={styles.emptyGrounds}>
            <MaterialCommunityIcons name="soccer-field" size={48} color="#ccc" />
            <Text variant="bodyMedium" style={styles.emptyText}>
              No grounds available for {selectedSport}
            </Text>
          </View>
        ) : (
          filteredGrounds.map((ground) => {
            const isAvailable = isGroundAvailable(ground);
            const isBlocked = isGroundBlocked(ground.id);
            const blockingReasons = getBlockingReasons(ground.id);
            const isSelected = selectedGround?.id === ground.id;
            const price = calculateTotalPrice(ground);

            return (
              <TouchableOpacity
                key={ground.id}
                style={[
                  styles.groundCard,
                  !isAvailable && styles.groundCardUnavailable,
                  isBlocked && styles.groundCardBlocked,
                  isSelected && styles.groundCardSelected,
                ]}
                onPress={() => isAvailable && setSelectedGround(ground)}
                disabled={!isAvailable}
              >
                <View style={styles.groundHeader}>
                  <View style={styles.groundInfo}>
                    <Text
                      variant="titleSmall"
                      style={[
                        styles.groundName,
                        !isAvailable && styles.textUnavailable,
                      ]}
                    >
                      {ground.name || "Ground"}
                    </Text>
                    <Text variant="bodySmall" style={styles.groundSize}>
                      {ground.size || "Standard"} • {ground.capacity || "10-14"} players
                    </Text>
                  </View>
                  <View style={styles.groundPrice}>
                    <Text
                      variant="titleMedium"
                      style={[
                        styles.priceValue,
                        !isAvailable && styles.textUnavailable,
                      ]}
                    >
                      ₹{price}
                    </Text>
                    <Text variant="bodySmall" style={styles.priceLabel}>
                      total
                    </Text>
                  </View>
                </View>

                {/* Price breakdown */}
                <View style={styles.priceBreakdown}>
                  <Text variant="bodySmall" style={styles.breakdownText}>
                    {(() => {
                      const pricing = ground.pricing;
                      const dayType = selectedDate?.isWeekend ? "weekend" : "weekday";
                      const dayPricing = pricing?.[dayType] || pricing?.weekday;
                      if (dayPricing) {
                        const rates = [];
                        if (dayPricing.morning?.rate) rates.push(`Morning: ₹${dayPricing.morning.rate}/hr`);
                        if (dayPricing.afternoon?.rate) rates.push(`Afternoon: ₹${dayPricing.afternoon.rate}/hr`);
                        if (dayPricing.evening?.rate) rates.push(`Evening: ₹${dayPricing.evening.rate}/hr`);
                        return rates.length > 0 ? rates.join(" • ") : "Contact for pricing";
                      }
                      return pricing?.allDayRate ? `₹${pricing.allDayRate}/hr` : "Contact for pricing";
                    })()}
                  </Text>
                </View>

                {/* Show blocking reason if blocked */}
                {isBlocked && blockingReasons.length > 0 && (
                  <View style={styles.blockInfo}>
                    <Text style={styles.blockTitle}>Blocked:</Text>
                    {blockingReasons.map((block, idx) => (
                      <Text key={idx} style={styles.blockDetail}>
                        • {block.reason || "Maintenance/Private Event"}
                      </Text>
                    ))}
                  </View>
                )}

                {/* Availability status */}
                <View style={styles.availabilityRow}>
                  <View
                    style={[
                      styles.availabilityBadge,
                      isAvailable ? styles.badgeAvailable : isBlocked ? styles.badgeBlocked : styles.badgeUnavailable,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={isAvailable ? "check-circle" : isBlocked ? "lock" : "close-circle"}
                      size={14}
                      color={isAvailable ? USER_COLOR : isBlocked ? "#FF9800" : "#F44336"}
                    />
                    <Text
                      style={[
                        styles.availabilityText,
                        isAvailable ? styles.textAvailable : isBlocked ? styles.textBlocked : styles.textUnavailable,
                      ]}
                    >
                      {isAvailable ? "Available" : isBlocked ? "Blocked" : "Booked"}
                    </Text>
                  </View>
                  {isSelected && (
                    <MaterialCommunityIcons name="check-circle" size={24} color={USER_COLOR} />
                  )}
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );

  // Render current step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 0: return renderDateSelection();
      case 1: return renderSportSelection();
      case 2: return renderTimeSelection();
      case 3: return renderGroundSelection();
      default: return null;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={USER_COLOR} />
        <Text variant="bodyMedium" style={styles.loadingText}>
          Loading booking options...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton icon="arrow-left" onPress={handleBack} />
        <View style={styles.headerTitle}>
          <Text variant="titleMedium" style={styles.headerText}>
            Book {turf?.name || "Turf"}
          </Text>
        </View>
        <View style={{ width: 48 }} />
      </View>

      {renderStepIndicator()}
      {renderStepContent()}

      {/* Bottom navigation */}
      <Surface style={styles.bottomNav} elevation={8}>
        <View style={styles.bottomContent}>
          {currentStep === 3 && selectedGround && (
            <View style={styles.totalPrice}>
              <Text variant="bodySmall" style={styles.totalLabel}>Total</Text>
              <Text variant="headlineSmall" style={styles.totalValue}>
                ₹{calculateTotalPrice(selectedGround)}
              </Text>
            </View>
          )}
          <Button
            mode="contained"
            onPress={handleNext}
            disabled={!canGoNext()}
            buttonColor={USER_COLOR}
            style={[styles.nextButton, currentStep === 3 && selectedGround && { flex: 1 }]}
          >
            {currentStep === 3 ? "Proceed to Payment" : "Continue"}
          </Button>
        </View>
      </Surface>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  loadingText: {
    marginTop: 12,
    color: "#666",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  headerTitle: {
    flex: 1,
    alignItems: "center",
  },
  headerText: {
    fontWeight: "600",
    color: "#333",
  },

  // Step Indicator
  stepIndicator: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#f9f9f9",
  },
  stepsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  stepItem: {
    alignItems: "center",
    flex: 1,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#e0e0e0",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  stepCompleted: {
    backgroundColor: USER_COLOR,
  },
  stepActive: {
    backgroundColor: USER_COLOR,
  },
  stepLabel: {
    color: "#999",
  },
  stepLabelActive: {
    color: USER_COLOR,
    fontWeight: "600",
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "#e0e0e0",
  },

  // Step Content
  stepContent: {
    flex: 1,
    padding: 16,
  },
  stepTitle: {
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  stepSubtitle: {
    color: "#666",
    marginBottom: 16,
  },

  // Date Selection
  dateScrollView: {
    marginBottom: 16,
  },
  dateScrollContent: {
    paddingVertical: 8,
  },
  dateCard: {
    width: DAY_WIDTH - 8,
    marginHorizontal: 4,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#f5f5f5",
    alignItems: "center",
  },
  dateCardSelected: {
    backgroundColor: USER_COLOR,
  },
  dateCardToday: {
    borderWidth: 2,
    borderColor: USER_COLOR,
  },
  dateWeekday: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  dateDay: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  dateMonth: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  dateTextSelected: {
    color: "#fff",
  },
  availabilityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
  },
  dotAvailable: {
    backgroundColor: USER_COLOR,
  },
  dotPartial: {
    backgroundColor: "#FFC107",
  },
  dotFull: {
    backgroundColor: "#F44336",
  },
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  legendText: {
    color: "#666",
  },

  // Sport Selection
  sportsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  sportCard: {
    width: "48%",
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#f5f5f5",
    alignItems: "center",
    marginBottom: 12,
    position: "relative",
  },
  sportCardSelected: {
    backgroundColor: USER_COLOR + "15",
    borderWidth: 2,
    borderColor: USER_COLOR,
  },
  sportIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: USER_COLOR + "20",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  sportIconSelected: {
    backgroundColor: USER_COLOR,
  },
  sportName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  sportNameSelected: {
    color: USER_COLOR,
  },
  sportCheck: {
    position: "absolute",
    top: 8,
    right: 8,
  },

  // Time Selection
  selectedTimeCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: "#fff",
  },
  selectedTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  selectedTimeItem: {
    alignItems: "center",
  },
  selectedTimeLabel: {
    color: "#666",
  },
  selectedTimeValue: {
    fontWeight: "600",
    color: "#333",
  },
  durationBadge: {
    backgroundColor: USER_COLOR,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  durationText: {
    color: "#fff",
    fontWeight: "600",
  },
  timeSlotsContainer: {
    flex: 1,
  },
  timeSlotsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  timeSlot: {
    width: "24%",
    margin: "0.5%",
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#f5f5f5",
    alignItems: "center",
  },
  timeSlotPast: {
    backgroundColor: "#e0e0e0",
  },
  timeSlotSelected: {
    backgroundColor: USER_COLOR + "30",
  },
  timeSlotStart: {
    backgroundColor: USER_COLOR,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
  },
  timeSlotEnd: {
    backgroundColor: USER_COLOR + "80",
  },
  timeSlotText: {
    fontSize: 12,
    color: "#333",
  },
  timeSlotTextPast: {
    color: "#999",
  },
  timeSlotTextSelected: {
    color: "#fff",
    fontWeight: "600",
  },

  // Ground Selection
  bookingSummary: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: "#fff",
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  summaryText: {
    marginLeft: 8,
    color: "#333",
  },
  groundsContainer: {
    flex: 1,
  },
  emptyGrounds: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 12,
    color: "#999",
  },
  groundCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#f9f9f9",
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "transparent",
  },
  groundCardUnavailable: {
    opacity: 0.6,
  },
  groundCardBlocked: {
    backgroundColor: "#FFF8E1",
    borderColor: "#FFE082",
    opacity: 0.8,
  },
  groundCardSelected: {
    borderColor: USER_COLOR,
    backgroundColor: USER_COLOR + "10",
  },
  groundHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  groundInfo: {
    flex: 1,
  },
  groundName: {
    fontWeight: "600",
    color: "#333",
  },
  groundSize: {
    color: "#666",
    marginTop: 2,
  },
  groundPrice: {
    alignItems: "flex-end",
  },
  priceValue: {
    fontWeight: "bold",
    color: USER_COLOR,
  },
  priceLabel: {
    color: "#666",
  },
  priceBreakdown: {
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#eee",
    marginBottom: 8,
  },
  breakdownText: {
    color: "#666",
  },
  availabilityRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  availabilityBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeAvailable: {
    backgroundColor: USER_COLOR + "20",
  },
  badgeUnavailable: {
    backgroundColor: "#FFEBEE",
  },
  badgeBlocked: {
    backgroundColor: "#FFF3E0",
  },
  availabilityText: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: "600",
  },
  textAvailable: {
    color: USER_COLOR,
  },
  textUnavailable: {
    color: "#F44336",
  },
  textBlocked: {
    color: "#FF9800",
  },
  blockInfo: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#FFE082",
    marginBottom: 8,
  },
  blockTitle: {
    fontSize: 12,
    color: "#FF9800",
    fontWeight: "500",
    marginBottom: 2,
  },
  blockDetail: {
    fontSize: 11,
    color: "#666",
    marginLeft: 4,
  },

  // Bottom Navigation
  bottomNav: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  bottomContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    paddingBottom: 24,
  },
  totalPrice: {
    marginRight: 16,
  },
  totalLabel: {
    color: "#666",
  },
  totalValue: {
    fontWeight: "bold",
    color: "#333",
  },
  nextButton: {
    borderRadius: 8,
    minWidth: 140,
  },
});
