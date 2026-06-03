/* istanbul ignore file */
import React, { PropsWithChildren, useEffect, useMemo } from "react";
import { haptic } from "./haptics";
import { Animated, Pressable, StyleProp, ViewStyle, Platform } from "react-native";
import { motion } from "./theme";

const canUseNativeDriver = Platform.OS !== "web";

export function FadeIn({
  children,
  durationMs = motion.normal,
  style,
}: PropsWithChildren<{ durationMs?: number; style?: StyleProp<ViewStyle> }>) {
  const opacity = useMemo(() => new Animated.Value(0), []);
  const translateY = useMemo(() => new Animated.Value(6), []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: durationMs,
        useNativeDriver: canUseNativeDriver,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: durationMs,
        useNativeDriver: canUseNativeDriver,
      }),
    ]).start();
  }, [durationMs, opacity, translateY]);

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
}

export function PressScale({
  children,
  onPress,
  disabled,
  style,
}: PropsWithChildren<{
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}>) {
  const scale = useMemo(() => new Animated.Value(1), []);

  const animateTo = (toValue: number) => {
    Animated.spring(scale, {
      toValue,
      useNativeDriver: Platform.OS !== "web",
      speed: motion.springSpeed,
      bounciness: motion.springBounciness,
    }).start();
  };

  return (
    <Pressable
      disabled={disabled}
      onPress={async () => {
        await haptic("light");
        onPress?.();
      }}
      onPressIn={() => animateTo(motion.pressInScale)}
      onPressOut={() => animateTo(1)}
      style={({ pressed }) => [style, { opacity: pressed ? 0.96 : 1 }]}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
