// Form <-> API conversion and validation. Values in the form are DISPLAY units;
// the API receives BASE units.
import { TRACKING_TYPES as T, GOAL_DIRECTIONS as D } from '../constants/trackingTypes';
import { presetByKey, presetForHabit } from '../constants/units';
import { previewLevels } from '../engine/progression';
import { isTimeUnit } from './format';
import { todayStr } from './date';

export const NEW_CATEGORY = '__new__';
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const WEEKDAY_LABELS = { 0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' };

export const isCheckKind = (type) => type === T.BOOLEAN || type === T.ABSTINENCE;

export function directionOptions(type) {
  return type === T.LIMIT ? [D.DECREASE, D.MAINTAIN, D.AVOID] : [D.INCREASE, D.DECREASE, D.MAINTAIN];
}
export function defaultDirection(type) {
  if (type === T.LIMIT) return D.DECREASE;
  if (type === T.ABSTINENCE) return D.AVOID;
  return D.INCREASE;
}

const fmtNum = (n) => String(Math.round(n * 10000) / 10000);
const roundBase = (n) => Math.round(n * 1e6) / 1e6;

export function emptyForm(settings = {}) {
  return {
    name: '', icon: '⭐', categoryId: 'cat_other', newCategoryName: '', newCategoryIcon: '📌', description: '',
    trackingType: T.COUNT, goalDirection: D.INCREASE, unitKey: 'reps', customUnit: '',
    target: '', minTarget: '', endTarget: '', startDate: todayStr(),
    weekdays: [0, 1, 2, 3, 4, 5, 6], scheduleTime: '', reminderTime: '', quickAdds: '',
    // progressionEnabled: false, progressionAmount: '',
    progressionEnabled: false, progressionAmount: settings.defaultProgressionAmount || '',
    progressionInterval: settings.defaultProgressionInterval || '14',
    progressionUnit: settings.defaultProgressionUnit || 'days',
    _orig: {},
  };
}

/** Existing habit -> form. Remembers original base values so untouched fields never drift. */
export function habitToForm(habit) {
  const preset = presetForHabit(habit);
  const f = habit.unitFactor || 1;
  const orig = {};
  const field = (key, base) => {
    if (base === null || base === undefined) return '';
    const text = fmtNum(base / f);
    orig[key] = { text, base };
    return text;
  };
  const quickText = (habit.quickAdds || []).map((n) => fmtNum(n / f)).join(', ');
  if (quickText) orig.quickAdds = { text: quickText, base: habit.quickAdds };

  return {
    name: habit.name, icon: habit.icon || '⭐', categoryId: habit.categoryId,
    newCategoryName: '', newCategoryIcon: '📌', description: habit.description || '',
    trackingType: habit.trackingType, goalDirection: habit.goalDirection,
    unitKey: preset.key, customUnit: preset.custom ? habit.unit : '',
    target: '', minTarget: field('minTarget', habit.minTarget), endTarget: field('endTarget', habit.endTarget),
    startDate: habit.startDate, weekdays: habit.weekdays && habit.weekdays.length ? habit.weekdays : [0, 1, 2, 3, 4, 5, 6],
    scheduleTime: habit.scheduleTime || '', reminderTime: habit.reminderTime || '',
    quickAdds: quickText,
    progressionEnabled: Boolean(habit.progressionEnabled),
    progressionAmount: field('progressionAmount', habit.progressionAmount),
    progressionInterval: habit.progressionInterval ? String(habit.progressionInterval) : '14',
    progressionUnit: habit.progressionUnit || 'days',
    _orig: orig,
  };
}

export function resolveUnit(form) {
  if (isCheckKind(form.trackingType)) return { unit: '', factor: 1 };
  const p = presetByKey(form.unitKey);
  return { unit: p.custom ? form.customUnit.trim() : p.unit, factor: p.factor };
}

function toBase(form, key, factor) {
  const text = String(form[key] === undefined || form[key] === null ? '' : form[key]).trim();
  if (text === '') return null;
  const o = form._orig && form._orig[key];
  if (o && o.text === text) return o.base;
  const n = Number(text);
  return Number.isFinite(n) ? roundBase(n * factor) : NaN;
}

function parseQuickAdds(form, factor) {
  const text = form.quickAdds.trim();
  if (!text) return [];
  const o = form._orig && form._orig.quickAdds;
  if (o && o.text === text) return o.base;
  return text.split(/[\s,]+/).filter(Boolean).map((s) => {
    const n = Number(s);
    return Number.isFinite(n) ? roundBase(n * factor) : NaN;
  });
}

export const showsMinTarget = (form) => !isCheckKind(form.trackingType) && form.goalDirection === D.INCREASE;

export function validateForm(form, { isNew, currentTarget }) {
  const e = {};
  const check = isCheckKind(form.trackingType);
  const { factor } = resolveUnit(form);

  if (!form.name.trim()) e.name = 'Enter a name';
  else if (form.name.trim().length > 60) e.name = 'Name is too long (max 60 characters)';
  if (form.categoryId === NEW_CATEGORY && !form.newCategoryName.trim()) e.newCategoryName = 'Enter a category name';
  if (!form.weekdays.length) e.weekdays = 'Pick at least one day';
  if (check) return e;

  if (presetByKey(form.unitKey).custom) {
    const u = form.customUnit.trim();
    if (!u) e.customUnit = 'Enter a unit';
    else if (isTimeUnit(u)) e.customUnit = 'For time, use the seconds / minutes / hours options';
  }

  let reference = currentTarget;
  if (isNew) {
    const target = toBase(form, 'target', factor);
    if (target === null || Number.isNaN(target) || target < 0) e.target = 'Enter a target (0 or more)';
    else if (target === 0 && form.trackingType !== T.LIMIT) e.target = 'Target must be greater than 0';
    reference = target;
  }

  if (showsMinTarget(form)) {
    const min = toBase(form, 'minTarget', factor);
    if (Number.isNaN(min) || (min !== null && min < 0)) e.minTarget = 'Enter a number (0 or more)';
    else if (min !== null && isNew && Number.isFinite(reference) && min > reference) e.minTarget = 'Minimum cannot exceed the target';
  }

  const quick = parseQuickAdds(form, factor);
  if (quick.length > 8) e.quickAdds = 'Up to 8 quick-add buttons';
  else if (quick.some((n) => !Number.isFinite(n) || n === 0)) e.quickAdds = 'Use numbers separated by commas, e.g. 1, 5, 10';

  if (form.progressionEnabled) {
    if (form.goalDirection !== D.INCREASE && form.goalDirection !== D.DECREASE) {
      e.goalDirection = 'Automatic progression needs Increase or Decrease';
    }
    const amount = toBase(form, 'progressionAmount', factor);
    if (amount === null || Number.isNaN(amount) || !(amount > 0)) e.progressionAmount = 'Enter an amount greater than 0';
    const interval = Number(form.progressionInterval);
    if (!Number.isInteger(interval) || interval < 1 || interval > 3650) e.progressionInterval = 'Enter a whole number, 1 or more';

    const end = toBase(form, 'endTarget', factor);
    if (Number.isNaN(end) || (end !== null && end < 0)) e.endTarget = 'Enter a number (0 or more)';
    else if (end !== null && Number.isFinite(reference)) {
      if (form.goalDirection === D.INCREASE && end < reference) e.endTarget = 'Final target must not be below the current target';
      if (form.goalDirection === D.DECREASE && end > reference) e.endTarget = 'Final target must not be above the current target';
    }
  }
  return e;
}

/** Validated form -> saveHabit payload (base units). startDate/startingTarget only on create. */
export function buildPayload(form, { isNew, habitId, categoryId }) {
  const type = form.trackingType;
  const check = isCheckKind(type);
  const { unit, factor } = resolveUnit(form);
  const payload = {
    name: form.name.trim(),
    icon: form.icon.trim() || '⭐',
    categoryId,
    description: form.description.trim(),
    trackingType: type,
    goalDirection: check ? (type === T.BOOLEAN ? D.INCREASE : D.AVOID) : form.goalDirection,
    unit,
    unitFactor: factor,
    minTarget: !check && showsMinTarget(form) ? toBase(form, 'minTarget', factor) : null,
    endTarget: !check && form.progressionEnabled ? toBase(form, 'endTarget', factor) : null,
    weekdays: form.weekdays,
    scheduleTime: form.scheduleTime,
    reminderTime: form.reminderTime,
    progressionEnabled: !check && form.progressionEnabled,
    progressionAmount: check ? null : toBase(form, 'progressionAmount', factor),
    progressionInterval: check || form.progressionInterval === '' ? null : Number(form.progressionInterval),
    progressionUnit: form.progressionUnit,
    quickAdds: check ? [] : parseQuickAdds(form, factor),
  };
  if (isNew) {
    payload.startDate = form.startDate;
    if (!check) payload.startingTarget = toBase(form, 'target', factor);
  } else {
    payload.habitId = habitId;
  }
  return payload;
}

/** Levels the progression will go through (null when not enough information yet). */
export function previewFromForm(form, { isNew, currentTarget }) {
  if (isCheckKind(form.trackingType) || !form.progressionEnabled) return null;
  if (form.goalDirection !== D.INCREASE && form.goalDirection !== D.DECREASE) return null;
  const { factor } = resolveUnit(form);
  const amount = toBase(form, 'progressionAmount', factor);
  const interval = Number(form.progressionInterval);
  const start = isNew ? toBase(form, 'target', factor) : currentTarget;
  if (!(amount > 0) || !Number.isInteger(interval) || interval < 1) return null;
  if (start === null || start === undefined || !Number.isFinite(start)) return null;
  const end = toBase(form, 'endTarget', factor);
  const habit = {
    goalDirection: form.goalDirection, progressionEnabled: true, progressionAmount: amount,
    progressionInterval: interval, progressionUnit: form.progressionUnit,
    endTarget: Number.isFinite(end) ? end : null,
  };
  return previewLevels(habit, isNew ? form.startDate : todayStr(), start, 5);
}