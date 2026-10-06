/**
 * Hand-drawn SVG bar chart. Each datum: { key, label, value, target, tip }.
 * Higher-is-better: teal up to the target (green once met), blue above it.
 * lowerBetter: the whole bar is green at or under the target, red over it.
 */
export default function BarChart({ data, formatValue, ariaLabel, maxValue = 0, lowerBetter = false }) {
  if (!data.length) return null;
  const many = data.length > 10;
  const W = many ? 640 : 360;
  const H = 220;
  const padX = 8;
  const padT = 22;
  const padB = 28;
  const innerW = W - padX * 2;
  const innerH = H - padT - padB;
  const maxV = Math.max(1, maxValue, ...data.map((d) => Math.max(d.value, d.target || 0))) * 1.08;
  const y = (v) => padT + innerH - (Math.max(0, v) / maxV) * innerH;
  const slot = innerW / data.length;
  const barW = Math.min(36, slot * 0.68);
  const fs = many ? 17 : 12;

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
      <line className="chart__axis" x1={padX} x2={W - padX} y1={y(0)} y2={y(0)} />
      {data.map((d, i) => {
        const cx = padX + slot * i + slot / 2;
        const t = d.target || 0;
        const lb = lowerBetter && t > 0;
        const met = t > 0 && d.value >= t;
        const baseVal = lb ? d.value : (t > 0 ? Math.min(d.value, t) : d.value);
        const overVal = lb ? 0 : (t > 0 ? Math.max(0, d.value - t) : 0);
        const baseClass = lb
          ? (d.value <= t ? ' chart__bar--met' : ' chart__bar--bad')
          : (met ? ' chart__bar--met' : '');
        const x = cx - barW / 2;
        return (
          <g key={d.key}>
            <title>{d.tip}</title>
            {baseVal > 0 && (
              <rect className={`chart__bar${baseClass}`}
                x={x} y={y(baseVal)} width={barW} height={y(0) - y(baseVal)} rx="3" />
            )}
            {overVal > 0 && (
              <rect className="chart__bar chart__bar--over"
                x={x} y={y(d.value)} width={barW} height={y(t) - y(d.value)} rx="3" />
            )}
            {t > 0 && (
              <line className="chart__target" x1={padX + slot * i} x2={padX + slot * (i + 1)} y1={y(t)} y2={y(t)} />
            )}
            {!many && d.value > 0 && (
              <text className="chart__value" x={cx} y={y(d.value) - 5} textAnchor="middle" fontSize={fs - 1}>
                {formatValue(d.value)}
              </text>
            )}
            {d.label && (
              <text className="chart__label" x={cx} y={H - 8} textAnchor="middle" fontSize={fs}>{d.label}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}