import { getMeta, setMeta } from '../db/idb';

const BASE =  '/';

// ----- device-local on/off switch -----
export async function isRemindersOn() {
  return (await getMeta('remindersOn')) === true;
}
export async function setRemindersOn(on) {
  await setMeta('remindersOn', Boolean(on));
  window.dispatchEvent(new Event('reminders-changed'));
}

export const notificationState = () =>
  typeof window === 'undefined' || !('Notification' in window) ? 'unsupported' : Notification.permission;

// ----- once-per-day claims (persisted, so refreshes and extra tabs don't repeat a reminder) -----
let current = { date: '', keys: new Set(), loading: null };

function ensure(today) {
  if (current.date === today && current.loading) return current.loading;
  const keys = new Set();
  current = {
    date: today,
    keys,
    loading: getMeta('remindersSent')
      .then((v) => { if (v && v.date === today) v.keys.forEach((k) => keys.add(k)); })
      .catch(() => {}),
  };
  return current.loading;
}

/** Returns the keys that were not claimed before. Filtering and adding are synchronous, so callers can't race. */
export async function claimKeys(today, wanted) {
  await ensure(today);
  if (current.date !== today) return [];
  const fresh = wanted.filter((k) => !current.keys.has(k));
  fresh.forEach((k) => current.keys.add(k));
  if (fresh.length) setMeta('remindersSent', { date: today, keys: [...current.keys] }).catch(() => {});
  return fresh;
}

// ----- delivery -----
async function showSystem(r) {
  const options = {
    body: r.body,
    tag: r.key,
    icon: `${BASE}pwa-192x192.png`,
    badge: `${BASE}pwa-64x64.png`,
    data: { url: r.url || '#/' },
  };
  const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
  if (reg && reg.showNotification) return reg.showNotification(r.title, options);   // required on Android and iOS
  return new Notification(r.title, options);
}

/** System notification when permitted, otherwise an in-app banner (see ReminderManager). */
export async function deliverReminder(r) {
  if (notificationState() === 'granted') {
    try { await showSystem(r); return 'system'; } catch (err) { console.warn('Notification failed', err); }
  }
  window.dispatchEvent(new CustomEvent('app-reminder', { detail: r }));
  return 'banner';
}