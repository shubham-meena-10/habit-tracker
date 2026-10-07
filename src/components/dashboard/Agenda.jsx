import { Link } from 'react-router';

const MARK = { done: '✓', missed: '✗', overdue: '⚠️', upcoming: '' };

export default function Agenda({ agenda, showLink = true }) {
  if (!agenda.length) return null;
  return (
    <section className="card" aria-label="Scheduled today">
      <h2>Scheduled</h2>
      <ul className="plain-list agenda">
        {agenda.map((a) => (
          <li key={a.habitId} className={`agenda__row agenda__row--${a.status}`}>
            <span className="agenda__time">{a.timeLabel}</span>
            <span aria-hidden="true">{a.icon}</span>
            <span className="agenda__main">
              <strong>{a.name}</strong>
              {a.status === 'overdue' && (
                <span className="agenda__note"> Scheduled for {a.timeLabel} · not completed</span>
              )}
              {a.status === 'missed' && <span className="agenda__note"> Not completed</span>}
              {(a.status === 'upcoming' || a.status === 'done') && a.detail && (
                <span className="muted small"> · {a.detail}</span>
              )}
            </span>
            <span className="agenda__mark" aria-label={a.status}>{MARK[a.status]}</span>
          </li>
        ))}
      </ul>
      {showLink && <Link className="small card-link" to="/schedule">Full schedule →</Link>}
    </section>
  );
}