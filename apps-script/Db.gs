// =====================================================================
// DB.GS — all Google Sheets access lives here (nothing else touches SpreadsheetApp)
// Depends on SCHEMA and newId_ from Setup.gs.
// =====================================================================
let ssCache_ = null;

function getSs_() {
  if (ssCache_) return ssCache_;
  const id = CONFIG.SPREADSHEET_ID;
  const usable = id && id.indexOf('PASTE') === -1;
  ssCache_ = usable ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  if (!ssCache_) throw new ApiError(500, 'Spreadsheet not found. Set CONFIG.SPREADSHEET_ID.', 'NO_SPREADSHEET');
  return ssCache_;
}

function sheet_(name) {
  const sh = getSs_().getSheetByName(name);
  if (!sh) throw new ApiError(500, 'Missing sheet "' + name + '". Run setupDatabase() first.', 'NO_SHEET');
  return sh;
}

// ---------- cell + row conversion ----------
const TIME_COLS_ = { scheduleTime: 1, reminderTime: 1 };
const DATE_COLS_ = { date: 1, startDate: 1, effectiveDate: 1 };

/** Safety net: if Sheets ever converts a text cell to a Date, turn it back into a string. */
function cell_(v, header) {
  if (v instanceof Date) {
    if (TIME_COLS_[header]) {
      return Utilities.formatDate(new Date(Math.round(v.getTime() / 60000) * 60000), CONFIG.TIMEZONE, 'HH:mm');
    }
    if (DATE_COLS_[header]) return Utilities.formatDate(v, CONFIG.TIMEZONE, 'yyyy-MM-dd');
    return v.toISOString();
  }
  return v;
}

function rowToObj_(headers, row, rowNum) {
  const o = { _row: rowNum };
  for (let c = 0; c < headers.length; c++) o[headers[c]] = cell_(row[c], headers[c]);
  return o;
}

function rowFromObj_(name, obj) {
  return SCHEMA[name].headers.map((h) => (obj[h] === undefined || obj[h] === null ? '' : obj[h]));
}

// ---------- reads ----------
/** Reads a whole sheet as objects (each has _row). Rows with a blank first column are skipped. */
function readTable_(name) {
  const sh = sheet_(name);
  const headers = SCHEMA[name].headers;
  const last = sh.getLastRow();
  if (last < 2) return [];
  const values = sh.getRange(2, 1, last - 1, headers.length).getValues();
  const out = [];
  for (let i = 0; i < values.length; i++) {
    if (values[i][0] === '' || values[i][0] === null) continue;
    out.push(rowToObj_(headers, values[i], i + 2));
  }
  return out;
}

function readRecord_(name, rowNum) {
  const sh = sheet_(name);
  const headers = SCHEMA[name].headers;
  return rowToObj_(headers, sh.getRange(rowNum, 1, 1, headers.length).getValues()[0], rowNum);
}

/** Map of first-column value -> row number. Reads one column only (fast). */
function indexIds_(name) {
  const sh = sheet_(name);
  const map = Object.create(null);
  const last = sh.getLastRow();
  if (last < 2) return map;
  const col = sh.getRange(2, 1, last - 1, 1).getValues();
  for (let i = 0; i < col.length; i++) {
    if (col[i][0] !== '' && col[i][0] !== null) map[String(col[i][0])] = i + 2;
  }
  return map;
}

/** First free row, judged by column A (checkbox/format-only rows don't count). */
function nextRow_(sh) {
  const last = sh.getLastRow();
  if (last < 2) return 2;
  const col = sh.getRange(1, 1, last, 1).getValues();
  for (let i = col.length - 1; i >= 1; i--) {
    if (col[i][0] !== '' && col[i][0] !== null) return i + 2;
  }
  return 2;
}

// ---------- writes ----------
/** Adds rows (with plain-text + checkbox formatting) when we run past the pre-formatted area. */
function growSheet_(sh, name, neededRow) {
  const max = sh.getMaxRows();
  if (neededRow <= max) return;
  const add = Math.max(neededRow - max, 500);
  sh.insertRowsAfter(max, add);
  const def = SCHEMA[name];
  def.text.forEach((h) => {
    sh.getRange(max + 1, def.headers.indexOf(h) + 1, add, 1).setNumberFormat('@');
  });
  const cb = SpreadsheetApp.newDataValidation().requireCheckbox().build();
  (BOOL_COLS[name] || []).forEach((h) => {
    sh.getRange(max + 1, def.headers.indexOf(h) + 1, add, 1).setDataValidation(cb);
  });
}

function appendRecords_(name, records) {
  if (!records.length) return;
  const sh = sheet_(name);
  const start = nextRow_(sh);
  growSheet_(sh, name, start + records.length - 1);
  const rows = records.map((r) => rowFromObj_(name, r));
  sh.getRange(start, 1, rows.length, rows[0].length).setValues(rows);
}

function writeRecord_(name, rowNum, obj) {
  const row = rowFromObj_(name, obj);
  sheet_(name).getRange(rowNum, 1, 1, row.length).setValues([row]);
}

function deleteRowsWhere_(name, predicate) {
  const rows = readTable_(name).filter(predicate).map((r) => r._row).sort((a, b) => b - a);
  const sh = sheet_(name);
  rows.forEach((r) => sh.deleteRow(r));
  return rows.length;
}

// ---------- parsers: sheet record -> clean API object ----------
function parseWeekdays_(v) {
  const out = [];
  String(v === undefined || v === null ? '' : v).split(',').forEach((s) => {
    const t = s.trim();
    if (t === '') return;
    const n = Number(t);
    if (Number.isInteger(n) && n >= 0 && n <= 6 && out.indexOf(n) < 0) out.push(n);
  });
  return out.length ? out.sort((a, b) => a - b) : [0, 1, 2, 3, 4, 5, 6];
}

function parseJsonArray_(v) {
  if (Array.isArray(v)) return v;
  if (!v) return [];
  try {
    const a = JSON.parse(String(v));
    return Array.isArray(a) ? a : [];
  } catch (e) { return []; }
}

function parseHabit_(r) {
  return {
    habitId: String(r.habitId),
    name: String(r.name),
    icon: String(r.icon || ''),
    categoryId: String(r.categoryId || 'cat_other'),
    description: String(r.description || ''),
    trackingType: String(r.trackingType),
    goalDirection: String(r.goalDirection || 'INCREASE'),
    unit: String(r.unit || ''),
    unitFactor: num_(r.unitFactor, 1) || 1,
    startingTarget: num_(r.startingTarget, 0),
    minTarget: numOrNull_(r.minTarget),
    endTarget: numOrNull_(r.endTarget),
    startDate: String(r.startDate || ''),
    weekdays: parseWeekdays_(r.weekdays),
    scheduleTime: String(r.scheduleTime || ''),
    reminderTime: String(r.reminderTime || ''),
    progressionEnabled: bool_(r.progressionEnabled),
    progressionAmount: numOrNull_(r.progressionAmount),
    progressionInterval: numOrNull_(r.progressionInterval),
    progressionUnit: String(r.progressionUnit || 'days'),
    quickAdds: parseJsonArray_(r.quickAdds),
    status: String(r.status || 'active'),
    sortOrder: num_(r.sortOrder, 0),
    createdAt: String(r.createdAt || ''),
    updatedAt: String(r.updatedAt || ''),
  };
}

/** Parsed habit -> sheet record (arrays become text, nulls become blanks). */
function habitToRecord_(h) {
  return Object.assign({}, h, {
    weekdays: h.weekdays.join(','),
    quickAdds: JSON.stringify(h.quickAdds || []),
  });
}

function parseCategory_(r) {
  return {
    categoryId: String(r.categoryId), name: String(r.name), icon: String(r.icon || ''),
    sortOrder: num_(r.sortOrder, 0), active: bool_(r.active),
  };
}

function parsePlan_(v) {
  if (v && typeof v === 'object') return v;
  if (!v) return null;
  try {
    const o = JSON.parse(String(v));
    return o && typeof o === 'object' ? o : null;
  } catch (e) { return null; }
}

function parseTarget_(r) {
  return {
    changeId: String(r.changeId), habitId: String(r.habitId), effectiveDate: String(r.effectiveDate),
    target: num_(r.target, 0), reason: String(r.reason || 'manual'), createdAt: String(r.createdAt || ''),
    plan: parsePlan_(r.plan),
  };
}

function parseEntry_(r) {
  return {
    entryId: String(r.entryId), habitId: String(r.habitId), date: String(r.date),
    delta: num_(r.delta, 0), source: String(r.source || 'tap'), durationSec: numOrNull_(r.durationSec),
    note: String(r.note || ''), deleted: bool_(r.deleted), createdAt: String(r.createdAt || ''),
    deviceId: String(r.deviceId || ''), updatedAt: String(r.updatedAt || ''),
  };
}

function parseDay_(r) {
  return {
    date: String(r.date), closed: bool_(r.closed), closedAt: String(r.closedAt || ''),
    notes: String(r.notes || ''), updatedAt: String(r.updatedAt || ''),
  };
}

// ---------- simple trigger: stamp "last modified" when YOU edit the sheet by hand ----------
function onEdit(e) {
  try {
    if (!e || !e.range) return;
    const sh = e.range.getSheet();
    const name = sh.getName();
    const stampHeader = STAMP_COLUMNS[name];
    if (!stampHeader) return;
    const col = SCHEMA[name].headers.indexOf(stampHeader) + 1;
    const r = e.range;
    if (r.getColumn() === col && r.getNumColumns() === 1) return; // you edited the stamp itself
    const startRow = Math.max(2, r.getRow());
    const endRow = r.getRow() + r.getNumRows() - 1;
    if (endRow < startRow) return;
    const iso = new Date().toISOString();
    const stamps = [];
    for (let i = startRow; i <= endRow; i++) stamps.push([iso]);
    sh.getRange(startRow, col, stamps.length, 1).setNumberFormat('@').setValues(stamps);
  } catch (err) { /* never block a manual edit */ }
}