// Schedule helpers: habits ordered by time, plus readable weekday summaries.
import { WEEKDAY_LABELS, WEEKDAY_ORDER } from '../utils/habitForm';
import { minutesOf } from './daily';

const bySortOrder = (a, b) => a.sortOrder - b.sortOrder;

/** timed (by clock time), anytime (no time set), paused. Archived habits are left out. */
export function buildSchedule(habits) {
  const active = habits.filter((h) => h.status === 'active');
  const timed = active
    .filter((h) => minutesOf(h.scheduleTime) !== null)
    .sort((a, b) => minutesOf(a.scheduleTime) - minutesOf(b.scheduleTime) || bySortOrder(a, b));
  const anytime = active.filter((h) => minutesOf(h.scheduleTime) === null).sort(bySortOrder);
  const paused = habits.filter((h) => h.status === 'paused').sort(bySortOrder);
  return { timed, anytime, paused };
}

/** [1,2,3,4,5] → "Weekdays", [0,6] → "Weekends", [3,1] → "Mon, Wed". */
export function weekdaySummary(days) {
  const set = [...new Set(days || [])].sort((a, b) => a - b);
  if (set.length === 0 || set.length === 7) return 'Every day';
  const key = set.join(',');
  if (key === '1,2,3,4,5') return 'Weekdays';
  if (key === '0,6') return 'Weekends';
  return WEEKDAY_ORDER.filter((d) => set.includes(d)).map((d) => WEEKDAY_LABELS[d]).join(', ');
}

/** 25 → "25 min", 135 → "2 h 15 min", 0 → "now". */
export function formatUntil(mins) {
  if (mins <= 0) return 'now';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}