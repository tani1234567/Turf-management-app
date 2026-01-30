import React, { memo } from "react";
import { View, StyleSheet, TouchableOpacity, Linking, Platform, Alert } from "react-native";
import { Text, Surface } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS } from "../../constants/theme";

/**
 * Open location in maps app
 */
const openInMaps = async (location) => {
  const { coordinates, googleMapsLink, address, turfName } = location;

  // Try Google Maps link first if available
  if (googleMapsLink) {
    try {
      const supported = await Linking.canOpenURL(googleMapsLink);
      if (supported) {
        await Linking.openURL(googleMapsLink);
        return;
      }
    } catch (error) {
      console.log("Error opening Google Maps link:", error);
    }
  }

  // Fall back to coordinates if available
  if (coordinates?.latitude && coordinates?.longitude) {
    const { latitude, longitude } = coordinates;
    const label = turfName || "Turf Location";

    let url;
    if (Platform.OS === "ios") {
      // Apple Maps
      url = `maps:0,0?q=${label}@${latitude},${longitude}`;
    } else {
      // Google Maps on Android
      url = `geo:${latitude},${longitude}?q=${latitude},${longitude}(${encodeURIComponent(label)})`;
    }

    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
        return;
      }
    } catch (error) {
      console.log("Error opening maps:", error);
    }

    // Last resort: open in browser
    const browserUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    try {
      await Linking.openURL(browserUrl);
      return;
    } catch (error) {
      console.log("Error opening browser:", error);
    }
  }

  // If nothing works, show alert with address
  Alert.alert(
    "Location",
    address || "Location details not available",
    [{ text: "OK" }]
  );
};

/**
 * LocationCard component for displaying shared locations in chat
 * @param {object} props
 * @param {object} props.message - Message data with location
 * @param {boolean} props.isOwn - Whether this message is from the current user
 */
const LocationCard = ({ message, isOwn }) => {
  const location = message.location;

  const handlePress = () => {
    openInMaps(location);
  };

  return (
    <View style={[styles.container, isOwn ? styles.ownContainer : styles.otherContainer]}>
      <TouchableOpacity onPress={handlePress} activeOpacity={0.8}>
        <Surface style={styles.card} elevation={2}>
          {/* Map Preview Placeholder */}
          <View style={styles.mapPreview}>
            <MaterialCommunityIcons
              name="map-marker-radius"
              size={48}
              color={COLORS.secondary}
            />
            <View style={styles.mapOverlay}>
              <MaterialCommunityIcons
                name="navigation"
                size={20}
                color="#fff"
              />
              <Text style={styles.mapOverlayText}>Open in Maps</Text>
            </View>
          </View>

          {/* Location Details */}
          <View style={styles.detailsSection}>
            <View style={styles.headerRow}>
              <MaterialCommunityIcons
                name="stadium"
                size={18}
                color={COLORS.primary}
              />
              <Text variant="titleSmall" style={styles.turfName}>
                {location?.turfName || "Turf Location"}
              </Text>
            </View>

            {location?.address && (
              <View style={styles.addressRow}>
                <MaterialCommunityIcons
                  name="map-marker-outline"
                  size={16}
                  color={COLORS.textSecondary}
                />
                <Text variant="bodySmall" style={styles.addressText} numberOfLines={2}>
                  {location.address}
                  {location.city ? `, ${location.city}` : ""}
                </Text>
              </View>
            )}

            {/* Directions hint */}
            <View style={styles.directionsHint}>
              <MaterialCommunityIcons
                name="directions"
                size={14}
                color={COLORS.secondary}
              />
              <Text variant="labelSmall" style={styles.directionsText}>
                Tap to get directions
              </Text>
            </View>
          </View>

          {/* Timestamp */}
          <Text variant="labelSmall" style={styles.timestamp}>
            {message.timestamp instanceof Date
              ? message.timestamp.toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                })
              : ""}
          </Text>
        </Surface>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    maxWidth: "85%",
  },
  ownContainer: {
    alignSelf: "flex-end",
  },
  otherContainer: {
    alignSelf: "flex-start",
  },
  card: {
    borderRadius: 12,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  mapPreview: {
    height: 100,
    backgroundColor: "#e3f2fd",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  mapOverlay: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: COLORS.secondary,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    gap: 4,
  },
  mapOverlayText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
  detailsSection: {
    padding: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  turfName: {
    fontWeight: "600",
    color: COLORS.text,
    flex: 1,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 4,
    marginBottom: 8,
  },
  addressText: {
    color: COLORS.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
  directionsHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  directionsText: {
    color: COLORS.secondary,
    fontWeight: "500",
  },
  timestamp: {
    color: COLORS.textSecondary,
    textAlign: "right",
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
});

export default memo(LocationCard);
