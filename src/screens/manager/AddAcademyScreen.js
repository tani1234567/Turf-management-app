import { useState, useCallback, useMemo } from "react";
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
  Chip,
  TextInput,
  IconButton,
  Divider,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSelectedTurf } from "../../hooks/useSelectedTurf";
import { useAppSelector } from "../../hooks";
import { selectUser } from "../../store/slices/authSlice";
import { addDocument } from "../../services/firebase/firestore";

const MANAGER_BLUE = "#3B82F6";

const DAYS_OF_WEEK = [
  { key: "monday", label: "Mon" },
  { key: "tuesday", label: "Tue" },
  { key: "wednesday", label: "Wed" },
  { key: "thursday", label: "Thu" },
  { key: "friday", label: "Fri" },
  { key: "saturday", label: "Sat" },
  { key: "sunday", label: "Sun" },
];

const MONTH_NAMES_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const getUpcomingMonths = () => {
  const d = new Date();
  return Array.from({ length: 3 }, (_, i) => {
    const t = new Date(d.getFullYear(), d.getMonth() + i, 1);
    const key = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`;
    return { key, label: `${MONTH_NAMES_FULL[t.getMonth()]} ${t.getFullYear()}` };
  });
};

const getLastDayOfMonth = (monthKey) => {
  const [y, m] = monthKey.split("-").map(Number);
  const last = new Date(y, m, 0);
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
};

const TIME_SLOTS = [];
for (let h = 6; h < 23; h++) {
  for (let m = 0; m < 60; m += 30) {
    const time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    const hour12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
    const ampm = h >= 12 ? "PM" : "AM";
    TIME_SLOTS.push({ time, label: `${hour12}:${String(m).padStart(2, "0")} ${ampm}` });
  }
}
TIME_SLOTS.push({ time: "23:00", label: "11:00 PM" });

const getTodayString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const formatDate = (dateStr) => {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
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
  const [y, mo, d] = dateStr.split("-").map(Number);
  const date = new Date(y, mo - 1 + months, d);
  const targetMonth = (mo - 1 + months) % 12;
  if (date.getMonth() !== targetMonth) date.setDate(0);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const getDayOfWeek = (dateStr) => {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const date = new Date(y, mo - 1, d);
  return ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"][date.getDay()];
};

const generateSessionDates = (startDate, endDate, scheduledDays) => {
  const dates = [];
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  const current = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  while (current <= end) {
    const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`;
    if (scheduledDays.includes(getDayOfWeek(dateStr))) dates.push(dateStr);
    current.setDate(current.getDate() + 1);
  }
  return dates;
};

function TimeSlotGrid({ startTime, endTime, onSlotPress }) {
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
            style={[styles.timeSlotChip, isStart && styles.timeSlotStart, isEnd && styles.timeSlotEnd, isInRange && styles.timeSlotInRange]}
            onPress={() => onSlotPress(slot.time)}
          >
            <Text style={[styles.timeSlotChipText, isSelected && styles.timeSlotChipTextActive]} numberOfLines={1}>
              {slot.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function StepIndicator({ currentStep }) {
  const steps = ["Details", "Schedule", "Contract", "Payment"];
  return (
    <View style={styles.stepIndicatorContainer}>
      {steps.map((label, index) => {
        const stepNum = index + 1;
        const isActive = stepNum === currentStep;
        const isComplete = stepNum < currentStep;
        return (
          <View key={label} style={styles.stepItem}>
            <View style={[styles.stepCircle, isActive && styles.stepCircleActive, isComplete && styles.stepCircleComplete]}>
              {isComplete
                ? <MaterialCommunityIcons name="check" size={13} color="#fff" />
                : <Text style={[styles.stepNumber, (isActive || isComplete) && styles.stepNumberActive]}>{stepNum}</Text>}
            </View>
            <Text style={[styles.stepLabel, isActive && styles.stepLabelActive, isComplete && styles.stepLabelComplete]}>
              {label}
            </Text>
            {index < steps.length - 1 && (
              <View style={[styles.stepLine, isComplete && styles.stepLineComplete]} />
            )}
          </View>
        );
      })}
    </View>
  );
}

export default function AddAcademyScreen({ navigation }) {
  const { selectedTurfId, turfData } = useSelectedTurf();
  const user = useAppSelector(selectUser);

  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1
  const [name, setName] = useState("");
  const [sport, setSport] = useState("");
  const [groundId, setGroundId] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  // Step 2
  const [daySchedules, setDaySchedules] = useState({});
  const [activeDay, setActiveDay] = useState(null);
  const [tempStartTime, setTempStartTime] = useState(null);
  const [tempEndTime, setTempEndTime] = useState(null);

  // Step 3
  const [startDate, setStartDate] = useState(getTodayString());
  const [selectedMonths, setSelectedMonths] = useState(() => [getUpcomingMonths()[0].key]);

  // Step 4
  const [totalAmount, setTotalAmount] = useState("");
  const [cashAmount, setCashAmount] = useState("");

  const grounds = useMemo(() => {
    if (!turfData?.grounds) return [];
    return turfData.grounds.map((g, i) => ({ ...g, id: g.id || `ground_${i}` }));
  }, [turfData]);

  const sports = useMemo(() => {
    const sportSet = new Set();
    (turfData?.grounds || []).forEach((g) => (g.sports || []).forEach((s) => sportSet.add(s)));
    return Array.from(sportSet);
  }, [turfData]);

  const selectedGroundName = useMemo(() => grounds.find((g) => g.id === groundId)?.name || "", [grounds, groundId]);
  const selectedDays = useMemo(() => Object.keys(daySchedules), [daySchedules]);

  const toggleMonth = useCallback((key) => {
    setSelectedMonths((prev) => {
      if (prev.includes(key)) {
        if (prev.length === 1) return prev; // keep at least one selected
        return prev.filter((k) => k !== key).sort();
      }
      return [...prev, key].sort();
    });
  }, []);

  const endDate = useMemo(() => {
    const sorted = [...selectedMonths].sort();
    return getLastDayOfMonth(sorted[sorted.length - 1]);
  }, [selectedMonths]);
  const sessionCount = useMemo(() => selectedDays.length === 0 ? 0 : generateSessionDates(startDate, endDate, selectedDays).length, [startDate, endDate, selectedDays]);
  const onlineAmount = useMemo(() => Math.max(0, (parseFloat(totalAmount) || 0) - (parseFloat(cashAmount) || 0)), [totalAmount, cashAmount]);

  const handleDayPress = useCallback((dayKey) => {
    if (daySchedules[dayKey]) {
      setActiveDay(dayKey);
      setTempStartTime(daySchedules[dayKey].startTime);
      setTempEndTime(daySchedules[dayKey].endTime);
    } else {
      const defaultStart = "06:00", defaultEnd = "07:00";
      setDaySchedules((prev) => ({ ...prev, [dayKey]: { startTime: defaultStart, endTime: defaultEnd } }));
      setActiveDay(dayKey);
      setTempStartTime(defaultStart);
      setTempEndTime(defaultEnd);
    }
  }, [daySchedules]);

  const handleDayRemove = useCallback((dayKey) => {
    setDaySchedules((prev) => { const next = { ...prev }; delete next[dayKey]; return next; });
    if (activeDay === dayKey) { setActiveDay(null); setTempStartTime(null); setTempEndTime(null); }
  }, [activeDay]);

  const handleTimeSlotPress = useCallback((time) => {
    if (!activeDay) return;
    if (!tempStartTime || (tempStartTime && tempEndTime)) {
      setTempStartTime(time); setTempEndTime(null);
    } else {
      if (time <= tempStartTime) { setTempStartTime(time); setTempEndTime(null); }
      else { setTempEndTime(time); setDaySchedules((prev) => ({ ...prev, [activeDay]: { startTime: tempStartTime, endTime: time } })); }
    }
  }, [activeDay, tempStartTime, tempEndTime]);

  const handleApplyToAllDays = useCallback(() => {
    if (!activeDay || !daySchedules[activeDay]) return;
    const { startTime: st, endTime: et } = daySchedules[activeDay];
    setDaySchedules((prev) => { const next = {}; for (const day of Object.keys(prev)) next[day] = { startTime: st, endTime: et }; return next; });
    Alert.alert("Applied", `${formatTime(st)} - ${formatTime(et)} applied to all days.`);
  }, [activeDay, daySchedules]);

  const navigateStartDate = useCallback((direction) => {
    const [y, mo, d] = startDate.split("-").map(Number);
    const date = new Date(y, mo - 1, d + direction);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (date.getTime() < today.getTime()) return; // block any date before today
    setStartDate(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`);
  }, [startDate]);

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
            Alert.alert("Invalid", `End time must be after start time for ${day.charAt(0).toUpperCase() + day.slice(1)}.`);
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
        if ((parseFloat(cashAmount) || 0) > parseFloat(totalAmount)) { Alert.alert("Invalid", "Cash amount cannot exceed total amount."); return false; }
        return true;
      default: return true;
    }
  }, [name, sport, groundId, daySchedules, startDate, sessionCount, totalAmount, cashAmount]);

  const nextStep = useCallback(() => {
    if (!validateStep(currentStep)) return;
    setCurrentStep((prev) => Math.min(prev + 1, 4));
  }, [currentStep, validateStep]);

  const prevStep = useCallback(() => setCurrentStep((prev) => Math.max(prev - 1, 1)), []);

  const handleSubmit = useCallback(async () => {
    if (!validateStep(4)) return;
    setSubmitting(true);
    try {
      const total = parseFloat(totalAmount) || 0;
      const cash = parseFloat(cashAmount) || 0;
      await addDocument("academies", {
        name: name.trim(), sport, turfId: selectedTurfId,
        turfName: turfData?.name || "", groundId, groundName: selectedGroundName,
        contactName: contactName.trim(), contactPhone: contactPhone.trim(),
        schedule: { days: daySchedules },
        contract: { startDate, endDate, selectedMonths },
        payment: { totalAmount: total, cashAmount: cash, onlineAmount: total - cash },
        status: "active", sessionCount, sessionsGenerated: false,
        createdBy: user?.userId, createdByName: user?.name || user?.displayName || "",
      });
      Alert.alert("Academy Created", `"${name.trim()}" created. ${sessionCount} sessions are being generated.`, [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert("Error", "Failed to create academy. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [validateStep, totalAmount, cashAmount, name, sport, selectedTurfId, turfData, groundId, selectedGroundName, contactName, contactPhone, daySchedules, startDate, endDate, selectedMonths, sessionCount, user, navigation]);

  const renderStep1 = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Text style={styles.stepTitle}>Basic Details</Text>
      <TextInput label="Academy Name *" value={name} onChangeText={setName} mode="outlined" style={styles.input} outlineColor="#ddd" activeOutlineColor={MANAGER_BLUE} />
      <Text style={styles.fieldLabel}>Sport *</Text>
      <View style={styles.chipGroup}>
        {sports.map((s) => <Chip key={s} selected={sport === s} onPress={() => setSport(s)} mode="outlined" style={styles.chip} selectedColor={MANAGER_BLUE}>{s}</Chip>)}
        {sports.length === 0 && <Text style={styles.hintText}>No sports configured for this turf</Text>}
      </View>
      <Text style={styles.fieldLabel}>Ground *</Text>
      <View style={styles.chipGroup}>
        {grounds.map((g) => <Chip key={g.id} selected={groundId === g.id} onPress={() => setGroundId(g.id)} mode="outlined" style={styles.chip} selectedColor={MANAGER_BLUE}>{g.name}</Chip>)}
      </View>
      <TextInput label="Contact Name" value={contactName} onChangeText={setContactName} mode="outlined" style={styles.input} outlineColor="#ddd" activeOutlineColor={MANAGER_BLUE} />
      <TextInput label="Contact Phone" value={contactPhone} onChangeText={setContactPhone} mode="outlined" style={styles.input} keyboardType="phone-pad" outlineColor="#ddd" activeOutlineColor={MANAGER_BLUE} />
    </ScrollView>
  );

  const renderStep2 = () => (
    <ScrollView style={styles.stepContent} contentContainerStyle={styles.stepScrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
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
              style={[styles.dayCircle, isSelected && styles.dayCircleSelected, isActive && styles.dayCircleActive]}
              onPress={() => handleDayPress(day.key)}
              onLongPress={() => isSelected && handleDayRemove(day.key)}
            >
              <Text style={[styles.dayCircleText, (isSelected || isActive) && styles.dayCircleTextActive]}>{day.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {selectedDays.length > 0 && <Text style={styles.hintText}>{selectedDays.length} day(s) selected</Text>}
      {activeDay && (
        <>
          <Divider style={styles.divider} />
          <Text style={styles.fieldLabel}>Set time for {activeDay.charAt(0).toUpperCase() + activeDay.slice(1)}</Text>
          {tempStartTime && (
            <Surface style={styles.summaryBox} elevation={1}>
              <MaterialCommunityIcons name="clock-outline" size={18} color={MANAGER_BLUE} />
              <Text style={styles.summaryText}>
                {formatTime(tempStartTime)}{tempEndTime ? ` → ${formatTime(tempEndTime)}` : " → Select end time"}
              </Text>
              {tempStartTime && tempEndTime && tempStartTime < tempEndTime && (
                <Text style={[styles.summaryText, { color: MANAGER_BLUE, fontWeight: "700" }]}>
                  {(() => {
                    const [sh, sm] = tempStartTime.split(":").map(Number);
                    const [eh, em] = tempEndTime.split(":").map(Number);
                    const mins = (eh * 60 + em) - (sh * 60 + sm);
                    return ` (${Math.floor(mins / 60)}h${mins % 60 > 0 ? ` ${mins % 60}m` : ""})`;
                  })()}
                </Text>
              )}
            </Surface>
          )}
          <TimeSlotGrid startTime={tempStartTime} endTime={tempEndTime} onSlotPress={handleTimeSlotPress} />
          {selectedDays.length > 1 && (
            <Button mode="outlined" onPress={handleApplyToAllDays} style={{ marginTop: 12 }} icon="content-copy" textColor={MANAGER_BLUE}>Apply to all days</Button>
          )}
        </>
      )}
      {selectedDays.length > 0 && (
        <>
          <Divider style={styles.divider} />
          <Text style={styles.fieldLabel}>Schedule Summary</Text>
          {selectedDays.map((day) => {
            const t = daySchedules[day];
            return (
              <View key={day} style={styles.scheduleSummaryRow}>
                <Text style={styles.scheduleSummaryDay}>{day.charAt(0).toUpperCase() + day.slice(1)}:</Text>
                <Text style={styles.scheduleSummaryTime}>{formatTime(t.startTime)} - {formatTime(t.endTime)}</Text>
              </View>
            );
          })}
        </>
      )}
    </ScrollView>
  );

  const renderStep3 = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepTitle}>Contract Period</Text>
      <Text style={styles.fieldLabel}>Start Date</Text>
      <View style={styles.dateNav}>
        <IconButton icon="chevron-left" size={24} onPress={() => navigateStartDate(-1)} />
        <View style={styles.dateDisplay}>
          <Text style={styles.dateDisplayText}>{formatDate(startDate)}</Text>
        </View>
        <IconButton icon="chevron-right" size={24} onPress={() => navigateStartDate(1)} />
      </View>
      <Text style={styles.fieldLabel}>Months (select one or more)</Text>
      <View style={styles.chipGroup}>
        {getUpcomingMonths().map((opt) => (
          <Chip
            key={opt.key}
            selected={selectedMonths.includes(opt.key)}
            onPress={() => toggleMonth(opt.key)}
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
        {[
          { icon: "calendar-start", label: "Start:", value: formatDate(startDate) },
          { icon: "calendar-end", label: "End:", value: formatDate(endDate) },
          {
            icon: "calendar-month",
            label: "Months:",
            value: (() => {
              const opts = getUpcomingMonths();
              const selected = opts.filter((o) => selectedMonths.includes(o.key));
              if (selected.length === 1) return selected[0].label;
              if (selected.length === opts.length) return `${selected[0].label} – ${selected[selected.length - 1].label}`;
              return selected.map((o) => o.label).join(", ");
            })(),
          },
        ].map(({ icon, label, value }) => (
          <View key={label} style={styles.contractRow}>
            <MaterialCommunityIcons name={icon} size={18} color="#666" />
            <Text style={styles.contractLabel}>{label}</Text>
            <Text style={styles.contractValue}>{value}</Text>
          </View>
        ))}
        <View style={styles.contractRow}>
          <MaterialCommunityIcons name="counter" size={18} color="#666" />
          <Text style={styles.contractLabel}>Sessions:</Text>
          <Text style={[styles.contractValue, { color: MANAGER_BLUE, fontWeight: "700" }]}>{sessionCount}</Text>
        </View>
        {selectedDays.length > 0 && (
          <View style={styles.contractRow}>
            <MaterialCommunityIcons name="calendar-week" size={18} color="#666" />
            <Text style={styles.contractLabel}>Days:</Text>
            <Text style={styles.contractValue}>{selectedDays.map((d) => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(", ")}</Text>
          </View>
        )}
      </Surface>
    </ScrollView>
  );

  const renderStep4 = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Text style={styles.stepTitle}>Payment Details</Text>
      <TextInput label="Total Amount (₹) *" value={totalAmount} onChangeText={setTotalAmount} mode="outlined" style={styles.input} keyboardType="numeric" outlineColor="#ddd" activeOutlineColor={MANAGER_BLUE} />
      <TextInput label="Cash Amount (₹)" value={cashAmount} onChangeText={setCashAmount} mode="outlined" style={styles.input} keyboardType="numeric" outlineColor="#ddd" activeOutlineColor={MANAGER_BLUE} />
      <Surface style={styles.paymentSummary} elevation={1}>
        <Text style={styles.paymentSummaryTitle}>Payment Breakdown</Text>
        <View style={styles.paymentRow}><Text style={styles.paymentLabel}>Total Amount</Text><Text style={styles.paymentValue}>₹{parseFloat(totalAmount) || 0}</Text></View>
        <View style={styles.paymentRow}><Text style={styles.paymentLabel}>Cash</Text><Text style={styles.paymentValue}>₹{parseFloat(cashAmount) || 0}</Text></View>
        <Divider style={{ marginVertical: 8 }} />
        <View style={styles.paymentRow}>
          <Text style={[styles.paymentLabel, { fontWeight: "700" }]}>Online</Text>
          <Text style={[styles.paymentValue, { color: MANAGER_BLUE, fontWeight: "700" }]}>₹{onlineAmount}</Text>
        </View>
        {sessionCount > 0 && parseFloat(totalAmount) > 0 && (
          <>
            <Divider style={{ marginVertical: 8 }} />
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>Per Session</Text>
              <Text style={styles.paymentValue}>₹{(parseFloat(totalAmount) / sessionCount).toFixed(0)}</Text>
            </View>
          </>
        )}
      </Surface>
      <Surface style={styles.finalSummary} elevation={1}>
        <Text style={styles.finalSummaryTitle}>
          <MaterialCommunityIcons name="check-circle-outline" size={16} color={MANAGER_BLUE} /> Review
        </Text>
        <Text style={styles.finalSummaryRow}>{name} - {sport}</Text>
        <Text style={styles.finalSummaryRow}>{selectedGroundName} | {selectedDays.map((d) => d.slice(0, 3)).join(", ")}</Text>
        {selectedDays.map((day) => {
          const t = daySchedules[day];
          return <Text key={day} style={styles.finalSummaryRow}>{day.charAt(0).toUpperCase() + day.slice(1, 3)}: {formatTime(t?.startTime)} - {formatTime(t?.endTime)}</Text>;
        })}
        <Text style={styles.finalSummaryRow}>{formatDate(startDate)} to {formatDate(endDate)} ({sessionCount} sessions)</Text>
      </Surface>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton icon="arrow-left" onPress={() => navigation.goBack()} disabled={submitting} />
        <Text variant="titleLarge" style={styles.headerTitle}>Add Academy</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {/* Step Indicator */}
        <StepIndicator currentStep={currentStep} />

        {/* Step Content */}
        <View style={{ flex: 1 }}>
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
          {currentStep === 4 && renderStep4()}
        </View>

        {/* Footer Buttons */}
        <View style={styles.footer}>
          {currentStep > 1 && (
            <Button mode="outlined" onPress={prevStep} style={styles.footerBtn} disabled={submitting}>Back</Button>
          )}
          {currentStep < 4 ? (
            <Button mode="contained" onPress={nextStep} style={[styles.footerBtn, styles.footerBtnPrimary]} buttonColor={MANAGER_BLUE}>Next</Button>
          ) : (
            <Button mode="contained" onPress={handleSubmit} style={[styles.footerBtn, styles.footerBtnPrimary]} buttonColor="#4CAF50" loading={submitting} disabled={submitting}>Create Academy</Button>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F0F4F8" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingRight: 4,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  headerTitle: { fontWeight: "bold", color: "#333", flex: 1 },

  // Step indicator — compact so all 4 labels fit without clipping
  stepIndicatorContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  stepItem: { flexDirection: "row", alignItems: "center" },
  stepCircle: {
    width: 26, height: 26, borderRadius: 13,
    borderWidth: 2, borderColor: "#ddd",
    justifyContent: "center", alignItems: "center",
    backgroundColor: "#fff",
  },
  stepCircleActive: { borderColor: MANAGER_BLUE, backgroundColor: MANAGER_BLUE },
  stepCircleComplete: { borderColor: "#4CAF50", backgroundColor: "#4CAF50" },
  stepNumber: { fontSize: 11, fontWeight: "600", color: "#999" },
  stepNumberActive: { color: "#fff" },
  stepLabel: { fontSize: 10, color: "#999", marginLeft: 4, fontWeight: "500" },
  stepLabelActive: { color: MANAGER_BLUE, fontWeight: "700" },
  stepLabelComplete: { color: "#4CAF50" },
  stepLine: { width: 14, height: 2, backgroundColor: "#ddd", marginHorizontal: 4 },
  stepLineComplete: { backgroundColor: "#4CAF50" },

  // Step content
  stepContent: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  stepScrollContent: { paddingBottom: 80 },
  stepTitle: { fontSize: 20, fontWeight: "700", color: "#212121", marginBottom: 16 },
  input: { marginBottom: 12, backgroundColor: "#fff" },
  fieldLabel: { fontSize: 14, fontWeight: "600", color: "#444", marginBottom: 8, marginTop: 4 },
  chipGroup: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  chip: { marginBottom: 4 },
  hintText: { fontSize: 12, color: "#999", marginBottom: 8 },
  divider: { marginVertical: 16 },

  dayCircleRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  dayCircle: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#f0f0f0", justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: "transparent" },
  dayCircleSelected: { backgroundColor: MANAGER_BLUE + "20", borderColor: MANAGER_BLUE },
  dayCircleActive: { backgroundColor: MANAGER_BLUE, borderColor: MANAGER_BLUE },
  dayCircleText: { fontSize: 12, fontWeight: "600", color: "#666" },
  dayCircleTextActive: { color: "#fff" },

  timeSlotsGrid: { flexDirection: "row", flexWrap: "wrap" },
  timeSlotChip: { width: "24%", margin: "0.5%", paddingVertical: 10, borderRadius: 8, backgroundColor: "#f0f0f0", alignItems: "center" },
  timeSlotStart: { backgroundColor: MANAGER_BLUE },
  timeSlotEnd: { backgroundColor: MANAGER_BLUE + "80" },
  timeSlotInRange: { backgroundColor: MANAGER_BLUE + "30" },
  timeSlotChipText: { fontSize: 11, fontWeight: "500", color: "#666" },
  timeSlotChipTextActive: { color: "#fff" },

  scheduleSummaryRow: { flexDirection: "row", alignItems: "center", marginBottom: 4, paddingVertical: 4, paddingHorizontal: 8, backgroundColor: "#f9f9f9", borderRadius: 6 },
  scheduleSummaryDay: { fontSize: 13, fontWeight: "600", color: "#444", width: 90 },
  scheduleSummaryTime: { fontSize: 13, color: MANAGER_BLUE, fontWeight: "500" },

  summaryBox: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 8, backgroundColor: "#E3F2FD", marginBottom: 12 },
  summaryText: { fontSize: 14, color: "#333", fontWeight: "500" },

  dateNav: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  dateDisplay: { flex: 1, alignItems: "center", paddingVertical: 12, backgroundColor: "#fff", borderRadius: 8, borderWidth: 1, borderColor: "#ddd" },
  dateDisplayText: { fontSize: 16, fontWeight: "600", color: "#333" },

  contractSummary: { padding: 16, borderRadius: 12, backgroundColor: "#fff" },
  contractSummaryTitle: { fontSize: 15, fontWeight: "700", color: "#212121", marginBottom: 12 },
  contractRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  contractLabel: { fontSize: 13, color: "#666", width: 70 },
  contractValue: { fontSize: 14, color: "#333", fontWeight: "500", flex: 1 },

  paymentSummary: { padding: 16, borderRadius: 12, backgroundColor: "#fff", marginBottom: 16 },
  paymentSummaryTitle: { fontSize: 15, fontWeight: "700", color: "#212121", marginBottom: 12 },
  paymentRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  paymentLabel: { fontSize: 14, color: "#666" },
  paymentValue: { fontSize: 14, color: "#333", fontWeight: "500" },

  finalSummary: { padding: 16, borderRadius: 12, backgroundColor: "#E3F2FD" },
  finalSummaryTitle: { fontSize: 15, fontWeight: "700", color: MANAGER_BLUE, marginBottom: 8 },
  finalSummaryRow: { fontSize: 13, color: "#444", marginBottom: 4, lineHeight: 20 },

  footer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: -12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  footerBtn: { minWidth: 100 },
  footerBtnPrimary: { flex: 1 },
});
