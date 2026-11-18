// #48 (Minh 16 Nov, ideas from Test Zone): (1) time to the final answer drives Rushed / Slow, SLOW_RIGHT, GUESS_LIKELY,
// IDLE_LIKELY and the Placement time bands; total time is kept; per set: answering · checking · blank (teacher only).
// (2) leaving the window is recorded in every set (≥ away_min_sec, not while the calculator has focus), shown to the teacher;
// only the Placement test tells the student (start line + calm toast); ⚠ only in Placement (left ≥ away_flag_sec, then right).
const fs = require('fs'), path = require('path');
const { makeGas } = require('./server');
const H = require('./h'); const { check, sleep, shot, waitMath } = H;
const forms = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'placement_forms_fx4.json'), 'utf8'));
const addForms = (G) => { G.ctx.appendObjects_('Placement_Forms', forms.map(r => ({ form: r[0], domain: r[1], slot: r[2], level: r[3], skill: r[4], code: r[5], qid: '' }))); G.fresh(); };
const ev = (t, qid, type, value) => ({ part: 'P', t_ms: t * 1000, qid, type, value: value === undefined ? null : value });

console.log('[server: time to the final answer]');
{
  const G = makeGas(), Q = {}; G.table('Questions').forEach(r => { Q[r.qid] = r; });
  const key = id => String(Q[id].key).replace(/^'/, ''), wrong = id => Q[id].type === 'spr' ? '999' : ['A', 'B', 'C', 'D'].find(l => l !== key(id));
  const sp = G.call('startPractice', ['FX-T01', 'H.B', 5]), t = G.call('getSet', ['FX-T01', sp.set_id, {}]);
  const [q1, q2, q3, q4, q5] = t.questions.map(q => q.qid);
  const events = [ev(0, null, 'part_start', 'P'),
    // Q1: answered at 30 s, then 10 s more; later a revisit WITHOUT a change (60 s) → 30 s to the answer, 100 s in total; away 30 s
    ev(0, q1, 'q_enter', 1), ev(30, q1, 'select', key(q1)), ev(35, q1, 'away', 30000), ev(40, q1, 'q_leave'),
    // Q2: A at 60 s (visit 40–70), back at 160 s and CHANGED at 190 s (leave 200) → 30 + 30 = 60 s to the answer, 70 s in total
    ev(40, q2, 'q_enter', 2), ev(60, q2, 'select', wrong(q2)), ev(70, q2, 'q_leave'),
    ev(100, q1, 'q_enter', 1), ev(160, q1, 'q_leave'),
    ev(160, q2, 'q_enter', 2), ev(190, q2, 'change', key(q2)), ev(200, q2, 'q_leave'),
    // Q3: blank, 60 s
    ev(200, q3, 'q_enter', 3), ev(260, q3, 'q_leave'),
    // Q4: right at 40 s, then sits 360 s (checking) → pace from 40 s: not Slow, not IDLE
    ev(260, q4, 'q_enter', 4), ev(300, q4, 'select', key(q4)), ev(660, q4, 'q_leave'),
    // Q5: right after 5 s → GUESS_LIKELY (from the answer time)
    ev(660, q5, 'q_enter', 5), ev(665, q5, 'select', key(q5)), ev(700, q5, 'q_leave')];
  const ans = { [q1]: key(q1), [q2]: key(q2), [q4]: key(q4), [q5]: key(q5) };
  const state = { v: 1, session_id: sp.set_id, current_part: 'P', phase: 'review', part_starts: { P: Date.now() - 800000 }, ended: {}, parts: { P: { cur: 4, ans, elim: {}, mark: {}, hl: {} } } };
  G.call('submit', ['FX-T01', sp.set_id, { state, events, ev_from: 0, copy: t.copy }]);
  const R = {}; G.table('Responses').forEach(r => { R[r.qid] = r; });
  check(+R[q1].time_answer_sec === 30 && +R[q1].time_try1_sec === 30 && +R[q1].time_total_sec === 100, 'revisit without a change: 30 s to the answer (total 100 s kept)');
  check(+R[q2].time_answer_sec === 60 && +R[q2].time_total_sec === 70, 'changed on a revisit: counted up to the change → 60 s (total 70 s)');
  check(R[q3].profile === 'BLANK' && +R[q3].time_answer_sec === 0 && +R[q3].time_total_sec === 60, 'blank: 0 s answering, 60 s on a blank question');
  check(R[q4].profile !== 'SLOW_RIGHT' && !/IDLE_LIKELY/.test(R[q4].flags) && +R[q4].time_answer_sec === 40 && +R[q4].time_total_sec === 400, 'right at 40 s, then 6 min checking: not Slow, not IDLE (pace reads 40 s)');
  check(/GUESS_LIKELY/.test(R[q5].flags), 'answer after 5 s → GUESS_LIKELY');
  check(+R[q1].away_n === 1 && +R[q1].away_sec === 30 && !/LEFT_THEN_RIGHT/.test(R[q1].flags), 'left the window 30 s on Q1: recorded; no ⚠ in practice');
  const S = G.table('Sets').find(s => s.set_id === sp.set_id);
  check(+S.time_answer_min === 2.3 && +S.time_blank_min === 1 && +S.time_check_min === 7.9 && +S.away_n === 1 && +S.away_sec === 30 && S.away_at === 'Q1',
    'set: answering ' + S.time_answer_min + ' min (30+60+40+5 s) · checking ' + S.time_check_min + ' min · blank ' + S.time_blank_min + ' min · left 1× 30 s at Q1');
  const tr = G.call('teacherResult', ['TEACH-FX-9', sp.set_id]);
  check(tr.pace && tr.pace.answer_min === 2.3 && tr.pace.away_n === 1 && tr.pace.away_at === 'Q1', 'teacher result: pace + leave log');
  const st = G.call('getResult', ['FX-T01', sp.set_id]);
  check(!st.pace && !/away/.test(JSON.stringify(st)), 'student result: nothing about leaving or checking time');
  const pr = G.call('studentProfile', ['TEACH-FX-9', 'FX-T01']).sets.find(x => x.set_id === sp.set_id);
  check(pr.away_n === 1 && pr.away_sec === 30 && pr.away_at === 'Q1' && pr.answer_min === 2.3, 'teacher profile: Sets row has answering time + "left 1× · 30 s · at Q1"');
  const tries = G.table('Tries').filter(x => x.set_id === sp.set_id && x.qid === q1);
  check(tries.length === 1 && +tries[0].time_sec === 30, 'Tries (first try in the set): measured the new way (30 s)');
  // old rows (no answering time column value) still read: pace falls back to the total
  const legacy = G.ctx.paceOf_([{ order: 1, time_total_sec: 50, profile: 'RIGHT', time_answer_sec: '' }]);
  check(legacy.answer_min === 0.8 && legacy.has_answer_time === false, 'old Responses rows (before #48): answering = total time, nothing breaks');
}

console.log('[server: placement]');
{
  const G = makeGas(), C = G.ctx, Q = {}; G.table('Questions').forEach(r => { Q[r.qid] = r; }); addForms(G);
  C.publishAssignment('TEACH-FX-9', { kind: 'placement', target: 'st:FX-T01', title: 'Placement test', form: 'auto' }); G.fresh();
  const aid = G.table('Assignments').slice(-1)[0].assignment_id;
  const st = G.call('startAssignment', ['FX-T01', aid, { device: 'test' }]), set = st.set, cur = set.questions.slice(-1)[0];
  check(/notes when you leave the test window/.test(set.profile.parts[0].directions_html) && set.settings.away_notice === true, 'placement start screen: "This test notes when you leave the test window." + notice on');
  const sp = G.call('startPractice', ['FX-T03', 'H.B', 5]), ps = G.call('getSet', ['FX-T03', sp.set_id, {}]);
  check(ps.settings.away_notice === false && !/leave the test window/.test(ps.profile.parts[0].directions_html), 'practice: no notice, no line');
  const k = String(Q[cur.qid].key).replace(/^'/, '');
  // right at 20 s, then 150 s on the item before Next (Easy max 60 s): band from 20 s → not slow; left 30 s → LEFT_THEN_RIGHT
  const evs = [ev(0, cur.qid, 'q_enter', 1), ev(5, cur.qid, 'away', 30000), ev(20, cur.qid, 'select', k), ev(170, cur.qid, 'q_leave')];
  const r = G.call('placementNext', ['FX-T01', st.set_id, { qid: cur.qid, state: { parts: { P: { ans: { [cur.qid]: k }, cur: 0 } }, seq: 3 }, events: evs, ev_from: 0, copy: set.copy }]);
  const row = G.table('Responses').find(x => x.qid === cur.qid && x.set_id === st.set_id);
  check(r.ok && /PL_(FAST|NORMAL)/.test(row.flags) && +row.time_try1_sec === 20 && +row.time_total_sec === 170, 'placement band from the time to the answer (20 s → ' + /PL_(\w+)/.exec(row.flags.split(',').find(f => /PL_(FAST|NORMAL|SLOW)/.test(f)))[1] + ', not SLOW for 170 s on the item)');
  check(/LEFT_THEN_RIGHT/.test(row.flags), 'left 30 s, then right → LEFT_THEN_RIGHT (⚠ for the teacher)');
  G.fresh(); const rep = C.placementReport_(G.ctx.readTable_('Sets').rows.find(x => x.set_id === st.set_id));   // unfinished: the report the teacher opens
  check(rep.items[0].away_flag === true && rep.items[0].away_sec === 30 && rep.pace.away_n === 1, 'placement report: item ⚠ + leave log');
}

(async () => {
  const E = await H.setup();
  const G = () => E.st.gas;
  try {
    const leave = async (p, ms, hidden) => {
      await p.evaluate(h => { if (h) { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); } else window.dispatchEvent(new Event('blur')); }, !!hidden);
      await sleep(ms);
      await p.evaluate(h => { if (h) { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); } else window.dispatchEvent(new Event('focus')); }, !!hidden);
      await sleep(200);
    };
    const aways = p => p.evaluate(() => window.SML.events.filter(e => e.type === 'away').map(e => e.qid + ':' + Math.round(e.value / 1000)));
    const toastOn = p => p.$eval('#toast', e => e.classList.contains('on') ? e.textContent : '');

    console.log('[browser: practice — recorded silently]');
    const { page } = await E.newPage('desktop1280');
    await H.login(page, E.url, 'FX-T01'); await page.waitForSelector('#picker .sm-it');
    await page.click('#picker [data-k="H.B"]'); await page.click('#btn-start');
    await page.waitForSelector('#btn-begin'); await page.click('#btn-begin'); await page.waitForSelector('#qwrap .q.on'); await waitMath(page);
    check(!/leave/i.test(await page.$eval('#v-directions', e => e.innerText).catch(() => '')), 'practice start screen: no line about leaving');
    await leave(page, 1000, false);
    check((await aways(page)).length === 0, 'left 1 s → not recorded');
    await leave(page, 2600, true);
    const a1 = await aways(page);
    check(a1.length === 1 && /:3$|:2$/.test(a1[0]) && !(await toastOn(page)) && !(await page.$('#modal-root.on')), 'left ~2.6 s (tab hidden) → recorded (' + a1[0] + '); no toast, no message');
    await page.click('#tool-calc'); await page.waitForSelector('#calc-panel.on');
    await page.evaluate(() => { const b = document.querySelector('#calc-panel button, #calc-panel [tabindex], #calc-x'); if (b) b.focus(); });
    await leave(page, 2600, false);
    check((await aways(page)).length === 1, 'focus in the calculator → a window blur is not counted');
    await page.click('#calc-x').catch(() => {});
    // answer all, submit
    const Q = {}; G().table('Questions').forEach(r => { Q[r.qid] = r; });
    for (let i = 0; i < 6 && !(await page.$('#v-review.on')); i++) {
      const box = await page.$('#qwrap .q.on'), id = await box.getAttribute('data-qid'), k = String(Q[id].key).replace(/^'/, '');
      const sp = await box.$('.spr-in'); if (sp) { await sp.fill(k); await sp.press('Tab'); } else await (await box.$('.ch-row[data-l="' + k + '"] .ch')).click();
      await sleep(150); await page.click('#btn-next'); await sleep(150);
    }
    await page.click('#btn-next'); await page.waitForSelector('#modal-root.on'); await page.click('#modal-root .btns button:last-child');
    await page.waitForSelector('#score-first');
    check(!/left the window|answering/i.test(await page.$eval('#result-body', e => e.innerText)), 'student result: nothing about leaving');
    E.st.gas.fresh();
    const setRow = E.st.gas.table('Sets').filter(s => s.student_code === 'FX-T01' && s.status === 'submitted').pop();
    check(+setRow.away_n === 1 && setRow.away_at === 'Q1' && setRow.time_answer_min !== '', 'Sheet: Sets away_n 1 · at Q1 · answering ' + setRow.time_answer_min + ' min');

    console.log('[browser: placement — calm note]');
    const g = G(); g.sheets.Settings.rows.forEach(r => { if (r[0] === 'away_flag_sec') r[1] = 2; }); addForms(g);
    g.ctx.publishAssignment('TEACH-FX-9', { kind: 'placement', target: 'st:FX-T03', title: 'Placement test', form: 'auto' }); g.fresh();
    const { page: pp } = await E.newPage('phone');
    await H.login(pp, E.url, 'FX-T03'); await pp.waitForSelector('#placement-card .hz-btn.big'); await pp.click('#placement-card .hz-btn.big');
    await pp.waitForSelector('#v-directions.on #btn-begin');
    check(/This test notes when you leave the test window\./.test(await pp.$eval('#v-directions', e => e.innerText)), 'placement start screen: "This test notes when you leave the test window."');
    await shot(pp, 'pace48_pl_start_phone');
    await pp.click('#v-directions.on #btn-begin'); await pp.waitForSelector('#qwrap .q.on'); await waitMath(pp);
    await leave(pp, 2600, true);
    const tt = await toastOn(pp);
    check(tt === 'You just left the test window. Your teacher can see this.' && !(await pp.$('#modal-root.on')), 'placement, back after 2.6 s: calm toast "' + tt + '" (no modal)');
    const col = await pp.$eval('#toast', e => getComputedStyle(e).backgroundColor);
    check(!/rgb\((2[0-9]{2}), ?([0-9]{1,2}), ?([0-9]{1,2})\)/.test(col), 'toast not red (' + col + ')');
    await shot(pp, 'pace48_pl_toast_phone');
    await sleep(4300);
    check(!(await toastOn(pp)), 'the note hides by itself');
    const box = await pp.$('#qwrap .q.on'), id = await box.getAttribute('data-qid'), k = String(G().table('Questions').find(r => r.qid === id).key).replace(/^'/, '');
    const sp = await box.$('.spr-in'); if (sp) { await sp.fill(k); await sp.press('Tab'); } else await (await box.$('.ch-row[data-l="' + k + '"] .ch')).click();
    await sleep(300); await pp.click('#btn-next'); await pp.waitForSelector('#wq-dot.ok', { timeout: 15000 }); await sleep(300);

    console.log('[teacher view]');
    const { page: tp } = await E.newPage('desktop1280');
    await H.login(tp, E.url, 'TEACH-FX-9'); await tp.waitForSelector('#t-students');
    await tp.click('#t-students [data-prof="FX-T01"]'); await tp.waitForSelector('#t-sets');
    const rowTxt = await tp.$eval('#t-sets', e => e.innerText);
    check(/1×/.test(rowTxt) && /Q1/.test(rowTxt) && /\d+(\.\d)? min/.test(rowTxt) && !/Slow \/ rushed/.test(rowTxt), 'profile → Sets: "Left the window 1× · … · Q1" + the set time (no Slow / rushed column)');
    await tp.$eval('#t-sets', e => e.scrollIntoView({ block: 'center' })); await sleep(200);
    await shot(tp, 'pace48_teacher_profile');
    await tp.click('#t-sets [data-res]'); await tp.waitForSelector('#res-pace');
    const pace = await tp.$eval('#res-pace', e => e.innerText);
    check(/^Time [\d.]+ min · Left the window: 1× · \d+ s · at Q1/.test(pace), 'set result (teacher): "' + pace + '"');
    await shot(tp, 'pace48_teacher_result');
    await tp.click('#res-home'); await tp.waitForSelector('#t-sets'); await tp.click('#t-back'); await tp.waitForSelector('#t-students');
    await tp.click('#t-students [data-prof="FX-T03"]'); await tp.waitForSelector('#t-sets');
    E.st.gas.fresh();
    const plId = E.st.gas.table('Sets').filter(s => s.kind === 'placement' && s.student_code === 'FX-T03').pop().set_id;
    await tp.evaluate(id => window.SMLT && 0, plId);
    const plBtn = await tp.$('[data-plrep]');
    if (plBtn) { await plBtn.click(); }
    else { await tp.evaluate(() => {}); }
    if (!plBtn) {                                                   // unfinished: open the report from the class screen data
      const r = E.st.gas.ctx.placementReport_(E.st.gas.ctx.readTable_('Sets').rows.find(x => x.set_id === plId));
      check(r.items[0].away_flag === true && r.pace.away_n === 1, 'placement (unfinished): item 1 has ⚠ (left ≥ away_flag_sec, then right) — from the server');
    } else {
      await tp.waitForSelector('#pl-items');
      check(/⚠/.test(await tp.$eval('#pl-items', e => e.innerText)), 'placement report: ⚠ on the question');
    }
  } catch (e) { console.error(e); check(false, 'exception: ' + e.message); }
  await E.close();
  process.exit(H.summary() ? 1 : 0);
})();
