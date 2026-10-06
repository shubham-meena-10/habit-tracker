import { newTimer, pauseTimer, resumeTimer } from '../engine/timer';
import { clearTimer, saveTimer } from '../db/timers';

export async function startSession({ habit, date, targetSec, loggedSec }) {
  const timer = newTimer({ habitId: habit.habitId, date, targetSec, loggedSec, now: Date.now() });
  await saveTimer(timer);
  return timer;
}
export const pauseSession = (timer) => saveTimer(pauseTimer(timer, Date.now()));
export const resumeSession = (timer) => saveTimer(resumeTimer(timer, Date.now()));
export const discardSession = (habitId) => clearTimer(habitId);