import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from "react-native";
import {
  Text,
  Surface,
  TextInput,
  Button,
  Chip,
  Divider,
  SegmentedButtons,
  Menu,
  ActivityIndicator,
  IconButton,
  Card,
  Badge,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSelector } from "react-redux";
import * as ImagePicker from "expo-image-picker";
import {
  selectUser,
  selectAssignedTurfId,
} from "../../store/slices/authSlice";
import {
  addDocument,
  queryDocuments,
  getDocument,
  subscribeToCollection,
} from "../../services/firebase/firestore";

const CARETAKER_COLOR = "#FF9800";

const ISSUE_TYPES = [
  { id: "lighting", label: "Lighting", icon: "lightbulb-outline", color: "#FFC107" },
  { id: "ground_condition", label: "Ground Condition", icon: "grass", color: "#4CAF50" },
  { id: "equipment", label: "Equipment", icon: "tools", color: "#2196F3" },
  { id: "safety", label: "Safety", icon: "shield-alert-outline", color: "#F44336" },
  { id: "other", label: "Other", icon: "help-circle-outline", color: "#9E9E9E" },
];

const PRIORITY_LEVELS = [
  { value: "low", label: "Low", color: "#4CAF50", icon: "arrow-down" },
  { value: "medium", label: "Medium", color: "#FF9800", icon: "minus" },
  { value: "high", label: "High", color: "#F44336", icon: "arrow-up" },
];

const STATUS_CONFIG = {
  pending: { label: "Pending", color: "#FF9800", icon: "clock-outline" },
  in_progress: { label: "In Progress", color: "#2196F3", icon: "progress-wrench" },
  resolved: { label: "Resolved", color: "#4CAF50", icon: "check-circle" },
  rejected: { label: "Rejected", color: "#F44336", icon: "close-circle" },
};

export default function MaintenanceLogScreen({ navigation }) {
  const user = useSelector(selectUser);
  const assignedTurfId = useSelector(selectAssignedTurfId);

  // View state
  const [activeTab, setActiveTab] = useState("report"); // 'report' or 'my_reports'

  // Form state
  const [selectedGround, setSelectedGround] = useState(null);
  const [issueType, setIssueType] = useState(null);
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [photos, setPhotos] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Ground selection
  const [grounds, setGrounds] = useState([]);
  const [groundMenuVisible, setGroundMenuVisible] = useState(false);
  const [loadingGrounds, setLoadingGrounds] = useState(true);

  // My reports state
  const [myReports, setMyReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Turf info
  const [turfName, setTurfName] = useState("");
  const [managerId, setManagerId] = useState(null);

  // Fetch turf data and grounds
  useEffect(() => {
    const fetchTurfData = async () => {
      const turfId = assignedTurfId || user?.assignedTurfId;
      if (!turfId) {
        setLoadingGrounds(false);
        return;
      }

      try {
        const turf = await getDocument("turfs", turfId);
        if (turf) {
          setTurfName(turf.name || "Unknown Turf");
          setGrounds(turf.grounds || []);
          // Get manager ID for notification
          if (turf.managerIds && turf.managerIds.length > 0) {
            setManagerId(turf.managerIds[0]);
          }
        }
      } catch (error) {
        console.error("Error fetching turf data:", error);
      } finally {
        setLoadingGrounds(false);
      }
    };

    fetchTurfData();
  }, [assignedTurfId, user?.assignedTurfId]);

  // Subscribe to my reports
  useEffect(() => {
    const turfId = assignedTurfId || user?.assignedTurfId;
    const caretakerId = user?.userId || user?.uid;

    if (!turfId || !caretakerId) {
      setLoadingReports(false);
      return;
    }

    const unsubscribe = subscribeToCollection(
      "maintenance_logs",
      (logs) => {
        // Sort by createdAt descending
        const sortedLogs = logs.sort((a, b) => {
          const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt);
          const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt);
          return dateB - dateA;
        });
        setMyReports(sortedLogs);
        setLoadingReports(false);
        setRefreshing(false);
      },
      [
        { field: "turfId", operator: "==", value: turfId },
        { field: "reportedBy", operator: "==", value: caretakerId },
      ]
    );

    return () => unsubscribe && unsubscribe();
  }, [assignedTurfId, user?.assignedTurfId, user?.userId, user?.uid]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // The subscription will automatically update the data
  }, []);

  const pickImage = async () => {
    if (photos.length >= 5) {
      Alert.alert("Limit Reached", "You can only upload up to 5 photos.");
      return;
    }

    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert("Permission Required", "Please allow access to your photo library.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });

    if (!result.canceled) {
      setPhotos([...photos, result.assets[0].uri]);
    }
  };

  const takePhoto = async () => {
    if (photos.length >= 5) {
      Alert.alert("Limit Reached", "You can only upload up to 5 photos.");
      return;
    }

    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert("Permission Required", "Please allow access to your camera.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });

    if (!result.canceled) {
      setPhotos([...photos, result.assets[0].uri]);
    }
  };

  const removePhoto = (index) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const validateForm = () => {
    if (!selectedGround) {
      Alert.alert("Required", "Please select a ground.");
      return false;
    }
    if (!issueType) {
      Alert.alert("Required", "Please select an issue type.");
      return false;
    }
    if (!description.trim()) {
      Alert.alert("Required", "Please provide a description of the issue.");
      return false;
    }
    if (description.trim().length < 10) {
      Alert.alert("Required", "Please provide a more detailed description (at least 10 characters).");
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    const turfId = assignedTurfId || user?.assignedTurfId;
    if (!turfId) {
      Alert.alert("Error", "No turf assigned. Please contact your manager.");
      return;
    }

    Alert.alert(
      "Submit Report",
      "Are you sure you want to submit this maintenance report?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Submit",
          onPress: async () => {
            setSubmitting(true);

            try {
              const issueTypeInfo = ISSUE_TYPES.find((t) => t.id === issueType);
              const priorityInfo = PRIORITY_LEVELS.find((p) => p.value === priority);

              // Create maintenance log document
              const maintenanceLogData = {
                turfId,
                turfName,
                groundId: selectedGround.groundId || selectedGround.id,
                groundName: selectedGround.name,
                issueType,
                issueTypeLabel: issueTypeInfo?.label || issueType,
                description: description.trim(),
                priority,
                priorityLabel: priorityInfo?.label || priority,
                photos: photos, // In production, these would be uploaded to storage first
                status: "pending",
                reportedBy: user?.userId || user?.uid,
                reportedByName: user?.name || "Caretaker",
                reportedByPhone: user?.phone || null,
                resolvedBy: null,
                resolvedByName: null,
                resolvedAt: null,
                resolutionNotes: null,
              };

              const logId = await addDocument("maintenance_logs", maintenanceLogData);

              // Create notification for manager
              if (managerId) {
                await addDocument("notifications", {
                  userId: managerId,
                  type: "maintenance_report",
                  title: "New Maintenance Report",
                  body: `${user?.name || "Caretaker"} reported a ${priorityInfo?.label || priority} priority ${issueTypeInfo?.label || issueType} issue at ${selectedGround.name}.`,
                  relatedId: logId,
                  relatedType: "maintenance_log",
                  turfId,
                  turfName,
                  isRead: false,
                });
              }

              // Reset form
              setSelectedGround(null);
              setIssueType(null);
              setDescription("");
              setPriority("medium");
              setPhotos([]);

              Alert.alert(
                "Report Submitted",
                "Your maintenance report has been submitted successfully. The manager will be notified.",
                [
                  {
                    text: "View My Reports",
                    onPress: () => setActiveTab("my_reports"),
                  },
                  { text: "OK" },
                ]
              );
            } catch (error) {
              console.error("Error submitting maintenance report:", error);
              Alert.alert("Error", "Failed to submit report. Please try again.");
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";
    const date = timestamp?.toDate?.() || new Date(timestamp);
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderReportForm = () => (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Turf Info */}
      <Surface style={styles.turfCard} elevation={1}>
        <View style={styles.turfCardContent}>
          <MaterialCommunityIcons name="soccer-field" size={28} color="#4CAF50" />
          <View style={styles.turfInfo}>
            <Text variant="bodySmall" style={styles.turfLabel}>
              Reporting for
            </Text>
            <Text variant="titleMedium" style={styles.turfNameText}>
              {turfName || "Loading..."}
            </Text>
          </View>
        </View>
      </Surface>

      {/* Ground Selection */}
      <Surface style={styles.section} elevation={1}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Select Ground *
        </Text>
        <Menu
          visible={groundMenuVisible}
          onDismiss={() => setGroundMenuVisible(false)}
          anchor={
            <TouchableOpacity
              style={styles.dropdownButton}
              onPress={() => setGroundMenuVisible(true)}
            >
              <View style={styles.dropdownContent}>
                <MaterialCommunityIcons
                  name="soccer-field"
                  size={20}
                  color={selectedGround ? CARETAKER_COLOR : "#666"}
                />
                <Text
                  variant="bodyLarge"
                  style={[
                    styles.dropdownText,
                    !selectedGround && styles.dropdownPlaceholder,
                  ]}
                >
                  {selectedGround?.name || "Select a ground"}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-down" size={24} color="#666" />
            </TouchableOpacity>
          }
        >
          {loadingGrounds ? (
            <Menu.Item title="Loading..." disabled />
          ) : grounds.length === 0 ? (
            <Menu.Item title="No grounds available" disabled />
          ) : (
            grounds.map((ground) => (
              <Menu.Item
                key={ground.groundId || ground.id}
                onPress={() => {
                  setSelectedGround(ground);
                  setGroundMenuVisible(false);
                }}
                title={ground.name}
                leadingIcon="soccer-field"
              />
            ))
          )}
        </Menu>
      </Surface>

      {/* Issue Type Selection */}
      <Surface style={styles.section} elevation={1}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Issue Type *
        </Text>
        <View style={styles.issueTypesGrid}>
          {ISSUE_TYPES.map((type) => (
            <TouchableOpacity
              key={type.id}
              style={[
                styles.issueTypeCard,
                issueType === type.id && styles.issueTypeCardSelected,
                issueType === type.id && { borderColor: type.color },
              ]}
              onPress={() => setIssueType(type.id)}
            >
              <View
                style={[
                  styles.issueTypeIconContainer,
                  issueType === type.id && { backgroundColor: type.color + "20" },
                ]}
              >
                <MaterialCommunityIcons
                  name={type.icon}
                  size={24}
                  color={issueType === type.id ? type.color : "#666"}
                />
              </View>
              <Text
                variant="bodySmall"
                style={[
                  styles.issueTypeLabel,
                  issueType === type.id && { color: type.color, fontWeight: "600" },
                ]}
              >
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Surface>

      {/* Description */}
      <Surface style={styles.section} elevation={1}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Description *
        </Text>
        <TextInput
          mode="outlined"
          placeholder="Describe the issue in detail..."
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          style={styles.descriptionInput}
          outlineColor="#E0E0E0"
          activeOutlineColor={CARETAKER_COLOR}
        />
        <Text variant="bodySmall" style={styles.charCount}>
          {description.length} characters
        </Text>
      </Surface>

      {/* Priority Selection */}
      <Surface style={styles.section} elevation={1}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Priority Level
        </Text>
        <View style={styles.priorityContainer}>
          {PRIORITY_LEVELS.map((level) => (
            <TouchableOpacity
              key={level.value}
              style={[
                styles.priorityButton,
                priority === level.value && styles.priorityButtonSelected,
                priority === level.value && { borderColor: level.color, backgroundColor: level.color + "15" },
              ]}
              onPress={() => setPriority(level.value)}
            >
              <MaterialCommunityIcons
                name={level.icon}
                size={20}
                color={priority === level.value ? level.color : "#666"}
              />
              <Text
                variant="bodyMedium"
                style={[
                  styles.priorityLabel,
                  priority === level.value && { color: level.color, fontWeight: "600" },
                ]}
              >
                {level.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Surface>

      {/* Photo Upload */}
      <Surface style={styles.section} elevation={1}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Photos ({photos.length}/5)
        </Text>
        <Text variant="bodySmall" style={styles.photoHint}>
          Add photos to help illustrate the issue
        </Text>

        <View style={styles.photoGrid}>
          {photos.map((uri, index) => (
            <View key={index} style={styles.photoContainer}>
              <Image source={{ uri }} style={styles.photoPreview} />
              <IconButton
                icon="close-circle"
                size={20}
                style={styles.removePhotoButton}
                iconColor="#F44336"
                containerColor="#fff"
                onPress={() => removePhoto(index)}
              />
            </View>
          ))}

          {photos.length < 5 && (
            <View style={styles.addPhotoButtons}>
              <TouchableOpacity style={styles.addPhotoButton} onPress={pickImage}>
                <MaterialCommunityIcons name="image-plus" size={28} color="#666" />
                <Text variant="bodySmall" style={styles.addPhotoText}>
                  Gallery
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addPhotoButton} onPress={takePhoto}>
                <MaterialCommunityIcons name="camera-plus" size={28} color="#666" />
                <Text variant="bodySmall" style={styles.addPhotoText}>
                  Camera
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Surface>

      {/* Submit Button */}
      <Button
        mode="contained"
        onPress={handleSubmit}
        loading={submitting}
        disabled={submitting}
        style={styles.submitButton}
        buttonColor={CARETAKER_COLOR}
        icon="send"
      >
        Submit Report
      </Button>
    </ScrollView>
  );

  const renderMyReports = () => (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[CARETAKER_COLOR]}
        />
      }
    >
      {loadingReports ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={CARETAKER_COLOR} />
          <Text variant="bodyMedium" style={styles.loadingText}>
            Loading reports...
          </Text>
        </View>
      ) : myReports.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="clipboard-text-outline" size={64} color="#ccc" />
          <Text variant="titleMedium" style={styles.emptyTitle}>
            No Reports Yet
          </Text>
          <Text variant="bodyMedium" style={styles.emptyText}>
            You haven't submitted any maintenance reports.
          </Text>
          <Button
            mode="contained"
            onPress={() => setActiveTab("report")}
            style={styles.emptyButton}
            buttonColor={CARETAKER_COLOR}
          >
            Report an Issue
          </Button>
        </View>
      ) : (
        myReports.map((report) => {
          const statusInfo = STATUS_CONFIG[report.status] || STATUS_CONFIG.pending;
          const issueInfo = ISSUE_TYPES.find((t) => t.id === report.issueType);
          const priorityInfo = PRIORITY_LEVELS.find((p) => p.value === report.priority);

          return (
            <Card key={report.id} style={styles.reportCard}>
              <Card.Content>
                {/* Header */}
                <View style={styles.reportHeader}>
                  <View style={styles.reportIssueType}>
                    <View
                      style={[
                        styles.reportIssueIcon,
                        { backgroundColor: (issueInfo?.color || "#666") + "20" },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={issueInfo?.icon || "help-circle-outline"}
                        size={20}
                        color={issueInfo?.color || "#666"}
                      />
                    </View>
                    <Text variant="titleSmall" style={styles.reportIssueLabel}>
                      {report.issueTypeLabel || report.issueType}
                    </Text>
                  </View>
                  <Chip
                    icon={() => (
                      <MaterialCommunityIcons
                        name={statusInfo.icon}
                        size={16}
                        color={statusInfo.color}
                      />
                    )}
                    style={[styles.statusChip, { backgroundColor: statusInfo.color + "15" }]}
                    textStyle={{ color: statusInfo.color, fontSize: 12 }}
                  >
                    {statusInfo.label}
                  </Chip>
                </View>

                {/* Ground */}
                <View style={styles.reportDetailRow}>
                  <MaterialCommunityIcons name="soccer-field" size={16} color="#666" />
                  <Text variant="bodyMedium" style={styles.reportDetailText}>
                    {report.groundName}
                  </Text>
                </View>

                {/* Description */}
                <Text variant="bodyMedium" style={styles.reportDescription}>
                  {report.description}
                </Text>

                {/* Photos */}
                {report.photos && report.photos.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.reportPhotosRow}>
                      {report.photos.map((uri, index) => (
                        <Image
                          key={index}
                          source={{ uri }}
                          style={styles.reportPhoto}
                        />
                      ))}
                    </View>
                  </ScrollView>
                )}

                <Divider style={styles.reportDivider} />

                {/* Footer */}
                <View style={styles.reportFooter}>
                  <View style={styles.reportFooterItem}>
                    <MaterialCommunityIcons
                      name={priorityInfo?.icon || "minus"}
                      size={16}
                      color={priorityInfo?.color || "#666"}
                    />
                    <Text
                      variant="bodySmall"
                      style={[styles.reportFooterText, { color: priorityInfo?.color || "#666" }]}
                    >
                      {report.priorityLabel || report.priority} Priority
                    </Text>
                  </View>
                  <View style={styles.reportFooterItem}>
                    <MaterialCommunityIcons name="clock-outline" size={16} color="#666" />
                    <Text variant="bodySmall" style={styles.reportFooterText}>
                      {formatDate(report.createdAt)}
                    </Text>
                  </View>
                </View>

                {/* Resolution notes if resolved */}
                {report.status === "resolved" && report.resolutionNotes && (
                  <Surface style={styles.resolutionCard} elevation={0}>
                    <Text variant="bodySmall" style={styles.resolutionLabel}>
                      Resolution Notes:
                    </Text>
                    <Text variant="bodyMedium" style={styles.resolutionText}>
                      {report.resolutionNotes}
                    </Text>
                    {report.resolvedByName && (
                      <Text variant="bodySmall" style={styles.resolvedBy}>
                        Resolved by {report.resolvedByName}
                      </Text>
                    )}
                  </Surface>
                )}
              </Card.Content>
            </Card>
          );
        })
      )}
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton icon="arrow-left" onPress={() => navigation.goBack()} />
        <Text variant="titleLarge" style={styles.headerTitle}>
          Maintenance Log
        </Text>
        <View style={{ width: 48 }} />
      </View>

      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <SegmentedButtons
          value={activeTab}
          onValueChange={setActiveTab}
          buttons={[
            {
              value: "report",
              label: "Report Issue",
              icon: "plus-circle-outline",
            },
            {
              value: "my_reports",
              label: "My Reports",
              icon: "clipboard-list-outline",
            },
          ]}
          style={styles.segmentedButtons}
        />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.content}
      >
        {activeTab === "report" ? renderReportForm() : renderMyReports()}
      </KeyboardAvoidingView>
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
    justifyContent: "space-between",
    paddingRight: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  headerTitle: {
    fontWeight: "bold",
    color: "#333",
  },
  tabContainer: {
    padding: 16,
    backgroundColor: "#fff",
  },
  segmentedButtons: {
    backgroundColor: "#f5f5f5",
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  turfCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#fff",
    marginBottom: 16,
  },
  turfCardContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  turfInfo: {
    marginLeft: 12,
    flex: 1,
  },
  turfLabel: {
    color: "#666",
  },
  turfNameText: {
    fontWeight: "600",
    color: "#333",
  },
  section: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#fff",
    marginBottom: 16,
  },
  sectionTitle: {
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  dropdownButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 8,
    backgroundColor: "#FAFAFA",
  },
  dropdownContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  dropdownText: {
    marginLeft: 12,
    color: "#333",
  },
  dropdownPlaceholder: {
    color: "#999",
  },
  issueTypesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  issueTypeCard: {
    width: "30%",
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#E0E0E0",
    alignItems: "center",
    backgroundColor: "#FAFAFA",
  },
  issueTypeCardSelected: {
    backgroundColor: "#fff",
    borderWidth: 2,
  },
  issueTypeIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#f5f5f5",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  issueTypeLabel: {
    textAlign: "center",
    color: "#666",
    fontSize: 11,
  },
  descriptionInput: {
    backgroundColor: "#fff",
    minHeight: 100,
  },
  charCount: {
    color: "#999",
    textAlign: "right",
    marginTop: 4,
  },
  priorityContainer: {
    flexDirection: "row",
    gap: 12,
  },
  priorityButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#E0E0E0",
    backgroundColor: "#FAFAFA",
    gap: 6,
  },
  priorityButtonSelected: {
    borderWidth: 2,
  },
  priorityLabel: {
    color: "#666",
  },
  photoHint: {
    color: "#666",
    marginBottom: 12,
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  photoContainer: {
    position: "relative",
  },
  photoPreview: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  removePhotoButton: {
    position: "absolute",
    top: -8,
    right: -8,
    margin: 0,
  },
  addPhotoButtons: {
    flexDirection: "row",
    gap: 10,
  },
  addPhotoButton: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#E0E0E0",
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FAFAFA",
  },
  addPhotoText: {
    color: "#666",
    marginTop: 4,
  },
  submitButton: {
    marginTop: 8,
    borderRadius: 8,
  },
  // My Reports styles
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
  },
  loadingText: {
    color: "#666",
    marginTop: 12,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
  },
  emptyTitle: {
    fontWeight: "600",
    color: "#333",
    marginTop: 16,
  },
  emptyText: {
    color: "#666",
    marginTop: 8,
    textAlign: "center",
  },
  emptyButton: {
    marginTop: 24,
    borderRadius: 8,
  },
  reportCard: {
    marginBottom: 12,
    borderRadius: 12,
  },
  reportHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  reportIssueType: {
    flexDirection: "row",
    alignItems: "center",
  },
  reportIssueIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  reportIssueLabel: {
    marginLeft: 10,
    fontWeight: "600",
    color: "#333",
  },
  statusChip: {
    height: 28,
  },
  reportDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  reportDetailText: {
    marginLeft: 8,
    color: "#666",
  },
  reportDescription: {
    color: "#333",
    lineHeight: 20,
    marginBottom: 12,
  },
  reportPhotosRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  reportPhoto: {
    width: 60,
    height: 60,
    borderRadius: 6,
  },
  reportDivider: {
    marginVertical: 12,
  },
  reportFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  reportFooterItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  reportFooterText: {
    color: "#666",
  },
  resolutionCard: {
    marginTop: 12,
    padding: 12,
    backgroundColor: "#E8F5E9",
    borderRadius: 8,
  },
  resolutionLabel: {
    color: "#2E7D32",
    fontWeight: "600",
    marginBottom: 4,
  },
  resolutionText: {
    color: "#333",
  },
  resolvedBy: {
    color: "#666",
    marginTop: 8,
    fontStyle: "italic",
  },
});
