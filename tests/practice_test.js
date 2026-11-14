// Server suite for round 2 (made-up fixture batches FX1 + FX2 only): adaptive practice selection (spec v1.1 §4) + Levels,
// fix tries (checkTry: MCQ 3 tries in total → locked, grid-in unlimited), Review area (§5), Ask teacher (§8), short codes.
const { makeGas } = require('./server');
let F = 0, P = 0; const check = (c, m) => { if (c) { P++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ FAIL: ' + m); } };

const G = makeGas();
const C = G.ctx;
const fx2 = C.readTable_('Batches').rows.find(x => x.batch === 'FX2');
C.updateRow_('Batches', fx2._row, { live: 'Yes' }); G.fresh();
const Q = {}; G.table('Questions').forEach(r => { Q[r.qid] = r; });
const keyOf = id => String(Q[id].key).replace(/^'/, '');
const wrongOf = id => Q[id].type === 'spr' ? '999' : ['A', 'B', 'C', 'D'].find(l => l !== keyOf(id));

/** Opens + submits a set; answer(qid, i) → 'right' | 'wrong' | 'blank'; ask = {qid: note}. */
function doSet(code, setId, answer, opts = {}) {
  G.fresh();
  const t = G.call('getSet', [code, setId, { device: 'test' }]);
  const ans = {}, events = [{ part: 'P', t_ms: 0, qid: null, type: 'part_start', value: 'P' }];
  let tt = 1000;
  t.questions.forEach((q, i) => {
    const how = answer(q.qid, i);
    events.push({ part: 'P', t_ms: tt, qid: q.qid, type: 'q_enter', value: i + 1 }); tt += (opts.secs || 60) * 500;
    if (how !== 'blank') { ans[q.qid] = how === 'right' ? keyOf(q.qid) : wrongOf(q.qid); events.push({ part: 'P', t_ms: tt, qid: q.qid, type: 'select', value: ans[q.qid] }); }
    tt += (opts.secs || 60) * 500;
    events.push({ part: 'P', t_ms: tt, qid: q.qid, type: 'q_leave', value: null });
  });
  const state = { v: 1, session_id: setId, current_part: 'P', phase: 'review', part_starts: { P: Date.now() - 600000 }, ended: {},
                  parts: { P: { cur: 0, ans, elim: {}, mark: {}, ask: opts.ask || {}, hl: {} } } };
  G.fresh();
  return { t, res: G.call('submit', [code, setId, { state, events, ev_from: 0, copy: t.copy }]) };
}
const setRow = id => { G.fresh(); return C.readTable_('Sets').rows.find(s => s.set_id === id); };
const level = (code, sk) => { G.fresh(); return C.readTable_('Levels').rows.find(r => r.student_code === code && String(r.skill).replace(/^'/, '') === sk); };

console.log('Adaptive practice: new student, level M');
G.fresh();
const s1 = G.call('startPractice', ['FX-T01', 'H.B', 5]);
let row = setRow(s1.set_id), q1 = row.qids.split(',');
check(row.level_at_start === 'E' && row.slots === 'E,E,E,M,M', 'new student → level E (Minh 13 Nov), slots E E E M M (warm-up first)');
check(q1.map(id => Q[id].difficulty).join('') === 'EEEMM', 'difficulties follow the slots: ' + q1.map(id => Q[id].difficulty).join(' '));
check(new Set(q1.map(id => Q[id].subskill)).size === 5, 'probe + fill spread over 5 different sub-skills: ' + q1.map(id => Q[id].subskill).join(' '));
check(!q1.includes('FX2-B01') && !(q1.includes('FX2-001') && q1.includes('FX2-002')), 'version B never served; one item per twin group');
const t1 = G.call('getSet', ['FX-T01', s1.set_id, {}]);
check(t1.questions.every(q => !('code' in q)), 'students never get the short code (it would show E/M/H); never the key');
check(!/"key"|"accepted"|"tags"|rationale|version_of/.test(JSON.stringify(t1)), 'set payload: no key / accepted / tags / rationale / version_of');

let okSlots = 0;
for (let k = 0; k < 20; k++) { const pk = C.pickForPractice_('FX-NOBODY', 'H.B', 10, 'seed-' + k); if (pk.qids.map(id => Q[id].difficulty).join('') === pk.slots.replace(/,/g, '')) okSlots++; }
check(okSlots === 20, 'every slot gets an item of its own difficulty (20 seeds × 10 questions; probe included)');
console.log('Levels: 2 good sets → up, 1 weak set → down');
let r1 = doSet('FX-T01', s1.set_id, () => 'right').res;
check(r1.first_try.right === 5, 'set 1: 5/5');
let lv = level('FX-T01', 'H.B');
check(lv && lv.level === 'E' && Number(lv.good_streak) === 1, 'Levels: H.B level E, good streak 1');
G.fresh();
const s2 = G.call('startPractice', ['FX-T01', 'H.B', 5]);
check(!setRow(s2.set_id).qids.split(',').some(id => q1.includes(id)), 'set 2: no question answered in the last 7 days');
doSet('FX-T01', s2.set_id, () => 'right');
lv = level('FX-T01', 'H.B');
check(lv.level === 'M' && Number(lv.good_streak) === 0 && /E→M/.test(lv.history), 'second good set → level M (streak reset, history "E→M")');
G.fresh();
const s3 = G.call('startPractice', ['FX-T01', 'H.B', 10]);
row = setRow(s3.set_id);
check(row.level_at_start === 'M' && row.slots === 'E,E,M,M,M,M,M,M,H,H', 'level M → 10 questions, slots E M M M H ×2: ' + row.slots);
doSet('FX-T01', s3.set_id, (id, i) => i < 4 ? 'right' : 'wrong');
lv = level('FX-T01', 'H.B');
check(lv.level === 'E' && /M→E/.test(lv.history), 'weak set (4/10 < 50 %) → level E');
check(Number(lv.n_items) === 20 && Number(lv.recent_pct) > 0 && Number(lv.recent_pct) < 1, 'R (recent weighted accuracy) + n_items stored: R=' + lv.recent_pct);

console.log('Missed sub-skills are re-checked in easy slots');
G.fresh();
const p = C.pickForPractice_('FX-T01', 'H.B', 10, 'seed-1');
const missedSubs = C.firstTries_('FX-T01').filter(t => !t.right).map(t => t.subskill);
check(p.why.filter(w => /^recheck/.test(w)).length >= 1 && p.why.filter(w => /^recheck/.test(w)).length <= 4, 're-check slots ≤ ceil(0.4·10) = 4: ' + p.why.filter(w => /^recheck/.test(w)).join(', '));
const perSub = {}; p.why.forEach(w => { if (/^recheck/.test(w)) perSub[w] = (perSub[w] || 0) + 1; });
check(Object.values(perSub).every(n => n <= 2), 'at most 2 re-check slots per missed sub-skill in a set of 10');
check(p.why.filter(w => /^recheck/.test(w)).every(w => missedSubs.includes(w.split(' ')[1])), 're-checks are sub-skills the student missed');
const reIdx = p.why.map((w, i) => /^recheck/.test(w) ? i : -1).filter(i => i >= 0);
check(reIdx.every(i => p.slots.split(',')[i] !== 'H'), 're-checks sit in E/M slots, not the hardest');
const pA = JSON.stringify(C.pickForPractice_('FX-T01', 'H.B', 10, 'seed-1').qids), pB = JSON.stringify(C.pickForPractice_('FX-T01', 'H.B', 10, 'seed-1').qids);
check(pA === pB, 'same seed → same pick (repeatable)');
check(C.getSettings_().standin_min === 3, 'standin_min default 3 (every College Board skill has real Easy/Medium items)');
check(C.bucketMap_(Object.values(Q).filter(r => r.difficulty === 'H'), C.getSettings_()).standin === true, 'no Easy/Medium items at all → Hard stand-ins (E = H level 1 …)');
const qg = [{ difficulty: 'E' }, { difficulty: 'E' }, { difficulty: 'M' }, { difficulty: 'M' }, { difficulty: 'M' }, { difficulty: 'H' }];
check(C.bucketMap_(qg, C.getSettings_()).standin === false, 'a small skill with real items (E2 M3, like Q.G) → real difficulties, no stand-ins');

console.log('Review area: wrong / blank / slow-right enter; one clean try clears');
G.fresh();
const s4 = G.call('startPractice', ['FX-T03', 'H.B', 5]);
const r4 = doSet('FX-T03', s4.set_id, (id, i) => i === 0 ? 'wrong' : i === 1 ? 'blank' : 'right', { ask: {} }).res;
G.fresh();
let rev = C.readTable_('Review').rows.filter(r => r.student_code === 'FX-T03');
check(rev.length === 2 && rev.every(r => r.status === 'open') && rev.map(r => r.reason).sort().join() === 'blank,wrong', 'Review: 2 open items (wrong, blank)');
let h = G.call('homeData', ['FX-T03']);
check(h.review.open === 2 && h.review.next === 2, 'home Review card: 2 to review');
check(h.history[0].fix_left === 2, 'history: "Fix 2 more"');

console.log('Fix wrong answers');
G.fresh();
const fx = G.call('getFix', ['FX-T03', s4.set_id]);
check(fx.questions.length === 2 && fx.questions.every(q => q.status === 'open'), 'getFix: the 2 items not right on try 1');
check(!/"key"|"accepted"|"tags"/.test(JSON.stringify(fx)), 'getFix payload: no key');
const mq = fx.questions.find(q => q.type === 'mcq') ;
const sq = fx.questions.find(q => q.type === 'spr');
if (mq) {
  const wrongs = ['A', 'B', 'C', 'D'].filter(l => l !== keyOf(mq.qid) && !mq.tried.includes(l));
  G.fresh(); let c = G.call('checkTry', ['FX-T03', s4.set_id, mq.qid, wrongs[0], 20]);
  const t0 = mq.n_tries;
  check(c.ok && c.correct === false && c.tries_left === 3 - t0 - 1, 'MCQ wrong fix → ✗, ' + c.tries_left + ' tries left (never the key)');
  check(!/"key"/.test(JSON.stringify(c)), 'checkTry answer has no key');
  G.fresh(); const again = G.call('checkTry', ['FX-T03', s4.set_id, mq.qid, wrongs[0], 5]);
  check(again.ok === false && /already tried/.test(again.msg), 'same letter twice → "You already tried …"');
  for (let k = 1; c.status === 'open' && k < wrongs.length; k++) { G.fresh(); c = G.call('checkTry', ['FX-T03', s4.set_id, mq.qid, wrongs[k], 10]); }
  check(c.status === 'locked' && c.tries_left === 0, 'after 3 tries in total → locked');
  G.fresh(); const lk = G.call('checkTry', ['FX-T03', s4.set_id, mq.qid, keyOf(mq.qid), 5]);
  check(lk.status === 'locked' && lk.correct === false, 'a locked item cannot be fixed any more');
}
if (sq) {
  let c;
  for (let k = 0; k < 4; k++) { G.fresh(); c = G.call('checkTry', ['FX-T03', s4.set_id, sq.qid, String(100 + k), 10]); }
  check(c.status === 'open' && c.tries_left === null, 'grid-in: 4 wrong tries, still open (no limit)');
  G.fresh(); c = G.call('checkTry', ['FX-T03', s4.set_id, sq.qid, keyOf(sq.qid), 10]);
  check(c.correct && c.status === 'fixed', 'grid-in right → Fixed');
}
G.fresh();
const sr4 = setRow(s4.set_id), resp4 = C.readTable_('Responses').rows.filter(r => r.set_id === s4.set_id);
const bestNow = resp4.filter(r => Number(r.best_correct) === 1).length;
check(Number(sr4.first_try) === 3 && Number(sr4.best_score) === bestNow && bestNow === 3 + (sq ? 1 : 0), 'First Try stays 3, Best Score = ' + bestNow);
const tries4 = C.readTable_('Tries').rows.filter(r => r.set_id === s4.set_id);
check(tries4.filter(r => Number(r.try_no) === 1).length >= 4 && tries4.length > 4, 'every try recorded in Tries (' + tries4.length + ' rows, try 1 from the submit)');
const res4 = G.call('getResult', ['FX-T03', s4.set_id]);
const leftOpen = fx.questions.length - (mq ? 1 : 0) - (sq ? 1 : 0);
check(res4.best.right === bestNow && res4.fix.open === leftOpen && res4.fix.locked === (mq ? 1 : 0), 'result: Best Score updated, ' + leftOpen + ' left to fix' + (mq ? ', 1 locked' : ''));

console.log('Ask teacher');
G.fresh();
const s5 = G.call('startPractice', ['FX-T03', 'H.B', 5]);
const firstQ = setRow(s5.set_id).qids.split(',')[0];
const r5 = doSet('FX-T03', s5.set_id, () => 'right', { ask: { [firstQ]: 'Why is it B?' } }).res;
G.fresh();
let ar = C.readTable_('Responses').rows.find(r => r.set_id === s5.set_id && r.qid === firstQ);
check(Number(ar.asked) === 1 && String(ar.ask_note).replace(/^'/, '') === 'Why is it B?' && ar.ask_status === 'open', 'asked during the set → Responses asked + note + open');
check(r5.asked.length === 1 && r5.asked[0].code === 'Q1', 'result: "You asked your teacher about: Q1"');
const second = setRow(s5.set_id).qids.split(',')[1];
G.fresh(); G.call('askTeacher', ['FX-T03', s5.set_id, second, true, 'x'.repeat(300)]);
G.fresh(); ar = C.readTable_('Responses').rows.find(r => r.set_id === s5.set_id && r.qid === second);
check(Number(ar.asked) === 1 && String(ar.ask_note).replace(/^'/, '').length === 200, 'ask after the result: stored, note cut to 200 characters');
G.fresh(); G.call('askTeacher', ['FX-T03', s5.set_id, second, false, '']);
G.fresh(); ar = C.readTable_('Responses').rows.find(r => r.set_id === s5.set_id && r.qid === second);
check(!ar.asked && !ar.ask_status, 'ask switched off again');
let thrown = ''; try { G.call('askTeacher', ['FX-T01', s5.set_id, second, true, '']); } catch (e) { thrown = e.message; }
check(/SESSION/.test(thrown), 'another student cannot ask on this set');

console.log('Review mini-set');
G.fresh();
const nOpen = C.readTable_('Review').rows.filter(r => r.student_code === 'FX-T03' && r.status === 'open').length;
const rs = G.call('startReview', ['FX-T03']);
row = setRow(rs.set_id);
check(row.kind === 'review' && rs.n === Math.min(5, nOpen) && row.slots === row.qids, 'Review set of ' + rs.n + ' open items (version A served: no live B)');
G.fresh(); check(G.call('startReview', ['FX-T03']).set_id === rs.set_id, 'an open Review set comes back (one at a time)');
const rr = doSet('FX-T03', rs.set_id, (id, i) => i === 0 ? 'right' : 'wrong').res;
check(rr.review_summary && rr.review_summary.cleared === 1 && rr.review_summary.still === rs.n - 1, 'result: "1 cleared, ' + (rs.n - 1) + ' still to review"');
G.fresh();
rev = C.readTable_('Review').rows.filter(r => r.student_code === 'FX-T03');
check(rev.filter(r => r.status === 'cleared' && r.cleared_by === 'pass').length === 1 && rev.filter(r => r.status === 'open').length === nOpen - 1, 'one clean pass → cleared; the others stay open (n_served counted)');
check(rev.filter(r => Number(r.n_served) === 1).length === rs.n, 'n_served = 1 for each served item');
const lvR = level('FX-T03', 'H.B');
check(lvR && Number(lvR.n_items) === 10, 'Review answers never move the level / R (n_items still 10)');

console.log(`\n${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
