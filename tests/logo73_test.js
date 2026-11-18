// #73 the new logo (design/logo/final/can-final): favicon files on the site wrapper, the web app favicon, the mark in the
// teacher header (28 px), the student header (26 px) and above "Ready to practise?" (48 px).
const fs = require('fs'), path = require('path');
const H = require('./h'); const { check, shot } = H;
/** Draw the element's background image on a canvas: how many pixels are really painted (a broken data URI paints none). */
const painted = (page, sel) => page.$eval(sel, e => new Promise(res => {
  const u = getComputedStyle(e).backgroundImage.replace(/^url\(["']?/, '').replace(/["']?\)$/, ''), img = new Image();
  img.onload = () => { const c = document.createElement('canvas'); c.width = c.height = 48; const x = c.getContext('2d'); x.drawImage(img, 0, 0, 48, 48);
    const d = x.getImageData(0, 0, 48, 48).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 100) n++; res(n); };
  img.onerror = () => res(-1); img.src = u;
}));
const SITE = path.join(__dirname, '..', 'site');
console.log('[files]');
['icon.svg', 'icon-180.png', 'favicon.ico', 'icon-32.png', 'icon-192.png', 'icon-512.png'].forEach(f => check(fs.existsSync(path.join(SITE, f)) && fs.statSync(path.join(SITE, f)).size > 300, 'site/' + f));
const svg = fs.readFileSync(path.join(SITE, 'icon.svg'), 'utf8'), html = fs.readFileSync(path.join(SITE, 'index.html'), 'utf8');
check(/#324dc7/.test(svg) && /#7d8fe0/.test(svg), 'site/icon.svg = the chosen mark (blue tile, light top-right cell)');
check(/href="favicon\.ico"/.test(html) && /href="icon\.svg"/.test(html) && /href="icon-180\.png"/.test(html), 'site page links favicon.ico + icon.svg + icon-180.png');
check(/setFaviconUrl\('https:\/\/minhtranlab\.github\.io\/satmath\/icon-32\.png'\)/.test(fs.readFileSync(path.join(__dirname, '..', 'src', 'Code.gs'), 'utf8')), 'web app favicon = the site PNG');
(async () => {
  const E = await H.setup();
  try {
    for (const dev of ['desktop1280', 'phone', 'ipad']) {
      const tag = dev === 'desktop1280' ? 'laptop' : dev;
      let { page } = await E.newPage(dev); await page.goto(E.url); await page.waitForSelector('#login-code');
      const m = await page.$eval('.hz-si-mark', e => { const r = e.getBoundingClientRect(), h = document.querySelector('.hz-si h1').getBoundingClientRect(); return { w: r.width, above: r.bottom <= h.top, bg: getComputedStyle(e).backgroundImage }; });
      const pm = await painted(page, '.hz-si-mark');
      check(m.w === 48 && m.above && pm > 300, dev + ': sign-in: the 48 px mark above the heading (' + pm + ' px painted)');
      await shot(page, 'logo73_signin_' + tag);
      await H.login(page, E.url, 'FX-T01'); await page.waitForSelector('#scr-home.on .hz-wm i');
      const s = await page.$eval('#scr-home .hz-wm i', e => ({ w: e.getBoundingClientRect().width, bg: getComputedStyle(e).backgroundImage }));
      const ps = await painted(page, '#scr-home .hz-wm i');
      check(s.w === 26 && /aebcf2/.test(decodeURIComponent(s.bg)) && ps > 300, dev + ': student header: the 26 px mark (no blue dot; ' + ps + ' px painted)');
      await page.screenshot({ path: path.join(H.SHOTS, 'logo73_student_' + tag + '.png'), clip: { x: 0, y: 0, width: page.viewportSize().width, height: 90 } });
      await page.context().close();
      ({ page } = await E.newPage(dev)); await H.login(page, E.url, 'TEACH-FX-9'); await page.waitForSelector('#t-students');
      const t = await page.$eval('#scr-teacher .brand-mark', e => ({ w: e.getBoundingClientRect().width, txt: e.textContent.trim(), bg: getComputedStyle(e).backgroundImage }));
      const pt = await painted(page, '#scr-teacher .brand-mark');
      check(t.w === 28 && t.txt === '' && pt > 300, dev + ': teacher header: the 28 px mark instead of "SM" (' + pt + ' px painted)');
      await page.screenshot({ path: path.join(H.SHOTS, 'logo73_teacher_' + tag + '.png'), clip: { x: 0, y: 0, width: page.viewportSize().width, height: 90 } });
      await page.context().close();
    }
  } catch (e) { console.error(e); check(false, 'exception: ' + e.message); }
  await E.close();
  process.exit(H.summary() ? 1 : 0);
})();
