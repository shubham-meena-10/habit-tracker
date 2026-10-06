import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import PageHeader from '../components/common/PageHeader';
import ProgressRing from '../components/dashboard/ProgressRing';
import UndoBar from '../components/dashboard/UndoBar';
import BarChart from '../components/progress/BarChart';
import { TRACKING_TYPES as T } from '../constants/trackingTypes';
import { CONFIG } from '../config';
import { useAppState, useAppActions } from '../store/AppContext';
import { useAnchorsByHabit } from '../hooks/useAnchors';
import { useClock } from '../hooks/useClock';
import { useYearSplit } from '../hooks/useYearSplit';
import { buildDayTotals, compareValues, dayTotal, evaluateDay } from '../engine/calculations';
import { quickAddsFor } from '../engine/daily';
import { dailySeries, summarize, yearSummary } from '../engine/stats';
import { formatAmount, formatPair, formatQuick } from '../utils/format';
import {
  addDays, formatMonthYear, formatShortDate, formatWeekdayShort, startOfMonth, startOfWeek,
} from '../utils/date';
import { findWaterHabit, isVolumeHabit, waterIncrementMl, withWaterUnit } from '../utils/water';

const timeOf = (iso) =>
  iso ? new Date(iso).toLocaleTimeString('en-IN', { timeZone: CONFIG.TIMEZONE, hour: 'numeric', minute: '2-digit' }) : '';

function Stat({ title, sub, value, lines }) {
  return (
    <div className="stat-card">
      <div className="muted small">{title}</div>
      {sub && <div className="muted small">{sub}</div>}
      <div className="stat-card__value">{value}</div>
      {lines.filter(Boolean).map((l) => (<div key={l} className="small">{l}</div>))}
    </div>
  );
}

export default function QuantityPage() {
  const { habitId } = useParams();
  const { ready, habits, entries, settings } = useAppState();
  const actions = useAppActions();
  const anchorsByHabit = useAnchorsByHabit();
  const { today } = useClock();
  const [range, setRange] = useState(7);
  const [error, setError] = useState('');
  const [amount, setAmount] = useState('');
  const [unitIdx, setUnitIdx] = useState(0);
  const [undo, setUndo] = useState(null);

  const raw = habits.find((h) => h.habitId === habitId) || null;
  const habit = useMemo(() => (raw ? withWaterUnit(raw, settings.waterUnit) : null), [raw, settings.waterUnit]);
  const anchors = useMemo(() => anchorsByHabit.get(habitId) || [], [anchorsByHabit, habitId]);
  const totals = useMemo(() => buildDayTotals(entries), [entries]);
  const year = useYearSplit(habit ? habit.habitId : null, today);
  const weekStartsOn = Number(settings.weekStartsOn ?? 1);

  useEffect(() => {
    if (!undo) return undefined;
    const id = setTimeout(() => setUndo(null), 6000);
    return () => clearTimeout(id);
  }, [undo]);

  const periods = useMemo(() => {
    if (!habit) return null;
    const clampStart = (d) => (d < habit.startDate ? habit.startDate : d);
    const period = (from) => {
      const f = clampStart(from);
      return summarize(dailySeries(habit, anchors, totals, f, today), today, f);
    };
    const weekStart = startOfWeek(today, Number.isFinite(weekStartsOn) ? weekStartsOn : 1);
    const yearStart = `${today.slice(0, 4)}-01-01`;
    const local = summarize(dailySeries(habit, anchors, totals, year.localFrom, today), today, year.localFrom);
    return {
      weekStart,
      week: period(weekStart),
      month: period(startOfMonth(today)),
      year: yearSummary({
        pre: year.pre, local, todayTotal: dayTotal(totals, habit.habitId, today).total,
        start: clampStart(yearStart), today,
      }),
    };
  }, [habit, anchors, totals, today, weekStartsOn, year.pre, year.localFrom]);

  const chart = useMemo(() => {
    if (!habit) return [];
    const rows = dailySeries(habit, anchors, totals, addDays(today, -(range - 1)), today);
    return rows.map((d, i) => ({
      key: d.date,
      value: d.total,
      target: d.scheduled ? d.target : 0,
      label: range === 7 ? formatWeekdayShort(d.date) : ((rows.length - 1 - i) % 5 === 0 ? String(Number(d.date.slice(8))) : ''),
      tip: `${formatShortDate(d.date)}: ${formatAmount(habit, d.total)} of ${formatAmount(habit, d.target)}`,
    }));
  }, [habit, anchors, totals, today, range]);

  const back = <Link className="btn" to="/">Back</Link>;
  if (!ready) return (<><PageHeader title="Stats" action={back} /><p className="muted">Loading…</p></>);
  if (!habit) return (<><PageHeader title="Habit not found" action={back} /></>);
  if (habit.trackingType !== T.QUANTITY) {
    return (
      <>
        <PageHeader title={`${habit.icon} ${habit.name}`} action={back} />
        <p className="muted">This page is for Quantity habits (like water).</p>
      </>
    );
  }

  const day = evaluateDay(habit, anchors, totals, today);
  const fa = (v) => formatAmount(habit, Math.round(v));
  const water = findWaterHabit(habits, settings);
  const isWater = Boolean(water) && water.habitId === habit.habitId;
  const glassMl = waterIncrementMl(settings);
  const quick = quickAddsFor(habit).filter((d) => !isWater || d !== glassMl);
  const units = isVolumeHabit(habit)
    ? [{ label: 'ml', factor: 1 }, { label: 'L', factor: 1000 }]
    : [{ label: habit.unit || 'units', factor: habit.unitFactor || 1 }];
  const unit = units[Math.min(unitIdx, units.length - 1)];

  const yd = dayTotal(totals, habit.habitId, addDays(today, -1));
  const cmp = yd.count > 0 ? compareValues(habit, day.actual, yd.total) : null;
  const todays = entries
    .filter((e) => e.habitId === habit.habitId && e.date === today)
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  async function add(delta) {
    setError('');
    try {
      const e = await actions.addEntry(habit, delta, { date: today });
      setUndo({ entryId: e.entryId, label: `${formatQuick(habit, delta)} · ${habit.name}` });
    } catch (err) {
      console.error(err);
      setError('Could not save that. Please try again.');
    }
  }

  async function addCustom() {
    const n = Number(amount);
    const base = Math.round(n * unit.factor * 1e6) / 1e6;
    if (amount.trim() === '' || !Number.isFinite(n) || n <= 0 || base > 1e7) {
      setError('Enter an amount greater than 0.');
      return;
    }
    await add(base);
    setAmount('');
  }

  async function remove(entryId) {
    setError('');
    try { await actions.removeEntry(entryId); } catch (err) { console.error(err); setError('Could not delete that entry.'); }
  }

  async function handleUndo() {
    const u = undo;
    setUndo(null);
    if (u) await remove(u.entryId);
  }

  const lines = (p) => [
    `Avg ${fa(p.avgPerDay)} / day`,
    p.scheduledDays > 0 ? `Target met on ${p.daysMet} of ${p.scheduledDays} finished days` : '',
    p.pct !== null ? `${Math.round(p.pct)}% of target` : '',
    p.best ? `Best ${fa(p.best.total)} (${formatShortDate(p.best.date)})` : '',
  ];
  const { week, month, weekStart } = periods;
  const yr = periods.year;

  return (
    <>
      <PageHeader title={`${habit.icon} ${habit.name}`} action={back} />
      {error && <p className="text-danger" role="alert">{error}</p>}

      <section className="card day-summary" aria-label="Today">
        <ProgressRing percent={Math.round(day.percentage)} />
        <div>
          <div className="muted small">Today</div>
          <div className="day-summary__big">{formatPair(habit, day.actual, day.target)}</div>
          <div className="small">
            {day.extra > 0 ? <strong>+{fa(day.extra)} extra</strong> : `${fa(day.remaining)} to go`}
          </div>
          {cmp && (
            <div className={`small compare${cmp.good === true ? ' compare--good' : cmp.good === false ? ' compare--bad' : ''}`}>
              Yesterday {fa(yd.total)} · {cmp.direction === 'same' ? 'same' : `${cmp.direction === 'up' ? '↑' : '↓'} ${formatQuick(habit, cmp.diff)}`}
            </div>
          )}
        </div>
      </section>

      <section className="card" aria-label="Add">
        <h2>Add</h2>
        <div className="hcard-actions">
          {isWater && (
            <button className="btn btn--primary btn--glass" onClick={() => add(glassMl)}>
              + 1 Glass <span className="btn__sub">{formatQuick(habit, glassMl).replace(/^\+/, '')}</span>
            </button>
          )}
          {quick.map((delta) => (
            <button key={delta} className="btn quick" disabled={day.actual + delta < 0} onClick={() => add(delta)}>
              {formatQuick(habit, delta)}
            </button>
          ))}
        </div>
        <div className="btn-row">
          <input className="input input--short" inputMode="decimal" aria-label="Custom amount"
            placeholder="Custom amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
          {units.length > 1 ? (
            <select className="input" aria-label="Unit" value={unitIdx} onChange={(e) => setUnitIdx(Number(e.target.value))}>
              {units.map((u, i) => (<option key={u.label} value={i}>{u.label}</option>))}
            </select>
          ) : (<span className="muted small">{unit.label}</span>)}
          <button className="btn" onClick={addCustom}>Add</button>
        </div>

        {todays.length > 0 && (
          <>
            <h3 className="small-title">Today&apos;s log</h3>
            <ul className="plain-list">
              {todays.map((e) => (
                <li key={e.entryId} className="entry-row">
                  <span className="small">{timeOf(e.createdAt)} · <strong>{formatQuick(habit, e.delta)}</strong></span>
                  <button className="btn btn--small" onClick={() => remove(e.entryId)}>Delete</button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="card" aria-label="Daily chart">
        <div className="chart-head">
          <h2>Daily intake</h2>
          <div className="chip-row">
            {[7, 30].map((n) => (
              <button key={n} className={`chip${range === n ? ' chip--on' : ''}`} aria-pressed={range === n} onClick={() => setRange(n)}>
                {n} days
              </button>
            ))}
          </div>
        </div>
        <BarChart data={chart} formatValue={fa} ariaLabel={`${habit.name} per day for the last ${range} days`} />
        <div className="legend small muted">
          <span><i className="swatch swatch--bar" /> below target</span>
          <span><i className="swatch swatch--met" /> target met</span>
          <span><i className="swatch swatch--over" /> extra</span>
          <span><i className="swatch swatch--line" /> target</span>
        </div>
        <ul className="sr-only">{chart.map((d) => (<li key={d.key}>{d.tip}</li>))}</ul>
      </section>

      <div className="stat-grid">
        <Stat title="Today" value={fa(day.actual)}
          lines={[`Target ${fa(day.target)}`, `${Math.round(day.percentage)}%`]} />
        <Stat title="This week" sub={`${formatShortDate(weekStart)} – ${formatShortDate(addDays(weekStart, 6))}`}
          value={fa(week.total)} lines={lines(week)} />
        <Stat title="This month" sub={formatMonthYear(today)} value={fa(month.total)} lines={lines(month)} />
        <Stat title="This year" sub={today.slice(0, 4)} value={fa(yr.total)}
          lines={[
            `Avg ${fa(yr.avgPerDay)} / day`,
            `${yr.daysLogged} days logged`,
            yr.best ? `Best ${fa(yr.best.total)}${yr.best.date ? ` (${formatShortDate(yr.best.date)})` : ''}` : '',
          ]} />
      </div>
      {year.status === 'loading' && <p className="muted small">Loading earlier months…</p>}
      {year.status === 'error' && (
        <p className="small text-danger" role="alert">
          Earlier months could not be loaded, so the year covers cached days only.{' '}
          <button className="btn btn--small" onClick={year.retry}>Retry</button>
        </p>
      )}

      <UndoBar undo={undo} onUndo={handleUndo} />
    </>
  );
}