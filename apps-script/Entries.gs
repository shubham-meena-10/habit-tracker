// =====================================================================
// ENTRIES.GS — the ledger, day check-ins, settings
// =====================================================================

/** Validates one incoming entry; returns a normalised object or throws ApiError. */
function validateEntry_(raw, habits, maxDate) {
  if (!raw || typeof raw !== 'object') throw vErr_('Each entry must be an object');
  const entryId = idField_(raw.entryId, 'entryId');
  const habit = habits[String(raw.habitId)];
  if (!habit) throw new ApiError(404, 'Unknown habitId', 'UNKNOWN_HABIT');
  const date = dateField_(raw.date, 'date');
  if (date < '2000-01-01' || date > maxDate) throw vErr_('date is outside the allowed range');
  const delta = numField_(raw.delta, 'delta', { required: true, min: -1e9, max: 1e9 });
  const source = raw.source === undefined ? 'tap' : enumField_(raw.source, ENTRY_SOURCES_, 'source');
  const durationSec = numField_(raw.durationSec, 'durationSec', { min: 0 });
  const note = str_(raw.note, 'note', 500, false);
  const deviceId = str_(raw.deviceId, 'deviceId', 40, false);
  const createdAt = raw.createdAt ? isoField_(raw.createdAt, 'createdAt') : '';

  if (habit.trackingType === 'BOOLEAN' || habit.trackingType === 'ABSTINENCE') {
    if (entryId !== 'chk_' + habit.habitId + '_' + date) {
      throw vErr_('BOOLEAN/ABSTINENCE entries must use entryId chk_<habitId>_<date>');
    }
    if (delta !== 0 && delta !== 1) throw vErr_('BOOLEAN/ABSTINENCE delta must be 0 or 1');
  }
  return {
    entryId: entryId, habitId: habit.habitId, date: date, delta: delta, source: source,
    durationSec: durationSec, note: note, deviceId: deviceId, createdAt: createdAt,
    deleted: raw.deleted === undefined ? undefined : bool_(raw.deleted),
  };
}

// ---------- addEntries: batch, idempotent upsert (the main sync path) ----------
function apiAddEntries_(data) {
  const list = data.entries;
  if (!Array.isArray(list) || !list.length) throw vErr_('entries must be a non-empty array');
  if (list.length > CONFIG.MAX_ENTRIES_PER_BATCH) throw vErr_('Too many entries in one request (max ' + CONFIG.MAX_ENTRIES_PER_BATCH + ')');

  const habits = Object.create(null);
  readTable_(SHEETS.HABITS).forEach((r) => { habits[String(r.habitId)] = parseHabit_(r); });
  const maxDate = addDays_(today_(), 1);   // 1-day slack for clock/timezone differences
  const now = nowIso_();
  const idIndex = indexIds_(SHEETS.ENTRIES);

  const results = [];
  const counts = { created: 0, updated: 0, duplicate: 0, error: 0 };
  const seen = Object.create(null);
  const toAppend = [];

  list.forEach((raw) => {
    const rawId = raw && raw.entryId ? String(raw.entryId) : '';
    try {
      const e = validateEntry_(raw, habits, maxDate);
      if (seen[e.entryId]) {
        results.push({ entryId: e.entryId, status: 'duplicate' }); counts.duplicate++; return;
      }
      seen[e.entryId] = true;

      const row = idIndex[e.entryId];
      if (!row) {
        toAppend.push({
          entryId: e.entryId, habitId: e.habitId, date: e.date, delta: e.delta, source: e.source,
          durationSec: e.durationSec, note: e.note, deleted: e.deleted === true,
          createdAt: e.createdAt || now, deviceId: e.deviceId, updatedAt: now,
        });
        results.push({ entryId: e.entryId, status: 'created' }); counts.created++;
        return;
      }

      const old = readRecord_(SHEETS.ENTRIES, row);
      if (String(old.habitId) !== e.habitId) throw new ApiError(409, 'entryId already belongs to another habit', 'CONFLICT');
      // A retry that omits "deleted" must never resurrect an entry the user deleted.
      const deleted = e.deleted === undefined ? bool_(old.deleted) : e.deleted;
      const same = String(old.date) === e.date && num_(old.delta, 0) === e.delta && bool_(old.deleted) === deleted &&
        String(old.note || '') === e.note && numOrNull_(old.durationSec) === e.durationSec;
      if (same) {
        results.push({ entryId: e.entryId, status: 'duplicate' }); counts.duplicate++;
      } else {
        writeRecord_(SHEETS.ENTRIES, row, Object.assign({}, old, {
          date: e.date, delta: e.delta, source: e.source, durationSec: e.durationSec,
          note: e.note, deleted: deleted, updatedAt: now,
        }));
        results.push({ entryId: e.entryId, status: 'updated' }); counts.updated++;
      }
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
      results.push({ entryId: rawId, status: 'error', code: err.code, error: err.message });
      counts.error++;
    }
  });

  appendRecords_(SHEETS.ENTRIES, toAppend);   // one batched write for all new rows
  return { results: results, counts: counts };
}

// ---------- deleteEntry: soft delete ----------
function apiDeleteEntry_(data) {
  const entryId = idField_(data.entryId, 'entryId');
  const row = indexIds_(SHEETS.ENTRIES)[entryId];
  if (!row) throw new ApiError(404, 'Entry not found', 'NOT_FOUND');
  const old = readRecord_(SHEETS.ENTRIES, row);
  if (bool_(old.deleted)) return { entryId: entryId, status: 'already_deleted' };
  old.deleted = true;
  old.updatedAt = nowIso_();
  writeRecord_(SHEETS.ENTRIES, row, old);
  return { entryId: entryId, status: 'deleted' };
}

// ---------- closeDay: end-of-day check-in ----------
function apiCloseDay_(data) {
  const date = dateField_(data.date, 'date');
  if (date > addDays_(today_(), 1)) throw vErr_('Cannot close a future day');
  const closed = data.closed === undefined ? true : bool_(data.closed);
  const now = nowIso_();
  const rec = { date: date, closed: closed, closedAt: closed ? now : '', notes: str_(data.notes, 'notes', 500, false), updatedAt: now };

  const row = indexIds_(SHEETS.DAYS)[date];
  if (row) {
    const old = readRecord_(SHEETS.DAYS, row);
    if (data.notes === undefined) rec.notes = String(old.notes || '');
    if (closed && bool_(old.closed) && old.closedAt) rec.closedAt = String(old.closedAt);
    writeRecord_(SHEETS.DAYS, row, rec);
  } else {
    appendRecords_(SHEETS.DAYS, [rec]);
  }
  return { dayStatus: parseDay_(rec) };
}

// ---------- saveSettings: upsert key/value pairs ----------
function apiSaveSettings_(data) {
  const s = data.settings;
  if (!s || typeof s !== 'object' || Array.isArray(s)) throw vErr_('settings must be an object');
  const keys = Object.keys(s);
  if (!keys.length || keys.length > 50) throw vErr_('Provide between 1 and 50 settings');

  // Validate everything first so a bad key doesn't leave a half-saved batch.
  const clean = keys.map((k) => {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(k)) throw vErr_('Invalid setting key: ' + k);
    if (k === 'schemaVersion') throw vErr_('schemaVersion is read-only');
    const raw = (s[k] !== null && typeof s[k] === 'object') ? JSON.stringify(s[k]) : s[k];
    return { key: k, value: str_(raw, 'setting ' + k, 500, false) };
  });

  const idx = indexIds_(SHEETS.SETTINGS);
  const now = nowIso_();
  const append = [];
  clean.forEach((c) => {
    const rec = { key: c.key, value: c.value, updatedAt: now };
    if (idx[c.key]) writeRecord_(SHEETS.SETTINGS, idx[c.key], rec); else append.push(rec);
  });
  appendRecords_(SHEETS.SETTINGS, append);
  return { settings: settingsMap_(null) };
}