import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

let enabled = true;
const off = () => !enabled || Platform.OS === 'web';
const quiet = () => {};

export const setHapticsEnabled = (value: boolean) => {
  enabled = value;
};

export const haptic = {
  /** Light tick for ordinary taps and selections. */
  tap: () => {
    if (!off()) Haptics.selectionAsync().catch(quiet);
  },
  /** Firmer press for primary buttons and path nodes. */
  press: () => {
    if (!off()) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(quiet);
  },
  soft: () => {
    if (!off()) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(quiet);
  },
  success: () => {
    if (!off()) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(quiet);
  },
  error: () => {
    if (!off()) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(quiet);
  },
  warn: () => {
    if (!off()) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(quiet);
  },
};
