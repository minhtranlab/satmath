// #107 (Minh 26/11, on his iPad): the Apple Pencil draws at once (no text selection, no highlight toolbar), a finger scrolls
// the question while the pen is on (GoodNotes style); a finger draws until a Pencil has been seen, or always / never with the
// "✋ Finger draws" switch (kept on this device); the split divider is easy to drag with a finger (a ~32 px target, pointer
// events, 25–75 %). Pencil = synthetic PointerEvents (pointerType 'pen'); finger = real CDP touch events in an iPad context.
const H = require('./h'); const { check, sleep, shot, waitMath } = H;
const T = 'TEACH-FX-9';

const ink = p => p.$eval('#tmain canvas.pen-cv', c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n; }).catch(() => -1);
// a Pencil stroke: pointerdown / move / up with pointerType 'pen' on the canvas (what iPadOS Safari sends for the Apple Pencil)
const pencil = (p, x, y, steps = 10) => p.evaluate(([x, y, steps]) => {
  const c = document.querySelector('canvas.pen-cv'), b = c.getBoundingClientRect(), o = (cx, cy) => ({ pointerType: 'pen', pointerId: 7, isPrimary: true, bubbles: true, cancelable: true, clientX: b.left + cx, clientY: b.top + cy, button: 0, buttons: 1, pressure: 0.5 });
  const down = new PointerEvent('pointerdown', o(x, y)); c.dispatchEvent(down);
  for (let i = 1; i <= steps; i++) c.dispatchEvent(new PointerEvent('pointermove', o(x + i * 22, y + (i % 2) * 5)));
  c.dispatchEvent(new PointerEvent('pointerup', Object.assign(o(x + steps * 22, y), { buttons: 0 })));
  return down.defaultPrevented;
}, [x, y, steps]);
// a finger drag with real touch events (Chromium makes pointerType 'touch' + scrolls by touch-action, like Safari)
async function finger(cdp, x0, y0, x1, y1, steps = 12) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
  for (let i = 1; i <= steps; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (x1 - x0) * i / steps, y: y0 + (y1 - y0) * i / steps }] }); await sleep(16); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(250);
}
const scrolled = p => p.evaluate(() => { let n = document.querySelector('canvas.pen-cv'), s = 0; while (n) { s += n.scrollTop || 0; n = n.parentElement; } return s + (document.scrollingElement.scrollTop || 0); });
const noSel = p => p.evaluate(() => { const s = getSelection(); return (!s || s.isCollapsed) && !document.querySelector('#hl-toolbar.on'); });
async function goOver(E, dev, key, qids) {
  const { page, ctx } = await E.newPage(dev);
  await H.login(page, E.url, T); await page.waitForSelector('[data-prof="FX-T01"]');
  await page.evaluate(([k, q]) => SMLX.goOver(SMLX.call('goOverData', SMLX.A.code, q), { sid: 'go', notesKey: k, backLabel: 'Back' }), [key, qids]);
  await page.waitForSelector('#scr-test.going #go-show'); await waitMath(page); await sleep(300);
  return { page, ctx, cdp: await ctx.newCDPSession(page) };
}

(async () => {
  const E = await H.setup();
  try {
    console.log('iPad, a Pencil in use: the Pencil draws at once, a finger scrolls');
    {
      const { page, ctx, cdp } = await goOver(E, 'ipad', 'p107a', ['FX1-001', 'FX1-003']);
      await page.evaluate(() => { const q = document.querySelector('#scr-test .q.on'); q.style.paddingBottom = '1600px'; });   // a long question (room to scroll)
      await page.tap('#tool-pen'); await sleep(150);
      check(!!(await page.$('#tmain canvas.pen-cv')) && await page.$eval('#pen-finger', e => e.offsetParent !== null), 'Pen on → canvas + a "✋ Finger draws" switch in the pen bar');
      check(!(await page.$eval('#scr-test', e => e.classList.contains('finger-scrolls'))) && await page.$eval('#pen-finger', e => e.getAttribute('aria-pressed')) === 'true', 'no Pencil seen yet → a finger still draws (phones, iPads without a pen)');
      const us = await page.$eval('#scr-test .q.on .stem, #scr-test .q.on', e => { const s = getComputedStyle(e); return (s.webkitUserSelect || s.userSelect) + '/' + (s.webkitTouchCallout || 'n/a'); });
      check(/^none/.test(us), 'pen on → the question text cannot be selected (user-select: ' + us + ')');
      // a Pencil touch on iPadOS also comes as a touch event with touchType "stylus": the canvas cancels it (no selection, no scroll)
      const stylusBlocked = await page.evaluate(() => { const c = document.querySelector('canvas.pen-cv'), e = new Event('touchstart', { bubbles: true, cancelable: true }); Object.defineProperty(e, 'touches', { value: [{ touchType: 'stylus', clientX: 10, clientY: 10 }] }); c.dispatchEvent(e); return e.defaultPrevented; });
      check(stylusBlocked, 'a stylus touchstart on the canvas is cancelled (iPadOS would start a selection with it)');
      const i0 = await ink(page);
      const prevented = await pencil(page, 60, 90);
      const i1 = await ink(page);
      check(prevented && i1 > i0 + 100, 'Pencil (pointerType pen) → a stroke at once (ink ' + i0 + ' → ' + i1 + ')');
      // the highlight toolbar must not open from a selection while the pen is on (even if one existed)
      await page.evaluate(() => { const t = document.querySelector('#scr-test .q.on .stem') || document.querySelector('#scr-test .q.on'); const r = document.createRange(); r.selectNodeContents(t); const s = getSelection(); s.removeAllRanges(); s.addRange(r); t.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); });
      await sleep(600);
      check(!(await page.$('#hl-toolbar.on')), 'no highlight toolbar while the pen is on');
      await pencil(page, 60, 140);
      check(await noSel(page), 'a Pencil stroke clears any selection; no toolbar');
      check(await page.$eval('#scr-test', e => e.classList.contains('finger-scrolls')) && await page.$eval('#pen-finger', e => e.getAttribute('aria-pressed')) === 'false', 'after the first Pencil stroke → a finger scrolls (switch shows off)');
      check(await page.$eval('canvas.pen-cv', c => getComputedStyle(c).touchAction) !== 'none', 'canvas lets a finger pan (touch-action: ' + await page.$eval('canvas.pen-cv', c => getComputedStyle(c).touchAction) + ')');
      const box = await (await page.$('canvas.pen-cv')).boundingBox();
      const s0 = await scrolled(page), k0 = await ink(page);
      await finger(cdp, box.x + 300, 650, box.x + 300, 250);
      const s1 = await scrolled(page), k1 = await ink(page);
      check(s1 > s0 + 100, 'finger drag up → the question scrolls (' + s0 + ' → ' + s1 + ' px)');
      check(k1 === k0, 'the finger drew nothing (ink ' + k0 + ' = ' + k1 + ')');
      check(await noSel(page), 'no selection / toolbar after the finger');
      await shot(page, 'ipad107_pencil');

      console.log('"✋ Finger draws" switch');
      await page.tap('#pen-finger'); await sleep(100);
      check(await page.$eval('#pen-finger', e => e.classList.contains('on') && e.getAttribute('aria-pressed') === 'true') && !(await page.$eval('#scr-test', e => e.classList.contains('finger-scrolls'))), 'tap → on (finger draws)');
      check(await page.evaluate(() => localStorage.getItem('sml_finger_draws')) === 'on', 'kept on this device (localStorage sml_finger_draws = on)');
      const b2 = await (await page.$('canvas.pen-cv')).boundingBox();
      const s2 = await scrolled(page), k2 = await ink(page);
      await finger(cdp, b2.x + 80, 400, b2.x + 360, 430);
      const s3 = await scrolled(page), k3 = await ink(page);
      check(k3 > k2 + 100 && Math.abs(s3 - s2) < 5, 'switch on → a finger draws, no scroll (ink ' + k2 + ' → ' + k3 + ')');
      await page.tap('#pen-finger'); await sleep(100);
      check(await page.evaluate(() => localStorage.getItem('sml_finger_draws')) === 'off' && await page.$eval('#scr-test', e => e.classList.contains('finger-scrolls')), 'tap again → off (a finger scrolls), kept = off');
      await page.tap('#pen-finger');                                          // leave it on for the next page (same device)
      await page.tap('#pen-bar [data-pt="off"]'); await sleep(100);
      const us2 = await page.$eval('#scr-test .q.on .stem, #scr-test .q.on', e => { const s = getComputedStyle(e); return s.webkitUserSelect || s.userSelect; });
      check(!/none/.test(us2), 'Pen off → text can be selected again (' + us2 + ')');
      // same device, a new go-over: the switch is remembered
      await page.evaluate(() => SMLX.goOver(SMLX.call('goOverData', SMLX.A.code, ['FX1-002']), { sid: 'go', notesKey: 'p107b', backLabel: 'Back' }));
      await page.waitForSelector('#scr-test.going #go-show'); await sleep(200);
      await page.tap('#tool-pen'); await sleep(100);
      check(await page.$eval('#pen-finger', e => e.getAttribute('aria-pressed')) === 'true', 'the switch is remembered on this device (on)');
      await page.evaluate(() => { try { localStorage.removeItem('sml_finger_draws'); } catch (e) {} });
      await ctx.close();
    }

    console.log('iPad with no Pencil: a finger draws');
    {
      const { page, ctx, cdp } = await goOver(E, 'ipad-portrait', 'p107c', ['FX1-001']);
      await page.tap('#tool-pen'); await sleep(150);
      const b = await (await page.$('canvas.pen-cv')).boundingBox(), k0 = await ink(page);
      await finger(cdp, b.x + 60, b.y + 120, b.x + 360, b.y + 140);
      const k1 = await ink(page);
      check(k1 > k0 + 100, 'finger drag → a stroke (no Pencil seen, switch untouched; ink ' + k0 + ' → ' + k1 + ')');
      check(await noSel(page), 'no selection / toolbar');
      await ctx.close();
    }

    console.log('Laptop: the mouse / trackpad draws as before');
    {
      const { page, ctx } = await goOver(E, 'desktop1280', 'p107d', ['FX1-001']);
      await page.click('#tool-pen');
      const b = await (await page.$('canvas.pen-cv')).boundingBox(), k0 = await ink(page);
      await page.mouse.move(b.x + 60, b.y + 100); await page.mouse.down(); for (let i = 1; i <= 10; i++) await page.mouse.move(b.x + 60 + i * 25, b.y + 100 + (i % 2) * 5); await page.mouse.up();
      check(await ink(page) > k0 + 100, 'mouse drag → a stroke');
      await ctx.close();
    }

    console.log('Divider (split question): a finger drags it');
    for (const where of ['teacher go-over', 'student set']) {
      const { page, ctx } = await E.newPage('ipad');
      const cdp = await ctx.newCDPSession(page);
      if (where === 'teacher go-over') {
        await H.login(page, E.url, T); await page.waitForSelector('[data-prof="FX-T01"]');
        await page.evaluate(() => SMLX.goOver(SMLX.call('goOverData', SMLX.A.code, ['FX1-004', 'FX1-001']), { sid: 'go', notesKey: 'p107e', backLabel: 'Back' }));
        await page.waitForSelector('#scr-test.going #go-show');
      } else {
        await H.login(page, E.url, 'FX-T01'); await page.waitForSelector('#picker .sm-it');
        await page.tap('#picker [data-k="H.B"]'); await page.tap('#picker [data-n="5"]'); await page.tap('#btn-start');
        await page.waitForSelector('#btn-begin'); await page.tap('#btn-begin'); await page.waitForSelector('#qwrap .q.on');
        for (let i = 0; i < 5 && !(await page.$('#qwrap .q.on.split')); i++) { await page.tap('#btn-next'); await sleep(250); }
      }
      await waitMath(page); await sleep(300);
      const ok = !!(await page.$('#scr-test .q.on.split .q-divider'));
      check(ok, where + ': a split question with the divider');
      if (!ok) { await ctx.close(); continue; }
      const g = () => page.$eval('#scr-test .q.on.split', q => { const d = q.querySelector('.q-divider').getBoundingClientRect(), r = q.getBoundingClientRect(), f = q.firstElementChild.getBoundingClientRect(); return { cx: d.left + d.width / 2, cy: d.top + d.height / 2, w: d.width, pct: Math.round(100 * f.width / r.width), qw: r.width }; });
      const g0 = await g();
      const target = await page.evaluate(([x, y]) => [-16, -12, 0, 12, 15].map(dx => { const e = document.elementFromPoint(x + dx, y); return !!(e && e.closest('.q-divider')); }), [g0.cx, g0.cy]);
      check(target.every(Boolean), where + ': the divider catches a finger from −16 to +15 px around its line (' + target.join(',') + ', line ' + g0.w + ' px)');
      const grip = await page.$eval('#scr-test .q.on.split .q-divider', d => { const s = getComputedStyle(d, '::after'); return parseFloat(s.height); });
      check(grip >= 40, where + ': a visible grip (' + grip + ' px tall)');
      await finger(cdp, g0.cx + 12, g0.cy, g0.cx + 12 + 0.15 * g0.qw, g0.cy);   // grab 12 px right of the line
      const g1 = await g();
      check(g1.pct >= g0.pct + 10, where + ': finger drag right → the left side grows (' + g0.pct + ' % → ' + g1.pct + ' %)');
      await finger(cdp, g1.cx - 10, g1.cy, g1.cx + 0.6 * g0.qw, g1.cy);
      const g2 = await g();
      check(g2.pct <= 76 && g2.pct >= 70, where + ': stops at 75 % (' + g2.pct + ' %)');
      await finger(cdp, g2.cx, g2.cy, g2.cx - 0.9 * g0.qw, g2.cy);
      const g3 = await g();
      check(g3.pct >= 24 && g3.pct <= 30, where + ': stops at 25 % (' + g3.pct + ' %)');
      check(await noSel(page), where + ': dragging the divider selects no text');
      await shot(page, 'ipad107_divider_' + (where === 'student set' ? 'student' : 'teacher'));
      await ctx.close();
    }

    console.log('Laptop: the divider still drags with the mouse');
    {
      const { page, ctx } = await goOver(E, 'desktop1280', 'p107f', ['FX1-004']);
      const d = await (await page.$('#scr-test .q.on.split .q-divider')).boundingBox();
      const pct = () => page.$eval('#scr-test .q.on.split', q => Math.round(100 * q.firstElementChild.getBoundingClientRect().width / q.getBoundingClientRect().width));
      const p0 = await pct();
      await page.mouse.move(d.x + d.width / 2, d.y + d.height / 2); await page.mouse.down(); await page.mouse.move(d.x - 150, d.y + d.height / 2, { steps: 8 }); await page.mouse.up();
      const p1 = await pct();
      check(p1 <= p0 - 8, 'mouse drag left → the left side shrinks (' + p0 + ' % → ' + p1 + ' %)');
      await ctx.close();
    }
    H.englishOnly(E);
  } catch (e) { console.error(e); check(false, 'exception: ' + e.message); }
  await E.close();
  process.exit(H.summary() ? 1 : 0);
})();
