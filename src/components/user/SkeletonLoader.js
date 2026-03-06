import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

/**
 * A single shimmer placeholder block.
 * @param {number} height  - block height
 * @param {number} width   - block width (defaults to 100%)
 * @param {number} radius  - border radius (default 8)
 * @param {object} style   - extra style overrides
 */
export const ShimmerBlock = ({ height = 20, width, radius = 8, style }) => {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1100,
        useNativeDriver: true,
      })
    ).start();
  }, [shimmer]);

  const translateX = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-300, 300],
  });

  return (
    <View
      style={[
        {
          height,
          width: width || "100%",
          borderRadius: radius,
          backgroundColor: "#e8e8e8",
          overflow: "hidden",
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { transform: [{ translateX }] },
        ]}
      >
        <LinearGradient
          colors={["transparent", "rgba(255,255,255,0.55)", "transparent"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
};

/**
 * A skeleton card mimicking the BookingCard layout.
 */
export const BookingCardSkeleton = () => (
  <View style={skeletonStyles.card}>
    <View style={skeletonStyles.headerRow}>
      <ShimmerBlock height={16} width="55%" radius={6} />
      <ShimmerBlock height={22} width="28%" radius={10} />
    </View>
    <View style={skeletonStyles.divider} />
    <View style={skeletonStyles.body}>
      <ShimmerBlock height={13} width="40%" radius={5} style={{ marginBottom: 8 }} />
      <ShimmerBlock height={13} width="50%" radius={5} style={{ marginBottom: 8 }} />
      <ShimmerBlock height={13} width="30%" radius={5} />
    </View>
  </View>
);

/**
 * Full-screen skeleton list of booking cards.
 */
const SkeletonBookingList = ({ count = 4 }) => (
  <View style={{ paddingHorizontal: 16, paddingTop: 4 }}>
    {Array.from({ length: count }).map((_, i) => (
      <BookingCardSkeleton key={i} />
    ))}
  </View>
);

const skeletonStyles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 12,
    overflow: "hidden",
    // shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
    paddingBottom: 10,
  },
  divider: {
    height: 1,
    backgroundColor: "#f0f0f0",
    marginHorizontal: 0,
  },
  body: {
    padding: 14,
    paddingTop: 12,
    paddingBottom: 14,
  },
});

export default SkeletonBookingList;
