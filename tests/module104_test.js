// #104 a real-test module has the SAME report as any assignment (Minh 24/11): below the score header the result is the normal
// set report built by the same code (resultCore_): First Try / Best, skills, types of mistakes (slow / rush), one question grid
// per module, the teacher's time + flag under every cell, Fix wrong answers and Ask across both modules, the teacher's go-over of
// the whole test, mistake tags → Review + My mistakes. Compared with a practice set answered in the same way.
const { makeGas } = require('./server');
const { modLib } = require('./modlib');
const H = require('./h'); const { check } = H;
const G = makeGas({ libDir: modLib() }), C = G.ctx, T = 'TEACH-FX-9';
const fx6 = C.readTable_('Batches').rows.find(x => x.batch === 'FX6'); C.updateRow_('Batches', fx6._row, { live: 'Yes' }); C._batchLive = null; G.fresh();
const Q = {}; G.table('Questions').forEach(r => { Q[r.qid] = r; });
const key = id => String(Q[id].key).replace(/^'/, ''), wrong = id => Q[id].type === 'spr' ? '999' : ['A', 'B', 'C', 'D'].find(l => l !== key(id));
// pattern by position: 0–9 right in 60 s · 10–12 right in 400 s (slow) · 13–15 wrong in 6 s (rushed) · 16–18 wrong in 90 s · 19–21 blank
const plan = i => i < 10 ? [true, 60] : i < 13 ? [true, 400] : i < 16 ? [false, 6] : i < 19 ? [false, 90] : [null, 30];
function answer(code, setId) {
  const t = G.call('getSet', [code, setId, {}]);
  const ans = {}, ev = [{ part: 'P', t_ms: 0, qid: null, type: 'part_start', value: 'P' }]; let tt = 1000;
  t.questions.forEach((q, i) => { const [ok, sec] = plan(i);
    ev.push({ part: 'P', t_ms: tt, qid: q.qid, type: 'q_enter', value: i + 1 }); tt += sec * 1000;
    if (ok !== null) { ans[q.qid] = ok ? key(q.qid) : wrong(q.qid); ev.push({ part: 'P', t_ms: tt - 500, qid: q.qid, type: 'select', value: ans[q.qid] }); }
    ev.push({ part: 'P', t_ms: tt, qid: q.qid, type: 'q_leave', value: null }); });
  G.fresh();
  return G.call('submit', [code, setId, { state: { v: 1, current_part: 'P', phase: 'review', part_starts: { P: Date.now() - tt }, ended: {}, parts: { P: { cur: 0, ans, elim: {}, mark: {}, ask: {}, hl: {} } } }, events: ev, ev_from: 0, copy: t.copy }]);
}
// a practice-like assignment of 22 questions (normal report) and a full real-test module, same student, same answering pattern
const pool = C.livePool_().filter(r => r.batch === 'FX6').map(r => String(r.qid));
const hw = G.call('publishAssignment', [T, { target: 'st:FX-T01', qids: pool.slice(400, 422), title: 'HW compare' }]); G.fresh();
const st0 = G.call('startAssignment', ['FX-T01', hw.assignment_id, {}]); G.fresh();
const hwRes = answer('FX-T01', st0.set_id); G.fresh();
const md = G.call('publishAssignment', [T, { target: 'st:FX-T01', kind: 'module', form: 'FULL', title: 'Real-test module' }]); G.fresh();
const m1 = G.call('startAssignment', ['FX-T01', md.assignment_id, {}]); G.fresh();
const r1 = answer('FX-T01', m1.set_id); G.fresh();
const res = answer('FX-T01', r1.module_next); G.fresh();
const M2 = r1.module_next, M1 = m1.set_id;

console.log('Student result = the normal report + the score on top');
const same = ['first_try', 'best', 'groups', 'types', 'review', 'fix', 'asked', 'show', 'valid', 'session_id', 'title', 'date'];
check(same.every(k => k in res) && same.every(k => k in hwRes), 'the same blocks as an assignment result: ' + same.join(', '));
check(res.score && res.domains.length === 4 && res.route && 'first_try' in res, 'plus the score header: range ' + res.score.lo + '–' + res.score.hi + ', route ' + res.route + ', 4 domains');
const prof = r => r.types.map(t => t.label + ' ' + t.n).join(' · ');
const twice = s => s.replace(/\d+/g, n => String(2 * n));
check(prof(res) === twice(prof(hwRes)), 'types of mistakes (slow / rush / wrong / blank) = 2 × the assignment\'s: ' + prof(res));
check(res.first_try.right === 26 && res.first_try.n === 44 && hwRes.first_try.right === 13, 'First Try 26/44 (assignment 13/22)');
check(res.review.length === 2 && res.review.map(p => p.title).join(' + ') === 'Module 1 + Module 2' && res.review.every(p => p.questions.length === 22), 'one question grid per module (Module 1, Module 2), 22 each');
const flags = r => r.review.map(p => p.questions.map(q => q.status[0] + (q.badge || '-')).join('')).join('|');
check(flags(res) === flags(hwRes) + '|' + flags(hwRes), 'every cell: right / wrong / blank + S / R the same as the assignment (' + flags(hwRes) + ')');
check(!res.review.some(p => p.questions.some(q => 't' in q)) && !/"key"|"accepted"|"code"\s*:\s*"[EMH]\d/.test(JSON.stringify(res)), 'student: no teacher times, no key, no short code');

console.log('Teacher result: the same + time and flag under every cell');
const tr = G.call('teacherResult', [T, M1]), thw = G.call('teacherResult', [T, st0.set_id]);
check(tr.teacher && tr.pace && thw.pace && tr.modules.length === 2 && tr.route === res.route && tr.score.lo === res.score.lo, 'score header (raw per module, route, range) + the pace line (time, leave-window log)');
const times = r => r.review.map(p => p.questions.map(q => q.t + (q.badge || '')).join(',')).join('|');
check(times(tr) === times(thw) + '|' + times(thw) && tr.review[0].questions.every(q => 'nm' in q), 'time + flag under every cell, time norms (nm) — the same as the assignment: ' + times(thw).slice(0, 60));

console.log('Fix, Ask, Go over, tags across both modules (one set id)');
const fx = G.call('getFix', ['FX-T01', M2]);
check(fx.parts.length === 2 && fx.questions.length === 18 && fx.questions.some(q => q.part === 'M1') && fx.best.n === 44 && !fx.fk, 'Fix wrong answers: the 18 open questions of both modules (best x/44)');
const m1Wrong = fx.questions.find(q => q.part === 'M1' && Q[q.qid].type === 'mcq');
const ck = G.call('checkTry', ['FX-T01', M2, m1Wrong.qid, key(m1Wrong.qid), 20]); G.fresh();
check(ck.correct && ck.best.right === 27 && ck.best.n === 44 && Number(G.table('Responses').find(r => r.set_id === M1 && r.qid === m1Wrong.qid).best_correct) === 1, 'a Check from the test (Module 2 set id) on a Module 1 question goes to Module 1 (best 27/44)');
const askQ = fx.questions.filter(q => q.part === 'M1')[1].qid;
G.call('askTeacher', ['FX-T01', M2, askQ, true, 'how?']); G.fresh();
const res2 = G.call('getResult', ['FX-T01', M2]);
check(res2.asked.length === 1 && / \(M1\)$/.test(res2.asked[0].code) && res2.best.right === 27, 'Ask on a Module 1 question → "You asked your teacher about: Q.. (M1)"; Best 27');
const tv = G.call('teacherReview', [T, M2]);
check(tv.questions.length === 44 && tv.parts.length === 2 && Object.keys(tv.keys || {}).length === 44 && tv.rows && tv.rows.length === 44, 'teacher Go over of the test: 44 questions in 2 parts, keys on "Show answer", the student\'s entries + times of all 44');
const before = G.call('mySkills', ['FX-T01']).mistakes;
const wr = tv.questions.filter(q => q.wrong && q.part === 'M1').slice(0, 2).concat(tv.questions.filter(q => q.wrong && q.part === 'M2').slice(0, 1));
wr.forEach(q => G.call('tagMistake', [T, M2, q.qid, 'Careless Calculation', '', false])); G.fresh();
const tagged = G.table('Responses').filter(r => r.mistake_type === 'Careless Calculation');
check(tagged.length === 3 && tagged.filter(r => r.set_id === M1).length === 2, 'mistake tags from the go-over land on the right module\'s answers (2 in Module 1, 1 in Module 2)');
check(wr.every(q => G.table('Review').some(r => r.student_code === 'FX-T01' && r.qid === q.qid && r.status === 'open')), 'the tagged questions are in the student\'s Review list');
const after = G.call('mySkills', ['FX-T01']).mistakes;
check(after.n === (before ? before.n : 0) + 3, 'My mistakes counts them like any set (' + after.n + ' tagged)');
const cv = G.call('classView', [T, 'st:FX-T01', 'a:' + md.assignment_id]);
check(cv.rows.length === 44 && cv.rows.every(r => r.students.length === 1 && r.students[0].time_s >= 0 && 'norm_s' in r.students[0] && 'profile' in r.students[0]), 'What to go over / Grid: the 44 answers, each with time, time norm and slow / rush profile');
process.exit(H.summary() ? 1 : 0);
