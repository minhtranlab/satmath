// #68 D (Minh 18 Nov, after the #67 preview): "My skills" in the app — Focus now · Why I miss · My mistakes · Skill map +
// popover · My progress · a skill's sub-skills with "Practise 5" = practice by SUB-skill. Formulas = the prototype README.
const { makeGas } = require('./server');
const H = require('./h'); const { check, sleep, shot } = H;
const full = (page, name) => page.screenshot({ path: require('path').join(H.SHOTS, name + '.png'), fullPage: true });
const T = 'TEACH-FX-9', DAY = 86400000;
const iso = d => new Date(Date.now() - d * DAY).toISOString();
let seq = 0;
function rowsFor(code, skill, sub, list) {            // list: [[ok, daysAgo, profile, mistake]]
  return list.map(([ok, d, p, m]) => ({ set_id: 'FXS-' + code + '-' + (++seq), student_code: code, qid: 'FXQ' + seq, order: 1, skill, subskill: sub,
    try1_correct: ok, best_correct: ok, profile: p || (ok ? 'NORMAL_RIGHT' : 'NORMAL_WRONG'), mistake_type: m || '', submitted_at: iso(d) }));
}
const rep = (k, x) => Array.from({ length: k }, () => x.slice());

console.log('[server: formulas on fixtures]');
{
  const G = makeGas(), C = G.ctx;
  const rows = [].concat(
    rowsFor('FX-T01', 'H.B', 'H.B.1', [[1, 1], [0, 2], [0, 3], [0, 3], [1, 4]]),                       // 40 % · 5 answers · weight 9.7
    rowsFor('FX-T01', 'P.C', 'P.C.1', [[1, 1], [1, 2], [1, 3], [0, 3], [0, 50]]),                       // 60 % (old wrong) · 16.7
    rowsFor('FX-T01', 'H.A', 'H.A.1', [[1, 1], [1, 2], [1, 3], [1, 3], [0, 4]]),                        // 80 % → green, not in Focus
    rowsFor('FX-T01', 'S.C', 'S.C.1', [[0, 1], [0, 2], [0, 3], [0, 4]]),                               // 4 answers → grey, not ranked
    rowsFor('FX-T01', 'Q.A', 'Q.A.1', [[0, 61], [0, 62], [0, 63], [0, 64], [0, 65]]),                  // older than 60 days → not counted
    rowsFor('FX-T03', 'H.B', 'H.B.2', rep(6, [0, 1, 'FAST_WRONG', 'Concept Gap'])));                  // another student
  C.appendObjects_('Responses', rows); G.fresh();
  let d = G.call('mySkills', ['FX-T01']);
  const K = k => d.skills.find(x => x.k === k);
  check(d.n_all === 19, '60-day window: 19 answers (the 5 older ones left out) — ' + d.n_all);
  check(K('H.B').pct === 40 && K('H.B').col === 'r' && K('P.C').pct === 60 && K('P.C').col === 'y' && K('H.A').pct === 80 && K('H.A').col === 'g', 'colours: 40 % red · 60 % amber · 80 % green');
  check(K('S.C').n === 4 && K('S.C').col === 'n' && !K('S.C').ranked && K('Q.A').n === 0 && K('Q.A').col === 'n', 'fewer than 5 answers → grey, not ranked (S.C 4 q; Q.A only old answers → none)');
  // score = (1 − wacc) × weight, wacc weighted 0.5^(age/14)
  const wacc = xs => { let s = 0, r = 0; xs.forEach(([ok, a]) => { const w = Math.pow(0.5, a / 14); s += w; r += w * ok; }); return r / s; };
  const sHB = (1 - wacc([[1, 1], [0, 2], [0, 3], [0, 3], [1, 4]])) * 9.7, sPC = (1 - wacc([[1, 1], [1, 2], [1, 3], [0, 3], [0, 50]])) * 16.7;
  const want = sPC > sHB ? ['P.C', 'H.B'] : ['H.B', 'P.C'];
  check(JSON.stringify(d.focus) === JSON.stringify(want), 'Focus now = skills < 80 % with ≥ 5 answers, by (1 − wacc) × weight: ' + d.focus.join(', ') + ' (H.B ' + sHB.toFixed(2) + ' · P.C ' + sPC.toFixed(2) + ')');
  check(d.why.n === 18 && d.why.types.length === 0, 'Why I miss: last 30 days (18 answers), no teacher notes yet');
  check(d.weeks[3].n === 18 && d.weeks[3].pct === 50 && d.weeks[2].pct === null && d.weeks[0].pct === null, 'weekly line: this week ' + d.weeks[3].pct + ' %; weeks under 5 answers have no point');
  check(!d.mistakes.enough && d.mistakes.types.length === 0, 'My mistakes hidden with no tags');
  check(!/FX-T03|FX-T0|TEACH|"key"|student_code|"accepted"/.test(JSON.stringify(d)), 'payload: nothing of other students, no codes, no keys');

  // mistakes: 2 tags → hidden; + 1 more + a "Not A Mistake" → shown
  const R = () => C.readTable_('Responses').rows.filter(r => r.student_code === 'FX-T01');
  const tag = (qid, t) => { const r = R().find(x => x.qid === qid); C.updateRow_('Responses', r._row, { mistake_type: t }); G.fresh(); };
  tag('FXQ2', 'Misread A Detail'); tag('FXQ3', 'Misread A Detail'); tag('FXQ10', 'Not A Mistake');
  d = G.call('mySkills', ['FX-T01']);
  check(!d.mistakes.enough && d.mistakes.n === 2, '2 tags (+ 1 "Not A Mistake", not counted) → still hidden ("not enough yet")');
  tag('FXQ4', 'Careless Calculation'); tag('FXQ5', 'Misread A Detail');   // H.B 4 days; …and one P.C 35 days ago:
  C.appendObjects_('Responses', rowsFor('FX-T01', 'P.C', 'P.C.2', [[0, 35, '', 'Misread A Detail']])); G.fresh();
  d = G.call('mySkills', ['FX-T01']);
  const m = d.mistakes, top = m.types[0];
  check(m.enough && m.n === 5 && top.t === 'Misread A Detail' && top.n === 4 && top.share === 80 && m.types[1].t === 'Careless Calculation' && m.types[1].share === 20, 'shown from 3 tags: Misread 4 · 80 % (top) · Careless 1 · 20 %');
  check(top.now === 3 && top.before === 1 && top.trend === 'up', 'trend: last 4 weeks 3 vs 1 the 4 weeks before → up');
  check(top.skills.length === 1 && /Linear functions/.test(top.skills[0]), 'skill where it happens most: ' + top.skills.join(', '));
  check(top.tip && top.items.length === 4 && top.items[0].qid && !('student_code' in top.items[0]), '"See these questions": 4 items (newest first), a tip');
  check(d.why.types[0].t === 'Misread A Detail' && d.why.types[0].n === 3, 'teacher\'s notes (30 days): Misread A Detail · 3');
  // level-ups
  const dm = n => { const x = new Date(Date.now() - n * DAY); return x.getDate() + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][x.getMonth()]; };
  C.appendObjects_('Levels', [{ student_code: 'FX-T01', skill: 'H.B', level: 'H', history: 'placement F1 → E ' + dm(40) + ' · E→M ' + dm(30) + ' · M→H ' + dm(5) + ' · H→M ' + dm(3) },
                              { student_code: 'FX-T01', skill: 'P.C', level: 'M', history: 'mixed M→H ' + dm(2) }]); G.fresh();
  d = G.call('mySkills', ['FX-T01']);
  check(d.ups.length === 1 && d.ups[0].k === 'H.B' && d.ups[0].from === 'M' && d.ups[0].to === 'H' && K('H.B').level === 'H', 'level-ups: only "M→H" (28 days, up, not placement / mixed-first / down)');
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
    const g = G(), C = g.ctx;
    // FX-T01: two practice sets of H.B, the teacher tags 3 wrong answers
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
    for (const dev of ['desktop1280', 'phone']) {
      const { page } = await E.newPage(dev); const tag = dev === 'phone' ? '_phone' : '_laptop';
      await H.login(page, E.url, 'FX-T01'); await page.waitForSelector('#btn-myskills');
      await shot(page, 'ms68_home' + tag);
      await page.click('#btn-myskills'); await page.waitForSelector('#scr-skills.on #ms-focus .ms-h2');
      await page.waitForSelector('#ms-mist .mm-row');
      check(await page.$eval('#ms-pop', e => getComputedStyle(e).display === 'none'), dev + ': no empty popover on the page');
      const txt = await page.$eval('#ms-main', e => e.innerText);
      check(/Focus now/.test(txt) && /Why I miss questions/.test(txt) && /My mistakes/.test(txt) && /Skill map/.test(txt) && /My progress/.test(txt), dev + ': My skills — Focus now · Why I miss · My mistakes · Skill map · My progress');
      check(/Misread A Detail/.test(await page.$eval('#ms-mist .mm-row.top', e => e.innerText)) && /most common/i.test(txt), dev + ': My mistakes — top type highlighted (Misread A Detail)');
      check(!/FX-T0|TEACH/.test(await page.content()), dev + ': no codes on the page');
      const fit = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
      check(fit, dev + ': no sideways scroll');
      await full(page, 'ms68_skills' + tag);
      await page.click('.ms-cell[data-ms-cell="H.B"]'); await page.waitForSelector('#ms-pop:not([hidden])');
      check(/Linear functions/.test(await page.$eval('#ms-pop', e => e.innerText)) && /Level:/.test(await page.$eval('#ms-pop', e => e.innerText)), dev + ': tap a square → name, % right first try, Level, Details / Practise 5');
      await shot(page, 'ms68_pop' + tag);
      await page.click('#ms-pop [data-ms-open]'); await page.waitForSelector('#scr-skill.on .ms-srow');
      check(await page.$eval('#ms-pop', e => getComputedStyle(e).display === 'none'), dev + ': the popover closes when the skill page opens');
      check((await page.$$('#sk-main .ms-srow')).length === 5 && !!(await page.$('#sk-main [data-ms-psub]')), dev + ': skill page — 5 sub-skills, Practise 5 on the weak ones');
      await full(page, 'ms68_skill' + tag);
      if (dev === 'desktop1280') {
        await page.click('#sk-main [data-ms-back="skills"]'); await page.waitForSelector('#scr-skills.on #ms-mist .mm-see');
        await page.click('#ms-mist .mm-see'); await page.waitForSelector('#scr-mist.on .mm-q');
        check((await page.$$('#mi-main .mm-q')).length === 2, '"See these questions" → the 2 Misread A Detail questions');
        await shot(page, 'ms68_mist' + tag);
        await page.click('#mi-main [data-ms-q="0"]'); await page.waitForSelector('#scr-test.viewing #btn-view-back');
        check(/my mistakes/i.test(await page.$eval('#btn-view-back', e => e.textContent)), 'Open → the question in the review screen ("Back to my mistakes")');
        await page.click('#btn-view-back'); await page.waitForSelector('#scr-mist.on .mm-q');
        check(/^\d{1,2} [A-Z][a-z]{2} · /.test(await page.$eval('#mi-main .mm-q span', e => e.textContent)), 'Back → the mistakes list again (dates like "18 Nov")');
        await page.click('#mi-main [data-ms-back="skills"]'); await page.waitForSelector('#scr-skills.on');
        await page.$eval('.ms-cell[data-ms-cell="H.B"]', e => e.click()); await page.click('#ms-pop [data-ms-open]'); await page.waitForSelector('#sk-main [data-ms-psub]');
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
      check(/Nothing yet/.test(t) && /hasn't tagged enough/.test(t) && /Shows up after your first set/.test(t) && (await page.$$('.ms-cell.n')).length === 19, 'new student: the empty states, all squares grey');
      await full(page, 'ms68_new_phone'); await page.context().close(); }
    H.englishOnly(E);
  } catch (e) { console.error(e); check(false, 'exception: ' + e.message); }
  await E.close();
  process.exit(H.summary() ? 1 : 0);
})();
