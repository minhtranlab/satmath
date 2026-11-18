/* ============================== My skills (#67 prototype → #68 D) ==============================
 * The student's own page: Focus now · Why I miss questions · My mistakes · Skill map · My progress, and one skill's
 * sub-skills. Everything is computed here from the cached snapshots (one call when the page opens; clicks need no server).
 * Formulas = design/my_skills_prototype/README.md:
 *   answers   = the student's Responses rows (all set kinds), last 60 days; one row = one first-try answer, blank = wrong
 *   %         = right on try 1 ÷ answers (plain);  colour: < 5 answers grey · ≥ 80 green · 50–79 amber · < 50 red
 *   Focus     = skills with ≥ 5 answers and < 80 %, top 3 by (1 − wacc) × Skill_Profile weight; wacc = first-try accuracy
 *               weighted 0.5^(age in days / 14)
 *   habits    = FAST_WRONG / SLOW_RIGHT counts, last 30 days; teacher's notes = the 2 most frequent mistake types, 30 days
 *   weeks     = 4 buckets of 7 days ending today, a % only with ≥ 5 answers
 *   level-ups = Levels history "E→M d MMM" entries going up in the last 28 days (not "placement …" / "mixed M→…" lines)
 *   My mistakes (Minh 18 Nov): the teacher's tags in the 60 days ("Not A Mistake" not counted), shown from 3 tags: per
 *               type count + share, last 4 weeks vs the 4 weeks before, the skill(s) where it happens most, a tip, the questions.
 * Only this student's rows are read into the payload — no codes, no keys, nothing of anyone else. */
var MS_ = { WINDOW: 60, MIN_N: 5, HALF: 14, HAB: 30, UPS: 28, MIN_TAGS: 3, GREEN: 80, AMBER: 50 };
var MS_TIPS_ = {
  'Concept Gap': 'The idea itself is shaky. Open the skill below and practise its red sub-skills first.',
  "Didn't Understand The Question": 'Before solving, say in your own words what the question asks for.',
  'Misread A Detail': 'Underline units, "not", "each" and what to find. Read the last line again before you answer.',
  'Careless Calculation': 'Write each step. Check your answer by putting it back into the question.',
  'Wrong Input/Format': 'Check how the answer must be typed: a fraction or a decimal, no units, no mixed numbers.',
  'Others': 'Ask your teacher what to watch for next time.'
};

function msColour_(n, pct) { return n < MS_.MIN_N ? 'n' : pct >= MS_.GREEN ? 'g' : pct >= MS_.AMBER ? 'y' : 'r'; }
/** Whole days between the day of ms and today (calendar days, script time zone). */
function msDayAge_(ms, todayStr) {
  var a = new Date(fmtDate_(new Date(ms), 'yyyy-MM-dd') + 'T12:00:00Z').getTime(), t = new Date(todayStr + 'T12:00:00Z').getTime();
  return Math.max(0, Math.round((t - a) / 86400000));
}

function mySkills(code) {
  cachedReads_();                                                   // read-only: snapshots, no Sheet (#42)
  var st = requireStudent_(code), codeN = normCode_(st.student_code);
  return mySkillsOf_(codeN);
}
function mySkillsOf_(codeN) {
  var S = getSettings_(), now = new Date(), today = fmtDate_(now, 'yyyy-MM-dd');
  var titles = {}, sets = {};
  readTable_('Sets').rows.forEach(function (s) { if (normCode_(s.student_code) === codeN) sets[String(s.set_id)] = s; });
  var ans = readTable_('Responses').rows.filter(function (r) { return normCode_(r.student_code) === codeN && toMs_(r.submitted_at); }).map(function (r) {
    var ms = toMs_(r.submitted_at);
    return { set_id: String(r.set_id), qid: String(r.qid), order: Number(r.order) || 0, k: clean_(r.skill), ss: clean_(r.subskill),
             ok: Number(r.try1_correct) === 1 ? 1 : 0, p: String(r.profile || ''), m: clean_(r.mistake_type), ms: ms, age: msDayAge_(ms, today) };
  });
  var A = ans.filter(function (a) { return a.age <= MS_.WINDOW; });

  // skills in taxonomy order
  var skills = [], byK = {}, doms = [], dSeen = {};
  SKILLS_.forEach(function (r) {
    if (!dSeen[r.domain]) { dSeen[r.domain] = 1; doms.push({ d: r.domain, name: r.domain_name }); }
    if (!byK[r.skill]) { byK[r.skill] = { k: r.skill, d: r.domain, name: r.skill_name, n: 0, r: 0, ws: 0, wr: 0, subs: [], _s: {} }; skills.push(byK[r.skill]); }
    if (r.subskill && !byK[r.skill]._s[r.subskill]) { var so = { ss: r.subskill, name: r.subskill_name, n: 0, r: 0 }; byK[r.skill]._s[r.subskill] = so; byK[r.skill].subs.push(so); }
  });
  A.forEach(function (a) {
    var o = byK[a.k]; if (!o) return;
    var w = Math.pow(0.5, a.age / MS_.HALF);
    o.n++; o.r += a.ok; o.ws += w; o.wr += w * a.ok;
    var s = o._s[a.ss]; if (s) { s.n++; s.r += a.ok; }
  });
  var live = {}; livePool_().forEach(function (q) { live[clean_(q.subskill)] = (live[clean_(q.subskill)] || 0) + 1; });
  var lv = {}; readTable_('Levels').rows.forEach(function (r) { if (normCode_(r.student_code) === codeN) lv[clean_(r.skill)] = r; });
  skills.forEach(function (o) {
    o.pct = o.n ? Math.round(100 * o.r / o.n) : null;
    o.wacc = o.ws ? o.wr / o.ws : null;
    o.ranked = o.n >= MS_.MIN_N;
    o.score = o.ranked ? Math.round(1e4 * (1 - o.wacc) * skillProfile_(o.k).weight) / 1e4 : -1;
    o.col = o.ranked ? msColour_(o.n, o.pct) : 'n';
    o.level = lv[o.k] && /^[EMH]$/.test(String(lv[o.k].level)) ? String(lv[o.k].level) : '';
    o.subs.forEach(function (s) { s.pct = s.n ? Math.round(100 * s.r / s.n) : null; s.col = s.n ? msColour_(s.n, s.pct) : 'n'; s.live = live[s.ss] || 0; });
  });
  var focus = skills.filter(function (o) { return o.ranked && o.pct < MS_.GREEN; })
    .sort(function (a, b) { return b.score - a.score || a.pct - b.pct; }).slice(0, 3).map(function (o) { return o.k; });

  // Why I miss questions (30 days)
  var recent = ans.filter(function (a) { return a.age <= MS_.HAB; });
  var mt30 = {}; recent.forEach(function (a) { if (a.m && a.m !== 'Not A Mistake') mt30[a.m] = (mt30[a.m] || 0) + 1; });
  var why = { n: recent.length, rushed: recent.filter(function (a) { return a.p === 'FAST_WRONG'; }).length,
              slow: recent.filter(function (a) { return a.p === 'SLOW_RIGHT'; }).length,
              types: Object.keys(mt30).sort(function (a, b) { return mt30[b] - mt30[a]; }).slice(0, 2).map(function (t) { return { t: t, n: mt30[t] }; }) };

  // My mistakes (60 days, the teacher's tags)
  var order = String(S.mistake_types).split(/\s*;\s*/).filter(String);
  var tagged = A.filter(function (a) { return a.m && a.m !== 'Not A Mistake'; });
  var mist = { n: tagged.length, min: MS_.MIN_TAGS, enough: tagged.length >= MS_.MIN_TAGS, types: [] };
  if (mist.enough) {
    var by = {};
    tagged.forEach(function (a) { (by[a.m] = by[a.m] || []).push(a); });
    mist.types = Object.keys(by).map(function (t) {
      var xs = by[t], perK = {};
      xs.forEach(function (a) { perK[a.k] = (perK[a.k] || 0) + 1; });
      var top = Math.max.apply(null, Object.keys(perK).map(function (k) { return perK[k]; }));
      var now4 = xs.filter(function (a) { return a.age < 28; }).length, before4 = xs.filter(function (a) { return a.age >= 28 && a.age < 56; }).length;
      return { t: t, n: xs.length, share: Math.round(100 * xs.length / tagged.length), now: now4, before: before4,
               trend: now4 > before4 ? 'up' : now4 < before4 ? 'down' : 'same',
               skills: Object.keys(perK).filter(function (k) { return perK[k] === top; }).slice(0, 2).map(function (k) { return skillName_(k) || k; }),
               tip: MS_TIPS_[t] || 'Ask your teacher what to watch for next time.',
               items: xs.slice().sort(function (a, b) { return b.ms - a.ms; }).slice(0, 40).map(function (a) {
                 var s = sets[a.set_id] || {};
                 if (!titles[a.set_id]) titles[a.set_id] = s.set_id ? setTitle_(s) : 'Set';
                 return { set_id: a.set_id, qid: a.qid, q: a.order, title: titles[a.set_id], date: fmtDate_(new Date(a.ms), 'dd MMM').replace(/^0/, ''),
                          skill: skillName_(a.k) || a.k, sub: subskillName_(a.ss) };
               }) };
    }).sort(function (a, b) { return b.n - a.n || order.indexOf(a.t) - order.indexOf(b.t); });
  }

  // My progress
  var weeks = [3, 2, 1, 0].map(function (w) {
    var xs = ans.filter(function (a) { return a.age >= 7 * w && a.age < 7 * w + 7; });
    return { n: xs.length, pct: xs.length >= MS_.MIN_N ? Math.round(100 * xs.filter(function (a) { return a.ok; }).length / xs.length) : null };
  });
  var ups = [], rank = { E: 0, M: 1, H: 2 }, mon = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  Object.keys(lv).forEach(function (k) {
    String(lv[k].history || '').split(/\s*·\s*/).forEach(function (h) {
      var m = /^([EMH])→([EMH]) (\d{1,2}) ([A-Z][a-z]{2})$/.exec(h.trim()); if (!m || !(rank[m[2]] > rank[m[1]]) || !(m[4] in mon)) return;
      var y = Number(today.slice(0, 4)), ds = function (yy) { return yy + '-' + ('0' + (mon[m[4]] + 1)).slice(-2) + '-' + ('0' + m[3]).slice(-2); };
      var d = ds(y); if (d > today) d = ds(y - 1);
      var age = Math.round((new Date(today + 'T12:00:00Z') - new Date(d + 'T12:00:00Z')) / 86400000);
      if (age <= MS_.UPS) ups.push({ k: k, name: skillName_(k) || k, from: m[1], to: m[2], when: m[3] + ' ' + m[4], age: age });
    });
  });
  ups.sort(function (a, b) { return a.age - b.age; });

  return {
    ok: true, today: today, window: MS_.WINDOW, min_n: MS_.MIN_N, hab: MS_.HAB, n_all: A.length,
    domains: doms,
    skills: skills.map(function (o) {
      return { k: o.k, d: o.d, name: o.name, n: o.n, pct: o.pct, col: o.col, ranked: o.ranked, level: o.level,
               subs: o.subs.map(function (s) { return { ss: s.ss, name: s.name, n: s.n, pct: s.pct, col: s.col, live: s.live }; }) };
    }),
    focus: focus, why: why, mistakes: mist, weeks: weeks, ups: ups, review_open: openReviewRows_(codeN).length
  };
}

/** #68 D: practise 5 of ONE sub-skill — the practice picker (same rules and level as the skill) on that sub-skill's items;
 *  fewer live items than asked → all of them first, the rest from the same skill (the page says so). */
function startSubPractice(code, sub, n, opts) {
  sub = clean_(sub);
  var row = SKILLS_.filter(function (r) { return r.subskill === sub; })[0];
  if (!row) throw new Error('FORM: This sub-skill is not in the library.');
  var r = startPracticeCore_(code, row.skill, n, opts && opts.replace, sub);
  return withSet_(r, code, opts);
}
