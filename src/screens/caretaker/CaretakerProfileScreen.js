import React, { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { Text, Surface, Divider } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSelector } from "react-redux";
import { useAuth } from "../../hooks";
import { selectAssignedTurfId } from "../../store/slices/authSlice";
import { getDocument, queryDocuments } from "../../services/firebase/firestore";

const CARETAKER_ORANGE = "#F97316";
const PALE_ORANGE      = "#FFF7ED";
const NAVY_ORANGE      = "#7C2D12";
const SUCCESS_GREEN    = "#22C55E";
const MANAGER_BLUE     = "#3B82F6";
const DANGER_RED       = "#EF4444";

const MENU_ITEMS = [
  { id: "notifications", icon: "bell", label: "Notifications", color: CARETAKER_ORANGE },
  { id: "help", icon: "help-circle", label: "Help & Support", color: "#607D8B" },
];

export default function CaretakerProfileScreen() {
  const { user, logout } = useAuth();
  const assignedTurfId = useSelector(selectAssignedTurfId);

  const [turfName, setTurfName] = useState(null);
  const [totalDays, setTotalDays] = useState(0);
  const [bookingsHandled, setBookingsHandled] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (!assignedTurfId) {
      setStatsLoading(false);
      return;
    }

    const loadProfileData = async () => {
      try {
        // Fetch turf name
        const turf = await getDocument("turfs", assignedTurfId);
        if (turf) setTurfName(turf.name || "Unknown Turf");

        // Fetch all non-cancelled bookings for this turf
        const bookings = await queryDocuments("bookings", [
          { field: "turfId", operator: "==", value: assignedTurfId },
        ]);

        const active = bookings.filter(
          (b) => b.status !== "cancelled" && b.status !== "rejected"
        );

        const uniqueDays = new Set(active.map((b) => b.date).filter(Boolean)).size;
        setTotalDays(uniqueDays);
        setBookingsHandled(active.length);
      } catch (e) {
        console.error("[CaretakerProfile] Failed to load profile data:", e);
      } finally {
        setStatsLoading(false);
      }
    };

    loadProfileData();
  }, [assignedTurfId]);

  const MenuItem = ({ item }) => (
    <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
      <View style={[styles.menuIconContainer, { backgroundColor: `${item.color}18` }]}>
        <MaterialCommunityIcons name={item.icon} size={20} color={item.color} />
      </View>
      <Text style={styles.menuLabel}>{item.label}</Text>
      <MaterialCommunityIcons name="chevron-right" size={18} color="#D1D5DB" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>

        {/* Profile Card with Banner */}
        <Surface style={styles.profileCard} elevation={2}>
          <View style={styles.profileBanner}>
            <View style={styles.avatarContainer}>
              <MaterialCommunityIcons name="account-hard-hat" size={32} color={CARETAKER_ORANGE} />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.userName}>{user?.name || "Caretaker"}</Text>
              <View style={styles.rolePill}>
                <Text style={styles.rolePillText}>Caretaker</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.editProfileBtn}>
              <MaterialCommunityIcons name="pencil-outline" size={18} color={CARETAKER_ORANGE} />
            </TouchableOpacity>
          </View>
          {user?.phone && (
            <View style={styles.profilePhoneRow}>
              <MaterialCommunityIcons name="phone-outline" size={14} color="#9CA3AF" />
              <Text style={styles.profilePhone}>{user.phone}</Text>
            </View>
          )}
        </Surface>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <Surface style={styles.statCard} elevation={2}>
            <View style={[styles.statAccentBar, { backgroundColor: SUCCESS_GREEN }]} />
            <View style={styles.statBody}>
              {statsLoading ? (
                <ActivityIndicator size="small" color={SUCCESS_GREEN} />
              ) : (
                <Text style={[styles.statValue, { color: SUCCESS_GREEN }]}>{totalDays}</Text>
              )}
              <Text style={styles.statLabel}>Total Days</Text>
            </View>
          </Surface>
          <Surface style={styles.statCard} elevation={2}>
            <View style={[styles.statAccentBar, { backgroundColor: MANAGER_BLUE }]} />
            <View style={styles.statBody}>
              {statsLoading ? (
                <ActivityIndicator size="small" color={MANAGER_BLUE} />
              ) : (
                <Text style={[styles.statValue, { color: MANAGER_BLUE }]}>{bookingsHandled}</Text>
              )}
              <Text style={styles.statLabel}>Bookings Handled</Text>
            </View>
          </Surface>
        </View>

        {/* Assigned Turf */}
        <View style={styles.sectionTitleRow}>
          <View style={styles.sectionTitleAccent} />
          <Text style={styles.sectionTitle}>ASSIGNED TURF</Text>
        </View>
        <Surface style={styles.turfCard} elevation={2}>
          <View style={[styles.turfIconContainer, { backgroundColor: PALE_ORANGE }]}>
            <MaterialCommunityIcons name="soccer-field" size={22} color={CARETAKER_ORANGE} />
          </View>
          <View style={styles.turfInfo}>
            {statsLoading ? (
              <ActivityIndicator size="small" color={CARETAKER_ORANGE} />
            ) : turfName ? (
              <>
                <Text style={styles.noTurfText}>{turfName}</Text>
                <Text style={styles.noTurfSubtext}>Active assignment</Text>
              </>
            ) : (
              <>
                <Text style={styles.noTurfText}>No turf assigned yet</Text>
                <Text style={styles.noTurfSubtext}>Contact your manager for assignment</Text>
              </>
            )}
          </View>
        </Surface>

        {/* Menu Items */}
        <View style={styles.sectionTitleRow}>
          <View style={styles.sectionTitleAccent} />
          <Text style={styles.sectionTitle}>ACCOUNT</Text>
        </View>
        <Surface style={styles.menuCard} elevation={2}>
          {MENU_ITEMS.map((item, index) => (
            <React.Fragment key={item.id}>
              <MenuItem item={item} />
              {index < MENU_ITEMS.length - 1 && (
                <Divider style={styles.divider} />
              )}
            </React.Fragment>
          ))}
        </Surface>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={logout} activeOpacity={0.7}>
          <MaterialCommunityIcons name="logout" size={18} color={DANGER_RED} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        {/* Version */}
        <Text style={styles.version}>Version 1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFBEB",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },

  // Profile Card
  profileCard: {
    borderRadius: 16,
    backgroundColor: "#fff",
    marginBottom: 16,
    overflow: "hidden",
  },
  profileBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    paddingBottom: 14,
    backgroundColor: PALE_ORANGE,
    gap: 12,
  },
  avatarContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: CARETAKER_ORANGE + "40",
  },
  profileInfo: {
    flex: 1,
  },
  userName: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 16,
    color: NAVY_ORANGE,
  },
  rolePill: {
    marginTop: 4,
    backgroundColor: CARETAKER_ORANGE + "20",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  rolePillText: {
    fontSize: 11,
    fontFamily: "Ubuntu-Medium",
    color: CARETAKER_ORANGE,
  },
  editProfileBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  profilePhoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  profilePhone: {
    fontSize: 13,
    color: "#6B7280",
    fontFamily: "Ubuntu-Regular",
  },

  // Stats
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  statAccentBar: {
    height: 4,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  statBody: {
    padding: 14,
    alignItems: "center",
  },
  statValue: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 28,
  },
  statLabel: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 11,
    color: "#6B7280",
    marginTop: 4,
    textAlign: "center",
  },

  // Section Headers
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    marginLeft: 2,
    gap: 8,
  },
  sectionTitleAccent: {
    width: 3,
    height: 14,
    borderRadius: 2,
    backgroundColor: CARETAKER_ORANGE,
  },
  sectionTitle: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 11,
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  // Turf Card
  turfCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 14,
    backgroundColor: "#fff",
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: CARETAKER_ORANGE,
    gap: 12,
  },
  turfIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  turfInfo: {
    flex: 1,
  },
  noTurfText: {
    fontFamily: "Ubuntu-Medium",
    fontSize: 14,
    color: "#374151",
  },
  noTurfSubtext: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 2,
  },

  // Menu Card
  menuCard: {
    borderRadius: 14,
    backgroundColor: "#fff",
    marginBottom: 20,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  menuIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  menuLabel: {
    flex: 1,
    fontFamily: "Ubuntu-Medium",
    fontSize: 14,
    color: "#111827",
  },
  divider: {
    marginLeft: 66,
    backgroundColor: "#F3F4F6",
  },

  // Logout
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#FCA5A5",
    backgroundColor: "#FEF2F2",
    marginTop: 4,
    marginBottom: 4,
  },
  logoutText: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 14,
    color: DANGER_RED,
  },

  // Version
  version: {
    textAlign: "center",
    color: "#9CA3AF",
    marginTop: 16,
    marginBottom: 8,
    fontSize: 12,
    fontFamily: "Ubuntu-Regular",
  },
});
