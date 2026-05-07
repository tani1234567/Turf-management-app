import React, { useState, useEffect } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { Text, Dialog, Portal, Button } from "react-native-paper";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";

// ─── Constants ────────────────────────────────────────────────────────────────
const ACCENT        = "#9C27B0";
const ACCENT_GLOW   = "rgba(156,39,176,0.13)";
const CLOCK_SIZE    = 256;
const CENTER        = CLOCK_SIZE / 2;
const FACE_R        = 112;   // clock face radius
const NUM_R         = 86;    // radius where 1-12 sit
const HAND_STEM_LEN = 58;    // where the hand line ends (before arrowhead base)
const ARROW_TIP_LEN = 14;    // arrowhead length beyond stem
const ARROW_WING    = 7;     // arrowhead half-width

// ─── Helpers ──────────────────────────────────────────────────────────────────
/** Degrees → (x, y) on circle of radius r, 0° = 12 o'clock, clockwise */
const polar = (deg, r) => {
  const rad = (deg - 90) * (Math.PI / 180);
  return { x: CENTER + r * Math.cos(rad), y: CENTER + r * Math.sin(rad) };
};

/** Hour (1-12) → angle degrees */
const hourToDeg = (h) => ((h % 12) / 12) * 360;

/** Touch (lx, ly) → nearest hour 1-12 */
const touchToHour = (lx, ly) => {
  const dx = lx - CENTER;
  const dy = ly - CENTER;
  let a = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
  if (a < 0) a += 360;
  let h = Math.round(a / 30);
  if (h === 0 || h > 12) h = 12;
  return h;
};

/** Build SVG arrowhead path at the tip of the hand */
const arrowPath = (deg, stemEnd) => {
  const rad = (deg - 90) * (Math.PI / 180);
  const ux =  Math.cos(rad);   // unit vector along hand direction
  const uy =  Math.sin(rad);
  const px = -uy;              // perpendicular (left/right)
  const py =  ux;

  // Tip is ahead of stemEnd
  const tip  = { x: stemEnd.x + ux * ARROW_TIP_LEN, y: stemEnd.y + uy * ARROW_TIP_LEN };
  // Base corners sit behind stemEnd
  const bl   = { x: stemEnd.x + px * ARROW_WING,    y: stemEnd.y + py * ARROW_WING };
  const br   = { x: stemEnd.x - px * ARROW_WING,    y: stemEnd.y - py * ARROW_WING };

  return `M ${f(tip.x)} ${f(tip.y)} L ${f(bl.x)} ${f(bl.y)} L ${f(br.x)} ${f(br.y)} Z`;
};

const f = (n) => n.toFixed(2);

// ─── Component ────────────────────────────────────────────────────────────────
export default function TimePickerModal({
  visible,
  onDismiss,
  onConfirm,
  initialTime = "06:00",
  label      = "Select Time",
}) {
  const [hours,   setHours]   = useState(6);
  const [minutes, setMinutes] = useState(0);

  useEffect(() => {
    if (visible) {
      const [h, m] = initialTime.split(":").map(Number);
      setHours(isNaN(h) ? 6 : h);
      setMinutes(m === 30 ? 30 : 0);
    }
  }, [visible, initialTime]);

  // 24-hour → display 1-12
  const isAM        = hours < 12;
  const displayHour = isAM ? (hours === 0 ? 12 : hours) : hours === 12 ? 12 : hours - 12;

  const toggleAMPM = (ap) => {
    if (ap === "AM" && !isAM) setHours(hours === 12 ? 0 : hours - 12);
    if (ap === "PM" &&  isAM) setHours(hours === 0  ? 12 : hours + 12);
  };

  // ── Touch handling ─────────────────────────────────────────────────────────
  const handleTouch = ({ nativeEvent: { locationX: lx, locationY: ly } }) => {
    const dist = Math.sqrt((lx - CENTER) ** 2 + (ly - CENTER) ** 2);
    // Only respond inside the clock face, ignore dead-center
    if (dist < 18 || dist > FACE_R + 16) return;
    const h    = touchToHour(lx, ly);
    const full = isAM ? (h === 12 ? 0 : h) : (h === 12 ? 12 : h + 12);
    setHours(full);
  };

  const responder = {
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder:  () => true,
    onResponderGrant: handleTouch,
    onResponderMove:  handleTouch,
  };

  // ── SVG geometry ───────────────────────────────────────────────────────────
  const handDeg  = hourToDeg(displayHour);
  const stemEnd  = polar(handDeg, HAND_STEM_LEN);
  const tailEnd  = polar(handDeg + 180, 14); // short tail behind center
  const arrow    = arrowPath(handDeg, stemEnd);

  // 12 hour items
  const hourItems = Array.from({ length: 12 }, (_, i) => {
    const num = i + 1;
    const pos = polar(hourToDeg(num), NUM_R);
    return { num, ...pos, active: displayHour === num };
  });

  const timeString = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.headerLabel}>{label.toUpperCase()}</Text>

          <View style={styles.headerRow}>
            {/* HH:MM + AM/PM label inline */}
            <View style={styles.timeBlock}>
              <Text style={styles.timeDisplay}>{timeString}</Text>
              <Text style={styles.ampmLabel}>{isAM ? "AM" : "PM"}</Text>
            </View>

            {/* AM / PM toggle pills */}
            <View style={styles.ampmCol}>
              {["AM", "PM"].map((ap) => {
                const on = (ap === "AM") === isAM;
                return (
                  <TouchableOpacity
                    key={ap}
                    style={[styles.ampmBtn, on && styles.ampmBtnOn]}
                    onPress={() => toggleAMPM(ap)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.ampmTxt, on && styles.ampmTxtOn]}>{ap}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* ── Clock face ──────────────────────────────────────────────────── */}
        <View style={styles.clockWrapper}>
          {/* SVG — visual only, no touch events */}
          <Svg
            width={CLOCK_SIZE}
            height={CLOCK_SIZE}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          >
            {/* Face background */}
            <Circle cx={CENTER} cy={CENTER} r={FACE_R} fill="#F7F2FF" />
            <Circle cx={CENTER} cy={CENTER} r={FACE_R} fill="none" stroke="#E2D4F0" strokeWidth={1.5} />

            {/* 60 tick marks (major at every 5) */}
            {Array.from({ length: 60 }, (_, i) => {
              const a     = (i / 60) * 2 * Math.PI - Math.PI / 2;
              const major = i % 5 === 0;
              const r1    = FACE_R - (major ? 13 : 6);
              return (
                <Line
                  key={`tk${i}`}
                  x1={f(CENTER + r1          * Math.cos(a))}
                  y1={f(CENTER + r1          * Math.sin(a))}
                  x2={f(CENTER + (FACE_R-2)  * Math.cos(a))}
                  y2={f(CENTER + (FACE_R-2)  * Math.sin(a))}
                  stroke={major ? "#C4A8DE" : "#E6DCF4"}
                  strokeWidth={major ? 1.5 : 0.8}
                />
              );
            })}

            {/* Glow halo on active number (no circle border, just soft fill) */}
            {hourItems
              .filter((h) => h.active)
              .map(({ num, x, y }) => (
                <Circle key={`glow${num}`} cx={x} cy={y} r={22} fill={ACCENT_GLOW} />
              ))}

            {/* Hand tail */}
            <Line
              x1={f(CENTER)} y1={f(CENTER)}
              x2={f(tailEnd.x)} y2={f(tailEnd.y)}
              stroke={ACCENT}
              strokeWidth={2.5}
              strokeLinecap="round"
            />

            {/* Hand stem */}
            <Line
              x1={f(CENTER)} y1={f(CENTER)}
              x2={f(stemEnd.x)} y2={f(stemEnd.y)}
              stroke={ACCENT}
              strokeWidth={2.5}
              strokeLinecap="round"
            />

            {/* Arrowhead */}
            <Path d={arrow} fill={ACCENT} />

            {/* Center pivot dot */}
            <Circle cx={CENTER} cy={CENTER} r={5} fill={ACCENT} />

            {/* Hour numbers — colored & larger when active, plain otherwise */}
            {hourItems.map(({ num, x, y, active }) => (
              <SvgText
                key={`n${num}`}
                x={f(x)}
                y={f(y + 5.5)}
                textAnchor="middle"
                fontSize={active ? "17" : "14"}
                fontWeight={active ? "700" : "400"}
                fill={active ? ACCENT : "#666"}
              >
                {num}
              </SvgText>
            ))}
          </Svg>

          {/* Touch capture overlay (invisible, full clock size) */}
          <View style={{ width: CLOCK_SIZE, height: CLOCK_SIZE }} {...responder} />
        </View>

        {/* ── Minute selector ─────────────────────────────────────────────── */}
        <View style={styles.minuteSection}>
          <Text style={styles.minuteTitle}>Minutes</Text>
          <View style={styles.minuteList}>
            {[0, 30].map((m, idx) => (
              <TouchableOpacity
                key={m}
                style={[
                  styles.minuteRow,
                  idx === 0 && styles.minuteRowFirst,
                  idx === 1 && styles.minuteRowLast,
                  minutes === m && styles.minuteRowActive,
                ]}
                onPress={() => setMinutes(m)}
                activeOpacity={0.75}
              >
                <Text style={[styles.minuteRowTxt, minutes === m && styles.minuteRowTxtActive]}>
                  {String(m).padStart(2, "0")}
                </Text>
                {minutes === m && (
                  <View style={styles.minuteCheckDot} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Actions ─────────────────────────────────────────────────────── */}
        <Dialog.Actions style={styles.actions}>
          <Button onPress={onDismiss} textColor="#999">Cancel</Button>
          <Button
            mode="contained"
            buttonColor={ACCENT}
            onPress={() => { onConfirm(timeString); onDismiss(); }}
          >
            Set Time
          </Button>
        </Dialog.Actions>

      </Dialog>
    </Portal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  dialog: {
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#fff",
    marginHorizontal: 16,
  },

  // Header
  header: {
    backgroundColor: ACCENT,
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 20,
  },
  headerLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 11,
    fontFamily: "Ubuntu-Bold",
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  timeBlock: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  timeDisplay: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 52,
    color: "#fff",
    letterSpacing: 2,
    lineHeight: 58,
  },
  ampmLabel: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 22,
    color: "rgba(255,255,255,0.85)",
    marginBottom: 6,
  },
  ampmCol: {
    gap: 8,
    marginLeft: 12,
  },
  ampmBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
  },
  ampmBtnOn: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderColor: "#fff",
  },
  ampmTxt: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 13,
    color: "rgba(255,255,255,0.5)",
  },
  ampmTxtOn: {
    color: "#fff",
  },

  // Clock
  clockWrapper: {
    alignSelf: "center",
    width: CLOCK_SIZE,
    height: CLOCK_SIZE,
    marginTop: 20,
    marginBottom: 16,
  },

  // Minute list
  minuteSection: {
    marginHorizontal: 22,
    marginBottom: 16,
  },
  minuteTitle: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 11,
    color: "#AAA",
    letterSpacing: 1,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  minuteList: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2D4F0",
    overflow: "hidden",
  },
  minuteRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "#F7F2FF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2D4F0",
  },
  minuteRowFirst: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  minuteRowLast: {
    borderBottomWidth: 0,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  minuteRowActive: {
    backgroundColor: ACCENT,
  },
  minuteRowTxt: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 18,
    color: ACCENT,
  },
  minuteRowTxtActive: {
    color: "#fff",
  },
  minuteCheckDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#fff",
  },

  // Actions
  actions: {
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
});
