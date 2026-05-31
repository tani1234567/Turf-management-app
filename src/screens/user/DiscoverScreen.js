import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  ScrollView,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  Linking,
  Alert,
  Image,
  Animated,
  Dimensions,
} from "react-native";
import { Text, ActivityIndicator } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Clipboard from "expo-clipboard";
import firestore from "@react-native-firebase/firestore";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const USER_COLOR = "#10B981";
const FEATURED_CARD_WIDTH = SCREEN_WIDTH - 64;
const BANNER_WIDTH = SCREEN_WIDTH - 48;

const CATEGORIES = [
  { id: "all", label: "All", icon: "tag-multiple-outline", color: "#6B7280" },
  { id: "sports_equipment", label: "Sports", icon: "basketball", color: "#3B82F6" },
  { id: "food_beverage", label: "Food & Drink", icon: "food-apple", color: "#F59E0B" },
  { id: "turf_promo", label: "Turf Deals", icon: "soccer-field", color: USER_COLOR },
  { id: "academy", label: "Academy", icon: "whistle", color: "#8B5CF6" },
];

const CATEGORY_GRADIENTS = {
  sports_equipment: ["#3B82F6", "#1D4ED8"],
  food_beverage: ["#F59E0B", "#D97706"],
  turf_promo: ["#10B981", "#059669"],
  academy: ["#8B5CF6", "#6D28D9"],
  default: ["#6B7280", "#4B5563"],
};

function getCategoryMeta(categoryId) {
  return CATEGORIES.find((c) => c.id === categoryId) || CATEGORIES[0];
}

function formatDate(timestamp) {
  if (!timestamp) return null;
  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return null;
  }
}

// ─── Featured Card ─────────────────────────────────────────────────────────────
function FeaturedCard({ offer, onPress }) {
  const gradients = CATEGORY_GRADIENTS[offer.category] || CATEGORY_GRADIENTS.default;
  const categoryMeta = getCategoryMeta(offer.category);

  return (
    <TouchableOpacity
      style={styles.featuredCard}
      onPress={onPress}
      activeOpacity={0.88}
    >
      {offer.bannerImage ? (
        <>
          <Image
            source={{ uri: offer.bannerImage }}
            style={styles.featuredImage}
            resizeMode="cover"
          />
          {/* Dark overlay for text readability on banner image */}
          <View style={styles.featuredImageOverlay} />
          {/* Text content overlay — brand, title, discount */}
          <View style={styles.featuredBannerContent}>
            <Text style={styles.featuredBrand} numberOfLines={1}>{offer.brandName}</Text>
            <Text style={styles.featuredCardTitle} numberOfLines={2}>{offer.title}</Text>
            {offer.discount && (
              <View style={styles.featuredDiscountPill}>
                <Text style={styles.featuredDiscountText}>{offer.discount}</Text>
              </View>
            )}
          </View>
        </>
      ) : (
        <LinearGradient colors={gradients} style={styles.featuredGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <View style={styles.featuredGradientContent}>
            <MaterialCommunityIcons name={categoryMeta.icon} size={40} color="rgba(255,255,255,0.3)" />
            <Text style={styles.featuredBrand} numberOfLines={1}>{offer.brandName}</Text>
            <Text style={styles.featuredCardTitle} numberOfLines={2}>{offer.title}</Text>
            {offer.discount && (
              <View style={styles.featuredDiscountPill}>
                <Text style={styles.featuredDiscountText}>{offer.discount}</Text>
              </View>
            )}
          </View>
        </LinearGradient>
      )}

      {/* Overlay: featured badge + category pill */}
      <View style={styles.featuredOverlayTop}>
        <View style={styles.featuredBadge}>
          <MaterialCommunityIcons name="star" size={10} color="#fff" />
          <Text style={styles.featuredBadgeText}>FEATURED</Text>
        </View>
        <View style={[styles.featuredCategoryPill, { backgroundColor: categoryMeta.color }]}>
          <Text style={styles.featuredCategoryText}>{categoryMeta.label}</Text>
        </View>
      </View>

      {/* Brand icon overlay — only on banner images, bottom-left corner */}
      {offer.iconImage && offer.bannerImage && (
        <View style={styles.featuredIconOverlay}>
          <Image
            source={{ uri: offer.iconImage }}
            style={styles.featuredIconImage}
            resizeMode="cover"
          />
        </View>
      )}

      {/* Tap hint */}
      {!offer.bannerImage && (
        <View style={styles.featuredTapHint}>
          <MaterialCommunityIcons name="chevron-right" size={16} color="rgba(255,255,255,0.7)" />
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Offer Card (grid) ─────────────────────────────────────────────────────────
function OfferCard({ offer, onPress }) {
  const categoryMeta = getCategoryMeta(offer.category);
  const color = categoryMeta.color;

  return (
    <TouchableOpacity style={styles.offerCard} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.offerCardInner}>
        {/* Icon — brand image or category fallback */}
        {offer.iconImage ? (
          <Image
            source={{ uri: offer.iconImage }}
            style={styles.offerCardIconImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.offerCardIconBg, { backgroundColor: color + "18" }]}>
            <MaterialCommunityIcons name={categoryMeta.icon} size={26} color={color} />
          </View>
        )}

        <Text style={styles.offerCardBrand} numberOfLines={1}>{offer.brandName}</Text>
        <Text style={styles.offerCardTitle} numberOfLines={2}>{offer.title}</Text>

        {offer.discount && (
          <View style={[styles.offerDiscountBadge, { backgroundColor: color }]}>
            <Text style={styles.offerDiscountText}>{offer.discount}</Text>
          </View>
        )}

        {/* Footer icons */}
        <View style={styles.offerCardFooter}>
          {offer.couponCode && (
            <View style={styles.offerFooterChip}>
              <MaterialCommunityIcons name="ticket-percent-outline" size={12} color={color} />
              <Text style={[styles.offerFooterChipText, { color }]}>Code</Text>
            </View>
          )}
          {offer.externalLink && (
            <View style={styles.offerFooterChip}>
              <MaterialCommunityIcons name="open-in-new" size={12} color={color} />
              <Text style={[styles.offerFooterChipText, { color }]}>Link</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Turf Promo Card (full-width) ──────────────────────────────────────────────
function TurfPromoCard({ offer, onPress }) {
  return (
    <TouchableOpacity style={styles.turfPromoCard} onPress={onPress} activeOpacity={0.88}>
      <LinearGradient
        colors={["#10B981", "#059669"]}
        style={styles.turfPromoGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <View style={styles.turfPromoContent}>
          <View style={styles.turfPromoLeft}>
            {offer.iconImage ? (
              <Image
                source={{ uri: offer.iconImage }}
                style={styles.turfPromoIconImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.turfPromoIconBg}>
                <MaterialCommunityIcons name="soccer-field" size={28} color="#fff" />
              </View>
            )}
            <View style={styles.turfPromoText}>
              <Text style={styles.turfPromoBrand} numberOfLines={1}>{offer.brandName}</Text>
              <Text style={styles.turfPromoTitle} numberOfLines={2}>{offer.title}</Text>
            </View>
          </View>
          {offer.discount && (
            <View style={styles.turfPromoDiscountBadge}>
              <Text style={styles.turfPromoDiscount}>{offer.discount}</Text>
            </View>
          )}
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

// ─── Offer Detail Bottom Sheet ─────────────────────────────────────────────────
function OfferDetailSheet({ offer, onClose }) {
  const [codeCopied, setCodeCopied] = useState(false);
  const translateY = useRef(new Animated.Value(400)).current;

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: 0,
      tension: 65,
      friction: 10,
      useNativeDriver: true,
    }).start();
  }, []);

  const close = useCallback(() => {
    Animated.timing(translateY, {
      toValue: 600,
      duration: 220,
      useNativeDriver: true,
    }).start(onClose);
  }, [onClose]);

  const handleCopy = useCallback(async () => {
    await Clipboard.setStringAsync(offer.couponCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2500);
  }, [offer.couponCode]);

  const handleLink = useCallback(() => {
    Linking.openURL(offer.externalLink).catch(() =>
      Alert.alert("Error", "Could not open this link.")
    );
  }, [offer.externalLink]);

  const categoryMeta = getCategoryMeta(offer.category);
  const color = categoryMeta.color;
  const validDate = formatDate(offer.validUntil);

  return (
    <Pressable style={styles.sheetOverlay} onPress={close}>
      <Animated.View
        style={[styles.sheet, { transform: [{ translateY }] }]}
        // Prevent tap from bubbling to overlay
      >
        <Pressable onPress={() => {}}>
          {/* Drag handle */}
          <View style={styles.dragHandle} />

          {/* Category tag */}
          <View style={[styles.sheetCategoryTag, { backgroundColor: color + "18" }]}>
            <MaterialCommunityIcons name={categoryMeta.icon} size={14} color={color} />
            <Text style={[styles.sheetCategoryText, { color }]}>{categoryMeta.label}</Text>
          </View>

          {/* Brand + title */}
          <Text style={styles.sheetBrand}>{offer.brandName}</Text>
          <Text style={styles.sheetTitle}>{offer.title}</Text>

          {/* Discount highlight */}
          {offer.discount && (
            <View style={[styles.sheetDiscountRow, { borderColor: color + "40", backgroundColor: color + "0D" }]}>
              <MaterialCommunityIcons name="tag" size={20} color={color} />
              <Text style={[styles.sheetDiscount, { color }]}>{offer.discount}</Text>
            </View>
          )}

          {/* Description */}
          {offer.description ? (
            <Text style={styles.sheetDescription}>{offer.description}</Text>
          ) : null}

          {/* Valid until */}
          {validDate && (
            <View style={styles.sheetValidRow}>
              <MaterialCommunityIcons name="clock-outline" size={14} color="#9CA3AF" />
              <Text style={styles.sheetValidText}>Valid until {validDate}</Text>
            </View>
          )}

          {/* Actions */}
          <View style={styles.sheetActions}>
            {offer.couponCode && (
              <TouchableOpacity
                style={[styles.sheetBtn, { backgroundColor: color }]}
                onPress={handleCopy}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons
                  name={codeCopied ? "check-circle" : "content-copy"}
                  size={18}
                  color="#fff"
                />
                <Text style={styles.sheetBtnText}>
                  {codeCopied ? "Copied!" : `Copy Code: ${offer.couponCode}`}
                </Text>
              </TouchableOpacity>
            )}
            {offer.externalLink && (
              <TouchableOpacity
                style={[
                  styles.sheetBtn,
                  offer.couponCode
                    ? [styles.sheetBtnOutline, { borderColor: color }]
                    : { backgroundColor: color },
                ]}
                onPress={handleLink}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons
                  name="open-in-new"
                  size={18}
                  color={offer.couponCode ? color : "#fff"}
                />
                <Text
                  style={[
                    styles.sheetBtnText,
                    offer.couponCode && { color },
                  ]}
                >
                  Visit Website
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </Pressable>
      </Animated.View>
    </Pressable>
  );
}

// ─── Platform Banner Card ──────────────────────────────────────────────────────
function PlatformBannerCard({ banner }) {
  const handlePress = async () => {
    if (banner.couponCode) {
      await Clipboard.setStringAsync(banner.couponCode);
      Alert.alert(
        "Code Copied!",
        `"${banner.couponCode}" copied to clipboard. Apply it when booking a turf.`
      );
    }
  };

  return (
    <TouchableOpacity
      style={[styles.bannerCard, { width: BANNER_WIDTH }]}
      onPress={handlePress}
      activeOpacity={0.9}
    >
      {banner.imageUrl ? (
        <>
          <Image
            source={{ uri: banner.imageUrl }}
            style={styles.bannerImage}
            resizeMode="cover"
          />
          <View style={styles.bannerImageOverlay} />
          <View style={styles.bannerTextOverlay}>
            <Text style={styles.bannerTitle} numberOfLines={1}>{banner.title}</Text>
            {banner.subtitle ? (
              <Text style={styles.bannerSubtitle} numberOfLines={1}>{banner.subtitle}</Text>
            ) : null}
            {banner.couponCode ? (
              <View style={styles.bannerCodePill}>
                <MaterialCommunityIcons name="tag" size={12} color="#fff" />
                <Text style={styles.bannerCodeText}>{banner.couponCode}</Text>
              </View>
            ) : null}
          </View>
        </>
      ) : (
        <LinearGradient
          colors={["#10B981", "#059669"]}
          style={styles.bannerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <View style={styles.bannerGradientContent}>
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle} numberOfLines={1}>{banner.title}</Text>
              {banner.subtitle ? (
                <Text style={[styles.bannerSubtitle, { color: "rgba(255,255,255,0.8)" }]} numberOfLines={1}>
                  {banner.subtitle}
                </Text>
              ) : null}
            </View>
            {banner.couponCode ? (
              <View style={[styles.bannerCodePill, { backgroundColor: "#fff" }]}>
                <MaterialCommunityIcons name="tag" size={12} color="#10B981" />
                <Text style={[styles.bannerCodeText, { color: "#10B981" }]}>
                  {banner.couponCode}
                </Text>
              </View>
            ) : null}
          </View>
        </LinearGradient>
      )}
    </TouchableOpacity>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────
export default function DiscoverScreen() {
  const [offers, setOffers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [platformBanners, setPlatformBanners] = useState([]);

  // Live subscription to platform promotional banners
  useEffect(() => {
    const unsub = firestore()
      .collection("platformBanners")
      .where("isActive", "==", true)
      .orderBy("displayOrder", "asc")
      .onSnapshot(
        (snap) =>
          setPlatformBanners(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        (err) => console.error("[DiscoverScreen] banners error:", err)
      );
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsubscribe = firestore()
      .collection("offers")
      .where("isActive", "==", true)
      .orderBy("sortOrder", "asc")
      .orderBy("createdAt", "asc")
      .onSnapshot(
        (snapshot) => {
          const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
          setOffers(data);
          setIsLoading(false);
        },
        (error) => {
          console.error("[DiscoverScreen] Firestore error:", error);
          setIsLoading(false);
        }
      );
    return () => unsubscribe();
  }, []);

  const featuredOffers = offers.filter((o) => o.isFeatured);

  const filteredOffers =
    selectedCategory === "all"
      ? offers
      : offers.filter((o) => o.category === selectedCategory);

  const renderOfferGrid = useCallback(() => {
    const rows = [];
    const nonTurfOffers = filteredOffers.filter((o) => o.category !== "turf_promo");
    const turfOffers = filteredOffers.filter((o) => o.category === "turf_promo");

    // Turf promo full-width cards
    if (turfOffers.length > 0 && (selectedCategory === "all" || selectedCategory === "turf_promo")) {
      rows.push(
        <View key="turf-section">
          {selectedCategory === "all" && (
            <Text style={styles.gridSectionLabel}>Turf Promotions</Text>
          )}
          {turfOffers.map((offer) => (
            <TurfPromoCard
              key={offer.id}
              offer={offer}
              onPress={() => setSelectedOffer(offer)}
            />
          ))}
        </View>
      );
    }

    // Regular 2-column grid
    if (nonTurfOffers.length > 0) {
      if (selectedCategory === "all" && turfOffers.length > 0) {
        rows.push(<Text key="offers-label" style={styles.gridSectionLabel}>Offers & Deals</Text>);
      }
      for (let i = 0; i < nonTurfOffers.length; i += 2) {
        rows.push(
          <View key={`row-${i}`} style={styles.offerRow}>
            <OfferCard
              offer={nonTurfOffers[i]}
              onPress={() => setSelectedOffer(nonTurfOffers[i])}
            />
            {nonTurfOffers[i + 1] ? (
              <OfferCard
                offer={nonTurfOffers[i + 1]}
                onPress={() => setSelectedOffer(nonTurfOffers[i + 1])}
              />
            ) : (
              <View style={styles.offerCardSpacer} />
            )}
          </View>
        );
      }
    }

    return rows;
  }, [filteredOffers, selectedCategory]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Discover</Text>
          <Text style={styles.headerSubtitle}>Offers & Promotions</Text>
        </View>
        <View style={styles.headerIconBg}>
          <MaterialCommunityIcons name="tag-heart-outline" size={22} color={USER_COLOR} />
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={USER_COLOR} />
          <Text style={styles.loadingText}>Loading offers...</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Platform Promotional Banners */}
          {platformBanners.length > 0 && (
            <View style={styles.bannerSection}>
              <FlatList
                horizontal
                data={platformBanners}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => <PlatformBannerCard banner={item} />}
                showsHorizontalScrollIndicator={false}
                snapToInterval={BANNER_WIDTH + 12}
                decelerationRate="fast"
                contentContainerStyle={styles.bannerList}
              />
            </View>
          )}

          {/* Featured Carousel */}
          {featuredOffers.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Featured</Text>
                <View style={styles.sectionTitleAccent} />
              </View>
              <FlatList
                horizontal
                data={featuredOffers}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <FeaturedCard offer={item} onPress={() => setSelectedOffer(item)} />
                )}
                showsHorizontalScrollIndicator={false}
                snapToInterval={FEATURED_CARD_WIDTH + 12}
                decelerationRate="fast"
                contentContainerStyle={styles.featuredList}
              />
            </View>
          )}

          {/* Category Pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryScroll}
            contentContainerStyle={styles.categoryContent}
          >
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryPill,
                    isSelected && { backgroundColor: cat.color, borderColor: cat.color },
                  ]}
                  onPress={() => setSelectedCategory(cat.id)}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons
                    name={cat.icon}
                    size={15}
                    color={isSelected ? "#fff" : cat.color}
                  />
                  <Text
                    style={[
                      styles.categoryPillLabel,
                      isSelected ? { color: "#fff" } : { color: cat.color },
                    ]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Offer Grid */}
          <View style={styles.gridSection}>
            {filteredOffers.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconBg}>
                  <MaterialCommunityIcons name="tag-off-outline" size={40} color="#D1D5DB" />
                </View>
                <Text style={styles.emptyTitle}>No offers yet</Text>
                <Text style={styles.emptySubtitle}>
                  Check back soon — exciting deals and promotions are on the way.
                </Text>
              </View>
            ) : (
              renderOfferGrid()
            )}
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      {/* Offer Detail Modal */}
      <Modal
        visible={!!selectedOffer}
        transparent
        animationType="none"
        onRequestClose={() => setSelectedOffer(null)}
        statusBarTranslucent
      >
        {selectedOffer && (
          <OfferDetailSheet
            offer={selectedOffer}
            onClose={() => setSelectedOffer(null)}
          />
        )}
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: "Ubuntu-Bold",
    color: "#1E293B",
    lineHeight: 30,
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#94A3B8",
    fontFamily: "Ubuntu-Regular",
    marginTop: 1,
  },
  headerIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: USER_COLOR + "12",
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Loading ──────────────────────────────────────────────────────────────────
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: "#94A3B8",
    fontFamily: "Ubuntu-Regular",
  },

  // ── Scroll ───────────────────────────────────────────────────────────────────
  scrollContent: {
    paddingTop: 8,
  },

  // ── Section ──────────────────────────────────────────────────────────────────
  section: {
    marginBottom: 4,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Ubuntu-Bold",
    color: "#1E293B",
  },
  sectionTitleAccent: {
    height: 3,
    width: 20,
    borderRadius: 2,
    backgroundColor: USER_COLOR,
  },

  // ── Featured Carousel ─────────────────────────────────────────────────────────
  featuredList: {
    paddingLeft: 20,
    paddingRight: 8,
  },
  featuredCard: {
    width: FEATURED_CARD_WIDTH,
    height: 160,
    borderRadius: 16,
    marginRight: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  featuredImage: {
    width: "100%",
    height: "100%",
  },
  featuredGradient: {
    flex: 1,
    padding: 20,
    justifyContent: "flex-end",
  },
  featuredGradientContent: {
    gap: 4,
  },
  featuredBrand: {
    fontSize: 11,
    fontFamily: "Ubuntu-Medium",
    color: "rgba(255,255,255,0.75)",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  featuredCardTitle: {
    fontSize: 17,
    fontFamily: "Ubuntu-Bold",
    color: "#fff",
    lineHeight: 22,
  },
  featuredDiscountPill: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.22)",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    marginTop: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
  },
  featuredDiscountText: {
    fontSize: 12,
    fontFamily: "Ubuntu-Bold",
    color: "#fff",
  },
  featuredOverlayTop: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  featuredBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.35)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  featuredBadgeText: {
    fontSize: 9,
    fontFamily: "Ubuntu-Bold",
    color: "#fff",
    letterSpacing: 0.5,
  },
  featuredCategoryPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
  },
  featuredCategoryText: {
    fontSize: 10,
    fontFamily: "Ubuntu-Bold",
    color: "#fff",
  },
  featuredIconOverlay: {
    position: "absolute",
    bottom: 12,
    right: 14,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.4)",
    backgroundColor: "#fff",
  },
  featuredIconImage: {
    width: 36,
    height: 36,
  },
  featuredImageOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  featuredBannerContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 14,
    paddingRight: 64,
    paddingVertical: 16,
    gap: 4,
  },
  featuredTapHint: {
    position: "absolute",
    bottom: 12,
    right: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 12,
    padding: 2,
  },

  // ── Category Pills ────────────────────────────────────────────────────────────
  categoryScroll: {
    marginTop: 4,
    marginBottom: 16,
  },
  categoryContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  categoryPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    backgroundColor: "#fff",
    marginRight: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  categoryPillLabel: {
    fontSize: 13,
    fontFamily: "Ubuntu-Medium",
  },

  // ── Grid Section ─────────────────────────────────────────────────────────────
  gridSection: {
    paddingHorizontal: 16,
  },
  gridSectionLabel: {
    fontSize: 13,
    fontFamily: "Ubuntu-Bold",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
    marginTop: 4,
  },
  offerRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  offerCardSpacer: {
    flex: 1,
  },

  // ── Offer Card ────────────────────────────────────────────────────────────────
  offerCard: {
    flex: 1,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  offerCardInner: {
    padding: 14,
    gap: 6,
    minHeight: 160,
  },
  offerCardIconImage: {
    width: 44,
    height: 44,
    borderRadius: 12,
    marginBottom: 4,
  },
  offerCardIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  offerCardBrand: {
    fontSize: 10,
    fontFamily: "Ubuntu-Medium",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  offerCardTitle: {
    fontSize: 13,
    fontFamily: "Ubuntu-Bold",
    color: "#1E293B",
    lineHeight: 18,
    flex: 1,
  },
  offerDiscountBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 2,
  },
  offerDiscountText: {
    fontSize: 11,
    fontFamily: "Ubuntu-Bold",
    color: "#fff",
  },
  offerCardFooter: {
    flexDirection: "row",
    gap: 6,
    marginTop: "auto",
    paddingTop: 8,
  },
  offerFooterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  offerFooterChipText: {
    fontSize: 11,
    fontFamily: "Ubuntu-Medium",
  },

  // ── Turf Promo Card ───────────────────────────────────────────────────────────
  turfPromoCard: {
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 12,
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 5,
  },
  turfPromoGradient: {
    padding: 16,
  },
  turfPromoContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  turfPromoLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  turfPromoIconImage: {
    width: 48,
    height: 48,
    borderRadius: 12,
  },
  turfPromoIconBg: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  turfPromoText: {
    flex: 1,
  },
  turfPromoBrand: {
    fontSize: 11,
    fontFamily: "Ubuntu-Medium",
    color: "rgba(255,255,255,0.8)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  turfPromoTitle: {
    fontSize: 15,
    fontFamily: "Ubuntu-Bold",
    color: "#fff",
    lineHeight: 20,
    marginTop: 2,
  },
  turfPromoDiscountBadge: {
    backgroundColor: "rgba(255,255,255,0.22)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
  },
  turfPromoDiscount: {
    fontSize: 13,
    fontFamily: "Ubuntu-Bold",
    color: "#fff",
  },

  // ── Empty State ───────────────────────────────────────────────────────────────
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
  emptySubtitle: {
    fontSize: 14,
    fontFamily: "Ubuntu-Regular",
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 260,
  },

  // ── Platform Banners ─────────────────────────────────────────────────────────
  bannerSection: {
    marginBottom: 4,
  },
  bannerList: {
    paddingLeft: 20,
    paddingRight: 8,
  },
  bannerCard: {
    height: 96,
    borderRadius: 14,
    marginRight: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  bannerImage: {
    width: "100%",
    height: "100%",
  },
  bannerImageOverlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.42)",
  },
  bannerTextOverlay: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    padding: 12,
    gap: 3,
  },
  bannerGradient: {
    flex: 1,
    padding: 14,
    justifyContent: "center",
  },
  bannerGradientContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  bannerTitle: {
    fontSize: 15,
    fontFamily: "Ubuntu-Bold",
    color: "#fff",
  },
  bannerSubtitle: {
    fontSize: 12,
    fontFamily: "Ubuntu-Regular",
    color: "rgba(255,255,255,0.85)",
  },
  bannerCodePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.22)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
  },
  bannerCodeText: {
    fontSize: 11,
    fontFamily: "Ubuntu-Bold",
    color: "#fff",
  },

  // ── Bottom Sheet ──────────────────────────────────────────────────────────────
  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 20,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E2E8F0",
    alignSelf: "center",
    marginBottom: 20,
  },
  sheetCategoryTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 12,
  },
  sheetCategoryText: {
    fontSize: 12,
    fontFamily: "Ubuntu-Bold",
  },
  sheetBrand: {
    fontSize: 12,
    fontFamily: "Ubuntu-Medium",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  sheetTitle: {
    fontSize: 20,
    fontFamily: "Ubuntu-Bold",
    color: "#1E293B",
    lineHeight: 26,
    marginBottom: 16,
  },
  sheetDiscountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  sheetDiscount: {
    fontSize: 18,
    fontFamily: "Ubuntu-Bold",
  },
  sheetDescription: {
    fontSize: 14,
    fontFamily: "Ubuntu-Regular",
    color: "#64748B",
    lineHeight: 21,
    marginBottom: 14,
  },
  sheetValidRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 24,
  },
  sheetValidText: {
    fontSize: 13,
    fontFamily: "Ubuntu-Regular",
    color: "#9CA3AF",
  },
  sheetActions: {
    gap: 10,
  },
  sheetBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    borderRadius: 12,
  },
  sheetBtnOutline: {
    borderWidth: 1.5,
    backgroundColor: "transparent",
  },
  sheetBtnText: {
    fontSize: 15,
    fontFamily: "Ubuntu-Bold",
    color: "#fff",
  },
});
