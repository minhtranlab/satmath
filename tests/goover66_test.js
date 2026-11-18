// #66 (Minh 18 Nov): the teacher sees the time next to every R / S badge (set Result, profile Sets, What to go over,
// Grid, Details) — "S 2:35", hover "2:35 to the final answer · normal 1:10 (220 %)"; the go-over has the student's
// entries + time in memory (Student's answer at once, no server call). Student payloads unchanged.
const { makeGas } = require('./server');
const H = require('./h'); const { check, sleep, shot, waitMath } = H;
const T = 'TEACH-FX-9';
const ev = (t, qid, type, value) => ({ part: 'P', t_ms: Math.round(t * 1000), qid, type, value: value === undefined ? null : value });
function doSet(G, code, plan) {                      // plan: [['wrong', 3], ['right', 600], …] → R / S badges
  const Q = {}; G.table('Questions').forEach(r => { Q[r.qid] = r; });
  const key = id => String(Q[id].key).replace(/^'/, ''), wrong = id => Q[id].type === 'spr' ? '999' : ['A', 'B', 'C', 'D'].find(l => l !== key(id));
  G.fresh(); const sp = G.call('startPractice', [code, 'H.B', plan.length]); G.fresh();
  const t = G.call('getSet', [code, sp.set_id, {}]), ans = {}, events = [ev(0, null, 'part_start', 'P')]; let s = 0;
  t.questions.forEach((q, i) => { const [ok, sec] = plan[i]; events.push(ev(s, q.qid, 'q_enter', i + 1)); s += sec; ans[q.qid] = ok === 'right' ? key(q.qid) : wrong(q.qid); events.push(ev(s - 0.5, q.qid, 'select', ans[q.qid])); events.push(ev(s, q.qid, 'q_leave')); });
  G.fresh(); G.call('submit', [code, sp.set_id, { state: { v: 1, current_part: 'P', phase: 'review', part_starts: { P: Date.now() - s * 1000 - 5000 }, ended: {}, parts: { P: { cur: 0, ans, elim: {}, mark: {}, ask: {}, hl: {} } } }, events, ev_from: 0, copy: t.copy }]);
  G.fresh();
  return { set_id: sp.set_id, qids: t.questions.map(q => q.qid), Q };
}
const PLAN = [['wrong', 3], ['right', 600], ['wrong', 60], ['right', 50], ['right', 45]];

console.log('[server]');
{
  const G = makeGas();
  const a = doSet(G, 'FX-T01', PLAN);
  const resp = G.table('Responses').filter(r => r.set_id === a.set_id).sort((x, y) => x.order - y.order);
  console.log('    profiles:', resp.map(r => r.profile + ' ' + r.time_try1_sec + 's pace ' + r.pace_ratio).join(' | '));
  const tr = G.call('teacherResult', [T, a.set_id]), cells = tr.review[0].questions;
  const rq = cells.find(q => q.badge === 'R'), sq = cells.find(q => q.badge === 'S');
  check(rq && sq && rq.t === 3 && sq.t === 600 && sq.nm > 0, 'teacher result: R and S cells carry the time (R ' + (rq || {}).t + ' s · S ' + (sq || {}).t + ' s, normal ' + (sq || {}).nm + ' s)');
  G.fresh(); const sr = G.call('getResult', ['FX-T01', a.set_id]);
  check(!sr.review[0].questions.some(q => 't' in q || 'nm' in q), 'student result payload unchanged (no time fields added)');
  G.fresh(); const rv = G.call('getReview', ['FX-T01', a.set_id]);
  check(!/"rows"|"keys"|"key"|"accepted"|"students"/.test(JSON.stringify(rv)), 'student review payload: no keys, no rows, no other students');
  G.fresh(); const tv = G.call('teacherReview', [T, a.set_id]);
  const row = tv.rows.find(r => r.qid === sq.qid), st = row && row.students[0];
  check(tv.rows.length === 5 && st && st.tries.length && st.time_s === 600 && st.norm_s > 0 && st.badge === 'S' && tv.rows.every(r => r.students.length === 1), 'teacher go-over payload: entries (all tries) + time + normal time of each question, this student only');
  G.fresh(); const pr = G.call('studentProfile', [T, 'FX-T01']), ps = pr.sets.find(x => x.set_id === a.set_id);
  check(ps.rs.length === 2 && ps.rs.some(x => x.b === 'S' && x.t === 600) && ps.rs.some(x => x.b === 'R' && x.t === 3), 'profile Sets: the R / S questions with their time');
  G.fresh(); const cv = G.call('classView', [T, 'st:FX-T01', 's:' + a.set_id]);
  check(cv.rows.find(r => r.qid === sq.qid).students[0].norm_s > 0, 'What to go over / Grid rows: normal time for the hover');
}

(async () => {
  const E = await H.setup(); const G = () => E.st.gas;
  try {
    const a = doSet(G(), 'FX-T01', PLAN);
    const cells = G().call('teacherResult', [T, a.set_id]).review[0].questions, sq = cells.find(q => q.badge === 'S'), rq = cells.find(q => q.badge === 'R');
    const mm = s => Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
    for (const dev of ['desktop1280', 'ipad']) {
      const { page } = await E.newPage(dev); const tag = dev === 'ipad' ? '_ipad' : '';
      await H.login(page, E.url, T); await page.waitForSelector('[data-prof="FX-T01"]');
      await page.$eval('[data-prof="FX-T01"]', e => e.click());
      // 2. profile Sets
      await page.waitForSelector('#t-sets');
      const setsTxt = await page.$eval('#t-sets', e => e.innerText);
      check(!/Slow \/ rushed/i.test(setsTxt) && /Left the window/i.test(setsTxt), dev + ' · profile Sets: no "Slow / rushed" column (#70), "Left the window" kept');
      await page.$eval('#t-sets', e => e.scrollIntoView({ block: 'center' })); await sleep(200); await shot(page, 'go66_sets' + tag);
      // 1. set Result
      await page.$eval('#t-sets [data-res]', e => e.click()); await page.waitForSelector('#result-body .rcell.tm');
      const cellTxt = await page.$eval('#result-body .rcell[data-qid="' + sq.qid + '"]', e => e.innerText.replace(/\s+/g, ' ') + ' | ' + e.title);
      check(cellTxt.includes(mm(600)) && /normal \d+:\d\d \(\d+ %\)/.test(cellTxt), dev + ' · Result cell: the time under the S badge, hover "' + cellTxt.split(' | ')[1] + '"');
      const chip = await page.$$eval('#result-body .qchip small', a => a.map(e => e.textContent));
      check(chip.some(t => /S \d+:\d\d/.test(t)), dev + ' · Result chips: "S 10:00" next to the question code');
      await page.$eval('#result-body .rgrid', e => e.scrollIntoView({ block: 'center' })); await sleep(200); await shot(page, 'go66_result' + tag);
      // go-over from the Report: time at once, Student's answer instant
      E.st.rpcLog = [];
      await page.$eval('#result-body .rcell[data-qid="' + sq.qid + '"]', e => e.click());
      await page.waitForSelector('#scr-test.going #go-stu'); await waitMath(page);
      await page.waitForFunction(() => /Time/.test(document.querySelector('#fb-go').innerText));
      check(new RegExp('Time\\s*' + mm(600)).test(await page.$eval('#fb-go', e => e.innerText)), dev + ' · go-over: "Time ' + mm(600) + '" with the S badge shown at once');
      const n0 = E.st.rpcLog.length;
      const ms = await page.evaluate(() => { const t0 = performance.now(); document.querySelector('#go-stu').click(); return /Loading/.test(document.querySelector('#go-strip').innerText) || !document.querySelector('#go-strip').innerText.trim() ? 99999 : performance.now() - t0; });
      check(ms < 100 && E.st.rpcLog.length === n0, dev + " · Student's answer in " + ms.toFixed(1) + ' ms, no server call');
      // 5. Details drawer
      await page.click('#go-det'); await page.waitForSelector('#go-dr-body .t-ps'); await sleep(300);
      check(new RegExp('Time\\s*' + mm(600) + '.*normal').test((await page.$eval('#go-dr-body .t-pst', e => e.innerText)).replace(/\n/g, ' ')), dev + ' · Details: "Time S 10:00 normal …"');
      await shot(page, 'go66_goover' + tag);
      await page.click('#btn-view-back'); await page.waitForSelector('#scr-result.on');
      await page.click('#res-home'); await page.waitForSelector('#scr-teacher.on');
      // 3 + 4. What to go over / Grid
      await page.$eval('[data-prof="FX-T01"]', e => e.click()).catch(() => {});
      await page.waitForSelector('#t-p-go'); await page.$eval('#t-p-go', e => e.click()); await page.waitForSelector('.t-row');
      const chips = await page.$$eval('.t-row .t-bt', a => a.map(e => e.textContent));
      check(chips.some(t => t === 'S ' + mm(600)) && chips.some(t => t === 'R ' + mm(3)), dev + ' · What to go over: "' + chips.join('", "') + '"');
      await shot(page, 'go66_list' + tag);
      await page.click('[data-tab="grid"]'); await page.waitForSelector('.t-grid .t-gmeta');
      const gm = await page.$$eval('.t-grid .t-gmeta', a => a.map(e => e.innerText.replace(/\s+/g, ' ') + '|' + e.title));
      check(gm.some(t => t.startsWith('S ' + mm(600)) && /normal/.test(t)) && gm.some(t => t.startsWith('R ' + mm(3))), dev + ' · Grid: "S 10:00" with the hover (' + gm.slice(0, 2).join(' ; ') + ')');
      const fit = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
      check(fit, dev + ' · no sideways page scroll');
      await shot(page, 'go66_grid' + tag);
      await page.context().close();
    }
    H.englishOnly(E);
  } catch (e) { console.error(e); check(false, 'exception: ' + e.message); }
  await E.close();
  process.exit(H.summary() ? 1 : 0);
})();
