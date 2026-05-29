import { Platform } from 'react-native';
import { useAppStore } from './store';

export type HapticKind = 'light' | 'medium' | 'success' | 'error';

export async function haptic(kind: HapticKind = 'light') {
  try {
    const { hapticsEnabled } = useAppStore.getState();
    if (!hapticsEnabled) return;
  } catch {
    // ignore store issues
  }
  try {
    // Avoid hard dependency during typecheck/build steps.
    // If expo-haptics is installed, this will work at runtime.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Haptics = require('expo-haptics') as any;

    if (!Haptics) return;

    const isAndroid = Platform.OS === 'android';

    switch (kind) {
      case 'success':
        if (isAndroid) {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          return;
        }
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return;
      case 'error':
        if (isAndroid) {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          return;
        }
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      case 'medium':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        return;
      default:
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  } catch {
    // no-op
  }
}
