// Week / month / year reports across all habits, plus insights built from real numbers.
import { isCheckHabit, lowerIsBetter } from './calculations';
import { buildHistory, compareSummaries, summarizeHistory } from './history';
import { isTimeUnit } from '../utils/format';

/**
 * Completion figures leave today out until the day is final (settledOnly);
 * streaks and totals still include it.
 */
export function periodReport({ habits, anchorsByHabit, totals, from, to, today, todayFinal, prev }) {
  const rows = [];
  const byDate = new Map();
  let completed = 0;
  let counted = 0;
  let pCompleted = 0;
  let pCounted = 0;

  habits.forEach((habit) => {
    const anchors = anchorsByHabit.get(habit.habitId) || [];
    const days = buildHistory(habit, anchors, totals, { from, to, today, todayFinal });
    const sum = summarizeHistory(habit, days, today, { settledOnly: true, todayFinal });
    let prevSum = null;
    if (prev) {
      const pd = buildHistory(habit, anchors, totals, { from: prev.from, to: prev.to, today, todayFinal });
      prevSum = summarizeHistory(habit, pd, today, { settledOnly: true, todayFinal });
      pCompleted += prevSum.completed;
      pCounted += prevSum.counted;
    }
    completed += sum.completed;
    counted += sum.counted;

    days.forEach((d) => {
      if (d.status !== 'success' && d.status !== 'fail') return;
      if (d.date === today && !todayFinal) return;
      const e = byDate.get(d.date) || { done: 0, counted: 0 };
      e.counted += 1;
      if (d.status === 'success') e.done += 1;
      byDate.set(d.date, e);
    });

    rows.push({ habit, days, sum, prevSum, change: prev ? compareSummaries(habit, sum, prevSum) : null });
  });

  const active = rows.filter((r) => r.sum.counted > 0);
  const byRate = [...active].sort((a, b) => b.sum.rate - a.sum.rate || b.sum.counted - a.sum.counted);
  const best = byRate[0] || null;
  const worst = byRate.length > 1 ? byRate[byRate.length - 1] : null;
  const needs = worst && worst !== best && worst.sum.rate < 100 ? worst : null;

  const changes = rows.filter((r) => r.change && Math.abs(r.change.pct) >= 5);
  const rank = (a, b) => Math.abs(b.change.pct) - Math.abs(a.change.pct);
  const improved = changes.filter((r) => r.change.good === true).sort(rank).slice(0, 3);
  const declined = changes.filter((r) => r.change.good === false).sort(rank).slice(0, 3);

  const longestRow = rows.reduce((m, r) => (!m || r.sum.longest > m.sum.longest ? r : m), null);

  return {
    rows,
    active,
    byDate,
    overall: { completed, counted, pct: counted ? (completed / counted) * 100 : null },
    prevOverall: prev ? { completed: pCompleted, counted: pCounted, pct: pCounted ? (pCompleted / pCounted) * 100 : null } : null,
    best,
    needs,
    improved,
    declined,
    longest: longestRow && longestRow.sum.longest > 0 ? { habit: longestRow.habit, days: longestRow.sum.longest } : null,
  };
}

/** Total time per category for "more is better" time habits (e.g. all exercise minutes). */
export function categoryTimeTotals(rows, categories) {
  const catMap = new Map(categories.map((c) => [c.categoryId, c]));
  const out = new Map();
  rows.forEach((r) => {
    const h = r.habit;
    if (isCheckHabit(h) || lowerIsBetter(h) || !isTimeUnit(h.unit) || r.sum.total <= 0) return;
    const cat = catMap.get(h.categoryId) || { categoryId: h.categoryId, name: 'Other', icon: '📌', sortOrder: 999 };
    const e = out.get(cat.categoryId) || { category: cat, total: 0 };
    e.total += r.sum.total;
    out.set(cat.categoryId, e);
  });
  return [...out.values()].sort((a, b) => a.category.sortOrder - b.category.sortOrder);
}

/** year report = period report for the whole year + a month-by-month breakdown. */
export function yearReport({ habits, anchorsByHabit, totals, year, today, todayFinal }) {
  const base = periodReport({
    habits, anchorsByHabit, totals, from: `${year}-01-01`, to: `${year}-12-31`, today, todayFinal, prev: null,
  });
  const lastMonth = year === Number(today.slice(0, 4)) ? Number(today.slice(5, 7)) : 12;
  const months = [];
  for (let m = 1; m <= lastMonth; m++) months.push(m);
  const prefix = (m) => `${year}-${String(m).padStart(2, '0')}`;
  const monthly = months.map((m) => ({ month: m, done: 0, counted: 0, rate: null }));

  base.rows.forEach((r) => {
    r.months = months.map((m) => {
      const ds = r.days.filter((d) => d.date.startsWith(prefix(m)));
      const dec = ds.filter((d) => (d.status === 'success' || d.status === 'fail') && (d.date !== today || todayFinal));
      const done = dec.filter((d) => d.status === 'success').length;
      return {
        month: m, counted: dec.length, done,
        rate: dec.length ? (done / dec.length) * 100 : null,
        total: ds.reduce((s, d) => s + d.actual, 0),
      };
    });
    r.months.forEach((x, i) => { monthly[i].done += x.done; monthly[i].counted += x.counted; });
  });
  monthly.forEach((x) => { x.rate = x.counted ? (x.done / x.counted) * 100 : null; });
  return { ...base, months, monthly, year };
}

/** Up to five plain sentences from the report. `fmt(habit, base)` formats an amount. */
export function buildInsights(report, { label, fmt }) {
  const out = [];

  report.rows
    .filter((r) => r.change && r.change.kind === 'avg' && r.change.good === true && Math.abs(r.change.pct) >= 10)
    .sort((a, b) => Math.abs(b.change.pct) - Math.abs(a.change.pct))
    .slice(0, 3)
    .forEach((r) => {
      const c = r.change;
      if (lowerIsBetter(r.habit)) {
        out.push(`You reduced ${r.habit.name} from ${fmt(r.habit, c.prev)} to ${fmt(r.habit, c.cur)} per day.`);
      } else {
        out.push(`You improved ${r.habit.name} by ${Math.round(c.pct)}% ${label}: ${fmt(r.habit, c.prev)} → ${fmt(r.habit, c.cur)} per day.`);
      }
    });

  const top = report.best;
  if (top && top.sum.counted >= 3 && top.sum.rate >= 50) {
    out.push(`You completed ${top.habit.name} ${top.sum.completed}/${top.sum.counted} days ${label}.`);
  }
  if (report.longest && report.longest.days >= 3) {
    out.push(`Your longest streak ${label} is ${report.longest.days} days (${report.longest.habit.name}).`);
  }
  report.rows
    .filter((r) => r.habit.trackingType === 'ABSTINENCE' && r.sum.completed >= 3 && r.sum.slips === 0)
    .slice(0, 2)
    .forEach((r) => out.push(`No slips on ${r.habit.name} ${label}.`));

  return out.slice(0, 5);
}