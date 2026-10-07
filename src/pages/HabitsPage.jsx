import { useMemo, useState } from "react";
import { Link } from "react-router";
import PageHeader from "../components/common/PageHeader";
import EmptyState from "../components/common/EmptyState";
import { describeError } from "../api/api";
import { useAppState, useAppActions } from "../store/AppContext";
import { useAnchorsByHabit } from "../hooks/useAnchors";
import { computeTarget } from "../engine/progression";
import { describeHabit, formatAmount } from "../utils/format";
import { formatShortDate, todayStr } from "../utils/date";

const FALLBACK_CATEGORY = {
  categoryId: "cat_other",
  name: "Other",
  icon: "📌",
  sortOrder: 999,
};

export default function HabitsPage() {
  const { ready, habits, categories, sync } = useAppState();
  const actions = useAppActions();
  const anchors = useAnchorsByHabit();
  const [error, setError] = useState("");
  const today = todayStr();

  const { groups, archived, total } = useMemo(() => {
    const catMap = new Map(categories.map((c) => [c.categoryId, c]));
    const byCat = new Map();
    habits
      .filter((h) => h.status !== "archived")
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .forEach((h) => {
        const cat = catMap.get(h.categoryId) || FALLBACK_CATEGORY;
        if (!byCat.has(cat.categoryId))
          byCat.set(cat.categoryId, { category: cat, items: [] });
        byCat
          .get(cat.categoryId)
          .items.push({
            habit: h,
            info: computeTarget(h, anchors.get(h.habitId) || [], today),
          });
      });
    const list = [...byCat.values()].sort(
      (a, b) => a.category.sortOrder - b.category.sortOrder,
    );
    return {
      groups: list,
      archived: habits.filter((h) => h.status === "archived"),
      total: list.reduce((n, g) => n + g.items.length, 0),
    };
  }, [habits, categories, anchors, today]);

  async function restore(id) {
    setError("");
    try {
      await actions.setHabitStatus(id, "active");
    } catch (err) {
      setError(describeError(err));
    }
  }

  const addButton = (
    <div className="btn-row" style={{ marginTop: 0 }}>
      <Link className="btn" to="/schedule">
        Schedule
      </Link>
      <Link className="btn btn--primary" to="/habits/new">
        + Add
      </Link>
    </div>
  );

  if (!ready)
    return (
      <>
        <PageHeader title="Habits" />
        <p className="muted">Loading…</p>
      </>
    );

  if (!groups.length) {
    const waiting = sync.phase === "syncing";
    return (
      <>
        <PageHeader title="Habits" />
        <EmptyState
          title={
            waiting ? "Loading your habits…" : "Start building your routine"
          }
          message={
            waiting
              ? "Fetching from Google Sheets."
              : sync.phase === "error" || sync.phase === "offline"
                ? sync.error ||
                  "You are offline and nothing is cached yet. Connect once to load your habits."
                : "Create your first habit."
          }
        >
          {!waiting && (
            <Link className="btn btn--primary" to="/habits/new">
              + Add Habit
            </Link>
          )}
        </EmptyState>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Habits"
        subtitle={`${total} habits`}
        action={addButton}
      />
      {groups.map(({ category, items }) => (
        <section
          key={category.categoryId}
          className="habit-group"
          aria-label={category.name}
        >
          <h2 className="habit-group__title">
            <span aria-hidden="true">{category.icon}</span> {category.name}
          </h2>
          <ul className="habit-list">
            {items.map(({ habit: h, info }) => (
              <li key={h.habitId} className="habit-row habit-row--link">
                <Link className="habit-link" to={`/habits/${h.habitId}`}>
                  <span className="habit-row__icon" aria-hidden="true">
                    {h.icon}
                  </span>
                  <div className="habit-row__main">
                    <div className="habit-row__name">
                      {h.name}
                      {h.status === "paused" && (
                        <span className="tag">Paused</span>
                      )}
                    </div>
                    <div className="muted small">
                      {describeHabit(h, info.target)}
                    </div>
                    {info.nextTarget !== null && h.status === "active" && (
                      <div className="muted small">
                        Next: {formatAmount(h, info.nextTarget)} on{" "}
                        {formatShortDate(info.nextTargetDate)}
                      </div>
                    )}
                  </div>
                  {h.scheduleTime && (
                    <span className="muted small">{h.scheduleTime}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {archived.length > 0 && (
        <details className="archived">
          <summary>Archived ({archived.length})</summary>
          <ul className="plain-list">
            {archived.map((h) => (
              <li key={h.habitId} className="entry-row">
                <span>
                  {h.icon} {h.name}
                </span>
                <button
                  className="btn btn--small"
                  onClick={() => restore(h.habitId)}
                >
                  Restore
                </button>
              </li>
            ))}
          </ul>
          {error && (
            <p className="text-danger small" role="alert">
              {error}
            </p>
          )}
        </details>
      )}
    </>
  );
}
