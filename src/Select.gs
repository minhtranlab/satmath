/**
 * SAT Math Lib — choosing the questions of a set + the student's home data (spec v1.1 §4, §5).
 *
 * Self-practice (startPractice → pickForPractice_): the student picks ONE College Board skill k + n ∈ {5, 10, 20}; the app
 * picks the difficulty. State per student × skill = Levels tab (level E/M/H, start M; R = weighted accuracy of the latest
 * first tries; good_streak). Template of difficulty slots per level; up to ceil(missed_share·n) slots re-check the
 * sub-skills the student missed (≤ n/5 per sub-skill, the easiest slots), one probe of a never-tried sub-skill, the rest
 * spread over the sub-skills least practised first. Only live, version-A items of live batches; one item per twin group;
 * items answered in the last block_days days only when the pool is too small. While E + M items of k are fewer than
 * standin_min, Hard items stand in (E = Hard level 1, M = Hard level 2, H = Hard level 3).
 * After a submitted set (afterSubmit_): R updated for every skill touched (practice + assignment, never Review); a
 * practice set moves the level: 2 good sets (≥ good_set_pct) in a row → up, 1 weak set (< weak_set_pct) → down.
 *
 * Review (startReview / reviewAfterSubmit_): an item enters when try 1 was wrong / blank or right but slow; served in
 * mini-sets of ≤ 5 (a live version B of it when one exists, else the A item); leaves after one clean pass (right on try
 * 1, not slow).
 */

/** Seeded shuffle (so a test can repeat a pick). */
function shuffle_(a, seed) {
  var s = (seed || Date.now()) % 2147483646 + 1;
  var rnd = function () { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}
function seedOf_(str) { var h = 7; String(str).split('').forEach(function (c) { h = (h * 31 + c.charCodeAt(0)) % 2147483646; }); return h + 1; }
var DIFF_ORDER_ = { E: 1, M: 2, H: 3 };
var TEMPLATE_5_ = { E: ['E', 'E', 'E', 'M', 'M'], M: ['E', 'M', 'M', 'M', 'H'], H: ['M', 'M', 'H', 'H', 'H'] };
var REVIEW_SET_SIZE = 5;
function clean_(v) { return String(v === undefined || v === null ? '' : v).replace(/^'/, '').trim(); }

/** Kind of every set ({set_id: kind}). */
function setKinds_() {
  var k = {}; readTable_('Sets').rows.forEach(function (s) { k[String(s.set_id)] = String(s.kind || 'practice'); }); return k;
}

/** One student's first tries, oldest first: [{qid, skill, subskill, right, blank, ms, kind, profile, twin}] (every set kind). */
function firstTries_(codeN, kinds) {
  kinds = kinds || setKinds_();
  return readTable_('Responses').rows.filter(function (r) { return normCode_(r.student_code) === codeN; }).map(function (r) {
    return { qid: String(r.qid), skill: clean_(r.skill), subskill: clean_(r.subskill), right: Number(r.try1_correct) === 1,
             blank: String(r.profile) === 'BLANK', ms: toMs_(r.submitted_at), kind: kinds[String(r.set_id)] || 'practice',
             profile: String(r.profile || ''), set_id: String(r.set_id) };
  }).sort(function (a, b) { return a.ms - b.ms; });
}

/** {qid: {last_ms, last_right, n}} of one student (first tries of every set). */
function historyOf_(codeN, tries) {
  var h = {};
  (tries || firstTries_(codeN)).forEach(function (t) {
    var o = h[t.qid] = h[t.qid] || { last_ms: 0, last_right: false, n: 0 };
    o.n++;
    if (t.ms >= o.last_ms) { o.last_ms = t.ms; o.last_right = t.right; }
  });
  return h;
}

/** R = weighted accuracy of the latest `recent_window` first tries in skill k (Review sets excluded). */
function recentR_(tries, skill, S) {
  var use = function (t) { return t.skill === skill && t.kind !== 'review' && t.kind !== 'placement'; };   // placement items set the level, not R
  var xs = tries.filter(use).slice(-S.recent_window).reverse();
  if (!xs.length) return { R: null, n: 0 };
  var num = 0, den = 0;
  xs.forEach(function (t, i) { var w = Math.pow(S.recent_decay, i); den += w; if (t.right) num += w; });
  return { R: num / den, n: tries.filter(use).length };
}

/* ---------------- Levels ---------------- */
function levelRow_(codeN, skill) {
  var rows = readTable_('Levels').rows;
  for (var i = 0; i < rows.length; i++) if (normCode_(rows[i].student_code) === codeN && clean_(rows[i].skill) === skill) return rows[i];
  return null;
}
/** Level state of a student in a skill (Levels row, else the start level). */
function levelState_(codeN, skill, tries, S) {
  var row = levelRow_(codeN, skill);
  if (row && /^[EMH]$/.test(String(row.level))) {
    return { level: String(row.level), R: row.recent_pct === '' ? null : Number(row.recent_pct), good_streak: Number(row.good_streak) || 0, row: row };
  }
  return { level: initialLevel_(tries, skill, S, codeN), R: recentR_(tries, skill, S).R, good_streak: 0, row: null };
}
/** A skill with no Levels row: the domain level of the latest placement test; else ≥ 5 first tries from assignments → R
 *  decides; else E. */
function initialLevel_(tries, skill, S, codeN) {
  if (codeN) { var pl = plLatestLevels_(codeN)[String(skill).charAt(0)]; if (pl) return pl; }
  var r = recentR_(tries, skill, S);
  if (r.n >= 5) return r.R >= S.good_set_pct ? 'H' : r.R < S.weak_set_pct ? 'E' : 'M';
  return 'E';                                        // Minh 13 Nov: a new student starts Easy (3 E + 2 M), going up as usual
}
function up_(l) { return l === 'E' ? 'M' : 'H'; }
function down_(l) { return l === 'H' ? 'M' : 'E'; }

/** After a submitted set: R for every skill touched; a practice set also moves the level of its skill. */
function afterSubmit_(s, rows) {
  var kind = String(s.kind || 'practice');
  if (kind === 'review') return '';
  var codeN = normCode_(s.student_code), S = getSettings_(), tries = firstTries_(codeN);
  var touched = {};
  rows.forEach(function (r) { var k = clean_(r.skill); if (k) touched[k] = 1; });
  var notes = [];
  Object.keys(touched).forEach(function (k) {
    var st = levelState_(codeN, k, tries, S), rr = recentR_(tries, k, S);
    if (!st.row && kind !== 'practice' && kind !== 'mixed') return; // assignment only: the level starts when the skill is first practised (initialLevel_)
    var lvl = st.row ? st.level : (String(s.level_at_start || '') || st.level), streak = st.good_streak, hist = st.row ? String(st.row.history || '') : '';
    if (kind === 'practice' && clean_(s.skill) === k) {
      var mine = rows.filter(function (r) { return clean_(r.skill) === k; });
      var ft = mine.filter(function (r) { return Number(r.try1_correct) === 1; }).length / Math.max(1, mine.length);
      var before = lvl;
      if (ft >= S.good_set_pct) streak++; else streak = 0;
      if (streak >= 2 && lvl !== 'H') { lvl = up_(lvl); streak = 0; }
      else if (ft < S.weak_set_pct && lvl !== 'E') { lvl = down_(lvl); streak = 0; }
      if (lvl !== before) { hist = (hist ? hist + ' · ' : '') + before + '→' + lvl + ' ' + fmtDate_(new Date(), 'd MMM'); notes.push(k + ' ' + before + '→' + lvl); }
    }
    if (kind === 'mixed') {
      // Mixed Practice: a skill seen for the first time works like a mini placement — start Medium, one step up after each
      // right first try, one step down after each wrong one. A skill with a level: its items count as a small set (same rule).
      var its = rows.filter(function (r) { return clean_(r.skill) === k; }), b0 = lvl;
      if (!st.row) {
        lvl = 'M';
        its.forEach(function (r) { lvl = Number(r.try1_correct) === 1 ? up_(lvl) : down_(lvl); });
        streak = 0;
      } else {
        var ft2 = its.filter(function (r) { return Number(r.try1_correct) === 1; }).length / Math.max(1, its.length);
        if (ft2 >= S.good_set_pct) streak++; else streak = 0;
        if (streak >= 2 && lvl !== 'H') { lvl = up_(lvl); streak = 0; }
        else if (ft2 < S.weak_set_pct && lvl !== 'E') { lvl = down_(lvl); streak = 0; }
      }
      if (lvl !== b0 || !st.row) { hist = (hist ? hist + ' · ' : '') + (st.row ? b0 : 'mixed M') + '→' + lvl + ' ' + fmtDate_(new Date(), 'd MMM'); notes.push(k + ' →' + lvl); }
    }
    var f = { student_code: codeN, skill: txt_(k), level: lvl, recent_pct: rr.R === null ? '' : round_(rr.R, 3), good_streak: streak,
              n_items: rr.n, last_set_id: String(s.set_id), updated_at: nowIso_(), history: hist };
    if (st.row) updateRow_('Levels', st.row._row, f); else appendObjects_('Levels', [f]);
  });
  return notes.join(', ');
}

/* ---------------- practice selection (§4.2) ---------------- */
function template_(level, n) {
  var t = TEMPLATE_5_[level] || TEMPLATE_5_.M, rep = Math.max(1, Math.round(n / 5)), out = [];
  t.forEach(function (d) { for (var i = 0; i < rep; i++) out.push(d); });
  return out.slice(0, n);
}
/** E/M/H slot → what to pick: real buckets, or Hard stand-ins while E + M items of the skill are thin. */
function bucketMap_(pool, S) {
  var em = pool.filter(function (r) { var d = String(r.difficulty).toUpperCase(); return d === 'E' || d === 'M'; }).length;
  if (em < S.standin_min) return { E: { diff: 'H', levels: [1, 2, 3] }, M: { diff: 'H', levels: [2, 1, 3] }, H: { diff: 'H', levels: [3, 2, 1] }, standin: true };
  return { E: { diff: 'E', levels: [] }, M: { diff: 'M', levels: [] }, H: { diff: 'H', levels: [] }, standin: false };
}
var NEIGHBOUR_ = { E: ['M'], M: ['E', 'H'], H: ['M'] };

/**
 * Picks the questions of a practice set. Returns {qids, level, slots, n, standin}.
 * setSeed makes the random parts repeatable (tests); in the app it is the set id.
 */
function pickForPractice_(codeN, skill, n, setSeed) {
  var S = getSettings_(), now = Date.now(), tries = firstTries_(codeN), hist = historyOf_(codeN, tries);
  var st = levelState_(codeN, skill, tries, S), prof = skillProfile_(skill);
  var slots = template_(prof.max_set ? 'M' : st.level, n);         // rare skills (max_set): a mix of all difficulties
  var all = livePool_().filter(function (r) { return clean_(r.skill) === skill && profServes_(skill, r.difficulty); }); // Skill_Profile
  var pool = all.filter(function (r) { var h = hist[String(r.qid)]; return !h || now - h.last_ms >= S.block_days * 86400000; });
  if (pool.length < n) pool = all;                                  // block dropped only if the pool is too small
  // Skill_Profile: level E in a skill with no Easy → Medium level 1 only; level H with no Hard → Medium level 2–3 + Hard only
  // (also for re-checks and probes of sub-skills); widened only when too few such items exist.
  var fit = null;
  if (st.level === 'E' && !prof.allowed.E && prof.allowed.M) fit = function (r) { return String(r.difficulty).toUpperCase() === 'M' && (Number(r.level) || 1) === 1; };
  if (st.level === 'H' && !prof.allowed.H && prof.allowed.M) fit = function (r) { var d = String(r.difficulty).toUpperCase(); return d === 'H' || (d === 'M' && (Number(r.level) || 1) >= 2); };
  if (fit) { var fp = pool.filter(fit), fa = all.filter(fit); if (fp.length >= n) pool = fp; else if (fa.length >= n) pool = fa; }
  var map = bucketMap_(all, S);
  if (!map.standin) {
    ['E', 'M', 'H'].forEach(function (d) { var ps = profSlot_(skill, d); if (ps) map[d] = ps; });  // no Easy → Medium level 1 …
    // level E in a skill with no Easy: the Medium slots too take the lowest CB level first; level H with no Hard: the hardest Medium
    if (st.level === 'E' && !prof.allowed.E && prof.allowed.M) map.M = { diff: 'M', levels: [1, 2, 3] };
    if (st.level === 'H' && !prof.allowed.H && prof.allowed.M) map.M = { diff: 'M', levels: [3, 2, 1] };
  }
  var strong = st.level === 'H' && st.R !== null && st.R >= S.strong_r;
  var seed = seedOf_(setSeed || (codeN + skill + now));
  var rnd = {}; shuffle_(pool.slice(), seed).forEach(function (r, i) { rnd[String(r.qid)] = i; });

  // sub-skills of k (taxonomy order) + this student's first tries in each
  var subs = SKILLS_.filter(function (x) { return x.skill === skill && x.subskill; }).map(function (x) { return x.subskill; });
  var bySub = {};
  subs.forEach(function (c) { bySub[c] = []; });
  tries.forEach(function (t) { if (t.skill === skill && bySub[t.subskill]) bySub[t.subskill].push(t); });
  var hasItems = {}; pool.forEach(function (r) { hasItems[clean_(r.subskill)] = 1; });
  var missed = subs.filter(function (c) {
    var xs = bySub[c]; if (!xs.length || !hasItems[c]) return false;
    var last5 = xs.slice(-5), wrong5 = last5.filter(function (t) { return !t.right; }).length;
    return !xs[xs.length - 1].right || wrong5 >= 2;
  }).sort(function (a, b) {
    var la = bySub[a].filter(function (t) { return !t.right; }).pop(), lb = bySub[b].filter(function (t) { return !t.right; }).pop();
    return (lb ? lb.ms : 0) - (la ? la.ms : 0);
  });
  var untried = subs.filter(function (c) { return !bySub[c].length && hasItems[c]; });
  var missedTwins = {};                                              // twin groups of the items missed in each sub-skill
  var rowOf = {}; all.forEach(function (r) { rowOf[String(r.qid)] = r; });
  tries.forEach(function (t) { var r = rowOf[t.qid]; if (r && !t.right && r.twin_group) (missedTwins[t.subskill] = missedTwins[t.subskill] || {})[String(r.twin_group)] = 1; });

  var chosen = slots.map(function () { return null; }), used = {}, twins = {}, perSub = {}, why = slots.map(function () { return ''; });
  function free(i) { return chosen[i] === null; }
  function cls(r, pref, sub) {
    var h = hist[String(r.qid)];
    switch (pref) {
      case 'twin': return !h && r.twin_group && missedTwins[sub] && missedTwins[sub][String(r.twin_group)];
      case 'unseen': return !h;
      case 'wrong_old': return h && !h.last_right && now - h.last_ms >= S.retry_wait_days * 86400000;
      case 'seen_right': return h && h.last_right;
      default: return true;
    }
  }
  function rank(r, prefs, sub, want) {
    var p = prefs.length; for (var i = 0; i < prefs.length; i++) if (cls(r, prefs[i], sub)) { p = i; break; }
    var lvl0 = want.alsoH && String(r.difficulty).toUpperCase() === 'H' ? 2 : Number(r.level) || 1;   // a real Hard item ranks like Medium level 2
    var lv = want.levels.length ? want.levels.indexOf(lvl0) : 0; if (lv < 0) lv = want.levels.length;
    var h = hist[String(r.qid)];
    return [p, lv, h ? h.last_ms : 0, rnd[String(r.qid)] || 0];
  }
  function cmp(a, b) { for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; }
  function best(cands, prefs, sub, want, strict) {
    var ok = cands.filter(function (r) {
      if (used[String(r.qid)]) return false;
      var tw = String(r.twin_group || ''); if (tw && twins[tw]) return false;
      return !strict || prefs.some(function (p) { return cls(r, p, sub); });
    });
    if (!ok.length) return null;
    ok.sort(function (a, b) { return cmp(rank(a, prefs, sub, want), rank(b, prefs, sub, want)); });
    return ok[0];
  }
  function inDiff(r, want) { var d = String(r.difficulty).toUpperCase(); return d === want.diff || (!!want.alsoH && d === 'H'); }
  function wantFor(slotDiff) {
    var w = map[slotDiff], lv = w.levels.slice();
    if (slotDiff === 'H' && strong) lv = [3, 2, 1];
    return { diff: w.diff, levels: lv, alsoH: !!w.alsoH };
  }
  /** pick(pool, sub, slot, map, prefer) with fallbacks: neighbour difficulty → any sub-skill → any item of k. */
  function pick(sub, slotDiff, prefs) {
    var want = wantFor(slotDiff), inSub = pool.filter(function (r) { return clean_(r.subskill) === sub; });
    var r = best(inSub.filter(function (x) { return inDiff(x, want); }), prefs, sub, want, true);
    if (r) return r;
    var nb = NEIGHBOUR_[slotDiff] || [];
    for (var i = 0; i < nb.length && !r; i++) { var w2 = wantFor(nb[i]); r = best(inSub.filter(function (x) { return inDiff(x, w2); }), prefs, sub, w2, true); }
    if (r) return r;
    r = best(pool.filter(function (x) { return inDiff(x, want); }), ['unseen', 'wrong_old', 'seen_right'], '', want, false);
    if (r) return r;
    return best(pool, ['unseen', 'wrong_old', 'seen_right'], '', want, false);
  }
  function take(r, i, reason) {
    if (!r) return false;
    chosen[i] = r; used[String(r.qid)] = 1; why[i] = reason;
    if (r.twin_group) twins[String(r.twin_group)] = 1;
    var sb = clean_(r.subskill); perSub[sb] = (perSub[sb] || 0) + 1;
    return true;
  }
  var lvlRank = DIFF_ORDER_[st.level];

  // 1) re-check missed sub-skills: ≤ ceil(missed_share·n) slots, ≤ n/5 per sub-skill, the easiest free slots ≤ level
  var maxRe = Math.ceil(S.missed_share * n), perMissed = Math.max(1, Math.floor(n / 5)), nRe = 0, progress = true;
  while (missed.length && nRe < maxRe && progress) {
    progress = false;
    for (var m = 0; m < missed.length && nRe < maxRe; m++) {
      var sub = missed[m];
      if ((perSub[sub] || 0) >= perMissed) continue;
      var si = -1;
      for (var i = 0; i < slots.length; i++) if (free(i) && DIFF_ORDER_[slots[i]] <= lvlRank && (si < 0 || DIFF_ORDER_[slots[i]] < DIFF_ORDER_[slots[si]])) si = i;
      if (si < 0) break;
      var want = wantFor(slots[si]);
      var inSub = pool.filter(function (r) { return clean_(r.subskill) === sub; });
      var r = best(inSub.filter(function (x) { return inDiff(x, want); }), ['twin', 'unseen', 'wrong_old'], sub, want, true);
      var nb = NEIGHBOUR_[slots[si]] || [];
      for (var k = 0; k < nb.length && !r; k++) { var w2 = wantFor(nb[k]); r = best(inSub.filter(function (x) { return inDiff(x, w2); }), ['twin', 'unseen', 'wrong_old'], sub, w2, true); }
      if (take(r, si, 'recheck ' + sub)) { nRe++; progress = true; }
    }
  }
  // 2) one probe of a never-tried sub-skill
  for (var p = 0; p < S.probes_per_set && untried.length; p++) {
    var order = ['M', 'E', 'H'], pi = -1;
    for (var o = 0; o < order.length && pi < 0; o++) for (var j = 0; j < slots.length; j++) if (free(j) && slots[j] === order[o]) { pi = j; break; }
    if (pi < 0) break;
    var probeSub = untried.shift(), want2 = wantFor(slots[pi]);
    var inProbe = pool.filter(function (x) { return clean_(x.subskill) === probeSub; });
    var pr = best(inProbe.filter(function (x) { return inDiff(x, want2); }), ['unseen'], probeSub, want2, true);
    var nbp = NEIGHBOUR_[slots[pi]] || [];
    for (var z = 0; z < nbp.length && !pr; z++) { var w3 = wantFor(nbp[z]); pr = best(inProbe.filter(function (x) { return inDiff(x, w3); }), ['unseen'], probeSub, w3, true); }
    take(pr, pi, 'probe ' + probeSub);
  }
  // 3) fill the rest, spread over sub-skills (least practised first, round-robin)
  var answered = {}; subs.forEach(function (c) { answered[c] = { n: bySub[c].length, last: bySub[c].length ? bySub[c][bySub[c].length - 1].ms : 0 }; });
  for (var f = 0; f < slots.length; f++) {
    if (!free(f)) continue;
    var cand = subs.filter(function (c) { return hasItems[c]; }).sort(function (a, b) {
      return ((answered[a].n + (perSub[a] || 0)) - (answered[b].n + (perSub[b] || 0))) || (answered[a].last - answered[b].last) || (subs.indexOf(a) - subs.indexOf(b));
    });
    var got = null;
    for (var c = 0; c < cand.length && !got; c++) {
      var wf = wantFor(slots[f]);
      got = best(pool.filter(function (x) { return clean_(x.subskill) === cand[c] && inDiff(x, wf); }), ['unseen', 'seen_right'], cand[c], wf, true);
    }
    if (!got) got = pick(cand[0] || '', slots[f], ['unseen', 'seen_right']);
    take(got, f, 'fill');
  }
  var picked = [];
  chosen.forEach(function (r, i) { if (r) picked.push({ r: r, slot: slots[i], why: why[i] }); });
  picked.sort(function (a, b) {
    return (DIFF_ORDER_[String(a.r.difficulty).toUpperCase()] || 3) - (DIFF_ORDER_[String(b.r.difficulty).toUpperCase()] || 3) ||
           (Number(a.r.level) || 0) - (Number(b.r.level) || 0) || (rnd[String(a.r.qid)] || 0) - (rnd[String(b.r.qid)] || 0);
  });
  return { qids: picked.map(function (x) { return String(x.r.qid); }), level: st.level,
           slots: picked.map(function (x) { return x.slot; }).join(','), why: picked.map(function (x) { return x.why; }), standin: map.standin };
}

/* ---------------- Mixed Practice (Minh 13 Nov): one set, several skills ----------------
 * Skill order: 1) skills with unfixed wrong answers or a mistake the teacher tagged, 2) the lowest-level skills, 3) untried
 * skills; at most 2 items per skill per 5 questions (spread over several skills). Each item at the student's level for that
 * skill (1st item = the level, 2nd = the 4th slot of its template). A student with no first tries at all: a mini placement —
 * every item Medium, spread over the 4 domains; afterSubmit_ then moves each skill up after a right / down after a wrong. */
function pickMixed_(codeN, n, setSeed) {
  var S = getSettings_(), tries = firstTries_(codeN), hist = historyOf_(codeN, tries), now = Date.now();
  var seed = seedOf_(setSeed || (codeN + now)), pool = livePool_();
  var bySkill = {}; pool.forEach(function (r) { (bySkill[clean_(r.skill)] = bySkill[clean_(r.skill)] || []).push(r); });
  var skills = []; SKILLS_.forEach(function (r) { if (skills.indexOf(r.skill) < 0 && bySkill[r.skill]) skills.push(r.skill); });
  var domainOf = {}; SKILLS_.forEach(function (r) { domainOf[r.skill] = r.domain; });
  var blank = !tries.length, perSkill = Math.max(1, Math.floor(2 * n / 5)), order = [], plan = [];
  var weights = mixedWeights_(skills);
  var lvCache = {}, levelOf = function (k) { return lvCache[k] || (lvCache[k] = levelState_(codeN, k, tries, S).level); };
  var lvRows = {}; readTable_('Levels').rows.forEach(function (r) { if (normCode_(r.student_code) === codeN && /^[EMH]$/.test(String(r.level))) lvRows[clean_(r.skill)] = String(r.level); });
  skills.forEach(function (k) { lvCache[k] = lvRows[k] || initialLevel_(tries, k, S, codeN); });   // one Sheet read, not one per skill
  if (blank) {
    // mini placement: round-robin over the 4 domains, a random skill of each, Medium
    var doms = {}; skills.forEach(function (k) { (doms[domainOf[k]] = doms[domainOf[k]] || []).push(k); });
    var wkey = {}, s0 = seed; skills.forEach(function (k) { s0 = (s0 * 16807) % 2147483647; wkey[k] = Math.pow(s0 / 2147483647, 1 / Math.max(1e-6, weights[k])); });
    Object.keys(doms).forEach(function (d) { doms[d].sort(function (a, b) { return wkey[b] - wkey[a]; }); });   // weighted shuffle (rare skills last)
    var dk = shuffle_(Object.keys(doms), seed + 1), i = 0;
    while (order.length < skills.length) { var d = dk[i % dk.length], l = doms[d]; if (l.length) order.push(l.shift()); i++; if (i > 400) break; }
  } else {
    var kinds = setKinds_();
    var resp = readTable_('Responses').rows.filter(function (r) { return normCode_(r.student_code) === codeN && kinds[String(r.set_id)] !== 'placement'; });
    var hurt = {};
    resp.forEach(function (r) {
      var k = clean_(r.skill); if (!k) return;
      var t = clean_(r.mistake_type), unfixed = Number(r.try1_correct) !== 1 && Number(r.best_correct) !== 1;
      if (unfixed || (t && t !== 'Not A Mistake')) hurt[k] = Math.max(hurt[k] || 0, toMs_(r.submitted_at));
    });
    // 1) skills with unfixed wrong answers / tagged mistakes (newest first, one item each, at most half the set);
    // 2) the rest by weight (Skill_Profile, mixedPlan_): area by area like the real test, skills by weight → long-run share = weight;
    //    ties: the lower level first, then random.
    var rr = {}; shuffle_(skills.slice(), seed).forEach(function (k, i) { rr[k] = i; });
    var first = skills.filter(function (k) { return hurt[k]; }).sort(function (a, b) { return hurt[b] - hurt[a] || rr[a] - rr[b]; }).slice(0, Math.ceil(n / 2));
    var tie = {}; skills.forEach(function (k) { tie[k] = (DIFF_ORDER_[levelOf(k)] || 2) * 1000 + rr[k]; });
    plan = mixedPlan_(skills.filter(function (k) { return (bySkill[k] || []).length; }), weights, mixedPast_(codeN), n, perSkill, first, tie);
  }
  if (blank) {
    var nSkills = Math.min(order.length, Math.max(Math.ceil(n / perSkill), Math.min(order.length, n))), chosenSkills = order.slice(0, nSkills);
    for (var rd = 0; plan.length < n && rd < perSkill; rd++) for (var c0 = 0; c0 < chosenSkills.length && plan.length < n; c0++) plan.push(chosenSkills[c0]);
  }
  // the items: the student's level for the skill (2nd item of a skill = the 4th slot of its template), after the profile
  var count = {}, picked = [], used = {}, twins = {}, slots = [];
  plan.forEach(function (k, pi) {
    var lvl = blank ? 'M' : levelOf(k), want = !count[k] ? lvl : (TEMPLATE_5_[lvl] || TEMPLATE_5_.M)[3];
    var ps = profSlot_(k, want), wd = ps ? ps.diff : want, wl = ps ? ps.levels : [];
    var cands = (bySkill[k] || []).filter(function (r) {
      var id = String(r.qid), tw = String(r.twin_group || ''), h = hist[id], d = String(r.difficulty).toUpperCase();
      if (!profServes_(k, d) || (d === 'H' && !skillProfile_(k).allowed.H && !(ps && ps.alsoH))) return false;
      return !used[id] && !(tw && twins[tw]) && (!h || now - h.last_ms >= S.block_days * 86400000);
    });
    var rnd = {}; shuffle_(cands.slice(), seed + pi).forEach(function (r, i) { rnd[String(r.qid)] = i; });
    var score = function (r) {
      var d = String(r.difficulty).toUpperCase(), h = hist[String(r.qid)], hit = d === wd || (ps && ps.alsoH && d === 'H');
      var lv = !wl.length ? 0 : wl.indexOf(ps && ps.alsoH && d === 'H' ? 2 : Number(r.level) || 1); if (lv < 0) lv = wl.length;
      return [hit ? 0 : Math.abs((DIFF_ORDER_[d] || 2) - DIFF_ORDER_[wd]) === 1 ? 1 : 2, lv, h ? 1 : 0, rnd[String(r.qid)]];
    };
    cands.sort(function (a, b) { var x = score(a), y = score(b); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2] || x[3] - y[3]; });
    var r0 = cands[0]; if (!r0) return;
    used[String(r0.qid)] = 1; if (r0.twin_group) twins[String(r0.twin_group)] = 1;
    count[k] = (count[k] || 0) + 1; picked.push(r0); slots.push(want);
  });
  // easier → harder, like every set
  var idx = picked.map(function (r, i) { return i; }).sort(function (a, b) {
    return (DIFF_ORDER_[String(picked[a].difficulty).toUpperCase()] || 3) - (DIFF_ORDER_[String(picked[b].difficulty).toUpperCase()] || 3) || a - b;
  });
  return { qids: idx.map(function (i) { return String(picked[i].qid); }), slots: idx.map(function (i) { return slots[i]; }).join(','),
           skills: Object.keys(count), blank: blank };
}
/** Mixed items this student already had, per skill (all Mixed sets). */
function mixedPast_(codeN) {
  var sk = {}; questionRows_().forEach(function (r) { sk[String(r.qid)] = clean_(r.skill); });
  var out = {};
  readTable_('Sets').rows.forEach(function (s) {
    if (normCode_(s.student_code) !== codeN || String(s.kind) !== 'mixed') return;
    setQids_(s).forEach(function (q) { var k = sk[q]; if (k) out[k] = (out[k] || 0) + 1; });
  });
  return out;
}
var MIXED_TITLE = 'Mixed Practice';
function startMixed(code, n) {
  var st = requireStudent_(code), codeN = normCode_(st.student_code), S = getSettings_();
  var sizes = String(S.set_sizes).split(/[,\s]+/).map(Number).filter(Boolean);
  n = Number(n);
  if (sizes.indexOf(n) < 0) throw new Error('FORM: Choose ' + sizes.join(', ') + ' questions.');
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var open = readTable_('Sets').rows.filter(function (r) { return normCode_(r.student_code) === codeN && isOpenStatus_(r.status) && String(r.kind) === 'mixed'; });
    if (open.length) return { ok: true, set_id: String(open[open.length - 1].set_id), resumed: true };
    var setId = newSetId_(codeN), pick = pickMixed_(codeN, n, setId);
    if (!pick.qids.length) throw new Error('FORM: There are no questions yet.');
    appendObjects_('Sets', [{ set_id: setId, student_code: codeN, kind: 'mixed', skill: '', n: pick.qids.length, qids: pick.qids.join(','),
                              level_at_start: pick.blank ? 'placement' : '', slots: pick.slots, created_at: nowIso_(), status: 'in_progress', events_saved: 0, last_saved_at: nowIso_() }]);
    return { ok: true, set_id: setId, n: pick.qids.length, skills: pick.skills.length };
  } finally { lock.releaseLock(); }
}

/* ---------------- Review area (§5) ---------------- */
function reviewRows_(codeN) { return readTable_('Review').rows.filter(function (r) { return normCode_(r.student_code) === codeN; }); }
function openReviewRows_(codeN) { return reviewRows_(codeN).filter(function (r) { return String(r.status || 'open') === 'open'; }); }

/** After any submitted set: new Review items (try 1 wrong / blank, or right but slow); a Review set clears its clean items. */
function reviewAfterSubmit_(s, rows) {
  var codeN = normCode_(s.student_code), kind = String(s.kind || 'practice'), open = {}, now = nowIso_(), add = [];
  openReviewRows_(codeN).forEach(function (r) { open[String(r.qid)] = r; });
  var aOf = {};                                                    // review set: served qid → the A item of the Review row
  if (kind === 'review') { var a = String(s.slots || '').split(','), q = setQids_(s); q.forEach(function (x, i) { aOf[x] = a[i] || x; }); }
  var cleared = 0, still = 0;
  rows.forEach(function (r) {
    var qid = aOf[String(r.qid)] || String(r.qid), p = String(r.profile), right1 = Number(r.try1_correct) === 1;
    var reason = p === 'BLANK' ? 'blank' : !right1 ? 'wrong' : p === 'SLOW_RIGHT' ? 'slow' : '';
    if (kind === 'review' && open[qid]) {
      var o = open[qid], f = { n_served: (Number(o.n_served) || 0) + 1 };
      if (right1 && p !== 'SLOW_RIGHT') { f.status = 'cleared'; f.cleared_at = now; f.cleared_by = 'pass'; cleared++; } else still++;
      updateRow_('Review', o._row, f);
      return;
    }
    if (reason && !open[qid]) { add.push({ student_code: codeN, qid: qid, reason: reason, from_set: String(s.set_id), added_at: now, status: 'open', n_served: 0 }); open[qid] = 1; }
  });
  appendObjects_('Review', add);
  return { added: add.length, cleared: cleared, still: still };
}

/** The item served for a Review row: a live version B of it when one exists, else the A item itself. */
function reviewServe_(aQid, pool) {
  var live = batchLive_();
  var b = questionRows_().filter(function (r) {
    return String(r.version).toUpperCase() === 'B' && clean_(r.version_of) === aQid && String(r.status || '').toLowerCase() === 'live' && live[String(r.batch)];
  });
  return b.length ? String(b[0].qid) : aQid;
}

/** Start (or resume) a Review mini-set of ≤ 5 open items, picked at random. */
function startReview(code) {
  var st = requireStudent_(code), codeN = normCode_(st.student_code);
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var open = readTable_('Sets').rows.filter(function (r) { return normCode_(r.student_code) === codeN && isOpenStatus_(r.status) && String(r.kind) === 'review'; });
    if (open.length) return { ok: true, set_id: String(open[open.length - 1].set_id), resumed: true };
    var items = openReviewRows_(codeN).map(function (r) { return String(r.qid); });
    var known = {}; questionRows_().forEach(function (r) { known[String(r.qid)] = 1; });
    items = items.filter(function (q) { return known[q]; });
    if (!items.length) throw new Error('FORM: Nothing to review right now.');
    var setId = newSetId_(codeN);
    var a = shuffle_(items, seedOf_(setId)).slice(0, REVIEW_SET_SIZE);
    var served = a.map(function (q) { return reviewServe_(q); });
    appendObjects_('Sets', [{ set_id: setId, student_code: codeN, kind: 'review', skill: '', n: served.length, qids: served.join(','),
                              slots: a.join(','), created_at: nowIso_(), status: 'in_progress', events_saved: 0, last_saved_at: nowIso_() }]);
    return { ok: true, set_id: setId, n: served.length };
  } finally { lock.releaseLock(); }
}

/* ============================== home ============================== */

/** Everything the home needs in one call: assignments (B6), open sets, skills (with "n new" + progress dot), Review, history. */
function homeData(code) {
  var st = requireStudent_(code), codeN = normCode_(st.student_code), S = getSettings_();
  var pool = livePool_(), tries = firstTries_(codeN), hist = historyOf_(codeN, tries);
  var acc = {};
  tries.forEach(function (t) {
    [t.skill, 's:' + t.subskill].forEach(function (k) { var o = acc[k] = acc[k] || { n: 0, r: 0 }; o.n++; if (t.right) o.r++; });
  });
  var dot = function (k) {
    var o = acc[k]; if (!o || o.n < S.progress_dot_min) return 'n';
    var p = o.r / o.n; return p >= S.dot_green ? 'g' : p >= S.dot_amber ? 'y' : 'r';
  };
  var count = {};
  pool.forEach(function (r) {
    [clean_(r.skill), 's:' + clean_(r.subskill)].forEach(function (k) { var c = count[k] = count[k] || { live: 0, fresh: 0 }; c.live++; if (!hist[String(r.qid)]) c.fresh++; });
  });
  var domains = [], dIdx = {};
  SKILLS_.forEach(function (r) {
    if (!dIdx[r.domain]) { dIdx[r.domain] = { domain: r.domain, name: r.domain_name, fresh: 0, skills: [], _s: {} }; domains.push(dIdx[r.domain]); }
    var d = dIdx[r.domain];
    if (!d._s[r.skill]) {
      var c = count[r.skill] || { live: 0, fresh: 0 };
      var pf = skillProfile_(r.skill);
      d._s[r.skill] = { skill: r.skill, name: r.skill_name, live: c.live, fresh: c.fresh, dot: dot(r.skill), subs: [], max_n: pf.max_set || 0, note: pf.max_set ? 'Rare on the test: sets of ' + pf.max_set : '' };
      d.skills.push(d._s[r.skill]); d.fresh += c.fresh;
    }
    if (r.subskill) {
      var cs = count['s:' + r.subskill] || { live: 0, fresh: 0 };
      d._s[r.skill].subs.push({ code: r.subskill, name: r.subskill_name, fresh: cs.fresh, dot: dot('s:' + r.subskill) });
    }
  });
  domains.forEach(function (d) { delete d._s; });
  var sets = readTable_('Sets').rows.filter(function (s) { return normCode_(s.student_code) === codeN && !isHidden_(s); });
  var plSet = {}; sets.forEach(function (s) { if (String(s.kind) === 'placement') plSet[String(s.set_id)] = 1; });
  var open = sets.filter(function (s) { return isOpenStatus_(s.status) && String(s.kind) !== 'assignment' && String(s.kind) !== 'placement'; }).map(function (s) {
    var stt = parseState_(s) || {}, ps = (stt.parts || {})[SET_PART] || {}, nAns = Object.keys(ps.ans || {}).length;
    return { set_id: String(s.set_id), kind: String(s.kind || 'practice'), title: setTitle_(s), n: Number(s.n) || 0, answered: nAns, started: dateStr_(s.created_at) };
  });
  var fixLeft = {};
  readTable_('Responses').rows.forEach(function (r) {
    if (normCode_(r.student_code) !== codeN || plSet[String(r.set_id)]) return;
    if (Number(r.best_correct) !== 1 && !isYes_(r.locked)) fixLeft[String(r.set_id)] = (fixLeft[String(r.set_id)] || 0) + 1;
  });
  var history = sets.filter(isFinished_).sort(function (a, b) { return toMs_(b.submitted_at) - toMs_(a.submitted_at); }).slice(0, 50).map(function (s) {
    return { set_id: String(s.set_id), kind: String(s.kind || 'practice'), title: setTitle_(s), date: dateStr_(s.submitted_at), n: Number(s.n) || 0,
             first_try: Number(s.first_try) || 0, best: s.best_score === '' ? Number(s.first_try) || 0 : Number(s.best_score),
             fix_left: fixLeft[String(s.set_id)] || 0 };
  });
  var sizes = String(S.set_sizes).split(/[,\s]+/).map(Number).filter(Boolean);
  var nReview = openReviewRows_(codeN).length;
  return { ok: true, first_name: String(st.name || '').replace(/\(.*?\)/g, '').trim().split(/\s+/)[0] || '', domains: domains,
           assignments: assignmentsFor_(codeN, sets), open: open, history: history, sizes: sizes,
           review: { open: nReview, next: Math.min(REVIEW_SET_SIZE, nReview) } };
}
