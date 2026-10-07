import { dueReminders } from './reminders';
import { entriesCsv, habitsCsv, parseBackup, toCsv } from '../utils/backupFormat';

export function runDeviceTests() {
  const results = [];
  const t = (name, got, want) => results.push({ name, got, want, pass: got === want });
  const noBom = (s) => s.replace(/^\uFEFF/, '');

  // ----- reminders -----
  const item = (id, extra = {}, itemExtra = {}) => ({
    habit: { habitId: id, icon: '💧', name: id, reminderTime: '07:00', trackingType: 'COUNT', ...extra },
    done: false, bucket: 'focus', calc: { state: 'none' }, valueText: '0 / 15 min', ...itemExtra,
  });
  const run = (items, minutes, extra = {}) =>
    dueReminders({ items, minutes, today: '2026-10-07', checkinTime: '21:00', closed: false, ...extra });

  t('due at the exact minute', run([item('a')], 420).length, 1);
  t('still due 9 minutes late', run([item('a')], 429).length, 1);
  t('not due 10 minutes late', run([item('a')], 430).length, 0);
  t('not due a minute early', run([item('a')], 419).length, 0);
  t('no reminder time, no reminder', run([item('a', { reminderTime: '' })], 420).length, 0);
  t('completed habits are skipped', run([item('a', {}, { done: true })], 420).length, 0);
  t('limits are never reminded', run([item('a', {}, { bucket: 'limits' })], 420).length, 0);
  t('a slip is not reminded', run([item('a', {}, { calc: { state: 'slip' } })], 420).length, 0);
  t('reminder body is the progress text', run([item('a')], 420)[0].body, '0 / 15 min');
  t('reminder key is per habit per day', run([item('a')], 420)[0].key, '2026-10-07|a');
  t('timer habits open the timer', run([item('p', { trackingType: 'TIMER' })], 420)[0].url, '#/timer/p');
  t('other habits open Home', run([item('a')], 420)[0].url, '#/');
  t('check-in reminder at the check-in time', run([], 1260).length, 1);
  t('check-in reminder key', run([], 1260)[0].key, '2026-10-07|checkin');
  t('check-in reminder opens the check-in', run([], 1260)[0].url, '#/checkin');
  t('no check-in reminder once the day is closed', run([], 1260, { closed: true }).length, 0);
  t('check-in defaults to 21:00', run([], 1260, { checkinTime: undefined }).length, 1);

  // ----- CSV -----
  t('csv escapes commas and quotes', noBom(toCsv(['a', 'b'], [['x,y', 'say "hi"']])), 'a,b\r\n"x,y","say ""hi"""');
  t('csv escapes new lines', noBom(toCsv(['a'], [['l1\nl2']])), 'a\r\n"l1\nl2"');
  t('csv defuses formulas in text', noBom(toCsv(['n'], [['=1+1']])), "n\r\n'=1+1");
  t('csv keeps negative numbers', noBom(toCsv(['n'], [[-5]])), 'n\r\n-5');
  t('csv starts with a byte-order mark', toCsv(['a'], []).charCodeAt(0), 0xfeff);

  const tables = {
    categories: [{ categoryId: 'cat_a', name: 'Health' }],
    habits: [
      { habitId: 'w', name: 'Water', unit: 'L', unitFactor: 1000, trackingType: 'QUANTITY', categoryId: 'cat_a', weekdays: [1, 2], status: 'active' },
      { habitId: 'y', name: 'Yoga', unit: '', unitFactor: 1, trackingType: 'BOOLEAN', categoryId: 'cat_a', weekdays: [], status: 'active' },
    ],
    entries: [
      { entryId: 'e2', habitId: 'y', date: '2026-10-06', delta: 1, source: 'checkin', note: '', deleted: false, createdAt: '2' },
      { entryId: 'e1', habitId: 'w', date: '2026-10-05', delta: 3800, source: 'tap', note: '', deleted: false, createdAt: '1' },
    ],
  };
  const lines = noBom(entriesCsv(tables)).split('\r\n');
  t('entries CSV has a header and two rows', lines.length, 3);
  t('entries are sorted by date', lines[1].startsWith('2026-10-05,Water,'), true);
  t('amounts use the display unit', lines[1].split(',')[2], '3.8');
  t('amount unit is shown', lines[1].split(',')[3], 'L');
  t('check-in entries keep their 0/1 value', lines[2].split(',')[2], '1');
  t('habits CSV shows the category name', noBom(habitsCsv(tables)).split('\r\n')[1].split(',')[2], 'Health');
  t('habits CSV joins weekdays', noBom(habitsCsv(tables)).split('\r\n')[1].includes(',1 2,'), true);

  // ----- backup parsing -----
  const fails = (text) => { try { parseBackup(text); return false; } catch { return true; } };
  t('rejects text that is not JSON', fails('nope'), true);
  t('rejects JSON from another app', fails('{"tables":{}}'), true);
  t('rejects a newer format', fails('{"app":"habit-tracker","format":2,"tables":{}}'), true);
  t('rejects a table that is not a list', fails('{"app":"habit-tracker","format":1,"tables":{"habits":{}}}'), true);
  const ok = parseBackup(JSON.stringify({
    app: 'habit-tracker', format: 1, tables: {
      habits: [{}], entries: [{ date: '2026-10-02' }, { date: '2026-10-01' }, { date: '2026-09-01', deleted: true }],
    },
  }));
  t('counts habits', ok.counts.habits, 1);
  t('counts only live entries', ok.counts.entries, 2);
  t('entry range start', ok.range.from, '2026-10-01');
  t('entry range end', ok.range.to, '2026-10-02');
  t('source defaults to server', ok.source, 'server');
  return results;
}