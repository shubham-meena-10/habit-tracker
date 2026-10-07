// Which reminders are due right now. Pure and generic: reads the dashboard items from buildDaily.
import { DEFAULT_CHECKIN_TIME } from './checkin';
import { minutesOf } from './daily';
import { TRACKING_TYPES as T } from '../constants/trackingTypes';

export const REMINDER_WINDOW_MIN = 10;   // a reminder is still delivered up to 10 minutes late

/**
 * items: dashboard items (active habits scheduled today).
 * Never reminds for: done habits, limits / lower-is-better habits, abstinence habits after a slip.
 */
export function dueReminders({ items, minutes, today, checkinTime, closed }) {
  const inWindow = (hhmm) => {
    const m = minutesOf(hhmm);
    return m !== null && m <= minutes && minutes - m < REMINDER_WINDOW_MIN;
  };

  const out = [];
  items.forEach((it) => {
    const h = it.habit;
    if (!inWindow(h.reminderTime)) return;
    if (it.done || it.bucket === 'limits' || it.calc.state === 'slip') return;
    out.push({
      key: `${today}|${h.habitId}`,
      title: `${h.icon} ${h.name}`,
      body: it.valueText,
      url: h.trackingType === T.TIMER ? `#/timer/${h.habitId}` : '#/',
    });
  });

  if (!closed && inWindow(checkinTime || DEFAULT_CHECKIN_TIME)) {
    out.push({ key: `${today}|checkin`, title: '🌙 Day check-in', body: 'A few taps and the day is done.', url: '#/checkin' });
  }
  return out;
}