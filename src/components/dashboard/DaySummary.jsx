import ProgressRing from './ProgressRing';

export default function DaySummary({ summary, final }) {
  const { percent, doneCount, total, watching } = summary;
  return (
    <section className="card day-summary" aria-label="Overall progress">
      <ProgressRing percent={percent} />
      <div>
        <div className="muted small">Overall progress</div>
        {total > 0 ? (
          <>
            <div className="day-summary__big">{doneCount} / {total}</div>
            <div className="muted small">habits completed</div>
          </>
        ) : (
          <div className="muted small">Only limits today. They count at the end of the day.</div>
        )}
        {watching > 0 && (
          <div className="muted small">{watching} limit{watching === 1 ? '' : 's'} being watched</div>
        )}
        {final && <div className="muted small">The day is over, so incomplete habits are marked.</div>}
      </div>
    </section>
  );
}