import { TRACKING_TYPES } from '../constants/trackingTypes';
import { newId } from '../utils/id';
import { todayStr } from '../utils/date';

/** BOOLEAN/ABSTINENCE: at most one entry per habit per day (deterministic ID, delta 0 or 1). */
export const isCheckType = (habit) =>
  habit.trackingType === TRACKING_TYPES.BOOLEAN || habit.trackingType === TRACKING_TYPES.ABSTINENCE;

export function createEntry({ habit, delta, source = 'tap', durationSec = null, note = '', date, deviceId = '' }) {
  if (!habit || !habit.habitId) throw new Error('A habit is required');
  if (!Number.isFinite(delta)) throw new Error('delta must be a number');
  const day = date || todayStr();
  if (isCheckType(habit) && delta !== 0 && delta !== 1) {
    throw new Error('Check-in habits only accept 0 or 1');
  }
  const now = new Date().toISOString();
  return {
    entryId: isCheckType(habit) ? `chk_${habit.habitId}_${day}` : newId('e'),
    habitId: habit.habitId,
    date: day,
    delta,
    source,
    durationSec,
    note,
    deleted: false,
    createdAt: now,
    deviceId,
    updatedAt: now,
  };
}

/** Shape sent to the server (updatedAt is server-owned). */
export function entryToWire(entry) {
  // eslint-disable-next-line no-unused-vars
  const { updatedAt, ...wire } = entry;
  return wire;
}
