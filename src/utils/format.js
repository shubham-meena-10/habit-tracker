import { TRACKING_TYPES } from '../constants/trackingTypes';

// Habits with a time unit always store SECONDS (the Add Habit form in Phase 5 enforces this).
const TIME_UNITS = new Set([
  'sec', 'secs', 'second', 'seconds', 'min', 'mins', 'minute', 'minutes', 'h', 'hr', 'hrs', 'hour', 'hours',
]);
export const isTimeUnit = (unit) => TIME_UNITS.has(String(unit || '').trim().toLowerCase());

const round2 = (n) => Math.round(n * 100) / 100;

export function formatDuration(totalSec) {
  const sign = totalSec < 0 ? '-' : '';
  let s = Math.round(Math.abs(totalSec));
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  s -= m * 60;
  if (h) return `${sign}${h}h${m ? ` ${m}m` : ''}`;
  if (m) return `${sign}${m} min${s ? ` ${s} sec` : ''}`;
  return `${sign}${s} sec`;
}

/** Formats a value stored in BASE units for display, using the habit's unit + unitFactor. */
export function formatAmount(habit, base) {
  if (base === null || base === undefined || base === '') return '';
  if (habit.trackingType === TRACKING_TYPES.BOOLEAN || habit.trackingType === TRACKING_TYPES.ABSTINENCE) return '';
  if (isTimeUnit(habit.unit)) return formatDuration(base);
  const v = round2(base / (habit.unitFactor || 1));
  return `${v.toLocaleString('en-IN')}${habit.unit ? ' ' + habit.unit : ''}`;
}

/** One-line summary for lists. Phase 5 passes the current (progressed) target instead of the starting one. */
export function describeHabit(habit, target = habit.startingTarget) {
  if (habit.trackingType === TRACKING_TYPES.BOOLEAN) return 'Daily check-off';
  if (habit.trackingType === TRACKING_TYPES.ABSTINENCE) return 'Daily clean check-in';

  const amount = formatAmount(habit, target);
  let text = habit.trackingType === TRACKING_TYPES.LIMIT ? `Limit ${amount}` : `Target ${amount}`;

  if (habit.progressionEnabled && habit.progressionAmount && habit.progressionInterval) {
    const sign = habit.goalDirection === 'DECREASE' ? '−' : '+';
    const every = habit.progressionInterval === 1
      ? habit.progressionUnit.replace(/s$/, '')
      : `${habit.progressionInterval} ${habit.progressionUnit}`;
    text += ` · ${sign}${formatAmount(habit, habit.progressionAmount)} every ${every}`;
  }
  return text;
}

/** "2.5 / 3 L", "25 sec / 30 sec", "7 / 10 pages". Values are BASE units. */
export function formatPair(habit, actual, target) {
  if (isTimeUnit(habit.unit)) return `${formatDuration(actual)} / ${formatDuration(target)}`;
  const f = habit.unitFactor || 1;
  const fmt = (n) => round2(n / f).toLocaleString('en-IN');
  return `${fmt(actual)} / ${fmt(target)}${habit.unit ? ' ' + habit.unit : ''}`;
}

/** Signed label for quick-add buttons and deltas: "+250 ml", "+1 page", "−1 cups". */
export function formatQuick(habit, delta) {
  const sign = delta < 0 ? '−' : '+';
  const abs = Math.abs(delta);
  const unit = String(habit.unit || '').trim().toLowerCase();
  if (unit === 'l' && habit.unitFactor === 1000 && abs < 1000) return `${sign}${round2(abs)} ml`;
  return `${sign}${formatAmount(habit, abs)}`;
}

/** "07:30" → "7:30 AM" */
export function formatTime12(hhmm) {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** Stopwatch style: 27 → "00:27", 3725 → "1:02:05". */
export function formatClock(totalSec) {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const mm = String(m).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Short value for chart labels: "45s", "30m", "1.5h", or a bare number ("3.8"). Values are BASE units. */
export function formatCompact(habit, base) {
  if (isTimeUnit(habit.unit)) {
    const s = Math.abs(base);
    if (s < 60) return `${Math.round(base)}s`;
    if (s < 3600) return `${Math.round(base / 60)}m`;
    return `${Math.round(base / 360) / 10}h`;
  }
  return String(round2(base / (habit.unitFactor || 1)));
}