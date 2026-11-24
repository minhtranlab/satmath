// #97 (Minh 21/11) teacher page: a Refresh button on the class view and the student view brings the newest data with one
// click (a student submits while the view is open), keeps the open tab and scroll, shows "Updated hh:mm"; the logo = Home
// (teacher: the class list; student: their home); no "Classes" link in the teacher top bar.
const H = require('./h'); const { setup, login, check, summary, sleep, shot } = H;
const T = 'TEACH-FX-9';
const ev = (t, qid, type, value) => ({ part: 'P', t_ms: t * 1000, qid, type, value: value === undefined ? null : value });
function doSet(g, code, n) {                                         // a finished practice set, all answers wrong
  const Q = {}; g.table('Questions').forEach(r => { Q[r.qid] = r; });
  const key = id => String(Q[id].key).replace(/^'/, ''), wrong = id => Q[id].type === 'spr' ? '999' : ['A', 'B', 'C', 'D'].find(l => l !== key(id));
  g.fresh(); const sp = g.call('startPractice', [code, 'H.B', n]); g.fresh();
  const t = g.call('getSet', [code, sp.set_id, {}]), ans = {}, events = [ev(0, null, 'part_start', 'P')]; let s = 0;
  t.questions.forEach((q, i) => { events.push(ev(s, q.qid, 'q_enter', i + 1)); s += 40; ans[q.qid] = wrong(q.qid); events.push(ev(s - 5, q.qid, 'select', ans[q.qid])); events.push(ev(s, q.qid, 'q_leave')); });
  g.fresh(); g.call('submit', [code, sp.set_id, { state: { v: 1, current_part: 'P', phase: 'review', part_starts: { P: Date.now() - 600000 }, ended: {}, parts: { P: { cur: 0, ans, elim: {}, mark: {}, ask: {}, hl: {} } } }, events, ev_from: 0, copy: t.copy }]);
  g.fresh();
  return sp.set_id;
}

(async () => {
  const E = await setup();
  const G = () => E.st.gas;
  try {
    const { page } = await E.newPage('desktop1280');
    await login(page, E.url, T);
    await page.waitForSelector('#t-students');
    const nav = await page.$$eval('.t-nav button', a => a.map(b => b.textContent.trim()));
    check(!nav.some(t => /^Classes$/.test(t)) && nav.some(t => /^Asked/.test(t)) && !!(await page.$('#t-brand')), 'top bar: no "Classes" link; Asked / Assignment stay; the logo is there (' + nav.join(' · ') + ')');

    // student view
    await page.click('#t-students [data-prof="FX-T01"]');
    await page.waitForSelector('#t-p-go');
    const upd0 = await page.$eval('#t-upd', e => e.textContent.trim());
    check(!!(await page.$('.t-actions #t-refresh')) && /^Updated \d\d:\d\d$/.test(upd0), 'student view: Refresh next to Rename / Turn off / What to go over, "' + upd0 + '"');
    const sets0 = await page.$$eval('#t-sets tr', a => a.length).catch(() => 0);
    doSet(G(), 'FX-T01', 5);                                         // the student submits while the teacher looks
    await sleep(400);
    check((await page.$$eval('#t-sets tr', a => a.length).catch(() => 0)) === sets0, 'nothing changes by itself');
    const seen = [], orig = G().ctx.studentProfile;
    G().ctx.studentProfile = function () { seen.push([].slice.call(arguments)); return orig.apply(this, arguments); };
    await page.click('#t-refresh');
    await page.waitForFunction(n => document.querySelectorAll('#t-sets tr').length > n, sets0, { timeout: 15000 });
    G().ctx.studentProfile = orig;
    check(seen.length === 1 && seen[0][2] === true, 'one click: the new set is on the student view (one call, read fresh from the Sheet)');
    check(await page.$eval('#t-refresh', b => !b.disabled && b.textContent.trim() === 'Refresh') && /^Updated \d\d:\d\d$/.test(await page.$eval('#t-upd', e => e.textContent.trim())), 'the button is ready again, time shown');

    // class view (What to go over / Grid): the tab stays
    await page.click('#t-p-go');
    await page.waitForSelector('#t-tabbody');
    await page.click('[data-tab="grid"]'); await sleep(300);
    check(!!(await page.$('.t-actions #t-refresh')), 'class view: Refresh in the top actions');
    const sc0 = await page.$$eval('#t-scope option', a => a.length);
    await page.evaluate(() => window.scrollTo(0, 120)); const y0 = await page.evaluate(() => window.scrollY);
    doSet(G(), 'FX-T01', 5);
    await page.click('#t-refresh');
    await page.waitForFunction(n => document.querySelectorAll('#t-scope option').length > n, sc0, { timeout: 15000 });
    check(await page.$eval('[data-tab="grid"]', b => b.classList.contains('on')), 'after Refresh: the new set is there and the Grid tab is still open');
    check(Math.abs((await page.evaluate(() => window.scrollY)) - y0) < 40, 'scroll kept');
    await shot(page, 'refresh97_class');

    // logo = home
    await page.click('#t-brand');
    await page.waitForSelector('#t-students');
    check(true, 'teacher: logo → the class list');
    const { page: sp } = await E.newPage('phone');
    await login(sp, E.url, 'FX-T01');
    await sp.waitForSelector('#scr-home.on');
    await sp.click('#scr-home .sm-nav [data-top="skills"]'); await sp.waitForSelector('#scr-skills.on');
    await sp.click('#scr-skills .hz-wm'); await sp.waitForSelector('#scr-home.on');
    check(true, 'student: logo on My skills → home');
    await sp.click('#scr-home .sm-nav [data-top="hist"]'); await sp.waitForSelector('#scr-hist.on');
    await sp.focus('#scr-hist .hz-wm'); await sp.keyboard.press('Enter'); await sp.waitForSelector('#scr-home.on');
    check(true, 'student: logo by keyboard (History → home)');
  } catch (e) { console.error(e); check(false, 'exception: ' + e.message); }
  await E.close();
  process.exit(summary() ? 1 : 0);
})();
