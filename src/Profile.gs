/**
 * SAT Math Lib — Skill profiles (Minh 14 Nov 2026, ticket #35): per College Board skill, which difficulties exist on the real
 * SAT, how often the skill comes up (weight, % of Mixed Practice items) and a smaller set size for rare skills.
 * Sheet tab Skill_Profile (one row per skill; Minh edits it): skill · name · allowed (E,M,H) · weight · max_set · note.
 *   - allowed without E (Circles, Right triangles & trig): an Easy slot gets Medium items of the lowest CB level (level 1);
 *     Easy items of the skill are never served.
 *   - allowed without H (Probability, Two-variable data): a Hard slot gets the hardest Medium items (level 2–3) or one of the
 *     few real Hard items; no Hard slot is required.
 *   - weight: Mixed Practice shares its items over the skills in proportion to the weights (Sainte-Laguë over the student's
 *     past Mixed items, so the long-run share follows the weight); skills with unfixed wrong answers still come first.
 *   - max_set: practice by skill offers only this many questions (Q.F, Q.G: 5) and mixes all difficulties.
 * Review and the Placement test do not use the profile.
 */
var SKILL_PROFILE_TAB = 'Skill_Profile';
// weight = real-test share: Algebra 35 %, Advanced Math 35 %, PSDA 15 %, Geometry 15 %, split over the skills by the size of the
// College Board bank (1,921 items); Q.F and Q.G fixed at 2.5 % each (about 1 in 20 Mixed items together).
var SKILL_PROFILE_DEFAULTS_ = [
  ['H.A', 'E,M,H', 6.3, '', ''], ['H.B', 'E,M,H', 9.7, '', ''], ['H.C', 'E,M,H', 7.4, '', ''], ['H.D', 'E,M,H', 7.2, '', ''], ['H.E', 'E,M,H', 4.4, '', ''],
  ['P.A', 'E,M,H', 7.6, '', ''], ['P.B', 'E,M,H', 10.7, '', ''], ['P.C', 'E,M,H', 16.7, '', ''],
  ['Q.A', 'E,M,H', 2.4, '', ''], ['Q.B', 'E,M,H', 2.2, '', ''], ['Q.C', 'E,M,H', 2.2, '', ''],
  ['Q.D', 'E,M', 1.9, '', 'No real Hard on the SAT: Hard = hardest Medium (+ the few Hard items)'],
  ['Q.E', 'E,M', 1.3, '', 'No real Hard on the SAT: Hard = hardest Medium (+ the few Hard items)'],
  ['Q.F', 'E,M,H', 2.5, 5, 'Rare on the test (about 1 per test): Mixed rarely, practice 5 only'],
  ['Q.G', 'E,M,H', 2.5, 5, 'Rare on the test (about 1 per test): Mixed rarely, practice 5 only'],
  ['S.A', 'E,M,H', 4.7, '', ''], ['S.B', 'E,M,H', 4.4, '', ''],
  ['S.C', 'M,H', 3.0, '', 'No real Easy on the SAT: Easy = Medium level 1'],
  ['S.D', 'M,H', 2.9, '', 'No real Easy on the SAT: Easy = Medium level 1']
];
var _skProf = null;
/** {skill: {allowed: {E: true, …}, weight, max_set, note, label}} from the tab (defaults for a skill without a row). */
function skillProfiles_() {
  if (_skProf) return _skProf;
  var out = {};
  SKILL_PROFILE_DEFAULTS_.forEach(function (d) { out[d[0]] = profRow_(d[0], d[1], d[2], d[3], d[4]); });
  var sh = null; try { sh = ss_().getSheetByName(SKILL_PROFILE_TAB); } catch (e) {}
  if (sh && sh.getLastRow() > 1) readTable_(SKILL_PROFILE_TAB).rows.forEach(function (r) {
    var k = clean_(r.skill); if (!k) return;
    out[k] = profRow_(k, r.allowed, r.weight === '' ? (out[k] || {}).weight : r.weight, r.max_set, r.note);
  });
  return (_skProf = out);
}
function profRow_(k, allowed, weight, maxSet, note) {
  var a = {}; String(allowed || 'E,M,H').toUpperCase().split(/[^EMH]+/).forEach(function (d) { if (d) a[d] = true; });
  if (!a.E && !a.M && !a.H) a = { E: true, M: true, H: true };
  var w = Number(weight); if (!(w >= 0)) w = 1;
  var ms = Number(maxSet) || 0;
  var lab = !a.E && a.M && a.H ? 'Medium/Hard only' : a.E && a.M && !a.H ? 'Easy/Medium only' : (a.E && a.M && a.H) ? '' : ['E', 'M', 'H'].filter(function (d) { return a[d]; }).map(function (d) { return { E: 'Easy', M: 'Medium', H: 'Hard' }[d]; }).join('/') + ' only';
  if (ms) lab = (lab ? lab + ' · ' : '') + 'rare on the test';
  return { skill: k, allowed: a, weight: w, max_set: ms, note: clean_(note), label: lab };
}
function skillProfile_(skill) { return skillProfiles_()[clean_(skill)] || profRow_(clean_(skill), 'E,M,H', 1, '', ''); }
/** May an item of this difficulty be served for the skill? (Hard of an "E,M" skill: only in a Hard slot.) */
function profServes_(skill, d) {
  var p = skillProfile_(skill); d = String(d).toUpperCase();
  return !!p.allowed[d] || (d === 'H' && !p.allowed.H && !!p.allowed.M);
}
/** What a slot of difficulty slotDiff asks for: {diff, levels (CB level preference), alsoH, note} after the profile. */
function profSlot_(skill, slotDiff) {
  var p = skillProfile_(skill);
  if (slotDiff === 'E' && !p.allowed.E) return { diff: 'M', levels: [1, 2, 3], alsoH: false, mapped: true };
  if (slotDiff === 'H' && !p.allowed.H) return { diff: 'M', levels: [3, 2, 1], alsoH: true, mapped: true };
  if (slotDiff === 'M' && !p.allowed.M) return { diff: p.allowed.H ? 'H' : 'E', levels: p.allowed.H ? [1, 2, 3] : [3, 2, 1], alsoH: false, mapped: true };
  return null;
}
/** Mixed Practice: weights of the given skills, normalised to sum 1. */
function mixedWeights_(skills) {
  var P = skillProfiles_(), w = {}, tot = 0;
  skills.forEach(function (k) { w[k] = P[k] ? P[k].weight : 1; tot += w[k]; });
  skills.forEach(function (k) { w[k] = tot > 0 ? w[k] / tot : 1 / skills.length; });
  return w;
}
/** Which skills get the n items of a Mixed set: first the "hurt" skills (in their order, one item each), then Sainte-Laguë over
 *  the weights — the next item goes to the skill with the lowest (past + this set + 0.5) / weight. At most perSkill each.
 *  past: {skill: Mixed items so far}. Returns the list of skills, one per item. */
function mixedPlan_(skills, weights, past, n, perSkill, first, tie) {
  var cnt = {}, plan = [];
  (first || []).forEach(function (k) { if (plan.length < n && skills.indexOf(k) >= 0 && (cnt[k] || 0) < perSkill) { plan.push(k); cnt[k] = (cnt[k] || 0) + 1; } });
  while (plan.length < n) {
    var best = null, bv = Infinity;
    skills.forEach(function (k) {
      if ((cnt[k] || 0) >= perSkill || !(weights[k] > 0)) return;
      var v = ((past[k] || 0) + (cnt[k] || 0) + 0.5) / weights[k];
      if (v < bv - 1e-12 || (Math.abs(v - bv) <= 1e-12 && tie && tie[k] < tie[best])) { bv = v; best = k; }
    });
    if (!best) break;
    plan.push(best); cnt[best] = (cnt[best] || 0) + 1;
  }
  return plan;
}
/** Update step: the tab gets one row per skill (defaults); rows Minh edited stay. */
function ensureSkillProfile_() {
  var sh = ss_().getSheetByName(SKILL_PROFILE_TAB);
  if (!sh) { ensureTabs_(); sh = ss_().getSheetByName(SKILL_PROFILE_TAB); }
  var have = {}; if (sh.getLastRow() > 1) readTable_(SKILL_PROFILE_TAB).rows.forEach(function (r) { have[clean_(r.skill)] = 1; });
  var add = SKILL_PROFILE_DEFAULTS_.filter(function (d) { return !have[d[0]]; }).map(function (d) {
    return { skill: txt_(d[0]), name: skillName_(d[0]), allowed: d[1], weight: d[2], max_set: d[3], note: d[4] };
  });
  if (add.length) appendObjects_(SKILL_PROFILE_TAB, add);
  _skProf = null;
  return add.length;
}
