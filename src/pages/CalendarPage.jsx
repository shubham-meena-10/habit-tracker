import { useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import PageHeader from "../components/common/PageHeader";
import EmptyState from "../components/common/EmptyState";
import PeriodNav from "../components/progress/PeriodNav";
import DayDetail from "../components/calendar/DayDetail";
import { useAppState } from "../store/AppContext";
import { useStatsContext } from "../hooks/useStatsContext";
import { useHistoryEntries } from "../hooks/useHistoryEntries";
import { buildDayTotals } from "../engine/calculations";
import { periodReport } from "../engine/summaries";
import {
  TONE_GOOD,
  TONE_OK,
  buildDayRows,
  canEditDay,
  dayPct,
  dayTone,
  monthGrid,
  monthStats,
} from "../engine/calendar";
import {
  addMonths,
  endOfMonth,
  formatLongDate,
  formatMonthYear,
  formatShortDate,
  formatWeekdayShort,
  startOfMonth,
} from "../utils/date";

export default function CalendarPage() {
  const { ready } = useAppState();
  const { today, todayFinal, habits, anchorsByHabit, weekStartsOn } =
    useStatsContext();
  const [offset, setOffset] = useState(0);
  const [picked, setPicked] = useState(null);
  const panelRef = useRef(null);

  const monthStart = useMemo(
    () => addMonths(startOfMonth(today), offset),
    [today, offset],
  );
  const monthEnd = endOfMonth(monthStart);
  const dataTo = monthEnd < today ? monthEnd : today;

  const active = useMemo(
    () => habits.filter((h) => h.status !== "archived"),
    [habits],
  );
  const earliest = useMemo(
    () =>
      active.reduce((m, h) => (!m || h.startDate < m ? h.startDate : m), null),
    [active],
  );

  const hist = useHistoryEntries({ from: monthStart, to: dataTo });
  const totals = useMemo(() => buildDayTotals(hist.entries), [hist.entries]);
  const report = useMemo(
    () =>
      periodReport({
        habits: active,
        anchorsByHabit,
        totals,
        from: monthStart,
        to: monthEnd,
        today,
        todayFinal,
        prev: null,
      }),
    [active, anchorsByHabit, totals, monthStart, monthEnd, today, todayFinal],
  );
  const weeks = useMemo(
    () => monthGrid(monthStart, weekStartsOn),
    [monthStart, weekStartsOn],
  );
  const stats = useMemo(() => monthStats(report.byDate), [report]);

  // Selected day: what you tapped, else today. It only applies if it lies in the month being shown.
  const wanted = picked === null ? today : picked;
  const sel = wanted >= monthStart && wanted <= dataTo ? wanted : null;
  const editable = sel
    ? canEditDay({ date: sel, today, cacheFrom: hist.cacheFrom })
    : false;

  const detail = useMemo(() => {
    if (!sel) return null;
    return buildDayRows({
      habits,
      anchorsByHabit,
      totals,
      entriesOnDate: hist.entries.filter((e) => e.date === sel),
      date: sel,
      today,
      todayFinal,
    });
  }, [sel, habits, anchorsByHabit, totals, hist.entries, today, todayFinal]);

  function pick(date) {
    setPicked(date);
    setTimeout(() => {
      // if (panelRef.current) panelRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      if (panelRef.current) {
        const calm = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        panelRef.current.scrollIntoView({
          behavior: calm ? "auto" : "smooth",
          block: "nearest",
        });
      }
    }, 50);
  }

  if (!ready)
    return (
      <>
        <PageHeader title="Calendar" />
        <p className="muted">Loading…</p>
      </>
    );
  if (!active.length) {
    return (
      <>
        <PageHeader title="Calendar" />
        <EmptyState
          title="Nothing to show yet"
          message="Your daily completion will appear here once you start tracking."
        >
          <Link className="btn btn--primary" to="/habits/new">
            + Add Habit
          </Link>
        </EmptyState>
      </>
    );
  }

  const lockedNote = hist.cacheFrom
    ? `This day is older than your cached history (since ${formatShortDate(hist.cacheFrom)} ${hist.cacheFrom.slice(0, 4)}), so it is view-only.`
    : "";

  return (
    <>
      <PageHeader title="Calendar" />
      <PeriodNav
        title={formatMonthYear(monthStart)}
        subtitle={offset === 0 ? "This month" : ""}
        canPrev={Boolean(earliest) && startOfMonth(earliest) < monthStart}
        canNext={offset < 0}
        onPrev={() => setOffset((n) => n - 1)}
        onNext={() => setOffset((n) => n + 1)}
      />
      {hist.status === "loading" && (
        <p className="muted small">Loading older history…</p>
      )}
      {hist.status === "error" && (
        <p className="small text-danger" role="alert">
          Older days could not be loaded, so this month may be incomplete.{" "}
          <button className="btn btn--small" onClick={hist.retry}>
            Retry
          </button>
        </p>
      )}

      <section className="card" aria-label="Month">
        <div
          className="cal"
          role="group"
          aria-label={`${formatMonthYear(monthStart)}, daily completion`}
        >
          <div className="cal__head" aria-hidden="true">
            {weeks[0].map((c) => (
              <span key={c.date}>{formatWeekdayShort(c.date)}</span>
            ))}
          </div>
          {weeks.map((week) => (
            <div className="cal__week" key={week[0].date}>
              {week.map((cell) => {
                if (!cell.inMonth)
                  return (
                    <span
                      key={cell.date}
                      className="cal__cell cal__cell--blank"
                      aria-hidden="true"
                    />
                  );
                const future = cell.date > today;
                const live = cell.date === today && !todayFinal;
                const entry = report.byDate.get(cell.date);
                const pct = live ? null : dayPct(entry);
                const tone = dayTone(pct);
                let state = "nothing tracked";
                if (future) state = "upcoming";
                else if (live) state = "in progress";
                else if (pct !== null)
                  state = `${Math.round(pct)}%, ${entry.done} of ${entry.counted} habits completed`;
                return (
                  <button
                    key={cell.date}
                    type="button"
                    disabled={future}
                    className={`cal__cell cal__cell--${tone}${cell.date === today ? " cal__cell--today" : ""}`}
                    aria-pressed={sel === cell.date}
                    aria-current={cell.date === today ? "date" : undefined}
                    aria-label={`${formatLongDate(cell.date)}: ${state}`}
                    onClick={() => pick(cell.date)}
                  >
                    <span className="cal__num">
                      {Number(cell.date.slice(8))}
                    </span>
                    <span className="cal__pct">
                      {live ? "…" : pct === null ? "" : `${Math.round(pct)}%`}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="legend small muted">
          <span>
            <i className="swatch swatch--met" /> {TONE_GOOD}%+ of habits
          </span>
          <span>
            <i className="swatch swatch--ok" /> {TONE_OK}–{TONE_GOOD - 1}%
          </span>
          <span>
            <i className="swatch swatch--bad" /> under {TONE_OK}%
          </span>
          <span>
            <i className="swatch swatch--skip" /> in progress / nothing tracked
          </span>
        </div>
        {stats.tracked > 0 ? (
          <p className="small">
            <strong>{stats.good}</strong> green · <strong>{stats.ok}</strong>{" "}
            amber · <strong>{stats.bad}</strong> red · average{" "}
            {Math.round(stats.avg)}% per day
          </p>
        ) : (
          <p className="muted small">
            Your daily completion will appear here once you start tracking.
          </p>
        )}
      </section>

      <div ref={panelRef}>
        {detail ? (
          <DayDetail
            key={sel}
            date={sel}
            detail={detail}
            today={today}
            todayFinal={todayFinal}
            editable={editable}
            lockedNote={lockedNote}
          />
        ) : (
          <p className="muted small">
            Tap a day to see what you did, and to add or fix entries.
          </p>
        )}
      </div>
    </>
  );
}
