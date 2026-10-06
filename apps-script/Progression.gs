// =====================================================================
// PROGRESSION.GS — generic target engine (no habit names, only configuration)
// Rule: target(date) = latest anchor with effectiveDate <= date, then
//       deterministic steps from that anchor, using the PLAN stored with that
//       anchor (or the habit's current settings for legacy anchors).
//       'pause' anchors freeze the target.
// =====================================================================

/** Snapshot of the settings that drive progression. Stored with each anchor so later edits never rewrite past days. */
function planOf_(h) {
  const n = (v) => (v === null || v === undefined || v === '') ? null : Number(v);
  return {
    enabled: !!h.progressionEnabled,
    amount: n(h.progressionAmount),
    interval: n(h.progressionInterval),
    unit: h.progressionUnit || 'days',
    end: n(h.endTarget),
    direction: h.goalDirection,
  };
}

function sortAnchors_(list) {
  return list.sort((a, b) => {
    if (a.effectiveDate !== b.effectiveDate) return a.effectiveDate < b.effectiveDate ? -1 : 1;
    return a.createdAt < b.createdAt ? -1 : (a.createdAt > b.createdAt ? 1 : 0);
  });
}

function anchorsFor_(habitId) {
  return sortAnchors_(readTable_(SHEETS.TARGETS).filter((r) => r.habitId === habitId).map(parseTarget_));
}

function anchorsByHabit_() {
  const map = Object.create(null);
  readTable_(SHEETS.TARGETS).map(parseTarget_).forEach((a) => {
    (map[a.habitId] = map[a.habitId] || []).push(a);
  });
  Object.keys(map).forEach((k) => sortAnchors_(map[k]));
  return map;
}

/** Number of completed progression steps between anchor and date. */
function stepsBetween_(anchor, date, interval, unit) {
  if (date <= anchor) return 0;
  if (unit === 'months') {
    const a = parseDate_(anchor);
    const d = parseDate_(date);
    const months = (d.getUTCFullYear() - a.getUTCFullYear()) * 12 + d.getUTCMonth() - a.getUTCMonth();
    let k = Math.floor(months / interval);
    while (k > 0 && addMonths_(anchor, k * interval) > date) k--;
    while (addMonths_(anchor, (k + 1) * interval) <= date) k++;
    return k;
  }
  const mult = unit === 'weeks' ? 7 : 1;
  return Math.floor(daysBetween_(anchor, date) / (interval * mult));
}

function stepDate_(anchor, n, interval, unit) {
  if (unit === 'months') return addMonths_(anchor, n * interval);
  return addDays_(anchor, n * interval * (unit === 'weeks' ? 7 : 1));
}

/**
 * @param habit   parsed habit (see parseHabit_); only used for anchors without a plan
 * @param anchors anchors for that habit, sorted ascending
 * @param date    YYYY-MM-DD
 */
function computeTarget_(habit, anchors, date) {
  let anchor = null;
  for (let i = 0; i < anchors.length; i++) {
    if (anchors[i].effectiveDate <= date) anchor = anchors[i]; else break;
  }
  if (!anchor) anchor = anchors[0] || { effectiveDate: habit.startDate, target: habit.startingTarget, reason: 'start' };

  const p = anchor.plan || planOf_(habit);
  const base = Number(anchor.target);
  const dir = p.direction === 'INCREASE' ? 1 : (p.direction === 'DECREASE' ? -1 : 0);
  const amount = Number(p.amount);
  const interval = Number(p.interval);
  const unit = p.unit || 'days';
  const end = (p.end === null || p.end === undefined || p.end === '') ? null : Number(p.end);

  const out = {
    target: base, anchorDate: anchor.effectiveDate, anchorReason: anchor.reason, steps: 0,
    frozen: false, capped: false, nextTarget: null, nextTargetDate: null, daysUntilIncrease: null,
  };

  out.frozen = !p.enabled || dir === 0 || anchor.reason === 'pause' || !(amount > 0) || !(interval >= 1);
  if (out.frozen) return out;

  // The end target is a cap (increase) or floor (decrease), but never pulls a manual target backwards.
  const clamp = (t) => {
    if (dir > 0) return end === null ? t : Math.min(t, Math.max(end, base));
    return end === null ? Math.max(0, t) : Math.max(t, Math.min(end, base));
  };

  const steps = stepsBetween_(anchor.effectiveDate, date, interval, unit);
  out.steps = steps;
  out.target = clamp(base + dir * amount * steps);

  const nextT = clamp(base + dir * amount * (steps + 1));
  if (nextT === out.target) {
    out.capped = true;
  } else {
    out.nextTarget = nextT;
    out.nextTargetDate = stepDate_(anchor.effectiveDate, steps + 1, interval, unit);
    out.daysUntilIncrease = daysBetween_(date, out.nextTargetDate);
  }
  return out;
}

/**
 * Stamps the habit's CURRENT plan onto every anchor that has none.
 * Called right before progression settings change, so old days keep the old rules.
 * Returns the updated anchors (createdAt doubles as "last modified" for incremental pull).
 */
function backfillPlans_(habit) {
  const rows = readTable_(SHEETS.TARGETS).filter((r) => r.habitId === habit.habitId && !r.plan);
  if (!rows.length) return [];
  const text = JSON.stringify(planOf_(habit));
  const now = nowIso_();
  return rows.map((r) => {
    const rec = Object.assign({}, r, { plan: text, createdAt: now });
    writeRecord_(SHEETS.TARGETS, r._row, rec);
    return parseTarget_(rec);
  });
}

/**
 * Insert or replace the anchor for (habit, date). One anchor per habit per day.
 * History is append-only: a date earlier than the latest anchor is rejected.
 * `plan` is the progression plan that applies from this anchor onwards.
 */
function upsertAnchor_(habitId, date, target, reason, plan) {
  const anchors = anchorsFor_(habitId);
  const latest = anchors[anchors.length - 1];
  const now = nowIso_();
  const planText = plan ? JSON.stringify(plan) : '';
  if (latest && date < latest.effectiveDate) {
    throw new ApiError(409, 'Target history is append-only: effectiveDate must be ' + latest.effectiveDate + ' or later', 'CONFLICT');
  }
  if (latest && latest.effectiveDate === date) {
    const rec = {
      changeId: latest.changeId, habitId: habitId, effectiveDate: date, target: target,
      reason: (latest.reason === 'start' && reason === 'manual') ? 'start' : reason,
      createdAt: now, plan: planText,
    };
    writeRecord_(SHEETS.TARGETS, indexIds_(SHEETS.TARGETS)[latest.changeId], rec);
    return parseTarget_(rec);
  }
  const rec = { changeId: newId_('tc'), habitId: habitId, effectiveDate: date, target: target, reason: reason, createdAt: now, plan: planText };
  appendRecords_(SHEETS.TARGETS, [rec]);
  return parseTarget_(rec);
}