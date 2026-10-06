import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import * as db from "../db/idb";
import * as dashboardApi from "../api/dashboardApi";
import { requestSync } from "../services/syncService";
import { createEntry, entryToWire } from "../services/entryService";
import * as habitsApi from "../api/habitsApi";
import { newId } from "../utils/id";

const AppStateContext = createContext(null);
const AppActionsContext = createContext(null);

const BACKOFF_MS = [5000, 15000, 60000, 300000];
const MIN_FOCUS_SYNC_GAP_MS = 30000;

const initialState = {
  ready: false,
  habits: [],
  categories: [],
  targetChanges: [],
  entries: [],
  dayStatus: [],
  settings: {},
  sync: { phase: "idle", pending: 0, failed: 0, lastSyncAt: null, error: null },
};

function reducer(state, action) {
  switch (action.type) {
    case "LOADED":
      return { ...state, ...action.data, ready: true };
    case "LOAD_FAILED":
      return {
        ...state,
        ready: true,
        sync: { ...state.sync, phase: "error", error: action.message },
      };
    case "ENTRY_UPSERT": {
      const i = state.entries.findIndex(
        (e) => e.entryId === action.entry.entryId,
      );
      const entries =
        i >= 0
          ? state.entries.map((e, idx) => (idx === i ? action.entry : e))
          : [...state.entries, action.entry];
      return { ...state, entries };
    }
    case "ENTRY_REMOVE":
      return {
        ...state,
        entries: state.entries.filter((e) => e.entryId !== action.entryId),
      };
    case "SYNC":
      return { ...state, sync: { ...state.sync, ...action.patch } };
    case "SETTINGS_PATCH":
      return { ...state, settings: { ...state.settings, ...action.patch } };
    case "DAY_UPSERT": {
      const i = state.dayStatus.findIndex((d) => d.date === action.day.date);
      const dayStatus =
        i >= 0
          ? state.dayStatus.map((d, idx) => (idx === i ? action.day : d))
          : [...state.dayStatus, action.day];
      return { ...state, dayStatus };
    }
    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const timers = useRef({ retry: null, soon: null });
  const attempt = useRef(0);
  const lastRun = useRef(0);
  const mutations = useRef(0); // bumps on every local write; lets reload() detect a race
  const runSyncRef = useRef(null);

  const refreshCounts = useCallback(async () => {
    try {
      const { pending, failed } = await db.getQueueStats();
      dispatch({ type: "SYNC", patch: { pending, failed } });
    } catch {
      /* ignore */
    }
  }, []);

  /** Reload everything from IndexedDB; retries if a local write happened while reading. */
  const reload = useCallback(async () => {
    for (let i = 0; i < 3; i++) {
      const v = mutations.current;
      const data = await db.loadAll();
      if (v === mutations.current || i === 2) {
        dispatch({ type: "LOADED", data });
        return;
      }
    }
  }, []);

  const runSync = useCallback(
    async ({ full = false } = {}) => {
      clearTimeout(timers.current.retry);
      lastRun.current = Date.now();
      dispatch({ type: "SYNC", patch: { phase: "syncing" } });

      const result = await requestSync({ forceFull: full });
      try {
        await reload();
      } catch {
        /* keep current state */
      }
      const counts = await db.getQueueStats().catch(() => ({}));

      if (result.ok) {
        attempt.current = 0;
        dispatch({
          type: "SYNC",
          patch: {
            phase: "idle",
            error: null,
            lastSyncAt: new Date().toISOString(),
            ...counts,
          },
        });
      } else if (result.phase === "offline") {
        dispatch({
          type: "SYNC",
          patch: { phase: "offline", error: null, ...counts },
        });
      } else {
        dispatch({
          type: "SYNC",
          patch: { phase: "error", error: result.message, ...counts },
        });
        if (result.retryable) {
          const delay =
            BACKOFF_MS[Math.min(attempt.current, BACKOFF_MS.length - 1)];
          attempt.current += 1;
          timers.current.retry = setTimeout(
            () => runSyncRef.current && runSyncRef.current(),
            delay,
          );
        }
      }
      return result;
    },
    [reload],
  );
  runSyncRef.current = runSync;

  const scheduleSync = useCallback(() => {
    clearTimeout(timers.current.soon);
    timers.current.soon = setTimeout(
      () => runSyncRef.current && runSyncRef.current(),
      800,
    );
  }, []);

  // ---------- startup: show cached data instantly, then sync in the background ----------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await reload();
        await refreshCounts();
        const lastSync = await db.getMeta("lastSync");
        if (!cancelled && lastSync)
          dispatch({ type: "SYNC", patch: { lastSyncAt: lastSync } });
      } catch (err) {
        console.error(err);
        if (!cancelled)
          dispatch({
            type: "LOAD_FAILED",
            message: "Local storage is unavailable in this browser mode.",
          });
        return;
      }
      if (!cancelled) runSyncRef.current();
    })();

    const onOnline = () => runSyncRef.current();
    const onOffline = () => {
      dispatch({ type: "SYNC", patch: { phase: "offline" } });
      refreshCounts();
    };
    const onVisible = () => {
      if (
        document.visibilityState === "visible" &&
        Date.now() - lastRun.current > MIN_FOCUS_SYNC_GAP_MS
      ) {
        runSyncRef.current();
      }
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisible);
    const t = timers.current;
    return () => {
      cancelled = true;
      clearTimeout(t.retry);
      clearTimeout(t.soon);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [reload, refreshCounts]);

  // ---------- actions (stable identity) ----------
  const actions = useMemo(
    () => ({
      /** One-tap logging: persists locally + queues for sync, UI updates immediately. */
      async addEntry(habit, delta, opts = {}) {
        const deviceId = await db.getDeviceId();
        const entry = createEntry({ habit, delta, deviceId, ...opts });
        const op = {
          opId: newId("op"),
          type: "addEntry",
          payload: entryToWire(entry),
          createdAt: entry.createdAt,
        };
        await db.saveEntryWithOp(entry, op);
        mutations.current += 1;
        dispatch({ type: "ENTRY_UPSERT", entry });
        refreshCounts();
        scheduleSync();
        return entry;
      },

      async removeEntry(entryId) {
        const op = {
          opId: newId("op"),
          type: "deleteEntry",
          payload: { entryId },
          createdAt: new Date().toISOString(),
        };
        await db.deleteEntryWithOp(entryId, op);
        mutations.current += 1;
        dispatch({ type: "ENTRY_REMOVE", entryId });
        refreshCounts();
        scheduleSync();
      },

      /** Local-first settings change: stored now, synced in the background. Values are saved as text. */
      async saveSettings(patch) {
        const clean = {};
        Object.keys(patch).forEach((k) => {
          clean[k] = String(patch[k]);
        });
        const op = {
          opId: newId("op"),
          type: "saveSettings",
          payload: { settings: clean },
          createdAt: new Date().toISOString(),
        };
        await db.saveSettingsWithOp(clean, op);
        mutations.current += 1;
        dispatch({ type: "SETTINGS_PATCH", patch: clean });
        refreshCounts();
        scheduleSync();
      },

      /** Local-first: closes (or reopens) a day. Stored now, synced in the background. */
      async closeDay(date, closed = true) {
        const op = {
          opId: newId("op"),
          type: "closeDay",
          payload: { date, closed },
          createdAt: new Date().toISOString(),
        };
        const day = await db.saveDayWithOp(date, closed, op);
        mutations.current += 1;
        dispatch({ type: "DAY_UPSERT", day });
        refreshCounts();
        scheduleSync();
        return day;
      },

      syncNow: (full = false) => runSyncRef.current({ full }),

      async testConnection() {
        const t0 = performance.now();
        const data = await dashboardApi.ping();
        return { ...data, latencyMs: Math.round(performance.now() - t0) };
      },

      getFailed: () => db.getFailed(),
      async clearFailed() {
        await db.clearFailed();
        await refreshCounts();
      },
      // ----- online-only edits: the server validates, then we store its authoritative result -----
      async saveHabit(habit) {
        const res = await habitsApi.saveHabit(habit);
        await db.putServerRecords({
          habits: [res.habit],
          targetChanges: res.targetChanges,
        });
        await reload();
        scheduleSync();
        return res;
      },

      async setHabitStatus(habitId, status) {
        const res = await habitsApi.setHabitStatus(habitId, status);
        await db.putServerRecords({
          habits: [res.habit],
          targetChanges: res.targetChanges,
        });
        await reload();
        scheduleSync();
        return res;
      },

      async setTarget(params) {
        const res = await habitsApi.setTarget(params);
        await db.putServerRecords({ targetChanges: [res.anchor] });
        await reload();
        scheduleSync();
        return res;
      },

      async saveCategory(category) {
        const res = await habitsApi.saveCategory(category);
        await db.putServerRecords({ categories: [res.category] });
        await reload();
        return res;
      },
    }),
    [refreshCounts, scheduleSync, reload],
  );

  return (
    <AppStateContext.Provider value={state}>
      <AppActionsContext.Provider value={actions}>
        {children}
      </AppActionsContext.Provider>
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used inside <AppProvider>");
  return ctx;
}

export function useAppActions() {
  const ctx = useContext(AppActionsContext);
  if (!ctx) throw new Error("useAppActions must be used inside <AppProvider>");
  return ctx;
}
