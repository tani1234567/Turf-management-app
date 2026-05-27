import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
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
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSelectedTurf } from "../../hooks/useSelectedTurf";
import { useAppSelector } from "../../hooks";
import { selectUser } from "../../store/slices/authSlice";
import {
  queryDocuments,
  setDocument,
  createBookingWithTransaction,
} from "../../services/firebase/firestore";
import {
  calculateBookingPrice,
  formatPrice,
  formatDuration,
  isWeekend,
  generateOperatingSlots,
} from "../../utils/priceUtils";

const MANAGER_BLUE = "#3B82F6";
const PALE_BLUE = "#DBEAFE";
const SUCCESS_GREEN = "#22C55E";
const WARN_ORANGE = "#F59E0B";
const DANGER_RED = "#EF4444";

// Booking types
const BOOKING_TYPES = [
  { value: "regular", label: "Regular Booking", icon: "calendar-check" },
  { value: "tournament", label: "Tournament", icon: "trophy" },
  { value: "offline", label: "Offline/Walk-in", icon: "walk" },
];

// Payment methods
const PAYMENT_METHODS = [
  { value: "cash", label: "Cash", icon: "cash" },
  { value: "upi", label: "UPI", icon: "cellphone" },
  { value: "card", label: "Card", icon: "credit-card" },
  { value: "bank_transfer", label: "Bank Transfer", icon: "bank" },
  { value: "pending", label: "Payment Pending", icon: "clock-outline" },
];

// Generate time slots (6 AM to 11 PM, 30-min intervals)
const formatTimeLabel = (hour, minute) => {
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${minute.toString().padStart(2, "0")} ${ampm}`;
};

const timeSlots = (() => {
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

// Generate next 45 days
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

// Helper functions
const getDateString = (date) => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const formatDate = (date) => {
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

// Check if two time ranges overlap
const hasTimeOverlap = (start1, end1, start2, end2) => {
  return start1 < end2 && end1 > start2;
};

// Normalize ground ID for comparison (handles legacy "ground-0" vs "ground_0" formats)
const normalizeGroundId = (groundId) => {
  if (!groundId) return "";
  // Convert both formats to a consistent format for comparison
  return groundId.toLowerCase().replace(/[-_]/g, "");
};

export default function CreateBookingScreen({ navigation, route }) {
  const { selectedTurfId, turfData } = useSelectedTurf();
  const user = useAppSelector(selectUser);
  const prefill = route?.params?.prefill ?? null;

  // Step state - New order: Customer -> Time -> Ground -> Payment
  const [currentStep, setCurrentStep] = useState(0);

  // Customer state
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [existingCustomer, setExistingCustomer] = useState(null);
  const [searchingCustomer, setSearchingCustomer] = useState(false);
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [bookingType, setBookingType] = useState("regular");

  // Time selection state — pre-filled from calendar selection if available
  const [selectedDate, setSelectedDate] = useState(() => {
    if (prefill?.date) {
      const [y, m, d] = prefill.date.split("-").map(Number);
      return new Date(y, m - 1, d);
    }
    return new Date();
  });
  const [startTime, setStartTime] = useState(prefill?.startTime ?? null);
  const [endTime, setEndTime] = useState(prefill?.endTime ?? null);

  // Ground selection state (Step 3 - after time)
  const [selectedGround, setSelectedGround] = useState(null);
  const [selectedSport, setSelectedSport] = useState(null);

  // Payment state
  const [advancePayment, setAdvancePayment] = useState(false);
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [customPriceEnabled, setCustomPriceEnabled] = useState(false);
  const [customPrice, setCustomPrice] = useState("");

  // Data state
  const [grounds, setGrounds] = useState([]);
  const [sports, setSports] = useState([]);
  const [existingBookings, setExistingBookings] = useState([]);
  const [blockedSlots, setBlockedSlots] = useState([]);
  const [loadingGrounds, setLoadingGrounds] = useState(false);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Price calculation
  const [priceBreakdown, setPriceBreakdown] = useState(null);

  // Search timer
  const searchTimerRef = useRef(null);

  // Dynamic slots respecting turf operating hours for the selected day
  const timeSlots = useMemo(
    () => generateOperatingSlots(turfData?.operatingHours, selectedDate, turfData?.holidaySchedule),
    [turfData, selectedDate]
  );

  // Load grounds from turf data (grounds are embedded in turf document)
  useEffect(() => {
    if (!turfData) {
      setGrounds([]);
      setSports([]);
      return;
    }

    setLoadingGrounds(true);
    try {
      // Grounds are stored as an array within the turf document
      const groundsData = turfData.grounds || [];

      // Map grounds with proper IDs
      const groundsWithIds = groundsData.map((g, index) => ({
        ...g,
        id: g.id || `ground_${index}`,
      }));

      setGrounds(groundsWithIds);

      // Auto-select ground from calendar prefill
      if (prefill?.groundId) {
        const match = groundsWithIds.find((g) => g.id === prefill.groundId);
        if (match) setSelectedGround(match);
      }

      // Extract unique sports from all grounds
      const allSports = new Set();
      groundsWithIds.forEach((g) => {
        if (g.sports && Array.isArray(g.sports)) {
          g.sports.forEach((s) => allSports.add(s));
        }
      });
      setSports([...allSports]);
    } catch (error) {
      console.error("Error loading grounds:", error);
    } finally {
      setLoadingGrounds(false);
    }
  }, [turfData]);

  // Load existing bookings for selected date (for all grounds)
  useEffect(() => {
    if (!selectedTurfId || !selectedDate) return;

    const loadBookings = async () => {
      setLoadingBookings(true);
      try {
        const dateStr = getDateString(selectedDate);
        const bookings = await queryDocuments("bookings", [
          { field: "turfId", operator: "==", value: selectedTurfId },
          { field: "date", operator: "==", value: dateStr },
        ]);
        // Only consider active bookings as conflicts
        setExistingBookings(bookings.filter((b) =>
          ["pending", "confirmed", "in_progress"].includes(b.status)
        ));
      } catch (error) {
        console.error("Error loading bookings:", error);
      } finally {
        setLoadingBookings(false);
      }
    };

    loadBookings();
  }, [selectedTurfId, selectedDate]);

  // Load blocked slots for the turf
  useEffect(() => {
    if (!selectedTurfId) {
      setBlockedSlots([]);
      return;
    }

    const loadBlockedSlots = async () => {
      try {
        const blocked = await queryDocuments("blocked_slots", [
          { field: "turfId", operator: "==", value: selectedTurfId },
        ]);
        setBlockedSlots(blocked);
      } catch (error) {
        console.error("Error loading blocked slots:", error);
        setBlockedSlots([]);
      }
    };

    loadBlockedSlots();
  }, [selectedTurfId]);

  // Search customer by phone
  const searchCustomer = useCallback(async (phone) => {
    if (!phone || phone.length < 10) {
      setExistingCustomer(null);
      setIsNewCustomer(false);
      return;
    }

    setSearchingCustomer(true);
    try {
      // Search by phone number
      const users = await queryDocuments("users", [
        { field: "phone", operator: "==", value: phone },
      ]);

      if (users.length > 0) {
        const foundUser = users[0];
        setExistingCustomer(foundUser);
        setCustomerName(foundUser.name || foundUser.displayName || "");
        setCustomerEmail(foundUser.email || "");
        setIsNewCustomer(false);
      } else {
        // Try with +91 prefix
        const usersWithPrefix = await queryDocuments("users", [
          { field: "phone", operator: "==", value: `+91${phone}` },
        ]);

        if (usersWithPrefix.length > 0) {
          const foundUser = usersWithPrefix[0];
          setExistingCustomer(foundUser);
          setCustomerName(foundUser.name || foundUser.displayName || "");
          setCustomerEmail(foundUser.email || "");
          setIsNewCustomer(false);
        } else {
          setExistingCustomer(null);
          setIsNewCustomer(true);
        }
      }
    } catch (error) {
      console.error("Error searching customer:", error);
    } finally {
      setSearchingCustomer(false);
    }
  }, []);

  // Debounced phone search
  useEffect(() => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    if (customerPhone.length >= 10) {
      searchTimerRef.current = setTimeout(() => {
        searchCustomer(customerPhone);
      }, 500);
    } else {
      setExistingCustomer(null);
      setIsNewCustomer(false);
    }

    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, [customerPhone, searchCustomer]);

  // Helper to check if a ground is blocked for the selected time
  const isGroundBlocked = useCallback((groundId) => {
    if (!startTime || !endTime || !selectedDate) return false;

    const dateStr = getDateString(selectedDate);
    const dayOfWeek = selectedDate.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
    const normalizedGroundId = normalizeGroundId(groundId);

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
      return hasTimeOverlap(startTime, endTime, blockStart, blockEnd);
    });
  }, [blockedSlots, startTime, endTime, selectedDate]);

  // Get blocking reasons for a ground
  const getBlockingReasons = useCallback((groundId) => {
    if (!startTime || !endTime || !selectedDate) return [];

    const dateStr = getDateString(selectedDate);
    const dayOfWeek = selectedDate.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
    const normalizedGroundId = normalizeGroundId(groundId);

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
      return hasTimeOverlap(startTime, endTime, blockStart, blockEnd);
    });
  }, [blockedSlots, startTime, endTime, selectedDate]);

  // Check if a ground is available for the selected time (checks both bookings and blocks)
  const isGroundAvailable = useCallback((groundId) => {
    if (!startTime || !endTime) return true;

    // Check if blocked
    if (isGroundBlocked(groundId)) return false;

    // Check for booking conflicts
    const normalizedGroundId = normalizeGroundId(groundId);
    return !existingBookings.some((booking) => {
      // Use normalized comparison to handle legacy data with different ID formats
      if (normalizeGroundId(booking.groundId) !== normalizedGroundId) return false;
      return hasTimeOverlap(startTime, endTime, booking.startTime, booking.endTime);
    });
  }, [existingBookings, startTime, endTime, isGroundBlocked]);

  // Get conflicting bookings for a ground
  const getConflictingBookings = useCallback((groundId) => {
    if (!startTime || !endTime) return [];

    const normalizedGroundId = normalizeGroundId(groundId);
    return existingBookings.filter((booking) => {
      // Use normalized comparison to handle legacy data with different ID formats
      if (normalizeGroundId(booking.groundId) !== normalizedGroundId) return false;
      return hasTimeOverlap(startTime, endTime, booking.startTime, booking.endTime);
    });
  }, [existingBookings, startTime, endTime]);

  // Check if slot is in past (for today)
  const isSlotPast = useCallback((time) => {
    const today = new Date();
    const selectedDateStr = getDateString(selectedDate);
    const todayStr = getDateString(today);

    if (selectedDateStr > todayStr) return false;
    if (selectedDateStr < todayStr) return true;

    // Same day - check time
    const now = `${String(today.getHours()).padStart(2, "0")}:${String(today.getMinutes()).padStart(2, "0")}`;
    return time < now;
  }, [selectedDate]);

  // Handle time slot selection
  const handleTimeSlotPress = useCallback((slot) => {
    if (isSlotPast(slot.time)) return;

    if (!startTime || (startTime && endTime)) {
      // Start new selection
      setStartTime(slot.time);
      setEndTime(null);
      // Reset ground selection when time changes
      setSelectedGround(null);
      setPriceBreakdown(null);
    } else {
      // Complete selection
      if (slot.time > startTime) {
        setEndTime(slot.time);
      } else if (slot.time < startTime) {
        setEndTime(startTime);
        setStartTime(slot.time);
      }
      // Reset ground selection when time changes
      setSelectedGround(null);
      setPriceBreakdown(null);
    }
  }, [startTime, endTime, isSlotPast]);

  // Get slot style
  const getSlotStyle = useCallback((slot) => {
    const isPast = isSlotPast(slot.time);
    const isStart = slot.time === startTime;
    const isEnd = slot.time === endTime;
    const isInRange = startTime && endTime && slot.time >= startTime && slot.time < endTime;

    if (isPast) return styles.slotPast;
    if (isStart || isEnd) return styles.slotSelected;
    if (isInRange) return styles.slotInRange;
    return styles.slotAvailable;
  }, [isSlotPast, startTime, endTime]);

  // Calculate price when ground is selected
  useEffect(() => {
    if (!selectedGround || !startTime || !endTime) {
      setPriceBreakdown(null);
      return;
    }

    const dateStr = getDateString(selectedDate);
    const breakdown = calculateBookingPrice(
      selectedGround,
      selectedSport,
      dateStr,
      startTime,
      endTime
    );
    setPriceBreakdown(breakdown);
  }, [selectedGround, selectedSport, selectedDate, startTime, endTime]);

  // Create new customer document
  const createNewCustomer = async () => {
    try {
      const customerId = `offline_${Date.now()}`;
      const customerData = {
        phone: customerPhone.startsWith("+91") ? customerPhone : `+91${customerPhone}`,
        name: customerName || "Walk-in Customer",
        email: customerEmail || null,
        role: "user",
        createdAt: new Date().toISOString(),
        createdBy: user?.userId,
        isOfflineCustomer: true,
      };

      await setDocument("users", customerId, customerData);
      return { id: customerId, ...customerData };
    } catch (error) {
      console.error("Error creating customer:", error);
      throw error;
    }
  };

  // Submit booking
  const handleSubmit = async () => {
    // Validation
    if (!customerPhone || customerPhone.length < 10) {
      Alert.alert("Error", "Please enter a valid phone number");
      return;
    }
    if (!customerName.trim()) {
      Alert.alert("Error", "Please enter customer name");
      return;
    }
    if (!startTime || !endTime) {
      Alert.alert("Error", "Please select time slots");
      return;
    }
    if (!selectedGround) {
      Alert.alert("Error", "Please select a ground");
      return;
    }

    // Double-check availability before submitting
    if (!isGroundAvailable(selectedGround.id)) {
      Alert.alert("Slot Unavailable", "This time slot is no longer available. Please select a different time or ground.");
      return;
    }

    setSubmitting(true);

    try {
      // Create or get customer
      let customer = existingCustomer;
      if (!customer && isNewCustomer) {
        customer = await createNewCustomer();
      }

      // Prepare booking data
      const bookingData = {
        turfId: selectedTurfId,
        turfName: turfData?.name || "",
        groundId: selectedGround.id,
        groundName: selectedGround.name,
        date: getDateString(selectedDate),
        startTime: startTime,
        endTime: endTime,
        sport: selectedSport || "general",
        duration: priceBreakdown?.duration || 1,
        totalDuration: priceBreakdown?.duration || 1,
        totalPrice: effectiveTotal,
        totalAmount: effectiveTotal,
        baseAmount: effectiveTotal,
        manualPricing: customPriceEnabled && parseFloat(customPrice) > 0,

        // Customer info
        userId: customer?.id || customer?.userId || null,
        userName: customerName,
        userPhone: customerPhone.startsWith("+91") ? customerPhone : `+91${customerPhone}`,
        userEmail: customerEmail || null,

        // Booking metadata
        bookingType: bookingType,
        status: "confirmed", // Skip pending for manager bookings

        // Payment info
        paymentStatus: advancePayment ? "partial" : paymentMethod === "pending" ? "pending" : "completed",
        paymentMethod: paymentMethod,
        advanceAmount: advancePayment ? parseFloat(advanceAmount) || 0 : 0,
        balanceAmount: advancePayment
          ? effectiveTotal - (parseFloat(advanceAmount) || 0)
          : paymentMethod === "pending" ? effectiveTotal : 0,

        // Manager info
        createdBy: user?.userId,
        createdByName: user?.name || user?.displayName || "Manager",
        createdByRole: "manager",
        isManualBooking: true,
        notes: notes.trim() || null,

        // Timestamps
        confirmedAt: new Date().toISOString(),
        confirmedBy: user?.userId,
      };

      // Create booking using transaction to prevent race conditions and double bookings
      const result = await createBookingWithTransaction(bookingData);

      if (!result.success) {
        // Transaction failed - slot was already booked
        Alert.alert(
          "Booking Failed",
          result.message || "This time slot is no longer available. Please select a different time or ground.",
          [{ text: "OK" }]
        );
        // Refresh bookings to show updated availability
        const dateStr = getDateString(selectedDate);
        const bookings = await queryDocuments("bookings", [
          { field: "turfId", operator: "==", value: selectedTurfId },
          { field: "date", operator: "==", value: dateStr },
        ]);
        setExistingBookings(bookings.filter((b) =>
          ["pending", "confirmed", "in_progress"].includes(b.status)
        ));
        return;
      }

      Alert.alert(
        "Booking Created",
        `Booking #${result.bookingId.slice(-6).toUpperCase()} has been confirmed.`,
        [
          {
            text: "Create Another",
            onPress: () => resetForm(),
          },
          {
            text: "Done",
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error("Error creating booking:", error);
      Alert.alert("Error", "Failed to create booking. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setCurrentStep(0);
    setCustomerPhone("");
    setCustomerName("");
    setCustomerEmail("");
    setExistingCustomer(null);
    setIsNewCustomer(false);
    setBookingType("regular");
    setSelectedDate(new Date());
    setStartTime(null);
    setEndTime(null);
    setSelectedGround(null);
    setSelectedSport(null);
    setNotes("");
    setAdvancePayment(false);
    setAdvanceAmount("");
    setPaymentMethod("cash");
    setPriceBreakdown(null);
    setCustomPriceEnabled(false);
    setCustomPrice("");
  };

  // Filter grounds by selected sport
  const filteredGrounds = useMemo(() => {
    return selectedSport
      ? grounds.filter((g) => g.sports?.includes(selectedSport))
      : grounds;
  }, [grounds, selectedSport]);

  // Effective total: custom override or auto-calculated
  const effectiveTotal = customPriceEnabled && parseFloat(customPrice) > 0
    ? parseFloat(customPrice)
    : (priceBreakdown?.total || 0);

  // Navigation validation
  const canProceed = useMemo(() => {
    switch (currentStep) {
      case 0: // Customer
        return customerPhone.length >= 10 && customerName.trim();
      case 1: // Time
        return startTime && endTime;
      case 2: // Ground
        return selectedGround !== null;
      case 3: // Payment
        return true;
      default:
        return false;
    }
  }, [currentStep, customerPhone, customerName, startTime, endTime, selectedGround]);

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
              Create Booking
            </Text>
            <Text variant="bodySmall" style={styles.headerSubtitle}>
              {turfData?.name}
            </Text>
          </View>
          <IconButton
            icon="refresh"
            size={24}
            onPress={resetForm}
          />
        </View>

        {/* Step indicator - Updated labels */}
        <View style={styles.stepIndicator}>
          {["Customer", "Time", "Ground", "Payment"].map((label, index) => (
            <TouchableOpacity
              key={label}
              style={styles.stepItem}
              onPress={() => index < currentStep && setCurrentStep(index)}
            >
              <View
                style={[
                  styles.stepCircle,
                  index <= currentStep && styles.stepCircleActive,
                  index < currentStep && styles.stepCircleComplete,
                ]}
              >
                {index < currentStep ? (
                  <MaterialCommunityIcons name="check" size={14} color="#fff" />
                ) : (
                  <Text style={[styles.stepNumber, index <= currentStep && styles.stepNumberActive]}>
                    {index + 1}
                  </Text>
                )}
              </View>
              <Text style={[styles.stepLabel, index <= currentStep && styles.stepLabelActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Step content */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Step 1: Customer Details */}
          {currentStep === 0 && (
            <View style={styles.stepContent}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Customer Information
              </Text>

              <TextInput
                label="Phone Number *"
                value={customerPhone}
                onChangeText={(text) => setCustomerPhone(text.replace(/[^0-9]/g, ""))}
                keyboardType="phone-pad"
                maxLength={10}
                style={styles.input}
                mode="outlined"
                left={<TextInput.Affix text="+91 " />}
                right={
                  searchingCustomer ? (
                    <TextInput.Icon icon={() => <ActivityIndicator size={20} />} />
                  ) : existingCustomer ? (
                    <TextInput.Icon icon="check-circle" iconColor="#4CAF50" />
                  ) : isNewCustomer ? (
                    <TextInput.Icon icon="account-plus" iconColor="#FF9800" />
                  ) : null
                }
              />

              {existingCustomer && (
                <Surface style={styles.customerFound} elevation={1}>
                  <MaterialCommunityIcons name="account-check" size={24} color="#4CAF50" />
                  <View style={styles.customerFoundInfo}>
                    <Text variant="titleSmall" style={styles.customerFoundTitle}>
                      Existing Customer Found
                    </Text>
                    <Text variant="bodySmall" style={styles.customerFoundText}>
                      {existingCustomer.name || existingCustomer.displayName}
                    </Text>
                  </View>
                </Surface>
              )}

              {isNewCustomer && (
                <Surface style={styles.newCustomer} elevation={1}>
                  <MaterialCommunityIcons name="account-plus" size={24} color="#FF9800" />
                  <View style={styles.customerFoundInfo}>
                    <Text variant="titleSmall" style={styles.newCustomerTitle}>
                      New Customer
                    </Text>
                    <Text variant="bodySmall" style={styles.customerFoundText}>
                      A new customer record will be created
                    </Text>
                  </View>
                </Surface>
              )}

              <TextInput
                label="Customer Name *"
                value={customerName}
                onChangeText={setCustomerName}
                style={styles.input}
                mode="outlined"
                editable={!existingCustomer || isNewCustomer}
              />

              <TextInput
                label="Email (Optional)"
                value={customerEmail}
                onChangeText={setCustomerEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.input}
                mode="outlined"
                editable={!existingCustomer || isNewCustomer}
              />

              <Text variant="titleMedium" style={[styles.sectionTitle, { marginTop: 24 }]}>
                Booking Type
              </Text>

              <View style={styles.bookingTypes}>
                {BOOKING_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type.value}
                    style={[
                      styles.bookingTypeCard,
                      bookingType === type.value && styles.bookingTypeCardActive,
                    ]}
                    onPress={() => setBookingType(type.value)}
                  >
                    <MaterialCommunityIcons
                      name={type.icon}
                      size={24}
                      color={bookingType === type.value ? MANAGER_BLUE : "#666"}
                    />
                    <Text
                      style={[
                        styles.bookingTypeText,
                        bookingType === type.value && styles.bookingTypeTextActive,
                      ]}
                    >
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Step 2: Date & Time Selection */}
          {currentStep === 1 && (
            <View style={styles.stepContent}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Select Date
              </Text>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.dateScroll}
                contentContainerStyle={styles.dateScrollContent}
              >
                {AVAILABLE_DATES.map((date, index) => {
                  const dateStr = getDateString(date);
                  const isSelected = dateStr === getDateString(selectedDate);
                  const isToday = dateStr === getDateString(new Date());
                  const weekend = isWeekend(dateStr);

                  return (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.dateCard,
                        isSelected && styles.dateCardSelected,
                        isToday && styles.dateCardToday,
                      ]}
                      onPress={() => {
                        setSelectedDate(date);
                        // Reset time and ground when date changes
                        setStartTime(null);
                        setEndTime(null);
                        setSelectedGround(null);
                        setPriceBreakdown(null);
                      }}
                    >
                      <Text style={[styles.dateDay, isSelected && styles.dateDaySelected]}>
                        {date.toLocaleDateString("en-IN", { weekday: "short" })}
                      </Text>
                      <Text style={[styles.dateNum, isSelected && styles.dateNumSelected]}>
                        {date.getDate()}
                      </Text>
                      {weekend && <View style={styles.weekendDot} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text variant="bodySmall" style={styles.selectedDateText}>
                {formatFullDate(selectedDate)}
                {isWeekend(getDateString(selectedDate)) && " (Weekend Rates)"}
              </Text>

              <Text variant="titleMedium" style={styles.sectionTitle}>
                Select Time Slot
              </Text>

              {startTime && (
                <Surface style={styles.timeRangeDisplay} elevation={1}>
                  <View style={styles.timeRangeItem}>
                    <Text style={styles.timeRangeLabel}>Start</Text>
                    <Text style={styles.timeRangeValue}>
                      {timeSlots.find((s) => s.time === startTime)?.label || startTime}
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="arrow-right" size={20} color="#666" />
                  <View style={styles.timeRangeItem}>
                    <Text style={styles.timeRangeLabel}>End</Text>
                    <Text style={styles.timeRangeValue}>
                      {endTime
                        ? timeSlots.find((s) => s.time === endTime)?.label || endTime
                        : "Select end time"}
                    </Text>
                  </View>
                  {startTime && endTime && (
                    <View style={styles.durationBadge}>
                      <Text style={styles.durationText}>
                        {formatDuration(
                          (timeSlots.findIndex((s) => s.time === endTime) -
                            timeSlots.findIndex((s) => s.time === startTime)) * 0.5
                        )}
                      </Text>
                    </View>
                  )}
                </Surface>
              )}

              <Text variant="bodySmall" style={styles.timeHint}>
                Tap to select start time, then tap again to select end time
              </Text>

              <View style={styles.timeSlotsGrid}>
                {timeSlots.map((slot) => {
                  const style = getSlotStyle(slot);
                  const isPast = isSlotPast(slot.time);

                  return (
                    <TouchableOpacity
                      key={slot.time}
                      style={[styles.timeSlot, style]}
                      onPress={() => handleTimeSlotPress(slot)}
                      disabled={isPast}
                    >
                      <Text
                        style={[
                          styles.timeSlotText,
                          isPast && styles.timeSlotTextDisabled,
                          (slot.time === startTime || slot.time === endTime) && styles.timeSlotTextSelected,
                        ]}
                      >
                        {slot.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Step 3: Ground Selection with Availability */}
          {currentStep === 2 && (
            <View style={styles.stepContent}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Selected Time
              </Text>

              <Surface style={styles.selectedTimeSummary} elevation={1}>
                <View style={styles.summaryTimeRow}>
                  <MaterialCommunityIcons name="calendar" size={20} color={MANAGER_BLUE} />
                  <Text style={styles.summaryTimeText}>{formatDate(selectedDate)}</Text>
                </View>
                <View style={styles.summaryTimeRow}>
                  <MaterialCommunityIcons name="clock-outline" size={20} color={MANAGER_BLUE} />
                  <Text style={styles.summaryTimeText}>
                    {timeSlots.find((s) => s.time === startTime)?.label} - {timeSlots.find((s) => s.time === endTime)?.label}
                  </Text>
                </View>
              </Surface>

              {sports.length > 0 && (
                <>
                  <Text variant="titleMedium" style={styles.sectionTitle}>
                    Filter by Sport (Optional)
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.sportsScroll}
                  >
                    <Chip
                      selected={selectedSport === null}
                      onPress={() => setSelectedSport(null)}
                      mode="outlined"
                      style={styles.sportChip}
                    >
                      All Sports
                    </Chip>
                    {sports.map((sport) => (
                      <Chip
                        key={sport}
                        selected={selectedSport === sport}
                        onPress={() => setSelectedSport(sport)}
                        mode="outlined"
                        style={styles.sportChip}
                      >
                        {sport}
                      </Chip>
                    ))}
                  </ScrollView>
                </>
              )}

              <Text variant="titleMedium" style={styles.sectionTitle}>
                Select Ground
              </Text>

              {loadingBookings || loadingGrounds ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={MANAGER_BLUE} />
                  <Text style={styles.loadingText}>Checking availability...</Text>
                </View>
              ) : (
                filteredGrounds.map((ground) => {
                  const isAvailable = isGroundAvailable(ground.id);
                  const conflictingBookings = getConflictingBookings(ground.id);
                  const blockingReasons = getBlockingReasons(ground.id);
                  const isBlocked = blockingReasons.length > 0;
                  const isSelected = selectedGround?.id === ground.id;

                  return (
                    <TouchableOpacity
                      key={ground.id}
                      style={[
                        styles.groundCard,
                        isSelected && styles.groundCardSelected,
                        !isAvailable && styles.groundCardUnavailable,
                        isBlocked && styles.groundCardBlocked,
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
                              !isAvailable && styles.groundNameUnavailable,
                            ]}
                          >
                            {ground.name}
                          </Text>
                          <Text variant="bodySmall" style={styles.groundMeta}>
                            {ground.size} • {ground.capacity}
                          </Text>
                        </View>
                        <View style={styles.groundStatusContainer}>
                          {isAvailable ? (
                            <View style={styles.availableBadge}>
                              <MaterialCommunityIcons name="check-circle" size={16} color="#4CAF50" />
                              <Text style={styles.availableText}>Available</Text>
                            </View>
                          ) : isBlocked ? (
                            <View style={styles.blockedBadge}>
                              <MaterialCommunityIcons name="lock" size={16} color="#FF9800" />
                              <Text style={styles.blockedText}>Blocked</Text>
                            </View>
                          ) : (
                            <View style={styles.bookedBadge}>
                              <MaterialCommunityIcons name="close-circle" size={16} color="#F44336" />
                              <Text style={styles.bookedText}>Booked</Text>
                            </View>
                          )}
                        </View>
                      </View>

                      {/* Show blocking reason if blocked */}
                      {isBlocked && blockingReasons.length > 0 && (
                        <View style={styles.blockInfo}>
                          <Text style={styles.blockTitle}>Blocked:</Text>
                          {blockingReasons.map((block, idx) => (
                            <Text key={idx} style={styles.blockDetail}>
                              • {block.reason || "Maintenance"} ({block.allDay ? "All Day" : `${formatTimeLabel(
                                parseInt(block.startTime?.split(":")[0] || "6"),
                                parseInt(block.startTime?.split(":")[1] || "0")
                              )} - ${formatTimeLabel(
                                parseInt(block.endTime?.split(":")[0] || "23"),
                                parseInt(block.endTime?.split(":")[1] || "0")
                              )}`})
                            </Text>
                          ))}
                        </View>
                      )}

                      {/* Show conflicting bookings if unavailable */}
                      {!isAvailable && !isBlocked && conflictingBookings.length > 0 && (
                        <View style={styles.conflictInfo}>
                          <Text style={styles.conflictTitle}>Booked by:</Text>
                          {conflictingBookings.map((booking, idx) => (
                            <Text key={idx} style={styles.conflictDetail}>
                              • {booking.userName || "Customer"} ({formatTimeLabel(
                                parseInt(booking.startTime.split(":")[0]),
                                parseInt(booking.startTime.split(":")[1])
                              )} - {formatTimeLabel(
                                parseInt(booking.endTime.split(":")[0]),
                                parseInt(booking.endTime.split(":")[1])
                              )})
                            </Text>
                          ))}
                        </View>
                      )}

                      {ground.sports && (
                        <View style={styles.groundSports}>
                          {ground.sports.slice(0, 3).map((s) => (
                            <Chip key={s} compact style={styles.groundSportChip}>
                              {s}
                            </Chip>
                          ))}
                        </View>
                      )}

                      {/* Show pricing preview for available grounds */}
                      {isAvailable && ground.pricing && (
                        <View style={styles.pricingPreview}>
                          <Text style={styles.pricingPreviewText}>
                            Estimated: {formatPrice(
                              calculateBookingPrice(
                                ground,
                                selectedSport,
                                getDateString(selectedDate),
                                startTime,
                                endTime
                              ).total
                            )}
                          </Text>
                        </View>
                      )}

                      {isSelected && (
                        <MaterialCommunityIcons
                          name="check-circle"
                          size={24}
                          color={MANAGER_BLUE}
                          style={styles.selectedCheck}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })
              )}

              {filteredGrounds.length === 0 && !loadingGrounds && (
                <Surface style={styles.noGroundsCard} elevation={1}>
                  <MaterialCommunityIcons name="alert-circle" size={48} color="#ccc" />
                  <Text style={styles.noGroundsText}>
                    No grounds available for the selected criteria
                  </Text>
                </Surface>
              )}
            </View>
          )}

          {/* Step 4: Payment */}
          {currentStep === 3 && (
            <View style={styles.stepContent}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Payment Details
              </Text>

              {priceBreakdown && (
                <Surface style={styles.totalCard} elevation={1}>
                  <Text variant="bodyMedium" style={styles.totalLabel}>
                    Total Amount
                  </Text>
                  <Text variant="headlineMedium" style={styles.totalAmount}>
                    {formatPrice(effectiveTotal)}
                  </Text>
                  {customPriceEnabled && (
                    <Text style={styles.customPriceNote}>Custom price applied</Text>
                  )}
                </Surface>
              )}

              {/* Price Breakdown */}
              {priceBreakdown && priceBreakdown.slots.length > 0 && !customPriceEnabled && (
                <Surface style={styles.priceBreakdown} elevation={1}>
                  <Text variant="titleSmall" style={styles.priceTitle}>
                    Price Breakdown
                  </Text>
                  {priceBreakdown.slots.map((slot, index) => (
                    <View key={index} style={styles.priceRow}>
                      <Text style={styles.priceLabel}>
                        {slot.name} ({formatDuration(slot.durationHours)})
                      </Text>
                      <Text style={styles.priceValue}>{formatPrice(slot.amount)}</Text>
                    </View>
                  ))}
                  <Divider style={styles.priceDivider} />
                  <View style={styles.priceRow}>
                    <Text style={styles.priceTotalLabel}>Total</Text>
                    <Text style={styles.priceTotalValue}>
                      {formatPrice(priceBreakdown.total)}
                    </Text>
                  </View>
                </Surface>
              )}

              {/* Custom Price Override */}
              <View style={styles.advanceSection}>
                <View style={styles.advanceHeader}>
                  <View>
                    <Text variant="titleSmall">Custom Price</Text>
                    <Text style={styles.customPriceSubtitle}>Override calculated amount</Text>
                  </View>
                  <Switch
                    value={customPriceEnabled}
                    onValueChange={(v) => {
                      setCustomPriceEnabled(v);
                      if (!v) setCustomPrice("");
                    }}
                    color={MANAGER_BLUE}
                  />
                </View>
                {customPriceEnabled && (
                  <TextInput
                    label="Custom Total Amount"
                    value={customPrice}
                    onChangeText={(v) => setCustomPrice(v.replace(/[^0-9]/g, ""))}
                    keyboardType="numeric"
                    style={styles.advanceInput}
                    mode="outlined"
                    left={<TextInput.Affix text="₹ " />}
                    placeholder={String(priceBreakdown?.total || 0)}
                  />
                )}
              </View>

              <Text variant="titleMedium" style={styles.sectionTitle}>
                Payment Method
              </Text>

              <View style={styles.paymentMethods}>
                {PAYMENT_METHODS.map((method) => (
                  <TouchableOpacity
                    key={method.value}
                    style={[
                      styles.paymentMethodCard,
                      paymentMethod === method.value && styles.paymentMethodCardActive,
                    ]}
                    onPress={() => setPaymentMethod(method.value)}
                  >
                    <MaterialCommunityIcons
                      name={method.icon}
                      size={24}
                      color={paymentMethod === method.value ? MANAGER_BLUE : "#666"}
                    />
                    <Text
                      style={[
                        styles.paymentMethodText,
                        paymentMethod === method.value && styles.paymentMethodTextActive,
                      ]}
                    >
                      {method.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.advanceSection}>
                <View style={styles.advanceHeader}>
                  <Text variant="titleSmall">Advance Payment Only</Text>
                  <Switch
                    value={advancePayment}
                    onValueChange={setAdvancePayment}
                    color={MANAGER_BLUE}
                  />
                </View>
                {advancePayment && (
                  <TextInput
                    label="Advance Amount"
                    value={advanceAmount}
                    onChangeText={setAdvanceAmount}
                    keyboardType="numeric"
                    style={styles.advanceInput}
                    mode="outlined"
                    left={<TextInput.Affix text="₹ " />}
                  />
                )}
                {advancePayment && advanceAmount && (
                  <Text style={styles.balanceText}>
                    Balance: {formatPrice(effectiveTotal - parseFloat(advanceAmount || 0))}
                  </Text>
                )}
              </View>

              <Text variant="titleMedium" style={styles.sectionTitle}>
                Notes (Optional)
              </Text>

              <TextInput
                label="Add notes for this booking"
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                style={styles.notesInput}
                mode="outlined"
              />

              {/* Booking Summary */}
              <Surface style={styles.summaryCard} elevation={1}>
                <Text variant="titleSmall" style={styles.summaryTitle}>
                  Booking Summary
                </Text>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Customer</Text>
                  <Text style={styles.summaryValue}>{customerName}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Phone</Text>
                  <Text style={styles.summaryValue}>+91 {customerPhone}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Date</Text>
                  <Text style={styles.summaryValue}>{formatDate(selectedDate)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Time</Text>
                  <Text style={styles.summaryValue}>
                    {timeSlots.find((s) => s.time === startTime)?.label} - {timeSlots.find((s) => s.time === endTime)?.label}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Ground</Text>
                  <Text style={styles.summaryValue}>{selectedGround?.name}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Type</Text>
                  <Text style={styles.summaryValue}>
                    {BOOKING_TYPES.find((t) => t.value === bookingType)?.label}
                  </Text>
                </View>
                <Divider style={styles.summaryDivider} />
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryTotalLabel}>Total</Text>
                  <Text style={styles.summaryTotalValue}>
                    {formatPrice(effectiveTotal)}
                  </Text>
                </View>
                <View style={styles.statusBadge}>
                  <MaterialCommunityIcons name="check-circle" size={16} color="#4CAF50" />
                  <Text style={styles.statusText}>Will be confirmed immediately</Text>
                </View>
              </Surface>
            </View>
          )}
        </ScrollView>

        {/* Footer buttons */}
        <View style={styles.footer}>
          {currentStep > 0 && (
            <Button
              mode="outlined"
              onPress={() => setCurrentStep(currentStep - 1)}
              style={styles.backButton}
            >
              Back
            </Button>
          )}
          {currentStep < 3 ? (
            <Button
              mode="contained"
              onPress={() => setCurrentStep(currentStep + 1)}
              disabled={!canProceed}
              style={styles.nextButton}
              buttonColor={MANAGER_BLUE}
            >
              Next
            </Button>
          ) : (
            <Button
              mode="contained"
              onPress={handleSubmit}
              loading={submitting}
              disabled={submitting}
              style={styles.nextButton}
              buttonColor="#4CAF50"
              icon="check"
            >
              Confirm Booking
            </Button>
          )}
        </View>
      </KeyboardAvoidingView>
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
    alignItems: "center",
    paddingHorizontal: 4,
    paddingVertical: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 16,
    color: "#111827",
  },
  headerSubtitle: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 12,
    color: "#6B7280",
  },

  // Step indicator
  stepIndicator: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  stepItem: {
    alignItems: "center",
    flex: 1,
  },
  stepCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
  },
  stepCircleActive: {
    backgroundColor: MANAGER_BLUE,
  },
  stepCircleComplete: {
    backgroundColor: SUCCESS_GREEN,
  },
  stepNumber: {
    fontSize: 12,
    fontFamily: "Ubuntu-Bold",
    color: "#9CA3AF",
  },
  stepNumberActive: {
    color: "#fff",
  },
  stepLabel: {
    fontSize: 11,
    fontFamily: "Ubuntu-Regular",
    color: "#9CA3AF",
    marginTop: 4,
  },
  stepLabelActive: {
    fontFamily: "Ubuntu-Medium",
    color: MANAGER_BLUE,
  },

  // Scroll view
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },

  // Step content
  stepContent: {
    flex: 1,
  },
  sectionTitle: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 14,
    color: "#374151",
    marginBottom: 12,
    marginTop: 8,
  },

  // Inputs
  input: {
    marginBottom: 12,
    backgroundColor: "#fff",
  },

  // Customer found
  customerFound: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#DCFCE7",
    marginBottom: 12,
  },
  newCustomer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#FEF3C7",
    marginBottom: 12,
  },
  customerFoundInfo: {
    marginLeft: 12,
    flex: 1,
  },
  customerFoundTitle: {
    fontFamily: "Ubuntu-Bold",
    color: SUCCESS_GREEN,
  },
  newCustomerTitle: {
    fontFamily: "Ubuntu-Bold",
    color: WARN_ORANGE,
  },
  customerFoundText: {
    fontFamily: "Ubuntu-Regular",
    color: "#6B7280",
    marginTop: 2,
    fontSize: 12,
  },

  // Booking types
  bookingTypes: {
    flexDirection: "row",
    gap: 10,
  },
  bookingTypeCard: {
    flex: 1,
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#E5E7EB",
  },
  bookingTypeCardActive: {
    borderColor: MANAGER_BLUE,
    backgroundColor: PALE_BLUE,
  },
  bookingTypeText: {
    fontSize: 11,
    fontFamily: "Ubuntu-Regular",
    color: "#6B7280",
    marginTop: 6,
    textAlign: "center",
  },
  bookingTypeTextActive: {
    fontFamily: "Ubuntu-Bold",
    color: MANAGER_BLUE,
  },

  // Date scroll
  dateScroll: {
    marginBottom: 8,
  },
  dateScrollContent: {
    paddingHorizontal: 4,
    gap: 8,
  },
  dateCard: {
    width: 58,
    height: 72,
    borderRadius: 12,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
  },
  dateCardSelected: {
    backgroundColor: MANAGER_BLUE,
    borderColor: MANAGER_BLUE,
  },
  dateCardToday: {
    borderColor: MANAGER_BLUE,
    borderWidth: 2,
  },
  dateDay: {
    fontSize: 11,
    fontFamily: "Ubuntu-Regular",
    color: "#6B7280",
  },
  dateDaySelected: {
    color: "#fff",
    fontFamily: "Ubuntu-Medium",
  },
  dateNum: {
    fontSize: 18,
    fontFamily: "Ubuntu-Bold",
    color: "#111827",
    marginTop: 2,
  },
  dateNumSelected: {
    color: "#fff",
  },
  weekendDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: WARN_ORANGE,
    marginTop: 4,
  },
  selectedDateText: {
    fontFamily: "Ubuntu-Regular",
    textAlign: "center",
    color: "#6B7280",
    marginBottom: 16,
    fontSize: 13,
  },

  // Time range display
  timeRangeDisplay: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#fff",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  timeRangeItem: {
    alignItems: "center",
  },
  timeRangeLabel: {
    fontSize: 11,
    fontFamily: "Ubuntu-Regular",
    color: "#6B7280",
  },
  timeRangeValue: {
    fontSize: 17,
    fontFamily: "Ubuntu-Bold",
    color: MANAGER_BLUE,
    marginTop: 2,
  },
  durationBadge: {
    backgroundColor: SUCCESS_GREEN,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  durationText: {
    color: "#fff",
    fontFamily: "Ubuntu-Bold",
    fontSize: 12,
  },
  timeHint: {
    fontFamily: "Ubuntu-Regular",
    textAlign: "center",
    color: "#9CA3AF",
    marginBottom: 12,
    fontSize: 12,
  },

  // Time slots grid
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
    borderColor: "#E5E7EB",
  },
  slotPast: {
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  slotSelected: {
    backgroundColor: SUCCESS_GREEN,
    borderWidth: 1,
    borderColor: SUCCESS_GREEN,
  },
  slotInRange: {
    backgroundColor: "#DCFCE7",
    borderWidth: 1,
    borderColor: "#86EFAC",
  },
  timeSlotText: {
    fontSize: 11,
    fontFamily: "Ubuntu-Medium",
    color: "#374151",
  },
  timeSlotTextDisabled: {
    color: "#9CA3AF",
  },
  timeSlotTextSelected: {
    color: "#fff",
    fontFamily: "Ubuntu-Bold",
  },

  // Selected time summary
  selectedTimeSummary: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: PALE_BLUE,
    marginBottom: 16,
  },
  summaryTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  summaryTimeText: {
    fontSize: 14,
    fontFamily: "Ubuntu-Medium",
    color: "#374151",
  },

  // Sports scroll
  sportsScroll: {
    marginBottom: 16,
  },
  sportChip: {
    marginRight: 8,
  },

  // Ground card
  groundCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#fff",
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "#E5E7EB",
    position: "relative",
  },
  groundCardSelected: {
    borderColor: MANAGER_BLUE,
    backgroundColor: PALE_BLUE,
  },
  groundCardUnavailable: {
    backgroundColor: "#F9FAFB",
    borderColor: "#E5E7EB",
  },
  groundHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  groundInfo: {
    flex: 1,
  },
  groundName: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 14,
    color: "#111827",
  },
  groundNameUnavailable: {
    color: "#9CA3AF",
  },
  groundMeta: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  groundStatusContainer: {
    marginLeft: 12,
  },
  availableBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  availableText: {
    fontSize: 11,
    fontFamily: "Ubuntu-Bold",
    color: SUCCESS_GREEN,
  },
  bookedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  bookedText: {
    fontSize: 11,
    fontFamily: "Ubuntu-Bold",
    color: DANGER_RED,
  },
  blockedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  blockedText: {
    fontSize: 11,
    fontFamily: "Ubuntu-Bold",
    color: WARN_ORANGE,
  },
  groundCardBlocked: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FCD34D",
  },
  blockInfo: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#FCD34D",
  },
  blockTitle: {
    fontSize: 12,
    fontFamily: "Ubuntu-Medium",
    color: WARN_ORANGE,
    marginBottom: 4,
  },
  blockDetail: {
    fontSize: 11,
    fontFamily: "Ubuntu-Regular",
    color: "#6B7280",
    marginLeft: 8,
  },
  conflictInfo: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#FECACA",
  },
  conflictTitle: {
    fontSize: 12,
    fontFamily: "Ubuntu-Medium",
    color: DANGER_RED,
    marginBottom: 4,
  },
  conflictDetail: {
    fontSize: 11,
    fontFamily: "Ubuntu-Regular",
    color: "#6B7280",
    marginLeft: 8,
  },
  groundSports: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 10,
    gap: 4,
  },
  groundSportChip: {
    height: 24,
  },
  pricingPreview: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  pricingPreviewText: {
    fontSize: 13,
    fontFamily: "Ubuntu-Bold",
    color: SUCCESS_GREEN,
  },
  selectedCheck: {
    position: "absolute",
    top: 12,
    right: 12,
  },

  // Loading
  loadingContainer: {
    alignItems: "center",
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontFamily: "Ubuntu-Regular",
    color: "#6B7280",
    fontSize: 13,
  },

  // No grounds
  noGroundsCard: {
    padding: 32,
    borderRadius: 12,
    backgroundColor: "#fff",
    alignItems: "center",
  },
  noGroundsText: {
    marginTop: 12,
    fontFamily: "Ubuntu-Regular",
    color: "#9CA3AF",
    textAlign: "center",
  },

  // Price breakdown
  priceBreakdown: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#fff",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  priceTitle: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 14,
    color: "#374151",
    marginBottom: 12,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  priceLabel: {
    fontFamily: "Ubuntu-Regular",
    color: "#6B7280",
    fontSize: 14,
  },
  priceValue: {
    fontFamily: "Ubuntu-Medium",
    color: "#374151",
  },
  priceDivider: {
    marginVertical: 8,
    backgroundColor: "#E5E7EB",
  },
  priceTotalLabel: {
    fontFamily: "Ubuntu-Bold",
    color: "#111827",
    fontSize: 15,
  },
  priceTotalValue: {
    fontFamily: "Ubuntu-Bold",
    color: SUCCESS_GREEN,
    fontSize: 16,
  },

  // Payment methods
  paymentMethods: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  paymentMethodCard: {
    width: "30%",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#E5E7EB",
  },
  paymentMethodCardActive: {
    borderColor: MANAGER_BLUE,
    backgroundColor: PALE_BLUE,
  },
  paymentMethodText: {
    fontSize: 10,
    fontFamily: "Ubuntu-Regular",
    color: "#6B7280",
    marginTop: 4,
    textAlign: "center",
  },
  paymentMethodTextActive: {
    fontFamily: "Ubuntu-Bold",
    color: MANAGER_BLUE,
  },

  // Advance section
  advanceSection: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#fff",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  advanceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  advanceInput: {
    marginTop: 12,
    backgroundColor: "#fff",
  },
  balanceText: {
    marginTop: 8,
    fontFamily: "Ubuntu-Medium",
    color: WARN_ORANGE,
  },
  customPriceNote: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 11,
    color: MANAGER_BLUE,
    marginTop: 4,
  },
  customPriceSubtitle: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 2,
  },

  // Total card
  totalCard: {
    padding: 20,
    borderRadius: 12,
    backgroundColor: PALE_BLUE,
    alignItems: "center",
    marginBottom: 16,
  },
  totalLabel: {
    fontFamily: "Ubuntu-Regular",
    color: "#374151",
    fontSize: 13,
  },
  totalAmount: {
    fontFamily: "Ubuntu-Bold",
    color: MANAGER_BLUE,
    fontSize: 26,
    marginTop: 4,
  },

  // Notes
  notesInput: {
    backgroundColor: "#fff",
    marginBottom: 16,
  },

  // Summary
  summaryCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  summaryTitle: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 14,
    color: "#374151",
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  summaryLabel: {
    fontFamily: "Ubuntu-Regular",
    color: "#6B7280",
    fontSize: 13,
  },
  summaryValue: {
    fontFamily: "Ubuntu-Medium",
    color: "#374151",
    fontSize: 13,
  },
  summaryDivider: {
    marginVertical: 8,
    backgroundColor: "#E5E7EB",
  },
  summaryTotalLabel: {
    fontFamily: "Ubuntu-Bold",
    color: "#111827",
    fontSize: 15,
  },
  summaryTotalValue: {
    fontFamily: "Ubuntu-Bold",
    color: SUCCESS_GREEN,
    fontSize: 16,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    gap: 6,
  },
  statusText: {
    fontFamily: "Ubuntu-Medium",
    color: SUCCESS_GREEN,
    fontSize: 13,
  },

  // Footer
  footer: {
    flexDirection: "row",
    padding: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    gap: 12,
  },
  backButton: {
    flex: 1,
  },
  nextButton: {
    flex: 2,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    padding: 16,
  },
  emptyCard: {
    padding: 36,
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
});
