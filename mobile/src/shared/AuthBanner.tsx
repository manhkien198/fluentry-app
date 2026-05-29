import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useAppStore } from './store';
import { useAppColors } from './useAppColors';

export function AuthBanner() {
  const colors = useAppColors();
  const authStatus = useAppStore((s) => s.authStatus);
  const authMessage = useAppStore((s) => s.authMessage);

  if (!authMessage || authStatus === 'authenticated' || authStatus === 'idle') return null;

  const styles = StyleSheet.create({
    wrap: {
      position: 'absolute',
      top: 48,
      left: 16,
      right: 16,
      zIndex: 999,
      backgroundColor: authStatus === 'refreshing' ? colors.warning : colors.danger,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    text: { color: '#fff', fontWeight: '700', textAlign: 'center' },
  });

  return (
    <View style={styles.wrap}>
      <Text style={styles.text}>{authMessage}</Text>
    </View>
  );
}
