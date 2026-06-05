import { useState, useCallback, useMemo } from "react";
import { View, StyleSheet, FlatList, Alert, TouchableOpacity, LayoutAnimation, Platform, UIManager } from "react-native";
import { Text, Surface, IconButton, ActivityIndicator } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect } from "react";
import { queryDocuments, updateDocument } from "../../services/firebase/firestore";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const MANAGER_BLUE = "#3B82F6";

const SESSION_STATUS_CONFIG = {
  scheduled: { color: "#2196F3", bg: "#E3F2FD", label: "Scheduled" },
  completed: { color: "#4CAF50", bg: "#E8F5E9", label: "Completed" },
  cancelled: { color: "#F44336", bg: "#FFEBEE", label: "Cancelled" },
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const getTodayString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const getCurrentMonthKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const getMonthKey = (dateStr) => dateStr.slice(0, 7); // "YYYY-MM"

const formatMonthLabel = (monthKey) => {
  const [year, month] = monthKey.split("-");
  return `${MONTH_NAMES[parseInt(month, 10) - 1]} ${year}`;
};

const formatDate = (dateStr) => {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${parseInt(day)} ${months[parseInt(month) - 1]} ${year}`;
};

const formatTime = (timeStr) => {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${m} ${ampm}`;
};

const getDayOfWeek = (dateStr) => {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const date = new Date(y, mo - 1, d);
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  return days[date.getDay()];
};

function SessionItem({ session, onCancel, today }) {
  const statusCfg = SESSION_STATUS_CONFIG[session.status] || SESSION_STATUS_CONFIG.scheduled;
  const dayName = getDayOfWeek(session.date);
  const dayLabel = dayName.charAt(0).toUpperCase() + dayName.slice(1);
  const canCancel = session.status === "scheduled" && session.date >= today;

  return (
    <Surface style={styles.sessionCard} elevation={1}>
      <View style={styles.sessionCardRow}>
        <View style={{ flex: 1 }}>
          <View style={styles.sessionDateRow}>
            <Text style={styles.sessionDate}>{formatDate(session.date)}</Text>
            <Text style={styles.sessionDay}>{dayLabel}</Text>
          </View>
          <Text style={styles.sessionTime}>
            {formatTime(session.startTime)} - {formatTime(session.endTime)}
          </Text>
        </View>
        <View style={styles.sessionActions}>
          <View style={[styles.sessionStatusBadge, { backgroundColor: statusCfg.bg }]}>
            <Text style={[styles.sessionStatusText, { color: statusCfg.color }]}>
              {statusCfg.label}
            </Text>
          </View>
          {canCancel && (
            <IconButton
              icon="close-circle-outline"
              iconColor="#F44336"
              size={22}
              onPress={() => onCancel(session)}
              style={{ margin: 0 }}
            />
          )}
        </View>
      </View>
    </Surface>
  );
}

function MonthSection({ monthKey, sessions, isExpanded, onToggle, onCancel, today, isPast }) {
  const scheduled = sessions.filter((s) => s.status === "scheduled").length;
  const completed = sessions.filter((s) => s.status === "completed").length;
  const cancelled = sessions.filter((s) => s.status === "cancelled").length;

  return (
    <View style={styles.monthSection}>
      <TouchableOpacity
        style={[styles.monthHeader, isPast && styles.monthHeaderPast]}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <View style={styles.monthHeaderLeft}>
          <MaterialCommunityIcons
            name="calendar-month"
            size={18}
            color={isPast ? "#999" : MANAGER_BLUE}
          />
          <Text style={[styles.monthLabel, isPast && styles.monthLabelPast]}>
            {formatMonthLabel(monthKey)}
          </Text>
          {isPast && (
            <View style={styles.pastBadge}>
              <Text style={styles.pastBadgeText}>Past</Text>
            </View>
          )}
        </View>
        <View style={styles.monthHeaderRight}>
          <View style={styles.monthMiniStats}>
            {scheduled > 0 && (
              <View style={[styles.miniStat, { backgroundColor: "#E3F2FD" }]}>
                <Text style={[styles.miniStatText, { color: "#2196F3" }]}>{scheduled} sched</Text>
              </View>
            )}
            {completed > 0 && (
              <View style={[styles.miniStat, { backgroundColor: "#E8F5E9" }]}>
                <Text style={[styles.miniStatText, { color: "#4CAF50" }]}>{completed} done</Text>
              </View>
            )}
            {cancelled > 0 && (
              <View style={[styles.miniStat, { backgroundColor: "#FFEBEE" }]}>
                <Text style={[styles.miniStatText, { color: "#F44336" }]}>{cancelled} cancl</Text>
              </View>
            )}
          </View>
          <MaterialCommunityIcons
            name={isExpanded ? "chevron-up" : "chevron-down"}
            size={20}
            color={isPast ? "#999" : "#555"}
          />
        </View>
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.monthContent}>
          {sessions.map((session) => (
            <SessionItem
              key={session.id}
              session={session}
              onCancel={onCancel}
              today={today}
            />
          ))}
        </View>
      )}
    </View>
  );
}

export default function AcademySessionsScreen({ navigation, route }) {
  const { academyId, academyName } = route.params || {};

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedMonths, setExpandedMonths] = useState({});

  const today = getTodayString();
  const currentMonthKey = getCurrentMonthKey();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const results = await queryDocuments("academy_sessions", [
          { field: "academyId", operator: "==", value: academyId },
        ]);
        results.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
        setSessions(results);
      } catch {
        Alert.alert("Error", "Failed to load sessions.");
      } finally {
        setLoading(false);
      }
    };
    if (academyId) load();
  }, [academyId]);

  // Group sessions by month, separated into past / current+future
  const { pastGroups, presentFutureGroups } = useMemo(() => {
    const groupMap = {};
    for (const s of sessions) {
      const mk = getMonthKey(s.date);
      if (!groupMap[mk]) groupMap[mk] = [];
      groupMap[mk].push(s);
    }

    const allMonthKeys = Object.keys(groupMap).sort();
    const past = [];
    const presentFuture = [];

    for (const mk of allMonthKeys) {
      if (mk < currentMonthKey) {
        past.push({ monthKey: mk, sessions: groupMap[mk] });
      } else {
        presentFuture.push({ monthKey: mk, sessions: groupMap[mk] });
      }
    }

    return { pastGroups: past, presentFutureGroups: presentFuture };
  }, [sessions, currentMonthKey]);

  // On load: expand current month and future months, collapse past
  useEffect(() => {
    if (loading) return;
    const initial = {};
    for (const { monthKey } of presentFutureGroups) {
      initial[monthKey] = true;
    }
    // Past months default to collapsed (no entries needed, falsy = collapsed)
    setExpandedMonths(initial);
  }, [loading]);

  const toggleMonth = useCallback((monthKey) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedMonths((prev) => ({ ...prev, [monthKey]: !prev[monthKey] }));
  }, []);

  const handleCancelSession = useCallback((session) => {
    Alert.alert(
      "Cancel Session",
      `Cancel the session on ${formatDate(session.date)} (${formatTime(session.startTime)} - ${formatTime(session.endTime)})?\n\nThis will open the slot for regular bookings.`,
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            try {
              await updateDocument("academy_sessions", session.id, {
                status: "cancelled",
                availableForBooking: true,
              });
              setSessions((prev) =>
                prev.map((s) =>
                  s.id === session.id
                    ? { ...s, status: "cancelled", availableForBooking: true }
                    : s
                )
              );
            } catch {
              Alert.alert("Error", "Failed to cancel session.");
            }
          },
        },
      ]
    );
  }, []);

  const totalScheduled = sessions.filter((s) => s.status === "scheduled").length;
  const totalCompleted = sessions.filter((s) => s.status === "completed").length;
  const totalCancelled = sessions.filter((s) => s.status === "cancelled").length;

  const renderContent = () => {
    if (sessions.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="calendar-blank" size={48} color="#ccc" />
          <Text style={styles.emptyTitle}>No Sessions</Text>
          <Text style={styles.emptySubtitle}>
            Sessions will appear once they are generated.
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        data={[]}
        keyExtractor={() => ""}
        renderItem={null}
        ListHeaderComponent={
          <View style={styles.listContainer}>
            {/* Current + future months */}
            {presentFutureGroups.map(({ monthKey, sessions: mSessions }) => (
              <MonthSection
                key={monthKey}
                monthKey={monthKey}
                sessions={mSessions}
                isExpanded={!!expandedMonths[monthKey]}
                onToggle={() => toggleMonth(monthKey)}
                onCancel={handleCancelSession}
                today={today}
                isPast={false}
              />
            ))}

            {/* Past months */}
            {pastGroups.length > 0 && (
              <>
                {pastGroups.length > 0 && presentFutureGroups.length > 0 && (
                  <View style={styles.divider} />
                )}
                <Text style={styles.pastSectionLabel}>Previous Months</Text>
                {pastGroups.map(({ monthKey, sessions: mSessions }) => (
                  <MonthSection
                    key={monthKey}
                    monthKey={monthKey}
                    sessions={mSessions}
                    isExpanded={!!expandedMonths[monthKey]}
                    onToggle={() => toggleMonth(monthKey)}
                    onCancel={handleCancelSession}
                    today={today}
                    isPast={true}
                  />
                ))}
              </>
            )}

            <View style={{ height: 24 }} />
          </View>
        }
      />
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton icon="arrow-left" onPress={() => navigation.goBack()} />
        <Text variant="titleLarge" style={styles.headerTitle} numberOfLines={1}>
          {academyName ? `${academyName} — Sessions` : "Sessions"}
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={MANAGER_BLUE} />
        </View>
      ) : (
        <>
          {sessions.length > 0 && (
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statCount}>{totalScheduled}</Text>
                <Text style={styles.statLabel}>Scheduled</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statCount, { color: "#4CAF50" }]}>{totalCompleted}</Text>
                <Text style={styles.statLabel}>Completed</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statCount, { color: "#F44336" }]}>{totalCancelled}</Text>
                <Text style={styles.statLabel}>Cancelled</Text>
              </View>
            </View>
          )}
          {renderContent()}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F0F4F8" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingRight: 4,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  headerTitle: {
    fontWeight: "bold",
    color: "#333",
    flex: 1,
  },

  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },

  statsRow: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    paddingVertical: 12,
  },
  statItem: { flex: 1, alignItems: "center" },
  statCount: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 22,
    color: MANAGER_BLUE,
  },
  statLabel: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },

  listContainer: { padding: 12 },

  // Month section
  monthSection: {
    marginBottom: 8,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#fff",
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "#fff",
  },
  monthHeaderPast: {
    backgroundColor: "#FAFAFA",
  },
  monthHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  monthLabel: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 15,
    color: "#1a1a2e",
  },
  monthLabelPast: {
    color: "#888",
  },
  pastBadge: {
    backgroundColor: "#F0F0F0",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  pastBadgeText: {
    fontFamily: "Ubuntu-Medium",
    fontSize: 11,
    color: "#999",
  },
  monthHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  monthMiniStats: {
    flexDirection: "row",
    gap: 4,
  },
  miniStat: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  miniStatText: {
    fontFamily: "Ubuntu-Medium",
    fontSize: 10,
  },

  monthContent: {
    paddingHorizontal: 10,
    paddingBottom: 10,
    gap: 8,
  },

  // Past section divider
  divider: {
    height: 1,
    backgroundColor: "#E0E0E0",
    marginVertical: 12,
    marginHorizontal: 4,
  },
  pastSectionLabel: {
    fontFamily: "Ubuntu-Medium",
    fontSize: 12,
    color: "#999",
    marginBottom: 6,
    marginLeft: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // Session card
  sessionCard: {
    borderRadius: 10,
    backgroundColor: "#fff",
    padding: 12,
    marginTop: 2,
  },
  sessionCardRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  sessionDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  sessionDate: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 14,
    color: "#1a1a2e",
  },
  sessionDay: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 13,
    color: "#666",
  },
  sessionTime: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 13,
    color: "#444",
  },
  sessionActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  sessionStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  sessionStatusText: {
    fontFamily: "Ubuntu-Medium",
    fontSize: 12,
  },

  // Empty state
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 60,
    gap: 8,
  },
  emptyTitle: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 16,
    color: "#999",
  },
  emptySubtitle: {
    fontFamily: "Ubuntu-Regular",
    fontSize: 13,
    color: "#bbb",
    textAlign: "center",
  },
});
