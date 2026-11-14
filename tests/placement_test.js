// Placement test (blueprint v2.2): routing port = routing.py (all 718 answer paths of placement_paths.csv), interleaved
// schedule (simulated whole tests: min 8 · typical 17–22 · max 24), Settings-tunable rules, time bands, and the server flow
// on made-up fixture forms (FX4): teacher assigns → one question at a time → result (Strong/Medium/Weak only) → Levels,
// Placements row, teacher report; retake with form B + comparison; placement items count as seen; no key in any payload.
const fs = require('fs'), path = require('path');
const { makeGas } = require('./server');
let F = 0, P = 0; const check = (c, m) => { if (c) { P++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ FAIL: ' + m); } };
const G = makeGas(), C = G.ctx;
const PR = () => C.plParams_();

console.log('Routing = routing.py (placement_paths.csv)');
const csv = fs.readFileSync(path.join(__dirname, 'fixtures', 'placement_paths.csv'), 'utf8').trim().split('\n').slice(1).map(l => l.split(','));
let same = 0, bad = [];
csv.forEach(([start, n, answers, slots, result]) => {
  const ans = answers.split(' ').map(x => x[1]);
  const r = C.plRoute_(ans, start, PR());
  const cnt = {}, mySlots = r.seq.map(x => { cnt[x[0]] = (cnt[x[0]] || 0) + 1; return x[0] + cnt[x[0]]; }).join(' ');
  const ok = r.result === result && r.seq.length === Number(n) && r.seq.join(' ') === answers && mySlots === slots;
  if (ok) same++; else if (bad.length < 3) bad.push(start + ' ' + answers + ' → ' + r.result + ' (want ' + result + ')');
});
check(csv.length === 718 && same === 718, 'all ' + csv.length + ' paths: same items, same slots, same result' + (bad.length ? ' — ' + bad.join('; ') : ''));
// no other path ends: enumerate every answer string up to 6 items
let ends = 0;
['E', 'M'].forEach(st => {
  const walk = (pre) => { const r = C.plRoute_(pre, st, PR()); if (r.result) { if (r.seq.length === pre.length) ends++; return; } if (pre.length < 6) ['F', 'S', 'W'].forEach(a => walk(pre.concat([a]))); };
  walk([]);
});
check(ends === 718, 'every answer sequence ends within 6 items: ' + ends + ' end paths (= the CSV)');
const ex = (a, s) => C.plRoute_(a.split(''), s || 'E', PR()).result;
check(ex('FFFF') === 'H', 'E→M→H→H right (any time at Hard) → Strong after 4 items');
check(ex('WW') === '<E', 'two Easy wrong → below Easy (Weak)');
check(ex('FFW') === null && C.plRoute_(['F', 'F', 'W'], 'E', PR()).level === 'M' && ex('FFWFW') === 'M', 'Hard wrong → back to Medium; 2nd Hard wrong → Medium');
check(ex('SS') === null && C.plRoute_(['S', 'S'], 'E', PR()).level === 'M', 'two slow rights at Easy = one step (half each)');

console.log('Interleaved schedule (simulation, routing.py sim_schedule terms)');
let seed = 12345; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const PROF = { weak: { E: .55, M: .2, H: .05 }, easyok: { E: .9, M: .45, H: .1 }, medium: { E: .95, M: .8, H: .3 }, strong: { E: .98, M: .95, H: .8 } };
const WANT = { weak: 16.5, easyok: 21.1, medium: 22.3, strong: 19.2 };
const P0 = PR();
function simTest(p) {
  const items = []; let order = [];
  for (let g = 0; g < 40; g++) {
    const st = C.plState_(items, P0, null); if (!st.next) return { n: items.length, order, res: st.results };
    const ok = rnd() < p[st.next.level];
    items.push({ dom: st.next.dom, slot: st.next.slot, a: ok ? (rnd() < 0.15 ? 'S' : 'F') : 'W' }); order.push(st.next.dom);
  }
  return { n: 99, order };
}
let allMin = 99, allMax = 0;
Object.keys(PROF).forEach(t => {
  const N = []; let advAt = 0;
  for (let i = 0; i < 3000; i++) { const r = simTest(PROF[t]); N.push(r.n); advAt += r.order.indexOf('ADV') + 1; }
  const mean = N.reduce((a, b) => a + b, 0) / N.length; allMin = Math.min(allMin, ...N); allMax = Math.max(allMax, ...N);
  check(Math.abs(mean - WANT[t]) <= 0.8, t + ': ' + mean.toFixed(1) + ' items on average (routing.py: ' + WANT[t] + '), Advanced Math from item ' + (advAt / N.length).toFixed(1));
});
check(allMin === 8 && allMax === 24, 'whole test: min ' + allMin + ' · max ' + allMax + ' items');
const strong = C.plState_([], P0, null);
check(strong.next.dom === 'ALG' && strong.next.slot === 'E1', 'first item: Algebra E1');
const ord = []; { const its = []; for (let i = 0; i < 12; i++) { const s = C.plState_(its, P0, null); ord.push(s.next.dom); its.push({ dom: s.next.dom, slot: s.next.slot, a: 'F' }); } }
check(ord.slice(0, 4).join(' ') === 'ALG PSD ALG GEO' && ord.indexOf('ADV') > 0, 'domains interleaved: ' + ord.join(' '));

console.log('Tunable (Settings) + time bands');
const S = C.getSettings_();
check(C.plBand_('E', 'mcq', 40, S) === 'fast' && C.plBand_('E', 'mcq', 41, S) === 'normal' && C.plBand_('E', 'mcq', 61, S) === 'slow', 'Easy: ≤ 40 s fast · ≤ 60 s normal · > 60 s slow');
check(C.plBand_('E', 'spr', 75, S) === 'normal' && C.plBand_('E', 'spr', 76, S) === 'slow', 'grid-in +15 s (Easy slow from 76 s)');
check(C.plBand_('M', 'mcq', 90, S) === 'normal' && C.plBand_('M', 'mcq', 91, S) === 'slow' && C.plBand_('H', 'mcq', 100, S) === 'normal', 'Medium ≤ 60 / ≤ 90 s · Hard ≤ 90 / ≤ 180 s');
const setRow = (k, v) => { G.fresh(); const r = C.readTable_('Settings').rows.find(x => x.key === k); C.updateRow_('Settings', r._row, { value: v }); G.fresh(); };
setRow('pl_slow_credit', 1);
check(C.plRoute_(['S'], 'E', C.plParams_()).level === 'M', 'pl_slow_credit = 1 → one slow right moves up');
setRow('pl_slow_credit', 0.5); setRow('pl_easy_max_sec', 70);
check(C.plBand_('E', 'mcq', 65, C.getSettings_()) === 'normal', 'pl_easy_max_sec = 70 → 65 s is normal');
setRow('pl_easy_max_sec', 60);
const sRows = C.readTable_('Settings').rows.filter(r => /^pl_/.test(r.key));
check(sRows.length === 14 && sRows.every(r => String(r.meaning).length > 10), '14 placement rows in the Settings tab, each with its meaning');

console.log('Server flow: assign → one question at a time → result');
const forms = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'placement_forms_fx4.json'), 'utf8'));
G.fresh(); C.appendObjects_('Placement_Forms', forms.map(r => ({ form: r[0], domain: r[1], slot: r[2], level: r[3], skill: r[4], code: r[5], qid: '' })));
G.fresh();
const formOf = {}; forms.forEach(r => { formOf[r[6]] = r[0] + ' ' + r[1] + ' ' + r[2]; });
const Q = {}; G.table('Questions').forEach(r => { Q[r.qid] = r; });
const key = id => String(Q[id].key).replace(/^'/, '');
const wrong = id => Q[id].type === 'spr' ? '999' : ['A', 'B', 'C', 'D'].find(l => l !== key(id));
const pub = G.call('publishAssignment', ['TEACH-FX-9', { kind: 'placement', target: 'st:FX-T03', form: 'auto', title: '' }]);
check(pub.ok && pub.placement, 'teacher publishes a Placement test to one student (form auto)');
G.fresh();
const asg = G.call('homeData', ['FX-T03']).assignments.find(a => a.assignment_id === pub.assignment_id);
check(asg && asg.placement && asg.title === 'Placement test', 'student home: "Placement test" on the Assigned card');
const leaks = [];
const watch = (x) => { const t = JSON.stringify(x); if (/"(key|accepted|rationale_html|tags|key_source)"\s*:/.test(t) || /"code"\s*:\s*"[EMH]\d/.test(t)) leaks.push(t.slice(0, 120)); return x; };
function run(code, aid, how, secFor) {
  G.fresh(); const st = watch(G.call('startAssignment', [code, aid]));
  G.fresh(); let t = watch(G.call('getSet', [code, st.set_id, {}]));
  const seen = [], ev = [{ part: 'P', t_ms: 0, qid: null, type: 'part_start', value: 'P' }]; let tt = 1000, out = null, from = 0;
  const qs = t.questions.slice();
  for (let i = 0; i < 30; i++) {
    const q = qs[qs.length - 1]; seen.push(q.qid);
    const dom = formOf[q.qid].split(' ')[1], slot = formOf[q.qid].split(' ')[2];
    const a = how(q.qid, dom, slot, i) ? key(q.qid) : wrong(q.qid), sec = secFor ? secFor(dom, slot, i) : 20;
    ev.push({ part: 'P', t_ms: tt, qid: q.qid, type: 'q_enter', value: i + 1 }); tt += sec * 1000;
    ev.push({ part: 'P', t_ms: tt - 100, qid: q.qid, type: 'select', value: a }); ev.push({ part: 'P', t_ms: tt, qid: q.qid, type: 'q_leave', value: null });
    const state = { parts: { P: { ans: { [q.qid]: a }, elim: {}, mark: {}, ask: {}, cur: i } }, part_starts: { P: Date.now() - tt } };
    G.fresh(); const r = watch(G.call('placementNext', [code, st.set_id, { qid: q.qid, state, events: ev.slice(from), ev_from: from, copy: t.copy }]));
    from = ev.length;
    if (r.done) { out = r.result; break; }
    qs.push(r.question);
  }
  return { set_id: st.set_id, seen, result: out };
}
const strongRun = run('FX-T03', pub.assignment_id, () => true);
const doms = strongRun.seen.map(q => formOf[q].split(' ')[1]);
check(strongRun.seen.length === 15 && strongRun.seen.every(q => formOf[q][0] === 'A'), 'all right in time: 15 items, all from form A (' + strongRun.seen.map(q => formOf[q].slice(2)).join(', ') + ')');
check(doms.slice(0, 4).join(' ') === 'ALG PSD ALG GEO' && formOf[strongRun.seen[doms.indexOf('ADV')]].endsWith('M1'), 'interleaved; Advanced Math starts at Medium (Algebra = Strong)');
check(strongRun.result && strongRun.result.placement && strongRun.result.domains.every(d => d.word === 'Strong'), 'student sees Strong in all 4 domains: ' + JSON.stringify(strongRun.result.domains.map(d => d.word)));
check(!('items' in strongRun.result) && !/"answer"|"right"/.test(JSON.stringify(strongRun.result)), 'student result: no items, no answers');
G.fresh();
const lv = {}; C.readTable_('Levels').rows.filter(r => r.student_code === 'FX-T03').forEach(r => { lv[String(r.skill).replace(/^'/, '')] = r; });
const tested = [...new Set(strongRun.seen.map(q => String(Q[q].skill).replace(/^'/, '')))];
check(tested.length >= 8 && tested.every(k => lv[k] && lv[k].level === 'H' && /placement A → H/.test(lv[k].history)), 'Levels: ' + tested.length + ' tested skills at H (history "placement A → H")');
const pr = C.readTable_('Placements').rows.find(r => r.set_id === strongRun.set_id);
check(pr && ['alg', 'adv', 'psd', 'geo'].every(d => String(pr[d]).replace(/^'/, '') === 'H') && Number(pr.n_items) === 15 && pr.form === 'A', 'Placements row: ALG/ADV/PSD/GEO = H, 15 items, form A');
check(C.initialLevel_([], 'H.A', C.getSettings_(), 'FX-T03') === 'H' && C.initialLevel_([], 'S.D', C.getSettings_(), 'FX-T03') === 'H', 'untested skills (Linear eq. in one variable, Circles) start at the domain level (H)');
const setR = C.readTable_('Sets').rows.find(s => s.set_id === strongRun.set_id);
check(setR.status === 'submitted' && setR.kind === 'placement' && Number(setR.n) === 15 && /ALG-E1-F/.test(setR.slots), 'Sets row: submitted, kind placement, path in slots (' + String(setR.slots).slice(0, 40) + '…)');
const hist = C.historyOf_('FX-T03');
check(strongRun.seen.every(q => hist[q]), 'placement items count as seen for practice (history)');
let thrown = ''; try { G.call('getReview', ['FX-T03', strongRun.set_id]); } catch (e) { thrown = e.message; }
check(/no question review/.test(thrown), 'student cannot open a question review of the placement test');
G.fresh(); const home = G.call('homeData', ['FX-T03']);
check(!home.assignments.some(a => a.assignment_id === pub.assignment_id) && home.history.some(h => h.kind === 'placement') && !home.open.some(o => o.kind === 'placement'), 'home: card gone, placement in History, not in "Pick up"');
G.fresh(); const rep = G.call('teacherResult', ['TEACH-FX-9', strongRun.set_id]);
check(rep.placement_report && rep.items.length === 15 && rep.items.every(i => i.code && i.band) && rep.domains.every(d => d.level === 'H') && rep.teach_first.length === 0 && !rep.previous,
  'teacher report: 15 items with code + time band, 4 domains H, nothing to teach first, no earlier placement');

console.log('Retake (auto → form B), slow + wrong answers');
G.fresh();
const pub2 = G.call('publishAssignment', ['TEACH-FX-9', { kind: 'placement', target: 'st:FX-T03', form: 'auto' }]);
// Algebra: E1 slow right (70 s) → E2 slow right → M1 wrong → E3 wrong(2nd? no: Easy wrong #1) …; others: all wrong
const retake = run('FX-T03', pub2.assignment_id, (q, dom, slot) => dom === 'ALG' && slot.startsWith('E') && slot !== 'E3', (dom, slot) => dom === 'ALG' ? 70 : 15);
check(retake.seen.every(q => formOf[q][0] === 'B'), 'retake uses form B only (' + retake.seen.length + ' items)');
G.fresh();
const pr2 = C.readTable_('Placements').rows.find(r => r.set_id === retake.set_id);
const v = d => String(pr2[d]).replace(/^'/, '');
check(v('psd') === '<E' && v('geo') === '<E' && v('adv') === '<E', 'all wrong → PSD, GEO, ADV below Easy (2 items each)');
check(retake.result.domains.every(d => d.word === 'Weak'), 'student sees Weak (never "below Easy")');
const path2 = String(pr2.path);
check(/ALG E1S · .*ALG E2S/.test(path2), 'slow rights at Easy recorded as S (half step): ' + path2.split(' · ').filter(x => /ALG/.test(x)).join(' · '));
G.fresh(); const rep2 = G.call('placementReport', ['TEACH-FX-9', retake.set_id]);
check(rep2.previous && rep2.previous.set_id === strongRun.set_id && rep2.previous.domains.every(d => d.level === 'H'), 'report compares with the previous placement (form A, all H)');
check(rep2.teach_first.length === 3 && rep2.teach_first.every(k => k.level === 'E'), 'teach first: 3 skills at E: ' + rep2.teach_first.map(k => k.skill).join(' '));
check(rep2.items.filter(i => i.dom === 'ALG').map(i => i.band).join(' ') === 'slow slow fast slow', 'Algebra items at 70 s: Easy → slow; the Medium grid-in → fast (≤ 60 + 15 s)');
check(C.initialLevel_([], 'S.D', C.getSettings_(), 'FX-T03') === 'E', 'after the retake, untested Circles starts at E');

console.log('Repeat + no leak');
G.fresh();
const pub3 = G.call('publishAssignment', ['TEACH-FX-9', { kind: 'placement', target: 'st:FX-T01', form: 'B' }]);
G.fresh(); const s3 = G.call('startAssignment', ['FX-T01', pub3.assignment_id]); G.fresh(); const t3 = G.call('getSet', ['FX-T01', s3.set_id, {}]);
const q1 = t3.questions[0].qid, st1 = { parts: { P: { ans: { [q1]: key(q1) }, elim: {}, mark: {}, ask: {}, cur: 0 } } };
const evs = [{ part: 'P', t_ms: 0, qid: q1, type: 'q_enter', value: 1 }, { part: 'P', t_ms: 9000, qid: q1, type: 'select', value: key(q1) }, { part: 'P', t_ms: 10000, qid: q1, type: 'q_leave', value: null }];
G.fresh(); const a1 = G.call('placementNext', ['FX-T01', s3.set_id, { qid: q1, state: st1, events: evs, ev_from: 0, copy: t3.copy }]);
G.fresh(); const a2 = G.call('placementNext', ['FX-T01', s3.set_id, { qid: q1, state: st1, events: [], ev_from: 3, copy: t3.copy }]);
G.fresh(); const nResp = C.readTable_('Responses').rows.filter(r => r.set_id === s3.set_id).length;
check(formOf[q1] === 'B ALG E1' && a2.repeat && a2.question.qid === a1.question.qid && nResp === 1, 'form B forced; a repeated answer (network retry) is not graded twice');
G.fresh(); const t4 = G.call('getSet', ['FX-T01', s3.set_id, {}]);
check(t4.profile.placement && t4.questions.length === 2 && t4.questions[1].qid === a1.question.qid && t4.questions[1].display_no === 2, 'resume: the set comes back at question 2');
check(!leaks.length, 'no key, accepted, tags or short code in any student payload' + (leaks.length ? ': ' + leaks[0] : ''));

console.log(`\n${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
