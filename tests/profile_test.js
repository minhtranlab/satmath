// Skill_Profile (#35, made-up fixtures): allowed difficulties + weights per College Board skill.
// Circles at level E → only Medium level-1 items; Probability at level H → hardest Medium (level 2–3) or the few Hard items;
// Evaluating statistical claims: practice 5 only, all difficulties; Mixed Practice shares over 1,000 items within ±3 points of
// the weights; the assignment builder fills a missing difficulty from the neighbour and says so; editing the tab works at once.
const { makeGas } = require('./server');
let F = 0, P = 0; const check = (c, m) => { if (c) { P++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ FAIL: ' + m); } };
const G = makeGas(), C = G.ctx;
const live = b => { const r = C.readTable_('Batches').rows.find(x => x.batch === b); C.updateRow_('Batches', r._row, { live: 'Yes' }); };
['FX5'].forEach(live); G.fresh();
const Q = {}; G.table('Questions').forEach(r => { Q[r.qid] = r; });
const d = id => String(Q[id].difficulty), lv = id => Number(Q[id].level), sk = id => String(Q[id].skill).replace(/^'/, '');
const setLevel = (code, skill, level) => { G.fresh(); C.appendObjects_('Levels', [{ student_code: code, skill: C.txt_(skill), level: level, good_streak: 0 }]); G.fresh(); };
const setRow = (k, v) => { G.fresh(); const r = C.readTable_('Settings').rows.find(x => x.key === k); C.updateRow_('Settings', r._row, { value: v }); G.fresh(); };

console.log('The tab');
G.fresh();
const tab = C.readTable_('Skill_Profile').rows;
const w = tab.reduce((a, r) => a + Number(r.weight), 0);
check(tab.length === 19 && Math.abs(w - 100) < 0.2, 'Skill_Profile: 19 skills, weights sum to ' + w.toFixed(1) + ' %');
const row = k => tab.find(r => String(r.skill).replace(/^'/, '') === k);
check(row('S.D').allowed === 'M,H' && row('S.C').allowed === 'M,H' && row('Q.E').allowed === 'E,M' && row('Q.D').allowed === 'E,M', 'Circles, Right triangles: M,H · Probability, Two-variable data: E,M');
check(Number(row('Q.G').max_set) === 5 && Number(row('Q.F').max_set) === 5 && Number(row('Q.G').weight) === 2.5, 'Q.F, Q.G: weight 2.5 %, practice sets of 5');
const dom = { H: 0, P: 0, Q: 0, S: 0 }; tab.forEach(r => { dom[String(r.skill).replace(/^'/, '')[0]] += Number(r.weight); });
check(Math.abs(dom.H - 35) < .2 && Math.abs(dom.P - 35) < .2 && Math.abs(dom.Q - 15) < .2 && Math.abs(dom.S - 15) < .2, 'domain shares 35 / 35 / 15 / 15 %');

console.log('Practice by skill');
setLevel('FX-T01', 'S.D', 'E');
G.fresh(); const a = C.pickForPractice_('FX-T01', 'S.D', 5, 'seed-a');
check(a.level === 'E' && a.qids.length === 5 && a.qids.every(id => d(id) === 'M' && lv(id) === 1), 'Circles at level E → 5 Medium level-1 items (no Easy): ' + a.qids.map(id => d(id) + lv(id)).join(' '));
G.fresh(); const a10 = C.pickForPractice_('FX-T01', 'S.D', 10, 'seed-a10');
check(!a10.qids.some(id => d(id) === 'E') && a10.qids.filter(id => d(id) === 'M' && lv(id) === 1).length === 6, 'Circles at level E, 10 questions: all 6 Medium level 1 first, never Easy (' + a10.qids.map(id => d(id) + lv(id)).join(' ') + ')');
// a second Circles set after missing every item (re-checks of missed sub-skills, a probe of a Hard-only sub-skill): still Medium level 1
G.fresh(); const s1 = G.call('startPractice', ['FX-T01', 'S.D', 5]); G.fresh(); const t1x = G.call('getSet', ['FX-T01', s1.set_id, {}]);
const wr = {}; t1x.questions.forEach(q => { wr[q.qid] = 'D'; });
G.fresh(); G.call('submit', ['FX-T01', s1.set_id, { state: { parts: { P: { ans: wr, elim: {}, mark: {}, ask: {} } } }, events: [], ev_from: 0, copy: t1x.copy }]);
G.fresh(); const lvRow = C.readTable_('Levels').rows.find(r => r.student_code === 'FX-T01' && String(r.skill).replace(/^'/, '') === 'S.D');
G.fresh(); const a3 = C.pickForPractice_('FX-T01', 'S.D', 5, 'seed-a3');
check(lvRow.level === 'E' && a3.qids.every(id => d(id) === 'M' && lv(id) === 1) && a3.why.some(x => /recheck/.test(x)), 'after missing a Circles set: re-checks stay Medium level 1, no Hard probe (' + a3.qids.map(id => d(id) + lv(id)).join(' ') + ' · ' + a3.why.join(', ') + ')');
setLevel('FX-T01', 'Q.E', 'H');
G.fresh(); const b = C.pickForPractice_('FX-T01', 'Q.E', 5, 'seed-b');
check(b.qids.length === 5 && b.qids.every(id => (d(id) === 'M' && lv(id) >= 2) || d(id) === 'H'), 'Probability at level H → Medium level 2–3 + the real Hard items: ' + b.qids.map(id => d(id) + lv(id)).join(' '));
check(!b.qids.some(id => d(id) === 'E'), 'Probability at level H: no Easy');
G.fresh(); const g = C.pickForPractice_('FX-T03', 'Q.G', 5, 'seed-g');
check(new Set(g.qids.map(d)).size === 3, 'Evaluating claims: a mix of all difficulties (' + g.qids.map(d).join(' ') + ')');
G.fresh(); const st = G.call('startPractice', ['FX-T03', 'Q.G', 20]);
check(st.n === 5, 'Evaluating claims: asked for 20 → a set of 5');
G.fresh(); const home = G.call('homeData', ['FX-T03']);
const qg = home.domains.find(x => x.skills.some(k => k.skill === 'Q.G')).skills.find(k => k.skill === 'Q.G');
check(qg.max_n === 5 && /Rare on the test/.test(qg.note), 'home picker: Q.G offers 5 only ("Rare on the test: sets of 5")');

console.log('Assignment builder');
G.fresh();
const tree = G.call('assignmentTree', ['TEACH-FX-9', 'st:FX-T03']);
const tk = c => tree.domains.flatMap(x => x.skills).find(k => k.code === c);
check(tk('S.D').profile === 'Medium/Hard only' && tk('Q.E').profile === 'Easy/Medium only' && /rare on the test/.test(tk('Q.G').profile) && tk('H.A').profile === '', 'topics show "Medium/Hard only", "Easy/Medium only", "rare on the test"');
G.fresh();
const pa = G.call('pickAssignment', ['TEACH-FX-9', { target: 'st:FX-T03', topics: [{ code: 'S.D', n: 3, diffs: 'E' }, { code: 'Q.E', n: 2, diffs: 'H' }] }]);
const t1 = pa.topics[0], t2 = pa.topics[1];
check(t1.picked.length === 3 && t1.picked.every(x => x.difficulty === 'M' && Number(x.level) === 1) && /has no Easy on the SAT — 3 Medium added \(easiest first\)/.test(t1.notes[0]), 'Circles, Easy ticked → 3 Medium level 1 + note: "' + t1.notes[0] + '"');
check(t2.picked.length === 2 && t2.picked.every(x => x.difficulty === 'M' && Number(x.level) === 2) && /has no Hard on the SAT — 2 Medium added \(hardest first\)/.test(t2.notes[0]), 'Probability, Hard ticked → 2 hardest Medium + note: "' + t2.notes[0] + '"');

console.log('Mixed Practice weights');
const skills = tab.map(r => String(r.skill).replace(/^'/, ''));
const W = C.mixedWeights_(skills), past = {};
for (let s = 0; s < 100; s++) C.mixedPlan_(skills, W, Object.assign({}, past), 10, 4, [], null).forEach(k => { past[k] = (past[k] || 0) + 1; });
let worst = 0, worstK = '';
skills.forEach(k => { const e = Math.abs((past[k] || 0) / 1000 - W[k]) * 100; if (e > worst) { worst = e; worstK = k; } });
check(worst <= 3, '1,000 simulated items (100 sets of 10): every skill within ' + worst.toFixed(2) + ' points of its weight (target ±3; worst ' + worstK + ')');
check((past['Q.G'] || 0) + (past['Q.F'] || 0) >= 45 && (past['Q.G'] || 0) + (past['Q.F'] || 0) <= 55, 'Q.G + Q.F: ' + ((past['Q.G'] || 0) + (past['Q.F'] || 0)) + ' of 1,000 items (≈ 1 in 20)');
// the same through the app: real Mixed sets on the fixtures (all made-up batches live, no 7-day block)
['FX2', 'FX3', 'FX4'].forEach(live); setRow('block_days', 0);
G.fresh(); const Q2 = {}; G.table('Questions').forEach(r => { Q2[r.qid] = r; });
const key = id => String(Q2[id].key).replace(/^'/, '');
const got = {}; let total = 0;
for (let s = 0; s < 51; s++) {          // set 0 = the blank-profile mini placement (not by weight): not counted
  G.fresh(); const m = G.call('startMixed', ['FX-T01', 20]);
  G.fresh(); const t = G.call('getSet', ['FX-T01', m.set_id, {}]);
  const ans = {}; t.questions.forEach(q => { ans[q.qid] = key(q.qid); if (!s) return; const k = String(Q2[q.qid].skill).replace(/^'/, ''); got[k] = (got[k] || 0) + 1; total++; });
  G.fresh(); G.call('submit', ['FX-T01', m.set_id, { state: { parts: { P: { ans, elim: {}, mark: {}, ask: {} } } }, events: [], ev_from: 0, copy: t.copy }]);
}
const liveSkills = Object.keys(got), W2 = C.mixedWeights_([...new Set(G.table('Questions').filter(r => /^FX[2-5]/.test(r.qid)).map(r => String(r.skill).replace(/^'/, '')))]);
let worst2 = 0, w2k = ''; Object.keys(W2).forEach(k => { const e = Math.abs((got[k] || 0) / total - W2[k]) * 100; if (e > worst2) { worst2 = e; w2k = k; } });
check(total === 1000 && worst2 <= 3, 'app, 50 Mixed sets of 20 on ' + Object.keys(W2).length + ' fixture skills: ' + total + ' items, every skill within ' + worst2.toFixed(2) + ' points of its weight (worst ' + w2k + ')');
setRow('block_days', 7);

console.log('Minh edits the tab');
G.fresh(); const r1 = C.readTable_('Skill_Profile').rows.find(r => String(r.skill).replace(/^'/, '') === 'S.D');
C.updateRow_('Skill_Profile', r1._row, { allowed: 'E,M,H' }); G.fresh();
const a2 = C.pickForPractice_('FX-T03', 'S.D', 5, 'seed-a2');
check(a2.qids.some(id => d(id) === 'E'), 'allowed back to E,M,H → Circles at level E gets Easy items again');
C.updateRow_('Skill_Profile', r1._row, { allowed: 'M,H' }); G.fresh();
G.fresh(); const n2 = C.ensureSkillProfile_();
check(n2 === 0 && C.readTable_('Skill_Profile').rows.length === 19, 'update again: nothing added, Minh\'s rows stay');

console.log(`\n${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
