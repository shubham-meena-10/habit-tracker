// All stored values are in BASE units (seconds, ml, reps...). `factor` = base units per display unit.
export const UNIT_PRESETS = [
  { key: 'reps', label: 'reps', unit: 'reps', factor: 1 },
  { key: 'pages', label: 'pages', unit: 'pages', factor: 1 },
  { key: 'cups', label: 'cups', unit: 'cups', factor: 1 },
  { key: 'times', label: 'times', unit: 'times', factor: 1 },
  { key: 'sec', label: 'seconds', unit: 'sec', factor: 1, time: true },
  { key: 'min', label: 'minutes', unit: 'min', factor: 60, time: true },
  { key: 'hour', label: 'hours', unit: 'h', factor: 3600, time: true },
  { key: 'L', label: 'litres', unit: 'L', factor: 1000 },
  { key: 'ml', label: 'millilitres', unit: 'ml', factor: 1 },
  { key: 'custom', label: 'Custom…', unit: '', factor: 1, custom: true },
];

export const presetByKey = (key) => UNIT_PRESETS.find((p) => p.key === key) || UNIT_PRESETS[0];

/** Timer/duration habits must use a time unit; everything else may use any. */
export function allowedPresets(trackingType) {
  return trackingType === 'TIMER' || trackingType === 'DURATION'
    ? UNIT_PRESETS.filter((p) => p.time)
    : UNIT_PRESETS;
}

export function defaultPresetKey(trackingType) {
  switch (trackingType) {
    case 'TIMER': case 'DURATION': return 'min';
    case 'QUANTITY': return 'L';
    case 'LIMIT': return 'cups';
    default: return 'reps';
  }
}

/** Finds the preset matching a stored habit (unit + factor), else "custom". */
export function presetForHabit(habit) {
  const unit = String(habit.unit || '').trim().toLowerCase();
  const factor = habit.unitFactor || 1;
  const hit = UNIT_PRESETS.find((p) => !p.custom && p.unit.toLowerCase() === unit && p.factor === factor);
  return hit || UNIT_PRESETS.find((p) => p.custom);
}