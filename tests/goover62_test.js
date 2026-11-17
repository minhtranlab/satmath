// #62 (Minh 17 Nov, after going over a set with a student): teacher tools in the go-over screen — Notes pad (MathQuill math
// inside text lines, colours, highlight, bullets, one pad per set kept in this browser until Clear / End & clear, Copy =
// rich HTML with math images + plain text), a Pen on the question (4 colours, 2 widths, eraser, Undo, Clear; gone on the
// next question), and an instant "Show answer" (the set's keys come with the teacher's go-over payload, never rendered).
const { makeGas } = require('./server');
const H = require('./h'); const { check, sleep, shot, waitMath } = H;
const T = 'TEACH-FX-9';
const ev = (t, qid, type, value) => ({ part: 'P', t_ms: t * 1000, qid, type, value: value === undefined ? null : value });
function doSet(G, code, plan) {
  const Q = {}; G.table('Questions').forEach(r => { Q[r.qid] = r; });
  const key = id => String(Q[id].key).replace(/^'/, ''), wrong = id => Q[id].type === 'spr' ? '999' : ['A', 'B', 'C', 'D'].find(l => l !== key(id));
  G.fresh(); const sp = G.call('startPractice', [code, 'H.B', plan.length]); G.fresh();
  const t = G.call('getSet', [code, sp.set_id, {}]), ans = {}, events = [ev(0, null, 'part_start', 'P')]; let s = 0;
  t.questions.forEach((q, i) => { events.push(ev(s, q.qid, 'q_enter', i + 1)); s += 40; ans[q.qid] = plan[i] === 'right' ? key(q.qid) : wrong(q.qid); events.push(ev(s - 5, q.qid, 'select', ans[q.qid])); events.push(ev(s, q.qid, 'q_leave')); });
  G.fresh(); G.call('submit', [code, sp.set_id, { state: { v: 1, current_part: 'P', phase: 'review', part_starts: { P: Date.now() - 600000 }, ended: {}, parts: { P: { cur: 0, ans, elim: {}, mark: {}, ask: {}, hl: {} } } }, events, ev_from: 0, copy: t.copy }]);
  G.fresh();
  return { set_id: sp.set_id, qids: t.questions.map(q => q.qid), key };
}

console.log('[server: the set\'s keys in the TEACHER go-over payloads only]');
{
  const G = makeGas(), C = G.ctx;
  const a = doSet(G, 'FX-T01', ['wrong', 'right', 'wrong', 'right', 'right']);
  const tr = G.call('teacherReview', [T, a.set_id]);
  check(tr.keys && a.qids.every(q => tr.keys[q] && tr.keys[q].key.length && String(tr.keys[q].key[0]).toUpperCase() === a.key(q).toUpperCase()), 'teacherReview: keys of all 5 questions (for an instant Show answer)');
  G.fresh(); const go = G.call('goOverData', [T, a.qids]);
  check(Object.keys(go.keys).length === 5, 'goOverData: keys of the list');
  const thr = f => { try { f(); return ''; } catch (e) { return e.message; } };
  check(/LOGIN/.test(thr(() => G.call('teacherReview', ['FX-T01', a.set_id]))) && /LOGIN/.test(thr(() => G.call('goOverData', ['FX-T01', a.qids]))), 'a student code gets neither (teacher session required)');
  G.fresh(); const rv = G.call('getReview', ['FX-T01', a.set_id]), res = G.call('getResult', ['FX-T01', a.set_id]);
  check(!/"key"|"keys"|"accepted"|"rationale_html"/.test(JSON.stringify(rv) + JSON.stringify(res)), 'student review + result: still no key');
}

(async () => {
  const E = await H.setup(); const G = () => E.st.gas;
  try {
    const a = doSet(G(), 'FX-T01', ['wrong', 'right', 'wrong', 'right', 'right']);
    const { page, ctx } = await E.newPage('desktop1280');
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
    await H.login(page, E.url, T);
    await page.waitForSelector('[data-prof="FX-T01"]');
    await page.$eval('[data-prof="FX-T01"]', e => e.click());
    await page.waitForSelector('[data-res]'); await page.$eval('[data-res]', e => e.click());
    await page.waitForSelector('#result-body [data-qid]');
    await page.$eval('#result-body [data-qid="' + a.qids[0] + '"]', e => e.click());
    await page.waitForSelector('#scr-test.going #go-show'); await waitMath(page);

    console.log('Show answer: instant');
    check(!(await page.$('#scr-test .ch.rv-key')) && !/Correct answer/.test(await page.$eval('#scr-test', e => e.innerText)), 'on open: no key on screen (kept in memory only)');
    E.st.rpcLog = [];
    const ms = await page.evaluate(() => { const t0 = performance.now(); document.querySelector('#go-show').click(); return document.querySelector('.go-key') ? performance.now() - t0 : 99999; });
    check(ms < 100 && !E.st.rpcLog.some(r => r.fn === 'teacherKey'), 'Show answer → key on screen in ' + ms.toFixed(1) + ' ms, no server call');
    check(!!(await page.$('#scr-test .q.on .ch.rv-key')) || /Correct answer/.test(await page.$eval('#fb-go', e => e.innerText)), 'the key is highlighted');

    console.log('Notes pad');
    check(await page.$eval('#tool-notes', e => getComputedStyle(e).display !== 'none') && await page.$eval('#tool-pen', e => getComputedStyle(e).display !== 'none'), 'Notes + Pen buttons in the top bar (teacher go-over)');
    await page.click('#tool-notes');
    await page.waitForSelector('#notes-panel.on #nt-ed');
    await page.click('#nt-ed');
    await page.keyboard.type('Slope = ');
    await page.keyboard.type('$');
    await page.waitForSelector('#nt-ed .mq.mq-focused');
    await page.keyboard.type('3/4');
    await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
    await page.keyboard.type(', so the line is y = ');
    await page.keyboard.press('Control+m');
    await page.waitForSelector('#nt-ed .mq.mq-focused');
    await page.keyboard.type('x^2'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
    await page.keyboard.type('+1');
    await page.keyboard.press('Escape');
    await page.keyboard.type(' (check)');
    await page.keyboard.press('Enter'); await page.keyboard.type('Trap: answer C');
    const latex = await page.$$eval('#nt-ed .mq', a => a.map(x => (x.querySelector('.mq-root-block') || x).textContent));
    check(await page.$('#nt-ed .mq .mq-fraction') && await page.$('#nt-ed .mq sup, #nt-ed .mq .mq-sup'), 'math typed like Desmos: "/" → a fraction, "^" → an exponent (' + latex.join(' | ') + ')');
    // colour "Trap" red + highlight "answer C"
    await page.evaluate(() => { const ed = document.querySelector('#nt-ed'); const w = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { const i = n.nodeValue.indexOf('Trap'); if (i >= 0) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 4); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return; } } });
    await page.click('#nt-tools [data-c="#d0263c"]');
    await page.evaluate(() => { const ed = document.querySelector('#nt-ed'); const w = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { const i = n.nodeValue.indexOf('answer C'); if (i >= 0) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 8); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return; } } });
    await page.keyboard.press('Control+e');
    const edHtml = await page.$eval('#nt-ed', e => e.innerHTML);
    check(/rgb\(208, 38, 60\)|#d0263c/i.test(edHtml) && /background-color:\s*rgb\(253, 230, 138\)|#fde68a/i.test(edHtml), 'red text colour + yellow highlight (Ctrl+E)');
    await sleep(600);
    await shot(page, 'go62_notes');
    // same set → same notes on the next question
    await page.click('#btn-next'); await page.waitForSelector('#go-show, .go-key'); await sleep(300);
    check((await page.$$('#nt-ed .mq')).length === 2 && /Trap/.test(await page.$eval('#nt-ed', e => e.innerText)), 'next question: the notes stay (one pad per set)');
    // Copy → paste into a plain box and a rich box
    await page.click('#nt-tools [data-nt="copy"]');
    await page.waitForFunction(() => /Copied/.test(document.querySelector('#toast').textContent), null, { timeout: 15000 });
    await page.evaluate(() => {
      const w = document.createElement('div'); w.id = 'paste-test';
      w.style.cssText = 'position:fixed;left:20px;bottom:90px;width:700px;background:#fff;border:2px solid #333;padding:10px;z-index:200;font:14px Arial';
      w.innerHTML = '<b>Plain text box</b><textarea id="pt" style="width:100%;height:60px"></textarea><b>HTML box</b><div id="ph" contenteditable="true" style="min-height:70px;border:1px solid #999;padding:6px"></div>';
      document.body.appendChild(w);
    });
    await page.focus('#pt'); await page.keyboard.press('Control+v');
    await page.focus('#ph'); await page.keyboard.press('Control+v');
    await sleep(400);
    const plain = await page.$eval('#pt', e => e.value), rich = await page.$eval('#ph', e => e.innerHTML);
    check(/Slope = 3\/4, so the line is y = x\^2\+1/.test(plain) && /Trap: answer C/.test(plain), 'paste in a plain box: "' + plain.replace(/\n/g, ' ⏎ ') + '"');
    check((rich.match(/<img/g) || []).length === 2 && /data:image\/png/.test(rich) && /208, 38, 60|d0263c/i.test(rich) && /253, 230, 138|fde68a/i.test(rich), 'paste in an HTML box: 2 math images + the red word + the highlight');
    await shot(page, 'go62_paste');
    await page.evaluate(() => document.querySelector('#paste-test').remove());
    // exit + reopen the same set → notes back; Clear
    await page.click('#btn-view-back'); await page.waitForSelector('#scr-result.on');
    check(await page.$eval('#notes-panel', e => !e.classList.contains('on')), 'Back to report → the Notes panel closes');
    await page.$eval('#result-body [data-qid="' + a.qids[1] + '"]', e => e.click());
    await page.waitForSelector('#scr-test.going #go-show');
    await page.click('#tool-notes'); await page.waitForSelector('#notes-panel.on'); await sleep(500);
    check((await page.$$('#nt-ed .mq .mq-fraction')).length === 1 && /Trap/.test(await page.$eval('#nt-ed', e => e.innerText)), 'reopen the same set → the same notes (math still editable)');
    await page.click('#nt-tools [data-nt="clear"]'); await page.waitForSelector('#modal-root.on'); await page.click('#modal-root .btns button:last-child');
    check(await page.$eval('#nt-ed', e => e.innerText.trim() === '') && await page.evaluate(k => { try { return localStorage.getItem(k); } catch (e) { return 'x'; } }, 'sml_notes_set:' + a.set_id) === null, 'Clear (confirmed) → empty, nothing kept');
    await page.keyboard.type('note 2');
    await page.click('#nt-tools [data-nt="end"]'); await page.waitForSelector('#modal-root.on'); await page.click('#modal-root .btns button:last-child');
    await page.waitForSelector('#scr-result.on');
    check(await page.evaluate(k => { try { return localStorage.getItem(k); } catch (e) { return 'x'; } }, 'sml_notes_set:' + a.set_id) === null, 'End & clear → the go-over ends, the notes are deleted');

    console.log('Pen on the question');
    await page.click('#res-home'); await page.waitForSelector('#scr-teacher.on');
    await page.evaluate(() => SMLX.goOver(SMLX.call('goOverData', SMLX.A.code, ['FX1-003', 'FX1-001']), { sid: 'go', notesKey: 't62', backLabel: 'Back', back: function () { SMLX.show('scr-teacher'); } }));
    await page.waitForSelector('#scr-test.going #go-show'); await waitMath(page); await sleep(500);
    check(!!(await page.$('#scr-test .q.on .tz-fig img, #scr-test .q.on img')), 'a question with a figure (FX1-003)');
    await page.click('#tool-pen');
    check(await page.$eval('#pen-bar', e => !e.hidden) && !!(await page.$('#tmain canvas.pen-cv')), 'Pen on → colours bar + a canvas over the question area');
    const box = await (await page.$('#tmain canvas.pen-cv')).boundingBox();
    const draw = async (y, colour, w) => {
      await page.click('#pen-bar [data-pc="' + colour + '"]'); if (w) await page.click('#pen-bar [data-pw="' + w + '"]');
      await page.mouse.move(box.x + 60, box.y + y); await page.mouse.down();
      for (let i = 1; i <= 12; i++) await page.mouse.move(box.x + 60 + i * 25, box.y + y + (i % 2) * 6);
      await page.mouse.up();
    };
    await draw(80, 'blue'); await draw(130, 'red', 2); await draw(180, 'green', 1); await draw(230, 'yellow', 2);
    const px = () => page.$eval('#tmain canvas.pen-cv', c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; const o = { n: 0, blue: 0, red: 0, green: 0, yellow: 0 };
      for (let i = 0; i < d.length; i += 4) { if (!d[i + 3]) continue; o.n++; const [r, g, b] = [d[i], d[i + 1], d[i + 2]]; if (b > 150 && r < 80) o.blue++; else if (r > 150 && g < 80) o.red++; else if (g > 100 && r < 80 && b < 120) o.green++; else if (r > 200 && g > 150 && b < 60) o.yellow++; } return o; }).catch(() => ({ n: 0 }));
    const p1 = await px();
    check(p1.blue > 50 && p1.red > 50 && p1.green > 50 && p1.yellow > 50, '4 colours drawn on the question (pixels ' + JSON.stringify(p1) + ')');
    const wide = await page.evaluate(() => { const c = document.querySelector('#tmain canvas.pen-cv'), q = document.querySelector('#scr-test .q.on').getBoundingClientRect(), t = document.querySelector('#tmain').getBoundingClientRect();
      if (!c) return null; const cr = c.getBoundingClientRect(), r = window.devicePixelRatio || 1, x0 = Math.floor((q.left - cr.left - 10) * r), d = c.getContext('2d').getImageData(0, 0, Math.max(1, x0), c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++;
      return { full: Math.abs(cr.width - t.width) < 20, margin: Math.round(q.left - t.left), inMargin: n }; });
    check(wide && wide.full && wide.inMargin > 100, 'the pen covers the whole width: ink in the white margin left of the question (' + JSON.stringify(wide) + ')');
    check(!(await page.$('#scr-test .q.on .ch.sel')), 'while the pen is on, drawing over the choices does not pick an answer');
    await shot(page, 'go62_pen');
    await page.click('#pen-bar [data-pt="undo"]');
    const p2 = await px(); check(p2.yellow < 10 && p2.blue > 50, 'Undo → the last stroke (yellow) goes');
    await page.click('#pen-bar [data-pt="eraser"]');
    await page.mouse.move(box.x + 60 + 6 * 25, box.y + 130); await page.mouse.down(); await page.mouse.move(box.x + 60 + 7 * 25, box.y + 132); await page.mouse.up();
    const p3 = await px(); check(p3.red < 10 && p3.blue > 50, 'Eraser on the red line → the red stroke goes');
    await page.click('#btn-next'); await sleep(400);
    const p4 = await px(); check(p4.n === 0, 'next question → the canvas is empty');
    await page.click('#btn-back'); await sleep(400);
    const p5 = await px(); check(p5.n === 0, 'back to the first question → still empty (drawings are not kept)');
    await page.click('#pen-bar [data-pt="off"]');
    const ch = await page.$('#scr-test .q.on .ch'); if (ch) { await ch.click(); check(await ch.evaluate(e => e.classList.contains('sel')), 'Pen off → clicks choose an answer again'); }
    await page.click('#btn-view-back'); await page.waitForSelector('#scr-teacher.on');

    console.log('iPad');
    for (const dev of ['ipad', 'ipad-portrait']) {
      const ip = (await E.newPage(dev)).page;
      await H.login(ip, E.url, T); await ip.waitForSelector('[data-prof="FX-T01"]');
      await ip.evaluate(() => SMLX.goOver(SMLX.call('goOverData', SMLX.A.code, ['FX1-003', 'FX1-001']), { sid: 'go', notesKey: 'ipad', backLabel: 'Back' }));
      await ip.waitForSelector('#scr-test.going #go-show'); await waitMath(ip); await sleep(400);
      await ip.tap('#tool-pen');
      const bx = await (await ip.$('#tmain canvas.pen-cv')).boundingBox();
      for (const [c, y] of [['red', 70], ['blue', 120]]) { await ip.tap('#pen-bar [data-pc="' + c + '"]'); await ip.mouse.move(bx.x + 40, bx.y + y); await ip.mouse.down(); for (let i = 1; i < 10; i++) await ip.mouse.move(bx.x + 40 + i * 30, bx.y + y + (i % 2) * 8); await ip.mouse.up(); }
      await ip.tap('#tool-notes'); await ip.waitForSelector('#notes-panel.on'); await ip.click('#nt-ed'); await ip.keyboard.type('Area = '); await ip.keyboard.type('$'); await ip.waitForSelector('#nt-ed .mq.mq-focused'); await ip.keyboard.type('1/2bh');
      await sleep(400);
      const fit = await ip.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && document.querySelector('#notes-panel').getBoundingClientRect().right <= innerWidth + 1);
      check(fit, dev + ': pen bar + Notes panel fit the screen');
      await shot(ip, 'go62_' + dev.replace('-', '_'));
      await ip.context().close();
    }
    H.englishOnly(E);
  } catch (e) { console.error(e); check(false, 'exception: ' + e.message); }
  await E.close();
  process.exit(H.summary() ? 1 : 0);
})();
