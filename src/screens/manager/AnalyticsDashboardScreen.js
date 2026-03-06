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
  Chip,
  ActivityIndicator,
  DataTable,
  Menu,
  IconButton,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Svg, { Rect, Line, Circle, Text as SvgText, Path, G } from "react-native-svg";
import { useAppSelector } from "../../hooks";
import { queryDocuments } from "../../services/firebase/firestore";
import { selectUser, selectAssignedTurfIds } from "../../store/slices/authSlice";

const MANAGER_BLUE = "#3B82F6";
const PALE_BLUE = "#DBEAFE";
const SUCCESS_GREEN = "#22C55E";
const WARN_ORANGE = "#F59E0B";
const DANGER_RED = "#EF4444";
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

const getDateRange = (range) => {
  const today = getToday();
  switch (range) {
    case "today":
      return { start: today, end: today, label: "Today" };
    case "week":
      return { start: getWeekStart(), end: today, label: "This Week" };
    case "month":
      return { start: getMonthStart(), end: today, label: "This Month" };
    default:
      return { start: getMonthStart(), end: today, label: "This Month" };
  }
};

const formatCurrency = (amount) => {
  if (amount >= 100000) return `Rs.${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `Rs.${(amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1)}K`;
  return `Rs.${amount}`;
};

const formatTime12 = (timeStr) => {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const dh = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${dh}${m !== "00" ? `:${m}` : ""}${ampm}`;
};

// ─── Chart Colors ───
const CHART_COLORS = [
  "#2196F3", "#4CAF50", "#FF9800", "#9C27B0",
  "#F44336", "#00BCD4", "#795548", "#607D8B",
];

// ═══════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════
export default function AnalyticsDashboardScreen({ navigation }) {
  const user = useAppSelector(selectUser);
  const assignedTurfIds = useAppSelector(selectAssignedTurfIds);

  const [selectedRange, setSelectedRange] = useState("week");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [sortColumn, setSortColumn] = useState("date");
  const [sortAsc, setSortAsc] = useState(false);
  const [tablePage, setTablePage] = useState(0);
  const TABLE_ROWS_PER_PAGE = 10;

  const dateRange = useMemo(() => getDateRange(selectedRange), [selectedRange]);

  // ── Fetch data ──
  useEffect(() => {
    fetchAnalyticsData();
  }, [selectedRange, assignedTurfIds]);

  const fetchAnalyticsData = async () => {
    if (!assignedTurfIds || assignedTurfIds.length === 0) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const allBookings = [];
      for (const turfId of assignedTurfIds) {
        const turfBookings = await queryDocuments("bookings", [
          { field: "turfId", operator: "==", value: turfId },
        ]);
        allBookings.push(...turfBookings);
      }
      setBookings(allBookings);
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAnalyticsData();
    setRefreshing(false);
  }, [selectedRange, assignedTurfIds]);

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
    const totalRevenue = confirmedBookings.reduce(
      (sum, b) => sum + (b.totalAmount || b.totalPrice || b.payment?.slotAmount || b.amount || 0),
      0
    );
    const avgValue = totalBookings > 0 ? Math.round(totalRevenue / totalBookings) : 0;

    // Utilization: booked hours / (available hours * days * grounds)
    const bookedHours = confirmedBookings.reduce(
      (sum, b) => sum + (b.duration || 1),
      0
    );
    const uniqueDates = [...new Set(confirmedBookings.map((b) => b.date))];
    const days = Math.max(uniqueDates.length, 1);
    const grounds = new Set(confirmedBookings.map((b) => b.groundId || b.groundName)).size || 1;
    const availableHours = 16 * days * grounds;
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
    };
  }, [confirmedBookings, filteredBookings]);

  // ═══════════════════════════════════════════
  // CHART DATA
  // ═══════════════════════════════════════════

  // Revenue trend (daily)
  const revenueTrend = useMemo(() => {
    const byDate = {};
    confirmedBookings.forEach((b) => {
      const revenue = b.totalAmount || b.totalPrice || b.payment?.slotAmount || b.amount || 0;
      byDate[b.date] = (byDate[b.date] || 0) + revenue;
    });
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, amount]) => ({
        label: date.slice(5), // MM-DD
        value: amount,
      }));
  }, [confirmedBookings]);

  // Sport-wise breakdown
  const sportBreakdown = useMemo(() => {
    const bySport = {};
    confirmedBookings.forEach((b) => {
      const sport = b.sport || "Other";
      bySport[sport] = (bySport[sport] || 0) + 1;
    });
    return Object.entries(bySport)
      .sort(([, a], [, b]) => b - a)
      .map(([sport, count], i) => ({
        label: sport,
        value: count,
        color: CHART_COLORS[i % CHART_COLORS.length],
      }));
  }, [confirmedBookings]);

  // Peak hours
  const peakHours = useMemo(() => {
    const byHour = {};
    confirmedBookings.forEach((b) => {
      const hour = parseInt((b.startTime || "00:00").split(":")[0], 10);
      byHour[hour] = (byHour[hour] || 0) + 1;
    });
    return Array.from({ length: 18 }, (_, i) => i + 5) // 5AM to 10PM
      .map((h) => ({
        label: `${h > 12 ? h - 12 : h}${h >= 12 ? "P" : "A"}`,
        value: byHour[h] || 0,
        hour: h,
      }))
      .filter((d) => d.value > 0 || d.hour % 2 === 0); // show even hours + any with data
  }, [confirmedBookings]);

  // Ground utilization
  const groundUtil = useMemo(() => {
    const byGround = {};
    confirmedBookings.forEach((b) => {
      const name = b.groundName || b.groundId || "Ground";
      byGround[name] = (byGround[name] || 0) + (b.duration || 1);
    });
    return Object.entries(byGround)
      .sort(([, a], [, b]) => b - a)
      .map(([name, hours], i) => ({
        label: name.length > 12 ? name.slice(0, 12) + "..." : name,
        value: hours,
        color: CHART_COLORS[i % CHART_COLORS.length],
      }));
  }, [confirmedBookings]);

  // ═══════════════════════════════════════════
  // PAYMENT BREAKDOWN
  // ═══════════════════════════════════════════
  const paymentBreakdown = useMemo(() => {
    let upiAdvance = 0;
    let cashAtVenue = 0;
    let onlineAtVenue = 0;
    let totalVerified = 0;
    let totalSubmitted = 0;

    confirmedBookings.forEach((b) => {
      const payment = b.payment || {};
      const advance = payment.advanceAmount || payment.advance?.amount || 0;
      const total = b.totalAmount || b.totalPrice || payment.slotAmount || b.amount || 0;
      const remaining = total - advance;

      // Advance (UPI)
      if (advance > 0) {
        upiAdvance += advance;
      }

      // Remaining amount - check method
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
      }
      if (payment.advance?.status === "submitted" || payment.advance?.status === "verified") {
        totalSubmitted++;
      }
    });

    const verificationRate = totalSubmitted > 0 ? Math.round((totalVerified / totalSubmitted) * 100) : 0;

    return {
      upiAdvance,
      cashAtVenue,
      onlineAtVenue,
      total: upiAdvance + cashAtVenue + onlineAtVenue,
      verificationRate,
      totalVerified,
      totalSubmitted,
    };
  }, [confirmedBookings]);

  // ═══════════════════════════════════════════
  // TABLE DATA
  // ═══════════════════════════════════════════
  const tableData = useMemo(() => {
    const sorted = [...confirmedBookings].sort((a, b) => {
      let valA, valB;
      switch (sortColumn) {
        case "date":
          valA = a.date || "";
          valB = b.date || "";
          break;
        case "customer":
          valA = (a.userName || a.customerName || "").toLowerCase();
          valB = (b.userName || b.customerName || "").toLowerCase();
          break;
        case "revenue":
          valA = a.totalAmount || a.totalPrice || a.payment?.slotAmount || a.amount || 0;
          valB = b.totalAmount || b.totalPrice || b.payment?.slotAmount || b.amount || 0;
          break;
        case "sport":
          valA = (a.sport || "").toLowerCase();
          valB = (b.sport || "").toLowerCase();
          break;
        default:
          valA = a.date || "";
          valB = b.date || "";
      }
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [confirmedBookings, sortColumn, sortAsc]);

  const paginatedData = useMemo(() => {
    const start = tablePage * TABLE_ROWS_PER_PAGE;
    return tableData.slice(start, start + TABLE_ROWS_PER_PAGE);
  }, [tableData, tablePage]);

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortAsc(!sortAsc);
    } else {
      setSortColumn(column);
      setSortAsc(true);
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

    const header = "Date,Customer,Sport,Ground,Time,Duration(hrs),Amount,Payment Method,Status";
    const rows = confirmedBookings.map((b) => {
      const amount = b.totalAmount || b.totalPrice || b.payment?.slotAmount || b.amount || 0;
      const method = b.payment?.remainingPaymentMethod || b.payment?.paymentMethod || "cash";
      return [
        b.date,
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

    // Summary
    const summary = [
      "",
      `\nAnalytics Summary (${dateRange.label}: ${dateRange.start} to ${dateRange.end})`,
      `Total Bookings,${kpis.totalBookings}`,
      `Total Revenue,${kpis.totalRevenue}`,
      `Avg Booking Value,${kpis.avgValue}`,
      `Utilization,${kpis.utilization}%`,
      `Cancellation Rate,${kpis.cancellationRate}%`,
      "",
      "Payment Breakdown",
      `UPI Advance,${paymentBreakdown.upiAdvance}`,
      `Cash at Venue,${paymentBreakdown.cashAtVenue}`,
      `Online at Venue,${paymentBreakdown.onlineAtVenue}`,
      `Verification Rate,${paymentBreakdown.verificationRate}%`,
    ].join("\n");

    try {
      await Share.share({
        message: csv + summary,
        title: `Analytics_${dateRange.start}_to_${dateRange.end}.csv`,
      });
    } catch (error) {
      console.error("Export error:", error);
    }
  };

  // ═══════════════════════════════════════════
  // CHART RENDERERS (SVG)
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
          {/* Grid lines */}
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
          {/* Bars */}
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
                  fill={d.color || barColor || MANAGER_BLUE}
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
                    {d.value}{unit}
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

    // Area fill
    const areaD = `${pathD} L ${points[points.length - 1].x} ${plotH + 4} L ${points[0].x} ${plotH + 4} Z`;

    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Svg width={chartW} height={chartH}>
          {/* Grid */}
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
          {/* Area */}
          <Path d={areaD} fill={`${MANAGER_BLUE}15`} />
          {/* Line */}
          <Path d={pathD} fill="none" stroke={MANAGER_BLUE} strokeWidth={2.5} />
          {/* Points + labels */}
          {points.map((p, i) => (
            <G key={i}>
              <Circle cx={p.x} cy={p.y} r={4} fill="#fff" stroke={MANAGER_BLUE} strokeWidth={2} />
              <SvgText x={p.x} y={chartH - 2} fontSize={9} fill="#666" textAnchor="middle">
                {data[i].label}
              </SvgText>
            </G>
          ))}
        </Svg>
      </ScrollView>
    );
  };

  const renderPieChart = (data) => {
    if (data.length === 0) return renderEmptyChart("No sport data");
    const total = data.reduce((s, d) => s + d.value, 0);
    const cx = 80;
    const cy = 80;
    const r = 65;
    let cumAngle = -Math.PI / 2;

    const slices = data.map((d) => {
      const angle = (d.value / total) * 2 * Math.PI;
      const startAngle = cumAngle;
      cumAngle += angle;
      const endAngle = cumAngle;

      const x1 = cx + r * Math.cos(startAngle);
      const y1 = cy + r * Math.sin(startAngle);
      const x2 = cx + r * Math.cos(endAngle);
      const y2 = cy + r * Math.sin(endAngle);
      const largeArc = angle > Math.PI ? 1 : 0;

      return {
        ...d,
        path: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`,
        percentage: Math.round((d.value / total) * 100),
      };
    });

    return (
      <View style={styles.pieContainer}>
        <Svg width={160} height={160}>
          {slices.map((s, i) => (
            <Path key={i} d={s.path} fill={s.color} />
          ))}
          <Circle cx={cx} cy={cy} r={30} fill="#fff" />
          <SvgText x={cx} y={cy + 4} fontSize={14} fontWeight="bold" fill="#333" textAnchor="middle">
            {total}
          </SvgText>
        </Svg>
        <View style={styles.pieLegend}>
          {slices.map((s, i) => (
            <View key={i} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: s.color }]} />
              <Text style={styles.legendLabel}>{s.label}</Text>
              <Text style={styles.legendValue}>
                {s.value} ({s.percentage}%)
              </Text>
            </View>
          ))}
        </View>
      </View>
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
          <ActivityIndicator size="large" color={MANAGER_BLUE} />
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[MANAGER_BLUE]} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#333" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Analytics</Text>
            <Text style={styles.headerSubtitle}>{dateRange.label}</Text>
          </View>
          <IconButton
            icon="export-variant"
            size={22}
            iconColor={MANAGER_BLUE}
            onPress={handleExport}
            style={styles.exportButton}
          />
        </View>

        {/* Date Range Selector */}
        <View style={styles.dateRangeRow}>
          {["today", "week", "month"].map((range) => (
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
                {range === "today" ? "Today" : range === "week" ? "Week" : "Month"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* KPI Cards */}
        <View style={styles.kpiGrid}>
          {[
            { label: "Bookings", value: String(kpis.totalBookings), icon: "calendar-check", color: "#4CAF50" },
            { label: "Revenue", value: formatCurrency(kpis.totalRevenue), icon: "currency-inr", color: "#2196F3" },
            { label: "Utilization", value: `${kpis.utilization}%`, icon: "chart-arc", color: "#9C27B0" },
            { label: "Avg Value", value: formatCurrency(kpis.avgValue), icon: "tag", color: "#FF9800" },
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

        {/* Sport-wise Breakdown */}
        <Surface style={styles.chartCard} elevation={1}>
          <Text style={styles.chartTitle}>Sport-wise Breakdown</Text>
          {renderPieChart(sportBreakdown)}
        </Surface>

        {/* Peak Hours */}
        <Surface style={styles.chartCard} elevation={1}>
          <Text style={styles.chartTitle}>Peak Hours</Text>
          {renderBarChart(peakHours, { barColor: "#FF9800" })}
        </Surface>

        {/* Ground Utilization */}
        <Surface style={styles.chartCard} elevation={1}>
          <Text style={styles.chartTitle}>Ground Utilization (hours)</Text>
          {renderBarChart(groundUtil, { barColor: "#4CAF50", unit: "h" })}
        </Surface>

        {/* Payment Breakdown */}
        <Surface style={styles.chartCard} elevation={1}>
          <Text style={styles.chartTitle}>Payment Breakdown</Text>
          <View style={styles.paymentGrid}>
            {[
              { label: "UPI Advance", value: paymentBreakdown.upiAdvance, color: "#2196F3", icon: "cellphone" },
              { label: "Cash at Venue", value: paymentBreakdown.cashAtVenue, color: "#4CAF50", icon: "cash" },
              { label: "Online at Venue", value: paymentBreakdown.onlineAtVenue, color: "#9C27B0", icon: "credit-card" },
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
          {paymentBreakdown.total > 0 && (
            <View style={styles.paymentBarContainer}>
              <View style={styles.paymentBar}>
                {paymentBreakdown.upiAdvance > 0 && (
                  <View
                    style={[
                      styles.paymentBarSegment,
                      {
                        flex: paymentBreakdown.upiAdvance / paymentBreakdown.total,
                        backgroundColor: "#2196F3",
                        borderTopLeftRadius: 4,
                        borderBottomLeftRadius: 4,
                      },
                    ]}
                  />
                )}
                {paymentBreakdown.cashAtVenue > 0 && (
                  <View
                    style={[
                      styles.paymentBarSegment,
                      {
                        flex: paymentBreakdown.cashAtVenue / paymentBreakdown.total,
                        backgroundColor: "#4CAF50",
                      },
                    ]}
                  />
                )}
                {paymentBreakdown.onlineAtVenue > 0 && (
                  <View
                    style={[
                      styles.paymentBarSegment,
                      {
                        flex: paymentBreakdown.onlineAtVenue / paymentBreakdown.total,
                        backgroundColor: "#9C27B0",
                        borderTopRightRadius: 4,
                        borderBottomRightRadius: 4,
                      },
                    ]}
                  />
                )}
              </View>
              <Text style={styles.paymentTotal}>
                Total: {formatCurrency(paymentBreakdown.total)}
              </Text>
            </View>
          )}

          {/* Verification rate */}
          <View style={styles.verificationRow}>
            <MaterialCommunityIcons name="shield-check" size={18} color="#4CAF50" />
            <Text style={styles.verificationLabel}>Payment Verification Rate:</Text>
            <Text style={styles.verificationValue}>
              {paymentBreakdown.verificationRate}%
            </Text>
            <Text style={styles.verificationDetail}>
              ({paymentBreakdown.totalVerified}/{paymentBreakdown.totalSubmitted} verified)
            </Text>
          </View>
        </Surface>

        {/* Data Table */}
        <Surface style={styles.chartCard} elevation={1}>
          <View style={styles.tableHeader}>
            <Text style={styles.chartTitle}>Booking Details</Text>
            <Button
              mode="text"
              compact
              icon="export-variant"
              textColor={MANAGER_BLUE}
              onPress={handleExport}
            >
              Export
            </Button>
          </View>

          <DataTable>
            <DataTable.Header>
              <DataTable.Title
                sortDirection={sortColumn === "date" ? (sortAsc ? "ascending" : "descending") : undefined}
                onPress={() => handleSort("date")}
              >
                Date
              </DataTable.Title>
              <DataTable.Title
                sortDirection={sortColumn === "customer" ? (sortAsc ? "ascending" : "descending") : undefined}
                onPress={() => handleSort("customer")}
              >
                Customer
              </DataTable.Title>
              <DataTable.Title
                sortDirection={sortColumn === "sport" ? (sortAsc ? "ascending" : "descending") : undefined}
                onPress={() => handleSort("sport")}
              >
                Sport
              </DataTable.Title>
              <DataTable.Title
                numeric
                sortDirection={sortColumn === "revenue" ? (sortAsc ? "ascending" : "descending") : undefined}
                onPress={() => handleSort("revenue")}
              >
                Revenue
              </DataTable.Title>
            </DataTable.Header>

            {paginatedData.length === 0 ? (
              <DataTable.Row>
                <DataTable.Cell>
                  <Text style={styles.emptyTableText}>No bookings found</Text>
                </DataTable.Cell>
              </DataTable.Row>
            ) : (
              paginatedData.map((b) => (
                <DataTable.Row key={b.id}>
                  <DataTable.Cell>{(b.date || "").slice(5)}</DataTable.Cell>
                  <DataTable.Cell>
                    {(b.userName || b.customerName || "Customer").slice(0, 12)}
                  </DataTable.Cell>
                  <DataTable.Cell>{b.sport || "-"}</DataTable.Cell>
                  <DataTable.Cell numeric>
                    Rs.{b.totalAmount || b.totalPrice || b.payment?.slotAmount || b.amount || 0}
                  </DataTable.Cell>
                </DataTable.Row>
              ))
            )}

            {tableData.length > TABLE_ROWS_PER_PAGE && (
              <DataTable.Pagination
                page={tablePage}
                numberOfPages={Math.ceil(tableData.length / TABLE_ROWS_PER_PAGE)}
                onPageChange={(page) => setTablePage(page)}
                label={`${tablePage * TABLE_ROWS_PER_PAGE + 1}-${Math.min(
                  (tablePage + 1) * TABLE_ROWS_PER_PAGE,
                  tableData.length
                )} of ${tableData.length}`}
                showFastPaginationControls
              />
            )}
          </DataTable>
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
    backgroundColor: "#F0F4F8",
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
    backgroundColor: "#E3F2FD",
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
    backgroundColor: MANAGER_BLUE,
    borderColor: MANAGER_BLUE,
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

  // Pie chart
  pieContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  pieLegend: {
    flex: 1,
    marginLeft: 16,
  },
  legendItem: {
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
    marginBottom: 12,
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
  verificationRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  verificationLabel: {
    fontSize: 13,
    color: "#333",
    marginLeft: 6,
  },
  verificationValue: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#4CAF50",
    marginLeft: 6,
  },
  verificationDetail: {
    fontSize: 11,
    color: "#999",
    marginLeft: 4,
  },

  // Table
  tableHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  emptyTableText: {
    color: "#999",
    fontStyle: "italic",
  },
});
