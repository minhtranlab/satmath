/**
 * SAT Math Lib — speed check (ticket #42). GET ?perf=1 runs the read calls of the teacher page and the student page on the
 * server, each as a fresh execution would (in-memory caches cleared first), and returns ONLY timings and row counts — no
 * Sheet data, names, codes or keys — so it is safe on the public URL. At most once per 20 s.
 * ping(): an empty call — its round trip from the browser = the fixed cost of one google.script.run.
 */
function ping() { return { ok: true, t: Date.now() }; }

var PERF_TABS_ = ['Settings', 'Students', 'Classes', 'Assignments', 'Sets', 'Responses', 'Tries', 'Levels', 'Questions', 'Batches', 'Skills', 'Skill_Profile', 'Placements'];

function resetMemo_() {
  _settings = null; _qrows = null; _batchLive = null; _skillIdx = null; _libIdx = null; _batch = {}; _setQ = {}; _timeNorms = null;
  _plForms = null; _plLatest = {}; _skProf = null; _asgTitle = null;
  if (typeof _tables !== 'undefined') _tables = {};
  if (typeof _ccache !== 'undefined') _ccache = {};
}

function perfRun_() {
  var cache = CacheService.getScriptCache();
  if (cache.get('sml_perf')) return JSON.stringify({ ok: false, msg: 'wait 20 s' });
  cache.put('sml_perf', '1', 20);
  var steps = [], t0 = Date.now();
  // each call twice: 'sheet' = as a fresh execution reading the Sheet; 'snap' = the same call from the tab snapshots (#42)
  // where the time goes: tab snapshots, Sheet reads, library files (per tab / file name: ms)
  var acc = null, wrap = function (fn, kind) { return function (n) { var a = Date.now(); try { return fn.apply(this, arguments); } finally { if (acc) { var k = kind + ':' + n; acc[k] = (acc[k] || 0) + Date.now() - a; } } }; };
  var o1 = tabFromCache_, o2 = readTableSheet_, o3 = libBatch_;
  tabFromCache_ = wrap(o1, 'snap'); readTableSheet_ = wrap(o2, 'sheet'); libBatch_ = wrap(o3, 'lib');
  var top = function (a) { return Object.keys(a).sort(function (x, y) { return a[y] - a[x]; }).slice(0, 5).map(function (k) { return k + ' ' + a[k]; }).join(', '); };
  var time = function (name, fn) {
    var one = function (fresh) {
      resetMemo_(); _ss = null; _forceFresh = fresh; _readMode = 'fresh'; acc = {};
      var a = Date.now(), extra = '';
      try { var r = fn(); if (typeof r === 'number') extra = r; } catch (e) { extra = 'error: ' + String(e.message || e).slice(0, 60); }
      _forceFresh = false;
      var out = { ms: Date.now() - a, info: extra, where: top(acc) }; acc = null; return out;
    };
    var f = one(true), c = one(false);
    steps.push({ name: name, ms: f.ms, snap_ms: c.ms, info: f.info || c.info, snap_where: c.where });
  };
  _perfAllowInactive = true;
  var raw = function (name, fn) { resetMemo_(); var a = Date.now(), x = ''; try { x = fn(); } catch (e) { x = 'error'; } steps.push({ name: name, ms: Date.now() - a, info: x }); };
  raw('open the Sheet (first read of a tab)', function () { _ss = null; readTableSheet_('Settings'); return ''; });
  PERF_TABS_.forEach(function (tab) { raw('read tab ' + tab, function () { try { return readTableSheet_(tab).rows.length; } catch (e) { return 'missing'; } }); });
  var S = getSettings_(), tc = String(S.teacher_code || '');
  var students = readTableRaw_('Students').rows.filter(function (r) { return /^TEST-/.test(normCode_(r.student_code)); });
  var sc = students.length ? normCode_(students[0].student_code) : '';
  var cls = readTableRaw_('Classes').rows.filter(function (c) { return c.class_id && (c.active === '' || isYes_(c.active)); });
  var cid = cls.length ? String(cls[0].class_id) : '';
  var withSets = {}; readTableRaw_('Sets').rows.forEach(function (s) { if (isFinished_(s)) withSets[normCode_(s.student_code)] = 1; });
  students.forEach(function (r) { if (withSets[normCode_(r.student_code)] && !withSets[sc]) sc = normCode_(r.student_code); });
  var sets = readTableRaw_('Sets').rows.filter(function (s) { return normCode_(s.student_code) === sc; });
  var done = sets.filter(function (s) { return isFinished_(s) && String(s.kind) !== 'placement'; }).pop();
  var resp = readTableRaw_('Responses').rows.filter(function (r) { return normCode_(r.student_code) === sc; }).pop();
  if (tc) {
    time('teacher: sign in (login)', function () { login(tc, ''); return ''; });
    time('teacher: Classes (teacherHome)', function () { teacherHome(tc); return ''; });
    if (cid) time('teacher: class screen (classView)', function () { classView(tc, cid, ''); return ''; });
    time('teacher: All students (classView all)', function () { classView(tc, 'all', ''); return ''; });
    if (sc) time('teacher: student profile (studentProfile)', function () { studentProfile(tc, sc); return ''; });
    time('teacher: Asked inbox (asksInbox)', function () { asksInbox(tc); return ''; });
    if (cid) time('teacher: New assignment (assignmentTree)', function () { assignmentTree(tc, cid); return ''; });
    if (resp) time('teacher: question panel (questionPanel)', function () { questionPanel(tc, String(resp.qid)); return ''; });
    if (done) time('teacher: a result (teacherResult)', function () { teacherResult(tc, String(done.set_id)); return ''; });
  }
  if (sc) {
    time('student: sign in (login)', function () { login(sc, ''); return ''; });
    time('student: home (homeData)', function () { homeData(sc); return ''; });
    if (done) time('student: a result (getResult)', function () { getResult(sc, String(done.set_id)); return ''; });
    if (done) time('student: open a set (getSet)', function () { getSet(sc, String(done.set_id), {}); return ''; });
  }
  _perfAllowInactive = false;
  tabFromCache_ = o1; readTableSheet_ = o2; libBatch_ = o3;
  return JSON.stringify({ ok: true, version: APP_VERSION, at: nowIso_(), teacher: !!tc, total_ms: Date.now() - t0, steps: steps });
}
/** readTable_ without the memo or the snapshot (perf counts real reads). */
function readTableRaw_(name) { return readTableSheet_(name); }
