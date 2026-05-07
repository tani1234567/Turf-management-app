import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Share,
  Dimensions,
} from "react-native";
import {
  Text,
  Surface,
  Button,
  ActivityIndicator,
  DataTable,
  IconButton,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Svg, { Rect, Line, Circle, Text as SvgText, Path, G } from "react-native-svg";
import { useSelector, useDispatch } from "react-redux";
import { selectCompany, selectSubscription, selectManagers } from "../../store/slices/companySlice";
import { selectTurfs, selectTotalGrounds, setTurfs } from "../../store/slices/ownerSlice";
import { queryDocuments, getDocument } from "../../services/firebase/firestore";
import { calculateSubscriptionPrice } from "../../utils/subscriptionPricing";

const OWNER_PURPLE = "#9C27B0";
const SCREEN_WIDTH = Dimensions.get("window").width;
const CHART_WIDTH = SCREEN_WIDTH - 64;
const CHART_HEIGHT = 180;

// ─── Date helpers ───

const toDateString = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const getToday = () => toDateString(new Date());

const getWeekStart = () => {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  return toDateString(d);
};

const getMonthStart = () => {
  const d = new Date();
  d.setDate(1);
  return toDateString(d);
};

const getSixMonthStart = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 5);
  d.setDate(1);
  return toDateString(d);
};

const getYearStart = () => {
  const d = new Date();
  d.setMonth(0);
  d.setDate(1);
  return toDateString(d);
};

const getDateRange = (range) => {
  const today = getToday();
  switch (range) {
    case "today":
      return { start: today, end: today, label: "Today" };
    case "week":
      return { start: getWeekStart(), end: today, label: "This Week" };
    case "month":
      return { start: getMonthStart(), end: today, label: "This Month" };
    case "6months":
      return { start: getSixMonthStart(), end: today, label: "Last 6 Months" };
    case "yearly":
      return { start: getYearStart(), end: today, label: "This Year" };
    default:
      return { start: getMonthStart(), end: today, label: "This Month" };
  }
};

const RANGE_LABELS = {
  today: "Today",
  week: "Week",
  month: "Month",
  "6months": "6 Months",
  yearly: "Yearly",
};

const getCollectedRevenue = (b) =>
  (b.payment?.advance?.totalCollected || 0) +
  (b.payment?.onGround?.totalCollected || 0) +
  (b.payment?.online?.totalCollected || 0);

const formatCurrency = (amount) => {
  if (amount >= 100000) return `Rs.${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `Rs.${(amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1)}K`;
  return `Rs.${amount}`;
};

// ─── Chart Colors ───
const CHART_COLORS = [
  "#9C27B0", "#4CAF50", "#2196F3", "#FF9800",
  "#F44336", "#00BCD4", "#795548", "#607D8B",
];

// ═══════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════
export default function OwnerAnalyticsDashboardScreen({ navigation }) {
  const dispatch = useDispatch();
  const company = useSelector(selectCompany);
  const subscription = useSelector(selectSubscription);
  const reduxTurfs = useSelector(selectTurfs);
  const reduxTotalGrounds = useSelector(selectTotalGrounds);
  const managerIds = useSelector(selectManagers);

  const [selectedRange, setSelectedRange] = useState("month");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [localTurfs, setLocalTurfs] = useState([]);
  const [managerNames, setManagerNames] = useState({});
  const [turfNames, setTurfNames] = useState({});
  const [sortColumn, setSortColumn] = useState("revenue");
  const [sortAsc, setSortAsc] = useState(false);
  const [tablePage, setTablePage] = useState(0);
  const TABLE_ROWS_PER_PAGE = 10;

  // Use Redux turfs if available, otherwise use locally fetched turfs
  const turfs = reduxTurfs && reduxTurfs.length > 0 ? reduxTurfs : localTurfs;
  const totalGrounds = reduxTurfs && reduxTurfs.length > 0
    ? reduxTotalGrounds
    : localTurfs.reduce((s, t) => s + (t.totalGrounds || t.grounds?.length || 1), 0);

  const dateRange = useMemo(() => getDateRange(selectedRange), [selectedRange]);

  // ── Fetch turfs from Firestore if Redux is empty ──
  useEffect(() => {
    if ((!reduxTurfs || reduxTurfs.length === 0) && company) {
      fetchTurfsFromFirestore();
    }
  }, [company, reduxTurfs]);

  const fetchTurfsFromFirestore = async () => {
    const companyId = company?.id || company?.companyId;
    if (!companyId) return;
    try {
      const fetchedTurfs = await queryDocuments("turfs", [
        { field: "companyId", operator: "==", value: companyId },
      ]);
      setLocalTurfs(fetchedTurfs);
      // Also populate Redux so other screens benefit
      if (fetchedTurfs.length > 0) {
        dispatch(setTurfs(fetchedTurfs));
      }
    } catch (error) {
      console.error("Error fetching turfs for analytics:", error);
    }
  };

  // ── Fetch analytics data ──
  useEffect(() => {
    if (turfs && turfs.length > 0) {
      fetchAnalyticsData();
    }
  }, [selectedRange, turfs]);

  const fetchAnalyticsData = async () => {
    if (!turfs || turfs.length === 0) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);

      // Build turf name map
      const names = {};
      turfs.forEach((t) => {
        names[t.id || t.turfId] = t.name || t.turfName || "Turf";
      });
      setTurfNames(names);

      // Fetch bookings for all company turfs
      const allBookings = [];
      for (const turf of turfs) {
        const turfId = turf.id || turf.turfId;
        const turfBookings = await queryDocuments("bookings", [
          { field: "turfId", operator: "==", value: turfId },
        ]);
        allBookings.push(...turfBookings.map((b) => ({ ...b, turfId })));
      }
      setBookings(allBookings);

      // Fetch manager names using getDocument (doc ID = userId)
      const allManagerIds = new Set(managerIds || []);
      // Also collect managerIds from turfs in case company.managers is incomplete
      turfs.forEach((t) => {
        (t.managerIds || t.managers || []).forEach((id) => allManagerIds.add(id));
      });

      if (allManagerIds.size > 0) {
        const mgrNames = {};
        for (const mgrId of allManagerIds) {
          try {
            const userDoc = await getDocument("users", mgrId);
            if (userDoc) {
              mgrNames[mgrId] = userDoc.name || userDoc.displayName || "Manager";
            } else {
              mgrNames[mgrId] = "Manager";
            }
          } catch {
            mgrNames[mgrId] = "Manager";
          }
        }
        setManagerNames(mgrNames);
      }
    } catch (error) {
      console.error("Error fetching owner analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Re-fetch turfs in case new ones were added
    await fetchTurfsFromFirestore();
    await fetchAnalyticsData();
    setRefreshing(false);
  }, [selectedRange, company]);

  // ── Check if 6month and yearly data is available ──
  const dataAvailability = useMemo(() => {
    const oldestBookingDate = bookings.reduce((min, b) => {
      if (!b.date) return min;
      return min === null || b.date < min ? b.date : min;
    }, null);

    if (!oldestBookingDate) return { has6Months: false, hasYearly: false };

    return {
      has6Months: oldestBookingDate <= getDateRange("6months").start,
      hasYearly: oldestBookingDate <= getDateRange("yearly").start,
    };
  }, [bookings]);

  const rangeOptions = useMemo(() => {
    const opts = ["today", "week", "month"];
    if (dataAvailability.has6Months) opts.push("6months");
    if (dataAvailability.hasYearly) opts.push("yearly");
    return opts;
  }, [dataAvailability]);

  // ── Filter bookings by date range ──
  const filteredBookings = useMemo(() => {
    return bookings.filter(
      (b) => b.date >= dateRange.start && b.date <= dateRange.end
    );
  }, [bookings, dateRange]);

  const confirmedBookings = useMemo(
    () =>
      filteredBookings.filter(
        (b) => b.status === "confirmed" || b.status === "completed"
      ),
    [filteredBookings]
  );

  // ═══════════════════════════════════════════
  // KPI CALCULATIONS
  // ═══════════════════════════════════════════

  const kpis = useMemo(() => {
    const totalBookings = confirmedBookings.length;
    const totalRevenue = confirmedBookings.reduce((sum, b) => sum + getCollectedRevenue(b), 0);
    const avgValue = totalBookings > 0 ? Math.round(totalRevenue / totalBookings) : 0;

    // Utilization
    const bookedHours = confirmedBookings.reduce(
      (sum, b) => sum + (b.duration || 1),
      0
    );
    const uniqueDates = [...new Set(confirmedBookings.map((b) => b.date))];
    const days = Math.max(uniqueDates.length, 1);
    const groundCount = totalGrounds || turfs.reduce((s, t) => s + (t.totalGrounds || t.grounds?.length || 1), 0);
    const availableHours = 16 * days * Math.max(groundCount, 1);
    const utilization = Math.min(100, Math.round((bookedHours / availableHours) * 100));

    // Cancellation rate
    const cancelledCount = filteredBookings.filter(
      (b) => b.status === "cancelled" || b.status === "rejected"
    ).length;
    const totalAttempted = filteredBookings.filter(
      (b) => !["expired", "pending_payment"].includes(b.status)
    ).length;
    const cancellationRate = totalAttempted > 0 ? Math.round((cancelledCount / totalAttempted) * 100) : 0;

    return {
      totalBookings,
      totalRevenue,
      utilization,
      avgValue,
      cancellationRate,
      totalTurfs: turfs.length,
      totalManagers: managerIds?.length || 0,
    };
  }, [confirmedBookings, filteredBookings, turfs, totalGrounds, managerIds]);

  // ═══════════════════════════════════════════
  // CROSS-TURF COMPARISON
  // ═══════════════════════════════════════════

  const turfComparison = useMemo(() => {
    const byTurf = {};
    confirmedBookings.forEach((b) => {
      const turfId = b.turfId;
      if (!byTurf[turfId]) {
        byTurf[turfId] = { revenue: 0, bookings: 0 };
      }
      byTurf[turfId].revenue += getCollectedRevenue(b);
      byTurf[turfId].bookings += 1;
    });
    return Object.entries(byTurf)
      .sort(([, a], [, b]) => b.revenue - a.revenue)
      .map(([turfId, data], i) => ({
        label: (turfNames[turfId] || "Turf").length > 10
          ? (turfNames[turfId] || "Turf").slice(0, 10) + "..."
          : turfNames[turfId] || "Turf",
        value: data.revenue,
        bookings: data.bookings,
        color: CHART_COLORS[i % CHART_COLORS.length],
        turfId,
      }));
  }, [confirmedBookings, turfNames]);

  // ═══════════════════════════════════════════
  // MANAGER PERFORMANCE
  // ═══════════════════════════════════════════

  const managerPerformance = useMemo(() => {
    // Map turfs to managers
    const turfManagerMap = {};
    turfs.forEach((t) => {
      const turfId = t.id || t.turfId;
      const managers = t.managerIds || t.managers || [];
      managers.forEach((mgrId) => {
        if (!turfManagerMap[mgrId]) turfManagerMap[mgrId] = [];
        turfManagerMap[mgrId].push(turfId);
      });
    });

    // Calculate per-manager stats
    const byManager = {};
    confirmedBookings.forEach((b) => {
      // Find which manager manages this turf
      Object.entries(turfManagerMap).forEach(([mgrId, turfIds]) => {
        if (turfIds.includes(b.turfId)) {
          if (!byManager[mgrId]) {
            byManager[mgrId] = { bookings: 0, revenue: 0 };
          }
          byManager[mgrId].bookings += 1;
          byManager[mgrId].revenue += getCollectedRevenue(b);
        }
      });
    });

    return Object.entries(byManager)
      .sort(([, a], [, b]) => b.revenue - a.revenue)
      .map(([mgrId, data]) => ({
        id: mgrId,
        name: managerNames[mgrId] || "Manager",
        bookings: data.bookings,
        revenue: data.revenue,
        avgValue: data.bookings > 0 ? Math.round(data.revenue / data.bookings) : 0,
      }));
  }, [confirmedBookings, turfs, managerNames]);

  // ═══════════════════════════════════════════
  // REVENUE TREND
  // ═══════════════════════════════════════════

  const revenueTrend = useMemo(() => {
    const byDate = {};
    confirmedBookings.forEach((b) => {
      byDate[b.date] = (byDate[b.date] || 0) + getCollectedRevenue(b);
    });
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, amount]) => ({
        label: date.slice(5),
        value: amount,
      }));
  }, [confirmedBookings]);

  // ═══════════════════════════════════════════
  // PAYMENT ANALYTICS
  // ═══════════════════════════════════════════

  const paymentAnalytics = useMemo(() => {
    let upiAdvanceTotal = 0;
    let cashAtVenue = 0;
    let onlineAtVenue = 0;
    let totalVerified = 0;
    let totalSubmitted = 0;
    let totalVerificationTimeMs = 0;
    let verificationCount = 0;
    let timedOutCount = 0;
    let totalPaymentBookings = 0;

    confirmedBookings.forEach((b) => {
      const payment = b.payment || {};
      const advance = payment.advanceAmount || payment.advance?.amount || 0;
      const total = b.totalAmount || b.totalPrice || payment.slotAmount || b.amount || 0;
      const remaining = total - advance;

      if (advance > 0) {
        upiAdvanceTotal += advance;
        totalPaymentBookings++;
      }

      if (remaining > 0) {
        const method = payment.remainingPaymentMethod || payment.paymentMethod || "cash";
        if (method === "cash") {
          cashAtVenue += remaining;
        } else {
          onlineAtVenue += remaining;
        }
      }

      // Verification tracking
      if (payment.advance?.verification?.isVerified || payment.advance?.status === "verified") {
        totalVerified++;
        // Calculate verification time if timestamps available
        const submittedAt = payment.advance?.submittedAt;
        const verifiedAt = payment.advance?.verification?.verifiedAt || payment.advance?.verifiedAt;
        if (submittedAt && verifiedAt) {
          const subTime = typeof submittedAt === "object" && submittedAt.toDate
            ? submittedAt.toDate().getTime()
            : new Date(submittedAt).getTime();
          const verTime = typeof verifiedAt === "object" && verifiedAt.toDate
            ? verifiedAt.toDate().getTime()
            : new Date(verifiedAt).getTime();
          if (verTime > subTime) {
            totalVerificationTimeMs += (verTime - subTime);
            verificationCount++;
          }
        }
      }
      if (payment.advance?.status === "submitted" || payment.advance?.status === "verified") {
        totalSubmitted++;
      }
    });

    // Check timed-out bookings from all filtered (not just confirmed)
    filteredBookings.forEach((b) => {
      if (b.status === "expired" || b.status === "payment_timeout") {
        timedOutCount++;
      }
    });

    const verificationRate = totalSubmitted > 0
      ? Math.round((totalVerified / totalSubmitted) * 100)
      : 0;

    const avgVerificationTimeMin = verificationCount > 0
      ? Math.round(totalVerificationTimeMs / verificationCount / 60000)
      : 0;

    const timeoutRate = (totalPaymentBookings + timedOutCount) > 0
      ? Math.round((timedOutCount / (totalPaymentBookings + timedOutCount)) * 100)
      : 0;

    return {
      upiAdvanceTotal,
      cashAtVenue,
      onlineAtVenue,
      total: upiAdvanceTotal + cashAtVenue + onlineAtVenue,
      verificationRate,
      totalVerified,
      totalSubmitted,
      avgVerificationTimeMin,
      timeoutRate,
      timedOutCount,
    };
  }, [confirmedBookings, filteredBookings]);

  // ═══════════════════════════════════════════
  // SUBSCRIPTION ROI
  // ═══════════════════════════════════════════

  const subscriptionROI = useMemo(() => {
    const grounds = totalGrounds || turfs.reduce((s, t) => s + (t.totalGrounds || t.grounds?.length || 1), 0);
    const pricing = calculateSubscriptionPrice(grounds, 1);
    const monthlySubscriptionCost = pricing.finalAmount;

    // Calculate monthly revenue based on selected range
    let monthlyRevenue = kpis.totalRevenue;
    if (selectedRange === "today") {
      monthlyRevenue = kpis.totalRevenue * 30;
    } else if (selectedRange === "week") {
      monthlyRevenue = kpis.totalRevenue * 4.3;
    } else if (selectedRange === "6months") {
      monthlyRevenue = Math.round(kpis.totalRevenue / 6);
    } else if (selectedRange === "yearly") {
      monthlyRevenue = Math.round(kpis.totalRevenue / 12);
    }

    const roi = monthlySubscriptionCost > 0
      ? Math.round(((monthlyRevenue - monthlySubscriptionCost) / monthlySubscriptionCost) * 100)
      : 0;

    const revenuePerGround = grounds > 0 ? Math.round(monthlyRevenue / grounds) : 0;

    return {
      monthlySubscriptionCost,
      monthlyRevenue: Math.round(monthlyRevenue),
      roi,
      revenuePerGround,
      grounds,
      pricePerGround: pricing.pricePerGround,
    };
  }, [kpis, totalGrounds, turfs, selectedRange]);

  // ═══════════════════════════════════════════
  // MANAGER TABLE SORT
  // ═══════════════════════════════════════════

  const sortedManagerData = useMemo(() => {
    return [...managerPerformance].sort((a, b) => {
      let valA, valB;
      switch (sortColumn) {
        case "name":
          valA = a.name.toLowerCase();
          valB = b.name.toLowerCase();
          break;
        case "bookings":
          valA = a.bookings;
          valB = b.bookings;
          break;
        case "revenue":
          valA = a.revenue;
          valB = b.revenue;
          break;
        case "avgValue":
          valA = a.avgValue;
          valB = b.avgValue;
          break;
        default:
          valA = a.revenue;
          valB = b.revenue;
      }
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [managerPerformance, sortColumn, sortAsc]);

  const paginatedManagers = useMemo(() => {
    const start = tablePage * TABLE_ROWS_PER_PAGE;
    return sortedManagerData.slice(start, start + TABLE_ROWS_PER_PAGE);
  }, [sortedManagerData, tablePage]);

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortAsc(!sortAsc);
    } else {
      setSortColumn(column);
      setSortAsc(column === "name");
    }
  };

  // ═══════════════════════════════════════════
  // EXPORT
  // ═══════════════════════════════════════════

  const handleExport = async () => {
    if (confirmedBookings.length === 0) {
      Alert.alert("No Data", "No bookings to export for this period.");
      return;
    }

    const header = "Date,Turf,Customer,Sport,Ground,Time,Duration(hrs),Amount Collected,Payment Method,Status";
    const rows = confirmedBookings.map((b) => {
      const amount = getCollectedRevenue(b);
      const method = b.payment?.remainingPaymentMethod || b.payment?.paymentMethod || "cash";
      return [
        b.date,
        `"${(turfNames[b.turfId] || "Turf").replace(/"/g, '""')}"`,
        `"${(b.userName || b.customerName || "Customer").replace(/"/g, '""')}"`,
        b.sport || "",
        b.groundName || b.groundId || "",
        `${b.startTime || ""}-${b.endTime || ""}`,
        b.duration || 1,
        amount,
        method,
        b.status,
      ].join(",");
    });

    const csv = [header, ...rows].join("\n");

    const summary = [
      "",
      `\nOwner Analytics Summary (${dateRange.label}: ${dateRange.start} to ${dateRange.end})`,
      `Total Bookings,${kpis.totalBookings}`,
      `Total Revenue,${kpis.totalRevenue}`,
      `Avg Booking Value,${kpis.avgValue}`,
      `Utilization,${kpis.utilization}%`,
      `Cancellation Rate,${kpis.cancellationRate}%`,
      "",
      "Turf-wise Revenue",
      ...turfComparison.map((t) => `${turfNames[t.turfId] || t.label},${t.value}`),
      "",
      "Manager Performance",
      ...managerPerformance.map((m) => `${m.name},Bookings:${m.bookings},Revenue:${m.revenue}`),
      "",
      "Payment Analytics",
      `UPI Advance Total,${paymentAnalytics.upiAdvanceTotal}`,
      `Cash at Venue,${paymentAnalytics.cashAtVenue}`,
      `Online at Venue,${paymentAnalytics.onlineAtVenue}`,
      `Verification Rate,${paymentAnalytics.verificationRate}%`,
      `Avg Verification Time,${paymentAnalytics.avgVerificationTimeMin} min`,
      `Timeout Rate,${paymentAnalytics.timeoutRate}%`,
      "",
      "Subscription ROI",
      `Monthly Cost,${subscriptionROI.monthlySubscriptionCost}`,
      `Monthly Revenue (est),${subscriptionROI.monthlyRevenue}`,
      `ROI,${subscriptionROI.roi}%`,
    ].join("\n");

    try {
      await Share.share({
        message: csv + summary,
        title: `Owner_Analytics_${dateRange.start}_to_${dateRange.end}.csv`,
      });
    } catch (error) {
      console.error("Export error:", error);
    }
  };

  // ═══════════════════════════════════════════
  // CHART RENDERERS
  // ═══════════════════════════════════════════

  const renderBarChart = (data, { height = CHART_HEIGHT, barColor, showLabels = true, unit = "" }) => {
    if (data.length === 0) return renderEmptyChart("No data for this period");
    const maxVal = Math.max(...data.map((d) => d.value), 1);
    const barWidth = Math.min(32, Math.max(12, (CHART_WIDTH - 40) / data.length - 4));
    const chartW = Math.max(CHART_WIDTH, data.length * (barWidth + 6) + 40);
    const chartH = height;
    const plotH = chartH - 36;

    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Svg width={chartW} height={chartH}>
          {[0, 0.25, 0.5, 0.75, 1].map((frac) => (
            <Line
              key={frac}
              x1={30}
              y1={plotH - frac * plotH + 4}
              x2={chartW}
              y2={plotH - frac * plotH + 4}
              stroke="#eee"
              strokeWidth={1}
            />
          ))}
          {data.map((d, i) => {
            const barH = (d.value / maxVal) * (plotH - 8);
            const x = 36 + i * (barWidth + 6);
            return (
              <G key={i}>
                <Rect
                  x={x}
                  y={plotH - barH + 4}
                  width={barWidth}
                  height={barH}
                  rx={4}
                  fill={d.color || barColor || OWNER_PURPLE}
                  opacity={0.85}
                />
                {showLabels && (
                  <SvgText
                    x={x + barWidth / 2}
                    y={chartH - 2}
                    fontSize={9}
                    fill="#666"
                    textAnchor="middle"
                  >
                    {d.label}
                  </SvgText>
                )}
                {d.value > 0 && (
                  <SvgText
                    x={x + barWidth / 2}
                    y={plotH - barH - 2}
                    fontSize={9}
                    fill="#333"
                    textAnchor="middle"
                  >
                    {unit === "Rs" ? formatCurrency(d.value) : `${d.value}${unit}`}
                  </SvgText>
                )}
              </G>
            );
          })}
        </Svg>
      </ScrollView>
    );
  };

  const renderLineChart = (data) => {
    if (data.length === 0) return renderEmptyChart("No revenue data");
    const maxVal = Math.max(...data.map((d) => d.value), 1);
    const chartW = Math.max(CHART_WIDTH, data.length * 50 + 40);
    const chartH = CHART_HEIGHT;
    const plotH = chartH - 36;
    const plotW = chartW - 40;

    const points = data.map((d, i) => ({
      x: 40 + (i / Math.max(data.length - 1, 1)) * plotW,
      y: plotH - (d.value / maxVal) * (plotH - 8) + 4,
    }));

    const pathD = points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
      .join(" ");

    const areaD = `${pathD} L ${points[points.length - 1].x} ${plotH + 4} L ${points[0].x} ${plotH + 4} Z`;

    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Svg width={chartW} height={chartH}>
          {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
            const y = plotH - frac * plotH + 4;
            return (
              <G key={frac}>
                <Line x1={36} y1={y} x2={chartW} y2={y} stroke="#eee" strokeWidth={1} />
                <SvgText x={2} y={y + 3} fontSize={8} fill="#999">
                  {formatCurrency(Math.round(maxVal * frac))}
                </SvgText>
              </G>
            );
          })}
          <Path d={areaD} fill={`${OWNER_PURPLE}15`} />
          <Path d={pathD} fill="none" stroke={OWNER_PURPLE} strokeWidth={2.5} />
          {points.map((p, i) => (
            <G key={i}>
              <Circle cx={p.x} cy={p.y} r={4} fill="#fff" stroke={OWNER_PURPLE} strokeWidth={2} />
              <SvgText x={p.x} y={chartH - 2} fontSize={9} fill="#666" textAnchor="middle">
                {data[i].label}
              </SvgText>
            </G>
          ))}
        </Svg>
      </ScrollView>
    );
  };

  const renderEmptyChart = (message) => (
    <View style={styles.emptyChart}>
      <MaterialCommunityIcons name="chart-line" size={32} color="#ddd" />
      <Text style={styles.emptyChartText}>{message}</Text>
    </View>
  );

  // ═══════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════

  if (loading && bookings.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={OWNER_PURPLE} />
          <Text style={styles.loadingText}>Loading analytics...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[OWNER_PURPLE]} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#333" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Company Analytics</Text>
            <Text style={styles.headerSubtitle}>
              {company?.name || "Company"} - {dateRange.label}
            </Text>
          </View>
          <IconButton
            icon="export-variant"
            size={22}
            iconColor={OWNER_PURPLE}
            onPress={handleExport}
            style={styles.exportButton}
          />
        </View>

        {/* Date Range Selector */}
        <View style={styles.dateRangeRow}>
          {rangeOptions.map((range) => (
            <TouchableOpacity
              key={range}
              style={[
                styles.dateChip,
                selectedRange === range && styles.dateChipActive,
              ]}
              onPress={() => { setSelectedRange(range); setTablePage(0); }}
            >
              <Text
                style={[
                  styles.dateChipText,
                  selectedRange === range && styles.dateChipTextActive,
                ]}
              >
                {RANGE_LABELS[range] ?? range}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* KPI Cards */}
        <View style={styles.kpiGrid}>
          {[
            { label: "Revenue", value: formatCurrency(kpis.totalRevenue), icon: "currency-inr", color: "#4CAF50" },
            { label: "Bookings", value: String(kpis.totalBookings), icon: "calendar-check", color: "#2196F3" },
            { label: "Turfs", value: String(kpis.totalTurfs), icon: "soccer-field", color: OWNER_PURPLE },
            { label: "Managers", value: String(kpis.totalManagers), icon: "account-tie", color: "#FF9800" },
            { label: "Utilization", value: `${kpis.utilization}%`, icon: "chart-arc", color: "#00BCD4" },
            { label: "Cancellation", value: `${kpis.cancellationRate}%`, icon: "cancel", color: "#F44336" },
          ].map((kpi) => (
            <Surface key={kpi.label} style={styles.kpiCard} elevation={1}>
              <View style={[styles.kpiIcon, { backgroundColor: `${kpi.color}15` }]}>
                <MaterialCommunityIcons name={kpi.icon} size={20} color={kpi.color} />
              </View>
              <Text style={[styles.kpiValue, { color: kpi.color }]}>{kpi.value}</Text>
              <Text style={styles.kpiLabel}>{kpi.label}</Text>
            </Surface>
          ))}
        </View>

        {/* Revenue Trend */}
        <Surface style={styles.chartCard} elevation={1}>
          <Text style={styles.chartTitle}>Revenue Trend</Text>
          {renderLineChart(revenueTrend)}
        </Surface>

        {/* Cross-Turf Comparison */}
        <Surface style={styles.chartCard} elevation={1}>
          <Text style={styles.chartTitle}>Revenue by Turf</Text>
          {renderBarChart(turfComparison, { barColor: OWNER_PURPLE, unit: "Rs" })}
          {turfComparison.length > 0 && (
            <View style={styles.turfLegend}>
              {turfComparison.map((t, i) => (
                <View key={i} style={styles.turfLegendItem}>
                  <View style={[styles.legendDot, { backgroundColor: t.color }]} />
                  <Text style={styles.legendLabel}>{t.label}</Text>
                  <Text style={styles.legendValue}>
                    {formatCurrency(t.value)} ({t.bookings} bookings)
                  </Text>
                </View>
              ))}
            </View>
          )}
        </Surface>

        {/* Manager Performance Table */}
        <Surface style={styles.chartCard} elevation={1}>
          <Text style={styles.chartTitle}>Manager Performance</Text>
          {managerPerformance.length === 0 ? (
            renderEmptyChart("No manager data available")
          ) : (
            <DataTable>
              <DataTable.Header>
                <DataTable.Title
                  sortDirection={sortColumn === "name" ? (sortAsc ? "ascending" : "descending") : undefined}
                  onPress={() => handleSort("name")}
                >
                  Manager
                </DataTable.Title>
                <DataTable.Title
                  numeric
                  sortDirection={sortColumn === "bookings" ? (sortAsc ? "ascending" : "descending") : undefined}
                  onPress={() => handleSort("bookings")}
                >
                  Bookings
                </DataTable.Title>
                <DataTable.Title
                  numeric
                  sortDirection={sortColumn === "revenue" ? (sortAsc ? "ascending" : "descending") : undefined}
                  onPress={() => handleSort("revenue")}
                >
                  Revenue
                </DataTable.Title>
                <DataTable.Title
                  numeric
                  sortDirection={sortColumn === "avgValue" ? (sortAsc ? "ascending" : "descending") : undefined}
                  onPress={() => handleSort("avgValue")}
                >
                  Avg
                </DataTable.Title>
              </DataTable.Header>

              {paginatedManagers.map((m) => (
                <DataTable.Row key={m.id}>
                  <DataTable.Cell>{m.name.slice(0, 12)}</DataTable.Cell>
                  <DataTable.Cell numeric>{m.bookings}</DataTable.Cell>
                  <DataTable.Cell numeric>{formatCurrency(m.revenue)}</DataTable.Cell>
                  <DataTable.Cell numeric>{formatCurrency(m.avgValue)}</DataTable.Cell>
                </DataTable.Row>
              ))}

              {sortedManagerData.length > TABLE_ROWS_PER_PAGE && (
                <DataTable.Pagination
                  page={tablePage}
                  numberOfPages={Math.ceil(sortedManagerData.length / TABLE_ROWS_PER_PAGE)}
                  onPageChange={(page) => setTablePage(page)}
                  label={`${tablePage * TABLE_ROWS_PER_PAGE + 1}-${Math.min(
                    (tablePage + 1) * TABLE_ROWS_PER_PAGE,
                    sortedManagerData.length
                  )} of ${sortedManagerData.length}`}
                  showFastPaginationControls
                />
              )}
            </DataTable>
          )}
        </Surface>

        {/* Financial Summary & Subscription ROI */}
        <Surface style={styles.chartCard} elevation={1}>
          <Text style={styles.chartTitle}>Subscription ROI</Text>

          <View style={styles.roiGrid}>
            <View style={styles.roiItem}>
              <Text style={styles.roiLabel}>Monthly Revenue (est.)</Text>
              <Text style={[styles.roiValue, { color: "#4CAF50" }]}>
                {formatCurrency(subscriptionROI.monthlyRevenue)}
              </Text>
            </View>
            <View style={styles.roiItem}>
              <Text style={styles.roiLabel}>Subscription Cost/mo</Text>
              <Text style={[styles.roiValue, { color: "#F44336" }]}>
                {formatCurrency(subscriptionROI.monthlySubscriptionCost)}
              </Text>
            </View>
          </View>

          <View style={styles.roiGrid}>
            <View style={styles.roiItem}>
              <Text style={styles.roiLabel}>ROI</Text>
              <Text style={[styles.roiValue, {
                color: subscriptionROI.roi >= 0 ? "#4CAF50" : "#F44336"
              }]}>
                {subscriptionROI.roi >= 0 ? "+" : ""}{subscriptionROI.roi}%
              </Text>
            </View>
            <View style={styles.roiItem}>
              <Text style={styles.roiLabel}>Revenue/Ground</Text>
              <Text style={[styles.roiValue, { color: OWNER_PURPLE }]}>
                {formatCurrency(subscriptionROI.revenuePerGround)}
              </Text>
            </View>
          </View>

          {/* ROI Visual Bar */}
          <View style={styles.roiBarContainer}>
            <View style={styles.roiBarLabel}>
              <Text style={styles.roiBarText}>Cost</Text>
              <Text style={styles.roiBarText}>Revenue</Text>
            </View>
            <View style={styles.roiBar}>
              <View
                style={[
                  styles.roiBarSegment,
                  {
                    flex: subscriptionROI.monthlySubscriptionCost,
                    backgroundColor: "#F44336",
                    borderTopLeftRadius: 4,
                    borderBottomLeftRadius: 4,
                  },
                ]}
              />
              <View
                style={[
                  styles.roiBarSegment,
                  {
                    flex: Math.max(subscriptionROI.monthlyRevenue - subscriptionROI.monthlySubscriptionCost, 0),
                    backgroundColor: "#4CAF50",
                    borderTopRightRadius: 4,
                    borderBottomRightRadius: 4,
                  },
                ]}
              />
            </View>
            <View style={styles.roiBarDetail}>
              <Text style={styles.roiDetailText}>
                {subscriptionROI.grounds} grounds x Rs.{subscriptionROI.pricePerGround}/mo
              </Text>
            </View>
          </View>
        </Surface>

        {/* Payment Analytics */}
        <Surface style={styles.chartCard} elevation={1}>
          <Text style={styles.chartTitle}>Payment Analytics</Text>

          <View style={styles.paymentGrid}>
            {[
              { label: "UPI Advance", value: paymentAnalytics.upiAdvanceTotal, color: "#2196F3", icon: "cellphone" },
              { label: "Cash at Venue", value: paymentAnalytics.cashAtVenue, color: "#4CAF50", icon: "cash" },
              { label: "Online at Venue", value: paymentAnalytics.onlineAtVenue, color: OWNER_PURPLE, icon: "credit-card" },
            ].map((item) => (
              <View key={item.label} style={styles.paymentItem}>
                <View style={[styles.paymentIcon, { backgroundColor: `${item.color}15` }]}>
                  <MaterialCommunityIcons name={item.icon} size={20} color={item.color} />
                </View>
                <Text style={styles.paymentItemLabel}>{item.label}</Text>
                <Text style={[styles.paymentItemValue, { color: item.color }]}>
                  {formatCurrency(item.value)}
                </Text>
              </View>
            ))}
          </View>

          {/* Payment bar */}
          {paymentAnalytics.total > 0 && (
            <View style={styles.paymentBarContainer}>
              <View style={styles.paymentBar}>
                {paymentAnalytics.upiAdvanceTotal > 0 && (
                  <View
                    style={[
                      styles.paymentBarSegment,
                      {
                        flex: paymentAnalytics.upiAdvanceTotal / paymentAnalytics.total,
                        backgroundColor: "#2196F3",
                        borderTopLeftRadius: 4,
                        borderBottomLeftRadius: 4,
                      },
                    ]}
                  />
                )}
                {paymentAnalytics.cashAtVenue > 0 && (
                  <View
                    style={[
                      styles.paymentBarSegment,
                      {
                        flex: paymentAnalytics.cashAtVenue / paymentAnalytics.total,
                        backgroundColor: "#4CAF50",
                      },
                    ]}
                  />
                )}
                {paymentAnalytics.onlineAtVenue > 0 && (
                  <View
                    style={[
                      styles.paymentBarSegment,
                      {
                        flex: paymentAnalytics.onlineAtVenue / paymentAnalytics.total,
                        backgroundColor: OWNER_PURPLE,
                        borderTopRightRadius: 4,
                        borderBottomRightRadius: 4,
                      },
                    ]}
                  />
                )}
              </View>
              <Text style={styles.paymentTotal}>
                Total: {formatCurrency(paymentAnalytics.total)}
              </Text>
            </View>
          )}

          {/* Verification & Timeout Stats */}
          <View style={styles.paymentStatsGrid}>
            <View style={styles.paymentStatItem}>
              <MaterialCommunityIcons name="shield-check" size={20} color="#4CAF50" />
              <Text style={styles.paymentStatLabel}>Verification Rate</Text>
              <Text style={[styles.paymentStatValue, { color: "#4CAF50" }]}>
                {paymentAnalytics.verificationRate}%
              </Text>
              <Text style={styles.paymentStatDetail}>
                {paymentAnalytics.totalVerified}/{paymentAnalytics.totalSubmitted}
              </Text>
            </View>
            <View style={styles.paymentStatItem}>
              <MaterialCommunityIcons name="clock-check" size={20} color="#2196F3" />
              <Text style={styles.paymentStatLabel}>Avg Verify Time</Text>
              <Text style={[styles.paymentStatValue, { color: "#2196F3" }]}>
                {paymentAnalytics.avgVerificationTimeMin > 0
                  ? `${paymentAnalytics.avgVerificationTimeMin} min`
                  : "N/A"}
              </Text>
            </View>
            <View style={styles.paymentStatItem}>
              <MaterialCommunityIcons name="timer-off" size={20} color="#F44336" />
              <Text style={styles.paymentStatLabel}>Timeout Rate</Text>
              <Text style={[styles.paymentStatValue, { color: "#F44336" }]}>
                {paymentAnalytics.timeoutRate}%
              </Text>
              <Text style={styles.paymentStatDetail}>
                {paymentAnalytics.timedOutCount} expired
              </Text>
            </View>
          </View>
        </Surface>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F0FF",
  },
  scrollContent: {
    paddingBottom: 16,
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

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#666",
  },
  exportButton: {
    backgroundColor: "#F3E5F5",
  },

  // Date range
  dateRangeRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  dateChip: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  dateChipActive: {
    backgroundColor: OWNER_PURPLE,
    borderColor: OWNER_PURPLE,
  },
  dateChipText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  dateChipTextActive: {
    color: "#fff",
  },

  // KPI
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  kpiCard: {
    width: "30%",
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#fff",
    margin: "1.5%",
    alignItems: "center",
  },
  kpiIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: "bold",
  },
  kpiLabel: {
    fontSize: 11,
    color: "#666",
    marginTop: 2,
    textAlign: "center",
  },

  // Charts
  chartCard: {
    margin: 16,
    marginBottom: 0,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#fff",
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 12,
  },
  emptyChart: {
    alignItems: "center",
    paddingVertical: 24,
  },
  emptyChartText: {
    marginTop: 8,
    color: "#999",
    fontSize: 13,
  },

  // Turf legend
  turfLegend: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  turfLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  legendLabel: {
    flex: 1,
    fontSize: 13,
    color: "#333",
  },
  legendValue: {
    fontSize: 12,
    color: "#666",
  },

  // ROI
  roiGrid: {
    flexDirection: "row",
    marginBottom: 12,
  },
  roiItem: {
    flex: 1,
    alignItems: "center",
    padding: 8,
  },
  roiLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  roiValue: {
    fontSize: 20,
    fontWeight: "bold",
  },
  roiBarContainer: {
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  roiBarLabel: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  roiBarText: {
    fontSize: 11,
    color: "#999",
  },
  roiBar: {
    flexDirection: "row",
    height: 12,
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: "#eee",
  },
  roiBarSegment: {
    height: 12,
  },
  roiBarDetail: {
    marginTop: 6,
    alignItems: "center",
  },
  roiDetailText: {
    fontSize: 11,
    color: "#999",
  },

  // Payment breakdown
  paymentGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  paymentItem: {
    flex: 1,
    alignItems: "center",
  },
  paymentIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  paymentItemLabel: {
    fontSize: 11,
    color: "#666",
    textAlign: "center",
    marginBottom: 2,
  },
  paymentItemValue: {
    fontSize: 14,
    fontWeight: "bold",
  },
  paymentBarContainer: {
    marginBottom: 16,
  },
  paymentBar: {
    flexDirection: "row",
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
    backgroundColor: "#eee",
  },
  paymentBarSegment: {
    height: 10,
  },
  paymentTotal: {
    fontSize: 12,
    color: "#666",
    textAlign: "right",
    marginTop: 4,
  },
  paymentStatsGrid: {
    flexDirection: "row",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  paymentStatItem: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 4,
  },
  paymentStatLabel: {
    fontSize: 10,
    color: "#666",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 2,
  },
  paymentStatValue: {
    fontSize: 16,
    fontWeight: "bold",
  },
  paymentStatDetail: {
    fontSize: 10,
    color: "#999",
    marginTop: 2,
  },
});
