import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
} from "react-native";
import {
  Text,
  Surface,
  Button,
  TextInput,
  ActivityIndicator,
  Divider,
  IconButton,
  Portal,
  Snackbar,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { getDocument, updateDocument } from "../../services/firebase/firestore";
import TimePickerModal from "../../components/TimePickerModal";

const ACCENT = "#3B82F6";
const NAVY = "#1E40AF";
const PH_RED = "#E53935";
const HOLIDAY_GREEN = "#D1FAE5";
const HOLIDAY_GREEN_BORDER = "#6EE7B7";
const TODAY_BG = "#FEF9C3";
const TODAY_BORDER = "#FCD34D";

// ─── Holiday engine ────────────────────────────────────────────────────────────

// Fixed-date gazetted holidays (MM-DD → name)
const FIXED_PH = {
  "01-01": "New Year's Day",
  "01-26": "Republic Day",
  "04-14": "Dr. Ambedkar Jayanti",
  "05-01": "International Labour Day",
  "08-15": "Independence Day",
  "10-02": "Gandhi Jayanti",
  "12-25": "Christmas",
};

/**
 * Easter Sunday via Meeus/Jones/Butcher algorithm (exact for any Gregorian year).
 * Returns { month (1-12), day }.
 */
function easterDate(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

function pad(n) { return String(n).padStart(2, "0"); }
function dateStr(y, m, d) { return `${y}-${pad(m)}-${pad(d)}`; }

/**
 * Gregorian date → Julian Day Number.
 */
function toJDN(y, m, d) {
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy +
    Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
}

/**
 * Julian Day Number → Gregorian { year, month, day }.
 */
function fromJDN(jdn) {
  const a = jdn + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d2 = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d2) / 4);
  const mm = Math.floor((5 * e + 2) / 153);
  return {
    year:  100 * b + d2 - 4800 + Math.floor(mm / 10),
    month: mm + 3 - 12 * Math.floor(mm / 10),
    day:   e - Math.floor((153 * mm + 2) / 5) + 1,
  };
}

/**
 * Hijri (Islamic civil/tabular calendar) → Gregorian.
 * Accurate to ±1 day vs. actual moon sighting.
 */
function hijriToGregorian(hy, hm, hd) {
  const jdn = Math.floor((11 * hy + 3) / 30) +
    354 * hy + 30 * hm - Math.floor((hm - 1) / 2) + hd + 1948440 - 385;
  return fromJDN(jdn);
}

/**
 * Gregorian → Hijri (civil).
 */
function gregorianToHijri(y, m, d) {
  const jdn = toJDN(y, m, d);
  const l   = jdn - 1948440 + 10632;
  const n   = Math.floor((l - 1) / 10631);
  const l2  = l - 10631 * n + 354;
  const j   = Math.floor((10985 - l2) / 5316) * Math.floor((50 * l2) / 17719) +
              Math.floor(l2 / 5670) * Math.floor((43 * l2) / 15238);
  const l3  = l2 - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) -
              Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
  const hy  = 30 * n + j - 30;
  const hm  = Math.ceil(l3 / 29.5);
  return { year: hy, month: hm };
}

/**
 * Find all Gregorian dates for a given Hijri month+day in a Gregorian year.
 * (A Hijri month can fall twice or zero times in a Gregorian year.)
 */
function hijriOccurrencesInYear(gregYear, hijriMonth, hijriDay, name) {
  const results = [];
  // Check two possible Hijri years that overlap with this Gregorian year
  const { year: hBaseYear } = gregorianToHijri(gregYear, 1, 1);
  for (let hy = hBaseYear - 1; hy <= hBaseYear + 1; hy++) {
    const g = hijriToGregorian(hy, hijriMonth, hijriDay);
    if (g.year === gregYear) {
      results.push({ str: dateStr(g.year, g.month, g.day), name });
    }
  }
  return results;
}

/**
 * Pre-computed variable Hindu festival dates (Drik Panchang / GOI gazette).
 * Hindu lunisolar calendar dates cannot be derived from a simple formula;
 * this table covers 2025–2040 and requires no maintenance until then.
 */
const HINDU_PH = {
  // Maha Shivratri
  "2025-02-26": "Maha Shivratri", "2026-02-15": "Maha Shivratri",
  "2027-03-06": "Maha Shivratri", "2028-02-23": "Maha Shivratri",
  "2029-02-11": "Maha Shivratri", "2030-03-01": "Maha Shivratri",
  "2031-02-19": "Maha Shivratri", "2032-02-08": "Maha Shivratri",
  "2033-02-26": "Maha Shivratri", "2034-02-16": "Maha Shivratri",
  "2035-03-07": "Maha Shivratri", "2036-02-24": "Maha Shivratri",
  "2037-02-12": "Maha Shivratri", "2038-03-03": "Maha Shivratri",
  "2039-02-20": "Maha Shivratri", "2040-02-10": "Maha Shivratri",
  // Holi (Dhuleti — day of colours)
  "2025-03-14": "Holi",          "2026-03-03": "Holi",
  "2027-03-22": "Holi",          "2028-03-11": "Holi",
  "2029-03-01": "Holi",          "2030-03-19": "Holi",
  "2031-03-09": "Holi",          "2032-03-27": "Holi",
  "2033-03-16": "Holi",          "2034-03-05": "Holi",
  "2035-03-24": "Holi",          "2036-03-13": "Holi",
  "2037-03-02": "Holi",          "2038-03-21": "Holi",
  "2039-03-10": "Holi",          "2040-02-28": "Holi",
  // Ram Navami
  "2025-04-06": "Ram Navami",    "2026-03-26": "Ram Navami",
  "2027-04-15": "Ram Navami",    "2028-04-03": "Ram Navami",
  "2029-03-23": "Ram Navami",    "2030-04-11": "Ram Navami",
  "2031-04-01": "Ram Navami",    "2032-04-19": "Ram Navami",
  "2033-04-08": "Ram Navami",    "2034-03-29": "Ram Navami",
  "2035-04-16": "Ram Navami",    "2036-04-05": "Ram Navami",
  "2037-03-25": "Ram Navami",    "2038-04-13": "Ram Navami",
  "2039-04-02": "Ram Navami",    "2040-04-21": "Ram Navami",
  // Mahavir Jayanti
  "2025-04-10": "Mahavir Jayanti", "2026-03-30": "Mahavir Jayanti",
  "2027-04-19": "Mahavir Jayanti", "2028-04-07": "Mahavir Jayanti",
  "2029-03-27": "Mahavir Jayanti", "2030-04-15": "Mahavir Jayanti",
  "2031-04-05": "Mahavir Jayanti", "2032-04-23": "Mahavir Jayanti",
  "2033-04-12": "Mahavir Jayanti", "2034-04-01": "Mahavir Jayanti",
  "2035-04-20": "Mahavir Jayanti", "2036-04-09": "Mahavir Jayanti",
  "2037-03-29": "Mahavir Jayanti", "2038-04-17": "Mahavir Jayanti",
  "2039-04-06": "Mahavir Jayanti", "2040-04-25": "Mahavir Jayanti",
  // Buddha Purnima
  "2025-05-12": "Buddha Purnima", "2026-05-01": "Buddha Purnima",
  "2027-05-21": "Buddha Purnima", "2028-05-09": "Buddha Purnima",
  "2029-04-29": "Buddha Purnima", "2030-05-18": "Buddha Purnima",
  "2031-05-07": "Buddha Purnima", "2032-05-26": "Buddha Purnima",
  "2033-05-15": "Buddha Purnima", "2034-05-04": "Buddha Purnima",
  "2035-05-23": "Buddha Purnima", "2036-05-12": "Buddha Purnima",
  "2037-05-01": "Buddha Purnima", "2038-05-20": "Buddha Purnima",
  "2039-05-10": "Buddha Purnima", "2040-04-29": "Buddha Purnima",
  // Janmashtami
  "2025-08-16": "Janmashtami",   "2026-08-05": "Janmashtami",
  "2027-08-25": "Janmashtami",   "2028-08-13": "Janmashtami",
  "2029-08-02": "Janmashtami",   "2030-08-21": "Janmashtami",
  "2031-08-11": "Janmashtami",   "2032-08-30": "Janmashtami",
  "2033-08-19": "Janmashtami",   "2034-08-08": "Janmashtami",
  "2035-08-28": "Janmashtami",   "2036-08-16": "Janmashtami",
  "2037-08-05": "Janmashtami",   "2038-08-24": "Janmashtami",
  "2039-08-14": "Janmashtami",   "2040-08-02": "Janmashtami",
  // Onam (Thiruvonam)
  "2025-09-05": "Onam",          "2026-08-26": "Onam",
  "2027-09-14": "Onam",          "2028-09-03": "Onam",
  "2029-08-23": "Onam",          "2030-09-11": "Onam",
  "2031-08-31": "Onam",          "2032-09-19": "Onam",
  "2033-09-08": "Onam",          "2034-08-28": "Onam",
  "2035-09-16": "Onam",          "2036-09-05": "Onam",
  "2037-08-25": "Onam",          "2038-09-13": "Onam",
  "2039-09-02": "Onam",          "2040-08-22": "Onam",
  // Dussehra / Vijaya Dashami
  "2025-10-02": "Dussehra",      "2026-10-22": "Dussehra",
  "2027-10-11": "Dussehra",      "2028-10-29": "Dussehra",
  "2029-10-18": "Dussehra",      "2030-10-08": "Dussehra",
  "2031-10-27": "Dussehra",      "2032-10-15": "Dussehra",
  "2033-10-04": "Dussehra",      "2034-10-23": "Dussehra",
  "2035-10-13": "Dussehra",      "2036-10-01": "Dussehra",
  "2037-10-20": "Dussehra",      "2038-10-09": "Dussehra",
  "2039-10-28": "Dussehra",      "2040-10-17": "Dussehra",
  // Diwali (Lakshmi Puja)
  "2025-10-20": "Diwali",        "2026-11-08": "Diwali",
  "2027-10-28": "Diwali",        "2028-10-17": "Diwali",
  "2029-11-05": "Diwali",        "2030-10-25": "Diwali",
  "2031-11-13": "Diwali",        "2032-11-02": "Diwali",
  "2033-10-21": "Diwali",        "2034-11-09": "Diwali",
  "2035-10-29": "Diwali",        "2036-10-18": "Diwali",
  "2037-11-06": "Diwali",        "2038-10-26": "Diwali",
  "2039-11-14": "Diwali",        "2040-11-03": "Diwali",
  // Guru Nanak Jayanti (Kartik Purnima)
  "2025-11-05": "Guru Nanak Jayanti", "2026-10-25": "Guru Nanak Jayanti",
  "2027-11-13": "Guru Nanak Jayanti", "2028-11-02": "Guru Nanak Jayanti",
  "2029-10-22": "Guru Nanak Jayanti", "2030-11-10": "Guru Nanak Jayanti",
  "2031-10-31": "Guru Nanak Jayanti", "2032-11-18": "Guru Nanak Jayanti",
  "2033-11-07": "Guru Nanak Jayanti", "2034-10-27": "Guru Nanak Jayanti",
  "2035-11-15": "Guru Nanak Jayanti", "2036-11-04": "Guru Nanak Jayanti",
  "2037-10-24": "Guru Nanak Jayanti", "2038-11-12": "Guru Nanak Jayanti",
  "2039-11-01": "Guru Nanak Jayanti", "2040-11-20": "Guru Nanak Jayanti",
};

/**
 * Build a Map<"YYYY-MM-DD", name> for all public holidays in a given Gregorian year.
 * Islamic holidays are computed algorithmically; Hindu dates come from HINDU_PH.
 */
function buildHolidayMap(year) {
  const map = new Map();

  // Fixed-date holidays
  Object.entries(FIXED_PH).forEach(([mmdd, name]) => {
    map.set(`${year}-${mmdd}`, name);
  });

  // Good Friday (2 days before Easter) — exact
  const easter = easterDate(year);
  const gf = new Date(year, easter.month - 1, easter.day);
  gf.setDate(gf.getDate() - 2);
  map.set(dateStr(gf.getFullYear(), gf.getMonth() + 1, gf.getDate()), "Good Friday");

  // Islamic holidays via Hijri algorithm
  // Eid ul-Fitr  = 1 Shawwal  (month 10, day 1)
  // Eid ul-Adha  = 10 Dhul Hijjah (month 12, day 10)
  // Muharram     = 1 Muharram (month 1, day 1)
  // Milad-un-Nabi= 12 Rabi al-Awwal (month 3, day 12)
  const islamicEvents = [
    { hm: 10, hd: 1,  name: "Eid ul-Fitr" },
    { hm: 12, hd: 10, name: "Eid ul-Adha" },
    { hm: 1,  hd: 1,  name: "Muharram" },
    { hm: 3,  hd: 12, name: "Milad-un-Nabi" },
  ];
  islamicEvents.forEach(({ hm, hd, name }) => {
    hijriOccurrencesInYear(year, hm, hd, name).forEach(({ str, name: n }) => {
      map.set(str, n);
    });
  });

  // Hindu pre-computed holidays
  Object.entries(HINDU_PH).forEach(([d, name]) => {
    if (d.startsWith(`${year}-`)) map.set(d, name);
  });

  return map;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt12 = (time24) => {
  if (!time24) return "";
  const [h, m] = time24.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
};

const makeDateStr = (y, m, d) =>
  `${y}-${pad(m + 1)}-${pad(d)}`;

const todayStr = () => {
  const d = new Date();
  return makeDateStr(d.getFullYear(), d.getMonth(), d.getDate());
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ─── CalendarPicker ────────────────────────────────────────────────────────────
function CalendarPicker({
  calMonth, setCalMonth,
  selectedDates, setSelectedDates,
  holidaySchedule,
  onPublicHolidayTapped,
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMs  = today.getTime();
  const today_   = todayStr();
  const year     = calMonth.getFullYear();
  const monthIdx = calMonth.getMonth();

  // Build holiday map for displayed month's year (and adjacent if needed)
  const holidayMap = useMemo(() => buildHolidayMap(year), [year]);

  const daysInMonth  = new Date(year, monthIdx + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, monthIdx, 1).getDay();
  const monthName    = calMonth.toLocaleString("default", { month: "long" });
  const canGoBack    = calMonth.getTime() > new Date(today.getFullYear(), today.getMonth(), 1).getTime();

  const cells = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const handlePress = (dateStr, isPast, phName) => {
    if (isPast) return;
    if (phName) onPublicHolidayTapped(phName);
    setSelectedDates((prev) => {
      const next = new Set(prev);
      if (next.has(dateStr)) next.delete(dateStr); else next.add(dateStr);
      return next;
    });
  };

  return (
    <View style={calStyles.root}>
      {/* Month nav */}
      <View style={calStyles.header}>
        <TouchableOpacity onPress={() => canGoBack && setCalMonth(new Date(year, monthIdx - 1, 1))} disabled={!canGoBack} hitSlop={8}>
          <MaterialCommunityIcons name="chevron-left" size={24} color={canGoBack ? ACCENT : "#D1D5DB"} />
        </TouchableOpacity>
        <Text style={calStyles.monthTitle}>{monthName} {year}</Text>
        <TouchableOpacity onPress={() => setCalMonth(new Date(year, monthIdx + 1, 1))} hitSlop={8}>
          <MaterialCommunityIcons name="chevron-right" size={24} color={ACCENT} />
        </TouchableOpacity>
      </View>

      {/* Day-of-week headers */}
      <View style={calStyles.row}>
        {DAY_LABELS.map((lbl, i) => (
          <Text key={i} style={calStyles.dayHeader}>{lbl}</Text>
        ))}
      </View>

      {/* Date rows */}
      {Array.from({ length: cells.length / 7 }, (_, rowIdx) => (
        <View key={rowIdx} style={calStyles.row}>
          {cells.slice(rowIdx * 7, rowIdx * 7 + 7).map((day, colIdx) => {
            if (!day) return <View key={`e${rowIdx}-${colIdx}`} style={calStyles.cell} />;
            const ds         = makeDateStr(year, monthIdx, day);
            const dateMs     = new Date(year, monthIdx, day).getTime();
            const isPast     = dateMs < todayMs;
            const isToday    = ds === today_;
            const isSelected = selectedDates.has(ds);
            const isAlreadyHoliday = !!holidaySchedule[ds];
            const phName     = !isPast ? (holidayMap.get(ds) || null) : null;

            return (
              <TouchableOpacity
                key={ds}
                style={[
                  calStyles.cell,
                  isToday && !isSelected && calStyles.todayCell,
                  isSelected && calStyles.selectedCell,
                  isAlreadyHoliday && !isSelected && calStyles.existingHolidayCell,
                ]}
                onPress={() => handlePress(ds, isPast, phName)}
                activeOpacity={isPast ? 1 : 0.7}
              >
                <Text style={[
                  calStyles.dayNum,
                  isPast && calStyles.pastNum,
                  phName && !isSelected && calStyles.phNum,
                  isSelected && calStyles.selectedNum,
                  isToday && !isSelected && calStyles.todayNum,
                ]}>
                  {day}
                </Text>
                {phName && !isSelected && <View style={calStyles.phDot} />}
                {isAlreadyHoliday && !isSelected && !phName && <View style={calStyles.holidayDot} />}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      {/* Legend */}
      <View style={calStyles.legend}>
        <View style={calStyles.legendItem}>
          <View style={[calStyles.legendDot, { backgroundColor: ACCENT }]} />
          <Text style={calStyles.legendText}>Selected</Text>
        </View>
        <View style={calStyles.legendItem}>
          <View style={[calStyles.legendDot, { backgroundColor: HOLIDAY_GREEN, borderWidth: 1, borderColor: HOLIDAY_GREEN_BORDER }]} />
          <Text style={calStyles.legendText}>Already set</Text>
        </View>
        <View style={calStyles.legendItem}>
          <Text style={[calStyles.legendText, { color: PH_RED, fontFamily: "Ubuntu-Bold" }]}>15 </Text>
          <Text style={calStyles.legendText}>Public holiday</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Main screen ───────────────────────────────────────────────────────────────
export default function HolidayScheduleScreen({ navigation, route }) {
  const { turfId, turfName } = route.params;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [holidaySchedule, setHolidaySchedule] = useState({});
  const [resolvedTurfName, setResolvedTurfName] = useState(turfName || "");

  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDates, setSelectedDates] = useState(new Set());
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [label, setLabel] = useState("");
  const [openTime, setOpenTime] = useState("07:00");
  const [closeTime, setCloseTime] = useState("23:00");
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [timePickerField, setTimePickerField] = useState("open");

  // Toast
  const [snackMsg, setSnackMsg] = useState("");
  const [snackVisible, setSnackVisible] = useState(false);

  const showToast = (msg) => {
    setSnackMsg(msg);
    setSnackVisible(true);
  };

  useEffect(() => {
    const load = async () => {
      try {
        const turf = await getDocument("turfs", turfId);
        setHolidaySchedule(turf?.holidaySchedule || {});
        if (!turfName && turf?.name) setResolvedTurfName(turf.name);
      } catch {
        Alert.alert("Error", "Failed to load holiday schedule.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [turfId]);

  const openTimePicker = (field) => {
    setTimePickerField(field);
    setTimePickerVisible(true);
  };

  const handleTimeConfirm = (time) => {
    if (timePickerField === "open") setOpenTime(time);
    else setCloseTime(time);
    setTimePickerVisible(false);
  };

  const resetAddModal = () => {
    setShowAddModal(false);
    setSelectedDates(new Set());
    setLabel("");
    setOpenTime("07:00");
    setCloseTime("23:00");
  };

  const doSave = useCallback(async () => {
    setSaving(true);
    const entry = { openTime, closeTime, label: label.trim() || "Holiday" };
    const updated = { ...holidaySchedule };
    selectedDates.forEach((d) => { updated[d] = entry; });
    try {
      await updateDocument("turfs", turfId, { holidaySchedule: updated });
      setHolidaySchedule(updated);
      resetAddModal();
    } catch {
      Alert.alert("Error", "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [selectedDates, openTime, closeTime, label, holidaySchedule, turfId]);

  const handleAddHoliday = useCallback(() => {
    if (selectedDates.size === 0) {
      Alert.alert("No dates selected", "Tap dates on the calendar to select them.");
      return;
    }
    const [oh] = openTime.split(":").map(Number);
    const [ch] = closeTime.split(":").map(Number);
    if (oh >= ch) {
      Alert.alert("Error", "Open time must be before close time.");
      return;
    }
    const conflicts = [...selectedDates].filter((d) => holidaySchedule[d]);
    if (conflicts.length > 0) {
      Alert.alert(
        "Overwrite?",
        `${conflicts.join(", ")} already have a holiday override.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Overwrite", onPress: doSave },
        ]
      );
      return;
    }
    doSave();
  }, [selectedDates, openTime, closeTime, holidaySchedule, doSave]);

  const handleDelete = useCallback((dateKey) => {
    Alert.alert(
      "Delete Holiday",
      `Remove holiday override for ${dateKey}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const updated = { ...holidaySchedule };
            delete updated[dateKey];
            try {
              await updateDocument("turfs", turfId, { holidaySchedule: updated });
              setHolidaySchedule(updated);
            } catch {
              Alert.alert("Error", "Failed to delete.");
            }
          },
        },
      ]
    );
  }, [holidaySchedule, turfId]);

  const sortedHolidays = Object.entries(holidaySchedule).sort(([a], [b]) => a.localeCompare(b));

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={8}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={NAVY} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Holiday Schedule</Text>
          {resolvedTurfName ? <Text style={styles.headerSub}>{resolvedTurfName}</Text> : null}
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddModal(true)}>
          <MaterialCommunityIcons name="plus" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={ACCENT} size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Surface style={styles.infoBanner} elevation={0}>
            <MaterialCommunityIcons name="information-outline" size={16} color={ACCENT} />
            <Text style={styles.infoText}>
              Holiday dates override regular operating hours. Pricing stays unchanged.
            </Text>
          </Surface>

          {sortedHolidays.length === 0 ? (
            <View style={styles.empty}>
              <MaterialCommunityIcons name="calendar-star" size={52} color="#D1D5DB" />
              <Text style={styles.emptyText}>No holiday overrides set</Text>
              <Text style={styles.emptySubText}>Tap + to add dates with extended hours</Text>
            </View>
          ) : (
            <Surface style={styles.listCard} elevation={2}>
              {sortedHolidays.map(([dateKey, entry], index) => (
                <React.Fragment key={dateKey}>
                  <View style={styles.holidayRow}>
                    <View style={styles.dateDot} />
                    <View style={styles.dateBlock}>
                      <Text style={styles.dateText}>{dateKey}</Text>
                      <Text style={styles.labelText}>{entry.label || "Holiday"}</Text>
                    </View>
                    <View style={styles.hoursBlock}>
                      <MaterialCommunityIcons name="clock-outline" size={13} color="#6B7280" />
                      <Text style={styles.hoursText}>
                        {fmt12(entry.openTime)} – {fmt12(entry.closeTime)}
                      </Text>
                    </View>
                    <IconButton icon="trash-can-outline" size={18} iconColor="#EF4444" onPress={() => handleDelete(dateKey)} />
                  </View>
                  {index < sortedHolidays.length - 1 && <Divider style={styles.divider} />}
                </React.Fragment>
              ))}
            </Surface>
          )}
        </ScrollView>
      )}

      {/* Add Holiday Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent onRequestClose={resetAddModal}>
        <Portal.Host>
          <View style={styles.modalOverlay}>
            <Surface style={styles.modalCard} elevation={8}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add Holiday</Text>
                <IconButton icon="close" size={22} onPress={resetAddModal} />
              </View>

              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <CalendarPicker
                  calMonth={calMonth}
                  setCalMonth={setCalMonth}
                  selectedDates={selectedDates}
                  setSelectedDates={setSelectedDates}
                  holidaySchedule={holidaySchedule}
                  onPublicHolidayTapped={(name) => showToast(`${name} — Public Holiday`)}
                />

                {selectedDates.size > 0 && (
                  <View style={styles.selectionBadge}>
                    <MaterialCommunityIcons name="calendar-check" size={15} color="#fff" />
                    <Text style={styles.selectionBadgeText}>
                      {selectedDates.size} date{selectedDates.size > 1 ? "s" : ""} selected
                    </Text>
                    <TouchableOpacity onPress={() => setSelectedDates(new Set())} style={styles.clearSelBtn}>
                      <Text style={styles.clearSelText}>Clear</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <TextInput
                  mode="outlined"
                  label="Label (e.g. Diwali, Gandhi Jayanti)"
                  value={label}
                  onChangeText={setLabel}
                  style={styles.labelInput}
                  outlineColor="#E5E7EB"
                  activeOutlineColor={ACCENT}
                  left={<TextInput.Icon icon="tag-outline" />}
                />

                <View style={styles.timeRow}>
                  <TouchableOpacity style={styles.timePill} onPress={() => openTimePicker("open")}>
                    <MaterialCommunityIcons name="clock-start" size={16} color={ACCENT} />
                    <View>
                      <Text style={styles.timePillLabel}>Opens at</Text>
                      <Text style={styles.timePillValue}>{fmt12(openTime)}</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.timePill} onPress={() => openTimePicker("close")}>
                    <MaterialCommunityIcons name="clock-end" size={16} color="#EF4444" />
                    <View>
                      <Text style={styles.timePillLabel}>Closes at</Text>
                      <Text style={[styles.timePillValue, { color: "#EF4444" }]}>{fmt12(closeTime)}</Text>
                    </View>
                  </TouchableOpacity>
                </View>

                <Button
                  mode="contained"
                  buttonColor={ACCENT}
                  onPress={handleAddHoliday}
                  loading={saving}
                  disabled={saving || selectedDates.size === 0}
                  style={styles.saveBtn}
                  contentStyle={{ paddingVertical: 4 }}
                >
                  {selectedDates.size > 1 ? `Save ${selectedDates.size} Holidays` : "Save Holiday"}
                </Button>
                <View style={{ height: 16 }} />
              </ScrollView>
            </Surface>
          </View>

          <TimePickerModal
            visible={timePickerVisible}
            onDismiss={() => setTimePickerVisible(false)}
            onConfirm={handleTimeConfirm}
            initialTime={timePickerField === "open" ? openTime : closeTime}
          />

          {/* Toast inside Portal.Host so it renders above the modal */}
          <Snackbar
            visible={snackVisible}
            onDismiss={() => setSnackVisible(false)}
            duration={2500}
            style={styles.snackbar}
          >
            <View style={styles.snackRow}>
              <MaterialCommunityIcons name="flag" size={15} color={PH_RED} style={{ marginRight: 6 }} />
              <Text style={styles.snackText}>{snackMsg}</Text>
            </View>
          </Snackbar>
        </Portal.Host>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Calendar styles ──────────────────────────────────────────────────────────
const calStyles = StyleSheet.create({
  root: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 14,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  monthTitle: { fontFamily: "Ubuntu-Bold", fontSize: 15, color: NAVY, letterSpacing: 0.2 },
  row: { flexDirection: "row", paddingHorizontal: 8 },
  dayHeader: {
    flex: 1,
    textAlign: "center",
    fontFamily: "Ubuntu-Medium",
    fontSize: 11,
    color: "#9CA3AF",
    paddingVertical: 8,
    letterSpacing: 0.3,
  },
  cell: {
    flex: 1,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    margin: 1,
    borderRadius: 8,
  },
  todayCell: { backgroundColor: TODAY_BG, borderWidth: 1.5, borderColor: TODAY_BORDER },
  selectedCell: { backgroundColor: ACCENT, borderRadius: 8 },
  existingHolidayCell: {
    backgroundColor: HOLIDAY_GREEN,
    borderWidth: 1,
    borderColor: HOLIDAY_GREEN_BORDER,
    borderRadius: 8,
  },
  dayNum: { fontFamily: "Ubuntu-Medium", fontSize: 14, color: "#111827" },
  phNum:  { color: PH_RED, fontFamily: "Ubuntu-Bold" },
  pastNum: { color: "#D1D5DB", fontFamily: "Ubuntu-Regular" },
  selectedNum: { color: "#fff", fontFamily: "Ubuntu-Bold" },
  todayNum: { color: "#92400E", fontFamily: "Ubuntu-Bold" },
  phDot: {
    position: "absolute",
    bottom: 3,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: PH_RED,
  },
  holidayDot: {
    position: "absolute",
    bottom: 3,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#10B981",
  },
  legend: {
    flexDirection: "row",
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    flexWrap: "wrap",
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontFamily: "Ubuntu-Regular", fontSize: 11, color: "#6B7280" },
});

// ─── Screen styles ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F0F4F8" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerCenter: { flex: 1 },
  headerTitle: { fontFamily: "Ubuntu-Bold", fontSize: 18, color: NAVY },
  headerSub: { fontFamily: "Ubuntu-Regular", fontSize: 12, color: "#6B7280", marginTop: 1 },
  addBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: ACCENT,
    justifyContent: "center", alignItems: "center",
  },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  scrollContent: { padding: 16, paddingBottom: 32 },
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#EFF6FF",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  infoText: { flex: 1, fontFamily: "Ubuntu-Regular", fontSize: 13, color: NAVY, lineHeight: 18 },
  listCard: { borderRadius: 14, backgroundColor: "#fff", overflow: "hidden" },
  holidayRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, paddingVertical: 11, gap: 10,
  },
  dateDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: ACCENT },
  dateBlock: { flex: 1 },
  dateText: { fontFamily: "Ubuntu-Bold", fontSize: 13, color: "#111827" },
  labelText: { fontFamily: "Ubuntu-Regular", fontSize: 11, color: "#6B7280", marginTop: 1 },
  hoursBlock: { flexDirection: "row", alignItems: "center", gap: 3 },
  hoursText: { fontFamily: "Ubuntu-Medium", fontSize: 11, color: "#374151" },
  divider: { marginLeft: 32, backgroundColor: "#F3F4F6" },
  empty: { alignItems: "center", paddingVertical: 52, gap: 10 },
  emptyText: { fontFamily: "Ubuntu-Bold", fontSize: 16, color: "#9CA3AF" },
  emptySubText: { fontFamily: "Ubuntu-Regular", fontSize: 13, color: "#D1D5DB", textAlign: "center" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    maxHeight: "93%", overflow: "hidden", minHeight:"80%"
  },
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingLeft: 20, paddingRight: 8, paddingVertical: 4,
    borderBottomWidth: 1, borderBottomColor: "#F3F4F6",
  },
  modalTitle: { fontFamily: "Ubuntu-Bold", fontSize: 18, color: NAVY },
  selectionBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#10B981", borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    marginHorizontal: 16, marginBottom: 12,
  },
  selectionBadgeText: { flex: 1, fontFamily: "Ubuntu-Medium", fontSize: 13, color: "#fff" },
  clearSelBtn: {
    backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  clearSelText: { fontFamily: "Ubuntu-Bold", fontSize: 11, color: "#fff" },
  labelInput: { backgroundColor: "#fff", marginHorizontal: 16, marginBottom: 12 },
  timeRow: { flexDirection: "row", gap: 10, marginHorizontal: 16, marginBottom: 16 },
  timePill: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 10,
    borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 14, backgroundColor: "#F9FAFB",
  },
  timePillLabel: { fontFamily: "Ubuntu-Regular", fontSize: 10, color: "#9CA3AF", marginBottom: 1 },
  timePillValue: { fontFamily: "Ubuntu-Bold", fontSize: 14, color: ACCENT },
  saveBtn: { borderRadius: 12, marginHorizontal: 16 },
  snackbar: { backgroundColor: "#1F2937", marginBottom: 8, borderRadius: 10 },
  snackRow: { flexDirection: "row", alignItems: "center" },
  snackText: { fontFamily: "Ubuntu-Medium", fontSize: 13, color: "#fff", flex: 1 },
});
