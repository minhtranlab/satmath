/**
 * SAT Math Lib — server (Google Apps Script web app). Engine copied from Test Zone v1.13 (github.com/minhtranlab/testzone).
 * -------------------------------------------------------------------------------------------------------------------
 * A student practises in SETS (5 / 10 / 20 questions picked from the private library on Drive). No timer, ever;
 * time per question is recorded. Server calls from the browser (only these):
 *   login · homeData · startPractice · startReview · getSet · getFigures · autosave · submit · getResult · getReview
 *   getFix · checkTry (fix wrong answers after the result) · askTeacher (after the result; during a set it rides on autosave)
 *   teacher (teacher_code): teacherOverview · teacherResult · teacherReview · teacherAnswer
 * The answer key never leaves the server: clientQuestion_() whitelists the fields it sends; grading is server-side.
 * All Sheet access is by header name (row 1), never by column position.
 * Library = JSON batch files + figure PNGs in the private Drive folder LIBRARY_FOLDER_ID (Library.gs).
 * Source of truth: github.com/minhtranlab/satmath — every push to main deploys automatically (README.md).
 */

var SHEET_ID = '1kvaTZbsSU6ZpI7B6pbYiuQklau2qot8l1bmT_Rc8l2g';          // "SAT Math Lib – Data" (minhtranipad@gmail.com)
var LIBRARY_FOLDER_ID = '1kv4i4SLgFFJDOBztZdYt6OFN3EPsQI81';             // Drive: SAT › SAT Math Lib › SAT Math Lib - Library (private)
var APP_VERSION = 'v0.15.4 (2026-11-19, QK difficulty re-rating applied to Item_Overrides)';
var APP_BUILD = 'dev';  // replaced by the GitHub Action with the commit id → the Sheet update (Update.gs) runs once per deploy

/* ============================== web app ============================== */

function doGet(e) {
  // Called by the GitHub Action right after each deploy: runs the Sheet update once per new version (Update.gs).
  // Returns a one-line status only (no Sheet data), so it is safe on the public URL.
  if (e && e.parameter && e.parameter.update === '1') {
    return ContentService.createTextOutput(runUpdateIfNeeded_()).setMimeType(ContentService.MimeType.TEXT);
  }
  // Speed check (#42): timings + row counts only (Perf.gs).
  if (e && e.parameter && e.parameter.perf === '1') {
    return ContentService.createTextOutput(perfRun_()).setMimeType(ContentService.MimeType.JSON);
  }
  // After editing the Sheet with another tool (no onEdit): ?flush=1 drops every snapshot. Returns one status line, no data.
  if (e && e.parameter && e.parameter.flush === '1') {
    var fc = CacheService.getScriptCache(), msg = 'wait 10 s';
    if (!fc.get('sml_flush')) { fc.put('sml_flush', '1', 10); msg = flushTabCache_(); }
    return ContentService.createTextOutput('SAT Math Lib ' + msg).setMimeType(ContentService.MimeType.TEXT);
  }
  var t = HtmlService.createTemplateFromFile('Index');
  return t.evaluate()
    .setTitle(getSettings_().app_name || 'SAT Math Lib')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=5')
    .setFaviconUrl('https://minhtranlab.github.io/satmath/icon-32.png')            // #73 the logo (a PNG on the public site)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

/* ============================== sheet helpers (Test Zone) ============================== */

var _ss = null;
function ss_() {
  if (!_ss) {
    try { var a = SpreadsheetApp.getActiveSpreadsheet(); if (a && a.getId() === SHEET_ID) _ss = a; } catch (e) {}
    if (!_ss) _ss = SpreadsheetApp.openById(SHEET_ID); // web app context
  }
  return _ss;
}

function sheet_(name) {
  var sh = ss_().getSheetByName(name);
  if (!sh) throw new Error('Missing tab: ' + name);
  return sh;
}

/* ---- speed (#42): every tab is read at most once per call (memo), and read-only calls (cachedReads_()) take a snapshot from
   CacheService instead of opening the Sheet (~1.3 s). Each tab has a version token; every write through appendObjects_ /
   updateRow_ (and onEdit for hand edits, the update after a deploy for everything) sets a new token, so a snapshot is used
   only while nothing changed. Edits made by other tools (Sheets API, scripts) fire no onEdit: they show after ?flush=1 (drops
   every snapshot: new epoch) or when snapshots expire (TAB_CACHE_SEC). Calls that write always read the Sheet itself (row
   numbers must be exact). ---- */
var _tables = {}, _readMode = 'fresh', TAB_CACHE_SEC = 900, TAB_CHUNK = 90000, EPOCH_KEY_ = 'smlv__epoch';
var _forceFresh = false, _perfAllowInactive = false;                                            // the speed check measures the old way too
// one CacheService round trip costs ~50 ms: a read-only call fetches the version + first chunk of every usual tab at once
var PRELOAD_TABS_ = ['Settings', 'Students', 'Classes', 'Assignments', 'Sets', 'Responses', 'Tries', 'Levels', 'Review', 'Questions', 'Batches', 'Skills', 'Skill_Profile', 'Time_Norms', 'Placements', 'Placement_Forms', 'Item_Overrides'];
var _pre = null;
var REF_TABS_ = ['Settings', 'Questions', 'Batches', 'Skills', 'Skill_Profile', 'Time_Norms', 'Placement_Forms', 'Item_Overrides'];
function cachedReads_() { if (_forceFresh) return; _readMode = 'cached'; preloadTabs_(); }
function preloadTabs_() {
  _pre = null;
  try { var keys = [EPOCH_KEY_]; PRELOAD_TABS_.forEach(function (n) { keys.push(tabVerKey_(n), tabHeadKey_(n)); }); _pre = CacheService.getScriptCache().getAll(keys) || {}; } catch (e) { _pre = null; }
}
/** Simple trigger: a hand edit in the Sheet → that tab's snapshot is out of date; Students / Classes / Responses → sync on the next teacher page. */
function onEdit(e) {
  try {
    var n = e.range.getSheet().getName(); tabChanged_(n);
    if (/^(Students|Classes|Responses)$/.test(n)) CacheService.getScriptCache().put('sml_dirty_sync', '1', 21600);
  } catch (x) {}
}
function tabVerKey_(name) { return 'smlv_' + name; }
function tabHeadKey_(name) { return 'smlh_' + name; }
function tabChanged_(name) {
  delete _tables[name]; _pre = null;
  try { CacheService.getScriptCache().put(tabVerKey_(name), newToken_(), 21600); } catch (e) {}
}
/** Drop every snapshot at once (new epoch): after a deploy, and ?flush=1 after edits made with other tools. */
function flushTabCache_() {
  _tables = {}; _pre = null;
  try { var c = CacheService.getScriptCache(); c.put(EPOCH_KEY_, newToken_(), 21600); c.put('sml_dirty_sync', '1', 21600); } catch (e) {}
  return 'cache: flushed';
}
function newToken_() { return String(Date.now()) + Math.random().toString(36).slice(2, 6); }
/** The token a snapshot of this tab must carry now: tab version @ epoch (made when missing, if make). */
function tabToken_(name, got, c, make) {
  var v = got[tabVerKey_(name)], e = got[EPOCH_KEY_];
  if (make && (!v || !e)) {
    var put = {}; if (!v) put[tabVerKey_(name)] = v = newToken_(); if (!e) put[EPOCH_KEY_] = e = newToken_();
    c.putAll(put, 21600);
  }
  return v && e ? v + '@' + e : null;
}
/** Snapshot layout: smlv_<tab> = version, smlv__epoch = epoch; smlh_<tab> = '{"v":version@epoch,"n":chunks}' + newline + chunk 0;
 *  smlt_<tab>_<version@epoch>_<i> = chunk i ≥ 1. A snapshot counts only when its v is the current version@epoch (a read that
 *  raced a write stored the old one → ignored). */
function tabFromCache_(name) {
  try {
    var c = CacheService.getScriptCache(), hk = tabHeadKey_(name);
    var g = _pre && PRELOAD_TABS_.indexOf(name) >= 0 ? _pre : (c.getAll([tabVerKey_(name), hk, EPOCH_KEY_]) || {});
    var v = tabToken_(name, g, c, false), head = g[hk];
    if (!v || !head) return null;
    var nl = head.indexOf('\n'), meta = JSON.parse(head.slice(0, nl));
    if (meta.v !== v || !(meta.n >= 1)) return null;
    var parts = [head.slice(nl + 1)];
    if (meta.n > 1) {
      var keys = []; for (var i = 1; i < meta.n; i++) keys.push('smlt_' + name + '_' + v + '_' + i);
      var got = c.getAll(keys) || {};
      for (var j = 0; j < keys.length; j++) { if (got[keys[j]] === undefined || got[keys[j]] === null) return null; parts.push(got[keys[j]]); }
    }
    var o = JSON.parse(parts.join(''), function (k, val) { return val && typeof val === 'object' && '$d' in val ? new Date(val.$d) : val; });
    return tableObj_(name, o.headers, o.rows);
  } catch (e) { return null; }
}
function tabToCache_(name, t, ver) {
  try {
    var c = CacheService.getScriptCache(), v = ver;
    if (!v) return;                                                     // readTable_ always sets the version BEFORE reading
    var rows = t.rows.map(function (r) { var o = {}; Object.keys(r).forEach(function (k) { var x = r[k]; o[k] = Object.prototype.toString.call(x) === '[object Date]' ? { $d: x.getTime() } : x; }); return o; });
    var s = JSON.stringify({ headers: t.headers, rows: rows }), put = {}, n = Math.ceil(s.length / TAB_CHUNK) || 1;
    if (n > 60) return;                                               // too big for the cache: read the Sheet
    for (var i = 1; i < n; i++) put['smlt_' + name + '_' + v + '_' + i] = s.slice(i * TAB_CHUNK, (i + 1) * TAB_CHUNK);
    put[tabHeadKey_(name)] = JSON.stringify({ v: v, n: n }) + '\n' + s.slice(0, TAB_CHUNK);
    c.putAll(put, TAB_CACHE_SEC);
  } catch (e) {}
}
function tableObj_(name, headers, rows) {
  var idx = {}; headers.forEach(function (h, i) { if (h && !(h in idx)) idx[h] = i; });
  var t = { headers: headers, idx: idx, rows: rows };
  Object.defineProperty(t, 'sh', { get: function () { return sheet_(name); } });
  return t;
}
/** Read a whole tab → {sh, headers, idx (name→0-based col), rows: [{_row, col: value…}]} (memo + snapshot, see above). */
function readTable_(name) {
  if (_tables[name]) return _tables[name];
  var t = null, ver = null;
  // #43: reference tabs (never updated by row number in a student's write call) come from the snapshot in write calls too
  if (_readMode === 'cached' || (!_forceFresh && REF_TABS_.indexOf(name) >= 0)) {
    t = tabFromCache_(name);
    if (t) return (_tables[name] = t);
  }
  // the version is taken (or made) BEFORE reading: a write during the read changes it, so this snapshot is never used
  try { var c = CacheService.getScriptCache(); ver = tabToken_(name, c.getAll([tabVerKey_(name), EPOCH_KEY_]) || {}, c, true); } catch (e) {}
  t = readTableSheet_(name);
  tabToCache_(name, t, ver);
  return (_tables[name] = t);
}
/** Does the tab exist? (from the snapshot when there is one) */
function hasTab_(name) {
  if (_tables[name]) return true;
  if (_readMode === 'cached' && tabFromCache_(name)) return true;
  return !!ss_().getSheetByName(name);
}
function readTableSheet_(name) {
  var sh = sheet_(name);
  var lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
  if (lastCol < 1) return { sh: sh, headers: [], idx: {}, rows: [] };
  var values = sh.getRange(1, 1, Math.max(lastRow, 1), lastCol).getValues();
  var headers = values[0].map(function (h) { return String(h).trim(); });
  var idx = {};
  headers.forEach(function (h, i) { if (h && !(h in idx)) idx[h] = i; });
  var rows = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var empty = true;
    for (var c = 0; c < row.length; c++) { if (row[c] !== '' && row[c] !== null) { empty = false; break; } }
    if (empty) continue;
    var o = { _row: r + 1 };
    headers.forEach(function (h, i) { if (h) o[h] = row[i]; });
    rows.push(o);
  }
  return { sh: sh, headers: headers, idx: idx, rows: rows };
}

function headers_(name) {
  var sh = sheet_(name);
  var lastCol = sh.getLastColumn();
  if (lastCol < 1) return [];
  return sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); });
}

/** Make sure the tab's grid has at least lastRowNeeded rows / lastColNeeded columns (the Sheet grid does not grow by itself). */
function ensureGrid_(sh, lastRowNeeded, lastColNeeded) {
  var maxR = sh.getMaxRows();
  if (lastRowNeeded > maxR) sh.insertRowsAfter(maxR, lastRowNeeded - maxR + 500);
  if (lastColNeeded) {
    var maxC = sh.getMaxColumns();
    if (lastColNeeded > maxC) sh.insertColumnsAfter(maxC, lastColNeeded - maxC);
  }
}

function rowsFor_(headers, objs) {
  return objs.map(function (o) {
    return headers.map(function (h) { return (h in o && o[h] !== undefined && o[h] !== null) ? o[h] : ''; });
  });
}

/** Append objects as rows, mapping keys to headers by name. Unknown keys are ignored. Grows the grid first. */
function appendObjects_(name, objs) {
  if (!objs || !objs.length) return;
  var sh = sheet_(name);
  var headers = headers_(name);
  var data = rowsFor_(headers, objs);
  var start = sh.getLastRow() + 1;
  try {
    ensureGrid_(sh, start + data.length - 1, headers.length);
    sh.getRange(start, 1, data.length, headers.length).setValues(data);
    tabChanged_(name);
  } catch (e) {
    console.error('WRITE FAILED appendObjects_(' + name + ', ' + data.length + ' rows at row ' + start + '): ' + e);
    throw e;
  }
}

/** Update named fields of one row (1-based sheet row). Cells not in `fields` are written back as they were. */
function updateRow_(name, rowNum, fields) {
  var sh = sheet_(name);
  var headers = headers_(name);
  var cur = sh.getRange(rowNum, 1, 1, headers.length).getValues()[0];
  var changed = false;
  cur = cur.map(keepCell_);
  headers.forEach(function (h, i) {
    if (h in fields && fields[h] !== undefined) { cur[i] = fields[h] === null ? '' : fields[h]; changed = true; }
  });
  try {
    if (changed) { sh.getRange(rowNum, 1, 1, headers.length).setValues([cur]); tabChanged_(name); }
  } catch (e) {
    console.error('WRITE FAILED updateRow_(' + name + ', row ' + rowNum + '): ' + e);
    throw e;
  }
}

/** A value read back from the Sheet, written again as the same text ("3/4" must not become a date, "=…" never a formula). */
function keepCell_(v) {
  if (typeof v !== 'string' || v === '') return v;
  return (/^[=+\-@]/.test(v) || /^-?\d+([.\/]\d+)?$/.test(v) || /^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/.test(v) || /^\d{4}-\d{2}-\d{2}/.test(v)) ? "'" + v : v;
}

var SETTINGS_DEFAULTS_ = {
  app_name: 'SAT Math Lib', teacher_code: '', desmos_api_key: '', autosave_sec: 60, set_sizes: '5,10,20',
  mcq_max_tries: 3, good_set_pct: 0.8, weak_set_pct: 0.5, recent_window: 10, recent_decay: 0.85, missed_share: 0.4,
  probes_per_set: 1, standin_min: 3, strong_r: 0.85, block_days: 7, retry_wait_days: 2, progress_dot_min: 3,
  dot_green: 0.8, dot_amber: 0.5, guess_min_time_sec: 15, fast_ratio: 0.5, slow_ratio: 1.5,
  mistake_placeholder: '— choose a mistake type —',
  mistake_types: "Concept Gap; Didn't Understand The Question; Misread A Detail; Careless Calculation; Wrong Input/Format; Others; Not A Mistake",
  ask_note_max: 200,
  // placement test (blueprint v2.2, Minh 14 Nov): time bands in seconds (fast ≤ fast, normal ≤ max, slow above; grid-in + spr extra)
  pl_easy_fast_sec: 40, pl_easy_max_sec: 60, pl_medium_fast_sec: 60, pl_medium_max_sec: 90, pl_hard_fast_sec: 90, pl_hard_max_sec: 180,
  pl_spr_extra_sec: 15, pl_slow_credit: 0.5, pl_max_per_domain: 6, pl_easy_cap: 3, pl_strong_run: 2, pl_wrong_stop: 2,
  pl_pattern: 'ALG,PSD,ALG,GEO', pl_adv_medium_if: 'H',
  // #48 leaving the window (all sets: recorded for the teacher; only the Placement test tells the student)
  away_min_sec: 2, away_flag_sec: 20, away_notice_placement: 'Yes'
};
var _settings = null;
function getSettings_() {
  if (_settings) return _settings;
  var out = {};
  Object.keys(SETTINGS_DEFAULTS_).forEach(function (k) { out[k] = SETTINGS_DEFAULTS_[k]; });
  try {
    readTable_('Settings').rows.forEach(function (r) {
      var k = String(r.key || '').trim();
      if (!k) return;
      var v = r.value;
      if (typeof out[k] === 'number') { var n = Number(v); if (v !== '' && !isNaN(n)) out[k] = n; }
      else if (v !== '' && v !== null && v !== undefined) out[k] = String(v).trim();
    });
  } catch (e) { /* defaults */ }
  if (!out.app_name) out.app_name = 'SAT Math Lib';
  return (_settings = out);
}

function nowIso_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd HH:mm:ss');
}
function fmtDate_(d, pattern) {
  return Utilities.formatDate(d, Session.getScriptTimeZone() || 'Asia/Ho_Chi_Minh', pattern);
}
function round_(x, d) { var p = Math.pow(10, d || 0); return Math.round(x * p) / p; }
function normCode_(c) { return String(c || '').trim().toUpperCase(); }
/** Force text in Sheets (so "6.10" or "3/4" is not turned into a number / date). */
function txt_(v) { return (v === null || v === undefined || v === '') ? '' : "'" + String(v); }
function isYes_(v) { var s = String(v).trim().toLowerCase(); return s === 'yes' || s === 'y' || s === 'true' || s === '1' || v === true; }
function toMs_(v) {
  if (!v) return 0;
  if (Object.prototype.toString.call(v) === '[object Date]') return v.getTime();
  var d = new Date(String(v).replace(' ', 'T') + (/[zZ+]/.test(String(v).slice(10)) ? '' : '+07:00'));
  return isNaN(d.getTime()) ? 0 : d.getTime();
}
/** Dates shown to students: "06 Nov, 19:52". */
function dateStr_(v) {
  var ms = toMs_(v);
  return ms ? fmtDate_(new Date(ms), 'dd MMM, HH:mm') : '';
}
function escHtml_(s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

/* ============================== auth ============================== */

function findStudent_(code) {
  code = normCode_(code);
  if (!code) return null;
  var rows = readTable_('Students').rows;
  for (var i = 0; i < rows.length; i++) {
    if (normCode_(rows[i].student_code) === code) return rows[i];
  }
  return null;
}

function requireStudent_(code) {
  var keys = loginKeys_(code, '');
  var st = findStudent_(code);
  if (!st && loginLockedAll_()) throw new Error('LOGIN: ' + LOCK_ALL_MSG);
  if (loginLocked_(keys)) throw new Error('LOGIN: ' + LOCK_MSG);
  if (!st) loginFailed_(keys);
  if (!st || (!isYes_(st.active) && !(_perfAllowInactive && /^TEST-/.test(normCode_(st.student_code))))) throw new Error('LOGIN: This code is not valid or is locked. Ask your teacher.');
  return st;
}

/* ---- login lock-out (Test Zone #16 m8 / #21): 10 wrong codes in 15 min → that code AND that device wait 15 min;
        30 wrong codes in 15 min from anywhere → every sign-in waits 5 min ---- */
var LOGIN_MAX_FAILS = 10, LOGIN_WINDOW_MS = 15 * 60 * 1000;
var LOCK_MSG = 'Too many wrong codes. Wait 15 minutes, then try again.';
function loginKeys_(code, deviceId) {
  var c = String(code || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '_').slice(0, 60);
  var d = String(deviceId || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60);
  var k = ['sml_lf_c_' + c];
  if (d) k.push('sml_lf_d_' + d);
  return k;
}
function failTimes_(cache, key, now) {
  var v = []; try { v = JSON.parse(cache.get(key) || '[]'); } catch (e) {}
  return (Array.isArray(v) ? v : []).filter(function (t) { return now - Number(t) < LOGIN_WINDOW_MS; });
}
var LOGIN_ALL_MAX = 30, LOGIN_ALL_WAIT_MS = 5 * 60 * 1000, ALL_KEY = 'sml_lf_all', ALL_LOCK_KEY = 'sml_lf_all_lock';
var LOCK_ALL_MSG = 'Too many wrong codes were tried. Sign-in is paused for 5 minutes. Please try again later.';
function loginLockedAll_() { return Date.now() < (Number(CacheService.getScriptCache().get(ALL_LOCK_KEY)) || 0); }
function loginLocked_(keys) {
  var cache = CacheService.getScriptCache(), now = Date.now();
  return keys.some(function (k) { return failTimes_(cache, k, now).length >= LOGIN_MAX_FAILS; });
}
function loginFailed_(keys) {
  var cache = CacheService.getScriptCache(), now = Date.now();
  var all = failTimes_(cache, ALL_KEY, now); all.push(now);
  try { cache.put(ALL_KEY, JSON.stringify(all.slice(-(LOGIN_ALL_MAX + 5))), 1800); } catch (e) {}
  if (all.length >= LOGIN_ALL_MAX) { try { cache.put(ALL_LOCK_KEY, String(now + LOGIN_ALL_WAIT_MS), 600); cache.put(ALL_KEY, '[]', 1800); } catch (e) {} }
  keys.forEach(function (k) { var t = failTimes_(cache, k, now); t.push(now); try { cache.put(k, JSON.stringify(t.slice(-50)), 1800); } catch (e) {} });
}

function login(code, deviceId, withHome) {
  cachedReads_();                                                   // read-only: snapshots, no Sheet (#42)
  var keys = loginKeys_(code, deviceId);
  if (loginLockedAll_()) return { ok: false, locked: true, msg: LOCK_ALL_MSG };
  if (loginLocked_(keys)) return { ok: false, locked: true, msg: LOCK_MSG };
  if (isTeacherCode_(code)) return { ok: true, teacher: true, app_name: getSettings_().app_name, version: APP_VERSION };
  var st = findStudent_(code);
  if (!st) {
    loginFailed_(keys);
    return { ok: false, msg: loginLockedAll_() ? LOCK_ALL_MSG : loginLocked_(keys) ? LOCK_MSG : 'Code not found. Check it or ask your teacher.' };
  }
  if (!isYes_(st.active)) return { ok: false, msg: 'This code is locked. Ask your teacher.' };
  var home = null; if (withHome) { try { home = homeData(code); } catch (e) { home = null; } }   // #42: one round trip
  return { ok: true, student: { code: normCode_(st.student_code), name: String(st.name || '') },
           app_name: getSettings_().app_name, version: APP_VERSION, home: home };
}

/* ============================== sets ============================== */

var SET_PART = 'P'; // a set is one untimed part

function findSet_(setId) {
  var t = readTable_('Sets');
  for (var i = 0; i < t.rows.length; i++) if (String(t.rows[i].set_id) === String(setId)) return t.rows[i];
  return null;
}
function requireSet_(code, setId) {
  requireStudent_(code);
  var s = findSet_(setId);
  if (!s || normCode_(s.student_code) !== normCode_(code)) throw new Error('SESSION: This set was not found.');
  return s;
}
function parseState_(s) { try { return s.state_json ? JSON.parse(s.state_json) : null; } catch (e) { return null; } }
function isOpenStatus_(v) { return String(v) === 'in_progress'; }
function isFinished_(s) { return String(s.status) === 'submitted'; }
/** #47: the student chose "Start a new set instead" for this unfinished set: status abandoned (not graded, not in the history;
 *  its answers stay in the Sheet). Only the set the page names, only an open practice / mixed set; returns the rest. */
function abandonReplaced_(open, replace) {
  if (!replace) return open;
  return open.filter(function (o) {
    if (String(o.set_id) !== String(replace) || ['practice', 'mixed'].indexOf(String(o.kind)) < 0) return true;
    updateRow_('Sets', o._row, { status: 'abandoned', progress: 'Closed: a new set was started', last_saved_at: nowIso_() });
    return false;
  });
}
function setQids_(s) { return String(s.qids || '').split(/[,\s]+/).map(function (x) { return x.trim(); }).filter(String); }

/** The set's questions (server side, keys included), in set order, with part / display_no set. */
var _setQ = {};
function setQuestions_(s) {
  var id = String(s.set_id);
  if (_setQ[id]) return _setQ[id];
  var qs = libQuestions_(setQids_(s)).map(function (q, i) {
    var o = JSON.parse(JSON.stringify(q)); o.part = SET_PART; o.display_no = i + 1; return o;
  });
  return (_setQ[id] = qs);
}

/** Title of a set for students / the Sheet ("Practice · Linear functions"). */
function setTitle_(s) {
  var kind = String(s.kind || 'practice');
  if (kind === 'practice') return 'Practice · ' + (clean_(s.subskill || '') ? subskillName_(clean_(s.subskill)) : (skillName_(String(s.skill || '')) || 'Mixed'));
  if (kind === 'review') return 'Review';
  if (kind === 'mixed') return MIXED_TITLE;
  if (kind === 'placement') return PL_TITLE;
  return s.assignment_id ? assignmentTitle_(s.assignment_id) : 'Assignment';
}

/** Profile of a set: one part, no time limit, calculator + reference (SAT Math). */
function setProfile_(s, n) {
  return {
    exam: 'SAT Math', title: setTitle_(s), part_word: 'set', question_font: 'serif', reference_sheet: 'sat_math',
    untimed: true, pause_allowed_between_parts: false,
    parts: [{ part: SET_PART, title: setTitle_(s), n: n, time_limit_sec: 0, calculator: true, reference: true, annotate: false,
              layout: 'single', spr_layout: 'split', choices: 4, can_return: true,
              directions_html: '<p>The questions in this set are from the SAT Math library. There is no time limit. ' +
                'You may use the Desmos calculator and the reference sheet. For multiple-choice questions, choose the best answer. ' +
                'For student-produced response questions, type your answer in the box.</p>' }]
  };
}

/** Client-safe question object — whitelist only (never key, accepted, tags, source, notes). Figures: src only when given. */
function clientQuestion_(q, withFigs) {
  return {
    qid: q.qid, part: q.part, display_no: q.display_no, type: q.type || 'mcq',
    stem_html: q.stem_html || '', passage_html: q.passage_html || '',
    figures: (q.figures || []).map(function (f, i) {
      var o = { fid: q.qid + '#' + i, src: withFigs ? figSrc_(f) : '', alt: f.alt || '', position: f.position || 'before_stem',
               width: f.width || null, caption: f.caption || '' };
      if (o.position === 'in_choice') o.choice = String(f.choice || '');        // a graph as an answer choice (OLD2-2-09, CB …)
      if (o.position === 'in_stem') o.after_p = Number(f.after_p) || 0;         // between the stem's paragraphs
      return o;
    }),
    choices: (q.choices || []).map(function (c) { return { label: c.label, html: c.html }; })
  };
}
var FIGS_WITH_SET = 3; // figures of the first 3 questions come with the set; the rest by getFigures (spec v1.1 §6.1)

/** Start a self-practice set: one CB skill + n questions (selection in Select.gs). Returns the new set id. */
function startPractice(code, skill, n, opts) { return withSet_(startPracticeCore_(code, skill, n, opts && opts.replace), code, opts); }
/** #42: one round trip instead of two — the set is opened in the same call when the page asks for it (opts = getSet opts). */
function withSet_(r, code, opts) {
  if (!opts || !r || !r.set_id || r.done) return r;
  var o = {}; Object.keys(opts).forEach(function (k) { if (k !== 'replace') o[k] = opts[k]; });
  try { r.set = getSet(code, r.set_id, o); } catch (e) { /* the page opens it with its own call */ }
  return r;
}
function startPracticeCore_(code, skill, n, replace, sub) {
  var st = requireStudent_(code), codeN = normCode_(st.student_code), S = getSettings_();
  var sizes = String(S.set_sizes).split(/[,\s]+/).map(Number).filter(Boolean);
  n = Number(n);
  if (sizes.indexOf(n) < 0) throw new Error('FORM: Choose ' + sizes.join(', ') + ' questions.');
  skill = String(skill || '').trim();
  if (!skillName_(skill)) throw new Error('FORM: This skill is not in the library.');
  var mx = skillProfile_(skill).max_set; if (mx && n > mx) n = mx;      // rare skills (Skill_Profile max_set): 5 questions only
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    sub = clean_(sub || '');
    var open = readTable_('Sets').rows.filter(function (r) { return normCode_(r.student_code) === codeN && isOpenStatus_(r.status) && String(r.kind) === 'practice' && String(r.skill) === skill && clean_(r.subskill || '') === sub; });
    open = abandonReplaced_(open, replace);                             // #47 "Start a new set instead" (the student said yes)
    if (open.length) { var o = open[open.length - 1]; return { ok: true, set_id: String(o.set_id), resumed: true, n: Number(o.n) || 0 }; } // one open practice set per skill
    var setId = newSetId_(codeN);
    var pick = sub ? pickForSub_(codeN, skill, sub, n, setId) : pickForPractice_(codeN, skill, n, setId);
    if (!pick.qids.length) throw new Error('FORM: There are no questions for this skill yet. Try another skill.');
    appendObjects_('Sets', [{
      set_id: setId, student_code: codeN, kind: 'practice', skill: txt_(skill), subskill: sub ? txt_(sub) : '', n: pick.qids.length, qids: pick.qids.join(','),
      level_at_start: pick.level || '', slots: pick.slots || '', created_at: nowIso_(), status: 'in_progress',
      events_saved: 0, last_saved_at: nowIso_()
    }]);
    var out = { ok: true, set_id: setId, n: pick.qids.length, short: pick.qids.length < n };
    if (sub) { out.sub = sub; out.sub_n = pick.sub_n; out.filled = pick.qids.length - pick.sub_n; out.sub_name = subskillName_(sub); out.skill_name = skillName_(skill); }
    return out;
  } finally { lock.releaseLock(); }
}
function newSetId_(codeN) {
  var day = fmtDate_(new Date(), 'yyyyMMdd');
  var mine = readTable_('Sets').rows.filter(function (r) { return String(r.set_id).indexOf('S-' + day + '-' + codeN + '-') === 0; }).length;
  return 'S-' + day + '-' + codeN + '-' + (mine + 1);
}

/** Open (or resume) a set: questions + figures of the first questions + state. */
function getSet(code, setId, opts) {
  opts = opts || {};
  var st = requireStudent_(code);
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  var s, copy;
  try {
    s = findSet_(setId);
    if (!s || normCode_(s.student_code) !== normCode_(st.student_code)) throw new Error('SESSION: This set was not found.');
    if (!isOpenStatus_(s.status)) throw new Error('SESSION: This set is already submitted.');
    copy = newCopyToken_();
    var f = { copy_token: copy };
    if (opts.device) f.device = txt_(String(opts.device).slice(0, 60));
    updateRow_('Sets', s._row, f); // this window is now the live copy; older ones stop (Test Zone #21 N1)
  } finally { lock.releaseLock(); }
  var qs = setQuestions_(s);
  if (!qs.length) throw new Error('FORM: The questions of this set are not available. Ask your teacher.');
  var S = getSettings_(), pl = String(s.kind) === 'placement';
  var prof = setProfile_(s, qs.length);
  if (pl) {
    prof.placement = true; prof.n_range = '8–24';
    prof.parts[0].directions_html = '<p>This test finds your level in the four areas of SAT Math. You get one question at a time; the next one ' +
      'depends on your answer. You cannot go back to a question. There is no timer, but the time on each question is recorded, so take your time ' +
      'and work carefully. You may use the Desmos calculator and the reference sheet. You can stop and continue later from your home page.</p>' +
      (isYes_(getSettings_().away_notice_placement) ? '<p class="pl-away-note">This test notes when you leave the test window.</p>' : '');
  }
  var plk = null; if (pl) try { plk = plPackFor_(s); } catch (e) { plk = null; }                    // #43: key of the current item only
  return {
    ok: true, pl: plk,
    session: { session_id: String(s.set_id), form_id: String(s.set_id), attempt_no: 1, student_name: String(st.name || ''),
               events_saved: Number(s.events_saved) || 0 },
    resumed: !!parseState_(s), state: parseState_(s), copy: copy, server_now: Date.now(),
    profile: prof,
    questions: qs.map(function (q, i) { return clientQuestion_(q, pl ? i === qs.length - 1 : i < FIGS_WITH_SET); }),
    settings: { app_name: S.app_name, autosave_sec: S.autosave_sec, desmos_api_key: desmosKey_(), show_results: 'score_and_right_wrong',
                away_min_sec: Number(S.away_min_sec) || 2, away_notice: String(s.kind) === 'placement' && isYes_(S.away_notice_placement) },
    ask_note_max: Number(S.ask_note_max) || 200
  };
}

/** The rest of a set's figures (background load after the set opens). Only figures of questions of this student's set. */
function getFigures(code, setId, fids) {
  cachedReads_();                                                   // read-only: snapshots, no Sheet (#42)
  var s = requireSet_(code, setId);
  var byQ = {}; setQuestions_(s).forEach(function (q) { byQ[q.qid] = q; });
  var out = {};
  (fids || []).slice(0, 60).forEach(function (fid) {
    var m = /^(.+)#(\d+)$/.exec(String(fid)); if (!m || !byQ[m[1]]) return;
    var f = (byQ[m[1]].figures || [])[Number(m[2])]; if (!f) return;
    out[fid] = figSrc_(f);
  });
  return { ok: true, figures: out };
}

function desmosKey_() { return getSettings_().desmos_api_key || 'dcb31709b452b1cf9dc26972add0fda6'; } // empty = Desmos public demo key

/* ---------------- state merge (Test Zone, no time limits) ---------------- */
function mergeState_(serverState, clientState, setStartMs, nowMs) {
  var st = clientState || {};
  var starts = (serverState && serverState.part_starts) || {};
  var cStarts = st.part_starts || {};
  Object.keys(cStarts).forEach(function (p) {
    if (!starts[p]) {
      var v = Number(cStarts[p]) || nowMs;
      if (v > nowMs) v = nowMs;
      if (setStartMs && v < setStartMs) v = setStartMs;
      starts[p] = v;
    }
  });
  st.part_starts = starts;
  var ended = (serverState && serverState.ended) || {};
  st.ended = st.ended || {};
  Object.keys(ended).forEach(function (p) {
    if (!ended[p]) return;
    st.ended[p] = ended[p];
    if (serverState.parts && serverState.parts[p]) { st.parts = st.parts || {}; st.parts[p] = serverState.parts[p]; }
  });
  return st;
}

/** Server-side check of what the browser sent (Test Zone #16 m6): answers only for the set's questions —
 *  MCQ = one of its choice letters, SPR = what fits the SAT answer box; eliminated = choice letters; marks = true. */
function cleanAnswers_(qs, state) {
  if (!state || !state.parts) return state;
  var byQ = {}; qs.forEach(function (q) { byQ[q.qid] = q; });
  Object.keys(state.parts).forEach(function (p) {
    var ps = state.parts[p];
    if (p !== SET_PART || !ps || typeof ps !== 'object') { delete state.parts[p]; return; }
    var ans = {}, elim = {}, mark = {}, ask = {};
    Object.keys(ps.ans || {}).forEach(function (qid) {
      var v = cleanAnswer_(byQ[qid], ps.ans[qid]);
      if (v !== null && v !== '') ans[qid] = v;
    });
    Object.keys(ps.elim || {}).forEach(function (qid) {
      var q = byQ[qid];
      if (!q || (q.type || 'mcq') !== 'mcq' || !Array.isArray(ps.elim[qid])) return;
      var ok = choiceLetters_(q);
      elim[qid] = ps.elim[qid].map(function (l) { return String(l).toUpperCase(); }).filter(function (l, i, a) { return ok.indexOf(l) >= 0 && a.indexOf(l) === i; });
    });
    Object.keys(ps.mark || {}).forEach(function (qid) { if (byQ[qid] && ps.mark[qid]) mark[qid] = true; });
    var max = Number(getSettings_().ask_note_max) || 200;
    Object.keys(ps.ask || {}).forEach(function (qid) { var v = ps.ask[qid]; if (byQ[qid] && v !== false && v !== null && v !== undefined) ask[qid] = String(v === true ? '' : v).slice(0, max); });
    ps.ans = ans; ps.elim = elim; ps.mark = mark; ps.ask = ask;
  });
  return state;
}
function cleanEvents_(qs, events) {
  if (!Array.isArray(events)) return events;
  var qm = {}; qs.forEach(function (q) { qm[q.qid] = q; });
  events.forEach(function (e) {
    if (!e || (e.type !== 'select' && e.type !== 'change')) return;
    var v = cleanAnswer_(qm[String(e.qid)], e.value);
    e.value = v === null ? '' : v;
  });
  return events;
}
function choiceLetters_(q) {
  var l = (q.choices || []).map(function (c) { return String(c.label).toUpperCase(); });
  return l.length ? l : ['A', 'B', 'C', 'D'];
}
/** The answer as it is stored, '' = blank, null = not a valid answer for this question. */
function cleanAnswer_(q, v) {
  if (!q) return null;
  if (v === null || v === undefined || v === '') return '';
  if (typeof v !== 'string' && typeof v !== 'number') return null;
  var s = String(v).trim();
  if (!s) return '';
  if ((q.type || 'mcq') === 'spr') { s = s.replace(/−/g, '-'); return sprValid_(s) ? s : null; }
  s = s.toUpperCase();
  return choiceLetters_(q).indexOf(s) >= 0 ? s : null;
}
/** What the SAT answer box accepts: digits, at most one "." or "/", "-" only first, 5 characters (6 with "-"). */
function sprValid_(s) {
  s = String(s);
  if (s.length > (s.charAt(0) === '-' ? 6 : 5)) return false;
  return /^-?\d*([.\/]\d*)?$/.test(s) && /\d/.test(s);
}

/* ---- one live copy per set (Test Zone #21 N1) ---- */
function newCopyToken_() { return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }
function staleCopy_(s, payload) {
  var cur = String(s.copy_token || ''), mine = payload && payload.copy ? String(payload.copy) : '';
  return !!(cur && mine && cur !== mine);
}
function otherCopy_() { return { ok: false, other_copy: true, msg: 'This set is open in another window. Close this one.', server_now: Date.now() }; }

function eventRows_(setId, events) {
  var logged = nowIso_();
  return events.map(function (e) {
    var val = e.value;
    if (val !== null && val !== undefined && typeof val === 'object') val = JSON.stringify(val);
    return { set_id: setId, t_ms: Math.round(Number(e.t_ms) || 0), qid: txt_(String(e.qid || '').slice(0, 60)),
             type: txt_(String(e.type || '').slice(0, 30)), value: (val === null || val === undefined) ? '' : txt_(String(val).slice(0, 500)),
             logged_at: logged };
  });
}
/** Append the part of the client event delta the server hasn't stored yet. Returns new events_saved. */
function storeEvents_(s, payload) {
  var saved = Number(s.events_saved) || 0;
  var from = Number(payload.ev_from) || 0;
  var evs = payload.events || [];
  var fresh = evs.slice(Math.max(0, saved - from));
  if (fresh.length) appendObjects_('Events', eventRows_(String(s.set_id), fresh));
  return Math.max(saved, from + evs.length);
}
function compactState_(state) {
  var s = JSON.stringify(state);
  if (s.length > 45000 && state.parts) { Object.keys(state.parts).forEach(function (p) { if (state.parts[p]) state.parts[p].hl = {}; }); s = JSON.stringify(state); }
  return s;
}
function progressText_(qs, state) {
  try {
    var ps = (state.parts || {})[SET_PART] || {}, ans = ps.ans || {};
    var answered = Object.keys(ans).filter(function (k) { return ans[k] !== ''; }).length;
    return answered + '/' + qs.length + ' answered · Q' + ((Number(ps.cur) || 0) + 1);
  } catch (e) { return ''; }
}

/** Autosave (≤ every autosave_sec, plus on leave). payload: { state, events: [delta], ev_from, copy } */
function autosave(code, setId, payload) {
  payload = payload || {};
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var s = requireSet_(code, setId);
    if (!isOpenStatus_(s.status)) return { ok: false, closed: true, status: String(s.status), server_now: Date.now() };
    if (staleCopy_(s, payload)) return otherCopy_();
    var qs = setQuestions_(s);
    cleanEvents_(qs, payload.events);
    var nowMs = Date.now();
    var state = mergeState_(parseState_(s), payload.state, toMs_(s.created_at) - 3600000, nowMs);
    cleanAnswers_(qs, state);
    var evSaved = storeEvents_(s, payload);
    var ps = (state.parts || {})[SET_PART] || {};
    updateRow_('Sets', s._row, { last_saved_at: nowIso_(), events_saved: evSaved, state_json: compactState_(state),
                                 current_q: (Number(ps.cur) || 0) + 1, progress: progressText_(qs, state) });
    return { ok: true, server_now: nowMs, events_saved: evSaved, part_starts: state.part_starts, ended: state.ended, status: 'in_progress' };
  } finally { lock.releaseLock(); }
}

/** #43: a key list for the browser, never plain: JSON, XOR with the set + question, hex. Only ever for ONE item the student
 *  is on (placement item, Fix question) — see plPack_ and fixKey. */
function encKey_(keys, salt) {
  var t = unescape(encodeURIComponent(JSON.stringify(keys))), out = '';                            // UTF-8 bytes
  salt = String(salt || 'sml');
  for (var i = 0; i < t.length; i++) { var c = (t.charCodeAt(i) ^ salt.charCodeAt(i % salt.length) ^ (37 + i * 11) % 251) & 255; out += (c < 16 ? '0' : '') + c.toString(16); }
  return out;
}

/* ============================== grading ============================== */

function isCorrect_(q, answer) {
  if (answer === undefined || answer === null || answer === '') return false;
  var keys = keyList_(q);
  if ((q.type || 'mcq') === 'spr') return sprCorrect_(answer, keys);
  return keys.some(function (k) { return String(k).trim().toUpperCase() === String(answer).trim().toUpperCase(); });
}
/** Key list of a question: MCQ = [letter]; SPR = accepted forms (+ the key itself). */
function keyList_(q) {
  var k = Array.isArray(q.key) ? q.key.slice() : (q.key === undefined || q.key === null || q.key === '' ? [] : [q.key]);
  if ((q.type || 'mcq') === 'spr' && Array.isArray(q.accepted)) q.accepted.forEach(function (a) { if (k.indexOf(a) < 0) k.push(a); });
  return k.map(String);
}

/**
 * Student-produced response (SAT rules, Test Zone): 5 characters (6 with "-"); any form with exactly the key's value
 * counts (3/4 = .75 = 0.75 = 6/8); a decimal that does not fit may be truncated or rounded but must then fill the box.
 * A decimal key that is not exact (0.651 next to 441/677) is a rounded form: it only matches as typed text.
 */
function sprCorrect_(answer, keys) {
  var a = String(answer).trim().replace(/−/g, '-');
  if (!a) return false;
  var neg = a.charAt(0) === '-', room = neg ? 6 : 5;
  if (a.length > room) return false;
  var ks = keys.map(function (k) { return String(k).trim().replace(/−/g, '-'); }).filter(String);
  if (ks.indexOf(a) >= 0) return true;
  var exact = sprExactValues_(ks);
  var av = sprParse_(a);
  if (!av) return false;
  return exact.some(function (kv) {
    if (av.n * kv.d === kv.n * av.d) return true;
    if (av.dec === null || av.dec < 1 || a.length !== room) return false;
    var p10 = Math.pow(10, av.dec), num = Math.abs(kv.n) * p10, sign = kv.n < 0 ? -1 : 1;
    var trunc = sign * Math.floor(num / kv.d), rnd = sign * Math.floor((2 * num + kv.d) / (2 * kv.d));
    return av.n === trunc || av.n === rnd;
  });
}
function sprExactValues_(ks) {
  var parsed = ks.map(sprParse_).filter(Boolean);
  var exact = parsed.filter(function (k) { return k.dec === null || k.dec === 0; });
  var decs = parsed.filter(function (k) { return k.dec !== null && k.dec > 0; });
  if (!exact.length && decs.length) {
    var same = decs.every(function (k) { return k.n * decs[0].d === decs[0].n * k.d; });
    return same ? [decs[0]] : [];
  }
  return exact;
}
function sprParse_(s) {
  var m = String(s).match(/^(-?)(\d+)\/(\d+)$/);
  if (m) { var d = Number(m[3]); return d ? { n: (m[1] ? -1 : 1) * Number(m[2]), d: d, dec: null } : null; }
  m = String(s).match(/^(-?)(\d*)(?:\.(\d*))?$/);
  if (!m || !(m[2] + (m[3] || '')).length) return null;
  var frac = m[3] || '';
  return { n: (m[1] ? -1 : 1) * Number((m[2] || '0') + frac), d: Math.pow(10, frac.length), dec: frac.length };
}
/** Tags (Questions tab) of these questions: skill, subskill, difficulty, level. */
function tagsOf_(qids) {
  var want = {}; qids.forEach(function (q) { want[q] = 1; });
  var out = {};
  questionRows_().forEach(function (r) {                              // #50: with the teacher's level overrides
    var id = String(r.qid); if (!want[id]) return;
    out[id] = { domain: String(r.domain || ''), skill: String(r.skill || ''), subskill: String(r.subskill || ''),
                difficulty: String(r.difficulty || 'H'), level: Number(r.level) || '' };
  });
  return out;
}

/** Full ordered event list of a set: rows already in Events + the client's unsent tail. */
function fullEvents_(s, payload) {
  var saved = Number(s.events_saved) || 0, from = Number(payload.ev_from) || 0, client = payload.events || [];
  if (from === 0 && saved <= client.length) return client;
  var stored = readTable_('Events').rows.filter(function (r) { return String(r.set_id) === String(s.set_id); }).map(function (r) {
    return { part: SET_PART, t_ms: Number(r.t_ms) || 0, qid: String(r.qid || ''), type: String(r.type), value: r.value === '' ? null : r.value };
  });
  return stored.concat(client.slice(Math.max(0, saved - from)));
}

/** Per-question metrics from the events (Test Zone deriveMetrics_). Time while the page was away is not counted. */
function deriveMetrics_(events, qids) {
  var m = {};
  qids.forEach(function (id) { m[id] = { visits: 0, time_ms: 0, first_visit_ms: null, order: null, answers: [], calc: false, ref: false, ever_marked: false,
                                          iv: [], last_ans_t: null, away_n: 0, away_ms: 0 }; });
  var openQ = null, openT = 0, visitIdx = {}, order = 0, calcOpen = false, lastT = 0, resumeQ = null;
  function close(t) {
    if (openQ && m[openQ]) {
      var d = Math.max(0, t - openT); m[openQ].time_ms += d; if (visitIdx[openQ] === 1) m[openQ].first_visit_ms = (m[openQ].first_visit_ms || 0) + d;
      if (d > 0) m[openQ].iv.push([openT, t]);
    }
    openQ = null;
  }
  events.forEach(function (e) {
    var t = Number(e.t_ms) || 0, q = e.qid;
    switch (e.type) {
      case 'resume': if (openQ) resumeQ = openQ; close(lastT); resumeQ = resumeQ || '__any__'; break;
      case 'q_enter':
        close(t);
        if (m[q]) {
          openQ = q; openT = t;
          var cont = resumeQ && (resumeQ === q || resumeQ === '__any__') && visitIdx[q];
          resumeQ = null;
          if (!cont) { m[q].visits++; visitIdx[q] = (visitIdx[q] || 0) + 1; }
          if (m[q].order === null) m[q].order = ++order;
          if (calcOpen) m[q].calc = true;
        }
        break;
      case 'q_leave': if (openQ === q) { if (String(e.value) === 'pagehide') resumeQ = q; close(t); } break;
      case 'review_open': case 'part_end': resumeQ = null; close(t); break;
      case 'select': case 'change': if (m[q]) { m[q].answers.push(String(e.value)); m[q].last_ans_t = t; } break;
      case 'away': if (m[q]) { m[q].away_n++; m[q].away_ms += Math.max(0, Number(e.value) || 0); } break;
      case 'mark': if (m[q]) m[q].ever_marked = true; break;
      case 'calc_open': calcOpen = true; if (openQ && m[openQ]) m[openQ].calc = true; break;
      case 'calc_close': calcOpen = false; break;
      case 'ref_open': if (openQ && m[openQ]) m[openQ].ref = true; break;
    }
    if (e.type !== 'resume') lastT = Math.max(lastT, t);
  });
  close(lastT);
  // #48 time to the final answer: the time on the question before the moment its last answer was chosen (every visit up to
  // then; a revisit after it — no change — does not count). No answer event (old data) → all the time.
  qids.forEach(function (id) {
    var x = m[id];
    if (x.last_ans_t === null) { x.ans_ms = x.time_ms; return; }
    x.ans_ms = x.iv.reduce(function (a, v) { return a + Math.max(0, Math.min(v[1], x.last_ans_t) - v[0]); }, 0);
  });
  return m;
}

/** #70 the time of a set (Minh): Σ per question (time to the final answer − time outside the window), each capped at 20 min.
 *  capped = how many questions hit the cap. */
var SET_Q_CAP_SEC_ = 1200;
function setTimeOf_(rows) {
  var sec = 0, capped = 0;
  rows.forEach(function (r) {
    var t = Math.max(0, (Number(r.time_try1_sec) || 0) - (Number(r.away_sec) || 0));
    if (t > SET_Q_CAP_SEC_) { t = SET_Q_CAP_SEC_; capped++; }
    sec += t;
  });
  return { min: round_(sec / 60, 1), capped: capped };
}
/** #48 per set (teacher only): answering · checking (on answered questions after their final answer) · blank, and the
 *  leave-window log (count, seconds, at which questions). */
function setPaceFields_(f, rows) {
  var sum = function (fn) { return rows.reduce(function (a, r) { return a + (Number(fn(r)) || 0); }, 0); };
  var used = sum(function (r) { return r.time_total_sec; }), blank = sum(function (r) { return r.profile === 'BLANK' ? r.time_total_sec : 0; });
  var ans = sum(function (r) { return r.profile === 'BLANK' ? 0 : (r.time_answer_sec === '' || r.time_answer_sec === undefined ? r.time_total_sec : r.time_answer_sec); });
  f.time_answer_min = round_(ans / 60, 1); f.time_blank_min = round_(blank / 60, 1); f.time_check_min = round_(Math.max(0, used - ans - blank) / 60, 1);
  var aw = rows.filter(function (r) { return Number(r.away_n) > 0; }).sort(function (a, b) { return Number(a.order) - Number(b.order); });
  f.away_n = aw.length ? sum(function (r) { return r.away_n; }) : 0; f.away_sec = aw.length ? sum(function (r) { return r.away_sec; }) : 0;
  f.away_at = aw.map(function (r) { return 'Q' + r.order; }).join(', ');
  return f;
}

function gradeSet_(s, state, events) {
  var qs = setQuestions_(s), S = getSettings_(), tags = tagsOf_(qs.map(function (q) { return q.qid; }));
  var ps = (state && state.parts && state.parts[SET_PART]) || {};
  var evs = events.slice().sort(function (a, b) { return (Number(a.t_ms) || 0) - (Number(b.t_ms) || 0); });
  var mm = deriveMetrics_(evs, qs.map(function (q) { return q.qid; }));
  var rows = [], right = 0, now = nowIso_();
  qs.forEach(function (q, i) {
    var x = mm[q.qid], fin = (ps.ans && ps.ans[q.qid]) || '';
    var corr = fin ? isCorrect_(q, fin) : false;
    if (corr) right++;
    var vals = x.answers.filter(function (v) { return v !== '' && v !== 'null'; });
    var first = vals.length ? vals[0] : fin;
    var nCh = 0; for (var k = 1; k < vals.length; k++) if (vals[k] !== vals[k - 1]) nCh++;
    var firstCorr = first ? isCorrect_(q, first) : null;
    var pattern = 'none';
    if (first && !fin) pattern = 'cleared';
    else if (first && fin && first !== fin) pattern = (firstCorr ? 'R' : 'W') + '→' + (corr ? 'R' : 'W');
    var tg = tags[q.qid] || ((q.tags) ? { domain: q.tags.domain, skill: q.tags.skill, subskill: q.tags.subskill, difficulty: q.tags.difficulty, level: q.tags.level } : {});
    // #48: pace (Rushed / Slow, SLOW_RIGHT, GUESS_LIKELY, IDLE_LIKELY, placement bands) reads the time to the final answer;
    // the total time on the question is kept (time_total_sec). A blank question: its time is "time on blank questions".
    var totalSec = x.time_ms / 1000, timeSec = fin ? x.ans_ms / 1000 : totalSec;
    var norm = timeNormFor_(q.type, tg.difficulty);
    var tp = timeProfile_(!!fin, corr, Math.min(timeSec, norm ? norm.slow * 3 : timeSec), norm, 120, S);
    var elim = ((ps.elim && ps.elim[q.qid]) || []).slice().sort();
    var flags = [];
    if (pattern === 'R→W') flags.push('CHANGED_R_TO_W');
    if (pattern === 'W→R') flags.push('CHANGED_W_TO_R');
    if (fin && timeSec < S.guess_min_time_sec) flags.push('GUESS_LIKELY');
    if (norm && timeSec > norm.slow * 3) flags.push('IDLE_LIKELY');
    var keys = keyList_(q);
    if ((q.type || 'mcq') === 'mcq' && elim.some(function (l) { return keys.indexOf(l) >= 0; })) flags.push('ELIM_KEY');
    rows.push({
      set_id: String(s.set_id), student_code: normCode_(s.student_code), qid: q.qid, order: i + 1,
      skill: txt_(tg.skill), subskill: txt_(tg.subskill), difficulty: tg.difficulty || '', level: tg.level || '',
      try1_answer: txt_(fin), try1_correct: fin ? (corr ? 1 : 0) : '', final_answer: txt_(fin), best_correct: corr ? 1 : 0,
      n_tries: fin ? 1 : 0, locked: '', fixed_at: '', n_changes: nCh, change_pattern: pattern, eliminated: elim.join(','),
      ever_marked: !!(x.ever_marked || (ps.mark && ps.mark[q.qid])), visits: x.visits,
      time_try1_sec: round_(timeSec, 1), time_total_sec: round_(totalSec, 1), time_answer_sec: fin ? round_(timeSec, 1) : 0, pace_ratio: round_(tp.ratio, 2),
      away_n: x.away_n || '', away_sec: x.away_n ? round_(x.away_ms / 1000, 0) : '',
      calc_used: !!x.calc, ref_used: !!x.ref, profile: tp.profile, flags: flags.join(','), submitted_at: now,
      asked: ps.ask && q.qid in ps.ask ? 1 : '', ask_note: ps.ask && ps.ask[q.qid] ? txt_(ps.ask[q.qid]) : '',
      ask_at: ps.ask && q.qid in ps.ask ? now : '', ask_status: ps.ask && q.qid in ps.ask ? 'open' : '',
      ask_code: ps.ask && q.qid in ps.ask ? txt_(q.code || '') : ''
    });
  });
  return { rows: rows, right: right, n: qs.length };
}

/** Submit a set. Idempotent: a second submit returns the stored result. payload: { state, events, ev_from, device, copy } */
function submit(code, setId, payload) {
  payload = payload || {};
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var s = requireSet_(code, setId);
    if (String(s.kind) === 'placement') return isFinished_(s) ? placementStudentView_(s) : { ok: false, msg: 'Answer the questions one by one.' };
    if (isFinished_(s)) return resultView_(s, responsesOf_(setId), false);
    if (staleCopy_(s, payload)) return otherCopy_();
    var qs = setQuestions_(s);
    cleanEvents_(qs, payload.events);
    var state = mergeState_(parseState_(s), payload.state, toMs_(s.created_at) - 3600000, Date.now());
    cleanAnswers_(qs, state);
    var all = fullEvents_(s, payload);
    var evSaved = storeEvents_(s, payload);
    var g = gradeSet_(s, state, all);
    appendObjects_('Responses', g.rows);
    appendObjects_('Tries', g.rows.filter(function (r) { return r.try1_correct !== ''; }).map(function (r) {
      return { set_id: r.set_id, student_code: r.student_code, qid: r.qid, try_no: 1, answer: r.try1_answer, correct: r.try1_correct, time_sec: r.time_try1_sec, at: r.submitted_at };
    }));
    var used = g.rows.reduce(function (a, r) { return a + (Number(r.time_total_sec) || 0); }, 0);
    var fields = { submitted_at: nowIso_(), status: 'submitted', events_saved: evSaved, last_saved_at: nowIso_(), progress: 'Submitted',
                   state_json: compactState_(state), first_try: g.right, best_score: g.right,
                   n_blank: g.rows.filter(function (r) { return r.profile === 'BLANK'; }).length, time_used_min: round_(used / 60, 1) };
    setPaceFields_(fields, g.rows);
    if (payload.device) fields.device = txt_(String(payload.device).slice(0, 60));
    updateRow_('Sets', s._row, fields);
    var done = {}; Object.keys(s).forEach(function (k) { done[k] = s[k]; }); Object.keys(fields).forEach(function (k) { done[k] = fields[k]; });
    try { reviewAfterSubmit_(done, g.rows); } catch (e) { console.error('REVIEW UPDATE FAILED ' + setId + ': ' + (e && e.stack || e)); }
    try { afterSubmit_(done, g.rows); } catch (e) { console.error('LEVELS UPDATE FAILED ' + setId + ': ' + (e && e.stack || e)); }
    return resultView_(done, g.rows, false);
  } finally { lock.releaseLock(); }
}

/* ============================== result · review · teacher ============================== */

function responsesOf_(setId) { return readTable_('Responses').rows.filter(function (r) { return String(r.set_id) === String(setId); }); }

/** "My Sets" → open a past result. */
function getResult(code, setId) {
  cachedReads_();                                                   // read-only: snapshots, no Sheet (#42)
  var s = requireSet_(code, setId);
  if (!isFinished_(s)) return { ok: false, msg: 'This set has not been submitted yet.' };
  if (String(s.kind) === 'placement') return placementStudentView_(s);
  return resultView_(s, responsesOf_(setId), false);
}

/** Questions of one finished set for the read-only review: the question + the student's answer, right / wrong, time.
 *  NEVER the key (clientQuestion_ whitelist; status comes from Responses). */
function reviewData_(s, rows, asTeacher) {
  var by = {}; rows.forEach(function (r) { by[String(r.qid)] = r; });
  var qs = setQuestions_(s).filter(function (q) { return by[q.qid]; }).map(function (q) {
    var r = by[q.qid], o = clientQuestion_(q, true);
    if (asTeacher) o.code = q.code || '';                      // the short code (E326) is for the teacher only (Minh 13 Nov)
    o.answer = String(r.final_answer === undefined ? '' : r.final_answer).replace(/^'/, '');
    o.status = String(r.profile) === 'BLANK' || o.answer === '' ? 'blank' : (Number(r.best_correct) === 1 ? 'right' : 'wrong');
    o.time_s = Math.round(Number(r.time_answer_sec !== '' && r.time_answer_sec !== undefined ? r.time_try1_sec : r.time_total_sec) || 0);
    o.label = 'Q' + q.display_no; o.badge = qBadge_(String(r.profile)); o.no = q.display_no;
    o.asked = !!r.asked && String(r.ask_status) !== 'resolved'; o.ask_note = String(r.ask_note || '').replace(/^'/, '');
    return o;
  });
  var p = setProfile_(s, qs.length).parts[0];
  return { ok: true, session_id: String(s.set_id), form_id: String(s.set_id), title: setTitle_(s), question_font: 'serif', reference_sheet: 'sat_math',
           parts: [{ part: p.part, title: p.title, layout: p.layout, spr_layout: p.spr_layout, choices: 4, calculator: true, reference: true,
                     annotate: false, directions_html: p.directions_html }],
           questions: qs, settings: { desmos_api_key: desmosKey_() } };
}
function getReview(code, setId) {
  cachedReads_();                                                   // read-only: snapshots, no Sheet (#42)
  var s = requireSet_(code, setId);
  if (!isFinished_(s)) throw new Error('SESSION: This set has not been submitted yet.');
  if (String(s.kind) === 'placement') throw new Error('SESSION: The placement test has no question review. Your teacher goes over it with you.');
  return reviewData_(s, responsesOf_(setId));
}

/* ============================== fix wrong answers · Ask teacher (spec v1.1 §3, §8) ============================== */

function triesOf_(setId, qid) {
  return readTable_('Tries').rows.filter(function (r) { return String(r.set_id) === String(setId) && String(r.qid) === String(qid); })
    .sort(function (a, b) { return Number(a.try_no) - Number(b.try_no); });
}
function mcqMax_() { return Number(getSettings_().mcq_max_tries) || 3; }
/** Fix state of one Responses row: fixed / locked / open, letters already tried (MCQ), tries left (MCQ; grid-in = unlimited). */
function fixState_(q, r, tries) {
  var mcq = (q.type || 'mcq') === 'mcq', n = Number(r.n_tries) || 0;
  var status = Number(r.try1_correct) === 1 ? 'right' : Number(r.best_correct) === 1 ? 'fixed' : isYes_(r.locked) || String(r.locked) === '1' ? 'locked' : 'open';
  return { status: status, n_tries: n, tries_left: mcq ? Math.max(0, mcqMax_() - n) : null,
           tried: mcq ? tries.filter(function (t) { return Number(t.correct) !== 1; }).map(function (t) { return String(t.answer).replace(/^'/, '').toUpperCase(); }) : [],
           answer: String(r.final_answer === undefined ? '' : r.final_answer).replace(/^'/, ''),
           asked: !!r.asked && String(r.ask_status) !== 'resolved', ask_note: String(r.ask_note || '').replace(/^'/, '') };
}

/** The questions of a submitted set that were not right on try 1 — to fix them (never the key). */
function getFix(code, setId) {
  cachedReads_();                                                   // read-only: snapshots, no Sheet (#42)
  var s = requireSet_(code, setId);
  if (!isFinished_(s)) throw new Error('SESSION: This set has not been submitted yet.');
  if (String(s.kind) === 'placement') throw new Error('SESSION: The placement test has no fixes.');
  var rows = responsesOf_(setId), by = {};
  rows.forEach(function (r) { by[String(r.qid)] = r; });
  var allTries = readTable_('Tries').rows.filter(function (t) { return String(t.set_id) === String(setId); });
  var d = reviewData_(s, rows);
  d.questions = d.questions.filter(function (o) { return Number(by[o.qid].try1_correct) !== 1; }).map(function (o) {
    var q = setQuestions_(s).filter(function (x) { return x.qid === o.qid; })[0];
    var fx = fixState_(q, by[o.qid], allTries.filter(function (t) { return String(t.qid) === o.qid; }));
    Object.keys(fx).forEach(function (k) { o[k] = fx[k]; });
    return o;
  });
  d.max_tries = mcqMax_();
  d.best = { right: rows.filter(function (r) { return Number(r.best_correct) === 1; }).length, n: rows.length };
  d.ask_note_max = Number(getSettings_().ask_note_max) || 200;
  // #43: the key of the first open question (the one Fix opens on), so its first Check is instant too — one question only
  var fo = d.questions.filter(function (o) { return o.status === 'open'; })[0];
  var fq = fo ? setQuestions_(s).filter(function (x) { return x.qid === fo.qid; })[0] : null;
  if (fq) d.fk = { ok: true, qid: fq.qid, k: encKey_(keyList_(fq), String(setId) + '|' + fq.qid), max: mcqMax_(), letters: choiceLetters_(fq) };
  return d;
}

/** One fix try: graded on the server at once. Answers only right / wrong + tries left — never the key. */
function checkTry(code, setId, qid, answer, timeSec) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var s = requireSet_(code, setId);
    if (!isFinished_(s)) throw new Error('SESSION: Submit the set first.');
    if (String(s.kind) === 'placement') throw new Error('SESSION: The placement test has no fixes.');
    var q = setQuestions_(s).filter(function (x) { return x.qid === String(qid); })[0];
    var r = responsesOf_(setId).filter(function (x) { return String(x.qid) === String(qid); })[0];
    if (!q || !r) throw new Error('SESSION: Question not found.');
    var tries = triesOf_(setId, qid), fx = fixState_(q, r, tries);
    var out = function (extra) {
      var rows = responsesOf_(setId);
      var o = { ok: true, qid: q.qid, best: { right: rows.filter(function (x) { return Number(x.best_correct) === 1; }).length, n: rows.length } };
      Object.keys(extra).forEach(function (k) { o[k] = extra[k]; });
      return o;
    };
    if (fx.status === 'right' || fx.status === 'fixed') return out({ correct: true, status: fx.status, tries_left: fx.tries_left, tried: fx.tried });
    if (fx.status === 'locked') return out({ correct: false, status: 'locked', tries_left: 0, tried: fx.tried });
    var a = cleanAnswer_(q, answer);
    if (a === null) return { ok: false, msg: (q.type === 'spr' ? 'This answer does not fit the answer box.' : 'Choose one of the answers.') };
    if (a === '') return { ok: false, msg: 'Enter an answer first.' };
    if ((q.type || 'mcq') === 'mcq' && fx.tried.indexOf(a) >= 0) return { ok: false, msg: 'You already tried ' + a + '.' };
    var n = fx.n_tries + 1, corr = isCorrect_(q, a), now = nowIso_();
    var locked = !corr && (q.type || 'mcq') === 'mcq' && n >= mcqMax_();
    appendObjects_('Tries', [{ set_id: String(setId), student_code: normCode_(s.student_code), qid: q.qid, try_no: n, answer: txt_(a), correct: corr ? 1 : 0,
                               time_sec: round_(Math.max(0, Math.min(Number(timeSec) || 0, 3600)), 1), at: now }]);
    var f = { n_tries: n, final_answer: txt_(a), time_total_sec: round_((Number(r.time_total_sec) || 0) + Math.max(0, Math.min(Number(timeSec) || 0, 3600)), 1) };
    if (corr) { f.best_correct = 1; f.fixed_at = now; }
    if (locked) f.locked = 1;
    updateRow_('Responses', r._row, f);
    var best = responsesOf_(setId).filter(function (x) { return Number(x.best_correct) === 1; }).length;
    updateRow_('Sets', s._row, { best_score: best });
    var tried = fx.tried.slice(); if (!corr && (q.type || 'mcq') === 'mcq') tried.push(a);
    return out({ correct: corr, status: corr ? 'fixed' : locked ? 'locked' : 'open', n_tries: n,
                 tries_left: (q.type || 'mcq') === 'mcq' ? Math.max(0, mcqMax_() - n) : null, tried: tried });
  } finally { lock.releaseLock(); }
}

/** #43 Fix feels instant: the key of the ONE Fix question the student has open (encoded), fetched while they think. The
 *  browser shows right / wrong at once; checkTry still records every try and is the truth. Not for a question already
 *  right, fixed or locked. */
function fixKey(code, setId, qid) {
  cachedReads_();
  var s = requireSet_(code, setId);
  if (!isFinished_(s) || String(s.kind) === 'placement') return { ok: false };
  var q = setQuestions_(s).filter(function (x) { return x.qid === String(qid); })[0];
  var r = responsesOf_(setId).filter(function (x) { return String(x.qid) === String(qid); })[0];
  if (!q || !r) return { ok: false };
  var fx = fixState_(q, r, triesOf_(setId, qid));
  if (fx.status !== 'open') return { ok: false };
  return { ok: true, qid: q.qid, k: encKey_(keyList_(q), String(setId) + '|' + q.qid), max: mcqMax_(), letters: choiceLetters_(q) };
}

/** Ask teacher on a question of a submitted set (during a set the ask rides on the autosaved state). */
function askTeacher(code, setId, qid, on, note) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var s = requireSet_(code, setId);
    if (!isFinished_(s)) throw new Error('SESSION: This set is still open.');
    var r = responsesOf_(setId).filter(function (x) { return String(x.qid) === String(qid); })[0];
    if (!r) throw new Error('SESSION: Question not found.');
    var max = Number(getSettings_().ask_note_max) || 200;
    var qc = (questionRows_().filter(function (x) { return String(x.qid) === String(qid); })[0] || {}).code;
    var f = on ? { asked: 1, ask_note: txt_(String(note || '').slice(0, max)), ask_at: nowIso_(), ask_status: 'open', resolved_at: '', ask_code: txt_(clean_(qc)) }
               : { asked: '', ask_note: '', ask_at: '', ask_status: '', ask_code: '' };
    updateRow_('Responses', r._row, f);
    return { ok: true, qid: String(qid), asked: !!on, note: on ? String(note || '').slice(0, max) : '' };
  } finally { lock.releaseLock(); }
}

/* ---- teacher mode (Settings → teacher_code): read-only; "Show answer" reveals one key on request.
        The full teacher page (classes, priority list, tagging, assignments) comes in a later build. ---- */
function isTeacherCode_(code) {
  var t = String(getSettings_().teacher_code || '').trim().toUpperCase();
  return !!t && t.length >= 4 && String(code || '').trim().toUpperCase() === t;
}
function requireTeacher_(code) { if (!isTeacherCode_(code)) throw new Error('LOGIN: Teacher code not valid.'); }
function isHidden_(s) { return isYes_(s && s.hidden); }

function teacherOverview(code) {
  cachedReads_();                                                   // read-only: snapshots, no Sheet (#42)
  requireTeacher_(code);
  var sets = readTable_('Sets').rows.filter(function (s) { return isFinished_(s) && !isHidden_(s); });
  var out = readTable_('Students').rows.map(function (st) {
    var c = normCode_(st.student_code);
    var mine = sets.filter(function (s) { return normCode_(s.student_code) === c; }).sort(function (a, b) { return toMs_(b.submitted_at) - toMs_(a.submitted_at); });
    return { code: c, name: String(st.name || c), track: '', active: isYes_(st.active),
      attempts: mine.map(function (s) {
        return { session_id: String(s.set_id), title: setTitle_(s), attempt_no: 1, date: dateStr_(s.submitted_at),
                 right: s.first_try === '' ? null : Number(s.first_try), n: Number(s.n) || null, reliable: '', sittings: 1, available: true };
      }) };
  }).sort(function (a, b) { return (b.attempts.length ? 1 : 0) - (a.attempts.length ? 1 : 0) || a.name.localeCompare(b.name); });
  return { ok: true, students: out };
}
function teacherSet_(code, setId) {
  requireTeacher_(code);
  var s = findSet_(setId);
  if (!s || !isFinished_(s)) throw new Error('SESSION: This set was not found.');
  return s;
}
function teacherResult(code, setId) {
  cachedReads_();                                                   // read-only: snapshots, no Sheet (#42)
  var s = teacherSet_(code, setId);
  return String(s.kind) === 'placement' ? placementReport_(s) : resultView_(s, responsesOf_(setId), true);
}
function teacherReview(code, setId) {
  cachedReads_();                                                   // read-only: snapshots, no Sheet (#42)
  var s = teacherSet_(code, setId), r = reviewData_(s, responsesOf_(setId), true), st = findStudent_(s.student_code);
  r.student = st ? String(st.name || '') : String(s.student_code); r.student_code = normCode_(s.student_code);
  // #50: nothing in this payload tells the answer — not the key, and not the student's answer (a right answer = the key);
  // "Wrong only" needs just wrong / not; the answers come with "Student's answer" (classView), the key with "Show answer" (teacherKey)
  var rs = {}; responsesOf_(setId).forEach(function (x) { rs[String(x.qid)] = x; });
  r.questions.forEach(function (q) { q.meta = goMeta_(q.qid); q.wrong = Number((rs[q.qid] || {}).try1_correct) !== 1; delete q.answer; delete q.status; });   // wrong on the first try
  r.keys = goKeys_(r.questions.map(function (q) { return q.qid; }));   // #62 (Minh's call): teacher only, kept in memory, shown on "Show answer" at once
  // #66: the student's entries (all tries) + time of every question, kept in memory: "Student's answer" and the time at once
  try { r.rows = classView(code, 'st:' + normCode_(s.student_code), 's:' + setId).rows; } catch (e) { r.rows = null; }
  return r;
}
/** #62 the keys (+ accepted forms, CB explanation) of a go-over set — ONLY in the teacher's go-over payloads (requireTeacher_ first). */
function goKeys_(qids) {
  var out = {};
  libQuestions_(qids).forEach(function (q) { out[q.qid] = { key: keyList_(q), type: q.type || 'mcq', rationale_html: q.rationale_html || '', cb_id: (q.source || {}).cb_question_id || '' }; });
  return out;
}
/** #50 go-over: what the teacher needs next to a question — never its key. Level (with the override), the CB label,
 *  the skill's allowed difficulties (Skill_Profile), whether it is a Placement item, normal time. */
function goMeta_(qid) {
  var r = questionRows_().filter(function (x) { return String(x.qid) === String(qid); })[0] || {};
  if (!_plItems) { _plItems = {}; try { var f = plForms_(); Object.keys(f).forEach(function (k) { _plItems[f[k]] = 1; }); } catch (e) {} }
  var sk = clean_(r.skill), prof = skillProfile_(sk), norm = timeNormFor_(r.type, r.difficulty);
  return { code: clean_(r.code), cb_id: clean_(r.cb_question_id), skill: sk, skill_name: skillName_(sk), subskill_name: subskillName_(clean_(r.subskill)),
           difficulty: String(r.difficulty || '').toUpperCase(), level: Number(r.level) || '', cb_difficulty: String(r.cb_difficulty || r.difficulty || '').toUpperCase(),
           cb_level: Number(r.cb_level || r.level) || '', overridden: !!r.overridden, source: /^CB-/.test(String(qid)) ? 'CB' : String(r.batch || ''),
           allowed: ['E', 'M', 'H'].filter(function (d) { return prof.allowed[d]; }), placement: !!_plItems[String(qid)], norm_sec: norm ? norm.target : null };
}
var _plItems = null;
/** #50 go-over of any questions (What to go over, the grid, Asked, a Placement report): the test screen content, no key. */
function goOverData(code, qids) {
  cachedReads_();
  requireTeacher_(code);
  qids = (qids || []).map(function (q) { return String(q || '').trim(); }).filter(String).slice(0, 80);
  var all = questionRows_(), byCode = {};
  all.forEach(function (x) { var c = clean_(x.code).toUpperCase(); if (c) byCode[c] = String(x.qid); });
  qids = qids.map(function (q) { return /^[EMH]\d+(B\d*)?$/i.test(q) && byCode[q.toUpperCase()] ? byCode[q.toUpperCase()] : q; });
  var lib = libQuestions_(qids), byQ = {}; lib.forEach(function (q) { byQ[q.qid] = q; });
  var qs = qids.filter(function (q) { return byQ[q]; }).map(function (qid, i) {
    var q = JSON.parse(JSON.stringify(byQ[qid])); q.part = SET_PART; q.display_no = i + 1;
    var o = clientQuestion_(q, true); o.meta = goMeta_(qid); o.code = o.meta.code; o.label = 'Q' + (i + 1); return o;
  });
  if (!qs.length) throw new Error('FORM: Question not found in the library.');
  var p = setProfile_({ kind: 'practice', set_id: 'go', n: qs.length }, qs.length).parts[0];
  return { ok: true, session_id: 'go', form_id: 'go', title: 'Go over', keys: goKeys_(qs.map(function (q) { return q.qid; })), question_font: 'serif', reference_sheet: 'sat_math',
           parts: [{ part: SET_PART, title: 'Go over', layout: p.layout, spr_layout: p.spr_layout, choices: 4, calculator: true, reference: true, annotate: true, directions_html: '' }],
           questions: qs, settings: { desmos_api_key: desmosKey_() } };
}
/** #50 the key of ONE question (+ the CB explanation) — only when the teacher presses "Show answer". */
function teacherKey(code, qid) {
  cachedReads_();
  requireTeacher_(code);
  var q = libQuestions_([String(qid)])[0];
  if (!q) throw new Error('FORM: Question not found in the library.');
  return { ok: true, qid: q.qid, type: q.type || 'mcq', key: keyList_(q), rationale_html: q.rationale_html || '', cb_id: (q.source || {}).cb_question_id || '' };
}
/** #50 the teacher's level for a question (go-over screen): Item_Overrides, one row per qid, last write wins, history in log.
 *  The Drive files are never edited. Undo = the same call with the old level. */
function setItemLevel(code, qid, diff, level, note) {
  requireTeacher_(code);
  qid = String(qid || '').trim(); diff = String(diff || '').toUpperCase(); level = Number(level) || 0;
  if (!/^[EMH]$/.test(diff) || [1, 2, 3].indexOf(level) < 0) throw new Error('FORM: Pick E, M or H and a level 1–3.');
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    if (!hasTab_('Item_Overrides')) ensureTabs_();
    var q = readTable_('Questions').rows.filter(function (x) { return String(x.qid) === qid; })[0];
    if (!q) throw new Error('FORM: Question not found.');
    var t = readTableSheet_('Item_Overrides');                         // fresh: the row number is written to
    var row = t.rows.filter(function (x) { return String(x.qid).replace(/^'/, '') === qid; })[0];
    var oldD = row ? String(row.difficulty || '').toUpperCase() : String(q.difficulty || '').toUpperCase();
    var oldL = row ? Number(row.level) || '' : Number(q.level) || '';
    var at = nowIso_(), line = at.slice(0, 16) + ' teacher: ' + oldD + oldL + ' → ' + diff + level;
    var f = { qid: txt_(qid), code: txt_(clean_(q.code)), difficulty: diff, level: level, old_difficulty: oldD, old_level: oldL, set_by: 'teacher', set_at: at,
              note: note ? String(note).slice(0, 200) : (row ? row.note : ''), log: (row && row.log ? String(row.log) + '\n' : '') + line };
    if (row) updateRow_('Item_Overrides', row._row, f); else appendObjects_('Item_Overrides', [f]);
    _ovr = null; _qrows = null; _plForms = null;
    var prof = skillProfile_(clean_(q.skill));
    return { ok: true, qid: qid, difficulty: diff, level: level, old: { difficulty: oldD, level: oldL }, cb: { difficulty: String(q.difficulty || '').toUpperCase(), level: Number(q.level) || '' },
             warn: prof.allowed[diff] ? '' : ({ E: 'Easy', M: 'Medium', H: 'Hard' })[diff] + ' is not offered for this skill in practice (Skill_Profile) — saved anyway.' };
  } finally { lock.releaseLock(); }
}
/** The key of ONE question of this set — only when the teacher presses "Show answer". */
function teacherAnswer(code, setId, qid) {
  cachedReads_();                                                   // read-only: snapshots, no Sheet (#42)
  var s = teacherSet_(code, setId);
  var q = setQuestions_(s).filter(function (x) { return x.qid === String(qid); })[0];
  if (!q) throw new Error('SESSION: Question not found.');
  return { ok: true, qid: q.qid, type: q.type || 'mcq', key: keyList_(q) };
}
