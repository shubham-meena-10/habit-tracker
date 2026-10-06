import { request } from './api';

// Habit/target changes are online-only: the server validates them and returns the
// authoritative result, which the caller then writes into IndexedDB (Phase 5).
export const saveHabit = (habit) => request('saveHabit', { habit });
export const setHabitStatus = (habitId, status) => request('setHabitStatus', { habitId, status });
export const setTarget = ({ habitId, target, reason, effectiveDate }) =>
  request('setTarget', { habitId, target, reason, effectiveDate });
export const saveCategory = (category) => request('saveCategory', category);
export const getProgression = (params = {}) => request('getProgression', params);