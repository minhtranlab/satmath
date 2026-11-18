/**
 * SAT Math Lib — the result page of a set (student + teacher). Never a key, never an explanation.
 *   First Try = right on the first try / n · Best Score = right on any try / n (fix tries: checkTry, Code.gs)
 *   Fix wrong answers (n) · "You asked your teacher about …" · Review sets: "2 cleared, 3 still to review"
 *   Results by skill: domain → CB skill → sub-skill, x/y, missed questions as chips
 *   Types of mistakes: Rushed and wrong (R) · Didn't know (slow and wrong) (S) · Wrong · Slow but right (S) · Blank
 *   Grid of the set's questions (✓ ✗ R S), each opens the question read-only (getReview)
 */
function qBadge_(p) { return p === 'SLOW_RIGHT' || p === 'SLOW_WRONG' ? 'S' : p === 'FAST_WRONG' ? 'R' : ''; }
function qStatusOf_(r) {
  var p = String(r.profile);
  if (p === 'BLANK') return 'blank';
  return Number(r.best_correct) === 1 ? 'right' : 'wrong';
}
var TYPES_ = [
  { key: 'FAST_WRONG', status: 'wrong', badge: 'R', label: 'Rushed and wrong', meaning: 'Answered quickly and got it wrong. Read the question again slowly.' },
  { key: 'SLOW_WRONG', status: 'wrong', badge: 'S', label: "Didn't know (slow and wrong)", meaning: 'Spent a long time and still got it wrong. Ask your teacher about it.' },
  { key: 'WRONG', status: 'wrong', badge: '', label: 'Wrong', meaning: 'Normal time, wrong answer.' },
  { key: 'SLOW_RIGHT', status: 'right', badge: 'S', label: 'Slow but right', meaning: 'Right, but it took long. Practise to get faster.' },
  { key: 'BLANK', status: 'blank', badge: '', label: 'Blank', meaning: 'No answer.' }
];

/** #48 teacher only: answering · checking · blank minutes and the leave-window log of a set (from its Responses rows). */
function paceOf_(rows) {
  var f = setPaceFields_({}, rows.slice().sort(function (a, b) { return Number(a.order) - Number(b.order); }));
  return { answer_min: f.time_answer_min, check_min: f.time_check_min, blank_min: f.time_blank_min,
           away_n: f.away_n, away_sec: f.away_sec, away_at: f.away_at, has_answer_time: rows.some(function (r) { return r.time_answer_sec !== '' && r.time_answer_sec !== undefined; }) };
}
function resultView_(s, rows, asTeacher) {
  rows = rows.slice().sort(function (a, b) { return Number(a.order) - Number(b.order); });
  var n = rows.length;
  var first = rows.filter(function (r) { return Number(r.try1_correct) === 1; }).length;
  var best = rows.filter(function (r) { return Number(r.best_correct) === 1; }).length;
  var ref = function (r) {
    var o = { qid: String(r.qid), code: 'Q' + r.order, status: qStatusOf_(r), badge: qBadge_(String(r.profile)) };
    if (asTeacher) { o.t = Math.round(Number(r.time_try1_sec) || 0); o.nm = normSec_(r); }     // #66 teacher: S · 2:35
    return o;
  };
  // domain → skill → sub-skill
  var tree = {}, order = [];
  rows.forEach(function (r) {
    var sk = String(r.skill).replace(/^'/, ''), ss = String(r.subskill).replace(/^'/, '');
    var dom = (SKILLS_.filter(function (x) { return x.skill === sk; })[0] || {}).domain || sk.split('.')[0] || '?';
    if (!tree[dom]) { tree[dom] = { title: domainName_(dom), sk: {}, list: [] }; order.push(dom); }
    var d = tree[dom];
    if (!d.sk[sk]) { d.sk[sk] = { name: skillName_(sk) || sk || 'Other', right: 0, n: 0, it: {}, items: [] }; d.list.push(d.sk[sk]); }
    var k = d.sk[sk];
    k.n++; if (Number(r.best_correct) === 1) k.right++;
    var key = ss || '-';
    if (!k.it[key]) { k.it[key] = { name: ss ? subskillName_(ss) : 'Other', right: 0, n: 0, missed: [], slow: [] }; k.items.push(k.it[key]); }
    var it = k.it[key];
    it.n++;
    if (Number(r.best_correct) === 1) { it.right++; if (String(r.profile) === 'SLOW_RIGHT') it.slow.push(ref(r)); }
    else it.missed.push(ref(r));
  });
  var groups = order.map(function (dk) {
    var d = tree[dk];
    return { title: d.title, rows: d.list.map(function (k) { return { name: k.name, right: k.right, n: k.n, items: k.items.map(function (i) { return { name: i.name, right: i.right, n: i.n, missed: i.missed, slow: i.slow }; }) }; }) };
  });
  var types = TYPES_.map(function (t) {
    var qs = rows.filter(function (r) { return String(r.profile) === t.key; }).map(ref);
    return { status: t.status, badge: t.badge, label: t.label, meaning: t.meaning, n: qs.length, qs: qs };
  });
  var st = asTeacher ? findStudent_(s.student_code) : null;
  var v = {
    ok: true, show: 'score_and_right_wrong', valid: true, session_id: String(s.set_id), title: setTitle_(s), date: dateStr_(s.submitted_at),
    first_try: { right: first, n: n }, best: { right: best, n: n }, groups: groups, types: types,
    review: [{ part: SET_PART, title: setTitle_(s), questions: rows.map(function (r) { var x = ref(r); x.no = Number(r.order); return x; }) }]
  };
  // fix wrong answers (§3): items not right on try 1 that are neither fixed nor locked
  v.kind = String(s.kind || 'practice');
  v.fix = { open: rows.filter(function (r) { return Number(r.best_correct) !== 1 && !isYes_(r.locked); }).length,
            fixed: rows.filter(function (r) { return Number(r.try1_correct) !== 1 && Number(r.best_correct) === 1; }).length,
            locked: rows.filter(function (r) { return Number(r.best_correct) !== 1 && isYes_(r.locked); }).length };
  v.asked = rows.filter(function (r) { return !!r.asked && String(r.ask_status) !== 'resolved'; }).map(ref);
  if (v.kind === 'review') {
    var clean = rows.filter(function (r) { return Number(r.try1_correct) === 1 && String(r.profile) !== 'SLOW_RIGHT'; }).length;
    v.review_summary = { cleared: clean, still: n - clean };
  }
  if (asTeacher) { v.teacher = true; v.student = st ? String(st.name || '') : String(s.student_code); v.student_code = normCode_(s.student_code); v.pace = paceOf_(rows); }
  return v;
}
