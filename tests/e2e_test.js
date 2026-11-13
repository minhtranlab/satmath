// Browser end-to-end (Chromium, made-up fixture library): the live smoke test, run locally.
// sign in → home (three columns) → Linear functions, 5 → set (no timer) → answer → Check Your Work → submit → result
// (First Try / Best Score) → open a question (read-only, no key) → home history. Wrong code. No key in any payload.
const { setup, shot, englishOnly, login, waitMath, check, summary, sleep } = require('./h');

(async () => {
  const E = await setup();
  try {
    const { page } = await E.newPage('desktop1280');
    console.log('wrong code');
    await login(page, E.url, 'NOPE-1');
    await page.waitForFunction(() => /not found/i.test(document.querySelector('#login-err').textContent));
    check(true, 'wrong code → "Code not found", stays on sign-in');
    check(!E.st.rpcLog.some(r => r.fn !== 'login'), 'nothing but login was called');

    console.log('sign in + home');
    await login(page, E.url, 'FX-T01');
    await page.waitForSelector('#picker .sm-it');
    await shot(page, 'e2e_home');
    check(await page.$eval('#home-hello', e => /^Hi Test\./.test(e.textContent)), 'greeting with first name');
    check((await page.$$('#picker .sm-c1 .sm-it')).length === 4, '4 areas');
    const lf = await page.$('#picker [data-k="H.B"]');
    check(!!lf, 'Linear functions in the skill column');
    await lf.click();
    check(await page.$eval('#picker .sm-c3 h3', e => e.textContent) === 'Linear functions', 'panel shows the chosen skill');
    check((await page.$$('#picker .sm-subl div')).length >= 5, 'its sub-skills listed (progress only)');
    await page.click('#picker [data-n="5"]');
    check(await page.$eval('#btn-start', e => e.textContent) === 'Start 5 questions', '5 / 10 / 20 → "Start 5 questions"');

    console.log('the set');
    await page.click('#btn-start');
    await page.waitForSelector('#btn-begin');
    await waitMath(page);
    check(await page.$eval('#v-directions', e => /No\s*timer/i.test(e.innerText)), 'start card: "No timer"');
    check(await page.$eval('#timer', e => getComputedStyle(e).visibility === 'hidden'), 'no timer in the top bar');
    await shot(page, 'e2e_start');
    await page.click('#btn-begin');
    await page.waitForSelector('#qwrap .q.on');
    await waitMath(page);
    check(await page.$eval('#timer', e => getComputedStyle(e).visibility === 'hidden'), 'no timer while answering');
    check(!(await page.isHidden('#tool-calc')) && !(await page.isHidden('#tool-ref')), 'Calculator + Reference available');
    const n = await page.$$eval('#qwrap .q', a => a.length);
    check(n === 5, '5 questions');
    await shot(page, 'e2e_q1');
    for (let i = 0; i < n; i++) {
      const box = await page.$('#qwrap .q.on');
      const spr = await box.$('.spr-in');
      if (i === 0) { /* leave the first one blank */ }
      else if (spr) { await spr.fill('3/4'); await spr.press('Tab'); await sleep(200); }
      else { const ch = await box.$$('.ch'); await ch[i % ch.length].click(); }
      await page.click('#btn-next');
      await sleep(150);
    }
    await page.waitForSelector('#v-review.on');
    check(await page.$eval('#v-review', e => /1<\/b> unanswered|1 unanswered/.test(e.innerHTML) || /1\s*unanswered/.test(e.innerText)), 'Check Your Work: 1 unanswered');
    await page.click('#btn-next');
    await page.waitForSelector('#modal-root.on');
    check(await page.$eval('#modal-root', e => /Submit this set\?/.test(e.innerText) && /blank: they count as wrong/.test(e.innerText)), 'confirm: "Submit this set?" + blank warning');
    await page.click('#modal-root .btns button:last-child');
    await page.waitForSelector('#score-first');
    await shot(page, 'e2e_result');
    const ft = await page.$eval('#score-first .v', e => e.textContent), bs = await page.$eval('#score-best .v', e => e.textContent);
    check(/^\d\/5$/.test(ft) && ft === bs, 'result: First Try ' + ft + ', Best Score ' + bs);
    check(await page.$eval('#result-body', e => /Correct answers are never shown/.test(e.innerText)), 'result says correct answers are never shown');
    const cells = await page.$$('#result-body .rgrid .rcell');
    check(cells.length === 5, 'grid of 5 questions');
    await cells[1].click();
    await page.waitForSelector('#view-bar span');
    await waitMath(page);
    const bar = await page.$eval('#view-bar', e => e.innerText);
    check(/Your answer/.test(bar) && !/Correct answer/.test(bar) && !(await page.$('#rv-show')), 'review: own answer shown, no correct answer, no Show answer button');
    await shot(page, 'e2e_review');
    await page.click('#btn-view-back');
    await page.click('#res-home');
    await page.waitForSelector('#history');
    const hist = await page.$eval('#history', e => e.innerText);
    check(/Linear functions/.test(hist) && hist.includes(ft), 'home history: the set with its First Try');

    console.log('payloads');
    const bad = E.st.rpcLog.filter(r => /"key"|"accepted"|key_source|"tags"|drive_id|transcription_notes/.test(r.res));
    check(!bad.length, 'no key / accepted / tags / drive id in ' + E.st.rpcLog.length + ' server→browser payloads' + (bad.length ? ' → ' + bad.map(b => b.fn).join(',') : ''));
    englishOnly(E);
  } catch (e) { console.error(e); check(false, 'exception: ' + e.message); }
  await E.close();
  process.exit(summary() ? 1 : 0);
})();
