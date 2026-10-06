// =====================================================================
// ROUTER.GS — entry points, auth, locking, response helpers
// =====================================================================

// Arrow wrappers resolve at call time, so file load order doesn't matter.
const ACTIONS = {
  // read-only (allowed over GET and POST)
  ping:           { write: false, fn: (d) => apiPing_(d) },
  bootstrap:      { write: false, fn: (d) => apiBootstrap_(d) },
  pull:           { write: false, fn: (d) => apiPull_(d) },
  getEntries:     { write: false, fn: (d) => apiGetEntries_(d) },
  getTotals:      { write: false, fn: (d) => apiGetTotals_(d) },
  getProgression: { write: false, fn: (d) => apiGetProgression_(d) },
  exportAll:      { write: false, fn: (d) => apiExportAll_(d) },
  // writes (POST only, serialised by a script lock)
  saveHabit:      { write: true, fn: (d) => apiSaveHabit_(d) },
  setHabitStatus: { write: true, fn: (d) => apiSetHabitStatus_(d) },
  setTarget:      { write: true, fn: (d) => apiSetTarget_(d) },
  saveCategory:   { write: true, fn: (d) => apiSaveCategory_(d) },
  addEntries:     { write: true, fn: (d) => apiAddEntries_(d) },
  deleteEntry:    { write: true, fn: (d) => apiDeleteEntry_(d) },
  closeDay:       { write: true, fn: (d) => apiCloseDay_(d) },
  saveSettings:   { write: true, fn: (d) => apiSaveSettings_(d) },
};

function doPost(e) {
  let req;
  try {
    req = JSON.parse((e && e.postData && e.postData.contents) || '');
  } catch (err) {
    return json_(fail_(400, 'Request body must be valid JSON', 'BAD_JSON'));
  }
  return json_(handleRequest_(req, 'POST'));
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  let data = {};
  if (p.data) {
    try { data = JSON.parse(p.data); } catch (err) { return json_(fail_(400, '"data" must be JSON', 'BAD_JSON')); }
  }
  return json_(handleRequest_({ token: p.token, action: p.action, requestId: p.requestId, data: data }, 'GET'));
}

function handleRequest_(req, method) {
  try {
    if (!req || typeof req !== 'object' || Array.isArray(req)) throw new ApiError(400, 'Request must be a JSON object', 'BAD_REQUEST');
    authorize_(req.token);
    const def = Object.prototype.hasOwnProperty.call(ACTIONS, req.action) ? ACTIONS[req.action] : null;
    if (!def) throw new ApiError(404, 'Unknown action: ' + String(req.action).slice(0, 40), 'UNKNOWN_ACTION');
    if (def.write && method === 'GET') throw new ApiError(405, 'This action requires POST', 'METHOD_NOT_ALLOWED');
    const data = (req.data && typeof req.data === 'object') ? req.data : {};
    return def.write ? runWrite_(req, def, data) : ok_(def.fn(data));
  } catch (err) {
    return errorResponse_(err);
  }
}

function authorize_(token) {
  const expected = PropertiesService.getScriptProperties().getProperty('API_TOKEN');
  if (!expected) throw new ApiError(500, 'API token not configured. Run generateApiToken() in the Apps Script editor.', 'NO_TOKEN');
  if (typeof token !== 'string' || !safeEqual_(token, expected)) throw new ApiError(401, 'Invalid or missing token', 'UNAUTHORIZED');
}

function safeEqual_(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** All writes: optional requestId replay + a script-wide lock so two devices can't interleave. */
function runWrite_(req, def, data) {
  const cache = CacheService.getScriptCache();
  let key = null;
  if (req.requestId !== undefined && req.requestId !== null) {
    if (!/^[A-Za-z0-9_\-]{6,64}$/.test(String(req.requestId))) throw new ApiError(400, 'requestId is invalid', 'VALIDATION');
    key = 'req_' + req.action + '_' + req.requestId;
    const hit = cache.get(key);
    if (hit) return Object.assign(JSON.parse(hit), { replayed: true });
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(CONFIG.LOCK_WAIT_MS)) throw new ApiError(503, 'Server is busy, please retry', 'BUSY');
  try {
    if (key) {   // a parallel duplicate may have finished while we waited for the lock
      const hit2 = cache.get(key);
      if (hit2) return Object.assign(JSON.parse(hit2), { replayed: true });
    }
    const res = ok_(def.fn(data));
    if (key) {
      const s = JSON.stringify(res);
      if (s.length < 90000) cache.put(key, s, CONFIG.REPLAY_TTL_SEC);
    }
    return res;
  } finally {
    lock.releaseLock();
  }
}

// ---------- RESPONSE HELPERS ----------
function ok_(data) {
  return { ok: true, status: 200, data: data === undefined ? null : data, error: null, serverTime: nowIso_() };
}

function fail_(status, message, code, detail) {
  const error = { code: code || 'ERROR', message: message };
  if (detail) error.detail = detail;
  return { ok: false, status: status, data: null, error: error, serverTime: nowIso_() };
}

function errorResponse_(err) {
  if (err instanceof ApiError) return fail_(err.status, err.message, err.code);
  console.error(err && err.stack ? err.stack : err);
  return fail_(500, 'Unexpected server error', 'INTERNAL', String((err && err.message) || err).slice(0, 200));
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}