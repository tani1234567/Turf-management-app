import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  RefreshControl,
  ScrollView,
  Alert,
} from "react-native";
import { Text, Surface, Button, Avatar } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSelector, useDispatch } from "react-redux";
import { selectUser, logout, updateUserProfile } from "../../store/slices/authSlice";
import { selectCompany } from "../../store/slices/companySlice";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../services/firebase/config";

const CARETAKER_ORANGE = "#F97316";
const PALE_ORANGE      = "#FFF7ED";
const NAVY_ORANGE      = "#7C2D12";
const SUCCESS_GREEN    = "#22C55E";
const DANGER_RED       = "#EF4444";

export default function WaitingForAssignmentScreen() {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const company = useSelector(selectCompany);

  const [refreshing, setRefreshing] = useState(false);

  // Real-time listener for assignment status
  useEffect(() => {
    if (!user?.uid) return;

    const userDocRef = doc(db, "users", user.uid);
    const unsubscribe = onSnapshot(
      userDocRef,
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const userData = docSnapshot.data();

          if (userData.isAssigned !== user.isAssigned) {
            dispatch(updateUserProfile({
              isAssigned: userData.isAssigned,
              assignedTurfId: userData.assignedTurfId,
              assignedCompanyId: userData.assignedCompanyId,
            }));

            if (userData.isAssigned) {
              Alert.alert(
                "Assignment Complete!",
                "You have been assigned to a turf. Your dashboard is now ready.",
                [{ text: "OK" }]
              );
            }
          }
        }
      },
      (error) => {
        console.error("Error listening to user document:", error);
      }
    );

    return () => unsubscribe();
  }, [user?.uid, user?.isAssigned, dispatch]);

  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: () => {
          dispatch(logout());
        },
      },
    ]);
  };

  const handleContactSupport = () => {
    Alert.alert(
      "Contact Support",
      "Please contact your manager or the turf owner to get assigned to a turf.",
      [{ text: "OK" }]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[CARETAKER_ORANGE]}
          />
        }
      >
        {/* Profile Header */}
        <View style={styles.header}>
          <Avatar.Text
            size={80}
            label={user?.name?.substring(0, 2).toUpperCase() || "CT"}
            style={{ backgroundColor: CARETAKER_ORANGE }}
          />
          <Text style={styles.name}>{user?.name || "Caretaker"}</Text>
          <Text style={styles.phone}>{user?.phone || "+91 98765 43210"}</Text>
        </View>

        {/* Company Info */}
        {company && (
          <Surface style={styles.companyCard} elevation={2}>
            <MaterialCommunityIcons
              name="office-building"
              size={32}
              color="#9C27B0"
            />
            <View style={styles.companyInfo}>
              <Text style={styles.companyName}>
                {company.name || "Company Name"}
              </Text>
              <Text style={styles.companySubtext}>
                You've joined this company
              </Text>
            </View>
            <MaterialCommunityIcons
              name="check-circle"
              size={24}
              color={SUCCESS_GREEN}
            />
          </Surface>
        )}

        {/* Waiting State */}
        <Surface style={styles.waitingCard} elevation={2}>
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons
              name="clock-outline"
              size={64}
              color={CARETAKER_ORANGE}
            />
          </View>
          <Text style={styles.waitingTitle}>
            Waiting for Assignment
          </Text>
          <Text style={styles.waitingText}>
            You have successfully joined the company. A manager or owner will
            assign you to a specific turf soon.
          </Text>

          <View style={styles.stepsList}>
            <View style={styles.stepItem}>
              <View style={[styles.stepDot, styles.stepCompleted]}>
                <MaterialCommunityIcons name="check" size={14} color="#fff" />
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Account Created</Text>
                <Text style={styles.stepSubtitle}>Your profile is set up</Text>
              </View>
            </View>

            <View style={styles.stepLine} />

            <View style={styles.stepItem}>
              <View style={[styles.stepDot, styles.stepCompleted]}>
                <MaterialCommunityIcons name="check" size={14} color="#fff" />
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Joined Company</Text>
                <Text style={styles.stepSubtitle}>
                  Connected to {company?.name || "the company"}
                </Text>
              </View>
            </View>

            <View style={styles.stepLine} />

            <View style={styles.stepItem}>
              <View style={[styles.stepDot, styles.stepPending]}>
                <MaterialCommunityIcons
                  name="clock-outline"
                  size={14}
                  color={CARETAKER_ORANGE}
                />
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Turf Assignment</Text>
                <Text style={styles.stepSubtitle}>
                  Waiting for manager to assign
                </Text>
              </View>
            </View>
          </View>
        </Surface>

        {/* Info Card */}
        <Surface style={styles.infoCard} elevation={1}>
          <MaterialCommunityIcons
            name="information-outline"
            size={24}
            color="#2196F3"
          />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>What happens next?</Text>
            <Text style={styles.infoText}>Once assigned, you'll be able to:</Text>
            <View style={styles.featureList}>
              <Text style={styles.featureItem}>• View today's bookings</Text>
              <Text style={styles.featureItem}>• Check the weekly schedule</Text>
              <Text style={styles.featureItem}>• Mark attendance for customers</Text>
              <Text style={styles.featureItem}>• Report maintenance issues</Text>
            </View>
          </View>
        </Surface>

        {/* Pull to refresh hint */}
        <View style={styles.refreshHint}>
          <MaterialCommunityIcons name="gesture-swipe-down" size={20} color="#9CA3AF" />
          <Text style={styles.refreshHintText}>Pull down to check for updates</Text>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            mode="outlined"
            icon="help-circle-outline"
            onPress={handleContactSupport}
            style={styles.actionButton}
            textColor={CARETAKER_ORANGE}
            labelStyle={{ fontFamily: "Ubuntu-Medium" }}
          >
            Need Help?
          </Button>
          <Button
            mode="text"
            icon="logout"
            onPress={handleLogout}
            textColor={DANGER_RED}
            labelStyle={{ fontFamily: "Ubuntu-Medium" }}
          >
            Logout
          </Button>
        </View>
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
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: "center",
    marginBottom: 20,
  },
  name: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 20,
    color: NAVY_ORANGE,
    marginTop: 12,
  },
  phone: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 14,
    color: "#6B7280",
    marginTop: 4,
  },
  companyCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#fff",
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: CARETAKER_ORANGE,
    gap: 12,
  },
  companyInfo: {
    flex: 1,
  },
  companyName: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 15,
    color: "#111827",
  },
  companySubtext: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  waitingCard: {
    padding: 24,
    borderRadius: 20,
    backgroundColor: "#fff",
    alignItems: "center",
    marginBottom: 16,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: PALE_ORANGE,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  waitingTitle: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 18,
    color: NAVY_ORANGE,
    marginBottom: 8,
    textAlign: "center",
  },
  waitingText: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  stepsList: {
    width: "100%",
    paddingHorizontal: 16,
  },
  stepItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  stepCompleted: {
    backgroundColor: SUCCESS_GREEN,
  },
  stepPending: {
    backgroundColor: PALE_ORANGE,
    borderWidth: 2,
    borderColor: CARETAKER_ORANGE,
  },
  stepContent: {
    marginLeft: 12,
    flex: 1,
  },
  stepTitle: {
    fontFamily: "Ubuntu-Medium",
    fontSize: 14,
    color: "#111827",
  },
  stepSubtitle: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  stepLine: {
    width: 2,
    height: 20,
    backgroundColor: "#E5E7EB",
    marginLeft: 13,
    marginVertical: 4,
  },
  infoCard: {
    flexDirection: "row",
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#E3F2FD",
    marginBottom: 16,
    gap: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 14,
    color: "#1565C0",
    marginBottom: 4,
  },
  infoText: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 13,
    color: "#374151",
  },
  featureList: {
    marginTop: 8,
  },
  featureItem: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 13,
    color: "#374151",
    marginTop: 4,
  },
  refreshHint: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    gap: 6,
  },
  refreshHintText: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 12,
    color: "#9CA3AF",
  },
  actions: {
    alignItems: "center",
  },
  actionButton: {
    marginBottom: 8,
    borderRadius: 8,
    borderColor: CARETAKER_ORANGE,
  },
});
