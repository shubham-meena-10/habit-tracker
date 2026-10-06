// Calendar helpers. Pure and generic: they use the same day-outcome engine as the Progress tab.
import { addDays, dateRange, endOfMonth, startOfMonth, startOfWeek } from '../utils/date';
import { buildHistory } from './history';

export const TONE_GOOD = 80;
export const TONE_OK = 50;

/** Share of habits completed -> good | ok | bad (none when nothing was counted). */
export function dayTone(pct) {
  if (pct === null || pct === undefined) return 'none';
  if (pct >= TONE_GOOD) return 'good';
  if (pct >= TONE_OK) return 'ok';
  return 'bad';
}

/** { done, counted } -> percentage, or null when nothing was counted. */
export function dayPct(entry) {
  return entry && entry.counted ? (entry.done * 100) / entry.counted : null;
}

/** Weeks of 7 cells covering the month, padded with days from the neighbouring months (inMonth false). */
export function monthGrid(monthStart, weekStartsOn = 1) {
  const first = startOfWeek(startOfMonth(monthStart), weekStartsOn);
  const last = addDays(startOfWeek(endOfMonth(monthStart), weekStartsOn), 6);
  const month = monthStart.slice(0, 7);
  const cells = dateRange(first, last).map((date) => ({ date, inMonth: date.startsWith(month) }));
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** byDate: Map(date -> {done, counted}) -> counts of green/amber/red days and the average. */
export function monthStats(byDate) {
  const out = { good: 0, ok: 0, bad: 0, tracked: 0, avg: null };
  let sum = 0;
  byDate.forEach((e) => {
    const p = dayPct(e);
    if (p === null) return;
    out[dayTone(p)] += 1;
    out.tracked += 1;
    sum += p;
  });
  out.avg = out.tracked ? sum / out.tracked : null;
  return out;
}

/** Days from the start of the local cache up to today can be edited. Older days are view-only. */
export function canEditDay({ date, today, cacheFrom }) {
  if (date > today) return false;
  return !cacheFrom || date >= cacheFrom;
}

/**
 * One row per habit for a single day, with the day's entries attached.
 * Habits not scheduled that day (and without entries) are counted in `hidden`.
 * Archived habits only appear when they have entries, and never count toward done/counted.
 */
export function buildDayRows({ habits, anchorsByHabit, totals, entriesOnDate, date, today, todayFinal }) {
  const byHabit = new Map();
  entriesOnDate.forEach((e) => {
    if (!byHabit.has(e.habitId)) byHabit.set(e.habitId, []);
    byHabit.get(e.habitId).push(e);
  });

  const rows = [];
  let hidden = 0;
  habits.forEach((habit) => {
    const entries = (byHabit.get(habit.habitId) || [])
      .slice()
      .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    if (habit.status === 'archived' && !entries.length) return;
    const day = buildHistory(habit, anchorsByHabit.get(habit.habitId) || [], totals, {
      from: date, to: date, today, todayFinal,
    })[0];
    if (!day) return;                                    // the habit did not exist yet
    if (day.status === 'skip' && !entries.length) { hidden += 1; return; }
    rows.push({ habit, day, entries });
  });
  rows.sort((a, b) => a.habit.sortOrder - b.habit.sortOrder);

  const decided = rows.filter((r) => r.habit.status !== 'archived' && (r.day.status === 'success' || r.day.status === 'fail'));
  const done = decided.filter((r) => r.day.status === 'success').length;
  return { rows, hidden, done, counted: decided.length, pct: decided.length ? (done * 100) / decided.length : null };
}