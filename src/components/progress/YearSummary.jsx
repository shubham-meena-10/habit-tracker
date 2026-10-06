import { useMemo, useState } from 'react';
import EmptyState from '../common/EmptyState';
import ProgressRing from '../dashboard/ProgressRing';
import BarChart from './BarChart';
import PeriodNav from './PeriodNav';
import { useHistoryEntries } from '../../hooks/useHistoryEntries';
import { buildDayTotals, isCheckHabit } from '../../engine/calculations';
import { yearReport } from '../../engine/summaries';
import { formatAmount, formatCompact } from '../../utils/format';
import { formatMonthShort } from '../../utils/date';

const pctText = (v) => (v === null || v === undefined ? '—' : `${Math.round(v)}%`);
const heat = (rate) => {
  if (rate === null) return 'heat--none';
  if (rate >= 80) return 'heat--4';
  if (rate >= 60) return 'heat--3';
  if (rate >= 40) return 'heat--2';
  return rate > 0 ? 'heat--1' : 'heat--0';
};

export default function YearSummary({ ctx }) {
  const { today, todayFinal, habits, anchorsByHabit } = ctx;
  const thisYear = Number(today.slice(0, 4));
  const [offset, setOffset] = useState(0);
  const [pick, setPick] = useState('');
  const year = thisYear + offset;
  const to = `${year}-12-31`;
  const dataTo = to < today ? to : today;

  const active = useMemo(() => habits.filter((h) => h.status !== 'archived'), [habits]);
  const earliest = useMemo(
    () => active.reduce((m, h) => (!m || h.startDate < m ? h.startDate : m), today),
    [active, today]
  );
  const hist = useHistoryEntries({ from: `${year}-01-01`, to: dataTo });
  const totals = useMemo(() => buildDayTotals(hist.entries), [hist.entries]);
  const report = useMemo(
    () => yearReport({ habits: active, anchorsByHabit, totals, year, today, todayFinal }),
    [active, anchorsByHabit, totals, year, today, todayFinal]
  );

  const rows = report.active;
  const numeric = rows.filter((r) => !isCheckHabit(r.habit) && r.sum.total > 0);
  const pickRow = numeric.find((r) => r.habit.habitId === pick) || numeric[0] || null;

  const monthChart = report.monthly.map((m) => ({
    key: String(m.month), value: m.rate || 0, target: 0, label: formatMonthShort(m.month),
    tip: m.counted ? `${formatMonthShort(m.month)}: ${m.done} of ${m.counted} habit-days (${Math.round(m.rate)}%)` : `${formatMonthShort(m.month)}: nothing tracked`,
  }));
  const totalChart = pickRow
    ? report.months.map((m, i) => ({
      key: String(m), value: pickRow.months[i].total, target: 0, label: formatMonthShort(m),
      tip: `${formatMonthShort(m)}: ${formatAmount(pickRow.habit, pickRow.months[i].total)}`,
    }))
    : [];

  return (
    <>
      <PeriodNav title={String(year)} subtitle={offset === 0 ? 'This year' : ''}
        canPrev={year > Number(earliest.slice(0, 4))} canNext={offset < 0}
        onPrev={() => setOffset((n) => n - 1)} onNext={() => setOffset((n) => n + 1)} />
      {hist.status === 'loading' && <p className="muted small">Loading earlier months…</p>}
      {hist.status === 'error' && (
        <p className="small text-danger" role="alert">
          Earlier months could not be loaded, so figures cover cached days only.{' '}
          <button className="btn btn--small" onClick={hist.retry}>Retry</button>
        </p>
      )}

      {report.overall.counted === 0 ? (
        <EmptyState title="Nothing to show yet" message="Your progress will appear here once you start tracking." />
      ) : (
        <>
          <section className="card summary-top" aria-label="Overall consistency">
            <ProgressRing percent={Math.round(report.overall.pct)} />
            <div>
              <div className="muted small">Overall consistency</div>
              <div className="day-summary__big">{report.overall.completed} / {report.overall.counted}</div>
              <div className="muted small">habit-days completed</div>
              {report.longest && (
                <div className="small">🔥 Longest streak: {report.longest.days} days ({report.longest.habit.name})</div>
              )}
            </div>
          </section>

          <section className="card" aria-label="Month by month">
            <h2>Month by month</h2>
            <BarChart data={monthChart} maxValue={100} formatValue={(v) => `${Math.round(v)}%`}
              ariaLabel={`Share of habits completed in each month of ${year}`} />
            <ul className="sr-only">{monthChart.map((d) => (<li key={d.key}>{d.tip}</li>))}</ul>
          </section>

          <section className="card" aria-label="Habit by month">
            <h2>Habits by month</h2>
            <div className="table-wrap">
              <table className="data-table heat-table">
                <caption className="sr-only">Completion rate per habit per month</caption>
                <thead>
                  <tr>
                    <th>Habit</th>
                    {report.months.map((m) => (<th key={m} className="num">{formatMonthShort(m).slice(0, 3)}</th>))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.habit.habitId}>
                      <td>{r.habit.icon} {r.habit.name}</td>
                      {r.months.map((m) => (
                        <td key={m.month} className={`num heat ${heat(m.rate)}`} title={m.counted ? `${m.done}/${m.counted}` : 'no data'}>
                          {m.rate === null ? '' : Math.round(m.rate)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted small">Completion % per month.</p>
          </section>

          {pickRow && (
            <section className="card" aria-label="Monthly totals">
              <div className="chart-head">
                <h2>Monthly totals</h2>
                <select className="input" aria-label="Habit" value={pickRow.habit.habitId} onChange={(e) => setPick(e.target.value)}>
                  {numeric.map((r) => (<option key={r.habit.habitId} value={r.habit.habitId}>{r.habit.icon} {r.habit.name}</option>))}
                </select>
              </div>
              <BarChart data={totalChart} formatValue={(v) => formatCompact(pickRow.habit, v)}
                ariaLabel={`${pickRow.habit.name} total per month in ${year}`} />
              <ul className="sr-only">{totalChart.map((d) => (<li key={d.key}>{d.tip}</li>))}</ul>
            </section>
          )}

          <section className="card" aria-label="By habit">
            <h2>By habit</h2>
            <div className="table-wrap">
              <table className="data-table">
                <caption className="sr-only">Yearly totals per habit</caption>
                <thead>
                  <tr><th>Habit</th><th className="num">Days done</th><th className="num">Rate</th><th className="num">Total</th><th className="num">Best streak</th></tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.habit.habitId}>
                      <td>{r.habit.icon} {r.habit.name}</td>
                      <td className="num">{r.sum.completed}</td>
                      <td className="num">{pctText(r.sum.rate)}</td>
                      <td className="num">{isCheckHabit(r.habit) ? '—' : formatAmount(r.habit, r.sum.total)}</td>
                      <td className="num">{r.sum.longest}</td>
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