import React, { PropsWithChildren, useEffect, useRef } from 'react';
import { haptic } from './haptics';
import { Animated, Pressable, StyleProp, ViewStyle } from 'react-native';

export function FadeIn({ children, durationMs = 220, style }: PropsWithChildren<{ durationMs?: number; style?: StyleProp<ViewStyle> }>) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(6)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: durationMs, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: durationMs, useNativeDriver: true }),
    ]).start();
  }, [durationMs, opacity, translateY]);

  return <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>{children}</Animated.View>;
}

export function PressScale({ children, onPress, disabled, style }: PropsWithChildren<{ onPress?: () => void; disabled?: boolean; style?: StyleProp<ViewStyle> }>) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (toValue: number) => {
    Animated.spring(scale, { toValue, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  };

  return (
    <Pressable
      disabled={disabled}
      onPress={async () => {
        await haptic('light');
        onPress?.();
      }}
      onPressIn={() => animateTo(0.985)}
      onPressOut={() => animateTo(1)}
      style={({ pressed }) => [style, { opacity: pressed ? 0.96 : 1 }]}
    >
      <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>
    </Pressable>
  );
}
