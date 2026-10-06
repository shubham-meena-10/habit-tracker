// Generic target engine. Port of Progression.gs: keep the two in sync.
// Rule: target(date) = latest anchor with effectiveDate <= date, then
//       deterministic steps from that anchor. 'pause' anchors freeze it.
import { addDays, addMonths, daysBetween, parseDate } from "../utils/date";

export function sortAnchors(list) {
  return [...list].sort((a, b) => {
    if (a.effectiveDate !== b.effectiveDate)
      return a.effectiveDate < b.effectiveDate ? -1 : 1;
    return (a.createdAt || "") < (b.createdAt || "")
      ? -1
      : (a.createdAt || "") > (b.createdAt || "")
        ? 1
        : 0;
  });
}

/** targetChanges[] -> Map(habitId -> sorted anchors[]) */
export function groupAnchors(targetChanges) {
  const map = new Map();
  targetChanges.forEach((a) => {
    if (!map.has(a.habitId)) map.set(a.habitId, []);
    map.get(a.habitId).push(a);
  });
  map.forEach((list, k) => map.set(k, sortAnchors(list)));
  return map;
}

/** Completed progression steps between anchor and date. */
export function stepsBetween(anchor, date, interval, unit) {
  if (date <= anchor) return 0;
  if (unit === "months") {
    const a = parseDate(anchor);
    const d = parseDate(date);
    const months =
      (d.getUTCFullYear() - a.getUTCFullYear()) * 12 +
      d.getUTCMonth() -
      a.getUTCMonth();
    let k = Math.floor(months / interval);
    while (k > 0 && addMonths(anchor, k * interval) > date) k--;
    while (addMonths(anchor, (k + 1) * interval) <= date) k++;
    return k;
  }
  const mult = unit === "weeks" ? 7 : 1;
  return Math.floor(daysBetween(anchor, date) / (interval * mult));
}

export function stepDate(anchor, n, interval, unit) {
  if (unit === "months") return addMonths(anchor, n * interval);
  return addDays(anchor, n * interval * (unit === "weeks" ? 7 : 1));
}

/**
 * Each anchor carries the plan in force when it was written; anchors without one
 * (created before Phase 9) fall back to the habit's current settings.
 * @returns {{target, anchorDate, anchorReason, steps, frozen, capped,
 *            nextTarget, nextTargetDate, daysUntilIncrease}}
 */
export function computeTarget(habit, anchors, date) {
  let anchor = null;
  for (let i = 0; i < anchors.length; i++) {
    if (anchors[i].effectiveDate <= date) anchor = anchors[i];
    else break;
  }
  if (!anchor) {
    anchor = anchors[0] || {
      effectiveDate: habit.startDate,
      target: habit.startingTarget,
      reason: "start",
    };
  }

  const p = anchor.plan || planOf(habit);
  const base = Number(anchor.target);
  const dir =
    p.direction === "INCREASE" ? 1 : p.direction === "DECREASE" ? -1 : 0;
  const amount = Number(p.amount);
  const interval = Number(p.interval);
  const unit = p.unit || "days";
  const end =
    p.end === null || p.end === undefined || p.end === ""
      ? null
      : Number(p.end);

  const out = {
    target: base,
    anchorDate: anchor.effectiveDate,
    anchorReason: anchor.reason,
    steps: 0,
    frozen: false,
    capped: false,
    nextTarget: null,
    nextTargetDate: null,
    daysUntilIncrease: null,
  };

  out.frozen =
    !p.enabled ||
    dir === 0 ||
    anchor.reason === "pause" ||
    !(amount > 0) ||
    !(interval >= 1);
  if (out.frozen) return out;

  // The end target is a cap (increase) or floor (decrease), never pulling a manual target backwards.
  const clamp = (t) => {
    if (dir > 0) return end === null ? t : Math.min(t, Math.max(end, base));
    return end === null ? Math.max(0, t) : Math.max(t, Math.min(end, base));
  };

  const steps = stepsBetween(anchor.effectiveDate, date, interval, unit);
  out.steps = steps;
  out.target = clamp(base + dir * amount * steps);

  const nextT = clamp(base + dir * amount * (steps + 1));
  if (nextT === out.target) {
    out.capped = true;
  } else {
    out.nextTarget = nextT;
    out.nextTargetDate = stepDate(
      anchor.effectiveDate,
      steps + 1,
      interval,
      unit,
    );
    out.daysUntilIncrease = daysBetween(date, out.nextTargetDate);
  }
  return out;
}
/** "Days 1-14 → 5, 15-28 → 10 …": levels a progression will go through, from a start date. */
export function previewLevels(habit, startDate, startTarget, count = 5) {
  const anchors = [
    {
      effectiveDate: startDate,
      target: startTarget,
      reason: "start",
      createdAt: "",
    },
  ];
  const out = [];
  let from = startDate;
  for (let i = 0; i < count; i++) {
    const info = computeTarget(habit, anchors, from);
    out.push({
      from,
      to: info.nextTargetDate ? addDays(info.nextTargetDate, -1) : null,
      target: info.target,
    });
    if (!info.nextTargetDate) break;
    from = info.nextTargetDate;
  }
  return out;
}

/** Start vs current level, for the habit detail page (Phase 10). */
export function levelSummary(habit, anchors, date) {
  const start = anchors.length
    ? Number(anchors[0].target)
    : Number(habit.startingTarget);
  const current = computeTarget(habit, anchors, date).target;
  return {
    start,
    current,
    changePct: start > 0 ? ((current - start) / start) * 100 : null,
  };
}

/** Snapshot of the settings that drive progression (mirrors planOf_ in Progression.gs). */
export function planOf(h) {
  const n = (v) =>
    v === null || v === undefined || v === "" ? null : Number(v);
  return {
    enabled: Boolean(h.progressionEnabled),
    amount: n(h.progressionAmount),
    interval: n(h.progressionInterval),
    unit: h.progressionUnit || "days",
    end: n(h.endTarget),
    direction: h.goalDirection,
  };
}

/** Upcoming levels from `from`, following the real anchors. The first row is the level in force on `from`. */
export function projectLevels(habit, anchors, from, count = 5) {
  const out = [];
  let d = from;
  for (let i = 0; i < count; i++) {
    const info = computeTarget(habit, anchors, d);
    out.push({ from: d, to: info.nextTargetDate ? addDays(info.nextTargetDate, -1) : null, target: info.target });
    if (!info.nextTargetDate) break;
    d = info.nextTargetDate;
  }
  return out;
}

/**
 * What actually applied, from the first anchor up to `today`:
 * one row per level, tagged with why it started (start/manual/pause/resume/reset, or 'progress' for an automatic step).
 */
export function levelTimeline(habit, anchors, today) {
  const list = sortAnchors(anchors).filter((a) => a.effectiveDate <= today);
  const out = [];
  list.forEach((a, i) => {
    const limit = i + 1 < list.length ? addDays(list[i + 1].effectiveDate, -1) : today;
    let from = a.effectiveDate;
    for (let guard = 0; from <= limit && guard < 2000; guard++) {
      const info = computeTarget(habit, anchors, from);
      const step = info.nextTargetDate;
      const stepEnd = step ? addDays(step, -1) : null;
      const to = stepEnd && stepEnd < limit ? stepEnd : limit;
      out.push({ from, to, target: info.target, reason: from === a.effectiveDate ? a.reason : 'progress' });
      if (!step || step > limit) break;
      from = step;
    }
  });
  return out;
}