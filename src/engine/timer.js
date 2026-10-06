// Pure timer logic. All state is timestamps, so elapsed time is always derived
// from the clock and can't drift or freeze when the screen locks.
export const MAX_SESSION_MS = 16 * 3600 * 1000;

/**
 * targetSec: today's target for the habit; loggedSec: already logged for that day.
 * goalSec is the part still to do, snapshotted so later entries don't move it mid-session.
 */
export function newTimer({ habitId, date, targetSec, loggedSec, now }) {
  const target = Math.max(0, Math.round(targetSec));
  const logged = Math.max(0, Math.round(loggedSec));
  return {
    habitId, date, status: 'running', startedAt: now, accumulatedMs: 0, firstStartedAt: now,
    targetSec: target, loggedSec: logged, goalSec: Math.max(0, target - logged),
  };
}

export function elapsedMs(t, now) {
  const run = t.status === 'running' ? Math.max(0, now - t.startedAt) : 0;
  return t.accumulatedMs + run;
}

export function pauseTimer(t, now) {
  if (t.status !== 'running') return t;
  return { ...t, status: 'paused', accumulatedMs: elapsedMs(t, now), startedAt: null };
}

export function resumeTimer(t, now) {
  if (t.status !== 'paused') return t;
  return { ...t, status: 'running', startedAt: now };
}

/** Whole seconds to save for this session (clamped to MAX_SESSION_MS). */
export function sessionSeconds(t, now) {
  return Math.round(Math.min(elapsedMs(t, now), MAX_SESSION_MS) / 1000);
}

export function timerView(t, now) {
  const ms = elapsedMs(t, now);
  const elapsedSec = Math.floor(ms / 1000);
  const remainingMs = Math.max(0, t.goalSec * 1000 - ms);
  return {
    elapsedMs: ms,
    elapsedSec,
    remainingSec: Math.ceil(remainingMs / 1000),
    targetMet: remainingMs === 0,
    totalSec: t.loggedSec + elapsedSec,
    extraSec: Math.max(0, t.loggedSec + elapsedSec - t.targetSec),
  };
}

/**
 * byDate: Map(date -> {total, count}) for one habit (from buildDayTotals).
 * Best only considers days BEFORE `date`, so today's session can beat it.
 */
export function historyStats(byDate, date, yesterdayDate) {
  let best = null;
  if (byDate) {
    byDate.forEach((v, d) => {
      if (d < date && v.total > 0 && (!best || v.total > best.total)) best = { total: v.total, date: d };
    });
  }
  const y = byDate ? byDate.get(yesterdayDate) : null;
  return { yesterday: y && y.count > 0 ? y.total : null, best };
}