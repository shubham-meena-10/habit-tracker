import { useMemo, useState } from 'react';
import { lowerIsBetter } from '../../engine/calculations';
import { levelSummary, levelTimeline, projectLevels, sortAnchors } from '../../engine/progression';
import { formatAmount } from '../../utils/format';
import { formatShortDate } from '../../utils/date';

const REASON_LABEL = {
  start: 'Start', manual: 'Manual', pause: 'Paused', resume: 'Resumed', reset: 'Reset', progress: 'Auto',
};
const VISIBLE_PAST = 6;

export default function ProgressionCard({ habit, anchors, info, today }) {
  const [showAll, setShowAll] = useState(false);
  const { past, upcoming, summary, log } = useMemo(() => ({
    past: levelTimeline(habit, anchors, today),
    upcoming: projectLevels(habit, anchors, today, 4).slice(1),
    summary: levelSummary(habit, anchors, today),
    log: sortAnchors(anchors).reverse(),
  }), [habit, anchors, today]);

  const fa = (v) => formatAmount(habit, v);
  const d = (s) => (s.slice(0, 4) === today.slice(0, 4) ? formatShortDate(s) : `${formatShortDate(s)} ${s.slice(0, 4)}`);

  let nextText;
  if (habit.status === 'paused') nextText = 'Paused: the target is frozen';
  else if (info.nextTarget !== null) {
    nextText = `${fa(info.nextTarget)} on ${d(info.nextTargetDate)} (in ${info.daysUntilIncrease} day${info.daysUntilIncrease === 1 ? '' : 's'})`;
  } else if (info.capped) nextText = 'Final target reached';
  else nextText = 'No automatic change';

  const pct = summary.changePct;
  const good = pct === null || pct === 0 ? null : (lowerIsBetter(habit) ? pct < 0 : pct > 0);
  const changeText = pct === null ? '—' : `${pct > 0 ? '+' : ''}${Math.round(pct)}%`;

  const hidden = showAll ? 0 : Math.max(0, past.length - VISIBLE_PAST);
  const shown = past.slice(hidden);
  const last = past.length - 1;
  const dateText = (l, now) => (l.from === l.to ? d(l.from) : `${d(l.from)} – ${now ? 'today' : d(l.to)}`);

  return (
    <section className="card" aria-label="Progression">
      <h2>Progression</h2>
      <dl className="kv">
        <dt>Started at</dt><dd>{fa(summary.start)}</dd>
        <dt>Current</dt><dd><strong>{fa(summary.current)}</strong></dd>
        <dt>Next</dt><dd>{nextText}</dd>
        <dt>Change</dt>
        <dd className={good === true ? 'change-good' : good === false ? 'change-bad' : ''}>{changeText}</dd>
      </dl>

      <h3 className="small-title">Levels</h3>
      {hidden > 0 && (
        <button className="btn btn--small" onClick={() => setShowAll(true)}>Show {hidden} earlier</button>
      )}
      <ul className="levels">
        {shown.map((l, i) => {
          const now = hidden + i === last;
          return (
            <li key={l.from} className={`levels__row${now ? ' levels__row--now' : ''}`}>
              <span className="levels__dates">{dateText(l, now)}</span>
              <span className="levels__target">{fa(l.target)}</span>
              <span className="tag">{now ? 'Now · ' : ''}{REASON_LABEL[l.reason] || l.reason}</span>
            </li>
          );
        })}
        {upcoming.map((l) => (
          <li key={`next-${l.from}`} className="levels__row levels__row--next">
            <span className="levels__dates">{d(l.from)}{l.to ? ` – ${d(l.to)}` : ' onwards'}</span>
            <span className="levels__target">{fa(l.target)}</span>
            <span className="tag">Planned</span>
          </li>
        ))}
      </ul>

      <details className="archived">
        <summary>Change log ({log.length})</summary>
        <p className="muted small">Starting levels and changes you made. Automatic steps are derived, so they aren&apos;t listed here.</p>
        <ul className="plain-list">
          {log.map((a) => (
            <li key={a.changeId} className="entry-row">
              <span className="small">{d(a.effectiveDate)} · <strong>{REASON_LABEL[a.reason] || a.reason}</strong></span>
              <span className="small">{fa(a.target)}</span>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}