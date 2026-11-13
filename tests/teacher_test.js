// Server suite for round 3 (made-up fixtures FX1 + FX2 only): teacher page — students + codes, classes, assignments
// (builder → student home → set), "What to go over" order, mistake tags → Review, asks inbox, profile, teacher-only calls.
const { makeGas } = require('./server');
let F = 0, P = 0; const check = (c, m) => { if (c) { P++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ FAIL: ' + m); } };
const throws = fn => { try { fn(); return ''; } catch (e) { return e.message; } };

const G = makeGas(), C = G.ctx, T = 'TEACH-FX-9';
const fx2 = C.readTable_('Batches').rows.find(x => x.batch === 'FX2'); C.updateRow_('Batches', fx2._row, { live: 'Yes' }); G.fresh();
const Q = {}; G.table('Questions').forEach(r => { Q[r.qid] = r; });
const keyOf = id => String(Q[id].key).replace(/^'/, '');
const wrongOf = id => Q[id].type === 'spr' ? '999' : ['A', 'B', 'C', 'D'].find(l => l !== keyOf(id));
function doSet(code, setId, answer, opts = {}) {
  G.fresh();
  const t = G.call('getSet', [code, setId, {}]);
  const ans = {}, events = [{ part: 'P', t_ms: 0, qid: null, type: 'part_start', value: 'P' }];
  let tt = 1000;
  t.questions.forEach((q, i) => {
    const how = answer(q.qid, i);
    events.push({ part: 'P', t_ms: tt, qid: q.qid, type: 'q_enter', value: i + 1 }); tt += (opts.secs ? opts.secs(i) : 60) * 1000;
    if (how !== 'blank') { ans[q.qid] = how === 'right' ? keyOf(q.qid) : wrongOf(q.qid); events.push({ part: 'P', t_ms: tt - 500, qid: q.qid, type: 'select', value: ans[q.qid] }); }
    events.push({ part: 'P', t_ms: tt, qid: q.qid, type: 'q_leave', value: null });
  });
  const state = { v: 1, session_id: setId, current_part: 'P', phase: 'review', part_starts: { P: Date.now() - 900000 }, ended: {},
                  parts: { P: { cur: 0, ans, elim: {}, mark: {}, ask: opts.ask || {}, hl: {} } } };
  G.fresh();
  return { t, res: G.call('submit', [code, setId, { state, events, ev_from: 0, copy: t.copy }]) };
}

console.log('Teacher only');
['teacherHome', 'classView', 'asksInbox', 'assignmentTree'].forEach(fn => check(/LOGIN/.test(throws(() => G.call(fn, ['FX-T01']))), fn + ': a student code is refused'));
check(/LOGIN/.test(throws(() => G.call('questionPanel', ['FX-T01', 'FX1-001']))), 'questionPanel (has the key): a student code is refused');

console.log('Students + classes');
G.fresh();
const ns = G.call('createStudent', [T, 'Nguyễn An (test)', []]);
check(ns.ok && /^AN-[A-Z0-9]{3}$/.test(ns.student_code), 'new student → the app issues a code: ' + ns.student_code + ' (initials + 3 characters)');
G.fresh(); check(G.call('login', [ns.student_code, 'D']).ok, 'the new code signs in');
const sh = G.sheets[Object.keys(G.sheets).find(k => G.sheets[k].name === 'Students')];
G.fresh(); C.appendObjects_('Students', [{ name: 'Sheet Kid (test)', active: '' }]); G.fresh();
G.call('teacherHome', [T]); G.fresh();
const sk = C.readTable_('Students').rows.find(r => r.name === 'Sheet Kid (test)');
check(/^KS-[A-Z0-9]{3}$/.test(sk.student_code) && sk.active === 'Yes', 'student typed in the Sheet without a code → code issued (' + sk.student_code + '), active Yes');
G.fresh();
const cl = G.call('saveClass', [T, { name: 'Pair (test)', student_codes: ['FX-T01', 'fx-t03', 'NOPE'] }]);
check(cl.ok && cl.class_id === 'C-001', 'class created: C-001');
G.fresh();
const cls = C.readTable_('Classes').rows[0];
check(cls.student_codes === 'FX-T01, FX-T03', 'members kept, unknown code dropped');
check(C.readTable_('Students').rows.find(r => r.student_code === 'FX-T01').classes === 'Pair (test)', 'Students.classes mirrors the class names');
G.fresh(); G.call('saveClass', [T, { class_id: 'C-002x', name: 'Solo (test)', student_codes: ['FX-T01'] }]);
G.fresh(); check(C.readTable_('Students').rows.find(r => r.student_code === 'FX-T01').classes === 'Pair (test), Solo (test)', 'a student can be in several classes');
G.fresh(); const th = G.call('teacherHome', [T]);
check(th.classes.length === 2 && th.classes[0].members.length === 2 && th.mistake_types.length === 7, 'teacher home: 2 classes, members, Minh\'s 7 mistake types');

console.log('Assignment builder');
G.fresh();
const tree = G.call('assignmentTree', [T, 'C-001']);
const hb = tree.domains.find(d => d.domain === 'H').skills.find(s => s.code === 'H.B');
check(hb.count && hb.count.M === 12 && hb.count.fM === 12, 'tree: Linear functions has 12 Medium items, 12 fresh for the class');
// FX-T01 does one practice set first, so some items are "done"
G.fresh(); const p1 = G.call('startPractice', ['FX-T01', 'H.B', 5]); doSet('FX-T01', p1.set_id, () => 'right');
G.fresh();
const pk = G.call('pickAssignment', [T, { target: 'C-001', topics: [{ code: 'H.B', n: 4, diffs: 'M,H' }, { code: 'H.B.3', n: 2, diffs: 'E' }] }]);
const t0 = pk.topics[0], t1 = pk.topics[1];
check(t0.picked.length === 4 && t0.picked.filter(x => x.difficulty === 'M').length === 2 && t0.picked.filter(x => x.difficulty === 'H').length === 2, 'n=4 over Medium + Hard → 2 M + 2 H');
check(t0.picked.every(x => x.status === 'new for all'), 'items nobody in the class has done come first ("new for all")');
check(new Set(t0.picked.map(x => x.subskill)).size >= 3, 'spread over sub-skills: ' + t0.picked.map(x => x.subskill).join(' '));
check(t1.picked.length === 2 && t1.picked.every(x => x.subskill === 'H.B.3' && x.difficulty === 'E') && t1.short === '', 'sub-skill topic: 2 Easy H.B.3 items');
check(t0.queue.length > 0 && t0.picked.every(x => /^[EMH]\d+$/.test(x.code)), 'Swap queue ready; every item shows its short code');
const big = G.call('pickAssignment', [T, { target: 'C-001', topics: [{ code: 'H.B.1', n: 9, diffs: 'H' }] }]).topics[0];
check(/only \d+ available/.test(big.short), 'too few items → "' + big.short + '"');
const qids = t0.picked.concat(t1.picked).map(x => x.qid);
G.fresh();
const pub = G.call('publishAssignment', [T, { target: 'C-001', title: 'Homework – test', qids, topics: [{ code: 'H.B', n: 4, diffs: 'M,H' }], due: '2099-01-01' }]);
check(pub.ok && pub.n === 6 && /^A-\d{8}-1$/.test(pub.assignment_id), 'published ' + pub.assignment_id + ' (6 questions, frozen)');
G.fresh();
const fut = G.call('publishAssignment', [T, { target: 'st:FX-T03', title: 'Later (test)', qids: qids.slice(0, 2), available_from: '2099-01-01' }]);

console.log('Student side');
G.fresh();
const h1 = G.call('homeData', ['FX-T01']), h3 = G.call('homeData', ['FX-T03']);
check(h1.assignments.length === 1 && h1.assignments[0].title === 'Homework – test' && h1.assignments[0].n === 6 && /due/.test(h1.assignments[0].when), 'home card: "Homework – test", 6 questions, due date shown');
check(h3.assignments.length === 1, 'the other class member sees it too; an assignment from a future day stays hidden');
G.fresh();
const sa = G.call('startAssignment', ['FX-T01', pub.assignment_id]), sb = G.call('startAssignment', ['FX-T03', pub.assignment_id]);
G.fresh();
const sr = C.readTable_('Sets').rows.find(s => s.set_id === sa.set_id);
check(sr.kind === 'assignment' && sr.qids === qids.join(',') && C.setTitle_(sr) === 'Homework – test', 'start → a set with the frozen questions, titled like the assignment');
check(G.call('startAssignment', ['FX-T01', pub.assignment_id]).set_id === sa.set_id, 'one set per student per assignment');
check(/FORM/.test(throws(() => G.call('startAssignment', [ns.student_code, pub.assignment_id]))), 'a student outside the class cannot start it');
// FX-T01: q0 wrong + asked, q1 wrong, rest right; FX-T03: q0 wrong, q2 right but slow, rest right
const order = qids;
doSet('FX-T01', sa.set_id, (id) => id === order[0] || id === order[1] ? 'wrong' : 'right', { ask: { [order[1]]: 'Why?' } });
doSet('FX-T03', sb.set_id, (id) => id === order[0] ? 'wrong' : 'right', { secs: i => i === 2 ? 400 : 60 });
G.fresh();
check(G.call('homeData', ['FX-T01']).assignments.length === 0, 'after submit the card leaves the home (it is in History)');

console.log('What to go over');
G.fresh();
const cv = G.call('classView', [T, 'C-001', 'a:' + pub.assignment_id]);
const codesInOrder = cv.rows.map(r => r.qid);
check(cv.rows.length === 6 && cv.members.length === 2, 'class view: 6 questions × 2 students');
check(codesInOrder[0] === order[0] && cv.rows[0].wrong1 === 2 && /2 of 2 wrong/.test(cv.rows[0].summary), 'top: the question both got wrong (' + cv.rows[0].code + ')');
check(codesInOrder[1] === order[1] && cv.rows[1].asks === 1, 'next: 1 wrong + asked');
const slowIdx = codesInOrder.indexOf(order[2]);
check(cv.rows[slowIdx].group === 3 && slowIdx === 2, 'then: right but slow');
check(cv.rows.slice(3).every(r => r.group === 4), 'last: right, fast, nobody asked');
check(cv.rows.every(r => /^[EMH]\d+$/.test(r.code)) && cv.rows[0].students.length === 2 && cv.rows[0].untagged === 2, 'every row: short code, each student\'s answer, 2 untagged');
check(cv.scopes.some(s => s.id === 'a:' + pub.assignment_id) && cv.assignments[0].students.every(s => s.state === 'done'), 'scope picker lists the assignment; both students done');
check(C.priorityOrder_([{ wrong1: 1, still: 0, asks: 0, extra: 0, slow: 0, slow_right: 0, code: 'M1' }, { wrong1: 1, still: 1, asks: 0, extra: 0, slow: 0, slow_right: 0, code: 'M2' }], true)[0].code === 'M2',
  'one student: still wrong after fixes comes before fixed later');
const one = G.call('classView', [T, 'st:FX-T01', 'all']);
check(one.target.kind === 'student' && one.rows.length >= 6, 'one student\'s list (profile): all time');

console.log('Question panel · tags · asks');
G.fresh();
const qp = G.call('questionPanel', [T, order[0]]);
check(qp.q.key.length >= 1 && qp.q.code === Q[order[0]].code && qp.q.stem_html, 'question panel: question + correct answer (teacher only) + code');
G.fresh();
const tg = G.call('tagMistake', [T, sb.set_id, order[1], 'Careless Calculation', 'sign']);
check(tg.ok && tg.review_added === true, 'tag "Careless Calculation" on a RIGHT answer → item added to the student\'s Review');
G.fresh();
const rr = C.readTable_('Responses').rows.find(r => r.set_id === sb.set_id && r.qid === order[1]);
check(rr.mistake_type === 'Careless Calculation' && rr.tagged_in === 'app', 'Responses.mistake_type + tagged_in app');
check(/FORM/.test(throws(() => G.call('tagMistake', [T, sb.set_id, order[1], 'Bad Type', '']))), 'only Minh\'s 7 types');
G.fresh(); check(G.call('tagMistake', [T, sb.set_id, order[3], 'Not A Mistake', '']).review_added === false, '"Not A Mistake" → no Review');
// a tag typed in the Sheet
const sheetRow = C.readTable_('Responses').rows.find(r => r.set_id === sa.set_id && r.qid === order[2]);
C.updateRow_('Responses', sheetRow._row, { mistake_type: 'Concept Gap' }); G.fresh();
C.syncTaggedReview_(); G.fresh();
check(C.readTable_('Review').rows.some(r => r.student_code === 'FX-T01' && r.qid === order[2] && r.reason === 'tagged') &&
      C.readTable_('Responses').rows.find(r => r.set_id === sa.set_id && r.qid === order[2]).tagged_in === 'sheet', 'tag typed in the Sheet → Review on the next update (once)');
G.fresh();
const inbox = G.call('asksInbox', [T]);
check(inbox.asks.length === 1 && inbox.asks[0].note === 'Why?' && inbox.asks[0].code === Q[order[1]].code, 'Asked inbox: 1 open ask with its note + code');
G.fresh(); G.call('resolveAsk', [T, inbox.asks[0].set_id, inbox.asks[0].qid]);
G.fresh(); check(G.call('asksInbox', [T]).asks.length === 0, 'Resolve → gone from the inbox');

console.log('Student profile');
G.fresh();
const pf = G.call('studentProfile', [T, 'FX-T01']);
check(pf.skills.length === 19 && pf.skills.find(s => s.skill === 'H.B').level === 'M', 'profile: 19 skills with level (Linear functions M)');
check(pf.sets.length === 2 && pf.sets.some(s => s.title === 'Homework – test' && s.first_try === 4), 'sets with First Try / Best Score');
check(pf.profiles.RIGHT >= 1 && pf.mistakes['Concept Gap'] === 1 && pf.review_open >= 2, 'timing profiles, mistake types, Review size');
check(!/"key"|"accepted"/.test(JSON.stringify(pf)) && !/"key"|"accepted"/.test(JSON.stringify(cv)), 'class view + profile: no keys (only the question panel has one)');

console.log(`\n${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
