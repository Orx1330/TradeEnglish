/* Browser preview: there is no daily local notification on the web, so reminders are switched off. */

export const REMINDERS_SUPPORTED = false;

export type ReminderText = { title: string; body: string };

export async function enableReminders(): Promise<boolean> {
  return false;
}

export async function scheduleDaily(_hour: number, _minute: number, _text: ReminderText) {
  return false;
}

export async function cancelDaily() {}
