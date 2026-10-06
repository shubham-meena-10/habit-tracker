const TEXT = { success: 'completed', fail: 'not completed', pending: 'in progress', skip: 'not scheduled' };

/** One small square per day. Used for Yes/No and quit habits, where a bar chart means nothing. */
export default function DayStrip({ days, label }) {
  return (
    <div>
      <div className="strip" role="img" aria-label={label}>
        {days.map((d) => (
          <span key={d.date} className={`strip__cell strip__cell--${d.status}`} title={`${d.date}: ${TEXT[d.status]}`} />
        ))}
      </div>
      <div className="legend small muted">
        <span><i className="swatch swatch--met" /> completed</span>
        <span><i className="swatch swatch--bad" /> not completed</span>
        <span><i className="swatch swatch--skip" /> not scheduled</span>
      </div>
    </div>
  );
}