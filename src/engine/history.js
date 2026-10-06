// Per-habit day history, streaks and summaries. Pure and generic:
// behaviour depends on tracking type, goal direction and configuration only.
import { TRACKING_TYPES as T } from '../constants/trackingTypes';
import { dateRange, daysBetween } from '../utils/date';
import { calcDay, dayTotal, isCheckHabit, isScheduledOn, lowerIsBetter } from './calculations';
import { computeTarget } from './progression';

/**
 * One row per day from..to (clamped to the habit's start date and to today).
 * status: success | fail | pending | skip
 *  - skip: not a scheduled weekday, or inside a pause
 *  - pending: today, not decided yet (and not final)
 *  - limit habits: within the limit = success once the day is final, over the limit = fail at once
 *  - abstinence: delta 1 = success, delta 0 = fail + slip, no check-in = fail once final (not a slip)
 */
export function buildHistory(habit, anchors, totals, { from, to, today, todayFinal }) {
  const start = from < habit.startDate ? habit.startDate : from;
  const end = to > today ? today : to;
  if (start > end) return [];
  const limitLike = !isCheckHabit(habit) && lowerIsBetter(habit);

  return dateRange(start, end).map((date) => {
    const info = computeTarget(habit, anchors, date);
    const { total, count } = dayTotal(totals, habit.habitId, date);
    const c = calcDay(habit, info.target, total, count);
    const scheduled = isScheduledOn(habit, date) && info.anchorReason !== 'pause';
    const final = date < today || todayFinal;

    let status = 'skip';
    let slip = false;
    if (scheduled) {
      if (habit.trackingType === T.ABSTINENCE) {
        slip = c.state === 'slip';
        status = c.state === 'success' ? 'success' : slip ? 'fail' : final ? 'fail' : 'pending';
      } else if (limitLike) {
        status = !c.completed ? 'fail' : final ? 'success' : 'pending';
      } else {
        status = c.completed ? 'success' : final ? 'fail' : 'pending';
      }
    }
    return {
      date, status, slip, scheduled, target: info.target, actual: c.actual, count,
      percentage: c.percentage, extra: c.extra, state: c.state,
    };
  });
}

/** Success days in a row. skip and pending days neither extend nor break a run; fail days reset it. */
export function streaksOf(days) {
  let run = 0;
  let longest = 0;
  days.forEach((d) => {
    if (d.status === 'success') {
      run += 1;
      if (run > longest) longest = run;
    } else if (d.status === 'fail') {
      run = 0;
    }
  });
  return { current: run, longest };
}

/**
 * opts.settledOnly: leave today out of counted/completed/rate unless opts.todayFinal
 * (streaks and totals still use every day).
 */
export function summarizeHistory(habit, days, today, opts = {}) {
  const include = (d) => !opts.settledOnly || d.date !== today || opts.todayFinal;
  const decided = days.filter((d) => (d.status === 'success' || d.status === 'fail') && include(d));
  const completed = decided.filter((d) => d.status === 'success').length;
  const { current, longest } = streaksOf(days);

  const finished = days.filter((d) => d.scheduled && d.date < today);
  let avgPerDay = 0;
  if (finished.length) avgPerDay = finished.reduce((s, d) => s + d.actual, 0) / finished.length;
  else {
    const t = days.find((d) => d.date === today && d.scheduled);
    avgPerDay = t ? t.actual : 0;
  }

  const logged = days.filter((d) => d.count > 0);
  let high = null;
  let low = null;
  logged.forEach((d) => {
    if (!high || d.actual > high.actual) high = { actual: d.actual, date: d.date };
    if (!low || d.actual < low.actual) low = { actual: d.actual, date: d.date };
  });

  const slips = days.filter((d) => d.slip);
  const fails = days.filter((d) => d.status === 'fail');
  const lastSlip = slips.length ? slips[slips.length - 1].date : null;

  return {
    counted: decided.length,
    completed,
    missed: decided.length - completed,
    rate: decided.length ? (completed / decided.length) * 100 : null,
    current,
    longest,
    total: days.reduce((s, d) => s + d.actual, 0),
    avgPerDay,
    loggedDays: logged.length,
    high,
    low,
    slips: slips.length,
    lastSlip,
    daysSinceSlip: lastSlip ? daysBetween(lastSlip, today) : null,
    lastFail: fails.length ? fails[fails.length - 1].date : null,
  };
}

/**
 * Current vs previous summary. Check-type habits compare completion rate (points),
 * everything else compares the average per finished day (%).
 * `good` respects goal direction (null = no meaningful change).
 */
export function compareSummaries(habit, cur, prev) {
  if (!cur || !prev || cur.counted < 2 || prev.counted < 2) return null;
  if (isCheckHabit(habit)) {
    const diff = cur.rate - prev.rate;
    return { kind: 'rate', diff, pct: diff, good: Math.abs(diff) < 1 ? null : diff > 0, cur: cur.rate, prev: prev.rate };
  }
  if (!(prev.avgPerDay > 0)) return null;
  const pct = ((cur.avgPerDay - prev.avgPerDay) / prev.avgPerDay) * 100;
  const good = Math.abs(pct) < 1 ? null : (lowerIsBetter(habit) ? pct < 0 : pct > 0);
  return { kind: 'avg', diff: cur.avgPerDay - prev.avgPerDay, pct, good, cur: cur.avgPerDay, prev: prev.avgPerDay };
}

export function changeLabel(c) {
  if (!c) return '—';
  const v = c.kind === 'rate' ? c.diff : c.pct;
  if (Math.abs(v) < 0.5) return '=';
  return `${v > 0 ? '↑' : '↓'} ${Math.abs(Math.round(v))}${c.kind === 'rate' ? ' pts' : '%'}`;
}

/**
 * Chart points. Up to 120 days: one per day. Longer: buckets of whole weeks (at most ~90 bars)
 * holding the average per scheduled day.
 */
export function bucketDays(days, maxBars = 90) {
  if (days.length <= 120) {
    return days.map((d) => ({ from: d.date, to: d.date, value: d.actual, target: d.scheduled ? d.target : 0 }));
  }
  const size = 7 * Math.ceil(days.length / 7 / maxBars);
  const out = [];
  for (let i = 0; i < days.length; i += size) {
    const chunk = days.slice(i, i + size);
    const sched = chunk.filter((d) => d.scheduled);
    const base = sched.length ? sched : chunk;
    const avg = (arr, f) => arr.reduce((s, d) => s + f(d), 0) / arr.length;
    out.push({
      from: chunk[0].date,
      to: chunk[chunk.length - 1].date,
      value: avg(base, (d) => d.actual),
      target: sched.length ? avg(sched, (d) => d.target) : 0,
    });
  }
  return out;
}