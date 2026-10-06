import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import PageHeader from '../components/common/PageHeader';
import { TRACKING_TYPES as T } from '../constants/trackingTypes';
import { useAppState, useAppActions } from '../store/AppContext';
import { useAnchorsByHabit } from '../hooks/useAnchors';
import { useClock } from '../hooks/useClock';
import { useNow } from '../hooks/useNow';
import { useTimers } from '../hooks/useTimers';
import { useWakeLock } from '../hooks/useWakeLock';
import { buildDayTotals, calcDay, evaluateDay, lowerIsBetter } from '../engine/calculations';
import { MAX_SESSION_MS, historyStats, sessionSeconds, timerView } from '../engine/timer';
import { discardSession, pauseSession, resumeSession, startSession } from '../services/timerService';
import { formatAmount, formatClock, formatDuration, formatPair } from '../utils/format';
import { addDays, formatShortDate } from '../utils/date';

export default function TimerPage() {
  const { habitId } = useParams();
  const navigate = useNavigate();
  const { ready, habits, entries } = useAppState();
  const actions = useAppActions();
  const anchorsByHabit = useAnchorsByHabit();
  const { today } = useClock();
  const { loaded, timers } = useTimers();
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [manual, setManual] = useState('');
  const [added, setAdded] = useState('');

  const habit = habits.find((h) => h.habitId === habitId) || null;
  const timer = timers.get(habitId) || null;
  const running = Boolean(timer && timer.status === 'running');
  const now = useNow(running);
  const totals = useMemo(() => buildDayTotals(entries), [entries]);
  const date = timer ? timer.date : today;
  const stats = useMemo(
    () => historyStats(totals.get(habitId), date, addDays(date, -1)),
    [totals, habitId, date]
  );
  const view = timer ? timerView(timer, now) : null;
  const targetMet = view ? view.targetMet : false;

  useWakeLock(running);

  // Vibrate once when the target is reached while you are watching (not when reopening an old timer).
  const seen = useRef({ key: '', reached: false });
  const key = timer ? String(timer.firstStartedAt) : '';
  const goal = timer ? timer.goalSec : 0;
  useEffect(() => {
    if (seen.current.key !== key) {
      seen.current = { key, reached: targetMet };
      return;
    }
    if (!seen.current.reached && targetMet && running && goal > 0 && navigator.vibrate) {
      navigator.vibrate([200, 100, 200]);
    }
    seen.current.reached = targetMet;
  }, [key, goal, running, targetMet]);

  const back = <Link className="btn" to="/">Back</Link>;
  if (!ready || !loaded) return (<><PageHeader title="Timer" action={back} /><p className="muted">Loading…</p></>);
  if (!habit) return (<><PageHeader title="Habit not found" action={back} /></>);
  if (habit.trackingType !== T.TIMER || lowerIsBetter(habit)) {
    return (
      <>
        <PageHeader title={`${habit.icon} ${habit.name}`} action={back} />
        <p className="muted">Timers are for Timer habits where more is better. Use the quick buttons on Home for this one.</p>
      </>
    );
  }

  const day = evaluateDay(habit, anchorsByHabit.get(habitId) || [], totals, date);
  const manualUnit = /^sec/i.test(habit.unit || '') ? 'seconds' : 'minutes';

  async function start() {
    setError(''); setResult(null); setAdded('');
    try {
      await startSession({ habit, date: today, targetSec: day.target, loggedSec: day.actual });
    } catch (err) {
      console.error(err);
      setError('Could not start the timer.');
    }
  }

  async function togglePause() {
    setError('');
    try { await (running ? pauseSession(timer) : resumeSession(timer)); }
    catch (err) { console.error(err); setError('Could not update the timer.'); }
  }

  async function finish() {
    if (busy || !timer) return;
    setBusy(true); setError('');
    try {
      const nowMs = Date.now();
      const secs = sessionSeconds(timer, nowMs);
      const capped = timerView(timer, nowMs).elapsedMs > MAX_SESSION_MS;
      if (secs < 1) {
        await discardSession(habitId);
        setResult({ empty: true });
        return;
      }
      await actions.addEntry(habit, secs, { date: timer.date, source: 'timer', durationSec: secs });
      await discardSession(habitId);
      const dayTotal = timer.loggedSec + secs;
      setResult({
        secs, capped, targetSec: timer.targetSec, loggedSec: timer.loggedSec, date: timer.date,
        newBest: Boolean(stats.best) && dayTotal > stats.best.total,
      });
    } catch (err) {
      console.error(err);
      setError('Could not save the session. Your timer is still running, so try Finish again.');
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (view.elapsedSec >= 10 && !window.confirm('Discard this session without saving?')) return;
    try { await discardSession(habitId); setResult(null); }
    catch (err) { console.error(err); setError('Could not reset the timer.'); }
  }

  async function addManual() {
    const n = Number(manual);
    const secs = Math.round(n * (manualUnit === 'seconds' ? 1 : 60));
    if (manual.trim() === '' || !Number.isFinite(n) || secs < 1 || secs > 86400) {
      setAdded('');
      setError('Enter an amount between 1 second and 24 hours.');
      return;
    }
    setError('');
    try {
      await actions.addEntry(habit, secs, { date: today, source: 'manual' });
      setManual('');
      setAdded(`Added ${formatDuration(secs)}.`);
    } catch (err) {
      console.error(err);
      setError('Could not save that. Please try again.');
    }
  }

  const statsCard = (
    <section className="card" aria-label="History">
      <div className="stat-row">
        <div className="stat">
          <div className="muted small">Yesterday</div>
          <div className="stat__value">{stats.yesterday === null ? '—' : formatAmount(habit, stats.yesterday)}</div>
        </div>
        <div className="stat">
          <div className="muted small">Best (cached days)</div>
          <div className="stat__value">{stats.best ? formatAmount(habit, stats.best.total) : '—'}</div>
          {stats.best && <div className="muted small">{formatShortDate(stats.best.date)}</div>}
        </div>
      </div>
    </section>
  );

  const manualCard = (
    <section className="card" aria-label="Manual entry">
      <h2>Add time manually</h2>
      <div className="btn-row">
        <input className="input input--short" inputMode="decimal" aria-label={`Amount in ${manualUnit}`}
          placeholder={manualUnit} value={manual} onChange={(e) => setManual(e.target.value)} />
        <button className="btn" onClick={addManual}>Add</button>
      </div>
      {added && <p role="status" className="small">✅ {added}</p>}
    </section>
  );

  let main;
  if (timer) {
    const projected = calcDay(habit, timer.targetSec, view.totalSec, 1);
    const clock = targetMet ? formatClock(view.elapsedSec) : formatClock(view.remainingSec);
    main = (
      <section className="card timer" aria-label="Timer">
        <div className="timer__label">{targetMet ? 'Session time' : 'Time left'}{running ? '' : ' · paused'}</div>
        <div
          className={`timer__clock${targetMet ? ' timer__clock--done' : ''}${running ? '' : ' timer__clock--paused'}`}
          role="timer" aria-label={`${targetMet ? 'Session time' : 'Time left'} ${clock}`}
        >
          {clock}
        </div>

        {targetMet && (
          <div className="timer__banner" role="status">
            <strong>{timer.goalSec > 0 ? 'Target completed 🎉' : "Today's target was already reached"}</strong>
            <br />You can continue if you want.
            {view.extraSec > 0 && <> <strong>+{formatDuration(view.extraSec)}</strong> extra</>}
          </div>
        )}

        <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={100}
          aria-valuenow={Math.min(100, Math.round(projected.percentage))} aria-label="Progress toward today's target">
          <div className={`bar__fill${targetMet ? ' bar__fill--done' : ''}`} style={{ width: `${Math.min(100, projected.percentage)}%` }} />
        </div>
        <p className="muted small">
          Today: {formatPair(habit, view.totalSec, timer.targetSec)} · {Math.round(projected.percentage)}%
        </p>

        <div className="timer__actions">
          <button className="btn btn--xl" onClick={togglePause}>{running ? '⏸ Pause' : '▶ Resume'}</button>
          <button className={`btn btn--xl${targetMet ? ' btn--primary' : ''}`} onClick={finish} disabled={busy}>
            {busy ? 'Saving…' : '✓ Finish'}
          </button>
        </div>
        <div className="btn-row timer__reset">
          <button className="btn btn--small" onClick={reset} disabled={busy}>Reset</button>
        </div>

        {timer.date !== today && (
          <p className="muted small">Started on {formatShortDate(timer.date)}. The time will be saved to that day.</p>
        )}
        {view.elapsedMs > MAX_SESSION_MS && (
          <p className="small text-danger" role="alert">This timer has run over 16 hours. Finish will save 16 hours only.</p>
        )}
      </section>
    );
  } else if (result) {
    const r = result.empty ? null : calcDay(habit, result.targetSec, result.loggedSec + result.secs, 1);
    main = (
      <section className="card timer" aria-label="Session saved">
        {result.empty ? (
          <p>Nothing to save: the timer ran for under a second.</p>
        ) : (
          <>
            <h2>Saved ✓</h2>
            {result.newBest && <p><strong>🏆 New best!</strong></p>}
            <dl className="kv timer__kv">
              <dt>Target</dt><dd>{formatAmount(habit, result.targetSec)}</dd>
              <dt>This session</dt><dd>{formatDuration(result.secs)}</dd>
              <dt>Today in total</dt><dd>{formatAmount(habit, result.loggedSec + result.secs)}</dd>
              <dt>{r.extra > 0 ? 'Extra' : 'Remaining'}</dt>
              <dd>{r.extra > 0 ? `+${formatDuration(r.extra)}` : formatAmount(habit, r.remaining)}</dd>
              <dt>Achievement</dt><dd>{Math.round(r.percentage)}%</dd>
            </dl>
            {result.capped && <p className="small text-danger">This session was capped at 16 hours.</p>}
          </>
        )}
        <div className="timer__actions">
          <button className="btn btn--xl" onClick={start}>▶ Start another</button>
          <button className="btn btn--xl btn--primary" onClick={() => navigate('/')}>Done</button>
        </div>
      </section>
    );
  } else {
    const met = day.actual >= day.target;
    main = (
      <section className="card timer" aria-label="Start timer">
        <div className="timer__label">Today&apos;s target</div>
        <div className="timer__clock">{formatClock(day.target)}</div>
        <p className="muted">
          {formatAmount(habit, day.target)}
          {day.actual > 0 && <> · logged {formatAmount(habit, day.actual)}</>}
        </p>
        {met && <p className="small">Target already reached today. A new session counts as extra.</p>}
        {!met && day.actual > 0 && <p className="small">{formatAmount(habit, day.remaining)} to go: the timer counts down what is left.</p>}
        <div className="timer__actions">
          <button className="btn btn--primary btn--xl" onClick={start}>▶ Start</button>
        </div>
      </section>
    );
  }

  return (
    <>
      <PageHeader title={`${habit.icon} ${habit.name}`} action={back} />
      {error && <p className="text-danger" role="alert">{error}</p>}
      {main}
      {statsCard}
      {!timer && manualCard}
    </>
  );
}