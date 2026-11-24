import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/*
 * The daily reminder: one local notification a day at the hour the learner picks, sent by the
 * phone itself (no server, no account). Its text is rewritten every time the app opens, so it
 * names the lesson that is actually next and the current streak.
 */

const ID = 'daily-reminder';
const CHANNEL = 'daily';

export const REMINDERS_SUPPORTED = true;

let handlerSet = false;
function setup() {
  if (handlerSet) return;
  handlerSet = true;
  // a reminder that arrives while the app is open still shows, quietly
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
}

/** Asks for permission if it has not been given yet. Resolves to whether reminders can be shown. */
export async function enableReminders(): Promise<boolean> {
  try {
    setup();
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const asked = await Notifications.requestPermissionsAsync();
    return asked.granted;
  } catch {
    return false;
  }
}

export type ReminderText = { title: string; body: string };

/** Replaces the daily reminder with one at hour:minute carrying this text. */
export async function scheduleDaily(hour: number, minute: number, text: ReminderText) {
  try {
    setup();
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) return false;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL, {
        name: 'التذكير اليومي',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    await Notifications.cancelScheduledNotificationAsync(ID).catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier: ID,
      content: { title: text.title, body: text.body, sound: true },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: CHANNEL },
    });
    return true;
  } catch {
    return false;
  }
}

export async function cancelDaily() {
  try {
    await Notifications.cancelScheduledNotificationAsync(ID);
  } catch {
    // nothing was scheduled
  }
}
