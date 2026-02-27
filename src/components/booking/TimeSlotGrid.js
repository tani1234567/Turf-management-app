import React from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from "react-native";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  SLOT_STATUS,
  SLOT_COLORS,
  SLOT_ICONS,
} from "../../utils/slotColorUtils";

const USER_COLOR = "#4CAF50";

/**
 * TimeSlotGrid — Color-coded time slot grid for BookingScreen Step 2.
 *
 * All slots are tappable regardless of status. Color coding is purely visual
 * to indicate availability. Validation happens when the user clicks "Continue".
 *
 * Props:
 *  - timeSlots: array of { time, hour, minute, label }
 *  - slotStatusMap: { "09:00": { status, selectable, colors, availableCount, totalCount } }
 *  - startTime / endTime: currently selected range
 *  - onSlotPress(slot): called for any slot tap
 *  - loading: boolean — shows shimmer placeholders
 */
export default function TimeSlotGrid({
  timeSlots = [],
  slotStatusMap = {},
  startTime,
  endTime,
  onSlotPress,
  loading = false,
}) {
  if (loading) {
    return (
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          {Array.from({ length: 32 }).map((_, i) => (
            <View key={i} style={[styles.slot, styles.shimmerSlot]} />
          ))}
        </View>
      </ScrollView>
    );
  }

  // Check if slot is in the selected range
  const isSlotInRange = (slot) => {
    if (!startTime) return false;
    if (!endTime) return slot.time === startTime.time;

    const slotIndex = timeSlots.findIndex((s) => s.time === slot.time);
    const startIndex = timeSlots.findIndex((s) => s.time === startTime.time);
    const endIndex = timeSlots.findIndex((s) => s.time === endTime.time);

    return slotIndex >= startIndex && slotIndex < endIndex;
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.grid}>
        {timeSlots.map((slot) => {
          const info = slotStatusMap[slot.time] || {
            status: SLOT_STATUS.AVAILABLE,
            selectable: true,
            colors: SLOT_COLORS[SLOT_STATUS.AVAILABLE],
          };
          const { status, selectable, colors, availableCount, totalCount } = info;

          const isInRange = isSlotInRange(slot);
          const isStart = startTime?.time === slot.time;
          const isEnd = endTime?.time === slot.time;
          const icon = SLOT_ICONS[status];

          // Selected range overrides color
          const isSelected = isInRange || isStart;

          return (
            <TouchableOpacity
              key={slot.time}
              style={[
                styles.slot,
                {
                  backgroundColor: colors.bg,
                  borderColor: colors.border,
                  borderWidth: 1,
                },
                isInRange && !isStart && !isEnd && styles.slotInRange,
                isStart && styles.slotStart,
                isEnd && styles.slotEnd,
              ]}
              onPress={() => onSlotPress?.(slot)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.slotText,
                  { color: colors.text },
                  isSelected && styles.slotTextSelected,
                ]}
                numberOfLines={1}
              >
                {slot.label}
              </Text>

              {/* Status icon */}
              {icon && !isSelected && (
                <MaterialCommunityIcons
                  name={icon}
                  size={10}
                  color={colors.text}
                  style={styles.statusIcon}
                />
              )}

              {/* Availability count badge for High Demand */}
              {status === SLOT_STATUS.HIGH_DEMAND &&
                !isSelected &&
                totalCount > 0 && (
                  <View style={styles.countBadge}>
                    <Text style={styles.countText}>
                      {availableCount}/{totalCount}
                    </Text>
                  </View>
                )}
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  slot: {
    width: "24%",
    margin: "0.5%",
    paddingVertical: 10,
    paddingHorizontal: 2,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  slotInRange: {
    backgroundColor: USER_COLOR + "30",
    borderColor: USER_COLOR,
    borderWidth: 1,
  },
  slotStart: {
    backgroundColor: USER_COLOR,
    borderColor: USER_COLOR,
    borderWidth: 1,
  },
  slotEnd: {
    backgroundColor: USER_COLOR + "80",
    borderColor: USER_COLOR,
    borderWidth: 1,
  },
  slotText: {
    fontSize: 11,
    fontWeight: "500",
  },
  slotTextSelected: {
    color: "#fff",
    fontWeight: "600",
  },
  statusIcon: {
    marginTop: 2,
  },
  countBadge: {
    marginTop: 2,
    backgroundColor: "#FFC107",
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  countText: {
    fontSize: 8,
    fontWeight: "700",
    color: "#fff",
  },
  shimmerSlot: {
    backgroundColor: "#f0f0f0",
    minHeight: 44,
  },
});
