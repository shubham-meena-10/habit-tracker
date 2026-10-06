// =====================================================================
// UTILS.GS — errors, dates, validation helpers
// =====================================================================
class ApiError extends Error {
  constructor(status, message, code) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code || 'ERROR';
  }
}

const pad2_ = (n) => (n < 10 ? '0' : '') + n;
function nowIso_() { return new Date().toISOString(); }
function today_() { return Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd'); }

// ---------- dates: YYYY-MM-DD strings, arithmetic in UTC (no DST/timezone drift) ----------
function parseDate_(s) {
  const p = s.split('-').map(Number);
  return new Date(Date.UTC(p[0], p[1] - 1, p[2]));
}
function fmtDate_(d) {
  return d.getUTCFullYear() + '-' + pad2_(d.getUTCMonth() + 1) + '-' + pad2_(d.getUTCDate());
}
function isValidDate_(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && fmtDate_(parseDate_(s)) === s;
}
function addDays_(s, n) {
  const d = parseDate_(s);
  d.setUTCDate(d.getUTCDate() + n);
  return fmtDate_(d);
}
function daysBetween_(a, b) {
  return Math.round((parseDate_(b) - parseDate_(a)) / 86400000);
}
/** Add whole months, clamping the day (Jan 31 + 1 month = Feb 28/29). */
function addMonths_(s, n) {
  const p = s.split('-').map(Number);
  const total = p[0] * 12 + (p[1] - 1) + n;
  const y = Math.floor(total / 12);
  const m = total % 12;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return fmtDate_(new Date(Date.UTC(y, m, Math.min(p[2], last))));
}

// ---------- tolerant readers (used when parsing sheet cells) ----------
function bool_(v) { return v === true || String(v).toLowerCase() === 'true'; }
function num_(v, d) {
  if (v === '' || v === null || v === undefined) return d;
  const n = Number(v);
  return isFinite(n) ? n : d;
}
function numOrNull_(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return isFinite(n) ? n : null;
}

// ---------- strict validators (used on incoming requests) ----------
function vErr_(msg) { return new ApiError(400, msg, 'VALIDATION'); }

function str_(v, field, max, required) {
  const s = (v === undefined || v === null) ? '' : String(v).trim();
  if (required && !s) throw vErr_(field + ' is required');
  if (s.length > max) throw vErr_(field + ' is too long (max ' + max + ' characters)');
  return s;
}

/** Returns a number, or null when blank and not required. */
function numField_(v, field, opt) {
  opt = opt || {};
  if (v === '' || v === null || v === undefined) {
    if (opt.required) throw vErr_(field + ' is required');
    return null;
  }
  const n = Number(v);
  if (typeof v === 'boolean' || !isFinite(n)) throw vErr_(field + ' must be a number');
  if (opt.integer && !Number.isInteger(n)) throw vErr_(field + ' must be a whole number');
  if (opt.min !== undefined && n < opt.min) throw vErr_(field + ' must be at least ' + opt.min);
  if (opt.max !== undefined && n > opt.max) throw vErr_(field + ' must be at most ' + opt.max);
  return n;
}

function enumField_(v, list, field) {
  const s = String(v === undefined || v === null ? '' : v);
  if (list.indexOf(s) < 0) throw vErr_(field + ' must be one of: ' + list.join(', '));
  return s;
}

function idField_(v, field) {
  const s = String(v === undefined || v === null ? '' : v).trim();
  if (!/^[A-Za-z0-9_\-]{3,80}$/.test(s)) throw vErr_(field + ' is invalid');
  return s;
}

function dateField_(v, field) {
  const s = String(v === undefined || v === null ? '' : v).trim();
  if (!isValidDate_(s)) throw vErr_(field + ' must be a valid date (YYYY-MM-DD)');
  return s;
}

function isoField_(v, field) {
  const s = String(v === undefined || v === null ? '' : v);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(s) || isNaN(Date.parse(s))) throw vErr_(field + ' must be an ISO timestamp');
  return s;
}

function timeField_(v, field) {
  const s = String(v === undefined || v === null ? '' : v).trim();
  if (!s) return '';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) throw vErr_(field + ' must be HH:mm (24-hour)');
  return s;
}

/** Accepts [1,2,3] or "1,2,3"; returns a sorted array of 0-6. Empty = every day. */
function weekdaysField_(v) {
  const arr = Array.isArray(v) ? v : String(v === undefined || v === null ? '' : v).split(',');
  const out = [];
  arr.forEach((x) => {
    const t = String(x).trim();
    if (t === '') return;
    const n = Number(t);
    if (!Number.isInteger(n) || n < 0 || n > 6) throw vErr_('weekdays must be numbers from 0 (Sun) to 6 (Sat)');
    if (out.indexOf(n) < 0) out.push(n);
  });
  return out.length ? out.sort((a, b) => a - b) : [0, 1, 2, 3, 4, 5, 6];
}

/** Accepts an array or a JSON string; returns an array of up to 8 non-zero numbers. */
function quickAddsField_(v) {
  let arr = v;
  if (typeof v === 'string') {
    if (!v.trim()) return [];
    try { arr = JSON.parse(v); } catch (e) { throw vErr_('quickAdds must be a JSON array of numbers'); }
  }
  if (arr === null || arr === undefined) return [];
  if (!Array.isArray(arr) || arr.length > 8) throw vErr_('quickAdds must be an array of up to 8 numbers');
  return arr.map((n) => {
    const x = Number(n);
    if (!isFinite(x) || x === 0 || Math.abs(x) > 1e7) throw vErr_('quickAdds contains an invalid number');
    return x;
  });
}

function clampInt_(v, min, max, def) {
  const n = Number(v);
  if (v === undefined || v === null || v === '' || !isFinite(n)) return def;
  return Math.min(max, Math.max(min, Math.round(n)));
}