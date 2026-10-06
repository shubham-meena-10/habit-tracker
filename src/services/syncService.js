import { ApiError } from '../api/api';
import * as dashboardApi from '../api/dashboardApi';
import * as entriesApi from '../api/entriesApi';
import { CONFIG } from '../config';
import { applySnapshot, getMeta, peekQueue, settleOps } from '../db/idb';
import { addDays } from '../utils/date';

// Handlers for single (non-batched) operations. All are idempotent on the server.
const HANDLERS = {
  deleteEntry: (op) => entriesApi.deleteEntry(op.payload.entryId, op.opId),
  closeDay: (op) => entriesApi.closeDay(op.payload, op.opId),
  saveSettings: (op) => dashboardApi.saveSettings(op.payload.settings, op.opId),
};

const failedItem = (op, message) => ({ op, error: message, at: new Date().toISOString() });

// ---------- push ----------
async function pushEntryGroup(group) {
  // Same entryId twice in one batch → the server would drop the second. Keep the latest.
  const latest = new Map();
  group.forEach((op) => latest.set(op.payload.entryId, op));
  const entries = [...latest.values()].map((op) => op.payload);

  let data;
  try {
    data = await entriesApi.addEntries(entries);
  } catch (err) {
    if (err instanceof ApiError && err.kind === 'client') {
      // Whole request rejected permanently → dead-letter the group.
      await settleOps(
        group.map((o) => o.seq),
        group.map((o) => failedItem(o, err.message)),
        entries.map((e) => e.entryId)
      );
      return;
    }
    throw err; // network / server / auth / config → stop, keep the queue
  }

  const rejected = new Map(); // entryId -> message
  (data.results || []).forEach((r) => {
    if (r.status === 'error') rejected.set(r.entryId, r.error || 'Rejected by server');
  });
  const failed = group.filter((o) => rejected.has(o.payload.entryId))
    .map((o) => failedItem(o, rejected.get(o.payload.entryId)));
  await settleOps(group.map((o) => o.seq), failed, [...rejected.keys()]);
}

async function pushSingle(op) {
  const handler = HANDLERS[op.type];
  if (!handler) {
    await settleOps([op.seq], [failedItem(op, 'Unknown operation type: ' + op.type)]);
    return;
  }
  try {
    await handler(op);
    await settleOps([op.seq]);
  } catch (err) {
    if (!(err instanceof ApiError) || err.kind !== 'client') throw err;
    // Deleting something the server never had is already "done".
    if (op.type === 'deleteEntry' && err.status === 404) await settleOps([op.seq]);
    else await settleOps([op.seq], [failedItem(op, err.message)]);
  }
}

async function pushQueue() {
  let pushed = 0;
  for (;;) {
    const ops = await peekQueue(CONFIG.SYNC_BATCH_SIZE);
    if (!ops.length) return pushed;
    if (ops[0].type === 'addEntry') {
      const group = [];
      for (const op of ops) {
        if (op.type !== 'addEntry') break;
        group.push(op);
      }
      await pushEntryGroup(group);
      pushed += group.length;
    } else {
      await pushSingle(ops[0]);
      pushed += 1;
    }
    // Every branch above either removes the op(s) or throws, so this loop always progresses.
  }
}

// ---------- pull ----------
async function pullChanges(forceFull) {
  const lastSync = await getMeta('lastSync');
  if (forceFull || !lastSync) {
    const days = CONFIG.BOOTSTRAP_DAYS;
    const snap = await dashboardApi.bootstrap({ days });
    return applySnapshot(snap, { fromDate: addDays(snap.today, -days) });
  }
  // Overlap by 5 s to be safe against clock skew; merges are idempotent.
  const since = new Date(Date.parse(lastSync) - 5000).toISOString();
  return applySnapshot(await dashboardApi.pull(since));
}

// ---------- one sync pass ----------
async function syncOnce({ forceFull }) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { ok: false, phase: 'offline', retryable: false, message: 'You are offline.' };
  }
  try {
    const pushed = await pushQueue();
    const pulled = await pullChanges(forceFull);
    return { ok: true, phase: 'idle', pushed, pulled };
  } catch (err) {
    if (err instanceof ApiError) {
      return {
        ok: false,
        phase: err.code === 'OFFLINE' ? 'offline' : 'error',
        retryable: err.retryable,
        kind: err.kind,
        message: err.message,
      };
    }
    console.error(err);
    return { ok: false, phase: 'error', retryable: false, message: 'Unexpected sync error.' };
  }
}

// ---------- single-flight wrapper ----------
let inFlight = null;
let rerun = false;
let rerunFull = false;

/** Safe to call from anywhere, any number of times: overlapping calls share one run. */
export function requestSync({ forceFull = false } = {}) {
  if (inFlight) {
    rerun = true;
    rerunFull = rerunFull || forceFull;
    return inFlight;
  }
  inFlight = (async () => {
    let full = forceFull;
    let result;
    do {
      rerun = false;
      result = await syncOnce({ forceFull: full });
      full = rerunFull;
      rerunFull = false;
    } while (rerun && result.ok);
    return result;
  })().finally(() => { inFlight = null; });
  return inFlight;
}