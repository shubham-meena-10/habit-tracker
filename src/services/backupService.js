import { ApiError } from '../api/api';
import { addEntries } from '../api/entriesApi';
import { exportAll, importStructure } from '../api/dashboardApi';
import { loadAll } from '../db/idb';
import { clearHistoryCache } from '../hooks/useHistoryEntries';

/** Full backup from the Sheet. Offline, falls back to this device's cache (and says so in `source`). */
export async function buildBackup() {
  try {
    const data = await exportAll();
    return {
      app: 'habit-tracker', format: 1, source: 'server',
      exportedAt: data.exportedAt, schemaVersion: data.schemaVersion, tables: data.tables,
    };
  } catch (err) {
    if (!(err instanceof ApiError) || err.kind !== 'network') throw err;
    const local = await loadAll();
    return {
      app: 'habit-tracker', format: 1, source: 'local-cache', exportedAt: new Date().toISOString(), schemaVersion: 1,
      tables: {
        settings: local.settings, categories: local.categories, habits: local.habits,
        targetChanges: local.targetChanges, entries: local.entries, dayStatus: local.dayStatus,
      },
    };
  }
}

const BATCH = 100;
const pick = (e) => ({
  entryId: e.entryId, habitId: e.habitId, date: e.date, delta: e.delta, source: e.source,
  durationSec: e.durationSec, note: e.note, createdAt: e.createdAt, deviceId: e.deviceId,
});

/** Additive import. onProgress({ done, total }) is called while entries are sent. */
export async function importBackup(tables, onProgress = () => {}) {
  const structure = await importStructure({
    categories: tables.categories || [],
    habits: tables.habits || [],
    targetChanges: tables.targetChanges || [],
    dayStatus: tables.dayStatus || [],
  });

  const entries = (tables.entries || []).filter((e) => e && !e.deleted).map(pick);
  const totals = { created: 0, updated: 0, duplicate: 0, error: 0 };
  const problems = [...(structure.errors || [])];
  onProgress({ done: 0, total: entries.length });

  for (let i = 0; i < entries.length; i += BATCH) {
    const res = await addEntries(entries.slice(i, i + BATCH));
    Object.keys(totals).forEach((k) => { totals[k] += (res.counts && res.counts[k]) || 0; });
    (res.results || []).forEach((r) => {
      if (r.status === 'error' && problems.length < 20) problems.push(`entry ${r.entryId}: ${r.error}`);
    });
    onProgress({ done: Math.min(i + BATCH, entries.length), total: entries.length });
  }
  clearHistoryCache();
  return { structure: structure.counts, entries: totals, problems };
}