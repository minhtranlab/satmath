/* ============================== My skills v3 (#70, Minh 18 Nov 21:28–22:13) ==============================
 * The student's own page (and the teacher's view of it), computed here from the cached snapshots (one call per page open).
 * Formulas = design/my_skills_prototype/README.md ("v3" section):
 *   answers    = the student's Responses rows (all set kinds), last 60 days; one row = one first-try answer, blank = wrong;
 *                difficulty = the question's difficulty now (teacher overrides included), else the one saved with the answer
 *   position   = 0–9 blocks (E1 E2 E3 · M1 M2 M3 · H1 H2 H3), the max of
 *                (a) level: the skill's Levels level (no row → the domain level of the latest Placement; no Placement → none):
 *                    all lower levels full + first-try % at that level with ≥ 5 answers there: < 50 → 1, 50–79 → 2, ≥ 80 → 3
 *                (b) every difficulty with ≥ 5 first-try answers and ≥ 50 %: all lower levels full + 2 (50–79) or 3 (≥ 80)
 *                So a student who took Placement starts from its levels; without Placement everything starts at 0.
 *   gains      = position now − position at the end of the day 7 / 30 days ago (same rules on the answers up to then; the
 *                level then read back from the Levels history, or the Placement finished by then), if > 0
 *   Focus      = % at the difficulty that gave the position (else the hardest one with ≥ 5 answers); skills with < 5 answers
 *                at every difficulty left out; < 80 % there; rank (1 − %) × Skill_Profile weight; top 3
 *   progress   = 4 weeks × Easy / Medium / Hard first-try %, a point only with ≥ 3 answers at that difficulty that week
 *   rushed     = wrong first tries with the R badge (profile FAST_WRONG) ÷ wrong first tries (60 days)
 *   slow       = right first tries with the S badge (SLOW_RIGHT); extra = mean(time to the final answer − normal time), m:ss;
 *                an answer with more than 10 min to the final answer is listed but not in the mean (Minh 18 Nov 21:29)
 *   My mistakes = the teacher's tags in the 60 days ("Not A Mistake" not counted), shown from 3 tags.
 * Only this student's rows go into the payload — no codes, no keys, nothing of anyone else. */
var MS_ = { WINDOW: 60, MIN_N: 5, WEEK_MIN: 3, MIN_TAGS: 3, UPS: 28, TOP: 80, MID: 50, LEFT: 600 };
var MS_LV_ = ['E', 'M', 'H'];

function msDayStr_(ms) { return fmtDate_(new Date(ms), 'yyyy-MM-dd'); }
function msDayAge_(ms, todayStr) {                                   // whole calendar days between that day and today
  var a = new Date(msDayStr_(ms) + 'T12:00:00Z').getTime(), t = new Date(todayStr + 'T12:00:00Z').getTime();
  return Math.max(0, Math.round((t - a) / 86400000));
}
function msMmss_(s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
/** Levels history entries with dates: [{date 'yyyy-MM-dd', from 'E|M|H'|null, to}] in order. "placement … → M" and
 *  "mixed M→H" are first levels (no level before them). */
function msHistory_(hist, todayStr) {
  var mon = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 }, y = Number(todayStr.slice(0, 4)), out = [];
  String(hist || '').split(/\s*·\s*/).forEach(function (h) {
    h = h.trim();
    var m, from = null, to, d, mo;
    if ((m = /^([EMH])→([EMH]) (\d{1,2}) ([A-Z][a-z]{2})$/.exec(h))) { from = m[1]; to = m[2]; d = m[3]; mo = m[4]; }
    else if ((m = /^(?:placement .*→ ?|mixed M→)([EMH]) (\d{1,2}) ([A-Z][a-z]{2})$/.exec(h))) { to = m[1]; d = m[2]; mo = m[3]; }
    else return;
    if (!(mo in mon)) return;
    var ds = function (yy) { return yy + '-' + ('0' + (mon[mo] + 1)).slice(-2) + '-' + ('0' + d).slice(-2); }, date = ds(y);
    if (date > todayStr) date = ds(y - 1);
    out.push({ date: date, from: from, to: to, h: h });
  });
  return out;
}
/** The level on day D (end of that day): the "from" of the first change after D (a Placement / first Mixed entry after D →
 *  no level yet); no change after D → the level now. */
function msLevelAt_(hist, nowLevel, D) {
  for (var i = 0; i < hist.length; i++) if (hist[i].date > D) return hist[i].from || '';
  return nowLevel;
}
/** Position (0–9 blocks) of a skill from its answers in a window and its level ('' = none): the max of (a) the level rule and
 *  (b) every difficulty with ≥ 5 answers and ≥ 50 %. src = the difficulty that gave it. */
function msPos_(xs, level) {
  var by = {}; MS_LV_.forEach(function (d) { var x = xs.filter(function (a) { return a.dif === d; }); by[d] = { n: x.length, pct: x.length ? Math.round(100 * x.filter(function (a) { return a.ok; }).length / x.length) : null }; });
  var best = 0, src = '';
  if (level) {
    var b = by[level], k = b.n >= MS_.MIN_N ? (b.pct >= MS_.TOP ? 3 : b.pct >= MS_.MID ? 2 : 1) : 0;
    best = 3 * MS_LV_.indexOf(level) + k; src = level;
  }
  MS_LV_.forEach(function (d) {
    var b = by[d]; if (b.n < MS_.MIN_N || b.pct < MS_.MID) return;
    var v = 3 * MS_LV_.indexOf(d) + (b.pct >= MS_.TOP ? 3 : 2);
    if (v > best) { best = v; src = d; }
  });
  return { steps: best, src: src, by: by };
}

function mySkills(code) {
  cachedReads_();                                                   // read-only: snapshots, no Sheet (#42)
  var st = requireStudent_(code), codeN = normCode_(st.student_code);
  return mySkillsOf_(codeN);
}
function mySkillsOf_(codeN, asTeacher) {
  var S = getSettings_(), now = Date.now(), today = msDayStr_(now);
  var sets = {}, titles = {};
  readTable_('Sets').rows.forEach(function (s) { if (normCode_(s.student_code) === codeN) sets[String(s.set_id)] = s; });
  var pool = livePool_(), difOf = {}, live = {};
  pool.forEach(function (q) { difOf[String(q.qid)] = String(q.difficulty || '').toUpperCase(); live[clean_(q.subskill)] = (live[clean_(q.subskill)] || 0) + 1; });
  var ans = readTable_('Responses').rows.filter(function (r) { return normCode_(r.student_code) === codeN && toMs_(r.submitted_at); }).map(function (r) {
    var ms = toMs_(r.submitted_at), qid = String(r.qid), d = (difOf[qid] || String(r.difficulty || '')).toUpperCase().charAt(0);
    var t = Number(r.time_try1_sec) || 0, nm = normSec_(r), away = Number(r.away_sec) || 0;
    return { set_id: String(r.set_id), qid: qid, order: Number(r.order) || 0, k: clean_(r.skill), ss: clean_(r.subskill), dif: /^[EMH]$/.test(d) ? d : '',
             ok: Number(r.try1_correct) === 1 ? 1 : 0, p: String(r.profile || ''), m: clean_(r.mistake_type), ms: ms, age: msDayAge_(ms, today),
             t: t, extra: nm !== null && t ? t - nm : null, t_on: Math.max(0, t - away) };
  });
  var A = ans.filter(function (a) { return a.age <= MS_.WINDOW; });
  var item = function (a, extra) {
    var s = sets[a.set_id] || {};
    if (!titles[a.set_id]) titles[a.set_id] = s.set_id ? setTitle_(s) : 'Set';
    var o = { set_id: a.set_id, qid: a.qid, q: a.order, title: titles[a.set_id], date: fmtDate_(new Date(a.ms), 'dd MMM').replace(/^0/, ''),
              skill: skillName_(a.k) || a.k, sub: subskillName_(a.ss) };
    if (extra) o.extra = extra;
    return o;
  };
  var newest = function (a, b) { return b.ms - a.ms; };

  // skills in taxonomy order + their current level
  var skills = [], byK = {}, doms = [], dSeen = {};
  SKILLS_.forEach(function (r) {
    if (!dSeen[r.domain]) { dSeen[r.domain] = 1; doms.push({ d: r.domain, name: r.domain_name }); }
    if (!byK[r.skill]) { byK[r.skill] = { k: r.skill, d: r.domain, name: r.skill_name, xs: [], subs: [], _s: {} }; skills.push(byK[r.skill]); }
    if (r.subskill && !byK[r.skill]._s[r.subskill]) { var so = { ss: r.subskill, name: r.subskill_name, n: 0, r: 0 }; byK[r.skill]._s[r.subskill] = so; byK[r.skill].subs.push(so); }
  });
  A.forEach(function (a) { var o = byK[a.k]; if (!o) return; o.xs.push(a); var s = o._s[a.ss]; if (s) { s.n++; s.r += a.ok; } });
  var lvRow = {}; readTable_('Levels').rows.forEach(function (r) { if (normCode_(r.student_code) === codeN) lvRow[clean_(r.skill)] = r; });
  var plLv = {}, plDay = '';                                         // the latest Placement: domain levels + the day it finished
  try { plLv = plLatestLevels_(codeN) || {}; var ph = plHistory_(codeN); if (ph.length) plDay = toMs_(ph[0].finished_at) ? msDayStr_(toMs_(ph[0].finished_at)) : today; } catch (e) { plLv = {}; }
  var W = { 7: msDayStr_(now - 7 * 86400000), 30: msDayStr_(now - 30 * 86400000) };
  var gains = { 7: { total: 0 }, 30: { total: 0 } };
  skills.forEach(function (o) {
    var row = lvRow[o.k], dom = String(o.k).charAt(0);
    var lvNow = row && /^[EMH]$/.test(String(row.level)) ? String(row.level) : (plLv[dom] || '');
    var hist = msHistory_(row ? row.history : '', today);
    o.level = lvNow;
    o.n = o.xs.length; o.pct = o.n ? Math.round(100 * o.xs.filter(function (a) { return a.ok; }).length / o.n) : null;
    var P = msPos_(o.xs, lvNow); o.steps = P.steps; o.src = P.src;
    o.by = MS_LV_.map(function (d) { return { d: d, n: P.by[d].n, pct: P.by[d].pct }; });
    var fd = o.src && P.by[o.src].n >= MS_.MIN_N ? o.src : '';
    if (!fd) MS_LV_.forEach(function (d) { if (P.by[d].n >= MS_.MIN_N) fd = d; });
    o.fd = fd; o.f_pct = fd ? P.by[fd].pct : null;
    o.gain = {};
    [7, 30].forEach(function (w) {
      var D = W[w];
      var xs = ans.filter(function (a) { return a.k === o.k && msDayStr_(a.ms) <= D && msDayAge_(a.ms, D) <= MS_.WINDOW; });
      var lt = row && /^[EMH]$/.test(String(row.level)) ? msLevelAt_(hist, lvNow, D) : (plDay && plDay <= D ? (plLv[dom] || '') : '');
      var was = msPos_(xs, lt).steps, g = Math.max(0, o.steps - was);
      o.gain[w] = { was: was, g: g }; gains[w].total += g;
    });
    o.subs.forEach(function (s) { s.pct = s.n ? Math.round(100 * s.r / s.n) : null; s.live = live[s.ss] || 0; });
    if (asTeacher) {                                                 // teacher: the sets with answers in this skill / sub-skill
      var seen = {}, ord = ans.filter(function (a) { return a.k === o.k; }).sort(function (a, b) { return a.ms - b.ms; });
      o.sets = []; ord.forEach(function (a) { if (!seen[a.set_id]) { seen[a.set_id] = 1; o.sets.push(item(a)); } });
      o.subs.forEach(function (s) { var sn = {}; s.sets = []; ord.forEach(function (a) { if (a.ss === s.ss && !sn[a.set_id]) { sn[a.set_id] = 1; s.sets.push(item(a)); } }); });
    }
  });

  // Focus now: % at the difficulty that gave the position (≥ 5 answers there, < 80 %), × weight
  var focus = skills.filter(function (o) { return o.fd && o.f_pct < MS_.TOP; }).map(function (o) {
    return { k: o.k, score: (1 - o.f_pct / 100) * skillProfile_(o.k).weight, pct: o.f_pct };
  }).sort(function (a, b) { return b.score - a.score || a.pct - b.pct; }).slice(0, 3).map(function (f) { return f.k; });

  // Why I miss questions (60 days)
  var wrong = A.filter(function (a) { return !a.ok; }), rushed = wrong.filter(function (a) { return a.p === 'FAST_WRONG'; });
  var slow = A.filter(function (a) { return a.ok && a.p === 'SLOW_RIGHT'; }), slowT = slow.filter(function (a) { return a.extra !== null && a.t <= MS_.LEFT; });   // > 10 min on one question (Minh): listed in Review these, not averaged
  var why = {
    wrong: wrong.length, rushed: rushed.length, rushed_pct: wrong.length ? Math.round(100 * rushed.length / wrong.length) : 0,
    slow: slow.length, slow_extra: slowT.length ? msMmss_(slowT.reduce(function (s, a) { return s + a.extra; }, 0) / slowT.length) : '',
    rushed_items: rushed.slice().sort(newest).map(function (a) { return item(a, 'R ' + msMmss_(a.t)); }),
    slow_items: slow.slice().sort(newest).map(function (a) { return item(a, a.extra !== null ? '+' + msMmss_(a.extra) : 'S ' + msMmss_(a.t)); })
  };

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
               items: xs.slice().sort(newest).slice(0, 40).map(function (a) { return item(a); }) };
    }).sort(function (a, b) { return b.n - a.n || order.indexOf(a.t) - order.indexOf(b.t); });
  }

  // My progress: 4 weeks × Easy / Medium / Hard
  var weeks = [3, 2, 1, 0].map(function (w) {
    var xs = ans.filter(function (a) { return a.age >= 7 * w && a.age < 7 * w + 7; }), o = { n: xs.length };
    MS_LV_.forEach(function (d) {
      var x = xs.filter(function (a) { return a.dif === d; });
      o[d] = x.length >= MS_.WEEK_MIN ? Math.round(100 * x.filter(function (a) { return a.ok; }).length / x.length) : null;
      o[d + 'n'] = x.length;
    });
    return o;
  });
  var ups = [], rank = { E: 0, M: 1, H: 2 };
  Object.keys(lvRow).forEach(function (k) {
    msHistory_(lvRow[k].history, today).forEach(function (e) {
      if (!e.from || !(rank[e.to] > rank[e.from])) return;
      var age = Math.round((new Date(today + 'T12:00:00Z') - new Date(e.date + 'T12:00:00Z')) / 86400000);
      if (age <= MS_.UPS) ups.push({ k: k, name: skillName_(k) || k, from: e.from, to: e.to, when: e.h.replace(/^.*\s(\d{1,2} [A-Z][a-z]{2})$/, '$1'), age: age });
    });
  });
  ups.sort(function (a, b) { return a.age - b.age; });

  return {
    ok: true, v: 3, today: today, window: MS_.WINDOW, min_n: MS_.MIN_N, week_min: MS_.WEEK_MIN, n_all: A.length,
    domains: doms,
    skills: skills.map(function (o) {
      var x = { k: o.k, d: o.d, name: o.name, n: o.n, pct: o.pct, level: o.level, steps: o.steps, src: o.src, fd: o.fd, f_pct: o.f_pct,
                by: o.by, gain: o.gain,
                subs: o.subs.map(function (s) { var y = { ss: s.ss, name: s.name, n: s.n, pct: s.pct, live: s.live }; if (asTeacher) y.sets = s.sets; return y; }) };
      if (asTeacher) x.sets = o.sets;
      return x;
    }),
    gains: gains, focus: focus, why: why, mistakes: mist, weeks: weeks, ups: ups, review_open: openReviewRows_(codeN).length
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
