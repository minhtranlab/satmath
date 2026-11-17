// #50 (Minh 17 Nov): the teacher goes over a question on the TEST SCREEN (question, choices, Desmos, Reference, annotate,
// Back / Next) with nothing that tells the answer on open — "Student's answer" shows what the student entered, "Show answer"
// fetches the key (+ CB explanation) only then. Level boxes E1…H3 save the teacher's level (Item_Overrides, never the Drive
// files), with Undo; every picker / filter / label / time norm reads it; the Placement forms keep their blueprint.
const { makeGas } = require('./server');
const H = require('./h'); const { check, sleep, shot, waitMath } = H;
const T = 'TEACH-FX-9';
const qsClean = r => { try { const j = JSON.parse(r.res); const q = (j.result || {}).questions; return !q || !/"key"|"rationale_html"|"accepted"/.test(JSON.stringify(q)); } catch (e) { return true; } };
const ev = (t, qid, type, value) => ({ part: 'P', t_ms: t * 1000, qid, type, value: value === undefined ? null : value });
function doSet(G, code, plan, askAt) {                                 // a finished practice set: plan = ['wrong','right',…]
  const Q = {}; G.table('Questions').forEach(r => { Q[r.qid] = r; });
  const key = id => String(Q[id].key).replace(/^'/, ''), wrong = id => Q[id].type === 'spr' ? '999' : ['A', 'B', 'C', 'D'].find(l => l !== key(id));
  G.fresh(); const sp = G.call('startPractice', [code, 'H.B', plan.length]); G.fresh();
  const t = G.call('getSet', [code, sp.set_id, {}]), ans = {}, events = [ev(0, null, 'part_start', 'P')]; let s = 0;
  t.questions.forEach((q, i) => { events.push(ev(s, q.qid, 'q_enter', i + 1)); s += 40; ans[q.qid] = plan[i] === 'right' ? key(q.qid) : wrong(q.qid); events.push(ev(s - 5, q.qid, 'select', ans[q.qid])); events.push(ev(s, q.qid, 'q_leave')); });
  const ask = askAt >= 0 ? { [t.questions[askAt].qid]: 'Why not B?' } : {};
  G.fresh(); G.call('submit', [code, sp.set_id, { state: { v: 1, current_part: 'P', phase: 'review', part_starts: { P: Date.now() - 600000 }, ended: {}, parts: { P: { cur: 0, ans, elim: {}, mark: {}, ask, hl: {} } } }, events, ev_from: 0, copy: t.copy }]);
  G.fresh();
  return { set_id: sp.set_id, qids: t.questions.map(q => q.qid), key, Q };
}

console.log('[server: Item_Overrides — the teacher\'s level is read everywhere]');
{
  const G = makeGas(), C = G.ctx;
  const live = C.readTable_('Batches').rows.find(x => x.batch === 'FX2'); C.updateRow_('Batches', live._row, { live: 'Yes' }); G.fresh();
  const pool = C.livePool_(), hb = pool.filter(r => r.skill === 'H.B'), h = hb.find(r => r.difficulty === 'H');
  check(!!h && C.hasTab_('Item_Overrides'), 'the tab Item_Overrides exists; a Hard H.B item to move: ' + h.code);
  const nM = hb.filter(r => r.difficulty === 'M').length;
  check(/LOGIN/.test((() => { try { G.call('setItemLevel', ['FX-T01', h.qid, 'M', 3, '']); } catch (e) { return String(e.message); } })()), 'a student code cannot change a level');
  G.fresh(); const r1 = G.call('setItemLevel', [T, h.qid, 'M', 3, '']);
  G.fresh(); const rows = G.table('Item_Overrides');
  check(r1.ok && r1.old.difficulty === 'H' && rows.length === 1 && rows[0].difficulty === 'M' && +rows[0].level === 3 && rows[0].old_difficulty === 'H' && rows[0].set_by === 'teacher' && /H\d → M3/.test(rows[0].log),
    'tick M3 on a Hard item → one row (qid, code, M, 3, old H, set_by teacher, log "H… → M3")');
  check(!C.readTable_('Questions').rows.some(r => r.qid === h.qid && r.difficulty !== h.difficulty), 'the Questions tab (from the library) is not edited');
  const q = C.questionRows_().find(r => r.qid === h.qid);
  check(q.difficulty === 'M' && +q.level === 3 && q.cb_difficulty === 'H' && q.overridden, 'questionRows_: M3 with the CB label kept (cb_difficulty H)');
  check(C.livePool_().filter(r => r.skill === 'H.B' && r.difficulty === 'M').length === nM + 1, 'practice / Mixed pool: one more Medium in H.B');
  G.fresh(); const pk = G.call('pickAssignment', [T, { target: 'st:FX-T01', topics: [{ code: 'H.B', n: 40, diffs: 'M' }] }]);
  const got = pk.topics[0].picked.map(x => x.qid);
  check(got.includes(h.qid) && pk.topics[0].picked.find(x => x.qid === h.qid).difficulty === 'M', 'assignment builder, Medium only → the item is picked as Medium');
  G.fresh(); const pkH = G.call('pickAssignment', [T, { target: 'st:FX-T01', topics: [{ code: 'H.B', n: 40, diffs: 'H' }] }]);
  check(!pkH.topics[0].picked.some(x => x.qid === h.qid && x.difficulty === 'H'), 'builder, Hard only → never picked as Hard any more');
  G.fresh(); const tree = G.call('assignmentTree', [T, '']); const hbT = tree.domains.flatMap(d => d.skills).find(s => s.code === 'H.B');
  check(hbT.count.M === nM + 1 && hbT.count.H === hb.filter(r => r.difficulty === 'H').length - 1, 'builder counts E/M/H: ' + JSON.stringify(hbT.count));
  check(C.tagsOf_([h.qid])[h.qid].difficulty === 'M', 'answers recorded from now on: difficulty M (Levels + Responses)');
  const m = C.goMeta_(h.qid), nM3 = C.timeNormFor_(h.type, 'M');
  check(m.difficulty === 'M' && m.level === 3 && m.cb_difficulty === 'H' && m.overridden && m.norm_sec === (nM3 ? nM3.target : null), 'teacher labels + time norm read M (normal time ' + m.norm_sec + ' s)');
  // Undo = the same call with the old level
  G.fresh(); const r2 = G.call('setItemLevel', [T, h.qid, 'H', +h.level || 1, '']); G.fresh();
  const rows2 = G.table('Item_Overrides');
  check(r2.ok && rows2.length === 1 && rows2[0].difficulty === 'H' && rows2[0].old_difficulty === 'M' && String(rows2[0].log).split('\n').length === 2 && C.questionRows_().find(r => r.qid === h.qid).difficulty === 'H',
    'Undo → back to H (still one row per qid, last write wins, history: 2 lines)');
  // QK batch import: rows written by another tool (set_by QK), read the same way
  C.appendObjects_('Item_Overrides', [{ qid: "'" + hb.find(r => r.difficulty === 'M').qid, code: 'x', difficulty: 'E', level: 2, set_by: 'QK', set_at: '2026-11-20' }]); G.fresh();
  const qk = C.questionRows_().find(r => r.qid === hb.find(r => r.difficulty === 'M').qid);
  check(qk.difficulty === 'E' && +qk.level === 2 && qk.cb_difficulty === 'M' && C.questionRows_().filter(r => r.overridden).length === 2, 'a batch row (set_by QK, qid written as text) is read like the teacher\'s');
  // Skill_Profile: a level the skill does not have → saved, with a warning
  const sc = G.table('Questions').find(r => r.skill === 'S.C' || r.skill === 'S.D');
  if (sc) { G.fresh(); const w = G.call('setItemLevel', [T, sc.qid, 'E', 1, '']); check(w.ok && /not offered/.test(w.warn), 'Easy on a ' + sc.skill + ' item (Skill_Profile M,H) → saved + warning'); }
  else check(true, '(no S.C / S.D item in the fixtures — warning tested in the browser)');
}

console.log('[server: payloads — the key only on Show answer]');
{
  const G = makeGas(), C = G.ctx;
  const live = C.readTable_('Batches').rows.find(x => x.batch === 'FX2'); C.updateRow_('Batches', live._row, { live: 'Yes' }); G.fresh();
  const a = doSet(G, 'FX-T01', ['wrong', 'right', 'wrong', 'right', 'right'], 0);
  const tr = G.call('teacherReview', [T, a.set_id]), js = JSON.stringify(tr);
  check(!/"key"|"rationale_html"|"answer"|"status"|"accepted"/.test(JSON.stringify(tr.questions)), 'teacherReview (a set Report): the questions carry no key, no explanation, no student answer, no right/wrong mark (#62: the keys come apart, teacher only)');
  check(tr.questions.filter(q => q.wrong).length === 2 && tr.questions.every(q => q.meta && q.meta.difficulty), '"Wrong only" flag (2 wrong on the first try) + level meta per question');
  G.fresh(); const go = G.call('goOverData', [T, a.qids]), gj = JSON.stringify(go);
  check(!/"key"|"rationale_html"|"answer"|"accepted"/.test(JSON.stringify(go.questions)) && go.questions.length === 5 && go.parts[0].calculator && go.parts[0].reference && go.parts[0].annotate, 'goOverData (What to go over / Grid / Asked / Placement): the test screen content, no key; calculator + Reference + annotate on');
  check(/LOGIN/.test((() => { try { G.call('goOverData', ['FX-T01', a.qids]); } catch (e) { return String(e.message); } })()) && /LOGIN/.test((() => { try { G.call('teacherKey', ['FX-T01', a.qids[0]]); } catch (e) { return String(e.message); } })()), 'students cannot call goOverData / teacherKey');
  G.fresh(); const k = G.call('teacherKey', [T, a.qids[0]]);
  check(k.key.length && String(k.key[0]).toUpperCase() === a.key(a.qids[0]).toUpperCase(), 'teacherKey → the key of that ONE question');
  G.fresh(); const qp = G.call('questionPanel', [T, a.qids[0]]);
  check(!('key' in qp.q) && !('rationale_html' in qp.q), 'questionPanel no longer sends the key');
}

(async () => {
  console.log('[browser: go over from a Report, What to go over, Grid, Asked]');
  const E = await H.setup(); const G = () => E.st.gas;
  try {
    const C = G().ctx;
    const live = C.readTable_('Batches').rows.find(x => x.batch === 'FX2'); C.updateRow_('Batches', live._row, { live: 'Yes' }); G().fresh();
    const a = doSet(G(), 'FX-T01', ['wrong', 'right', 'wrong', 'right', 'right'], 0);
    const { page } = await E.newPage('desktop1280');
    await H.login(page, E.url, T);
    await page.waitForSelector('[data-prof="FX-T01"]');
    await page.$eval('[data-prof="FX-T01"]', e => e.click());
    await page.waitForSelector('[data-res]');
    await page.$eval('[data-res]', e => e.click());
    await page.waitForSelector('#result-body [data-qid]');
    E.st.rpcLog = [];
    await page.$eval('#result-body [data-qid="' + a.qids[2] + '"]', e => e.click());
    await page.waitForSelector('#scr-test.going #go-show'); await waitMath(page);
    let bar = await page.$eval('#scr-test', e => e.innerText);
    check(!(await page.$('#scr-test .ch.rv-key')) && !/Correct answer|✓|✗/.test(bar) && !(await page.$('.ch-row.stu-pick')) && !(await page.$('#scr-test .ch.sel')), 'Report → go over: full test screen, no key, no correct mark, no student answer on open');
    check(await page.$eval('#go-wrong', e => e.checked) && /of 2/.test(await page.$eval('#nav-label', e => e.textContent)), '"Wrong only" ON by default → 2 questions (the wrong ones)');
    check(await page.$eval('#tool-calc', e => !e.classList.contains('hidden')) && await page.$eval('#tool-ref', e => !e.classList.contains('hidden')) && await page.$('#tool-annot'), 'Calculator, Reference, Annotate in the bar');
    check((await page.$$('.go-box')).length === 9 && (await page.$$('.go-box input:checked')).length === 1 && /CB: |Label: /.test(await page.$eval('#view-bar', e => e.innerText)), '9 level boxes, the current one ticked, the original label beside');
    check(E.st.rpcLog.every(qsClean) && !E.st.rpcLog.some(r => r.fn === 'teacherKey'), 'network: the questions carry no key; keys only in the teacher\'s separate map (' + E.st.rpcLog.map(r => r.fn).join(', ') + ')');
    await shot(page, 'go50_report_open');
    await page.click('#go-stu');
    await page.waitForFunction(() => /Test Student|FX|: /.test(document.querySelector('#go-strip').innerText) && !/Loading/.test(document.querySelector('#go-strip').innerText));
    check(/\d+ s/.test(await page.$eval('#go-strip', e => e.innerText)) && await page.$('.ch-row.stu-pick') && !/✓|✗/.test(await page.$eval('#go-strip', e => e.innerText)), 'Student\'s answer → the student\'s entry + time, marked on the choice (still no ✓/✗)');
    check(!E.st.rpcLog.some(r => r.fn === 'teacherKey'), 'still no key fetched');
    await page.click('#go-show'); await page.waitForSelector('.go-key');
    check(!E.st.rpcLog.some(r => r.fn === 'teacherKey') && await page.$('#scr-test .q.on .ch.rv-key') && /✗/.test(await page.$eval('#go-strip', e => e.innerText)), 'Show answer → at once from memory (#62, no call), the key highlighted, ✗ on the student\'s try');
    await shot(page, 'go50_report_shown');
    // a choice is clickable for the teacher
    const rowsL = await page.$$('#scr-test .q.on .ch-row'); if (rowsL.length) { await rowsL[0].$eval('.ch', e => e.click()); check(await rowsL[0].$eval('.ch', e => e.classList.contains('sel')), 'the teacher can click a choice'); }
    // level boxes
    const cur = await page.$eval('.go-box input:checked', e => e.getAttribute('data-lv')), to = cur === 'M3' ? 'E2' : 'M3';
    await page.click('.go-box input[data-lv="' + to + '"]');
    await page.waitForFunction(t => /Saved: .. → /.test(document.querySelector('#toast').textContent) && document.querySelector('#toast').textContent.indexOf(t) >= 0, to);
    check(await page.$eval('.go-box input[data-lv="' + to + '"]', e => e.checked) && (await page.$$('.go-box input:checked')).length === 1, 'tick ' + to + ' → ticked at once, toast "Saved: ' + cur + ' → ' + to + '"');
    await page.waitForFunction(() => window.SMLX && SMLX.WQ.list.length === 0);
    G().fresh();
    let ov = G().table('Item_Overrides').find(r => String(r.qid).replace(/^'/, '') === a.qids[2]);
    check(ov && ov.difficulty === to[0] && +ov.level === +to[1], 'saved in Item_Overrides: ' + (ov ? ov.difficulty + ov.level : '—'));
    await shot(page, 'go50_level_saved');
    await page.click('#go-undo');
    await page.waitForFunction(() => /Undone/.test(document.querySelector('#toast').textContent));
    await page.waitForFunction(() => window.SMLX && SMLX.WQ.list.length === 0);
    G().fresh(); ov = G().table('Item_Overrides').find(r => String(r.qid).replace(/^'/, '') === a.qids[2]);
    check(ov.difficulty + ov.level === cur && await page.$eval('.go-box input[data-lv="' + cur + '"]', e => e.checked), 'Undo → back to ' + cur + ' (screen + Sheet)');
    // drawer
    check(await page.$eval('#go-drawer', e => !e.classList.contains('on')), 'Details drawer closed by default');
    await page.click('#go-det'); await page.waitForSelector('#go-dr-body .t-ps'); await sleep(300);
    check(/Tries:/.test(await page.$eval('#go-dr-body', e => e.innerText)) && /s to the answer/.test(await page.$eval('#go-dr-body', e => e.innerText)) && await page.$('#go-dr-body [data-tag="0"]') && await page.$('#go-dr-body [data-save="0"]'), 'Details: tries, time, mistake type + note + Save');
    await shot(page, 'go50_details');
    await page.click('#go-dr-x');
    // Back / Next inside the set; Wrong only off → all 5
    await page.click('#go-wrong'); await page.waitForFunction(() => /of 5/.test(document.querySelector('#nav-label').textContent));
    check(true, 'Wrong only off → all 5 questions');
    await page.click('#btn-next'); await page.waitForSelector('#go-show');
    check(!(await page.$('#scr-test .q.on .ch.rv-key')), 'Next question: its key not shown (each question separately)');
    await page.click('#btn-view-back'); await page.waitForSelector('#scr-result.on');
    check(true, '"Back to report" → the Report');

    console.log('What to go over / Grid / Asked');
    await page.click('#res-home'); await page.waitForSelector('#scr-teacher.on');
    await page.$eval('[data-prof="FX-T01"]', e => e.click()).catch(() => {});
    await page.waitForSelector('[data-sgo]');
    await page.$eval('[data-sgo]', e => e.click());
    await page.waitForSelector('.t-row');
    E.st.rpcLog = [];
    await page.$eval('.t-row', e => e.click());
    await page.waitForSelector('#scr-test.going #go-show'); await waitMath(page);
    check(!(await page.$('#scr-test .ch.rv-key')) && E.st.rpcLog.some(r => r.fn === 'goOverData') && E.st.rpcLog.every(qsClean), 'What to go over → test screen; no key on screen or in the questions');
    await page.click('#btn-view-back'); await page.waitForSelector('#scr-teacher.on .t-row');
    await page.click('[data-tab="grid"]'); await page.waitForSelector('.t-grid tr[data-q]');
    E.st.rpcLog = [];
    await page.$eval('.t-grid tr[data-q]', e => e.click());
    await page.waitForSelector('#scr-test.going #go-show');
    check(!(await page.$('#scr-test .ch.rv-key')) && E.st.rpcLog.every(qsClean), 'Grid → test screen, no key on screen');
    await page.click('#btn-view-back'); await page.waitForSelector('#scr-teacher.on .t-grid');
    check(true, '"Back to class" → the Grid again');
    await page.click('.t-nav [data-go="asks"]'); await page.waitForSelector('[data-open]');
    await page.click('[data-open]'); await page.waitForSelector('#scr-test.going #go-show');
    check(/Back to Asked/.test(await page.$eval('#btn-view-back', e => e.textContent)) && !(await page.$('#scr-test .ch.rv-key')), 'Asked → Open → test screen ("Back to Asked")');
    await page.click('#go-stu'); await page.waitForFunction(() => !/Loading/.test(document.querySelector('#go-strip').innerText) && document.querySelector('#go-strip').innerText.length > 3);
    check(/\d+ s/.test(await page.$eval('#go-strip', e => e.innerText)), 'Asked: Student\'s answer shows the student\'s try');
    await page.click('#go-det'); await page.waitForSelector('#go-dr-body .t-pask');
    check(/Why not B\?/.test(await page.$eval('#go-dr-body .t-pask', e => e.innerText)), 'Asked: the student\'s note in Details (with Resolve)');
    await page.click('#go-dr-x');
    await page.click('#btn-view-back'); await page.waitForSelector('#scr-teacher.on [data-open]');

    console.log('iPad');
    for (const dev of ['ipad', 'ipad-portrait']) {
      const ip = (await E.newPage(dev)).page;
      await H.login(ip, E.url, T); await ip.waitForSelector('[data-prof="FX-T01"]');
      await ip.$eval('[data-prof="FX-T01"]', e => e.click()); await ip.waitForSelector('[data-res]');
      await ip.$eval('[data-res]', e => e.click()); await ip.waitForSelector('#result-body [data-qid]');
      await ip.$eval('#result-body [data-qid="' + a.qids[0] + '"]', e => e.click());
      await ip.waitForSelector('#scr-test.going #go-show'); await waitMath(ip);
      await ip.tap('#go-stu'); await ip.waitForFunction(() => !/Loading/.test(document.querySelector('#go-strip').innerText) && document.querySelector('#go-strip').innerText.length > 3);
      await ip.tap('#go-show'); await ip.waitForSelector('.go-key');
      const fit = await ip.evaluate(() => { const b = document.querySelector('#fbar').getBoundingClientRect(), v = document.querySelector('#view-bar').getBoundingClientRect();
        return document.documentElement.scrollWidth <= innerWidth + 1 && b.bottom <= innerHeight + 1 && v.right <= innerWidth + 1; });
      check(fit, dev + ': bars fit the screen, no sideways scroll; taps work');
      await shot(ip, 'go50_' + dev.replace('-', '_'));
      await ip.tap('#go-det'); await sleep(400); await shot(ip, 'go50_' + dev.replace('-', '_') + '_details');
      await ip.context().close();
    }
    H.englishOnly(E);
  } catch (e) { console.error(e); check(false, 'exception: ' + e.message); }
  await E.close();
  process.exit(H.summary() ? 1 : 0);
})();
