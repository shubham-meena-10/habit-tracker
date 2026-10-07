// Pure helpers for export and import (no network, no storage), so they can be tested.
const BOM = '\uFEFF';   // makes Excel read the file as UTF-8 (emoji in habit names)
const round4 = (n) => Math.round(n * 10000) / 10000;

function cell(v) {
  if (v === null || v === undefined) return '';
  let s = String(v);
  // Text starting with = + - @ would run as a formula in Excel / Sheets. Defuse it.
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header, rows) {
  return BOM + [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
}

const isCheckType = (h) => h && (h.trackingType === 'BOOLEAN' || h.trackingType === 'ABSTINENCE');

/** One row per entry. `amount` is in the habit's display unit (L, min, reps…); times are in that unit too. */
export function entriesCsv(tables) {
  const habits = new Map((tables.habits || []).map((h) => [h.habitId, h]));
  const rows = [...(tables.entries || [])].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
  const header = ['date', 'habit', 'amount', 'unit', 'source', 'durationSec', 'note', 'deleted', 'createdAt', 'entryId', 'habitId'];
  return toCsv(header, rows.map((e) => {
    const h = habits.get(e.habitId) || {};
    const check = isCheckType(h);
    return [
      e.date, h.name || '', check ? e.delta : round4(e.delta / (h.unitFactor || 1)), check ? '' : h.unit || '',
      e.source, e.durationSec, e.note, e.deleted ? 'TRUE' : 'FALSE', e.createdAt, e.entryId, e.habitId,
    ];
  }));
}

/** startingTarget, minTarget, endTarget and progressionAmount are in base units (divide by unitFactor for the display unit). */
export function habitsCsv(tables) {
  const cats = new Map((tables.categories || []).map((c) => [c.categoryId, c.name]));
  const header = [
    'habitId', 'name', 'category', 'trackingType', 'goalDirection', 'unit', 'unitFactor', 'startingTarget',
    'minTarget', 'endTarget', 'startDate', 'weekdays', 'scheduleTime', 'reminderTime', 'progressionEnabled',
    'progressionAmount', 'progressionInterval', 'progressionUnit', 'status',
  ];
  return toCsv(header, (tables.habits || []).map((h) => [
    h.habitId, h.name, cats.get(h.categoryId) || h.categoryId, h.trackingType, h.goalDirection, h.unit, h.unitFactor,
    h.startingTarget, h.minTarget, h.endTarget, h.startDate, (h.weekdays || []).join(' '), h.scheduleTime, h.reminderTime,
    h.progressionEnabled ? 'TRUE' : 'FALSE', h.progressionAmount, h.progressionInterval, h.progressionUnit, h.status,
  ]));
}

const LISTS = ['categories', 'habits', 'targetChanges', 'entries', 'dayStatus'];

/** Validates a backup file's text. Throws an Error with a user-friendly message. */
export function parseBackup(text) {
  if (String(text).length > 40 * 1024 * 1024) throw new Error('That file is too large to be a backup from this app.');
  let obj;
  try { obj = JSON.parse(text); } catch { throw new Error('That file is not valid JSON.'); }
  if (!obj || typeof obj !== 'object' || obj.app !== 'habit-tracker' || !obj.tables || typeof obj.tables !== 'object') {
    throw new Error('This does not look like a backup from this app.');
  }
  if (obj.format !== 1) throw new Error('This backup was made by a newer version of the app.');
  LISTS.forEach((k) => {
    if (obj.tables[k] !== undefined && !Array.isArray(obj.tables[k])) throw new Error(`The backup's "${k}" is not a list.`);
  });

  const t = obj.tables;
  const live = (t.entries || []).filter((e) => e && !e.deleted);
  const dates = live.map((e) => e.date).filter(Boolean).sort();
  return {
    source: obj.source || 'server',
    exportedAt: obj.exportedAt || '',
    tables: t,
    counts: {
      categories: (t.categories || []).length,
      habits: (t.habits || []).length,
      targetChanges: (t.targetChanges || []).length,
      dayStatus: (t.dayStatus || []).length,
      entries: live.length,
    },
    range: dates.length ? { from: dates[0], to: dates[dates.length - 1] } : null,
  };
}