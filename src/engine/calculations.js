// Generic per-day calculation engine. Behaviour depends only on trackingType,
// goalDirection and configuration, never on habit names.
import { TRACKING_TYPES as T, GOAL_DIRECTIONS as D } from '../constants/trackingTypes';
import { weekdayIndex } from '../utils/date';
import { computeTarget } from './progression';

const r1 = (n) => Math.round(n * 10) / 10;
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

export const isCheckHabit = (h) => h.trackingType === T.BOOLEAN || h.trackingType === T.ABSTINENCE;

/** Lower is better: limits, abstinence, and any DECREASE/AVOID goal. */
export const lowerIsBetter = (h) =>
  h.trackingType === T.LIMIT || h.trackingType === T.ABSTINENCE ||
  h.goalDirection === D.DECREASE || h.goalDirection === D.AVOID;

export function isScheduledOn(habit, date) {
  return date >= habit.startDate && (habit.weekdays || ALL_DAYS).includes(weekdayIndex(date));
}

/**
 * @param target      target for that day, in base units
 * @param actual      sum of entry deltas for that day, in base units
 * @param entryCount  number of (non-deleted) entries that day. Needed to tell
 *                    "no check-in yet" apart from an explicit slip (delta 0).
 * @returns {{target, actual, percentage, extra, remaining, better, over, completed, state}}
 *   state: none | partial | done | exceeded      (higher is better, maintain)
 *          within | over                         (lower is better)
 *          pending | success | slip              (abstinence)
 *   Note: for limits, `completed` only means "at or under the cap right now".
 *   Phase 6 decides when an untouched limit habit counts as a success for the day.
 */
export function calcDay(habit, target, actual, entryCount) {
  const a = Number(actual) || 0;
  const t = Number(target) || 0;
  const count = entryCount === undefined ? (a !== 0 ? 1 : 0) : entryCount;
  const out = { target: t, actual: a, percentage: 0, extra: 0, remaining: 0, better: 0, over: 0, completed: false, state: 'none' };

  if (habit.trackingType === T.BOOLEAN) {
    const done = a >= 1;
    return { ...out, target: 1, actual: done ? 1 : 0, percentage: done ? 100 : 0, remaining: done ? 0 : 1, completed: done, state: done ? 'done' : 'none' };
  }

  if (habit.trackingType === T.ABSTINENCE) {
    if (count === 0) return { ...out, target: 0, actual: 0, remaining: 1, state: 'pending' };
    const clean = a >= 1;
    return { ...out, target: 0, actual: clean ? 1 : 0, percentage: clean ? 100 : 0, completed: clean, state: clean ? 'success' : 'slip' };
  }

  if (lowerIsBetter(habit)) {
    const within = a <= t;
    return {
      ...out,
      percentage: within ? 100 : r1((t / a) * 100),   // a > t >= 0, so a > 0
      better: within ? t - a : 0,
      over: within ? 0 : a - t,
      remaining: Math.max(0, t - a),
      completed: within,
      state: within ? 'within' : 'over',
    };
  }

  if (habit.goalDirection === D.MAINTAIN) {
    const diff = Math.abs(a - t);
    const ok = diff <= t * 0.1;
    return {
      ...out,
      percentage: t > 0 ? Math.max(0, r1(100 - (diff / t) * 100)) : (a === 0 ? 100 : 0),
      extra: Math.max(0, a - t),
      remaining: Math.max(0, t - a),
      completed: ok,
      state: a <= 0 ? 'none' : ok ? 'done' : a < t ? 'partial' : 'over',
    };
  }

  // Higher is better. Percentage is NOT capped at 100 (water 3.8 L / 3 L = 126.7%).
  const needed = habit.minTarget !== null && habit.minTarget !== undefined && habit.minTarget <= t ? habit.minTarget : t;
  const completed = a >= needed && (a > 0 || t === 0);
  return {
    ...out,
    percentage: t > 0 ? r1((a / t) * 100) : (a > 0 ? 100 : 0),
    extra: Math.max(0, a - t),
    remaining: Math.max(0, t - a),
    completed,
    state: a <= 0 ? 'none' : !completed ? 'partial' : a > t ? 'exceeded' : 'done',
  };
}

/** Today vs a previous value: direction plus whether the change is good (null = neutral). */
export function compareValues(habit, current, previous) {
  if (previous === null || previous === undefined) return null;
  const diff = current - previous;
  const direction = diff > 0 ? 'up' : diff < 0 ? 'down' : 'same';
  let good = null;
  if (diff !== 0) {
    if (habit.goalDirection === D.MAINTAIN && habit.trackingType !== T.LIMIT) good = null;
    else good = lowerIsBetter(habit) ? diff < 0 : diff > 0;
  }
  return { diff, direction, good };
}

/** entries[] -> Map(habitId -> Map(date -> {total, count})) */
export function buildDayTotals(entries) {
  const out = new Map();
  for (const e of entries) {
    if (e.deleted) continue;
    let byDate = out.get(e.habitId);
    if (!byDate) { byDate = new Map(); out.set(e.habitId, byDate); }
    const cur = byDate.get(e.date) || { total: 0, count: 0 };
    cur.total += e.delta;
    cur.count += 1;
    byDate.set(e.date, cur);
  }
  return out;
}

export function dayTotal(totals, habitId, date) {
  const byDate = totals.get(habitId);
  return (byDate && byDate.get(date)) || { total: 0, count: 0 };
}

/** One call for the UI: target (with progression) + actual -> full calculation. */
export function evaluateDay(habit, anchors, totals, date) {
  const progression = computeTarget(habit, anchors, date);
  const { total, count } = dayTotal(totals, habit.habitId, date);
  return { ...calcDay(habit, progression.target, total, count), progression };
}