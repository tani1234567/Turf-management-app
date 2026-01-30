import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import {
  Text,
  Surface,
  Button,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../../hooks";

const ROLES = [
  {
    id: "user",
    title: "User",
    description: "Book turfs for your games, view availability, and manage your bookings",
    icon: "account",
    color: "#4CAF50",
    features: ["Browse & book turfs", "View booking history", "Chat with managers"],
  },
  {
    id: "owner",
    title: "Turf Owner",
    description: "Own and manage turf businesses, handle subscriptions, and oversee operations",
    icon: "office-building",
    color: "#9C27B0",
    features: ["Create & manage company", "Add turfs & grounds", "View company analytics"],
  },
  {
    id: "manager",
    title: "Manager",
    description: "Manage turf operations, handle bookings, and coordinate with caretakers",
    icon: "briefcase",
    color: "#2196F3",
    features: ["Manage multiple turfs", "Accept/reject bookings", "View analytics"],
  },
  {
    id: "caretaker",
    title: "Caretaker",
    description: "Handle day-to-day operations, collect payments, and manage on-ground activities",
    icon: "account-hard-hat",
    color: "#FF9800",
    features: ["View daily schedule", "Collect payments", "Mark attendance"],
  },
];

export default function RoleSelectionScreen({ route, navigation }) {
  const theme = useTheme();
  const { user } = useAuth();

  // Get userId and phoneNumber from route params or from auth state
  const userId = route?.params?.userId || user?.userId;
  const phoneNumber = route?.params?.phoneNumber || user?.phone;

  const [selectedRole, setSelectedRole] = useState(null);

  const handleContinue = () => {
    if (!selectedRole) return;

    navigation.navigate("ProfileSetupScreen", {
      userId,
      phoneNumber,
      role: selectedRole,
    });
  };

  const RoleCard = ({ role, isSelected, onSelect }) => (
    <TouchableOpacity
      onPress={() => onSelect(role.id)}
      activeOpacity={0.7}
    >
      <Surface
        style={[
          styles.roleCard,
          isSelected && { borderColor: role.color, borderWidth: 2 },
        ]}
        elevation={isSelected ? 3 : 1}
      >
        <View style={styles.roleHeader}>
          <View
            style={[styles.iconContainer, { backgroundColor: `${role.color}20` }]}
          >
            <MaterialCommunityIcons
              name={role.icon}
              size={32}
              color={role.color}
            />
          </View>
          <View style={styles.roleInfo}>
            <Text variant="titleMedium" style={styles.roleTitle}>
              {role.title}
            </Text>
            <Text variant="bodySmall" style={styles.roleDescription}>
              {role.description}
            </Text>
          </View>
          <View
            style={[
              styles.radioOuter,
              isSelected && { borderColor: role.color },
            ]}
          >
            {isSelected && (
              <View
                style={[styles.radioInner, { backgroundColor: role.color }]}
              />
            )}
          </View>
        </View>

        <View style={styles.featuresContainer}>
          {role.features.map((feature, index) => (
            <View key={index} style={styles.featureItem}>
              <MaterialCommunityIcons
                name="check-circle"
                size={16}
                color={role.color}
              />
              <Text variant="bodySmall" style={styles.featureText}>
                {feature}
              </Text>
            </View>
          ))}
        </View>
      </Surface>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text variant="headlineSmall" style={styles.title}>
            Choose Your Role
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Select how you want to use Turf Booking
          </Text>
        </View>

        {/* Role Cards */}
        <View style={styles.rolesContainer}>
          {ROLES.map((role) => (
            <RoleCard
              key={role.id}
              role={role}
              isSelected={selectedRole === role.id}
              onSelect={setSelectedRole}
            />
          ))}
        </View>

        {/* Note */}
        <View style={styles.noteContainer}>
          <MaterialCommunityIcons
            name="information-outline"
            size={18}
            color="#666"
          />
          <Text variant="bodySmall" style={styles.noteText}>
            Managers & Caretakers need an invite code from a Turf Owner to join.
            Caretakers will be assigned to a turf after joining.
          </Text>
        </View>

        {/* Continue Button */}
        <Button
          mode="contained"
          onPress={handleContinue}
          disabled={!selectedRole}
          style={styles.continueButton}
          contentStyle={styles.buttonContent}
        >
          Continue
        </Button>
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
    padding: 20,
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
    marginTop: 12,
  },
  title: {
    fontWeight: "bold",
    marginBottom: 8,
  },
  subtitle: {
    color: "#666",
    textAlign: "center",
  },
  rolesContainer: {
    gap: 16,
  },
  roleCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "transparent",
  },
  roleHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  roleInfo: {
    flex: 1,
  },
  roleTitle: {
    fontWeight: "bold",
    marginBottom: 4,
  },
  roleDescription: {
    color: "#666",
    lineHeight: 18,
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#ddd",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  featuresContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  featureText: {
    marginLeft: 6,
    color: "#444",
  },
  noteContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#E3F2FD",
    padding: 12,
    borderRadius: 8,
    marginTop: 24,
  },
  noteText: {
    flex: 1,
    marginLeft: 8,
    color: "#666",
    lineHeight: 18,
  },
  continueButton: {
    marginTop: 24,
    borderRadius: 8,
  },
  buttonContent: {
    height: 50,
  },
});
