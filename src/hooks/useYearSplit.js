import { useCallback, useEffect, useState } from 'react';
import { getTotals } from '../api/entriesApi';
import { getMeta } from '../db/idb';
import { useAppState } from '../store/AppContext';
import { addDays } from '../utils/date';

const EMPTY = { total: 0, daysLogged: 0, bestDay: null, bestDate: null };

/**
 * The year splits into: [Jan 1 .. day before the local cache starts] from the server (one aggregate call),
 * and [cache start .. today] from local entries. Returns { status, pre, localFrom, retry }.
 */
export function useYearSplit(habitId, today) {
  const { sync } = useAppState();
  const yearStart = `${today.slice(0, 4)}-01-01`;
  const [cacheFrom, setCacheFrom] = useState(undefined);   // undefined = not read yet, null = unknown
  const [tick, setTick] = useState(0);
  const [result, setResult] = useState({ key: '', status: 'idle', pre: null });

  useEffect(() => {
    let alive = true;
    getMeta('cacheFrom')
      .then((v) => { if (alive) setCacheFrom(v || null); })
      .catch(() => { if (alive) setCacheFrom(null); });
    return () => { alive = false; };
  }, [sync.lastSyncAt]);

  const needsServer = Boolean(habitId) && Boolean(cacheFrom) && cacheFrom > yearStart;
  const key = `${habitId}|${yearStart}|${cacheFrom}|${tick}`;

  useEffect(() => {
    if (!needsServer) return undefined;
    let alive = true;
    getTotals({ from: yearStart, to: addDays(cacheFrom, -1) })
      .then((data) => {
        if (alive) setResult({ key, status: 'ok', pre: (data.habits && data.habits[habitId]) || EMPTY });
      })
      .catch(() => { if (alive) setResult({ key, status: 'error', pre: null }); });
    return () => { alive = false; };
  }, [needsServer, key, habitId, yearStart, cacheFrom]);

  const retry = useCallback(() => setTick((n) => n + 1), []);
  const localFrom = needsServer ? cacheFrom : yearStart;

  if (!needsServer) return { status: cacheFrom === undefined ? 'loading' : 'ok', pre: null, localFrom, retry };
  if (result.key === key) return { status: result.status, pre: result.pre, localFrom, retry };
  return { status: 'loading', pre: null, localFrom, retry };
}