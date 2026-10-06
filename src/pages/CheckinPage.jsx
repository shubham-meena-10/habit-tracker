import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import PageHeader from '../components/common/PageHeader';
import EmptyState from '../components/common/EmptyState';
import ProgressRing from '../components/dashboard/ProgressRing';
import CheckinRow from '../components/checkin/CheckinRow';
import { useAppState, useAppActions } from '../store/AppContext';
import { useStatsContext } from '../hooks/useStatsContext';
import { buildDayTotals } from '../engine/calculations';
import { buildDayRows } from '../engine/calendar';
import { pendingQuitRows, summarizeCheckin } from '../engine/checkin';
import { addDays, formatLongDate } from '../utils/date';

export default function CheckinPage() {
  const { ready, entries, dayStatus } = useAppState();
  const actions = useAppActions();
  const { today, todayFinal, habits, anchorsByHabit } = useStatsContext();
  const [which, setWhich] = useState('today');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const date = which === 'today' ? today : addDays(today, -1);
  const closed = dayStatus.some((d) => d.date === date && d.closed);
  const final = date < today || todayFinal;

  const dateEntries = useMemo(() => entries.filter((e) => e.date === date), [entries, date]);
  const detail = useMemo(
    () => buildDayRows({
      habits, anchorsByHabit, totals: buildDayTotals(dateEntries), entriesOnDate: dateEntries, date, today, todayFinal,
    }),
    [habits, anchorsByHabit, dateEntries, date, today, todayFinal]
  );
  const summary = useMemo(() => summarizeCheckin(detail.rows), [detail]);
  const quitPending = useMemo(() => pendingQuitRows(detail.rows), [detail]);

  async function run(fn) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (err) {
      console.error(err);
      setError('Could not save that. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const mark = (habit, delta) => run(() => actions.addEntry(habit, delta, { date, source: 'checkin' }));
  const clear = (entryId) => run(() => actions.removeEntry(entryId));
  const markAllClean = () => run(async () => {
    for (const r of quitPending) {
      await actions.addEntry(r.habit, 1, { date, source: 'checkin' });
    }
  });

  const header = (
    <PageHeader
      title="🌙 Day check-in"
      subtitle={formatLongDate(date)}
      action={<Link className="btn" to="/">Back</Link>}
    />
  );

  if (!ready) return (<>{header}<p className="muted">Loading…</p></>);

  const toggle = (
    <div className="chip-row" role="group" aria-label="Day" style={{ marginBottom: 16 }}>
      {[['today', 'Today'], ['yesterday', 'Yesterday']].map(([key, label]) => (
        <button key={key} className={`chip${which === key ? ' chip--on' : ''}`} aria-pressed={which === key}
          onClick={() => setWhich(key)}>
          {label}
        </button>
      ))}
    </div>
  );

  if (summary.total === 0) {
    return (
      <>
        {header}
        {toggle}
        <EmptyState title="Nothing scheduled" message="None of your active habits were scheduled on this day.">
          <Link className="btn" to="/habits">Manage habits</Link>
        </EmptyState>
      </>
    );
  }

  return (
    <>
      {header}
      {toggle}
      {error && <p className="text-danger" role="alert">{error}</p>}

      <section className="card day-summary" aria-label="Summary">
        <ProgressRing percent={summary.pct || 0} />
        <div>
          <div className="muted small">Done</div>
          <div className="day-summary__big">{summary.done} / {summary.total}</div>
          <div className="muted small">{closed ? 'Day completed' : final ? 'The day is over' : 'So far'}</div>
        </div>
      </section>

      <section className="card" aria-label="Habits">
        <ul className="ci-list">
          {summary.items.map(({ row, state }) => (
            <CheckinRow
              key={row.habit.habitId} row={row} state={state} date={date} final={final}
              busy={busy} onMark={mark} onClear={clear}
            />
          ))}
        </ul>
        {quitPending.length >= 2 && !closed && (
          <div className="btn-row">
            <button className="btn" disabled={busy} onClick={markAllClean}>✓ All {quitPending.length} quit habits clean</button>
          </div>
        )}
      </section>

      {closed ? (
        <section className="card ci-complete" aria-label="Day completed">
          <h2>Day completed 🎉</h2>
          <p className="muted">
            {summary.done} of {summary.total} completed{summary.pct !== null ? ` · ${summary.pct}%` : ''}.
          </p>
          <div className="btn-row" style={{ justifyContent: 'center' }}>
            <Link className="btn btn--primary" to="/">Back to Home</Link>
            <button className="btn" disabled={busy} onClick={() => run(() => actions.closeDay(date, false))}>Reopen day</button>
          </div>
        </section>
      ) : (
        <section className="card ci-complete" aria-label="Complete day">
          {summary.open.length > 0 ? (
            <p className="small">
              Still open: {summary.open.map((r) => r.habit.name).join(', ')}. They will count as not completed.
            </p>
          ) : (
            <p className="small">Everything is done 🎉</p>
          )}
          <button className="btn btn--primary btn--xl" disabled={busy} onClick={() => run(() => actions.closeDay(date, true))}>
            Complete Day
          </button>
        </section>
      )}
    </>
  );
}