import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import {
  Text,
  Surface,
  TextInput,
  Chip,
  Button,
  Checkbox,
  Divider,
  SegmentedButtons,
  Menu,
} from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { TIME_SLOTS, DAY_TYPES, getSportById, getSportColor } from "../../constants/sports";

const OWNER_COLOR = "#9C27B0";

// Time options for picker (30 minute intervals)
const TIME_OPTIONS = [];
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 30) {
    const hour = h.toString().padStart(2, "0");
    const minute = m.toString().padStart(2, "0");
    TIME_OPTIONS.push(`${hour}:${minute}`);
  }
}

// Default pricing structure for a sport
const getDefaultPricing = () => ({
  weekday: {
    morning: { start: "06:00", end: "10:00", hourlyRate: 1000 },
    afternoon: { start: "10:00", end: "18:00", hourlyRate: 800 },
    evening: { start: "18:00", end: "23:00", hourlyRate: 1500 },
  },
  weekend: {
    morning: { start: "06:00", end: "10:00", hourlyRate: 1200 },
    afternoon: { start: "10:00", end: "18:00", hourlyRate: 1000 },
    evening: { start: "18:00", end: "23:00", hourlyRate: 1800 },
  },
});

// Time Picker Component
const TimePicker = ({ value, onChange, label }) => {
  const [menuVisible, setMenuVisible] = useState(false);

  return (
    <Menu
      visible={menuVisible}
      onDismiss={() => setMenuVisible(false)}
      anchor={
        <TouchableOpacity
          style={styles.timePickerButton}
          onPress={() => setMenuVisible(true)}
        >
          <Text variant="bodySmall" style={styles.timePickerLabel}>
            {label}
          </Text>
          <View style={styles.timePickerValue}>
            <Text variant="bodyLarge" style={styles.timePickerText}>
              {value}
            </Text>
            <MaterialCommunityIcons name="clock-outline" size={16} color="#666" />
          </View>
        </TouchableOpacity>
      }
      contentStyle={styles.timeMenu}
    >
      <ScrollView style={styles.timeMenuScroll}>
        {TIME_OPTIONS.map((time) => (
          <Menu.Item
            key={time}
            onPress={() => {
              onChange(time);
              setMenuVisible(false);
            }}
            title={time}
            style={time === value ? styles.selectedTime : null}
            titleStyle={time === value ? styles.selectedTimeText : null}
          />
        ))}
      </ScrollView>
    </Menu>
  );
};

// Currency Input Component
const CurrencyInput = ({ value, onChange, label }) => {
  const [localValue, setLocalValue] = useState(value?.toString() || "");

  useEffect(() => {
    setLocalValue(value?.toString() || "");
  }, [value]);

  const handleChange = (text) => {
    // Remove non-numeric characters
    const numericValue = text.replace(/[^0-9]/g, "");
    setLocalValue(numericValue);
    onChange(parseInt(numericValue, 10) || 0);
  };

  return (
    <View style={styles.currencyInputContainer}>
      <Text variant="bodySmall" style={styles.currencyLabel}>
        {label}
      </Text>
      <View style={styles.currencyInputWrapper}>
        <Text style={styles.currencySymbol}>₹</Text>
        <TextInput
          mode="outlined"
          value={localValue}
          onChangeText={handleChange}
          keyboardType="numeric"
          style={styles.currencyInput}
          dense
          outlineStyle={styles.currencyInputOutline}
        />
        <Text variant="bodySmall" style={styles.perHourText}>
          /hr
        </Text>
      </View>
    </View>
  );
};

// Time Slot Row Component
const TimeSlotRow = ({ slotName, slotData, onUpdate }) => {
  return (
    <View style={styles.timeSlotRow}>
      <View style={styles.timeSlotHeader}>
        <MaterialCommunityIcons
          name={
            slotName === "morning"
              ? "weather-sunset-up"
              : slotName === "afternoon"
              ? "white-balance-sunny"
              : "weather-sunset-down"
          }
          size={20}
          color={OWNER_COLOR}
        />
        <Text variant="titleSmall" style={styles.timeSlotTitle}>
          {slotName.charAt(0).toUpperCase() + slotName.slice(1)}
        </Text>
      </View>

      <View style={styles.timeSlotContent}>
        <View style={styles.timeRangeContainer}>
          <TimePicker
            value={slotData.start}
            onChange={(time) => onUpdate({ ...slotData, start: time })}
            label="From"
          />
          <Text style={styles.timeSeparator}>to</Text>
          <TimePicker
            value={slotData.end}
            onChange={(time) => onUpdate({ ...slotData, end: time })}
            label="To"
          />
        </View>

        <CurrencyInput
          value={slotData.hourlyRate}
          onChange={(rate) => onUpdate({ ...slotData, hourlyRate: rate })}
          label="Hourly Rate"
        />
      </View>
    </View>
  );
};

// Day Type Pricing Section
const DayTypePricing = ({ dayType, pricing, onUpdate, copyFromWeekday }) => {
  const isWeekend = dayType === "weekend";

  return (
    <View style={styles.dayTypeSection}>
      <View style={styles.dayTypeHeader}>
        <Text variant="titleMedium" style={styles.dayTypeTitle}>
          {isWeekend ? "Weekend Pricing" : "Weekday Pricing"}
        </Text>
        <Text variant="bodySmall" style={styles.dayTypeSubtitle}>
          {isWeekend ? "Sat & Sun" : "Mon - Fri"}
        </Text>
      </View>

      {isWeekend && copyFromWeekday && (
        <TouchableOpacity
          style={styles.copyButton}
          onPress={copyFromWeekday}
        >
          <MaterialCommunityIcons name="content-copy" size={16} color={OWNER_COLOR} />
          <Text variant="bodySmall" style={styles.copyButtonText}>
            Copy from Weekday
          </Text>
        </TouchableOpacity>
      )}

      <TimeSlotRow
        slotName="morning"
        slotData={pricing.morning}
        onUpdate={(data) => onUpdate({ ...pricing, morning: data })}
      />
      <Divider style={styles.slotDivider} />
      <TimeSlotRow
        slotName="afternoon"
        slotData={pricing.afternoon}
        onUpdate={(data) => onUpdate({ ...pricing, afternoon: data })}
      />
      <Divider style={styles.slotDivider} />
      <TimeSlotRow
        slotName="evening"
        slotData={pricing.evening}
        onUpdate={(data) => onUpdate({ ...pricing, evening: data })}
      />
    </View>
  );
};

// Preview Calculator Component
const PreviewCalculator = ({ pricing }) => {
  const [duration, setDuration] = useState(2);
  const [dayType, setDayType] = useState("weekend");
  const [timeSlot, setTimeSlot] = useState("evening");

  const calculateTotal = () => {
    if (!pricing || !pricing[dayType] || !pricing[dayType][timeSlot]) {
      return 0;
    }
    return pricing[dayType][timeSlot].hourlyRate * duration;
  };

  const total = calculateTotal();
  const dayLabel = dayType === "weekend" ? "Saturday" : "Monday";

  return (
    <Surface style={styles.previewCard} elevation={2}>
      <Text variant="titleSmall" style={styles.previewTitle}>
        <MaterialCommunityIcons name="calculator" size={18} color={OWNER_COLOR} /> Price Preview
      </Text>

      <View style={styles.previewControls}>
        <View style={styles.previewRow}>
          <Text variant="bodySmall" style={styles.previewLabel}>Duration:</Text>
          <View style={styles.durationButtons}>
            {[1, 2, 3, 4].map((hr) => (
              <TouchableOpacity
                key={hr}
                style={[
                  styles.durationButton,
                  duration === hr && styles.durationButtonActive,
                ]}
                onPress={() => setDuration(hr)}
              >
                <Text
                  style={[
                    styles.durationButtonText,
                    duration === hr && styles.durationButtonTextActive,
                  ]}
                >
                  {hr}h
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.previewRow}>
          <Text variant="bodySmall" style={styles.previewLabel}>Day:</Text>
          <SegmentedButtons
            value={dayType}
            onValueChange={setDayType}
            buttons={[
              { value: "weekday", label: "Weekday" },
              { value: "weekend", label: "Weekend" },
            ]}
            style={styles.segmentedButtons}
            density="small"
          />
        </View>

        <View style={styles.previewRow}>
          <Text variant="bodySmall" style={styles.previewLabel}>Time:</Text>
          <SegmentedButtons
            value={timeSlot}
            onValueChange={setTimeSlot}
            buttons={[
              { value: "morning", label: "Morning" },
              { value: "afternoon", label: "Afternoon" },
              { value: "evening", label: "Evening" },
            ]}
            style={styles.segmentedButtons}
            density="small"
          />
        </View>
      </View>

      <View style={styles.previewResult}>
        <Text variant="bodyMedium" style={styles.previewResultText}>
          {duration} hour{duration > 1 ? "s" : ""} on {dayLabel} {timeSlot} =
        </Text>
        <Text variant="headlineSmall" style={styles.previewTotal}>
          ₹{total.toLocaleString()}
        </Text>
      </View>
    </Surface>
  );
};

// Main Component
export default function PricingConfigurator({
  grounds = [],
  initialPricing = {},
  onChange,
}) {
  // State
  const [selectedGroundId, setSelectedGroundId] = useState(
    grounds[0]?.id || grounds[0]?.groundId || null
  );
  const [selectedSport, setSelectedSport] = useState(null);
  const [pricing, setPricing] = useState(initialPricing);
  const [copyWeekdayToWeekend, setCopyWeekdayToWeekend] = useState(false);

  // Initialize selected sport when ground changes
  useEffect(() => {
    if (selectedGroundId && grounds.length > 0) {
      const ground = grounds.find(
        (g) => g.id === selectedGroundId || g.groundId === selectedGroundId
      );
      if (ground?.sports?.length > 0) {
        setSelectedSport(ground.sports[0]);
      }
    }
  }, [selectedGroundId, grounds]);

  // Initialize pricing for grounds/sports that don't have pricing yet
  useEffect(() => {
    const newPricing = { ...pricing };
    let hasChanges = false;

    grounds.forEach((ground) => {
      const groundId = ground.id || ground.groundId;
      if (!newPricing[groundId]) {
        newPricing[groundId] = {};
        hasChanges = true;
      }

      (ground.sports || []).forEach((sport) => {
        if (!newPricing[groundId][sport]) {
          newPricing[groundId][sport] = getDefaultPricing();
          hasChanges = true;
        }
      });
    });

    if (hasChanges) {
      setPricing(newPricing);
      onChange?.(newPricing);
    }
  }, [grounds]);

  // Get current ground and its sports
  const currentGround = grounds.find(
    (g) => g.id === selectedGroundId || g.groundId === selectedGroundId
  );
  const currentSports = currentGround?.sports || [];

  // Get current pricing for selected ground/sport
  const currentPricing = pricing[selectedGroundId]?.[selectedSport] || getDefaultPricing();

  // Update pricing handler
  const handlePricingUpdate = useCallback(
    (dayType, data) => {
      const newPricing = {
        ...pricing,
        [selectedGroundId]: {
          ...pricing[selectedGroundId],
          [selectedSport]: {
            ...pricing[selectedGroundId]?.[selectedSport],
            [dayType]: data,
          },
        },
      };

      // If copy weekday to weekend is enabled and we're updating weekday
      if (copyWeekdayToWeekend && dayType === "weekday") {
        newPricing[selectedGroundId][selectedSport].weekend = { ...data };
      }

      setPricing(newPricing);
      onChange?.(newPricing);
    },
    [pricing, selectedGroundId, selectedSport, copyWeekdayToWeekend, onChange]
  );

  // Copy weekday to weekend
  const handleCopyWeekdayToWeekend = useCallback(() => {
    if (!pricing[selectedGroundId]?.[selectedSport]?.weekday) return;

    const newPricing = {
      ...pricing,
      [selectedGroundId]: {
        ...pricing[selectedGroundId],
        [selectedSport]: {
          ...pricing[selectedGroundId][selectedSport],
          weekend: { ...pricing[selectedGroundId][selectedSport].weekday },
        },
      },
    };

    setPricing(newPricing);
    onChange?.(newPricing);
  }, [pricing, selectedGroundId, selectedSport, onChange]);

  // Copy to all sports
  const handleCopyToAllSports = useCallback(() => {
    if (!pricing[selectedGroundId]?.[selectedSport]) return;

    const currentSportPricing = pricing[selectedGroundId][selectedSport];
    const newGroundPricing = { ...pricing[selectedGroundId] };

    currentSports.forEach((sport) => {
      newGroundPricing[sport] = { ...currentSportPricing };
    });

    const newPricing = {
      ...pricing,
      [selectedGroundId]: newGroundPricing,
    };

    setPricing(newPricing);
    onChange?.(newPricing);
  }, [pricing, selectedGroundId, selectedSport, currentSports, onChange]);

  // Validation
  const validatePricing = useCallback(() => {
    const errors = [];

    Object.entries(pricing).forEach(([groundId, groundPricing]) => {
      Object.entries(groundPricing).forEach(([sport, sportPricing]) => {
        ["weekday", "weekend"].forEach((dayType) => {
          const slots = sportPricing[dayType];
          if (!slots) return;

          // Check for gaps
          const times = [
            { start: slots.morning?.start, end: slots.morning?.end },
            { start: slots.afternoon?.start, end: slots.afternoon?.end },
            { start: slots.evening?.start, end: slots.evening?.end },
          ].filter((t) => t.start && t.end);

          // Check rates > 0
          Object.values(slots).forEach((slot) => {
            if (slot.hourlyRate <= 0) {
              errors.push(`${groundId} - ${sport} - ${dayType}: Rate must be greater than 0`);
            }
          });
        });
      });
    });

    return errors;
  }, [pricing]);

  if (grounds.length === 0) {
    return (
      <Surface style={styles.emptyContainer} elevation={1}>
        <MaterialCommunityIcons name="soccer-field" size={48} color="#ccc" />
        <Text variant="bodyLarge" style={styles.emptyText}>
          No grounds added yet
        </Text>
        <Text variant="bodySmall" style={styles.emptySubtext}>
          Add grounds with sports to configure pricing
        </Text>
      </Surface>
    );
  }

  return (
    <View style={styles.container}>
      {/* Ground Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.groundTabs}
        contentContainerStyle={styles.groundTabsContent}
      >
        {grounds.map((ground) => {
          const groundId = ground.id || ground.groundId;
          const isSelected = groundId === selectedGroundId;

          return (
            <TouchableOpacity
              key={groundId}
              style={[styles.groundTab, isSelected && styles.groundTabSelected]}
              onPress={() => setSelectedGroundId(groundId)}
            >
              <MaterialCommunityIcons
                name="soccer-field"
                size={18}
                color={isSelected ? "#fff" : OWNER_COLOR}
              />
              <Text
                variant="bodyMedium"
                style={[
                  styles.groundTabText,
                  isSelected && styles.groundTabTextSelected,
                ]}
              >
                {ground.name || `Ground ${groundId}`}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Sport Chips */}
      {currentSports.length > 0 && (
        <View style={styles.sportChipsContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.sportChipsContent}
          >
            {currentSports.map((sport) => {
              const sportData = getSportById(sport);
              const isSelected = sport === selectedSport;

              return (
                <Chip
                  key={sport}
                  selected={isSelected}
                  onPress={() => setSelectedSport(sport)}
                  style={[
                    styles.sportChip,
                    isSelected && {
                      backgroundColor: getSportColor(sport) + "20",
                    },
                  ]}
                  textStyle={[
                    styles.sportChipText,
                    isSelected && { color: getSportColor(sport) },
                  ]}
                  icon={() => (
                    <MaterialCommunityIcons
                      name={sportData?.icon || "help-circle"}
                      size={18}
                      color={isSelected ? getSportColor(sport) : "#666"}
                    />
                  )}
                >
                  {sportData?.name || sport}
                </Chip>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* No sports message */}
      {currentSports.length === 0 && (
        <Surface style={styles.noSportsContainer} elevation={1}>
          <Text variant="bodyMedium" style={styles.noSportsText}>
            No sports configured for this ground
          </Text>
        </Surface>
      )}

      {/* Pricing Configuration */}
      {selectedSport && (
        <ScrollView
          style={styles.pricingScroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Copy Options */}
          <View style={styles.copyOptions}>
            <TouchableOpacity
              style={styles.copyOptionRow}
              onPress={() => setCopyWeekdayToWeekend(!copyWeekdayToWeekend)}
            >
              <Checkbox
                status={copyWeekdayToWeekend ? "checked" : "unchecked"}
                onPress={() => setCopyWeekdayToWeekend(!copyWeekdayToWeekend)}
                color={OWNER_COLOR}
              />
              <Text variant="bodyMedium">Auto-copy weekday to weekend</Text>
            </TouchableOpacity>

            <Button
              mode="text"
              icon="content-copy"
              onPress={handleCopyToAllSports}
              textColor={OWNER_COLOR}
              compact
            >
              Copy to all sports
            </Button>
          </View>

          {/* Weekday Pricing */}
          <Surface style={styles.pricingSection} elevation={1}>
            <DayTypePricing
              dayType="weekday"
              pricing={currentPricing.weekday}
              onUpdate={(data) => handlePricingUpdate("weekday", data)}
            />
          </Surface>

          {/* Weekend Pricing */}
          <Surface style={styles.pricingSection} elevation={1}>
            <DayTypePricing
              dayType="weekend"
              pricing={currentPricing.weekend}
              onUpdate={(data) => handlePricingUpdate("weekend", data)}
              copyFromWeekday={handleCopyWeekdayToWeekend}
            />
          </Surface>

          {/* Preview Calculator */}
          <PreviewCalculator pricing={currentPricing} />

          <View style={styles.bottomPadding} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyContainer: {
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "#fff",
    margin: 16,
  },
  emptyText: {
    marginTop: 16,
    color: "#666",
  },
  emptySubtext: {
    marginTop: 4,
    color: "#999",
  },
  groundTabs: {
    maxHeight: 50,
  },
  groundTabsContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  groundTab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: OWNER_COLOR,
    marginRight: 8,
    gap: 6,
  },
  groundTabSelected: {
    backgroundColor: OWNER_COLOR,
  },
  groundTabText: {
    color: OWNER_COLOR,
  },
  groundTabTextSelected: {
    color: "#fff",
  },
  sportChipsContainer: {
    paddingVertical: 8,
  },
  sportChipsContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  sportChip: {
    marginRight: 8,
    backgroundColor: "#f5f5f5",
  },
  sportChipText: {
    color: "#666",
  },
  noSportsContainer: {
    padding: 24,
    margin: 16,
    borderRadius: 12,
    backgroundColor: "#fff",
    alignItems: "center",
  },
  noSportsText: {
    color: "#666",
  },
  pricingScroll: {
    flex: 1,
  },
  copyOptions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  copyOptionRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  pricingSection: {
    margin: 16,
    marginTop: 8,
    marginBottom: 8,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#fff",
  },
  dayTypeSection: {},
  dayTypeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  dayTypeTitle: {
    fontWeight: "bold",
    color: "#333",
  },
  dayTypeSubtitle: {
    color: "#666",
  },
  copyButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: OWNER_COLOR + "15",
    borderRadius: 16,
    marginBottom: 12,
    gap: 4,
  },
  copyButtonText: {
    color: OWNER_COLOR,
  },
  timeSlotRow: {
    marginVertical: 8,
  },
  timeSlotHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  timeSlotTitle: {
    fontWeight: "600",
    color: "#333",
  },
  timeSlotContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  timeRangeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  timePickerButton: {
    padding: 8,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    minWidth: 80,
  },
  timePickerLabel: {
    color: "#666",
    fontSize: 10,
    marginBottom: 2,
  },
  timePickerValue: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  timePickerText: {
    fontWeight: "600",
  },
  timeMenu: {
    maxHeight: 300,
  },
  timeMenuScroll: {
    maxHeight: 250,
  },
  selectedTime: {
    backgroundColor: OWNER_COLOR + "20",
  },
  selectedTimeText: {
    color: OWNER_COLOR,
    fontWeight: "bold",
  },
  timeSeparator: {
    color: "#666",
  },
  currencyInputContainer: {
    minWidth: 120,
  },
  currencyLabel: {
    color: "#666",
    fontSize: 10,
    marginBottom: 2,
  },
  currencyInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
  },
  currencySymbol: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginRight: 4,
  },
  currencyInput: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    height: 36,
  },
  currencyInputOutline: {
    borderRadius: 8,
  },
  perHourText: {
    color: "#666",
    marginLeft: 4,
  },
  slotDivider: {
    marginVertical: 8,
  },
  previewCard: {
    margin: 16,
    marginTop: 8,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#fff",
  },
  previewTitle: {
    fontWeight: "bold",
    color: OWNER_COLOR,
    marginBottom: 16,
  },
  previewControls: {
    gap: 12,
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  previewLabel: {
    width: 60,
    color: "#666",
  },
  durationButtons: {
    flexDirection: "row",
    gap: 8,
  },
  durationButton: {
    width: 40,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#f5f5f5",
    alignItems: "center",
    justifyContent: "center",
  },
  durationButtonActive: {
    backgroundColor: OWNER_COLOR,
  },
  durationButtonText: {
    fontWeight: "600",
    color: "#666",
  },
  durationButtonTextActive: {
    color: "#fff",
  },
  segmentedButtons: {
    flex: 1,
  },
  previewResult: {
    marginTop: 16,
    padding: 12,
    backgroundColor: OWNER_COLOR + "10",
    borderRadius: 12,
    alignItems: "center",
  },
  previewResultText: {
    color: "#666",
  },
  previewTotal: {
    fontWeight: "bold",
    color: OWNER_COLOR,
    marginTop: 4,
  },
  bottomPadding: {
    height: 32,
  },
});
