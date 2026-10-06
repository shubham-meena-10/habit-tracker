// Check-in helpers. Pure and generic: they work on the day rows from buildDayRows (engine/calendar.js).
import { TRACKING_TYPES as T } from '../constants/trackingTypes';
import { isCheckHabit, lowerIsBetter } from './calculations';
import { minutesOf } from './daily';

export const DEFAULT_CHECKIN_TIME = '21:00';

export const validTime = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s || ''));
/** The day-close time must be 12:00 or later (a later cut-off past midnight is not supported). */
export const validCloseTime = (s) => validTime(s) && s >= '12:00';

/**
 * done: counts as completed (a limit still within its cap counts, because that is how the day ends)
 * open: not done yet, and can still be fixed
 * bad:  a broken limit or a slip
 * off:  not scheduled that day
 */
export function checkinState(habit, day) {
  if (day.status === 'skip') return 'off';
  if (day.status === 'success') return 'done';
  const limitLike = !isCheckHabit(habit) && lowerIsBetter(habit);
  if (limitLike && day.status === 'pending') return 'done';
  if (day.status === 'fail' && (limitLike || day.slip)) return 'bad';
  return 'open';
}

/** rows come from buildDayRows. Archived and not-scheduled rows are left out. */
export function summarizeCheckin(rows) {
  const items = rows
    .filter((r) => r.habit.status !== 'archived' && r.day.status !== 'skip')
    .map((row) => ({ row, state: checkinState(row.habit, row.day) }));
  const done = items.filter((i) => i.state === 'done').length;
  return {
    items,
    total: items.length,
    done,
    open: items.filter((i) => i.state === 'open').map((i) => i.row),
    bad: items.filter((i) => i.state === 'bad').map((i) => i.row),
    pct: items.length ? Math.round((done * 100) / items.length) : null,
  };
}

/** Quit habits with no check-in yet (and not already a slip). */
export function pendingQuitRows(rows) {
  return rows.filter(
    (r) => r.habit.status !== 'archived' && r.habit.trackingType === T.ABSTINENCE &&
      r.day.status !== 'skip' && r.entries.length === 0 && r.day.status !== 'success'
  );
}

/** Evening prompt: after the check-in time, while the day is still open. */
export function isCheckinDue({ minutes, checkinTime, closed }) {
  if (closed) return false;
  const at = minutesOf(checkinTime || DEFAULT_CHECKIN_TIME);
  return at !== null && minutes >= at;
}