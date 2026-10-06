import { buildDayTotals } from './calculations';
import { buildDaily } from './daily';
import { computeTarget, groupAnchors, levelTimeline, planOf, projectLevels } from './progression';

export function runPlanTests() {
  const results = [];
  const t = (name, got, want) => results.push({ name, got, want, pass: got === want });
  const anchor = (date, target, reason = 'start', plan = null) => ({ effectiveDate: date, target, reason, createdAt: '', plan });

  const push = {
    habitId: 'p', name: 'p', icon: '', status: 'active', trackingType: 'COUNT', goalDirection: 'INCREASE',
    unit: 'reps', unitFactor: 1, minTarget: null, endTarget: null, startDate: '2026-10-01', startingTarget: 5,
    weekdays: [0, 1, 2, 3, 4, 5, 6], progressionEnabled: true, progressionAmount: 5, progressionInterval: 14,
    progressionUnit: 'days', quickAdds: [], scheduleTime: '', sortOrder: 1,
  };
  const plan14 = planOf(push);
  const habit7 = { ...push, progressionInterval: 7 };

  // Plan snapshots: changing the interval must not rewrite past days
  const snap = [anchor('2026-10-01', 5, 'start', plan14), anchor('2026-10-20', 10, 'manual', planOf(habit7))];
  t('past days keep the old 14-day plan', computeTarget(habit7, snap, '2026-10-19').target, 10);
  t('new plan: 6 days in, no step yet', computeTarget(habit7, snap, '2026-10-26').target, 10);
  t('new plan: 7 days in, one step', computeTarget(habit7, snap, '2026-10-27').target, 15);
  t('legacy anchor falls back to current settings', computeTarget(habit7, [anchor('2026-10-01', 5)], '2026-10-19').target, 15);
  t('plan with progression off is frozen',
    computeTarget(push, [anchor('2026-10-01', 5, 'start', { ...plan14, enabled: false })], '2026-12-01').target, 5);

  // Timeline: automatic steps
  const auto = levelTimeline(push, [anchor('2026-10-01', 5)], '2026-10-29');
  t('timeline levels', auto.map((l) => l.target).join(','), '5,10,15');
  t('timeline reasons', auto.map((l) => l.reason).join(','), 'start,progress,progress');
  t('timeline first range ends 14 Oct', auto[0].to, '2026-10-14');
  t('timeline last range ends today', auto[2].to, '2026-10-29');

  // Timeline: manual change
  const man = levelTimeline(push, [anchor('2026-10-01', 5, 'start', plan14), anchor('2026-10-20', 12, 'manual', plan14)], '2026-10-25');
  t('manual timeline levels', man.map((l) => l.target).join(','), '5,10,12');
  t('manual timeline reasons', man.map((l) => l.reason).join(','), 'start,progress,manual');
  t('automatic level is cut at the manual change', man[1].to, '2026-10-19');

  // Timeline: pause
  const pau = levelTimeline(push, [anchor('2026-10-01', 5), anchor('2026-10-10', 5, 'pause')], '2026-10-20');
  t('paused timeline levels', pau.map((l) => l.target).join(','), '5,5');
  t('paused timeline reasons', pau.map((l) => l.reason).join(','), 'start,pause');

  // Projection
  const proj = projectLevels(push, [anchor('2026-10-01', 5)], '2026-10-05', 3);
  t('projection levels', proj.map((l) => l.target).join(','), '5,10,15');
  t('projection first range ends 14 Oct', proj[0].to, '2026-10-14');
  t('frozen habit projects one level', projectLevels({ ...push, progressionEnabled: false }, [anchor('2026-10-01', 5)], '2026-10-05', 3).length, 1);

  // Dashboard hints
  const first = (habit, today) => {
    const anchors = groupAnchors([{ changeId: 'a', habitId: habit.habitId, effectiveDate: habit.startDate, target: habit.startingTarget, reason: 'start', createdAt: '', plan: null }]);
    return buildDaily({
      habits: [habit], anchorsByHabit: anchors, totals: buildDayTotals([]), dayStatus: [], settings: {}, today, minutes: 600,
    }).items[0];
  };
  const tea = { ...push, habitId: 'tea', trackingType: 'LIMIT', goalDirection: 'DECREASE', unit: 'cups', startingTarget: 4, endTarget: 1, progressionAmount: 1, progressionInterval: 7 };
  t('level-up shown on the day of the step', first(push, '2026-10-15').levelUp, 'New target today: 10 reps (was 5)');
  t('no hint when the next step is far away', first(push, '2026-10-15').progressNote, '');
  t('no level-up on an ordinary day', first(push, '2026-10-25').levelUp, null);
  t('next step within a week', first(push, '2026-10-25').progressNote, 'Next target in 4 days: 15 reps');
  t('next step tomorrow', first(push, '2026-10-28').progressNote, 'Next target tomorrow: 15 reps');
  t('limits say "limit"', first(tea, '2026-10-08').levelUp, 'New limit today: 3 cups (was 4)');
  t('limit next step in 7 days', first(tea, '2026-10-08').progressNote, 'Next limit in 7 days: 2 cups');
  return results;
}