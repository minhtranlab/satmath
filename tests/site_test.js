// #39 nice link: site/index.html (GitHub Pages wrapper, the Test Zone way) shows the app full screen in a cross-site iframe.
// Static: only the deployment link, noindex, icons, no data. Browser (wrapper on 127.0.0.1, app on localhost = two sites,
// like github.io → script.google.com): laptop + phone → student sign-in and home; the teacher signs in on the same screen.
const http = require('http'), fs = require('fs'), path = require('path');
const H = require('./h'); const { check, sleep } = H;
const SITE = path.join(__dirname, '..', 'site');
const LIVE = 'https://script.google.com/macros/s/' + fs.readFileSync(path.join(__dirname, '..', '.deployment'), 'utf8').trim() + '/exec';

console.log('[wrapper page: static]');
const html = fs.readFileSync(path.join(SITE, 'index.html'), 'utf8');
const urls = html.match(/https?:\/\/[^\s"'<>)]+/g) || [];
check(urls.length === 2 && urls.every(u => u === LIVE), 'site/index.html loads only the Apps Script deployment link (' + urls.length + '×)');
check(/<meta name="robots" content="noindex, nofollow">/.test(html) && /<title>SAT Math Lib<\/title>/.test(html) && /name="viewport"[^>]+width=device-width/.test(html), 'title "SAT Math Lib", mobile viewport, robots noindex, nofollow');
check(!/<script[^>]+src=|<link[^>]+stylesheet|fonts\.g|analytics|gtag/i.test(html), 'no outside scripts, fonts or trackers');
check(!/stem_html|"key"|data:image|TEST-[A-Z0-9]{6}|teacher_code|token|api[_-]?key/i.test(html.replace(/<!--[\s\S]*?-->/g, '')), 'no question data, codes, keys or tokens in the page');
check(fs.readdirSync(SITE).sort().join(',') === 'icon-180.png,icon.svg,index.html', 'site/ = index.html + 2 icons, nothing else');
check(/XFrameOptionsMode\.ALLOWALL/.test(fs.readFileSync(path.join(__dirname, '..', 'src', 'Code.gs'), 'utf8')), 'Code.gs: the app may be shown inside the wrapper (ALLOWALL)');

(async () => {
  const E = await H.setup();
  const wport = 9100 + Math.floor(Math.random() * 500);
  const page0 = html.split(LIVE).join(E.url);
  const ws = http.createServer((req, res) => {
    const u = req.url.split('?')[0], f = u === '/' ? 'index.html' : u.slice(1);
    if (f === 'index.html') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(page0); return; }
    const p = path.join(SITE, path.basename(f));
    if (fs.existsSync(p)) { res.writeHead(200, { 'content-type': /svg$/.test(p) ? 'image/svg+xml' : 'image/png' }); res.end(fs.readFileSync(p)); return; }
    res.writeHead(404); res.end();
  }).listen(wport);
  const WRAP = 'http://127.0.0.1:' + wport + '/';
  const frameOf = async (page) => { for (let i = 0; i < 60; i++) { const f = page.frames().find(x => x.url().startsWith(E.url)); if (f && await f.$('#login-code').catch(() => null)) return f; await sleep(250); } return null; };
  try {
    for (const dev of ['desktop1280', 'phone']) {
      console.log('[' + dev + ']');
      const { page } = await E.newPage(dev);
      await page.goto(WRAP);
      const f = await frameOf(page);
      check(!!f && await page.title() === 'SAT Math Lib', 'the link opens the student sign-in inside the page (title "SAT Math Lib")');
      const box = await page.$eval('#app', e => { const r = e.getBoundingClientRect(); return [r.width, r.height, innerWidth, innerHeight]; });
      check(box[0] === box[2] && box[1] === box[3], 'the app fills the screen (' + box[0] + '×' + box[1] + ')');
      await f.fill('#login-code', 'FX-T01'); await f.click('#login-btn');
      await f.waitForSelector('#picker .sm-it', { timeout: 30000 });
      check(true, 'student signs in → home with the skill picker');
      await H.shot(page, 'site_' + dev + '_student');
      const { page: tp } = await E.newPage(dev);
      await tp.goto(WRAP); const tf = await frameOf(tp);
      await tf.fill('#login-code', 'TEACH-FX-9'); await tf.click('#login-btn');
      await tf.waitForSelector('#t-students', { timeout: 30000 });
      check(true, 'teacher signs in with the teacher code on the same link → teacher page');
      await H.shot(tp, 'site_' + dev + '_teacher');
      await page.close(); await tp.close();
    }
  } catch (e) { console.error(e); check(false, 'exception: ' + e.message); }
  ws.close(); await E.close();
  process.exit(H.summary() ? 1 : 0);
})();
