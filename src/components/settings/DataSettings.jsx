import { useRef, useState } from 'react';
import { describeError } from '../../api/api';
import { useAppState, useAppActions } from '../../store/AppContext';
import { buildBackup, importBackup } from '../../services/backupService';
import { entriesCsv, habitsCsv, parseBackup } from '../../utils/backupFormat';
import { saveTextFile } from '../../utils/download';
import { formatShortDate, todayStr } from '../../utils/date';

export default function DataSettings() {
  const { sync } = useAppState();
  const actions = useAppActions();
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);
  const [preview, setPreview] = useState(null);
  const [progress, setProgress] = useState('');
  const fileRef = useRef(null);

  async function exportAs(kind) {
    setBusy(kind);
    setMsg(null);
    try {
      const backup = await buildBackup();
      const stamp = todayStr();
      let outcome;
      if (kind === 'json') outcome = await saveTextFile(`habit-backup-${stamp}.json`, JSON.stringify(backup, null, 2), 'application/json');
      else if (kind === 'entries') outcome = await saveTextFile(`habit-entries-${stamp}.csv`, entriesCsv(backup.tables), 'text/csv');
      else outcome = await saveTextFile(`habit-habits-${stamp}.csv`, habitsCsv(backup.tables), 'text/csv');
      if (outcome === 'cancelled') return;
      setMsg({
        ok: backup.source === 'server'
          ? 'Exported all your data from the Sheet.'
          : 'You are offline, so this export only contains what is cached on this device (about 90 days of entries).',
      });
    } catch (err) {
      setMsg({ err: describeError(err) });
    } finally {
      setBusy('');
    }
  }

  async function chooseFile(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    setMsg(null);
    setPreview(null);
    if (!file) return;
    try {
      setPreview({ name: file.name, parsed: parseBackup(await file.text()) });
    } catch (err) {
      setMsg({ err: err.message });
    }
  }

  async function runImport() {
    if (!preview) return;
    if (!window.confirm('Import this backup? It only adds what is missing and never overwrites or deletes anything.')) return;
    setBusy('import');
    setMsg(null);
    try {
      const res = await importBackup(preview.parsed.tables, ({ done, total }) => setProgress(`Importing entries… ${done} / ${total}`));
      await actions.syncNow(true);
      const s = res.structure;
      const added = (k) => (s[k] ? s[k].added : 0);
      setPreview(null);
      setMsg({
        ok: `Added ${added('habits')} habits, ${added('categories')} categories, ${added('targetChanges')} target changes, ${added('dayStatus')} days and ${res.entries.created} entries. ` +
          `${res.entries.duplicate} entries were already there.`,
        problems: res.problems,
      });
    } catch (err) {
      setMsg({ err: describeError(err) });
    } finally {
      setBusy('');
      setProgress('');
    }
  }

  async function resetCache() {
    const waiting = sync.pending > 0 ? ` ${sync.pending} unsynced action${sync.pending === 1 ? '' : 's'} will be kept and sent first.` : '';
    if (!window.confirm(`Clear the data cached on this device and download it again from your Sheet?${waiting}`)) return;
    setBusy('reset');
    setMsg(null);
    try {
      const result = await actions.resetLocalCache();
      setMsg(result.ok ? { ok: 'Cache cleared and reloaded from your Sheet.' } : { err: result.message || 'Reloading failed. Try Full resync.' });
    } catch (err) {
      setMsg({ err: `${describeError(err)} Nothing was cleared.` });
    } finally {
      setBusy('');
    }
  }

  const p = preview && preview.parsed;
  return (
    <section className="card">
      <h2>Data &amp; backup</h2>
      <div className="btn-row" style={{ marginTop: 0 }}>
        <button className="btn btn--primary" disabled={Boolean(busy)} onClick={() => exportAs('json')}>
          {busy === 'json' ? 'Exporting…' : 'Export everything (JSON)'}
        </button>
        <button className="btn" disabled={Boolean(busy)} onClick={() => exportAs('entries')}>Entries (CSV)</button>
        <button className="btn" disabled={Boolean(busy)} onClick={() => exportAs('habits')}>Habits (CSV)</button>
      </div>
      <p className="muted small">The JSON file includes archived habits and deleted entries. In the habits CSV, targets are in base units (seconds, ml); divide by <code>unitFactor</code>.</p>

      <h3 className="small-title">Import a backup</h3>
      <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" onChange={chooseFile} aria-label="Backup file" />
      <div className="btn-row">
        <button className="btn" disabled={Boolean(busy)} onClick={() => fileRef.current && fileRef.current.click()}>Choose backup file…</button>
      </div>
      {p && (
        <div className="preview" aria-label="Backup contents">
          <div className="small"><strong>{preview.name}</strong></div>
          <p className="small">
            {p.counts.habits} habits · {p.counts.categories} categories · {p.counts.targetChanges} target changes ·{' '}
            {p.counts.dayStatus} days · {p.counts.entries} entries
            {p.range ? ` (${formatShortDate(p.range.from)} ${p.range.from.slice(0, 4)} – ${formatShortDate(p.range.to)} ${p.range.to.slice(0, 4)})` : ''}
          </p>
          {p.source === 'local-cache' && <p className="small text-danger">This backup came from a device cache and may be missing older entries.</p>}
          <p className="muted small">Adds what is missing. Nothing is overwritten or deleted. Settings are not imported.</p>
          <div className="btn-row">
            <button className="btn btn--primary" disabled={Boolean(busy)} onClick={runImport}>{busy === 'import' ? 'Importing…' : 'Import'}</button>
            <button className="btn" disabled={Boolean(busy)} onClick={() => setPreview(null)}>Cancel</button>
          </div>
        </div>
      )}
      {progress && <p role="status" className="small">{progress}</p>}

      <h3 className="small-title">Reset local cache</h3>
      <p className="muted small">If something looks wrong on this device, clear the cache and re-download from your Sheet. Unsynced actions are kept.</p>
      <div className="btn-row" style={{ marginTop: 0 }}>
        <button className="btn" disabled={Boolean(busy) || sync.phase === 'syncing'} onClick={resetCache}>
          {busy === 'reset' ? 'Resetting…' : 'Reset local cache'}
        </button>
      </div>

      {msg && msg.ok && <p role="status" className="small">✅ {msg.ok}</p>}
      {msg && msg.problems && msg.problems.length > 0 && (
        <details className="archived" open>
          <summary>{msg.problems.length} item{msg.problems.length === 1 ? '' : 's'} could not be imported</summary>
          <ul className="plain-list">{msg.problems.map((x) => (<li key={x} className="small">{x}</li>))}</ul>
        </details>
      )}
      {msg && msg.err && <p role="alert" className="small text-danger">❌ {msg.err}</p>}
    </section>
  );
}