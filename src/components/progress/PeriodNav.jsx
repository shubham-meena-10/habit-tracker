export default function PeriodNav({ title, subtitle, onPrev, onNext, canPrev, canNext }) {
  return (
    <div className="period-nav">
      <button className="btn btn--icon" aria-label="Previous period" onClick={onPrev} disabled={!canPrev}>‹</button>
      <div className="period-nav__title">
        {title}
        {subtitle && <div className="muted small">{subtitle}</div>}
      </div>
      <button className="btn btn--icon" aria-label="Next period" onClick={onNext} disabled={!canNext}>›</button>
    </div>
  );
}