import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  RefreshControl,
} from "react-native";
import {
  Text,
  Surface,
  Button,
  Avatar,
  RadioButton,
  Divider,
  ActivityIndicator,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSelector, useDispatch } from "react-redux";
import { selectUser, selectAssignedTurfIds } from "../../store/slices/authSlice";
import {
  selectCompany,
  removeUnassignedCaretaker,
} from "../../store/slices/companySlice";
import {
  queryDocuments,
  updateDocument,
} from "../../services/firebase/firestore";

const MANAGER_COLOR = "#2196F3";
const CARETAKER_COLOR = "#FF9800";

export default function CaretakerAssignmentScreen({ navigation, route }) {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const company = useSelector(selectCompany);
  const assignedTurfIds = useSelector(selectAssignedTurfIds) || user?.assignedTurfIds || [];
  const companyId = company?.id || company?.companyId || user?.companyId;

  const [selectedCaretaker, setSelectedCaretaker] = useState(
    route.params?.caretakerId || null
  );
  const [selectedTurf, setSelectedTurf] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [caretakersData, setCaretakersData] = useState([]);
  const [turfsData, setTurfsData] = useState([]);

  // Fetch caretakers and turfs from Firestore
  const fetchData = useCallback(
    async ({ showRefresh = false } = {}) => {
      if (!companyId) {
        setFetchingData(false);
        return;
      }

      if (showRefresh) {
        setRefreshing(true);
      } else {
        setFetchingData(true);
      }

      try {
        // Fetch caretakers for this company
        const users = await queryDocuments("users", [
          { field: "companyId", operator: "==", value: companyId },
          { field: "role", operator: "==", value: "caretaker" },
        ]);

        const caretakerDocs = users.map((u) => ({
          ...u,
          id: u.id || u.userId,
        }));
        setCaretakersData(caretakerDocs);

        // Fetch turfs for this company
        const turfs = await queryDocuments("turfs", [
          { field: "companyId", operator: "==", value: companyId },
        ]);

        const turfDocs = turfs.map((t) => ({
          ...t,
          id: t.id || t.turfId,
        }));
        setTurfsData(turfDocs);
      } catch (error) {
        console.error("Error fetching data:", error);
        Alert.alert("Error", "Failed to load data. Please try again.");
      } finally {
        setFetchingData(false);
        setRefreshing(false);
      }
    },
    [companyId]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter unassigned caretakers (not assigned, not suspended)
  const displayCaretakers = caretakersData.filter(
    (c) => !c.isAssigned && !c.isSuspended
  );

  // Filter turfs this manager can assign to
  const displayTurfs = turfsData.filter(
    (turf) =>
      assignedTurfIds.includes(turf.turfId) ||
      assignedTurfIds.includes(turf.id) ||
      user?.role === "owner"
  );

  const handleAssign = async () => {
    if (!selectedCaretaker || !selectedTurf) {
      Alert.alert("Selection Required", "Please select both a caretaker and a turf.");
      return;
    }

    setLoading(true);

    try {
      const caretaker = displayCaretakers.find(
        (c) => c.id === selectedCaretaker || c.userId === selectedCaretaker
      );
      const turf = displayTurfs.find(
        (t) => t.id === selectedTurf || t.turfId === selectedTurf
      );

      // Update caretaker document
      await updateDocument("users", selectedCaretaker, {
        assignedTurfId: selectedTurf,
        isAssigned: true,
        assignedAt: new Date(),
        assignedBy: user?.userId,
      });

      // Update turf document - add caretaker
      const currentCaretakerIds = turf?.caretakerIds || [];
      await updateDocument("turfs", selectedTurf, {
        caretakerIds: [...currentCaretakerIds, selectedCaretaker],
      });

      // Update company document - move from unassigned to assigned
      // This would be handled by the Redux slice
      dispatch(removeUnassignedCaretaker(selectedCaretaker));

      Alert.alert(
        "Success!",
        `${caretaker?.name || "Caretaker"} has been assigned to ${
          turf?.name || "the turf"
        }.`,
        [
          {
            text: "OK",
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error("Error assigning caretaker:", error);
      Alert.alert("Error", "Failed to assign caretaker. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const CaretakerItem = ({ caretaker }) => {
    const isSelected =
      selectedCaretaker === caretaker.id || selectedCaretaker === caretaker.userId;

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => setSelectedCaretaker(caretaker.id || caretaker.userId)}
      >
        <Surface
          style={[styles.itemCard, isSelected && styles.itemCardSelected]}
          elevation={1}
        >
          <RadioButton
            value={caretaker.id || caretaker.userId}
            status={isSelected ? "checked" : "unchecked"}
            onPress={() => setSelectedCaretaker(caretaker.id || caretaker.userId)}
            color={CARETAKER_COLOR}
          />
          <Avatar.Text
            size={40}
            label={caretaker.name?.substring(0, 2).toUpperCase() || "?"}
            style={{ backgroundColor: CARETAKER_COLOR }}
          />
          <View style={styles.itemInfo}>
            <Text variant="titleSmall" style={styles.itemName}>
              {caretaker.name}
            </Text>
            <Text variant="bodySmall" style={styles.itemSubtext}>
              {caretaker.phone}
            </Text>
          </View>
          <View style={styles.waitingBadge}>
            <MaterialCommunityIcons name="clock-outline" size={14} color="#FF9800" />
            <Text variant="bodySmall" style={styles.waitingText}>
              Waiting
            </Text>
          </View>
        </Surface>
      </TouchableOpacity>
    );
  };

  const TurfItem = ({ turf }) => {
    const isSelected = selectedTurf === turf.id || selectedTurf === turf.turfId;

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => setSelectedTurf(turf.id || turf.turfId)}
      >
        <Surface
          style={[styles.itemCard, isSelected && styles.itemCardSelected]}
          elevation={1}
        >
          <RadioButton
            value={turf.id || turf.turfId}
            status={isSelected ? "checked" : "unchecked"}
            onPress={() => setSelectedTurf(turf.id || turf.turfId)}
            color={MANAGER_COLOR}
          />
          <View style={styles.turfIconContainer}>
            <MaterialCommunityIcons name="soccer-field" size={24} color={MANAGER_COLOR} />
          </View>
          <View style={styles.itemInfo}>
            <Text variant="titleSmall" style={styles.itemName}>
              {turf.name}
            </Text>
            <Text variant="bodySmall" style={styles.itemSubtext}>
              {turf.location?.city || "Location not set"}
            </Text>
          </View>
        </Surface>
      </TouchableOpacity>
    );
  };

  const EmptyCaretakers = () => (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons name="account-check" size={48} color="#4CAF50" />
      <Text variant="titleMedium" style={styles.emptyTitle}>
        No Unassigned Caretakers
      </Text>
      <Text variant="bodyMedium" style={styles.emptyText}>
        All caretakers have been assigned to turfs.
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="#000" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text variant="headlineSmall" style={styles.title}>
            Assign Caretaker
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Select a caretaker and a turf to assign
          </Text>
        </View>
      </View>

      {fetchingData ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={MANAGER_COLOR} />
          <Text variant="bodyMedium" style={styles.loadingText}>
            Loading caretakers...
          </Text>
        </View>
      ) : displayCaretakers.length === 0 ? (
        <EmptyCaretakers />
      ) : (
        <ScrollView
          style={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchData({ showRefresh: true })}
              colors={[MANAGER_COLOR]}
              tintColor={MANAGER_COLOR}
            />
          }
        >
          {/* Step 1: Select Caretaker */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepNumber}>1</Text>
              </View>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Select Caretaker
              </Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            >
              {displayCaretakers.map((caretaker, index) => (
                <CaretakerItem key={caretaker.id || caretaker.userId || `caretaker-${index}`} caretaker={caretaker} />
              ))}
            </ScrollView>
          </View>

          <Divider style={styles.divider} />

          {/* Step 2: Select Turf */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.stepBadge, !selectedCaretaker && styles.stepBadgeDisabled]}>
                <Text style={styles.stepNumber}>2</Text>
              </View>
              <Text
                variant="titleMedium"
                style={[
                  styles.sectionTitle,
                  !selectedCaretaker && styles.sectionTitleDisabled,
                ]}
              >
                Select Turf
              </Text>
            </View>
            {selectedCaretaker ? (
              <View style={styles.turfList}>
                {displayTurfs.map((turf) => (
                  <TurfItem key={turf.id || turf.turfId} turf={turf} />
                ))}
              </View>
            ) : (
              <View style={styles.disabledSection}>
                <Text variant="bodyMedium" style={styles.disabledText}>
                  Select a caretaker first
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* Assign Button */}
      {displayCaretakers.length > 0 && (
        <View style={styles.footer}>
          <Button
            mode="contained"
            onPress={handleAssign}
            loading={loading}
            disabled={loading || !selectedCaretaker || !selectedTurf}
            style={styles.assignButton}
            contentStyle={styles.buttonContent}
            buttonColor={MANAGER_COLOR}
          >
            {loading ? "Assigning..." : "Assign Caretaker"}
          </Button>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  scrollContent: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontWeight: "bold",
  },
  subtitle: {
    color: "#666",
    marginTop: 2,
  },
  section: {
    paddingVertical: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: MANAGER_COLOR,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  stepBadgeDisabled: {
    backgroundColor: "#E0E0E0",
  },
  stepNumber: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
  },
  sectionTitle: {
    fontWeight: "bold",
  },
  sectionTitleDisabled: {
    color: "#999",
  },
  horizontalList: {
    paddingHorizontal: 16,
  },
  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#fff",
    marginRight: 12,
    minWidth: 220,
    borderWidth: 2,
    borderColor: "transparent",
  },
  itemCardSelected: {
    borderColor: MANAGER_COLOR,
    backgroundColor: "#E3F2FD",
  },
  itemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  itemName: {
    fontWeight: "600",
  },
  itemSubtext: {
    color: "#666",
    marginTop: 2,
  },
  waitingBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF3E0",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  waitingText: {
    color: "#FF9800",
    marginLeft: 4,
    fontSize: 11,
  },
  turfIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E3F2FD",
    justifyContent: "center",
    alignItems: "center",
  },
  turfList: {
    paddingHorizontal: 16,
  },
  divider: {
    marginVertical: 8,
  },
  disabledSection: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    alignItems: "center",
  },
  disabledText: {
    color: "#999",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    color: "#666",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  emptyTitle: {
    fontWeight: "bold",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    color: "#666",
    textAlign: "center",
  },
  footer: {
    padding: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  assignButton: {
    borderRadius: 8,
  },
  buttonContent: {
    height: 50,
  },
});
