import { useMemo } from 'react';
import { Link } from 'react-router';
import PageHeader from '../components/common/PageHeader';
import EmptyState from '../components/common/EmptyState';
import Agenda from '../components/dashboard/Agenda';
import { useAppState } from '../store/AppContext';
import { useDaily } from '../hooks/useDaily';
import { buildSchedule, formatUntil, weekdaySummary } from '../engine/schedule';
import { formatTime12 } from '../utils/format';
import { formatLongDate } from '../utils/date';

function ScheduleTable({ habits, label }) {
  if (!habits.length) return null;
  return (
    <div className="table-wrap">
      <table className="data-table">
        <caption className="sr-only">{label}</caption>
        <thead>
          <tr><th>Time</th><th>Habit</th><th>Days</th><th>Reminder</th></tr>
        </thead>
        <tbody>
          {habits.map((h) => (
            <tr key={h.habitId}>
              <td>{h.scheduleTime ? formatTime12(h.scheduleTime) : 'Anytime'}</td>
              <td>
                <Link to={`/habits/${h.habitId}/edit`}>{h.icon} {h.name}</Link>
                {h.status === 'paused' && <span className="tag">Paused</span>}
              </td>
              <td>{weekdaySummary(h.weekdays)}</td>
              <td>{h.reminderTime ? formatTime12(h.reminderTime) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SchedulePage() {
  const { ready, habits } = useAppState();
  const { today, minutes, data } = useDaily();
  const sched = useMemo(() => buildSchedule(habits), [habits]);

  const header = (
    <PageHeader
      title="Schedule" subtitle={formatLongDate(today)}
      action={<Link className="btn" to="/checkin">🌙 Check-in</Link>}
    />
  );
  if (!ready) return (<>{header}<p className="muted">Loading…</p></>);
  if (!habits.some((h) => h.status !== 'archived')) {
    return (
      <>
        {header}
        <EmptyState title="Nothing scheduled" message="Create a habit and give it a time to see it here.">
          <Link className="btn btn--primary" to="/habits/new">+ Add Habit</Link>
        </EmptyState>
      </>
    );
  }

  const { agenda, items } = data;
  const overdue = agenda.filter((a) => a.status === 'overdue');
  const next = agenda.find((a) => a.status === 'upcoming');
  const anytime = items.filter((i) => i.sched === null);

  return (
    <>
      {header}

      {overdue.length > 0 && (
        <section className="card warn-card" role="status" aria-label="Overdue">
          <strong>⚠️ {overdue.length} overdue</strong>
          <p className="small">{overdue.map((a) => `${a.name} (${a.timeLabel})`).join(' · ')}</p>
        </section>
      )}
      {next && (
        <section className="card" aria-label="Next up">
          <div className="muted small">Next up</div>
          <div><strong>{next.icon} {next.name}</strong> at {next.timeLabel} · in {formatUntil(next.minutes - minutes)}</div>
        </section>
      )}

      {agenda.length > 0 ? (
        <Agenda agenda={agenda} showLink={false} />
      ) : (
        <p className="muted small">No habits have a set time today.</p>
      )}

      {anytime.length > 0 && (
        <section className="card" aria-label="Anytime today">
          <h2>Anytime today</h2>
          <ul className="plain-list">
            {anytime.map((i) => (
              <li key={i.habit.habitId} className="entry-row">
                <span><span aria-hidden="true">{i.habit.icon}</span> {i.habit.name}</span>
                <span className={i.done ? 'delta-good' : 'muted small'}>{i.done ? '✓ Done' : 'To do'}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card" aria-label="Weekly schedule">
        <h2>Weekly schedule</h2>
        {sched.timed.length === 0 && (
          <p className="muted small">No habit has a set time yet. Open a habit&apos;s settings to add one.</p>
        )}
        <ScheduleTable habits={sched.timed} label="Habits with a set time" />
        {sched.anytime.length > 0 && (
          <>
            <h3 className="small-title">No set time</h3>
            <ScheduleTable habits={sched.anytime} label="Habits without a set time" />
          </>
        )}
        {sched.paused.length > 0 && (
          <>
            <h3 className="small-title">Paused</h3>
            <ScheduleTable habits={sched.paused} label="Paused habits" />
          </>
        )}
        <p className="muted small">Tap a habit to change its time, days or reminder.</p>
      </section>
    </>
  );
}