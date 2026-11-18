// #68 D + #69 (Minh 18 Nov 20:29: Map B · Focus B · Progress B · Rush/Slow A · Colours A + gains): "My skills" v2 —
// 9-step ladder per skill (level + first-try % at that level), gains vs 1 / 2 weeks ago, Focus at the current level, E/M/H
// weekly lines, rushed share + slow extra time with "Review these" lists, My mistakes (no tips), practice by sub-skill.
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

console.log('[server: v2 formulas on fixtures]');
{
  const G = makeGas(), C = G.ctx;
  const R = [].concat(
    rowsFor('FX-T01', 'H.B', 'H.B.1', 'E', [[1, 1], [1, 2], [1, 3], [1, 4], [1, 5]]),
    rowsFor('FX-T01', 'H.B', 'H.B.2', 'M', [[1, 1], [0, 1], [0, 2], [1, 2], [0, 3]]),                                // 40 % at M
    rowsFor('FX-T01', 'P.C', 'P.C.1', 'E', rep(5, [1, 10])),
    rowsFor('FX-T01', 'P.C', 'P.C.2', 'M', [[1, 1], [1, 1], [1, 2], [0, 2], [0, 2]]),                                // 60 % at M
    rowsFor('FX-T01', 'H.A', 'H.A.1', 'M', [[1, 1, 'SLOW_RIGHT', { time_try1_sec: 200, pace_ratio: 2 }], [1, 1, 'SLOW_RIGHT', { time_try1_sec: 150, pace_ratio: 1.5 }],
                                              [1, 2], [1, 2], [1, 3], [1, 4], [0, 4],
                                              [1, 2, 'SLOW_RIGHT', { time_try1_sec: 3000, pace_ratio: 10 }]]),                   // 7 / 8 = 88 % at M; 50 min = left the page
    rowsFor('FX-T01', 'H.A', 'H.A.2', 'H', [[1, 8], [1, 8], [1, 15], [1, 15], [1, 16]]),
    rowsFor('FX-T01', 'S.C', 'S.C.1', 'E', rep(5, [1, 10])),
    rowsFor('FX-T01', 'S.C', 'S.C.2', 'M', [[0, 1], [0, 1]]),                                                           // only 2 at M
    rowsFor('FX-T01', 'Q.A', 'Q.A.1', 'E', rep(4, [0, 1, 'FAST_WRONG', { time_try1_sec: 12 }])),                     // 4 answers → grey
    rowsFor('FX-T01', 'Q.B', 'Q.B.1', 'E', rep(5, [0, 70])),                                                            // older than 60 days
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
  check(K('H.B').steps === 4 && K('P.C').steps === 5 && K('H.A').steps === 6, 'ladder at Medium: 40 % → 3+1 · 60 % → 3+2 · 88 % → 3+3 steps (' + [K('H.B').steps, K('P.C').steps, K('H.A').steps] + ')');
  check(K('S.C').steps === 3 && !K('S.C').grey, 'fewer than 5 answers at the level → only the 3 Easy steps');
  check(K('Q.A').grey && K('Q.A').steps === 0 && K('Q.B').n === 0 && K('Q.B').grey, '< 5 answers in the skill (or only answers > 60 days old) → grey');
  check(JSON.stringify(K('H.B').by) === JSON.stringify([{ d: 'E', n: 5, pct: 100 }, { d: 'M', n: 5, pct: 40 }, { d: 'H', n: 0, pct: null }]), 'skill page split: Easy 100 % · Medium 40 % · Hard –');
  check(JSON.stringify(d.focus) === JSON.stringify(['P.C', 'H.B']) && K('H.B').at_pct === 40 && K('P.C').at_pct === 60,
    'Focus = % at the current level only (H.B 40 % at M though 70 % overall), rank (1 − %) × weight: P.C 6.68 > H.B 5.82; H.A 86 % and S.C (2 at M) out');
  check(K('P.C').gain[7].was === 3 && K('P.C').gain[7].g === 2 && K('P.C').gain[14].g === 5, 'gains P.C: a week ago Easy 100 % (3 steps) → now 5: +2; two weeks ago no answers (grey): +5');
  check(K('S.C').gain[7].was === 6 && K('S.C').gain[7].g === 0 && K('S.C').gain[14].g === 3, 'S.C went H→M 3 days ago: a week ago 6 steps, now 3 → no loss shown (+0); vs 2 weeks: +3');
  check(K('H.A').gain[7].was === 3 && K('H.A').gain[7].g === 3, 'H.A a week ago: 5 answers, Medium, 0 at Medium → 3 steps; now 6: +3');
  const tot = w => d.skills.reduce((s, k) => s + k.gain[w].g, 0);
  check(d.gains[7].total === tot(7) && d.gains[7].skills.every(x => x.g > 0) && d.gains[7].skills[0].g >= d.gains[7].skills.slice(-1)[0].g, 'top line "This week: +' + d.gains[7].total + ' steps" = the sum of the gains, only skills that gained');
  const w0 = d.weeks[3], w1 = d.weeks[2], w2 = d.weeks[1];
  check(w0.E === 56 && w0.M === 60 && w0.H === null && w1.E === 100 && w1.H === null && w1.Hn === 2 && w2.H === 100 && d.weeks[0].E === null,
    'weekly lines: this week E 56 % · M 60 % · H none; a week with 2 Hard answers has no point (gap); 3 → a point');
  check(d.why.wrong === 12 && d.why.rushed === 4 && d.why.rushed_pct === 33, 'rushed: 4 of 12 wrong answers (33 %), window 60 days');
  check(d.why.slow === 3 && d.why.slow_extra === '1:15' && d.why.slow_items.length === 3, 'slow: +1:15 over normal (100 s and 50 s over); the 50-min one is listed but not averaged (left the page)');
  const ids = R.filter(r => r.student_code === 'FX-T01' && r.profile === 'FAST_WRONG').map(r => r.qid).sort();
  check(JSON.stringify(d.why.rushed_items.map(x => x.qid).sort()) === JSON.stringify(ids) && d.why.slow_items.map(x => x.qid).sort().join() === 'FXQ21,FXQ22,FXQ28', '"Review these" lists = exactly those questions');
  check(!/FX-T03|TEACH|"key"|student_code|"accepted"|"tip"/.test(JSON.stringify(d)), 'payload: nothing of other students (FX-T03), no teacher code, no keys, no tips (set ids carry only the student\'s own code, as everywhere in the app)');
  // mistakes thresholds
  const mine = () => C.readTable_('Responses').rows.filter(r => r.student_code === 'FX-T01');
  const tag = (qid, t) => { const r = mine().find(x => x.qid === qid); C.updateRow_('Responses', r._row, { mistake_type: t }); G.fresh(); };
  tag('FXQ7', 'Misread A Detail'); tag('FXQ8', 'Misread A Detail'); tag('FXQ10', 'Not A Mistake');
  d = G.call('mySkills', ['FX-T01']);
  check(!d.mistakes.enough && d.mistakes.n === 2, 'My mistakes: 2 tags (+ "Not A Mistake", not counted) → hidden');
  tag('FXQ19', 'Misread A Detail'); tag('FXQ34', 'Careless Calculation');
  d = G.call('mySkills', ['FX-T01']);
  const top = d.mistakes.types[0];
  check(d.mistakes.enough && top.t === 'Misread A Detail' && top.n === 3 && top.share === 75 && top.items.length === 3 && !('tip' in top), 'from 3 tags: Misread 3 · 75 % on top, its 3 questions, no tip');
  check(/LOGIN|SESSION|code/i.test((() => { try { G.call('mySkills', ['NOPE-1']); } catch (e) { return e.message; } })()), 'unknown code → refused');
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
    // FX-T01: two practice sets of H.B, the teacher tags 3 wrong answers, one wrong answer was rushed
    const Q = {}; g.table('Questions').forEach(r => { Q[r.qid] = r; });
    const key = id => String(Q[id].key).replace(/^'/, ''), wrong = id => Q[id].type === 'spr' ? '999' : ['A', 'B', 'C', 'D'].find(l => l !== key(id));
    const ev = (t, qid, type, value) => ({ part: 'P', t_ms: t, qid, type, value: value === undefined ? null : value });
    const wrongs = [];
    for (const plan of [[0, 1, 0, 1, 0], [0, 0, 1, 1, 1]]) {
      g.fresh(); const sp = g.call('startPractice', ['FX-T01', 'H.B', 5]); g.fresh();
      const t = g.call('getSet', ['FX-T01', sp.set_id, {}]), ans = {}, events = [ev(0, null, 'part_start', 'P')]; let ms = 1000;
      t.questions.forEach((q, i) => { events.push(ev(ms, q.qid, 'q_enter', i + 1)); ms += 50000; ans[q.qid] = plan[i] ? key(q.qid) : wrong(q.qid); events.push(ev(ms - 200, q.qid, 'select', ans[q.qid])); events.push(ev(ms, q.qid, 'q_leave')); if (!plan[i]) wrongs.push([sp.set_id, q.qid]); });
      g.fresh(); g.call('submit', ['FX-T01', sp.set_id, { state: { v: 1, current_part: 'P', phase: 'review', part_starts: { P: Date.now() - 400000 }, ended: {}, parts: { P: { cur: 0, ans, elim: {}, mark: {}, ask: {}, hl: {} } } }, events, ev_from: 0, copy: t.copy }]);
    }
    g.fresh();
    [['Misread A Detail'], ['Misread A Detail'], ['Concept Gap']].forEach(([t], i) => { g.call('tagMistake', [T, wrongs[i][0], wrongs[i][1], t, '']); g.fresh(); });
    { const r = g.ctx.readTable_('Responses').rows.find(x => x.set_id === wrongs[3][0] && x.qid === wrongs[3][1]); g.ctx.updateRow_('Responses', r._row, { profile: 'FAST_WRONG' }); g.fresh(); }
    const nR = g.ctx.readTable_('Responses').rows.filter(x => x.student_code === 'FX-T01' && x.profile === 'FAST_WRONG' && Number(x.try1_correct) !== 1).length;
    g.ctx.appendObjects_('Responses', rowsFor('FX-T01', 'P.C', 'P.C.1', 'E', rep(5, [1, 0])).concat(rowsFor('FX-T01', 'H.B', 'H.B.1', 'E', rep(5, [1, 0])))); g.fresh();   // gains this week
    for (const [dev, dark] of [['desktop1280', false], ['phone', false], ['desktop1280', true], ['phone', true]]) {
      const { page } = await E.newPage(dev); const tag = (dev === 'phone' ? '_phone' : '_laptop') + (dark ? '_dark' : '');
      if (dark) await page.emulateMedia({ colorScheme: 'dark' });
      await H.login(page, E.url, 'FX-T01'); await page.waitForSelector('#btn-myskills');
      await page.click('#btn-myskills'); await page.waitForSelector('#scr-skills.on #ms-focus .ms-h2');
      await page.waitForSelector('#ms-mist .mm-row');
      const txt = await page.$eval('#ms-main', e => e.innerText);
      if (!dark) {
        check(/Focus now/.test(txt) && /Why I miss questions/.test(txt) && /My mistakes/.test(txt) && /Skill map/.test(txt) && /My progress/.test(txt), dev + ': Focus now · Why I miss · My mistakes · Skill map · My progress');
        check(DELETED.every(re => !re.test(txt)), dev + ': the deleted texts are gone (tips, captions, "Read the question twice"…)');
        check((await page.$$('#ms-map .ms-lrow')).length === 19 && (await page.$$('#ms-map .ms-lad i')).length === 19 * 9 && !(await page.$('.ms-cell')), dev + ': skill map = 19 ladders of 9 steps (no heat map)');
        check(!/\b[EMH][123]\b/.test(await page.$eval('#ms-map', e => e.innerText)), dev + ': no "M2 / H1" text');
        check(/^This week: \+\d+ steps?/.test(await page.$eval('#ms-gain', e => e.innerText)) && !!(await page.$('#ms-map .ms-lad i.up')) && /^\+\d$/.test(await page.$eval('#ms-map .ms-lrow[data-ms-open="P.C"] .ms-lg', e => e.textContent)), dev + ': gains — top line "This week: +n steps", new steps outlined green, "+n" at the row end');
        check(/\d+ of \d+/.test(await page.$eval('#ms-rush', e => e.innerText)) && new RegExp('^' + nR + ' of 5\\nwrong answers were rushed \\(' + Math.round(100 * nR / 5) + '%\\)\\nReview these ' + nR + ' →').test(await page.$eval('#ms-rush', e => e.innerText)), dev + ': rushed card "' + nR + ' of 5 wrong answers were rushed" + Review these ' + nR);
        check(/most common/i.test(txt) && /Misread A Detail/.test(await page.$eval('#ms-mist .mm-row.top', e => e.innerText)), dev + ': My mistakes top type highlighted');
        const reds = await page.evaluate(() => [...document.querySelectorAll('#ms-map .ms-lad i, #ms-map .ms-legend i')].map(i => getComputedStyle(i).backgroundColor).filter(c => { const m = c.match(/\d+/g).map(Number); return m[0] > 150 && m[1] < 120 && m[2] < 120; }).length);
        check(reds === 0, dev + ': no red in the ladders');
        check(!/FX-T0|TEACH/.test(await page.content()), dev + ': no codes on the page');
      } else {
        const bg = await page.$eval('#scr-skills', e => getComputedStyle(e).backgroundColor);
        check(bg === 'rgb(255, 255, 255)', dev + ': a phone in dark mode still gets the white page (Minh: no dark) (' + bg + ')');
      }
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), dev + (dark ? ' dark' : '') + ': no sideways scroll');
      await full(page, 'ms69_skills' + tag);
      await page.click('#ms-map .ms-lrow[data-ms-open="H.B"]'); await page.waitForSelector('#scr-skill.on .ms-srow');
      if (!dark) {
        check((await page.$$('#sk-main .ms-srow')).length === 5 && !!(await page.$('#sk-main [data-ms-psub]')) && (await page.$$('#sk-main .ms-emc')).length === 3, dev + ': skill page — ladder, Easy / Medium / Hard %, 5 sub-skills with Practise 5');
        check(!(await page.$('#sk-main .sm-dot.r, #sk-main .sm-dot.g, #sk-main .sm-dot.y')), dev + ': sub-skill dots on the blue scale');
      }
      await full(page, 'ms69_skill' + tag);
      if (dev === 'desktop1280' && !dark) {
        await page.click('#sk-main [data-ms-back="skills"]'); await page.waitForSelector('#scr-skills.on #ms-rush .ms-rv');
        await page.click('[data-ms-vs="14"]'); await sleep(100);
        check(await page.$eval('[data-ms-vs="14"]', e => e.getAttribute('aria-pressed')) === 'true' && (!(await page.$('#ms-gain')) || /^Last 2 weeks/.test(await page.$eval('#ms-gain', e => e.innerText))), 'switch "vs 2 weeks ago" → the gains compare with 2 weeks ago');
        await page.click('[data-ms-vs="7"]');
        await page.click('#ms-rush .ms-rv'); await page.waitForSelector('#scr-mist.on .mm-q');
        check((await page.$$('#mi-main .mm-q')).length === nR && /R \d:\d\d/.test(await page.$eval('#mi-main .mm-q', e => e.innerText)), '"Review these" → exactly the rushed question (with its time)');
        await page.click('#mi-main [data-ms-q="0"]'); await page.waitForSelector('#scr-test.viewing #btn-view-back');
        check(/Back to the list/.test(await page.$eval('#btn-view-back', e => e.textContent)), 'Open → the review screen ("Back to the list")');
        await page.click('#btn-view-back'); await page.waitForSelector('#scr-mist.on .mm-q');
        await page.click('#mi-main [data-ms-back="skills"]'); await page.waitForSelector('#scr-skills.on #ms-mist .mm-see');
        await page.click('#ms-mist .mm-see'); await page.waitForSelector('#scr-mist.on .mm-q');
        check((await page.$$('#mi-main .mm-q')).length === 2 && /^\d{1,2} [A-Z][a-z]{2} · /.test(await page.$eval('#mi-main .mm-q span', e => e.textContent)), '"See these questions" → the 2 Misread A Detail questions');
        await shot(page, 'ms69_list_laptop');
        await page.click('#mi-main [data-ms-back="skills"]'); await page.waitForSelector('#scr-skills.on');
        await page.click('#ms-map .ms-lrow[data-ms-open="H.B"]'); await page.waitForSelector('#sk-main [data-ms-psub]');
        const sub = await page.$eval('#sk-main [data-ms-psub]', e => e.getAttribute('data-ms-psub'));
        await page.click('#sk-main [data-ms-psub]'); await page.waitForSelector('#scr-test.on #tb-title');
        await sleep(300);
        const title = await page.$eval('#tb-title', e => e.textContent);
        check(/Practice/.test(title) && !/Linear functions/.test(title), 'sub-skill Practise 5 → a practice set of that sub-skill (' + title + ')');
        g.fresh(); const st = g.ctx.readTable_('Sets').rows.slice(-1)[0];
        check(st.subskill === sub, 'Sets row has the sub-skill ' + sub);
      }
      await page.context().close();
    }
    console.log('new student');
    { const { page } = await E.newPage('phone'); await H.login(page, E.url, 'FX-T03'); await page.waitForSelector('#btn-myskills'); await page.click('#btn-myskills'); await page.waitForSelector('#ms-focus .ms-empty');
      const t = await page.$eval('#ms-main', e => e.innerText);
      check(/Nothing yet/.test(t) && /hasn't tagged enough/.test(t) && /Shows up after your first set/.test(t) && (await page.$$('#ms-map .ms-lad i.n')).length === 19 * 9 && !(await page.$('#ms-gain')), 'new student: the empty states, all ladders grey, no gains line');
      await page.click('#ms-map .ms-lrow[data-ms-open="H.B"]'); await page.waitForSelector('#sk-notyet');
      check(/Not enough answers yet/.test(await page.$eval('#sk-notyet', e => e.textContent)), 'tap a grey skill → "Not enough answers yet"');
      await full(page, 'ms69_new_phone'); await page.context().close(); }
    H.englishOnly(E);
  } catch (e) { console.error(e); check(false, 'exception: ' + e.message); }
  await E.close();
  process.exit(H.summary() ? 1 : 0);
})();
