// Builds everything the dashboard shows for one day. Pure and generic:
// behaviour depends on tracking type, goal direction and configuration only.
import { TRACKING_TYPES as T } from "../constants/trackingTypes";
import { addDays } from "../utils/date";
import {
  formatAmount,
  formatPair,
  formatQuick,
  formatTime12,
  isTimeUnit,
} from "../utils/format";
import {
  calcDay,
  compareValues,
  dayTotal,
  isCheckHabit,
  isScheduledOn,
  lowerIsBetter,
} from "./calculations";
import { computeTarget } from "./progression";

const SOON_MINUTES = 60;

export function minutesOf(hhmm) {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** A day is "final" once it is in the past, was closed by the user, or the close time has passed. */
export function isDayFinal({ date, today, minutes, closeTime, closed }) {
  if (date < today) return true;
  if (date > today) return false;
  if (closed) return true;
  const close = minutesOf(closeTime || "23:59");
  return close !== null && minutes >= close;
}

/** One-tap buttons in BASE units: the habit's own list, else generic defaults by type. */
export function quickAddsFor(habit) {
  if (isCheckHabit(habit)) return [];
  if (Array.isArray(habit.quickAdds) && habit.quickAdds.length)
    return habit.quickAdds;
  const f = habit.unitFactor || 1;
  switch (habit.trackingType) {
    case T.TIMER:
    case T.DURATION:
      return isTimeUnit(habit.unit) && f === 1 ? [10, 30, 60] : [60, 300, 600];
    case T.QUANTITY:
      if (
        String(habit.unit || "")
          .trim()
          .toLowerCase() === "ml" &&
        f === 1
      )
        return [250, 500, 1000];
      return f > 1 ? [f / 4, f / 2, f] : [1, 5, 10];
    case T.LIMIT:
      return [1, -1];
    default:
      return [1, 5, 10];
  }
}

function buildItem({
  habit,
  info,
  calc,
  yd,
  today,
  minutes,
  final,
  prevTarget,
}) {
  const check = isCheckHabit(habit);
  const limitLike = !check && lowerIsBetter(habit);
  const sched = minutesOf(habit.scheduleTime);
  const fa = (v) => formatAmount(habit, v);

  let bucket;
  let done;
  let counted;
  let score;
  let ok = true;

  if (check) {
    done = calc.completed;
    bucket =
      calc.state === "pending" || calc.state === "none" ? "focus" : "done";
    counted = true;
    score = done ? 100 : 0;
    ok = calc.state !== "slip";
  } else if (limitLike) {
    bucket = "limits";
    done = calc.completed && final;
    counted = final || !calc.completed;
    score = counted ? (calc.completed ? 100 : calc.percentage) : 0;
    ok = calc.completed;
  } else {
    done = calc.completed;
    bucket = done ? "done" : "focus";
    counted = true;
    score = done ? 100 : Math.min(100, calc.percentage);
  }

  const pending = bucket === "focus";
  const overdue = pending && !final && sched !== null && sched < minutes;
  const soon =
    pending &&
    !final &&
    sched !== null &&
    sched >= minutes &&
    sched - minutes <= SOON_MINUTES;

  // ----- text -----
  let valueText;
  let subText = "";
  if (habit.trackingType === T.BOOLEAN) {
    valueText = done ? "Done ✓" : "Not yet";
    if (!done && final) subText = "Not completed";
  } else if (habit.trackingType === T.ABSTINENCE) {
    valueText =
      calc.state === "success"
        ? "Clean ✓"
        : calc.state === "slip"
          ? "Slipped"
          : "Check in";
    if (calc.state === "pending" && final) subText = "Not checked in";
  } else {
    valueText =
      formatPair(habit, calc.actual, calc.target) + (done ? " ✓" : "");
    if (limitLike) {
      if (!calc.completed) subText = `${fa(calc.over)} over limit`;
      else if (final) subText = "Within limit";
      else subText = `${fa(calc.remaining)} left`;
    } else if (done) {
      if (calc.extra > 0)
        subText = `+${fa(calc.extra)} extra · ${Math.round(calc.percentage)}%`;
      else if (calc.percentage < 100)
        subText = `${Math.round(calc.percentage)}% · minimum met`;
    } else {
      const parts = [];
      if (calc.actual > 0) parts.push(`${fa(calc.remaining)} to go`);
      if (final) parts.push("Not completed");
      subText = parts.join(" · ");
    }
  }

  let tone = "neutral";
  if (done && ok) tone = "done";
  else if (!ok) tone = "bad";
  else if (overdue) tone = "warn";

  let barPct;
  if (check) barPct = done ? 100 : 0;
  else if (limitLike)
    barPct =
      calc.target > 0
        ? Math.min(100, (calc.actual / calc.target) * 100)
        : calc.actual > 0
          ? 100
          : 0;
  else barPct = Math.min(100, calc.percentage);

  let compare = null;
  if (!check && yd.count > 0) {
    const c = compareValues(habit, calc.actual, yd.total);
    if (c) {
      const arrow =
        c.direction === "up" ? "↑" : c.direction === "down" ? "↓" : "=";
      const change =
        c.direction === "same"
          ? "same"
          : `${arrow} ${formatQuick(habit, c.diff)}`;
      const verdict =
        c.good === true ? " · better" : c.good === false ? " · worse" : "";
      compare = {
        good: c.good,
        text: `Yesterday ${fa(yd.total)} · ${change}${verdict}`,
      };
    }
  }

  // ----- progression hints -----
  let levelUp = null;
  let progressNote = "";
  if (!check) {
    const word = limitLike ? "limit" : "target";
    if (
      prevTarget !== null &&
      prevTarget !== undefined &&
      prevTarget !== info.target
    ) {
      levelUp = `New ${word} today: ${fa(info.target)} (was ${fa(prevTarget)})`;
    }
    if (info.nextTarget !== null && info.daysUntilIncrease <= 7) {
      const when =
        info.daysUntilIncrease === 1
          ? "tomorrow"
          : `in ${info.daysUntilIncrease} days`;
      progressNote = `Next ${word} ${when}: ${fa(info.nextTarget)}`;
    }
  }

  return {
    habit,
    info,
    calc,
    bucket,
    done,
    counted,
    score,
    ok,
    tone,
    barPct,
    overdue,
    soon,
    sched,
    valueText,
    subText,
    compare,
    levelUp,
    progressNote,
    timeLabel: formatTime12(habit.scheduleTime),
    statusText: overdue
      ? `Scheduled for ${formatTime12(habit.scheduleTime)} · not completed`
      : "",
    quick: quickAddsFor(habit),
    entryId: check ? `chk_${habit.habitId}_${today}` : null,
    
  };
}

const byTimeThenOrder = (a, b) =>
  (a.sched === null ? 1e9 : a.sched) - (b.sched === null ? 1e9 : b.sched) ||
  a.habit.sortOrder - b.habit.sortOrder;
const rank = (i) => (i.overdue ? 0 : i.soon ? 1 : 2);

export function buildDaily({
  habits,
  anchorsByHabit,
  totals,
  dayStatus,
  settings,
  today,
  minutes,
}) {
  const closed = dayStatus.some((d) => d.date === today && d.closed);
  const final = isDayFinal({
    date: today,
    today,
    minutes,
    closeTime: settings.dayCloseTime,
    closed,
  });
  const yesterday = addDays(today, -1);
  const dayBefore = addDays(today, -2);

  const items = [];
   habits.forEach((habit) => {
    if (habit.status !== 'active' || !isScheduledOn(habit, today)) return;
    const anchors = anchorsByHabit.get(habit.habitId) || [];
    const info = computeTarget(habit, anchors, today);
    const prevTarget = yesterday >= habit.startDate ? computeTarget(habit, anchors, yesterday).target : null;
    const { total, count } = dayTotal(totals, habit.habitId, today);
    const calc = calcDay(habit, info.target, total, count);
    const yd = dayTotal(totals, habit.habitId, yesterday);
    items.push(buildItem({ habit, info, calc, yd, today, minutes, final, prevTarget }));
  });

  const focus = items
    .filter((i) => i.bucket === "focus")
    .sort((a, b) => rank(a) - rank(b) || byTimeThenOrder(a, b));
  const limits = items
    .filter((i) => i.bucket === "limits")
    .sort(byTimeThenOrder);
  const done = items.filter((i) => i.bucket === "done").sort(byTimeThenOrder);

  const counted = items.filter((i) => i.counted);
  const summary = {
    total: counted.length,
    doneCount: counted.filter((i) => i.done).length,
    percent: counted.length
      ? Math.round(counted.reduce((s, i) => s + i.score, 0) / counted.length)
      : 0,
    watching: items.filter((i) => i.bucket === "limits" && !i.counted).length,
  };

  const agenda = items
    .filter((i) => i.sched !== null)
    .sort(byTimeThenOrder)
    .map((i) => ({
      habitId: i.habit.habitId,
      icon: i.habit.icon,
      name: i.habit.name,
      timeLabel: i.timeLabel,
      minutes: i.sched,
      status: i.done
        ? "done"
        : final || !i.ok
          ? "missed"
          : i.overdue
            ? "overdue"
            : "upcoming",
      detail:
        i.habit.trackingType === T.BOOLEAN ||
        i.habit.trackingType === T.ABSTINENCE
          ? ""
          : formatAmount(i.habit, i.calc.target),
    }));

  // Yesterday vs the day before (finished days only; check-type habits excluded).
  const wins = [];
  habits.forEach((habit) => {
    if (
      habit.status !== "active" ||
      isCheckHabit(habit) ||
      !isScheduledOn(habit, yesterday)
    )
      return;
    const a = dayTotal(totals, habit.habitId, yesterday);
    const b = dayTotal(totals, habit.habitId, dayBefore);
    if (!a.count || !b.count) return;
    const c = compareValues(habit, a.total, b.total);
    if (c && c.good === true)
      wins.push({ habit, text: formatQuick(habit, c.diff) });
  });

  return {
    final,
    items,
    groups: { focus, limits, done },
    summary,
    agenda,
    wins: wins.slice(0, 5),
  };
}
