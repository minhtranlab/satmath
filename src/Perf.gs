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
  var time = function (name, fn, fresh) {
    if (fresh !== false) resetMemo_();
    var a = Date.now(), extra = '';
    try { var r = fn(); if (typeof r === 'number') extra = r; } catch (e) { extra = 'error: ' + String(e.message || e).slice(0, 60); }
    steps.push({ name: name, ms: Date.now() - a, info: extra });
  };
  time('open the Sheet', function () { _ss = null; ss_(); return ''; });
  PERF_TABS_.forEach(function (tab) { time('read tab ' + tab, function () { try { return readTableRaw_(tab).rows.length; } catch (e) { return 'missing'; } }); });
  var S = getSettings_(), tc = String(S.teacher_code || '');
  var students = readTableRaw_('Students').rows.filter(function (r) { return /^TEST-/.test(normCode_(r.student_code)) && isYes_(r.active); });
  var sc = students.length ? normCode_(students[0].student_code) : '';
  var cls = readTableRaw_('Classes').rows.filter(function (c) { return c.class_id && (c.active === '' || isYes_(c.active)); });
  var cid = cls.length ? String(cls[0].class_id) : '';
  var sets = readTableRaw_('Sets').rows.filter(function (s) { return normCode_(s.student_code) === sc; });
  var done = sets.filter(function (s) { return isFinished_(s) && String(s.kind) !== 'placement'; }).pop();
  var resp = readTableRaw_('Responses').rows.filter(function (r) { return normCode_(r.student_code) === sc; }).pop();
  if (tc) {
    time('teacher: sign in (login)', function () { login(tc, ''); return ''; });
    time('teacher: Classes (teacherHome)', function () { teacherHome(tc); return ''; });
    if (cid) time('teacher: class screen (classView)', function () { classView(tc, cid, ''); return ''; });
    time('teacher: All students (classView all)', function () { classView(tc, 'all', ''); return ''; });
    if (sc) time('teacher: student profile (studentProfile)', function () { studentProfile(tc, sc); return ''; });
    if (sc) time('teacher: turn a student on/off (editStudent, no change)', function () { var st = findStudent_(sc); requireTeacher_(tc); return st ? 1 : 0; });
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
  return JSON.stringify({ ok: true, version: APP_VERSION, at: nowIso_(), teacher: !!tc, total_ms: Date.now() - t0, steps: steps });
}
/** readTable_ without the per-call memo (perf counts real reads). */
function readTableRaw_(name) { if (typeof _tables !== 'undefined') delete _tables[name]; return readTable_(name); }
