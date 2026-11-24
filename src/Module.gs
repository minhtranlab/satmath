/**
 * SAT Math Lib — "Real-test module" (#101, Minh 23/11 + Brain 24/11 after 📐 #102).
 * -------------------------------------------------------------------------------------------------------------------
 * The teacher assigns one module (Module 1 · Module 2 easier · Module 2 harder) or the full Math section (Module 1, then
 * the easier or harder Module 2 by the Module 1 result, like Bluebook). Each module = one set (kind "module"), 22 items,
 * 35 minutes, the normal test screen with a timer; it ends at 0:00 by itself. A full test = two sets with the same test_id
 * (the Module 1 set id) in the tab Modules.
 *   Builder (modBuild_): the #102 blueprint slot by slot — level per slot within ±1 (allowed range), grid-ins at fixed slots,
 *   domain quota per band, skill caps (P.C ≤ 5, H.B/P.B ≤ 3, others ≤ 2, same sub-skill ≤ 2 and never twice in a row),
 *   ≥ 12 skills, ≥ 10 question forms (same form ≤ 4, never 3 in a row), figures/tables ≥ 3. Only live version-A items the
 *   student has never seen (answered, in any of their sets, Review, a published assignment for them, a Placement form) —
 *   and by default none of the 432 CB practice-test items (CbPtItems.gs). A short slot is filled in the blueprint's order
 *   (other skill of the domain → next level in range → grid-in ↔ MCQ with the next slot of the band → neighbour domain),
 *   each substitution logged in the Modules row (the teacher sees it).
 *   Score (modScore_): blended CB table (8 practice tests) at raw × 54 / n + a difficulty adjustment = how many more (or
 *   fewer) a student of that ability (Rasch, levels E1…H3) gets on an average CB test than on the items they had.
 *   Shown as a range: one module ± mod_range_one, full ± mod_range_full. data/scoring/README.md has the method.
 * Grading is the normal submit (Code.gs): keys never leave the server. Every number is a Settings row (mod_*).
 */
var MOD_TAB = 'Modules', MOD_KIND = 'module';
var MOD_LV_ = ['E1', 'E2', 'E3', 'M1', 'M2', 'M3', 'H1', 'H2', 'H3'];
var MOD_NAMES_ = { M1: 'Module 1', M2E: 'Module 2 (easier)', M2H: 'Module 2 (harder)', FULL: 'Module 1 + Module 2' };
var MOD_DOM_NAME_ = { H: 'Algebra', P: 'Advanced Math', Q: 'Problem-Solving and Data Analysis', S: 'Geometry and Trigonometry' };
var MOD_DOMS_ = ['H', 'P', 'Q', 'S'];
var MOD_NB_ = { H: 'Q', Q: 'H', P: 'S', S: 'P' };                                    // neighbour domain (#102 §4 step 4)
// College Board raw → Math scale, mean of the 8 practice tests' midpoints (raw 0–54; data/scoring/cb_math_scale.json)
var MOD_BLEND_ = [200, 210.62, 211.88, 215, 219.38, 225, 232.5, 243.75, 259.38, 278.75, 301.88, 319.38, 333.12, 343.12, 353.12, 361.88, 368.12,
  375.62, 380.62, 390.62, 396.88, 404.38, 408.12, 418.12, 426.88, 436.88, 446.88, 456.88, 468.12, 480.62, 491.88, 501.88, 513.12, 524.38, 536.88,
  546.88, 559.38, 570.62, 581.88, 591.88, 604.38, 618.12, 631.88, 641.88, 658.12, 673.12, 688.12, 705.62, 723.12, 740, 756.25, 770, 784.38, 790.62, 797.5];
// items per level (our final levels) in an average CB practice test (54 items; mean of tests 4–11)
var MOD_CB_COUNTS_ = { E2: 23.375, E3: 2.0, M1: 8.875, M2: 3.625, M3: 7.25, H1: 4.25, H2: 4.25, H3: 0.375 };

/* ---------------- parameters (Settings, all tunable) ---------------- */
function modLvIdx_(s) { return MOD_LV_.indexOf(String(s || '').trim().toUpperCase()); }
/** 'E2 E1-E3, …' → [{no, t, lo, hi}] (index into MOD_LV_). */
function modParseLevels_(txt) {
  return String(txt || '').split(',').map(function (x) { return x.trim(); }).filter(String).map(function (x, i) {
    var m = /^([EMH][1-3])\s+([EMH][1-3])\s*-\s*([EMH][1-3])$/i.exec(x) || /^([EMH][1-3])$/i.exec(x);
    if (!m) throw new Error('Settings: level slot "' + x + '" must look like "E2 E1-E3".');
    var t = modLvIdx_(m[1]), lo = m[2] ? modLvIdx_(m[2]) : Math.max(0, t - 1), hi = m[3] ? modLvIdx_(m[3]) : Math.min(8, t + 1);
    return { no: i + 1, t: t, lo: Math.min(lo, t), hi: Math.max(hi, t) };
  });
}
/** '1-9: H4 P2 Q2 S1 | 10-15: …' → [{from, to, quota: {H: 4, …}}] */
function modParseBands_(txt) {
  return String(txt || '').split('|').map(function (x) { return x.trim(); }).filter(String).map(function (x) {
    var m = /^(\d+)\s*-\s*(\d+)\s*:\s*(.*)$/.exec(x); if (!m) throw new Error('Settings: band "' + x + '" must look like "1-9: H4 P2 Q2 S1".');
    var q = { H: 0, P: 0, Q: 0, S: 0 };
    m[3].split(/[\s,]+/).filter(String).forEach(function (y) { var k = /^([HPQS])\s*(\d+)$/i.exec(y); if (k) q[k[1].toUpperCase()] = Number(k[2]); });
    return { from: Number(m[1]), to: Number(m[2]), quota: q };
  });
}
function modParseCounts_(txt) {
  var o = {}; String(txt || '').split(/[,;]/).forEach(function (x) { var m = /^\s*([A-Za-z.]+)\s+(\d+)\s*$/.exec(x); if (m) o[m[1]] = Number(m[2]); }); return o;
}
function modParams_(mod) {
  var S = getSettings_(), key = mod === 'M2E' ? 'm2e' : mod === 'M2H' ? 'm2h' : 'm1';
  var slots = modParseLevels_(S['mod_levels_' + key]), grid = {};
  String(S.mod_gridin_slots || '').split(/[,\s]+/).filter(String).forEach(function (x) { grid[Number(x)] = 1; });
  slots.forEach(function (s) { s.type = grid[s.no] ? 'spr' : 'mcq'; });
  var bands = modParseBands_(S['mod_bands_' + key]);
  slots.forEach(function (s) { s.band = 0; bands.forEach(function (b, i) { if (s.no >= b.from && s.no <= b.to) s.band = i; }); });
  var caps = modParseCounts_(S.mod_skill_caps);
  return { mod: mod, slots: slots, bands: bands, caps: caps, other_cap: caps.other === undefined ? 2 : caps.other, sub_cap: Number(S.mod_sub_cap) || 2,
           min_skills: Number(S.mod_min_skills) || 0, min_forms: Number(S.mod_min_forms) || 0, form_cap: Number(S.mod_form_cap) || 4,
           min_figs: Number(S.mod_min_figures) || 0, grid_doms: modParseCounts_(S.mod_gridin_domains), minutes: Number(S.mod_minutes) || 35 };
}

/* ---------------- the pool: live version A, never seen, no CB practice-test item ---------------- */
var _cbPt = null;
function modCbPt_() { if (!_cbPt) { _cbPt = {}; CB_PT_IDS_.forEach(function (x) { _cbPt['CB-' + x] = 1; }); } return _cbPt; }
/** Everything this student has met or will meet: answered, in any of their sets, Review, published assignments for them, Placement forms. */
function modSeen_(codeN) {
  var seen = {};
  readTable_('Responses').rows.forEach(function (r) { if (normCode_(r.student_code) === codeN) seen[String(r.qid)] = 1; });
  readTable_('Sets').rows.forEach(function (s) { if (normCode_(s.student_code) === codeN) setQids_(s).forEach(function (q) { seen[q] = 1; }); });
  readTable_('Review').rows.forEach(function (r) { if (normCode_(r.student_code) === codeN) seen[clean_(r.qid)] = 1; });
  readTable_('Assignments').rows.forEach(function (a) {
    if (String(a.status) === 'published' && String(a.kind) !== MOD_KIND && targetMembers_(a).indexOf(codeN) >= 0) setQids_(a).forEach(function (q) { seen[q] = 1; });
  });
  try { var f = plForms_(); Object.keys(f).forEach(function (k) { seen[f[k]] = 1; }); } catch (e) {}
  return seen;
}
function modRow_(r) {
  var d = String(r.difficulty || '').toUpperCase(), l = Math.max(1, Math.min(3, Number(r.level) || 2));
  var lv = { E: 0, M: 3, H: 6 }[d]; if (lv === undefined) return null;
  var sk = clean_(r.skill);
  return { qid: String(r.qid), skill: sk, dom: sk.charAt(0), sub: clean_(r.subskill), type: String(r.type || 'mcq') === 'spr' ? 'spr' : 'mcq', lv: lv + l - 1, twin: String(r.twin_group || '') };
}
function modPool_(codeN, withCb) {
  var seen = modSeen_(codeN), cb = isYes_(getSettings_().mod_exclude_cb_pt) && !withCb ? modCbPt_() : {}, twins = {};
  questionRows_().forEach(function (r) { var tw = String(r.twin_group || ''); if (tw && seen[String(r.qid)]) twins[tw] = 1; });
  return livePool_().map(function (r) {
    if (seen[String(r.qid)] || cb[String(r.qid)] || (r.twin_group && twins[String(r.twin_group)])) return null;
    var o = modRow_(r); return o && MOD_DOMS_.indexOf(o.dom) >= 0 ? o : null;
  }).filter(Boolean);
}

/* ---------------- question form (port of 📐 #102 _work102/scripts/forms.py, first match wins) ---------------- */
var MOD_FORMS_ = [
  ['equivalent', /equivalent/], ['interpret', /best interpretation|what does .{0,60} represent|represents? the (estimated )?(number|amount)|meaning/],
  ['n_solutions', /how many (distinct )?(real )?(solutions|points|times|values of x)|no (real )?solutions?|infinitely many|exactly one solution/],
  ['model', /which (of the following )?(equation|function|inequalit|expression|system|graph|table)\w* .{0,40}(represent|model|could be used|gives|define|describe|correctly|shows|relat)|which equation|which inequality|which function/],
  ['could_be', /could be/], ['constant', /constant/], ['solve', /solution|solve/], ['feature', /intercept|vertex|slope|maximum|minimum|zeros?\b/],
  ['geo_measure', /area|perimeter|volume|measure|length|radius|diameter|circumference|degrees|radians/], ['percent', /percent|%|ratio/],
  ['prob', /probability|at random|sample|survey/], ['data', /mean|median|range|standard deviation|dot plot|histogram|bar graph|scatterplot|line of best fit|table/],
  ['value', /value of|what is/]];
function modText_(html) { return String(html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\\[()\[\]]/g, ' ').replace(/\s+/g, ' ').trim(); }
function modForm_(text) {
  var s = String(text || '').toLowerCase();
  for (var i = 0; i < MOD_FORMS_.length; i++) if (MOD_FORMS_[i][1].test(s)) return MOD_FORMS_[i][0];
  return 'other';
}
/** {qid: {form, fig, words}} for these items: the Item_Forms tab (written by every deploy, modFormsSync_), else their batch files. */
var _modInfo = {}, _modTab = null;
function modInfo_(qids) {
  if (!_modTab) {
    _modTab = {};
    try { readTable_('Item_Forms').rows.forEach(function (r) { _modTab[clean_(r.qid)] = { form: String(r.form || 'other'), fig: isYes_(r.fig), words: Number(r.words) || 0 }; }); } catch (e) {}
  }
  qids.forEach(function (q) { if (!_modInfo[q] && _modTab[q]) _modInfo[q] = _modTab[q]; });
  var need = qids.filter(function (q) { return !_modInfo[q]; });
  if (need.length) libQuestions_(need).forEach(function (q) {
    var t = modText_(q.stem_html), all = modText_((q.passage_html || '') + ' ' + q.stem_html);
    _modInfo[q.qid] = { form: modForm_(t), fig: (q.figures || []).length > 0 || /<table/i.test(String(q.stem_html || '') + String(q.passage_html || '')),
                        words: all ? all.split(' ').length : 0 };
  });
  need.forEach(function (q) { if (!_modInfo[q]) _modInfo[q] = { form: 'other', fig: false, words: 0 }; });
  var o = {}; qids.forEach(function (q) { o[q] = _modInfo[q]; }); return o;
}

/* ---------------- the builder ---------------- */
function modRand_(seed) { var x = seedOf_(String(seed)) % 2147483647 || 1; return function () { x = (x * 48271) % 2147483647; return (x - 1) / 2147483646; }; }
function modCapOf_(P, skill) { return P.caps[skill] !== undefined ? P.caps[skill] : P.other_cap; }
/** One module for one student → {qids, levels: ['E2', …], log: [lines], stats}. Throws when the library cannot fill it. */
function modBuild_(codeN, mod, seed) {
  var P = modParams_(mod), rnd = modRand_(seed + '|' + mod), pool = modPool_(codeN, false), poolCb = null;
  var st = { used: {}, twin: {}, skill: {}, sub: {}, form: {}, forms: [], doms: [], subs: [], picked: [], figs: 0, grid: {} };
  var left = P.bands.map(function (b) { var q = {}; Object.keys(b.quota).forEach(function (d) { q[d] = b.quota[d]; }); return q; });
  var log = [], owed = [];                                          // grid-in ↔ MCQ swaps still owed to a later slot of the band
  var NAMEL = function (i) { return MOD_LV_[Math.max(0, Math.min(8, i))]; }, TY = { spr: 'grid-in', mcq: 'multiple choice' };
  var ok = function (r, sl, lo, hi, dom, type) {
    if (st.used[r.qid] || (r.twin && st.twin[r.twin]) || r.type !== type || (dom && r.dom !== dom) || r.lv < lo || r.lv > hi) return false;
    if ((st.skill[r.skill] || 0) >= modCapOf_(P, r.skill)) return false;
    if (r.sub && ((st.sub[r.sub] || 0) >= P.sub_cap || st.subs[st.subs.length - 1] === r.sub)) return false;
    return true;
  };
  /** the best candidate (level first, new skill / sub-skill, form rules, figures early) or null */
  var choose = function (src, sl, lo, hi, dom, type) {
    var c = src.filter(function (r) { return ok(r, sl, lo, hi, dom, type); });
    if (!c.length) return null;
    c.forEach(function (r) { r._c = Math.abs(r.lv - sl.t) * 10 + (st.skill[r.skill] || 0) * 1.5 + (st.sub[r.sub] ? 3 : 0) + rnd(); });
    c.sort(function (a, b) { return a._c - b._c; });
    var top = c.slice(0, 8), inf = modInfo_(top.map(function (r) { return r.qid; }));
    var n = st.forms.length, last2 = n >= 2 && st.forms[n - 1] === st.forms[n - 2] ? st.forms[n - 1] : null;
    var fit = top.filter(function (r) { var f = inf[r.qid].form; return (st.form[f] || 0) < P.form_cap && f !== last2; });
    var useFig = sl.no <= 12 && st.figs < P.min_figs;
    (fit.length ? fit : top).forEach(function (r) { r._d = r._c + (st.form[inf[r.qid].form] || 0) * 1.2 - (useFig && inf[r.qid].fig ? 2 : 0); });
    var best = (fit.length ? fit : top).sort(function (a, b) { return a._d - b._d; })[0];
    return { r: best, info: inf[best.qid], formMiss: !fit.length };
  };
  var domOrder = function (sl, type, band) {
    var q = left[band] || {}, d = MOD_DOMS_.filter(function (x) { return q[x] > 0; });
    var nD = st.doms.length, run = nD >= 2 && st.doms[nD - 1] === st.doms[nD - 2] ? st.doms[nD - 1] : null;
    var r0 = {}; d.forEach(function (x) { r0[x] = rnd(); });
    return d.sort(function (a, b) {
      return (a === run) - (b === run) ||
        (type === 'spr' ? ((P.grid_doms[b] || 0) - (st.grid[b] || 0)) - ((P.grid_doms[a] || 0) - (st.grid[a] || 0)) : 0) || q[b] - q[a] || r0[a] - r0[b];
    });
  };
  P.slots.forEach(function (sl) {
    var band = sl.band, type = sl.type, other = type === 'spr' ? 'mcq' : 'spr', doms = domOrder(sl, type, band), got = null, why = '', plan = doms[0] || null;
    // the grid-in (or MCQ) an earlier slot of this band could not get comes here when it can
    var ow = owed.filter(function (o) { return o.band === band && o.type !== type; })[0];
    if (ow) {
      doms.some(function (d) { var x = choose(pool, sl, sl.lo, sl.hi, d, ow.type); if (x) { got = x; plan = d; } return !!x; });
      if (got) { why = TY[ow.type] + ' moved here from slot ' + ow.from; owed.splice(owed.indexOf(ow), 1); type = got.r.type; }
    }
    if (!got) doms.some(function (d) { var x = choose(pool, sl, sl.lo, sl.hi, d, type); if (x) { got = x; plan = d; } return !!x; });
    if (!got) {                                                                     // (3) grid-in ↔ MCQ with the next slot of the band
      doms.some(function (d) { var x = choose(pool, sl, sl.lo, sl.hi, d, other); if (x) { got = x; plan = d; } return !!x; });
      if (got) { why = 'no ' + TY[type] + ' left → ' + TY[other] + ' here'; owed.push({ band: band, type: type, from: sl.no }); }
    }
    if (!got) {                                                                     // (4) neighbour domain
      doms.some(function (d) { var x = choose(pool, sl, sl.lo, sl.hi, MOD_NB_[d], type) || choose(pool, sl, sl.lo, sl.hi, MOD_NB_[d], other); if (x) { got = x; plan = d; } return !!x; });
      if (got) why = 'no ' + MOD_DOM_NAME_[plan] + ' item → ' + MOD_DOM_NAME_[got.r.dom];
    }
    if (!got) {                                                                     // (5) one level beyond the range, any domain
      [type, other].some(function (t) { got = choose(pool, sl, Math.max(0, sl.lo - 1), Math.min(8, sl.hi + 1), null, t); return !!got; });
      if (got) why = 'nothing in ' + NAMEL(sl.lo) + '–' + NAMEL(sl.hi) + ' → ' + NAMEL(got.r.lv);
    }
    if (!got) {                                                                     // (6) a CB practice-test item (last resort)
      poolCb = poolCb || modPool_(codeN, true).filter(function (r) { return modCbPt_()[r.qid]; });
      [type, other].some(function (t) { got = choose(poolCb, sl, Math.max(0, sl.lo - 1), Math.min(8, sl.hi + 1), null, t); return !!got; });
      if (got) why = 'only a College Board practice-test item was left';
    }
    if (!got) throw new Error('FORM: Not enough new questions for this module (slot ' + sl.no + '). Ask your teacher.');
    var r = got.r;
    if (!why && r.lv !== sl.t) why = 'no ' + NAMEL(sl.t) + ' → ' + NAMEL(r.lv);
    if (!why && got.formMiss) why = 'question form repeats';
    if (plan && left[band] && left[band][plan] > 0) left[band][plan]--;
    st.used[r.qid] = 1; if (r.twin) st.twin[r.twin] = 1; st.skill[r.skill] = (st.skill[r.skill] || 0) + 1; st.sub[r.sub] = (st.sub[r.sub] || 0) + 1;
    st.subs.push(r.sub); st.doms.push(r.dom); st.form[got.info.form] = (st.form[got.info.form] || 0) + 1; st.forms.push(got.info.form);
    if (got.info.fig) st.figs++; if (r.type === 'spr') st.grid[r.dom] = (st.grid[r.dom] || 0) + 1;
    st.picked.push({ slot: sl.no, band: band, r: r, info: got.info });
    if (why) log.push('slot ' + sl.no + ' (' + NAMEL(sl.t) + ' ' + TY[sl.type] + '): ' + why);
  });
  // within a band: easier first (grid-ins stay on their slots); then no 3 items of one domain in a row where a swap helps
  P.bands.forEach(function (b, bi) {
    ['mcq', 'spr'].forEach(function (t) {
      var at = st.picked.map(function (p, i) { return i; }).filter(function (i) { return st.picked[i].band === bi && st.picked[i].r.type === t; });
      var items = at.map(function (i) { return st.picked[i]; }).sort(function (x, y) { return x.r.lv - y.r.lv; });
      at.forEach(function (i, k) { st.picked[i] = { slot: st.picked[i].slot, band: bi, r: items[k].r, info: items[k].info }; });
    });
  });
  // after the reorder: no 3 of one domain or one form in a row, no sub-skill twice in a row — swap with an item of the same
  // band, type and level where that clears it (and makes nothing new)
  var pk = st.picked, bad = function (i) {
    if (i < 0 || i >= pk.length) return false;
    var x = pk[i], p1 = pk[i - 1], p2 = pk[i - 2], n1 = pk[i + 1], n2 = pk[i + 2];
    var run = function (f) { return (p1 && p2 && f(p1) === f(x) && f(p2) === f(x)) || (p1 && n1 && f(p1) === f(x) && f(n1) === f(x)) || (n1 && n2 && f(n1) === f(x) && f(n2) === f(x)); };
    return (x.r.sub && ((p1 && p1.r.sub === x.r.sub) || (n1 && n1.r.sub === x.r.sub))) || run(function (y) { return y.r.dom; }) || run(function (y) { return y.info.form; });
  };
  for (var pass = 0; pass < 3; pass++) for (var i = 0; i < pk.length; i++) {
    if (!bad(i)) continue;
    for (var j = 0; j < pk.length; j++) {
      if (j === i || pk[j].band !== pk[i].band || pk[j].r.type !== pk[i].r.type || pk[j].r.lv !== pk[i].r.lv) continue;
      var before = [i - 2, i - 1, i, i + 1, i + 2, j - 2, j - 1, j, j + 1, j + 2].filter(bad).length;
      var t1 = pk[i]; pk[i] = { slot: t1.slot, band: t1.band, r: pk[j].r, info: pk[j].info }; pk[j] = { slot: pk[j].slot, band: t1.band, r: t1.r, info: t1.info };
      if ([i - 2, i - 1, i, i + 1, i + 2, j - 2, j - 1, j, j + 1, j + 2].filter(bad).length < before) break;
      var t2 = pk[i]; pk[i] = { slot: t2.slot, band: t2.band, r: pk[j].r, info: pk[j].info }; pk[j] = { slot: pk[j].slot, band: t2.band, r: t2.r, info: t2.info };
    }
  }
  var skills = Object.keys(st.skill).length, forms = Object.keys(st.form).length;
  if (skills < P.min_skills) log.push('only ' + skills + ' different skills (aim ' + P.min_skills + ')');
  if (forms < P.min_forms) log.push('only ' + forms + ' question forms (aim ' + P.min_forms + ')');
  if (st.figs < P.min_figs) log.push('only ' + st.figs + ' items with a figure or table (aim ' + P.min_figs + ')');
  var doms = {}; st.picked.forEach(function (p) { doms[p.r.dom] = (doms[p.r.dom] || 0) + 1; });
  return { qids: st.picked.map(function (p) { return p.r.qid; }), levels: st.picked.map(function (p) { return NAMEL(p.r.lv); }),
           types: st.picked.map(function (p) { return p.r.type; }), doms: st.picked.map(function (p) { return p.r.dom; }), skills_list: st.picked.map(function (p) { return p.r.skill; }),
           forms_list: st.picked.map(function (p) { return p.info.form; }), log: log,
           stats: { skills: skills, forms: forms, figs: st.figs, grid: st.picked.filter(function (p) { return p.r.type === 'spr'; }).length, doms: doms } };
}

/* ---------------- score ---------------- */
function modP_(th, b) { return 1 / (1 + Math.exp(-(th - b))); }
/** resp: [{lv: 'M2', right: true}] → {raw, n, cb_raw, mid, lo, hi}. opt: {full, route ('M2E' / 'M2H' / ''), single ('M1' …)} */
function modScore_(resp, opt) {
  opt = opt || {};
  var S = getSettings_(), step = Number(S.mod_level_step) || 0.5, sd = Number(S.mod_prior_sd) || 3;
  var b = function (lv) { var i = modLvIdx_(lv); return ((i < 0 ? 4 : i) - 4) * step; };
  var n = resp.length, raw = resp.filter(function (x) { return x.right; }).length;
  if (!n) return null;
  var th = 0;
  for (var it = 0; it < 60; it++) {                                                 // MAP ability (normal prior keeps all-right finite)
    var g = -th / (sd * sd), h = -1 / (sd * sd);
    resp.forEach(function (x) { var p = modP_(th, b(x.lv)); g += (x.right ? 1 : 0) - p; h -= p * (1 - p); });
    var stp = g / h; th -= stp; if (Math.abs(stp) < 1e-7) break;
  }
  var own = resp.reduce(function (a, x) { return a + modP_(th, b(x.lv)); }, 0) * 54 / n;
  var avg = Object.keys(MOD_CB_COUNTS_).reduce(function (a, k) { return a + MOD_CB_COUNTS_[k] * modP_(th, b(k)); }, 0);
  var cbRaw = Math.max(0, Math.min(54, raw * 54 / n + (avg - own)));
  var i0 = Math.floor(cbRaw), f = cbRaw - i0, mid = MOD_BLEND_[i0] * (1 - f) + MOD_BLEND_[Math.min(54, i0 + 1)] * f;
  if (opt.route === 'M2E' || opt.single === 'M2E') mid = Math.min(mid, Number(S.mod_easy_cap) || 800);
  if (opt.full && opt.route === 'M2H') mid = Math.max(mid, Number(S.mod_hard_floor) || 200);
  var half = opt.full ? Number(S.mod_range_full) || 40 : Number(S.mod_range_one) || 60;
  var r10 = function (x) { return Math.round(x / 10) * 10; };
  return { raw: raw, n: n, cb_raw: round_(cbRaw, 1), theta: round_(th, 2), mid: r10(mid), lo: Math.max(200, r10(mid - half)), hi: Math.min(800, r10(mid + half)) };
}

/* ---------------- sets of a module assignment ---------------- */
function modModeOf_(a) { var f = String(a.form || '').trim().toUpperCase(); return MOD_NAMES_[f] ? f : 'M1'; }
function modRows_() { try { return readTable_(MOD_TAB).rows; } catch (e) { return []; } }
function modRecord_(setId) { return modRows_().filter(function (r) { return String(r.set_id) === String(setId); })[0] || null; }
function modTestRows_(testId) { return modRows_().filter(function (r) { return String(r.test_id) === String(testId); }).sort(function (a, b) { return a._row - b._row; }); }
function ensureModTab_() { if (!hasTab_(MOD_TAB)) ensureTabs_(); }
/** Makes one module set (+ its Modules row). The caller holds the script lock. */
function modCreateSet_(c, a, mod, testId, mode) {
  var setId = newSetId_(c), b = modBuild_(c, mod, setId);
  appendObjects_('Sets', [{ set_id: setId, student_code: c, kind: MOD_KIND, assignment_id: String(a.assignment_id), skill: '', n: b.qids.length, qids: b.qids.join(','),
                            level_at_start: mod, slots: b.levels.join(','), created_at: nowIso_(), status: 'in_progress', events_saved: 0, last_saved_at: nowIso_() }]);
  ensureModTab_();
  appendObjects_(MOD_TAB, [{ set_id: setId, student_code: c, assignment_id: String(a.assignment_id), test_id: testId || setId, mode: mode, module: mod, n: b.qids.length,
                             levels: b.levels.join(' '), subs: txt_(b.log.join('\n')), stats: txt_(JSON.stringify(b.stats)), built_at: nowIso_() }]);
  return { ok: true, set_id: setId, n: b.qids.length, module: mod };
}
/** startAssignment of kind module: the open module, else the next one (Module 2 of a full test), else done. */
function startModule_(a, c) {
  var mode = modModeOf_(a);
  var sets = readTable_('Sets').rows.filter(function (s) { return normCode_(s.student_code) === c && String(s.assignment_id) === String(a.assignment_id) && String(s.status) !== 'abandoned'; });
  var open = sets.filter(function (s) { return isOpenStatus_(s.status); })[0];
  if (open) return { ok: true, set_id: String(open.set_id), resumed: true, n: Number(open.n) || 0 };
  if (!sets.length) return modCreateSet_(c, a, mode === 'FULL' ? 'M1' : mode, '', mode);
  var done = sets.filter(isFinished_);
  if (mode === 'FULL' && done.length === 1) { var nx = modNext_(done[0], a, c); if (nx) return nx; }
  return { ok: true, set_id: String(done[done.length - 1].set_id), resumed: true, done: true };
}
/** Module 1 of a full test is in: route by its raw score (Settings mod_route_raw) → Module 2 set. */
function modNext_(m1, a, c) {
  var rec = modRecord_(m1.set_id) || {}, raw = Number(rec.raw);
  if (rec.raw === '' || rec.raw === undefined) raw = Number(m1.first_try) || 0;
  var route = raw >= (Number(getSettings_().mod_route_raw) || 13) ? 'M2H' : 'M2E';
  if (rec._row) updateRow_(MOD_TAB, rec._row, { route: route });
  return modCreateSet_(c, a, route, String(m1.set_id), 'FULL');
}
/** After the normal submit of a module set: raw + domains on its Modules row; a full test's Module 1 → Module 2;
 *  the last module → the score of the test. Returns {next: {set_id}} or {final: true}. */
function modAfterSubmit_(s, rows) {
  ensureModTab_();
  var rec = modRecord_(s.set_id); if (!rec) return { final: true };
  var raw = rows.filter(function (r) { return Number(r.try1_correct) === 1; }).length;
  updateRow_(MOD_TAB, rec._row, { raw: raw, by_domain: modDomainsText_(rows), finished_at: nowIso_() });
  if (String(rec.mode) === 'FULL' && String(rec.module) === 'M1') {
    var a = readTable_('Assignments').rows.filter(function (x) { return String(x.assignment_id) === String(s.assignment_id); })[0];
    if (a) return { next: modNext_(s, a, normCode_(s.student_code)) };
  }
  var tr = modTestRows_(rec.test_id), all = [];
  tr.forEach(function (t) { all = all.concat(t.set_id === rec.set_id ? rows : responsesOf_(t.set_id)); });
  var route = tr.length > 1 ? String(tr[tr.length - 1].module) : '';
  var sc = modScore_(all.map(function (r) { return { lv: String(r.difficulty || '').toUpperCase() + (Number(r.level) || 2), right: Number(r.try1_correct) === 1 }; }),
                     { full: tr.length > 1, route: route, single: tr.length > 1 ? '' : String(rec.module) });
  var me = modRecord_(s.set_id);
  if (sc && me) updateRow_(MOD_TAB, me._row, { route: route, cb_raw: sc.cb_raw, score_lo: sc.lo, score_hi: sc.hi, score_mid: sc.mid });
  return { final: true };
}
function modDomainsText_(rows) {
  var d = modDomains_(rows); return MOD_DOMS_.map(function (k) { return k + ' ' + d[k].right + '/' + d[k].n; }).join(' · ');
}
function modDomains_(rows) {
  var o = {}; MOD_DOMS_.forEach(function (k) { o[k] = { right: 0, n: 0 }; });
  rows.forEach(function (r) { var k = clean_(r.skill).charAt(0); if (!o[k]) return; o[k].n++; if (Number(r.try1_correct) === 1) o[k].right++; });
  return o;
}

/* ---------------- what the student / teacher see ---------------- */
function modTitle_(s) {
  var rec = modRecord_(s.set_id), mod = String(s.level_at_start || (rec && rec.module) || 'M1');
  return assignmentTitle_(s.assignment_id) + ' · ' + (mod === 'M1' ? 'Module 1' : 'Module 2');
}
/** The test screen profile of a module: one timed part (Settings mod_minutes); Module 2 of a full test starts by itself. */
function modProfile_(s, n) {
  var rec = modRecord_(s.set_id) || {}, mod = String(s.level_at_start || rec.module || 'M1'), mins = Number(getSettings_().mod_minutes) || 35;
  var p = setProfile_(s, n);
  p.untimed = false; p.title = modTitle_(s); p.module = true;
  p.auto_begin = String(rec.mode) === 'FULL' && mod !== 'M1'; p.next_module = String(rec.mode) === 'FULL' && mod === 'M1'; p.part_word = 'module';
  p.parts[0].title = mod === 'M1' ? 'Module 1' : 'Module 2'; p.parts[0].time_limit_sec = mins * 60;
  p.parts[0].directions_html = '<p>The questions in this module address a number of important math skills. You may use the Desmos calculator ' +
    'and the reference sheet. For multiple-choice questions, choose the best answer. For student-produced response questions, type your answer ' +
    'in the box. You can mark questions to come back to and check your work on the review page before you submit. At 0:00 the module ends ' +
    'and your answers are submitted.</p>';
  return p;
}
/** #104 Result of a module set (the whole test for a full one) = the normal set report (resultCore_: skills, types of mistakes,
 *  times + slow / rush, first try / best, fix, asked; one question grid per module) + the score header on top: range, route,
 *  4 domains; teacher: raw per module, route, substitutions. */
function modResultView_(s, asTeacher) {
  var rec = modRecord_(s.set_id) || { test_id: s.set_id, module: s.level_at_start, mode: '' };
  var tr = modTestRows_(rec.test_id || s.set_id), last = tr[tr.length - 1] || rec, setsById = {};
  if (!tr.length) tr = [{ set_id: s.set_id, module: s.level_at_start || 'M1', n: s.n }];
  readTable_('Sets').rows.forEach(function (x) { setsById[String(x.set_id)] = x; });
  var all = [], parts = [], mods = [], lastSet = s, multi = tr.length > 1;
  tr.forEach(function (t, i) {
    var ss = setsById[String(t.set_id)], done = !!(ss && isFinished_(ss));
    var rs = (done ? responsesOf_(t.set_id) : []).map(function (r) {
      var c = {}; Object.keys(r).forEach(function (k) { c[k] = r[k]; }); c._m = i; c._lab = 'Q' + r.order + (multi ? ' (M' + (i + 1) + ')' : ''); return c;
    });
    if (done) { lastSet = ss; if (rs.length) parts.push({ part: 'M' + (i + 1), title: i ? 'Module 2' : 'Module 1', rows: rs }); }
    all = all.concat(rs);
    var o = { set_id: String(t.set_id), title: i ? 'Module 2' : 'Module 1', right: rs.filter(function (r) { return Number(r.try1_correct) === 1; }).length, n: Number(t.n) || rs.length, done: done };
    if (asTeacher) { o.module = String(t.module); o.name = MOD_NAMES_[String(t.module)] || ''; o.subs = String(t.subs || '').replace(/^'/, '').split('\n').filter(String); o.levels = String(t.levels || ''); }
    mods.push(o);
  });
  var v = resultCore_(lastSet, all, asTeacher, { title: assignmentTitle_(s.assignment_id), parts: parts });
  var full = String(rec.mode) === 'FULL', finished = mods.every(function (m) { return m.done; }) && (!full || mods.length > 1);
  var d = modDomains_(all), sc = finished && last.score_lo !== '' && last.score_lo !== undefined ? { lo: Number(last.score_lo), hi: Number(last.score_hi) } : null;
  v.session_id = String(s.set_id); v.kind = MOD_KIND; v.module = true; v.score = sc; v.one_module = !full; v.finished = finished;
  v.route = full && mods.length > 1 ? (String(tr[1].module) === 'M2H' ? 'harder' : 'easier') : '';
  v.domains = MOD_DOMS_.map(function (k) { return { name: MOD_DOM_NAME_[k], right: d[k].right, n: d[k].n }; });
  if (asTeacher) { v.modules = mods; v.mode = String(rec.mode || ''); v.cb_raw = last.cb_raw === '' || last.cb_raw === undefined ? null : Number(last.cb_raw); v.route_raw = Number(getSettings_().mod_route_raw) || 13; }
  return v;
}
/** #104 the set of the same test that holds this question (Result / Go over / Fix / Ask of a full test use one set id). */
function modSetOf_(setId, qid) {
  var rec = modRecord_(setId); if (!rec) return String(setId);
  var hit = modTestRows_(rec.test_id).filter(function (t) { var ss = findSet_(t.set_id); return ss && setQids_(ss).indexOf(String(qid)) >= 0; })[0];
  return hit ? String(hit.set_id) : String(setId);
}
/** #104 all answers of the test (both modules), for the "best" line of Fix. */
function modTestResponses_(setId) {
  var rec = modRecord_(setId); if (!rec) return responsesOf_(setId);
  var out = []; modTestRows_(rec.test_id).forEach(function (t) { out = out.concat(responsesOf_(t.set_id)); }); return out;
}
/** Read-only review of the whole test (Module 1 + Module 2 as two parts), never a key. */
function modReviewData_(s, asTeacher) {
  var rec = modRecord_(s.set_id) || { test_id: s.set_id }, tr = modTestRows_(rec.test_id || s.set_id), parts = [], qs = [];
  if (!tr.length) tr = [{ set_id: s.set_id, module: s.level_at_start || 'M1' }];
  tr.forEach(function (t, i) {
    var ss = findSet_(t.set_id); if (!ss || !isFinished_(ss)) return;
    var d = reviewData_(ss, responsesOf_(t.set_id), asTeacher), part = 'M' + (i + 1), title = i ? 'Module 2' : 'Module 1';
    parts.push({ part: part, title: title, layout: d.parts[0].layout, spr_layout: d.parts[0].spr_layout, choices: 4, calculator: true, reference: true, annotate: false, directions_html: '' });
    d.questions.forEach(function (q) { q.part = part; q.label = 'Q' + q.no + (tr.length > 1 ? ' (M' + (i + 1) + ')' : ''); q.set_id = String(t.set_id); qs.push(q); });
  });
  return { ok: true, session_id: String(s.set_id), form_id: String(s.set_id), title: assignmentTitle_(s.assignment_id), question_font: 'serif', reference_sheet: 'sat_math',
           parts: parts, questions: qs, settings: { desmos_api_key: desmosKey_() } };
}
/** Teacher: the latest finished test range per student ({CODE: {lo, hi, date, full}}). */
function modLatest_() {
  var out = {};
  modRows_().forEach(function (r) {
    if (r.score_lo === '' || r.score_lo === undefined) return;
    var c = normCode_(r.student_code), ms = toMs_(r.finished_at);
    if (!out[c] || ms >= out[c].ms) out[c] = { lo: Number(r.score_lo), hi: Number(r.score_hi), date: dateStr_(r.finished_at), full: String(r.mode) === 'FULL', ms: ms };
  });
  Object.keys(out).forEach(function (k) { delete out[k].ms; });
  return out;
}
/** A second submit of Module 1 of a full test (lost answer, retry): its Module 2 when that one is still open. */
function modOpenNext_(s) {
  var rec = modRecord_(s.set_id); if (!rec || String(rec.mode) !== 'FULL' || String(rec.module) !== 'M1') return null;
  var m2 = modTestRows_(rec.test_id)[1]; if (!m2) return null;
  var ss = findSet_(m2.set_id); return ss && isOpenStatus_(ss.status) ? String(m2.set_id) : null;
}
/** Home card of a module assignment for one student (null = nothing left to do). */
function modCardFor_(a, c, sets) {
  var mode = modModeOf_(a), mine = sets.filter(function (x) { return String(x.assignment_id) === String(a.assignment_id) && String(x.status) !== 'abandoned'; });
  var open = mine.filter(function (x) { return isOpenStatus_(x.status); })[0], done = mine.filter(isFinished_);
  if (!open && done.length && (mode !== 'FULL' || done.length >= 2)) return null;
  var stt = open ? parseState_(open) || {} : {}, ps = (stt.parts || {})[SET_PART] || {};
  return { module: true, mode: mode, n: mode === 'FULL' ? 44 : 22, minutes: Number(getSettings_().mod_minutes) || 35, n_modules: mode === 'FULL' ? 2 : 1,
           set_id: open ? String(open.set_id) : '', answered: Object.keys(ps.ans || {}).length, on_module: open ? (String(open.level_at_start) === 'M1' ? 1 : 2) : (done.length ? 2 : 1) };
}
/** Deploy step (after the library sync, whose batch files are in memory): tab Item_Forms = the question form, figure / table
 *  and word count of every version-A item, so building a module never has to open the batch files. */
function modFormsSync_() {
  if (!hasTab_('Item_Forms')) ensureTabs_();
  var idx = libIndex_(), rows = [];
  Object.keys(idx).sort().forEach(function (b) {
    var data = null; try { data = libBatch_(b); } catch (e) { return; }
    ((data && data.questions) || []).forEach(function (q) {
      if (String(q.version || 'A').toUpperCase() === 'B') return;
      var t = modText_(q.stem_html), all = modText_((q.passage_html || '') + ' ' + q.stem_html);
      rows.push({ qid: txt_(q.qid), form: modForm_(t), fig: (q.figures || []).length > 0 || /<table/i.test(String(q.stem_html || '') + String(q.passage_html || '')) ? 'Yes' : '',
                  words: all ? all.split(' ').length : 0 });
    });
  });
  if (!rows.length) return 'item forms: library not readable — kept';
  rewriteTable_('Item_Forms', function () { return false; }, rows);
  _modTab = null;
  var c = {}; rows.forEach(function (r) { c[r.form] = (c[r.form] || 0) + 1; });
  return 'item forms: ' + rows.length + ' items, ' + Object.keys(c).length + ' forms';
}
/** #104 Fix wrong answers of a module test: the open questions of both modules (each Check goes to the module that holds it). */
function modFix_(code, s) {
  var rec = modRecord_(s.set_id) || { test_id: s.set_id }, tr = modTestRows_(rec.test_id || s.set_id), d0 = null, qs = [], parts = [];
  if (!tr.length) tr = [{ set_id: s.set_id }];
  tr.forEach(function (t, i) {
    var ss = findSet_(t.set_id); if (!ss || !isFinished_(ss)) return;
    var d = getFix(code, String(t.set_id), true);
    if (!d0) d0 = d;
    var part = 'M' + (i + 1);
    parts.push({ part: part, title: i ? 'Module 2' : 'Module 1', layout: d.parts[0].layout, spr_layout: d.parts[0].spr_layout, choices: 4, calculator: true, reference: true, annotate: false, directions_html: '' });
    d.questions.forEach(function (q) { q.part = part; q.label = 'Q' + q.no + (tr.length > 1 ? ' (M' + (i + 1) + ')' : ''); qs.push(q); });
  });
  if (!d0) throw new Error('SESSION: This set has not been submitted yet.');
  var all = modTestResponses_(s.set_id);
  d0.session_id = String(s.set_id); d0.form_id = String(s.set_id); d0.title = assignmentTitle_(s.assignment_id); d0.parts = parts; d0.questions = qs;
  d0.best = { right: all.filter(function (r) { return Number(r.best_correct) === 1; }).length, n: all.length };
  delete d0.fk;                                                    // its key is sealed with one module's set id
  return d0;
}
