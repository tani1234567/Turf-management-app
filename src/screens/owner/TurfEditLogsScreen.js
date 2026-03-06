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
  Menu,
  Divider,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSelector } from "react-redux";

import { selectCompany } from "../../store/slices/companySlice";
import { selectTurfs } from "../../store/slices/ownerSlice";
import { queryDocuments } from "../../services/firebase/firestore";

const OWNER_COLOR = "#9C27B0";
const PAGE_SIZE = 20;

const EDIT_TYPE_CONFIG = {
  pricing_update: {
    label: "Pricing",
    icon: "currency-inr",
    color: "#4CAF50",
    bgColor: "#E8F5E9",
  },
  timing_update: {
    label: "Hours",
    icon: "clock-outline",
    color: "#2196F3",
    bgColor: "#E3F2FD",
  },
  advance_settings: {
    label: "Advance Pay",
    icon: "credit-card-settings-outline",
    color: "#FF9800",
    bgColor: "#FFF3E0",
  },
  advance_payment_settings: {
    label: "Advance Pay",
    icon: "credit-card-settings-outline",
    color: "#FF9800",
    bgColor: "#FFF3E0",
  },
  ground_added: {
    label: "Ground Added",
    icon: "plus-circle-outline",
    color: "#4CAF50",
    bgColor: "#E8F5E9",
  },
  ground_removed: {
    label: "Ground Removed",
    icon: "minus-circle-outline",
    color: "#F44336",
    bgColor: "#FFEBEE",
  },
  details_update: {
    label: "Details",
    icon: "pencil-outline",
    color: "#9C27B0",
    bgColor: "#F3E5F5",
  },
};

const ROLE_LABELS = {
  owner: "Owner",
  manager: "Manager",
  admin: "Admin",
};

const formatTimestamp = (timestamp) => {
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
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatRelativeTime = (timestamp) => {
  if (!timestamp) return "";
  let date;
  if (timestamp.toDate) {
    date = timestamp.toDate();
  } else if (timestamp.seconds) {
    date = new Date(timestamp.seconds * 1000);
  } else {
    date = new Date(timestamp);
  }
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatTimestamp(timestamp);
};

export default function TurfEditLogsScreen({ navigation, route }) {
  const filterTurfId = route.params?.turfId || null;
  const filterTurfName = route.params?.turfName || null;

  const company = useSelector(selectCompany);
  const turfs = useSelector(selectTurfs);
  const companyId = company?.id || company?.companyId;

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);

  // Filters
  const [filterType, setFilterType] = useState(null);
  const [filterMenuVisible, setFilterMenuVisible] = useState(false);

  const fetchLogs = useCallback(async () => {
    if (!companyId) return;

    try {
      const filters = [];
      if (filterTurfId) {
        filters.push({ field: "turfId", operator: "==", value: filterTurfId });
      } else {
        filters.push({ field: "companyId", operator: "==", value: companyId });
      }

      const docs = await queryDocuments("turf_edit_logs", filters);

      // Sort by editedAt descending (client-side)
      const sorted = docs.sort((a, b) => {
        const aTime =
          a.editedAt?.seconds || a.timestamp?.seconds || 0;
        const bTime =
          b.editedAt?.seconds || b.timestamp?.seconds || 0;
        return bTime - aTime;
      });

      setLogs(sorted);
    } catch (error) {
      console.error("Error fetching edit logs:", error);
    } finally {
      setLoading(false);
    }
  }, [companyId, filterTurfId]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchLogs();
    setRefreshing(false);
  }, [fetchLogs]);

  const loadMore = () => {
    if (displayCount < filteredLogs.length) {
      setDisplayCount((prev) => prev + PAGE_SIZE);
    }
  };

  // Apply type filter
  const filteredLogs = filterType
    ? logs.filter((log) => {
        const logType = log.editType || log.changeType;
        return logType === filterType;
      })
    : logs;

  const displayedLogs = filteredLogs.slice(0, displayCount);

  // Get turf name from ID
  const getTurfName = (turfId) => {
    if (filterTurfName) return filterTurfName;
    const turf = turfs?.find(
      (t) => t.id === turfId || t.turfId === turfId
    );
    return turf?.name || turfId;
  };

  const renderLogItem = ({ item }) => {
    const editType = item.editType || item.changeType || "details_update";
    const config = EDIT_TYPE_CONFIG[editType] || EDIT_TYPE_CONFIG.details_update;
    const ts = item.editedAt || item.timestamp;
    const editorName = item.editedByName || item.changedByName || "Unknown";
    const editorRole = item.editedByRole || item.changedByRole || "";

    // Build change summary
    let summary = "";
    if (item.changes) {
      if (Array.isArray(item.changes)) {
        summary = item.changes.map((c) => c.summary).join("; ");
      } else if (item.changes.summary) {
        summary = item.changes.summary;
      }
    }
    if (!summary && editType === "advance_payment_settings") {
      summary = "Advance payment settings updated";
    }
    if (!summary) {
      summary = config.label + " change";
    }

    return (
      <Surface style={styles.logCard} elevation={1}>
        <View style={styles.logHeader}>
          <View style={[styles.logIconContainer, { backgroundColor: config.bgColor }]}>
            <MaterialCommunityIcons name={config.icon} size={20} color={config.color} />
          </View>
          <View style={styles.logInfo}>
            <Text variant="bodyMedium" style={styles.logSummary}>
              {summary}
            </Text>
            <View style={styles.logMeta}>
              <Text variant="bodySmall" style={styles.logEditor}>
                {editorName}
                {editorRole ? ` (${ROLE_LABELS[editorRole] || editorRole})` : ""}
              </Text>
              <Text variant="bodySmall" style={styles.logTime}>
                {formatRelativeTime(ts)}
              </Text>
            </View>
          </View>
          <Chip
            mode="flat"
            style={[styles.typeChip, { backgroundColor: config.bgColor }]}
            textStyle={{ color: config.color, fontSize: 10, fontWeight: "600" }}
          >
            {config.label}
          </Chip>
        </View>

        {/* Show turf name if viewing all turfs */}
        {!filterTurfId && item.turfId && (
          <View style={styles.logTurfRow}>
            <MaterialCommunityIcons name="soccer-field" size={14} color="#999" />
            <Text variant="bodySmall" style={styles.logTurfName}>
              {item.turfName || getTurfName(item.turfId)}
            </Text>
          </View>
        )}

        {/* Before/after values */}
        {item.changes && !Array.isArray(item.changes) && item.changes.oldValue !== undefined && (
          <View style={styles.changeValues}>
            <View style={styles.changeValueRow}>
              <Text variant="bodySmall" style={styles.changeLabel}>Before:</Text>
              <Text variant="bodySmall" style={styles.changeOldValue} numberOfLines={1}>
                {String(item.changes.oldValue)}
              </Text>
            </View>
            <View style={styles.changeValueRow}>
              <Text variant="bodySmall" style={styles.changeLabel}>After:</Text>
              <Text variant="bodySmall" style={styles.changeNewValue} numberOfLines={1}>
                {String(item.changes.newValue)}
              </Text>
            </View>
          </View>
        )}

        {/* Multiple changes */}
        {item.changes && Array.isArray(item.changes) && item.changes.length > 1 && (
          <View style={styles.multiChanges}>
            {item.changes.slice(0, 3).map((change, idx) => (
              <View key={idx} style={styles.multiChangeItem}>
                <MaterialCommunityIcons name="circle-small" size={16} color="#999" />
                <Text variant="bodySmall" style={styles.multiChangeText} numberOfLines={1}>
                  {change.summary}
                </Text>
              </View>
            ))}
            {item.changes.length > 3 && (
              <Text variant="bodySmall" style={styles.moreChanges}>
                +{item.changes.length - 3} more changes
              </Text>
            )}
          </View>
        )}

        {/* Full timestamp */}
        <Text variant="labelSmall" style={styles.fullTimestamp}>
          {formatTimestamp(ts)}
        </Text>
      </Surface>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.headerBar}>
          <IconButton icon="arrow-left" onPress={() => navigation.goBack()} />
          <Text variant="titleLarge" style={styles.headerTitle}>Edit History</Text>
          <View style={{ width: 48 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={OWNER_COLOR} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerBar}>
        <IconButton icon="arrow-left" onPress={() => navigation.goBack()} />
        <View style={{ flex: 1 }}>
          <Text variant="titleLarge" style={styles.headerTitle}>Edit History</Text>
          {filterTurfName && (
            <Text variant="bodySmall" style={styles.headerSubtitle}>{filterTurfName}</Text>
          )}
        </View>
        <Menu
          visible={filterMenuVisible}
          onDismiss={() => setFilterMenuVisible(false)}
          anchor={
            <IconButton
              icon="filter-variant"
              onPress={() => setFilterMenuVisible(true)}
              iconColor={filterType ? OWNER_COLOR : "#666"}
            />
          }
        >
          <Menu.Item
            title="All Types"
            onPress={() => { setFilterType(null); setFilterMenuVisible(false); }}
            leadingIcon={!filterType ? "check" : undefined}
          />
          <Divider />
          <Menu.Item
            title="Pricing"
            onPress={() => { setFilterType("pricing_update"); setFilterMenuVisible(false); }}
            leadingIcon="currency-inr"
          />
          <Menu.Item
            title="Operating Hours"
            onPress={() => { setFilterType("timing_update"); setFilterMenuVisible(false); }}
            leadingIcon="clock-outline"
          />
          <Menu.Item
            title="Advance Payment"
            onPress={() => { setFilterType("advance_payment_settings"); setFilterMenuVisible(false); }}
            leadingIcon="credit-card-settings-outline"
          />
          <Menu.Item
            title="Details"
            onPress={() => { setFilterType("details_update"); setFilterMenuVisible(false); }}
            leadingIcon="pencil-outline"
          />
          <Menu.Item
            title="Ground Added"
            onPress={() => { setFilterType("ground_added"); setFilterMenuVisible(false); }}
            leadingIcon="plus-circle-outline"
          />
          <Menu.Item
            title="Ground Removed"
            onPress={() => { setFilterType("ground_removed"); setFilterMenuVisible(false); }}
            leadingIcon="minus-circle-outline"
          />
        </Menu>
      </View>

      {/* Active filter indicator */}
      {filterType && (
        <View style={styles.activeFilter}>
          <Chip
            mode="flat"
            style={{ backgroundColor: EDIT_TYPE_CONFIG[filterType]?.bgColor || "#F3E5F5" }}
            textStyle={{ color: EDIT_TYPE_CONFIG[filterType]?.color || OWNER_COLOR }}
            onClose={() => setFilterType(null)}
          >
            {EDIT_TYPE_CONFIG[filterType]?.label || filterType}
          </Chip>
          <Text variant="bodySmall" style={styles.filterCount}>
            {filteredLogs.length} result{filteredLogs.length !== 1 ? "s" : ""}
          </Text>
        </View>
      )}

      {filteredLogs.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="history" size={64} color="#ccc" />
          <Text variant="titleMedium" style={styles.emptyTitle}>
            No Edit History
          </Text>
          <Text variant="bodyMedium" style={styles.emptySubtitle}>
            {filterType
              ? "No logs match the selected filter."
              : "Changes to turfs will be logged here."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={displayedLogs}
          keyExtractor={(item) => item.id}
          renderItem={renderLogItem}
          contentContainerStyle={styles.listContent}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[OWNER_COLOR]}
            />
          }
          ListFooterComponent={
            displayCount < filteredLogs.length ? (
              <View style={styles.loadingMore}>
                <ActivityIndicator size="small" color={OWNER_COLOR} />
              </View>
            ) : null
          }
        />
      )}
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
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    paddingRight: 4,
  },
  headerTitle: {
    fontWeight: "bold",
  },
  headerSubtitle: {
    color: "#666",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  activeFilter: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    gap: 8,
  },
  filterCount: {
    color: "#666",
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  logCard: {
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
    backgroundColor: "#fff",
  },
  logHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  logIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  logInfo: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
  },
  logSummary: {
    fontWeight: "600",
    lineHeight: 20,
  },
  logMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
    gap: 8,
  },
  logEditor: {
    color: "#666",
  },
  logTime: {
    color: "#999",
  },
  typeChip: {
    height: 22,
  },
  logTurfRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 4,
    paddingLeft: 46,
  },
  logTurfName: {
    color: "#999",
  },
  changeValues: {
    marginTop: 8,
    paddingLeft: 46,
    gap: 2,
  },
  changeValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  changeLabel: {
    color: "#999",
    width: 44,
  },
  changeOldValue: {
    color: "#F44336",
    flex: 1,
    textDecorationLine: "line-through",
  },
  changeNewValue: {
    color: "#4CAF50",
    flex: 1,
    fontWeight: "600",
  },
  multiChanges: {
    marginTop: 8,
    paddingLeft: 42,
  },
  multiChangeItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  multiChangeText: {
    color: "#666",
    flex: 1,
  },
  moreChanges: {
    color: "#999",
    marginLeft: 16,
    marginTop: 2,
  },
  fullTimestamp: {
    color: "#ccc",
    marginTop: 8,
    paddingLeft: 46,
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
  loadingMore: {
    paddingVertical: 16,
    alignItems: "center",
  },
});
