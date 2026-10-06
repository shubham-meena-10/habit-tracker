import { buildDayTotals } from './calculations';
import { quickAddsFor } from './daily';
import { dailySeries, summarize, yearSummary } from './stats';
import { findWaterHabit, isVolumeHabit, waterIncrementMl, withWaterUnit } from '../utils/water';

export function runStatsTests() {
  const results = [];
  const t = (name, got, want) => results.push({ name, got, want, pass: got === want });

  const habit = {
    habitId: 'w', trackingType: 'QUANTITY', goalDirection: 'INCREASE', minTarget: null, endTarget: null,
    startDate: '2026-10-01', weekdays: [0, 1, 2, 3, 4, 5, 6], progressionEnabled: false,
    progressionAmount: null, progressionInterval: null, progressionUnit: 'days',
    startingTarget: 3000, unit: 'L', unitFactor: 1000, status: 'active', sortOrder: 1,
  };
  const anchors = [{ changeId: 'a', habitId: 'w', effectiveDate: '2026-10-01', target: 3000, reason: 'start', createdAt: '' }];
  const totals = buildDayTotals([
    { entryId: '1', habitId: 'w', date: '2026-10-03', delta: 3800, deleted: false },
    { entryId: '2', habitId: 'w', date: '2026-10-04', delta: 2000, deleted: false },
    { entryId: '3', habitId: 'w', date: '2026-10-05', delta: 1000, deleted: false },
  ]);

  const series = dailySeries(habit, anchors, totals, '2026-10-01', '2026-10-07');
  t('series covers 7 days', series.length, 7);
  t('series total Oct 3', series[2].total, 3800);
  t('series extra Oct 3 (3.8 vs 3 L)', series[2].extra, 800);
  t('series target', series[0].target, 3000);

  const s = summarize(series, '2026-10-05', '2026-10-01');
  t('summary total includes today', s.total, 6800);
  t('summary avg excludes today', Math.round(s.avgPerDay), 1450);
  t('summary days logged', s.daysLogged, 3);
  t('summary best day', s.best.total, 3800);
  t('summary best date', s.best.date, '2026-10-03');
  t('summary days met', s.daysMet, 1);
  t('summary finished days', s.scheduledDays, 4);
  t('summary % of target', Math.round(s.pct), 48);

  const only = summarize(dailySeries(habit, anchors, totals, '2026-10-05', '2026-10-05'), '2026-10-05', '2026-10-05');
  t('single day falls back to today', only.avgPerDay, 1000);

  const y = yearSummary({
    pre: { total: 60000, daysLogged: 20, bestDay: 4500, bestDate: '2026-02-01' },
    local: s, todayTotal: 1000, start: '2026-01-01', today: '2026-10-05',
  });
  t('year total merges server + local', y.total, 66800);
  t('year days logged merges', y.daysLogged, 23);
  t('year best comes from the larger side', y.best.total, 4500);
  t('year avg excludes today', Math.round(y.avgPerDay), 238);
  t('year without server part', yearSummary({ pre: null, local: s, todayTotal: 1000, start: '2026-10-01', today: '2026-10-05' }).total, 6800);

  t('litre habit is a volume habit', isVolumeHabit(habit), true);
  t('custom L with factor 1 is not', isVolumeHabit({ ...habit, unitFactor: 1 }), false);
  t('count habit is not', isVolumeHabit({ trackingType: 'COUNT', unit: 'reps', unitFactor: 1 }), false);
  const ml = { ...habit, habitId: 'ml', unit: 'ml', unitFactor: 1, sortOrder: 2 };
  t('auto-detect picks first volume habit', findWaterHabit([ml, habit], {}).habitId, 'w');
  t('explicit choice wins', findWaterHabit([habit, ml], { waterHabitId: 'ml' }).habitId, 'ml');
  t('archived choice falls back', findWaterHabit([habit, { ...ml, status: 'archived' }], { waterHabitId: 'ml' }).habitId, 'w');
  t('default glass is 250 ml', waterIncrementMl({}), 250);
  t('configured glass', waterIncrementMl({ defaultWaterIncrementMl: '500' }), 500);
  t('invalid glass falls back', waterIncrementMl({ defaultWaterIncrementMl: '9000' }), 250);
  t('ml display unit', withWaterUnit(habit, 'ml').unitFactor, 1);
  t('unchanged unit keeps identity', withWaterUnit(habit, 'L') === habit, true);
  t('ml habit gets glass-sized quick adds', quickAddsFor({ ...ml, quickAdds: [] }).join(','), '250,500,1000');
  return results;
}