import React from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { Text, Surface, Chip, IconButton } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";

const ADMIN_COLOR = "#F44336";

const PRIORITY_COLORS = {
  P0: { bg: "#FFEBEE", text: "#C62828" },
  P1: { bg: "#FFF3E0", text: "#E65100" },
  P2: { bg: "#E3F2FD", text: "#1565C0" },
  P3: { bg: "#F3E5F5", text: "#6A1B9A" },
};

/**
 * Shared scaffold/placeholder component for admin screens.
 * Used during scaffolding phase — each screen will replace this with real UI.
 *
 * @param {string} title - Screen title
 * @param {string} section - Which section this belongs to (e.g., "Company Management")
 * @param {string} priority - P0/P1/P2/P3
 * @param {string} icon - MaterialCommunityIcons name
 * @param {string[]} features - List of planned features
 * @param {object} navigation - React Navigation prop (optional)
 * @param {boolean} showBack - Show back button (default true for stack screens)
 */
export default function AdminScaffold({
  title,
  section,
  priority = "P0",
  icon = "shield-account",
  features = [],
  navigation,
  showBack = true,
}) {
  const priorityStyle = PRIORITY_COLORS[priority] || PRIORITY_COLORS.P0;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          {showBack && navigation && (
            <IconButton
              icon="arrow-left"
              size={24}
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            />
          )}
          <View style={styles.headerText}>
            <Text variant="headlineSmall" style={styles.title}>
              {title}
            </Text>
            <View style={styles.badges}>
              <Chip
                mode="flat"
                style={[styles.sectionChip]}
                textStyle={styles.sectionChipText}
                compact
              >
                {section}
              </Chip>
              <Chip
                mode="flat"
                style={[
                  styles.priorityChip,
                  { backgroundColor: priorityStyle.bg },
                ]}
                textStyle={[
                  styles.priorityChipText,
                  { color: priorityStyle.text },
                ]}
                compact
              >
                {priority}
              </Chip>
            </View>
          </View>
        </View>

        {/* Icon */}
        <Surface style={styles.iconCard} elevation={1}>
          <MaterialCommunityIcons name={icon} size={64} color={ADMIN_COLOR} />
          <Text variant="titleMedium" style={styles.scaffoldLabel}>
            Under Construction
          </Text>
          <Text variant="bodySmall" style={styles.scaffoldSublabel}>
            This screen is scaffolded and ready for implementation
          </Text>
        </Surface>

        {/* Planned Features */}
        {features.length > 0 && (
          <Surface style={styles.featuresCard} elevation={1}>
            <Text variant="titleSmall" style={styles.featuresTitle}>
              Planned Features
            </Text>
            {features.map((feature, index) => (
              <View key={index} style={styles.featureRow}>
                <MaterialCommunityIcons
                  name="checkbox-blank-outline"
                  size={18}
                  color="#999"
                />
                <Text variant="bodyMedium" style={styles.featureText}>
                  {feature}
                </Text>
              </View>
            ))}
          </Surface>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  backButton: {
    marginRight: 4,
    marginLeft: -8,
    marginTop: -4,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontWeight: "bold",
    color: "#333",
  },
  badges: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },
  sectionChip: {
    backgroundColor: "#FFEBEE",
  },
  sectionChipText: {
    color: ADMIN_COLOR,
    fontSize: 11,
    fontWeight: "600",
  },
  priorityChip: {},
  priorityChipText: {
    fontSize: 11,
    fontWeight: "bold",
  },
  iconCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    marginBottom: 16,
  },
  scaffoldLabel: {
    marginTop: 16,
    fontWeight: "600",
    color: "#333",
  },
  scaffoldSublabel: {
    marginTop: 4,
    color: "#999",
    textAlign: "center",
  },
  featuresCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
  },
  featuresTitle: {
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    gap: 10,
  },
  featureText: {
    color: "#555",
    flex: 1,
  },
});
