// import PageHeader from '../components/common/PageHeader';
// import EmptyState from '../components/common/EmptyState';
// import { greeting, todayStr, formatLongDate } from '../utils/date';
// import { Link } from 'react-router';

// export default function HomePage() {
//   const today = todayStr();
//   return (
//     <>
//       <PageHeader title={`${greeting()} 👋`} subtitle={formatLongDate(today)} />
//       <EmptyState
//         title="Start building your routine"
//         message="Create your first habit to see today's progress here."
//       >
//         {/* <button className="btn btn--primary" disabled>
//           + Add Habit (Phase 5)
//         </button> */}
//         <Link className="btn btn--primary" to="/habits/new">+ Add Habit</Link>
//       </EmptyState>
//     </>
//   );
// }

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useTimers } from "../hooks/useTimers";
import { startSession } from "../services/timerService";
import PageHeader from "../components/common/PageHeader";
import EmptyState from "../components/common/EmptyState";
import DaySummary from "../components/dashboard/DaySummary";
import HabitCard from "../components/dashboard/HabitCard";
import Agenda from "../components/dashboard/Agenda";
import UndoBar from "../components/dashboard/UndoBar";
import { useAppState, useAppActions } from "../store/AppContext";
import { useDaily } from "../hooks/useDaily";
import { formatLongDate, greeting } from "../utils/date";
import { formatQuick } from "../utils/format";
import { findWaterHabit, waterIncrementMl } from "../utils/water";
import CheckinPrompt from "../components/dashboard/CheckinPrompt";
import { isCheckinDue } from "../engine/checkin";

export default function HomePage() {
  const { ready, habits, settings, dayStatus } = useAppState();
  const actions = useAppActions();
  const { today, minutes, data } = useDaily();
  const navigate = useNavigate();
  const { timers } = useTimers();
  const [undo, setUndo] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!undo) return undefined;
    const id = setTimeout(() => setUndo(null), 6000);
    return () => clearTimeout(id);
  }, [undo]);

  const name =
    settings.profileName && settings.profileName !== "Me"
      ? `, ${settings.profileName}`
      : "";
  const header = (
    <PageHeader
      title={`${greeting(minutes)}${name} 👋`}
      subtitle={formatLongDate(today)}
    />
  );

  async function handleAdd(habit, delta) {
    setError("");
    try {
      const entry = await actions.addEntry(habit, delta, { date: today });
      setUndo({
        entryId: entry.entryId,
        label: `${formatQuick(habit, delta)} · ${habit.name}`,
      });
    } catch (err) {
      console.error(err);
      setError("Could not save that. Please try again.");
    }
  }

  async function handleCheck(habit, delta) {
    setError("");
    try {
      const entry = await actions.addEntry(habit, delta, {
        date: today,
        source: "checkin",
      });
      setUndo({
        entryId: entry.entryId,
        label: `${habit.name}: ${delta === 1 ? "done" : "slip recorded"}`,
      });
    } catch (err) {
      console.error(err);
      setError("Could not save that. Please try again.");
    }
  }

  async function handleUncheck(item) {
    setError("");
    try {
      await actions.removeEntry(item.entryId);
    } catch (err) {
      console.error(err);
      setError("Could not undo that.");
    }
  }

  async function handleUndo() {
    const u = undo;
    setUndo(null);
    try {
      await actions.removeEntry(u.entryId);
    } catch (err) {
      console.error(err);
      setError("Could not undo that.");
    }
  }

  async function handleStartTimer(item) {
    setError("");
    try {
      await startSession({
        habit: item.habit,
        date: today,
        targetSec: item.calc.target,
        loggedSec: item.calc.actual,
      });
      navigate(`/timer/${item.habit.habitId}`);
    } catch (err) {
      console.error(err);
      setError("Could not start the timer.");
    }
  }
  if (!ready)
    return (
      <>
        {header}
        <p className="muted">Loading…</p>
      </>
    );

  if (!habits.some((h) => h.status !== "archived")) {
    return (
      <>
        {header}
        <EmptyState
          title="Start building your routine"
          message="Create your first habit."
        >
          <Link className="btn btn--primary" to="/habits/new">
            + Add Habit
          </Link>
        </EmptyState>
      </>
    );
  }

  const { groups, summary, agenda, wins, final, items } = data;
  const closed = dayStatus.some((d) => d.date === today && d.closed);
  const due = isCheckinDue({
    minutes,
    checkinTime: settings.checkinTime,
    closed,
  });
  const water = findWaterHabit(habits, settings);
  const glassMl = waterIncrementMl(settings);
  const card = (item) => {
    const isWater = Boolean(water) && item.habit.habitId === water.habitId;
    return (
      <HabitCard
        key={item.habit.habitId}
        item={item}
        timer={timers.get(item.habit.habitId)}
        glass={isWater ? { delta: glassMl } : undefined}
        detailsTo={
          item.habit.trackingType === "QUANTITY"
            ? `/quantity/${item.habit.habitId}`
            : undefined
        }
        onAdd={handleAdd}
        onCheck={handleCheck}
        onUncheck={handleUncheck}
        onStartTimer={handleStartTimer}
      />
    );
  };

  if (!items.length) {
    return (
      <>
        {header}
        <EmptyState
          title="Nothing scheduled today"
          message="None of your active habits are scheduled for today."
        >
          <Link className="btn" to="/habits">
            Manage habits
          </Link>
        </EmptyState>
      </>
    );
  }

  return (
    <>
      {header}
      {error && (
        <p className="text-danger" role="alert">
          {error}
        </p>
      )}
      <DaySummary summary={summary} final={final} />
      <CheckinPrompt due={due} closed={closed} />

      {groups.focus.length > 0 && (
        <section aria-label="Today's focus">
          <h2 className="section-title">🔥 Today&apos;s Focus</h2>
          {groups.focus.map(card)}
        </section>
      )}
      {groups.focus.length === 0 &&
        summary.total > 0 &&
        summary.doneCount === summary.total && (
          <p className="all-done">Everything on your list is done 🎉</p>
        )}

      {groups.limits.length > 0 && (
        <section aria-label="Limits">
          <h2 className="section-title">Limits</h2>
          {groups.limits.map(card)}
        </section>
      )}

      {groups.done.length > 0 && (
        <section aria-label="Logged today">
          <h2 className="section-title">Done</h2>
          {groups.done.map(card)}
        </section>
      )}

      <Agenda agenda={agenda} />

      {wins.length > 0 && (
        <section className="card" aria-label="Yesterday">
          <h2>Yesterday</h2>
          <p className="muted small">You improved:</p>
          <ul className="plain-list">
            {wins.map((w) => (
              <li key={w.habit.habitId} className="small">
                <span aria-hidden="true">{w.habit.icon}</span> {w.habit.name}{" "}
                <strong>{w.text}</strong>
              </li>
            ))}
          </ul>
        </section>
      )}

      <UndoBar undo={undo} onUndo={handleUndo} />
    </>
  );
}
