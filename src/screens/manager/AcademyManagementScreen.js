import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import {
  Text,
  Surface,
  Button,
  Chip,
  TextInput,
  ActivityIndicator,
  IconButton,
  FAB,
  Divider,
  Portal,
  Dialog,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSelectedTurf } from "../../hooks/useSelectedTurf";
import { useAppSelector } from "../../hooks";
import { selectUser } from "../../store/slices/authSlice";
import {
  addDocument,
  queryDocuments,
  updateDocument,
  subscribeToCollection,
} from "../../services/firebase/firestore";

const MANAGER_BLUE = "#2196F3";

const DAYS_OF_WEEK = [
  { key: "monday", label: "Mon" },
  { key: "tuesday", label: "Tue" },
  { key: "wednesday", label: "Wed" },
  { key: "thursday", label: "Thu" },
  { key: "friday", label: "Fri" },
  { key: "saturday", label: "Sat" },
  { key: "sunday", label: "Sun" },
];

const DURATION_OPTIONS = [
  { value: 1, label: "1 Month" },
  { value: 2, label: "2 Months" },
  { value: 3, label: "3 Months" },
];

const STATUS_CONFIG = {
  active: { color: "#4CAF50", bg: "#E8F5E9", label: "Active" },
  paused: { color: "#FF9800", bg: "#FFF3E0", label: "Paused" },
  expired: { color: "#9E9E9E", bg: "#F5F5F5", label: "Expired" },
  cancelled: { color: "#F44336", bg: "#FFEBEE", label: "Cancelled" },
};

// 30-minute interval time slots (matching BlockSlotsScreen style)
const TIME_SLOTS = [];
for (let h = 6; h < 23; h++) {
  for (let m = 0; m < 60; m += 30) {
    const time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    const hour12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
    const ampm = h >= 12 ? "PM" : "AM";
    const label = `${hour12}:${String(m).padStart(2, "0")} ${ampm}`;
    TIME_SLOTS.push({ time, label });
  }
}
// Add 11:00 PM as the last possible end time
TIME_SLOTS.push({ time: "23:00", label: "11:00 PM" });

// Helpers
const getTodayString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const formatDate = (dateStr) => {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${parseInt(day)} ${months[parseInt(month) - 1]} ${year}`;
};

const formatTime = (timeStr) => {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${m} ${ampm}`;
};

const addMonthsToDate = (dateStr, months) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1 + months, d);
  // If the day overflowed (e.g. Jan 31 + 1 month = Mar 3), use last day of target month
  const targetMonth = (m - 1 + months) % 12;
  if (date.getMonth() !== targetMonth) {
    date.setDate(0); // Go to last day of previous month
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const getDayOfWeek = (dateStr) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  return days[date.getDay()];
};

/**
 * Generate all session dates for a given schedule within a contract period
 */
const generateSessionDates = (startDate, endDate, scheduledDays) => {
  const dates = [];
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  const current = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);

  while (current <= end) {
    const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`;
    const dayName = getDayOfWeek(dateStr);
    if (scheduledDays.includes(dayName)) {
      dates.push(dateStr);
    }
    current.setDate(current.getDate() + 1);
  }

  return dates;
};

// ============================================================
// Time Slot Grid Component (30-min intervals, matching BlockSlotsScreen)
// ============================================================
function TimeSlotGrid({ startTime, endTime, onSlotPress, selecting }) {
  return (
    <View style={styles.timeSlotsGrid}>
      {TIME_SLOTS.map((slot) => {
        const isStart = startTime === slot.time;
        const isEnd = endTime === slot.time;
        const isInRange = startTime && endTime && slot.time > startTime && slot.time < endTime;
        const isSelected = isStart || isEnd || isInRange;

        return (
          <TouchableOpacity
            key={slot.time}
            style={[
              styles.timeSlotChip,
              isStart && styles.timeSlotStart,
              isEnd && styles.timeSlotEnd,
              isInRange && styles.timeSlotInRange,
            ]}
            onPress={() => onSlotPress(slot.time)}
          >
            <Text
              style={[
                styles.timeSlotChipText,
                isSelected && styles.timeSlotChipTextActive,
              ]}
              numberOfLines={1}
            >
              {slot.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ============================================================
// Step Indicator Component
// ============================================================
function StepIndicator({ currentStep, totalSteps }) {
  const steps = ["Details", "Schedule", "Contract", "Payment"];
  return (
    <View style={styles.stepIndicatorContainer}>
      {steps.map((label, index) => {
        const stepNum = index + 1;
        const isActive = stepNum === currentStep;
        const isComplete = stepNum < currentStep;
        return (
          <View key={label} style={styles.stepItem}>
            <View
              style={[
                styles.stepCircle,
                isActive && styles.stepCircleActive,
                isComplete && styles.stepCircleComplete,
              ]}
            >
              {isComplete ? (
                <MaterialCommunityIcons name="check" size={14} color="#fff" />
              ) : (
                <Text
                  style={[
                    styles.stepNumber,
                    (isActive || isComplete) && styles.stepNumberActive,
                  ]}
                >
                  {stepNum}
                </Text>
              )}
            </View>
            <Text
              style={[
                styles.stepLabel,
                isActive && styles.stepLabelActive,
                isComplete && styles.stepLabelComplete,
              ]}
            >
              {label}
            </Text>
            {index < steps.length - 1 && (
              <View
                style={[
                  styles.stepLine,
                  isComplete && styles.stepLineComplete,
                ]}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}

// ============================================================
// Academy Card Component
// ============================================================
/**
 * Calculate days remaining until contract expiry
 */
const getDaysUntilExpiry = (endDateStr) => {
  if (!endDateStr) return null;
  const today = getTodayString();
  const [ty, tm, td] = today.split("-").map(Number);
  const [ey, em, ed] = endDateStr.split("-").map(Number);
  const todayDate = new Date(ty, tm - 1, td);
  const endDate = new Date(ey, em - 1, ed);
  const diffMs = endDate - todayDate;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
};

function AcademyCard({ academy, onPress, onStatusChange }) {
  const status = STATUS_CONFIG[academy.status] || STATUS_CONFIG.active;
  const scheduleDays = academy.schedule?.days;
  const isOldFormat = Array.isArray(scheduleDays);
  const daysArr = isOldFormat ? scheduleDays : (scheduleDays ? Object.keys(scheduleDays) : []);
  const daysLabel = daysArr
    .map((d) => d.charAt(0).toUpperCase() + d.slice(1, 3))
    .join(", ");

  const daysUntilExpiry = academy.status === "active"
    ? getDaysUntilExpiry(academy.contract?.endDate)
    : null;
  const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry >= 0 && daysUntilExpiry <= 5;

  return (
    <TouchableOpacity onPress={() => onPress(academy)} activeOpacity={0.7}>
      <Surface style={styles.academyCard} elevation={2}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {academy.name}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
              <Text style={[styles.statusText, { color: status.color }]}>
                {status.label}
              </Text>
            </View>
          </View>
          <IconButton
            icon={academy.status === "active" ? "pause-circle-outline" : "play-circle-outline"}
            iconColor={academy.status === "active" ? "#FF9800" : "#4CAF50"}
            size={24}
            onPress={() => onStatusChange(academy)}
          />
        </View>

        {academy.sessionsGenerated === false && (
          <View style={styles.sessionsPendingBanner}>
            <MaterialCommunityIcons name="alert-circle-outline" size={14} color="#E65100" />
            <Text style={styles.sessionsPendingText}>Sessions pending</Text>
          </View>
        )}

        <View style={styles.cardBody}>
          <View style={styles.cardRow}>
            <MaterialCommunityIcons name="basketball" size={16} color="#666" />
            <Text style={styles.cardRowText}>{academy.sport || "N/A"}</Text>
          </View>
          <View style={styles.cardRow}>
            <MaterialCommunityIcons name="soccer-field" size={16} color="#666" />
            <Text style={styles.cardRowText}>{academy.groundName || "N/A"}</Text>
          </View>
          <View style={styles.cardRow}>
            <MaterialCommunityIcons name="calendar-week" size={16} color="#666" />
            <Text style={styles.cardRowText}>{daysLabel || "No days"}</Text>
          </View>
          <View style={styles.cardRow}>
            <MaterialCommunityIcons name="clock-outline" size={16} color="#666" />
            <Text style={styles.cardRowText}>
              {isOldFormat
                ? `${formatTime(academy.schedule?.startTime)} - ${formatTime(academy.schedule?.endTime)}`
                : daysArr.map((d) => {
                    const t = scheduleDays[d];
                    return `${d.slice(0, 3).charAt(0).toUpperCase() + d.slice(1, 3)} ${formatTime(t?.startTime)}-${formatTime(t?.endTime)}`;
                  }).join(", ")
              }
            </Text>
          </View>
          <View style={styles.cardRow}>
            <MaterialCommunityIcons name="calendar-range" size={16} color="#666" />
            <Text style={styles.cardRowText}>
              {formatDate(academy.contract?.startDate)} - {formatDate(academy.contract?.endDate)}
            </Text>
          </View>
          <View style={styles.cardRow}>
            <MaterialCommunityIcons name="currency-inr" size={16} color="#666" />
            <Text style={styles.cardRowText}>
              {"\u20B9"}{academy.payment?.totalAmount || 0}
              {academy.payment?.cashAmount > 0 && ` (Cash: \u20B9${academy.payment.cashAmount})`}
            </Text>
          </View>
        </View>

        {isExpiringSoon && (
          <View style={styles.expiryBanner}>
            <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#E65100" />
            <Text style={styles.expiryBannerText}>
              {daysUntilExpiry === 0
                ? "Expires today"
                : `Expiring in ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? "s" : ""}`}
            </Text>
          </View>
        )}

        {academy.contactName && (
          <View style={styles.cardFooter}>
            <MaterialCommunityIcons name="account" size={14} color="#999" />
            <Text style={styles.cardFooterText}>
              {academy.contactName}{academy.contactPhone ? ` \u2022 ${academy.contactPhone}` : ""}
            </Text>
          </View>
        )}
      </Surface>
    </TouchableOpacity>
  );
}

// ============================================================
// Main Screen
// ============================================================
export default function AcademyManagementScreen({ navigation }) {
  const { selectedTurfId, turfData } = useSelectedTurf();
  const user = useAppSelector(selectUser);

  // List state
  const [academies, setAcademies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Detail dialog
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedAcademy, setSelectedAcademy] = useState(null);

  // Sessions state
  const [sessionsVisible, setSessionsVisible] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  // Renewal state
  const [renewalVisible, setRenewalVisible] = useState(false);
  const [renewalDuration, setRenewalDuration] = useState(1);
  const [renewalAmount, setRenewalAmount] = useState("");
  const [renewalCashAmount, setRenewalCashAmount] = useState("");
  const [renewalSubmitting, setRenewalSubmitting] = useState(false);

  // Generate sessions state
  const [generatingSessionsId, setGeneratingSessionsId] = useState(null);

  // Form state - Step 1: Basic Details
  const [name, setName] = useState("");
  const [sport, setSport] = useState("");
  const [groundId, setGroundId] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  // Form state - Step 2: Schedule (per-day times)
  const [daySchedules, setDaySchedules] = useState({});
  // Shape: { monday: { startTime: "06:00", endTime: "08:00" }, ... }
  const [activeDay, setActiveDay] = useState(null); // day currently being configured
  const [tempStartTime, setTempStartTime] = useState(null);
  const [tempEndTime, setTempEndTime] = useState(null);

  // Form state - Step 3: Contract
  const [startDate, setStartDate] = useState(getTodayString());
  const [durationMonths, setDurationMonths] = useState(1);

  // Form state - Step 4: Payment
  const [totalAmount, setTotalAmount] = useState("");
  const [cashAmount, setCashAmount] = useState("");

  // Computed values
  const grounds = useMemo(() => {
    if (!turfData?.grounds) return [];
    return turfData.grounds.map((g, i) => ({
      ...g,
      id: g.id || `ground_${i}`,
    }));
  }, [turfData]);

  const sports = useMemo(() => {
    const sportSet = new Set();
    (turfData?.grounds || []).forEach((g) => {
      (g.sports || []).forEach((s) => sportSet.add(s));
    });
    return Array.from(sportSet);
  }, [turfData]);

  const selectedGroundName = useMemo(() => {
    const g = grounds.find((gr) => gr.id === groundId);
    return g?.name || "";
  }, [grounds, groundId]);

  // Derived from daySchedules
  const selectedDays = useMemo(() => Object.keys(daySchedules), [daySchedules]);

  const endDate = useMemo(() => {
    return addMonthsToDate(startDate, durationMonths);
  }, [startDate, durationMonths]);

  const sessionCount = useMemo(() => {
    if (selectedDays.length === 0) return 0;
    return generateSessionDates(startDate, endDate, selectedDays).length;
  }, [startDate, endDate, selectedDays]);

  const onlineAmount = useMemo(() => {
    const total = parseFloat(totalAmount) || 0;
    const cash = parseFloat(cashAmount) || 0;
    return Math.max(0, total - cash);
  }, [totalAmount, cashAmount]);

  // Renewal computed values
  const renewalStartDate = useMemo(() => {
    if (!selectedAcademy?.contract?.endDate) return getTodayString();
    const oldEnd = selectedAcademy.contract.endDate;
    const today = getTodayString();
    // Start from the day after old end date, or today if past
    if (oldEnd < today) return today;
    const [y, m, d] = oldEnd.split("-").map(Number);
    const nextDay = new Date(y, m - 1, d + 1);
    return `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, "0")}-${String(nextDay.getDate()).padStart(2, "0")}`;
  }, [selectedAcademy]);

  const renewalEndDate = useMemo(() => {
    return addMonthsToDate(renewalStartDate, renewalDuration);
  }, [renewalStartDate, renewalDuration]);

  const renewalSessionCount = useMemo(() => {
    if (!selectedAcademy?.schedule?.days) return 0;
    const sched = selectedAcademy.schedule.days;
    const daysArr = Array.isArray(sched) ? sched : Object.keys(sched);
    if (daysArr.length === 0) return 0;
    return generateSessionDates(renewalStartDate, renewalEndDate, daysArr).length;
  }, [renewalStartDate, renewalEndDate, selectedAcademy]);

  const renewalOnlineAmount = useMemo(() => {
    const total = parseFloat(renewalAmount) || 0;
    const cash = parseFloat(renewalCashAmount) || 0;
    return Math.max(0, total - cash);
  }, [renewalAmount, renewalCashAmount]);

  // Subscribe to academies
  useEffect(() => {
    if (!selectedTurfId) {
      setAcademies([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToCollection(
      "academies",
      (docs) => {
        setAcademies(docs);
        setLoading(false);
        setRefreshing(false);
      },
      [{ field: "turfId", operator: "==", value: selectedTurfId }]
    );

    return () => unsubscribe();
  }, [selectedTurfId]);

  // Filtered list
  const filteredAcademies = useMemo(() => {
    if (statusFilter === "all") return academies;
    return academies.filter((a) => a.status === statusFilter);
  }, [academies, statusFilter]);

  // Reset form
  const resetForm = useCallback(() => {
    setCurrentStep(1);
    setName("");
    setSport("");
    setGroundId("");
    setContactName("");
    setContactPhone("");
    setDaySchedules({});
    setActiveDay(null);
    setTempStartTime(null);
    setTempEndTime(null);
    setStartDate(getTodayString());
    setDurationMonths(1);
    setTotalAmount("");
    setCashAmount("");
  }, []);

  // Open create modal
  const openCreateModal = useCallback(() => {
    resetForm();
    setModalVisible(true);
  }, [resetForm]);

  // Handle day toggle — add/remove from schedule, set active for time editing
  const handleDayPress = useCallback((dayKey) => {
    if (daySchedules[dayKey]) {
      // Day already selected — set as active to edit times
      setActiveDay(dayKey);
      setTempStartTime(daySchedules[dayKey].startTime);
      setTempEndTime(daySchedules[dayKey].endTime);
    } else {
      // Add day with default times
      const defaultStart = "06:00";
      const defaultEnd = "07:00";
      setDaySchedules((prev) => ({
        ...prev,
        [dayKey]: { startTime: defaultStart, endTime: defaultEnd },
      }));
      setActiveDay(dayKey);
      setTempStartTime(defaultStart);
      setTempEndTime(defaultEnd);
    }
  }, [daySchedules]);

  // Remove a day from schedule
  const handleDayRemove = useCallback((dayKey) => {
    setDaySchedules((prev) => {
      const next = { ...prev };
      delete next[dayKey];
      return next;
    });
    if (activeDay === dayKey) {
      setActiveDay(null);
      setTempStartTime(null);
      setTempEndTime(null);
    }
  }, [activeDay]);

  // Handle time slot press for the active day
  const handleTimeSlotPress = useCallback((time) => {
    if (!activeDay) return;

    if (!tempStartTime || (tempStartTime && tempEndTime)) {
      // Start new selection
      setTempStartTime(time);
      setTempEndTime(null);
    } else {
      // Complete selection
      if (time <= tempStartTime) {
        // Clicked before start, make this the new start
        setTempStartTime(time);
        setTempEndTime(null);
      } else {
        setTempEndTime(time);
        // Save to daySchedules
        setDaySchedules((prev) => ({
          ...prev,
          [activeDay]: { startTime: tempStartTime, endTime: time },
        }));
      }
    }
  }, [activeDay, tempStartTime, tempEndTime]);

  // Apply current day's times to all selected days
  const handleApplyToAllDays = useCallback(() => {
    if (!activeDay || !daySchedules[activeDay]) return;
    const { startTime: st, endTime: et } = daySchedules[activeDay];
    setDaySchedules((prev) => {
      const next = {};
      for (const day of Object.keys(prev)) {
        next[day] = { startTime: st, endTime: et };
      }
      return next;
    });
    Alert.alert("Applied", `${formatTime(st)} - ${formatTime(et)} applied to all days.`);
  }, [activeDay, daySchedules]);

  // Navigate start date
  const navigateStartDate = useCallback((direction) => {
    const [y, m, d] = startDate.split("-").map(Number);
    const date = new Date(y, m - 1, d + direction);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) return; // Don't go before today
    setStartDate(
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
    );
  }, [startDate]);

  // Validation
  const validateStep = useCallback((step) => {
    switch (step) {
      case 1:
        if (!name.trim()) { Alert.alert("Missing", "Please enter an academy name."); return false; }
        if (!sport) { Alert.alert("Missing", "Please select a sport."); return false; }
        if (!groundId) { Alert.alert("Missing", "Please select a ground."); return false; }
        return true;
      case 2:
        if (Object.keys(daySchedules).length === 0) { Alert.alert("Missing", "Please select at least one day."); return false; }
        for (const [day, times] of Object.entries(daySchedules)) {
          if (!times.startTime || !times.endTime || times.startTime >= times.endTime) {
            const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);
            Alert.alert("Invalid", `End time must be after start time for ${dayLabel}.`);
            return false;
          }
        }
        return true;
      case 3:
        if (!startDate) { Alert.alert("Missing", "Please set a start date."); return false; }
        if (sessionCount === 0) { Alert.alert("No Sessions", "The selected schedule produces no sessions in the contract period."); return false; }
        return true;
      case 4:
        if (!totalAmount || parseFloat(totalAmount) <= 0) { Alert.alert("Invalid", "Please enter a valid total amount."); return false; }
        const cash = parseFloat(cashAmount) || 0;
        if (cash > parseFloat(totalAmount)) { Alert.alert("Invalid", "Cash amount cannot exceed total amount."); return false; }
        return true;
      default:
        return true;
    }
  }, [name, sport, groundId, daySchedules, startDate, sessionCount, totalAmount, cashAmount]);

  // Go to next step
  const nextStep = useCallback(() => {
    if (!validateStep(currentStep)) return;
    setCurrentStep((prev) => Math.min(prev + 1, 4));
  }, [currentStep, validateStep]);

  // Go to previous step
  const prevStep = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  }, []);

  // Submit academy — sessions are auto-generated by Cloud Function (generateAcademySessions)
  const handleSubmit = useCallback(async () => {
    if (!validateStep(4)) return;

    setSubmitting(true);

    try {
      const total = parseFloat(totalAmount) || 0;
      const cash = parseFloat(cashAmount) || 0;

      // Create academy document — Cloud Function will generate sessions on create
      const academyData = {
        name: name.trim(),
        sport,
        turfId: selectedTurfId,
        turfName: turfData?.name || "",
        groundId,
        groundName: selectedGroundName,
        contactName: contactName.trim(),
        contactPhone: contactPhone.trim(),
        schedule: {
          days: daySchedules,
        },
        contract: {
          startDate,
          endDate,
          durationMonths,
        },
        payment: {
          totalAmount: total,
          cashAmount: cash,
          onlineAmount: total - cash,
        },
        status: "active",
        sessionCount,
        sessionsGenerated: false,
        createdBy: user?.userId,
        createdByName: user?.name || user?.displayName || "",
      };

      await addDocument("academies", academyData);

      setModalVisible(false);
      resetForm();
      Alert.alert(
        "Academy Created",
        `"${name.trim()}" created. ${sessionCount} sessions are being generated.`
      );
    } catch (error) {
      console.error("Error creating academy:", error);
      Alert.alert("Error", "Failed to create academy. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [
    validateStep, totalAmount, cashAmount, name, sport, selectedTurfId,
    turfData, groundId, selectedGroundName, contactName, contactPhone,
    daySchedules, startDate, endDate, durationMonths,
    sessionCount, user, resetForm,
  ]);

  // Toggle academy status
  const handleStatusChange = useCallback(async (academy) => {
    const newStatus = academy.status === "active" ? "paused" : "active";
    const label = newStatus === "active" ? "resume" : "pause";

    Alert.alert(
      `${label.charAt(0).toUpperCase() + label.slice(1)} Academy`,
      `Are you sure you want to ${label} "${academy.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: `Yes, ${label}`,
          onPress: async () => {
            try {
              await updateDocument("academies", academy.id, { status: newStatus });
            } catch (error) {
              Alert.alert("Error", "Failed to update academy status.");
            }
          },
        },
      ]
    );
  }, []);

  // View academy details
  const handleViewDetails = useCallback((academy) => {
    setSelectedAcademy(academy);
    setDetailVisible(true);
  }, []);

  // Trigger session generation by updating the academy doc.
  // The onAcademyStatusChange cloud function has self-healing logic:
  // any update to a doc with sessionsGenerated===false && status==="active"
  // will automatically generate the sessions.
  const handleGenerateSessions = useCallback(async () => {
    if (!selectedAcademy) return;
    setGeneratingSessionsId(selectedAcademy.id);
    try {
      await updateDocument("academies", selectedAcademy.id, {
        sessionGenerationRequestedAt: new Date(),
      });
      Alert.alert(
        "Generating Sessions",
        "Session generation has been triggered. Sessions will appear shortly — pull to refresh or check back in a moment."
      );
      setDetailVisible(false);
    } catch (error) {
      console.error("Error triggering session generation:", error);
      Alert.alert("Error", "Failed to trigger session generation. Please try again.");
    } finally {
      setGeneratingSessionsId(null);
    }
  }, [selectedAcademy]);

  // Load sessions for an academy
  const loadSessions = useCallback(async (academyId) => {
    setSessionsLoading(true);
    try {
      const results = await queryDocuments("academy_sessions", [
        { field: "academyId", operator: "==", value: academyId },
      ]);
      // Sort by date ascending
      results.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
      setSessions(results);
    } catch (error) {
      console.error("Error loading sessions:", error);
      Alert.alert("Error", "Failed to load sessions.");
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  // View sessions for selected academy
  const handleViewSessions = useCallback(async () => {
    if (!selectedAcademy) return;
    await loadSessions(selectedAcademy.id);
    setDetailVisible(false);
    setSessionsVisible(true);
  }, [selectedAcademy, loadSessions]);

  // Open renewal modal
  const handleOpenRenewal = useCallback(() => {
    if (!selectedAcademy) return;
    setRenewalDuration(selectedAcademy.contract?.durationMonths || 1);
    setRenewalAmount(String(selectedAcademy.payment?.totalAmount || ""));
    setRenewalCashAmount(String(selectedAcademy.payment?.cashAmount || ""));
    setDetailVisible(false);
    setRenewalVisible(true);
  }, [selectedAcademy]);

  // Submit renewal
  const handleRenewalSubmit = useCallback(async () => {
    if (!selectedAcademy) return;

    const total = parseFloat(renewalAmount) || 0;
    const cash = parseFloat(renewalCashAmount) || 0;

    if (total <= 0) {
      Alert.alert("Invalid", "Please enter a valid total amount.");
      return;
    }
    if (cash > total) {
      Alert.alert("Invalid", "Cash amount cannot exceed total amount.");
      return;
    }
    if (renewalSessionCount === 0) {
      Alert.alert("No Sessions", "The selected duration produces no sessions.");
      return;
    }

    setRenewalSubmitting(true);

    try {
      await updateDocument("academies", selectedAcademy.id, {
        "contract.startDate": renewalStartDate,
        "contract.endDate": renewalEndDate,
        "contract.durationMonths": renewalDuration,
        "payment.totalAmount": total,
        "payment.cashAmount": cash,
        "payment.onlineAmount": total - cash,
        status: "active",
        sessionsGenerated: false,
        renewalReminderSent: false,
        renewedAt: new Date(),
        renewalHistory: [
          ...(selectedAcademy.renewalHistory || []),
          {
            previousStartDate: selectedAcademy.contract?.startDate,
            previousEndDate: selectedAcademy.contract?.endDate,
            newStartDate: renewalStartDate,
            newEndDate: renewalEndDate,
            durationMonths: renewalDuration,
            amount: total,
            renewedAt: new Date().toISOString(),
          },
        ],
      });

      setRenewalVisible(false);
      setSelectedAcademy(null);
      Alert.alert(
        "Academy Renewed",
        `"${selectedAcademy.name}" has been renewed. ${renewalSessionCount} new sessions are being generated.`
      );
    } catch (error) {
      console.error("Error renewing academy:", error);
      Alert.alert("Error", "Failed to renew academy. Please try again.");
    } finally {
      setRenewalSubmitting(false);
    }
  }, [
    selectedAcademy, renewalAmount, renewalCashAmount, renewalSessionCount,
    renewalStartDate, renewalEndDate, renewalDuration,
  ]);

  // Cancel individual session
  const handleCancelSession = useCallback((session) => {
    Alert.alert(
      "Cancel Session",
      `Cancel the session on ${formatDate(session.date)} (${formatTime(session.startTime)} - ${formatTime(session.endTime)})?\n\nThis will open the slot for regular bookings.`,
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            try {
              await updateDocument("academy_sessions", session.id, {
                status: "cancelled",
                availableForBooking: true,
              });
              // Update local state
              setSessions((prev) =>
                prev.map((s) =>
                  s.id === session.id
                    ? { ...s, status: "cancelled", availableForBooking: true }
                    : s
                )
              );
            } catch (error) {
              Alert.alert("Error", "Failed to cancel session.");
            }
          },
        },
      ]
    );
  }, []);

  // Refresh
  const onRefresh = useCallback(() => {
    setRefreshing(true);
  }, []);

  // ============================
  // Render: Step 1 - Basic Details
  // ============================
  const renderStep1 = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepTitle}>Basic Details</Text>

      <TextInput
        label="Academy Name *"
        value={name}
        onChangeText={setName}
        mode="outlined"
        style={styles.input}
        outlineColor="#ddd"
        activeOutlineColor={MANAGER_BLUE}
      />

      <Text style={styles.fieldLabel}>Sport *</Text>
      <View style={styles.chipGroup}>
        {sports.map((s) => (
          <Chip
            key={s}
            selected={sport === s}
            onPress={() => setSport(s)}
            mode="outlined"
            style={styles.chip}
            selectedColor={MANAGER_BLUE}
          >
            {s}
          </Chip>
        ))}
        {sports.length === 0 && (
          <Text style={styles.hintText}>No sports configured for this turf</Text>
        )}
      </View>

      <Text style={styles.fieldLabel}>Ground *</Text>
      <View style={styles.chipGroup}>
        {grounds.map((g) => (
          <Chip
            key={g.id}
            selected={groundId === g.id}
            onPress={() => setGroundId(g.id)}
            mode="outlined"
            style={styles.chip}
            selectedColor={MANAGER_BLUE}
          >
            {g.name}
          </Chip>
        ))}
      </View>

      <TextInput
        label="Contact Name"
        value={contactName}
        onChangeText={setContactName}
        mode="outlined"
        style={styles.input}
        outlineColor="#ddd"
        activeOutlineColor={MANAGER_BLUE}
      />

      <TextInput
        label="Contact Phone"
        value={contactPhone}
        onChangeText={setContactPhone}
        mode="outlined"
        style={styles.input}
        keyboardType="phone-pad"
        outlineColor="#ddd"
        activeOutlineColor={MANAGER_BLUE}
      />
    </ScrollView>
  );

  // ============================
  // Render: Step 2 - Schedule (Per-day times)
  // ============================
  const renderStep2 = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepTitle}>Schedule</Text>

      <Text style={styles.fieldLabel}>Days of the Week *</Text>
      <Text style={styles.hintText}>Tap to select & edit time. Long press to remove.</Text>
      <View style={styles.dayCircleRow}>
        {DAYS_OF_WEEK.map((day) => {
          const isSelected = !!daySchedules[day.key];
          const isActive = activeDay === day.key;
          return (
            <TouchableOpacity
              key={day.key}
              style={[
                styles.dayCircle,
                isSelected && styles.dayCircleSelected,
                isActive && styles.dayCircleActive,
              ]}
              onPress={() => handleDayPress(day.key)}
              onLongPress={() => isSelected && handleDayRemove(day.key)}
            >
              <Text
                style={[
                  styles.dayCircleText,
                  (isSelected || isActive) && styles.dayCircleTextActive,
                ]}
              >
                {day.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {selectedDays.length > 0 && (
        <Text style={styles.hintText}>
          {selectedDays.length} day(s) selected
        </Text>
      )}

      {/* Per-day time grid */}
      {activeDay && (
        <>
          <Divider style={styles.divider} />
          <Text style={styles.fieldLabel}>
            Set time for {activeDay.charAt(0).toUpperCase() + activeDay.slice(1)}
          </Text>

          {/* Time range display */}
          {tempStartTime && (
            <Surface style={styles.summaryBox} elevation={1}>
              <MaterialCommunityIcons name="clock-outline" size={18} color={MANAGER_BLUE} />
              <Text style={styles.summaryText}>
                {formatTime(tempStartTime)}
                {tempEndTime ? ` → ${formatTime(tempEndTime)}` : " → Select end time"}
              </Text>
              {tempStartTime && tempEndTime && tempStartTime < tempEndTime && (
                <Text style={[styles.summaryText, { color: MANAGER_BLUE, fontWeight: "700" }]}>
                  {(() => {
                    const [sh, sm] = tempStartTime.split(":").map(Number);
                    const [eh, em] = tempEndTime.split(":").map(Number);
                    const mins = (eh * 60 + em) - (sh * 60 + sm);
                    const h = Math.floor(mins / 60);
                    const m = mins % 60;
                    return ` (${h}h${m > 0 ? ` ${m}m` : ""})`;
                  })()}
                </Text>
              )}
            </Surface>
          )}

          <TimeSlotGrid
            startTime={tempStartTime}
            endTime={tempEndTime}
            onSlotPress={handleTimeSlotPress}
          />

          {selectedDays.length > 1 && (
            <Button
              mode="outlined"
              onPress={handleApplyToAllDays}
              style={{ marginTop: 12 }}
              icon="content-copy"
              textColor={MANAGER_BLUE}
            >
              Apply to all days
            </Button>
          )}
        </>
      )}

      {/* Schedule summary */}
      {selectedDays.length > 0 && (
        <>
          <Divider style={styles.divider} />
          <Text style={styles.fieldLabel}>Schedule Summary</Text>
          {selectedDays.map((day) => {
            const t = daySchedules[day];
            const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);
            return (
              <View key={day} style={styles.scheduleSummaryRow}>
                <Text style={styles.scheduleSummaryDay}>{dayLabel}:</Text>
                <Text style={styles.scheduleSummaryTime}>
                  {formatTime(t.startTime)} - {formatTime(t.endTime)}
                </Text>
              </View>
            );
          })}
        </>
      )}
    </ScrollView>
  );

  // ============================
  // Render: Step 3 - Contract Period
  // ============================
  const renderStep3 = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepTitle}>Contract Period</Text>

      <Text style={styles.fieldLabel}>Start Date</Text>
      <View style={styles.dateNav}>
        <IconButton
          icon="chevron-left"
          size={24}
          onPress={() => navigateStartDate(-1)}
        />
        <TouchableOpacity style={styles.dateDisplay}>
          <Text style={styles.dateDisplayText}>{formatDate(startDate)}</Text>
        </TouchableOpacity>
        <IconButton
          icon="chevron-right"
          size={24}
          onPress={() => navigateStartDate(1)}
        />
      </View>

      <Text style={styles.fieldLabel}>Duration</Text>
      <View style={styles.chipGroup}>
        {DURATION_OPTIONS.map((opt) => (
          <Chip
            key={opt.value}
            selected={durationMonths === opt.value}
            onPress={() => setDurationMonths(opt.value)}
            mode="outlined"
            style={styles.chip}
            selectedColor={MANAGER_BLUE}
          >
            {opt.label}
          </Chip>
        ))}
      </View>

      <Divider style={styles.divider} />

      <Surface style={styles.contractSummary} elevation={1}>
        <Text style={styles.contractSummaryTitle}>Contract Summary</Text>

        <View style={styles.contractRow}>
          <MaterialCommunityIcons name="calendar-start" size={18} color="#666" />
          <Text style={styles.contractLabel}>Start:</Text>
          <Text style={styles.contractValue}>{formatDate(startDate)}</Text>
        </View>
        <View style={styles.contractRow}>
          <MaterialCommunityIcons name="calendar-end" size={18} color="#666" />
          <Text style={styles.contractLabel}>End:</Text>
          <Text style={styles.contractValue}>{formatDate(endDate)}</Text>
        </View>
        <View style={styles.contractRow}>
          <MaterialCommunityIcons name="calendar-multiple" size={18} color="#666" />
          <Text style={styles.contractLabel}>Duration:</Text>
          <Text style={styles.contractValue}>{durationMonths} month(s)</Text>
        </View>
        <View style={styles.contractRow}>
          <MaterialCommunityIcons name="counter" size={18} color="#666" />
          <Text style={styles.contractLabel}>Sessions:</Text>
          <Text style={[styles.contractValue, { color: MANAGER_BLUE, fontWeight: "700" }]}>
            {sessionCount}
          </Text>
        </View>
        {selectedDays.length > 0 && (
          <View style={styles.contractRow}>
            <MaterialCommunityIcons name="calendar-week" size={18} color="#666" />
            <Text style={styles.contractLabel}>Days:</Text>
            <Text style={styles.contractValue}>
              {selectedDays.map((d) => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(", ")}
            </Text>
          </View>
        )}
      </Surface>
    </ScrollView>
  );

  // ============================
  // Render: Step 4 - Payment
  // ============================
  const renderStep4 = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepTitle}>Payment Details</Text>

      <TextInput
        label="Total Amount (\u20B9) *"
        value={totalAmount}
        onChangeText={setTotalAmount}
        mode="outlined"
        style={styles.input}
        keyboardType="numeric"
        outlineColor="#ddd"
        activeOutlineColor={MANAGER_BLUE}
      />

      <TextInput
        label="Cash Amount (\u20B9)"
        value={cashAmount}
        onChangeText={setCashAmount}
        mode="outlined"
        style={styles.input}
        keyboardType="numeric"
        outlineColor="#ddd"
        activeOutlineColor={MANAGER_BLUE}
      />

      <Surface style={styles.paymentSummary} elevation={1}>
        <Text style={styles.paymentSummaryTitle}>Payment Breakdown</Text>

        <View style={styles.paymentRow}>
          <Text style={styles.paymentLabel}>Total Amount</Text>
          <Text style={styles.paymentValue}>{"\u20B9"}{parseFloat(totalAmount) || 0}</Text>
        </View>
        <View style={styles.paymentRow}>
          <Text style={styles.paymentLabel}>Cash</Text>
          <Text style={styles.paymentValue}>{"\u20B9"}{parseFloat(cashAmount) || 0}</Text>
        </View>
        <Divider style={{ marginVertical: 8 }} />
        <View style={styles.paymentRow}>
          <Text style={[styles.paymentLabel, { fontWeight: "700" }]}>Online</Text>
          <Text style={[styles.paymentValue, { color: MANAGER_BLUE, fontWeight: "700" }]}>
            {"\u20B9"}{onlineAmount}
          </Text>
        </View>

        {sessionCount > 0 && parseFloat(totalAmount) > 0 && (
          <>
            <Divider style={{ marginVertical: 8 }} />
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>Per Session</Text>
              <Text style={styles.paymentValue}>
                {"\u20B9"}{(parseFloat(totalAmount) / sessionCount).toFixed(0)}
              </Text>
            </View>
          </>
        )}
      </Surface>

      <Surface style={styles.finalSummary} elevation={1}>
        <Text style={styles.finalSummaryTitle}>
          <MaterialCommunityIcons name="check-circle-outline" size={16} color={MANAGER_BLUE} />
          {" "}Review
        </Text>
        <Text style={styles.finalSummaryRow}>{name} - {sport}</Text>
        <Text style={styles.finalSummaryRow}>
          {selectedGroundName} | {selectedDays.map((d) => d.slice(0, 3)).join(", ")}
        </Text>
        {selectedDays.map((day) => {
          const t = daySchedules[day];
          return (
            <Text key={day} style={styles.finalSummaryRow}>
              {day.charAt(0).toUpperCase() + day.slice(1, 3)}: {formatTime(t?.startTime)} - {formatTime(t?.endTime)}
            </Text>
          );
        })}
        <Text style={styles.finalSummaryRow}>
          {formatDate(startDate)} to {formatDate(endDate)} ({sessionCount} sessions)
        </Text>
      </Surface>
    </ScrollView>
  );

  // ============================
  // Render: Create Modal
  // ============================
  const renderCreateModal = () => (
    <Modal
      visible={modalVisible}
      animationType="slide"
      onRequestClose={() => {
        if (!submitting) setModalVisible(false);
      }}
    >
      <SafeAreaView style={styles.modalContainer}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <IconButton
              icon="close"
              size={24}
              onPress={() => {
                if (!submitting) setModalVisible(false);
              }}
            />
            <Text style={styles.modalTitle}>Add Academy</Text>
            <View style={{ width: 48 }} />
          </View>

          {/* Step Indicator */}
          <StepIndicator currentStep={currentStep} totalSteps={4} />

          {/* Step Content */}
          <View style={{ flex: 1 }}>
            {currentStep === 1 && renderStep1()}
            {currentStep === 2 && renderStep2()}
            {currentStep === 3 && renderStep3()}
            {currentStep === 4 && renderStep4()}
          </View>

          {/* Navigation Buttons */}
          <View style={styles.modalFooter}>
            {currentStep > 1 && (
              <Button
                mode="outlined"
                onPress={prevStep}
                style={styles.footerButton}
                disabled={submitting}
              >
                Back
              </Button>
            )}
            {currentStep < 4 ? (
              <Button
                mode="contained"
                onPress={nextStep}
                style={[styles.footerButton, styles.footerButtonPrimary]}
                buttonColor={MANAGER_BLUE}
              >
                Next
              </Button>
            ) : (
              <Button
                mode="contained"
                onPress={handleSubmit}
                style={[styles.footerButton, styles.footerButtonPrimary]}
                buttonColor="#4CAF50"
                loading={submitting}
                disabled={submitting}
              >
                Create Academy
              </Button>
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );

  // ============================
  // Render: Detail Dialog
  // ============================
  const renderDetailDialog = () => (
    <Portal>
      <Dialog visible={detailVisible} onDismiss={() => setDetailVisible(false)}>
        <Dialog.Title>{selectedAcademy?.name || "Academy Details"}</Dialog.Title>
        <Dialog.ScrollArea style={{ maxHeight: 400 }}>
          <ScrollView>
            {selectedAcademy && (
              <View style={{ padding: 4 }}>
                {selectedAcademy.sessionsGenerated === false && (
                  <View style={styles.sessionsWarningBanner}>
                    <MaterialCommunityIcons name="alert-circle" size={20} color="#E65100" />
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={styles.sessionsWarningTitle}>Sessions not generated</Text>
                      <Text style={styles.sessionsWarningText}>
                        Sessions have not been generated yet. Tap the button below to generate them manually.
                      </Text>
                    </View>
                  </View>
                )}
                <DetailRow icon="basketball" label="Sport" value={selectedAcademy.sport} />
                <DetailRow icon="soccer-field" label="Ground" value={selectedAcademy.groundName} />
                <DetailRow
                  icon="calendar-week"
                  label="Days"
                  value={(() => {
                    const sched = selectedAcademy.schedule?.days;
                    const arr = Array.isArray(sched) ? sched : (sched ? Object.keys(sched) : []);
                    return arr.map((d) => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(", ");
                  })()}
                />
                <DetailRow
                  icon="clock-outline"
                  label="Time"
                  value={(() => {
                    const sched = selectedAcademy.schedule;
                    if (Array.isArray(sched?.days)) {
                      return `${formatTime(sched?.startTime)} - ${formatTime(sched?.endTime)}`;
                    }
                    if (sched?.days && typeof sched.days === "object") {
                      return Object.entries(sched.days).map(([d, t]) =>
                        `${d.charAt(0).toUpperCase() + d.slice(1, 3)}: ${formatTime(t.startTime)}-${formatTime(t.endTime)}`
                      ).join(", ");
                    }
                    return "N/A";
                  })()}
                />
                <DetailRow
                  icon="calendar-range"
                  label="Contract"
                  value={`${formatDate(selectedAcademy.contract?.startDate)} - ${formatDate(selectedAcademy.contract?.endDate)}`}
                />
                <DetailRow
                  icon="counter"
                  label="Sessions"
                  value={`${selectedAcademy.sessionCount || "N/A"}`}
                />
                <DetailRow
                  icon="currency-inr"
                  label="Total"
                  value={`\u20B9${selectedAcademy.payment?.totalAmount || 0}`}
                />
                {selectedAcademy.contactName && (
                  <DetailRow icon="account" label="Contact" value={selectedAcademy.contactName} />
                )}
                {selectedAcademy.contactPhone && (
                  <DetailRow icon="phone" label="Phone" value={selectedAcademy.contactPhone} />
                )}
                <DetailRow
                  icon="information"
                  label="Status"
                  value={STATUS_CONFIG[selectedAcademy.status]?.label || selectedAcademy.status}
                  valueColor={STATUS_CONFIG[selectedAcademy.status]?.color}
                />
              </View>
            )}
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions style={{ flexWrap: "wrap" }}>
          {selectedAcademy?.sessionsGenerated === false && (
            <Button
              onPress={handleGenerateSessions}
              icon="cog-sync"
              textColor="#E65100"
              loading={generatingSessionsId === selectedAcademy?.id}
              disabled={generatingSessionsId === selectedAcademy?.id}
            >
              Generate Sessions
            </Button>
          )}
          {selectedAcademy?.status === "expired" && (
            <Button onPress={handleOpenRenewal} icon="refresh" textColor="#4CAF50">
              Renew
            </Button>
          )}
          <Button onPress={handleViewSessions} icon="calendar-text">
            Sessions
          </Button>
          <Button onPress={() => setDetailVisible(false)}>Close</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );

  // ============================
  // Render: Sessions Modal
  // ============================
  const SESSION_STATUS_CONFIG = {
    scheduled: { color: "#2196F3", bg: "#E3F2FD", label: "Scheduled" },
    completed: { color: "#4CAF50", bg: "#E8F5E9", label: "Completed" },
    cancelled: { color: "#F44336", bg: "#FFEBEE", label: "Cancelled" },
  };

  const renderSessionsModal = () => (
    <Modal
      visible={sessionsVisible}
      animationType="slide"
      onRequestClose={() => setSessionsVisible(false)}
    >
      <SafeAreaView style={styles.modalContainer}>
        {/* Header */}
        <View style={styles.modalHeader}>
          <IconButton
            icon="arrow-left"
            size={24}
            onPress={() => setSessionsVisible(false)}
          />
          <Text style={styles.modalTitle}>Sessions</Text>
          <View style={{ width: 48 }} />
        </View>

        {/* Session stats */}
        {!sessionsLoading && sessions.length > 0 && (
          <View style={styles.sessionStats}>
            <View style={styles.sessionStatItem}>
              <Text style={styles.sessionStatCount}>
                {sessions.filter((s) => s.status === "scheduled").length}
              </Text>
              <Text style={styles.sessionStatLabel}>Scheduled</Text>
            </View>
            <View style={styles.sessionStatItem}>
              <Text style={[styles.sessionStatCount, { color: "#4CAF50" }]}>
                {sessions.filter((s) => s.status === "completed").length}
              </Text>
              <Text style={styles.sessionStatLabel}>Completed</Text>
            </View>
            <View style={styles.sessionStatItem}>
              <Text style={[styles.sessionStatCount, { color: "#F44336" }]}>
                {sessions.filter((s) => s.status === "cancelled").length}
              </Text>
              <Text style={styles.sessionStatLabel}>Cancelled</Text>
            </View>
          </View>
        )}

        {/* Session list */}
        {sessionsLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={MANAGER_BLUE} />
          </View>
        ) : (
          <FlatList
            data={sessions}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyListContainer}>
                <MaterialCommunityIcons name="calendar-blank" size={48} color="#ccc" />
                <Text style={styles.emptyListTitle}>No Sessions</Text>
                <Text style={styles.emptyListSubtitle}>
                  Sessions will appear once they are generated.
                </Text>
              </View>
            }
            renderItem={({ item: session }) => {
              const statusCfg = SESSION_STATUS_CONFIG[session.status] || SESSION_STATUS_CONFIG.scheduled;
              const dayName = getDayOfWeek(session.date);
              const dayLabel = dayName.charAt(0).toUpperCase() + dayName.slice(1);
              const canCancel = session.status === "scheduled" && session.date >= getTodayString();

              return (
                <Surface style={styles.sessionCard} elevation={1}>
                  <View style={styles.sessionCardRow}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.sessionDateRow}>
                        <Text style={styles.sessionDate}>{formatDate(session.date)}</Text>
                        <Text style={styles.sessionDay}>{dayLabel}</Text>
                      </View>
                      <Text style={styles.sessionTime}>
                        {formatTime(session.startTime)} - {formatTime(session.endTime)}
                      </Text>
                    </View>
                    <View style={styles.sessionActions}>
                      <View style={[styles.sessionStatusBadge, { backgroundColor: statusCfg.bg }]}>
                        <Text style={[styles.sessionStatusText, { color: statusCfg.color }]}>
                          {statusCfg.label}
                        </Text>
                      </View>
                      {canCancel && (
                        <IconButton
                          icon="close-circle-outline"
                          iconColor="#F44336"
                          size={22}
                          onPress={() => handleCancelSession(session)}
                          style={{ margin: 0 }}
                        />
                      )}
                    </View>
                  </View>
                </Surface>
              );
            }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );

  // ============================
  // Render: Renewal Modal
  // ============================
  const renderRenewalModal = () => (
    <Modal
      visible={renewalVisible}
      animationType="slide"
      onRequestClose={() => {
        if (!renewalSubmitting) setRenewalVisible(false);
      }}
    >
      <SafeAreaView style={styles.modalContainer}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {/* Header */}
          <View style={styles.modalHeader}>
            <IconButton
              icon="close"
              size={24}
              onPress={() => {
                if (!renewalSubmitting) setRenewalVisible(false);
              }}
            />
            <Text style={styles.modalTitle}>Renew Academy</Text>
            <View style={{ width: 48 }} />
          </View>

          <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
            {/* Academy info */}
            <Surface style={styles.renewalInfoCard} elevation={1}>
              <Text style={styles.renewalAcademyName}>{selectedAcademy?.name}</Text>
              <Text style={styles.renewalInfoText}>
                {selectedAcademy?.sport} - {selectedAcademy?.groundName}
              </Text>
              <Text style={styles.renewalInfoText}>
                Previous: {formatDate(selectedAcademy?.contract?.startDate)} - {formatDate(selectedAcademy?.contract?.endDate)}
              </Text>
            </Surface>

            {/* Duration selection */}
            <Text style={styles.fieldLabel}>New Duration</Text>
            <View style={styles.chipGroup}>
              {DURATION_OPTIONS.map((opt) => (
                <Chip
                  key={opt.value}
                  selected={renewalDuration === opt.value}
                  onPress={() => setRenewalDuration(opt.value)}
                  mode="outlined"
                  style={styles.chip}
                  selectedColor={MANAGER_BLUE}
                >
                  {opt.label}
                </Chip>
              ))}
            </View>

            {/* New contract summary */}
            <Surface style={styles.contractSummary} elevation={1}>
              <Text style={styles.contractSummaryTitle}>New Contract Period</Text>

              <View style={styles.contractRow}>
                <MaterialCommunityIcons name="calendar-start" size={18} color="#666" />
                <Text style={styles.contractLabel}>Start:</Text>
                <Text style={styles.contractValue}>{formatDate(renewalStartDate)}</Text>
              </View>
              <View style={styles.contractRow}>
                <MaterialCommunityIcons name="calendar-end" size={18} color="#666" />
                <Text style={styles.contractLabel}>End:</Text>
                <Text style={styles.contractValue}>{formatDate(renewalEndDate)}</Text>
              </View>
              <View style={styles.contractRow}>
                <MaterialCommunityIcons name="calendar-multiple" size={18} color="#666" />
                <Text style={styles.contractLabel}>Duration:</Text>
                <Text style={styles.contractValue}>{renewalDuration} month(s)</Text>
              </View>
              <View style={styles.contractRow}>
                <MaterialCommunityIcons name="counter" size={18} color="#666" />
                <Text style={styles.contractLabel}>Sessions:</Text>
                <Text style={[styles.contractValue, { color: MANAGER_BLUE, fontWeight: "700" }]}>
                  {renewalSessionCount}
                </Text>
              </View>
              <View style={styles.contractRow}>
                <MaterialCommunityIcons name="calendar-week" size={18} color="#666" />
                <Text style={styles.contractLabel}>Days:</Text>
                <Text style={styles.contractValue}>
                  {(() => {
                    const sched = selectedAcademy?.schedule?.days;
                    const arr = Array.isArray(sched) ? sched : (sched ? Object.keys(sched) : []);
                    return arr.map((d) => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(", ");
                  })()}
                </Text>
              </View>
            </Surface>

            {/* Payment */}
            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Payment</Text>

            <TextInput
              label="Total Amount (\u20B9) *"
              value={renewalAmount}
              onChangeText={setRenewalAmount}
              mode="outlined"
              style={styles.input}
              keyboardType="numeric"
              outlineColor="#ddd"
              activeOutlineColor={MANAGER_BLUE}
            />

            <TextInput
              label="Cash Amount (\u20B9)"
              value={renewalCashAmount}
              onChangeText={setRenewalCashAmount}
              mode="outlined"
              style={styles.input}
              keyboardType="numeric"
              outlineColor="#ddd"
              activeOutlineColor={MANAGER_BLUE}
            />

            <Surface style={styles.paymentSummary} elevation={1}>
              <Text style={styles.paymentSummaryTitle}>Payment Breakdown</Text>
              <View style={styles.paymentRow}>
                <Text style={styles.paymentLabel}>Total Amount</Text>
                <Text style={styles.paymentValue}>{"\u20B9"}{parseFloat(renewalAmount) || 0}</Text>
              </View>
              <View style={styles.paymentRow}>
                <Text style={styles.paymentLabel}>Cash</Text>
                <Text style={styles.paymentValue}>{"\u20B9"}{parseFloat(renewalCashAmount) || 0}</Text>
              </View>
              <Divider style={{ marginVertical: 8 }} />
              <View style={styles.paymentRow}>
                <Text style={[styles.paymentLabel, { fontWeight: "700" }]}>Online</Text>
                <Text style={[styles.paymentValue, { color: MANAGER_BLUE, fontWeight: "700" }]}>
                  {"\u20B9"}{renewalOnlineAmount}
                </Text>
              </View>
              {renewalSessionCount > 0 && parseFloat(renewalAmount) > 0 && (
                <>
                  <Divider style={{ marginVertical: 8 }} />
                  <View style={styles.paymentRow}>
                    <Text style={styles.paymentLabel}>Per Session</Text>
                    <Text style={styles.paymentValue}>
                      {"\u20B9"}{(parseFloat(renewalAmount) / renewalSessionCount).toFixed(0)}
                    </Text>
                  </View>
                </>
              )}
            </Surface>
          </ScrollView>

          {/* Footer */}
          <View style={styles.modalFooter}>
            <Button
              mode="outlined"
              onPress={() => setRenewalVisible(false)}
              style={styles.footerButton}
              disabled={renewalSubmitting}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleRenewalSubmit}
              style={[styles.footerButton, styles.footerButtonPrimary]}
              buttonColor="#4CAF50"
              loading={renewalSubmitting}
              disabled={renewalSubmitting}
              icon="refresh"
            >
              Renew Academy
            </Button>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );

  // Detail row helper
  const DetailRow = ({ icon, label, value, valueColor }) => (
    <View style={styles.detailRow}>
      <MaterialCommunityIcons name={icon} size={18} color="#666" />
      <Text style={styles.detailLabel}>{label}:</Text>
      <Text style={[styles.detailValue, valueColor && { color: valueColor }]}>
        {value}
      </Text>
    </View>
  );

  // Render academy card
  const renderAcademyItem = useCallback(
    ({ item }) => (
      <AcademyCard
        academy={item}
        onPress={handleViewDetails}
        onStatusChange={handleStatusChange}
      />
    ),
    [handleViewDetails, handleStatusChange]
  );

  const keyExtractor = useCallback((item) => item.id, []);

  // ============================
  // Render: Empty / No Turf States
  // ============================
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

  // ============================
  // Main Render
  // ============================
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton
          icon="arrow-left"
          size={24}
          onPress={() => navigation.goBack()}
        />
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Academies</Text>
          <Text style={styles.headerSubtitle}>{turfData?.name || ""}</Text>
        </View>
        <View style={{ width: 48 }} />
      </View>

      {/* Status Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterBar}
        contentContainerStyle={styles.filterBarContent}
      >
        <Chip
          selected={statusFilter === "all"}
          onPress={() => setStatusFilter("all")}
          mode="outlined"
          style={styles.filterChip}
          compact
        >
          All ({academies.length})
        </Chip>
        {Object.entries(STATUS_CONFIG).map(([key, config]) => {
          const count = academies.filter((a) => a.status === key).length;
          return (
            <Chip
              key={key}
              selected={statusFilter === key}
              onPress={() => setStatusFilter(key)}
              mode="outlined"
              style={styles.filterChip}
              compact
            >
              {config.label} ({count})
            </Chip>
          );
        })}
      </ScrollView>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={MANAGER_BLUE} />
        </View>
      ) : (
        <FlatList
          data={filteredAcademies}
          renderItem={renderAcademyItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={[
            styles.listContent,
            filteredAcademies.length === 0 && styles.emptyList,
          ]}
          ListEmptyComponent={
            <View style={styles.emptyListContainer}>
              <MaterialCommunityIcons name="school-outline" size={64} color="#ccc" />
              <Text style={styles.emptyListTitle}>No Academies</Text>
              <Text style={styles.emptyListSubtitle}>
                Tap the + button to create your first academy with recurring sessions.
              </Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[MANAGER_BLUE]}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB */}
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={openCreateModal}
        label="Add Academy"
      />

      {/* Modals */}
      {renderCreateModal()}
      {renderDetailDialog()}
      {renderSessionsModal()}
      {renderRenewalModal()}
    </SafeAreaView>
  );
}

// ============================================================
// Styles
// ============================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 4,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#212121",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },

  // Filter bar
  filterBar: {
    maxHeight: 48,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  filterBarContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  filterChip: {
    marginRight: 4,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  // List
  listContent: {
    padding: 12,
    paddingBottom: 80,
  },
  emptyList: {
    flex: 1,
  },

  // Academy Card
  academyCard: {
    borderRadius: 12,
    backgroundColor: "#fff",
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardHeaderLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#212121",
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  sessionsPendingBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: "#FFF3E0",
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  sessionsPendingText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#E65100",
  },
  cardBody: {
    marginTop: 8,
    gap: 6,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardRowText: {
    fontSize: 13,
    color: "#444",
    flex: 1,
  },
  expiryBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#FFF3E0",
    borderRadius: 8,
  },
  expiryBannerText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#E65100",
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  cardFooterText: {
    fontSize: 12,
    color: "#999",
  },

  // Empty states
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
  emptyListContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyListTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#999",
    marginTop: 16,
  },
  emptyListSubtitle: {
    fontSize: 14,
    color: "#bbb",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },

  // FAB
  fab: {
    position: "absolute",
    right: 16,
    bottom: 16,
    backgroundColor: MANAGER_BLUE,
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#212121",
  },
  modalFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    padding: 16,
    gap: 12,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  footerButton: {
    minWidth: 100,
  },
  footerButtonPrimary: {
    flex: 1,
  },

  // Step Indicator
  stepIndicatorContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
    backgroundColor: "#fff",
  },
  stepItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#ddd",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  stepCircleActive: {
    borderColor: MANAGER_BLUE,
    backgroundColor: MANAGER_BLUE,
  },
  stepCircleComplete: {
    borderColor: "#4CAF50",
    backgroundColor: "#4CAF50",
  },
  stepNumber: {
    fontSize: 12,
    fontWeight: "600",
    color: "#999",
  },
  stepNumberActive: {
    color: "#fff",
  },
  stepLabel: {
    fontSize: 11,
    color: "#999",
    marginLeft: 4,
    fontWeight: "500",
  },
  stepLabelActive: {
    color: MANAGER_BLUE,
    fontWeight: "700",
  },
  stepLabelComplete: {
    color: "#4CAF50",
  },
  stepLine: {
    width: 20,
    height: 2,
    backgroundColor: "#ddd",
    marginHorizontal: 4,
  },
  stepLineComplete: {
    backgroundColor: "#4CAF50",
  },

  // Step Content
  stepContent: {
    flex: 1,
    padding: 16,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#212121",
    marginBottom: 16,
  },
  input: {
    marginBottom: 12,
    backgroundColor: "#fff",
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#444",
    marginBottom: 8,
    marginTop: 4,
  },
  chipGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    marginBottom: 4,
  },
  dayChip: {
    minWidth: 52,
  },
  hintText: {
    fontSize: 12,
    color: "#999",
    marginBottom: 8,
  },
  divider: {
    marginVertical: 16,
  },

  // Day circles (per-day schedule)
  dayCircleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  dayCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  dayCircleSelected: {
    backgroundColor: MANAGER_BLUE + "20",
    borderColor: MANAGER_BLUE,
  },
  dayCircleActive: {
    backgroundColor: MANAGER_BLUE,
    borderColor: MANAGER_BLUE,
  },
  dayCircleText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
  },
  dayCircleTextActive: {
    color: "#fff",
  },

  // Time slot grid (30-min intervals)
  timeSlotsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  timeSlotChip: {
    width: "24%",
    margin: "0.5%",
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
    alignItems: "center",
  },
  timeSlotStart: {
    backgroundColor: MANAGER_BLUE,
  },
  timeSlotEnd: {
    backgroundColor: MANAGER_BLUE + "80",
  },
  timeSlotInRange: {
    backgroundColor: MANAGER_BLUE + "30",
  },
  timeSlotChipText: {
    fontSize: 11,
    fontWeight: "500",
    color: "#666",
  },
  timeSlotChipTextActive: {
    color: "#fff",
  },

  // Schedule summary
  scheduleSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: "#f9f9f9",
    borderRadius: 6,
  },
  scheduleSummaryDay: {
    fontSize: 13,
    fontWeight: "600",
    color: "#444",
    width: 90,
  },
  scheduleSummaryTime: {
    fontSize: 13,
    color: MANAGER_BLUE,
    fontWeight: "500",
  },

  // Summary box
  summaryBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#E3F2FD",
    marginBottom: 12,
  },
  summaryText: {
    fontSize: 14,
    color: "#333",
    fontWeight: "500",
  },

  // Date navigation
  dateNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  dateDisplay: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  dateDisplayText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },

  // Contract summary
  contractSummary: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#fff",
  },
  contractSummaryTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#212121",
    marginBottom: 12,
  },
  contractRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  contractLabel: {
    fontSize: 13,
    color: "#666",
    width: 70,
  },
  contractValue: {
    fontSize: 14,
    color: "#333",
    fontWeight: "500",
    flex: 1,
  },

  // Payment summary
  paymentSummary: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#fff",
    marginBottom: 16,
  },
  paymentSummaryTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#212121",
    marginBottom: 12,
  },
  paymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  paymentLabel: {
    fontSize: 14,
    color: "#666",
  },
  paymentValue: {
    fontSize: 14,
    color: "#333",
    fontWeight: "500",
  },

  // Final summary
  finalSummary: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#E3F2FD",
  },
  finalSummaryTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: MANAGER_BLUE,
    marginBottom: 8,
  },
  finalSummaryRow: {
    fontSize: 13,
    color: "#444",
    marginBottom: 4,
    lineHeight: 20,
  },

  // Session stats
  sessionStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  sessionStatItem: {
    alignItems: "center",
  },
  sessionStatCount: {
    fontSize: 20,
    fontWeight: "700",
    color: MANAGER_BLUE,
  },
  sessionStatLabel: {
    fontSize: 11,
    color: "#999",
    marginTop: 2,
  },

  // Session card
  sessionCard: {
    borderRadius: 10,
    backgroundColor: "#fff",
    padding: 12,
    marginBottom: 8,
  },
  sessionCardRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  sessionDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sessionDate: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  sessionDay: {
    fontSize: 12,
    color: "#888",
  },
  sessionTime: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  sessionActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  sessionStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  sessionStatusText: {
    fontSize: 11,
    fontWeight: "600",
  },

  // Sessions warning banner in detail dialog
  sessionsWarningBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFF3E0",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  sessionsWarningTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#E65100",
    marginBottom: 2,
  },
  sessionsWarningText: {
    fontSize: 12,
    color: "#BF360C",
    lineHeight: 17,
  },

  // Detail dialog
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

  // Renewal modal
  renewalInfoCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#F5F5F5",
    marginBottom: 16,
  },
  renewalAcademyName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#212121",
    marginBottom: 4,
  },
  renewalInfoText: {
    fontSize: 13,
    color: "#666",
    marginTop: 2,
  },
});
