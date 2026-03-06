import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Text,
} from "react-native";
import { Surface } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../../hooks";

const BRAND_GREEN = "#16A34A";
const BRAND_DARK = "#14532D";
const GRAY_TEXT = "#6B7280";
const DARK_TEXT = "#111827";

const ROLES = [
  {
    id: "user",
    title: "User",
    description: "Book turfs for your games, view availability, and manage your bookings",
    icon: "account",
    color: "#4CAF50",
    features: ["Browse & book turfs", "View booking history"],
  },
  {
    id: "owner",
    title: "Turf Owner",
    description: "Own and manage turf businesses, handle subscriptions, and oversee operations",
    icon: "office-building",
    color: "#9C27B0",
    features: ["Create & manage company", "View company analytics"],
  },
  {
    id: "manager",
    title: "Manager",
    description: "Manage turf operations, handle bookings, and coordinate with caretakers",
    icon: "briefcase",
    color: "#3B82F6",
    features: ["Manage multiple turfs", "Accept/reject bookings"],
  },
  {
    id: "caretaker",
    title: "Caretaker",
    description: "Handle day-to-day operations, collect payments, and manage on-ground activities",
    icon: "account-hard-hat",
    color: "#F97316",
    features: ["View daily schedule", "Collect payments"],
  },
];

export default function RoleSelectionScreen({ route, navigation }) {
  const { user } = useAuth();
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
    <TouchableOpacity onPress={() => onSelect(role.id)} activeOpacity={0.7}>
      <Surface
        style={[
          styles.roleCard,
          { borderLeftColor: isSelected ? role.color : "#F3F4F6" },
        ]}
        elevation={isSelected ? 3 : 1}
      >
        <View style={styles.cardRow}>
          {/* Left icon */}
          <View style={[styles.iconCircle, { backgroundColor: role.color + "18" }]}>
            <MaterialCommunityIcons name={role.icon} size={22} color={role.color} />
          </View>

          {/* Middle content */}
          <View style={styles.cardMiddle}>
            <Text style={styles.roleTitle}>{role.title}</Text>
            <Text style={styles.roleDesc}>{role.description}</Text>
            {role.features.map((feature, i) => (
              <View key={i} style={styles.featureRow}>
                <MaterialCommunityIcons name="check" size={12} color={role.color} />
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </View>

          {/* Right radio */}
          <View
            style={[
              styles.radioOuter,
              { borderColor: isSelected ? role.color : "#D1D5DB" },
            ]}
          >
            {isSelected && (
              <View style={[styles.radioInner, { backgroundColor: role.color }]} />
            )}
          </View>
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
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.navigate("LoginScreen")}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="arrow-left" size={18} color={BRAND_DARK} />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Choose Your Role</Text>
          <Text style={styles.subtitle}>Select how you want to use the app</Text>
        </View>

        {/* Role Cards */}
        <View style={styles.cardsContainer}>
          {ROLES.map((role) => (
            <RoleCard
              key={role.id}
              role={role}
              isSelected={selectedRole === role.id}
              onSelect={setSelectedRole}
            />
          ))}
        </View>

        {/* Info pill */}
        <View style={styles.infoPillWrapper}>
          <View style={styles.infoPill}>
            <MaterialCommunityIcons name="lock-outline" size={14} color="#F97316" />
            <Text style={styles.infoPillText}>
              Managers & Caretakers need an invite code
            </Text>
          </View>
        </View>

        {/* Continue Button */}
        <TouchableOpacity
          style={[styles.continueButton, !selectedRole && styles.continueButtonDisabled]}
          onPress={handleContinue}
          disabled={!selectedRole}
          activeOpacity={0.85}
        >
          <Text style={styles.continueButtonText}>Continue</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7FFF9",
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    paddingBottom: 0,
    marginBottom: 20,
    marginTop: 8,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    marginBottom: 16,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  backButtonText: {
    fontFamily: "Ubuntu-Medium",
    fontSize: 14,
    color: BRAND_DARK,
  },
  title: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 24,
    color: BRAND_DARK,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 14,
    color: GRAY_TEXT,
  },
  cardsContainer: {
    gap: 12,
  },
  roleCard: {
    borderRadius: 14,
    backgroundColor: "#fff",
    borderLeftWidth: 4,
    marginBottom: 0,
    overflow: "hidden",
  },
  cardRow: {
    flexDirection: "row",
    padding: 16,
    alignItems: "center",
    gap: 12,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  cardMiddle: {
    flex: 1,
  },
  roleTitle: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 15,
    color: DARK_TEXT,
    marginBottom: 2,
  },
  roleDesc: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 12,
    color: GRAY_TEXT,
    lineHeight: 16,
    marginBottom: 6,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 3,
  },
  featureText: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 11,
    color: GRAY_TEXT,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  infoPillWrapper: {
    alignItems: "center",
    marginVertical: 16,
  },
  infoPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFF7ED",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignSelf: "center",
  },
  infoPillText: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 12,
    color: "#92400E",
  },
  continueButton: {
    backgroundColor: BRAND_GREEN,
    borderRadius: 12,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  continueButtonDisabled: {
    opacity: 0.5,
  },
  continueButtonText: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 15,
    color: "#fff",
  },
});
