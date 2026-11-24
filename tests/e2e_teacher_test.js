// Browser suite, teacher page (made-up fixtures only): sign in with the teacher code → classes → new student (code shown
// once) → new class → assignment builder (Linear functions × 3 Medium) → students do it → What to go over (order, codes,
// copy) → question panel (correct answer, tries, mistake type → Review) → Asked inbox → profile. Students never get a key.
const { setup, shot, englishOnly, login, waitMath, check, summary, sleep } = require('./h');

(async () => {
  const E = await setup();
  const G = () => E.st.gas;
  try {
    const live = G().ctx.readTable_('Batches').rows.find(x => x.batch === 'FX2');
    G().ctx.updateRow_('Batches', live._row, { live: 'Yes' }); G().fresh();
    const { page } = await E.newPage('desktop1280');
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
    console.log('teacher sign-in + classes');
    await login(page, E.url, 'TEACH-FX-9');
    await page.waitForSelector('#t-students');
    check(await page.$eval('#scr-teacher', e => e.classList.contains('on')), 'teacher code → teacher page (Classes)');
    await page.click('#t-new-st');
    await page.fill('.t-modal [name=name]', 'Lan Test');
    await page.click('.t-modal .btns button:last-child');
    await page.waitForSelector('.t-newcode .t-code');
    const newCode = await page.$eval('.t-newcode .t-code', e => e.textContent);
    check(/^TL-[A-Z0-9]{3}$/.test(newCode), 'New student → code shown once: ' + newCode);
    await page.click('.t-modal .btns button');
    await page.waitForSelector('#t-new-cl');
    await page.click('#t-new-cl');
    await page.fill('.t-modal [name=name]', 'Pair (test)');
    await page.check('.t-modal input[value="FX-T01"]'); await page.check('.t-modal input[value="FX-T03"]');
    await page.click('.t-modal .btns button:last-child');
    await page.waitForSelector('.t-card[data-class="C-001"]');
    check(/Test Student/.test(await page.$eval('.t-card[data-class="C-001"]', e => e.innerText)), 'New class "Pair (test)" with 2 students');
    await shot(page, 'e2e_t_classes');

    console.log('assignment builder');
    await page.click('.t-card[data-class="C-001"]');
    await page.waitForSelector('#t-new-asg');
    await page.click('#t-new-asg');
    await page.waitForSelector('.b-topic[data-code="H.B"] .b-on');
    await page.check('.b-topic[data-code="H.B"] .b-on');
    await page.fill('.b-topic[data-code="H.B"] .b-n', '3');
    check(await page.$eval('.b-topic[data-code="H.B"] .b-diff[value="M"]', e => e.checked), 'Medium ticked by default; counts "n new / total" shown');
    await page.click('#b-pickbtn');
    await page.waitForSelector('.b-item');
    const items = await page.$$eval('.b-item', a => a.map(x => x.innerText));
    check(items.length === 3 && items.every(t => /Medium/.test(t) && /new for all/.test(t)), '3 Medium items, all "new for all", each with its code');
    const before = await page.$eval('.b-item .t-code', e => e.textContent);
    await page.click('.b-item [data-swap]');
    check(await page.$eval('.b-item .t-code', e => e.textContent) !== before, 'Swap replaces an item with the next one');
    await shot(page, 'e2e_t_builder');
    await page.click('#b-publish');
    await page.waitForSelector('.t-asg');
    check(/not started/.test(await page.$eval('.t-asg', e => e.innerText)), 'Published → class Assignments tab: both "not started"');

    console.log('student home: Assigned by your teacher');
    const sp = (await E.newPage('phone')).page;
    await login(sp, E.url, 'FX-T01');
    await sp.waitForSelector('#assigned .hz-btn.big');
    const card = await sp.$eval('#assigned', e => e.innerText);
    check(/Assigned by your teacher/i.test(card) && /Homework/.test(card) && /3\s*questions/.test(card) && !/Desmos/.test(card) && await sp.$eval('#assigned .hz-ring', e => /3/.test(e.innerText)), 'student (phone): focus card "Assigned by your teacher" · Homework – … · ring 3 questions · no Desmos line');
    await shot(sp, 'e2e_t_student_focus');
    await sp.click('#assigned .hz-btn.big');
    await sp.waitForSelector('#btn-begin');
    check(/Homework/.test(await sp.$eval('#tb-title', e => e.textContent)), 'Start → the assignment set opens (no timer)');
    await shot(sp, 'e2e_t_student_card');

    console.log('students do it (server calls)');
    const g = G(), C = g.ctx;
    g.fresh();
    const aid = C.readTable_('Assignments').rows[0].assignment_id;
    const Q = {}; C.readTable_('Questions').rows.forEach(r => { Q[r.qid] = r; });
    const key = id => String(Q[id].key).replace(/^'/, ''), wrong = id => Q[id].type === 'spr' ? '999' : ['A', 'B', 'C', 'D'].find(l => l !== key(id));
    for (const [code, plan, ask] of [['FX-T01', ['wrong', 'right', 'right'], 1], ['FX-T03', ['wrong', 'wrong', 'right'], -1]]) {
      g.fresh(); const h = g.call('homeData', [code]);
      check(h.assignments.length === 1, code + ': the assignment is on the home ("Assigned by your teacher")');
      const s = g.call('startAssignment', [code, aid]); g.fresh();
      const t = g.call('getSet', [code, s.set_id, {}]);
      const ans = {}, ev = [{ part: 'P', t_ms: 0, qid: null, type: 'part_start', value: 'P' }]; let tt = 1000;
      t.questions.forEach((q, i) => { ev.push({ part: 'P', t_ms: tt, qid: q.qid, type: 'q_enter', value: i + 1 }); tt += 60000; ans[q.qid] = plan[i] === 'right' ? key(q.qid) : wrong(q.qid);
        ev.push({ part: 'P', t_ms: tt - 100, qid: q.qid, type: 'select', value: ans[q.qid] }); ev.push({ part: 'P', t_ms: tt, qid: q.qid, type: 'q_leave', value: null }); });
      const askMap = ask >= 0 ? { [t.questions[ask].qid]: 'How?' } : {};
      g.fresh(); g.call('submit', [code, s.set_id, { state: { v: 1, current_part: 'P', phase: 'review', part_starts: { P: Date.now() - 600000 }, ended: {}, parts: { P: { cur: 0, ans, elim: {}, mark: {}, ask: askMap, hl: {} } } }, events: ev, ev_from: 0, copy: t.copy }]);
    }
    const order = C.readTable_('Assignments').rows[0].qids.split(',');

    console.log('What to go over');
    await page.click('[data-tab="go"]');
    await page.click('.t-back'); await page.waitForSelector('.t-card[data-class="C-001"]');
    await page.click('.t-card[data-class="C-001"]');
    await page.waitForSelector('.t-row');
    const rows = await page.$$eval('.t-row', a => a.map(r => r.getAttribute('data-q')));
    check(rows[0] === order[0], 'top row = the question both got wrong');
    check(rows[1] === order[1], 'next = 1 of 2 wrong + asked');
    check(await page.$eval('.t-row .t-codebox.big .t-code', e => /^M\d+$/.test(e.textContent)) && await page.$('.t-row .t-copy'), 'each row: short code big + Copy button');
    await page.click('.t-row .t-copy');
    await page.waitForFunction(() => /Copied/.test(document.querySelector('#toast').textContent));
    check(true, 'Copy → "Copied M…"');
    const firstCode = await page.$eval('.t-row .t-code', e => e.textContent);
    await page.fill('#t-search', firstCode);
    check((await page.$$('.t-row')).length === 1, 'search box with a code → that row only');
    await page.fill('#t-search', '');
    await shot(page, 'e2e_t_goover');
    await page.click('[data-tab="grid"]');
    await page.waitForSelector('.t-grid');
    check((await page.$$('.t-grid tr[data-q]')).length === 3 && (await page.$$('.t-grid th')).length === 3, 'Grid: 3 questions × 2 students');
    await page.click('[data-gf="asked"]');
    check((await page.$$('.t-grid tr[data-q]')).length === 1, 'Grid filter "Asked" → 1 question');
    await page.click('[data-tab="go"]');

    console.log('go over a question (#50: the test screen, the key only on Show answer)');
    await page.$eval('.t-row', e => e.click());
    await page.waitForSelector('#scr-test.going #go-show');
    await waitMath(page);
    check(!(await page.$('#scr-test .ch.rv-key')) && !/Correct answer/.test(await page.$eval('#scr-test', e => e.innerText)), 'go-over opens with no key, no correct mark');
    await page.click('#go-det');
    await page.waitForSelector('#go-dr-body .t-ps');
    await sleep(400); // drawer slide-in
    check((await page.$$('#go-dr-body .t-ps')).length === 2 && /Tries:/.test(await page.$eval('#go-dr-body .t-ps', e => e.innerText)), 'Details drawer: each student with tries + time');
    await page.selectOption('#go-dr-body [data-tag="0"]', 'Concept Gap');
    await page.$eval('#go-dr-body [data-save="0"]', e => e.click());
    await page.waitForFunction(() => /Saved.*Concept Gap/.test(document.querySelector('#toast').textContent));
    check(true, 'mistake type saved ("Concept Gap") from the drawer');
    await page.click('#go-show');
    await page.waitForSelector('.go-key');
    check(/Correct answer: \S+/.test(await page.$eval('#fb-go', e => e.innerText)), 'Show answer → the correct answer');
    await shot(page, 'e2e_t_panel');
    await page.click('#btn-view-back');
    await page.waitForSelector('#scr-teacher.on .t-row');
    g.fresh();
    const tagged = C.readTable_('Responses').rows.filter(r => r.mistake_type === 'Concept Gap');
    check(tagged.length === 1 && tagged[0].tagged_in === 'app', 'Responses.mistake_type written');

    console.log('Asked inbox + profile');
    await page.click('.t-nav [data-go="asks"]');
    await page.waitForSelector('[data-res]');
    check(/How\?/.test(await page.$eval('#t-body', e => e.innerText)), 'Asked: the note "How?" with its code');
    await page.click('[data-res]');
    await page.waitForFunction(() => /No open questions/.test(document.querySelector('#t-body').innerText));
    check(true, 'Resolve → inbox empty');
    await page.click('#t-brand');
    await page.waitForSelector('[data-prof="FX-T03"]');
    await page.$eval('[data-prof="FX-T03"]', e => e.click());
    await page.waitForSelector('#t-my .ms-lrow');
    check((await page.$$('#t-my .ms-lrow')).length === 19 && /Homework/.test(await page.$eval('#t-body', e => e.innerText)), 'profile: the student\'s skill map (19 skills) + the assignment with First Try / Best');
    await shot(page, 'e2e_t_profile');

    console.log('payloads');
    const studentCalls = E.st.rpcLog.filter(r => !/^(teacher|create|edit|save|class|question|tag|resolve|asks|student|assignment|pick|publish|close|goOver|setItemLevel)/.test(r.fn) && r.fn !== 'login');
    const keyLeak = studentCalls.filter(r => /"key"|"accepted"/.test(r.res));
    check(!keyLeak.length, 'student calls carry no key (' + studentCalls.length + ' checked)');
    englishOnly(E);
  } catch (e) { console.error(e); check(false, 'exception: ' + e.message); }
  await E.close();
  process.exit(summary() ? 1 : 0);
})();
