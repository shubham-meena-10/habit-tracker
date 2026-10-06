// Generic period statistics. Pure functions: no habit names, no React.
import { dateRange, daysBetween } from '../utils/date';
import { calcDay, dayTotal, isScheduledOn } from './calculations';
import { computeTarget } from './progression';

/** One row per day from..to (inclusive) with that day's target and result. */
export function dailySeries(habit, anchors, totals, from, to) {
  return dateRange(from, to).map((date) => {
    const info = computeTarget(habit, anchors, date);
    const { total, count } = dayTotal(totals, habit.habitId, date);
    const c = calcDay(habit, info.target, total, count);
    return {
      date, total, count, target: info.target, percentage: c.percentage,
      extra: c.extra, completed: c.completed, scheduled: isScheduledOn(habit, date),
    };
  });
}

/**
 * Totals include today. Averages and % of target use finished days only
 * (today is left out until it is over, unless it is the only day available).
 */
export function summarize(series, today, startDate) {
  const days = series.filter((d) => d.date <= today && d.date >= startDate);
  const past = days.filter((d) => d.date < today);
  const basis = past.length ? past : days;
  const sum = (arr, f) => arr.reduce((s, d) => s + f(d), 0);

  const scheduled = basis.filter((d) => d.scheduled);
  const targetTotal = sum(scheduled, (d) => d.target);
  let best = null;
  days.forEach((d) => {
    if (d.total > 0 && (!best || d.total > best.total)) best = { total: d.total, date: d.date };
  });

  return {
    days: days.length,
    total: sum(days, (d) => d.total),
    avgPerDay: basis.length ? sum(basis, (d) => d.total) / basis.length : 0,
    daysLogged: days.filter((d) => d.total > 0).length,
    best,
    daysMet: scheduled.filter((d) => d.completed).length,
    scheduledDays: scheduled.length,
    pct: targetTotal > 0 ? (sum(scheduled, (d) => d.total) / targetTotal) * 100 : null,
  };
}

/**
 * Year = server aggregate for the part before the local cache (`pre`, may be null)
 * + local summary for the cached part.
 */
export function yearSummary({ pre, local, todayTotal, start, today }) {
  const total = (pre ? pre.total : 0) + local.total;
  const basisDays = Math.max(0, daysBetween(start, today));
  let best = local.best;
  if (pre && pre.bestDay !== null && pre.bestDay !== undefined && (!best || pre.bestDay > best.total)) {
    best = { total: pre.bestDay, date: pre.bestDate };
  }
  return {
    total,
    avgPerDay: basisDays > 0 ? (total - todayTotal) / basisDays : total,
    daysLogged: (pre ? pre.daysLogged : 0) + local.daysLogged,
    best,
  };
}