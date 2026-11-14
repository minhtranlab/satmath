/**
 * SAT Math Lib — teacher page (spec v1.1 §2.2, §7, §8, §9). Every call checks Settings.teacher_code (requireTeacher_).
 *   teacherHome · createStudent · editStudent · saveClass · classView · questionPanel · tagMistake · resolveAsk · asksInbox
 *   studentProfile · assignmentTree · pickAssignment · publishAssignment · closeAssignment
 * Student side of assignments: assignmentsFor_ (home card) · startAssignment.
 * The teacher sees keys (questionPanel) — students never do. Short codes (E326) are shown big with a copy button (BRAIN #64, #69).
 */

var CODE_CHARS_ = 'ACDEFGHJKLMNPQRTUVWXY3479';

/* ============================== students + classes ============================== */
function initials_(name) {
  var s = String(name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'D').toUpperCase().replace(/\(.*?\)/g, ' ');
  var w = s.split(/[^A-Z]+/).filter(String);
  var ini = w.length >= 2 ? w[w.length - 1].charAt(0) + w[0].charAt(0) : (w[0] || 'ST').slice(0, 2);
  return (ini + 'X').slice(0, 2);
}
function newStudentCode_(name, taken) {
  for (var k = 0; k < 200; k++) {
    var c = initials_(name) + '-';
    for (var i = 0; i < 3; i++) c += CODE_CHARS_.charAt(Math.floor(Math.random() * CODE_CHARS_.length));
    if (!taken[c] && !isTeacherCode_(c)) return c;
  }
  throw new Error('FORM: Could not make a new code. Try again.');
}
/** Sheet-created students without a code get one; Students.classes = names of their classes (read-only mirror). */
function syncStudents_() {
  var st = readTable_('Students'), taken = {}, filled = 0;
  st.rows.forEach(function (r) { var c = normCode_(r.student_code); if (c) taken[c] = 1; });
  var cls = readTable_('Classes').rows.filter(function (c) { return c.class_id && (c.active === '' || isYes_(c.active)); });
  var mirror = {};
  cls.forEach(function (c) { codesOf_(c.student_codes).forEach(function (sc) { (mirror[sc] = mirror[sc] || []).push(String(c.name || c.class_id)); }); });
  st.rows.forEach(function (r) {
    var f = {}, c = normCode_(r.student_code);
    if (!c && String(r.name || '').trim()) { c = newStudentCode_(r.name, taken); taken[c] = 1; f.student_code = c; f.created_in = r.created_in || 'sheet'; if (!r.created_at) f.created_at = nowIso_(); if (r.active === '') f.active = 'Yes'; filled++; }
    var m = (mirror[c] || []).join(', ');
    if (c && String(r.classes || '') !== m) f.classes = m;
    if (Object.keys(f).length) updateRow_('Students', r._row, f);
  });
  return 'students: ' + st.rows.length + (filled ? ', codes issued: ' + filled : '');
}
function codesOf_(v) { return String(v || '').split(/[,;\s]+/).map(normCode_).filter(String); }

function createStudent(code, name, classIds) {
  requireTeacher_(code);
  name = String(name || '').trim().slice(0, 60);
  if (!name) throw new Error('FORM: Type the student\'s name.');
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var taken = {}; readTable_('Students').rows.forEach(function (r) { taken[normCode_(r.student_code)] = 1; });
    var sc = newStudentCode_(name, taken);
    appendObjects_('Students', [{ student_code: sc, name: name, active: 'Yes', created_in: 'app', created_at: nowIso_() }]);
    (classIds || []).forEach(function (cid) {
      var c = readTable_('Classes').rows.filter(function (x) { return String(x.class_id) === String(cid); })[0];
      if (c) updateRow_('Classes', c._row, { student_codes: codesOf_(c.student_codes).concat([sc]).join(', ') });
    });
    syncStudents_();
    return { ok: true, student_code: sc, name: name };
  } finally { lock.releaseLock(); }
}
function editStudent(code, sc, f) {
  requireTeacher_(code);
  var st = findStudent_(sc); if (!st) throw new Error('FORM: Student not found.');
  var u = {};
  if (f && f.name !== undefined && String(f.name).trim()) u.name = String(f.name).trim().slice(0, 60);
  if (f && f.active !== undefined) u.active = f.active ? 'Yes' : 'No';
  updateRow_('Students', st._row, u);
  return { ok: true };
}
/** New or changed class: name + members. cls = {class_id?, name, student_codes: [], active?} */
function saveClass(code, cls) {
  requireTeacher_(code);
  var name = String(cls && cls.name || '').trim().slice(0, 60);
  if (!name) throw new Error('FORM: Type a class name.');
  var known = {}; readTable_('Students').rows.forEach(function (r) { known[normCode_(r.student_code)] = 1; });
  var members = (cls.student_codes || []).map(normCode_).filter(function (c, i, a) { return known[c] && a.indexOf(c) === i; });
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var t = readTable_('Classes'), row = cls.class_id ? t.rows.filter(function (x) { return String(x.class_id) === String(cls.class_id); })[0] : null;
    var f = { name: name, student_codes: members.join(', '), active: cls.active === false ? 'No' : 'Yes' };
    var id;
    if (row) { updateRow_('Classes', row._row, f); id = String(row.class_id); }
    else {
      var n = 0; t.rows.forEach(function (x) { var m = /^C-(\d+)$/.exec(String(x.class_id)); if (m) n = Math.max(n, Number(m[1])); });
      id = 'C-' + ('00' + (n + 1)).slice(-3);
      f.class_id = id; f.created_in = 'app'; appendObjects_('Classes', [f]);
    }
    syncStudents_();
    return { ok: true, class_id: id };
  } finally { lock.releaseLock(); }
}

/* ============================== teacher home ============================== */
function lastActivity_(sets) {
  var ms = 0; sets.forEach(function (s) { ms = Math.max(ms, toMs_(s.submitted_at) || toMs_(s.last_saved_at) || toMs_(s.created_at)); });
  return ms;
}
function teacherHome(code) {
  cachedReads_();                                                   // read-only: snapshots, no Sheet (#42)
  requireTeacher_(code);
  // Students / codes / tags typed in the Sheet: synced only after a hand edit (onEdit flag) or once an hour (#42)
  var cc = CacheService.getScriptCache();
  if (cc.get('sml_dirty_sync') || !cc.get('sml_synced')) {
    _readMode = 'fresh'; _tables = {};
    try { syncStudents_(); syncTaggedReview_(); } catch (e) { console.warn('teacherHome sync: ' + e); }
    try { cc.put('sml_synced', '1', 3600); cc.remove('sml_dirty_sync'); } catch (e) {}
    _readMode = 'cached';
  }
  var students = readTable_('Students').rows.filter(function (r) { return normCode_(r.student_code); });
  var sets = readTable_('Sets').rows.filter(function (s) { return !isHidden_(s); });
  var resp = readTable_('Responses').rows, rev = readTable_('Review').rows, asg = readTable_('Assignments').rows;
  var by = {};
  students.forEach(function (r) { by[normCode_(r.student_code)] = { code: normCode_(r.student_code), name: String(r.name || ''), active: isYes_(r.active), classes: String(r.classes || ''), sets: [], asks: 0, review: 0 }; });
  sets.forEach(function (s) { var o = by[normCode_(s.student_code)]; if (o) o.sets.push(s); });
  resp.forEach(function (r) { var o = by[normCode_(r.student_code)]; if (o && r.asked && String(r.ask_status) === 'open') o.asks++; });
  rev.forEach(function (r) { var o = by[normCode_(r.student_code)]; if (o && String(r.status) === 'open') o.review++; });
  var stOut = Object.keys(by).map(function (k) {
    var o = by[k], ms = lastActivity_(o.sets);
    return { code: o.code, name: o.name, active: o.active, classes: o.classes, last: ms ? dateStr_(new Date(ms)) : '', last_ms: ms, asks: o.asks, review: o.review,
             n_sets: o.sets.filter(isFinished_).length };
  }).sort(function (a, b) { return (b.active - a.active) || a.name.localeCompare(b.name); });
  var classes = readTable_('Classes').rows.filter(function (c) { return c.class_id; }).map(function (c) {
    var mem = codesOf_(c.student_codes).filter(function (x) { return by[x]; });
    var last = 0, asks = 0;
    mem.forEach(function (x) { last = Math.max(last, lastActivity_(by[x].sets)); asks += by[x].asks; });
    var open = asg.filter(function (a) { return String(a.status) === 'published' && targetMembers_(a).some(function (x) { return mem.indexOf(x) >= 0; }); }).filter(function (a) {
      return mem.some(function (x) { return !by[x].sets.some(function (s) { return String(s.assignment_id) === String(a.assignment_id) && isFinished_(s); }); });
    }).length;
    return { class_id: String(c.class_id), name: String(c.name || c.class_id), active: c.active === '' || isYes_(c.active), members: mem.map(function (x) { return { code: x, name: by[x].name }; }),
             last: last ? dateStr_(new Date(last)) : '', asks: asks, open_assignments: open };
  });
  var openAsks = resp.filter(function (r) { return r.asked && String(r.ask_status) === 'open'; }).length;
  var S = getSettings_();
  return { ok: true, classes: classes, students: stOut, open_asks: openAsks,
           mistake_types: String(S.mistake_types).split(/\s*;\s*/).filter(String), mistake_placeholder: S.mistake_placeholder };
}

/* ============================== class screen: what to go over · grid ============================== */
function targetMembers_(a) {
  if (String(a.target_type) === 'student') return [normCode_(a.target_id)];
  var c = readTable_('Classes').rows.filter(function (x) { return String(x.class_id) === String(a.target_id); })[0];
  return c ? codesOf_(c.student_codes) : [];
}
/** target: 'all' | 'C-001' (class) | 'st:CODE' (one student) → {title, members: [codes]} */
function resolveTarget_(target) {
  target = String(target || 'all');
  var studs = readTable_('Students').rows.filter(function (r) { return normCode_(r.student_code); });
  if (target.indexOf('st:') === 0) {
    var s = findStudent_(target.slice(3)); if (!s) throw new Error('FORM: Student not found.');
    return { kind: 'student', id: normCode_(s.student_code), title: String(s.name || s.student_code), members: [normCode_(s.student_code)] };
  }
  if (target === 'all') return { kind: 'all', id: 'all', title: 'All students', members: studs.filter(function (r) { return isYes_(r.active); }).map(function (r) { return normCode_(r.student_code); }) };
  var c = readTable_('Classes').rows.filter(function (x) { return String(x.class_id) === target; })[0];
  if (!c) throw new Error('FORM: Class not found.');
  return { kind: 'class', id: target, title: String(c.name || target), members: codesOf_(c.student_codes) };
}

/** The order rule of "What to go over" (spec §9) — the ONE place to change it.
 *  1 most students wrong on try 1 (one student: still wrong after fixes before fixed later) → open asks → extra tries → slow;
 *  2 right on try 1 but asked; 3 right but slow; 4 right, fast, nobody asked (folded). */
function priorityOrder_(rows, single) {
  rows.forEach(function (r) { r.group = r.wrong1 > 0 ? 1 : r.asks > 0 ? 2 : r.slow_right > 0 ? 3 : 4; });
  return rows.sort(function (a, b) {
    return a.group - b.group || b.wrong1 - a.wrong1 || (single ? b.still - a.still : 0) || b.asks - a.asks ||
           b.extra - a.extra || b.slow - a.slow || String(a.code).localeCompare(String(b.code), undefined, { numeric: true });
  });
}

function classView(code, target, scope) {
  cachedReads_();                                                   // read-only: snapshots, no Sheet (#42)
  requireTeacher_(code);
  var T = resolveTarget_(target), mem = {}, names = {};
  T.members.forEach(function (c) { mem[c] = 1; });
  readTable_('Students').rows.forEach(function (r) { names[normCode_(r.student_code)] = String(r.name || r.student_code); });
  var allSets = readTable_('Sets').rows.filter(function (s) { return mem[normCode_(s.student_code)] && isFinished_(s) && !isHidden_(s); });
  var asg = readTable_('Assignments').rows.filter(function (a) { return a.assignment_id && targetMembers_(a).some(function (c) { return mem[c]; }); });
  // scopes to pick from: assignments of these students, recent sets, date ranges
  scope = String(scope || (asg.length ? 'a:' + asg[asg.length - 1].assignment_id : 'd30'));
  var now = Date.now(), inScope;
  if (scope.indexOf('a:') === 0) inScope = function (s) { return String(s.assignment_id) === scope.slice(2); };
  else if (scope.indexOf('s:') === 0) inScope = function (s) { return String(s.set_id) === scope.slice(2); };
  else if (scope === 'all') inScope = function () { return true; };
  else { var days = Number(scope.replace(/\D/g, '')) || 30; inScope = function (s) { return now - toMs_(s.submitted_at) <= days * 86400000; }; }
  var sets = allSets.filter(inScope), setIds = {}, setOf = {};
  sets.forEach(function (s) { setIds[String(s.set_id)] = 1; setOf[String(s.set_id)] = s; });
  var resp = readTable_('Responses').rows.filter(function (r) { return setIds[String(r.set_id)]; });
  var tries = {}; readTable_('Tries').rows.forEach(function (t) { if (setIds[String(t.set_id)]) (tries[t.set_id + '|' + t.qid] = tries[t.set_id + '|' + t.qid] || []).push(t); });
  var qrow = {}; questionRows_().forEach(function (r) { qrow[String(r.qid)] = r; });
  // latest answer of each student per question in scope
  var latest = {};
  resp.forEach(function (r) {
    var k = String(r.qid) + '|' + normCode_(r.student_code), cur = latest[k];
    if (!cur || toMs_(r.submitted_at) >= toMs_(cur.submitted_at)) latest[k] = r;
  });
  var byQ = {};
  Object.keys(latest).forEach(function (k) {
    var r = latest[k], q = String(r.qid), Q = qrow[q] || {};
    var o = byQ[q] = byQ[q] || { qid: q, code: clean_(Q.code), cb_id: clean_(Q.cb_question_id), skill: clean_(r.skill) || clean_(Q.skill),
      subskill: clean_(r.subskill) || clean_(Q.subskill), difficulty: String(r.difficulty || Q.difficulty || ''), type: String(Q.type || 'mcq'),
      n: 0, wrong1: 0, still: 0, asks: 0, extra: 0, slow: 0, slow_right: 0, untagged: 0, students: [] };
    var p = String(r.profile), right1 = Number(r.try1_correct) === 1, best = Number(r.best_correct) === 1, nt = Number(r.n_tries) || 0;
    var ask = !!r.asked && String(r.ask_status) === 'open';
    o.n++; if (!right1) o.wrong1++; if (!best) o.still++; if (ask) o.asks++; o.extra += Math.max(0, nt - 1);
    if (p === 'SLOW_RIGHT' || p === 'SLOW_WRONG') o.slow++; if (p === 'SLOW_RIGHT') o.slow_right++;
    if (!right1 && !String(r.mistake_type || '').trim()) o.untagged++;
    var tl = (tries[r.set_id + '|' + r.qid] || []).sort(function (a, b) { return Number(a.try_no) - Number(b.try_no); });
    o.students.push({ code: normCode_(r.student_code), name: names[normCode_(r.student_code)] || r.student_code, set_id: String(r.set_id),
      set_title: setTitle_(setOf[String(r.set_id)] || {}), date: dateStr_(r.submitted_at),
      tries: tl.map(function (t) { return { a: clean_(t.answer), ok: Number(t.correct) === 1 }; }),
      try1: clean_(r.try1_answer), right1: right1, best: best, n_tries: nt, locked: isYes_(r.locked), time_s: Math.round(Number(r.time_try1_sec) || 0),
      pace: Number(r.pace_ratio) || null, profile: p, badge: qBadge_(p), flags: String(r.flags || ''), asked: !!r.asked, ask_note: clean_(r.ask_note),
      ask_status: String(r.ask_status || ''), mistake_type: clean_(r.mistake_type), mistake_note: clean_(r.mistake_note) });
  });
  var rows = priorityOrder_(Object.keys(byQ).map(function (k) { return byQ[k]; }), T.members.length === 1);
  rows.forEach(function (r) {
    r.skill_name = skillName_(r.skill); r.subskill_name = subskillName_(r.subskill);
    var bits = [r.wrong1 + ' of ' + r.n + ' wrong'];
    if (r.asks) bits.push(r.asks + ' asked'); if (r.extra) bits.push(r.extra + r.n + ' tries'); if (r.slow) bits.push(r.slow + ' slow');
    r.summary = bits.join(' · ');
  });
  // one student: weak sub-skills (red dot, ≥ progress_dot_min answers) above the list
  var weak = [];
  if (T.members.length === 1) {
    var S = getSettings_(), acc = {};
    firstTries_(T.members[0]).forEach(function (t) { var o = acc[t.subskill] = acc[t.subskill] || { n: 0, r: 0 }; o.n++; if (t.right) o.r++; });
    Object.keys(acc).forEach(function (k) { var o = acc[k]; if (k && o.n >= S.progress_dot_min && o.r / o.n < S.dot_amber) weak.push({ subskill: k, name: subskillName_(k), right: o.r, n: o.n }); });
    weak.sort(function (a, b) { return a.right / a.n - b.right / b.n; });
  }
  var scopes = [{ id: 'd7', label: 'Last 7 days' }, { id: 'd30', label: 'Last 30 days' }, { id: 'all', label: 'All time' }];
  asg.slice().reverse().forEach(function (a) { scopes.push({ id: 'a:' + a.assignment_id, label: 'Assignment · ' + String(a.title) }); });
  allSets.filter(function (s) { return String(s.kind) !== 'assignment'; }).sort(function (a, b) { return toMs_(b.submitted_at) - toMs_(a.submitted_at); }).slice(0, 15).forEach(function (s) {
    scopes.push({ id: 's:' + s.set_id, label: (names[normCode_(s.student_code)] || '') + ' · ' + setTitle_(s) + ' · ' + dateStr_(s.submitted_at) });
  });
  var assignments = asg.map(function (a) { return assignmentInfo_(a, names); });
  return { ok: true, target: { kind: T.kind, id: T.id, title: T.title }, members: T.members.map(function (c) { return { code: c, name: names[c] || c }; }),
           scope: scope, scopes: scopes, rows: rows, weak: weak, assignments: assignments, n_sets: sets.length };
}
function assignmentInfo_(a, names) {
  var mem = targetMembers_(a), sets = readTable_('Sets').rows.filter(function (s) { return String(s.assignment_id) === String(a.assignment_id); });
  var pl = String(a.kind) === 'placement';
  return { assignment_id: String(a.assignment_id), title: String(a.title), target_type: String(a.target_type), target_id: String(a.target_id),
           kind: pl ? 'placement' : 'questions', form: pl ? String(a.form || 'auto') : '', n: pl ? 0 : setQids_(a).length, available_from: fmtDay_(a.available_from), due: fmtDay_(a.due), status: String(a.status),
           students: mem.map(function (c) {
             var s = sets.filter(function (x) { return normCode_(x.student_code) === c; })[0];
             return { code: c, name: (names || {})[c] || c, state: !s ? 'not started' : isFinished_(s) ? 'done' : 'in progress', n: s ? Number(s.n) || 0 : 0,
                      first_try: s && isFinished_(s) ? Number(s.first_try) : null, best: s && isFinished_(s) ? Number(s.best_score) : null, set_id: s ? String(s.set_id) : '' };
           }) };
}
function fmtDay_(v) {
  if (!v) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') return fmtDate_(v, 'yyyy-MM-dd');
  return String(v).replace(/^'/, '').slice(0, 10);
}

/** The question as students saw it + the key (teacher only) + the CB rationale when there is one. */
function questionPanel(code, qid) {
  cachedReads_();                                                   // read-only: snapshots, no Sheet (#42)
  requireTeacher_(code);
  qid = String(qid || '').trim();
  if (/^[EMH]\d+(B\d*)?$/i.test(qid)) {                            // a short code (E326) typed in the search box
    var hit = questionRows_().filter(function (x) { return clean_(x.code).toUpperCase() === qid.toUpperCase(); })[0];
    if (hit) qid = String(hit.qid);
  }
  var q = libQuestions_([qid])[0];
  if (!q) throw new Error('FORM: Question not found in the library.');
  q.part = 'P'; q.display_no = 1;
  var o = clientQuestion_(q, true), r = questionRows_().filter(function (x) { return String(x.qid) === String(qid); })[0] || {};
  o.code = clean_(r.code) || q.code || '';
  o.key = keyList_(q); o.rationale_html = q.rationale_html || '';
  o.cb_id = clean_(r.cb_question_id) || ((q.source || {}).cb_question_id || '');
  o.skill_name = skillName_(clean_(r.skill)); o.subskill_name = subskillName_(clean_(r.subskill)); o.difficulty = String(r.difficulty || ''); o.level = r.level || '';
  var norm = timeNormFor_(q.type, r.difficulty); o.norm_sec = norm ? norm.target : null;
  return { ok: true, q: o };
}

/* ============================== tags · asks ============================== */
function responseRow_(setId, qid) {
  return readTable_('Responses').rows.filter(function (r) { return String(r.set_id) === String(setId) && String(r.qid) === String(qid); })[0];
}
/** Mistake type of one answer (Minh's 7, Settings.mistake_types). A real mistake also puts the item in the student's Review. */
function tagMistake(code, setId, qid, type, note) {
  requireTeacher_(code);
  var S = getSettings_(), types = String(S.mistake_types).split(/\s*;\s*/).filter(String);
  type = String(type || '').trim();
  if (type && types.indexOf(type) < 0) throw new Error('FORM: Unknown mistake type.');
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var r = responseRow_(setId, qid); if (!r) throw new Error('FORM: Answer not found.');
    updateRow_('Responses', r._row, { mistake_type: type, mistake_note: txt_(String(note || '').slice(0, 300)), tagged_at: type ? nowIso_() : '', tagged_in: type ? 'app' : '' });
    var added = false;
    if (type && type !== 'Not A Mistake') added = tagToReview_(normCode_(r.student_code), String(qid), String(setId));
    return { ok: true, review_added: added };
  } finally { lock.releaseLock(); }
}
function tagToReview_(sc, qid, setId) {
  var open = readTable_('Review').rows.some(function (x) { return normCode_(x.student_code) === sc && String(x.qid) === qid && String(x.status) === 'open'; });
  if (open) return false;
  appendObjects_('Review', [{ student_code: sc, qid: qid, reason: 'tagged', from_set: setId, added_at: nowIso_(), status: 'open', n_served: 0 }]);
  return true;
}
/** Tags typed in the Sheet (tagged_in empty): each one is handled once — Review row if it is a real mistake, then
 *  tagged_in = sheet. Tags made on the teacher page are handled at once by tagMistake. */
function syncTaggedReview_() {
  var n = 0, now = nowIso_();
  readTable_('Responses').rows.forEach(function (r) {
    var t = clean_(r.mistake_type);
    if (!t || String(r.tagged_in || '').trim()) return;
    if (t !== 'Not A Mistake' && tagToReview_(normCode_(r.student_code), String(r.qid), String(r.set_id))) n++;
    updateRow_('Responses', r._row, { tagged_in: 'sheet', tagged_at: r.tagged_at || now });
  });
  return 'tags from the Sheet → Review: ' + n;
}
/** Mistake-type dropdown on Responses.mistake_type (rebuilt from Settings on every update). */
function ensureMistakeDropdown_() {
  var sh = sheet_('Responses'), col = headers_('Responses').indexOf('mistake_type') + 1;
  if (col < 1) return 'dropdown: no column';
  var types = String(getSettings_().mistake_types).split(/\s*;\s*/).filter(String);
  var rule = SpreadsheetApp.newDataValidation().requireValueInList(types, true).setAllowInvalid(true).build();
  sh.getRange(2, col, Math.max(1, sh.getMaxRows() - 1), 1).setDataValidation(rule);
  return 'dropdown: ' + types.length + ' mistake types';
}
function resolveAsk(code, setId, qid, reopen) {
  requireTeacher_(code);
  var r = responseRow_(setId, qid); if (!r) throw new Error('FORM: Answer not found.');
  updateRow_('Responses', r._row, reopen ? { ask_status: 'open', resolved_at: '' } : { ask_status: 'resolved', resolved_at: nowIso_() });
  return { ok: true };
}
function asksInbox(code) {
  cachedReads_();                                                   // read-only: snapshots, no Sheet (#42)
  requireTeacher_(code);
  var names = {}; readTable_('Students').rows.forEach(function (r) { names[normCode_(r.student_code)] = String(r.name || r.student_code); });
  var sets = {}; readTable_('Sets').rows.forEach(function (s) { sets[String(s.set_id)] = s; });
  var qc = {}; questionRows_().forEach(function (r) { qc[String(r.qid)] = clean_(r.code); });
  var out = readTable_('Responses').rows.filter(function (r) { return r.asked && String(r.ask_status) === 'open'; }).map(function (r) {
    return { set_id: String(r.set_id), qid: String(r.qid), code: qc[String(r.qid)] || '', student: names[normCode_(r.student_code)] || r.student_code, student_code: normCode_(r.student_code),
             note: clean_(r.ask_note), date: dateStr_(r.ask_at || r.submitted_at), ms: toMs_(r.ask_at || r.submitted_at), set_title: setTitle_(sets[String(r.set_id)] || {}),
             right1: Number(r.try1_correct) === 1, best: Number(r.best_correct) === 1 };
  }).sort(function (a, b) { return b.ms - a.ms; });
  return { ok: true, asks: out };
}

/* ============================== student profile ============================== */
function studentProfile(code, sc) {
  cachedReads_();                                                   // read-only: snapshots, no Sheet (#42)
  requireTeacher_(code);
  var st = findStudent_(sc); if (!st) throw new Error('FORM: Student not found.');
  var c = normCode_(st.student_code), S = getSettings_(), tries = firstTries_(c);
  var lv = {}; readTable_('Levels').rows.forEach(function (r) { if (normCode_(r.student_code) === c) lv[clean_(r.skill)] = r; });
  var acc = {};
  tries.forEach(function (t) { [t.skill, 's:' + t.subskill].forEach(function (k) { var o = acc[k] = acc[k] || { n: 0, r: 0 }; o.n++; if (t.right) o.r++; }); });
  var dot = function (o) { if (!o || o.n < S.progress_dot_min) return 'n'; var p = o.r / o.n; return p >= S.dot_green ? 'g' : p >= S.dot_amber ? 'y' : 'r'; };
  var skills = [], seen = {};
  SKILLS_.forEach(function (r) {
    if (!seen[r.skill]) {
      seen[r.skill] = { skill: r.skill, name: r.skill_name, domain: r.domain_name, level: lv[r.skill] ? String(lv[r.skill].level) : '',
                        recent: lv[r.skill] && lv[r.skill].recent_pct !== '' ? Number(lv[r.skill].recent_pct) : null,
                        streak: lv[r.skill] ? Number(lv[r.skill].good_streak) || 0 : 0, history: lv[r.skill] ? String(lv[r.skill].history || '') : '',
                        n: (acc[r.skill] || {}).n || 0, right: (acc[r.skill] || {}).r || 0, dot: dot(acc[r.skill]), subs: [] };
      skills.push(seen[r.skill]);
    }
    var o = acc['s:' + r.subskill];
    if (r.subskill && o) seen[r.skill].subs.push({ code: r.subskill, name: r.subskill_name, n: o.n, right: o.r, dot: dot(o) });
  });
  var resp = readTable_('Responses').rows.filter(function (r) { return normCode_(r.student_code) === c; });
  var prof = {}, types = {}, asks = 0, time = 0, nTries = 0;
  resp.forEach(function (r) {
    prof[String(r.profile)] = (prof[String(r.profile)] || 0) + 1;
    var t = clean_(r.mistake_type); if (t) types[t] = (types[t] || 0) + 1;
    if (r.asked && String(r.ask_status) === 'open') asks++;
    time += Number(r.time_total_sec) || 0; nTries += Number(r.n_tries) || 0;
  });
  var fixLeft = {}; resp.forEach(function (r) { if (Number(r.best_correct) !== 1 && !isYes_(r.locked)) fixLeft[r.set_id] = (fixLeft[r.set_id] || 0) + 1; });
  var placements = []; try { placements = plSummaries_(c); } catch (e) {}
  var sets = readTable_('Sets').rows.filter(function (s) { return normCode_(s.student_code) === c && !isHidden_(s); })
    .sort(function (a, b) { return (toMs_(b.submitted_at) || toMs_(b.created_at)) - (toMs_(a.submitted_at) || toMs_(a.created_at)); }).map(function (s) {
      return { set_id: String(s.set_id), title: setTitle_(s), kind: String(s.kind), date: dateStr_(s.submitted_at || s.created_at), done: isFinished_(s),
               n: Number(s.n) || 0, first_try: isFinished_(s) ? Number(s.first_try) || 0 : null, best: isFinished_(s) ? Number(s.best_score) || 0 : null,
               time_min: Number(s.time_used_min) || 0, fix_left: String(s.kind) === 'placement' ? 0 : fixLeft[String(s.set_id)] || 0, progress: String(s.progress || '') };
    });
  var review = readTable_('Review').rows.filter(function (r) { return normCode_(r.student_code) === c && String(r.status) === 'open'; }).length;
  return { ok: true, student: { code: c, name: String(st.name || ''), active: isYes_(st.active), classes: String(st.classes || '') },
           skills: skills, sets: sets, placements: placements, profiles: prof, mistakes: types, asks_open: asks, review_open: review,
           totals: { answers: resp.length, first_try_right: resp.filter(function (r) { return Number(r.try1_correct) === 1; }).length,
                     best_right: resp.filter(function (r) { return Number(r.best_correct) === 1; }).length, tries: nTries, time_min: round_(time / 60, 1) } };
}

/* ============================== assignments (§7) ============================== */
/** Tree domain → skill → sub-skill with live items per E/M/H, and how many are fresh for every target student. */
function assignmentTree(code, target) {
  cachedReads_();                                                   // read-only: snapshots, no Sheet (#42)
  requireTeacher_(code);
  var mem = target ? resolveTarget_(target).members : [], done = {};
  if (mem.length) readTable_('Responses').rows.forEach(function (r) { if (mem.indexOf(normCode_(r.student_code)) >= 0) done[String(r.qid)] = 1; });
  var cnt = {};
  livePool_().forEach(function (r) {
    var d = String(r.difficulty).toUpperCase();
    [clean_(r.skill), clean_(r.subskill)].forEach(function (k) {
      var o = cnt[k] = cnt[k] || { E: 0, M: 0, H: 0, fE: 0, fM: 0, fH: 0 };
      if (o[d] !== undefined) { o[d]++; if (!done[String(r.qid)]) o['f' + d]++; }
    });
  });
  var doms = [], di = {};
  SKILLS_.forEach(function (r) {
    if (!di[r.domain]) { di[r.domain] = { domain: r.domain, name: r.domain_name, skills: [], _s: {} }; doms.push(di[r.domain]); }
    var d = di[r.domain];
    if (!d._s[r.skill]) { var pf = skillProfile_(r.skill); d._s[r.skill] = { code: r.skill, name: r.skill_name, count: cnt[r.skill] || null, subs: [], profile: pf.label, allowed: ['E', 'M', 'H'].filter(function (x) { return pf.allowed[x]; }).join(',') }; d.skills.push(d._s[r.skill]); }
    if (r.subskill) d._s[r.skill].subs.push({ code: r.subskill, name: r.subskill_name, count: cnt[r.subskill] || null });
  });
  doms.forEach(function (d) { delete d._s; });
  return { ok: true, domains: doms, members: mem.length };
}
/** Spread n over the ticked difficulties as evenly as possible (n=4, M+H → 2 M + 2 H). */
function spread_(n, diffs) {
  var out = {}; diffs.forEach(function (d, i) { out[d] = Math.floor(n / diffs.length) + (i < n % diffs.length ? 1 : 0); }); return out;
}
/** Picks the questions of an assignment (§7.4). spec = {target, topics: [{code, n, diffs: 'E,M'}]} → per topic: picked + queue (for Swap). */
function pickAssignment(code, spec) {
  cachedReads_();                                                   // read-only: snapshots, no Sheet (#42)
  requireTeacher_(code);
  var T = resolveTarget_(spec && spec.target), mem = T.members, names = {};
  readTable_('Students').rows.forEach(function (r) { names[normCode_(r.student_code)] = String(r.name || r.student_code).split(/\s+/)[0]; });
  var last = {};                                                   // qid → {ms, who: [names]}
  readTable_('Responses').rows.forEach(function (r) {
    var c = normCode_(r.student_code); if (mem.indexOf(c) < 0) return;
    var o = last[String(r.qid)] = last[String(r.qid)] || { ms: 0, who: [] };
    o.ms = Math.max(o.ms, toMs_(r.submitted_at)); if (o.who.indexOf(names[c]) < 0) o.who.push(names[c]);
  });
  var pool = livePool_(), used = {}, twins = {}, S = getSettings_(), seed = seedOf_(JSON.stringify(spec) + Date.now());
  var topics = (spec.topics || []).map(function (t) {
    var tc = String(t.code || ''), n = Math.max(1, Math.min(40, Number(t.n) || 1));
    var diffs = String(t.diffs || '').split(/[,\s]+/).map(function (d) { return d.toUpperCase(); }).filter(function (d) { return /^[EMH]$/.test(d); });
    if (!diffs.length) throw new Error('FORM: Tick Easy, Medium or Hard for ' + tc + '.');
    var isSub = /\.\d+$/.test(tc), skill = isSub ? (SKILLS_.filter(function (x) { return x.subskill === tc; })[0] || {}).skill : tc;
    var inTopic = pool.filter(function (r) { return isSub ? clean_(r.subskill) === tc : clean_(r.skill) === tc; });
    // Teacher's ticks = real difficulties: NO Hard stand-ins here (bug #28: Q.G with E+M ticked got Hard items).
    // Skill_Profile: a difficulty the skill does not have on the SAT counts as 0 items (Circles: no Easy) → neighbour fill + note
    var prof = skillProfile_(skill);
    var match = function (r, d) { return String(r.difficulty).toUpperCase() === d && !!prof.allowed[d]; };
    var rnd = {}; shuffle_(inTopic.slice(), seed).forEach(function (r, i) { rnd[String(r.qid)] = i; });
    var lvPref = 0;                                                  // filling for a missing Easy: Medium level 1 first (+1); for Hard: hardest first (−1)
    var queueFor = function (d) {
      return inTopic.filter(function (r) { return match(r, d); }).sort(function (a, b) {
        var la = last[String(a.qid)], lb = last[String(b.qid)];
        return (la ? 1 : 0) - (lb ? 1 : 0) || lvPref * ((Number(a.level) || 1) - (Number(b.level) || 1)) || (la ? la.ms : 0) - (lb ? lb.ms : 0) || rnd[String(a.qid)] - rnd[String(b.qid)];
      });
    };
    var picked = [], extra = {}, subsUsed = {};                       // sub-skills already in this topic (spread across difficulties too)
    /** take up to k items of difficulty d (one per sub-skill first, then the rest in queue order) */
    var takeFrom = function (d, k) {
      var q = queueFor(d), take = [];
      [true, false].forEach(function (firstPass) {
        q.forEach(function (r) {
          if (take.length >= k) return;
          var id = String(r.qid), tw = String(r.twin_group || ''), sb = clean_(r.subskill);
          if (used[id] || (tw && twins[tw]) || (firstPass && subsUsed[sb])) return;
          used[id] = 1; if (tw) twins[tw] = 1; subsUsed[sb] = 1; take.push(r);
        });
      });
      take.forEach(function (r) { picked.push(r); });
      return take.length;
    };
    var want = spread_(n, diffs), got = {}, notes = [];
    diffs.forEach(function (d) { got[d] = takeFrom(d, want[d]); });
    // a ticked difficulty with too few items: fill from the neighbouring difficulty — and say so in the builder
    var NB = { E: ['M', 'H'], M: ['E', 'H'], H: ['M', 'E'] }, NAME = { E: 'Easy', M: 'Medium', H: 'Hard' };
    diffs.forEach(function (d) {
      var miss = want[d] - got[d]; if (miss <= 0) return;
      var adds = [], none = !prof.allowed[d];
      lvPref = d === 'E' ? 1 : d === 'H' ? -1 : 0;
      NB[d].forEach(function (nd) { if (miss <= 0) return; var k = takeFrom(nd, miss); if (k) { adds.push(k + ' ' + NAME[nd]); extra[nd] = (extra[nd] || 0) + k; miss -= k; } });
      lvPref = 0;
      notes.push((none ? skillName_(skill) + ' has no ' + NAME[d] + ' on the SAT' : 'only ' + got[d] + ' ' + NAME[d] + ' available') +
                 (adds.length ? ' — ' + adds.join(' + ') + ' added' + (none && d === 'E' ? ' (easiest first)' : none && d === 'H' ? ' (hardest first)' : '') : '') + (miss > 0 ? ' — ' + miss + ' missing' : ''));
    });
    var queue = [];
    diffs.concat(['E', 'M', 'H'].filter(function (d) { return diffs.indexOf(d) < 0; })).forEach(function (d) { queueFor(d).forEach(function (r) { if (!used[String(r.qid)]) queue.push(r); }); });
    var avail = inTopic.filter(function (r) { return diffs.some(function (d) { return match(r, d); }); }).length;
    var item = function (r) {
      var l = last[String(r.qid)];
      return { qid: String(r.qid), code: clean_(r.code), difficulty: String(r.difficulty), level: r.level || '', subskill: clean_(r.subskill),
               subskill_name: subskillName_(clean_(r.subskill)), status: l ? 'done by ' + l.who.join(', ') : 'new for all' };
    };
    return { code: tc, name: isSub ? subskillName_(tc) : skillName_(tc), n: n, diffs: diffs.join(','), available: avail,
             short: picked.length < n ? 'only ' + picked.length + ' available' : '', notes: notes,
             picked: picked.map(function (r) { var o = item(r); o.extra = diffs.indexOf(String(r.difficulty).toUpperCase()) < 0; return o; }),
             queue: queue.slice(0, 30).map(item) };
  });
  return { ok: true, target: { kind: T.kind, id: T.id, title: T.title, members: mem.length }, topics: topics };
}
/** Publish (or save as draft) an assignment with the frozen list of questions. */
function publishAssignment(code, a) {
  requireTeacher_(code);
  var T = resolveTarget_(a && a.target);
  if (T.kind === 'all') throw new Error('FORM: Choose a student or a class.');
  var pl = String(a.kind || '') === 'placement', qids = [], form = '';
  if (pl) {
    form = String(a.form || 'auto').toUpperCase(); if (['A', 'B', 'AUTO'].indexOf(form) < 0) form = 'AUTO';
    var fm = plForms_(), slots = Object.keys(fm).filter(function (k) { return form === 'AUTO' || k.indexOf(form + '|') === 0; });
    if (!slots.length) throw new Error('FORM: The placement forms are not in the Sheet yet (tab Placement_Forms).');
  } else {
    var known = {}; livePool_().forEach(function (r) { known[String(r.qid)] = 1; });
    qids = (a.qids || []).map(String).filter(function (q, i, arr) { return known[q] && arr.indexOf(q) === i; });
    if (!qids.length) throw new Error('FORM: Pick the questions first.');
  }
  var title = String(a.title || '').trim().slice(0, 80) || (pl ? PL_TITLE : 'Homework – ' + fmtDate_(new Date(), 'd MMM'));
  var from = /^\d{4}-\d{2}-\d{2}$/.test(String(a.available_from || '')) ? a.available_from : fmtDate_(new Date(), 'yyyy-MM-dd');
  var due = /^\d{4}-\d{2}-\d{2}$/.test(String(a.due || '')) ? a.due : '';
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var day = fmtDate_(new Date(), 'yyyyMMdd'), n = readTable_('Assignments').rows.filter(function (x) { return String(x.assignment_id).indexOf('A-' + day + '-') === 0; }).length;
    var id = 'A-' + day + '-' + (n + 1);
    appendObjects_('Assignments', [{ assignment_id: id, title: title, target_type: T.kind, target_id: T.id, topics: pl ? '' : txt_(JSON.stringify(a.topics || [])),
      qids: qids.join(','), available_from: txt_(from), due: txt_(due), status: a.draft ? 'draft' : 'published', created_at: nowIso_(), created_in: 'app',
      kind: pl ? 'placement' : '', form: pl ? form.toLowerCase() === 'auto' ? 'auto' : form : '' }]);
    return { ok: true, assignment_id: id, n: qids.length, placement: pl };
  } finally { lock.releaseLock(); }
}
function closeAssignment(code, aid, reopen) {
  requireTeacher_(code);
  var r = readTable_('Assignments').rows.filter(function (x) { return String(x.assignment_id) === String(aid); })[0];
  if (!r) throw new Error('FORM: Assignment not found.');
  updateRow_('Assignments', r._row, { status: reopen ? 'published' : 'closed' });
  return { ok: true };
}

/* ---------------- student side ---------------- */
function assignmentFor_(a, c) { return String(a.status) === 'published' && targetMembers_(a).indexOf(c) >= 0; }
/** Home card ① for one student: published, available from today, not yet submitted by them. */
function assignmentsFor_(c, sets) {
  var today = fmtDate_(new Date(), 'yyyy-MM-dd');
  return readTable_('Assignments').rows.filter(function (a) { return a.assignment_id && assignmentFor_(a, c) && fmtDay_(a.available_from) <= today; }).map(function (a) {
    var s = sets.filter(function (x) { return String(x.assignment_id) === String(a.assignment_id); })[0];
    if (s && isFinished_(s)) return null;
    var stt = s ? parseState_(s) || {} : {}, ps = (stt.parts || {})[SET_PART] || {}, nAns = Object.keys(ps.ans || {}).length, n = setQids_(a).length;
    var due = fmtDay_(a.due), when = 'from ' + dayStr_(fmtDay_(a.available_from)) + (due ? ' · due ' + dayStr_(due, true) : '');
    if (String(a.kind) === 'placement') return { assignment_id: String(a.assignment_id), title: String(a.title), placement: true, n: 0, when: when,
      set_id: s ? String(s.set_id) : '', answered: s ? Math.max(0, (Number(s.n) || 1) - 1) : 0 };
    return { assignment_id: String(a.assignment_id), title: String(a.title), n: n, when: when, set_id: s ? String(s.set_id) : '', answered: nAns };
  }).filter(Boolean);
}
function dayStr_(ymd, withDay) {
  var d = new Date(ymd + 'T12:00:00+07:00'); if (isNaN(d.getTime())) return ymd;
  return fmtDate_(d, withDay ? 'EEE d MMM' : 'd MMM');
}
function startAssignment(code, aid) {
  var st = requireStudent_(code), c = normCode_(st.student_code);
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var a = readTable_('Assignments').rows.filter(function (x) { return String(x.assignment_id) === String(aid); })[0];
    if (!a || !assignmentFor_(a, c) || fmtDay_(a.available_from) > fmtDate_(new Date(), 'yyyy-MM-dd')) throw new Error('FORM: This assignment is not available.');
    var have = readTable_('Sets').rows.filter(function (s) { return normCode_(s.student_code) === c && String(s.assignment_id) === String(aid); })[0];
    if (have) return { ok: true, set_id: String(have.set_id), resumed: true, done: isFinished_(have) };
    if (String(a.kind) === 'placement') return startPlacement_(a, c);
    var setId = newSetId_(c), q = setQids_(a);
    appendObjects_('Sets', [{ set_id: setId, student_code: c, kind: 'assignment', assignment_id: String(aid), skill: '', n: q.length, qids: q.join(','),
                              created_at: nowIso_(), status: 'in_progress', events_saved: 0, last_saved_at: nowIso_() }]);
    return { ok: true, set_id: setId, n: q.length };
  } finally { lock.releaseLock(); }
}
var _asgTitle = null;
function assignmentTitle_(aid) {
  if (!_asgTitle) { _asgTitle = {}; try { readTable_('Assignments').rows.forEach(function (a) { _asgTitle[String(a.assignment_id)] = String(a.title || ''); }); } catch (e) {} }
  return _asgTitle[String(aid)] || 'Assignment';
}
