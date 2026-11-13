/**
 * SAT Math Lib — choosing the questions of a practice set + the student's home data.
 * Build B1/B2 (skeleton): unseen first, then items missed ≥ retry_wait_days ago, then the oldest seen; one item per twin
 * group; easier → harder. The adaptive levels of spec v1.1 §4 (templates E/M/H, missed sub-skills, probe) come in B3
 * and replace pickForPractice_ only.
 */

/** Seeded shuffle (so a test can repeat a pick). */
function shuffle_(a, seed) {
  var s = seed || Date.now() % 2147483647;
  var rnd = function () { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}
var DIFF_ORDER_ = { E: 1, M: 2, H: 3 };

/** {qid: {last_ms, last_right, n}} of one student (first tries of every set). */
function historyOf_(codeN) {
  var h = {};
  readTable_('Responses').rows.forEach(function (r) {
    if (normCode_(r.student_code) !== codeN) return;
    var q = String(r.qid), t = toMs_(r.submitted_at);
    var o = h[q] = h[q] || { last_ms: 0, last_right: false, n: 0 };
    o.n++;
    if (t >= o.last_ms) { o.last_ms = t; o.last_right = Number(r.try1_correct) === 1; }
  });
  return h;
}

function pickForPractice_(codeN, skill, n) {
  var S = getSettings_(), hist = historyOf_(codeN), now = Date.now();
  var pool = livePool_().filter(function (r) { return String(r.skill).replace(/^'/, '') === skill; });
  var unseen = [], wrongOld = [], seen = [];
  pool.forEach(function (r) {
    var h = hist[String(r.qid)];
    if (!h) unseen.push(r);
    else if (!h.last_right && now - h.last_ms >= S.retry_wait_days * 86400000) wrongOld.push(r);
    else seen.push(r);
  });
  shuffle_(unseen); shuffle_(wrongOld);
  seen.sort(function (a, b) { return hist[String(a.qid)].last_ms - hist[String(b.qid)].last_ms; });
  var out = [], twins = {};
  unseen.concat(wrongOld, seen).forEach(function (r) {
    if (out.length >= n) return;
    var tw = String(r.twin_group || '');
    if (tw && twins[tw]) return;
    if (tw) twins[tw] = 1;
    out.push(r);
  });
  out.sort(function (a, b) {
    return (DIFF_ORDER_[String(a.difficulty).toUpperCase()] || 3) - (DIFF_ORDER_[String(b.difficulty).toUpperCase()] || 3) ||
           (Number(a.level) || 0) - (Number(b.level) || 0);
  });
  return { qids: out.map(function (r) { return String(r.qid); }), level: '', slots: '' };
}

/* ============================== home ============================== */

/** Everything the home needs in one call: skills (with "n new" + progress dot), open sets, history. */
function homeData(code) {
  var st = requireStudent_(code), codeN = normCode_(st.student_code), S = getSettings_();
  var pool = livePool_(), hist = historyOf_(codeN);
  // accuracy of first tries per skill / sub-skill
  var acc = {};
  readTable_('Responses').rows.forEach(function (r) {
    if (normCode_(r.student_code) !== codeN || r.try1_correct === '') return;
    [String(r.skill).replace(/^'/, ''), 's:' + String(r.subskill).replace(/^'/, '')].forEach(function (k) {
      var o = acc[k] = acc[k] || { n: 0, r: 0 }; o.n++; if (Number(r.try1_correct) === 1) o.r++;
    });
  });
  var dot = function (k) {
    var o = acc[k]; if (!o || o.n < S.progress_dot_min) return 'n';
    var p = o.r / o.n; return p >= S.dot_green ? 'g' : p >= S.dot_amber ? 'y' : 'r';
  };
  var count = {};
  pool.forEach(function (r) {
    var sk = String(r.skill).replace(/^'/, ''), ss = 's:' + String(r.subskill).replace(/^'/, '');
    [sk, ss].forEach(function (k) { var c = count[k] = count[k] || { live: 0, fresh: 0 }; c.live++; if (!hist[String(r.qid)]) c.fresh++; });
  });
  var domains = [], dIdx = {};
  (typeof SKILLS_ !== 'undefined' ? SKILLS_ : []).forEach(function (r) {
    if (!dIdx[r.domain]) { dIdx[r.domain] = { domain: r.domain, name: r.domain_name, fresh: 0, skills: [], _s: {} }; domains.push(dIdx[r.domain]); }
    var d = dIdx[r.domain];
    if (!d._s[r.skill]) {
      var c = count[r.skill] || { live: 0, fresh: 0 };
      d._s[r.skill] = { skill: r.skill, name: r.skill_name, live: c.live, fresh: c.fresh, dot: dot(r.skill), subs: [] };
      d.skills.push(d._s[r.skill]); d.fresh += c.fresh;
    }
    if (r.subskill) {
      var cs = count['s:' + r.subskill] || { live: 0, fresh: 0 };
      d._s[r.skill].subs.push({ code: r.subskill, name: r.subskill_name, fresh: cs.fresh, dot: dot('s:' + r.subskill) });
    }
  });
  domains.forEach(function (d) { delete d._s; });
  var sets = readTable_('Sets').rows.filter(function (s) { return normCode_(s.student_code) === codeN && !isHidden_(s); });
  var open = sets.filter(function (s) { return isOpenStatus_(s.status); }).map(function (s) {
    var stt = parseState_(s) || {}, ps = (stt.parts || {})[SET_PART] || {}, nAns = Object.keys(ps.ans || {}).length;
    return { set_id: String(s.set_id), title: setTitle_(s), n: Number(s.n) || 0, answered: nAns, started: dateStr_(s.created_at) };
  });
  var history = sets.filter(isFinished_).sort(function (a, b) { return toMs_(b.submitted_at) - toMs_(a.submitted_at); }).slice(0, 50).map(function (s) {
    return { set_id: String(s.set_id), title: setTitle_(s), date: dateStr_(s.submitted_at), n: Number(s.n) || 0,
             first_try: Number(s.first_try) || 0, best: s.best_score === '' ? Number(s.first_try) || 0 : Number(s.best_score) };
  });
  var sizes = String(S.set_sizes).split(/[,\s]+/).map(Number).filter(Boolean);
  return { ok: true, first_name: String(st.name || '').replace(/\(.*?\)/g, '').trim().split(/\s+/)[0] || '', domains: domains,
           open: open, history: history, sizes: sizes };
}
