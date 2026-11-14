/**
 * SAT Math Lib — time per question by question type + difficulty (Test Zone #24 F; SAT Math norms, SC 2026-11-10).
 * A question is "Rushed" when the time on it is below fast_below_sec, "Slow" above slow_above_sec. The norms are in the
 * Sheet tab Time_Norms (created once from TimeNorms.gs; Minh may edit it). Lookup: (Math, *, difficulty, mcq | spr).
 * No matching row → fallback ratio rule (Settings fast_ratio / slow_ratio × 120 s).
 */
var TIME_NORMS_TAB = 'Time_Norms';
var _timeNorms = null;

function ensureTimeNorms_() {
  var ss = ss_(), sh = ss.getSheetByName(TIME_NORMS_TAB);
  if (sh && sh.getLastRow() > 1) return 'time norms: kept';
  if (!sh) sh = ss.insertSheet(TIME_NORMS_TAB);
  var rows = TIME_NORMS_DEFAULT_.map(function (r, i) { return i === 0 ? r : r.map(function (v, j) { return j >= 4 ? Number(v) : v; }); });
  ensureGrid_(sh, rows.length + 5, rows[0].length);
  sh.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  try { sh.setFrozenRows(1); sh.getRange(1, 1, 1, rows[0].length).setFontWeight('bold'); } catch (e) {}
  _timeNorms = null;
  return 'time norms: created (' + (rows.length - 1) + ' rows)';
}

/** key "section|skill|difficulty|qtype" → { target, fast, slow } (seconds) */
function timeNorms_() {
  if (_timeNorms) return _timeNorms;
  var rows = null;
  try { rows = readTable_(TIME_NORMS_TAB).rows; if (!rows.length) rows = null; } catch (e) { rows = null; }
  if (!rows) {
    var h = TIME_NORMS_DEFAULT_[0];
    rows = TIME_NORMS_DEFAULT_.slice(1).map(function (r) { var o = {}; h.forEach(function (k, i) { o[k] = r[i]; }); return o; });
  }
  var m = {};
  rows.forEach(function (r) {
    var t = Number(r.target_sec), f = Number(r.fast_below_sec), s = Number(r.slow_above_sec);
    if (!(t > 0) || isNaN(f) || isNaN(s)) return;
    var k = [r.section, r.skill, r.difficulty, r.qtype].map(function (x) { return String(x === undefined ? '' : x).replace(/^'/, '').trim(); }).join('|');
    m[k] = { target: t, fast: f, slow: s };
  });
  return (_timeNorms = m);
}

/** The norm of one question (type 'mcq' | 'spr', difficulty E/M/H). null = none. */
function timeNormFor_(type, difficulty) {
  var m = timeNorms_(), d = String(difficulty || 'M').toUpperCase().charAt(0) || 'M';
  var qt = String(type || 'mcq') === 'spr' ? 'spr' : 'mcq';
  return m[['Math', '*', d, qt].join('|')] || m[['Math', '*', d, 'mcq'].join('|')] || null;
}

/** Right / wrong + time → RIGHT, SLOW_RIGHT, FAST_WRONG, SLOW_WRONG, WRONG, BLANK and pace_ratio. */
function timeProfile_(answered, correct, timeSec, norm, pace, S) {
  var ratio, fast, slow;
  if (norm) { ratio = timeSec / norm.target; fast = timeSec < norm.fast; slow = timeSec > norm.slow; }
  else { ratio = timeSec / (pace || 1); fast = ratio < S.fast_ratio; slow = ratio > S.slow_ratio; }
  var p;
  if (!answered) p = 'BLANK';
  else if (!correct) p = fast ? 'FAST_WRONG' : (slow ? 'SLOW_WRONG' : 'WRONG');
  else p = slow ? 'SLOW_RIGHT' : 'RIGHT';
  return { profile: p, ratio: ratio };
}
