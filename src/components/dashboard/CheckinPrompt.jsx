import { Link } from 'react-router';

/** Evening card on Home. Quiet link during the day, prominent after the check-in time, a note once done. */
export default function CheckinPrompt({ due, closed }) {
  if (closed) {
    return (
      <p className="checkin-link small">
        <span aria-hidden="true">🌙</span> Day completed · <Link to="/checkin">Review</Link>
      </p>
    );
  }
  if (due) {
    return (
      <section className="card checkin-card" aria-label="Day check-in">
        <div>
          <strong>🌙 Time for your day check-in</strong>
          <p className="muted small">It takes a few seconds.</p>
        </div>
        <Link className="btn btn--primary" to="/checkin">Check in</Link>
      </section>
    );
  }
  return (
    <p className="checkin-link small"><Link to="/checkin">🌙 Day check-in →</Link></p>
  );
}