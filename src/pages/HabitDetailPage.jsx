import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import PageHeader from '../components/common/PageHeader';
import EmptyState from '../components/common/EmptyState';
import BarChart from '../components/progress/BarChart';
import DayStrip from '../components/progress/DayStrip';
import HistoryTable from '../components/progress/HistoryTable';
import StatCard from '../components/progress/StatCard';
import ProgressionCard from '../components/habits/ProgressionCard';
import { TRACKING_TYPES as T } from '../constants/trackingTypes';
import { useAppState } from '../store/AppContext';
import { useStatsContext } from '../hooks/useStatsContext';
import { useHistoryEntries } from '../hooks/useHistoryEntries';
import { buildDayTotals, isCheckHabit, lowerIsBetter } from '../engine/calculations';
import { bucketDays, buildHistory, changeLabel, compareSummaries, summarizeHistory } from '../engine/history';
import { computeTarget, levelSummary } from '../engine/progression';
import { describeHabit, formatAmount, formatCompact } from '../utils/format';
import { formatShortDate, formatWeekdayShort } from '../utils/date';

const RANGES = [[7, '7 days'], [30, '30 days'], [90, '90 days'], [0, 'All time']];
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function labelFor(p, i, n) {
  if (n <= 7) return formatWeekdayShort(p.from);
  const step = Math.max(1, Math.ceil(n / 8));
  if ((n - 1 - i) % step !== 0) return '';
  return n <= 31 && p.from === p.to ? String(Number(p.from.slice(8))) : formatShortDate(p.from);
}

export default function HabitDetailPage() {
  const { habitId } = useParams();
  const { ready } = useAppState();
  const ctx = useStatsContext();
  const { today, todayFinal, anchorsByHabit } = ctx;
  const [range, setRange] = useState(30);

  const habit = useMemo(() => ctx.habits.find((h) => h.habitId === habitId) || null, [ctx.habits, habitId]);
  const anchors = useMemo(() => anchorsByHabit.get(habitId) || [], [anchorsByHabit, habitId]);
  const hist = useHistoryEntries({ habitId, from: habit ? habit.startDate : today, to: today });
  const totals = useMemo(() => buildDayTotals(hist.entries), [hist.entries]);

  const days = useMemo(() => {
    if (!habit) return [];
    let to = today;
    if (habit.status === 'archived') {
      // An archived habit stops at its last entry, so the days after archiving are not counted as missed.
      to = hist.entries.reduce((m, e) => (e.date > m ? e.date : m), habit.startDate);
    }
    return buildHistory(habit, anchors, totals, { from: habit.startDate, to, today, todayFinal });
  }, [habit, anchors, totals, hist.entries, today, todayFinal]);

  const sum = useMemo(() => (habit ? summarizeHistory(habit, days, today) : null), [habit, days, today]);

  const trend = useMemo(() => {
    if (!habit || days.length < 14) return null;
    const n = Math.min(30, Math.floor(days.length / 2));
    const cur = summarizeHistory(habit, days.slice(-n), today);
    const prev = summarizeHistory(habit, days.slice(-2 * n, -n), today);
    const c = compareSummaries(habit, cur, prev);
    return c ? { ...c, n } : null;
  }, [habit, days, today]);

  const chartDays = useMemo(() => (range === 0 ? days : days.slice(-range)), [days, range]);
  const chart = useMemo(() => {
    if (!habit) return [];
    const points = bucketDays(chartDays);
    return points.map((p, i) => {
      const bucket = p.from !== p.to;
      const val = formatAmount(habit, p.value);
      const tgt = p.target > 0 ? ` of ${formatAmount(habit, p.target)}` : '';
      return {
        key: p.from, value: p.value, target: p.target, label: labelFor(p, i, points.length),
        tip: bucket
          ? `${formatShortDate(p.from)} – ${formatShortDate(p.to)}: average ${val} per day${tgt ? ` (target ${formatAmount(habit, p.target)})` : ''}`
          : `${formatShortDate(p.from)}: ${val}${tgt}`,
      };
    });
  }, [habit, chartDays]);

  const back = <Link className="btn" to="/habits">Back</Link>;
  if (!ready) return (<><PageHeader title="Habit" action={back} /><p className="muted">Loading…</p></>);
  if (!habit) return (<><PageHeader title="Habit not found" action={back} /></>);

  const check = isCheckHabit(habit);
  const lower = lowerIsBetter(habit);
  const info = computeTarget(habit, anchors, today);
  const lv = levelSummary(habit, anchors, today);
  const fa = (v) => formatAmount(habit, v);
  const hasData = hist.entries.length > 0;
  const rateText = sum.rate === null ? '—' : `${Math.round(sum.rate * 10) / 10}%`;

  return (
    <>
      <PageHeader
        title={`${habit.icon} ${habit.name}`}
        subtitle={describeHabit(habit, info.target)}
        action={back}
      />
      <div className="btn-row" style={{ marginTop: 0, marginBottom: 16 }}>
        <Link className="btn" to={`/habits/${habit.habitId}/edit`}>✏️ Edit &amp; plan</Link>
        {habit.trackingType === T.TIMER && !lower && <Link className="btn" to={`/timer/${habit.habitId}`}>⏱ Timer</Link>}
        {habit.trackingType === T.QUANTITY && <Link className="btn" to={`/quantity/${habit.habitId}`}>📊 Quantity stats</Link>}
        {habit.status !== 'active' && <span className="tag">{habit.status === 'paused' ? 'Paused' : 'Archived'}</span>}
      </div>

      {hist.status === 'loading' && <p className="muted small">Loading older history…</p>}
      {hist.status === 'error' && (
        <p className="small text-danger" role="alert">
          Older history could not be loaded, so streaks, totals and charts cover cached days only.{' '}
          <button className="btn btn--small" onClick={hist.retry}>Retry</button>
        </p>
      )}

      <div className="stat-grid">
        {!check && (
          <StatCard
            title={lower ? 'Current limit' : 'Current target'} value={fa(info.target)}
            lines={[
              `Started at ${fa(lv.start)}`,
              lv.changePct === null ? '' : `${lv.changePct > 0 ? '+' : ''}${Math.round(lv.changePct)}% since start`,
            ]}
          />
        )}
        {check ? (
          <StatCard title="Total" value={plural(sum.completed, 'day')} lines={[`since ${formatShortDate(habit.startDate)}`]} />
        ) : (
          <StatCard title="Total" value={fa(sum.total)}
            lines={[`${plural(sum.loggedDays, 'day')} logged`, `Average ${fa(sum.avgPerDay)} / day`]} />
        )}
        <StatCard title="Streak" value={`🔥 ${plural(sum.current, 'day')}`} lines={[`🏆 Best: ${plural(sum.longest, 'day')}`]} />
        <StatCard title="Completion" value={rateText}
          lines={[`${sum.completed} / ${sum.counted} days completed`, `${plural(sum.missed, 'missed day')}`]} />
        {!check && sum.high && sum.low && (
          lower ? (
            <StatCard title="Lowest day" value={fa(sum.low.actual)}
              lines={[formatShortDate(sum.low.date), `Highest: ${fa(sum.high.actual)}`]} />
          ) : (
            <StatCard title="Best day" value={fa(sum.high.actual)}
              lines={[formatShortDate(sum.high.date), `Lowest logged: ${fa(sum.low.actual)}`]} />
          )
        )}
        {habit.trackingType === T.ABSTINENCE && (
          <StatCard
            title="Last slip"
            value={sum.lastSlip ? `${plural(sum.daysSinceSlip, 'day')} ago` : 'None'}
            lines={[sum.lastSlip ? formatShortDate(sum.lastSlip) : 'No slips recorded', `${plural(sum.slips, 'slip')} in total`]}
            tone={sum.lastSlip ? undefined : 'good'}
          />
        )}
      </div>

      {trend && (
        <section className="card" aria-label="Trend">
          <h2>Trend</h2>
          <p className={trend.good === true ? 'delta-good' : trend.good === false ? 'delta-bad' : ''}>
            <strong>{changeLabel(trend)}</strong>{' '}
            {trend.kind === 'rate'
              ? 'in completion rate'
              : `in average per day (${fa(trend.prev)} → ${fa(trend.cur)})`}
          </p>
          <p className="muted small">Last {trend.n} days compared with the {trend.n} before.</p>
        </section>
      )}

      {hasData ? (
        <section className="card" aria-label="Chart">
          <div className="chart-head">
            <h2>{check ? 'Consistency' : 'History'}</h2>
            <div className="chip-row">
              {RANGES.map(([n, label]) => (
                <button key={n} className={`chip${range === n ? ' chip--on' : ''}`} aria-pressed={range === n} onClick={() => setRange(n)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {check ? (
            <DayStrip days={chartDays} label={`${habit.name}: ${chartDays.filter((d) => d.status === 'success').length} days completed`} />
          ) : (
            <>
              <BarChart data={chart} lowerBetter={lower} formatValue={(v) => formatCompact(habit, v)}
                ariaLabel={`${habit.name} ${range === 0 ? 'over all time' : `over the last ${range} days`}`} />
              <ul className="sr-only">{chart.map((d) => (<li key={d.key}>{d.tip}</li>))}</ul>
              {chartDays.length > 120 && <p className="muted small">Each bar is the average per day over a few weeks.</p>}
            </>
          )}
        </section>
      ) : (
        hist.status !== 'loading' && (
          <EmptyState title="Nothing tracked yet" message="Your progress will appear here once you start tracking." />
        )
      )}

      {!check && <ProgressionCard habit={habit} anchors={anchors} info={info} today={today} />}
      <HistoryTable habit={habit} days={days} />
    </>
  );
}