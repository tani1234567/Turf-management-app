import { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
  Animated,
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
const MANAGER_BLUE = "#3B82F6";
const PALE_BLUE = "#DBEAFE";
const SUCCESS_GREEN = "#22C55E";
const WARN_ORANGE = "#F59E0B";
const DANGER_RED = "#EF4444";

// Calendar view types
const VIEW_TYPES = {
  DAY: "day",
  WEEK: "week",
  MONTH: "month",
};

// Status colors for bookings
const STATUS_COLORS = {
  pending: { bg: "#FEF3C7", color: "#F59E0B", label: "Pending" },
  confirmed: { bg: "#DBEAFE", color: "#3B82F6", label: "Confirmed" },
  in_progress: { bg: "#DCFCE7", color: "#22C55E", label: "In Progress" },
  completed: { bg: "#F3F4F6", color: "#9CA3AF", label: "Completed" },
  academy: { bg: "#FEF3C7", color: "#F97316", label: "Academy" },
  blocked: { bg: "#E5E7EB", color: "#6B7280", label: "Blocked" },
  cancelled: { bg: "#FEE2E2", color: "#EF4444", label: "Cancelled" },
  rejected: { bg: "#FEE2E2", color: "#EF4444", label: "Rejected" },
};

// Render priority: higher number = rendered on top (higher zIndex)
const STATUS_PRIORITY = {
  cancelled: 0,
  rejected: 1,
  expired: 2,
  pending_payment: 3,
  blocked: 4,
  pending: 5,
  academy: 6,
  completed: 7,
  confirmed: 8,
  in_progress: 9,
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

  // Slot selection state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectionStart, setSelectionStart] = useState(null); // hour index (0 = 6 AM)
  const [selectionEnd, setSelectionEnd] = useState(null);
  const [selectionGroundId, setSelectionGroundId] = useState(null);
  const selectionBarAnim = useRef(new Animated.Value(0)).current;
  const lastTapRef = useRef({ time: 0, slotIndex: -1 });

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

  // Animate selection bar in/out
  useEffect(() => {
    Animated.spring(selectionBarAnim, {
      toValue: selectionMode ? 1 : 0,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start();
  }, [selectionMode]);

  // Convert hour index to "HH:00" string (index 0 = 6 AM)
  const idxToTime = (idx) => `${String(idx + 6).padStart(2, "0")}:00`;

  // Check if a 1-hour slot is occupied by an active booking on the given ground
  const isSlotOccupied = useCallback((slotIndex, groundId, dateStr) => {
    const slotStart = idxToTime(slotIndex);
    const slotEnd = idxToTime(slotIndex + 1);
    return getEventsForDate(dateStr).some((e) => {
      if (["cancelled", "rejected", "expired"].includes(e.displayStatus)) return false;
      if (groundId && e.groundId && e.groundId !== groundId) return false;
      return e.startTime < slotEnd && e.endTime > slotStart;
    });
  }, [getEventsForDate]);

  // Check if the selected range has any conflicts
  const selectionHasConflict = useCallback((start, end, groundId, dateStr) => {
    for (let i = start; i <= end; i++) {
      if (isSlotOccupied(i, groundId, dateStr)) return true;
    }
    return false;
  }, [isSlotOccupied]);

  // Handle tapping on a time slot row
  const handleSlotTap = useCallback((slotIndex, dateStr) => {
    const DOUBLE_TAP_MS = 300;
    const now = Date.now();
    const last = lastTapRef.current;

    if (selectionMode) {
      // In selection mode: extend/adjust selection anchor
      setSelectionStart((prev) => Math.min(slotIndex, prev ?? slotIndex));
      setSelectionEnd((prev) => Math.max(slotIndex, prev ?? slotIndex));
      return;
    }

    if (now - last.time < DOUBLE_TAP_MS && last.slotIndex === slotIndex) {
      // Double-tap: enter selection mode
      const autoGround =
        grounds.length === 1
          ? grounds[0].id
          : groundFilter !== "all"
          ? groundFilter
          : null;
      setSelectionStart(slotIndex);
      setSelectionEnd(slotIndex);
      setSelectionGroundId(autoGround);
      setSelectionMode(true);
      lastTapRef.current = { time: 0, slotIndex: -1 };
    } else {
      lastTapRef.current = { time: now, slotIndex };
    }
  }, [selectionMode, grounds, groundFilter]);

  const clearSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectionStart(null);
    setSelectionEnd(null);
    setSelectionGroundId(null);
  }, []);

  const handleBookFromSelection = useCallback((dateStr) => {
    const start = idxToTime(selectionStart);
    const end = idxToTime((selectionEnd ?? selectionStart) + 1);
    clearSelection();
    navigation.navigate("CreateBooking", {
      prefill: { date: dateStr, startTime: start, endTime: end, groundId: selectionGroundId },
    });
  }, [selectionStart, selectionEnd, selectionGroundId, clearSelection, navigation]);

  const handleBlockFromSelection = useCallback((dateStr) => {
    const start = idxToTime(selectionStart);
    const end = idxToTime((selectionEnd ?? selectionStart) + 1);
    clearSelection();
    navigation.navigate("BlockSlots", {
      prefill: { date: dateStr, startTime: start, endTime: end, groundId: selectionGroundId },
    });
  }, [selectionStart, selectionEnd, selectionGroundId, clearSelection, navigation]);

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

    const normStart = selectionStart ?? 0;
    const normEnd = selectionEnd ?? normStart;
    const selTop = normStart * 60;
    const selHeight = (normEnd - normStart + 1) * 60;
    const hasConflict =
      selectionMode &&
      selectionHasConflict(normStart, normEnd, selectionGroundId, dateStr);

    return (
      <ScrollView
        style={styles.dayViewContainer}
        contentContainerStyle={selectionMode ? { paddingBottom: 200 } : undefined}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[MANAGER_BLUE]} />
        }
      >
        {/* Hint shown when not in selection mode */}
        {!selectionMode && (
          <View style={styles.selectionHint}>
            <MaterialCommunityIcons name="gesture-double-tap" size={14} color="#9CA3AF" />
            <Text style={styles.selectionHintText}>Double-tap an empty slot to select</Text>
          </View>
        )}

        <View style={styles.timeGrid}>
          {TIME_SLOTS.map((time, slotIndex) => {
            const occupied =
              selectionMode && isSlotOccupied(slotIndex, selectionGroundId, dateStr);
            const inSelection =
              selectionMode && slotIndex >= normStart && slotIndex <= normEnd;

            return (
              <TouchableOpacity
                key={time}
                activeOpacity={1}
                style={[
                  styles.timeRow,
                  selectionMode && styles.timeRowSelectable,
                  occupied && styles.timeRowOccupied,
                ]}
                onPress={() => {
                  if (selectionMode) {
                    if (!occupied) handleSlotTap(slotIndex, dateStr);
                  } else {
                    handleSlotTap(slotIndex, dateStr);
                  }
                }}
              >
                <Text style={styles.timeLabel}>{formatTime(time)}</Text>
                <View
                  style={[
                    styles.timeSlotLine,
                    inSelection && { backgroundColor: "transparent" },
                  ]}
                />
              </TouchableOpacity>
            );
          })}

          {/* Selection overlay */}
          {selectionMode && (
            <View
              pointerEvents="none"
              style={[
                styles.selectionOverlay,
                {
                  top: selTop,
                  height: selHeight,
                  backgroundColor: hasConflict
                    ? "rgba(239,68,68,0.15)"
                    : "rgba(59,130,246,0.15)",
                  borderColor: hasConflict ? DANGER_RED : MANAGER_BLUE,
                },
              ]}
            >
              <View style={styles.selectionOverlayHandleRow}>
                <View
                  style={[
                    styles.selectionOverlayHandle,
                    { backgroundColor: hasConflict ? DANGER_RED : MANAGER_BLUE },
                  ]}
                />
              </View>
              <Text
                style={[
                  styles.selectionOverlayLabel,
                  { color: hasConflict ? DANGER_RED : MANAGER_BLUE },
                ]}
              >
                {`${formatTime(idxToTime(normStart))} – ${formatTime(idxToTime(normEnd + 1))}`}
              </Text>
              {hasConflict && (
                <Text style={styles.selectionConflictLabel}>Booking exists</Text>
              )}
              <View style={styles.selectionOverlayHandleRow}>
                <View
                  style={[
                    styles.selectionOverlayHandle,
                    { backgroundColor: hasConflict ? DANGER_RED : MANAGER_BLUE },
                  ]}
                />
              </View>
            </View>
          )}

          <View style={styles.eventsContainer}>
            {events.map((event, index) => {
              const position = getBookingStyle(event);
              const priority = STATUS_PRIORITY[event.displayStatus] ?? 5;
              return (
                <View
                  key={event.id || index}
                  style={[
                    styles.eventWrapper,
                    { top: position.top, height: position.height, zIndex: priority },
                  ]}
                >
                  <BookingBlock booking={event} />
                </View>
              );
            })}
          </View>
        </View>

        {events.length === 0 && !selectionMode && (
          <View style={styles.noEventsDay}>
            <MaterialCommunityIcons name="calendar-blank" size={48} color="#ccc" />
            <Text style={styles.noEventsText}>No bookings for this day</Text>
          </View>
        )}
      </ScrollView>
    );
  };

  // Selection action bar
  const SelectionBar = () => {
    const dateStr = getDateString(selectedDate);
    const normStart = selectionStart ?? 0;
    const normEnd = selectionEnd ?? normStart;
    const durationHrs = normEnd - normStart + 1;
    const hasConflict = selectionHasConflict(normStart, normEnd, selectionGroundId, dateStr);

    const translateY = selectionBarAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [160, 0],
    });

    return (
      <Animated.View style={[styles.selectionBar, { transform: [{ translateY }] }]}>
        {/* Summary row */}
        <View style={styles.selectionBarHeader}>
          <View style={styles.selectionBarInfo}>
            <MaterialCommunityIcons name="clock-outline" size={15} color={MANAGER_BLUE} />
            <Text style={styles.selectionBarTime}>
              {`${formatTime(idxToTime(normStart))} – ${formatTime(idxToTime(normEnd + 1))}`}
            </Text>
            <View style={styles.selectionBarDot} />
            <Text style={styles.selectionBarDuration}>
              {durationHrs}h
            </Text>
          </View>
          <TouchableOpacity onPress={clearSelection} style={styles.selectionBarClose}>
            <MaterialCommunityIcons name="close" size={18} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* Ground picker (only when multiple grounds) */}
        {grounds.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.selectionGroundRow}
            contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}
          >
            {grounds.map((g) => (
              <TouchableOpacity
                key={g.id}
                style={[
                  styles.selectionGroundChip,
                  selectionGroundId === g.id && styles.selectionGroundChipActive,
                ]}
                onPress={() => setSelectionGroundId(g.id)}
              >
                <Text
                  style={[
                    styles.selectionGroundChipText,
                    selectionGroundId === g.id && styles.selectionGroundChipTextActive,
                  ]}
                >
                  {g.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {hasConflict && (
          <View style={styles.selectionConflictBanner}>
            <MaterialCommunityIcons name="alert-circle" size={14} color={DANGER_RED} />
            <Text style={styles.selectionConflictBannerText}>
              A booking already exists in this slot
            </Text>
          </View>
        )}

        {/* Action buttons */}
        <View style={styles.selectionBarActions}>
          <TouchableOpacity
            style={styles.selectionBlockBtn}
            onPress={() => handleBlockFromSelection(dateStr)}
          >
            <MaterialCommunityIcons name="lock-outline" size={16} color={WARN_ORANGE} />
            <Text style={styles.selectionBlockBtnText}>Block</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.selectionBookBtn,
              hasConflict && styles.selectionBookBtnDisabled,
            ]}
            disabled={hasConflict}
            onPress={() => handleBookFromSelection(dateStr)}
          >
            <MaterialCommunityIcons name="calendar-plus" size={16} color="#fff" />
            <Text style={styles.selectionBookBtnText}>Create Booking</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
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
          {viewType === VIEW_TYPES.DAY && DayView()}
          {viewType === VIEW_TYPES.WEEK && WeekView()}
          {viewType === VIEW_TYPES.MONTH && MonthView()}
        </>
      )}

      {/* Quick action FAB — hidden in selection mode */}
      {!selectionMode && (
        <FAB
          icon="plus"
          style={styles.fab}
          onPress={() => navigation.navigate("CreateBooking")}
          label="New Booking"
        />
      )}

      {/* Slot selection action bar */}
      {selectionMode && <SelectionBar />}

      {/* Dialogs */}
      <LegendDialog />
      <BookingDetailsDialog />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F0F4F8",
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: "row",
  },
  title: {
    fontSize: 18,
    fontFamily: "Ubuntu-Bold",
    color: "#111827",
  },
  turfName: {
    fontSize: 12,
    fontFamily: "Ubuntu-Regular",
    color: "#6B7280",
    marginTop: 1,
  },

  // View type selector
  viewSelector: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginVertical: 10,
    backgroundColor: "#E5E7EB",
    borderRadius: 10,
    padding: 4,
  },
  viewTypeButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  viewTypeButtonActive: {
    backgroundColor: "#fff",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  viewTypeText: {
    fontSize: 13,
    fontFamily: "Ubuntu-Medium",
    color: "#6B7280",
  },
  viewTypeTextActive: {
    fontFamily: "Ubuntu-Bold",
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
    fontFamily: "Ubuntu-Bold",
    fontSize: 15,
    color: "#111827",
  },
  goTodayText: {
    fontSize: 11,
    fontFamily: "Ubuntu-Medium",
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
    fontFamily: "Ubuntu-Regular",
    color: "#9CA3AF",
    textAlign: "right",
  },
  timeSlotLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E5E7EB",
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
    fontFamily: "Ubuntu-Regular",
    color: "#9CA3AF",
  },

  // Booking block
  bookingBlock: {
    borderRadius: 8,
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
    fontFamily: "Ubuntu-Bold",
  },
  bookingName: {
    fontSize: 12,
    fontFamily: "Ubuntu-Medium",
    color: "#374151",
    marginTop: 2,
  },
  bookingGround: {
    fontSize: 10,
    fontFamily: "Ubuntu-Regular",
    color: "#6B7280",
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
    backgroundColor: "#9CA3AF",
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
    borderRadius: 10,
  },
  weekDayHeaderToday: {
    backgroundColor: PALE_BLUE,
  },
  weekDayHeaderSelected: {
    borderWidth: 2,
    borderColor: MANAGER_BLUE,
  },
  weekDayName: {
    fontSize: 11,
    fontFamily: "Ubuntu-Medium",
    color: "#6B7280",
  },
  weekDayNameToday: {
    color: MANAGER_BLUE,
    fontFamily: "Ubuntu-Bold",
  },
  weekDayDate: {
    fontSize: 16,
    fontFamily: "Ubuntu-Bold",
    color: "#111827",
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
    fontFamily: "Ubuntu-Medium",
    color: MANAGER_BLUE,
  },
  noEventsWeek: {
    textAlign: "center",
    fontFamily: "Ubuntu-Regular",
    color: "#D1D5DB",
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
    fontFamily: "Ubuntu-Bold",
    color: "#6B7280",
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
    borderRadius: 8,
  },
  monthDayOther: {
    opacity: 0.4,
  },
  monthDayToday: {
    backgroundColor: PALE_BLUE,
  },
  monthDaySelected: {
    borderWidth: 2,
    borderColor: MANAGER_BLUE,
  },
  monthDayText: {
    fontSize: 14,
    fontFamily: "Ubuntu-Medium",
    color: "#374151",
  },
  monthDayTextOther: {
    color: "#9CA3AF",
  },
  monthDayTextToday: {
    fontFamily: "Ubuntu-Bold",
    color: MANAGER_BLUE,
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
    fontFamily: "Ubuntu-Regular",
    color: "#374151",
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
    fontFamily: "Ubuntu-Regular",
    color: "#6B7280",
    width: 70,
  },
  detailValue: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Ubuntu-Medium",
    color: "#111827",
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  emptyTitle: {
    marginTop: 16,
    fontFamily: "Ubuntu-Bold",
    fontSize: 16,
    color: "#111827",
  },
  emptyText: {
    marginTop: 8,
    fontFamily: "Ubuntu-Regular",
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 20,
  },

  // Slot selection hint
  selectionHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 6,
    backgroundColor: "#F9FAFB",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  selectionHintText: {
    fontSize: 11,
    fontFamily: "Ubuntu-Regular",
    color: "#9CA3AF",
  },

  // Pressable time rows
  timeRowSelectable: {
    backgroundColor: "rgba(59,130,246,0.03)",
  },
  timeRowOccupied: {
    opacity: 0.5,
  },

  // Selection overlay (absolutely positioned on timeGrid)
  selectionOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    borderWidth: 1.5,
    borderRadius: 8,
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 4,
    zIndex: 20,
  },
  selectionOverlayHandleRow: {
    alignItems: "center",
  },
  selectionOverlayHandle: {
    width: 28,
    height: 3,
    borderRadius: 2,
    opacity: 0.6,
  },
  selectionOverlayLabel: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 13,
    textAlign: "center",
    marginVertical: 2,
  },
  selectionConflictLabel: {
    fontFamily: "Ubuntu-Medium",
    fontSize: 11,
    color: DANGER_RED,
    textAlign: "center",
  },

  // Selection action bar
  selectionBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 16,
    zIndex: 100,
  },
  selectionBarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  selectionBarInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  selectionBarTime: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 15,
    color: "#111827",
  },
  selectionBarDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#9CA3AF",
  },
  selectionBarDuration: {
    fontFamily: "Ubuntu-Medium",
    fontSize: 13,
    color: "#6B7280",
  },
  selectionBarClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  selectionGroundRow: {
    marginBottom: 12,
    maxHeight: 36,
  },
  selectionGroundChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
  },
  selectionGroundChipActive: {
    borderColor: MANAGER_BLUE,
    backgroundColor: PALE_BLUE,
  },
  selectionGroundChipText: {
    fontFamily: "Ubuntu-Medium",
    fontSize: 13,
    color: "#6B7280",
  },
  selectionGroundChipTextActive: {
    color: MANAGER_BLUE,
  },
  selectionConflictBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF2F2",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: DANGER_RED,
  },
  selectionConflictBannerText: {
    fontFamily: "Ubuntu-Medium",
    fontSize: 12,
    color: DANGER_RED,
  },
  selectionBarActions: {
    flexDirection: "row",
    gap: 10,
  },
  selectionBlockBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: WARN_ORANGE,
    backgroundColor: "#FFFBEB",
  },
  selectionBlockBtnText: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 14,
    color: WARN_ORANGE,
  },
  selectionBookBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: MANAGER_BLUE,
  },
  selectionBookBtnDisabled: {
    backgroundColor: "#9CA3AF",
  },
  selectionBookBtnText: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 14,
    color: "#fff",
  },

  // FAB
  fab: {
    position: "absolute",
    right: 16,
    bottom: 16,
    backgroundColor: MANAGER_BLUE,
  },
});
