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
  IconButton,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSelector } from "react-redux";
import { selectUser, selectAssignedTurfId } from "../../store/slices/authSlice";
import {
  getDocument,
  queryDocuments,
  setDocument,
  createBookingWithTransaction,
} from "../../services/firebase/firestore";

const CARETAKER_ORANGE = "#F97316";
const PALE_ORANGE = "#FFF7ED";
const NAVY_ORANGE = "#7C2D12";
const SUCCESS_GREEN = "#22C55E";
const DANGER_RED = "#EF4444";

// Generate time slots (6 AM to 11 PM, 30-min intervals)
const formatTimeLabel = (hour, minute) => {
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${minute.toString().padStart(2, "0")} ${ampm}`;
};

const TIME_SLOTS = (() => {
  const slots = [];
  for (let hour = 6; hour <= 23; hour++) {
    slots.push({ time: `${hour.toString().padStart(2, "0")}:00`, label: formatTimeLabel(hour, 0) });
    if (hour < 23) {
      slots.push({ time: `${hour.toString().padStart(2, "0")}:30`, label: formatTimeLabel(hour, 30) });
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

const getDateString = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const formatDate = (date) =>
  date.toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric" });

const hasTimeOverlap = (s1, e1, s2, e2) => s1 < e2 && e1 > s2;

const normalizeGroundId = (id) => (id ? id.toLowerCase().replace(/[-_]/g, "") : "");

export default function CaretakerCreateBookingScreen({ navigation }) {
  const user = useSelector(selectUser);
  const assignedTurfId = useSelector(selectAssignedTurfId);

  const [turfData, setTurfData] = useState(null);
  const [loadingTurf, setLoadingTurf] = useState(true);

  const [currentStep, setCurrentStep] = useState(0);

  // Customer
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [existingCustomer, setExistingCustomer] = useState(null);
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [searchingCustomer, setSearchingCustomer] = useState(false);

  // Time
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);

  // Ground
  const [grounds, setGrounds] = useState([]);
  const [selectedGround, setSelectedGround] = useState(null);
  const [selectedSport, setSelectedSport] = useState(null);
  const [sports, setSports] = useState([]);
  const [existingBookings, setExistingBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [blockedSlots, setBlockedSlots] = useState([]);

  // Manual price (caretaker enters this)
  const [manualPrice, setManualPrice] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const searchTimerRef = useRef(null);

  // Load turf data
  useEffect(() => {
    if (!assignedTurfId) { setLoadingTurf(false); return; }
    const load = async () => {
      try {
        const turf = await getDocument("turfs", assignedTurfId);
        setTurfData(turf);
        if (turf) {
          const gs = (turf.grounds || []).map((g, i) => ({ ...g, id: g.id || `ground_${i}` }));
          setGrounds(gs);
          const sp = new Set();
          gs.forEach((g) => (g.sports || []).forEach((s) => sp.add(s)));
          setSports([...sp]);
        }
      } catch (e) {
        console.error("Error loading turf:", e);
      } finally {
        setLoadingTurf(false);
      }
    };
    load();
  }, [assignedTurfId]);

  // Load existing bookings when date changes
  useEffect(() => {
    if (!assignedTurfId || !selectedDate) return;
    const load = async () => {
      setLoadingBookings(true);
      try {
        const dateStr = getDateString(selectedDate);
        const bks = await queryDocuments("bookings", [
          { field: "turfId", operator: "==", value: assignedTurfId },
          { field: "date", operator: "==", value: dateStr },
        ]);
        setExistingBookings(bks.filter((b) => ["pending", "confirmed", "in_progress"].includes(b.status)));
      } catch (e) {
        console.error("Error loading bookings:", e);
      } finally {
        setLoadingBookings(false);
      }
    };
    load();
  }, [assignedTurfId, selectedDate]);

  // Load blocked slots
  useEffect(() => {
    if (!assignedTurfId) return;
    queryDocuments("blocked_slots", [{ field: "turfId", operator: "==", value: assignedTurfId }])
      .then(setBlockedSlots)
      .catch(() => setBlockedSlots([]));
  }, [assignedTurfId]);

  // Customer search
  const searchCustomer = useCallback(async (phone) => {
    if (!phone || phone.length < 10) { setExistingCustomer(null); setIsNewCustomer(false); return; }
    setSearchingCustomer(true);
    try {
      let users = await queryDocuments("users", [{ field: "phone", operator: "==", value: phone }]);
      if (!users.length) {
        users = await queryDocuments("users", [{ field: "phone", operator: "==", value: `+91${phone}` }]);
      }
      if (users.length) {
        const found = users[0];
        setExistingCustomer(found);
        setCustomerName(found.name || found.displayName || "");
        setIsNewCustomer(false);
      } else {
        setExistingCustomer(null);
        setIsNewCustomer(true);
      }
    } catch (e) {
      console.error("Error searching customer:", e);
    } finally {
      setSearchingCustomer(false);
    }
  }, []);

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (customerPhone.length >= 10) {
      searchTimerRef.current = setTimeout(() => searchCustomer(customerPhone), 500);
    } else {
      setExistingCustomer(null);
      setIsNewCustomer(false);
    }
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [customerPhone, searchCustomer]);

  // Ground availability
  const isGroundBlocked = useCallback((groundId) => {
    if (!startTime || !endTime || !selectedDate) return false;
    const dateStr = getDateString(selectedDate);
    const dow = selectedDate.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
    const ng = normalizeGroundId(groundId);
    return blockedSlots.some((block) => {
      if (block.groundId !== "all" && normalizeGroundId(block.groundId) !== ng) return false;
      if (block.blockType === "recurring") {
        if (dateStr < block.startDate || dateStr > (block.recurringEndDate || block.endDate)) return false;
        if (!block.recurringDays?.includes(dow)) return false;
      } else if (block.blockType === "range") {
        if (dateStr < block.startDate || dateStr > block.endDate) return false;
      } else {
        if (dateStr !== block.startDate) return false;
      }
      const bs = block.allDay ? "06:00" : block.startTime;
      const be = block.allDay ? "23:00" : block.endTime;
      return hasTimeOverlap(startTime, endTime, bs, be);
    });
  }, [blockedSlots, startTime, endTime, selectedDate]);

  const isGroundAvailable = useCallback((groundId) => {
    if (!startTime || !endTime) return true;
    if (isGroundBlocked(groundId)) return false;
    const ng = normalizeGroundId(groundId);
    return !existingBookings.some((b) => normalizeGroundId(b.groundId) === ng && hasTimeOverlap(startTime, endTime, b.startTime, b.endTime));
  }, [existingBookings, startTime, endTime, isGroundBlocked]);

  // Time slot press
  const handleTimeSlotPress = useCallback((slot) => {
    if (!startTime || (startTime && endTime)) {
      setStartTime(slot.time);
      setEndTime(null);
      setSelectedGround(null);
    } else {
      if (slot.time > startTime) {
        setEndTime(slot.time);
      } else {
        setEndTime(startTime);
        setStartTime(slot.time);
      }
      setSelectedGround(null);
    }
  }, [startTime, endTime]);

  const getSlotStyle = useCallback((slot) => {
    const inRange = startTime && endTime && slot.time >= startTime && slot.time < endTime;
    if (slot.time === startTime || slot.time === endTime) return styles.slotSelected;
    if (inRange) return styles.slotInRange;
    return styles.slotAvailable;
  }, [startTime, endTime]);

  // Compute booking duration in hours (for extension rate)
  const bookingDurationHours = useMemo(() => {
    if (!startTime || !endTime) return 1;
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    return Math.max(((eh * 60 + em) - (sh * 60 + sm)) / 60, 0.5);
  }, [startTime, endTime]);

  const filteredGrounds = useMemo(
    () => selectedSport ? grounds.filter((g) => g.sports?.includes(selectedSport)) : grounds,
    [grounds, selectedSport]
  );

  const canProceed = useMemo(() => {
    switch (currentStep) {
      case 0: return customerPhone.length >= 10 && customerName.trim().length > 0;
      case 1: return Boolean(startTime && endTime);
      case 2: return Boolean(selectedGround);
      case 3: return Boolean(manualPrice && parseFloat(manualPrice) > 0);
      default: return true;
    }
  }, [currentStep, customerPhone, customerName, startTime, endTime, selectedGround, manualPrice]);

  const createNewCustomer = async () => {
    const customerId = `offline_${Date.now()}`;
    const data = {
      phone: customerPhone.startsWith("+91") ? customerPhone : `+91${customerPhone}`,
      name: customerName || "Walk-in Customer",
      role: "user",
      createdAt: new Date().toISOString(),
      createdBy: user?.userId,
      isOfflineCustomer: true,
    };
    await setDocument("users", customerId, data);
    return { id: customerId, ...data };
  };

  const handleSubmit = async () => {
    if (!isGroundAvailable(selectedGround.id)) {
      Alert.alert("Slot Unavailable", "This time slot is no longer available.");
      return;
    }
    setSubmitting(true);
    try {
      let customer = existingCustomer;
      if (!customer && isNewCustomer) customer = await createNewCustomer();

      const price = parseFloat(manualPrice) || 0;

      const bookingData = {
        turfId: assignedTurfId,
        turfName: turfData?.name || "",
        groundId: selectedGround.id,
        groundName: selectedGround.name,
        date: getDateString(selectedDate),
        startTime,
        endTime,
        sport: selectedSport || "general",
        duration: bookingDurationHours,
        totalDuration: bookingDurationHours,
        totalPrice: price,
        totalAmount: price,
        baseAmount: price,
        userId: customer?.id || customer?.userId || null,
        userName: customerName,
        userPhone: customerPhone.startsWith("+91") ? customerPhone : `+91${customerPhone}`,
        bookingType: "offline",
        status: "confirmed",
        paymentStatus: "pending",
        paymentMethod: "cash",
        advanceAmount: 0,
        balanceAmount: price,
        payment: {
          slotAmount: price,
          remainingAmount: price,
          remainingPaid: false,
          isFullyPaid: false,
        },
        createdBy: user?.userId,
        createdByName: user?.name || "Caretaker",
        createdByRole: "caretaker",
        isManualBooking: true,
        manualPricing: true,
        confirmedAt: new Date().toISOString(),
        confirmedBy: user?.userId,
      };

      const result = await createBookingWithTransaction(bookingData);
      if (!result.success) {
        Alert.alert("Booking Failed", result.message || "Slot no longer available.");
        return;
      }

      Alert.alert(
        "Booking Created",
        `Booking #${result.bookingId.slice(-6).toUpperCase()} confirmed.`,
        [
          { text: "New Booking", onPress: () => resetForm() },
          { text: "Done", onPress: () => navigation.goBack() },
        ]
      );
    } catch (e) {
      console.error("Error creating booking:", e);
      Alert.alert("Error", "Failed to create booking. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setCurrentStep(0);
    setCustomerPhone("");
    setCustomerName("");
    setExistingCustomer(null);
    setIsNewCustomer(false);
    setSelectedDate(new Date());
    setStartTime(null);
    setEndTime(null);
    setSelectedGround(null);
    setSelectedSport(null);
    setManualPrice("");
  };

  if (loadingTurf) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={CARETAKER_ORANGE} />
        </View>
      </SafeAreaView>
    );
  }

  if (!assignedTurfId || !turfData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <MaterialCommunityIcons name="soccer-field" size={64} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>No Turf Assigned</Text>
        </View>
      </SafeAreaView>
    );
  }

  const STEPS = ["Customer", "Time", "Ground", "Payment"];

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <IconButton icon="arrow-left" size={24} onPress={() => navigation.goBack()} iconColor={NAVY_ORANGE} />
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Quick Booking</Text>
            <Text style={styles.headerSubtitle}>{turfData.name}</Text>
          </View>
          <IconButton icon="refresh" size={22} onPress={resetForm} iconColor="#9CA3AF" />
        </View>

        {/* Step indicator */}
        <View style={styles.stepIndicator}>
          {STEPS.map((label, index) => (
            <TouchableOpacity
              key={label}
              style={styles.stepItem}
              onPress={() => index < currentStep && setCurrentStep(index)}
            >
              <View style={[styles.stepCircle, index <= currentStep && styles.stepCircleActive, index < currentStep && styles.stepCircleComplete]}>
                {index < currentStep ? (
                  <MaterialCommunityIcons name="check" size={12} color="#fff" />
                ) : (
                  <Text style={[styles.stepNumber, index <= currentStep && styles.stepNumberActive]}>{index + 1}</Text>
                )}
              </View>
              <Text style={[styles.stepLabel, index <= currentStep && styles.stepLabelActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Step 0: Customer ── */}
          {currentStep === 0 && (
            <View style={styles.stepContent}>
              <Text style={styles.sectionTitle}>Customer Information</Text>

              <TextInput
                label="Phone Number *"
                value={customerPhone}
                onChangeText={(t) => setCustomerPhone(t.replace(/[^0-9]/g, ""))}
                keyboardType="phone-pad"
                maxLength={10}
                style={styles.input}
                mode="outlined"
                outlineColor="#E5E7EB"
                activeOutlineColor={CARETAKER_ORANGE}
                left={<TextInput.Affix text="+91 " />}
                right={
                  searchingCustomer
                    ? <TextInput.Icon icon={() => <ActivityIndicator size={18} color={CARETAKER_ORANGE} />} />
                    : existingCustomer
                    ? <TextInput.Icon icon="check-circle" iconColor={SUCCESS_GREEN} />
                    : isNewCustomer
                    ? <TextInput.Icon icon="account-plus" iconColor={CARETAKER_ORANGE} />
                    : null
                }
              />

              {existingCustomer && (
                <Surface style={styles.customerFound} elevation={1}>
                  <MaterialCommunityIcons name="account-check" size={22} color={SUCCESS_GREEN} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.customerFoundTitle}>Existing Customer Found</Text>
                    <Text style={styles.customerFoundSub}>{existingCustomer.name || existingCustomer.displayName}</Text>
                  </View>
                </Surface>
              )}
              {isNewCustomer && (
                <Surface style={styles.newCustomer} elevation={1}>
                  <MaterialCommunityIcons name="account-plus" size={22} color={CARETAKER_ORANGE} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.newCustomerTitle}>New Customer</Text>
                    <Text style={styles.customerFoundSub}>A new record will be created</Text>
                  </View>
                </Surface>
              )}

              <TextInput
                label="Customer Name *"
                value={customerName}
                onChangeText={setCustomerName}
                style={styles.input}
                mode="outlined"
                outlineColor="#E5E7EB"
                activeOutlineColor={CARETAKER_ORANGE}
                editable={!existingCustomer}
              />
            </View>
          )}

          {/* ── Step 1: Date & Time ── */}
          {currentStep === 1 && (
            <View style={styles.stepContent}>
              <Text style={styles.sectionTitle}>Select Date</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateScroll}>
                {AVAILABLE_DATES.slice(0, 14).map((date, i) => {
                  const isSelected = getDateString(date) === getDateString(selectedDate);
                  const isToday = getDateString(date) === getDateString(new Date());
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[styles.dateChip, isSelected && styles.dateChipSelected]}
                      onPress={() => { setSelectedDate(date); setStartTime(null); setEndTime(null); }}
                    >
                      <Text style={[styles.dateChipDay, isSelected && styles.dateChipTextSelected]}>
                        {date.toLocaleDateString("en-IN", { weekday: "short" })}
                      </Text>
                      <Text style={[styles.dateChipNum, isSelected && styles.dateChipTextSelected]}>
                        {date.getDate()}
                      </Text>
                      {isToday && <View style={[styles.todayDot, isSelected && { backgroundColor: "#fff" }]} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Select Time Slot</Text>
              {startTime && !endTime && (
                <Surface style={styles.timeHint} elevation={0}>
                  <MaterialCommunityIcons name="information-outline" size={16} color={CARETAKER_ORANGE} />
                  <Text style={styles.timeHintText}>
                    Start: {TIME_SLOTS.find((s) => s.time === startTime)?.label} — now tap end time
                  </Text>
                </Surface>
              )}
              {startTime && endTime && (
                <Surface style={styles.timeSelected} elevation={1}>
                  <MaterialCommunityIcons name="clock-check-outline" size={18} color={SUCCESS_GREEN} />
                  <Text style={styles.timeSelectedText}>
                    {TIME_SLOTS.find((s) => s.time === startTime)?.label} → {TIME_SLOTS.find((s) => s.time === endTime)?.label}
                  </Text>
                  <TouchableOpacity onPress={() => { setStartTime(null); setEndTime(null); }}>
                    <MaterialCommunityIcons name="close-circle" size={18} color="#9CA3AF" />
                  </TouchableOpacity>
                </Surface>
              )}
              <View style={styles.timeGrid}>
                {TIME_SLOTS.map((slot) => {
                  const slotStyle = getSlotStyle(slot);
                  return (
                    <TouchableOpacity
                      key={slot.time}
                      style={[styles.timeSlot, slotStyle]}
                      onPress={() => handleTimeSlotPress(slot)}
                    >
                      <Text style={[styles.timeSlotText, slotStyle === styles.slotSelected && styles.timeSlotTextSelected, slotStyle === styles.slotInRange && styles.timeSlotTextInRange]}>
                        {slot.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* ── Step 2: Ground ── */}
          {currentStep === 2 && (
            <View style={styles.stepContent}>
              <Text style={styles.sectionTitle}>Select Ground</Text>
              <Text style={styles.timeRangeLabel}>
                {formatDate(selectedDate)} · {TIME_SLOTS.find((s) => s.time === startTime)?.label} – {TIME_SLOTS.find((s) => s.time === endTime)?.label}
              </Text>

              {sports.length > 1 && (
                <View style={styles.sportFilter}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <Chip
                      selected={!selectedSport}
                      onPress={() => setSelectedSport(null)}
                      style={styles.sportChip}
                      selectedColor={CARETAKER_ORANGE}
                    >
                      All
                    </Chip>
                    {sports.map((s) => (
                      <Chip
                        key={s}
                        selected={selectedSport === s}
                        onPress={() => setSelectedSport(s)}
                        style={styles.sportChip}
                        selectedColor={CARETAKER_ORANGE}
                      >
                        {s}
                      </Chip>
                    ))}
                  </ScrollView>
                </View>
              )}

              {loadingBookings ? (
                <ActivityIndicator size="small" color={CARETAKER_ORANGE} style={{ marginTop: 16 }} />
              ) : (
                filteredGrounds.map((ground) => {
                  const available = isGroundAvailable(ground.id);
                  const isSelected = selectedGround?.id === ground.id;
                  return (
                    <TouchableOpacity
                      key={ground.id}
                      disabled={!available}
                      onPress={() => { setSelectedGround(ground); }}
                    >
                      <Surface
                        style={[styles.groundCard, isSelected && styles.groundCardSelected, !available && styles.groundCardUnavailable]}
                        elevation={isSelected ? 3 : 1}
                      >
                        <View style={styles.groundCardContent}>
                          <View style={[styles.groundIconCircle, { backgroundColor: isSelected ? CARETAKER_ORANGE : PALE_ORANGE }]}>
                            <MaterialCommunityIcons name="soccer-field" size={22} color={isSelected ? "#fff" : CARETAKER_ORANGE} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.groundName, isSelected && { color: CARETAKER_ORANGE }]}>{ground.name}</Text>
                            <Text style={styles.groundSports}>{(ground.sports || []).join(", ") || "General"}</Text>
                          </View>
                          {!available && (
                            <View style={styles.unavailablePill}>
                              <Text style={styles.unavailableText}>Booked</Text>
                            </View>
                          )}
                          {isSelected && <MaterialCommunityIcons name="check-circle" size={22} color={CARETAKER_ORANGE} />}
                        </View>
                      </Surface>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          )}

          {/* ── Step 3: Payment ── */}
          {currentStep === 3 && (
            <View style={styles.stepContent}>
              {/* Mini summary */}
              <Surface style={styles.miniSummary} elevation={1}>
                <View style={styles.summaryRow}>
                  <MaterialCommunityIcons name="account" size={16} color="#9CA3AF" />
                  <Text style={styles.summaryLabel}>Customer</Text>
                  <Text style={styles.summaryValue}>{customerName}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <MaterialCommunityIcons name="clock-outline" size={16} color="#9CA3AF" />
                  <Text style={styles.summaryLabel}>Time</Text>
                  <Text style={styles.summaryValue}>
                    {TIME_SLOTS.find((s) => s.time === startTime)?.label} – {TIME_SLOTS.find((s) => s.time === endTime)?.label}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <MaterialCommunityIcons name="soccer-field" size={16} color="#9CA3AF" />
                  <Text style={styles.summaryLabel}>Ground</Text>
                  <Text style={styles.summaryValue}>{selectedGround?.name}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <MaterialCommunityIcons name="calendar" size={16} color="#9CA3AF" />
                  <Text style={styles.summaryLabel}>Date</Text>
                  <Text style={styles.summaryValue}>{formatDate(selectedDate)}</Text>
                </View>
              </Surface>

              {/* Manual price entry */}
              <Text style={styles.sectionTitle}>Enter Booking Amount</Text>
              <Surface style={styles.priceCard} elevation={2}>
                <View style={styles.priceInputRow}>
                  <Text style={styles.rupeeSym}>₹</Text>
                  <TextInput
                    value={manualPrice}
                    onChangeText={(v) => setManualPrice(v.replace(/[^0-9]/g, ""))}
                    keyboardType="numeric"
                    placeholder="0"
                    style={styles.priceInput}
                    mode="flat"
                    underlineColor="transparent"
                    activeUnderlineColor="transparent"
                    textColor={CARETAKER_ORANGE}
                  />
                </View>
                <Divider style={{ marginTop: 4 }} />
                <View style={styles.payAtTurfPill}>
                  <MaterialCommunityIcons name="cash-clock" size={14} color={CARETAKER_ORANGE} />
                  <Text style={styles.payAtTurfText}>
                    Full amount collected at turf · Extensions use same hourly rate
                  </Text>
                </View>
              </Surface>
            </View>
          )}
        </ScrollView>

        {/* Navigation buttons */}
        <View style={styles.navBar}>
          {currentStep > 0 && (
            <Button
              mode="outlined"
              onPress={() => setCurrentStep((s) => s - 1)}
              style={styles.navBtn}
              textColor={CARETAKER_ORANGE}
              disabled={submitting}
            >
              Back
            </Button>
          )}
          {currentStep < STEPS.length - 1 ? (
            <Button
              mode="contained"
              onPress={() => setCurrentStep((s) => s + 1)}
              style={[styles.navBtn, { flex: 1 }]}
              buttonColor={CARETAKER_ORANGE}
              disabled={!canProceed}
            >
              Next
            </Button>
          ) : (
            <Button
              mode="contained"
              onPress={handleSubmit}
              loading={submitting}
              disabled={submitting}
              style={[styles.navBtn, { flex: 1 }]}
              buttonColor={CARETAKER_ORANGE}
              icon="calendar-check"
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
  container: { flex: 1, backgroundColor: "#FFFBEB" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  emptyTitle: { fontFamily: "Ubuntu-Medium", fontSize: 15, color: "#9CA3AF" },

  // Header
  header: { flexDirection: "row", alignItems: "center", paddingRight: 8, paddingTop: 4 },
  headerCenter: { flex: 1 },
  headerTitle: { fontFamily: "Ubuntu-Bold", fontSize: 17, color: NAVY_ORANGE },
  headerSubtitle: { fontFamily: "Ubuntu-Regular", fontSize: 12, color: "#6B7280" },

  // Step indicator
  stepIndicator: { flexDirection: "row", justifyContent: "space-around", paddingHorizontal: 16, paddingBottom: 12 },
  stepItem: { alignItems: "center", gap: 4 },
  stepCircle: { width: 26, height: 26, borderRadius: 13, backgroundColor: "#E5E7EB", justifyContent: "center", alignItems: "center" },
  stepCircleActive: { backgroundColor: CARETAKER_ORANGE },
  stepCircleComplete: { backgroundColor: SUCCESS_GREEN },
  stepNumber: { fontFamily: "Ubuntu-Bold", fontSize: 12, color: "#9CA3AF" },
  stepNumberActive: { color: "#fff" },
  stepLabel: { fontFamily: "Ubuntu-Regular", fontSize: 10, color: "#9CA3AF" },
  stepLabelActive: { color: CARETAKER_ORANGE, fontFamily: "Ubuntu-Medium" },

  // Content
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 8 },
  stepContent: { gap: 12 },
  sectionTitle: { fontFamily: "Ubuntu-Bold", fontSize: 14, color: NAVY_ORANGE },

  // Input
  input: { backgroundColor: "#fff", marginBottom: 4 },

  // Customer cards
  customerFound: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 10, backgroundColor: "#F0FDF4" },
  customerFoundTitle: { fontFamily: "Ubuntu-Medium", fontSize: 13, color: "#166534" },
  customerFoundSub: { fontFamily: "Ubuntu-Regular", fontSize: 12, color: "#6B7280" },
  newCustomer: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 10, backgroundColor: PALE_ORANGE },
  newCustomerTitle: { fontFamily: "Ubuntu-Medium", fontSize: 13, color: NAVY_ORANGE },

  // Date
  dateScroll: { marginBottom: 4 },
  dateChip: { alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, marginRight: 8, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E7EB", minWidth: 52 },
  dateChipSelected: { backgroundColor: CARETAKER_ORANGE, borderColor: CARETAKER_ORANGE },
  dateChipDay: { fontFamily: "Ubuntu-Regular", fontSize: 10, color: "#6B7280" },
  dateChipNum: { fontFamily: "Ubuntu-Bold", fontSize: 16, color: "#111827" },
  dateChipTextSelected: { color: "#fff" },
  todayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: CARETAKER_ORANGE, marginTop: 2 },

  // Time
  timeHint: { flexDirection: "row", alignItems: "center", gap: 6, padding: 10, backgroundColor: PALE_ORANGE, borderRadius: 8 },
  timeHintText: { fontFamily: "Ubuntu-Regular", fontSize: 12, color: NAVY_ORANGE, flex: 1 },
  timeSelected: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, backgroundColor: "#F0FDF4", borderRadius: 8 },
  timeSelectedText: { fontFamily: "Ubuntu-Medium", fontSize: 13, color: "#166534", flex: 1 },
  timeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  timeSlot: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, minWidth: 80, alignItems: "center" },
  timeSlotText: { fontFamily: "Ubuntu-Regular", fontSize: 12, color: "#374151" },
  timeSlotTextSelected: { color: "#fff", fontFamily: "Ubuntu-Medium" },
  timeSlotTextInRange: { color: CARETAKER_ORANGE },
  slotAvailable: { backgroundColor: "#fff", borderColor: "#E5E7EB" },
  slotSelected: { backgroundColor: CARETAKER_ORANGE, borderColor: CARETAKER_ORANGE },
  slotInRange: { backgroundColor: PALE_ORANGE, borderColor: CARETAKER_ORANGE },
  slotPast: { backgroundColor: "#F3F4F6", borderColor: "#E5E7EB", opacity: 0.5 },
  timeRangeLabel: { fontFamily: "Ubuntu-Regular", fontSize: 12, color: "#6B7280", marginBottom: 8 },

  // Sport filter
  sportFilter: { marginBottom: 8 },
  sportChip: { marginRight: 6 },

  // Ground cards
  groundCard: { borderRadius: 12, backgroundColor: "#fff", marginBottom: 10 },
  groundCardSelected: { borderWidth: 1.5, borderColor: CARETAKER_ORANGE },
  groundCardUnavailable: { opacity: 0.5 },
  groundCardContent: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  groundIconCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center" },
  groundName: { fontFamily: "Ubuntu-Medium", fontSize: 14, color: "#111827" },
  groundSports: { fontFamily: "Ubuntu-Regular", fontSize: 12, color: "#6B7280" },
  unavailablePill: { backgroundColor: "#FEE2E2", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  unavailableText: { fontFamily: "Ubuntu-Medium", fontSize: 11, color: DANGER_RED },

  // Summary
  miniSummary: { borderRadius: 12, backgroundColor: "#fff", padding: 14, gap: 8, marginBottom: 4 },
  summaryCard: { borderRadius: 14, backgroundColor: "#fff", padding: 16, gap: 10 },
  summaryRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  summaryLabel: { fontFamily: "Ubuntu-Regular", fontSize: 13, color: "#6B7280", width: 70 },
  summaryValue: { fontFamily: "Ubuntu-Medium", fontSize: 14, color: "#111827", flex: 1 },
  // Price entry
  priceCard: { borderRadius: 14, backgroundColor: "#fff", padding: 16 },
  priceInputRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 8 },
  rupeeSym: { fontFamily: "Ubuntu-Bold", fontSize: 36, color: CARETAKER_ORANGE, marginRight: 4 },
  priceInput: { fontSize: 48, fontFamily: "Ubuntu-Bold", color: CARETAKER_ORANGE, backgroundColor: "transparent", minWidth: 150, textAlign: "center" },
  payAtTurfPill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: PALE_ORANGE, borderRadius: 8, padding: 10, marginTop: 12 },
  payAtTurfText: { fontFamily: "Ubuntu-Regular", fontSize: 12, color: NAVY_ORANGE, flex: 1 },

  // Nav
  navBar: { flexDirection: "row", gap: 12, padding: 16, paddingTop: 8, backgroundColor: "#FFFBEB", borderTopWidth: 1, borderTopColor: "#FEE4D0" },
  navBtn: { borderRadius: 10, borderColor: CARETAKER_ORANGE },
});
