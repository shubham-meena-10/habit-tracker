import {
  checkinState, isCheckinDue, pendingQuitRows, summarizeCheckin, validCloseTime, validTime,
} from './checkin';
import { buildSchedule, formatUntil, weekdaySummary } from './schedule';

export function runCheckinTests() {
  const results = [];
  const t = (name, got, want) => results.push({ name, got, want, pass: got === want });

  const H = (trackingType, extra) => ({
    habitId: trackingType, trackingType, goalDirection: 'INCREASE', status: 'active', sortOrder: 1, ...extra,
  });
  const D = (status, extra) => ({ status, slip: false, ...extra });
  const LIM = { goalDirection: 'DECREASE' };
  const ABS = { goalDirection: 'AVOID' };

  t('success is done', checkinState(H('COUNT'), D('success')), 'done');
  t('unfinished habit is open', checkinState(H('COUNT'), D('pending')), 'open');
  t('failed past-day habit can still be fixed', checkinState(H('COUNT'), D('fail')), 'open');
  t('limit still within its cap counts as done', checkinState(H('LIMIT', LIM), D('pending')), 'done');
  t('limit exceeded is bad', checkinState(H('LIMIT', LIM), D('fail')), 'bad');
  t('a slip is bad', checkinState(H('ABSTINENCE', ABS), D('fail', { slip: true })), 'bad');
  t('unchecked quit habit on a past day is open', checkinState(H('ABSTINENCE', ABS), D('fail')), 'open');
  t('unchecked quit habit today is open', checkinState(H('ABSTINENCE', ABS), D('pending')), 'open');
  t('not scheduled is off', checkinState(H('COUNT'), D('skip')), 'off');

  const row = (habit, day, entries = []) => ({ habit, day, entries });
  const rows = [
    row(H('COUNT', { habitId: 'a' }), D('success')),
    row(H('COUNT', { habitId: 'b' }), D('pending')),
    row(H('LIMIT', { habitId: 'c', ...LIM }), D('pending')),
    row(H('ABSTINENCE', { habitId: 'd', ...ABS }), D('pending')),
    row(H('ABSTINENCE', { habitId: 'e', ...ABS }), D('fail', { slip: true }), [{ entryId: 'x', delta: 0 }]),
    row(H('COUNT', { habitId: 'f', status: 'archived' }), D('success')),
    row(H('COUNT', { habitId: 'g' }), D('skip')),
  ];
  const s = summarizeCheckin(rows);
  t('archived and not-scheduled rows are left out', s.total, 5);
  t('done count', s.done, 2);
  t('open habits', s.open.map((r) => r.habit.habitId).join(','), 'b,d');
  t('bad habits', s.bad.map((r) => r.habit.habitId).join(','), 'e');
  t('percentage', s.pct, 40);
  t('empty day has no percentage', summarizeCheckin([]).pct, null);
  t('only unchecked quit habits are pending', pendingQuitRows(rows).map((r) => r.habit.habitId).join(','), 'd');

  t('due after the check-in time', isCheckinDue({ minutes: 1260, checkinTime: '21:00', closed: false }), true);
  t('not due a minute earlier', isCheckinDue({ minutes: 1259, checkinTime: '21:00', closed: false }), false);
  t('not due once the day is closed', isCheckinDue({ minutes: 1300, checkinTime: '21:00', closed: true }), false);
  t('default check-in time is 21:00', isCheckinDue({ minutes: 1300, closed: false }), true);

  t('valid time', validTime('07:30'), true);
  t('25:00 is not a time', validTime('25:00'), false);
  t('blank is not a time', validTime(''), false);
  t('23:59 is a valid close time', validCloseTime('23:59'), true);
  t('12:00 is a valid close time', validCloseTime('12:00'), true);
  t('11:59 is too early to close a day', validCloseTime('11:59'), false);

  const hs = [
    { habitId: 'a', status: 'active', scheduleTime: '10:00', sortOrder: 2 },
    { habitId: 'b', status: 'active', scheduleTime: '09:05', sortOrder: 3 },
    { habitId: 'c', status: 'active', scheduleTime: '', sortOrder: 1 },
    { habitId: 'd', status: 'paused', scheduleTime: '08:00', sortOrder: 4 },
    { habitId: 'e', status: 'archived', scheduleTime: '08:00', sortOrder: 5 },
  ];
  const sch = buildSchedule(hs);
  t('timed habits are ordered by clock time', sch.timed.map((h) => h.habitId).join(','), 'b,a');
  t('habits without a time are listed separately', sch.anytime.map((h) => h.habitId).join(','), 'c');
  t('paused habits are listed separately', sch.paused.map((h) => h.habitId).join(','), 'd');

  t('every day', weekdaySummary([0, 1, 2, 3, 4, 5, 6]), 'Every day');
  t('weekdays', weekdaySummary([1, 2, 3, 4, 5]), 'Weekdays');
  t('weekends', weekdaySummary([6, 0]), 'Weekends');
  t('named days follow Monday-first order', weekdaySummary([3, 1]), 'Mon, Wed');
  t('Sunday sorts last', weekdaySummary([0, 1]), 'Mon, Sun');
  t('minutes only', formatUntil(25), '25 min');
  t('whole hours', formatUntil(60), '1 h');
  t('hours and minutes', formatUntil(135), '2 h 15 min');
  t('already due', formatUntil(0), 'now');
  return results;
}