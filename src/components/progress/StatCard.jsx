export default function StatCard({ title, sub, value, lines = [], tone }) {
  return (
    <div className="stat-card">
      <div className="muted small">{title}</div>
      {sub && <div className="muted small">{sub}</div>}
      <div className={`stat-card__value${tone ? ` stat-card__value--${tone}` : ''}`}>{value}</div>
      {lines.filter(Boolean).map((l) => (<div key={l} className="small">{l}</div>))}
    </div>
  );
}