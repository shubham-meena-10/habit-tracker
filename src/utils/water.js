import { TRACKING_TYPES as T } from '../constants/trackingTypes';

export const WATER_UNITS = ['L', 'ml'];

/**
 * A "volume habit" is a QUANTITY habit stored in millilitres: litres (factor 1000)
 * or millilitres (factor 1). This is a property of its configuration, never its name.
 */
export function isVolumeHabit(habit) {
  if (habit.trackingType !== T.QUANTITY) return false;
  const unit = String(habit.unit || '').trim().toLowerCase();
  const factor = habit.unitFactor || 1;
  return (unit === 'l' && factor === 1000) || (unit === 'ml' && factor === 1);
}

export function volumeHabits(habits) {
  return habits
    .filter((h) => h.status !== 'archived' && isVolumeHabit(h))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** The habit that gets the "+ 1 Glass" button: the one chosen in Settings, else the first active volume habit. */
export function findWaterHabit(habits, settings) {
  const list = volumeHabits(habits);
  const id = settings.waterHabitId;
  if (id) {
    const hit = list.find((h) => h.habitId === id);
    if (hit) return hit;
  }
  return list.find((h) => h.status === 'active') || list[0] || null;
}

export function waterIncrementMl(settings) {
  const n = Number(settings.defaultWaterIncrementMl);
  return Number.isFinite(n) && n >= 1 && n <= 5000 ? Math.round(n) : 250;
}

/** Display copy of a volume habit in the chosen water unit. Base values (ml) are untouched. */
export function withWaterUnit(habit, waterUnit) {
  if (!isVolumeHabit(habit)) return habit;
  const unit = waterUnit === 'ml' ? 'ml' : 'L';
  const factor = unit === 'ml' ? 1 : 1000;
  if (habit.unit === unit && habit.unitFactor === factor) return habit;
  return { ...habit, unit, unitFactor: factor };
}