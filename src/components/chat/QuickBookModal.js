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
  Surface,
  Chip,
  IconButton,
  ActivityIndicator,
} from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS } from "../../constants/theme";
import { generateOperatingSlots } from "../../utils/priceUtils";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

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
    dates.push({
      date: dateStr,
      dayName: date.toLocaleDateString("en-US", { weekday: "short" }),
      dayNum: date.getDate(),
      month: date.toLocaleDateString("en-US", { month: "short" }),
      isToday: i === 0,
    });
  }
  return dates;
};

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
 * Get icon name for sport
 */
const getSportIcon = (sport) => {
  const icons = {
    cricket: "cricket",
    football: "soccer",
    badminton: "badminton",
    tennis: "tennis",
    basketball: "basketball",
    volleyball: "volleyball",
    pickleball: "racquet",
    hockey: "hockey-sticks",
  };
  return icons[sport?.toLowerCase()] || "run";
};

/**
 * QuickBookModal - Simplified booking modal for chat
 * @param {object} props
 * @param {boolean} props.visible - Modal visibility
 * @param {function} props.onDismiss - Close handler
 * @param {function} props.onSubmit - Submit handler
 * @param {object} props.companyData - Company data with turfs
 * @param {object} props.userData - Current user data
 * @param {boolean} props.isLoading - Loading state
 */
const QuickBookModal = ({
  visible,
  onDismiss,
  onSubmit,
  companyData,
  userData,
  isLoading = false,
}) => {
  // State
  const [selectedTurf, setSelectedTurf] = useState(null);
  const [selectedGround, setSelectedGround] = useState(null);
  const [selectedSport, setSelectedSport] = useState(null);
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [selectedStartTime, setSelectedStartTime] = useState(null);
  const [selectedEndTime, setSelectedEndTime] = useState(null);
  const [turfs, setTurfs] = useState([]);

  // Memoized values
  const dates = useMemo(() => getNext14Days(), []);

  // Dynamic slots respecting selected turf's operating hours for the selected day
  const timeSlots = useMemo(
    () => generateOperatingSlots(selectedTurf?.operatingHours, selectedDate, selectedTurf?.holidaySchedule),
    [selectedTurf, selectedDate]
  );

  // Calculate price based on selection
  const totalPrice = useMemo(() => {
    if (!selectedGround || !selectedSport || !selectedStartTime || !selectedEndTime) {
      return 0;
    }
    const duration = calculateDuration(selectedStartTime, selectedEndTime);
    if (duration <= 0) return 0;

    const pricing = selectedGround.pricing?.[selectedSport];
    if (!pricing) return 0;

    const date = new Date(selectedDate);
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const dayType = isWeekend ? "weekend" : "weekday";

    const startHour = parseInt(selectedStartTime.split(":")[0], 10);
    let hourlyRate = 0;

    const dayPricing = pricing[dayType];
    if (dayPricing) {
      if (dayPricing.morning && startHour >= 6 && startHour < 10) {
        hourlyRate = dayPricing.morning.hourlyRate;
      } else if (dayPricing.afternoon && startHour >= 10 && startHour < 18) {
        hourlyRate = dayPricing.afternoon.hourlyRate;
      } else if (dayPricing.evening && startHour >= 18) {
        hourlyRate = dayPricing.evening.hourlyRate;
      } else if (dayPricing.allDay) {
        hourlyRate = dayPricing.allDay.hourlyRate;
      }
    }

    return Math.round(hourlyRate * duration);
  }, [selectedGround, selectedSport, selectedDate, selectedStartTime, selectedEndTime]);

  // Reset form when modal opens
  useEffect(() => {
    if (visible) {
      setSelectedTurf(null);
      setSelectedGround(null);
      setSelectedSport(null);
      setSelectedDate(getTodayString());
      setSelectedStartTime(null);
      setSelectedEndTime(null);

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

  // Filter end times to be after start time
  const availableEndTimes = useMemo(() => {
    if (!selectedStartTime) return timeSlots;
    return timeSlots.filter((slot) => slot.time > selectedStartTime);
  }, [selectedStartTime, timeSlots]);

  // Handlers
  const handleSelectTurf = (turf) => {
    setSelectedTurf(turf);
    setSelectedGround(null);
    setSelectedSport(null);
  };

  const handleSelectGround = (ground) => {
    setSelectedGround(ground);
    setSelectedSport(null);
  };

  const handleSubmit = () => {
    if (!canSubmit) return;

    const duration = calculateDuration(selectedStartTime, selectedEndTime);
    const bookingData = {
      turfId: selectedTurf.turfId,
      turfName: selectedTurf.name,
      groundId: selectedGround.groundId,
      groundName: selectedGround.name,
      sport: selectedSport,
      date: selectedDate,
      startTime: selectedStartTime,
      endTime: selectedEndTime,
      duration,
      totalAmount: totalPrice,
      userId: userData?.id || userData?.userId || userData?.uid,
      userName: userData?.name || userData?.displayName || "User",
      userPhone: userData?.phone || userData?.phoneNumber || "",
      userEmail: userData?.email || "",
      companyId: companyData?.companyId,
      bookingType: "regular",
    };

    onSubmit(bookingData);
  };

  // Validation
  const canSubmit = selectedTurf && selectedGround && selectedSport &&
    selectedDate && selectedStartTime && selectedEndTime &&
    calculateDuration(selectedStartTime, selectedEndTime) > 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <Surface style={styles.modal} elevation={5}>
          {/* Header */}
          <View style={styles.header}>
            <Text variant="titleLarge" style={styles.headerTitle}>
              Quick Book
            </Text>
            <IconButton
              icon="close"
              size={24}
              onPress={onDismiss}
              style={styles.closeButton}
            />
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Turf Selection */}
            {turfs.length > 1 && (
              <>
                <Text variant="titleSmall" style={styles.sectionTitle}>
                  Select Turf
                </Text>
                <View style={styles.chipContainer}>
                  {turfs.map((turf) => (
                    <Chip
                      key={turf.turfId}
                      mode={selectedTurf?.turfId === turf.turfId ? "flat" : "outlined"}
                      selected={selectedTurf?.turfId === turf.turfId}
                      onPress={() => handleSelectTurf(turf)}
                      style={[
                        styles.chip,
                        selectedTurf?.turfId === turf.turfId && styles.selectedChip,
                      ]}
                      textStyle={selectedTurf?.turfId === turf.turfId ? styles.selectedChipText : null}
                    >
                      {turf.name}
                    </Chip>
                  ))}
                </View>
              </>
            )}

            {/* Ground Selection */}
            {selectedTurf && (
              <>
                <Text variant="titleSmall" style={styles.sectionTitle}>
                  Ground
                </Text>
                <View style={styles.chipContainer}>
                  {selectedTurf.grounds?.map((ground) => (
                    <Chip
                      key={ground.groundId}
                      mode={selectedGround?.groundId === ground.groundId ? "flat" : "outlined"}
                      selected={selectedGround?.groundId === ground.groundId}
                      onPress={() => handleSelectGround(ground)}
                      style={[
                        styles.chip,
                        selectedGround?.groundId === ground.groundId && styles.selectedChip,
                      ]}
                      textStyle={selectedGround?.groundId === ground.groundId ? styles.selectedChipText : null}
                    >
                      {ground.name}
                    </Chip>
                  ))}
                </View>
              </>
            )}

            {/* Sport Selection */}
            {selectedGround && (
              <>
                <Text variant="titleSmall" style={styles.sectionTitle}>
                  Sport
                </Text>
                <View style={styles.chipContainer}>
                  {selectedGround.sports?.map((sport) => (
                    <Chip
                      key={sport}
                      mode={selectedSport === sport ? "flat" : "outlined"}
                      selected={selectedSport === sport}
                      onPress={() => setSelectedSport(sport)}
                      icon={getSportIcon(sport)}
                      style={[
                        styles.chip,
                        selectedSport === sport && styles.selectedChip,
                      ]}
                      textStyle={selectedSport === sport ? styles.selectedChipText : null}
                    >
                      {sport.charAt(0).toUpperCase() + sport.slice(1)}
                    </Chip>
                  ))}
                </View>
              </>
            )}

            {/* Date Selection */}
            <Text variant="titleSmall" style={styles.sectionTitle}>
              Date
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateScroll}>
              {dates.map((dateItem) => (
                <TouchableOpacity
                  key={dateItem.date}
                  style={[
                    styles.dateCard,
                    selectedDate === dateItem.date && styles.selectedDateCard,
                  ]}
                  onPress={() => setSelectedDate(dateItem.date)}
                >
                  <Text
                    style={[
                      styles.dateDay,
                      selectedDate === dateItem.date && styles.selectedDateText,
                    ]}
                  >
                    {dateItem.dayName}
                  </Text>
                  <Text
                    style={[
                      styles.dateNum,
                      selectedDate === dateItem.date && styles.selectedDateText,
                    ]}
                  >
                    {dateItem.dayNum}
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
            <Text variant="titleSmall" style={styles.sectionTitle}>
              Time
            </Text>
            <View style={styles.timeRow}>
              <View style={styles.timeColumn}>
                <Text variant="labelSmall" style={styles.timeLabel}>From</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {timeSlots.slice(0, -1).map((slot) => (
                    <Chip
                      key={`start-${slot.time}`}
                      mode={selectedStartTime === slot.time ? "flat" : "outlined"}
                      selected={selectedStartTime === slot.time}
                      onPress={() => {
                        setSelectedStartTime(slot.time);
                        setSelectedEndTime(null);
                      }}
                      style={[
                        styles.timeChip,
                        selectedStartTime === slot.time && styles.selectedChip,
                      ]}
                      textStyle={selectedStartTime === slot.time ? styles.selectedChipText : styles.timeChipText}
                      compact
                    >
                      {slot.label}
                    </Chip>
                  ))}
                </ScrollView>
              </View>
            </View>

            {selectedStartTime && (
              <View style={styles.timeRow}>
                <View style={styles.timeColumn}>
                  <Text variant="labelSmall" style={styles.timeLabel}>To</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {availableEndTimes.map((slot) => (
                      <Chip
                        key={`end-${slot.time}`}
                        mode={selectedEndTime === slot.time ? "flat" : "outlined"}
                        selected={selectedEndTime === slot.time}
                        onPress={() => setSelectedEndTime(slot.time)}
                        style={[
                          styles.timeChip,
                          selectedEndTime === slot.time && styles.selectedChip,
                        ]}
                        textStyle={selectedEndTime === slot.time ? styles.selectedChipText : styles.timeChipText}
                        compact
                      >
                        {slot.label}
                      </Chip>
                    ))}
                  </ScrollView>
                </View>
              </View>
            )}

            {/* Summary */}
            {canSubmit && (
              <Surface style={styles.summaryCard} elevation={1}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Duration</Text>
                  <Text style={styles.summaryValue}>
                    {calculateDuration(selectedStartTime, selectedEndTime)} hour(s)
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Total</Text>
                  <Text style={styles.priceText}>₹{totalPrice}</Text>
                </View>
              </Surface>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Button
              mode="outlined"
              onPress={onDismiss}
              style={styles.footerButton}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleSubmit}
              loading={isLoading}
              disabled={!canSubmit || isLoading}
              style={[styles.footerButton, styles.confirmButton]}
              icon="calendar-check"
            >
              Request Booking
            </Button>
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
    maxHeight: SCREEN_HEIGHT * 0.85,
    paddingBottom: Platform.OS === "ios" ? 34 : 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  headerTitle: {
    fontWeight: "600",
    color: COLORS.text,
  },
  closeButton: {
    margin: 0,
  },
  content: {
    paddingHorizontal: 20,
    maxHeight: SCREEN_HEIGHT * 0.6,
  },
  sectionTitle: {
    fontWeight: "600",
    color: COLORS.text,
    marginTop: 16,
    marginBottom: 10,
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
  dateScroll: {
    marginBottom: 8,
  },
  dateCard: {
    width: 56,
    paddingVertical: 10,
    marginRight: 8,
    borderRadius: 10,
    backgroundColor: "#f5f5f5",
    alignItems: "center",
  },
  selectedDateCard: {
    backgroundColor: COLORS.primary,
  },
  dateDay: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: "500",
  },
  dateNum: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
    marginVertical: 2,
  },
  selectedDateText: {
    color: "#fff",
  },
  todayBadge: {
    backgroundColor: COLORS.success,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    marginTop: 2,
  },
  todayText: {
    fontSize: 8,
    color: "#fff",
    fontWeight: "600",
  },
  timeRow: {
    marginBottom: 8,
  },
  timeColumn: {
    flex: 1,
  },
  timeLabel: {
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  timeChip: {
    marginRight: 6,
    marginBottom: 4,
  },
  timeChipText: {
    fontSize: 11,
  },
  summaryCard: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#f8f9fa",
    marginTop: 16,
    marginBottom: 8,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  summaryLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  summaryValue: {
    color: COLORS.text,
    fontWeight: "500",
    fontSize: 14,
  },
  priceText: {
    color: COLORS.primary,
    fontWeight: "700",
    fontSize: 18,
  },
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
  confirmButton: {
    backgroundColor: COLORS.primary,
  },
});

export default QuickBookModal;
