// import PageHeader from '../components/common/PageHeader';
// import { CONFIG, isApiConfigured } from '../config';
// import { todayStr } from '../utils/date';

// export default function SettingsPage() {
//   return (
//     <>
//       <PageHeader title="Settings" />
//       <section className="card">
//         <h2>Diagnostics</h2>
//         <dl className="kv">
//           <dt>Timezone</dt>
//           <dd>{CONFIG.TIMEZONE}</dd>
//           <dt>Today (local)</dt>
//           <dd>{todayStr()}</dd>
//           <dt>API configured</dt>
//           <dd>{isApiConfigured() ? 'Yes' : 'No — set VITE_GOOGLE_APPS_SCRIPT_URL in .env'}</dd>
//         </dl>
//       </section>
//     </>
//   );
// }



import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/common/PageHeader';
import { CONFIG, isApiConfigured } from '../config';
import { todayStr } from '../utils/date';
import { describeError } from '../api/api';
import { useAppState, useAppActions } from '../store/AppContext';
import EngineTests from '../components/settings/EngineTests';
import WaterSettings from '../components/settings/WaterSettings';
import DaySettings from '../components/settings/DaySettings';

export default function SettingsPage() {
  const { habits, entries, sync } = useAppState();
  const actions = useAppActions();
  const [test, setTest] = useState({ state: 'idle' });
  const [failedList, setFailedList] = useState([]);
  const [devHabitId, setDevHabitId] = useState('');
  const [devError, setDevError] = useState('');

  useEffect(() => {
    let alive = true;
    actions.getFailed().then((l) => { if (alive) setFailedList(l); }).catch(() => {});
    return () => { alive = false; };
  }, [actions, sync.failed]);

  const sorted = useMemo(
    () => habits.filter((h) => h.status !== 'archived').sort((a, b) => a.sortOrder - b.sortOrder),
    [habits]
  );
  const nameById = useMemo(() => new Map(habits.map((h) => [h.habitId, h.name])), [habits]);
  const recent = useMemo(
    () => [...entries].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 5),
    [entries]
  );
  const selected = sorted.find((h) => h.habitId === devHabitId) || sorted[0];

  async function runTest() {
    setTest({ state: 'loading' });
    try {
      setTest({ state: 'ok', result: await actions.testConnection() });
    } catch (err) {
      setTest({ state: 'error', message: describeError(err) });
    }
  }

  async function addTestEntry() {
    setDevError('');
    try {
      await actions.addEntry(selected, 1, { source: 'manual', note: 'phase-4 test' });
    } catch (err) {
      setDevError(err.message);
    }
  }

  const fmt = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { timeZone: CONFIG.TIMEZONE }) : 'never');

  return (
    <>
      <PageHeader title="Settings" />
      <EngineTests />
      <WaterSettings />
      <DaySettings />

      <section className="card">
        <h2>Diagnostics</h2>
        <dl className="kv">
          <dt>Timezone</dt><dd>{CONFIG.TIMEZONE}</dd>
          <dt>Today (local)</dt><dd>{todayStr()}</dd>
          <dt>API configured</dt>
          <dd>{isApiConfigured() ? 'Yes' : 'No — set VITE_GOOGLE_APPS_SCRIPT_URL and VITE_API_TOKEN in .env'}</dd>
        </dl>
      </section>

      <section className="card">
        <h2>Sync &amp; connection</h2>
        <dl className="kv">
          <dt>Status</dt><dd>{sync.phase}</dd>
          <dt>Last sync</dt><dd>{fmt(sync.lastSyncAt)}</dd>
          <dt>Waiting to sync</dt><dd>{sync.pending}</dd>
          <dt>Rejected by server</dt><dd>{sync.failed}</dd>
          {sync.error && (<><dt>Last error</dt><dd className="text-danger">{sync.error}</dd></>)}
        </dl>
        <div className="btn-row">
          <button className="btn" onClick={runTest} disabled={test.state === 'loading'}>
            {test.state === 'loading' ? 'Testing…' : 'Test connection'}
          </button>
          <button className="btn" onClick={() => actions.syncNow(false)} disabled={sync.phase === 'syncing'}>Sync now</button>
          <button className="btn" onClick={() => actions.syncNow(true)} disabled={sync.phase === 'syncing'}>Full resync</button>
        </div>

        {test.state === 'ok' && (
          <p role="status">
            ✅ Connected in {test.result.latencyMs} ms · server date {test.result.today} ({test.result.timezone}) ·{' '}
            {test.result.schemaOk
              ? 'sheet structure OK'
              : `⚠️ sheet problem — missing: ${test.result.missingSheets.join(', ') || 'none'}; bad headers: ${test.result.badHeaders.join(', ') || 'none'}`}
          </p>
        )}
        {test.state === 'error' && <p className="text-danger" role="alert">❌ {test.message}</p>}

        {failedList.length > 0 && (
          <>
            <h3 className="small-title">Rejected operations</h3>
            <ul className="plain-list">
              {failedList.map((f) => (
                <li key={f.seq} className="small">
                  <strong>{f.op.type}</strong> — {f.error}
                </li>
              ))}
            </ul>
            <button className="btn btn--small" onClick={() => actions.clearFailed()}>Clear</button>
          </>
        )}
      </section>

      <section className="card">
        <h2>Developer tools <span className="tag">temporary</span></h2>
        <p className="muted small">
          Writes real rows to your Sheet to test the queue. Remove them afterwards with Delete (soft-deleted, ignored in totals).
        </p>
        {sorted.length > 0 && (
          <div className="btn-row">
            <select
              className="input"
              aria-label="Habit"
              value={selected ? selected.habitId : ''}
              onChange={(e) => setDevHabitId(e.target.value)}
            >
              {sorted.map((h) => (<option key={h.habitId} value={h.habitId}>{h.icon} {h.name}</option>))}
            </select>
            <button className="btn btn--primary" onClick={addTestEntry}>Add +1 test entry</button>
          </div>
        )}
        {devError && <p className="text-danger" role="alert">{devError}</p>}

        {recent.length > 0 && (
          <ul className="plain-list">
            {recent.map((e) => (
              <li key={e.entryId} className="entry-row">
                <span className="small">
                  {nameById.get(e.habitId) || e.habitId} · {e.date} · <strong>{e.delta > 0 ? '+' : ''}{e.delta}</strong>
                </span>
                <button className="btn btn--small" onClick={() => actions.removeEntry(e.entryId)}>Delete</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}