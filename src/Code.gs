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
var APP_VERSION = 'v0.3 (2026-11-13, teacher page: classes, What to go over, assignments)';
var APP_BUILD = 'dev';  // replaced by the GitHub Action with the commit id → the Sheet update (Update.gs) runs once per deploy

/* ============================== web app ============================== */

function doGet(e) {
  // Called by the GitHub Action right after each deploy: runs the Sheet update once per new version (Update.gs).
  // Returns a one-line status only (no Sheet data), so it is safe on the public URL.
  if (e && e.parameter && e.parameter.update === '1') {
    return ContentService.createTextOutput(runUpdateIfNeeded_()).setMimeType(ContentService.MimeType.TEXT);
  }
  var t = HtmlService.createTemplateFromFile('Index');
  return t.evaluate()
    .setTitle(getSettings_().app_name || 'SAT Math Lib')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=5')
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

/** Read a whole tab → {sh, headers, idx (name→0-based col), rows: [{_row, col: value…}]} */
function readTable_(name) {
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
    if (changed) sh.getRange(rowNum, 1, 1, headers.length).setValues([cur]);
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
  probes_per_set: 1, standin_min: 10, strong_r: 0.85, block_days: 7, retry_wait_days: 2, progress_dot_min: 3,
  dot_green: 0.8, dot_amber: 0.5, guess_min_time_sec: 15, fast_ratio: 0.5, slow_ratio: 1.5,
  mistake_placeholder: '— choose a mistake type —',
  mistake_types: "Concept Gap; Didn't Understand The Question; Misread A Detail; Careless Calculation; Wrong Input/Format; Others; Not A Mistake",
  ask_note_max: 200
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
  if (!st || !isYes_(st.active)) throw new Error('LOGIN: This code is not valid or is locked. Ask your teacher.');
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

function login(code, deviceId) {
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
  return { ok: true, student: { code: normCode_(st.student_code), name: String(st.name || '') },
           app_name: getSettings_().app_name, version: APP_VERSION };
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
  if (kind === 'practice') return 'Practice · ' + (skillName_(String(s.skill || '')) || 'Mixed');
  if (kind === 'review') return 'Review';
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
    qid: q.qid, code: q.code || '', part: q.part, display_no: q.display_no, type: q.type || 'mcq',
    stem_html: q.stem_html || '', passage_html: q.passage_html || '',
    figures: (q.figures || []).map(function (f, i) {
      return { fid: q.qid + '#' + i, src: withFigs ? figSrc_(f) : '', alt: f.alt || '', position: f.position || 'before_stem',
               width: f.width || null, caption: f.caption || '' };
    }),
    choices: (q.choices || []).map(function (c) { return { label: c.label, html: c.html }; })
  };
}
var FIGS_WITH_SET = 3; // figures of the first 3 questions come with the set; the rest by getFigures (spec v1.1 §6.1)

/** Start a self-practice set: one CB skill + n questions (selection in Select.gs). Returns the new set id. */
function startPractice(code, skill, n) {
  var st = requireStudent_(code), codeN = normCode_(st.student_code), S = getSettings_();
  var sizes = String(S.set_sizes).split(/[,\s]+/).map(Number).filter(Boolean);
  n = Number(n);
  if (sizes.indexOf(n) < 0) throw new Error('FORM: Choose ' + sizes.join(', ') + ' questions.');
  skill = String(skill || '').trim();
  if (!skillName_(skill)) throw new Error('FORM: This skill is not in the library.');
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var open = readTable_('Sets').rows.filter(function (r) { return normCode_(r.student_code) === codeN && isOpenStatus_(r.status) && String(r.kind) === 'practice' && String(r.skill) === skill; });
    if (open.length) return { ok: true, set_id: String(open[open.length - 1].set_id), resumed: true }; // one open practice set per skill
    var setId = newSetId_(codeN);
    var pick = pickForPractice_(codeN, skill, n, setId);
    if (!pick.qids.length) throw new Error('FORM: There are no questions for this skill yet. Try another skill.');
    appendObjects_('Sets', [{
      set_id: setId, student_code: codeN, kind: 'practice', skill: txt_(skill), n: pick.qids.length, qids: pick.qids.join(','),
      level_at_start: pick.level || '', slots: pick.slots || '', created_at: nowIso_(), status: 'in_progress',
      events_saved: 0, last_saved_at: nowIso_()
    }]);
    return { ok: true, set_id: setId, n: pick.qids.length, short: pick.qids.length < n };
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
  var S = getSettings_();
  return {
    ok: true,
    session: { session_id: String(s.set_id), form_id: String(s.set_id), attempt_no: 1, student_name: String(st.name || ''),
               events_saved: Number(s.events_saved) || 0 },
    resumed: !!parseState_(s), state: parseState_(s), copy: copy, server_now: Date.now(),
    profile: setProfile_(s, qs.length),
    questions: qs.map(function (q, i) { return clientQuestion_(q, i < FIGS_WITH_SET); }),
    settings: { app_name: S.app_name, autosave_sec: S.autosave_sec, desmos_api_key: desmosKey_(), show_results: 'score_and_right_wrong' },
    ask_note_max: Number(S.ask_note_max) || 200
  };
}

/** The rest of a set's figures (background load after the set opens). Only figures of questions of this student's set. */
function getFigures(code, setId, fids) {
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
  readTable_('Questions').rows.forEach(function (r) {
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
  qids.forEach(function (id) { m[id] = { visits: 0, time_ms: 0, first_visit_ms: null, order: null, answers: [], calc: false, ref: false, ever_marked: false }; });
  var openQ = null, openT = 0, visitIdx = {}, order = 0, calcOpen = false, lastT = 0, resumeQ = null;
  function close(t) {
    if (openQ && m[openQ]) { var d = Math.max(0, t - openT); m[openQ].time_ms += d; if (visitIdx[openQ] === 1) m[openQ].first_visit_ms = (m[openQ].first_visit_ms || 0) + d; }
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
      case 'select': case 'change': if (m[q]) m[q].answers.push(String(e.value)); break;
      case 'mark': if (m[q]) m[q].ever_marked = true; break;
      case 'calc_open': calcOpen = true; if (openQ && m[openQ]) m[openQ].calc = true; break;
      case 'calc_close': calcOpen = false; break;
      case 'ref_open': if (openQ && m[openQ]) m[openQ].ref = true; break;
    }
    if (e.type !== 'resume') lastT = Math.max(lastT, t);
  });
  close(lastT);
  return m;
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
    var timeSec = x.time_ms / 1000;
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
      time_try1_sec: round_(timeSec, 1), time_total_sec: round_(timeSec, 1), pace_ratio: round_(tp.ratio, 2),
      calc_used: !!x.calc, ref_used: !!x.ref, profile: tp.profile, flags: flags.join(','), submitted_at: now,
      asked: ps.ask && q.qid in ps.ask ? 1 : '', ask_note: ps.ask && ps.ask[q.qid] ? txt_(ps.ask[q.qid]) : '',
      ask_at: ps.ask && q.qid in ps.ask ? now : '', ask_status: ps.ask && q.qid in ps.ask ? 'open' : ''
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
  var s = requireSet_(code, setId);
  if (!isFinished_(s)) return { ok: false, msg: 'This set has not been submitted yet.' };
  return resultView_(s, responsesOf_(setId), false);
}

/** Questions of one finished set for the read-only review: the question + the student's answer, right / wrong, time.
 *  NEVER the key (clientQuestion_ whitelist; status comes from Responses). */
function reviewData_(s, rows) {
  var by = {}; rows.forEach(function (r) { by[String(r.qid)] = r; });
  var qs = setQuestions_(s).filter(function (q) { return by[q.qid]; }).map(function (q) {
    var r = by[q.qid], o = clientQuestion_(q, true);
    o.answer = String(r.final_answer === undefined ? '' : r.final_answer).replace(/^'/, '');
    o.status = String(r.profile) === 'BLANK' || o.answer === '' ? 'blank' : (Number(r.best_correct) === 1 ? 'right' : 'wrong');
    o.time_s = Math.round(Number(r.time_total_sec) || 0);
    o.label = 'Q' + q.display_no; o.badge = qBadge_(String(r.profile)); o.no = q.display_no;
    o.asked = !!r.asked && String(r.ask_status) !== 'resolved'; o.ask_note = String(r.ask_note || '').replace(/^'/, '');
    return o;
  });
  var p = setProfile_(s, qs.length).parts[0];
  return { ok: true, session_id: String(s.set_id), form_id: String(s.set_id), title: setTitle_(s), question_font: 'serif',
           parts: [{ part: p.part, title: p.title, layout: p.layout, spr_layout: p.spr_layout, choices: 4, calculator: true, reference: true,
                     annotate: false, directions_html: p.directions_html }],
           questions: qs, settings: { desmos_api_key: desmosKey_() } };
}
function getReview(code, setId) {
  var s = requireSet_(code, setId);
  if (!isFinished_(s)) throw new Error('SESSION: This set has not been submitted yet.');
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
  var s = requireSet_(code, setId);
  if (!isFinished_(s)) throw new Error('SESSION: This set has not been submitted yet.');
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
  return d;
}

/** One fix try: graded on the server at once. Answers only right / wrong + tries left — never the key. */
function checkTry(code, setId, qid, answer, timeSec) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var s = requireSet_(code, setId);
    if (!isFinished_(s)) throw new Error('SESSION: Submit the set first.');
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
    var f = on ? { asked: 1, ask_note: txt_(String(note || '').slice(0, max)), ask_at: nowIso_(), ask_status: 'open', resolved_at: '' }
               : { asked: '', ask_note: '', ask_at: '', ask_status: '' };
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
function teacherResult(code, setId) { var s = teacherSet_(code, setId); return resultView_(s, responsesOf_(setId), true); }
function teacherReview(code, setId) {
  var s = teacherSet_(code, setId), r = reviewData_(s, responsesOf_(setId)), st = findStudent_(s.student_code);
  r.student = st ? String(st.name || '') : String(s.student_code);
  return r;
}
/** The key of ONE question of this set — only when the teacher presses "Show answer". */
function teacherAnswer(code, setId, qid) {
  var s = teacherSet_(code, setId);
  var q = setQuestions_(s).filter(function (x) { return x.qid === String(qid); })[0];
  if (!q) throw new Error('SESSION: Question not found.');
  return { ok: true, qid: q.qid, type: q.type || 'mcq', key: keyList_(q) };
}
