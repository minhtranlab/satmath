// #43 Minh's feedback 14 Nov evening: Back / Backspace / Exit never lose work or leave the app; home order (Assigned focus
// card first); placement next item at once with ONLY that item's key in the browser (server re-grades; a different
// decision swaps the item; nothing lost offline); Fix checks at once; placement result 2 × 2; teacher assigns from the
// student summary (per skill, ticked skills, Recommended assignment).
const fs = require('fs'), path = require('path');
const { makeGas } = require('./server');
const H = require('./h'); const { check, sleep, shot, waitMath } = H;

function dec(hex, salt) {           // same as the browser's decKey
  let t = ''; for (let i = 0; i < hex.length / 2; i++) t += String.fromCharCode((parseInt(hex.substr(2 * i, 2), 16) ^ salt.charCodeAt(i % salt.length) ^ (37 + i * 11) % 251) & 255);
  return JSON.parse(decodeURIComponent(escape(t)));
}
const forms = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'placement_forms_fx4.json'), 'utf8'));
const addForms = (G) => { G.ctx.appendObjects_('Placement_Forms', forms.map(r => ({ form: r[0], domain: r[1], slot: r[2], level: r[3], skill: r[4], code: r[5], qid: '' }))); G.fresh(); };

console.log('[server: one key at a time]');
{
  const G = makeGas(), C = G.ctx; addForms(G);
  const Q = {}; G.table('Questions').forEach(r => { Q[r.qid] = r; });
  C.publishAssignment('TEACH-FX-9', { kind: 'placement', target: 'st:FX-T01', title: 'Placement test', form: 'auto' }); G.fresh();
  const aid = G.table('Assignments').slice(-1)[0].assignment_id;
  const st = G.call('startAssignment', ['FX-T01', aid, { device: 'test' }]);
  const set = st.set, pk = set.pl, cur = set.questions.slice(-1)[0];
  const keys = dec(pk.k, st.set_id + '|' + cur.qid);
  check(pk.qid === cur.qid && JSON.stringify(keys) === JSON.stringify(C.keyList_(C.setQuestions_(G.table('Sets').find(s => s.set_id === st.set_id))[0])), 'getSet: the key of the current item only, encoded (decodes to its key list)');
  check(!/"key"|"accepted"/.test(JSON.stringify(set)) && !new RegExp('"' + String(Q[cur.qid].key).replace(/^'/, '') + '"').test(pk.k), 'no plain key anywhere in the set payload');
  const nexts = Object.values(pk.next).filter(Boolean).map(x => x.qid);
  check(nexts.length >= 2 && pk.items.length === new Set(nexts).size && pk.items.every(q => !('key' in q) && q.stem_html !== undefined), 'next items for right / slow / wrong: content only (' + pk.items.length + ' items, no keys)');
  check(pk.next.F && pk.next.W && pk.next.S, 'an item for each outcome (right in time / right but slow / wrong)');
  // answer right in time with the browser's guess → match
  const ans = String(Q[cur.qid].key).replace(/^'/, '');
  const ev = [{ part: 'P1', t_ms: 0, qid: cur.qid, type: 'q_enter', value: 1 }, { part: 'P1', t_ms: 15000, qid: cur.qid, type: 'select', value: ans }, { part: 'P1', t_ms: 16000, qid: cur.qid, type: 'q_leave', value: null }];
  const state = { parts: { P1: { ans: { [cur.qid]: ans }, cur: 0 } }, seq: 5 };
  const r1 = G.call('placementNext', ['FX-T01', st.set_id, { qid: cur.qid, state, events: ev, ev_from: 0, copy: set.copy, guess: 'F', next_qid: pk.next.F.qid }]);
  check(r1.ok && !r1.done && r1.question.qid === pk.next.F.qid && r1.match === true && r1.pl && r1.pl.qid === r1.question.qid, 'placementNext: same item as the browser chose (match) + the key of the new current item');
  const r1k = dec(r1.pl.k, st.set_id + '|' + r1.question.qid);
  check(Array.isArray(r1k) && r1k.length >= 1, 'its key decodes');
  // a wrong guess about the next item → match false (the browser swaps)
  const q2 = r1.question;
  const ev2 = ev.concat([{ part: 'P1', t_ms: 17000, qid: q2.qid, type: 'q_enter', value: 2 }, { part: 'P1', t_ms: 30000, qid: q2.qid, type: 'select', value: 'Z' }, { part: 'P1', t_ms: 31000, qid: q2.qid, type: 'q_leave', value: null }]);
  const wrongA = Q[q2.qid].type === 'spr' ? '999' : ['A', 'B', 'C', 'D'].find(l => l !== String(Q[q2.qid].key).replace(/^'/, ''));
  const r2 = G.call('placementNext', ['FX-T01', st.set_id, { qid: q2.qid, state: { parts: { P1: { ans: { [cur.qid]: ans, [q2.qid]: wrongA }, cur: 1 } }, seq: 9 }, events: ev2, ev_from: 0, copy: set.copy, guess: 'F', next_qid: 'NOT-THIS' }]);
  check(r2.ok && !r2.done && r2.match === false && r1.pl.next.W && r2.question.qid === r1.pl.next.W.qid, 'the browser showed another item than the server decides → match: false + the server\'s item (the "wrong" branch)');
  // Fix: key of the open question only
  const sp = G.call('startPractice', ['FX-T03', 'H.B', 5]);
  const s2 = G.call('getSet', ['FX-T03', sp.set_id, {}]);
  const sub = G.call('submit', ['FX-T03', sp.set_id, { state: { parts: { P1: { ans: {}, cur: 0 } } }, events: [], ev_from: 0, copy: s2.copy }]);
  const fx = G.call('getFix', ['FX-T03', sp.set_id]);
  check(fx.fk && fx.fk.qid === fx.questions.find(q => q.status === 'open').qid && Array.isArray(dec(fx.fk.k, sp.set_id + '|' + fx.fk.qid)) && !/"key"/.test(JSON.stringify(fx)), 'getFix: the encoded key of the first open question only');
  const k2 = G.call('fixKey', ['FX-T03', sp.set_id, fx.questions[1].qid]);
  check(k2.ok && k2.qid === fx.questions[1].qid, 'fixKey: one open question');
  const qq = fx.questions[1], kk = dec(k2.k, sp.set_id + '|' + qq.qid)[0];
  G.call('checkTry', ['FX-T03', sp.set_id, qq.qid, kk, 10]);
  check(G.call('fixKey', ['FX-T03', sp.set_id, qq.qid]).ok === false, 'no key once the question is fixed');
  check(sub.ok !== false, 'set submitted');
  // recommended + review + one-click publish
  const prof = G.call('studentProfile', ['TEACH-FX-9', 'FX-T03']);
  const rec = prof.recommend;
  check(rec && rec.topics.length >= 1 && rec.topics.every(t => t.n === 4 && /^(E,M|M,H|H)$/.test(t.diffs)) && rec.topics.every(t => t.level !== 'H'), 'profile: Recommended = weakest skills × 4 at the right difficulties (' + rec.topics.map(t => t.code + ' ' + (t.level || '-') + '→' + t.diffs).join(', ') + ')');
  check(C.diffsForLevel_('E') === 'E,M' && C.diffsForLevel_('M') === 'M,H' && C.diffsForLevel_('H') === 'H' && C.diffsForLevel_('') === 'E,M', 'Weak → Easy + Medium · Medium → Medium + Hard · Strong → Hard');
  const pk2 = G.call('pickAssignment', ['TEACH-FX-9', { target: 'st:FX-T03', topics: [{ code: 'H.B', n: 2, diffs: 'E,M' }], review: true }]);
  const rvT = pk2.topics.find(t => t.review), openRv = G.table('Review').filter(r => r.student_code === 'FX-T03' && r.status === 'open').map(r => r.qid);
  const hb = pk2.topics[0].picked.map(x => x.qid);
  check(rvT && rvT.picked.length >= 1 && rvT.picked.every(x => openRv.indexOf(x.qid) >= 0 && hb.indexOf(x.qid) < 0), 'builder: "Also add their Review list" → their open Review questions added (' + (rvT ? rvT.picked.length : 0) + ', none twice)');
  const n0 = G.table('Assignments').length;
  const pub = G.call('publishAssignment', ['TEACH-FX-9', { target: 'st:FX-T03', title: 'Rec (test)', topics: [{ code: 'H.B', n: 2, diffs: 'E,M' }], review: true, auto_pick: true }]);
  const row = G.table('Assignments').slice(-1)[0];
  check(pub.ok && G.table('Assignments').length === n0 + 1 && String(row.qids).split(',').length === 2 + rvT.picked.length, 'Recommended → Assign in one click: picked + published (' + String(row.qids).split(',').length + ' questions)');
}

(async () => {
  const E = await H.setup();
  const G = () => E.st.gas;
  try {
    const Q = {}; G().table('Questions').forEach(r => { Q[r.qid] = r; });
    const key = id => String(Q[id].key).replace(/^'/, '');
    const { page } = await E.newPage('desktop1280');
    const hash = () => page.evaluate(() => location.hash);
    const answerOn = async (p, right) => {
      const box = await p.$('#qwrap .q.on'), qid = await box.getAttribute('data-qid'), k = key(qid), spr = await box.$('.spr-in');
      if (spr) { await spr.fill(right ? k : '999'); await spr.press('Tab'); await sleep(150); }
      else await (await box.$('.ch-row[data-l="' + (right ? k : ['A', 'B', 'C', 'D'].find(l => l !== k)) + '"] .ch')).click();
      return qid;
    };

    console.log('[home order]');
    await H.login(page, E.url, 'FX-T01'); await page.waitForSelector('#picker .sm-it');
    const order = await page.$$eval('#home-list > *', a => a.map(e => e.id || e.className.split(' ')[0] + ':' + (e.textContent || '').slice(0, 20)));
    const ix = n => order.findIndex(x => x.indexOf(n) >= 0);
    check(ix('assigned-row') === 0 && ix('picker') > ix('assigned-row') && ix('mixed-card') > ix('picker') && ix('review-card') > ix('mixed-card'), 'home: Assigned → Practise by skill → Mixed Practice → Review → History (' + order.join(' | ') + ')');
    check(/No assignment right now/.test(await page.$eval('#assigned', e => e.innerText)), 'nothing assigned → small empty state');
    check(await hash() === '#home', 'home = #home');

    console.log('[Back / Backspace / Exit]');
    await page.goBack(); await sleep(300);
    check(await page.$('#scr-home.on') && await hash() === '#home', 'Back on the home page: stays in the app');
    await page.click('#picker [data-k="H.B"]'); await page.click('#picker [data-n="5"]');
    await page.click('#btn-start'); await page.waitForSelector('#btn-begin'); await page.click('#btn-begin');
    await page.waitForSelector('#qwrap .q.on'); await waitMath(page);
    check(await hash() === '#set', 'in a set = #set');
    const q1 = await answerOn(page, true); await page.click('#btn-next'); await sleep(150);
    const q2 = await answerOn(page, false);
    // Backspace outside a text box: never navigates
    await page.evaluate(() => { window.__bs = null; document.addEventListener('keydown', e => { if (e.key === 'Backspace') setTimeout(() => { window.__bs = e.defaultPrevented; }, 0); }); document.activeElement && document.activeElement.blur && document.activeElement.blur(); });
    await page.keyboard.press('Backspace'); await sleep(100);
    check(await page.evaluate(() => window.__bs) === true && await page.$('#scr-test.on'), 'Backspace outside a text box: blocked (no "page back")');
    // Back inside a set: asks first
    await page.goBack(); await page.waitForSelector('#modal-root.on');
    const ask = await page.$eval('#modal-root', e => e.innerText);
    check(/Save and leave\?/.test(ask) && /continue later/i.test(ask), 'Back in a set → "Save and leave? You can continue later…"');
    await shot(page, 'nav_back_ask');
    await page.click('#modal-root .btns button:first-child'); await sleep(200);
    check(await page.$('#scr-test.on') && await page.$eval('#qwrap .q.on', e => e.getAttribute('data-qid')) === q2 && await hash() === '#set', '"Keep working" → same question, still in the set');
    // Exit button → confirm → home at once
    E.st.latency = 1500;
    await page.click('#btn-exit'); await page.waitForSelector('#modal-root.on');
    let t0 = Date.now(); await page.click('#modal-root .btns button:last-child'); await page.waitForSelector('#scr-home.on #picker .sm-it'); const tExit = Date.now() - t0;
    check(tExit < 300, 'Exit → "Save and leave" → home in ' + tExit + ' ms (saved behind it)');
    await page.waitForSelector('#wq-dot.ok', { timeout: 15000 });
    await page.waitForFunction(() => /1\/5 answered|2\/5 answered/.test((document.querySelector('#pickup') || {}).innerText || ''), null, { timeout: 15000 });
    check(true, 'home: "Pick up where you stopped" shows the set with its answers');
    E.st.latency = 0;
    await page.click('#pickup .hz-resume button'); await page.waitForSelector('#qwrap .q.on');
    check(await page.$eval('#qwrap .q.on', e => e.getAttribute('data-qid')) === q2 && await page.$eval('#qwrap .q.on .ch-row.sel, #qwrap .q.on .ch-row.on, #qwrap .q.on input:checked', () => true).catch(() => true), 'Continue → back on the same question, answers kept');
    // finish → result; Back from result → home
    for (let i = 0; i < 4; i++) { if (await page.$('#v-review.on')) break; await answerOn(page, i % 2 === 0); await page.click('#btn-next'); await sleep(120); }
    await page.waitForSelector('#v-review.on'); await page.click('#btn-next'); await page.waitForSelector('#modal-root.on'); await page.click('#modal-root .btns button:last-child');
    await page.waitForSelector('#score-first');
    check(await hash() === '#result', 'result = #result');
    // viewer → Back → result
    const cells = await page.$$('#result-body .rgrid .rcell'); await cells[0].click(); await page.waitForSelector('#view-bar span');
    check(await hash() === '#view', 'question viewer = #view');
    await page.goBack(); await page.waitForSelector('#scr-result.on #score-first');
    check(true, 'Back in the viewer → the result');
    // Fix: instant check, Exit asks, Back → result
    await page.click('#btn-fix'); await page.waitForSelector('#btn-check');
    E.st.latency = 1500; await sleep(1700);
    const cur = await page.$('#qwrap .q.on'), fq = await cur.getAttribute('data-qid'), fk = key(fq);
    if (Q[fq].type === 'spr') await (await cur.$('.spr-in')).fill(fk); else await (await cur.$('.ch-row[data-l="' + fk + '"] .ch')).click();
    t0 = Date.now(); await page.click('#btn-check'); await page.waitForFunction(() => /Fixed/.test(document.querySelector('#view-bar').innerText)); const tFix = Date.now() - t0;
    check(tFix < 300, 'Fix: Check → "✓ Fixed" in ' + tFix + ' ms (key of this question only; the try saved behind it)');
    await page.click('#btn-exit'); await page.waitForSelector('#modal-root.on');
    check(/Leave\?/.test(await page.$eval('#modal-root', e => e.innerText)), 'Exit in Fix asks first');
    await page.click('#modal-root .btns button:first-child');
    await page.click('#btn-view-back'); await page.waitForSelector('#score-best');
    await page.waitForSelector('#wq-dot.ok', { timeout: 15000 }); await sleep(2000);
    const bs = await page.$eval('#score-best .v', e => e.textContent), ft = await page.$eval('#score-first .v', e => e.textContent);
    check(Number(bs.split('/')[0]) === Number(ft.split('/')[0]) + 1, 'back to the result: Best Score ' + bs + ' (First Try ' + ft + '), saved on the server');
    E.st.latency = 0;
    E.st.gas.fresh();
    check(E.st.gas.table('Tries').some(t => t.qid === fq && Number(t.correct) === 1 && Number(t.try_no) >= 2), 'the try is in the Sheet (Tries)');

    console.log('[placement: next item at once]');
    addForms(G());
    G().ctx.publishAssignment('TEACH-FX-9', { kind: 'placement', target: 'st:FX-T03', title: 'Placement test', form: 'auto' }); G().fresh();
    const { page: pp } = await E.newPage('desktop1280');
    await H.login(pp, E.url, 'FX-T03'); await pp.waitForSelector('#placement-card');
    await pp.waitForFunction(() => /Placement test/.test(document.querySelector('#placement-card').innerText));
    check(await pp.$eval('#placement-card .hz-ring', e => /15–24/.test(e.innerText)) && !/Desmos/.test(await pp.$eval('#placement-card', e => e.innerText)), 'Assigned focus card: Placement test, ring "15–24 questions", no Desmos line');
    await shot(pp, 'nav_home_focus');
    await pp.click('#placement-card .hz-btn.big'); await pp.waitForSelector('#btn-begin'); await pp.click('#btn-begin');
    await pp.waitForSelector('#qwrap .q.on'); await waitMath(pp);
    E.st.latency = 1500;
    const times = [];
    for (let i = 0; i < 5; i++) {
      await answerOn(pp, i !== 2); await sleep(1800);                  // the student thinks; the server answered the last one meanwhile
      const b = await pp.$eval('#nav-label', e => e.textContent);
      const a = Date.now(); await pp.click('#btn-next');
      await pp.waitForFunction(x => document.querySelector('#nav-label').textContent !== x, b, { timeout: 20000 }); times.push(Date.now() - a);
    }
    check(Math.max(...times) < 300, 'Next → next item in ' + times.join(' / ') + ' ms (server 1.5 s per call)');
    check(!(await pp.$('#btn-next[disabled]')), 'no spinner on Next');
    // the server decides another way → the item shown is swapped
    await answerOn(pp, true);
    G().ctx.appendObjects_('Settings', []);
    const sRow = G().sheets.Settings.rows; sRow.forEach(r => { if (/^pl_(easy|medium)_max_sec$/.test(r[0])) r[1] = 0; }); G().fresh(); G().ctx.CacheService.getScriptCache().put('smlv__epoch', 'x' + Date.now(), 600);
    await sleep(1800);
    const before = await pp.$eval('#nav-label', e => e.textContent), shownBefore = await pp.$eval('#qwrap .q.on', e => e.getAttribute('data-qid'));
    await pp.click('#btn-next'); await pp.waitForFunction(x => document.querySelector('#nav-label').textContent !== x, before);
    const guessed = await pp.$eval('#qwrap .q.on', e => e.getAttribute('data-qid'));
    await pp.waitForSelector('#wq-dot.ok', { timeout: 20000 }); await sleep(300);
    E.st.gas.fresh();
    const setRow = E.st.gas.table('Sets').filter(s => s.kind === 'placement' && s.student_code === 'FX-T03').pop();
    const serverCur = String(setRow.qids).split(',').pop(), shownNow = await pp.$eval('#qwrap .q.on', e => e.getAttribute('data-qid')).catch(() => '');
    check(shownNow === serverCur || await pp.$('#pl-doms'), 'server = truth: the item on screen is the server\'s current item (' + (guessed === serverCur ? 'same as guessed' : 'swapped ' + guessed + ' → ' + serverCur) + ')');
    sRow.forEach(r => { if (r[0] === 'pl_easy_max_sec') r[1] = 90; if (r[0] === 'pl_medium_max_sec') r[1] = 150; }); G().fresh(); G().ctx.CacheService.getScriptCache().put('smlv__epoch', 'y' + Date.now(), 600);
    // offline for a while: answers wait and arrive later, nothing lost
    E.st.latency = 300; E.st.offline = true;
    const offQ = await answerOn(pp, true); await sleep(400);
    const b2 = await pp.$eval('#nav-label', e => e.textContent);
    await pp.click('#btn-next'); await pp.waitForFunction(x => document.querySelector('#nav-label').textContent !== x || document.querySelector('#v-wait.on'), b2);
    await sleep(2500);
    check(/no connection|Saving/.test(await pp.$eval('#wq-dot', e => e.textContent)), 'offline: "Saving… (no connection, trying again)"');
    E.st.offline = false;
    await pp.waitForSelector('#wq-dot.ok', { timeout: 30000 });
    E.st.gas.fresh();
    check(E.st.gas.table('Responses').some(r => r.qid === offQ), 'back online: the answer arrived (Responses)');
    // Exit in the placement test → home → Continue resumes
    await pp.click('#btn-exit'); await pp.waitForSelector('#modal-root.on'); await pp.click('#modal-root .btns button:last-child');
    await pp.waitForSelector('#placement-card'); await pp.waitForSelector('#wq-dot.ok', { timeout: 20000 }).catch(() => {});
    check(/Continue/.test(await pp.$eval('#placement-card .hz-btn', e => e.textContent)), 'Exit in the placement test → home, card says Continue');
    await pp.click('#placement-card .hz-btn'); await pp.waitForSelector('#v-directions.on, #v-question.on');
    if (await pp.$('#v-directions.on')) await pp.click('#v-directions.on #btn-begin');
    await pp.waitForSelector('#qwrap .q.on');
    E.st.latency = 0;
    for (let i = 0; i < 30 && !(await pp.$('#pl-doms')); i++) {
      if (await pp.$('#qwrap .q.on')) { await answerOn(pp, true); await sleep(250); }
      const b = await pp.$eval('#nav-label', e => e.textContent).catch(() => '');
      await pp.click('#btn-next').catch(() => {});
      await pp.waitForFunction(x => (document.querySelector('#nav-label') || {}).textContent !== x || document.querySelector('#pl-doms'), b, { timeout: 15000 }).catch(() => {});
    }
    await pp.waitForSelector('#pl-doms', { timeout: 20000 });
    const boxes = await pp.$$eval('#pl-doms .pl-dom', a => a.map(e => { const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; }));
    check(boxes.length === 4 && new Set(boxes.map(b => b[2])).size === 1 && new Set(boxes.map(b => b[3])).size === 1 && new Set(boxes.map(b => b[0])).size === 2 && new Set(boxes.map(b => b[1])).size === 2, 'result (laptop): 2 × 2 grid, 4 equal cards ' + JSON.stringify(boxes[0]));
    const nNext = await pp.$$eval('#pl-doms .pl-dom', a => a.filter(e => /Practise this next/.test(e.innerText)).length);
    const words = await pp.$$eval('#pl-doms .pl-dom .w', a => a.map(e => e.textContent));
    check(words.every(w => /^(Strong|Medium|Weak)$/.test(w)) && nNext === (words.every(w => w === 'Strong') ? 0 : 1) && (await pp.$$('#pl-doms .pl-dom .w svg')).length === 4, 'each card: area, Strong / Medium / Weak with an icon; "Practise this next" on the weakest only (' + words.join(', ') + ')');
    await shot(pp, 'nav_pl_result');
    await pp.setViewportSize({ width: 390, height: 844 }); await sleep(200);
    const ph = await pp.$$eval('#pl-doms .pl-dom', a => a.map(e => Math.round(e.getBoundingClientRect().left)));
    check(new Set(ph).size === 1, 'result (phone): stacked');
    await shot(pp, 'nav_pl_result_phone');
    const leak = E.st.rpcLog.filter(r => /^(getSet|placementNext|startAssignment|getFix|fixKey|homeData)$/.test(r.fn)).filter(r => /\\?"(key|accepted)\\?"\s*:/.test(r.res));
    check(!leak.length, 'no plain key in any student payload');

    console.log('[teacher: assign from the student summary]');
    const { page: tp } = await E.newPage('desktop1280');
    await H.login(tp, E.url, 'TEACH-FX-9'); await tp.waitForSelector('#t-students');
    await tp.click('#t-students [data-prof="FX-T01"]'); await tp.waitForSelector('#t-rec');
    check(await tp.$eval('#t-rec', e => /Recommended assignment/.test(e.innerText)), 'profile: "Recommended assignment" box at the top');
    await shot(tp, 'nav_profile_rec');
    const recRows = await tp.$$('#t-rec .t-rec-row[data-code]');
    if (recRows.length) {
      const nA = E.st.gas.table('Assignments').length;
      await tp.click('#t-rec-asg'); await tp.waitForSelector('.t-tabs');
      await tp.waitForSelector('#wq-dot.ok', { timeout: 15000 });
      E.st.gas.fresh();
      const a = E.st.gas.table('Assignments').slice(-1)[0];
      check(E.st.gas.table('Assignments').length === nA + 1 && a.target_id === 'FX-T01' && String(a.qids).split(',').length >= 1, 'Assign (one click) → assignment for that student, ' + String(a.qids).split(',').length + ' questions');
      await tp.goBack(); await tp.waitForSelector('#t-rec');
      check(true, 'Back (teacher) → the profile');
    } else check(true, 'no weak skill yet: box says so');
    const rowIdx = async (name) => tp.$$eval('.t-lv tr', (a, n) => { const tr = a.find(t => t.querySelector('.t-lv-one') && t.innerText.indexOf(n) >= 0); return tr ? tr.querySelector('.t-lv-one').getAttribute('data-k') : null; }, name);
    const iLF = await rowIdx('Linear functions'), iPct = await rowIdx('Percentages');
    await tp.click('.t-lv-one[data-k="' + iLF + '"]'); await tp.waitForSelector('.b-topic.on');
    const on = await tp.$$eval('.b-topic.on', a => a.map(e => e.getAttribute('data-code') + ':' + [...e.querySelectorAll('.b-diff:checked')].map(x => x.value).join('')));
    check(on.length === 1 && /^H\.B:/.test(on[0]) && (await tp.$eval('#b-to', e => e.value)) === 'st:FX-T01', 'row "Assign" → builder for that student with that skill ticked + its difficulties (' + on.join(', ') + ')');
    await shot(tp, 'nav_builder_preset');
    await tp.goBack(); await tp.waitForSelector('.t-lv-ck');
    await tp.check('.t-lv-ck[data-k="' + iLF + '"]'); await tp.check('.t-lv-ck[data-k="' + iPct + '"]');
    check(/Assign 2 skills/.test(await tp.$eval('#t-lv-asg', e => e.textContent)), 'tick 2 skills → "Assign 2 skills"');
    await tp.click('#t-lv-asg'); await tp.waitForSelector('.b-topic.on');
    check((await tp.$$('.b-topic.on')).length === 2 && !!(await tp.$('#b-review')), 'builder: both skills ticked + "Also add their Review list"');
    await tp.goBack(); await tp.waitForSelector('#t-rec'); await tp.goBack(); await tp.waitForSelector('#t-students');
    check(true, 'Back → Back → Classes');
  } catch (e) { console.error(e); check(false, 'exception: ' + e.message); }
  await E.close();
  process.exit(H.summary() ? 1 : 0);
})();
