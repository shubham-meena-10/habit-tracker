import { useCallback, useEffect, useMemo, useState } from 'react';
import { getEntries } from '../api/entriesApi';
import { getMeta } from '../db/idb';
import { useAppState } from '../store/AppContext';
import { addDays } from '../utils/date';

const CHUNK_DAYS = 700;          // the server allows up to 800 days per request
const EMPTY = [];
const remoteCache = new Map();   // key -> entries older than the local cache (they never change in the app)
export function clearHistoryCache() {
  remoteCache.clear();
}

async function fetchRange(habitId, from, to) {
  const out = [];
  let start = from;
  while (start <= to) {
    const cap = addDays(start, CHUNK_DAYS - 1);
    const end = cap < to ? cap : to;
    const res = await getEntries({ habitId: habitId || undefined, from: start, to: end });
    out.push(...res.entries);
    start = addDays(end, 1);
  }
  return out;
}

/**
 * Entries for [from, to]: local ones from the cache start onward, plus a server fetch for the
 * part before the cache. Returns { status: loading | ok | error, entries, retry }.
 * While loading or on error, `entries` holds the cached part only.
 */
export function useHistoryEntries({ habitId = null, from, to }) {
  const { entries, sync } = useAppState();
  const [cacheFrom, setCacheFrom] = useState(undefined);   // undefined = not read yet, null = unknown
  const [tick, setTick] = useState(0);
  const [remote, setRemote] = useState({ key: '', status: 'idle', entries: EMPTY });

  useEffect(() => {
    let alive = true;
    getMeta('cacheFrom')
      .then((v) => { if (alive) setCacheFrom(v || null); })
      .catch(() => { if (alive) setCacheFrom(null); });
    return () => { alive = false; };
  }, [sync.lastSyncAt]);

  const beforeCache = cacheFrom ? addDays(cacheFrom, -1) : null;
  const remoteTo = beforeCache && beforeCache < to ? beforeCache : to;
  const needsRemote = Boolean(cacheFrom) && from < cacheFrom && remoteTo >= from;
  const key = `${habitId || '*'}|${from}|${remoteTo}|${tick}`;

  useEffect(() => {
    if (!needsRemote || remoteCache.has(key)) return undefined;
    let alive = true;
    fetchRange(habitId, from, remoteTo)
      .then((list) => {
        remoteCache.set(key, list);
        if (alive) setRemote({ key, status: 'ok', entries: list });
      })
      .catch(() => { if (alive) setRemote({ key, status: 'error', entries: EMPTY }); });
    return () => { alive = false; };
  }, [needsRemote, key, habitId, from, remoteTo]);

  let status = 'ok';
  let remoteEntries = EMPTY;
  if (needsRemote) {
    const cached = remoteCache.get(key);
    if (cached) remoteEntries = cached;
    else if (remote.key === key) { status = remote.status; remoteEntries = remote.entries; }
    else status = 'loading';
  } else if (cacheFrom === undefined) {
    status = 'loading';
  }

  const merged = useMemo(() => {
    const lo = cacheFrom && cacheFrom > from ? cacheFrom : from;
    const local = entries.filter((e) => e.date >= lo && e.date <= to && (!habitId || e.habitId === habitId));
    return remoteEntries.length ? [...local, ...remoteEntries] : local;
  }, [entries, remoteEntries, cacheFrom, from, to, habitId]);

  const retry = useCallback(() => setTick((n) => n + 1), []);
//   return { status, entries: merged, retry };
  return { status, entries: merged, retry, cacheFrom: cacheFrom || null };
}