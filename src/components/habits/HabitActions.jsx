import { useState } from 'react';
import { useNavigate } from 'react-router';
import { describeError } from '../../api/api';
import { useAppActions } from '../../store/AppContext';
import { formatAmount } from '../../utils/format';
import { formatShortDate } from '../../utils/date';
import { isCheckHabit } from '../../engine/calculations';

export default function HabitActions({ habit, info }) {
  const actions = useAppActions();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [manual, setManual] = useState('');

  const paused = habit.status === 'paused';
  const archived = habit.status === 'archived';
  const check = isCheckHabit(habit);
  const factor = habit.unitFactor || 1;

  async function run(okText, fn) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: okText });
    } catch (err) {
      setMsg({ err: describeError(err) });
    } finally {
      setBusy(false);
    }
  }

  function setManualTarget() {
    const n = Number(manual);
    if (manual.trim() === '' || !Number.isFinite(n) || n < 0) {
      setMsg({ err: 'Enter a target (0 or more).' });
      return;
    }
    const base = Math.round(n * factor * 1e6) / 1e6;
    run('Target updated.', async () => { await actions.setTarget({ habitId: habit.habitId, reason: 'manual', target: base }); setManual(''); });
  }

  let progressionText;
  if (check) progressionText = null;
  else if (paused) progressionText = 'Paused: the target is frozen until you resume.';
  else if (!habit.progressionEnabled) progressionText = 'Automatic progression is off.';
  else if (info.capped) progressionText = 'Final target reached.';
  else if (info.nextTarget !== null) {
    progressionText = `Next: ${formatAmount(habit, info.nextTarget)} on ${formatShortDate(info.nextTargetDate)} (in ${info.daysUntilIncrease} day${info.daysUntilIncrease === 1 ? '' : 's'})`;
  }

  return (
    <section className="card">
      <h2>Target &amp; status</h2>
      {!check && (
        <p>
          Current target: <strong>{formatAmount(habit, info.target)}</strong>
          {progressionText && <><br /><span className="muted small">{progressionText}</span></>}
        </p>
      )}
      {archived && <p className="muted small">This habit is archived. Its history is kept.</p>}

      <div className="btn-row">
        {archived && (
          <button className="btn btn--primary" disabled={busy}
            onClick={() => run('Habit restored.', () => actions.setHabitStatus(habit.habitId, 'active'))}>Restore</button>
        )}
        {habit.status === 'active' && (
          <button className="btn" disabled={busy}
            onClick={() => run('Habit paused.', () => actions.setHabitStatus(habit.habitId, 'paused'))}>⏸ Pause</button>
        )}
        {paused && (
          <button className="btn btn--primary" disabled={busy}
            onClick={() => run('Habit resumed.', () => actions.setHabitStatus(habit.habitId, 'active'))}>▶ Resume</button>
        )}
        {!archived && (
          <button className="btn" disabled={busy} onClick={() => {
            if (window.confirm(`Archive "${habit.name}"? It disappears from your lists, but all history is kept and you can restore it later.`)) {
              run('Archived.', async () => { await actions.setHabitStatus(habit.habitId, 'archived'); navigate('/habits'); });
            }
          }}>🗄 Archive</button>
        )}
      </div>

      {!check && !paused && !archived && (
        <>
          <h3 className="small-title">Adjust target</h3>
          <div className="btn-row">
            <input className="input input--short" inputMode="decimal" aria-label="New target" value={manual}
              placeholder={formatAmount(habit, info.target)} onChange={(e) => setManual(e.target.value)} />
            <button className="btn" disabled={busy} onClick={setManualTarget}>Set target</button>
          </div>
          <div className="btn-row">
            <button className="btn btn--small" disabled={busy || info.frozen || info.capped}
              title="Keeps today's target and restarts the interval from today"
              onClick={() => run('Next increase postponed: the interval restarts today.', () =>
                actions.setTarget({ habitId: habit.habitId, reason: 'manual', target: info.target }))}>
              Skip next increase
            </button>
            <button className="btn btn--small" disabled={busy} onClick={() => {
              if (window.confirm(`Reset "${habit.name}" to its starting target (${formatAmount(habit, habit.startingTarget)}) from today? Past days keep their targets.`)) {
                run('Progression reset.', () => actions.setTarget({ habitId: habit.habitId, reason: 'reset' }));
              }
            }}>Reset progression</button>
          </div>
        </>
      )}

      {msg && msg.ok && <p role="status" className="small">✅ {msg.ok}</p>}
      {msg && msg.err && <p role="alert" className="small text-danger">❌ {msg.err}</p>}
    </section>
  );
}