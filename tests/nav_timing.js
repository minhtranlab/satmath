// #43 timing of "next question" per mode with a slow server (LAT ms per call, like the live app). Not part of CI.
// node nav_timing.js <tag> [LAT]  → prints a table + writes .work/nav_<tag>.json
const fs = require('fs'), path = require('path');
const H = require('./h'); const { sleep } = H;
const TAG = process.argv[2] || 'run', LAT = Number(process.argv[3] || 2500);

(async () => {
  const E = await H.setup(); const out = {};
  const G = () => E.st.gas;
  const t = async (name, fn) => { const a = Date.now(); try { await fn(); out[name] = Date.now() - a; } catch (e) { out[name] = 'error: ' + e.message.split('\n')[0]; } console.log(name.padEnd(48), out[name]); };
  try {
    const Q = {}; G().table('Questions').forEach(r => { Q[r.qid] = r; });
    const key = id => String(Q[id].key).replace(/^'/, '');
    const { page } = await E.newPage('desktop1280');
    await H.login(page, E.url, 'FX-T01'); await page.waitForSelector('#picker .sm-it');
    E.st.latency = LAT;
    const label = () => page.$eval('#nav-label', e => e.textContent).catch(() => '');
    const nextQ = async (name) => {
      const b = await label();
      await t(name, async () => { await page.click('#btn-next'); await page.waitForFunction(x => { const l = document.querySelector('#nav-label'); return (l && l.textContent !== x) || document.querySelector('#v-review.on'); }, b, { timeout: 30000 }); });
    };
    const answerOn = async (right) => {
      const box = await page.$('#qwrap .q.on'), qid = await box.getAttribute('data-qid'), k = key(qid), spr = await box.$('.spr-in');
      if (spr) { await spr.fill(right ? k : '999'); await spr.press('Tab'); await sleep(150); }
      else await (await box.$('.ch-row[data-l="' + (right ? k : ['A', 'B', 'C', 'D'].find(l => l !== k)) + '"] .ch')).click();
    };
    // practice by skill
    await page.click('#picker [data-k="H.B"]'); await page.click('#picker [data-n="5"]');
    await t('practice: Start → first screen', async () => { await page.click('#btn-start'); await page.waitForSelector('#btn-begin', { timeout: 30000 }); });
    await page.click('#btn-begin'); await page.waitForSelector('#qwrap .q.on');
    await answerOn(false); await nextQ('practice: Next → next question');
    await answerOn(true); await nextQ('practice: Next (2)');
    for (let i = 0; i < 3; i++) { await answerOn(i % 2 === 0); await page.click('#btn-next'); await sleep(100); }
    await page.waitForSelector('#v-review.on');
    await t('practice: Submit → result', async () => { await page.click('#btn-next'); await page.waitForSelector('#modal-root.on'); await page.click('#modal-root .btns button:last-child'); await page.waitForSelector('#score-first', { timeout: 30000 }); });
    // fix
    await page.click('#btn-fix'); await page.waitForSelector('#btn-check', { timeout: 30000 });
    for (let k = 0; k < 5; k++) {
      const cur = await page.$('#qwrap .q.on'); const qid = await cur.getAttribute('data-qid');
      if (!(await page.$('#btn-check'))) { await page.click('#btn-next'); await sleep(300); continue; }
      const kk = key(qid);
      if (Q[qid].type === 'spr') await (await cur.$('.spr-in')).fill('98');
      else { const tried = await cur.$$eval('.ch-row.tried', a => a.map(e => e.getAttribute('data-l'))); await (await cur.$('.ch-row[data-l="' + ['A', 'B', 'C', 'D'].find(l => l !== kk && tried.indexOf(l) < 0) + '"] .ch')).click(); }
      await sleep(3000);                                              // the student thinks (prefetch may run)
      await t('fix: Check (wrong) → "Not yet"', async () => { await page.click('#btn-check'); await page.waitForFunction(() => /Not yet|Locked/.test(document.querySelector('#view-bar').innerText), null, { timeout: 30000 }); });
      if (Q[qid].type === 'spr') await (await cur.$('.spr-in')).fill(kk); else await (await cur.$('.ch-row[data-l="' + kk + '"] .ch')).click();
      await t('fix: Check (right) → "Fixed"', async () => { await page.click('#btn-check'); await page.waitForFunction(() => /Fixed/.test(document.querySelector('#view-bar').innerText), null, { timeout: 30000 }); });
      break;
    }
    await t('fix: back to the result', async () => { await page.click('#btn-view-back'); await page.waitForSelector('#score-best', { timeout: 30000 }); });
    await t('result → home', async () => { await page.click('#res-home'); await page.waitForSelector('#picker .sm-it', { timeout: 30000 }); });
    // mixed
    await t('mixed: Start → first screen', async () => { await page.click('#btn-mixed'); await page.waitForSelector('#btn-begin', { timeout: 30000 }); });
    await page.click('#btn-begin'); await page.waitForSelector('#qwrap .q.on');
    await answerOn(true); await nextQ('mixed: Next → next question');
    await t('mixed: leave → home', async () => {
      if (await page.$('#btn-exit')) { await page.click('#btn-exit'); await page.waitForSelector('#modal-root.on'); await page.click('#modal-root .btns button:last-child'); }
      else { await page.click('#btn-more'); await page.click('#mm-save'); }
      await page.waitForSelector('#picker .sm-it', { timeout: 30000 });
    }).catch(() => {});
    // placement (made-up FX4 forms)
    E.st.latency = 0;
    const forms = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'placement_forms_fx4.json'), 'utf8'));
    G().ctx.appendObjects_('Placement_Forms', forms.map(r => ({ form: r[0], domain: r[1], slot: r[2], level: r[3], skill: r[4], code: r[5], qid: '' }))); G().fresh();
    G().ctx.publishAssignment('TEACH-FX-9', { kind: 'placement', target: 'st:FX-T01', title: 'Placement test', form: 'auto' });
    G().fresh();
    await page.evaluate(() => { try { localStorage.removeItem('tz_active'); } catch (e) {} });
    await page.reload(); await page.waitForSelector('#placement-card', { timeout: 30000 });
    E.st.latency = LAT;
    await t('placement: Start → first screen', async () => { await page.click('#placement-card .hz-btn'); await page.waitForSelector('#btn-begin', { timeout: 30000 }); });
    await page.click('#btn-begin'); await page.waitForSelector('#qwrap .q.on');
    for (let i = 0; i < 4; i++) { await answerOn(i !== 1); await sleep(3000); await nextQ('placement: Next → next question (' + (i + 1) + ')'); }
  } catch (e) { console.error(e); }
  E.st.latency = 0;
  fs.writeFileSync(path.join(__dirname, '.work', 'nav_' + TAG + '.json'), JSON.stringify({ latency_ms: LAT, at: new Date().toISOString(), steps: out }, null, 1));
  await E.close(); process.exit(0);
})();
