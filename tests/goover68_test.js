// #68 A–C: the mistake type in the go-over TOP bar (one student: select, saved at once, Undo, keys 1–7; a class:
// popover per student + "Set all to"), a tag resolves the student's open Ask (Undo opens it again), Notes open in math.
const { makeGas } = require('./server');
const H = require('./h'); const { check, sleep, shot, waitMath } = H;
const T = 'TEACH-FX-9';
function setup(G) {                     // class "Pair" (FX-T01, FX-T03) + one 3-question assignment; FX-T01 asks on Q1
  const C = G.ctx;
  const cls = G.call('saveClass', [T, { name: 'Pair T68', student_codes: ['FX-T01', 'FX-T03'] }]); G.fresh();
  const pool = C.livePool_().filter(r => r.skill === 'H.B' && String(r.type) !== 'spr').slice(0, 3).map(r => r.qid);
  G.call('publishAssignment', [T, { target: cls.class_id, qids: pool, title: 'Homework T68' }]); G.fresh();
  const aid = C.readTable_('Assignments').rows.slice(-1)[0].assignment_id;
  const Q = {}; C.readTable_('Questions').rows.forEach(r => { Q[r.qid] = r; });
  const key = id => String(Q[id].key).replace(/^'/, ''), wrong = id => ['A', 'B', 'C', 'D'].find(l => l !== key(id));
  const sets = {};
  for (const [code, plan, ask] of [['FX-T01', ['wrong', 'right', 'wrong'], 0], ['FX-T03', ['wrong', 'wrong', 'right'], -1]]) {
    G.fresh(); const s = G.call('startAssignment', [code, aid]); G.fresh();
    const t = G.call('getSet', [code, s.set_id, {}]), ans = {}, ev = [{ part: 'P', t_ms: 0, qid: null, type: 'part_start', value: 'P' }]; let tt = 1000;
    t.questions.forEach((q, i) => { ev.push({ part: 'P', t_ms: tt, qid: q.qid, type: 'q_enter', value: i + 1 }); tt += 60000; ans[q.qid] = plan[i] === 'right' ? key(q.qid) : wrong(q.qid);
      ev.push({ part: 'P', t_ms: tt - 100, qid: q.qid, type: 'select', value: ans[q.qid] }); ev.push({ part: 'P', t_ms: tt, qid: q.qid, type: 'q_leave', value: null }); });
    const askMap = ask >= 0 ? { [t.questions[ask].qid]: 'How?' } : {};
    G.fresh(); G.call('submit', [code, s.set_id, { state: { v: 1, current_part: 'P', phase: 'review', part_starts: { P: Date.now() - 600000 }, ended: {}, parts: { P: { cur: 0, ans, elim: {}, mark: {}, ask: askMap, hl: {} } } }, events: ev, ev_from: 0, copy: t.copy }]);
    sets[code] = { set_id: s.set_id, qids: t.questions.map(q => q.qid) };
  }
  G.fresh();
  return { cls: cls.class_id, aid, sets, qids: sets['FX-T01'].qids };
}
const row = (G, sid, qid) => G.table('Responses').find(r => r.set_id === sid && r.qid === qid);

console.log('[server: a tag resolves the open Ask; its Undo opens it again]');
{
  const G = makeGas(), d = setup(G), s1 = d.sets['FX-T01'], q0 = s1.qids[0];
  check(row(G, s1.set_id, q0).ask_status === 'open', 'FX-T01 asked on Q1 (open)');
  const r1 = G.call('tagMistake', [T, s1.set_id, q0, 'Concept Gap', '']); G.fresh();
  let r = row(G, s1.set_id, q0);
  check(r1.ask_resolved && r.mistake_type === 'Concept Gap' && r.ask_status === 'resolved' && r.resolved_by === 'tag' && r.resolved_at, 'tag → mistake saved + Ask resolved (resolved_by tag)');
  const r2 = G.call('tagMistake', [T, s1.set_id, q0, '', '', true]); G.fresh(); r = row(G, s1.set_id, q0);
  check(r2.ask_reopened && r.mistake_type === '' && r.ask_status === 'open' && !r.resolved_by, 'Undo (old type + undoAsk) → tag removed, Ask open again');
  G.call('tagMistake', [T, s1.set_id, q0, 'Not A Mistake', '']); G.fresh();
  check(row(G, s1.set_id, q0).ask_status === 'resolved', '"Not A Mistake" also resolves the Ask');
  G.call('resolveAsk', [T, s1.set_id, q0, true]); G.fresh();
  const all = G.call('tagMistakes', [T, [{ set_id: s1.set_id, qid: q0 }, { set_id: d.sets['FX-T03'].set_id, qid: q0 }], 'Misread A Detail']); G.fresh();
  check(all.items.length === 2 && row(G, s1.set_id, q0).mistake_type === 'Misread A Detail' && row(G, d.sets['FX-T03'].set_id, q0).mistake_type === 'Misread A Detail' && all.items[0].ask_resolved && row(G, s1.set_id, q0).ask_status === 'resolved', '"Set all to" (tagMistakes): both students tagged, the open Ask resolved');
  check(/LOGIN/.test((() => { try { G.call('tagMistakes', ['FX-T01', [], 'Concept Gap']); } catch (e) { return e.message; } })()), 'students cannot tag');
}

(async () => {
  const E = await H.setup(); const G = () => E.st.gas;
  try {
    const d = setup(G()), s1 = d.sets['FX-T01'], q = d.qids;
    for (const dev of ['desktop1280', 'ipad']) {
      const { page } = await E.newPage(dev); const tag = dev === 'ipad' ? '_ipad' : '';
      await H.login(page, E.url, T); await page.waitForSelector('[data-prof="FX-T01"]');
      if (dev === 'desktop1280') {
        console.log('one student (Report → go over)');
        await page.$eval('[data-prof="FX-T01"]', e => e.click());
        await page.waitForSelector('#t-sets [data-res]'); await page.$eval('#t-sets [data-res]', e => e.click());
        await page.waitForSelector('#result-body .rcell');
        await page.$eval('#result-body .rcell[data-qid="' + q[0] + '"]', e => e.click());
        await page.waitForSelector('#scr-test.going #go-mt'); await waitMath(page);
        const pos = await page.evaluate(() => { const m = document.querySelector('.go-mk').getBoundingClientRect(), d = document.querySelector('#go-det').getBoundingClientRect(), v = document.querySelector('#view-bar').getBoundingClientRect(); return m.right <= d.left + 2 && Math.abs(m.top + m.height / 2 - d.top - d.height / 2) < 6 && m.top >= v.top - 2 && m.bottom <= v.bottom + 2; });
        check(pos && /Mistake/.test(await page.$eval('.go-mk', e => e.innerText)), 'top bar: "Mistake [select]" right before Details');
        const opts = await page.$$eval('#go-mt option', a => a.map(o => o.value));
        check(opts.length === 8 && opts[0] === '', 'placeholder + the 7 mistake types from Settings');
        await page.selectOption('#go-mt', 'Concept Gap');
        await page.waitForSelector('.go-mk-ok'); await page.waitForFunction(() => window.SMLX && SMLX.WQ.list.length === 0);
        G().fresh(); let r = row(G(), s1.set_id, q[0]);
        check(r.mistake_type === 'Concept Gap' && r.ask_status === 'resolved', 'select → saved at once (no Save), "Saved ✓", the Ask resolved');
        await page.waitForFunction(() => /Ask resolved/.test(document.querySelector('#toast').textContent));
        check(true, 'toast "Saved ✓ Concept Gap · Ask resolved"');
        await shot(page, 'go68_bar_one');
        await page.click('#go-mt-undo'); await page.waitForFunction(() => window.SMLX && SMLX.WQ.list.length === 0); await sleep(200);
        G().fresh(); r = row(G(), s1.set_id, q[0]);
        check(r.mistake_type === '' && r.ask_status === 'open' && await page.$eval('#go-mt', e => e.value === ''), 'Undo → no type, Ask open again (screen + Sheet)');
        await page.click('#scr-test .q.on .stem, #scr-test .q.on .q-text').catch(() => {});
        await page.keyboard.press('3'); await page.waitForFunction(() => window.SMLX && SMLX.WQ.list.length === 0); await sleep(200);
        G().fresh(); const t3 = G().ctx.getSettings_().mistake_types.split(/\s*;\s*/)[2];
        check(row(G(), s1.set_id, q[0]).mistake_type === t3 && await page.$eval('#go-mt', e => e.value) === t3, 'key 3 → the 3rd type (' + t3 + ')');
        await page.click('#go-det'); await page.waitForSelector('#go-dr-body [data-tag="0"]'); await sleep(250);
        check(await page.$eval('#go-dr-body [data-tag="0"]', e => e.value) === t3, 'Details shows the same type (same data)');
        await page.click('#go-dr-x');
        if (await page.$('#go-wrong:checked')) { await page.click('#go-wrong'); await sleep(300); }
        await page.click('#btn-next'); await sleep(400);
        check(!(await page.$('#go-mt')), 'a question the student got right → no mistake control');
        await page.click('#btn-view-back'); await page.waitForSelector('#scr-result.on');
        await H.login(page, E.url, T); await page.waitForSelector('.t-card[data-class]');
      }
      console.log(dev + ': class (What to go over → popover)');
      await page.$eval('.t-card[data-class="' + d.cls + '"]', e => e.click()); await page.waitForSelector('.t-row');
      await page.$eval('.t-row[data-q="' + q[1] + '"]', e => e.click());          // Q2: FX-T03 wrong, FX-T01 right
      await page.waitForSelector('#scr-test.going #go-show');
      await page.waitForSelector('#go-mk-b');
      check(/1 student · 0 tagged/.test(await page.$eval('#go-mk-b', e => e.textContent)) && !(await page.$('#go-mt')), dev + ' · class list, Q2 (one student missed) → "Mistakes · 1 student · 0 tagged ▾" (popover says who)');
      await page.click('#btn-back').catch(() => {}); await sleep(300);
      if (!(await page.$('#go-mk-b'))) { await page.click('#btn-view-back'); await page.waitForSelector('.t-row'); await page.$eval('.t-row[data-q="' + q[0] + '"]', e => e.click()); await page.waitForSelector('#go-mk-b'); }
      check(/2 students · \d tagged/.test(await page.$eval('#go-mk-b', e => e.textContent)), dev + ' · Q1 (both wrong): "Mistakes · 2 students · n tagged ▾"');
      await page.click('#go-mk-b'); await page.waitForSelector('#go-mkpop:not([hidden]) [data-mi="1"]');
      await shot(page, 'go68_class_pop' + tag);
      const fit = await page.evaluate(() => { const p = document.querySelector('#go-mkpop').getBoundingClientRect(), v = document.querySelector('#view-bar'); return [p.left, p.right, innerWidth, v.scrollWidth - v.clientWidth]; });
      check(fit[0] >= 0 && fit[1] <= fit[2] + 1 && fit[3] <= 1, dev + ' · popover and top bar fit the screen');
      if (dev === 'desktop1280') {
        await page.selectOption('#go-mkpop [data-mi="1"]', 'Others'); await page.waitForFunction(() => window.SMLX && SMLX.WQ.list.length === 0); await sleep(200);
        G().fresh(); check(row(G(), d.sets['FX-T03'].set_id, q[0]).mistake_type === 'Others', 'popover: one student tagged');
        await page.click('#go-mk-b').catch(() => {}); await sleep(100);
        if (!(await page.$('#go-mkpop:not([hidden])'))) await page.click('#go-mk-b');
        await page.selectOption('#go-mkall', 'Concept Gap'); await page.waitForFunction(() => window.SMLX && SMLX.WQ.list.length === 0); await sleep(200);
        G().fresh();
        check(row(G(), s1.set_id, q[0]).mistake_type === 'Concept Gap' && row(G(), d.sets['FX-T03'].set_id, q[0]).mistake_type === 'Concept Gap' && row(G(), s1.set_id, q[0]).ask_status === 'resolved', '"Set all to: Concept Gap" → both tagged, FX-T01\'s Ask resolved');
        check(/2 tagged/.test(await page.$eval('#go-mk-b', e => e.textContent)), 'the button says "2 tagged"');
        await page.click('#btn-view-back'); await page.waitForSelector('.t-row');
        check(!/untagged/.test(await page.$eval('.t-row[data-q="' + q[0] + '"]', e => e.innerText)), 'What to go over: no "untagged" on that row any more');
        console.log('Notes open in math');
        await page.$eval('.t-row', e => e.click()); await page.waitForSelector('#scr-test.going #go-show');
        await page.click('#tool-notes'); await page.waitForSelector('#nt-ed .mq.mq-focused');
        await page.keyboard.type('3/4x^2');
        check(!!(await page.$('#nt-ed .mq .mq-fraction')) && !!(await page.$('#nt-ed .mq .mq-sup, #nt-ed .mq sup')), 'Notes open inside a math field: "3/4x^2" → fraction + power, no shortcut');
        await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter'); await sleep(150);
        check((await page.$$('#nt-ed .mq')).length === 2 && !!(await page.$('#nt-ed .mq.mq-focused')), 'Enter → a new math line');
        await page.keyboard.type('x = 3'); await page.keyboard.press('Control+t'); await page.keyboard.type(' so '); await page.keyboard.press('Control+t'); await page.keyboard.type('y = 7');
        const lx = await page.evaluate(() => [...document.querySelectorAll('#nt-ed .mq')][1]._mq.latex());
        check(/\\ /.test(lx) && /\\text\{ so \}/.test(lx) && /y\\ =\\ 7/.test(lx), 'spaces stay spaces in math; Ctrl+T inside math → upright words, Ctrl+T again → math (' + lx + ')');
        await page.keyboard.press('Enter'); await page.keyboard.press('Control+t'); await page.keyboard.type('Trap: answer C');
        const txt = await page.$eval('#nt-ed', e => e.innerText);
        check(/Trap: answer C/.test(txt) && (await page.$$('#nt-ed .mq')).length === 2, 'Ctrl+T on a new (empty) line → a words line; the empty math field goes');
        await page.click('#nt-tools [data-nt="text"]').catch(() => {});
        await shot(page, 'go68_notes_math');
      }
      await page.context().close();
    }
    H.englishOnly(E);
  } catch (e) { console.error(e); check(false, 'exception: ' + e.message); }
  await E.close();
  process.exit(H.summary() ? 1 : 0);
})();
