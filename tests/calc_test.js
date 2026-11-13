// Browser suite: the calculator panel (Minh 13 Nov: "it jumps"). Laptop 1280×800 + 1440×900 and phone 390×844:
// opens beside the question (not over it), drag by the title bar only, resize from the corner only, a cancelled gesture
// leaves nothing behind (hovering afterwards moves nothing), Expand/Collapse = two fixed sizes, close/open and a window
// resize keep the size. Screenshots: calc_<device>_*.png
const { setup, shot, login, waitMath, check, summary, sleep } = require('./h');

async function openSet(page, E, code) {
  await login(page, E.url, code || 'FX-T01');
  await page.waitForSelector('#picker .sm-it');
  await page.click('#picker [data-k="H.B"]'); await page.click('#picker [data-n="5"]'); await page.click('#btn-start');
  await page.waitForSelector('#btn-begin, #qwrap .q.on', { state: 'visible' });
  if (await page.$('#btn-begin:visible')) await page.click('#btn-begin');
  await page.waitForSelector('#qwrap .q.on'); await waitMath(page);
}
const box = (page, sel) => page.$eval(sel, e => { const r = e.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), r: Math.round(r.right), b: Math.round(r.bottom) }; });
const same = (a, b) => Math.abs(a.x - b.x) <= 1 && Math.abs(a.y - b.y) <= 1 && Math.abs(a.w - b.w) <= 1 && Math.abs(a.h - b.h) <= 1;

async function laptop(E, W, H, tag) {
  console.log('laptop ' + W + '×' + H);
  const { page } = await E.newPage('desktop1280');
  await page.setViewportSize({ width: W, height: H });
  await openSet(page, E, tag === 'l1440' ? 'FX-T03' : 'FX-T01');
  await page.click('#tool-calc'); await page.waitForSelector('#calc-panel.on'); await sleep(400);
  let p = await box(page, '#calc-panel'), q = await box(page, '#qwrap .q.on .q-text');
  check(p.x >= 0 && p.r <= W && p.y >= 0 && p.b <= H, 'opens inside the window: ' + JSON.stringify(p));
  check(q.x >= p.r, 'the question sits to the right of the calculator (not covered)');
  await shot(page, 'calc_' + tag + '_open');
  // drag by the title bar
  const head = await box(page, '#calc-head .ttl');
  await page.mouse.move(head.x + 10, head.y + 8); await page.mouse.down(); await page.mouse.move(head.x + 160, head.y - 42, { steps: 8 }); await page.mouse.up();
  await sleep(150);
  let p2 = await box(page, '#calc-panel');
  check(Math.abs(p2.x - (p.x + 150)) <= 2 && p2.y >= 0 && p2.y <= p.y && p2.w === p.w && p2.h === p.h, 'drag by the title bar: moved right by 150 (kept inside the window), size unchanged');
  // hovering afterwards changes nothing
  await page.mouse.move(head.x + 300, head.y + 30, { steps: 6 }); const c = await box(page, '#calc-rs'); await page.mouse.move(c.x + 30, c.y + 30, { steps: 6 }); await sleep(150);
  check(same(await box(page, '#calc-panel'), p2), 'moving the mouse over the title bar / corner without pressing → nothing moves');
  // a cancelled gesture (trackpad / released outside) leaves no listener behind
  const h2 = await box(page, '#calc-head .ttl');
  await page.mouse.move(h2.x + 10, h2.y + 8); await page.mouse.down(); await page.mouse.move(h2.x + 40, h2.y + 8, { steps: 3 }); await sleep(100);
  await page.$eval('#calc-head', e => e.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: 1 })));
  const afterCancel = await box(page, '#calc-panel');
  await page.mouse.move(h2.x + 200, h2.y + 100, { steps: 6 }); await page.mouse.up(); await page.mouse.move(h2.x + 260, h2.y + 140, { steps: 4 }); await sleep(150);
  check(same(await box(page, '#calc-panel'), afterCancel), 'gesture cancelled mid-drag → the panel stops; later moves do nothing');
  p2 = await box(page, '#calc-panel');
  // the body (Desmos) does not drag
  await page.mouse.move(p2.x + p2.w / 2, p2.y + p2.h / 2); await page.mouse.down(); await page.mouse.move(p2.x + p2.w / 2 + 80, p2.y + p2.h / 2 + 40, { steps: 5 }); await page.mouse.up(); await sleep(150);
  check(same(await box(page, '#calc-panel'), p2), 'dragging inside the calculator does not move the panel');
  // resize from the corner
  const rs = await box(page, '#calc-rs');
  await page.mouse.move(rs.x + 10, rs.y + 10); await page.mouse.down(); await page.mouse.move(rs.x + 70, rs.y - 70, { steps: 8 }); await page.mouse.up(); await sleep(200);
  const p3 = await box(page, '#calc-panel');
  check(Math.abs(p3.w - (p2.w + 60)) <= 2 && Math.abs(p3.h - (p2.h - 80)) <= 2 && p3.x === p2.x && p3.y === p2.y, 'resize from the corner: +60 wide, −80 high, position unchanged');
  // expand / collapse twice: two fixed sizes
  const sizes = [];
  for (let k = 0; k < 2; k++) {
    await page.click('#calc-exp'); await sleep(250); const big = await box(page, '#calc-panel');
    await page.click('#calc-exp'); await sleep(250); const small = await box(page, '#calc-panel');
    sizes.push([big, small]);
  }
  check(same(sizes[0][0], sizes[1][0]) && sizes[0][0].w > p3.w && sizes[0][0].r <= W, 'Expand → the same big size every time: ' + sizes[0][0].w + '×' + sizes[0][0].h);
  check(same(sizes[0][1], p3) && same(sizes[1][1], p3), 'Collapse → exactly the size before (no shrinking by itself)');
  await page.click('#calc-exp'); await sleep(200); await shot(page, 'calc_' + tag + '_expanded'); await page.click('#calc-exp'); await sleep(200);
  // close / open: remembered
  await page.click('#calc-x'); await sleep(150); await page.click('#tool-calc'); await sleep(300);
  check(same(await box(page, '#calc-panel'), p3), 'close + open → same size and place');
  // window gets smaller then back: stays inside, size kept when it fits
  await page.setViewportSize({ width: W - 200, height: H - 100 }); await sleep(300);
  const pS = await box(page, '#calc-panel');
  check(pS.r <= W - 200 && pS.b <= H - 100 && pS.x >= 0 && pS.y >= 0, 'window made smaller → panel still inside the window');
  await page.setViewportSize({ width: W, height: H }); await sleep(300);
  const pB = await box(page, '#calc-panel');
  check(pB.w === pS.w && pB.h === pS.h, 'window back to full size → the panel does not grow by itself');
  await shot(page, 'calc_' + tag + '_after');
  await page.close();
}

(async () => {
  const E = await setup();
  try {
    await laptop(E, 1280, 800, 'l1280');
    await laptop(E, 1440, 900, 'l1440');
    console.log('phone 390×844');
    const { page } = await E.newPage('phone');
    await openSet(page, E, 'FX-T01');
    await page.click('#tool-calc'); await page.waitForSelector('#calc-panel.on'); await sleep(400);
    const vp = page.viewportSize(), p = await box(page, '#calc-panel'), f = await box(page, '#fbar');
    check(p.x === 0 && Math.abs(p.w - vp.width) <= 1 && p.b <= f.y + 1 && p.h > vp.height * 0.3, 'phone: bottom sheet, full width, above the Back/Next bar (' + p.w + '×' + p.h + ')');
    check(await page.$eval('#calc-x', e => getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width >= 30), 'phone: a clear × close button');
    const before = await box(page, '#calc-panel'), hb = await box(page, '#calc-head .ttl');
    await page.touchscreen.tap(hb.x + 5, hb.y + 5);
    check(same(await box(page, '#calc-panel'), before), 'phone: the sheet does not move');
    await shot(page, 'calc_phone_open');
    await page.click('#calc-exp'); await sleep(250);
    const full = await box(page, '#calc-panel');
    check(full.h > before.h && full.y >= 0, 'phone: Expand → full height');
    await page.click('#calc-exp'); await sleep(250);
    check(same(await box(page, '#calc-panel'), before), 'phone: Collapse → back to the sheet');
    await page.click('#calc-x'); await sleep(200);
    check(!(await page.$eval('#calc-panel', e => e.classList.contains('on'))), 'phone: × closes it');
    await shot(page, 'calc_phone_closed');
    const spr = await page.$('#qwrap .q .spr-prev');
    check(!spr || /Your answer will be read as:/.test(await page.$eval('#qwrap .q .spr-prev', e => e.textContent)), 'grid-in: "Your answer will be read as:" instead of "Answer Preview"');
  } catch (e) { console.error(e); check(false, 'exception: ' + e.message); }
  await E.close();
  process.exit(summary() ? 1 : 0);
})();
