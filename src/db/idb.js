import { openDB } from 'idb';
import { newId } from '../utils/id';

const DB_NAME = 'habit-tracker';
const DB_VERSION = 1;
let dbPromise = null;

export function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore('habits', { keyPath: 'habitId' });
          db.createObjectStore('categories', { keyPath: 'categoryId' });
          db.createObjectStore('targetChanges', { keyPath: 'changeId' })
            .createIndex('by-habit', 'habitId');
          const entries = db.createObjectStore('entries', { keyPath: 'entryId' });
          entries.createIndex('by-habit', 'habitId');
          entries.createIndex('by-date', 'date');
          entries.createIndex('by-habit-date', ['habitId', 'date']);
          db.createObjectStore('dayStatus', { keyPath: 'date' });
          db.createObjectStore('settings', { keyPath: 'key' });
          db.createObjectStore('meta', { keyPath: 'key' });
          // Ordered by auto-increment `seq`; ops are replayed in this order.
          db.createObjectStore('queue', { keyPath: 'seq', autoIncrement: true });
          // Operations the server permanently rejected (kept so you can see why).
          db.createObjectStore('failed', { keyPath: 'seq', autoIncrement: true });
        }
        // Future schema changes: add `if (oldVersion < 2) { ... }` blocks here.
      },
    });
  }
  return dbPromise;
}

// ---------- meta ----------
export async function getMeta(key) {
  const row = await (await getDb()).get('meta', key);
  return row ? row.value : null;
}
export async function setMeta(key, value) {
  await (await getDb()).put('meta', { key, value });
}

let deviceIdPromise = null;
export function getDeviceId() {
  if (!deviceIdPromise) {
    deviceIdPromise = (async () => {
      let id = await getMeta('deviceId');
      if (!id) {
        id = newId('dev');
        await setMeta('deviceId', id);
      }
      return id;
    })();
  }
  return deviceIdPromise;
}

// ---------- read everything the UI needs ----------
export async function loadAll() {
  const db = await getDb();
  const [habits, categories, targetChanges, entries, dayStatus, settingRows] = await Promise.all([
    db.getAll('habits'),
    db.getAll('categories'),
    db.getAll('targetChanges'),
    db.getAll('entries'),
    db.getAll('dayStatus'),
    db.getAll('settings'),
  ]);
  const settings = {};
  settingRows.forEach((r) => { settings[r.key] = r.value; });
  return { habits, categories, targetChanges, entries, dayStatus, settings };
}

// ---------- local-first writes (data + queue op in ONE transaction) ----------
export async function saveEntryWithOp(entry, op) {
  const tx = (await getDb()).transaction(['entries', 'queue'], 'readwrite');
  await Promise.all([tx.objectStore('entries').put(entry), tx.objectStore('queue').add(op), tx.done]);
}

export async function deleteEntryWithOp(entryId, op) {
  const tx = (await getDb()).transaction(['entries', 'queue'], 'readwrite');
  await Promise.all([tx.objectStore('entries').delete(entryId), tx.objectStore('queue').add(op), tx.done]);
}

export async function enqueueOp(op) {
  await (await getDb()).add('queue', op);
}

// ---------- queue ----------
export async function peekQueue(limit) {
  return (await getDb()).getAll('queue', null, limit);
}

export async function getQueueStats() {
  const db = await getDb();
  const [pending, failed] = await Promise.all([db.count('queue'), db.count('failed')]);
  return { pending, failed };
}

/**
 * Remove finished ops from the queue. Rejected ops go to `failed`, and their
 * local entries are removed so the UI doesn't show data the server refused.
 */
export async function settleOps(removeSeqs, failedItems = [], dropEntryIds = []) {
  const tx = (await getDb()).transaction(['queue', 'failed', 'entries'], 'readwrite');
  const queue = tx.objectStore('queue');
  const failed = tx.objectStore('failed');
  const entries = tx.objectStore('entries');
  removeSeqs.forEach((s) => queue.delete(s));
  failedItems.forEach((f) => failed.add(f));
  dropEntryIds.forEach((id) => entries.delete(id));
  await tx.done;
}

export async function getFailed() {
  return (await getDb()).getAll('failed');
}
export async function clearFailed() {
  await (await getDb()).clear('failed');
}

// ---------- apply a server snapshot (bootstrap or pull) ----------
/**
 * A FULL snapshot replaces local server-owned data, but only when the queue is
 * empty (checked inside the same transaction), so pending local writes are never lost.
 * An INCREMENTAL snapshot is merged (upsert; deleted entries are removed).
 */
export async function applySnapshot(snap, { fromDate } = {}) {
  const db = await getDb();
  const tx = db.transaction(
    ['habits', 'categories', 'targetChanges', 'entries', 'dayStatus', 'settings', 'meta', 'queue'],
    'readwrite'
  );
  const habits = tx.objectStore('habits');
  const categories = tx.objectStore('categories');
  const targets = tx.objectStore('targetChanges');
  const entries = tx.objectStore('entries');
  const days = tx.objectStore('dayStatus');
  const settings = tx.objectStore('settings');
  const meta = tx.objectStore('meta');

  const pending = await tx.objectStore('queue').count();
  const replace = Boolean(snap.full) && pending === 0;

  if (replace) {
    await Promise.all([habits.clear(), categories.clear(), targets.clear(), days.clear(), settings.clear()]);
    if (fromDate) {
      let cursor = await entries.index('by-date').openCursor(IDBKeyRange.lowerBound(fromDate));
      while (cursor) {
        await cursor.delete();
        cursor = await cursor.continue();
      }
    }
  }

  const writes = [];
  (snap.categories || []).forEach((c) => writes.push(categories.put(c)));
  (snap.habits || []).forEach((h) => writes.push(habits.put(h)));
  (snap.targetChanges || []).forEach((t) => writes.push(targets.put(t)));
  (snap.dayStatus || []).forEach((d) => writes.push(days.put(d)));
  (snap.entries || []).forEach((e) => writes.push(e.deleted ? entries.delete(e.entryId) : entries.put(e)));
  Object.keys(snap.settings || {}).forEach((key) => writes.push(settings.put({ key, value: snap.settings[key] })));
  writes.push(meta.put({ key: 'lastSync', value: snap.serverTime }));
  if (snap.full && fromDate) writes.push(meta.put({ key: 'cacheFrom', value: fromDate }));

  await Promise.all(writes);
  await tx.done;
  return { replaced: replace, pending };
}

/** Write authoritative server results (online-only habit/target/category edits). */
export async function putServerRecords({ habits = [], targetChanges = [], categories = [] }) {
  const tx = (await getDb()).transaction(['habits', 'targetChanges', 'categories'], 'readwrite');
  habits.forEach((h) => tx.objectStore('habits').put(h));
  targetChanges.forEach((t) => tx.objectStore('targetChanges').put(t));
  categories.forEach((c) => tx.objectStore('categories').put(c));
  await tx.done;
}

/** Settings are written locally AND queued for sync in one transaction. */
export async function saveSettingsWithOp(settings, op) {
  const tx = (await getDb()).transaction(['settings', 'queue'], 'readwrite');
  Object.keys(settings).forEach((key) => tx.objectStore('settings').put({ key, value: String(settings[key]) }));
  await Promise.all([tx.objectStore('queue').add(op), tx.done]);
}

/**
 * Closes or reopens a day locally AND queues the sync op, in one transaction.
 * Existing notes are kept. Returns the stored day.
 */
export async function saveDayWithOp(date, closed, op) {
  const tx = (await getDb()).transaction(['dayStatus', 'queue'], 'readwrite');
  const store = tx.objectStore('dayStatus');
  const old = await store.get(date);
  const now = new Date().toISOString();
  const day = {
    date,
    closed,
    closedAt: closed ? (old && old.closed && old.closedAt ? old.closedAt : now) : '',
    notes: old ? old.notes || '' : '',
    updatedAt: now,
  };
  await Promise.all([store.put(day), tx.objectStore('queue').add(op), tx.done]);
  return day;
}

/**
 * Empties the cached server data so the next full sync re-downloads it.
 * The sync queue, rejected-operations list, device id and running timers are kept.
 */
export async function clearLocalCache() {
  const stores = ['habits', 'categories', 'targetChanges', 'entries', 'dayStatus', 'settings'];
  const tx = (await getDb()).transaction([...stores, 'meta'], 'readwrite');
  const meta = tx.objectStore('meta');
  await Promise.all([
    ...stores.map((s) => tx.objectStore(s).clear()),
    ...['lastSync', 'cacheFrom', 'remindersSent'].map((k) => meta.delete(k)),
    tx.done,
  ]);
}



/**
 * Wipes EVERYTHING on this device: cached data, the sync queue, rejected ops, timers, reminder history.
 * Kept: deviceId, API token, reminders on/off switch.
 */
export async function clearEverythingLocal() {
  const db = await getDb();
  const stores = ['habits', 'categories', 'targetChanges', 'entries', 'dayStatus', 'settings', 'queue', 'failed'];
  const keep = new Set(['deviceId', 'apiToken', 'remindersOn']);
  const tx = db.transaction([...stores, 'meta'], 'readwrite');
  const meta = tx.objectStore('meta');
  const keys = await meta.getAllKeys();
  await Promise.all([
    ...stores.map((s) => tx.objectStore(s).clear()),
    ...keys.filter((k) => !keep.has(k)).map((k) => meta.delete(k)),
    tx.done,
  ]);
}