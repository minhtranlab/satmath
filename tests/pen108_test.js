// #108 (from Test Zone v1.17): the go-over pen covers BOTH panes of a split question (left = passage / figure / directions,
// right = the question): a stroke belongs to the pane it starts on, scrolls with that pane, stays in place when the divider
// is dragged, eraser + Undo on both; cleared on the next question. Select (lasso): a loop around strokes → dashed box →
// drag inside the pane, Delete (button + key), Undo — with the mouse, the Apple Pencil, and a finger only when
// "✋ Finger draws" is on (#107 rules kept).
const H = require('./h'); const { check, sleep, shot, waitMath } = H;
const T = 'TEACH-FX-9';
const L = '#scr-test .q.on .q-pass canvas.pen-cv', R = '#scr-test .q.on .q-side canvas.pen-cv';
// ink of one canvas: pixel count + bounding box in canvas CSS px
const ink = (p, sel) => p.$eval(sel, c => { const r = window.devicePixelRatio || 1, d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0, l = 1e9, t = 1e9, rr = -1, b = -1;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 40) { n++; const k = (i - 3) / 4, x = k % c.width, y = Math.floor(k / c.width); l = Math.min(l, x); rr = Math.max(rr, x); t = Math.min(t, y); b = Math.max(b, y); }
  return n ? { n, l: Math.round(l / r), t: Math.round(t / r), r: Math.round(rr / r), b: Math.round(b / r) } : { n: 0 }; }).catch(() => ({ n: -1 }));
const rect = (p, sel) => p.$eval(sel, e => { const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; });
async function mouseStroke(p, x, y, n = 8, dx = 20) { await p.mouse.move(x, y); await p.mouse.down(); for (let i = 1; i <= n; i++) await p.mouse.move(x + i * dx, y + (i % 2) * 4); await p.mouse.up(); }
async function mouseLoop(p, cx, cy, rx, ry) { await p.mouse.move(cx + rx, cy); await p.mouse.down(); for (let i = 1; i <= 24; i++) { const a = i / 24 * 2 * Math.PI; await p.mouse.move(cx + rx * Math.cos(a), cy + ry * Math.sin(a)); } await p.mouse.up(); }
// synthetic Apple Pencil events on one canvas (points in screen px)
const pencilPath = (p, sel, pts) => p.evaluate(([sel, pts]) => {
  const c = document.querySelector(sel), o = (x, y, b) => ({ pointerType: 'pen', pointerId: 9, isPrimary: true, bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, buttons: b, pressure: 0.5 });
  c.dispatchEvent(new PointerEvent('pointerdown', o(pts[0][0], pts[0][1], 1)));
  pts.slice(1).forEach(q => c.dispatchEvent(new PointerEvent('pointermove', o(q[0], q[1], 1))));
  const z = pts[pts.length - 1]; c.dispatchEvent(new PointerEvent('pointerup', o(z[0], z[1], 0)));
}, [sel, pts]);
const loopPts = (cx, cy, rx, ry) => Array.from({ length: 25 }, (_, i) => [cx + rx * Math.cos(i / 24 * 2 * Math.PI), cy + ry * Math.sin(i / 24 * 2 * Math.PI)]);
async function finger(cdp, pts) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pts[0][0], y: pts[0][1] }] });
  for (const q of pts.slice(1)) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: q[0], y: q[1] }] }); await sleep(12); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(200);
}
async function goOver(E, dev, key, qids) {
  const { page, ctx } = await E.newPage(dev);
  await H.login(page, E.url, T); await page.waitForSelector('[data-prof="FX-T01"]');
  await page.evaluate(([k, q]) => SMLX.goOver(SMLX.call('goOverData', SMLX.A.code, q), { sid: 'go', notesKey: k, backLabel: 'Back' }), [key, qids]);
  await page.waitForSelector('#scr-test.going #go-show'); await waitMath(page); await sleep(300);
  return { page, ctx };
}

(async () => {
  const E = await H.setup();
  try {
    console.log('Pen over both panes (laptop)');
    {
      const { page, ctx } = await goOver(E, 'desktop1280', 'p108a', ['FX1-004', 'FX1-001']);
      check(!!(await page.$('#scr-test .q.on.split')), 'FX1-004 = a split question (directions left, question right)');
      await page.click('#tool-pen'); await sleep(150);
      check(!!(await page.$(L)) && !!(await page.$(R)), 'Pen on → one layer in the left pane and one in the question pane');
      const lr = await rect(page, '#scr-test .q.on .q-pass'), rr = await rect(page, '#scr-test .q.on .q-side');
      await mouseStroke(page, lr.x + 40, lr.y + 160);
      const a1 = await ink(page, L), b1 = await ink(page, R);
      check(a1.n > 100 && b1.n === 0, 'a stroke started on the left pane lands on the left pane (' + a1.n + ' px) and nowhere else');
      await mouseStroke(page, rr.x + 60, rr.y + 230, 8, 24);
      const b2 = await ink(page, R); check(b2.n > 100 && (await ink(page, L)).n === a1.n, 'a stroke on the question pane → the question pane (' + b2.n + ' px)');
      // scroll the left pane: the stroke moves with it (canvas inside the pane), the right pane does not move
      const c0 = await rect(page, L), q0 = await rect(page, R);
      await page.$eval('#scr-test .q.on .q-pass', e => { e.scrollTop = 120; }); await sleep(150);
      const c1 = await rect(page, L), q1 = await rect(page, R), a2 = await ink(page, L);
      const sh = await page.$eval('#scr-test .q.on .q-pass', e => e.scrollTop);
      check(sh > 50 && Math.abs((c0.y - c1.y) - sh) < 2 && a2.t === a1.t && Math.abs(q1.y - q0.y) < 1, 'left pane scrolled ' + sh + ' px → its stroke moved up ' + Math.round(c0.y - c1.y) + ' px with it; the question pane did not move');
      await page.$eval('#scr-test .q.on .q-pass', e => { e.scrollTop = 0; }); await sleep(100);
      // drag the divider: strokes keep their place in their pane (no stretching)
      const d = await rect(page, '#scr-test .q.on .q-divider');
      await page.mouse.move(d.x + d.w / 2, d.y + d.h / 2); await page.mouse.down(); await page.mouse.move(d.x + 180, d.y + d.h / 2, { steps: 8 }); await page.mouse.up(); await sleep(300);
      const lw = (await rect(page, '#scr-test .q.on .q-pass')).w, a3 = await ink(page, L), b3 = await ink(page, R), cw = (await rect(page, L)).w;
      check(lw > lr.w + 100 && Math.abs(cw - lw) < 30, 'divider dragged: left pane ' + Math.round(lr.w) + ' → ' + Math.round(lw) + ' px, its layer follows (' + Math.round(cw) + ' px)');
      check(a3.l === a1.l && a3.t === a1.t && a3.r === a1.r && b3.l === b2.l && b3.t === b2.t && b3.r === b2.r, 'both strokes stay in place in their pane (same box, not stretched)');
      await shot(page, 'pen108_panes');
      // eraser + undo on both panes
      await page.click('#pen-bar [data-pt="eraser"]');
      const lr2 = await rect(page, L);
      await page.mouse.move(lr2.x + a1.l + 60, lr2.y + a1.t + 3); await page.mouse.down(); await page.mouse.move(lr2.x + a1.l + 80, lr2.y + a1.t + 4, { steps: 3 }); await page.mouse.up();
      check((await ink(page, L)).n === 0 && (await ink(page, R)).n === b2.n, 'Eraser on the left stroke → gone; the question-pane stroke stays');
      const rr2 = await rect(page, R);
      await page.mouse.move(rr2.x + b2.l + 60, rr2.y + b2.t + 3); await page.mouse.down(); await page.mouse.move(rr2.x + b2.l + 90, rr2.y + b2.t + 4, { steps: 3 }); await page.mouse.up();
      check((await ink(page, R)).n === 0, 'Eraser on the question pane works too');
      await page.click('#pen-bar [data-pt="undo"]'); await page.click('#pen-bar [data-pt="undo"]');
      check((await ink(page, L)).n === a1.n && (await ink(page, R)).n === b2.n, 'Undo × 2 → both strokes back');

      console.log('Select (lasso) with the mouse');
      await page.click('#pen-bar [data-pt="select"]');
      check(await page.$eval('#pen-bar [data-pt="select"]', e => e.classList.contains('on')) && await page.$eval('#pen-del', e => e.hidden), 'Select on; Delete hidden until something is selected');
      const r3 = await rect(page, R), cx = r3.x + (b2.l + b2.r) / 2, cy = r3.y + (b2.t + b2.b) / 2;
      await mouseLoop(page, cx, cy, (b2.r - b2.l) / 2 + 40, (b2.b - b2.t) / 2 + 40);
      const sel1 = await ink(page, R);
      check(!(await page.$eval('#pen-del', e => e.hidden)) && sel1.n > b2.n && sel1.l < b2.l, 'a loop around the stroke → selected: dashed box drawn, Delete shown');
      check((await ink(page, L)).n === a1.n, 'the loop on the question pane does not select the left stroke');
      await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + 60, cy + 50, { steps: 6 }); await page.mouse.up();
      await page.click('#pen-bar [data-pc="blue"]'); await sleep(50);            // back to the pen: the box goes, the stroke stays moved
      const mv = await ink(page, R);
      check(Math.abs(mv.l - b2.l - 60) <= 2 && Math.abs(mv.t - b2.t - 50) <= 2 && Math.abs(mv.n - b2.n) < 40, 'drag the box → the stroke moved by (60, 50) (' + (mv.l - b2.l) + ', ' + (mv.t - b2.t) + ')');
      await page.click('#pen-bar [data-pt="undo"]');
      const un = await ink(page, R); check(un.l === b2.l && un.t === b2.t, 'Undo → back where it was');
      // a box dragged far stays inside its pane
      await page.click('#pen-bar [data-pt="select"]');
      await mouseLoop(page, cx, cy, (b2.r - b2.l) / 2 + 40, (b2.b - b2.t) / 2 + 40);
      await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx - 900, cy, { steps: 10 }); await page.mouse.up();
      const far = await ink(page, R); check(far.n > 0 && far.l >= 0 && far.l <= 12, 'dragged far left → it stops at the pane edge (left ' + far.l + ' px), never into the other pane');
      check((await ink(page, L)).n === a1.n, 'the left pane is untouched');
      await page.click('#pen-del'); await sleep(50);
      check((await ink(page, R)).n === 0 && await page.$eval('#pen-del', e => e.hidden), 'Delete → the selected strokes are gone');
      await page.click('#pen-bar [data-pt="undo"]');
      check((await ink(page, R)).n > 100, 'Undo → back');
      // keyboard Delete on a selection in the left pane
      const l4 = await rect(page, L);
      await mouseLoop(page, l4.x + (a1.l + a1.r) / 2, l4.y + (a1.t + a1.b) / 2, (a1.r - a1.l) / 2 + 40, (a1.b - a1.t) / 2 + 40);
      await page.keyboard.press('Delete'); await sleep(50);
      check((await ink(page, L)).n === 0 && (await ink(page, R)).n > 100, 'left pane: loop + Delete key → only that stroke goes');
      await page.click('#pen-bar [data-pt="undo"]'); check((await ink(page, L)).n === a1.n, 'Undo → back');
      await shot(page, 'pen108_select');
      // pen off: drawing stays visible, clicks reach the question again; next question: gone
      await page.click('#pen-bar [data-pt="off"]');
      check((await ink(page, L)).n === a1.n && (await ink(page, R)).n > 100, 'Pen off → the drawing stays on screen');
      await page.click('#tool-pen');
      await page.click('#btn-next'); await sleep(400);
      check((await page.$$('#scr-test canvas.pen-cv')).length >= 1 && (await ink(page, '#tmain canvas.pen-cv')).n === 0, 'next question (one page) → one layer over the whole page, empty');
      await page.click('#btn-back'); await sleep(400);
      check((await ink(page, L)).n === 0 && (await ink(page, R)).n === 0, 'back to the split question → empty (drawings are not kept)');
      await ctx.close();
    }

    console.log('Select with the Apple Pencil and a finger (iPad)');
    {
      const { page, ctx } = await goOver(E, 'ipad', 'p108b', ['FX1-004']);
      const cdp = await ctx.newCDPSession(page);
      await page.tap('#tool-pen'); await sleep(150);
      const r = await rect(page, R), x0 = r.x + 80, y0 = r.y + 240;
      await pencilPath(page, R, Array.from({ length: 9 }, (_, i) => [x0 + i * 22, y0 + (i % 2) * 4]));
      const s0 = await ink(page, R); check(s0.n > 100, 'Pencil stroke on the question pane');
      check(await page.$eval('#scr-test', e => e.classList.contains('finger-scrolls')), 'Pencil seen → a finger scrolls (#107)');
      await page.tap('#pen-bar [data-pt="select"]');
      const cx = r.x + (s0.l + s0.r) / 2, cy = r.y + (s0.t + s0.b) / 2, rx = (s0.r - s0.l) / 2 + 40, ry = (s0.b - s0.t) / 2 + 40;
      // a finger loop with "Finger draws" off = a scroll, not a lasso
      await finger(cdp, loopPts(cx, cy, rx, ry));
      check(await page.$eval('#pen-del', e => e.hidden), 'finger loop (Finger draws off) → nothing selected (the finger scrolls)');
      await pencilPath(page, R, loopPts(cx, cy, rx, ry));
      check(!(await page.$eval('#pen-del', e => e.hidden)), 'Pencil loop → selected (Delete shown)');
      await pencilPath(page, R, Array.from({ length: 7 }, (_, i) => [cx + i * 8, cy + i * 6]));
      await page.tap('#pen-bar [data-pc="red"]'); await sleep(50);
      const s1 = await ink(page, R); check(Math.abs(s1.l - s0.l - 48) <= 2 && Math.abs(s1.t - s0.t - 36) <= 2, 'Pencil drag on the box → moved (' + (s1.l - s0.l) + ', ' + (s1.t - s0.t) + ')');
      await page.tap('#pen-finger'); await page.tap('#pen-bar [data-pt="select"]');
      const cx2 = r.x + (s1.l + s1.r) / 2, cy2 = r.y + (s1.t + s1.b) / 2;
      await finger(cdp, loopPts(cx2, cy2, rx, ry));
      check(!(await page.$eval('#pen-del', e => e.hidden)), 'Finger draws on → a finger loop selects');
      await page.tap('#pen-del'); await page.waitForFunction(() => document.querySelector('#pen-del').hidden, null, { timeout: 3000 }).catch(() => {});   // a tap's click can come late on a touch screen
      check((await ink(page, R)).n === 0, 'Delete (tap) → gone');
      await page.tap('#pen-bar [data-pt="undo"]'); check((await ink(page, R)).n > 100, 'Undo → back');
      const fit = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
      check(fit, 'pen bar with Select fits the iPad screen');
      await shot(page, 'pen108_ipad');
      await page.evaluate(() => { try { localStorage.removeItem('sml_finger_draws'); } catch (e) {} });
      await ctx.close();
    }
    H.englishOnly(E);
  } catch (e) { console.error(e); check(false, 'exception: ' + e.message); }
  await E.close();
  process.exit(H.summary() ? 1 : 0);
})();
