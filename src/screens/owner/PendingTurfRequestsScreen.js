import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Image,
  ScrollView,
  Modal,
} from "react-native";
import {
  Text,
  Surface,
  IconButton,
  ActivityIndicator,
  Chip,
  Button,
  Divider,
  TextInput,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSelector, useDispatch } from "react-redux";

import { selectUser } from "../../store/slices/authSlice";
import { selectCompany, updateStats } from "../../store/slices/companySlice";
import { addTurf } from "../../store/slices/ownerSlice";
import {
  queryDocuments,
  updateDocument,
  setDocument,
  serverTimestamp,
} from "../../services/firebase/firestore";
import { SPORTS, AMENITIES } from "../../constants/sports";
import { isRemoteImageUri } from "../../services/firebase/turfImages";

const OWNER_COLOR = "#9C27B0";

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

const formatTime = (timeStr) => {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${m} ${ampm}`;
};

const getSportName = (sportId) => {
  const sport = SPORTS.find((s) => s.id === sportId);
  return sport?.name || sportId;
};

const getAmenityName = (amenityId) => {
  const amenity = AMENITIES.find((a) => a.id === amenityId);
  return amenity?.name || amenityId;
};

const DAYS_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const DAY_LABELS = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

export default function PendingTurfRequestsScreen({ navigation }) {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const company = useSelector(selectCompany);

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  // Detail dialog
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [detailVisible, setDetailVisible] = useState(false);

  // Reject dialog
  const [rejectDialogVisible, setRejectDialogVisible] = useState(false);
  const [rejectingRequest, setRejectingRequest] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const companyId = company?.id || company?.companyId;

  const fetchRequests = useCallback(async () => {
    if (!companyId) return;

    try {
      const docs = await queryDocuments("turf_requests", [
        { field: "companyId", operator: "==", value: companyId },
      ]);
      const sorted = docs.sort((a, b) => {
        const statusOrder = { pending: 0, approved: 1, rejected: 2 };
        const aDiff = statusOrder[a.status] ?? 3;
        const bDiff = statusOrder[b.status] ?? 3;
        if (aDiff !== bDiff) return aDiff - bDiff;
        return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
      });
      setRequests(sorted);
    } catch (error) {
      console.error("Error fetching turf requests:", error);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchRequests();
    setRefreshing(false);
  }, [fetchRequests]);

  // --- Approve flow ---

  const handleApprove = (request) => {
    Alert.alert(
      "Approve Turf Request",
      `Approve "${request.turfName || request.turfData?.name}"? The requesting manager will be auto-assigned to this turf.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Approve",
          onPress: () => executeApproval(request),
        },
      ]
    );
  };

  const executeApproval = async (request) => {
    setActionLoading(request.id);
    try {
      const turfData = request.turfData || {};
      const turfId = `turf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const normalizedCoverImage = isRemoteImageUri(turfData.coverImage) ? turfData.coverImage : null;
      const normalizedImages = (turfData.images || []).filter((uri) => isRemoteImageUri(uri));

      // Build the turf document from the request data
      const newTurf = {
        turfId,
        companyId,
        name: turfData.name || request.turfName || "Unnamed Turf",
        description: turfData.description || null,
        coverImage: normalizedCoverImage,
        images: normalizedImages,
        location: turfData.location || {},
        operatingHours: turfData.operatingHours || {},
        grounds: turfData.grounds || [],
        totalGrounds: turfData.totalGrounds || turfData.grounds?.length || 0,
        managerIds: request.requestedBy ? [request.requestedBy] : [],
        caretakerIds: [],
        isActive: true,
        qrCodes: {
          global: "https://turfbooking.app/book",
          turf: `https://turfbooking.app/book/${turfId}`,
        },
        stats: {
          totalBookings: 0,
          monthlyRevenue: 0,
          todayBookings: 0,
        },
        createdAt: serverTimestamp(),
        createdBy: user?.userId || null,
        approvedFromRequest: request.id,
        updatedAt: serverTimestamp(),
      };

      // Create the turf
      await setDocument("turfs", turfId, newTurf);

      // Auto-assign the requesting manager
      if (request.requestedBy) {
        try {
          const managerDoc = await queryDocuments("users", [
            { field: "userId", operator: "==", value: request.requestedBy },
          ]);
          if (managerDoc.length > 0) {
            const managerData = managerDoc[0];
            const existingTurfIds = managerData.assignedTurfIds || [];
            if (!existingTurfIds.includes(turfId)) {
              await updateDocument("users", request.requestedBy, {
                assignedTurfIds: [...existingTurfIds, turfId],
              });
            }
          }
        } catch (err) {
          console.error("Error assigning manager to turf:", err);
        }
      }

      // Update request status
      await updateDocument("turf_requests", request.id, {
        status: "approved",
        approvedBy: user?.userId || null,
        approvedAt: serverTimestamp(),
        createdTurfId: turfId,
        updatedAt: serverTimestamp(),
      });

      // Update company stats
      const currentTotalTurfs = company?.stats?.totalTurfs || 0;
      const currentTotalGrounds = company?.stats?.totalGrounds || 0;
      const groundCount = newTurf.totalGrounds;

      await updateDocument("companies", companyId, {
        "stats.totalTurfs": currentTotalTurfs + 1,
        "stats.totalGrounds": currentTotalGrounds + groundCount,
      });

      // Update Redux
      dispatch(addTurf(newTurf));
      dispatch(
        updateStats({
          totalTurfs: currentTotalTurfs + 1,
          totalGrounds: currentTotalGrounds + groundCount,
        })
      );

      Alert.alert(
        "Turf Created!",
        `"${newTurf.name}" has been created with ${groundCount} ground(s). ${request.requestedByName || "The manager"} has been auto-assigned.`
      );

      // Refresh list
      await fetchRequests();
      setDetailVisible(false);
    } catch (error) {
      console.error("Error approving turf request:", error);
      Alert.alert("Error", "Failed to approve turf request. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  // --- Reject flow ---

  const openRejectDialog = (request) => {
    setRejectingRequest(request);
    setRejectionReason("");
    setRejectDialogVisible(true);
  };

  const executeRejection = async () => {
    if (!rejectingRequest) return;

    setActionLoading(rejectingRequest.id);
    setRejectDialogVisible(false);

    try {
      await updateDocument("turf_requests", rejectingRequest.id, {
        status: "rejected",
        rejectedBy: user?.userId || null,
        rejectedAt: serverTimestamp(),
        rejectionReason: rejectionReason.trim() || null,
        updatedAt: serverTimestamp(),
      });

      Alert.alert("Request Rejected", "The manager has been notified.");
      await fetchRequests();
      setDetailVisible(false);
    } catch (error) {
      console.error("Error rejecting turf request:", error);
      Alert.alert("Error", "Failed to reject request. Please try again.");
    } finally {
      setActionLoading(null);
      setRejectingRequest(null);
    }
  };

  // --- Render request card ---

  const renderRequestCard = ({ item }) => {
    const turfData = item.turfData || {};
    const groundCount = turfData.grounds?.length || turfData.totalGrounds || 0;
    const isPending = item.status === "pending";
    const isApproved = item.status === "approved";
    const isRejected = item.status === "rejected";
    const isActioning = actionLoading === item.id;

    return (
      <Surface style={styles.requestCard} elevation={2}>
        <TouchableOpacity
          onPress={() => {
            setSelectedRequest(item);
            setDetailVisible(true);
          }}
          activeOpacity={0.7}
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardIconContainer}>
              <MaterialCommunityIcons name="soccer-field" size={28} color={OWNER_COLOR} />
            </View>
            <View style={styles.cardTitleSection}>
              <Text variant="titleMedium" style={styles.cardTurfName}>
                {item.turfName || turfData.name || "Unnamed Turf"}
              </Text>
              <Text variant="bodySmall" style={styles.cardLocation}>
                {turfData.location?.city
                  ? `${turfData.location.city}${turfData.location.state ? `, ${turfData.location.state}` : ""}`
                  : "Location not set"}
              </Text>
            </View>
            {isPending && (
              <Chip
                mode="flat"
                style={styles.pendingChip}
                textStyle={styles.pendingChipText}
              >
                Pending
              </Chip>
            )}
            {isApproved && (
              <Chip
                mode="flat"
                style={styles.approvedChip}
                textStyle={styles.approvedChipText}
              >
                Approved
              </Chip>
            )}
            {isRejected && (
              <Chip
                mode="flat"
                style={styles.rejectedChip}
                textStyle={styles.rejectedChipText}
              >
                Rejected
              </Chip>
            )}
          </View>

          <Divider style={styles.cardDivider} />

          <View style={styles.cardMeta}>
            <View style={styles.metaItem}>
              <MaterialCommunityIcons name="account" size={16} color="#666" />
              <Text variant="bodySmall" style={styles.metaText}>
                {item.requestedByName || "Manager"}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <MaterialCommunityIcons name="land-plots" size={16} color="#666" />
              <Text variant="bodySmall" style={styles.metaText}>
                {groundCount} ground{groundCount !== 1 ? "s" : ""}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <MaterialCommunityIcons name="calendar" size={16} color="#666" />
              <Text variant="bodySmall" style={styles.metaText}>
                {formatDate(item.createdAt)}
              </Text>
            </View>
          </View>

          {isRejected && item.rejectionReason && (
            <View style={styles.rejectionBanner}>
              <MaterialCommunityIcons name="alert-circle" size={16} color="#D32F2F" />
              <Text variant="bodySmall" style={styles.rejectionText} numberOfLines={2}>
                {item.rejectionReason}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {isPending && (
          <View style={styles.cardActions}>
            <Button
              mode="outlined"
              onPress={() => {
                setSelectedRequest(item);
                setDetailVisible(true);
              }}
              style={styles.viewButton}
            >
              View Full
            </Button>
            <Button
              mode="outlined"
              onPress={() => openRejectDialog(item)}
              textColor="#F44336"
              style={styles.rejectButton}
              loading={isActioning}
              disabled={isActioning}
            >
              Reject
            </Button>
            <Button
              mode="contained"
              onPress={() => handleApprove(item)}
              buttonColor="#4CAF50"
              style={styles.approveButton}
              loading={isActioning}
              disabled={isActioning}
            >
              Approve
            </Button>
          </View>
        )}
      </Surface>
    );
  };

  // --- Detail dialog ---

  const renderDetailDialog = () => {
    if (!selectedRequest) return null;

    const turfData = selectedRequest.turfData || {};
    const requestCoverImage = isRemoteImageUri(turfData.coverImage) ? turfData.coverImage : null;
    const grounds = turfData.grounds || [];
    const isPending = selectedRequest.status === "pending";
    const operatingHours = turfData.operatingHours || {};
    const isActioning = actionLoading === selectedRequest.id;

    return (
      <Modal
        visible={detailVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={1}>
                {selectedRequest.turfName || turfData.name}
              </Text>
              <IconButton icon="close" size={22} iconColor={OWNER_COLOR} onPress={() => setDetailVisible(false)} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScrollArea}>
              <View style={styles.dialogBody}>
                {/* Requested by */}
                <View style={styles.dialogInfoRow}>
                  <MaterialCommunityIcons name="account" size={18} color="#666" />
                  <Text variant="bodyMedium" style={styles.dialogInfoText}>
                    Requested by {selectedRequest.requestedByName || "Manager"} on {formatDate(selectedRequest.createdAt)}
                  </Text>
                </View>

                {/* Cover Image */}
                {requestCoverImage && (
                  <Image
                    source={{ uri: requestCoverImage }}
                    style={styles.dialogCoverImage}
                    resizeMode="cover"
                  />
                )}

                {/* Description */}
                {turfData.description && (
                  <>
                    <Text variant="titleSmall" style={styles.dialogSectionTitle}>
                      Description
                    </Text>
                    <Text variant="bodyMedium" style={styles.dialogText}>
                      {turfData.description}
                    </Text>
                  </>
                )}

                <Divider style={styles.dialogDivider} />

                {/* Location */}
                <Text variant="titleSmall" style={styles.dialogSectionTitle}>
                  Location
                </Text>
                {turfData.location?.address && (
                  <Text variant="bodyMedium" style={styles.dialogText}>
                    {turfData.location.address}
                  </Text>
                )}
                <Text variant="bodyMedium" style={styles.dialogText}>
                  {[turfData.location?.city, turfData.location?.state, turfData.location?.pincode]
                    .filter(Boolean)
                    .join(", ") || "Not specified"}
                </Text>
                {turfData.location?.googleMapsLink && (
                  <View style={styles.dialogInfoRow}>
                    <MaterialCommunityIcons name="google-maps" size={16} color={OWNER_COLOR} />
                    <Text variant="bodySmall" style={{ color: OWNER_COLOR, marginLeft: 4 }} numberOfLines={1}>
                      Google Maps link provided
                    </Text>
                  </View>
                )}

                <Divider style={styles.dialogDivider} />

                {/* Operating Hours */}
                <Text variant="titleSmall" style={styles.dialogSectionTitle}>
                  Operating Hours
                </Text>
                {DAYS_ORDER.map((day) => {
                  const hours = operatingHours[day];
                  if (!hours) return null;
                  return (
                    <View key={day} style={styles.hoursRow}>
                      <Text variant="bodyMedium" style={styles.dayLabel}>
                        {DAY_LABELS[day]}
                      </Text>
                      {hours.isOpen ? (
                        <Text variant="bodyMedium" style={styles.hoursText}>
                          {formatTime(hours.openTime)} - {formatTime(hours.closeTime)}
                        </Text>
                      ) : (
                        <Text variant="bodyMedium" style={styles.closedText}>
                          Closed
                        </Text>
                      )}
                    </View>
                  );
                })}

                <Divider style={styles.dialogDivider} />

                {/* Grounds */}
                <Text variant="titleSmall" style={styles.dialogSectionTitle}>
                  Grounds ({grounds.length})
                </Text>
                {grounds.map((ground, index) => (
                  <Surface key={ground.groundId || index} style={styles.groundDetailCard} elevation={1}>
                    <Text variant="titleSmall" style={styles.groundName}>
                      {ground.name || `Ground ${index + 1}`}
                    </Text>

                    {ground.sports?.length > 0 && (
                      <View style={styles.chipRow}>
                        {ground.sports.map((sportId) => (
                          <Chip key={sportId} mode="outlined" style={styles.smallChip} textStyle={styles.smallChipText}>
                            {getSportName(sportId)}
                          </Chip>
                        ))}
                      </View>
                    )}

                    {ground.amenities?.length > 0 && (
                      <View style={styles.chipRow}>
                        {ground.amenities.map((amenityId) => (
                          <Chip key={amenityId} mode="outlined" style={styles.smallChip} textStyle={styles.smallChipText}>
                            {getAmenityName(amenityId)}
                          </Chip>
                        ))}
                      </View>
                    )}

                    {ground.pricing?.weekday?.morning?.rate && (
                      <View style={styles.pricingSummary}>
                        <Text variant="bodySmall" style={styles.pricingLabel}>
                          Weekday: ₹{ground.pricing.weekday.morning.rate} - ₹{ground.pricing.weekday.evening?.rate || ground.pricing.weekday.morning.rate}/hr
                        </Text>
                        {ground.pricing.weekend?.morning?.rate && (
                          <Text variant="bodySmall" style={styles.pricingLabel}>
                            Weekend: ₹{ground.pricing.weekend.morning.rate} - ₹{ground.pricing.weekend.evening?.rate || ground.pricing.weekend.morning.rate}/hr
                          </Text>
                        )}
                      </View>
                    )}
                    {ground.pricing?.allDayRate > 0 && (
                      <Text variant="bodySmall" style={styles.pricingLabel}>
                        All Day: ₹{ground.pricing.allDayRate}
                      </Text>
                    )}
                  </Surface>
                ))}

                {/* Rejection info */}
                {selectedRequest.status === "rejected" && selectedRequest.rejectionReason && (
                  <>
                    <Divider style={styles.dialogDivider} />
                    <View style={styles.rejectionDetailBanner}>
                      <MaterialCommunityIcons name="close-circle" size={20} color="#D32F2F" />
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text variant="titleSmall" style={{ color: "#D32F2F", fontWeight: "bold" }}>
                          Rejected
                        </Text>
                        <Text variant="bodyMedium" style={{ color: "#B71C1C", marginTop: 2 }}>
                          {selectedRequest.rejectionReason}
                        </Text>
                      </View>
                    </View>
                  </>
                )}

                {selectedRequest.status === "approved" && (
                  <>
                    <Divider style={styles.dialogDivider} />
                    <View style={styles.approvedDetailBanner}>
                      <MaterialCommunityIcons name="check-circle" size={20} color="#2E7D32" />
                      <Text variant="bodyMedium" style={{ color: "#2E7D32", marginLeft: 8 }}>
                        Approved on {formatDate(selectedRequest.approvedAt)}
                      </Text>
                    </View>
                  </>
                )}

                <View style={{ height: 16 }} />
              </View>
            </ScrollView>

            {/* Footer actions */}
            <View style={styles.modalActions}>
              <Button onPress={() => setDetailVisible(false)} style={{ flex: 1 }} textColor={OWNER_COLOR}>Close</Button>
              {isPending && (
                <Button
                  textColor="#F44336"
                  onPress={() => {
                    setDetailVisible(false);
                    openRejectDialog(selectedRequest);
                  }}
                  disabled={isActioning}
                  style={{ flex: 1 }}
                >
                  Reject
                </Button>
              )}
              {isPending && (
                <Button
                  mode="contained"
                  buttonColor="#4CAF50"
                  onPress={() => handleApprove(selectedRequest)}
                  loading={isActioning}
                  disabled={isActioning}
                  style={{ flex: 1 }}
                >
                  Approve
                </Button>
              )}
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  // --- Reject dialog ---

  const renderRejectDialog = () => (
    <Modal
      visible={rejectDialogVisible}
      transparent
      animationType="slide"
      onRequestClose={() => setRejectDialogVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { maxHeight: "50%" }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Reject Request</Text>
            <IconButton icon="close" size={22} iconColor={OWNER_COLOR} onPress={() => setRejectDialogVisible(false)} />
          </View>
          <View style={styles.dialogBody}>
            <Text variant="bodyMedium" style={{ marginBottom: 12, color: "#444" }}>
              Provide a reason for rejecting "{rejectingRequest?.turfName || rejectingRequest?.turfData?.name}":
            </Text>
            <TextInput
              mode="outlined"
              label="Rejection Reason (optional)"
              placeholder="e.g., Location too close to existing turf"
              value={rejectionReason}
              onChangeText={setRejectionReason}
              multiline
              numberOfLines={3}
              style={styles.rejectInput}
            />
          </View>
          <View style={styles.modalActions}>
            <Button onPress={() => setRejectDialogVisible(false)} style={{ flex: 1 }} textColor={OWNER_COLOR}>Cancel</Button>
            <Button
              mode="contained"
              buttonColor="#F44336"
              onPress={executeRejection}
              loading={actionLoading === rejectingRequest?.id}
              style={{ flex: 1 }}
            >
              Reject
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );

  // --- Main render ---

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.headerBar}>
          <IconButton icon="arrow-left" onPress={() => navigation.goBack()} />
          <Text variant="titleLarge" style={styles.headerTitle}>Turf Requests</Text>
          <View style={{ width: 48 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={OWNER_COLOR} />
        </View>
      </SafeAreaView>
    );
  }

  const pendingRequests = requests.filter((r) => r.status === "pending");

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerBar}>
        <IconButton icon="arrow-left" onPress={() => navigation.goBack()} />
        <Text variant="titleLarge" style={styles.headerTitle}>Turf Requests</Text>
        <View style={{ width: 48 }} />
      </View>

      {/* Tab chips for filtering */}
      <View style={styles.filterRow}>
        <Text variant="bodyMedium" style={styles.filterLabel}>
          {pendingRequests.length} pending
          {requests.length > pendingRequests.length
            ? ` · ${requests.length - pendingRequests.length} resolved`
            : ""}
        </Text>
      </View>

      {requests.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="file-check-outline" size={64} color="#ccc" />
          <Text variant="titleMedium" style={styles.emptyTitle}>
            No Turf Requests
          </Text>
          <Text variant="bodyMedium" style={styles.emptySubtitle}>
            When managers request new turfs, they'll appear here for your review.
          </Text>
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
              colors={[OWNER_COLOR]}
            />
          }
        />
      )}

      {renderDetailDialog()}
      {renderRejectDialog()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F0FF",
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
  filterRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  filterLabel: {
    color: "#666",
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
    marginBottom: 14,
    backgroundColor: "#fff",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  cardIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F3E5F5",
    justifyContent: "center",
    alignItems: "center",
  },
  cardTitleSection: {
    flex: 1,
    marginLeft: 12,
  },
  cardTurfName: {
    fontWeight: "bold",
  },
  cardLocation: {
    color: "#666",
    marginTop: 2,
  },
  pendingChip: {
    backgroundColor: "#FFF3E0",
    alignSelf: "center",
    paddingVertical: 5,
  },
  pendingChipText: {
    color: "#E65100",
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 16,
    marginVertical: 0,
  },
  approvedChip: {
    backgroundColor: "#E8F5E9",
    alignSelf: "center",
    paddingVertical: 5,
  },
  approvedChipText: {
    color: "#2E7D32",
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 16,
    marginVertical: 0,
  },
  rejectedChip: {
    backgroundColor: "#FFEBEE",
    alignSelf: "center",
    paddingVertical: 5,
  },
  rejectedChipText: {
    color: "#C62828",
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 16,
    marginVertical: 0,
  },
  cardDivider: {
    marginVertical: 12,
  },
  cardMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
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
  cardActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 14,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingTop: 12,
  },
  viewButton: {
    borderColor: "#999",
  },
  rejectButton: {
    borderColor: "#F44336",
  },
  approveButton: {},
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
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 20,
    paddingRight: 4,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  modalTitle: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 17,
    color: "#111827",
    flex: 1,
  },
  modalScrollArea: {
    flexShrink: 1,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    gap: 8,
  },
  dialogBody: {
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  dialogInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 6,
  },
  dialogInfoText: {
    color: "#666",
  },
  dialogCoverImage: {
    width: "100%",
    height: 160,
    borderRadius: 8,
    marginVertical: 8,
  },
  dialogSectionTitle: {
    fontWeight: "bold",
    marginBottom: 8,
    color: OWNER_COLOR,
  },
  dialogText: {
    marginBottom: 4,
    color: "#333",
  },
  dialogDivider: {
    marginVertical: 14,
  },
  hoursRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  dayLabel: {
    fontWeight: "600",
    width: 40,
  },
  hoursText: {
    color: "#333",
  },
  closedText: {
    color: "#F44336",
  },
  groundDetailCard: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: "#FAFAFA",
  },
  groundName: {
    fontWeight: "bold",
    marginBottom: 6,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 6,
  },
  smallChip: {
    alignSelf: "center",
    paddingVertical: 3,
  },
  smallChipText: {
    fontSize: 11,
    lineHeight: 16,
    marginVertical: 0,
  },
  pricingSummary: {
    marginTop: 4,
  },
  pricingLabel: {
    color: "#666",
    marginTop: 2,
  },
  rejectionDetailBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFEBEE",
    padding: 12,
    borderRadius: 8,
  },
  approvedDetailBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F5E9",
    padding: 12,
    borderRadius: 8,
  },
  rejectInput: {
    backgroundColor: "#fff",
  },
});
