import React, { useEffect } from "react";
import { View, StyleSheet, FlatList, TouchableOpacity } from "react-native";
import { Text, ActivityIndicator } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSelectedTurf } from "../../hooks/useSelectedTurf";

const MANAGER_BLUE = "#3B82F6";
const PALE_BLUE    = "#EFF6FF";
const NAVY_BLUE    = "#1E40AF";
const PAGE_BG      = "#F0F4F8";

const getLocationText = (turf) => {
  const loc = turf.location || turf.address;
  if (!loc) return null;
  if (typeof loc === "object") {
    return loc.address || [loc.city, loc.state].filter(Boolean).join(", ") || null;
  }
  return loc;
};

export default function TurfSelectionScreen({ navigation, route }) {
  const { nextScreen } = route.params || {};
  const { allTurfs, selectedTurfId, hasMultipleTurfs, isLoading, changeTurf } = useSelectedTurf();

  useEffect(() => {
    if (!isLoading && !hasMultipleTurfs && selectedTurfId) {
      if (nextScreen) {
        navigation.replace(nextScreen, { turfId: selectedTurfId });
      } else {
        navigation.goBack();
      }
    }
  }, [isLoading, hasMultipleTurfs, selectedTurfId, navigation, nextScreen]);

  const handleSelect = async (turfId) => {
    await changeTurf(turfId);
    if (nextScreen) {
      navigation.replace(nextScreen, { turfId });
    } else {
      navigation.goBack();
    }
  };

  const renderCard = ({ item: turf }) => {
    const isSelected = turf.id === selectedTurfId;
    const location   = getLocationText(turf);
    const grounds    = turf.grounds?.length || 0;

    return (
      <TouchableOpacity
        activeOpacity={0.82}
        onPress={() => handleSelect(turf.id)}
        style={[styles.card, isSelected && styles.cardSelected]}
      >
        {/* Icon */}
        <View style={[styles.cardIcon, isSelected && styles.cardIconSelected]}>
          <MaterialCommunityIcons
            name="soccer-field"
            size={26}
            color={isSelected ? "#fff" : MANAGER_BLUE}
          />
        </View>

        {/* Text */}
        <View style={styles.cardBody}>
          <Text style={[styles.cardName, isSelected && styles.cardNameSelected]} numberOfLines={1}>
            {turf.name}
          </Text>
          {location ? (
            <View style={styles.cardRow}>
              <MaterialCommunityIcons
                name="map-marker-outline"
                size={13}
                color={isSelected ? "#93C5FD" : "#9CA3AF"}
              />
              <Text
                style={[styles.cardMeta, isSelected && styles.cardMetaSelected]}
                numberOfLines={1}
              >
                {location}
              </Text>
            </View>
          ) : null}
          {grounds > 0 ? (
            <View style={styles.cardRow}>
              <MaterialCommunityIcons
                name="grid"
                size={13}
                color={isSelected ? "#93C5FD" : "#9CA3AF"}
              />
              <Text style={[styles.cardMeta, isSelected && styles.cardMetaSelected]}>
                {grounds} ground{grounds !== 1 ? "s" : ""}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Right indicator */}
        {isSelected ? (
          <View style={styles.checkBadge}>
            <MaterialCommunityIcons name="check" size={16} color="#fff" />
          </View>
        ) : (
          <MaterialCommunityIcons name="chevron-right" size={22} color="#D1D5DB" />
        )}
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={MANAGER_BLUE} />
          <Text style={styles.loadingText}>Loading turfs…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#374151" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Select Turf</Text>
          <Text style={styles.headerSub}>Choose a turf to continue</Text>
        </View>
      </View>

      {allTurfs.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIconCircle}>
            <MaterialCommunityIcons name="soccer-field" size={40} color={MANAGER_BLUE} />
          </View>
          <Text style={styles.emptyTitle}>No Turfs Assigned</Text>
          <Text style={styles.emptySub}>
            Contact your owner to get turfs assigned to your account.
          </Text>
        </View>
      ) : (
        <FlatList
          data={allTurfs}
          keyExtractor={(item) => item.id}
          renderItem={renderCard}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },

  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, paddingHorizontal: 32 },
  loadingText: { fontFamily: "Ubuntu-Regular", fontSize: 14, color: "#6B7280" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: "#F3F4F6",
    justifyContent: "center", alignItems: "center",
  },
  headerTitle: { fontFamily: "Ubuntu-Bold", fontSize: 18, color: "#111827" },
  headerSub:   { fontFamily: "Ubuntu-Regular", fontSize: 12, color: "#9CA3AF", marginTop: 1 },

  list: { padding: 16, paddingBottom: 28 },

  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardSelected: {
    backgroundColor: MANAGER_BLUE,
    borderColor: NAVY_BLUE,
  },

  cardIcon: {
    width: 52, height: 52, borderRadius: 14,
    backgroundColor: PALE_BLUE,
    justifyContent: "center", alignItems: "center",
  },
  cardIconSelected: { backgroundColor: "rgba(255,255,255,0.18)" },

  cardBody: { flex: 1, gap: 4 },
  cardName: { fontFamily: "Ubuntu-Bold", fontSize: 16, color: "#111827" },
  cardNameSelected: { color: "#fff" },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  cardMeta: { fontFamily: "Ubuntu-Regular", fontSize: 12, color: "#9CA3AF", flex: 1 },
  cardMetaSelected: { color: "#BFDBFE" },

  checkBadge: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.22)",
    justifyContent: "center", alignItems: "center",
  },

  emptyIconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: PALE_BLUE,
    justifyContent: "center", alignItems: "center",
    marginBottom: 4,
  },
  emptyTitle: { fontFamily: "Ubuntu-Bold", fontSize: 16, color: "#111827" },
  emptySub:   {
    fontFamily: "Ubuntu-Regular", fontSize: 13, color: "#9CA3AF",
    textAlign: "center", lineHeight: 20,
  },
});
