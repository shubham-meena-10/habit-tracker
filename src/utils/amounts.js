import { isTimeUnit } from './format';
import { isVolumeHabit } from './water';

/**
 * Units offered when typing an amount by hand. `factor` = base units per unit.
 * `index` is the default choice for that habit.
 */
export function amountUnitsFor(habit) {
  const unit = String(habit.unit || '').trim().toLowerCase();
  if (isTimeUnit(habit.unit)) {
    return {
      units: [{ label: 'min', factor: 60 }, { label: 'sec', factor: 1 }, { label: 'hours', factor: 3600 }],
      index: /^s/.test(unit) ? 1 : /^h/.test(unit) ? 2 : 0,
    };
  }
  if (isVolumeHabit(habit)) {
    return { units: [{ label: 'ml', factor: 1 }, { label: 'L', factor: 1000 }], index: unit === 'l' ? 1 : 0 };
  }
  return { units: [{ label: habit.unit || 'units', factor: habit.unitFactor || 1 }], index: 0 };
}