// #108 (from Test Zone #52 v1.17.2, spr52_test) grid-in answers by the official SAT / Bluebook entry rules: grader cases from
// the SAT directions, negatives with 6 characters, equivalent fractions, 09A M2-11 (441/677: .6514 ✓ 0.651 ✓ .651 ✗ .6515 ✗,
// 441/677 cannot be typed), "Show answer" prints only typeable entries, the browser grader (Fix / placement) = the server
// grader on 40,000 random cases, the input box (5 / 6 characters, allowed characters), the directions (2/3 example).
const fs = require('fs'), vm = require('vm'), P = require('./paths');
const H = require('./h'); const { check, sleep, shot, waitMath } = H;
const T = 'TEACH-FX-9';

// server grader (Code.gs) and browser grader (Client.html), each alone in a sandbox
const gs = fs.readFileSync(P.APP + '/Code.gs', 'utf8'), C = {}; vm.createContext(C);
vm.runInContext(gs.slice(gs.indexOf('function isCorrect_'), gs.indexOf('/** Tags (Questions tab)')), C);
const ch = fs.readFileSync(P.APP + '/Client.html', 'utf8'), B = {}; vm.createContext(B);
vm.runInContext(ch.slice(ch.indexOf('  function sprParseC'), ch.indexOf('  function rightC(')), B);

console.log('[grader: the SAT directions]');
const Tk = (a, k) => C.sprCorrect_(a, k.split('|'));
const row = (k, list) => { const bad = list.filter(([a, want]) => Tk(a, k) !== want); return bad.length ? bad.map(x => x[0]).join(' ') : ''; };
const cases = [
  ['2/3', [['2/3', true], ['4/6', true], ['.6666', true], ['.6667', true], ['0.666', true], ['0.667', true], ['.66', false], ['.67', false], ['0.66', false], ['0.67', false]], '2/3: 2/3, 4/6, .6666, .6667, 0.666, 0.667 right; .66 .67 0.66 0.67 wrong'],
  ['7/9', [['.7777', true], ['.7778', true], ['0.777', true], ['0.778', true], ['0.77', false], ['.78', false], ['0.78', false]], '7/9 (directions table): .7777 .7778 0.777 0.778 right; 0.77 .78 0.78 wrong'],
  ['5/2', [['2.5', true], ['2.50', true], ['5/2', true], ['10/4', true], ['2 1/2', false], ['21/2', false]], '2.5: 2.5, 2.50, 5/2, 10/4 right; mixed "2 1/2" and 21/2 wrong'],
  ['-2/7', [['-2/7', true], ['-.2857', true], ['-0.285', true], ['-0.286', true], ['-.28', false], ['-0.29', false], ['2/7', false]], 'negative (6 characters): -2/7, -.2857, -0.285, -0.286 right; -.28, -0.29, 2/7 wrong'],
  ['-1/3', [['-.3333', true], ['-0.333', true], ['-.33333', false], ['-0.3333', false]], 'negative: 7 characters never count (-.33333, -0.3333)'],
  ['1/2', [['2/4', true], ['.5', true], ['0.50', true], ['1.5/3', false], ['50%', false], ['$.5', false], ['0,5', false], [' 1/2 ', true]], 'equivalent fraction 2/4 right; a decimal inside a fraction, %, $ and a comma wrong'],
  ['12', [['12', true], ['12.0', true], ['012', true], ['12.01', false], ['123456', false]], 'whole numbers: 12, 12.0 right; 12.01, 6 characters wrong'],
  ['441/677|0.651|.6514', [['.6514', true], ['0.651', true], ['.651', false], ['.6515', false], ['0.652', false], ['441/677', false], ['0.6514', false]], '09A M2-11 (441/677): .6514 ✓ 0.651 ✓; .651 .6515 0.652 ✗; 441/677 (7 characters) and 0.6514 (6) cannot be typed'],
  ['2/3|0.67|.67', [['.67', false], ['0.67', false], ['.6667', true], ['2/3', true]], 'a short rounded form in the accepted list is a display form only: .67 / 0.67 wrong for 2/3'],
  ['10/3|3.333', [['3.333', true], ['3.33', false], ['10/3', true], ['3.334', false]], '10/3: 3.333 fills the box ✓, 3.33 ✗'],
  ['0.651|.6514', [['.651', false], ['0.651', true], ['.6514', true]], 'only rounded decimals listed (different values) → each counts as typed, nothing shorter']
];
cases.forEach(([k, list, label]) => { const b = row(k, list); check(!b, label + (b ? ' — WRONG: ' + b : '')); });

console.log('[Show answer: only what can be typed]');
check(C.sprShow_('441/677|0.651|.6514'.split('|')).join(' or ') === '.6514 or 0.651', 'Show answer text for 441/677: ".6514 or 0.651" (never 441/677)');
const shows = { '3/4|0.75|.75': '3/4 or 0.75', '9/17|0.529|.5294': '9/17 or 0.529', '36/5|7.2|7.200': '36/5 or 7.2', '12.5|25/2': '12.5', '-1': '-1', '2/3': '2/3', '1000/3': '333.3', '2/3|0.67': '2/3' };
const bad = Object.keys(shows).filter(k => C.sprShow_(k.split('|')).join(' or ') !== shows[k]);
check(!bad.length, 'the exact answer when it fits (+ one decimal form), else the box-filling decimal: ' + Object.keys(shows).map(k => k + ' → ' + shows[k]).join('; ') + (bad.length ? ' — WRONG: ' + bad.map(k => k + ' → ' + C.sprShow_(k.split('|')).join(' or ')).join('; ') : ''));
check(C.sprFill_({ n: 7, d: 9 }).join() === '.7777,.7778,0.777,0.778' && C.sprFill_({ n: -2, d: 7 }).join() === '-.2857,-0.285,-0.286', 'box-filling forms: 7/9 → .7777 .7778 0.777 0.778; -2/7 → -.2857 -0.285 -0.286');
const every = Object.keys(shows).concat(['441/677|0.651|.6514', '-2/7', '7/9']).every(k => C.sprShow_(k.split('|')).every(f => C.sprCorrect_(f, k.split('|')) && f.length <= (f[0] === '-' ? 6 : 5)));
check(every, 'every form Show answer prints fits the box and is graded right');
check(JSON.stringify(C.keyShow_({ type: 'mcq', key: 'C' })) === '["C"]' && C.keyShow_({ type: 'spr', key: '441/677', accepted: ['441/677', '0.651', '.6514'] }).join() === '.6514,0.651', 'keyShow_: MCQ = the letter; SPR = the typeable forms');

console.log('[the browser grader = the server grader]');
{
  let seed = 7; const rnd = n => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
  const vals = () => { const d = 1 + rnd(40), n = rnd(2000) - 400; return [n, d]; };
  const forms = (n, d) => { const v = n / d, s = v < 0 ? '-' : '', a = Math.abs(v); return [n + '/' + d, String(+v.toFixed(4)), s + a.toFixed(3), s + a.toFixed(2), s + a.toFixed(4).replace(/^0/, ''), s + a.toFixed(3).replace(/^0/, ''), s + (Math.floor(a * 1000) / 1000).toFixed(3), s + (Math.floor(a * 10000) / 10000).toFixed(4).replace(/^0/, ''), String(Math.round(v)), (2 * n) + '/' + (2 * d)]; };
  let diff = 0, n = 0, ex = '';
  for (let i = 0; i < 2000; i++) {
    const [a, b] = vals(), f = forms(a, b), keys = [f[0]].concat(rnd(2) ? [f[1]] : []).concat(rnd(3) ? [] : [f[2], f[4]]);
    const ans = forms(a, b).concat(forms(...vals()).slice(0, 3), ['', '.', '-', '1.5/3', 'abc', '1/0', '00000']);
    ans.forEach(x => { n++; if (C.sprCorrect_(x, keys) !== B.sprRightC(x, keys)) { diff++; if (!ex) ex = JSON.stringify([x, keys]); } });
  }
  check(!diff, 'browser (Fix / placement check) and server agree on ' + n + ' random answers' + (diff ? ' — ' + diff + ' differ, e.g. ' + ex : ''));
}

console.log('[Sheet update: keys that cannot be typed + past answers re-graded]');
{
  const { makeGas } = require('./server');
  const G = makeGas(), X = G.ctx, tab = n => G.sheets[n].rows, hd = n => tab(n)[0];
  const setKey = (qid, k, acc) => { const r = tab('Questions').find(x => x[hd('Questions').indexOf('qid')] === qid); r[hd('Questions').indexOf('key')] = k; r[hd('Questions').indexOf('accepted')] = acc; };
  // a practice set with grid-ins, answered
  const sp = G.call('startPractice', ['FX-T01', 'H.B', 5]); G.fresh();
  const t = G.call('getSet', ['FX-T01', sp.set_id, {}]); const spr = t.questions.filter(q => q.type === 'spr').map(q => q.qid);
  check(spr.length >= 1, 'a practice set with ' + spr.length + ' grid-in question(s)');
  const ans = {}; t.questions.forEach(q => { ans[q.qid] = q.type === 'spr' ? '.651' : 'A'; });
  const ev = [{ part: 'P', t_ms: 0, qid: null, type: 'part_start', value: 'P' }]; t.questions.forEach((q, i) => { ev.push({ part: 'P', t_ms: i * 40000 + 1000, qid: q.qid, type: 'q_enter', value: i + 1 }, { part: 'P', t_ms: i * 40000 + 30000, qid: q.qid, type: 'select', value: ans[q.qid] }, { part: 'P', t_ms: i * 40000 + 39000, qid: q.qid, type: 'q_leave', value: null }); });
  G.fresh(); G.call('submit', ['FX-T01', sp.set_id, { state: { v: 1, current_part: 'P', phase: 'review', part_starts: { P: Date.now() - 600000 }, ended: {}, parts: { P: { cur: 0, ans, elim: {}, mark: {}, ask: {}, hl: {} } } }, events: ev, ev_from: 0, copy: t.copy }]);
  // the key becomes 441/677 (09A M2-11); the stored grade of ".651" is the OLD one (right, by value)
  const q0 = spr[0]; setKey(q0, '441/677', '441/677|0.651|.6514');
  const RH = hd('Responses'), rr = tab('Responses').find(r => r[RH.indexOf('set_id')] === sp.set_id && r[RH.indexOf('qid')] === q0);
  rr[RH.indexOf('try1_correct')] = 1; rr[RH.indexOf('best_correct')] = 1;
  const TH = hd('Tries'), tr = tab('Tries').find(r => r[TH.indexOf('set_id')] === sp.set_id && r[TH.indexOf('qid')] === q0); if (tr) tr[TH.indexOf('correct')] = 1;
  const SH = hd('Sets'), srow = tab('Sets').find(r => r[SH.indexOf('set_id')] === sp.set_id), ft0 = Number(srow[SH.indexOf('first_try')]) + 1; srow[SH.indexOf('first_try')] = ft0; srow[SH.indexOf('best_score')] = ft0;
  G.fresh(); X._forceFresh = true;
  const m1 = X.gridinKeyCheck_(); const keysTab = G.table('Gridin_Keys');
  check(/1 key\(s\) cannot be typed/.test(m1) && keysTab.length === 1 && keysTab[0].qid === q0 && /key_untypeable/.test(keysTab[0].problem) && keysTab[0].show_answer === '.6514 or 0.651', 'Gridin_Keys: ' + q0 + ' (441/677) key_untypeable, Show answer ".6514 or 0.651" — "' + m1 + '"');
  G.fresh(); X._forceFresh = true;
  const m2 = X.gridinRegrade_(), lg = G.table('Gridin_Regrade');
  const r2 = G.table('Responses').find(r => r.set_id === sp.set_id && r.qid === q0);
  check(/dry run/.test(m2) && /first try 1 right→wrong/.test(m2) && lg.some(x => x.qid === q0 && x.what === 'first try' && x.answer === '.651' && x.was === 'right' && x.now === 'wrong' && x.applied === 'no' && x.student === 'Test Student (test)') && String(r2.try1_correct) === '1',
    'dry run: ".651" right → wrong logged in Gridin_Regrade (by name, not code), nothing changed — "' + m2 + '"');
  check(!lg.some(x => /FX-T01/.test(JSON.stringify(x))), 'the log has no student code (not even inside a set id)');
  X.GRIDIN_APPLY_ = true; G.fresh(); X._forceFresh = true;
  const m3 = X.gridinRegrade_(); G.fresh();
  const r3 = G.table('Responses').find(r => r.set_id === sp.set_id && r.qid === q0), s3 = G.table('Sets').find(r => r.set_id === sp.set_id);
  check(/applied/.test(m3) && String(r3.try1_correct) === '0' && String(r3.best_correct) === '0' && Number(s3.first_try) === ft0 - 1 && Number(s3.best_score) === ft0 - 1, 'apply: first try + best corrected, set First Try / Best ' + ft0 + ' → ' + s3.first_try + ' — "' + m3 + '"');
  G.fresh(); X._forceFresh = true;
  const m4 = X.gridinRegrade_();
  check(/first try 0 right→wrong \+ 0 wrong→right/.test(m4) && G.table('Gridin_Regrade').length === 0, 'run again → nothing left to change (safe to repeat)');
  X.GRIDIN_APPLY_ = false;
}

(async () => {
  const E = await H.setup(); const G = () => E.st.gas;
  try {
    // FX1-004 gets the 09A M2-11 key in the Questions tab (the Sheet key wins over the file)
    const Q = G().sheets.Questions.rows, h = Q[0], r = Q.find(x => x[h.indexOf('qid')] === 'FX1-004');
    r[h.indexOf('key')] = '441/677'; r[h.indexOf('accepted')] = '441/677|0.651|.6514'; G().fresh();

    console.log('[browser: the grid-in box + directions]');
    const { page, ctx } = await E.newPage('desktop1280');
    await H.login(page, E.url, 'FX-T01'); await page.waitForSelector('#picker .sm-it');
    await page.click('#picker [data-k="H.B"]'); await page.click('#picker [data-n="5"]'); await page.click('#btn-start');
    await page.waitForSelector('#btn-begin'); await page.click('#btn-begin'); await page.waitForSelector('#qwrap .q.on');
    for (let i = 0; i < 5 && !(await page.$('#qwrap .q.on .spr-in')); i++) { await page.click('#btn-next'); await sleep(200); }
    const typed = async s => { await page.fill('#qwrap .q.on .spr-in', ''); await page.type('#qwrap .q.on .spr-in', s); await sleep(60); return await page.inputValue('#qwrap .q.on .spr-in'); };
    const t1 = await typed('441/677'), t2 = await typed('-.333333'), t3 = await typed('1,5%$ a'), t4 = await typed('-2-/7.');
    check(t1 === '441/6' && t2 === '-.3333' && t3 === '15' && t4 === '-2/7', 'box: "441/677" stops at 5 characters (' + t1 + '), "-" allows 6 (' + t2 + '); only digits . / and a leading - (' + t3 + ', ' + t4 + ')');
    await page.fill('#qwrap .q.on .spr-in', '');
    const dir = await page.textContent('#qwrap .q.on .spr-dir-pane');
    check(/up to 5 characters for a positive answer and up to 6/.test(dir) && /fraction that does not fit/.test(dir) && /must fill the whole box/.test(dir) && /\.6666, \.6667, 0\.666 or 0\.667, not \.66, \.67, 0\.66 or 0\.67/.test(dir) && /Do not type symbols such as %, \$ or a comma/.test(dir),
      'directions: 5 / 6 characters; a fraction that does not fit → decimal; truncate or round and fill the box (2/3 example); no symbols');
    await shot(page, 'spr108_directions');
    await ctx.close();

    console.log('[teacher Show answer]');
    const tp = (await E.newPage('desktop1280')).page;
    await H.login(tp, E.url, T); await tp.waitForSelector('[data-prof="FX-T01"]');
    await tp.evaluate(() => SMLX.goOver(SMLX.call('goOverData', SMLX.A.code, ['FX1-004']), { sid: 'go', notesKey: 's108', backLabel: 'Back' }));
    await tp.waitForSelector('#scr-test.going #go-show'); await waitMath(tp);
    await tp.click('#go-show'); await sleep(150);
    const ans = (await tp.textContent('#scr-test')).replace(/\s+/g, ' ');
    check(/Correct answer: \.6514 or 0\.651/.test(ans) && !/441\/677/.test(ans), 'go-over Show answer: "Correct answer: .6514 or 0.651" — no 441/677 anywhere');
    await shot(tp, 'spr108_show_answer');
    G().fresh(); const k1 = G().call('teacherKey', [T, 'FX1-004']); G().fresh(); const k2 = G().call('goOverData', [T, ['FX1-004']]);
    check(k1.key.join() === '.6514,0.651' && k2.keys['FX1-004'].key.join() === '.6514,0.651', 'teacher payloads carry the typeable forms only');
    H.englishOnly(E);
  } catch (e) { console.error(e); check(false, 'exception: ' + e.message); }
  await E.close();
  process.exit(H.summary() ? 1 : 0);
})();
