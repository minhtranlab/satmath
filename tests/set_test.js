// Server-side suite (real src/*.gs in the Apps Script mock, made-up fixture library FX1):
// Sheet update (tabs, Skills, Batches, Questions) · library loader + cache · login · home · start a set · getSet whitelist
// (never key / accepted / tags) · figures per set · autosave · submit + grading + Responses · result · review · teacher.
const fs = require('fs'), path = require('path');
const { makeGas, LIB } = require('./server');
let F = 0, P = 0; const check = (c, m) => { if (c) { P++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ FAIL: ' + m); } };
const throws = (fn) => { try { fn(); return ''; } catch (e) { return e.message; } };

console.log('Sheet update (first run on an empty spreadsheet)');
const G = makeGas({ live: false });
const C = G.ctx;
const tabNames = G.order.map(k => G.sheets[k].name);
['README', 'Settings', 'Students', 'Classes', 'Sets', 'Responses', 'Tries', 'Review', 'Levels', 'Assignments', 'Skill_Summary', 'Questions', 'Batches', 'Skills', 'Events', 'Dictionary', 'Time_Norms']
  .forEach(t => check(tabNames.includes(t), 'tab ' + t));
check(!tabNames.includes('Sheet1'), 'empty Sheet1 renamed to README');
const skills = G.table('Skills');
check(skills.length >= 104 && skills.every(r => r.skill && r.skill_name), 'Skills tab: ' + skills.length + ' rows, every row has its CB skill + name');
check(skills.some(r => r.subskill === 'H.B.3' && r.skill === 'H.B'), 'skill and sub-skill are separate fields');
const qrowsAll = G.table('Questions'), qrows = qrowsAll.filter(r => r.batch === 'FX1');
check(qrows.length === 8 && qrows.every(r => r.status === 'live'), 'Questions tab: 8 FX1 rows, status live');
check(qrowsAll.filter(r => r.batch === 'FX2').length === 36 && qrowsAll.find(r => r.qid === 'FX2-B01').status === 'candidate', 'FX2: 36 rows, the version-B item = candidate');
check(qrowsAll.find(r => r.qid === 'FX2-001').code === 'E9001', 'Questions.code = the short code from the file');
check(qrows.every(r => !('stem_html' in r)) && !JSON.stringify(G.table('Questions')).includes('<p>'), 'Questions tab holds no question text');
check(qrows.find(r => r.qid === 'FX1-005').accepted === '3/4|.75|0.75', 'grid-in accepted forms kept as text ("3/4" not a date)');
const b = G.table('Batches');
check(b.length === 2 && b[0].batch === 'FX1' && b[0].live === 'No' && Number(b[0].n_items) === 8 && b[1].live === 'No', 'Batches: FX1 (8 items) + FX2, live = No (new batches)');
const settings = G.table('Settings');
check(settings.some(r => r.key === 'mistake_types' && /Concept Gap; Didn't Understand The Question; Misread A Detail; Careless Calculation; Wrong Input\/Format; Others; Not A Mistake/.test(r.value)), "Settings: Minh's 7 mistake types in order");
check(settings.find(r => r.key === 'teacher_code').value === 'TEACH-FX-9', 'Settings: an existing value is never changed');
check(/^v0\.\d/.test(settings.find(r => r.key === 'code_version').value), 'code_version stamped');
check(/already up to date/.test(C.runUpdateIfNeeded_()), 'second ping: already up to date');
check(G.table('Time_Norms').length === 6, 'Time_Norms: 6 Math rows');

console.log('Library: live switch, cache, Sheet key wins');
G.fresh();
check(C.livePool_().length === 0, 'batch live = No → nothing served');
const brow = C.readTable_('Batches').rows[0]; C.updateRow_('Batches', brow._row, { live: 'Yes' }); G.fresh();
check(C.livePool_().length === 8, 'batch live = Yes → 8 questions served');
G.cache.clear(); G.fresh(); const r0 = G.dstats.reads; C.libQuestions_(['FX1-001']); G.fresh(); C.libQuestions_(['FX1-002']);
check(G.dstats.reads === r0 + 1, 'batch file read from Drive once, then from CacheService');
const q2 = C.readTable_('Questions').rows.find(r => r.qid === 'FX1-002');
C.updateRow_('Questions', q2._row, { key: 'D' }); G.fresh();
check(C.libQuestions_(['FX1-002'])[0].key === 'D', 'a key typed in the Questions tab wins over the file');
C.updateRow_('Questions', q2._row, { key: "'B" }); G.fresh();
const hold = C.readTable_('Questions').rows.find(r => r.qid === 'FX1-008');
C.updateRow_('Questions', hold._row, { status: 'hold' }); G.fresh();
check(!C.livePool_().some(r => r.qid === 'FX1-008'), 'status hold → never served');
C.updateRow_('Questions', hold._row, { status: 'live' }); G.fresh();

console.log('Login');
check(G.call('login', ['fx-t01', 'D1']).ok === true, 'student code (any case) signs in');
check(G.call('login', ['FX-T02', 'D1']).ok === false, 'locked student refused');
const bad = G.call('login', ['NOPE', 'D2']);
check(bad.ok === false && /not found/.test(bad.msg), 'wrong code → "Code not found"');
check(/LOGIN/.test(throws(() => G.call('homeData', ['NOPE']))), 'wrong code → no home data');
check(/LOGIN/.test(throws(() => G.call('getSet', ['NOPE', 'S-x', {}]))), 'wrong code → no questions');
check(G.call('login', ['TEACH-FX-9', 'D3']).teacher === true, 'teacher code → teacher mode');

console.log('Home + start a set');
G.fresh();
const h = G.call('homeData', ['FX-T01']);
const hb = h.domains.find(d => d.domain === 'H').skills.find(s => s.skill === 'H.B');
check(h.ok && h.domains.length === 4 && hb.live === 6 && hb.fresh === 6, 'home: 4 areas; Linear functions 6 live, 6 new');
check(hb.subs.length >= 5 && hb.subs.every(s => s.dot === 'n'), 'sub-skills listed, grey dots (nothing done yet)');
check(/Choose/.test(throws(() => G.call('startPractice', ['FX-T01', 'H.B', 7]))), 'only 5 / 10 / 20 allowed');
check(/no questions/.test(throws(() => G.call('startPractice', ['FX-T01', 'S.D', 5]))), 'skill with no live questions → clear message');
G.fresh();
const sp = G.call('startPractice', ['FX-T01', 'H.B', 5]);
check(sp.ok && /^S-\d{8}-FX-T01-1$/.test(sp.set_id) && sp.n === 5, 'set created: ' + sp.set_id + ' (5 questions)');
G.fresh();
const sp2 = G.call('startPractice', ['FX-T01', 'H.B', 5]);
check(sp2.set_id === sp.set_id && sp2.resumed, 'same skill again while open → the open set comes back');
const setRow = G.table('Sets')[0];
const qids = setRow.qids.split(',');
const diffs = qids.map(id => qrows.find(r => r.qid === id).difficulty);
check(qids.length === 5 && new Set(qids).size === 5 && qids.every(id => qrows.find(r => r.qid === id).skill === 'H.B'), 'set = 5 different H.B questions');
check(diffs.join('') === [...diffs].sort((a, b) => 'EMH'.indexOf(a) - 'EMH'.indexOf(b)).join(''), 'easier → harder: ' + diffs.join(' '));

console.log('getSet: whitelist, figures, other students');
G.fresh();
const t = G.call('getSet', ['FX-T01', sp.set_id, { device: 'test' }]);
const pay = JSON.stringify(t);
check(t.ok && t.questions.length === 5 && t.profile.untimed && t.profile.parts[0].time_limit_sec === 0, 'set opens: 5 questions, one untimed part');
check(!/"key"|"accepted"|key_source|"tags"|"source"|transcription_notes|rationale|drive_id/.test(pay), 'payload has no key / accepted / key_source / tags / source / notes / drive id');
const withFig = t.questions.find(q => q.figures.length);
const firstThree = t.questions.slice(0, 3).map(q => q.qid);
if (withFig) {
  const inFirst = firstThree.includes(withFig.qid);
  check(inFirst ? /^data:image\/png;base64,/.test(withFig.figures[0].src) : withFig.figures[0].src === '', 'figure of ' + withFig.qid + (inFirst ? ' comes with the set (first 3)' : ' not in the set payload (later)'));
  const gf = G.call('getFigures', ['FX-T01', sp.set_id, [withFig.figures[0].fid]]);
  check(/^data:image\/png;base64,iVBOR/.test(gf.figures[withFig.figures[0].fid]), 'getFigures → the PNG as a data: URI (no Drive link)');
}
check(/SESSION/.test(throws(() => G.call('getSet', ['FX-T03', sp.set_id, {}]))), 'another student cannot open this set');
check(/SESSION/.test(throws(() => G.call('getFigures', ['FX-T03', sp.set_id, ['FX1-003#0']]))), 'another student gets no figures of it');
check(Object.keys(G.call('getFigures', ['FX-T01', sp.set_id, ['FX1-007#0', 'x#1']]).figures).length === 0, 'figures of questions outside the set → nothing');

console.log('autosave + submit + grading');
const qs = t.questions;
const answers = {};
const keyOf = id => { const r = qrows.find(x => x.qid === id); return r.type === 'spr' ? r.key : r.key; };
qs.forEach((q, i) => { if (i === 0) return; answers[q.qid] = i === 1 ? (q.type === 'spr' ? '99' : ['A', 'B', 'C', 'D'].find(l => l !== keyOf(q.qid))) : keyOf(q.qid); });
const events = [{ part: 'P', t_ms: 0, qid: null, type: 'part_start', value: 'P' }];
let tt = 1000;
qs.forEach(q => { events.push({ part: 'P', t_ms: tt, qid: q.qid, type: 'q_enter', value: 1 }); tt += 20000;
  if (answers[q.qid]) events.push({ part: 'P', t_ms: tt, qid: q.qid, type: 'select', value: answers[q.qid] }); tt += 50000;
  events.push({ part: 'P', t_ms: tt, qid: q.qid, type: 'q_leave', value: null }); });
const state = { v: 1, session_id: sp.set_id, current_part: 'P', phase: 'review', part_starts: { P: Date.now() - 400000 }, ended: {},
                parts: { P: { cur: 4, ans: Object.assign({}, answers, { 'FX1-007': 'C', bogus: 'A' }), elim: {}, mark: {}, hl: {} } } };
G.fresh();
const a1 = G.call('autosave', ['FX-T01', sp.set_id, { state, events: events.slice(0, 3), ev_from: 0, copy: t.copy }]);
check(a1.ok && G.table('Events').length === 3, 'autosave stores the event delta (3 rows)');
const saved = JSON.parse(G.table('Sets')[0].state_json);
check(!saved.parts.P.ans.bogus && !saved.parts.P.ans['FX1-007'], 'answers for questions outside the set are dropped');
check(G.call('autosave', ['FX-T01', sp.set_id, { state, events: [], ev_from: 3, copy: 'old-window' }]).other_copy === true, 'an older window is refused (one live copy)');
G.fresh();
const res = G.call('submit', ['FX-T01', sp.set_id, { state, events, ev_from: 0, copy: t.copy, device: 'test' }]);
check(res.ok && res.first_try.right === 3 && res.first_try.n === 5 && res.best.right === 3, 'submit: First Try 3/5 (1 blank, 1 wrong), Best Score 3/5');
check(!/"key"|accepted|correct answer/i.test(JSON.stringify(res)), 'result has no key');
const resp = G.table('Responses');
check(resp.length === 5 && resp.every(r => r.set_id === sp.set_id && r.skill === 'H.B' && r.subskill), 'Responses: 5 rows with skill + sub-skill');
check(resp.filter(r => r.profile === 'BLANK').length === 1 && resp.filter(r => String(r.try1_correct) === '0').length === 1, 'one blank, one wrong');
check(resp.every(r => r.profile === 'BLANK' || Number(r.time_try1_sec) === 70), 'time per question from the events (70 s each)');
const sr = G.table('Sets')[0];
check(sr.status === 'submitted' && Number(sr.first_try) === 3 && Number(sr.best_score) === 3 && sr.progress === 'Submitted', 'Sets row: submitted, 3 / 3');
check(G.call('submit', ['FX-T01', sp.set_id, { state, events, ev_from: 0, copy: t.copy }]).first_try.right === 3 && G.table('Responses').length === 5, 'second submit = same result, no new rows');
check(res.groups.length === 1 && res.groups[0].rows[0].name === 'Linear functions', 'result by skill: Algebra → Linear functions');
check(res.types.find(x => x.label === 'Blank').n === 1, 'types of mistakes: 1 blank');

console.log('review + teacher');
G.fresh();
const rv = G.call('getReview', ['FX-T01', sp.set_id]);
check(rv.ok && rv.questions.length === 5 && rv.questions.every(q => ['right', 'wrong', 'blank'].includes(q.status)), 'review: every question with its status');
check(!/"key"|"accepted"/.test(JSON.stringify(rv)), 'review has no key');
check(/LOGIN/.test(throws(() => G.call('teacherAnswer', ['FX-T01', sp.set_id, qs[0].qid]))), 'a student cannot call teacherAnswer');
const ta = G.call('teacherAnswer', ['TEACH-FX-9', sp.set_id, qs[0].qid]);
check(ta.ok && ta.key.length >= 1, 'teacher: Show answer → key of that one question');
const ov = G.call('teacherOverview', ['TEACH-FX-9']);
check(ov.students.find(s => s.code === 'FX-T01').attempts.length === 1, 'teacher overview lists the set');
G.fresh();
const h2 = G.call('homeData', ['FX-T01']);
check(h2.history.length === 1 && h2.history[0].first_try === 3 && h2.open.length === 0, 'home: history shows First Try 3/5, nothing open');
check(h2.domains.find(d => d.domain === 'H').skills.find(s => s.skill === 'H.B').fresh === 1, 'home: 1 new question left in Linear functions');
const next = G.call('startPractice', ['FX-T01', 'H.B', 5]);
G.fresh();
const nq = G.table('Sets').find(s => s.set_id === next.set_id).qids.split(',');
check(nq[0] !== undefined && nq.includes(qrows.filter(r => r.skill === 'H.B').map(r => r.qid).find(id => !qids.includes(id))), 'next set: the unseen question comes first');

console.log(`\n${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
