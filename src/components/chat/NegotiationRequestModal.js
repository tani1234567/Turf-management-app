import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
} from "react-native";
import {
  Text,
  Button,
  TextInput,
  Surface,
  Chip,
  IconButton,
  ActivityIndicator,
  HelperText,
  Checkbox,
} from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS } from "../../constants/theme";
import { queryDocuments } from "../../services/firebase/firestore";
import { calculateBookingPrice } from "../../utils/priceUtils";

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");

// Sport icons mapping
const SPORT_ICONS = {
  football: "soccer",
  cricket: "cricket",
  badminton: "badminton",
  tennis: "tennis",
  basketball: "basketball",
  volleyball: "volleyball",
  hockey: "hockey-sticks",
  pickleball: "racquet",
  default: "trophy",
};

/**
 * Normalize ground ID for comparison (handles legacy "ground-0" vs "ground_0" formats)
 */
const normalizeGroundId = (groundId) => {
  if (!groundId) return "";
  return groundId.toLowerCase().replace(/[-_]/g, "");
};

/**
 * Format date to display string
 */
const formatDisplayDate = (date) => {
  if (!date) return "";
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

/**
 * Get today's date in YYYY-MM-DD format
 */
const getTodayString = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
};

/**
 * Get dates for next 14 days
 */
const getNext14Days = () => {
  const dates = [];
  const today = new Date();
  for (let i = 0; i < 14; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const dayOfWeek = date.getDay();
    dates.push({
      date: dateStr,
      dayName: date.toLocaleDateString("en-US", { weekday: "short" }),
      dayNum: date.getDate(),
      month: date.toLocaleDateString("en-US", { month: "short" }),
      isToday: i === 0,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      fullDate: date,
    });
  }
  return dates;
};

/**
 * Generate time slots from 6 AM to 11 PM in 30-minute intervals
 */
const generateTimeSlots = () => {
  const slots = [];
  for (let hour = 6; hour <= 22; hour++) {
    const time = `${String(hour).padStart(2, "0")}:00`;
    const displayTime = hour > 12 ? `${hour - 12}:00 PM` : hour === 12 ? "12:00 PM" : `${hour}:00 AM`;
    slots.push({ time, displayTime, hour, minute: 0 });
    // Add half hour slot
    const halfTime = `${String(hour).padStart(2, "0")}:30`;
    const halfDisplayTime = hour > 12 ? `${hour - 12}:30 PM` : hour === 12 ? "12:30 PM" : `${hour}:30 AM`;
    slots.push({ time: halfTime, displayTime: halfDisplayTime, hour, minute: 30 });
  }
  // Add 11 PM
  slots.push({ time: "23:00", displayTime: "11:00 PM", hour: 23, minute: 0 });
  return slots;
};

const TIME_SLOTS = generateTimeSlots();

/**
 * Calculate duration in hours
 */
const calculateDuration = (startTime, endTime) => {
  if (!startTime || !endTime) return 0;
  const [startHour, startMin] = startTime.split(":").map(Number);
  const [endHour, endMin] = endTime.split(":").map(Number);
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  return (endMinutes - startMinutes) / 60;
};

/**
 * NegotiationRequestModal - Modal for users to create booking requests with price negotiation
 * Flow: Turf → Sport → Date → Time → Available Grounds → Price
 */
const NegotiationRequestModal = ({
  visible,
  onDismiss,
  onSubmit,
  companyData,
  userData,
  isLoading = false,
}) => {
  // Step state: 1: Turf & Sport, 2: Date & Time, 3: Available Grounds, 4: Price
  const [step, setStep] = useState(1);

  // Selection state
  const [selectedTurf, setSelectedTurf] = useState(null);
  const [selectedSport, setSelectedSport] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);
  const [selectedGround, setSelectedGround] = useState(null);

  // Price state
  const [willingToNegotiate, setWillingToNegotiate] = useState(false);
  const [requestedPrice, setRequestedPrice] = useState("");
  const [message, setMessage] = useState("");

  // Data state
  const [turfs, setTurfs] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [blockedSlots, setBlockedSlots] = useState([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [availabilityLoaded, setAvailabilityLoaded] = useState(false);

  // Memoized values
  const dates = useMemo(() => getNext14Days(), []);

  // Reset form when modal opens
  useEffect(() => {
    if (visible) {
      setStep(1);
      setSelectedTurf(null);
      setSelectedSport(null);
      setSelectedDate(null);
      setStartTime(null);
      setEndTime(null);
      setSelectedGround(null);
      setWillingToNegotiate(false);
      setRequestedPrice("");
      setMessage("");
      setBookings([]);
      setBlockedSlots([]);
      setAvailabilityLoaded(false);

      if (companyData?.turfs) {
        setTurfs(companyData.turfs);
      }
    }
  }, [visible, companyData]);

  // Auto-select turf if only one
  useEffect(() => {
    if (turfs.length === 1 && !selectedTurf) {
      setSelectedTurf(turfs[0]);
    }
  }, [turfs, selectedTurf]);

  // Fetch bookings and blocked slots when date and turf are selected
  useEffect(() => {
    const fetchAvailability = async () => {
      if (!selectedTurf || !selectedDate) return;

      setLoadingAvailability(true);
      setAvailabilityLoaded(false);

      const turfId = selectedTurf.turfId || selectedTurf.id;
      const dateStr = selectedDate.date;

      console.log("Fetching availability for turf:", turfId, "date:", dateStr);

      try {
        // Fetch bookings for selected date and turf
        const bookingsData = await queryDocuments("bookings", [
          { field: "turfId", operator: "==", value: turfId },
          { field: "date", operator: "==", value: dateStr },
        ]);

        const activeBookings = (bookingsData || []).filter((b) =>
          ["pending", "confirmed", "in_progress"].includes(b.status)
        );

        console.log("Found bookings:", activeBookings.length, activeBookings.map(b => ({
          groundId: b.groundId,
          startTime: b.startTime,
          endTime: b.endTime,
          status: b.status
        })));

        setBookings(activeBookings);

        // Fetch blocked slots for turf
        const blockedData = await queryDocuments("blocked_slots", [
          { field: "turfId", operator: "==", value: turfId },
        ]);
        setBlockedSlots(blockedData || []);
        setAvailabilityLoaded(true);
      } catch (error) {
        console.error("Error fetching availability:", error);
        setAvailabilityLoaded(true); // Mark as loaded even on error to prevent infinite loading
      } finally {
        setLoadingAvailability(false);
      }
    };

    fetchAvailability();
  }, [selectedTurf, selectedDate]);

  // Get available sports from selected turf
  const availableSports = useMemo(() => {
    if (!selectedTurf) return [];
    const sports = selectedTurf.sports || [];
    const groundSports = (selectedTurf.grounds || []).flatMap((g) => g.sports || []);
    const allSports = [...new Set([...sports, ...groundSports])];
    return allSports;
  }, [selectedTurf]);

  // Get grounds that support selected sport (with normalized IDs to match booking format)
  const filteredGrounds = useMemo(() => {
    if (!selectedTurf || !selectedSport) return [];

    // Normalize grounds to ensure they have proper IDs matching booking format
    const normalizedGrounds = (selectedTurf.grounds || []).map((g, index) => {
      // Ensure groundId matches the format used in bookings (ground_0, ground_1, etc.)
      const groundId = g.groundId || g.id || `ground_${index}`;
      // If the id is just a number, convert to ground_N format
      const normalizedId = typeof groundId === 'number' || /^\d+$/.test(groundId)
        ? `ground_${groundId}`
        : groundId;

      return {
        ...g,
        groundId: normalizedId,
        id: normalizedId,
      };
    });

    return normalizedGrounds.filter((g) =>
      (g.sports || []).some((s) => s.toLowerCase() === selectedSport.toLowerCase())
    );
  }, [selectedTurf, selectedSport]);

  // Normalize time to HH:MM format for consistent comparison
  const normalizeTime = (time) => {
    if (!time) return "";
    // Handle "HH:MM:SS" format by taking first 5 chars
    const normalized = time.substring(0, 5);
    return normalized;
  };

  // Check if a time slot is booked for a ground
  // groundInfo contains both id and name for matching
  const isSlotBooked = useCallback(
    (groundId, groundName, timeSlot) => {
      const normalizedGroundId = normalizeGroundId(groundId);
      const normalizedTimeSlot = normalizeTime(timeSlot);
      const normalizedGroundName = groundName?.toLowerCase().replace(/[\s-_]/g, "") || "";

      return bookings.some((booking) => {
        const bookingGroundId = normalizeGroundId(booking.groundId);
        const bookingGroundName = booking.groundName?.toLowerCase().replace(/[\s-_]/g, "") || "";

        // Check for any type of match
        const directIdMatch = booking.groundId === groundId;
        const normalizedIdMatch = bookingGroundId === normalizedGroundId;
        const nameMatch = normalizedGroundName && bookingGroundName &&
          (normalizedGroundName === bookingGroundName ||
           normalizedGroundName.includes(bookingGroundName) ||
           bookingGroundName.includes(normalizedGroundName));

        // Also check for index-based matching (ground_0 matches first ground, etc.)
        const bookingIndex = booking.groundId?.match(/ground[_-]?(\d+)/i)?.[1];
        const groundIndex = groundId?.match(/ground[_-]?(\d+)/i)?.[1];
        const indexMatch = bookingIndex !== undefined && groundIndex !== undefined && bookingIndex === groundIndex;

        const hasMatch = directIdMatch || normalizedIdMatch || nameMatch || indexMatch;

        if (!hasMatch) return false;

        const bookingStart = normalizeTime(booking.startTime);
        const bookingEnd = normalizeTime(booking.endTime);
        const hasOverlap = normalizedTimeSlot >= bookingStart && normalizedTimeSlot < bookingEnd;

        if (hasOverlap) {
          const matchType = directIdMatch ? "DIRECT_ID" :
                           normalizedIdMatch ? "NORMALIZED_ID" :
                           nameMatch ? "NAME" : "INDEX";
          console.log(`${matchType} MATCH - Slot ${timeSlot} is BOOKED: ground=${groundId}/${groundName}, booking=${booking.groundId}/${booking.groundName}, time=${bookingStart}-${bookingEnd}`);
        }

        return hasOverlap;
      });
    },
    [bookings]
  );

  // Check if a ground is blocked for the selected time range
  const isGroundBlocked = useCallback(
    (groundId) => {
      if (!startTime || !endTime || !selectedDate) return false;

      const dateStr = selectedDate.date;
      const dayOfWeek = selectedDate.fullDate
        .toLocaleDateString("en-US", { weekday: "long" })
        .toLowerCase();
      const normalizedGroundId = normalizeGroundId(groundId);
      const slotStartTime = startTime.time;
      const slotEndTime = endTime.time;

      return blockedSlots.some((block) => {
        // Check ground match
        if (block.groundId !== "all") {
          if (normalizeGroundId(block.groundId) !== normalizedGroundId) return false;
        }

        // Check date match based on block type
        if (block.blockType === "recurring") {
          if (dateStr < block.startDate || dateStr > (block.recurringEndDate || block.endDate))
            return false;
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
    },
    [blockedSlots, startTime, endTime, selectedDate]
  );

  // Check if time slot is in past
  const isSlotPast = useCallback(
    (slot) => {
      if (!selectedDate?.isToday) return false;
      const now = new Date();
      const slotTime = new Date();
      slotTime.setHours(slot.hour, slot.minute, 0, 0);
      return slotTime <= now;
    },
    [selectedDate]
  );

  // Check ground availability for selected time range
  const isGroundAvailable = useCallback(
    (ground) => {
      // Don't show as available until we've loaded availability data
      if (!availabilityLoaded) return false;

      if (!startTime || !endTime) return true;

      const groundId = ground.groundId || ground.id;
      const groundName = ground.name || ground.groundName;

      console.log(`Checking availability for ground: ${groundId} (${groundName}), time: ${startTime.time}-${endTime.time}, bookings count: ${bookings.length}`);
      console.log(`Bookings for comparison:`, bookings.map(b => ({ groundId: b.groundId, groundName: b.groundName, time: `${b.startTime}-${b.endTime}` })));

      // Check if blocked
      if (isGroundBlocked(groundId)) {
        console.log(`Ground ${groundId} is blocked`);
        return false;
      }

      // Check for booking conflicts
      const startIndex = TIME_SLOTS.findIndex((s) => s.time === startTime.time);
      const endIndex = TIME_SLOTS.findIndex((s) => s.time === endTime.time);

      for (let i = startIndex; i < endIndex; i++) {
        if (isSlotBooked(groundId, groundName, TIME_SLOTS[i].time)) {
          console.log(`Ground ${groundId} (${groundName}) has booking conflict at ${TIME_SLOTS[i].time}`);
          return false;
        }
      }

      console.log(`Ground ${groundId} (${groundName}) is available`);
      return true;
    },
    [startTime, endTime, isSlotBooked, isGroundBlocked, availabilityLoaded, bookings]
  );

  // Calculate price using priceUtils
  const originalPrice = useMemo(() => {
    if (!selectedGround || !selectedSport || !startTime || !endTime || !selectedDate) {
      return 0;
    }
    const result = calculateBookingPrice(
      selectedGround,
      selectedSport,
      selectedDate.date,
      startTime.time,
      endTime.time
    );
    return result.total;
  }, [selectedGround, selectedSport, selectedDate, startTime, endTime]);

  // Handle time slot selection
  const handleTimeSlotPress = (slot) => {
    if (isSlotPast(slot)) return;

    if (!startTime || (startTime && endTime)) {
      // Start new selection
      setStartTime(slot);
      setEndTime(null);
      setSelectedGround(null); // Reset ground selection when time changes
    } else {
      const startIndex = TIME_SLOTS.findIndex((s) => s.time === startTime.time);
      const slotIndex = TIME_SLOTS.findIndex((s) => s.time === slot.time);

      if (slotIndex <= startIndex) {
        setStartTime(slot);
        setEndTime(null);
        setSelectedGround(null);
      } else {
        // Ensure minimum 1 hour (2 slots)
        if (slotIndex - startIndex >= 2) {
          setEndTime(slot);
          setSelectedGround(null);
        } else {
          const minEndIndex = startIndex + 2;
          if (minEndIndex < TIME_SLOTS.length) {
            setEndTime(TIME_SLOTS[minEndIndex]);
            setSelectedGround(null);
          }
        }
      }
    }
  };

  // Check if slot is in selected range
  const isSlotInRange = (slot) => {
    if (!startTime) return false;
    if (!endTime) return slot.time === startTime.time;

    const slotIndex = TIME_SLOTS.findIndex((s) => s.time === slot.time);
    const startIndex = TIME_SLOTS.findIndex((s) => s.time === startTime.time);
    const endIndex = TIME_SLOTS.findIndex((s) => s.time === endTime.time);

    return slotIndex >= startIndex && slotIndex < endIndex;
  };

  // Navigation handlers
  const handleNextStep = () => {
    if (step === 1 && selectedTurf && selectedSport) {
      setStep(2);
    } else if (step === 2 && selectedDate && startTime && endTime) {
      setStep(3);
    } else if (step === 3 && selectedGround) {
      setStep(4);
    }
  };

  const handlePrevStep = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSubmit = () => {
    if (!canSubmit) return;

    const duration = calculateDuration(startTime.time, endTime.time);
    const finalPrice = willingToNegotiate ? parseInt(requestedPrice, 10) : originalPrice;

    const negotiationData = {
      turfId: selectedTurf.turfId || selectedTurf.id,
      turfName: selectedTurf.name,
      groundId: selectedGround.groundId || selectedGround.id,
      groundName: selectedGround.name,
      sport: selectedSport,
      date: selectedDate.date,
      startTime: startTime.time,
      endTime: endTime.time,
      duration,
      originalPrice,
      requestedPrice: finalPrice,
      isNegotiation: willingToNegotiate,
      message: message.trim(),
      senderId: userData?.id || userData?.userId || userData?.uid,
      senderType: "user",
      senderName: userData?.name || userData?.displayName || "User",
      senderPhone: userData?.phone || userData?.phoneNumber || "",
      senderEmail: userData?.email || "",
    };

    onSubmit(negotiationData);
  };

  // Validation
  const canProceedStep1 = selectedTurf && selectedSport;
  const canProceedStep2 =
    selectedDate && startTime && endTime && calculateDuration(startTime.time, endTime.time) > 0;
  const canProceedStep3 = selectedGround;
  const canSubmit =
    canProceedStep1 &&
    canProceedStep2 &&
    canProceedStep3 &&
    (!willingToNegotiate || (requestedPrice && parseInt(requestedPrice, 10) > 0));

  // Price validation
  const priceError = useMemo(() => {
    if (!willingToNegotiate || !requestedPrice) return "";
    const price = parseInt(requestedPrice, 10);
    if (isNaN(price) || price <= 0) return "Enter a valid price";
    if (price > originalPrice * 1.5) return "Price too high";
    return "";
  }, [requestedPrice, originalPrice, willingToNegotiate]);

  const discount = useMemo(() => {
    if (!willingToNegotiate || !requestedPrice || !originalPrice) return 0;
    const price = parseInt(requestedPrice, 10);
    if (price >= originalPrice) return 0;
    return Math.round(((originalPrice - price) / originalPrice) * 100);
  }, [requestedPrice, originalPrice, willingToNegotiate]);

  // Render Step 1: Select Turf & Sport
  const renderStep1 = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      {/* Turf Selection */}
      <Text variant="titleMedium" style={styles.sectionTitle}>
        Select Turf
      </Text>
      <View style={styles.chipContainer}>
        {turfs.map((turf) => (
          <Chip
            key={turf.turfId || turf.id}
            mode={selectedTurf?.turfId === turf.turfId || selectedTurf?.id === turf.id ? "flat" : "outlined"}
            selected={selectedTurf?.turfId === turf.turfId || selectedTurf?.id === turf.id}
            onPress={() => {
              setSelectedTurf(turf);
              setSelectedSport(null); // Reset sport when turf changes
              setSelectedDate(null);
              setStartTime(null);
              setEndTime(null);
              setSelectedGround(null);
              setAvailabilityLoaded(false);
              setBookings([]);
              setBlockedSlots([]);
            }}
            style={[
              styles.chip,
              (selectedTurf?.turfId === turf.turfId || selectedTurf?.id === turf.id) &&
                styles.selectedChip,
            ]}
            textStyle={
              selectedTurf?.turfId === turf.turfId || selectedTurf?.id === turf.id
                ? styles.selectedChipText
                : null
            }
          >
            {turf.name}
          </Chip>
        ))}
      </View>

      {/* Sport Selection */}
      {selectedTurf && availableSports.length > 0 && (
        <>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Select Sport
          </Text>
          <View style={styles.sportsGrid}>
            {availableSports.map((sport) => {
              const isSelected = selectedSport === sport;
              const icon = SPORT_ICONS[sport.toLowerCase()] || SPORT_ICONS.default;

              return (
                <TouchableOpacity
                  key={sport}
                  style={[styles.sportCard, isSelected && styles.sportCardSelected]}
                  onPress={() => setSelectedSport(sport)}
                >
                  <View style={[styles.sportIconContainer, isSelected && styles.sportIconSelected]}>
                    <MaterialCommunityIcons
                      name={icon}
                      size={28}
                      color={isSelected ? "#fff" : COLORS.primary}
                    />
                  </View>
                  <Text style={[styles.sportName, isSelected && styles.sportNameSelected]}>
                    {sport.charAt(0).toUpperCase() + sport.slice(1)}
                  </Text>
                  {isSelected && (
                    <MaterialCommunityIcons
                      name="check-circle"
                      size={18}
                      color={COLORS.primary}
                      style={styles.sportCheck}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}
    </ScrollView>
  );

  // Render Step 2: Select Date & Time
  const renderStep2 = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      {/* Date Selection */}
      <Text variant="titleMedium" style={styles.sectionTitle}>
        Select Date
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateScroll}>
        {dates.map((dateItem) => (
          <TouchableOpacity
            key={dateItem.date}
            style={[
              styles.dateCard,
              selectedDate?.date === dateItem.date && styles.selectedDateCard,
            ]}
            onPress={() => {
              setSelectedDate(dateItem);
              setSelectedGround(null); // Reset ground when date changes
              setAvailabilityLoaded(false); // Reset availability when date changes
            }}
          >
            <Text
              style={[
                styles.dateDay,
                selectedDate?.date === dateItem.date && styles.selectedDateText,
              ]}
            >
              {dateItem.dayName}
            </Text>
            <Text
              style={[
                styles.dateNum,
                selectedDate?.date === dateItem.date && styles.selectedDateText,
              ]}
            >
              {dateItem.dayNum}
            </Text>
            <Text
              style={[
                styles.dateMonth,
                selectedDate?.date === dateItem.date && styles.selectedDateText,
              ]}
            >
              {dateItem.month}
            </Text>
            {dateItem.isToday && (
              <View style={styles.todayBadge}>
                <Text style={styles.todayText}>Today</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Time Selection */}
      {selectedDate && (
        <>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Select Time (min 1 hour)
          </Text>

          {/* Selected time display */}
          {startTime && (
            <Surface style={styles.selectedTimeCard} elevation={1}>
              <View style={styles.selectedTimeRow}>
                <View style={styles.selectedTimeItem}>
                  <Text variant="labelSmall" style={styles.selectedTimeLabel}>
                    Start
                  </Text>
                  <Text variant="titleMedium" style={styles.selectedTimeValue}>
                    {startTime.displayTime}
                  </Text>
                </View>
                <MaterialCommunityIcons name="arrow-right" size={24} color="#999" />
                <View style={styles.selectedTimeItem}>
                  <Text variant="labelSmall" style={styles.selectedTimeLabel}>
                    End
                  </Text>
                  <Text variant="titleMedium" style={styles.selectedTimeValue}>
                    {endTime ? endTime.displayTime : "Select"}
                  </Text>
                </View>
                {startTime && endTime && (
                  <View style={styles.durationBadge}>
                    <Text style={styles.durationText}>
                      {calculateDuration(startTime.time, endTime.time)}h
                    </Text>
                  </View>
                )}
              </View>
            </Surface>
          )}

          {/* Time slots grid */}
          <View style={styles.timeSlotsGrid}>
            {TIME_SLOTS.map((slot) => {
              const isPast = isSlotPast(slot);
              const isInRange = isSlotInRange(slot);
              const isStart = startTime?.time === slot.time;

              return (
                <TouchableOpacity
                  key={slot.time}
                  style={[
                    styles.timeSlot,
                    isPast && styles.timeSlotPast,
                    isInRange && styles.timeSlotSelected,
                    isStart && styles.timeSlotStart,
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
                    {slot.displayTime}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}
    </ScrollView>
  );

  // Render Step 3: Available Grounds
  const renderStep3 = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      {/* Booking summary */}
      <Surface style={styles.bookingSummary} elevation={1}>
        <View style={styles.summaryRow}>
          <MaterialCommunityIcons name="stadium" size={18} color={COLORS.primary} />
          <Text variant="bodyMedium" style={styles.summaryText}>
            {selectedTurf?.name}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <MaterialCommunityIcons
            name={SPORT_ICONS[selectedSport?.toLowerCase()] || SPORT_ICONS.default}
            size={18}
            color={COLORS.primary}
          />
          <Text variant="bodyMedium" style={styles.summaryText}>
            {selectedSport}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <MaterialCommunityIcons name="calendar" size={18} color={COLORS.primary} />
          <Text variant="bodyMedium" style={styles.summaryText}>
            {selectedDate?.dayName}, {selectedDate?.dayNum} {selectedDate?.month}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <MaterialCommunityIcons name="clock-outline" size={18} color={COLORS.primary} />
          <Text variant="bodyMedium" style={styles.summaryText}>
            {startTime?.displayTime} - {endTime?.displayTime}
          </Text>
        </View>
      </Surface>

      <Text variant="titleMedium" style={styles.sectionTitle}>
        Available Grounds
      </Text>

      {(loadingAvailability || !availabilityLoaded) ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text variant="bodySmall" style={styles.loadingText}>
            Checking availability...
          </Text>
        </View>
      ) : filteredGrounds.length === 0 ? (
        <View style={styles.emptyGrounds}>
          <MaterialCommunityIcons name="soccer-field" size={48} color="#ccc" />
          <Text variant="bodyMedium" style={styles.emptyText}>
            No grounds available for {selectedSport}
          </Text>
        </View>
      ) : (
        filteredGrounds.map((ground) => {
          const groundId = ground.groundId || ground.id;
          const isAvailable = isGroundAvailable(ground);
          const isBlocked = isGroundBlocked(groundId);
          const isSelected = (selectedGround?.groundId || selectedGround?.id) === groundId;

          // Calculate price for this ground
          const price = calculateBookingPrice(
            ground,
            selectedSport,
            selectedDate?.date,
            startTime?.time,
            endTime?.time
          ).total;

          return (
            <TouchableOpacity
              key={groundId}
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
                    style={[styles.groundName, !isAvailable && styles.textUnavailable]}
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
                    style={[styles.priceValue, !isAvailable && styles.textUnavailable]}
                  >
                    ₹{price}
                  </Text>
                  <Text variant="bodySmall" style={styles.priceLabel}>
                    total
                  </Text>
                </View>
              </View>

              {/* Availability status */}
              <View style={styles.availabilityRow}>
                <View
                  style={[
                    styles.availabilityBadge,
                    isAvailable
                      ? styles.badgeAvailable
                      : isBlocked
                      ? styles.badgeBlocked
                      : styles.badgeUnavailable,
                  ]}
                >
                  <MaterialCommunityIcons
                    name={isAvailable ? "check-circle" : isBlocked ? "lock" : "close-circle"}
                    size={14}
                    color={isAvailable ? COLORS.primary : isBlocked ? "#FF9800" : "#F44336"}
                  />
                  <Text
                    style={[
                      styles.availabilityText,
                      isAvailable
                        ? styles.textAvailable
                        : isBlocked
                        ? styles.textBlocked
                        : styles.textUnavailableRed,
                    ]}
                  >
                    {isAvailable ? "Available" : isBlocked ? "Blocked" : "Booked"}
                  </Text>
                </View>
                {isSelected && (
                  <MaterialCommunityIcons name="check-circle" size={24} color={COLORS.primary} />
                )}
              </View>
            </TouchableOpacity>
          );
        })
      )}
    </ScrollView>
  );

  // Render Step 4: Price & Submit
  const renderStep4 = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      {/* Full Booking Summary */}
      <Surface style={styles.summarySurface} elevation={1}>
        <Text variant="titleMedium" style={styles.summaryTitle}>
          Booking Summary
        </Text>
        <View style={styles.summaryDetailRow}>
          <MaterialCommunityIcons name="stadium" size={18} color={COLORS.textSecondary} />
          <Text style={styles.summaryLabel}>Venue:</Text>
          <Text style={styles.summaryValue}>
            {selectedTurf?.name} - {selectedGround?.name}
          </Text>
        </View>
        <View style={styles.summaryDetailRow}>
          <MaterialCommunityIcons
            name={SPORT_ICONS[selectedSport?.toLowerCase()] || SPORT_ICONS.default}
            size={18}
            color={COLORS.textSecondary}
          />
          <Text style={styles.summaryLabel}>Sport:</Text>
          <Text style={styles.summaryValue}>
            {selectedSport?.charAt(0).toUpperCase() + selectedSport?.slice(1)}
          </Text>
        </View>
        <View style={styles.summaryDetailRow}>
          <MaterialCommunityIcons name="calendar" size={18} color={COLORS.textSecondary} />
          <Text style={styles.summaryLabel}>Date:</Text>
          <Text style={styles.summaryValue}>{formatDisplayDate(selectedDate?.date)}</Text>
        </View>
        <View style={styles.summaryDetailRow}>
          <MaterialCommunityIcons name="clock-outline" size={18} color={COLORS.textSecondary} />
          <Text style={styles.summaryLabel}>Time:</Text>
          <Text style={styles.summaryValue}>
            {startTime?.displayTime} - {endTime?.displayTime}
          </Text>
        </View>
        <View style={styles.summaryDetailRow}>
          <MaterialCommunityIcons name="timer-sand" size={18} color={COLORS.textSecondary} />
          <Text style={styles.summaryLabel}>Duration:</Text>
          <Text style={styles.summaryValue}>
            {calculateDuration(startTime?.time, endTime?.time)} hour(s)
          </Text>
        </View>
      </Surface>

      {/* Original Price */}
      <View style={styles.priceSection}>
        <View style={styles.originalPriceRow}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Booking Price
          </Text>
          <Text variant="headlineMedium" style={styles.originalPriceText}>
            ₹{originalPrice}
          </Text>
        </View>
      </View>

      {/* Willing to Negotiate Checkbox */}
      <TouchableOpacity
        style={styles.negotiateCheckbox}
        onPress={() => {
          setWillingToNegotiate(!willingToNegotiate);
          if (!willingToNegotiate) {
            setRequestedPrice(String(Math.round(originalPrice * 0.9))); // Default 10% discount
          }
        }}
      >
        <Checkbox
          status={willingToNegotiate ? "checked" : "unchecked"}
          onPress={() => {
            setWillingToNegotiate(!willingToNegotiate);
            if (!willingToNegotiate) {
              setRequestedPrice(String(Math.round(originalPrice * 0.9)));
            }
          }}
          color={COLORS.primary}
        />
        <Text variant="bodyMedium" style={styles.negotiateLabel}>
          I want to negotiate the price
        </Text>
      </TouchableOpacity>

      {/* Negotiation Price Input (only shown when willing to negotiate) */}
      {willingToNegotiate && (
        <View style={styles.negotiationPriceSection}>
          <View style={styles.priceCompare}>
            <View style={styles.priceBox}>
              <Text variant="labelSmall" style={styles.priceBoxLabel}>
                Original Price
              </Text>
              <Text variant="titleLarge" style={styles.priceBoxOriginal}>
                ₹{originalPrice}
              </Text>
            </View>
            <MaterialCommunityIcons name="arrow-right" size={24} color="#999" />
            <View style={styles.priceBox}>
              <Text variant="labelSmall" style={styles.priceBoxLabel}>
                Your Offer
              </Text>
              <TextInput
                mode="outlined"
                value={requestedPrice}
                onChangeText={setRequestedPrice}
                keyboardType="numeric"
                left={<TextInput.Affix text="₹" />}
                style={styles.priceInput}
                error={!!priceError}
                dense
              />
            </View>
          </View>
          {priceError ? (
            <HelperText type="error" visible={true}>
              {priceError}
            </HelperText>
          ) : discount > 0 ? (
            <HelperText type="info" visible={true} style={styles.discountText}>
              {discount}% discount requested
            </HelperText>
          ) : null}
        </View>
      )}

      {/* Message Input */}
      <View style={styles.messageSection}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Message (Optional)
        </Text>
        <TextInput
          mode="outlined"
          value={message}
          onChangeText={setMessage}
          multiline
          numberOfLines={3}
          placeholder="Add a note for the manager..."
          style={styles.messageInput}
          maxLength={200}
        />
        <Text variant="labelSmall" style={styles.charCount}>
          {message.length}/200
        </Text>
      </View>
    </ScrollView>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <Surface style={styles.modal} elevation={5}>
          {/* Header */}
          <View style={styles.header}>
            <Text variant="titleLarge" style={styles.headerTitle}>
              {step === 1 && "Select Venue & Sport"}
              {step === 2 && "Select Date & Time"}
              {step === 3 && "Select Ground"}
              {step === 4 && "Confirm & Request"}
            </Text>
            <IconButton icon="close" size={24} onPress={onDismiss} style={styles.closeButton} />
          </View>

          {/* Progress Indicator */}
          <View style={styles.progressContainer}>
            {[1, 2, 3, 4].map((s) => (
              <View
                key={s}
                style={[styles.progressDot, s <= step && styles.progressDotActive]}
              />
            ))}
          </View>

          {/* Step Content */}
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}

          {/* Footer with Navigation Buttons */}
          <View style={styles.footer}>
            {step > 1 && (
              <Button mode="outlined" onPress={handlePrevStep} style={styles.footerButton}>
                Back
              </Button>
            )}
            {step < 4 ? (
              <Button
                mode="contained"
                onPress={handleNextStep}
                disabled={
                  (step === 1 && !canProceedStep1) ||
                  (step === 2 && !canProceedStep2) ||
                  (step === 3 && !canProceedStep3)
                }
                style={[styles.footerButton, styles.nextButton]}
              >
                Next
              </Button>
            ) : (
              <Button
                mode="contained"
                onPress={handleSubmit}
                loading={isLoading}
                disabled={!canSubmit || isLoading || !!priceError}
                style={[styles.footerButton, styles.submitButton]}
                icon="send"
              >
                {willingToNegotiate ? "Send Request" : "Request Booking"}
              </Button>
            )}
          </View>
        </Surface>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modal: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.9,
    paddingBottom: Platform.OS === "ios" ? 34 : 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontWeight: "600",
    color: COLORS.text,
    flex: 1,
  },
  closeButton: {
    margin: 0,
  },
  progressContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#e0e0e0",
  },
  progressDotActive: {
    backgroundColor: COLORS.primary,
    width: 24,
  },
  stepContent: {
    paddingHorizontal: 20,
    minHeight: 300,
    maxHeight: SCREEN_HEIGHT * 0.55,
  },
  sectionTitle: {
    fontWeight: "600",
    color: COLORS.text,
    marginTop: 16,
    marginBottom: 12,
  },
  chipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    marginBottom: 4,
  },
  selectedChip: {
    backgroundColor: COLORS.primary,
  },
  selectedChipText: {
    color: "#fff",
  },

  // Sports Grid
  sportsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  sportCard: {
    width: "48%",
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#f5f5f5",
    alignItems: "center",
    marginBottom: 12,
    position: "relative",
  },
  sportCardSelected: {
    backgroundColor: COLORS.primary + "15",
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  sportIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary + "20",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  sportIconSelected: {
    backgroundColor: COLORS.primary,
  },
  sportName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
  },
  sportNameSelected: {
    color: COLORS.primary,
  },
  sportCheck: {
    position: "absolute",
    top: 8,
    right: 8,
  },

  // Date Selection
  dateScroll: {
    marginBottom: 8,
  },
  dateCard: {
    width: 70,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginRight: 10,
    borderRadius: 12,
    backgroundColor: "#f5f5f5",
    alignItems: "center",
  },
  selectedDateCard: {
    backgroundColor: COLORS.primary,
  },
  dateDay: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: "500",
  },
  dateNum: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
    marginVertical: 2,
  },
  dateMonth: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  selectedDateText: {
    color: "#fff",
  },
  todayBadge: {
    backgroundColor: COLORS.success,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  todayText: {
    fontSize: 9,
    color: "#fff",
    fontWeight: "600",
  },

  // Time Selection
  selectedTimeCard: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
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
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  durationText: {
    color: "#fff",
    fontWeight: "600",
  },
  timeSlotsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  timeSlot: {
    width: "24%",
    margin: "0.5%",
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#f5f5f5",
    alignItems: "center",
  },
  timeSlotPast: {
    backgroundColor: "#e0e0e0",
  },
  timeSlotSelected: {
    backgroundColor: COLORS.primary + "30",
  },
  timeSlotStart: {
    backgroundColor: COLORS.primary,
  },
  timeSlotText: {
    fontSize: 11,
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
    gap: 8,
  },
  summaryText: {
    color: "#333",
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 20,
  },
  loadingText: {
    marginTop: 8,
    color: COLORS.textSecondary,
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
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + "10",
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
    color: COLORS.primary,
  },
  priceLabel: {
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
    backgroundColor: COLORS.primary + "20",
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
    color: COLORS.primary,
  },
  textUnavailable: {
    color: "#999",
  },
  textUnavailableRed: {
    color: "#F44336",
  },
  textBlocked: {
    color: "#FF9800",
  },

  // Price Section (Step 4)
  summarySurface: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#f8f9fa",
    marginTop: 8,
  },
  summaryTitle: {
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 12,
  },
  summaryDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  summaryLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
    width: 60,
  },
  summaryValue: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  priceSection: {
    marginTop: 20,
  },
  originalPriceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  originalPriceText: {
    color: COLORS.primary,
    fontWeight: "bold",
  },
  negotiateCheckbox: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    backgroundColor: "#f5f5f5",
    padding: 8,
    borderRadius: 8,
  },
  negotiateLabel: {
    color: COLORS.text,
    flex: 1,
  },
  negotiationPriceSection: {
    marginTop: 16,
    padding: 16,
    backgroundColor: "#fff8e1",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ffe082",
  },
  priceCompare: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  priceBox: {
    flex: 1,
    alignItems: "center",
  },
  priceBoxLabel: {
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  priceBoxOriginal: {
    color: COLORS.textSecondary,
    textDecorationLine: "line-through",
  },
  priceInput: {
    backgroundColor: "#fff",
    width: "100%",
  },
  discountText: {
    color: COLORS.success,
    textAlign: "center",
  },
  messageSection: {
    marginTop: 16,
    marginBottom: 16,
  },
  messageInput: {
    backgroundColor: "#fff",
  },
  charCount: {
    textAlign: "right",
    color: COLORS.textSecondary,
    marginTop: 4,
  },

  // Footer
  footer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  footerButton: {
    flex: 1,
  },
  nextButton: {
    backgroundColor: COLORS.primary,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
  },
});

export default NegotiationRequestModal;
