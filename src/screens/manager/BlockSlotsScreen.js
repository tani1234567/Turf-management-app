import { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from "react-native";
import {
  Text,
  Surface,
  Button,
  TextInput,
  Chip,
  Divider,
  ActivityIndicator,
  Switch,
  IconButton,
  Portal,
  Dialog,
  FAB,
  SegmentedButtons,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSelectedTurf } from "../../hooks/useSelectedTurf";
import { useAppSelector } from "../../hooks";
import { selectUser } from "../../store/slices/authSlice";
import {
  queryDocuments,
  addDocument,
  deleteDocument,
  subscribeToCollection,
} from "../../services/firebase/firestore";

const SCREEN_WIDTH = Dimensions.get("window").width;
const MANAGER_BLUE = "#3B82F6";
const PALE_BLUE = "#DBEAFE";
const SUCCESS_GREEN = "#22C55E";
const WARN_ORANGE = "#F59E0B";
const DANGER_RED = "#EF4444";

// Block types
const BLOCK_TYPES = {
  SINGLE: "single",
  RANGE: "range",
  RECURRING: "recurring",
};

// Days of week for recurring blocks
const DAYS_OF_WEEK = [
  { value: "sunday", label: "Sun", short: "S" },
  { value: "monday", label: "Mon", short: "M" },
  { value: "tuesday", label: "Tue", short: "T" },
  { value: "wednesday", label: "Wed", short: "W" },
  { value: "thursday", label: "Thu", short: "T" },
  { value: "friday", label: "Fri", short: "F" },
  { value: "saturday", label: "Sat", short: "S" },
];

// Common block reasons
const COMMON_REASONS = [
  { value: "maintenance", label: "Maintenance", icon: "wrench" },
  { value: "private_event", label: "Private Event", icon: "party-popper" },
  { value: "tournament", label: "Tournament", icon: "trophy" },
  { value: "weather", label: "Weather", icon: "weather-cloudy" },
  { value: "other", label: "Other", icon: "dots-horizontal" },
];

// Generate time slots (6 AM to 11 PM, 30-min intervals)
const formatTimeLabel = (hour, minute) => {
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${minute.toString().padStart(2, "0")} ${ampm}`;
};

const TIME_SLOTS = (() => {
  const slots = [];
  for (let hour = 6; hour <= 23; hour++) {
    slots.push({
      time: `${hour.toString().padStart(2, "0")}:00`,
      label: formatTimeLabel(hour, 0),
    });
    if (hour < 23) {
      slots.push({
        time: `${hour.toString().padStart(2, "0")}:30`,
        label: formatTimeLabel(hour, 30),
      });
    }
  }
  return slots;
})();

// Helper functions
const getDateString = (date) => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const formatDate = (date) => {
  if (typeof date === "string") {
    date = new Date(date);
  }
  return date.toLocaleDateString("en-IN", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
};

const formatFullDate = (date) => {
  if (typeof date === "string") {
    date = new Date(date);
  }
  return date.toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

// Generate dates for calendar preview (next 45 days)
const AVAILABLE_DATES = (() => {
  const dates = [];
  const today = new Date();
  for (let i = 0; i < 45; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    dates.push(date);
  }
  return dates;
})();

// Check if two time ranges overlap
const hasTimeOverlap = (start1, end1, start2, end2) => {
  return start1 < end2 && end1 > start2;
};

// Get all dates in a range
const getDatesInRange = (startDate, endDate) => {
  const dates = [];
  const current = new Date(startDate);
  const end = new Date(endDate);
  while (current <= end) {
    dates.push(getDateString(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
};

// Check if a date matches recurring days
const matchesRecurringDays = (dateStr, recurringDays) => {
  const date = new Date(dateStr);
  const dayName = DAYS_OF_WEEK[date.getDay()].value;
  return recurringDays.includes(dayName);
};

// Normalize ground ID for comparison
const normalizeGroundId = (groundId) => {
  if (!groundId) return "";
  return groundId.toLowerCase().replace(/[-_]/g, "");
};

export default function BlockSlotsScreen({ navigation }) {
  const { selectedTurfId, turfData } = useSelectedTurf();
  const user = useAppSelector(selectUser);

  // View mode: 'create' or 'list'
  const [viewMode, setViewMode] = useState("list");

  // Block type
  const [blockType, setBlockType] = useState(BLOCK_TYPES.SINGLE);

  // Date selection
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [recurringDays, setRecurringDays] = useState([]);
  const [recurringEndDate, setRecurringEndDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    return date;
  });

  // Ground selection
  const [selectedGround, setSelectedGround] = useState(null);
  const [allGrounds, setAllGrounds] = useState(false);

  // Time selection
  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);
  const [allDay, setAllDay] = useState(false);

  // Reason
  const [reasonType, setReasonType] = useState("maintenance");
  const [customReason, setCustomReason] = useState("");

  // Data state
  const [grounds, setGrounds] = useState([]);
  const [existingBlocks, setExistingBlocks] = useState([]);
  const [existingBookings, setExistingBookings] = useState([]);
  const [conflictingBookings, setConflictingBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Dialog state
  const [conflictDialogVisible, setConflictDialogVisible] = useState(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [blockToDelete, setBlockToDelete] = useState(null);

  // Load grounds from turf data
  useEffect(() => {
    if (!turfData) {
      setGrounds([]);
      return;
    }

    const groundsData = turfData.grounds || [];
    const groundsWithIds = groundsData.map((g, index) => ({
      ...g,
      id: g.id || `ground_${index}`,
    }));
    setGrounds(groundsWithIds);
  }, [turfData]);

  // Subscribe to existing blocked slots
  useEffect(() => {
    if (!selectedTurfId) {
      setExistingBlocks([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribe = subscribeToCollection(
      "blocked_slots",
      (docs) => {
        setExistingBlocks(docs);
        setLoading(false);
      },
      [{ field: "turfId", operator: "==", value: selectedTurfId }]
    );

    return () => unsubscribe();
  }, [selectedTurfId]);

  // Load existing bookings for conflict checking
  useEffect(() => {
    if (!selectedTurfId || viewMode !== "create") return;

    const loadBookings = async () => {
      try {
        // Get date range to check
        let datesToCheck = [];
        if (blockType === BLOCK_TYPES.SINGLE) {
          datesToCheck = [getDateString(startDate)];
        } else if (blockType === BLOCK_TYPES.RANGE) {
          datesToCheck = getDatesInRange(startDate, endDate);
        } else if (blockType === BLOCK_TYPES.RECURRING) {
          const allDates = getDatesInRange(startDate, recurringEndDate);
          datesToCheck = allDates.filter((d) => matchesRecurringDays(d, recurringDays));
        }

        if (datesToCheck.length === 0) {
          setExistingBookings([]);
          return;
        }

        // Query bookings for these dates
        const bookings = await queryDocuments("bookings", [
          { field: "turfId", operator: "==", value: selectedTurfId },
        ]);

        // Filter bookings by date and status
        const relevantBookings = bookings.filter(
          (b) =>
            datesToCheck.includes(b.date) &&
            ["pending", "confirmed", "in_progress"].includes(b.status)
        );

        setExistingBookings(relevantBookings);
      } catch (error) {
        console.error("Error loading bookings:", error);
      }
    };

    loadBookings();
  }, [selectedTurfId, viewMode, blockType, startDate, endDate, recurringDays, recurringEndDate]);

  // Check for conflicts when parameters change
  useEffect(() => {
    if (!startTime || !endTime || viewMode !== "create") {
      setConflictingBookings([]);
      return;
    }

    const effectiveStartTime = allDay ? "06:00" : startTime;
    const effectiveEndTime = allDay ? "23:00" : endTime;

    // Filter bookings that conflict with the block parameters
    const conflicts = existingBookings.filter((booking) => {
      // Check ground match
      if (!allGrounds && selectedGround) {
        const normalizedSelected = normalizeGroundId(selectedGround.id);
        const normalizedBooking = normalizeGroundId(booking.groundId);
        if (normalizedSelected !== normalizedBooking) return false;
      }

      // Check time overlap
      return hasTimeOverlap(effectiveStartTime, effectiveEndTime, booking.startTime, booking.endTime);
    });

    setConflictingBookings(conflicts);
  }, [existingBookings, selectedGround, allGrounds, startTime, endTime, allDay, viewMode]);

  // Handle time slot selection
  const handleTimeSlotPress = useCallback((slot) => {
    if (allDay) return;

    if (!startTime || (startTime && endTime)) {
      setStartTime(slot.time);
      setEndTime(null);
    } else {
      if (slot.time > startTime) {
        setEndTime(slot.time);
      } else if (slot.time < startTime) {
        setEndTime(startTime);
        setStartTime(slot.time);
      }
    }
  }, [startTime, endTime, allDay]);

  // Get slot style
  const getSlotStyle = useCallback((slot) => {
    if (allDay) return styles.slotAllDay;

    const isStart = slot.time === startTime;
    const isEnd = slot.time === endTime;
    const isInRange = startTime && endTime && slot.time >= startTime && slot.time < endTime;

    if (isStart || isEnd) return styles.slotSelected;
    if (isInRange) return styles.slotInRange;
    return styles.slotAvailable;
  }, [startTime, endTime, allDay]);

  // Toggle recurring day
  const toggleRecurringDay = useCallback((day) => {
    setRecurringDays((prev) => {
      if (prev.includes(day)) {
        return prev.filter((d) => d !== day);
      }
      return [...prev, day];
    });
  }, []);

  // Get effective dates for preview
  const getPreviewDates = useMemo(() => {
    if (blockType === BLOCK_TYPES.SINGLE) {
      return [getDateString(startDate)];
    } else if (blockType === BLOCK_TYPES.RANGE) {
      return getDatesInRange(startDate, endDate);
    } else if (blockType === BLOCK_TYPES.RECURRING && recurringDays.length > 0) {
      const allDates = getDatesInRange(startDate, recurringEndDate);
      return allDates.filter((d) => matchesRecurringDays(d, recurringDays));
    }
    return [];
  }, [blockType, startDate, endDate, recurringDays, recurringEndDate]);

  // Create the block
  const handleCreateBlock = async () => {
    // Validation
    if (!allGrounds && !selectedGround) {
      Alert.alert("Error", "Please select a ground or choose 'All Grounds'");
      return;
    }
    if (!allDay && (!startTime || !endTime)) {
      Alert.alert("Error", "Please select time range or enable 'All Day'");
      return;
    }
    if (blockType === BLOCK_TYPES.RECURRING && recurringDays.length === 0) {
      Alert.alert("Error", "Please select at least one day for recurring block");
      return;
    }
    if (blockType === BLOCK_TYPES.RANGE && endDate < startDate) {
      Alert.alert("Error", "End date must be after start date");
      return;
    }

    // Check for conflicts
    if (conflictingBookings.length > 0) {
      setConflictDialogVisible(true);
      return;
    }

    await createBlock();
  };

  // Actually create the block
  const createBlock = async () => {
    setSubmitting(true);

    try {
      const effectiveStartTime = allDay ? "06:00" : startTime;
      const effectiveEndTime = allDay ? "23:00" : endTime;

      const reason = reasonType === "other" ? customReason : COMMON_REASONS.find((r) => r.value === reasonType)?.label;

      // Create block data based on type
      const blockData = {
        turfId: selectedTurfId,
        turfName: turfData?.name,
        groundId: allGrounds ? "all" : selectedGround.id,
        groundName: allGrounds ? "All Grounds" : selectedGround.name,
        blockType: blockType,
        startDate: getDateString(startDate),
        endDate: blockType === BLOCK_TYPES.RANGE ? getDateString(endDate) : getDateString(startDate),
        startTime: effectiveStartTime,
        endTime: effectiveEndTime,
        allDay: allDay,
        reason: reason || "Blocked",
        reasonType: reasonType,
        blockedBy: user?.userId,
        blockedByName: user?.name || user?.displayName || "Manager",
        blockedByRole: user?.role || "manager",
      };

      // Add recurring specific fields
      if (blockType === BLOCK_TYPES.RECURRING) {
        blockData.recurringDays = recurringDays;
        blockData.recurringEndDate = getDateString(recurringEndDate);
        blockData.endDate = getDateString(recurringEndDate);
      }

      await addDocument("blocked_slots", blockData);

      Alert.alert("Success", "Slots blocked successfully!", [
        {
          text: "Create Another",
          onPress: resetForm,
        },
        {
          text: "View Blocks",
          onPress: () => setViewMode("list"),
        },
      ]);
    } catch (error) {
      console.error("Error creating block:", error);
      Alert.alert("Error", "Failed to create block. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Delete a block
  const handleDeleteBlock = async () => {
    if (!blockToDelete) return;

    try {
      await deleteDocument("blocked_slots", blockToDelete.id);
      Alert.alert("Success", "Block removed successfully");
    } catch (error) {
      console.error("Error deleting block:", error);
      Alert.alert("Error", "Failed to remove block. Please try again.");
    } finally {
      setDeleteDialogVisible(false);
      setBlockToDelete(null);
    }
  };

  // Reset form
  const resetForm = () => {
    setBlockType(BLOCK_TYPES.SINGLE);
    setStartDate(new Date());
    setEndDate(new Date());
    setRecurringDays([]);
    setRecurringEndDate(() => {
      const date = new Date();
      date.setMonth(date.getMonth() + 1);
      return date;
    });
    setSelectedGround(null);
    setAllGrounds(false);
    setStartTime(null);
    setEndTime(null);
    setAllDay(false);
    setReasonType("maintenance");
    setCustomReason("");
    setConflictingBookings([]);
  };

  // Filter active blocks (not expired)
  const activeBlocks = useMemo(() => {
    const today = getDateString(new Date());
    return existingBlocks.filter((block) => {
      const endDate = block.recurringEndDate || block.endDate || block.startDate;
      return endDate >= today;
    });
  }, [existingBlocks]);

  // Past blocks
  const pastBlocks = useMemo(() => {
    const today = getDateString(new Date());
    return existingBlocks.filter((block) => {
      const endDate = block.recurringEndDate || block.endDate || block.startDate;
      return endDate < today;
    });
  }, [existingBlocks]);

  // Check if a date is blocked for calendar preview
  const isDateBlocked = useCallback((dateStr) => {
    return getPreviewDates.includes(dateStr);
  }, [getPreviewDates]);

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
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        {/* Header */}
        <View style={styles.header}>
          <IconButton
            icon="arrow-left"
            size={24}
            onPress={() => navigation.goBack()}
          />
          <View style={styles.headerCenter}>
            <Text variant="titleMedium" style={styles.headerTitle}>
              Block Slots
            </Text>
            <Text variant="bodySmall" style={styles.headerSubtitle}>
              {turfData?.name}
            </Text>
          </View>
          <IconButton
            icon={viewMode === "list" ? "plus" : "format-list-bulleted"}
            size={24}
            onPress={() => setViewMode(viewMode === "list" ? "create" : "list")}
          />
        </View>

        {/* View mode toggle */}
        <View style={styles.viewToggleContainer}>
          <SegmentedButtons
            value={viewMode}
            onValueChange={setViewMode}
            buttons={[
              { value: "list", label: "View Blocks", icon: "format-list-bulleted" },
              { value: "create", label: "Create Block", icon: "plus" },
            ]}
            style={styles.viewToggle}
          />
        </View>

        {/* Content */}
        {viewMode === "list" ? (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={MANAGER_BLUE} />
              </View>
            ) : (
              <>
                {/* Active Blocks */}
                <Text variant="titleMedium" style={styles.sectionTitle}>
                  Active Blocks ({activeBlocks.length})
                </Text>

                {activeBlocks.length === 0 ? (
                  <Surface style={styles.noBlocksCard} elevation={1}>
                    <MaterialCommunityIcons name="calendar-check" size={48} color="#ccc" />
                    <Text style={styles.noBlocksText}>No active blocks</Text>
                    <Button
                      mode="contained"
                      onPress={() => setViewMode("create")}
                      style={styles.createBlockButton}
                      buttonColor={MANAGER_BLUE}
                    >
                      Create Block
                    </Button>
                  </Surface>
                ) : (
                  activeBlocks.map((block) => (
                    <BlockCard
                      key={block.id}
                      block={block}
                      onDelete={() => {
                        setBlockToDelete(block);
                        setDeleteDialogVisible(true);
                      }}
                    />
                  ))
                )}

                {/* Past Blocks */}
                {pastBlocks.length > 0 && (
                  <>
                    <Text variant="titleMedium" style={[styles.sectionTitle, { marginTop: 24 }]}>
                      Past Blocks ({pastBlocks.length})
                    </Text>
                    {pastBlocks.slice(0, 5).map((block) => (
                      <BlockCard
                        key={block.id}
                        block={block}
                        isPast
                        onDelete={() => {
                          setBlockToDelete(block);
                          setDeleteDialogVisible(true);
                        }}
                      />
                    ))}
                    {pastBlocks.length > 5 && (
                      <Text style={styles.morePastBlocks}>
                        + {pastBlocks.length - 5} more past blocks
                      </Text>
                    )}
                  </>
                )}
              </>
            )}
          </ScrollView>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Block Type Selection */}
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Block Type
            </Text>

            <View style={styles.blockTypes}>
              {[
                { type: BLOCK_TYPES.SINGLE, label: "Single Day", icon: "calendar" },
                { type: BLOCK_TYPES.RANGE, label: "Date Range", icon: "calendar-range" },
                { type: BLOCK_TYPES.RECURRING, label: "Recurring", icon: "calendar-sync" },
              ].map((item) => (
                <TouchableOpacity
                  key={item.type}
                  style={[
                    styles.blockTypeCard,
                    blockType === item.type && styles.blockTypeCardActive,
                  ]}
                  onPress={() => setBlockType(item.type)}
                >
                  <MaterialCommunityIcons
                    name={item.icon}
                    size={24}
                    color={blockType === item.type ? MANAGER_BLUE : "#666"}
                  />
                  <Text
                    style={[
                      styles.blockTypeText,
                      blockType === item.type && styles.blockTypeTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Date Selection */}
            <Text variant="titleMedium" style={styles.sectionTitle}>
              {blockType === BLOCK_TYPES.SINGLE
                ? "Select Date"
                : blockType === BLOCK_TYPES.RANGE
                ? "Select Date Range"
                : "Select Start Date & Days"}
            </Text>

            {blockType === BLOCK_TYPES.RANGE && (
              <Text style={styles.dateRangeHint}>
                {getDateString(startDate) === getDateString(endDate)
                  ? "Tap start date selected. Now tap end date."
                  : `Selected: ${formatDate(startDate)} to ${formatDate(endDate)}`}
              </Text>
            )}

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.dateScroll}
              contentContainerStyle={styles.dateScrollContent}
            >
              {AVAILABLE_DATES.map((date, index) => {
                const dateStr = getDateString(date);
                const startDateStr = getDateString(startDate);
                const endDateStr = getDateString(endDate);
                const isSelected = dateStr === startDateStr;
                // Only show end selected if start and end are different dates
                const isEndSelected = blockType === BLOCK_TYPES.RANGE &&
                  dateStr === endDateStr &&
                  startDateStr !== endDateStr;
                const isInRange =
                  blockType === BLOCK_TYPES.RANGE &&
                  date > startDate &&
                  date < endDate;
                const isBlocked = isDateBlocked(dateStr);
                const isToday = dateStr === getDateString(new Date());

                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.dateCard,
                      isSelected && styles.dateCardSelected,
                      isEndSelected && styles.dateCardEndSelected,
                      isInRange && styles.dateCardInRange,
                      isBlocked && !isSelected && !isEndSelected && styles.dateCardBlocked,
                      isToday && !isSelected && styles.dateCardToday,
                    ]}
                    onPress={() => {
                      if (blockType === BLOCK_TYPES.SINGLE) {
                        setStartDate(date);
                      } else if (blockType === BLOCK_TYPES.RANGE) {
                        // Check if start and end are the same (user selecting end date)
                        const startDateStr = getDateString(startDate);
                        const endDateStr = getDateString(endDate);

                        if (startDateStr === endDateStr) {
                          // User is selecting end date
                          if (date >= startDate) {
                            setEndDate(date);
                          } else {
                            // If selected date is before start, make it new start
                            setEndDate(startDate);
                            setStartDate(date);
                          }
                        } else {
                          // Range already selected, start new selection
                          setStartDate(date);
                          setEndDate(date);
                        }
                      } else {
                        setStartDate(date);
                      }
                    }}
                  >
                    <Text
                      style={[
                        styles.dateDay,
                        (isSelected || isEndSelected) && styles.dateDaySelected,
                      ]}
                    >
                      {date.toLocaleDateString("en-IN", { weekday: "short" })}
                    </Text>
                    <Text
                      style={[
                        styles.dateNum,
                        (isSelected || isEndSelected) && styles.dateNumSelected,
                      ]}
                    >
                      {date.getDate()}
                    </Text>
                    {isBlocked && !isSelected && !isEndSelected && (
                      <View style={styles.blockedIndicator} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Recurring Days Selection */}
            {blockType === BLOCK_TYPES.RECURRING && (
              <>
                <Text variant="titleMedium" style={styles.sectionTitle}>
                  Repeat on Days
                </Text>
                <View style={styles.recurringDays}>
                  {DAYS_OF_WEEK.map((day) => (
                    <TouchableOpacity
                      key={day.value}
                      style={[
                        styles.dayButton,
                        recurringDays.includes(day.value) && styles.dayButtonActive,
                      ]}
                      onPress={() => toggleRecurringDay(day.value)}
                    >
                      <Text
                        style={[
                          styles.dayButtonText,
                          recurringDays.includes(day.value) && styles.dayButtonTextActive,
                        ]}
                      >
                        {day.short}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text variant="titleMedium" style={styles.sectionTitle}>
                  Until Date
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.dateScroll}
                  contentContainerStyle={styles.dateScrollContent}
                >
                  {AVAILABLE_DATES.map((date, index) => {
                    const dateStr = getDateString(date);
                    const isSelected = dateStr === getDateString(recurringEndDate);
                    const isToday = dateStr === getDateString(new Date());

                    if (date < startDate) return null;

                    return (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.dateCard,
                          isSelected && styles.dateCardEndSelected,
                          isToday && !isSelected && styles.dateCardToday,
                        ]}
                        onPress={() => setRecurringEndDate(date)}
                      >
                        <Text
                          style={[
                            styles.dateDay,
                            isSelected && styles.dateDaySelected,
                          ]}
                        >
                          {date.toLocaleDateString("en-IN", { weekday: "short" })}
                        </Text>
                        <Text
                          style={[
                            styles.dateNum,
                            isSelected && styles.dateNumSelected,
                          ]}
                        >
                          {date.getDate()}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            )}

            {/* Ground Selection */}
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Select Ground
            </Text>

            <View style={styles.allGroundsRow}>
              <Text variant="bodyMedium">Block All Grounds</Text>
              <Switch
                value={allGrounds}
                onValueChange={(value) => {
                  setAllGrounds(value);
                  if (value) setSelectedGround(null);
                }}
                color={MANAGER_BLUE}
              />
            </View>

            {!allGrounds && (
              <View style={styles.groundsList}>
                {grounds.map((ground) => {
                  const isSelected = selectedGround?.id === ground.id;
                  return (
                    <TouchableOpacity
                      key={ground.id}
                      style={[
                        styles.groundCard,
                        isSelected && styles.groundCardSelected,
                      ]}
                      onPress={() => setSelectedGround(ground)}
                    >
                      <View style={styles.groundInfo}>
                        <Text
                          variant="titleSmall"
                          style={[
                            styles.groundName,
                            isSelected && styles.groundNameSelected,
                          ]}
                        >
                          {ground.name}
                        </Text>
                        {ground.sports && (
                          <Text variant="bodySmall" style={styles.groundSports}>
                            {ground.sports.join(", ")}
                          </Text>
                        )}
                      </View>
                      {isSelected && (
                        <MaterialCommunityIcons
                          name="check-circle"
                          size={24}
                          color={MANAGER_BLUE}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Time Selection */}
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Select Time Range
            </Text>

            <View style={styles.allDayRow}>
              <Text variant="bodyMedium">Block Entire Day</Text>
              <Switch
                value={allDay}
                onValueChange={(value) => {
                  setAllDay(value);
                  if (value) {
                    setStartTime("06:00");
                    setEndTime("23:00");
                  } else {
                    setStartTime(null);
                    setEndTime(null);
                  }
                }}
                color={MANAGER_BLUE}
              />
            </View>

            {!allDay && (
              <>
                {startTime && (
                  <Surface style={styles.timeRangeDisplay} elevation={1}>
                    <View style={styles.timeRangeItem}>
                      <Text style={styles.timeRangeLabel}>Start</Text>
                      <Text style={styles.timeRangeValue}>
                        {TIME_SLOTS.find((s) => s.time === startTime)?.label || startTime}
                      </Text>
                    </View>
                    <MaterialCommunityIcons name="arrow-right" size={20} color="#666" />
                    <View style={styles.timeRangeItem}>
                      <Text style={styles.timeRangeLabel}>End</Text>
                      <Text style={styles.timeRangeValue}>
                        {endTime
                          ? TIME_SLOTS.find((s) => s.time === endTime)?.label || endTime
                          : "Select"}
                      </Text>
                    </View>
                  </Surface>
                )}

                <View style={styles.timeSlotsGrid}>
                  {TIME_SLOTS.map((slot) => (
                    <TouchableOpacity
                      key={slot.time}
                      style={[styles.timeSlot, getSlotStyle(slot)]}
                      onPress={() => handleTimeSlotPress(slot)}
                    >
                      <Text
                        style={[
                          styles.timeSlotText,
                          (slot.time === startTime || slot.time === endTime) && styles.timeSlotTextSelected,
                        ]}
                      >
                        {slot.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* Reason */}
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Reason for Blocking
            </Text>

            <View style={styles.reasonsList}>
              {COMMON_REASONS.map((reason) => (
                <TouchableOpacity
                  key={reason.value}
                  style={[
                    styles.reasonCard,
                    reasonType === reason.value && styles.reasonCardActive,
                  ]}
                  onPress={() => setReasonType(reason.value)}
                >
                  <MaterialCommunityIcons
                    name={reason.icon}
                    size={20}
                    color={reasonType === reason.value ? MANAGER_BLUE : "#666"}
                  />
                  <Text
                    style={[
                      styles.reasonText,
                      reasonType === reason.value && styles.reasonTextActive,
                    ]}
                  >
                    {reason.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {reasonType === "other" && (
              <TextInput
                label="Custom Reason"
                value={customReason}
                onChangeText={setCustomReason}
                style={styles.customReasonInput}
                mode="outlined"
                placeholder="Enter reason for blocking"
              />
            )}

            {/* Conflict Warning */}
            {conflictingBookings.length > 0 && (
              <Surface style={styles.conflictWarning} elevation={1}>
                <View style={styles.conflictHeader}>
                  <MaterialCommunityIcons name="alert" size={24} color="#FF9800" />
                  <Text style={styles.conflictTitle}>
                    {conflictingBookings.length} Booking Conflict{conflictingBookings.length > 1 ? "s" : ""}
                  </Text>
                </View>
                <Text style={styles.conflictText}>
                  There are existing bookings in this time range. These bookings will need to be handled separately.
                </Text>
                <Button
                  mode="text"
                  onPress={() => setConflictDialogVisible(true)}
                  textColor="#FF9800"
                >
                  View Conflicts
                </Button>
              </Surface>
            )}

            {/* Preview */}
            {getPreviewDates.length > 0 && (
              <Surface style={styles.previewCard} elevation={1}>
                <Text variant="titleSmall" style={styles.previewTitle}>
                  Block Preview
                </Text>
                <View style={styles.previewContent}>
                  <View style={styles.previewRow}>
                    <MaterialCommunityIcons name="calendar" size={18} color="#666" />
                    <Text style={styles.previewText}>
                      {blockType === BLOCK_TYPES.SINGLE
                        ? formatDate(startDate)
                        : blockType === BLOCK_TYPES.RANGE
                        ? `${formatDate(startDate)} - ${formatDate(endDate)}`
                        : `${formatDate(startDate)} - ${formatDate(recurringEndDate)}`}
                    </Text>
                  </View>
                  {blockType === BLOCK_TYPES.RECURRING && recurringDays.length > 0 && (
                    <View style={styles.previewRow}>
                      <MaterialCommunityIcons name="calendar-sync" size={18} color="#666" />
                      <Text style={styles.previewText}>
                        Every {recurringDays.map((d) => DAYS_OF_WEEK.find((day) => day.value === d)?.label).join(", ")}
                      </Text>
                    </View>
                  )}
                  <View style={styles.previewRow}>
                    <MaterialCommunityIcons name="soccer-field" size={18} color="#666" />
                    <Text style={styles.previewText}>
                      {allGrounds ? "All Grounds" : selectedGround?.name || "Not selected"}
                    </Text>
                  </View>
                  <View style={styles.previewRow}>
                    <MaterialCommunityIcons name="clock-outline" size={18} color="#666" />
                    <Text style={styles.previewText}>
                      {allDay
                        ? "All Day (6:00 AM - 11:00 PM)"
                        : startTime && endTime
                        ? `${TIME_SLOTS.find((s) => s.time === startTime)?.label} - ${TIME_SLOTS.find((s) => s.time === endTime)?.label}`
                        : "Not selected"}
                    </Text>
                  </View>
                  <View style={styles.previewRow}>
                    <MaterialCommunityIcons name="information" size={18} color="#666" />
                    <Text style={styles.previewText}>
                      {reasonType === "other" ? customReason || "Other" : COMMON_REASONS.find((r) => r.value === reasonType)?.label}
                    </Text>
                  </View>
                  <Divider style={styles.previewDivider} />
                  <Text style={styles.previewSummary}>
                    This will block {getPreviewDates.length} day{getPreviewDates.length > 1 ? "s" : ""}
                  </Text>
                </View>
              </Surface>
            )}
          </ScrollView>
        )}

        {/* Footer for create mode */}
        {viewMode === "create" && (
          <View style={styles.footer}>
            <Button
              mode="outlined"
              onPress={resetForm}
              style={styles.resetButton}
            >
              Reset
            </Button>
            <Button
              mode="contained"
              onPress={handleCreateBlock}
              loading={submitting}
              disabled={submitting}
              style={styles.createButton}
              buttonColor={MANAGER_BLUE}
              icon="calendar-lock"
            >
              Block Slots
            </Button>
          </View>
        )}

        {/* FAB for list mode */}
        {viewMode === "list" && (
          <FAB
            icon="plus"
            style={styles.fab}
            onPress={() => setViewMode("create")}
            label="New Block"
          />
        )}

        {/* Conflict Dialog */}
        <Portal>
          <Dialog visible={conflictDialogVisible} onDismiss={() => setConflictDialogVisible(false)}>
            <Dialog.Title>Booking Conflicts</Dialog.Title>
            <Dialog.Content>
              <Text style={styles.dialogText}>
                The following bookings conflict with your block:
              </Text>
              <ScrollView style={styles.conflictList}>
                {conflictingBookings.map((booking, index) => (
                  <View key={booking.id || index} style={styles.conflictItem}>
                    <Text style={styles.conflictItemName}>
                      {booking.userName || booking.customerName || "Customer"}
                    </Text>
                    <Text style={styles.conflictItemDetail}>
                      {booking.date} • {formatTimeLabel(
                        parseInt(booking.startTime.split(":")[0]),
                        parseInt(booking.startTime.split(":")[1])
                      )} - {formatTimeLabel(
                        parseInt(booking.endTime.split(":")[0]),
                        parseInt(booking.endTime.split(":")[1])
                      )}
                    </Text>
                    <Text style={styles.conflictItemGround}>
                      {booking.groundName || "Ground"}
                    </Text>
                  </View>
                ))}
              </ScrollView>
              <Text style={styles.dialogNote}>
                You can still create the block. Existing bookings will need to be cancelled or rescheduled separately.
              </Text>
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setConflictDialogVisible(false)}>Cancel</Button>
              <Button
                onPress={() => {
                  setConflictDialogVisible(false);
                  createBlock();
                }}
                textColor="#FF9800"
              >
                Block Anyway
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>

        {/* Delete Confirmation Dialog */}
        <Portal>
          <Dialog visible={deleteDialogVisible} onDismiss={() => setDeleteDialogVisible(false)}>
            <Dialog.Title>Remove Block</Dialog.Title>
            <Dialog.Content>
              <Text>Are you sure you want to remove this block?</Text>
              {blockToDelete && (
                <Surface style={styles.deleteBlockPreview} elevation={1}>
                  <Text style={styles.deleteBlockReason}>{blockToDelete.reason}</Text>
                  <Text style={styles.deleteBlockDetail}>
                    {blockToDelete.groundName} • {formatDate(blockToDelete.startDate)}
                    {blockToDelete.endDate !== blockToDelete.startDate && ` - ${formatDate(blockToDelete.endDate)}`}
                  </Text>
                </Surface>
              )}
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setDeleteDialogVisible(false)}>Cancel</Button>
              <Button onPress={handleDeleteBlock} textColor="#F44336">
                Remove
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Block Card Component
function BlockCard({ block, isPast = false, onDelete }) {
  const formatBlockDates = () => {
    if (block.blockType === "recurring") {
      const days = block.recurringDays?.map((d) =>
        DAYS_OF_WEEK.find((day) => day.value === d)?.label
      ).join(", ");
      return `Every ${days} (${formatDate(block.startDate)} - ${formatDate(block.recurringEndDate || block.endDate)})`;
    }
    if (block.startDate === block.endDate) {
      return formatDate(block.startDate);
    }
    return `${formatDate(block.startDate)} - ${formatDate(block.endDate)}`;
  };

  return (
    <Surface style={[styles.blockCard, isPast && styles.blockCardPast]} elevation={1}>
      <View style={styles.blockCardHeader}>
        <View style={styles.blockCardIcon}>
          <MaterialCommunityIcons
            name={
              block.blockType === "recurring"
                ? "calendar-sync"
                : block.blockType === "range"
                ? "calendar-range"
                : "calendar"
            }
            size={24}
            color={isPast ? "#999" : MANAGER_BLUE}
          />
        </View>
        <View style={styles.blockCardInfo}>
          <Text style={[styles.blockCardReason, isPast && styles.blockCardReasonPast]}>
            {block.reason}
          </Text>
          <Text style={styles.blockCardDates}>{formatBlockDates()}</Text>
        </View>
        {!isPast && (
          <IconButton
            icon="delete-outline"
            size={22}
            iconColor="#F44336"
            onPress={onDelete}
          />
        )}
      </View>
      <View style={styles.blockCardDetails}>
        <Chip compact style={styles.blockCardChip} textStyle={styles.blockCardChipText}>
          {block.groundName}
        </Chip>
        <Chip compact style={styles.blockCardChip} textStyle={styles.blockCardChipText}>
          {block.allDay
            ? "All Day"
            : `${formatTimeLabel(
                parseInt(block.startTime?.split(":")[0] || "6"),
                parseInt(block.startTime?.split(":")[1] || "0")
              )} - ${formatTimeLabel(
                parseInt(block.endTime?.split(":")[0] || "23"),
                parseInt(block.endTime?.split(":")[1] || "0")
              )}`}
        </Chip>
      </View>
      <Text style={styles.blockCardMeta}>
        Blocked by {block.blockedByName} • {formatDate(block.createdAt?.toDate?.() || new Date(block.createdAt))}
      </Text>
    </Surface>
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
    alignItems: "center",
    paddingHorizontal: 4,
    paddingVertical: 8,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontWeight: "bold",
    color: "#333",
  },
  headerSubtitle: {
    color: "#666",
  },

  // View toggle
  viewToggleContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
  },
  viewToggle: {
    backgroundColor: "#F0F4F8",
  },

  // Scroll view
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },

  // Section title
  sectionTitle: {
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
    marginTop: 8,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
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

  // No blocks
  noBlocksCard: {
    padding: 32,
    borderRadius: 10,
    backgroundColor: "#fff",
    alignItems: "center",
  },
  noBlocksText: {
    marginTop: 12,
    color: "#999",
    marginBottom: 16,
  },
  createBlockButton: {
    marginTop: 8,
  },
  morePastBlocks: {
    textAlign: "center",
    color: "#999",
    marginTop: 8,
  },

  // Block types
  blockTypes: {
    flexDirection: "row",
    gap: 10,
  },
  blockTypeCard: {
    flex: 1,
    alignItems: "center",
    padding: 16,
    borderRadius: 10,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#E0E0E0",
  },
  blockTypeCardActive: {
    borderColor: MANAGER_BLUE,
    backgroundColor: "#E3F2FD",
  },
  blockTypeText: {
    fontSize: 12,
    color: "#666",
    marginTop: 8,
    textAlign: "center",
  },
  blockTypeTextActive: {
    color: MANAGER_BLUE,
    fontWeight: "600",
  },

  // Date range hint
  dateRangeHint: {
    textAlign: "center",
    color: MANAGER_BLUE,
    fontSize: 13,
    marginBottom: 8,
    fontWeight: "500",
  },

  // Date scroll
  dateScroll: {
    marginBottom: 12,
  },
  dateScrollContent: {
    paddingHorizontal: 4,
    gap: 8,
  },
  dateCard: {
    width: 56,
    height: 70,
    borderRadius: 10,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  dateCardSelected: {
    backgroundColor: MANAGER_BLUE,
    borderColor: MANAGER_BLUE,
  },
  dateCardEndSelected: {
    backgroundColor: "#FF9800",
    borderColor: "#FF9800",
  },
  dateCardInRange: {
    backgroundColor: "#E3F2FD",
    borderColor: MANAGER_BLUE,
  },
  dateCardBlocked: {
    backgroundColor: "#FFEBEE",
    borderColor: "#FFCDD2",
  },
  dateCardToday: {
    borderColor: MANAGER_BLUE,
    borderWidth: 2,
  },
  dateDay: {
    fontSize: 11,
    color: "#666",
  },
  dateDaySelected: {
    color: "#fff",
  },
  dateNum: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginTop: 2,
  },
  dateNumSelected: {
    color: "#fff",
  },
  blockedIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#F44336",
    marginTop: 4,
  },

  // Recurring days
  recurringDays: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  dayButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#E0E0E0",
    alignItems: "center",
    justifyContent: "center",
  },
  dayButtonActive: {
    backgroundColor: MANAGER_BLUE,
    borderColor: MANAGER_BLUE,
  },
  dayButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  dayButtonTextActive: {
    color: "#fff",
  },

  // Ground selection
  allGroundsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 10,
    marginBottom: 12,
  },
  groundsList: {
    gap: 8,
    marginBottom: 8,
  },
  groundCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 10,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#E0E0E0",
  },
  groundCardSelected: {
    borderColor: MANAGER_BLUE,
    backgroundColor: "#E3F2FD",
  },
  groundInfo: {
    flex: 1,
  },
  groundName: {
    fontWeight: "600",
    color: "#333",
  },
  groundNameSelected: {
    color: MANAGER_BLUE,
  },
  groundSports: {
    color: "#666",
    marginTop: 2,
  },

  // Time selection
  allDayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 10,
    marginBottom: 12,
  },
  timeRangeDisplay: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    padding: 16,
    borderRadius: 10,
    backgroundColor: "#fff",
    marginBottom: 12,
  },
  timeRangeItem: {
    alignItems: "center",
  },
  timeRangeLabel: {
    fontSize: 11,
    color: "#666",
  },
  timeRangeValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: MANAGER_BLUE,
    marginTop: 2,
  },
  timeSlotsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 16,
  },
  timeSlot: {
    width: "23%",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  slotAvailable: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  slotAllDay: {
    backgroundColor: "#FFEBEE",
    borderWidth: 1,
    borderColor: "#FFCDD2",
  },
  slotSelected: {
    backgroundColor: "#F44336",
    borderWidth: 1,
    borderColor: "#F44336",
  },
  slotInRange: {
    backgroundColor: "#FFCDD2",
    borderWidth: 1,
    borderColor: "#EF9A9A",
  },
  timeSlotText: {
    fontSize: 11,
    color: "#333",
    fontWeight: "500",
  },
  timeSlotTextSelected: {
    color: "#fff",
    fontWeight: "bold",
  },

  // Reason selection
  reasonsList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  reasonCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#E0E0E0",
    gap: 6,
  },
  reasonCardActive: {
    borderColor: MANAGER_BLUE,
    backgroundColor: "#E3F2FD",
  },
  reasonText: {
    fontSize: 13,
    color: "#666",
  },
  reasonTextActive: {
    color: MANAGER_BLUE,
    fontWeight: "600",
  },
  customReasonInput: {
    backgroundColor: "#fff",
    marginBottom: 16,
  },

  // Conflict warning
  conflictWarning: {
    padding: 16,
    borderRadius: 10,
    backgroundColor: "#FFF3E0",
    marginBottom: 16,
  },
  conflictHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  conflictTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FF9800",
  },
  conflictText: {
    color: "#666",
    marginBottom: 4,
  },

  // Preview
  previewCard: {
    padding: 16,
    borderRadius: 10,
    backgroundColor: "#fff",
    marginTop: 8,
  },
  previewTitle: {
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  previewContent: {},
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  previewText: {
    flex: 1,
    color: "#333",
    fontSize: 14,
  },
  previewDivider: {
    marginVertical: 8,
  },
  previewSummary: {
    color: MANAGER_BLUE,
    fontWeight: "600",
    textAlign: "center",
  },

  // Footer
  footer: {
    flexDirection: "row",
    padding: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#eee",
    gap: 12,
  },
  resetButton: {
    flex: 1,
  },
  createButton: {
    flex: 2,
  },

  // FAB
  fab: {
    position: "absolute",
    right: 16,
    bottom: 16,
    backgroundColor: MANAGER_BLUE,
  },

  // Block card
  blockCard: {
    padding: 16,
    borderRadius: 10,
    backgroundColor: "#fff",
    marginBottom: 12,
  },
  blockCardPast: {
    opacity: 0.6,
  },
  blockCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  blockCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#E3F2FD",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  blockCardInfo: {
    flex: 1,
  },
  blockCardReason: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  blockCardReasonPast: {
    color: "#999",
  },
  blockCardDates: {
    fontSize: 13,
    color: "#666",
    marginTop: 2,
  },
  blockCardDetails: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  blockCardChip: {
    backgroundColor: "#F0F4F8",
  },
  blockCardChipText: {
    fontSize: 11,
  },
  blockCardMeta: {
    fontSize: 11,
    color: "#999",
    marginTop: 12,
  },

  // Dialog
  dialogText: {
    marginBottom: 12,
    color: "#333",
  },
  dialogNote: {
    marginTop: 12,
    color: "#FF9800",
    fontSize: 13,
  },
  conflictList: {
    maxHeight: 200,
  },
  conflictItem: {
    padding: 12,
    backgroundColor: "#FFF3E0",
    borderRadius: 8,
    marginBottom: 8,
  },
  conflictItemName: {
    fontWeight: "600",
    color: "#333",
  },
  conflictItemDetail: {
    fontSize: 13,
    color: "#666",
    marginTop: 2,
  },
  conflictItemGround: {
    fontSize: 12,
    color: "#999",
    marginTop: 2,
  },
  deleteBlockPreview: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#FFEBEE",
    marginTop: 12,
  },
  deleteBlockReason: {
    fontWeight: "600",
    color: "#F44336",
  },
  deleteBlockDetail: {
    fontSize: 13,
    color: "#666",
    marginTop: 4,
  },
});
