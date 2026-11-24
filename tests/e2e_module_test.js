// #101 browser: the teacher assigns a real-test module (Full: Module 1 → adaptive Module 2) → the student takes Module 1 on
// the timed test screen (directions, 35:00, review page) → Module 2 starts by itself (harder route) → result: the range big,
// 4 domain bars + (#104) the normal report below (First Try, types, a grid per module, Go over) → the teacher sees raw per
// module, route, range, the time under every cell, the go-over, What to go over / Grid, the student's latest range.
// A second student: one module on a phone, the timer runs out → submitted by itself. No key in any payload.
process.env.LIB_DIR = require('./modlib').modLib();
const { setup, shot, englishOnly, login, waitMath, check, summary, sleep } = require('./h');
const T = 'TEACH-FX-9';

(async () => {
  const E = await setup();
  const G = () => E.st.gas, C = () => E.st.gas.ctx;
  try {
    const b = C().readTable_('Batches').rows.find(x => x.batch === 'FX6'); C().updateRow_('Batches', b._row, { live: 'Yes' }); C()._batchLive = null; G().fresh();
    const Q = {}; G().table('Questions').forEach(r => { Q[r.qid] = r; });
    const key = id => String(Q[id].key).replace(/^'/, '');

    console.log('teacher assigns');
    const { page: tp } = await E.newPage('desktop1280');
    await login(tp, E.url, T);
    await tp.waitForSelector('#t-students');
    check(await tp.$eval('#t-students', e => /Real-test score/i.test(e.innerText)), 'student list has a "Real-test score" column');
    await tp.click('#t-students [data-prof="FX-T01"]'); await tp.waitForSelector('#t-p-asg'); await tp.click('#t-p-asg');
    await tp.waitForSelector('#b-kind-mod'); await tp.click('#b-kind-mod');
    await tp.waitForSelector('#b-mod');
    check(await tp.$eval('#b-title', e => e.value) === 'Real-test module' && (await tp.$$eval('#b-mod option', a => a.map(o => o.value))).join(',') === 'FULL,M1,M2E,M2H', 'New assignment → Real-test module: Full / Module 1 / Module 2 easier / Module 2 harder');
    await shot(tp, 'mod101_assign');
    await tp.click('#b-modpub');
    for (let i = 0; i < 40 && !G().table('Assignments').some(a => a.kind === 'module'); i++) await sleep(250);
    const asg = G().table('Assignments').find(a => a.kind === 'module');
    check(asg && asg.form === 'FULL' && asg.target_id === 'FX-T01', 'published: kind module, Full, for the student');

    console.log('Module 1');
    const { page } = await E.newPage('desktop1280');
    await login(page, E.url, 'FX-T01');
    await page.waitForSelector('#assigned .hz-btn.big');
    check(await page.$eval('#assigned', e => /2\s*modules/.test(e.innerText) && /22\s*questions each/.test(e.innerText) && /35 min/.test(e.innerText)), 'home card: 2 modules · 22 questions each · 35 min each');
    await shot(page, 'mod101_home');
    await page.click('#assigned .hz-btn.big');
    await page.waitForSelector('#btn-begin'); await waitMath(page);
    check(await page.$eval('#v-directions', e => /Module 1/.test(e.innerText) && /35:00/.test(e.innerText) && /22/.test(e.innerText)), 'directions: Module 1 · 22 questions · 35:00');
    await page.click('#btn-begin');
    await page.waitForSelector('#qwrap .q.on'); await waitMath(page);
    const t0 = await page.$eval('#timer .digits', e => e.textContent);
    check(/^3[45]:\d\d$/.test(t0) && await page.$eval('#timer', e => getComputedStyle(e).visibility !== 'hidden'), 'the timer runs: ' + t0);
    await shot(page, 'mod101_m1_q1');
    async function answerAll(nRight) {
      const n = await page.$$eval('#qwrap .q', a => a.length);
      for (let i = 0; i < n; i++) {
        const box = await page.$('#qwrap .q.on'), qid = await box.getAttribute('data-qid'), spr = await box.$('.spr-in');
        if (spr) { await spr.fill(i < nRight ? key(qid) : '999'); await spr.press('Tab'); }
        else { const L = i < nRight ? key(qid) : ['A', 'B', 'C', 'D'].find(l => l !== key(qid)); await (await box.$('.ch-row[data-l="' + L + '"] .ch')).click(); }
        if (i === 3) await (await box.$('.q-mark, [data-mark], .mark-btn') || box).click().catch(() => {});
        await sleep(60);
        await page.click('#btn-next'); await sleep(90);
      }
      return n;
    }
    const n1 = await answerAll(16);
    await page.waitForSelector('#v-review.on');
    check(n1 === 22 && await page.$eval('#v-review', e => /22/.test(e.innerText)), 'review page before submit (22 questions)');
    await shot(page, 'mod101_m1_review');
    await page.click('#btn-next'); await page.waitForSelector('#modal-root.on');
    check(await page.$eval('#modal-root', e => /Submit Module 1\?/.test(e.innerText) && /Module 2 starts right after/.test(e.innerText)), 'confirm: "Submit Module 1?" · Module 2 starts right after');
    await page.click('#modal-root .btns button:last-child');

    console.log('Module 2 starts by itself');
    await page.waitForFunction(() => /Module 2/.test(document.querySelector('#tb-title').textContent) && document.querySelector('#qwrap .q.on'), null, { timeout: 30000 });
    await waitMath(page);
    check(!(await page.$('#v-directions.on')) && /^3[45]:\d\d$/.test(await page.$eval('#timer .digits', e => e.textContent)), 'Module 2: no directions to click, its own 35:00 runs');
    G().fresh();
    const m2 = C().readTable_('Modules').rows.filter(r => r.student_code === 'FX-T01');
    check(m2.length === 2 && m2[0].route === 'M2H' && m2[1].module === 'M2H', '16 / 22 in Module 1 → harder Module 2');
    await shot(page, 'mod101_m2_q1');
    await answerAll(12);
    await page.waitForSelector('#v-review.on'); await page.click('#btn-next'); await page.waitForSelector('#modal-root.on');
    check(await page.$eval('#modal-root', e => /Submit Module 2\?/.test(e.innerText) && /submitted/.test(e.innerText)), 'confirm: "Submit Module 2?"');
    await page.click('#modal-root .btns button:last-child');

    console.log('result');
    await page.waitForSelector('#mod-score', { timeout: 30000 });
    const range = await page.$eval('#mod-score .v', e => e.textContent);
    check(/^\d{3}–\d{3}$/.test(range) && +range.split('–')[1] - +range.split('–')[0] === 80, 'result: estimated score ' + range + ' (80 wide), big');
    check((await page.$$('#mod-doms .mod-dom')).length === 4 && await page.$eval('#mod-doms', e => /Algebra/.test(e.innerText) && /Geometry and Trigonometry/.test(e.innerText)), '4 domain bars');
    check(await page.$eval('#mod-route', e => e.textContent) === 'Module 2: harder' && !(await page.$('#mod-mods')), 'route shown to the student (Module 2: harder); no raw per module');
    // #104 below the score: the normal assignment report
    check(await page.$eval('#score-first .v', e => e.textContent.replace(/\s/g, '')) === '28/44' && !!(await page.$('#btn-fix')) && !!(await page.$('#result-body .res-types')),
      'below: First Try 28/44, Best Score, Fix wrong answers, Results by skill, Types of mistakes');
    const grids = await page.$$eval('#result-body .res-part', a => a.map(x => x.querySelector('h3').innerText.replace(/\s+/g, ' ') + ':' + x.querySelectorAll('.rgrid .rcell').length));
    check(grids.length === 2 && /^Module 1 16 \/ 22:22$/.test(grids[0]) && /^Module 2 12 \/ 22:22$/.test(grids[1]), 'question grids by module: ' + grids.join(' | '));
    await shot(page, 'mod104_result');
    await page.evaluate(() => document.querySelectorAll('#result-body .res-part')[1].scrollIntoView()); await sleep(200); await shot(page, 'mod104_result_grids');
    await page.click('#result-body .res-part:nth-of-type(2) .rcell, #result-body .res-part >> nth=1 >> .rcell').catch(async () => { const c = (await page.$$('#result-body .res-part'))[1]; await (await c.$('.rcell')).click(); });
    await page.waitForSelector('#v-question.on'); await waitMath(page);
    check(await page.$eval('#tb-title', e => /Module 2/.test(e.textContent)) && !!(await page.$('#view-bar')), 'a Module 2 cell opens that question read-only (Go over of the whole test)');
    await shot(page, 'mod104_goover');
    await page.click('#btn-view-back'); await page.waitForSelector('#mod-score');
    check(true, 'back to the result');

    console.log('teacher sees it');
    await tp.click('#t-brand'); await tp.waitForSelector('#t-students');
    await tp.click('#t-refresh').catch(() => {});
    await tp.evaluate(() => location.reload()); await tp.waitForSelector('#login-code').catch(() => {});
    await login(tp, E.url, T); await tp.waitForSelector('#t-students');
    const row = await tp.$eval('#t-students', e => e.innerText);
    check(row.includes(range), 'student list: latest range ' + range);
    await tp.click('#t-students [data-prof="FX-T01"]'); await tp.waitForSelector('#t-sets');
    check(await tp.$eval('#t-sets', e => /Module 1/.test(e.innerText) && /Module 2/.test(e.innerText)), 'profile: both module sets in Sets');
    await tp.click('#t-sets [data-res]');
    await tp.waitForSelector('#mod-mods');
    const mm = await tp.$eval('#mod-mods', e => e.innerText);
    check(/Module 1: 16\/22/.test(mm) && /harder\): 12\/22/.test(mm) && /route harder/.test(mm) && await tp.$eval('#mod-score .v', e => e.textContent) === range, 'teacher result: Module 1 16/22 · Module 2 (harder) 12/22 · route harder · the range');
    await shot(tp, 'mod101_teacher_result');
    const tms = await tp.$$eval('#result-body .rgrid .rcell .rtm', a => a.length), tgr = await tp.$$eval('#result-body .res-part', a => a.length);
    check(tms === 44 && tgr === 2 && !!(await tp.$('#res-pace')) && !!(await tp.$('#result-body .res-types')), 'teacher result below the score: pace line, types of mistakes, 2 module grids with the time under all 44 cells');
    await shot(tp, 'mod104_teacher_result');
    const c2 = (await tp.$$('#result-body .res-part'))[1]; await (await c2.$('.rcell')).click();
    await tp.waitForSelector('#scr-test.going', { timeout: 20000 });
    check(await tp.$eval('#tb-title', e => /Module 2/.test(e.textContent)), 'teacher: a Module 2 cell opens the go-over screen on that question');
    await shot(tp, 'mod104_teacher_goover');
    await tp.click('#btn-view-back').catch(() => {}); await tp.waitForSelector('#res-home', { state: 'visible' });
    await tp.click('#res-home'); await tp.waitForSelector('#t-p-go, #t-students [data-prof="FX-T01"]', { state: 'visible' });
    if (!(await tp.$('#t-p-go'))) { await tp.click('#t-students [data-prof="FX-T01"]'); await tp.waitForSelector('#t-p-go'); }
    await tp.click('#t-p-go');
    await tp.waitForSelector('#t-tabbody'); await sleep(400);
    check(await tp.$eval('#t-tabbody', e => (e.innerText.match(/[EMH]8\d{3}/g) || []).length >= 5), 'What to go over: the module answers are there like any set (question codes listed)');
    await shot(tp, 'mod104_teacher_goover_tab');
    await tp.click('[data-tab="grid"]'); await sleep(500);
    check(await tp.$eval('#t-tabbody', e => (e.innerText.match(/[EMH]8\d{3}/g) || []).length >= 20), 'Grid: the module answers with time and slow / rush flags');
    await shot(tp, 'mod104_teacher_grid');

    console.log('one module on a phone, time runs out');
    const st = C().readTable_('Settings').rows.find(x => x.key === 'mod_minutes'); C().updateRow_('Settings', st._row, { value: 0.15 }); G().fresh();
    G().call('publishAssignment', [T, { target: 'st:FX-T03', kind: 'module', form: 'M2E', title: 'Real-test module' }]); G().fresh();
    const { page: pp } = await E.newPage('phone');
    await login(pp, E.url, 'FX-T03');
    await pp.waitForSelector('#assigned .hz-btn.big');
    check(await pp.$eval('#assigned', e => /22\s*questions/.test(e.innerText) && /One module/.test(e.innerText)), 'phone home card: one module, 22 questions');
    await pp.click('#assigned .hz-btn.big'); await pp.waitForSelector('#btn-begin'); await pp.click('#btn-begin');
    await pp.waitForSelector('#qwrap .q.on'); await waitMath(pp);
    await shot(pp, 'mod101_phone_q1');
    const bx = await pp.$('#qwrap .q.on'), q1 = await bx.getAttribute('data-qid'), sp = await bx.$('.spr-in');
    if (sp) await sp.fill(key(q1)); else await (await bx.$('.ch-row[data-l="' + key(q1) + '"] .ch')).click();
    await pp.waitForSelector('#mod-score', { timeout: 30000 });
    const r2 = await pp.$eval('#mod-score', e => e.innerText);
    check(/\d{3}–\d{3}/.test(r2) && /One module only: a wider range/.test(r2), 'at 0:00 the module is submitted by itself → result with the wider-range line');
    G().fresh();
    const s3 = C().readTable_('Sets').rows.find(s => s.student_code === 'FX-T03' && s.kind === 'module');
    check(s3.status === 'submitted' && Number(s3.first_try) === 1, 'the answer given before the time ran out counts (1 right)');
    await shot(pp, 'mod101_phone_result');
    check(await pp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'phone: nothing wider than the screen');

    console.log('no key');
    const pays = E.st.rpcLog.filter(r => /getSet|startAssignment|submit|getResult|getReview|homeData|getFigures|autosave/.test(r.fn)).map(r => r.res);
    check(pays.length > 6 && pays.every(t => !/"key"|"accepted"|"tags"|rationale|"code"\s*:\s*"[EMH]\d|"levels"|"subs"/.test(t)), 'student payloads (' + pays.length + '): no key, accepted, tags, short code, levels or substitution log');
    englishOnly(E);
  } catch (e) { console.error(e); check(false, 'exception: ' + e.message); }
  await E.close();
  process.exit(summary() ? 1 : 0);
})();
