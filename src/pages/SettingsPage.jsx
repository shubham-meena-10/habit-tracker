import { useEffect, useState } from 'react';
import PageHeader from '../components/common/PageHeader';
import ProfileSettings from '../components/settings/ProfileSettings';
import WaterSettings from '../components/settings/WaterSettings';
import DaySettings from '../components/settings/DaySettings';
import InstallCard from '../components/settings/InstallCard';
import ReminderSettings from '../components/settings/ReminderSettings';
import DataSettings from '../components/settings/DataSettings';
import AccessSettings from '../components/settings/AccessSettings';
import EngineTests from '../components/settings/EngineTests';
import { CONFIG, isApiConfigured } from '../config';
import { describeError } from '../api/api';
import { todayStr } from '../utils/date';
import { useAppState, useAppActions } from '../store/AppContext';
import DangerSettings from '../components/settings/DangerSettings';

function apiHost() {
  try { return new URL(CONFIG.API_URL).host; } catch { return 'not set'; }
}

export default function SettingsPage() {
  const { sync } = useAppState();
  const actions = useAppActions();
  const [test, setTest] = useState({ state: 'idle' });
  const [failedList, setFailedList] = useState([]);

  useEffect(() => {
    let alive = true;
    actions.getFailed().then((l) => { if (alive) setFailedList(l); }).catch(() => {});
    return () => { alive = false; };
  }, [actions, sync.failed]);

  async function runTest() {
    setTest({ state: 'loading' });
    try {
      setTest({ state: 'ok', result: await actions.testConnection() });
    } catch (err) {
      setTest({ state: 'error', message: describeError(err) });
    }
  }

  const fmt = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { timeZone: CONFIG.TIMEZONE }) : 'never');

  return (
    <>
      <PageHeader title="Settings" />
      <ProfileSettings />
      <WaterSettings />
      <DaySettings />
      <InstallCard />
      <ReminderSettings />
      <DataSettings />
      <AccessSettings />
      <DangerSettings />

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
                <li key={f.seq} className="small"><strong>{f.op.type}</strong> — {f.error}</li>
              ))}
            </ul>
            <button className="btn btn--small" onClick={() => actions.clearFailed()}>Clear</button>
          </>
        )}
      </section>

      <section className="card">
        <h2>About</h2>
        <dl className="kv">
          <dt>Timezone</dt><dd>{CONFIG.TIMEZONE} <span className="muted small">(set at build time)</span></dd>
          <dt>Today (local)</dt><dd>{todayStr()}</dd>
          <dt>Server</dt><dd>{apiHost()}</dd>
          <dt>Connected</dt><dd>{isApiConfigured() ? 'Yes' : 'No: see Access above'}</dd>
        </dl>
      </section>

      <EngineTests />
    </>
  );
}
