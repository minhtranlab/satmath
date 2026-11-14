// #42 speed round. 1) Server: tab snapshots (CacheService) are used only while nothing changed — writes, hand edits (onEdit)
// and a read that raced a write all fall back to the Sheet; dates survive; archiving a class closes its open assignments.
// 2) Browser with a slow server (800 ms per call): navigation between screens already seen and every toggle show on screen in
// < 300 ms; the write queue saves in order, retries a network failure once, puts the screen back + says so when the server
// refuses, loses nothing while moving around, and warns before closing the tab while saving.
const { makeGas } = require('./server');
const H = require('./h'); const { check, sleep } = H;

console.log('[server: tab snapshots]');
{
  const G = makeGas(), C = G.ctx;
  let sheetReads = 0; const orig = C.readTableSheet_; C.readTableSheet_ = function (n) { sheetReads++; return orig(n); };
  const run = (fn, args) => { C._tables = {}; C._readMode = 'fresh'; return C[fn](...args); };   // one call = one execution, cache kept
  run('teacherHome', ['TEACH-FX-9']);
  const r1 = sheetReads; run('teacherHome', ['TEACH-FX-9']); const r2 = sheetReads - r1;
  check(r1 > 0 && r2 === 0, 'teacher home: 1st call reads ' + r1 + ' tabs from the Sheet, the 2nd call 0 (all from snapshots)');
  run('classView', ['TEACH-FX-9', 'all', '']); const r3 = sheetReads; run('classView', ['TEACH-FX-9', 'all', '']);
  check(sheetReads === r3, 'class screen: 2nd call 0 Sheet reads');
  // a write through updateRow_ → the next read sees it
  const st = C.readTable_('Students').rows.find(r => r.student_code === 'FX-T03');
  C.updateRow_('Students', st._row, { name: 'Renamed (test)' });
  const h = run('teacherHome', ['TEACH-FX-9']);
  check(h.students.some(s => s.name === 'Renamed (test)'), 'after a write the next read shows it (snapshot version changed)');
  // a hand edit in the Sheet (bypasses our helpers) → onEdit → fresh read
  G.sheets.Students.rows.forEach(r => { if (r[0] === 'FX-T03') r[1] = 'Hand edit (test)'; });
  const h1 = run('teacherHome', ['TEACH-FX-9']);
  C.onEdit({ range: { getSheet: () => ({ getName: () => 'Students' }) } });
  const h2 = run('teacherHome', ['TEACH-FX-9']);
  check(!h1.students.some(s => s.name === 'Hand edit (test)') && h2.students.some(s => s.name === 'Hand edit (test)'), 'hand edit: stale only until onEdit marks the tab → then read from the Sheet');
  // a read that started before a write must not leave an old snapshot behind
  const verBefore = C.CacheService.getScriptCache().get('smlv_Students');
  const oldT = C.readTableSheet_('Students');
  C.updateRow_('Students', st._row, { name: 'After race (test)' });
  C.tabToCache_('Students', oldT, verBefore);                       // the slow reader stores what it read, under the OLD version
  const h3 = run('teacherHome', ['TEACH-FX-9']);
  check(h3.students.some(s => s.name === 'After race (test)'), 'a read that raced a write: its snapshot is ignored (old version)');
  // ?flush=1 (edits made with other tools fire no onEdit) → every snapshot dropped
  G.sheets.Students.rows.forEach(r => { if (r[0] === 'FX-T03') r[1] = 'API edit (test)'; });
  const f1 = run('teacherHome', ['TEACH-FX-9']);
  const fl = C.doGet({ parameter: { flush: '1' } }).getContent();
  const f2 = run('teacherHome', ['TEACH-FX-9']);
  check(!f1.students.some(s => s.name === 'API edit (test)') && f2.students.some(s => s.name === 'API edit (test)') && /flushed/.test(fl), 'edit by another tool: shows after ?flush=1 (' + fl + ')');
  // dates survive the snapshot; row numbers + column index kept
  const cc = C.CacheService.getScriptCache(); const ver = C.tabToken_('Fake', {}, cc, true);
  const fake = { headers: ['a', 'b'], rows: [{ _row: 2, a: new Date(Date.UTC(2026, 10, 14, 7, 30)), b: 'x' }] };
  C.tabToCache_('Fake', fake, ver);
  const back = C.tabFromCache_('Fake');
  check(back && Object.prototype.toString.call(back.rows[0].a) === '[object Date]' && back.rows[0].a.getTime() === fake.rows[0].a.getTime(), 'dates come back as dates from a snapshot');
  check(back && back.rows[0]._row === 2 && back.idx.b === 1, 'row numbers and column index kept');
  // archive a class: its open assignments close; students and history stay
  const cls = C.saveClass('TEACH-FX-9', { name: 'Arch (test)', student_codes: ['FX-T01', 'FX-T03'] });
  const pub = C.publishAssignment('TEACH-FX-9', { target: cls.class_id, qids: C.livePool_().slice(0, 2).map(r => String(r.qid)), title: 'HW (test)' });
  const ar = C.saveClass('TEACH-FX-9', { class_id: cls.class_id, name: 'Arch (test)', student_codes: ['FX-T01', 'FX-T03'], active: false });
  const home = run('teacherHome', ['TEACH-FX-9']), c2 = home.classes.find(c => c.class_id === cls.class_id);
  C._tables = {}; const asg = C.readTable_('Assignments').rows.find(a => a.assignment_id === pub.assignment_id);
  check(ar.closed === 1 && c2 && !c2.active && asg.status === 'closed' && c2.members.length === 2, 'Archive class: active = No, its open assignment closed, members kept');
  const rest = C.saveClass('TEACH-FX-9', { class_id: cls.class_id, name: 'Arch (test)', student_codes: ['FX-T01', 'FX-T03'], active: true });
  check(rest.ok && run('teacherHome', ['TEACH-FX-9']).classes.find(c => c.class_id === cls.class_id).active, 'Restore: active again');
}

(async () => {
  const E = await H.setup();
  try {
    console.log('[browser: slow server, 800 ms per call]');
    E.st.latency = 800;
    const { page } = await E.newPage('desktop1280');
    const unload = []; page.on('dialog', d => { unload.push(d.type()); d.dismiss(); });
    await H.login(page, E.url, 'TEACH-FX-9');
    await page.waitForSelector('#t-students');
    // a class to move around in
    await page.click('#t-new-cl'); await page.fill('.t-modal [name=name]', 'Speed (test)');
    await page.check('.t-modal input[value="FX-T01"]'); await page.check('.t-modal input[value="FX-T03"]');
    let t0 = Date.now(); await page.click('.t-modal .btns button:last-child');
    await page.waitForSelector('.t-card.t-fresh'); const tNew = Date.now() - t0;
    check(tNew < 300, 'New class: its card shows at once (' + tNew + ' ms), "Saving…"');
    await page.waitForSelector('#wq-dot.ok', { timeout: 15000 });
    await page.waitForFunction(() => document.querySelector('.t-card[data-class="C-001"]'), null, { timeout: 15000 });
    await page.click('.t-card[data-class="C-001"]'); await page.waitForSelector('.t-tabs');
    await page.waitForSelector('[data-prof="FX-T03"]'); await sleep(2500);       // class screen + profiles fetched ahead
    // Minh's example: open Student → Turn off → back to Classes
    t0 = Date.now(); await page.click('.t-chip[data-prof="FX-T03"]'); await page.waitForSelector('#t-p-act'); const tProf = Date.now() - t0;
    check(tProf < 300, 'open a student (fetched ahead): ' + tProf + ' ms');
    t0 = Date.now(); await page.click('#t-p-act'); await page.waitForFunction(() => /Turn on/.test(document.querySelector('#t-p-act').textContent)); const tOff = Date.now() - t0;
    check(tOff < 300, 'Turn off: on screen in ' + tOff + ' ms (saved in the background)');
    check(/Saving/.test(await page.$eval('#wq-dot', e => e.textContent)), '"Saving…" shows while the server works');
    t0 = Date.now(); await page.click('#t-back'); await page.waitForSelector('#t-students'); const tBack = Date.now() - t0;
    check(tBack < 300, 'back to Classes: ' + tBack + ' ms (cached, refreshed quietly)');
    await page.waitForSelector('#wq-dot.ok', { timeout: 15000 });
    E.st.gas.fresh();
    check(E.st.gas.ctx.readTable_('Students').rows.find(r => r.student_code === 'FX-T03').active === 'No', 'the server has it: FX-T03 active = No');
    await page.waitForFunction(() => !document.querySelector('[data-prof="FX-T03"]'), null, { timeout: 15000 });
    check(true, 'inactive students hidden in the list by default');
    await page.check('#t-show-off'); await page.waitForSelector('tr.off [data-prof="FX-T03"]');
    check(true, '"Show inactive" shows them (greyed)');
    await H.shot(page, 'speed_home_inactive');

    console.log('[write queue]');
    await page.click('tr.off [data-prof="FX-T03"]'); await page.waitForSelector('#t-p-act');
    // order: rename then turn on, sent one after the other
    E.st.rpcLog = [];
    await page.click('#t-p-ren'); await page.fill('.t-modal [name=name]', 'Queue (test)'); await page.click('.t-modal .btns button:last-child');
    await page.click('#t-p-act');
    await page.waitForSelector('#wq-dot.ok', { timeout: 20000 });
    const order = E.st.rpcLog.filter(r => r.fn === 'editStudent').map(r => JSON.parse(r.res).result ? 'ok' : 'err');
    E.st.gas.fresh(); const row = E.st.gas.ctx.readTable_('Students').rows.find(r => r.student_code === 'FX-T03');
    check(order.length === 2 && row.name === 'Queue (test)' && row.active === 'Yes', 'two changes saved in order (rename, then turn on)');
    // retry once after a network failure
    let fails = 1;
    await page.route('**/rpc', async (route) => {
      const b = JSON.parse(route.request().postData() || '{}');
      if (b.fn === 'editStudent' && fails > 0) { fails--; await route.abort('failed'); return; }
      await route.continue();
    });
    await page.click('#t-p-act'); await page.waitForSelector('#wq-dot.ok', { timeout: 20000 });
    E.st.gas.fresh();
    check(fails === 0 && E.st.gas.ctx.readTable_('Students').rows.find(r => r.student_code === 'FX-T03').active === 'No', 'a network failure → retried once → saved');
    // the server refuses → screen put back + clear message
    await page.unroute('**/rpc');
    await page.route('**/rpc', async (route) => {
      const b = JSON.parse(route.request().postData() || '{}');
      if (b.fn === 'editStudent') { await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ error: 'FORM: Student not found.' }) }); return; }
      await route.continue();
    });
    const label0 = await page.$eval('#t-p-act', e => e.textContent);
    await page.click('#t-p-act');
    await page.waitForSelector('#modal-root.on');
    const msg = await page.$eval('#modal-root', e => e.innerText);
    check(/Not saved/.test(msg) && /Student not found/.test(msg) && await page.$eval('#t-p-act', e => e.textContent) === label0, 'refused → the button is back as before + "Not saved: … Student not found"');
    await H.shot(page, 'speed_rollback');
    await page.click('#modal-root .btns button'); await page.unroute('**/rpc');
    // nothing lost while moving around; closing the tab while saving asks first
    E.st.latency = 2500;
    await page.click('#t-p-act'); await page.click('#t-back'); await page.waitForSelector('#t-students');
    await page.click('.t-nav [data-go="asks"]'); await sleep(200);
    await page.close({ runBeforeUnload: true }).catch(() => {}); await sleep(300);
    check(unload.includes('beforeunload'), 'closing the tab with a change still saving → the browser asks first');
    await sleep(3500);
    E.st.gas.fresh();
    check(E.st.gas.ctx.readTable_('Students').rows.find(r => r.student_code === 'FX-T03').active === 'Yes', 'the change made before moving around is saved');
    E.st.latency = 0;

    console.log('[archive / restore a class]');
    const { page: p2 } = await E.newPage('desktop1280');
    await H.login(p2, E.url, 'TEACH-FX-9'); await p2.waitForSelector('.t-card[data-class="C-001"]');
    await p2.click('.t-card[data-class="C-001"]'); await p2.waitForSelector('#t-arch-cl');
    await p2.click('#t-arch-cl'); await p2.waitForSelector('#modal-root.on');
    check(/stay in the Sheet/.test(await p2.$eval('#modal-root', e => e.innerText)), 'Archive asks first (in the page): students, sets and history stay');
    await p2.click('#modal-root .btns button:last-child');
    await p2.waitForSelector('#t-students'); await p2.waitForSelector('#wq-dot.ok', { timeout: 15000 });
    check(!(await p2.$('.t-card[data-class="C-001"]')), 'archived class gone from Classes');
    await p2.check('#t-show-arch'); await p2.waitForSelector('.t-card.arch[data-class="C-001"]');
    await H.shot(p2, 'speed_archived');
    await p2.click('.t-card.arch[data-class="C-001"]'); await p2.waitForSelector('#t-restore-cl');
    await p2.click('#t-restore-cl'); await p2.waitForSelector('#wq-dot.ok', { timeout: 15000 });
    E.st.gas.fresh();
    check(String(E.st.gas.ctx.readTable_('Classes').rows.find(c => c.class_id === 'C-001').active) === 'Yes', 'Restore → active again');

    console.log('[student: home from cache]');
    E.st.latency = 800;
    const { page: sp } = await E.newPage('desktop1280');
    const n0 = E.st.rpcLog.length;
    await H.login(sp, E.url, 'FX-T01'); await sp.waitForSelector('#picker .sm-it');
    const fns = E.st.rpcLog.slice(n0).map(r => r.fn);
    check(fns[0] === 'login' && fns.indexOf('homeData') < 0, 'sign-in brings the home page along (one call: ' + fns.join(', ') + ')');
    await sp.reload();
    t0 = Date.now(); await sp.waitForSelector('#picker .sm-it'); const tRe = Date.now() - t0;
    check(tRe < 1500, 'reopen the link: home from this device in ' + tRe + ' ms (server: 800 ms per call)');
    E.st.latency = 0;
  } catch (e) { console.error(e); check(false, 'exception: ' + e.message); }
  await E.close();
  process.exit(H.summary() ? 1 : 0);
})();
