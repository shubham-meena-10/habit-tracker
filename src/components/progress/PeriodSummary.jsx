import { useMemo, useState } from 'react';
import EmptyState from '../common/EmptyState';
import ProgressRing from '../dashboard/ProgressRing';
import BarChart from './BarChart';
import PeriodNav from './PeriodNav';
import { useHistoryEntries } from '../../hooks/useHistoryEntries';
import { buildDayTotals, isCheckHabit } from '../../engine/calculations';
import { changeLabel } from '../../engine/history';
import { buildInsights, categoryTimeTotals, periodReport } from '../../engine/summaries';
import {
  addDays, addMonths, dateRange, endOfMonth, formatMonthYear, formatShortDate,
  formatWeekdayShort, startOfMonth, startOfWeek,
} from '../../utils/date';
import { formatAmount } from '../../utils/format';

const tone = (good) => (good === true ? 'delta-good' : good === false ? 'delta-bad' : '');
const pctText = (v) => (v === null || v === undefined ? '—' : `${Math.round(v)}%`);

/** Weekly (kind="week") and monthly (kind="month") summary. */
export default function PeriodSummary({ kind, ctx }) {
  const { today, todayFinal, habits, categories, anchorsByHabit, weekStartsOn } = ctx;
  const [offset, setOffset] = useState(0);

  const period = useMemo(() => {
    if (kind === 'week') {
      const start = addDays(startOfWeek(today, weekStartsOn), offset * 7);
      const end = addDays(start, 6);
      return {
        from: start, to: end, prev: { from: addDays(start, -7), to: addDays(start, -1) },
        title: offset === 0 ? 'This week' : 'Week',
        subtitle: `${formatShortDate(start)} – ${formatShortDate(end)}`,
        label: offset === 0 ? 'this week' : `in the week of ${formatShortDate(start)}`,
        prevName: 'previous week',
      };
    }
    const start = addMonths(startOfMonth(today), offset);
    const prevStart = addMonths(start, -1);
    return {
      from: start, to: endOfMonth(start), prev: { from: prevStart, to: endOfMonth(prevStart) },
      title: formatMonthYear(start), subtitle: offset === 0 ? 'This month' : '',
      label: offset === 0 ? 'this month' : `in ${formatMonthYear(start)}`,
      prevName: 'previous month',
    };
  }, [kind, offset, today, weekStartsOn]);

  const active = useMemo(() => habits.filter((h) => h.status !== 'archived'), [habits]);
  const earliest = useMemo(
    () => active.reduce((m, h) => (!m || h.startDate < m ? h.startDate : m), null),
    [active]
  );
  const dataTo = period.to < today ? period.to : today;
  const hist = useHistoryEntries({ from: period.prev.from, to: dataTo });
  const totals = useMemo(() => buildDayTotals(hist.entries), [hist.entries]);

  const report = useMemo(
    () => periodReport({
      habits: active, anchorsByHabit, totals, from: period.from, to: period.to,
      prev: period.prev, today, todayFinal,
    }),
    [active, anchorsByHabit, totals, period, today, todayFinal]
  );

  const chart = useMemo(() => {
    if (dataTo < period.from) return [];
    const list = dateRange(period.from, dataTo);
    return list.map((date, i) => {
      const e = report.byDate.get(date);
      const pct = e && e.counted ? (e.done / e.counted) * 100 : 0;
      let tip = `${formatShortDate(date)}: nothing tracked`;
      if (e) tip = `${formatShortDate(date)}: ${e.done} of ${e.counted} habits (${Math.round(pct)}%)`;
      else if (date === today && !todayFinal) tip = `${formatShortDate(date)}: in progress`;
      return {
        key: date, value: pct, target: 0, tip,
        label: kind === 'week' ? formatWeekdayShort(date) : ((list.length - 1 - i) % 5 === 0 ? String(Number(date.slice(8))) : ''),
      };
    });
  }, [report, period.from, dataTo, kind, today, todayFinal]);

  const insights = useMemo(
    () => buildInsights(report, { label: period.label, fmt: formatAmount }),
    [report, period.label]
  );
  const timeByCategory = useMemo(() => categoryTimeTotals(report.rows, categories), [report.rows, categories]);

  const canPrev = Boolean(earliest) && period.from > earliest;
  const nav = (
    <PeriodNav title={period.title} subtitle={period.subtitle}
      canPrev={canPrev} canNext={offset < 0}
      onPrev={() => setOffset((n) => n - 1)} onNext={() => setOffset((n) => n + 1)} />
  );

  const { overall, prevOverall } = report;
  const diff = overall.pct !== null && prevOverall && prevOverall.pct !== null ? overall.pct - prevOverall.pct : null;
  const rows = report.active;

  return (
    <>
      {nav}
      {hist.status === 'loading' && <p className="muted small">Loading older history…</p>}
      {hist.status === 'error' && (
        <p className="small text-danger" role="alert">
          Older days could not be loaded, so figures cover cached days only.{' '}
          <button className="btn btn--small" onClick={hist.retry}>Retry</button>
        </p>
      )}

      {overall.counted === 0 ? (
        <EmptyState title="Nothing to show yet" message="Your progress will appear here once you start tracking." />
      ) : (
        <>
          <section className="card summary-top" aria-label="Overall">
            <ProgressRing percent={Math.round(overall.pct)} />
            <div>
              <div className="muted small">Overall completion</div>
              <div className="day-summary__big">{overall.completed} / {overall.counted}</div>
              <div className="muted small">habit-days completed</div>
              {diff !== null && Math.abs(diff) >= 1 && (
                <div className={`small ${tone(diff > 0)}`}>
                  {diff > 0 ? '↑' : '↓'} {Math.abs(Math.round(diff))} pts vs {period.prevName}
                </div>
              )}
              {!todayFinal && offset === 0 && <div className="muted small">Today is counted once the day ends.</div>}
            </div>
          </section>

          <section className="card" aria-label="Highlights">
            {report.best && (
              <p>🏆 <strong>Best habit:</strong> {report.best.habit.icon} {report.best.habit.name} — {pctText(report.best.sum.rate)}</p>
            )}
            {report.needs && (
              <p>🎯 <strong>Needs improvement:</strong> {report.needs.habit.icon} {report.needs.habit.name} — {pctText(report.needs.sum.rate)}</p>
            )}
            {report.longest && (
              <p>🔥 <strong>Longest streak:</strong> {report.longest.days} days ({report.longest.habit.name})</p>
            )}
            {report.improved.length > 0 && (
              <p className="delta-good"><strong>Improved:</strong>{' '}
                {report.improved.map((r) => `${r.habit.name} ${changeLabel(r.change)}`).join(' · ')}</p>
            )}
            {report.declined.length > 0 && (
              <p className="delta-bad"><strong>Declined:</strong>{' '}
                {report.declined.map((r) => `${r.habit.name} ${changeLabel(r.change)}`).join(' · ')}</p>
            )}
          </section>

          <section className="card" aria-label="Daily completion">
            <h2>Daily completion</h2>
            <BarChart data={chart} maxValue={100} formatValue={(v) => `${Math.round(v)}%`}
              ariaLabel={`Share of habits completed each day ${period.label}`} />
            <ul className="sr-only">{chart.map((d) => (<li key={d.key}>{d.tip}</li>))}</ul>
          </section>

          <section className="card" aria-label="What your data says">
            <h2>What your data says</h2>
            {insights.length > 0 ? (
              <ul className="insights">{insights.map((s) => (<li key={s}>{s}</li>))}</ul>
            ) : (
              <p className="muted small">Insights appear once you have a few days of data.</p>
            )}
          </section>

          {kind === 'month' && timeByCategory.length > 0 && (
            <section className="card" aria-label="Time by category">
              <h2>Time by category</h2>
              <ul className="plain-list">
                {timeByCategory.map(({ category, total }) => (
                  <li key={category.categoryId} className="entry-row">
                    <span>{category.icon} {category.name}</span>
                    <strong>{formatAmount({ unit: 'sec', unitFactor: 1 }, total)}</strong>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="card" aria-label="By habit">
            <h2>By habit</h2>
            <div className="table-wrap">
              <table className="data-table">
                <caption className="sr-only">Completion and totals per habit {period.label}</caption>
                <thead>
                  <tr>
                    <th>Habit</th><th className="num">Done</th><th className="num">Rate</th>
                    <th className="num">Total</th><th className="num">vs {kind === 'week' ? 'last week' : 'last month'}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.habit.habitId}>
                      <td>{r.habit.icon} {r.habit.name}</td>
                      <td className="num">{r.sum.completed}/{r.sum.counted}</td>
                      <td className="num">{pctText(r.sum.rate)}</td>
                      <td className="num">{isCheckHabit(r.habit) ? '—' : formatAmount(r.habit, r.sum.total)}</td>
                      <td className={`num ${tone(r.change && r.change.good)}`}>{changeLabel(r.change)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}