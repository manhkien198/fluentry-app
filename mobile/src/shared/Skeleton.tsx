import React, { useEffect, useMemo } from "react";
import {
  Animated,
  StyleProp,
  View,
  ViewStyle,
  DimensionValue,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { motion, radius, spacing } from "./theme";
import { useAppColors } from "./useAppColors";

const canUseNativeDriver = Platform.OS !== "web";

export function SkeletonLine({
  width = "100%",
  height = 12,
  style,
}: {
  width?: DimensionValue;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useAppColors();
  const translateX = useMemo(() => new Animated.Value(-1), []);

  const base = colors.surfaceAlt;
  const highlight = colors.border;

  const gradientColors = useMemo(
    () => [base, highlight, base] as const,
    [base, highlight],
  );

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(translateX, {
        toValue: 1,
        duration: motion.skeleton,
        useNativeDriver: canUseNativeDriver,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [translateX]);

  const animatedTranslateX = useMemo(
    () =>
      translateX.interpolate({
        inputRange: [-1, 1],
        outputRange: [-220, 220],
      }),
    [translateX],
  );

  return (
    <View
      style={[
        {
          width,
          height,
          backgroundColor: base,
          borderRadius: radius.sm,
          overflow: "hidden",
        },
        style,
      ]}
    >
      <Animated.View
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          width: "120%",
          transform: [
            {
              translateX: animatedTranslateX,
            },
          ],
        }}
      >
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1, opacity: 0.6 }}
        />
      </Animated.View>
    </View>
  );
}

export function SkeletonCard() {
  const colors = useAppColors();
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.xl,
        padding: spacing.lg,
        gap: spacing.sm,
      }}
    >
      <SkeletonLine width={160} height={16} />
      <SkeletonLine width={"92%"} />
      <SkeletonLine width={"70%"} />
      <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
        <SkeletonLine width={90} height={34} style={{ borderRadius: 16 }} />
        <SkeletonLine width={90} height={34} style={{ borderRadius: 16 }} />
      </View>
    </View>
  );
}
