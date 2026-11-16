// #47 (Minh 16 Nov, student CHRIS): the Reference panel was empty ('sat_math' vs 'sat'); "picked 5, got 10" (an unfinished
// 10-set of the skill opened silently). Now: the SAT Math reference sheet in every set kind + the review / Fix viewer;
// default 5; an unfinished set shows "Continue N-question set" + "Start a new set instead" (asks, then closes the old one).
const fs = require('fs'), path = require('path');
const { makeGas } = require('./server');
const H = require('./h'); const { check, sleep, shot, waitMath } = H;
const forms = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'placement_forms_fx4.json'), 'utf8'));
const addForms = (G) => { G.ctx.appendObjects_('Placement_Forms', forms.map(r => ({ form: r[0], domain: r[1], slot: r[2], level: r[3], skill: r[4], code: r[5], qid: '' }))); G.fresh(); };

console.log('[server]');
{
  const G = makeGas(), C = G.ctx;
  const a = G.call('startPractice', ['FX-T01', 'H.B', 10]);
  const s1 = G.call('getSet', ['FX-T01', a.set_id, {}]);
  check(s1.profile.reference_sheet === 'sat_math' && s1.profile.parts[0].reference === true, 'a set: reference_sheet sat_math, Reference on');
  const b = G.call('startPractice', ['FX-T01', 'H.B', 5]);
  check(b.resumed && b.set_id === a.set_id && b.n === a.n, 'pick 5 with an unfinished ' + a.n + '-set (no "replace"): the server says resumed + n ' + b.n + ' (the page asks; never silent)');
  const c = G.call('startPractice', ['FX-T01', 'H.B', 5, { replace: a.set_id }]);
  const rows = G.table('Sets');
  check(!c.resumed && c.n === 5 && rows.find(r => r.set_id === a.set_id).status === 'abandoned' && rows.find(r => r.set_id === c.set_id).status === 'in_progress', '"Start a new set instead" → old set abandoned, new 5-question set');
  const hd = G.call('homeData', ['FX-T01']);
  check(!hd.open.some(o => o.set_id === a.set_id) && !hd.history.some(o => o.set_id === a.set_id) && hd.open.some(o => o.set_id === c.set_id && o.skill === 'H.B' && o.n === 5), 'home: the abandoned set is neither open nor in the history; the open set carries skill + n');
  const d = G.call('startPractice', ['FX-T01', 'H.B', 10, { replace: 'S-NOT-THIS' }]);
  check(d.resumed && d.set_id === c.set_id && G.table('Sets').find(r => r.set_id === c.set_id).status === 'in_progress', '"replace" naming another set: nothing closed');
  const m1 = G.call('startMixed', ['FX-T01', 10]), m2 = G.call('startMixed', ['FX-T01', 5]);
  check(m2.resumed && m2.n === m1.n, 'Mixed: same (resumed + n ' + m2.n + ')');
  const m3 = G.call('startMixed', ['FX-T01', 5, { replace: m1.set_id }]);
  check(!m3.resumed && G.table('Sets').find(r => r.set_id === m1.set_id).status === 'abandoned', 'Mixed "Start a new set instead" → old one abandoned');
  // the viewer data
  const s2 = G.call('getSet', ['FX-T01', c.set_id, {}]);
  G.call('submit', ['FX-T01', c.set_id, { state: { parts: { P1: { ans: {}, cur: 0 } } }, events: [], ev_from: 0, copy: s2.copy }]);
  check(G.call('getReview', ['FX-T01', c.set_id]).reference_sheet === 'sat_math' && G.call('getFix', ['FX-T01', c.set_id]).reference_sheet === 'sat_math', 'review / Fix viewer: reference_sheet sat_math');
}

(async () => {
  const E = await H.setup();
  const G = () => E.st.gas;
  try {
    const { page } = await E.newPage('desktop1280');
    const refOk = async (where) => {
      await page.waitForSelector('#tool-ref:not(.hidden)', { timeout: 10000 });
      await page.click('#tool-ref'); await page.waitForSelector('#ref-panel.on');
      await page.waitForFunction(() => document.querySelectorAll('#ref-body .ref-grid mjx-container').length >= 5, null, { timeout: 15000 }).catch(() => {});
      const n = await page.$$eval('#ref-body .ref-grid mjx-container', a => a.length), txt = await page.$eval('#ref-body', e => e.innerText);
      check(n >= 5 && !/No reference sheet/.test(txt), where + ': Reference shows the SAT Math sheet (' + n + ' formulas)');
      return n;
    };
    const refClose = async () => { await page.click('#ref-x'); await sleep(100); };
    const begin = async () => { await page.waitForSelector('#v-directions.on #btn-begin, #v-question.on #qwrap .q.on'); if (await page.$('#v-directions.on #btn-begin')) await page.click('#v-directions.on #btn-begin'); await page.waitForSelector('#qwrap .q.on'); await waitMath(page); };

    console.log('[picker: default 5, unfinished set]');
    await H.login(page, E.url, 'FX-T01'); await page.waitForSelector('#picker .sm-it');
    await page.click('#picker [data-k="H.B"]');
    check(/^Start 5 questions$/.test(await page.$eval('#btn-start', e => e.textContent)) && await page.$eval('#picker [data-n="5"]', e => e.classList.contains('on')), 'fresh skill: 5 picked by default, "Start 5 questions"');
    await page.click('#btn-start'); await begin();
    check(/of 5/.test(await page.$eval('#nav-label', e => e.textContent)), 'Start 5 questions → a 5-question set');
    await refOk('practice'); await shot(page, 'fix47_ref_practice'); await refClose();
    // answer 2, leave
    for (let i = 0; i < 2; i++) { await (await page.$('#qwrap .q.on .ch, #qwrap .q.on .spr-in')).click().catch(() => {}); const sp = await page.$('#qwrap .q.on .spr-in'); if (sp) await sp.fill('7'); await page.click('#btn-next'); await sleep(150); }
    await page.click('#btn-exit'); await page.waitForSelector('#modal-root.on'); await page.click('#modal-root .btns button:last-child');
    await page.waitForSelector('#picker .sm-it'); await page.waitForSelector('#wq-dot.ok', { timeout: 15000 }); await sleep(800);
    await page.click('#picker [data-k="H.B"]');
    await page.waitForSelector('#btn-cont');
    const cont = await page.$eval('#btn-cont', e => e.textContent), done = await page.$eval('.sm-contn', e => e.textContent);
    check(cont === 'Continue 5-question set' && /2\/5 done/.test(done) && !(await page.$('#picker [data-n]')) && await page.$('#btn-newset'), 'unfinished set: "' + cont + '" · ' + done + ' · "Start a new set instead" (no size buttons)');
    check(/unfinished/i.test(await page.$eval('#picker [data-k="H.B"]', e => e.innerText)), 'skill list: "unfinished" mark');
    await shot(page, 'fix47_picker_continue');
    await page.click('#btn-newset'); await page.waitForSelector('#modal-root.on');
    const ask = await page.$eval('#modal-root', e => e.innerText);
    check(/Your unfinished set \(5 questions, 2 answered\) will be closed\. Start a new set\?/.test(ask), 'asks: "Your unfinished set (5 questions, 2 answered) will be closed. Start a new set?"');
    await shot(page, 'fix47_newset_ask');
    await page.click('#modal-root .btns button:last-child');
    await page.waitForSelector('#picker [data-n="5"].on');
    await page.click('#picker [data-n="5"]'); const oldId = (await G().table('Sets').filter(s => s.student_code === 'FX-T01' && s.status === 'in_progress').pop()).set_id;
    await page.click('#btn-start'); await begin();
    E.st.gas.fresh();
    check(/of 5/.test(await page.$eval('#nav-label', e => e.textContent)) && E.st.gas.table('Sets').find(s => s.set_id === oldId).status === 'abandoned', 'new 5-question set; the old one abandoned');
    await page.click('#btn-exit'); await page.waitForSelector('#modal-root.on'); await page.click('#modal-root .btns button:last-child');
    await page.waitForSelector('#picker .sm-it'); await page.waitForSelector('#wq-dot.ok', { timeout: 15000 }); await sleep(500);
    // stale page: the server has an unfinished 10-set the page does not know → asks, never opens it silently
    const curOpen = E.st.gas.table('Sets').filter(s => s.student_code === 'FX-T01' && s.status === 'in_progress' && s.skill === 'H.B').pop();
    E.st.gas.sheets.Sets.rows.forEach(r => { if (r[0] === curOpen.set_id) { const i = E.st.gas.sheets.Sets.rows[0].indexOf('n'); r[i] = 10; } });
    E.st.gas.fresh(); E.st.gas.ctx.CacheService.getScriptCache().put('smlv__epoch', 'e' + Date.now(), 600);
    await page.evaluate(() => { const o = (window.SML && window.SML.home && window.SML.home.open) || []; o.length = 0; });
    await page.click('#picker [data-d="1"]'); await page.click('#picker [data-d="0"]'); await page.click('#picker [data-k="H.B"]');
    if (await page.$('#btn-start')) {
      await page.click('#btn-start'); await page.waitForSelector('#modal-root.on');
      const m = await page.$eval('#modal-root', e => e.innerText);
      check(/unfinished set/i.test(m) && /Continue 10-question set/.test(m) && /start 5 new/i.test(m), 'old page + an unfinished 10-set on the server → asks "Continue 10-question set" / "Close it, start 5 new"');
      await page.click('#modal-root .btns button:last-child'); await begin();
      check(/of 5/.test(await page.$eval('#nav-label', e => e.textContent)), '"Close it, start 5 new" → 5 questions');
      await page.click('#btn-exit'); await page.waitForSelector('#modal-root.on'); await page.click('#modal-root .btns button:last-child'); await page.waitForSelector('#picker .sm-it');
    } else check(true, '(page already knew the unfinished set)');

    console.log('[Mixed]');
    await page.waitForSelector('#wq-dot.ok', { timeout: 15000 }); await sleep(400);
    check(/^Start 5$/.test(await page.$eval('#btn-mixed', e => e.textContent)), 'Mixed: 5 by default ("Start 5")');
    await page.click('#btn-mixed'); await begin();
    await refOk('Mixed'); await refClose();
    await page.click('#btn-exit'); await page.waitForSelector('#modal-root.on'); await page.click('#modal-root .btns button:last-child');
    await page.waitForSelector('#mixed-card'); await page.waitForSelector('#wq-dot.ok', { timeout: 15000 }); await sleep(800);
    await page.waitForFunction(() => /Continue \d+-question set/.test(document.querySelector('#btn-mixed').textContent));
    check(!!(await page.$('#btn-newmix')), 'Mixed unfinished: "Continue N-question set" + "Start a new set instead"');
    await shot(page, 'fix47_mixed_continue');
    await page.click('#btn-newmix'); await page.waitForSelector('#modal-root.on'); await page.click('#modal-root .btns button:last-child');
    await page.waitForSelector('#mixed-card [data-mn="5"].on');
    await page.click('#btn-mixed'); await begin();
    E.st.gas.fresh();
    check(E.st.gas.table('Sets').filter(s => s.student_code === 'FX-T01' && s.kind === 'mixed' && s.status === 'abandoned').length === 1, 'Mixed: new set, the old one abandoned');

    console.log('[Reference in every kind]');
    // finish this mixed set with wrong answers → Review items + a result → review viewer + Fix viewer
    for (let i = 0; i < 25 && !(await page.$('#v-review.on')); i++) {
      const sp = await page.$('#qwrap .q.on .spr-in'); if (sp) await sp.fill('999'); else { const ch = await page.$$('#qwrap .q.on .ch'); if (ch.length) await ch[0].click(); }
      await page.click('#btn-next'); await sleep(120);
    }
    await page.click('#btn-next'); await page.waitForSelector('#modal-root.on'); await page.click('#modal-root .btns button:last-child');
    await page.waitForSelector('#score-first');
    const cells = await page.$$('#result-body .rgrid .rcell'); await cells[0].click(); await page.waitForSelector('#view-bar span'); await waitMath(page);
    await refOk('review viewer'); await shot(page, 'fix47_ref_viewer'); await refClose();
    await page.click('#btn-view-back'); await page.waitForSelector('#score-first');
    if (await page.$('#btn-fix')) { await page.click('#btn-fix'); await page.waitForSelector('#btn-check'); await refOk('Fix'); await refClose(); await page.click('#btn-view-back'); await page.waitForSelector('#score-first'); }
    await page.click('#res-home'); await page.waitForSelector('#review-card');
    await page.waitForSelector('#wq-dot.ok', { timeout: 15000 }).catch(() => {}); await sleep(500);
    if (await page.$('#btn-review')) { await page.click('#btn-review'); await begin(); await refOk('Review set'); await refClose();
      await page.click('#btn-exit'); await page.waitForSelector('#modal-root.on'); await page.click('#modal-root .btns button:last-child'); await page.waitForSelector('#picker .sm-it'); }
    else check(false, 'Review set: no Review card button');
    // assignment
    const pool = G().ctx.livePool_().slice(0, 2).map(r => String(r.qid));
    G().ctx.publishAssignment('TEACH-FX-9', { target: 'st:FX-T01', qids: pool, title: 'HW (test)' }); G().fresh();
    addForms(G()); G().ctx.publishAssignment('TEACH-FX-9', { kind: 'placement', target: 'st:FX-T03', title: 'Placement test', form: 'auto' }); G().fresh();
    await page.evaluate(() => { try { localStorage.removeItem('tz_active'); } catch (e) {} }); await page.reload();
    await page.waitForSelector('#assigned .hz-btn.big'); await page.click('#assigned .hz-btn.big'); await begin();
    await refOk('assignment');
    const { page: pp } = await E.newPage('phone');
    await H.login(pp, E.url, 'FX-T03'); await pp.waitForSelector('#placement-card .hz-btn.big'); await pp.click('#placement-card .hz-btn.big');
    await pp.waitForSelector('#v-directions.on #btn-begin'); await pp.click('#v-directions.on #btn-begin'); await pp.waitForSelector('#qwrap .q.on'); await waitMath(pp);
    await pp.waitForSelector('#tool-ref:not(.hidden)'); await pp.click('#tool-ref'); await pp.waitForSelector('#ref-panel.on');
    await pp.waitForFunction(() => document.querySelectorAll('#ref-body .ref-grid mjx-container').length >= 5, null, { timeout: 15000 }).catch(() => {});
    const np = await pp.$$eval('#ref-body .ref-grid mjx-container', a => a.length);
    check(np >= 5, 'placement test (phone): Reference shows the SAT Math sheet (' + np + ' formulas)');
    await shot(pp, 'fix47_ref_placement_phone');
  } catch (e) { console.error(e); check(false, 'exception: ' + e.message); }
  await E.close();
  process.exit(H.summary() ? 1 : 0);
})();
