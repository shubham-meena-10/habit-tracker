import { buildDayTotals } from './calculations';
import { buildDayRows, canEditDay, dayPct, dayTone, monthGrid, monthStats } from './calendar';
import { amountUnitsFor } from '../utils/amounts';

export function runCalendarTests() {
  const results = [];
  const t = (name, got, want) => results.push({ name, got, want, pass: got === want });

  // ----- grid -----
  const mon = monthGrid('2026-10-01', 1);
  t('Monday grid has 5 weeks', mon.length, 5);
  t('Monday grid starts on 28 Sep', mon[0][0].date, '2026-09-28');
  t('Monday grid ends on 1 Nov', mon[4][6].date, '2026-11-01');
  t('1 Oct is in the Thursday column', mon[0][3].date, '2026-10-01');
  t('days from the previous month are flagged', mon[0][0].inMonth, false);
  const sun = monthGrid('2026-10-01', 0);
  t('Sunday grid starts on 27 Sep', sun[0][0].date, '2026-09-27');
  t('Sunday grid ends on 31 Oct', sun[4][6].date, '2026-10-31');
  t('a month that fits exactly needs 4 weeks', monthGrid('2026-02-01', 0).length, 4);
  t('the same month needs 5 weeks starting Monday', monthGrid('2026-02-01', 1).length, 5);

  // ----- tones -----
  t('80% is green', dayTone(80), 'good');
  t('79.9% is amber', dayTone(79.9), 'ok');
  t('50% is amber', dayTone(50), 'ok');
  t('49.9% is red', dayTone(49.9), 'bad');
  t('nothing counted is grey', dayTone(null), 'none');
  t('4 of 5 is 80%', dayPct({ done: 4, counted: 5 }), 80);
  t('0 of 0 is nothing', dayPct({ done: 0, counted: 0 }), null);

  const stats = monthStats(new Map([
    ['a', { done: 5, counted: 5 }], ['b', { done: 2, counted: 4 }], ['c', { done: 1, counted: 5 }], ['d', { done: 0, counted: 0 }],
  ]));
  t('month stats: green days', stats.good, 1);
  t('month stats: amber days', stats.ok, 1);
  t('month stats: red days', stats.bad, 1);
  t('month stats: empty days are not tracked', stats.tracked, 3);
  t('month stats: average', Math.round(stats.avg), 57);

  // ----- edit window -----
  t('today is editable', canEditDay({ date: '2026-10-05', today: '2026-10-05', cacheFrom: '2026-07-07' }), true);
  t('future is not editable', canEditDay({ date: '2026-10-06', today: '2026-10-05', cacheFrom: null }), false);
  t('older than the cache is view-only', canEditDay({ date: '2026-07-06', today: '2026-10-05', cacheFrom: '2026-07-07' }), false);
  t('the first cached day is editable', canEditDay({ date: '2026-07-07', today: '2026-10-05', cacheFrom: '2026-07-07' }), true);
  t('unknown cache start allows editing', canEditDay({ date: '2026-01-01', today: '2026-10-05', cacheFrom: null }), true);

  // ----- day rows (4 Oct 2026 is a Sunday) -----
  const make = (habitId, extra) => ({
    habitId, name: habitId, icon: '', status: 'active', startDate: '2026-10-01',
    weekdays: [0, 1, 2, 3, 4, 5, 6], unit: '', unitFactor: 1, minTarget: null, endTarget: null,
    progressionEnabled: false, progressionAmount: null, progressionInterval: null, progressionUnit: 'days',
    quickAdds: [], scheduleTime: '', categoryId: 'c', ...extra,
  });
  const water = make('water', { sortOrder: 1, trackingType: 'QUANTITY', goalDirection: 'INCREASE', startingTarget: 3000, unit: 'L', unitFactor: 1000 });
  const tea = make('tea', { sortOrder: 2, trackingType: 'LIMIT', goalDirection: 'DECREASE', startingTarget: 3, unit: 'cups' });
  const yoga = make('yoga', { sortOrder: 3, trackingType: 'BOOLEAN', goalDirection: 'INCREASE', startingTarget: 1 });
  const work = make('work', { sortOrder: 4, trackingType: 'TIMER', goalDirection: 'INCREASE', startingTarget: 28800, unit: 'min', unitFactor: 60, weekdays: [1, 2, 3, 4, 5] });
  const old = make('old', { sortOrder: 5, status: 'archived', trackingType: 'COUNT', goalDirection: 'INCREASE', startingTarget: 5, unit: 'reps' });
  const habits = [water, tea, yoga, work, old];
  const anchorsByHabit = new Map(habits.map((h) => [h.habitId, [{
    changeId: `a_${h.habitId}`, habitId: h.habitId, effectiveDate: h.startDate, target: h.startingTarget, reason: 'start', createdAt: '', plan: null,
  }]]));
  const ent = (id, habitId, delta) => ({ entryId: id, habitId, date: '2026-10-04', delta, deleted: false, createdAt: id });
  const entries = [ent('1', 'water', 2000), ent('2', 'water', 1200), ent('3', 'tea', 4)];
  const run = (list) => buildDayRows({
    habits, anchorsByHabit, totals: buildDayTotals(list), entriesOnDate: list, date: '2026-10-04',
    today: '2026-10-05', todayFinal: false,
  });

  const d = run(entries);
  const by = (id) => d.rows.find((r) => r.habit.habitId === id);
  t('weekday-only habit is hidden on a Sunday', d.rows.length, 3);
  t('hidden count', d.hidden, 1);
  t('archived habit without entries is not listed', Boolean(by('old')), false);
  t('water 3.2 / 3 L succeeds', by('water').day.status, 'success');
  t('water has two entries attached', by('water').entries.length, 2);
  t('tea over the limit fails', by('tea').day.status, 'fail');
  t('yoga with no check-in fails on a past day', by('yoga').day.status, 'fail');
  t('counted habits', d.counted, 3);
  t('completed habits', d.done, 1);
  t('percentage', Math.round(d.pct), 33);

  const withOld = run([...entries, ent('4', 'old', 5)]);
  t('archived habit with entries is listed', withOld.rows.length, 4);
  t('archived habit does not count', withOld.counted, 3);

  // ----- unit choices for manual amounts -----
  const pick = (h) => { const u = amountUnitsFor(h); return u.units[u.index].label; };
  t('seconds habit defaults to sec', pick({ trackingType: 'TIMER', unit: 'sec', unitFactor: 1 }), 'sec');
  t('minutes habit defaults to min', pick({ trackingType: 'TIMER', unit: 'min', unitFactor: 60 }), 'min');
  t('hours habit defaults to hours', pick({ trackingType: 'TIMER', unit: 'h', unitFactor: 3600 }), 'hours');
  t('litres habit defaults to L', pick({ trackingType: 'QUANTITY', unit: 'L', unitFactor: 1000 }), 'L');
  t('millilitres habit defaults to ml', pick({ trackingType: 'QUANTITY', unit: 'ml', unitFactor: 1 }), 'ml');
  t('other habits use their own unit', pick({ trackingType: 'COUNT', unit: 'reps', unitFactor: 1 }), 'reps');
  return results;
}