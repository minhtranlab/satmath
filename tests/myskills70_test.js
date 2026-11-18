// "My skills" v3 (#68 D, #69, #70 Minh 18 Nov 21:28–22:13): 9 blocks per skill in one blue (position = max of the level rule
// and every difficulty with ≥ 5 answers ≥ 50 %; Placement = the starting point), gained blocks green vs last week / month,
// Practise per row, Focus at the difficulty of the position, rushed / slow lists, My mistakes; student top bar + History;
// the teacher's student page = the same blocks + ticks / sets / go-over; masked codes; no narrator text.
const { makeGas } = require('./server');
const H = require('./h'); const { check, sleep, shot } = H;
const full = (page, name) => page.screenshot({ path: require('path').join(H.SHOTS, name + '.png'), fullPage: true });
const T = 'TEACH-FX-9', DAY = 86400000;
const iso = d => new Date(Date.now() - d * DAY + 60000).toISOString();
const dm = n => { const x = new Date(Date.now() - n * DAY); return x.getDate() + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][x.getMonth()]; };
let seq = 0;
function rowsFor(code, skill, sub, dif, list) {      // list: [[ok, daysAgo, profile?, extra fields?]]
  return list.map(([ok, d, p, x]) => Object.assign({ set_id: 'FXS-' + code + '-' + (++seq), student_code: code, qid: 'FXQ' + seq, order: 1, skill, subskill: sub, difficulty: dif,
    try1_correct: ok, best_correct: ok, profile: p || (ok ? 'NORMAL_RIGHT' : 'NORMAL_WRONG'), mistake_type: '', submitted_at: iso(d) }, x || {}));
}
const rep = (k, x) => Array.from({ length: k }, () => x.slice());
const DELETED = [/Read the question twice/, /Practise for speed/, /Last 30 days\. Time = time to your final answer/, /What your teacher saw/, /Tip:/, /The idea itself is shaky/, /Underline units/, /Your weakest skills that count most/];

console.log('[server: v3 position, gains, focus]');
{
  const G = makeGas(), C = G.ctx;
  const R = [].concat(
    rowsFor('FX-T01', 'H.B', 'H.B.1', 'E', [[1, 1], [1, 2], [1, 3], [1, 4], [1, 5]]),
    rowsFor('FX-T01', 'H.B', 'H.B.2', 'M', [[1, 1], [0, 1], [0, 2], [1, 2], [0, 3]]),                                // 40 % at M
    rowsFor('FX-T01', 'P.C', 'P.C.1', 'E', rep(5, [1, 10])),
    rowsFor('FX-T01', 'P.C', 'P.C.2', 'M', [[1, 1], [1, 1], [1, 2], [0, 2], [0, 2]]),                                // 60 % at M
    rowsFor('FX-T01', 'H.A', 'H.A.1', 'M', [[1, 1, 'SLOW_RIGHT', { time_try1_sec: 200, pace_ratio: 2 }], [1, 1, 'SLOW_RIGHT', { time_try1_sec: 150, pace_ratio: 1.5 }],
                                              [1, 2], [1, 2], [1, 3], [1, 4], [0, 4],
                                              [1, 2, 'SLOW_RIGHT', { time_try1_sec: 26754, pace_ratio: 4.49, away_sec: 26000 }]]),   // 7 / 8 at M; 7 h → listed, not averaged
    rowsFor('FX-T01', 'H.A', 'H.A.2', 'H', [[1, 8], [1, 8], [1, 15], [1, 15], [1, 16]]),                            // Hard 5 / 5
    rowsFor('FX-T01', 'S.C', 'S.C.1', 'E', rep(5, [1, 10])),
    rowsFor('FX-T01', 'S.C', 'S.C.2', 'M', [[0, 1], [0, 1]]),                                                           // only 2 at M
    rowsFor('FX-T01', 'Q.A', 'Q.A.1', 'E', rep(4, [0, 1, 'FAST_WRONG', { time_try1_sec: 12 }])),
    rowsFor('FX-T01', 'Q.B', 'Q.B.1', 'E', rep(5, [0, 70])),                                                            // older than 60 days
    rowsFor('FX-T01', 'Q.C', 'Q.C.1', 'H', [[1, 1], [1, 1], [1, 2], [0, 2], [0, 3]]),                                // no level: Hard 60 % → 8
    rowsFor('FX-T03', 'H.B', 'H.B.2', 'M', rep(6, [0, 1, 'FAST_WRONG', { mistake_type: 'Concept Gap' }])));          // another student
  C.appendObjects_('Responses', R);
  C.appendObjects_('Levels', [
    { student_code: 'FX-T01', skill: 'H.B', level: 'M', history: '' },
    { student_code: 'FX-T01', skill: 'P.C', level: 'M', history: 'placement F1 → E ' + dm(30) + ' · E→M ' + dm(3) },
    { student_code: 'FX-T01', skill: 'H.A', level: 'M', history: '' },
    { student_code: 'FX-T01', skill: 'S.C', level: 'M', history: 'mixed M→H ' + dm(20) + ' · H→M ' + dm(3) },
    { student_code: 'FX-T01', skill: 'Q.A', level: 'E', history: '' }]);
  G.fresh();
  let d = G.call('mySkills', ['FX-T01']);
  const K = k => d.skills.find(x => x.k === k);
  check(K('H.B').steps === 4 && K('P.C').steps === 5 && K('H.A').steps === 9, 'position: Medium 40 % → 3+1 · Medium 60 % → 3+2 · Hard 100 % (5 answers) → 9 (' + [K('H.B').steps, K('P.C').steps, K('H.A').steps] + ')');
  check(K('Q.C').steps === 8 && K('Q.C').src === 'H' && !K('Q.C').level, 'no level, Hard 60 % (5 answers) → 8 blocks (difficulty lifts the position)');
  check(K('S.C').steps === 3 && K('Q.A').steps === 0 && K('Q.B').steps === 0, '< 5 answers at the level → only the lower levels; Easy level with 4 answers → 0; no level, no answers → 0');
  check(JSON.stringify(K('H.B').by) === JSON.stringify([{ d: 'E', n: 5, pct: 100 }, { d: 'M', n: 5, pct: 40 }, { d: 'H', n: 0, pct: null }]), 'skill page split: Easy 100 % · Medium 40 % · Hard –');
  check(JSON.stringify(d.focus) === JSON.stringify(['P.C', 'H.B', 'Q.C']) && K('H.B').fd === 'M' && K('H.B').f_pct === 40 && K('Q.C').fd === 'H' && K('Q.C').f_pct === 60,
    'Focus = % at the difficulty that gave the position: P.C 60 % at M, H.B 40 % at M, Q.C 60 % at Hard; H.A (100 % at Hard) and S.C (2 at M → its Easy 100 %) out');
  check(K('P.C').gain[7].was === 3 && K('P.C').gain[7].g === 2 && K('P.C').gain[30].g === 5, 'gains P.C: a week ago Easy 100 % (3) → now 5: +2; a month ago (Placement that day, no answers) 0 → +5');
  check(K('S.C').gain[7].was === 6 && K('S.C').gain[7].g === 0 && K('S.C').gain[30].g === 3, 'S.C went H→M: a week ago 6, now 3 → no loss shown; a month ago no level → +3');
  check(K('H.A').gain[7].g === 0 && K('H.A').gain[30].g === 6, 'H.A: a week ago Hard 5 / 5 already → 9 (+0); a month ago 3 → +6');
  const tot = w => d.skills.reduce((s, k) => s + k.gain[w].g, 0);
  check(d.gains[7].total === tot(7) && d.gains[30].total === tot(30) && !('14' in d.gains), 'gains: vs last week and vs last month (no "2 weeks")');
  const w0 = d.weeks[3], w1 = d.weeks[2], w2 = d.weeks[1];
  check(w0.E === 56 && w0.M === 60 && w0.H === 60 && w1.E === 100 && w1.H === null && w1.Hn === 2 && w2.H === 100 && d.weeks[0].E === null,
    'weekly lines: this week E 56 % · M 60 % · H 60 %; a week with 2 Hard answers has no point (gap); 3 → a point');
  check(d.why.wrong === 14 && d.why.rushed === 4 && d.why.rushed_pct === 29, 'rushed: 4 of 14 wrong answers (29 %)');
  check(d.why.slow === 3 && d.why.slow_extra === '1:15' && d.why.slow_items.length === 3, 'slow: +1:15 over normal; the 7-hour one (> 10 min) is listed but not averaged');
  const ids = R.filter(r => r.student_code === 'FX-T01' && r.profile === 'FAST_WRONG').map(r => r.qid).sort();
  check(JSON.stringify(d.why.rushed_items.map(x => x.qid).sort()) === JSON.stringify(ids), '"Review these" lists = exactly those questions');
  check(!/FX-T03|TEACH|"key"|student_code|"accepted"|"tip"|"sets"/.test(JSON.stringify(d)), 'student payload: nothing of other students, no teacher code, no keys, no teacher extras');
  const tv = G.call('studentProfile', [T, 'FX-T01']).my;
  check(tv.v === 3 && tv.skills.find(x => x.k === 'H.B').sets.length >= 1 && tv.skills.find(x => x.k === 'H.B').subs.find(x => x.ss === 'H.B.2').sets.length >= 1 && tv.skills.find(x => x.k === 'H.B').steps === 4,
    'teacher payload: the same blocks + the sets under each skill / sub-skill');
  const mine = () => C.readTable_('Responses').rows.filter(r => r.student_code === 'FX-T01');
  const tag = (qid, t) => { const r = mine().find(x => x.qid === qid); C.updateRow_('Responses', r._row, { mistake_type: t }); G.fresh(); };
  tag('FXQ7', 'Misread A Detail'); tag('FXQ8', 'Misread A Detail'); tag('FXQ10', 'Not A Mistake');
  d = G.call('mySkills', ['FX-T01']);
  check(!d.mistakes.enough && d.mistakes.n === 2, 'My mistakes: 2 tags (+ "Not A Mistake") → hidden');
  tag('FXQ19', 'Misread A Detail'); tag('FXQ34', 'Careless Calculation');
  d = G.call('mySkills', ['FX-T01']);
  check(d.mistakes.enough && d.mistakes.types[0].t === 'Misread A Detail' && d.mistakes.types[0].n === 3, 'from 3 tags: Misread 3 on top');
}

console.log('[server: Placement baseline]');
{
  const G = makeGas(), C = G.ctx;
  C.appendObjects_('Placements', [{ set_id: 'S-PL-FX-T03', student_code: 'FX-T03', form: 'A', finished_at: iso(10), n_items: 15, n_right: 9, time_min: 20, alg: 'M', adv: 'H', psd: 'E', geo: '<E' }]);
  G.fresh();
  const d = G.call('mySkills', ['FX-T03']), K = k => d.skills.find(x => x.k === k);
  check(K('H.B').steps === 3 && K('P.C').steps === 6 && K('Q.A').steps === 0 && K('S.C').steps === 0 && K('H.B').level === 'M', 'with Placement (Alg M · Adv H · PSD E · Geo below E): Algebra 3 · Advanced 6 · the rest 0, no answers needed');
  check(K('P.C').gain[7].g === 0 && K('P.C').gain[30].g === 6, 'the Placement 10 days ago: +0 vs last week, +6 vs last month');
  const n = G.call('mySkills', ['FX-T01']);
  check(n.skills.every(k => k.steps === 0), 'without Placement and answers: every skill 0');
}

console.log('[server: practice by sub-skill]');
{
  const G = makeGas(), C = G.ctx;
  const live = C.livePool_(), inSub = s => live.filter(r => r.subskill === s).map(r => r.qid);
  const p2 = C.pickForSub_('FX-T01', 'H.B', 'H.B.3', 2, 'seed1');
  check(p2.qids.length === 2 && p2.sub_n === 2 && p2.qids.every(q => inSub('H.B.3').includes(q)), 'enough live items → the whole set from that sub-skill (H.B.3: 2 of 2)');
  const r = G.call('startSubPractice', ['FX-T01', 'H.B.3', 5, {}]); G.fresh();
  const s = C.readTable_('Sets').rows.find(x => x.set_id === r.set_id), q = String(s.qids).split(',');
  check(r.sub_n === 2 && r.filled === 3 && q.length === 5 && new Set(q).size === 5 && q.slice(0, 2).every(x => inSub('H.B.3').includes(x)) && q.slice(2).every(x => live.find(y => y.qid === x).skill === 'H.B'),
    'fewer than 5 → its 2 first, 3 more from the same skill (no repeats), the page is told (filled 3)');
  check(s.subskill === 'H.B.3' && s.skill === 'H.B' && s.kind === 'practice' && /Practice · /.test(C.setTitle_(s)) && C.setTitle_(s) !== 'Practice · ' + C.skillName_('H.B'), 'Sets row: practice of H.B, subskill H.B.3, title = the sub-skill (' + C.setTitle_(s) + ')');
  G.fresh(); const again = G.call('startSubPractice', ['FX-T01', 'H.B.3', 5, {}]); G.fresh();
  const whole = G.call('startPractice', ['FX-T01', 'H.B', 5, {}]); G.fresh();
  check(again.resumed && again.set_id === r.set_id && !whole.resumed && whole.set_id !== r.set_id, 'unfinished sub-skill set resumes; the whole-skill practice is a separate set');
  G.fresh(); const h = G.call('homeData', ['FX-T01']);
  check(h.open.some(o => o.sub === 'H.B.3') && h.open.some(o => o.skill === 'H.B' && !o.sub), 'home: both unfinished sets listed (the sub-skill one marked)');
  check(/sub-skill/.test((() => { try { G.call('startSubPractice', ['FX-T01', 'X.Y.9', 5, {}]); } catch (e) { return e.message; } })()), 'unknown sub-skill → refused');
}

(async () => {
  const E = await H.setup(); const G = () => E.st.gas;
  try {
    const g = G();
    // FX-T01: two practice sets of H.B, the teacher tags 3 wrong answers, one wrong answer was rushed; 7 sets in all (History)
    const Q = {}; g.table('Questions').forEach(r => { Q[r.qid] = r; });
    const key = id => String(Q[id].key).replace(/^'/, ''), wrong = id => Q[id].type === 'spr' ? '999' : ['A', 'B', 'C', 'D'].find(l => l !== key(id));
    const ev = (t, qid, type, value) => ({ part: 'P', t_ms: t, qid, type, value: value === undefined ? null : value });
    const wrongs = [];
    const doSet = (skill, plan) => {
      g.fresh(); const sp = g.call('startPractice', ['FX-T01', skill, 5]); g.fresh();
      const t = g.call('getSet', ['FX-T01', sp.set_id, {}]), ans = {}, events = [ev(0, null, 'part_start', 'P')]; let ms = 1000;
      t.questions.forEach((q, i) => { events.push(ev(ms, q.qid, 'q_enter', i + 1)); ms += 50000; ans[q.qid] = plan[i] ? key(q.qid) : wrong(q.qid); events.push(ev(ms - 200, q.qid, 'select', ans[q.qid])); events.push(ev(ms, q.qid, 'q_leave')); if (!plan[i]) wrongs.push([sp.set_id, q.qid]); });
      g.fresh(); g.call('submit', ['FX-T01', sp.set_id, { state: { v: 1, current_part: 'P', phase: 'review', part_starts: { P: Date.now() - 400000 }, ended: {}, parts: { P: { cur: 0, ans, elim: {}, mark: {}, ask: {}, hl: {} } } }, events, ev_from: 0, copy: t.copy }]);
      return sp.set_id;
    };
    for (const plan of [[0, 1, 0, 1, 0], [0, 0, 1, 1, 1]]) doSet('H.B', plan);
    for (let i = 0; i < 4; i++) doSet('H.B', [1, 1, 1, 0, 1]);
    g.fresh();
    [['Misread A Detail'], ['Misread A Detail'], ['Concept Gap']].forEach(([t], i) => { g.call('tagMistake', [T, wrongs[i][0], wrongs[i][1], t, '']); g.fresh(); });
    { const r = g.ctx.readTable_('Responses').rows.find(x => x.set_id === wrongs[3][0] && x.qid === wrongs[3][1]); g.ctx.updateRow_('Responses', r._row, { profile: 'FAST_WRONG' }); g.fresh(); }
    g.ctx.appendObjects_('Responses', rowsFor('FX-T01', 'P.C', 'P.C.1', 'E', rep(5, [1, 0]))); g.fresh();     // P.C 5 / 5 Easy today → +3 this week
    const nSets = g.ctx.readTable_('Sets').rows.filter(x => x.student_code === 'FX-T01' && x.status === 'submitted').length;
    for (const dev of ['desktop1280', 'phone', 'ipad']) {
      const { page } = await E.newPage(dev); const tag = '_' + (dev === 'desktop1280' ? 'laptop' : dev);
      await H.login(page, E.url, 'FX-T01'); await page.waitForSelector('#btn-myskills');
      // top bar + History on home
      check(!!(await page.$('#scr-home .sm-nav [data-top="skills"]')) && !!(await page.$('#scr-home .sm-nav [data-top="hist"]')), dev + ': home top bar: My skills · History next to the name');
      check((await page.$$('#history tr')).length === 6 && !!(await page.$('#btn-fullhist')), dev + ': home History = the 5 latest sets + "Full history" (' + nSets + ' sets)');
      if (dev === 'desktop1280') {
        await shot(page, 'ms70_home' + tag);
        await page.click('#btn-fullhist'); await page.waitForSelector('#scr-hist.on #history-all');
        check((await page.$$('#history-all tr')).length === nSets + 1 && !!(await page.$('#scr-hist .sm-nav [data-top="home"]')), 'Full history: every set, newest first; top bar has Home');
        await page.click('#scr-hist .sm-nav [data-top="home"]'); await page.waitForSelector('#scr-home.on');
      }
      await page.click('#scr-home .sm-nav [data-top="skills"]'); await page.waitForSelector('#scr-skills.on #ms-map .ms-lrow');
      const txt = await page.$eval('#ms-main', e => e.innerText);
      check(/Focus now/.test(txt) && /Why I miss questions/.test(txt) && /My mistakes/.test(txt) && /Skill map/.test(txt) && /My progress/.test(txt) && !!(await page.$('#scr-skills .sm-nav [data-top="home"]')), dev + ': My skills blocks + Home in the top bar');
      check(!(await page.$('#ms-gain')) && !/This week: \+/.test(txt) && !/answers in the last 60 days/.test(txt), dev + ': no "This week: +n steps" line, no caption');
      const cols = await page.evaluate(() => { const c = {}; document.querySelectorAll('#ms-map .ms-lad i').forEach(i => { const k = i.className || 'off'; c[k] = c[k] || new Set(); c[k].add(getComputedStyle(i).backgroundColor); }); return Object.fromEntries(Object.entries(c).map(([k, v]) => [k, [...v]])); });
      check((cols.on || cols.up) && (!cols.on || (cols.on.length === 1 && cols.on[0] === 'rgb(50, 77, 199)')) && cols.off.length === 1 && cols.off[0] === 'rgb(227, 231, 240)' && (!cols.up || (cols.up.length === 1 && cols.up[0] === 'rgb(31, 157, 97)')), dev + ': one blue for the map, one light neutral for empty blocks, gained blocks green ' + JSON.stringify(cols));
      check(/^\+3$/.test(await page.$eval('#ms-map .ms-lrow[data-k="P.C"] .ms-lg', e => e.textContent)) && (await page.$$('#ms-map .ms-lrow[data-k="P.C"] .ms-lad i.up')).length === 3, dev + ': P.C gained 3 blocks this week: 3 green blocks + "+3"');
      const fx = await page.$eval('#ms-focus', e => e.innerText);
      check(/\d+% at (Easy|Medium|Hard)/.test(fx) || (!(await page.$('#ms-focus .ms-frow')) && /Nothing below 80% yet/.test(fx)), dev + ': Focus "n% at Medium" (' + fx.replace(/\s+/g, ' ') + ')');
      check(!/\b[EMH][123]\b/.test(await page.$eval('#ms-map', e => e.innerText)) && (await page.$$('#ms-map .ms-pr')).length === 19, dev + ': no "M2 / H1" text; a Practise button on each of the 19 rows');
      await full(page, 'ms70_skills' + tag);
      if (dev === 'desktop1280') {
        await page.click('[data-ms-vs="30"]'); await sleep(100);
        check(await page.$eval('[data-ms-vs="30"]', e => e.getAttribute('aria-pressed')) === 'true' && /vs last month/.test(await page.$eval('.ms-vs', e => e.innerText)) && !/2 weeks/.test(await page.$eval('.ms-vs', e => e.innerText)), 'switch "vs last week · vs last month"');
        await page.click('[data-ms-vs="7"]');
        await page.click('#ms-rush .ms-rv'); await page.waitForSelector('#scr-mist.on .mm-q');
        check(/R \d:\d\d/.test(await page.$eval('#mi-main .mm-q', e => e.innerText)), '"Review these" → exactly the rushed questions');
        await page.click('#mi-main [data-ms-q="0"]'); await page.waitForSelector('#scr-test.viewing #btn-view-back');
        await page.waitForFunction(() => /Back to the list/.test(document.querySelector('#btn-view-back').textContent), null, { timeout: 8000 }).catch(() => {});
        check(/Back to the list/.test(await page.$eval('#btn-view-back', e => e.textContent)), 'Open → the review screen ("Back to the list")');
        await page.click('#btn-view-back'); await page.waitForSelector('#scr-mist.on .mm-q');
        await page.click('#scr-mist .sm-nav [data-top="skills"]'); await page.waitForSelector('#scr-skills.on #ms-map');
        await page.click('#ms-map .ms-lrow[data-k="H.B"] .ms-lbtn'); await page.waitForSelector('#scr-skill.on .ms-srow');
        check((await page.$$('#sk-main .ms-emc')).length === 3 && !!(await page.$('#sk-main [data-ms-psub]')) && !!(await page.$('#scr-skill .sm-nav [data-top="home"]')), 'a row → the skill page (E / M / H %, sub-skills with Practise 5), Home in the top bar');
        await full(page, 'ms70_skill' + tag);
        await page.click('#scr-skill .sm-nav [data-top="skills"]'); await page.waitForSelector('#scr-skills.on #ms-map');
        await page.click('#ms-map .ms-lrow[data-k="H.B"] .ms-pr'); await page.waitForSelector('#scr-test.on #tb-title'); await sleep(300);
        g.fresh(); const st = g.ctx.readTable_('Sets').rows.slice(-1)[0];
        check(st.kind === 'practice' && st.skill === 'H.B' && Number(st.n) === 5 && !st.subskill, 'Practise on a map row → 5 questions of that one skill (' + await page.$eval('#tb-title', e => e.textContent) + ')');
      }
      await page.context().close();
    }
    console.log('teacher: the student page = the same blocks + extras');
    for (const dev of ['desktop1280', 'ipad']) {
      const { page } = await E.newPage(dev); const tag = '_' + (dev === 'desktop1280' ? 'laptop' : dev);
      await H.login(page, E.url, T); await page.waitForSelector('[data-prof="FX-T01"]');
      const codes = await page.$$eval('#t-students .t-scode', a => a.map(e => e.innerText.trim()));
      check(codes.length >= 2 && codes.every(c => c === '●●●●') && !/FX-T0/.test(await page.$eval('#t-students', e => e.innerText)), dev + ': class list: student codes hidden (●●●●)');
      if (dev === 'desktop1280') {
        await page.click('#t-students .t-scode .t-mask'); await sleep(100);
        check(/FX-T0\d/.test(await page.$eval('#t-students .t-scode.on', e => e.innerText)) && !!(await page.$('#t-students .t-scode.on .t-copy')), 'click ●●●● → the code + Copy');
        await page.click('h1, .t-head, body', { position: { x: 5, y: 5 } }).catch(() => {}); await page.mouse.click(5, 300); await sleep(100);
        check(!(await page.$('#t-students .t-scode.on')), 'click elsewhere → hidden again');
      }
      await page.$eval('[data-prof="FX-T01"]', e => e.click()); await page.waitForSelector('#t-my #ms-map .ms-lrow');
      const tt = await page.$eval('#t-body', e => e.innerText);
      check(['#ms-focus', '#ms-why', '#ms-mist', '#ms-map', '#ms-prog'].every(x => tt && true) && (await page.$$('#t-my #ms-focus, #t-my #ms-why, #t-my #ms-mist, #t-my #ms-map, #t-my #ms-prog')).length === 5, dev + ': teacher student page shows the same 5 blocks');
      check(!/Level per skill|Good sets in a row|Timing:|Mistake types:|Placement tests|Slow \/ rushed/.test(tt) && (await page.$$('#t-my .ms-ck')).length === 19 && !(await page.$('#t-my .ms-pr')), dev + ': old table / lines gone; tick boxes on the map rows, no Practise buttons');
      const head = await page.$eval('#t-body .t-head', e => e.innerText);
      check(/●●●●/.test(head) && !/FX-T01/.test(head), dev + ': profile code hidden (' + head.replace(/\s+/g, ' ').slice(0, 80) + ')');
      if (dev === 'desktop1280') {
        await page.click('#t-my .ms-lrow[data-k="H.B"] .ms-lbtn'); await page.waitForSelector('#ms-tdet-H-B:not([hidden]) .ms-setn');
        const nb = await page.$$eval('#ms-tdet-H-B .ms-emh + .ms-sets .ms-setn', a => a.map(e => e.textContent));
        check(nb.length === 6 && nb.join() === '1,2,3,4,5,6' && (await page.$$('#ms-tdet-H-B .ms-srow .ms-setn')).length >= 2, 'a skill row → E / M / H %, its sets 1 … 6 and the sets under each sub-skill');
        await full(page, 'ms70_teacher' + tag);
        await page.click('#ms-tdet-H-B .ms-setn'); await page.waitForSelector('#scr-test.going #go-show');
        check(true, 'a set number → Go over');
        await page.click('#btn-view-back'); await page.waitForSelector('#t-my');
        await page.click('#t-my #ms-rush .ms-rv'); await page.waitForSelector('#scr-test.going #go-show');
        check(true, '"Review these" (teacher) → the questions in go-over');
        await page.click('#btn-view-back'); await page.waitForSelector('#t-my');
      } else await full(page, 'ms70_teacher' + tag);
      await page.context().close();
    }
    console.log('new student');
    { const { page } = await E.newPage('phone'); await H.login(page, E.url, 'FX-T03'); await page.waitForSelector('#btn-myskills'); await page.click('#btn-myskills'); await page.waitForSelector('#ms-focus .ms-empty');
      const t = await page.$eval('#ms-main', e => e.innerText);
      check((await page.$$('#ms-map .ms-lad i.on, #ms-map .ms-lad i.up')).length === 0 && [...t.matchAll(/^.*$/gm)].length > 0 && $$len(await page.$$eval('.ms-empty', a => a.map(e => e.textContent))), 'new student: every block empty (≤ 6 words), no filled blocks');
      await full(page, 'ms70_new_phone'); await page.context().close(); }
    H.englishOnly(E);
  } catch (e) { console.error(e); check(false, 'exception: ' + e.message); }
  await E.close();
  process.exit(H.summary() ? 1 : 0);
})();
function $$len(a) { return a.length >= 3 && a.every(x => x.trim().split(/\s+/).length <= 6); }
