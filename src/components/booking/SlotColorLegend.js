import React from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { Text } from "react-native-paper";

/**
 * SlotColorLegend — Horizontal scrollable legend strip
 * showing colored dots + labels for each active slot status.
 *
 * Props:
 *  - items: array of { status, label, color } from getActiveLegendItems()
 */
export default function SlotColorLegend({ items = [] }) {
  if (items.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {items.map((item) => (
        <View key={item.status} style={styles.item}>
          <View style={[styles.dot, { backgroundColor: item.color }]} />
          <Text style={styles.label}>{item.label}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    maxHeight: 32,
    marginTop: 8,
  },
  content: {
    alignItems: "center",
    paddingHorizontal: 4,
    gap: 12,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 4,
  },
  label: {
    fontSize: 11,
    color: "#666",
  },
});
