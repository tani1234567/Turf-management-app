import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import {
  Text,
  Surface,
  IconButton,
  ActivityIndicator,
  Chip,
  Button,
  Dialog,
  Portal,
  Divider,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSelector } from "react-redux";

import { selectUser } from "../../store/slices/authSlice";
import { queryDocuments } from "../../services/firebase/firestore";

const MANAGER_BLUE = "#3B82F6";
const PALE_BLUE = "#DBEAFE";
const SUCCESS_GREEN = "#22C55E";
const WARN_ORANGE = "#F59E0B";
const DANGER_RED = "#EF4444";

const STATUS_CONFIG = {
  pending: {
    label: "Pending",
    color: "#FF9800",
    bgColor: "#FFF3E0",
    icon: "clock-outline",
  },
  approved: {
    label: "Approved",
    color: "#4CAF50",
    bgColor: "#E8F5E9",
    icon: "check-circle-outline",
  },
  rejected: {
    label: "Rejected",
    color: "#F44336",
    bgColor: "#FFEBEE",
    icon: "close-circle-outline",
  },
};

const formatDate = (timestamp) => {
  if (!timestamp) return "";
  let date;
  if (timestamp.toDate) {
    date = timestamp.toDate();
  } else if (timestamp.seconds) {
    date = new Date(timestamp.seconds * 1000);
  } else {
    date = new Date(timestamp);
  }
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export default function TurfRequestsListScreen({ navigation }) {
  const user = useSelector(selectUser);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [detailDialogVisible, setDetailDialogVisible] = useState(false);

  const fetchRequests = useCallback(async () => {
    if (!user?.userId) return;

    try {
      const docs = await queryDocuments("turf_requests", [
        { field: "requestedBy", operator: "==", value: user.userId },
      ]);
      const sorted = docs.sort((a, b) => {
        const aTime = a.createdAt?.seconds || 0;
        const bTime = b.createdAt?.seconds || 0;
        return bTime - aTime;
      });
      setRequests(sorted);
    } catch (error) {
      console.error("Error fetching turf requests:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.userId]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchRequests();
    setRefreshing(false);
  }, [fetchRequests]);

  const openDetail = (request) => {
    setSelectedRequest(request);
    setDetailDialogVisible(true);
  };

  const renderRequestCard = ({ item }) => {
    const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
    const turfData = item.turfData || {};
    const groundCount = turfData.grounds?.length || turfData.totalGrounds || 0;

    return (
      <TouchableOpacity onPress={() => openDetail(item)} activeOpacity={0.7}>
        <Surface style={styles.requestCard} elevation={2}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <MaterialCommunityIcons name="soccer-field" size={24} color={MANAGER_BLUE} />
              <View style={styles.cardTitleInfo}>
                <Text variant="titleMedium" style={styles.turfName}>
                  {item.turfName || turfData.name || "Unnamed Turf"}
                </Text>
                <Text variant="bodySmall" style={styles.locationText}>
                  {turfData.location?.city
                    ? `${turfData.location.city}${turfData.location.state ? `, ${turfData.location.state}` : ""}`
                    : "Location not set"}
                </Text>
              </View>
            </View>
            <Chip
              mode="flat"
              style={[styles.statusChip, { backgroundColor: statusConfig.bgColor }]}
              textStyle={{ color: statusConfig.color, fontSize: 12, fontWeight: "600" }}
              icon={() => (
                <MaterialCommunityIcons
                  name={statusConfig.icon}
                  size={14}
                  color={statusConfig.color}
                />
              )}
            >
              {statusConfig.label}
            </Chip>
          </View>

          <View style={styles.cardDetails}>
            <View style={styles.detailItem}>
              <MaterialCommunityIcons name="land-plots" size={16} color="#666" />
              <Text variant="bodySmall" style={styles.detailText}>
                {groundCount} ground{groundCount !== 1 ? "s" : ""}
              </Text>
            </View>
            <View style={styles.detailItem}>
              <MaterialCommunityIcons name="calendar" size={16} color="#666" />
              <Text variant="bodySmall" style={styles.detailText}>
                Submitted {formatDate(item.createdAt)}
              </Text>
            </View>
          </View>

          {item.status === "rejected" && item.rejectionReason && (
            <View style={styles.rejectionBanner}>
              <MaterialCommunityIcons name="alert-circle" size={16} color="#D32F2F" />
              <Text variant="bodySmall" style={styles.rejectionText} numberOfLines={2}>
                Reason: {item.rejectionReason}
              </Text>
            </View>
          )}

          {item.status === "approved" && (
            <View style={styles.approvedBanner}>
              <MaterialCommunityIcons name="check-circle" size={16} color="#2E7D32" />
              <Text variant="bodySmall" style={styles.approvedText}>
                Approved {formatDate(item.approvedAt)}
              </Text>
            </View>
          )}
        </Surface>
      </TouchableOpacity>
    );
  };

  const renderDetailDialog = () => {
    if (!selectedRequest) return null;

    const turfData = selectedRequest.turfData || {};
    const statusConfig = STATUS_CONFIG[selectedRequest.status] || STATUS_CONFIG.pending;
    const grounds = turfData.grounds || [];

    return (
      <Portal>
        <Dialog
          visible={detailDialogVisible}
          onDismiss={() => setDetailDialogVisible(false)}
          style={styles.detailDialog}
        >
          <Dialog.Title>Request Details</Dialog.Title>
          <Dialog.ScrollArea style={styles.dialogScroll}>
            <View style={styles.dialogContent}>
              <View style={styles.dialogStatusRow}>
                <Chip
                  mode="flat"
                  style={{ backgroundColor: statusConfig.bgColor }}
                  textStyle={{ color: statusConfig.color, fontWeight: "600" }}
                >
                  {statusConfig.label}
                </Chip>
                <Text variant="bodySmall" style={styles.dialogDate}>
                  {formatDate(selectedRequest.createdAt)}
                </Text>
              </View>

              <Divider style={styles.dialogDivider} />

              <Text variant="titleMedium" style={styles.dialogSectionTitle}>
                Turf Information
              </Text>
              <Text variant="bodyMedium" style={styles.dialogLabel}>Name</Text>
              <Text variant="bodyMedium" style={styles.dialogValue}>
                {selectedRequest.turfName || turfData.name}
              </Text>

              {turfData.description && (
                <>
                  <Text variant="bodyMedium" style={styles.dialogLabel}>Description</Text>
                  <Text variant="bodyMedium" style={styles.dialogValue}>
                    {turfData.description}
                  </Text>
                </>
              )}

              <Divider style={styles.dialogDivider} />

              <Text variant="titleMedium" style={styles.dialogSectionTitle}>
                Location
              </Text>
              {turfData.location?.address && (
                <Text variant="bodyMedium" style={styles.dialogValue}>
                  {turfData.location.address}
                </Text>
              )}
              <Text variant="bodyMedium" style={styles.dialogValue}>
                {[turfData.location?.city, turfData.location?.state, turfData.location?.pincode]
                  .filter(Boolean)
                  .join(", ")}
              </Text>

              <Divider style={styles.dialogDivider} />

              <Text variant="titleMedium" style={styles.dialogSectionTitle}>
                Grounds ({grounds.length})
              </Text>
              {grounds.map((ground, index) => (
                <View key={ground.groundId || index} style={styles.dialogGroundItem}>
                  <Text variant="bodyMedium" style={styles.dialogGroundName}>
                    {ground.name}
                  </Text>
                  <Text variant="bodySmall" style={styles.dialogGroundDetail}>
                    Sports: {ground.sports?.join(", ") || "None"}
                  </Text>
                </View>
              ))}

              {selectedRequest.status === "rejected" && selectedRequest.rejectionReason && (
                <>
                  <Divider style={styles.dialogDivider} />
                  <Text variant="titleMedium" style={[styles.dialogSectionTitle, { color: "#D32F2F" }]}>
                    Rejection Reason
                  </Text>
                  <Text variant="bodyMedium" style={styles.dialogValue}>
                    {selectedRequest.rejectionReason}
                  </Text>
                </>
              )}
            </View>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setDetailDialogVisible(false)}>Close</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.headerBar}>
          <IconButton icon="arrow-left" onPress={() => navigation.goBack()} />
          <Text variant="titleLarge" style={styles.headerTitle}>My Turf Requests</Text>
          <View style={{ width: 48 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={MANAGER_BLUE} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerBar}>
        <IconButton icon="arrow-left" onPress={() => navigation.goBack()} />
        <Text variant="titleLarge" style={styles.headerTitle}>My Turf Requests</Text>
        <IconButton
          icon="plus"
          iconColor={MANAGER_BLUE}
          onPress={() => navigation.navigate("TurfRequest")}
        />
      </View>

      {requests.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="file-document-outline" size={64} color="#ccc" />
          <Text variant="titleMedium" style={styles.emptyTitle}>
            No Turf Requests
          </Text>
          <Text variant="bodyMedium" style={styles.emptySubtitle}>
            Submit a request to add a new turf for your company.
          </Text>
          <Button
            mode="contained"
            icon="plus"
            buttonColor={MANAGER_BLUE}
            style={styles.emptyButton}
            onPress={() => navigation.navigate("TurfRequest")}
          >
            Request New Turf
          </Button>
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id}
          renderItem={renderRequestCard}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[MANAGER_BLUE]}
            />
          }
        />
      )}

      {renderDetailDialog()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F0F4F8",
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    paddingRight: 4,
  },
  headerTitle: {
    fontWeight: "bold",
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  requestCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: "#fff",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  cardTitleInfo: {
    marginLeft: 12,
    flex: 1,
  },
  turfName: {
    fontWeight: "bold",
  },
  locationText: {
    color: "#666",
    marginTop: 2,
  },
  statusChip: {
    height: 28,
  },
  cardDetails: {
    flexDirection: "row",
    marginTop: 12,
    gap: 16,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  detailText: {
    color: "#666",
  },
  rejectionBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFEBEE",
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  rejectionText: {
    color: "#D32F2F",
    flex: 1,
  },
  approvedBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F5E9",
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  approvedText: {
    color: "#2E7D32",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontWeight: "bold",
    marginTop: 16,
    color: "#666",
  },
  emptySubtitle: {
    color: "#999",
    textAlign: "center",
    marginTop: 8,
  },
  emptyButton: {
    marginTop: 24,
    borderRadius: 8,
  },
  detailDialog: {
    maxHeight: "80%",
  },
  dialogScroll: {
    paddingHorizontal: 0,
  },
  dialogContent: {
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  dialogStatusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  dialogDate: {
    color: "#666",
  },
  dialogDivider: {
    marginVertical: 12,
  },
  dialogSectionTitle: {
    fontWeight: "bold",
    marginBottom: 8,
  },
  dialogLabel: {
    color: "#666",
    marginTop: 4,
  },
  dialogValue: {
    marginBottom: 4,
  },
  dialogGroundItem: {
    backgroundColor: "#F5F5F5",
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  dialogGroundName: {
    fontWeight: "600",
  },
  dialogGroundDetail: {
    color: "#666",
    marginTop: 2,
  },
});
