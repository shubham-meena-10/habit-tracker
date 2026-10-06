// =====================================================================
// HABITS.GS — habits, targets, categories
// =====================================================================
const DEFAULT_HABIT_ = {
  icon: '⭐', categoryId: 'cat_other', description: '', trackingType: 'COUNT', goalDirection: 'INCREASE',
  unit: '', unitFactor: 1, startingTarget: 0, minTarget: null, endTarget: null,
  weekdays: [0, 1, 2, 3, 4, 5, 6], scheduleTime: '', reminderTime: '',
  progressionEnabled: false, progressionAmount: null, progressionInterval: null, progressionUnit: 'days',
  quickAdds: [], status: 'active', sortOrder: 0,
};

function loadHabit_(habitId) {
  const row = indexIds_(SHEETS.HABITS)[habitId];
  if (!row) throw new ApiError(404, 'Habit not found', 'NOT_FOUND');
  const rec = readRecord_(SHEETS.HABITS, row);
  return { row: row, rec: rec, habit: parseHabit_(rec) };
}

function hasEntries_(habitId) {
  const sh = sheet_(SHEETS.ENTRIES);
  const last = sh.getLastRow();
  if (last < 2) return false;
  const col = sh.getRange(2, 2, last - 1, 1).getValues();
  for (let i = 0; i < col.length; i++) if (String(col[i][0]) === habitId) return true;
  return false;
}

// ---------- saveHabit: create (no habitId / unknown habitId) or update ----------
function apiSaveHabit_(data) {
  const input = data.habit || data;
  if (!input || typeof input !== 'object') throw vErr_('habit is required');

  const today = today_();
  const habitRows = readTable_(SHEETS.HABITS);
  const categories = readTable_(SHEETS.CATEGORIES);
  const existingRec = input.habitId ? habitRows.filter((r) => r.habitId === input.habitId)[0] : null;
  const old = existingRec ? parseHabit_(existingRec) : null;
  const isNew = !old;

  const base = old || DEFAULT_HABIT_;
  const v = (k) => (input[k] !== undefined ? input[k] : base[k]);

  const h = {};
  h.habitId = isNew ? (input.habitId ? idField_(input.habitId, 'habitId') : newId_('h')) : old.habitId;
  h.name = str_(v('name'), 'name', 60, true);
  h.icon = str_(v('icon'), 'icon', 16, false) || '⭐';
  h.description = str_(v('description'), 'description', 300, false);
  h.categoryId = str_(v('categoryId'), 'categoryId', 60, true);
  if (!categories.some((c) => c.categoryId === h.categoryId)) throw vErr_('Unknown categoryId');

  h.trackingType = enumField_(v('trackingType'), TRACKING_TYPES_, 'trackingType');
  if (!isNew && h.trackingType !== old.trackingType && hasEntries_(old.habitId)) {
    throw new ApiError(409, 'trackingType cannot change once a habit has entries. Create a new habit instead.', 'CONFLICT');
  }

  let dir = v('goalDirection');
  if (isNew && input.goalDirection === undefined) {
    dir = h.trackingType === 'LIMIT' ? 'DECREASE' : (h.trackingType === 'ABSTINENCE' ? 'AVOID' : 'INCREASE');
  }
  h.goalDirection = enumField_(dir, GOAL_DIRECTIONS_, 'goalDirection');

  h.unit = str_(v('unit'), 'unit', 20, false);
  h.unitFactor = numField_(v('unitFactor'), 'unitFactor', { min: 0.000001 }) || 1;

  // startDate + startingTarget are history anchors: set once, never edited here.
  h.startDate = isNew ? dateField_(input.startDate || today, 'startDate') : old.startDate;
  if (h.trackingType === 'BOOLEAN') h.startingTarget = 1;
  else if (h.trackingType === 'ABSTINENCE') h.startingTarget = 0;
  else h.startingTarget = isNew ? numField_(input.startingTarget, 'startingTarget', { required: true, min: 0 }) : old.startingTarget;

  h.minTarget = numField_(v('minTarget'), 'minTarget', { min: 0 });
  h.endTarget = numField_(v('endTarget'), 'endTarget', { min: 0 });
  h.weekdays = weekdaysField_(v('weekdays'));
  h.scheduleTime = timeField_(v('scheduleTime'), 'scheduleTime');
  h.reminderTime = timeField_(v('reminderTime'), 'reminderTime');
  h.progressionEnabled = bool_(v('progressionEnabled'));
  h.progressionAmount = numField_(v('progressionAmount'), 'progressionAmount', { min: 0 });
  h.progressionInterval = numField_(v('progressionInterval'), 'progressionInterval', { min: 1, integer: true });
  h.progressionUnit = enumField_(v('progressionUnit') || 'days', PROGRESSION_UNITS_, 'progressionUnit');
  h.quickAdds = quickAddsField_(v('quickAdds'));
  h.status = isNew ? 'active' : old.status;
  h.sortOrder = isNew
    ? habitRows.reduce((m, r) => Math.max(m, num_(r.sortOrder, 0)), 0) + 1
    : (input.sortOrder !== undefined ? (numField_(input.sortOrder, 'sortOrder', {}) || 0) : old.sortOrder);

  // Type-specific normalisation
  if (h.trackingType === 'BOOLEAN' || h.trackingType === 'ABSTINENCE') {
    h.goalDirection = h.trackingType === 'BOOLEAN' ? 'INCREASE' : 'AVOID';
    h.progressionEnabled = false;
    h.progressionAmount = null; h.progressionInterval = null;
    h.minTarget = null; h.endTarget = null;
  }
  if (h.trackingType === 'LIMIT' && h.goalDirection === 'INCREASE') {
    throw vErr_('LIMIT habits need goalDirection DECREASE, MAINTAIN or AVOID');
  }
  if (h.progressionEnabled) {
    if (h.goalDirection !== 'INCREASE' && h.goalDirection !== 'DECREASE') throw vErr_('Progression needs goalDirection INCREASE or DECREASE');
    if (!(h.progressionAmount > 0)) throw vErr_('progressionAmount must be greater than 0');
    if (!h.progressionInterval) throw vErr_('progressionInterval is required when progression is enabled');
  }

  const lower = h.name.toLowerCase();
  if (habitRows.some((r) => r.habitId !== h.habitId && r.status !== 'archived' && String(r.name).toLowerCase() === lower)) {
    throw new ApiError(409, 'A habit named "' + h.name + '" already exists', 'CONFLICT');
  }

  const now = nowIso_();
  const changes = [];

  if (isNew) {
    h.createdAt = now; h.updatedAt = now;
    appendRecords_(SHEETS.HABITS, [habitToRecord_(h)]);
    // changes.push(upsertAnchor_(h.habitId, h.startDate, h.startingTarget, 'start'));
    changes.push(upsertAnchor_(h.habitId, h.startDate, h.startingTarget, 'start', planOf_(h)));
  } else {
    // Changing progression settings must not rewrite past targets:
    // freeze today's target (computed with the OLD settings) as a new anchor first.
    const norm = (x) => (x === null || x === undefined || x === '') ? '' : String(x);
    const progChanged = ['progressionEnabled', 'progressionAmount', 'progressionInterval', 'progressionUnit', 'endTarget', 'goalDirection']
      .some((k) => norm(old[k]) !== norm(h[k]));
    if (progChanged) {
      // Anchors without a plan are stamped with the OLD settings first, so changing
      // the interval or amount can never rewrite earlier days.
      backfillPlans_(old).forEach((c) => changes.push(c));
      const anchors = anchorsFor_(old.habitId);
      const latest = anchors[anchors.length - 1];
      if (!latest || latest.reason !== 'pause') {
        const when = (latest && latest.effectiveDate > today) ? latest.effectiveDate : today;
        const current = computeTarget_(old, anchors, when).target;
        changes.push(upsertAnchor_(old.habitId, when, current, 'manual', planOf_(h)));
      }
    }
    h.createdAt = old.createdAt; h.updatedAt = now;
    writeRecord_(SHEETS.HABITS, existingRec._row, habitToRecord_(h));
  }
  return { created: isNew, habit: h, targetChanges: changes };
}

// ---------- setHabitStatus: active / paused / archived ----------
function apiSetHabitStatus_(data) {
  const habitId = idField_(data.habitId, 'habitId');
  const status = enumField_(data.status, HABIT_STATUSES_, 'status');
  const loaded = loadHabit_(habitId);
  const rec = loaded.rec;
  const habit = loaded.habit;
  const today = today_();

  if (habit.status !== status) {
    rec.status = status;
    rec.updatedAt = nowIso_();
    writeRecord_(SHEETS.HABITS, loaded.row, rec);
  }

  const anchors = anchorsFor_(habitId);
  const latest = anchors[anchors.length - 1];
  const when = (latest && latest.effectiveDate > today) ? latest.effectiveDate : today;
  const changes = [];

  if (status === 'paused' && !(latest && latest.reason === 'pause')) {
    changes.push(upsertAnchor_(habitId, when, computeTarget_(habit, anchors, when).target, 'pause', planOf_(habit)));
  } else if (status === 'active' && latest && latest.reason === 'pause') {
    changes.push(upsertAnchor_(habitId, when, latest.target, 'resume', planOf_(habit)));
  }
  return { habit: parseHabit_(rec), targetChanges: changes };
}

// ---------- setTarget: manual / pause / resume / reset ----------
function apiSetTarget_(data) {
  const habitId = idField_(data.habitId, 'habitId');
  const habit = loadHabit_(habitId).habit;
  const reason = enumField_(data.reason || 'manual', ANCHOR_REASONS_, 'reason');
  const today = today_();
  const date = data.effectiveDate ? dateField_(data.effectiveDate, 'effectiveDate') : today;
  if (date > addDays_(today, 1)) throw vErr_('effectiveDate cannot be in the future');

  const anchors = anchorsFor_(habitId);
  let target = numField_(data.target, 'target', { min: 0 });
  if (target === null) {
    target = reason === 'reset' ? habit.startingTarget : computeTarget_(habit, anchors, date).target;
  }
  // const anchor = upsertAnchor_(habitId, date, target, reason);
    const anchor = upsertAnchor_(habitId, date, target, reason, planOf_(habit));
  return { anchor: anchor, progression: computeTarget_(habit, anchorsFor_(habitId), today) };
}

// ---------- saveCategory ----------
function apiSaveCategory_(data) {
  const name = str_(data.name, 'name', 40, true);
  const icon = str_(data.icon, 'icon', 16, false);
  const rows = readTable_(SHEETS.CATEGORIES);
  let id = data.categoryId ? String(data.categoryId).trim() : '';
  if (id && !/^cat_[a-z0-9_]{1,40}$/.test(id)) throw vErr_('categoryId must look like cat_xxx');

  const existing = id ? rows.filter((r) => r.categoryId === id)[0] : null;
  if (!id) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24);
    id = 'cat_' + (slug || newId_('c').slice(2));
    if (rows.some((r) => r.categoryId === id)) id += '_' + newId_('x').slice(2, 6);
  }
  const rec = {
    categoryId: id, name: name, icon: icon || (existing ? existing.icon : '📌'),
    sortOrder: data.sortOrder !== undefined ? (numField_(data.sortOrder, 'sortOrder', {}) || 0)
      : (existing ? num_(existing.sortOrder, 0) : rows.reduce((m, r) => Math.max(m, num_(r.sortOrder, 0)), 0) + 1),
    active: data.active !== undefined ? bool_(data.active) : (existing ? bool_(existing.active) : true),
  };
  if (existing) writeRecord_(SHEETS.CATEGORIES, existing._row, rec); else appendRecords_(SHEETS.CATEGORIES, [rec]);
  return { category: parseCategory_(rec) };
}