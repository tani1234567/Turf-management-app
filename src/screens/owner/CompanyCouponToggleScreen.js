import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Switch,
  RefreshControl,
} from "react-native";
import { Text, Surface, Divider, ActivityIndicator } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { TouchableOpacity } from "react-native";
import { useSelector } from "react-redux";
import { selectCompany } from "../../store/slices/companySlice";
import {
  getCompanyCoupons,
  setCompanyCouponStatus,
} from "../../services/firebase/coupons";

const ACCENT = "#10B981";

export default function CompanyCouponToggleScreen({ navigation }) {
  const company = useSelector(selectCompany);
  const companyId = company?.id;

  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState({});

  const loadCoupons = useCallback(async () => {
    if (!companyId) return;
    try {
      const data = await getCompanyCoupons(companyId);
      // Active admin-status first, then paused by admin, then expired
      setCoupons(
        data.sort((a, b) => {
          const rank = (c) =>
            c.status === "active" ? 0 : c.status === "paused" ? 1 : 2;
          return rank(a) - rank(b);
        })
      );
    } catch (err) {
      console.error("Error loading coupons:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadCoupons();
  }, [loadCoupons]);

  const handleToggle = useCallback(
    async (coupon) => {
      if (coupon.status !== "active") return; // admin override — company can't change
      if (toggling[coupon.id]) return;

      const newStatus =
        coupon.companyStatus === "active" ? "paused" : "active";

      // Optimistic update
      setToggling((prev) => ({ ...prev, [coupon.id]: true }));
      setCoupons((prev) =>
        prev.map((c) =>
          c.id === coupon.id ? { ...c, companyStatus: newStatus } : c
        )
      );

      const result = await setCompanyCouponStatus(coupon.id, companyId, newStatus);

      if (!result.success) {
        // Revert on failure
        setCoupons((prev) =>
          prev.map((c) =>
            c.id === coupon.id ? { ...c, companyStatus: coupon.companyStatus } : c
          )
        );
      }
      setToggling((prev) => ({ ...prev, [coupon.id]: false }));
    },
    [companyId, toggling]
  );

  const formatDiscount = (coupon) => {
    if (coupon.discountType === "flat") return `₹${coupon.discountValue} OFF`;
    const cap = coupon.maxDiscountAmount
      ? ` · Max ₹${coupon.maxDiscountAmount}`
      : "";
    return `${coupon.discountValue}% OFF${cap}`;
  };

  const formatValidTo = (ts) => {
    if (!ts) return "—";
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getAdminStatusInfo = (coupon) => {
    if (coupon.status === "expired")
      return { label: "Expired", color: "#9CA3AF", icon: "timer-off-outline" };
    if (coupon.status === "paused")
      return { label: "Paused by PlayGrid", color: "#F59E0B", icon: "pause-circle-outline" };
    return null; // "active" — company toggle works normally
  };

  const isLive = (coupon) =>
    coupon.status === "active" && coupon.companyStatus === "active";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="#1E293B" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Offers & Coupons</Text>
          <Text style={styles.headerSub}>
            Toggle the coupons assigned to your turf
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadCoupons();
              }}
              colors={[ACCENT]}
            />
          }
        >
          {coupons.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconBg}>
                <MaterialCommunityIcons
                  name="tag-off-outline"
                  size={40}
                  color="#D1D5DB"
                />
              </View>
              <Text style={styles.emptyTitle}>No coupons yet</Text>
              <Text style={styles.emptySub}>
                Want to run an offer for your turf? Contact PlayGrid support and
                we'll set it up for you.
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.sectionNote}>
                PlayGrid creates coupons for you. You can toggle them on or off.
                If a coupon is greyed out, it has been paused or expired by
                PlayGrid.
              </Text>

              {coupons.map((coupon, index) => {
                const adminInfo = getAdminStatusInfo(coupon);
                const live = isLive(coupon);
                const isAdminBlocked = coupon.status !== "active";
                const isTogglingThis = !!toggling[coupon.id];

                return (
                  <React.Fragment key={coupon.id}>
                    <Surface style={styles.couponCard} elevation={1}>
                      {/* Top row: code + toggle */}
                      <View style={styles.couponTopRow}>
                        <View style={styles.couponCodeRow}>
                          <MaterialCommunityIcons
                            name="tag-outline"
                            size={16}
                            color={isAdminBlocked ? "#9CA3AF" : ACCENT}
                          />
                          <Text
                            style={[
                              styles.couponCode,
                              isAdminBlocked && styles.mutedText,
                            ]}
                          >
                            {coupon.code}
                          </Text>
                          {live && (
                            <View style={styles.liveBadge}>
                              <Text style={styles.liveBadgeText}>LIVE</Text>
                            </View>
                          )}
                        </View>

                        <Switch
                          value={coupon.companyStatus === "active"}
                          onValueChange={() => handleToggle(coupon)}
                          disabled={isAdminBlocked || isTogglingThis}
                          trackColor={{ false: "#E5E7EB", true: ACCENT + "60" }}
                          thumbColor={
                            coupon.companyStatus === "active" ? ACCENT : "#9CA3AF"
                          }
                        />
                      </View>

                      {/* Title */}
                      <Text
                        style={[
                          styles.couponTitle,
                          isAdminBlocked && styles.mutedText,
                        ]}
                        numberOfLines={2}
                      >
                        {coupon.title}
                      </Text>

                      {/* Discount + validity */}
                      <View style={styles.couponMeta}>
                        <View style={styles.metaChip}>
                          <MaterialCommunityIcons
                            name="percent"
                            size={13}
                            color={isAdminBlocked ? "#9CA3AF" : ACCENT}
                          />
                          <Text
                            style={[
                              styles.metaText,
                              isAdminBlocked && styles.mutedText,
                            ]}
                          >
                            {formatDiscount(coupon)}
                          </Text>
                        </View>
                        {coupon.minBookingAmount > 0 && (
                          <View style={styles.metaChip}>
                            <MaterialCommunityIcons
                              name="currency-inr"
                              size={13}
                              color="#94A3B8"
                            />
                            <Text style={styles.metaTextMuted}>
                              Min ₹{coupon.minBookingAmount}
                            </Text>
                          </View>
                        )}
                        <View style={styles.metaChip}>
                          <MaterialCommunityIcons
                            name="clock-outline"
                            size={13}
                            color="#94A3B8"
                          />
                          <Text style={styles.metaTextMuted}>
                            Valid till {formatValidTo(coupon.validTo)}
                          </Text>
                        </View>
                      </View>

                      {/* Usage */}
                      <View style={styles.usageRow}>
                        <MaterialCommunityIcons
                          name="account-multiple-check-outline"
                          size={14}
                          color="#94A3B8"
                        />
                        <Text style={styles.usageText}>
                          {coupon.usageCount || 0}
                          {coupon.totalUsageLimit
                            ? ` / ${coupon.totalUsageLimit} used`
                            : " used"}
                        </Text>
                      </View>

                      {/* Admin override notice */}
                      {adminInfo && (
                        <View style={styles.adminNotice}>
                          <MaterialCommunityIcons
                            name={adminInfo.icon}
                            size={14}
                            color={adminInfo.color}
                          />
                          <Text
                            style={[styles.adminNoticeText, { color: adminInfo.color }]}
                          >
                            {adminInfo.label}
                          </Text>
                        </View>
                      )}
                    </Surface>

                    {index < coupons.length - 1 && (
                      <View style={{ height: 10 }} />
                    )}
                  </React.Fragment>
                );
              })}

              <View style={styles.contactNote}>
                <MaterialCommunityIcons
                  name="information-outline"
                  size={16}
                  color="#94A3B8"
                />
                <Text style={styles.contactNoteText}>
                  Want to create a new offer or change coupon details? Contact
                  PlayGrid support.
                </Text>
              </View>
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: { flex: 1 },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Ubuntu-Bold",
    color: "#1E293B",
  },
  headerSub: {
    fontSize: 12,
    fontFamily: "Ubuntu-Regular",
    color: "#94A3B8",
    marginTop: 1,
  },

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },

  sectionNote: {
    fontSize: 13,
    fontFamily: "Ubuntu-Regular",
    color: "#64748B",
    lineHeight: 19,
    marginBottom: 16,
  },

  couponCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    gap: 8,
  },

  couponTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  couponCodeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  couponCode: {
    fontFamily: "Ubuntu-Bold",
    fontSize: 15,
    color: ACCENT,
    letterSpacing: 0.5,
  },
  liveBadge: {
    backgroundColor: ACCENT,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 20,
  },
  liveBadgeText: {
    fontSize: 10,
    fontFamily: "Ubuntu-Bold",
    color: "#fff",
    letterSpacing: 0.4,
  },

  couponTitle: {
    fontFamily: "Ubuntu-Medium",
    fontSize: 14,
    color: "#1E293B",
    lineHeight: 19,
  },

  couponMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  metaText: {
    fontSize: 12,
    fontFamily: "Ubuntu-Bold",
    color: ACCENT,
  },
  metaTextMuted: {
    fontSize: 12,
    fontFamily: "Ubuntu-Regular",
    color: "#94A3B8",
  },

  usageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  usageText: {
    fontSize: 12,
    fontFamily: "Ubuntu-Regular",
    color: "#94A3B8",
  },

  adminNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFF7ED",
    padding: 8,
    borderRadius: 8,
    marginTop: 2,
  },
  adminNoticeText: {
    fontSize: 12,
    fontFamily: "Ubuntu-Medium",
  },

  mutedText: { color: "#9CA3AF" },

  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 12,
  },
  emptyIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Ubuntu-Bold",
    color: "#475569",
  },
  emptySub: {
    fontSize: 14,
    fontFamily: "Ubuntu-Regular",
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 280,
  },

  contactNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 20,
    padding: 14,
    backgroundColor: "#fff",
    borderRadius: 12,
  },
  contactNoteText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Ubuntu-Regular",
    color: "#94A3B8",
    lineHeight: 18,
  },
});
