// Round 4 (made-up fixtures FX1 + FX2 + FX3): Mixed Practice (several skills, priority order, ≤ 2 per skill per 5,
// each item at the skill's level; blank profile = mini placement at Medium over 4 domains, up after right / down after wrong),
// new students start Easy, students never get short codes (the Ask-teacher record keeps it for the teacher).
const { makeGas } = require('./server');
let F = 0, P = 0; const check = (c, m) => { if (c) { P++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ FAIL: ' + m); } };
const G = makeGas(), C = G.ctx;
['FX2', 'FX3'].forEach(b => { const r = C.readTable_('Batches').rows.find(x => x.batch === b); C.updateRow_('Batches', r._row, { live: 'Yes' }); }); G.fresh();
const Q = {}; G.table('Questions').forEach(r => { Q[r.qid] = r; });
const sk = id => String(Q[id].skill).replace(/^'/, ''), key = id => String(Q[id].key).replace(/^'/, '');
const wrong = id => Q[id].type === 'spr' ? '999' : ['A', 'B', 'C', 'D'].find(l => l !== key(id));
function doSet(code, setId, how, ask) {
  G.fresh(); const t = G.call('getSet', [code, setId, {}]);
  const ans = {}, ev = [{ part: 'P', t_ms: 0, qid: null, type: 'part_start', value: 'P' }]; let tt = 1000;
  t.questions.forEach((q, i) => { ev.push({ part: 'P', t_ms: tt, qid: q.qid, type: 'q_enter', value: i + 1 }); tt += 60000;
    ans[q.qid] = how(q.qid, i) === 'right' ? key(q.qid) : wrong(q.qid); ev.push({ part: 'P', t_ms: tt - 100, qid: q.qid, type: 'select', value: ans[q.qid] }); ev.push({ part: 'P', t_ms: tt, qid: q.qid, type: 'q_leave', value: null }); });
  G.fresh();
  return { t, res: G.call('submit', [code, setId, { state: { parts: { P: { ans, elim: {}, mark: {}, ask: ask || {} } } }, events: ev, ev_from: 0, copy: t.copy }]) };
}
const setRow = id => { G.fresh(); return C.readTable_('Sets').rows.find(s => s.set_id === id); };
const lv = (c, k) => { G.fresh(); const r = C.readTable_('Levels').rows.find(x => x.student_code === c && String(x.skill).replace(/^'/, '') === k); return r ? r.level : ''; };

console.log('Mixed Practice — blank profile (mini placement)');
G.fresh();
const m1 = G.call('startMixed', ['FX-T03', 5]);
let row = setRow(m1.set_id), q = row.qids.split(',');
const skills = [...new Set(q.map(sk))], doms = [...new Set(q.map(id => sk(id)[0]))];
check(row.kind === 'mixed' && q.length === 5 && C.setTitle_(row) === 'Mixed Practice', 'Mixed 5 → a "Mixed Practice" set of 5');
check(skills.length >= 3 && doms.length >= 3, 'mixes ' + skills.length + ' skills over ' + doms.length + ' domains: ' + skills.join(' '));
check(q.every(id => Q[id].difficulty === 'M') && row.level_at_start === 'placement', 'no history yet → every item Medium (mini placement)');
const per = {}; q.forEach(id => { per[sk(id)] = (per[sk(id)] || 0) + 1; });
check(Object.values(per).every(n => n <= 2), 'at most 2 items per skill in a set of 5');
check(G.call('startMixed', ['FX-T03', 5]).set_id === m1.set_id, 'an open Mixed set comes back (Continue)');
const firstSkill = sk(q[0]);
const r1 = doSet('FX-T03', m1.set_id, (id) => sk(id) === firstSkill ? 'right' : 'wrong').res;
check(r1.title === 'Mixed Practice', 'result title "Mixed Practice"');
const after = skills.map(k => k + ':' + lv('FX-T03', k));
check(lv('FX-T03', firstSkill) === 'H' && skills.filter(k => k !== firstSkill).every(k => lv('FX-T03', k) === 'E'), 'levels move: right → up (M→H), wrong → down (M→E): ' + after.join(' '));

console.log('Mixed Practice — with a profile');
G.fresh();
const m2 = G.call('startMixed', ['FX-T03', 10]);
row = setRow(m2.set_id); q = row.qids.split(',');
const per2 = {}; q.forEach(id => { per2[sk(id)] = (per2[sk(id)] || 0) + 1; });
check(q.length === 10 && Object.values(per2).every(n => n <= 4) && Object.keys(per2).length >= 3, '10 questions, ≤ 4 per skill, ' + Object.keys(per2).length + ' skills');
const wrongSkills = skills.filter(k => k !== firstSkill);
check(wrongSkills.every(k => per2[k]), 'skills with unfixed wrong answers come first: ' + wrongSkills.join(' ') + ' all in the set');
const eSkillItems = q.filter(id => wrongSkills.includes(sk(id)));
check(eSkillItems.filter(id => Q[id].difficulty === 'E').length >= wrongSkills.length, 'items at the student\'s level for that skill (level E → Easy first)');
check(!q.some(id => C.readTable_('Responses').rows.some(r => r.student_code === 'FX-T03' && r.qid === id)), 'no question answered in the last 7 days');

console.log('New students start Easy (practice by skill)');
G.fresh();
const sp = G.call('startPractice', ['FX-T01', 'S.A', 5]);
row = setRow(sp.set_id);
check(row.level_at_start === 'E' && row.slots.split(',').length === 5, 'new student, Area and volume → level E (' + row.slots + ', only 2 Easy items exist)');

console.log('Codes: teacher only');
G.fresh();
const t = G.call('getSet', ['FX-T01', sp.set_id, {}]);
check(t.questions.every(x => !('code' in x)) && !/"code"\s*:\s*"[EMH]\d/.test(JSON.stringify(t)), 'student set payload: no short code');
const fq = t.questions[1].qid;
doSet('FX-T01', sp.set_id, () => 'wrong', { [fq]: 'help' });
G.fresh();
const rv = G.call('getReview', ['FX-T01', sp.set_id]), fx = G.call('getFix', ['FX-T01', sp.set_id]), res = G.call('getResult', ['FX-T01', sp.set_id]), home = G.call('homeData', ['FX-T01']);
check(![rv, fx, res, home].some(x => /"code"\s*:\s*"[EMH]\d/.test(JSON.stringify(x))), 'review, fix, result, home: no short code');
const ar = C.readTable_('Responses').rows.find(r => r.set_id === sp.set_id && r.qid === fq);
check(String(ar.ask_code).replace(/^'/, '') === Q[fq].code, 'Ask teacher → the code is kept for the teacher (Responses.ask_code ' + Q[fq].code + ')');
const tr = G.call('teacherReview', ['TEACH-FX-9', sp.set_id]);
check(tr.questions.every(x => /^[EMH]\d+$/.test(x.code)), 'teacher review: codes shown');

console.log(`\n${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
