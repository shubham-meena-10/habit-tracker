import { getDb } from './idb';

// Active timers live in the existing `meta` store (key "timer_<habitId>"): no schema change.
// They are device-local and are never synced to Google Sheets.
const PREFIX = 'timer_';
const listeners = new Set();
let channel = null;
try {
  if (typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel('habit-timers');
    channel.onmessage = () => listeners.forEach((fn) => fn());   // other tabs
  }
} catch { channel = null; }

function notify() {
  listeners.forEach((fn) => fn());
  if (channel) channel.postMessage('changed');
}

export function subscribeTimers(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Map(habitId -> timer) */
export async function loadTimers() {
  const rows = await (await getDb()).getAll('meta');
  const map = new Map();
  rows.forEach((r) => {
    if (typeof r.key === 'string' && r.key.startsWith(PREFIX) && r.value && r.value.habitId) {
      map.set(r.value.habitId, r.value);
    }
  });
  return map;
}

export async function saveTimer(timer) {
  await (await getDb()).put('meta', { key: PREFIX + timer.habitId, value: timer });
  notify();
}

export async function clearTimer(habitId) {
  await (await getDb()).delete('meta', PREFIX + habitId);
  notify();
}