import { buildDayTotals } from './calculations';
import { bucketDays, buildHistory, compareSummaries, summarizeHistory } from './history';
import { buildInsights, periodReport, yearReport } from './summaries';
import { addDays } from '../utils/date';
import { formatCompact } from '../utils/format';

export function runHistoryTests() {
  const results = [];
  const t = (name, got, want) => results.push({ name, got, want, pass: got === want });

  const make = (habitId, extra) => ({
    habitId, name: habitId, icon: '', status: 'active', startDate: '2026-10-01',
    weekdays: [0, 1, 2, 3, 4, 5, 6], unit: '', unitFactor: 1, minTarget: null, endTarget: null,
    progressionEnabled: false, progressionAmount: null, progressionInterval: null, progressionUnit: 'days',
    quickAdds: [], scheduleTime: '', sortOrder: 1, categoryId: 'c', ...extra,
  });
  const startAnchor = (h) => ({
    changeId: 'a', habitId: h.habitId, effectiveDate: h.startDate, target: h.startingTarget,
    reason: 'start', createdAt: '', plan: null,
  });
  const ent = (habitId, date, delta) => ({ entryId: `${habitId}_${date}_${delta}`, habitId, date, delta, deleted: false });
  const run = (habit, entries, today, { todayFinal = false, extra = [], from = '2026-10-01' } = {}) => {
    const days = buildHistory(habit, [startAnchor(habit), ...extra], buildDayTotals(entries), { from, to: today, today, todayFinal });
    return { days, sum: summarizeHistory(habit, days, today) };
  };

  // ----- count habit: S S F S S S(today) -----
  const p = make('p', { trackingType: 'COUNT', goalDirection: 'INCREASE', startingTarget: 10, unit: 'reps' });
  const pEntries = [
    ent('p', '2026-10-01', 10), ent('p', '2026-10-02', 12), ent('p', '2026-10-03', 5),
    ent('p', '2026-10-04', 10), ent('p', '2026-10-05', 10), ent('p', '2026-10-06', 10),
  ];
  const a = run(p, pEntries, '2026-10-06');
  t('streak: current run is 3', a.sum.current, 3);
  t('streak: longest run is 3', a.sum.longest, 3);
  t('counted days', a.sum.counted, 6);
  t('completed days', a.sum.completed, 5);
  t('missed days', a.sum.missed, 1);
  t('total reps', a.sum.total, 57);
  t('completion rate', Math.round(a.sum.rate), 83);
  t('best day', a.sum.high.actual, 12);

  const pend = run(p, pEntries.slice(0, 5), '2026-10-06');
  t('unfinished today does not break the streak', pend.sum.current, 2);
  t('pending today is not counted', pend.sum.counted, 5);
  t('final today with nothing logged breaks the streak', run(p, pEntries.slice(0, 5), '2026-10-06', { todayFinal: true }).sum.current, 0);

  // ----- weekdays: Mon-Fri boolean, Oct 1 is a Thursday -----
  const y = make('y', { trackingType: 'BOOLEAN', goalDirection: 'INCREASE', startingTarget: 1, weekdays: [1, 2, 3, 4, 5] });
  const wk = run(y, [ent('y', '2026-10-01', 1), ent('y', '2026-10-02', 1), ent('y', '2026-10-05', 1)], '2026-10-05');
  t('weekend days are skipped', wk.days.filter((d) => d.status === 'skip').length, 2);
  t('weekend does not break the streak', wk.sum.current, 3);
  t('weekend is not counted', wk.sum.counted, 3);

  // ----- pause: days inside a pause are skipped -----
  const pz = run(p, [ent('p', '2026-10-01', 10), ent('p', '2026-10-02', 10), ent('p', '2026-10-05', 10)], '2026-10-05', {
    extra: [
      { changeId: 'b', habitId: 'p', effectiveDate: '2026-10-03', target: 10, reason: 'pause', createdAt: '1', plan: null },
      { changeId: 'c', habitId: 'p', effectiveDate: '2026-10-05', target: 10, reason: 'resume', createdAt: '2', plan: null },
    ],
  });
  t('paused days are skipped', pz.days.filter((d) => d.status === 'skip').length, 2);
  t('pause does not break the streak', pz.sum.current, 3);

  // ----- limit: S F S pending -----
  const tea = make('tea', { trackingType: 'LIMIT', goalDirection: 'DECREASE', startingTarget: 3, unit: 'cups' });
  const teaEntries = [ent('tea', '2026-10-01', 2), ent('tea', '2026-10-02', 4), ent('tea', '2026-10-04', 1)];
  const lim = run(tea, teaEntries, '2026-10-04');
  t('limit: unlogged past day within the limit is a success', lim.days[2].status, 'success');
  t('limit: over the limit is a fail', lim.days[1].status, 'fail');
  t('limit: today within limit is pending', lim.days[3].status, 'pending');
  t('limit: current streak', lim.sum.current, 1);
  t('limit: today counts once final', run(tea, teaEntries, '2026-10-04', { todayFinal: true }).sum.current, 2);
  t('limit: exceeding today fails at once', run(tea, [ent('tea', '2026-10-04', 5)], '2026-10-04', { from: '2026-10-04' }).days[0].status, 'fail');

  // ----- abstinence: S S F(slip) S pending -----
  const nop = make('nop', { trackingType: 'ABSTINENCE', goalDirection: 'AVOID', startingTarget: 0 });
  const nEntries = [ent('nop', '2026-10-01', 1), ent('nop', '2026-10-02', 1), ent('nop', '2026-10-03', 0), ent('nop', '2026-10-04', 1)];
  const ab = run(nop, nEntries, '2026-10-05');
  t('abstinence: current streak', ab.sum.current, 1);
  t('abstinence: longest streak', ab.sum.longest, 2);
  t('abstinence: last slip', ab.sum.lastSlip, '2026-10-03');
  t('abstinence: days since slip', ab.sum.daysSinceSlip, 2);
  const ab2 = run(nop, nEntries, '2026-10-06');
  t('abstinence: unchecked past day breaks the streak', ab2.sum.current, 0);
  t('abstinence: unchecked day is not a slip', ab2.sum.slips, 1);

  // ----- comparisons -----
  const cs = (counted, avgPerDay, rate) => ({ counted, avgPerDay, rate });
  const up = compareSummaries(p, cs(5, 15, 100), cs(5, 10, 100));
  t('count habit +50%', Math.round(up.pct), 50);
  t('count habit improvement is good', up.good, true);
  t('tea down 50% is good', compareSummaries(tea, cs(5, 2, 100), cs(5, 4, 100)).good, true);
  t('tea up is bad', compareSummaries(tea, cs(5, 4, 100), cs(5, 2, 100)).good, false);
  t('too few days gives no comparison', compareSummaries(p, cs(1, 15, 100), cs(5, 10, 100)), null);
  t('check habit compares rate in points', compareSummaries(y, cs(5, 0, 80), cs(5, 0, 60)).diff, 20);

  // ----- chart buckets -----
  t('short range is one bar per day', bucketDays(Array.from({ length: 10 }, (_, i) => ({ date: addDays('2026-01-01', i), scheduled: true, actual: i, target: 5 }))).length, 10);
  const long = bucketDays(Array.from({ length: 200 }, (_, i) => ({ date: addDays('2026-01-01', i), scheduled: true, actual: i, target: 5 })));
  t('long range is bucketed by weeks', long.length, 29);
  t('bucket value is the average', long[0].value, 3);
  t('bucket target is the average target', long[0].target, 5);

  // ----- period report (today = Oct 6, not final, so today is left out of the rates) -----
  const tea2 = [ent('tea', '2026-10-01', 2), ent('tea', '2026-10-02', 4), ent('tea', '2026-10-04', 5)];
  const totals = buildDayTotals([...pEntries, ...tea2]);
  const anchorsByHabit = new Map([['p', [startAnchor(p)]], ['tea', [startAnchor(tea)]]]);
  const args = { habits: [p, tea], anchorsByHabit, totals, today: '2026-10-06', todayFinal: false };
  const rep = periodReport({ ...args, from: '2026-10-01', to: '2026-10-07', prev: null });
  t('overall counted leaves today out', rep.overall.counted, 10);
  t('overall completed', rep.overall.completed, 7);
  t('overall percent', Math.round(rep.overall.pct), 70);
  t('best habit', rep.best.habit.habitId, 'p');
  t('needs improvement', rep.needs.habit.habitId, 'tea');
  t('per-day totals', `${rep.byDate.get('2026-10-02').done}/${rep.byDate.get('2026-10-02').counted}`, '1/2');
  t('longest streak includes today', rep.longest.days, 3);
  t('insight: best completion', buildInsights(rep, { label: 'this month', fmt: (h, v) => String(v) }).includes('You completed p 4/5 days this month.'), true);

  const yr = yearReport({ ...args, year: 2026 });
  t('year covers months up to now', yr.months.length, 10);
  t('year: empty month has no rate', yr.monthly[0].rate, null);
  t('year: October counted', yr.monthly[9].counted, 10);
  t('year: October completed', yr.monthly[9].done, 7);

  t('compact seconds', formatCompact({ unit: 'sec', unitFactor: 1 }, 45), '45s');
  t('compact minutes', formatCompact({ unit: 'min', unitFactor: 60 }, 1800), '30m');
  t('compact hours', formatCompact({ unit: 'h', unitFactor: 3600 }, 5400), '1.5h');
  t('compact litres', formatCompact({ unit: 'L', unitFactor: 1000 }, 3800), '3.8');
  return results;
}