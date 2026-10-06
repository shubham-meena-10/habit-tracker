import { useState } from 'react';
import { CONFIG } from '../../config';
import { TRACKING_TYPES as T } from '../../constants/trackingTypes';
import { quickAddsFor } from '../../engine/daily';
import { useAppActions } from '../../store/AppContext';
import { amountUnitsFor } from '../../utils/amounts';
import { formatAmount, formatQuick } from '../../utils/format';
import { formatShortDate, todayStr } from '../../utils/date';

const SOURCE_LABEL = { timer: '⏱ timer', manual: 'manual', checkin: 'check-in', import: 'import' };

// Back-filled entries are created "now", so for them show when they were added, not a misleading time.
function stamp(entry, date) {
  if (!entry.createdAt) return '';
  const added = todayStr(CONFIG.TIMEZONE, new Date(entry.createdAt));
  if (added === date) {
    return new Date(entry.createdAt).toLocaleTimeString('en-IN', {
      timeZone: CONFIG.TIMEZONE, hour: 'numeric', minute: '2-digit',
    });
  }
  return `added ${formatShortDate(added)}`;
}

export default function EntryEditor({ habit, date, day, entries }) {
  const actions = useAppActions();
  const { units, index } = amountUnitsFor(habit);
  const [unitIdx, setUnitIdx] = useState(index);
  const [amount, setAmount] = useState('');
  const [total, setTotal] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const unit = units[Math.min(unitIdx, units.length - 1)];
  const isBool = habit.trackingType === T.BOOLEAN;
  const isAbst = habit.trackingType === T.ABSTINENCE;

  async function run(fn, okText) {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      if (okText) setMsg({ ok: okText });
    } catch (err) {
      console.error(err);
      setMsg({ err: 'Could not save that. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  const toBase = (text) => {
    const trimmed = text.trim();
    if (trimmed === '') return NaN;
    const n = Number(trimmed);
    return Number.isFinite(n) ? Math.round(n * unit.factor * 1e6) / 1e6 : NaN;
  };

  // ---------- Yes/No and quit habits ----------
  if (isBool || isAbst) {
    const existing = entries[0] || null;
    const clean = Boolean(existing) && existing.delta >= 1;
    const slipped = Boolean(existing) && existing.delta === 0;
    const mark = (delta) => run(() => actions.addEntry(habit, delta, { date, source: 'checkin' }));
    const clear = () => run(() => actions.removeEntry(existing.entryId));

    return (
      <div className="editor">
        <div className="hcard-actions">
          {isBool && !clean && <button className="btn btn--primary" disabled={busy} onClick={() => mark(1)}>✓ Mark done</button>}
          {isBool && clean && <button className="btn" disabled={busy} onClick={clear}>Remove check-off</button>}
          {isAbst && (
            <>
              <button className={`btn${clean ? ' btn--done' : ''}`} aria-pressed={clean} disabled={busy || clean} onClick={() => mark(1)}>
                ✓ Clean
              </button>
              <button className={`btn btn--danger${slipped ? ' btn--done' : ''}`} aria-pressed={slipped} disabled={busy || slipped} onClick={() => mark(0)}>
                Slipped
              </button>
              {existing && <button className="btn" disabled={busy} onClick={clear}>Clear</button>}
            </>
          )}
        </div>
        {msg && msg.err && <p role="alert" className="small text-danger">❌ {msg.err}</p>}
      </div>
    );
  }

  // ---------- numeric habits ----------
  const quick = quickAddsFor(habit);

  function addCustom() {
    const base = toBase(amount);
    if (!Number.isFinite(base) || base <= 0 || base > 1e7) {
      setMsg({ err: 'Enter an amount greater than 0.' });
      return;
    }
    run(async () => {
      await actions.addEntry(habit, base, { date, source: 'manual' });
      setAmount('');
    }, 'Added.');
  }

  function setDayTotal() {
    const base = toBase(total);
    if (!Number.isFinite(base) || base < 0 || base > 1e7) {
      setMsg({ err: 'Enter a total (0 or more).' });
      return;
    }
    const delta = Math.round((base - day.actual) * 1e6) / 1e6;
    if (delta === 0) {
      setMsg({ ok: 'The day is already at that total.' });
      return;
    }
    run(async () => {
      await actions.addEntry(habit, delta, {
        date, source: 'manual', note: `Adjusted to ${formatAmount(habit, base)}`,
      });
      setTotal('');
    }, 'Total updated.');
  }

  const unitPicker = units.length > 1 ? (
    <select className="input" aria-label="Unit" value={unitIdx} onChange={(e) => setUnitIdx(Number(e.target.value))}>
      {units.map((u, i) => (<option key={u.label} value={i}>{u.label}</option>))}
    </select>
  ) : (<span className="muted small">{unit.label}</span>);

  return (
    <div className="editor">
      {entries.length > 0 ? (
        <ul className="plain-list" style={{ marginTop: 0 }}>
          {entries.map((e) => (
            <li key={e.entryId} className="entry-row">
              <span className="small">
                {stamp(e, date)} · <strong>{formatQuick(habit, e.delta)}</strong>
                {e.source && e.source !== 'tap' && <span className="muted"> · {SOURCE_LABEL[e.source] || e.source}</span>}
              </span>
              <button className="btn btn--small" disabled={busy} onClick={() => run(() => actions.removeEntry(e.entryId))}>Delete</button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted small" style={{ marginTop: 0 }}>Nothing logged on this day.</p>
      )}

      <h3 className="small-title">Add</h3>
      <div className="hcard-actions">
        {quick.map((delta) => (
          <button key={delta} className="btn quick" disabled={busy || day.actual + delta < 0}
            aria-label={`${formatQuick(habit, delta)} ${habit.name}`}
            onClick={() => run(() => actions.addEntry(habit, delta, { date, source: 'manual' }))}>
            {formatQuick(habit, delta)}
          </button>
        ))}
      </div>
      <div className="btn-row">
        <input className="input input--short" inputMode="decimal" aria-label="Amount to add" placeholder="Amount"
          value={amount} onChange={(e) => setAmount(e.target.value)} />
        {unitPicker}
        <button className="btn" disabled={busy} onClick={addCustom}>Add</button>
      </div>

      <h3 className="small-title">{`Set the day's total`}</h3>
      <div className="btn-row">
        <input className="input input--short" inputMode="decimal" aria-label="New day total"
          placeholder={String(Math.round((day.actual / unit.factor) * 100) / 100)}
          value={total} onChange={(e) => setTotal(e.target.value)} />
        {unitPicker}
        <button className="btn" disabled={busy} onClick={setDayTotal}>Set total</button>
      </div>
      <p className="muted small">Adds one correcting entry so the day matches. Your earlier entries stay in the log.</p>

      {msg && msg.ok && <p role="status" className="small">✅ {msg.ok}</p>}
      {msg && msg.err && <p role="alert" className="small text-danger">❌ {msg.err}</p>}
    </div>
  );
}