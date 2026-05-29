import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleProp, View, ViewStyle, DimensionValue } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppColors } from './useAppColors';

export function SkeletonLine({
  width = '100%',
  height = 12,
  style,
}: {
  width?: DimensionValue;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useAppColors();
  const translateX = useRef(new Animated.Value(-1)).current;

  const base = colors.surfaceAlt;
  const highlight = colors.border;

  const gradientColors = useMemo(() => [base, highlight, base], [base, highlight]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(translateX, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [translateX]);

  return (
    <View style={[{ width, height, backgroundColor: base, borderRadius: 10, overflow: 'hidden' }, style]}>
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: '120%',
          transform: [
            {
              translateX: translateX.interpolate({
                inputRange: [-1, 1],
                outputRange: [-220, 220],
              }),
            },
          ],
        }}
      >
        <LinearGradient
          colors={gradientColors as any}
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
    <View style={{ backgroundColor: colors.surface, borderRadius: 20, padding: 16, gap: 10 }}>
      <SkeletonLine width={160} height={16} />
      <SkeletonLine width={'92%'} />
      <SkeletonLine width={'70%'} />
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
        <SkeletonLine width={90} height={34} style={{ borderRadius: 16 }} />
        <SkeletonLine width={90} height={34} style={{ borderRadius: 16 }} />
      </View>
    </View>
  );
}
