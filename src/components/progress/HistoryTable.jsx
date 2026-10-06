import { useMemo, useState } from 'react';
import { TRACKING_TYPES as T } from '../../constants/trackingTypes';
import { isCheckHabit } from '../../engine/calculations';
import { formatAmount } from '../../utils/format';
import { formatShortDate, formatWeekdayShort } from '../../utils/date';

const PAGE = 30;
const MARK = {
  success: ['✓', 'Completed', 'delta-good'],
  fail: ['✗', 'Not completed', 'delta-bad'],
  pending: ['…', 'In progress', ''],
  skip: ['–', 'Not scheduled', ''],
};

function actualText(habit, d) {
  if (habit.trackingType === T.BOOLEAN) return d.actual >= 1 ? 'Done' : '—';
  if (habit.trackingType === T.ABSTINENCE) return d.state === 'success' ? 'Clean' : d.state === 'slip' ? 'Slipped' : '—';
  return formatAmount(habit, d.actual);
}

export default function HistoryTable({ habit, days }) {
  const [shown, setShown] = useState(PAGE);
  const rows = useMemo(() => days.filter((d) => d.scheduled || d.count > 0).reverse(), [days]);
  const check = isCheckHabit(habit);
  if (!rows.length) return null;

  return (
    <section className="card" aria-label="History">
      <h2>History</h2>
      <div className="table-wrap">
        <table className="data-table">
          <caption className="sr-only">Daily target and result for {habit.name}</caption>
          <thead>
            <tr><th>Date</th>{!check && <th className="num">Target</th>}<th className="num">Actual</th><th aria-label="Result" /></tr>
          </thead>
          <tbody>
            {rows.slice(0, shown).map((d) => {
              const [symbol, text, cls] = MARK[d.status];
              return (
                <tr key={d.date}>
                  <td>{formatWeekdayShort(d.date)} {formatShortDate(d.date)}</td>
                  {!check && <td className="num">{formatAmount(habit, d.target)}</td>}
                  <td className="num">{actualText(habit, d)}</td>
                  <td className={cls}><span aria-label={text}>{symbol}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length > shown && (
        <div className="btn-row">
          <button className="btn btn--small" onClick={() => setShown((n) => n + PAGE)}>
            Show more ({rows.length - shown} older)
          </button>
        </div>
      )}
    </section>
  );
}