import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
} from "react-native";
import {
  Text,
  Surface,
  Switch,
  Button,
  RadioButton,
  Checkbox,
  Divider,
  ActivityIndicator,
  IconButton,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSelector, useDispatch } from "react-redux";

import { selectUser, updateUserProfile } from "../../store/slices/authSlice";
import { selectCompany } from "../../store/slices/companySlice";
import { updateDocument, queryDocuments } from "../../services/firebase/firestore";

const OWNER_COLOR = "#9C27B0";

// Permission comparison data
const PERMISSIONS_TABLE = [
  {
    feature: "View Company Analytics",
    withoutPermissions: { text: "Full", enabled: true },
    withPermissions: { text: "Full", enabled: true },
  },
  {
    feature: "View Booking Details",
    withoutPermissions: { text: "Aggregated only", enabled: false },
    withPermissions: { text: "Full access", enabled: true },
  },
  {
    feature: "Approve/Reject Bookings",
    withoutPermissions: { text: "No", enabled: false },
    withPermissions: { text: "Yes", enabled: true },
  },
  {
    feature: "Respond to Chats",
    withoutPermissions: { text: "No", enabled: false },
    withPermissions: { text: "Yes", enabled: true },
  },
  {
    feature: "Create Academies",
    withoutPermissions: { text: "No", enabled: false },
    withPermissions: { text: "Yes", enabled: true },
  },
  {
    feature: "Block Slots",
    withoutPermissions: { text: "No", enabled: false },
    withPermissions: { text: "Yes", enabled: true },
  },
  {
    feature: "Assign Caretakers",
    withoutPermissions: { text: "No", enabled: false },
    withPermissions: { text: "Yes", enabled: true },
  },
  {
    feature: "Track Expenses",
    withoutPermissions: { text: "View only", enabled: false },
    withPermissions: { text: "Add/Edit", enabled: true },
  },
  {
    feature: "Manage Managers",
    withoutPermissions: { text: "Always", enabled: true },
    withPermissions: { text: "Always", enabled: true },
  },
  {
    feature: "Manage Subscription",
    withoutPermissions: { text: "Always", enabled: true },
    withPermissions: { text: "Always", enabled: true },
  },
];

export default function OperationalSettingsScreen({ navigation }) {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const company = useSelector(selectCompany);
  const companyId = company?.id || company?.companyId || user?.companyId;

  // State
  const [turfs, setTurfs] = useState([]);
  const [loadingTurfs, setLoadingTurfs] = useState(true);
  const [operationalPermissions, setOperationalPermissions] = useState(
    user?.hasOperationalPermissions || false
  );
  const [turfSelection, setTurfSelection] = useState(
    user?.managedTurfIds?.length > 0 ? "specific" : "all"
  );
  const [selectedTurfIds, setSelectedTurfIds] = useState(
    user?.managedTurfIds || []
  );
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch turfs from Firestore
  const fetchTurfs = useCallback(async () => {
    if (!companyId) return;

    setLoadingTurfs(true);
    try {
      const turfsData = await queryDocuments("turfs", [
        { field: "companyId", operator: "==", value: companyId },
      ]);

      const turfDocs = turfsData.map((t) => ({
        ...t,
        id: t.id || t.turfId,
      }));
      setTurfs(turfDocs);
    } catch (error) {
      console.error("Error fetching turfs:", error);
    } finally {
      setLoadingTurfs(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchTurfs();
  }, [fetchTurfs]);

  // Track changes
  useEffect(() => {
    const originalEnabled = user?.hasOperationalPermissions || false;
    const originalSelection = user?.managedTurfIds?.length > 0 ? "specific" : "all";
    const originalTurfIds = user?.managedTurfIds || [];

    const changed =
      operationalPermissions !== originalEnabled ||
      turfSelection !== originalSelection ||
      JSON.stringify(selectedTurfIds.sort()) !== JSON.stringify(originalTurfIds.sort());

    setHasChanges(changed);
  }, [operationalPermissions, turfSelection, selectedTurfIds, user]);

  // Toggle turf selection
  const toggleTurfSelection = (turfId) => {
    setSelectedTurfIds((prev) => {
      if (prev.includes(turfId)) {
        return prev.filter((id) => id !== turfId);
      } else {
        return [...prev, turfId];
      }
    });
  };

  // Save settings
  const handleSave = async () => {
    // Validation
    if (operationalPermissions && turfSelection === "specific" && selectedTurfIds.length === 0) {
      Alert.alert(
        "Validation Error",
        "Please select at least one turf to manage, or choose 'All turfs'."
      );
      return;
    }

    setSaving(true);

    try {
      const userId = user?.userId || user?.id;
      const managedTurfIds = turfSelection === "all" ? [] : selectedTurfIds;

      // Update Firestore
      await updateDocument("users", userId, {
        hasOperationalPermissions: operationalPermissions,
        managedTurfIds: operationalPermissions ? managedTurfIds : [],
      });

      // Update Redux
      dispatch(
        updateUserProfile({
          hasOperationalPermissions: operationalPermissions,
          managedTurfIds: operationalPermissions ? managedTurfIds : [],
        })
      );

      setHasChanges(false);
      Alert.alert("Success", "Settings saved successfully.");
    } catch (error) {
      console.error("Error saving settings:", error);
      Alert.alert("Error", "Failed to save settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Permission status icon
  const PermissionIcon = ({ enabled }) => (
    <MaterialCommunityIcons
      name={enabled ? "check-circle" : "close-circle"}
      size={18}
      color={enabled ? "#4CAF50" : "#F44336"}
    />
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton
          icon="arrow-left"
          size={24}
          onPress={() => navigation.goBack()}
        />
        <View style={styles.headerTitleContainer}>
          <Text variant="headlineSmall" style={styles.title}>
            Operational Permissions
          </Text>
          <Text variant="bodySmall" style={styles.subtitle}>
            Control your involvement in day-to-day operations
          </Text>
        </View>
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Main Toggle */}
        <Surface style={styles.section} elevation={1}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text variant="titleMedium" style={styles.toggleTitle}>
                Enable Operational Permissions
              </Text>
            </View>
            <Switch
              value={operationalPermissions}
              onValueChange={setOperationalPermissions}
              color={OWNER_COLOR}
            />
          </View>

          <View style={styles.permissionsDescription}>
            <Text variant="bodyMedium" style={styles.descriptionHeader}>
              When enabled, you can:
            </Text>
            <View style={styles.permissionsList}>
              {[
                "Approve and reject booking requests",
                "Respond to customer chats",
                "Create and manage academies",
                "Block time slots",
                "Assign caretakers to turfs",
                "Track expenses (add/edit)",
              ].map((item, index) => (
                <View key={index} style={styles.permissionItem}>
                  <MaterialCommunityIcons
                    name="check"
                    size={16}
                    color={operationalPermissions ? OWNER_COLOR : "#999"}
                  />
                  <Text
                    variant="bodySmall"
                    style={[
                      styles.permissionText,
                      !operationalPermissions && styles.permissionTextDisabled,
                    ]}
                  >
                    {item}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </Surface>

        {/* Turf Selection (shown only when toggle is ON) */}
        {operationalPermissions && (
          <Surface style={styles.section} elevation={1}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Select turfs to manage
            </Text>

            <RadioButton.Group
              onValueChange={setTurfSelection}
              value={turfSelection}
            >
              <TouchableOpacity
                style={styles.radioOption}
                onPress={() => setTurfSelection("all")}
              >
                <RadioButton value="all" color={OWNER_COLOR} />
                <View style={styles.radioContent}>
                  <Text variant="bodyMedium" style={styles.radioLabel}>
                    All turfs
                  </Text>
                  <View style={styles.recommendedBadge}>
                    <Text style={styles.recommendedText}>Recommended</Text>
                  </View>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.radioOption}
                onPress={() => setTurfSelection("specific")}
              >
                <RadioButton value="specific" color={OWNER_COLOR} />
                <Text variant="bodyMedium" style={styles.radioLabel}>
                  Specific turfs only
                </Text>
              </TouchableOpacity>
            </RadioButton.Group>

            {/* Turf Checkboxes */}
            {turfSelection === "specific" && (
              <View style={styles.turfListContainer}>
                {loadingTurfs ? (
                  <View style={styles.noTurfsContainer}>
                    <ActivityIndicator animating color={OWNER_COLOR} />
                    <Text variant="bodyMedium" style={styles.noTurfsText}>
                      Loading turfs...
                    </Text>
                  </View>
                ) : turfs.length === 0 ? (
                  <View style={styles.noTurfsContainer}>
                    <MaterialCommunityIcons
                      name="soccer-field"
                      size={40}
                      color="#ccc"
                    />
                    <Text variant="bodyMedium" style={styles.noTurfsText}>
                      No turfs found. Add turfs first.
                    </Text>
                  </View>
                ) : (
                  <>
                    <Divider style={styles.turfDivider} />
                    {turfs.map((turf) => {
                      const turfId = turf.turfId || turf.id;
                      const isSelected = selectedTurfIds.includes(turfId);

                      return (
                        <TouchableOpacity
                          key={turfId}
                          style={styles.turfCheckboxItem}
                          onPress={() => toggleTurfSelection(turfId)}
                        >
                          <Checkbox
                            status={isSelected ? "checked" : "unchecked"}
                            color={OWNER_COLOR}
                          />
                          <View style={styles.turfCheckboxInfo}>
                            <Text variant="bodyMedium">{turf.name}</Text>
                            {turf.location && (
                              <Text variant="bodySmall" style={styles.turfLocation}>
                                {turf.location.city || turf.location.address || ""}
                              </Text>
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}

                    {selectedTurfIds.length === 0 && (
                      <View style={styles.validationError}>
                        <MaterialCommunityIcons
                          name="alert-circle"
                          size={16}
                          color="#F44336"
                        />
                        <Text variant="bodySmall" style={styles.validationErrorText}>
                          Please select at least one turf
                        </Text>
                      </View>
                    )}
                  </>
                )}
              </View>
            )}
          </Surface>
        )}

        {/* Permission Preview Table */}
        <Surface style={styles.section} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Permission Comparison
          </Text>
          <Text variant="bodySmall" style={styles.tableSubtitle}>
            See what changes when you enable operational permissions
          </Text>

          {/* Table Header */}
          <View style={styles.tableHeader}>
            <Text variant="labelSmall" style={[styles.tableHeaderCell, styles.featureColumn]}>
              Feature
            </Text>
            <Text variant="labelSmall" style={[styles.tableHeaderCell, styles.permissionColumn]}>
              Without
            </Text>
            <Text variant="labelSmall" style={[styles.tableHeaderCell, styles.permissionColumn]}>
              With
            </Text>
          </View>

          {/* Table Rows */}
          {PERMISSIONS_TABLE.map((row, index) => (
            <View
              key={index}
              style={[
                styles.tableRow,
                index % 2 === 0 && styles.tableRowAlternate,
              ]}
            >
              <Text variant="bodySmall" style={[styles.tableCell, styles.featureColumn]}>
                {row.feature}
              </Text>
              <View style={[styles.tableCell, styles.permissionColumn, styles.permissionCellContent]}>
                <PermissionIcon enabled={row.withoutPermissions.enabled} />
                <Text
                  variant="bodySmall"
                  style={[
                    styles.permissionCellText,
                    !row.withoutPermissions.enabled && styles.permissionCellTextDisabled,
                  ]}
                >
                  {row.withoutPermissions.text}
                </Text>
              </View>
              <View style={[styles.tableCell, styles.permissionColumn, styles.permissionCellContent]}>
                <PermissionIcon enabled={row.withPermissions.enabled} />
                <Text
                  variant="bodySmall"
                  style={[
                    styles.permissionCellText,
                    !row.withPermissions.enabled && styles.permissionCellTextDisabled,
                  ]}
                >
                  {row.withPermissions.text}
                </Text>
              </View>
            </View>
          ))}
        </Surface>

        {/* Info Note */}
        <View style={styles.infoNote}>
          <MaterialCommunityIcons name="information-outline" size={20} color="#666" />
          <Text variant="bodySmall" style={styles.infoNoteText}>
            These settings only affect your account. Managers and caretakers have
            their own permission levels based on their roles.
          </Text>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Save Button */}
      <View style={styles.footer}>
        <Button
          mode="contained"
          onPress={handleSave}
          loading={saving}
          disabled={saving || !hasChanges}
          style={styles.saveButton}
          buttonColor={OWNER_COLOR}
          contentStyle={styles.saveButtonContent}
        >
          Save Settings
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingRight: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  headerTitleContainer: {
    flex: 1,
  },
  title: {
    fontWeight: "bold",
    color: "#212121",
  },
  subtitle: {
    color: "#666",
    marginTop: 2,
  },
  scrollContent: {
    flex: 1,
  },
  section: {
    margin: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#fff",
  },
  sectionTitle: {
    fontWeight: "bold",
    marginBottom: 12,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  toggleInfo: {
    flex: 1,
    marginRight: 12,
  },
  toggleTitle: {
    fontWeight: "bold",
  },
  permissionsDescription: {
    marginTop: 16,
    padding: 12,
    backgroundColor: "#F3E5F5",
    borderRadius: 12,
  },
  descriptionHeader: {
    fontWeight: "600",
    marginBottom: 8,
    color: OWNER_COLOR,
  },
  permissionsList: {
    gap: 6,
  },
  permissionItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  permissionText: {
    marginLeft: 8,
    color: "#333",
  },
  permissionTextDisabled: {
    color: "#999",
  },
  radioOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  radioContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  radioLabel: {
    marginLeft: 8,
  },
  recommendedBadge: {
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  recommendedText: {
    fontSize: 10,
    color: "#4CAF50",
    fontWeight: "600",
  },
  turfListContainer: {
    marginTop: 8,
  },
  turfDivider: {
    marginBottom: 8,
  },
  turfCheckboxItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  turfCheckboxInfo: {
    flex: 1,
    marginLeft: 8,
  },
  turfLocation: {
    color: "#666",
    marginTop: 2,
  },
  noTurfsContainer: {
    alignItems: "center",
    paddingVertical: 24,
  },
  noTurfsText: {
    color: "#999",
    marginTop: 8,
  },
  validationError: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFEBEE",
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  validationErrorText: {
    color: "#F44336",
    marginLeft: 8,
  },
  tableSubtitle: {
    color: "#666",
    marginBottom: 16,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f5f5f5",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 4,
  },
  tableHeaderCell: {
    fontWeight: "600",
    color: "#666",
    textTransform: "uppercase",
  },
  featureColumn: {
    flex: 2,
  },
  permissionColumn: {
    flex: 1.2,
    textAlign: "center",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  tableRowAlternate: {
    backgroundColor: "#fafafa",
    borderRadius: 4,
  },
  tableCell: {
    fontSize: 12,
  },
  permissionCellContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  permissionCellText: {
    marginLeft: 4,
    fontSize: 11,
  },
  permissionCellTextDisabled: {
    color: "#999",
  },
  infoNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginHorizontal: 16,
    marginTop: 8,
    padding: 12,
    backgroundColor: "#E3F2FD",
    borderRadius: 8,
  },
  infoNoteText: {
    flex: 1,
    marginLeft: 8,
    color: "#1565C0",
    lineHeight: 18,
  },
  bottomPadding: {
    height: 100,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  saveButton: {
    borderRadius: 8,
  },
  saveButtonContent: {
    height: 50,
  },
});
