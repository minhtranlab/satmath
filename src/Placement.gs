/**
 * SAT Math Lib — Placement test (blueprint v2.2 by 🧭 Skills, approved by Minh 14 Nov 2026).
 * -------------------------------------------------------------------------------------------------------------------
 * The teacher assigns a "Placement test" (form A = first time, form B = retake; "auto" picks). The student gets ONE
 * question at a time; the next one is chosen on the server from the answer and the time band:
 *   - 4 domains (ALG Algebra, ADV Advanced Math, PSD Problem-Solving & Data, GEO Geometry & Trig), interleaved by the
 *     pattern ALG → PSD → ALG → GEO (Algebra's turns go to Advanced Math once Algebra has a result).
 *   - per domain start Easy (Advanced Math starts Medium when Algebra = Strong); right within the time band = 1 step,
 *     slow right = ½ step (pl_slow_credit); wrong = one level down; at Hard any right counts.
 *   - stop: 2 Hard right in a row → H · 2nd Easy wrong / 3 Easy items without moving up → E (any Easy right) or below E ·
 *     2nd Hard wrong → M · 2nd Medium wrong → E · 6 items → highest level passed (Hard reached → M, Medium → E).
 * The items of each slot (E1 E2 E3 M1–M4 H1–H4 per domain per form) are in the Sheet tab Placement_Forms (codes only).
 * Result: per domain E/M/H/<E (Weak/Medium/Strong), per tested skill a level → Levels (seeds practice + Mixed Practice);
 * untested skills of a domain start at the domain level (initialLevel_). Students see Strong / Medium / Weak per domain only.
 * Port of taxonomy/placement/routing.py — keep both in step (tests/placement_test.js replays all 718 paths).
 */

var PL_DOMAINS_ = ['ALG', 'ADV', 'PSD', 'GEO'];                                  // report order (real-test weight)
var PL_CB_ = { ALG: 'H', ADV: 'P', PSD: 'Q', GEO: 'S' };                         // placement domain → College Board domain letter
var PL_NAME_ = { ALG: 'Algebra', ADV: 'Advanced Math', PSD: 'Problem-Solving and Data Analysis', GEO: 'Geometry and Trigonometry' };
var PL_WORD_ = { H: 'Strong', M: 'Medium', E: 'Weak', '<E': 'Weak' };
var PL_LEVELS_ = ['E', 'M', 'H'];
var PL_FORMS_TAB = 'Placement_Forms', PL_TAB = 'Placements', PL_TITLE = 'Placement test';

/** The routing numbers (Settings, all tunable). */
function plParams_() {
  var S = getSettings_();
  return {
    pattern: String(S.pl_pattern || 'ALG,PSD,ALG,GEO').split(/[,\s]+/).map(function (x) { return x.toUpperCase(); }).filter(function (x) { return PL_CB_[x]; }),
    max: Number(S.pl_max_per_domain) || 6, easy_cap: Number(S.pl_easy_cap) || 3, strong_run: Number(S.pl_strong_run) || 2,
    wrong_stop: Number(S.pl_wrong_stop) || 2, slow_credit: S.pl_slow_credit === '' ? 0.5 : Number(S.pl_slow_credit),
    adv_medium_if: String(S.pl_adv_medium_if || 'H').toUpperCase()
  };
}

/** One domain. ans: ['F' right in time | 'S' slow right | 'W' wrong]. → {seq: ['EF', 'MS' …], result: 'H'|'M'|'E'|'<E'|null, level} */
function plRoute_(ans, start, P) {
  var lvl = Math.max(0, PL_LEVELS_.indexOf(start)), credit = 0, hrun = 0, seq = [], passed = {}, wrong = [0, 0, 0];
  var eW = 0, eR = 0, eSeen = 0;
  for (var p = 0; p < lvl; p++) passed[p] = 1;
  var out = function (r) { return { seq: seq, result: r, level: PL_LEVELS_[lvl] }; };
  for (var i = 0; i < ans.length; i++) {
    var a = ans[i], cur = PL_LEVELS_[lvl];
    seq.push(cur + a);
    if (cur === 'E') eSeen++;
    if (a === 'F' || a === 'S') {
      if (cur === 'E') eR++;
      if (cur === 'H') { hrun++; if (hrun >= P.strong_run) return out('H'); }                 // at Hard any right counts
      else { credit += a === 'F' ? 1 : P.slow_credit; if (credit >= 1 - 1e-9) { passed[lvl] = 1; lvl++; credit = 0; hrun = 0; } }
    } else {
      credit = 0; hrun = 0;
      if (cur === 'E') { eW++; if (eW === P.wrong_stop) return out(eR ? 'E' : '<E'); }
      else { wrong[lvl]++; if (wrong[lvl] === P.wrong_stop) return out(PL_LEVELS_[lvl - 1]); lvl--; }
    }
    if (lvl === 0 && eSeen >= P.easy_cap) return out(eR ? 'E' : '<E');                         // Easy not passed after easy_cap items
    if (seq.length === P.max) {
      var hi = -1; Object.keys(passed).forEach(function (k) { hi = Math.max(hi, Number(k)); });
      return out(hi >= 1 ? 'M' : (hi === 0 || eR) ? 'E' : '<E');
    }
  }
  return out(null);
}
/** Which domain gives the next item (pattern pointer k). → {d, k} or {d: null}. */
function plNextDomain_(results, k, P) {
  var pat = P.pattern.length ? P.pattern : ['ALG', 'PSD', 'ALG', 'GEO'];
  for (var step = 0; step < pat.length * 2; step++) {
    var d = pat[(k + step) % pat.length];
    if (d === 'ALG' && results.ALG) d = 'ADV';
    if (!results[d]) return { d: d, k: k + step + 1 };
  }
  return { d: null, k: k };
}
function plStart_(d, results, P) { return d === 'ADV' && results.ALG === P.adv_medium_if ? 'M' : 'E'; }

/** Replay the items so far ([{dom, slot, a}] in order) → per-domain answers + results + the next slot (or null = done).
 *  hasSlot(dom, slot): false → that domain ends now by the 6-item rule (a slot missing in the form never blocks the test). */
function plState_(items, P, hasSlot) {
  var answers = {}, results = {}, k = 0;
  PL_DOMAINS_.forEach(function (d) { answers[d] = []; });
  items.forEach(function (it) {
    if (!it.a || it.a === '?') return;
    k = plNextDomain_(results, k, P).k;
    answers[it.dom].push(it.a);
    var r = plRoute_(answers[it.dom], plStart_(it.dom, results, P), P).result;
    if (r) results[it.dom] = r;
  });
  for (var guard = 0; guard < 8; guard++) {
    var nd = plNextDomain_(results, k, P);
    if (!nd.d) return { answers: answers, results: results, next: null };
    var st = plRoute_(answers[nd.d], plStart_(nd.d, results, P), P);
    var nAt = st.seq.filter(function (x) { return x.charAt(0) === st.level; }).length;
    var slot = st.level + (nAt + 1);
    if (!hasSlot || hasSlot(nd.d, slot)) return { answers: answers, results: results, next: { dom: nd.d, slot: slot, level: st.level }, k: nd.k };
    results[nd.d] = st.seq.length ? plMaxRule_(st.seq) : '?';                                 // '?' = domain not tested
  }
  return { answers: answers, results: results, next: null };
}
/** Result when a domain must stop early: the 6-item rule on what was answered. */
function plMaxRule_(seq) {
  var hi = -1, eR = false;
  seq.forEach(function (x, i) {
    var l = PL_LEVELS_.indexOf(x.charAt(0)), nx = seq[i + 1];
    if (nx && PL_LEVELS_.indexOf(nx.charAt(0)) > l) hi = Math.max(hi, l);
    if (x === 'EF' || x === 'ES') eR = true;
  });
  return hi >= 1 ? 'M' : (hi === 0 || eR) ? 'E' : '<E';
}

/** Time band of one answer: fast (≤ fast) · normal (≤ max) · slow. Grid-in gets pl_spr_extra_sec more. */
function plBand_(level, type, sec, S) {
  var nm = { E: 'easy', M: 'medium', H: 'hard' }[level] || 'medium', extra = String(type) === 'spr' ? Number(S.pl_spr_extra_sec) || 0 : 0;
  var fast = (Number(S['pl_' + nm + '_fast_sec']) || 0) + extra, max = (Number(S['pl_' + nm + '_max_sec']) || 0) + extra;
  return sec <= fast ? 'fast' : sec <= max ? 'normal' : 'slow';
}

/* ---------------- forms + items ---------------- */
var _plForms = null;
/** {'A|ALG|E1': qid} from the tab Placement_Forms (a qid or a short code per slot). */
function plForms_() {
  if (_plForms) return _plForms;
  var out = {}, byCode = {}, known = {};
  questionRows_().forEach(function (r) { known[String(r.qid)] = 1; var c = clean_(r.code).toUpperCase(); if (c) byCode[c] = String(r.qid); });
  var rows = []; try { rows = readTable_(PL_FORMS_TAB).rows; } catch (e) {}
  rows.forEach(function (r) {
    var f = clean_(r.form).toUpperCase(), d = clean_(r.domain).toUpperCase(), s = clean_(r.slot).toUpperCase();
    var q = clean_(r.qid), c = clean_(r.code).toUpperCase();
    var qid = known[q] ? q : byCode[c] || '';
    if (f && d && s && qid) out[f + '|' + d + '|' + s] = qid;
  });
  return (_plForms = out);
}
function plParseSlots_(s) {
  return String(s.slots || '').split(',').map(function (x) { return x.trim(); }).filter(String).map(function (x) {
    var p = x.split('-'); return { dom: p[0], slot: p[1], a: p[2] || '?' };
  });
}
function plSlotsText_(items) { return items.map(function (it) { return it.dom + '-' + it.slot + '-' + (it.a || '?'); }).join(','); }

/** Finished placements of a student, newest first (Placements tab rows). */
function plHistory_(codeN) {
  var rows = []; try { rows = readTable_(PL_TAB).rows; } catch (e) {}
  return rows.filter(function (r) { return normCode_(r.student_code) === codeN; })
    .sort(function (a, b) { return toMs_(b.finished_at) - toMs_(a.finished_at) || b._row - a._row; });
}
var _plLatest = {};
/** Domain levels of the latest placement {H: 'M', P: 'E', …} by College Board domain letter (empty = none). */
function plLatestLevels_(codeN) {
  if (_plLatest[codeN]) return _plLatest[codeN];
  var out = {}, h = []; try { h = plHistory_(codeN); } catch (e) {}
  if (h.length) PL_DOMAINS_.forEach(function (d) { var v = clean_(h[0][d.toLowerCase()]); if (/^(<E|E|M|H)$/.test(v)) out[PL_CB_[d]] = v === '<E' ? 'E' : v; });
  return (_plLatest[codeN] = out);
}
/** Form for a new placement: the assignment's A / B, or auto = A the first time, then the other form of the latest one. */
function plFormFor_(form, codeN) {
  form = String(form || 'auto').toUpperCase();
  if (form === 'A' || form === 'B') return form;
  var h = plHistory_(codeN);
  return h.length && clean_(h[0].form).toUpperCase() === 'A' ? 'B' : 'A';
}

/* ---------------- student side ---------------- */
/** Called by startAssignment for an assignment of kind placement: makes the set with its first question. */
function startPlacement_(a, c) {
  var form = plFormFor_(a.form, c), forms = plForms_(), P = plParams_();
  var st = plState_([], P, function (d, sl) { return !!forms[form + '|' + d + '|' + sl]; });
  if (!st.next) throw new Error('FORM: The placement test is not set up yet (tab Placement_Forms). Ask your teacher.');
  var qid = forms[form + '|' + st.next.dom + '|' + st.next.slot], setId = newSetId_(c);
  appendObjects_('Sets', [{ set_id: setId, student_code: c, kind: 'placement', assignment_id: String(a.assignment_id), skill: '', n: 1, qids: qid,
                            level_at_start: form, slots: plSlotsText_([{ dom: st.next.dom, slot: st.next.slot, a: '?' }]), created_at: nowIso_(),
                            status: 'in_progress', events_saved: 0, last_saved_at: nowIso_(), progress: '0 answered' }]);
  return { ok: true, set_id: setId, n: 1, form: form };
}

/** Answer of the current question → the next one (or the result). payload: {qid, state, events, ev_from, copy}. Idempotent:
 *  a repeat for a question already answered returns the question that is current now. */
function placementNext(code, setId, payload) {
  payload = payload || {};
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var s = requireSet_(code, setId);
    if (String(s.kind) !== 'placement') throw new Error('SESSION: This is not a placement test.');
    if (isFinished_(s)) return { ok: true, done: true, result: placementStudentView_(s) };
    if (staleCopy_(s, payload)) return otherCopy_();
    var qs = setQuestions_(s), cur = qs[qs.length - 1], items = plParseSlots_(s);
    if (String(payload.qid || '') !== cur.qid) return { ok: true, done: false, question: clientQuestion_(cur, true), n: qs.length, repeat: true };
    var S = getSettings_(), P = plParams_(), forms = plForms_(), form = String(s.level_at_start || 'A');
    cleanEvents_(qs, payload.events);
    var state = mergeState_(parseState_(s), payload.state, toMs_(s.created_at) - 3600000, Date.now());
    cleanAnswers_(qs, state);
    var all = fullEvents_(s, payload), evSaved = storeEvents_(s, payload);
    var g = gradeSet_(s, state, all), row = g.rows[g.rows.length - 1], it = items[items.length - 1];
    var level = String(it.slot || 'E').charAt(0), right = Number(row.try1_correct) === 1;
    var band = plBand_(level, cur.type, Number(row.time_try1_sec) || 0, S);
    it.a = !right ? 'W' : (level !== 'H' && band === 'slow') ? 'S' : 'F';
    row.flags = (row.flags ? row.flags + ',' : '') + 'PL_' + it.dom + '_' + it.slot + ',PL_' + band.toUpperCase();
    row.asked = ''; row.ask_note = ''; row.ask_at = ''; row.ask_status = ''; row.ask_code = '';
    appendObjects_('Responses', [row]);
    appendObjects_('Tries', [{ set_id: row.set_id, student_code: row.student_code, qid: row.qid, try_no: 1, answer: row.try1_answer,
                               correct: row.try1_correct === '' ? 0 : row.try1_correct, time_sec: row.time_try1_sec, at: row.submitted_at }]);
    var stt = plState_(items, P, function (d, sl) { return !!forms[form + '|' + d + '|' + sl]; });
    var f = { events_saved: evSaved, last_saved_at: nowIso_(), state_json: compactState_(state) };
    if (!stt.next) {
      updateRow_('Sets', s._row, f);
      Object.keys(f).forEach(function (k) { s[k] = f[k]; });
      s.slots = plSlotsText_(items);
      return { ok: true, done: true, result: finishPlacement_(s, stt) };
    }
    var nq = forms[form + '|' + stt.next.dom + '|' + stt.next.slot];
    items.push({ dom: stt.next.dom, slot: stt.next.slot, a: '?' });
    var qids = setQids_(s).concat([nq]);
    f.qids = qids.join(','); f.n = qids.length; f.slots = plSlotsText_(items); f.current_q = qids.length; f.progress = (qids.length - 1) + ' answered';
    updateRow_('Sets', s._row, f);
    var q = JSON.parse(JSON.stringify(libQuestions_([nq])[0] || null));
    if (!q) throw new Error('FORM: A placement question is missing from the library. Ask your teacher.');
    q.part = SET_PART; q.display_no = qids.length;
    return { ok: true, done: false, question: clientQuestion_(q, true), n: qids.length };
  } finally { lock.releaseLock(); }
}

/** Per tested skill: the domain level, one step down when an item of the skill was missed at or below it, one step up when
 *  one was right above it (both → the domain level). Below Easy → Easy (flag). */
function plSkillLevels_(rows, results) {
  var by = {};
  rows.forEach(function (r) {
    var k = clean_(r.skill), m = /PL_([A-Z]{3})_/.exec(String(r.flags || '')); if (!k || !m) return;
    var o = by[k] = by[k] || { skill: k, dom: m[1], n: 0, right: 0, wrongLow: false, rightHigh: false, items: [] };
    o.n++; if (Number(r.try1_correct) === 1) o.right++;
    o.items.push({ d: String(r.difficulty || 'E').toUpperCase(), right: Number(r.try1_correct) === 1 });
  });
  return Object.keys(by).map(function (k) {
    var o = by[k], dr = results[o.dom] || 'E', base = /^[EMH]$/.test(dr) ? dr : 'E', bi = PL_LEVELS_.indexOf(base);
    o.items.forEach(function (x) { var xi = PL_LEVELS_.indexOf(x.d); if (!x.right && xi <= bi) o.wrongLow = true; if (x.right && xi > bi) o.rightHigh = true; });
    var lvl = o.rightHigh && !o.wrongLow ? up_(base) : o.wrongLow && !o.rightHigh ? down_(base) : base;
    return { skill: k, name: skillName_(k), dom: o.dom, level: lvl, below: dr === '<E', n: o.n, right: o.right };
  }).sort(function (a, b) { return PL_DOMAINS_.indexOf(a.dom) - PL_DOMAINS_.indexOf(b.dom) || a.skill.localeCompare(b.skill); });
}
/** "Teach first": the 3 tested skills with the lowest level (then: weaker domain, more misses, real-test weight). Strong skills never. */
function plTeachFirst_(skills, results) {
  var rank = { '<E': 0, E: 1, M: 2, H: 3 };
  return skills.filter(function (k) { return k.level !== 'H'; }).sort(function (a, b) {
    return PL_LEVELS_.indexOf(a.level) - PL_LEVELS_.indexOf(b.level) || rank[results[a.dom] || 'E'] - rank[results[b.dom] || 'E'] ||
      (b.n - b.right) - (a.n - a.right) || PL_DOMAINS_.indexOf(a.dom) - PL_DOMAINS_.indexOf(b.dom);
  }).slice(0, 3);
}

function ensurePlTab_() {
  if (!hasTab_(PL_TAB)) ensureTabs_();
}
/** Last item answered: domain results, skill levels → Levels, Placements row, set submitted. Returns the student view. */
function finishPlacement_(s, stt) {
  var codeN = normCode_(s.student_code), rows = responsesOf_(s.set_id), results = stt.results;
  var skills = plSkillLevels_(rows, results), teach = plTeachFirst_(skills, results), now = nowIso_(), day = fmtDate_(new Date(), 'd MMM');
  var form = String(s.level_at_start || 'A'), prev = plHistory_(codeN)[0];
  // Levels: every tested skill gets the placement level (practice + Mixed Practice start there)
  var lv = {}; readTable_('Levels').rows.forEach(function (r) { if (normCode_(r.student_code) === codeN) lv[clean_(r.skill)] = r; });
  skills.forEach(function (k) {
    var r = lv[k.skill], hist = r ? String(r.history || '') : '';
    var f = { student_code: codeN, skill: txt_(k.skill), level: k.level, recent_pct: '', good_streak: 0, n_items: r ? r.n_items : 0,
              last_set_id: String(s.set_id), updated_at: now, history: (hist ? hist + ' · ' : '') + 'placement ' + form + ' → ' + k.level + ' ' + day };
    if (r) updateRow_('Levels', r._row, f); else appendObjects_('Levels', [f]);
  });
  var right = rows.filter(function (r) { return Number(r.try1_correct) === 1; }).length;
  var time = rows.reduce(function (a, r) { return a + (Number(r.time_total_sec) || 0); }, 0);
  var items = plParseSlots_(s);
  ensurePlTab_();
  var rec = { set_id: String(s.set_id), student_code: codeN, form: form, assignment_id: String(s.assignment_id || ''), finished_at: now,
              n_items: rows.length, n_right: right, time_min: round_(time / 60, 1),
              skill_levels: skills.map(function (k) { return k.skill + ':' + k.level; }).join(' '), teach_first: teach.map(function (k) { return k.skill; }).join(' '),
              path: items.map(function (it) { return it.dom + ' ' + it.slot + it.a; }).join(' · '), prev_set_id: prev ? String(prev.set_id) : '' };
  PL_DOMAINS_.forEach(function (d) { rec[d.toLowerCase()] = txt_(results[d] || ''); });
  appendObjects_(PL_TAB, [rec]);
  _plLatest = {};
  var fields = { submitted_at: now, status: 'submitted', progress: 'Submitted', first_try: right, best_score: right, n: rows.length,
                 n_blank: rows.filter(function (r) { return r.profile === 'BLANK'; }).length, time_used_min: round_(time / 60, 1), slots: plSlotsText_(items) };
  updateRow_('Sets', s._row, fields);
  Object.keys(fields).forEach(function (k) { s[k] = fields[k]; });
  return placementStudentView_(s, rec);
}

/** What the student sees: Strong / Medium / Weak per domain. Never an answer, a key or a code. */
function placementStudentView_(s, rec) {
  rec = rec || plRecord_(s.set_id);
  var doms = PL_DOMAINS_.map(function (d) { var v = rec ? clean_(rec[d.toLowerCase()]) : ''; return { name: PL_NAME_[d], word: PL_WORD_[v] || '' }; });
  return { ok: true, placement: true, session_id: String(s.set_id), title: PL_TITLE, date: dateStr_(s.submitted_at), n: rec ? Number(rec.n_items) || 0 : Number(s.n) || 0,
           domains: doms, time_min: rec ? Number(rec.time_min) || 0 : 0 };
}
function plRecord_(setId) {
  var rows = []; try { rows = readTable_(PL_TAB).rows; } catch (e) {}
  return rows.filter(function (r) { return String(r.set_id) === String(setId); })[0] || null;
}

/* ---------------- teacher side ---------------- */
/** Placement report: domain levels, skills tested, every item + time band, teach first, comparison with the previous one. */
function placementReport(code, setId) {
  cachedReads_();                                                   // read-only: snapshots, no Sheet (#42)
  requireTeacher_(code);
  var s = findSet_(setId);
  if (!s || String(s.kind) !== 'placement') throw new Error('SESSION: Placement test not found.');
  return placementReport_(s);
}
function placementReport_(s) {
  var st = findStudent_(s.student_code), rec = plRecord_(s.set_id), S = getSettings_();
  var qrow = {}; questionRows_().forEach(function (r) { qrow[String(r.qid)] = r; });
  var rows = responsesOf_(s.set_id).sort(function (a, b) { return Number(a.order) - Number(b.order); });
  var items = plParseSlots_(s), results = {};
  PL_DOMAINS_.forEach(function (d) { results[d] = rec ? clean_(rec[d.toLowerCase()]) : ''; });
  var list = rows.map(function (r, i) {
    var it = items[i] || {}, m = /PL_(FAST|NORMAL|SLOW)/.exec(String(r.flags || '')), Q = qrow[String(r.qid)] || {};
    return { no: i + 1, qid: String(r.qid), code: clean_(Q.code), dom: it.dom || '', slot: it.slot || '', skill: clean_(r.skill), skill_name: skillName_(clean_(r.skill)),
             subskill_name: subskillName_(clean_(r.subskill)), difficulty: String(r.difficulty || ''), type: String(Q.type || 'mcq'),
             answer: clean_(r.final_answer), right: Number(r.try1_correct) === 1, blank: String(r.profile) === 'BLANK',
             time_s: Math.round(Number(r.time_try1_sec) || 0), band: m ? m[1].toLowerCase() : '', step: it.a || '' };
  });
  var skills = plSkillLevels_(rows, results), teach = rec ? plTeachFirst_(skills, results) : [];
  var doms = PL_DOMAINS_.map(function (d) {
    var its = list.filter(function (x) { return x.dom === d; });
    return { dom: d, name: PL_NAME_[d], level: results[d], word: PL_WORD_[results[d]] || '', n: its.length, right: its.filter(function (x) { return x.right; }).length,
             path: its.map(function (x) { return x.slot + (x.step === 'W' ? '✗' : x.step === 'S' ? '½' : '✓'); }).join(' → ') };
  });
  var prevRec = rec && rec.prev_set_id ? plRecord_(rec.prev_set_id) : null, prev = null;
  if (prevRec) {
    var pl = {}; String(prevRec.skill_levels || '').split(/\s+/).filter(String).forEach(function (x) { var p = x.split(':'); pl[p[0]] = p[1]; });
    prev = { set_id: String(prevRec.set_id), form: String(prevRec.form), date: dateStr_(prevRec.finished_at), n_items: Number(prevRec.n_items) || 0,
             domains: PL_DOMAINS_.map(function (d) { return { dom: d, level: clean_(prevRec[d.toLowerCase()]) }; }), skills: pl };
  }
  var bands = { E: [S.pl_easy_fast_sec, S.pl_easy_max_sec], M: [S.pl_medium_fast_sec, S.pl_medium_max_sec], H: [S.pl_hard_fast_sec, S.pl_hard_max_sec], spr: S.pl_spr_extra_sec };
  return { ok: true, placement_report: true, set_id: String(s.set_id), student: st ? String(st.name || '') : String(s.student_code), student_code: normCode_(s.student_code),
           form: String(s.level_at_start || ''), done: isFinished_(s), date: dateStr_(s.submitted_at || s.created_at), n_items: list.length,
           n_right: list.filter(function (x) { return x.right; }).length, time_min: rec ? Number(rec.time_min) || 0 : round_(list.reduce(function (a, x) { return a + x.time_s; }, 0) / 60, 1),
           domains: doms, skills: skills, teach_first: teach, items: list, previous: prev, bands: bands };
}
/** A student's placements (newest first) for the teacher's profile page. */
function plSummaries_(codeN) {
  return plHistory_(codeN).map(function (r) {
    return { set_id: String(r.set_id), form: String(r.form), date: dateStr_(r.finished_at), n_items: Number(r.n_items) || 0,
             domains: PL_DOMAINS_.map(function (d) { return { dom: d, name: PL_NAME_[d], level: clean_(r[d.toLowerCase()]) }; }) };
  });
}
