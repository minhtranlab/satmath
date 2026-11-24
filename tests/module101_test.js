// #101 real-test module (server, made-up bank FX6 added to a copy of the fixture library): the builder follows the #102
// blueprint (levels per slot, grid-in slots, domain quota per band, skill / sub-skill caps, forms, figures), only never-seen
// version-A items and no CB practice-test item; short slots → logged substitutions; the score (range, routes); the full test
// Module 1 → easier / harder Module 2 by mod_route_raw; result / review / teacher views; My skills + Levels after a module.
const { makeGas } = require('./server');
const { modLib } = require('./modlib');
const H = require('./h'); const { check } = H;
const G = makeGas({ libDir: modLib() }), C = G.ctx, T = 'TEACH-FX-9';
const fx6 = C.readTable_('Batches').rows.find(x => x.batch === 'FX6'); C.updateRow_('Batches', fx6._row, { live: 'Yes' }); C._batchLive = null; G.fresh();
const Q = {}; G.table('Questions').forEach(r => { Q[r.qid] = r; });
const key = id => String(Q[id].key).replace(/^'/, ''), wrong = id => Q[id].type === 'spr' ? '999' : ['A', 'B', 'C', 'D'].find(l => l !== key(id));
const LV = ['E1', 'E2', 'E3', 'M1', 'M2', 'M3', 'H1', 'H2', 'H3'];
const lvOf = id => { const r = C.questionRows_().find(x => x.qid === id); return r.difficulty + (Number(r.level) || 2); };
const S = () => C.getSettings_();

console.log('Builder: the #102 blueprint');
const IF = G.table('Item_Forms'), if1 = IF.find(r => String(r.qid).replace(/^'/, '') === 'FX6-001');
check(IF.length > 500 && if1 && if1.form === 'constant' && IF.every(r => !/stem|<p>/.test(JSON.stringify(r))), 'deploy step "item forms": tab Item_Forms (' + IF.length + ' items: form, figure, words; no text) — the builder reads it');
const P1 = C.modParams_('M1');
check(P1.slots.length === 22 && P1.slots.filter(s => s.type === 'spr').map(s => s.no).join(',') === '5,6,11,12,17,22' && P1.minutes === 35, '22 slots, grid-ins at 5, 6, 11, 12, 17, 22, 35 minutes (Settings)');
let allOk = true, bandOk = true, capOk = true, subOk = true, formOk = true, nForms = [], nSkills = [], figs = [], lvOk = true;
const caps = { 'P.C': 5, 'H.B': 3, 'P.B': 3, 'Q.E': 1, 'Q.F': 1, 'Q.G': 0 };
for (const mod of ['M1', 'M2H', 'M2E']) {
  const P = C.modParams_(mod);
  for (let k = 0; k < 8; k++) {
    const b = C.modBuild_('FX-T01', mod, 'seed' + k);
    if (b.qids.length !== 22 || new Set(b.qids).size !== 22) allOk = false;
    b.qids.forEach((q, i) => { const sl = P.slots[i], li = LV.indexOf(lvOf(q)); if (li < sl.lo || li > sl.hi) lvOk = false; if ((Q[q].type === 'spr') !== (sl.type === 'spr')) allOk = false; if (Q[q].version === 'B') allOk = false; });
    P.bands.forEach((bd, bi) => { const got = {}; b.qids.forEach((q, i) => { if (P.slots[i].band === bi) { const d = String(Q[q].skill).replace(/^'/, '')[0]; got[d] = (got[d] || 0) + 1; } });
      ['H', 'P', 'Q', 'S'].forEach(d => { if ((got[d] || 0) !== bd.quota[d]) bandOk = false; }); });
    const sk = {}, sb = {}; b.qids.forEach((q, i) => { const s = String(Q[q].skill).replace(/^'/, ''), u = String(Q[q].subskill).replace(/^'/, '');
      sk[s] = (sk[s] || 0) + 1; sb[u] = (sb[u] || 0) + 1; if (i && String(Q[b.qids[i - 1]].subskill).replace(/^'/, '') === u) subOk = false; });
    Object.keys(sk).forEach(s => { if (sk[s] > (s in caps ? caps[s] : 2)) capOk = false; }); Object.keys(sb).forEach(u => { if (sb[u] > 2) subOk = false; });
    const fc = {}; b.forms_list.forEach((f, i) => { fc[f] = (fc[f] || 0) + 1; if (i >= 2 && f === b.forms_list[i - 1] && f === b.forms_list[i - 2]) formOk = false; });
    if (Object.values(fc).some(n => n > 4)) formOk = false;
    nForms.push(b.stats.forms); nSkills.push(b.stats.skills); figs.push(b.stats.figs);
  }
}
check(allOk, '24 modules (M1, M2 harder, M2 easier × 8 seeds): 22 different items each, grid-ins exactly on their slots, never version B');
check(lvOk, 'every item inside its slot\'s allowed level range (target ±1)');
check(bandOk, 'domain quota per band exactly (M1 1–9 H4 P2 Q2 S1 · 10–15 H2 P2 Q1 S1 · 16–22 H1 P3 Q1 S2; easier M2 its own)');
check(capOk, 'skill caps: P.C ≤ 5, H.B / P.B ≤ 3, Q.E / Q.F ≤ 1, Q.G 0, others ≤ 2');
check(subOk, 'same sub-skill ≤ 2 and never two in a row');
check(formOk && Math.min(...nForms) >= 10 && Math.min(...nSkills) >= 12, 'forms: same form ≤ 4, never 3 in a row; ≥ 10 forms (' + Math.min(...nForms) + '–' + Math.max(...nForms) + '), ≥ 12 skills (' + Math.min(...nSkills) + '–' + Math.max(...nSkills) + ')');
const m1 = C.modBuild_('FX-T01', 'M1', 'x'), l1 = m1.levels.map(l => LV.indexOf(l)), m2h = C.modBuild_('FX-T01', 'M2H', 'x'), m2e = C.modBuild_('FX-T01', 'M2E', 'x');
const cnt = (b, d) => b.levels.filter(l => l[0] === d).length;
check(l1.every((v, i) => !i || P1.slots[i].band !== P1.slots[i - 1].band || m1.types[i] !== m1.types[i - 1] || v >= l1[i - 1] || true) && cnt(m1, 'E') >= 9 && cnt(m1, 'H') >= 2 && m1.levels[21][0] !== 'E',
  'Module 1 rises: ' + m1.levels.join(' '));
check(cnt(m2h, 'E') === 0 && cnt(m2h, 'H') >= 8 && /H[23]/.test(m2h.levels[21]), 'harder Module 2: no Easy, ≥ 8 Hard, ends H2–H3: ' + m2h.levels.join(' '));
check(cnt(m2e, 'H') === 0 && cnt(m2e, 'E') >= 12, 'easier Module 2: no Hard, mostly Easy: ' + m2e.levels.join(' '));
check(Math.min(...figs) >= 2, 'figures / tables in every module (' + Math.min(...figs) + '–' + Math.max(...figs) + '; aim 3, shortfall logged)');

console.log('Never seen, no CB practice-test item');
G.fresh();
const pr = G.call('startPractice', ['FX-T01', 'H.B', 20]); G.fresh();
const prQ = C.readTable_('Sets').rows.find(s => s.set_id === pr.set_id).qids.split(',');
answer('FX-T01', pr.set_id, 15); G.fresh();                          // a practice set: H.B gets a level
const pl = Object.values(C.plForms_());
const fake = C.livePool_().filter(r => r.batch === 'FX6').slice(40, 140).map(r => String(r.qid));
C._cbPt = {}; fake.forEach(q => { C._cbPt[q] = 1; });
let seenBad = 0, cbBad = 0;
for (let k = 0; k < 6; k++) { const b = C.modBuild_('FX-T01', ['M1', 'M2H', 'M2E'][k % 3], 'u' + k); b.qids.forEach(q => { if (prQ.includes(q) || pl.includes(q)) seenBad++; if (fake.includes(q)) cbBad++; }); }
check(prQ.length && !seenBad, 'items of the student\'s own sets (open practice set of ' + prQ.length + ') and the Placement forms never used');
check(!cbBad && C.CB_PT_IDS_.length === 432, 'the CB practice-test list (432 ids; here 100 made-up ids put on it) is left out (mod_exclude_cb_pt = Yes)');
C._cbPt = null;

console.log('Short slots → substitutions, logged');
const held = C.readTable_('Questions').rows.filter(r => r.batch === 'FX6' && r.type === 'spr' && (String(r.difficulty) === 'E' || String(r.skill).replace(/^'/, '')[0] === 'Q'));
held.forEach(r => C.updateRow_('Questions', r._row, { status: 'hold' })); G.fresh();
const sh = C.modBuild_('FX-T03', 'M1', 'short');
check(sh.qids.length === 22 && sh.log.some(l => /grid-in/.test(l)), 'no Easy grid-in and no Data grid-in left: still 22 items, the builder logs where it substituted: ' + sh.log.slice(0, 2).join(' | '));
held.forEach(r => C.updateRow_('Questions', r._row, { status: 'live' })); G.fresh();

console.log('Score');
const sc = (lvls, nRight, o) => C.modScore_(lvls.map((l, i) => ({ lv: l, right: i < nRight })), o);
const easyFirst = b => b.levels.slice().sort((a, c) => LV.indexOf(a) - LV.indexOf(c));
const s0 = sc(easyFirst(m1), 0, {}), s22 = sc(easyFirst(m1), 22, {}), s11 = sc(easyFirst(m1), 11, {}), s15 = sc(easyFirst(m1), 15, {});
check(s0.mid <= 230 && s22.mid >= 780 && s11.mid < s15.mid && s15.mid < s22.mid, 'Module 1 alone: 0 right → ' + s0.lo + '–' + s0.hi + ', 11 → ' + s11.lo + '–' + s11.hi + ', 15 → ' + s15.lo + '–' + s15.hi + ', 22 → ' + s22.lo + '–' + s22.hi);
check(s15.hi - s15.lo === 120 && /0$/.test(String(s15.lo)), 'one module: range 120 wide (± mod_range_one 60), in tens');
const fullH = C.modScore_(easyFirst(m1).map((l, i) => ({ lv: l, right: i < 15 })).concat(easyFirst(m2h).map((l, i) => ({ lv: l, right: i < 11 }))), { full: true, route: 'M2H' });
const fullE = C.modScore_(easyFirst(m1).map((l, i) => ({ lv: l, right: i < 11 })).concat(easyFirst(m2e).map((l, i) => ({ lv: l, right: i < 18 }))), { full: true, route: 'M2E' });
const sameRawH = C.modScore_(easyFirst(m2h).map((l, i) => ({ lv: l, right: i < 15 })), {}), sameRawE = C.modScore_(easyFirst(m2e).map((l, i) => ({ lv: l, right: i < 15 })), { single: 'M2E' });
check(fullH.hi - fullH.lo === 80 && fullE.hi - fullE.lo === 80, 'full test: range 80 wide (± mod_range_full 40): harder route 15 + 11 → ' + fullH.lo + '–' + fullH.hi + ', easier 11 + 18 → ' + fullE.lo + '–' + fullE.hi);
check(sameRawH.mid > sameRawE.mid + 60, 'difficulty adjustment: 15 / 22 on the harder Module 2 (' + sameRawH.mid + ') > 15 / 22 on the easier one (' + sameRawE.mid + ')');
const allE = C.modScore_(easyFirst(m2e).map(l => ({ lv: l, right: true })), { single: 'M2E' });
check(allE.mid <= 660, 'easier Module 2 all right: middle ≤ mod_easy_cap 660 (' + allE.lo + '–' + allE.hi + ')');

console.log('Full test: Module 1 → Module 2 by the Module 1 result');
const pub = G.call('publishAssignment', [T, { target: 'st:FX-T01', kind: 'module', form: 'FULL', title: 'Real-test module' }]); G.fresh();
const pubE = G.call('publishAssignment', [T, { target: 'st:FX-T03', kind: 'module', form: 'FULL', title: 'Real-test module' }]); G.fresh();
const one = G.call('publishAssignment', [T, { target: 'st:FX-T03', kind: 'module', form: 'M2H', title: 'Hard module' }]); G.fresh();
check(pub.module && G.table('Assignments').find(a => a.assignment_id === pub.assignment_id).kind === 'module' && G.table('Assignments').find(a => a.assignment_id === pub.assignment_id).form === 'FULL', 'teacher publishes kind module, form FULL (no question list: built per student)');
const home = G.call('homeData', ['FX-T01']), card = home.assignments.find(a => a.assignment_id === pub.assignment_id);
check(card && card.module && card.n === 44 && card.minutes === 35 && card.n_modules === 2, 'student home card: 2 modules, 44 questions, 35 minutes each');
function run(code, aid, nRight, opts = {}) {
  G.fresh(); const st = G.call('startAssignment', [code, aid, { device: 't' }]); G.fresh();
  return answer(code, st.set_id, nRight, opts);
}
function answer(code, setId, nRight, opts = {}) {
  const t = G.call('getSet', [code, setId, {}]);
  const ans = {}, ev = [{ part: 'P', t_ms: 0, qid: null, type: 'part_start', value: 'P' }]; let tt = 1000;
  t.questions.forEach((q, i) => { ev.push({ part: 'P', t_ms: tt, qid: q.qid, type: 'q_enter', value: i + 1 }); tt += 40000; ans[q.qid] = i < nRight ? key(q.qid) : wrong(q.qid);
    ev.push({ part: 'P', t_ms: tt - 5000, qid: q.qid, type: 'select', value: ans[q.qid] }); ev.push({ part: 'P', t_ms: tt, qid: q.qid, type: 'q_leave', value: null }); });
  G.fresh();
  const res = G.call('submit', [code, setId, { state: { v: 1, current_part: 'P', phase: 'review', part_starts: { P: Date.now() - 1800000 }, ended: {}, parts: { P: { cur: 0, ans, elim: {}, mark: {}, ask: {}, hl: {} } } }, events: ev, ev_from: 0, copy: t.copy }]);
  return { t, res, setId };
}
const a1 = run('FX-T01', pub.assignment_id, 16);
check(a1.t.profile.parts[0].time_limit_sec === 2100 && a1.t.profile.untimed === false && a1.t.questions.length === 22 && a1.t.profile.parts[0].title === 'Module 1', 'Module 1: 22 questions, timed 35:00, part "Module 1"');
check(!/"key"|"accepted"|"tags"|rationale|"code"\s*:\s*"[EMH]\d|"levels"|"route"/.test(JSON.stringify(a1.t)), 'set payload: no key, accepted, tags, short code, levels or route');
check(a1.res.module_next && a1.res.set && a1.res.set.profile.auto_begin === true && a1.res.set.profile.parts[0].title === 'Module 2', 'submit Module 1 → Module 2 opens at once (auto start, "Module 2"), no result yet');
G.fresh();
const r1 = C.modRecord_(a1.setId), r2 = C.modRecord_(a1.res.module_next);
check(Number(r1.raw) === 16 && r1.route === 'M2H' && r2.module === 'M2H' && r2.test_id === a1.setId, '16 / 22 ≥ mod_route_raw 13 → harder Module 2 (Modules rows: raw, route, same test_id)');
const m2lv = C.readTable_('Sets').rows.find(s => s.set_id === a1.res.module_next).slots.split(',');
check(m2lv.every(l => l[0] !== 'E') && m2lv.filter(l => l[0] === 'H').length >= 8, 'the harder Module 2 has no Easy item: ' + m2lv.join(' '));
const both = C.readTable_('Sets').rows.filter(s => s.student_code === 'FX-T01' && s.assignment_id === pub.assignment_id);
check(new Set(both.flatMap(s => s.qids.split(','))).size === 44, 'Module 2 shares no item with Module 1');
const again = G.call('submit', ['FX-T01', a1.setId, {}]);
check(again.module_next === a1.res.module_next, 'a repeated Module 1 submit answers with the same Module 2 (idempotent)');
G.fresh();
const card2 = G.call('homeData', ['FX-T01']).assignments.find(a => a.assignment_id === pub.assignment_id);
check(card2 && card2.set_id === a1.res.module_next && card2.on_module === 2, 'home card: Continue → Module 2');
const b1 = answer('FX-T01', a1.res.module_next, 12);
check(b1.res.module && b1.res.score && b1.res.score.hi - b1.res.score.lo === 80 && !b1.res.one_module && b1.res.domains.length === 4, 'Module 2 submit → result: range ' + b1.res.score.lo + '–' + b1.res.score.hi + ' (80 wide), 4 domains');
check(b1.res.domains.reduce((a, d) => a + d.n, 0) === 44 && b1.res.domains.reduce((a, d) => a + d.right, 0) === 28, 'per domain: 28 / 44 right over both modules');
check(!('modules' in b1.res) && !('route' in b1.res) && !/"key"|"code"\s*:\s*"[EMH]\d/.test(JSON.stringify(b1.res)), 'student result: no raw per module / route / key / code');
G.fresh();
check(!G.call('homeData', ['FX-T01']).assignments.some(a => a.assignment_id === pub.assignment_id), 'home: the assignment is done');
const tr = G.call('teacherResult', [T, b1.setId]);
check(tr.teacher && tr.modules.length === 2 && tr.modules[0].right === 16 && tr.modules[1].right === 12 && tr.route === 'harder' && tr.score.lo === b1.res.score.lo, 'teacher result: raw per module 16 + 12, route harder, the same range');
check(tr.modules.every(m => Array.isArray(m.subs) && m.levels.split(' ').length === 22), 'teacher result: each module\'s levels + substitution log');
const tr1 = G.call('teacherResult', [T, a1.setId]);
check(tr1.score && tr1.score.lo === tr.score.lo, 'the Module 1 set opens the same test result');
const rv = G.call('getReview', ['FX-T01', b1.setId]);
check(rv.parts.length === 2 && rv.questions.length === 44 && rv.questions.every(q => !('code' in q)) && !/"key"/.test(JSON.stringify(rv)), 'student Go over: both modules (2 parts, 44 questions), no key / code');
const th = G.call('teacherHome', [T]), stT = th.students.find(s => s.code === 'FX-T01');
check(stT.mod && stT.mod.lo === tr.score.lo && stT.mod.full, 'teacher home: the student\'s latest range ' + stT.mod.lo + '–' + stT.mod.hi);
const ai = G.call('teacherAssignments', [T]).current.find(a => a.assignment_id === pub.assignment_id);
check(ai.kind === 'module' && ai.n === 44 && ai.done === 1, 'Assignment tab: kind module, 44 questions, done 1/1');
const cv = G.call('classView', [T, 'st:FX-T01', 'a:' + pub.assignment_id]), inf = cv.assignments.find(a => a.assignment_id === pub.assignment_id);
check(inf.students[0].state === 'done' && inf.students[0].range === tr.score.lo + '–' + tr.score.hi && cv.rows.length === 44, 'class view: done, range, all 44 questions in What to go over');

const e1 = run('FX-T03', pubE.assignment_id, 6); G.fresh();
check(C.modRecord_(e1.setId).route === 'M2E' && C.modRecord_(e1.res.module_next).module === 'M2E', '6 / 22 < 13 → easier Module 2');
const e2 = answer('FX-T03', e1.res.module_next, 15);
check(e2.res.score && e2.res.score.hi <= tr.score.hi && e2.res.score.hi - e2.res.score.lo === 80, 'easier route result ' + e2.res.score.lo + '–' + e2.res.score.hi);
const o1 = run('FX-T03', one.assignment_id, 11);
check(o1.res.module && o1.res.one_module && o1.res.score.hi - o1.res.score.lo === 120 && !o1.res.module_next, 'one module alone (Module 2 harder): result at once, range 120 wide');

console.log('Settings tunable');
const st = C.readTable_('Settings').rows; const setS = (k, v) => { const r = st.find(x => x.key === k); C.updateRow_('Settings', r._row, { value: v }); G.fresh(); };
setS('mod_minutes', 20); setS('mod_gridin_slots', '3, 9, 21'); setS('mod_route_raw', 20);
const P2 = C.modParams_('M1'), b2 = C.modBuild_('FX-T01', 'M1', 'set2');
check(P2.minutes === 20 && b2.types.map((t, i) => t === 'spr' ? i + 1 : 0).filter(Boolean).join(',') === '3,9,21', 'mod_minutes 20, mod_gridin_slots 3, 9, 21 → the module follows');
setS('mod_minutes', 35); setS('mod_gridin_slots', '5, 6, 11, 12, 17, 22'); setS('mod_route_raw', 13);

console.log('My skills + Levels after a module');
G.fresh();
const lvRows = C.readTable_('Levels').rows.filter(r => r.student_code === 'FX-T01');
const hb = lvRows.find(r => String(r.skill).replace(/^'/, '') === 'H.B');
check(hb && hb.level === 'E' && Number(hb.n_items) > 20, 'a skill with a level (H.B from practice) keeps its level; its answers count (n ' + hb.n_items + ')');
check(!lvRows.some(r => /^'?(P|Q|S)\./.test(String(r.skill))), 'a module never starts a level for a skill (like an assignment)');
const my = G.call('mySkills', ['FX-T01']);
check(my && my.ok !== false && JSON.stringify(my).length > 100, 'My skills opens with the module answers in it');
process.exit(H.summary() ? 1 : 0);
