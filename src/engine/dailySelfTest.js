import { buildDayTotals } from './calculations';
import { groupAnchors } from './progression';
import { buildDaily, isDayFinal, quickAddsFor } from './daily';

export function runDailyTests() {
  const results = [];
  const t = (name, got, want) => results.push({ name, got, want, pass: got === want });

  const make = (habitId, extra) => ({
    habitId, name: habitId, icon: '', status: 'active', startDate: '2026-10-01',
    weekdays: [0, 1, 2, 3, 4, 5, 6], unit: '', unitFactor: 1, minTarget: null, endTarget: null,
    progressionEnabled: false, progressionAmount: null, progressionInterval: null, progressionUnit: 'days',
    quickAdds: [], scheduleTime: '', sortOrder: 1, ...extra,
  });
  const water = make('water', { trackingType: 'QUANTITY', goalDirection: 'INCREASE', unit: 'L', unitFactor: 1000, startingTarget: 3000 });
  const tea = make('tea', { trackingType: 'LIMIT', goalDirection: 'DECREASE', unit: 'cups', startingTarget: 3 });
  const nop = make('nop', { trackingType: 'ABSTINENCE', goalDirection: 'AVOID', startingTarget: 0 });
  const yoga = make('yoga', { trackingType: 'BOOLEAN', goalDirection: 'INCREASE', startingTarget: 1, scheduleTime: '07:00' });
  const habits = [water, tea, nop, yoga];

  const anchorsByHabit = groupAnchors(habits.map((h) => ({
    changeId: 'a_' + h.habitId, habitId: h.habitId, effectiveDate: '2026-10-01',
    target: h.startingTarget, reason: 'start', createdAt: '',
  })));
  const entries = [
    { entryId: 'e1', habitId: 'water', date: '2026-10-05', delta: 3800, deleted: false },
    { entryId: 'e2', habitId: 'tea', date: '2026-10-05', delta: 2, deleted: false },
  ];
  const totals = buildDayTotals(entries);
  const run = (minutes) => buildDaily({ habits, anchorsByHabit, totals, dayStatus: [], settings: {}, today: '2026-10-05', minutes });

  const mid = run(600); // 10:00
  const by = (d, id) => d.items.find((i) => i.habit.habitId === id);
  t('water is done', by(mid, 'water').bucket, 'done');
  t('water 3.8 / 3 L', by(mid, 'water').valueText, '3.8 / 3 L ✓');
  t('water extra text', by(mid, 'water').subText, '+0.8 L extra · 127%');
  t('tea within limit is watched, not counted', by(mid, 'tea').counted, false);
  t('tea shows remaining', by(mid, 'tea').subText, '1 cups left');
  t('abstinence pending is in focus', by(mid, 'nop').bucket, 'focus');
  t('yoga scheduled 07:00 is overdue at 10:00', by(mid, 'yoga').overdue, true);
  t('overdue habit is listed first', mid.groups.focus[0].habit.habitId, 'yoga');
  t('summary counted', mid.summary.total, 3);
  t('summary done', mid.summary.doneCount, 1);
  t('summary percent', mid.summary.percent, 33);

  const end = run(1439); // 23:59
  t('day final at close time', end.final, true);
  t('tea counted once final', by(end, 'tea').counted, true);
  t('tea done once final', by(end, 'tea').done, true);
  t('final summary done', end.summary.doneCount, 2);
  t('final summary percent', end.summary.percent, 50);
  t('yoga not overdue once final', by(end, 'yoga').overdue, false);

  t('yesterday is final', isDayFinal({ date: '2026-10-04', today: '2026-10-05', minutes: 0 }), true);
  t('today before close is not final', isDayFinal({ date: '2026-10-05', today: '2026-10-05', minutes: 600, closeTime: '23:59' }), false);
  t('closed day is final', isDayFinal({ date: '2026-10-05', today: '2026-10-05', minutes: 600, closed: true }), true);

  t('default quick adds for litres', quickAddsFor(water).join(','), '250,500,1000');
  t('default quick adds for limits', quickAddsFor(tea).join(','), '1,-1');
  t('no quick adds for check habits', quickAddsFor(nop).length, 0);
  return results;
}