import React, { useRef } from "react";
import { Animated, Pressable } from "react-native";

/**
 * Drop-in replacement for TouchableOpacity that adds a spring scale animation.
 * Use for cards and interactive surfaces.
 *
 * @param {number} scaleValue  - how far to scale down on press (default 0.97)
 * @param {number} speed       - spring speed (default 22)
 */
const AnimatedPressable = ({
  children,
  onPress,
  onLongPress,
  scaleValue = 0.97,
  speed = 22,
  style,
  disabled,
  hitSlop,
}) => {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () => {
    Animated.spring(scale, {
      toValue: scaleValue,
      speed,
      bounciness: 4,
      useNativeDriver: true,
    }).start();
  };

  const pressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      speed,
      bounciness: 4,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      disabled={disabled}
      hitSlop={hitSlop}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

export default AnimatedPressable;
