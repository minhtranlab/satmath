// #71 (Minh's review of v0.14): tidy sign-in, map without words and with 9 equal blocks, Recommended = Focus order,
// the Assignment tab (Current: Edit / Cancel / Delete; Past), the one-time Ask backfill.
const { makeGas } = require('./server');
const H = require('./h'); const { check, sleep, shot } = H;
const T = 'TEACH-FX-9';
const full = (page, name) => page.screenshot({ path: require('path').join(H.SHOTS, name + '.png'), fullPage: true });

console.log('[server: Recommended = Focus now order]');
{
  const G = makeGas(), C = G.ctx, iso = d => new Date(Date.now() - d * 864e5).toISOString(); let n = 0;
  const rows = (k, ss, dif, oks) => oks.map(ok => ({ set_id: 'FXS-' + (++n), student_code: 'FX-T01', qid: 'FXQ' + n, order: 1, skill: k, subskill: ss, difficulty: dif, try1_correct: ok, profile: ok ? 'RIGHT' : 'WRONG', submitted_at: iso(1) }));
  C.appendObjects_('Responses', [].concat(rows('H.B', 'H.B.1', 'M', [1, 0, 0, 1, 0]), rows('P.C', 'P.C.1', 'M', [1, 1, 1, 0, 0]), rows('S.C', 'S.C.1', 'E', [0, 0, 1, 0, 0]), rows('Q.A', 'Q.A.1', 'H', [1, 1, 0, 0, 0])));
  C.appendObjects_('Levels', [{ student_code: 'FX-T01', skill: 'H.B', level: 'M' }, { student_code: 'FX-T01', skill: 'P.C', level: 'M' }, { student_code: 'FX-T01', skill: 'S.C', level: 'E' }, { student_code: 'FX-T01', skill: 'Q.A', level: 'H' }]);
  G.fresh();
  const p = G.call('studentProfile', [T, 'FX-T01']), f = p.my.focus, rec = p.recommend.topics.map(t => t.code);
  check(f.length === 3 && JSON.stringify(rec) === JSON.stringify(f), 'Recommended assignment skills = Focus now, same order (' + rec.join(', ') + ')');
  const st = G.call('mySkills', ['FX-T01']);
  check(JSON.stringify(st.focus) === JSON.stringify(f), 'the student sees the same Focus now');
}

console.log('[server: assignments — edit / cancel / delete]');
{
  const G = makeGas(), C = G.ctx;
  const q = C.livePool_().filter(r => r.skill === 'H.B').slice(0, 3).map(r => r.qid);
  const a1 = G.call('publishAssignment', [T, { target: 'st:FX-T01', qids: q, title: 'HW one' }]); G.fresh();
  const a2 = G.call('publishAssignment', [T, { target: 'st:FX-T01', qids: q.slice(0, 2), title: 'HW two' }]); G.fresh();
  let L = G.call('teacherAssignments', [T]);
  check(L.current.length >= 2 && L.current[0].title === 'HW two' && L.current[0].done === 0 && L.current[0].total === 1 && L.current[0].who && L.current[0].started === 0, 'Current: title, who, from–due, done 0/1, newest first');
  G.call('editAssignment', [T, a1.assignment_id, { title: 'HW one (b)', due: '2026-12-01', target: 'st:FX-T03' }]); G.fresh();
  let r1 = C.readTable_('Assignments').rows.find(x => x.assignment_id === a1.assignment_id);
  check(r1.title === 'HW one (b)' && String(r1.due).replace(/^'/, '') === '2026-12-01' && r1.target_id === 'FX-T03', 'Edit: title, due, students');
  G.call('editAssignment', [T, a1.assignment_id, { qids: q.slice(1) }]); G.fresh();
  check(String(C.readTable_('Assignments').rows.find(x => x.assignment_id === a1.assignment_id).qids).split(',').length === 2, 'Edit: the questions while nobody started');
  G.call('startAssignment', ['FX-T03', a1.assignment_id]); G.fresh();
  const err = fn => { try { fn(); return ''; } catch (e) { return e.message; } };
  check(/started/.test(err(() => G.call('editAssignment', [T, a1.assignment_id, { qids: q }]))), 'after a start: questions refused');
  G.call('editAssignment', [T, a1.assignment_id, { title: 'HW one (c)' }]); G.fresh();
  check(C.readTable_('Assignments').rows.find(x => x.assignment_id === a1.assignment_id).title === 'HW one (c)', 'after a start: the title still changes');
  check(/started/.test(err(() => G.call('deleteAssignment', [T, a1.assignment_id]))), 'Delete refused after a start');
  G.call('deleteAssignment', [T, a2.assignment_id]); G.fresh();
  L = G.call('teacherAssignments', [T]);
  check(!L.current.concat(L.past).some(x => x.assignment_id === a2.assignment_id) && !G.call('homeData', ['FX-T01']).assignments.some(x => x.assignment_id === a2.assignment_id), 'Delete (nobody started): gone everywhere (row kept as "deleted")');
  check(G.call('homeData', ['FX-T03']).assignments.some(x => x.assignment_id === a1.assignment_id), 'before Cancel: the student sees it');
  G.call('cancelAssignment', [T, a1.assignment_id]); G.fresh();
  L = G.call('teacherAssignments', [T]);
  check(!G.call('homeData', ['FX-T03']).assignments.some(x => x.assignment_id === a1.assignment_id) && /not available/.test(err(() => G.call('startAssignment', ['FX-T03', a1.assignment_id]))), 'Cancel: hidden for the student, cannot start');
  check(L.past.some(x => x.assignment_id === a1.assignment_id && x.status === 'cancelled') && C.readTable_('Sets').rows.some(s => s.assignment_id === a1.assignment_id), 'Cancel: in Past, its set kept (history)');
  check(/LOGIN|teacher/i.test(err(() => G.call('cancelAssignment', ['FX-T01', a1.assignment_id]))), 'students cannot cancel');
}

console.log('[server: Ask backfill]');
{
  const G = makeGas(), C = G.ctx;
  C.appendObjects_('Responses', [{ set_id: 'B1', student_code: 'FX-T01', qid: 'q1', asked: 'Yes', ask_status: 'open', mistake_type: 'Concept Gap' },
    { set_id: 'B1', student_code: 'FX-T01', qid: 'q2', asked: 'Yes', ask_status: 'open', mistake_type: 'Not A Mistake' },
    { set_id: 'B1', student_code: 'FX-T01', qid: 'q3', asked: 'Yes', ask_status: 'open', mistake_type: '' },
    { set_id: 'B1', student_code: 'FX-T01', qid: 'q4', asked: 'Yes', ask_status: 'resolved', mistake_type: 'Concept Gap', resolved_by: 'teacher' }]); G.fresh();
  check(C.backfillAskTags_() === 'asks backfill: 2 resolved', 'open Asks that already have a mistake type → resolved (2)');
  G.fresh(); const b = G.table('Responses').filter(r => r.set_id === 'B1');
  check(b[0].resolved_by === 'tag-backfill' && b[0].resolved_at && b[1].ask_status === 'resolved' && b[2].ask_status === 'open' && b[3].resolved_by === 'teacher', 'only those rows / cells change');
  check(C.backfillAskTags_() === 'asks backfill: 0 resolved', 'a second run changes nothing');
  check(/backfillAskTags_/.test(require('fs').readFileSync(__dirname + '/../src/Update.gs', 'utf8')), 'runs in the Sheet update after the deploy');
}

(async () => {
  const E = await H.setup(); const G = () => E.st.gas;
  try {
    for (const dev of ['desktop1280', 'phone']) {
      const { page } = await E.newPage(dev); await page.goto(E.url); await page.waitForSelector('#login-code');
      const lay = await page.evaluate(() => { const h = document.querySelector('.hz-si h1').getBoundingClientRect(), f = document.querySelector('#login-form').getBoundingClientRect(); return { gap: f.top - h.bottom, hc: (h.left + h.right) / 2, fc: (f.left + f.right) / 2, w: innerWidth }; });
      check(lay.gap >= 16 && Math.abs(lay.hc - lay.w / 2) < 3 && Math.abs(lay.fc - lay.w / 2) < 3 && !(await page.$('.hz-chips')), dev + ': sign-in: heading, then the code box (' + Math.round(lay.gap) + ' px apart), centred, no feature tiles');
      await shot(page, 'm71_signin_' + (dev === 'phone' ? 'phone' : 'laptop'));
      await page.context().close();
    }
    const g = G(); g.fresh(); g.call('startPractice', ['FX-T01', 'H.B', 5]);
    for (const dev of ['desktop1280', 'phone', 'ipad']) {
      const { page } = await E.newPage(dev);
      await H.login(page, E.url, 'FX-T01'); await page.waitForSelector('#btn-myskills'); await page.click('#btn-myskills'); await page.waitForSelector('#ms-map .ms-lrow');
      const m = await page.evaluate(() => {
        const out = { w: new Set(), g: new Set(), G: new Set() };
        document.querySelectorAll('#ms-map .ms-lad').forEach(l => { const r = [...l.children].map(i => i.getBoundingClientRect());
          r.forEach(x => out.w.add(x.width.toFixed(2)));
          for (let i = 1; i < 9; i++) (i % 3 ? out.g : out.G).add((r[i].left - r[i - 1].right).toFixed(2)); });
        return { w: [...out.w], g: [...out.g], G: [...out.G] };
      });
      check(m.w.length === 1 && m.g.length === 1 && m.G.length === 1 && +m.G[0] > +m.g[0], dev + ': 9 blocks of one width (' + m.w + ' px), equal gaps (' + m.g + ' / ' + m.G + ' px between levels)');
      const mt = await page.$eval('#ms-map', e => e.innerText);
      check(!/\bEasy\b|\bMedium\b|\bHard\b|this week|this month/.test(mt) && !(await page.$('#ms-map .ms-legend')) && /vs last week/.test(mt), dev + ': map without words (no Easy / Medium / Hard, no "this week"), the switch stays');
      if (dev !== 'phone') await shot(page, 'm71_map_' + (dev === 'ipad' ? 'ipad' : 'laptop'));
      await page.context().close();
    }
    console.log('teacher: the Assignment tab');
    const { page: tp } = await E.newPage('desktop1280');
    const q = g.ctx.livePool_().filter(r => r.skill === 'H.B').slice(0, 2).map(r => r.qid);
    g.call('publishAssignment', [T, { target: 'st:FX-T01', qids: q, title: 'Tab A' }]); g.fresh();
    g.call('publishAssignment', [T, { target: 'st:FX-T03', qids: q, title: 'Tab B' }]); g.fresh();
    await H.login(tp, E.url, T); await tp.waitForSelector('#t-students');
    check(/^Assignment$/.test(await tp.$eval('.t-nav [data-go="asg"]', e => e.textContent.trim())), 'nav tab "Assignment"');
    await tp.click('.t-nav [data-go="asg"]'); await tp.waitForSelector('#t-acur .t-arow');
    check(!!(await tp.$('#t-asg-new')) && (await tp.$$('#t-acur .t-arow')).length >= 2 && !!(await tp.$('#t-apast:not([open])')), 'New assignment · Current list · Past collapsed');
    await shot(tp, 'm71_asg_tab');
    const rowB = '#t-acur .t-arow:has-text("Tab B")';
    await tp.click(rowB + ' [data-aedit]'); await tp.waitForSelector('#modal-root.on [name=title]');
    await tp.fill('#modal-root [name=title]', 'Tab B2'); await tp.fill('#modal-root [name=due]', '2026-12-05');
    await tp.click('#modal-root .btns .btn-blue'); await tp.waitForFunction(() => window.SMLX && SMLX.WQ.list.length === 0); await sleep(200);
    g.fresh(); let rb = g.ctx.readTable_('Assignments').rows.find(x => x.title === 'Tab B2');
    check(!!rb && String(rb.due).replace(/^'/, '') === '2026-12-05' && /Tab B2/.test(await tp.$eval('#t-acur', e => e.innerText)), 'Edit → title + due saved, list updated');
    await tp.click('#t-acur .t-arow:has-text("Tab B2") [data-acancel]'); await tp.waitForSelector('#modal-root.on');
    await tp.click('#modal-root .btns .btn-blue'); await tp.waitForFunction(() => window.SMLX && SMLX.WQ.list.length === 0); await sleep(200);
    g.fresh(); rb = g.ctx.readTable_('Assignments').rows.find(x => x.title === 'Tab B2');
    check(rb.status === 'cancelled' && !/Tab B2/.test(await tp.$eval('#t-acur', e => e.innerText)) && /Tab B2/.test(await tp.$eval('#t-apast', e => e.textContent)), 'Cancel (confirmed on the page) → cancelled, moved to Past');
    await tp.click('#t-acur .t-arow:has-text("Tab A") [data-adel]'); await tp.waitForSelector('#modal-root.on');
    await tp.click('#modal-root .btns .btn-blue'); await tp.waitForFunction(() => window.SMLX && SMLX.WQ.list.length === 0); await sleep(200);
    g.fresh();
    check(g.ctx.readTable_('Assignments').rows.find(x => x.title === 'Tab A').status === 'deleted' && !/Tab A\b/.test(await tp.$eval('#t-body', e => e.innerText)), 'Delete (nobody started) → gone');
    await tp.click('#t-apast summary'); await sleep(100); await shot(tp, 'm71_asg_past');
    const { page: sp } = await E.newPage('phone'); await H.login(sp, E.url, 'FX-T03'); await sp.waitForSelector('#btn-myskills');
    check(!/Tab B/.test(await sp.$eval('#scr-home', e => e.innerText)), 'the student no longer sees the cancelled assignment');
    H.englishOnly(E);
  } catch (e) { console.error(e); check(false, 'exception: ' + e.message); }
  await E.close();
  process.exit(H.summary() ? 1 : 0);
})();
