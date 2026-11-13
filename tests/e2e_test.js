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
      if (i === 0) {
        check(!(await page.$('#qwrap .q-code')) && /Question 1 of 5/.test(await page.$eval('#nav-label', e => e.textContent)), 'no question code for students (it would show E/M/H): only "Question 1 of 5"');
        check(await page.$$eval('#qwrap .stem .nw', a => a.length) > 0, 'math + the punctuation after it kept together (no "?" alone on a line)');
      }
      if (i === 1) {
        await (await box.$('.q-ask')).click();
        await (await box.$('.ask-in')).fill('I do not get the graph');
        check(await box.$eval('.q-askrow', e => getComputedStyle(e).display !== 'none'), 'Ask teacher: note box opens');
      }
      if (i === 0) { /* leave the first one blank */ }
      else if (spr) { await spr.fill('3/4'); await spr.press('Tab'); await sleep(200); }
      else { const ch = await box.$$('.ch'); await ch[i % ch.length].click(); }
      await page.click('#btn-next');
      await sleep(150);
    }
    await page.waitForSelector('#v-review.on');
    check(await page.$eval('#v-review', e => /1<\/b> unanswered|1 unanswered/.test(e.innerHTML) || /1\s*unanswered/.test(e.innerText)), 'Check Your Work: 1 unanswered');
    await page.click('#btn-save-later');
    await page.waitForSelector('#pickup .hz-resume button');
    check(/4\/5 answered/.test(await page.$eval('#pickup', e => e.innerText)), 'Save and continue later → home: "Continue · 4/5 answered"');
    await page.click('#pickup .hz-resume button');
    await page.waitForSelector('#v-review.on');
    check(true, 'Continue → back on Check Your Work');
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
    check(/Q2/.test(await page.$eval('#asked-list', e => e.innerText)), 'result: "You asked your teacher about: Q2"');

    console.log('fix wrong answers');
    const Qt = {}; E.st.gas.table('Questions').forEach(r => { Qt[r.qid] = r; });
    await page.click('#btn-fix');
    await page.waitForSelector('#btn-check');
    await waitMath(page);
    let fixed = 0;
    for (let k = 0; k < 6; k++) {
      const cur = await page.$('#qwrap .q.on'); if (!cur) break;
      const qid = await cur.getAttribute('data-qid'), key = String(Qt[qid].key).replace(/^'/, '');
      if (!(await page.$('#btn-check'))) { if (await page.$('#btn-next:not([disabled])')) { await page.click('#btn-next'); await sleep(200); continue; } break; }
      if (Qt[qid].type === 'spr') {
        await (await cur.$('.spr-in')).fill('98'); await page.click('#btn-check'); await page.waitForFunction(() => /Not yet/.test(document.querySelector('#view-bar').innerText));
        check(true, 'grid-in wrong → "Not yet"');
        await (await cur.$('.spr-in')).fill(key);
      } else {
        const wrong = ['A', 'B', 'C', 'D'].find(l => l !== key);
        await (await cur.$('.ch-row[data-l="' + wrong + '"] .ch')).click(); await page.click('#btn-check');
        await page.waitForFunction(() => /Not yet/.test(document.querySelector('#view-bar').innerText));
        check(await cur.$eval('.ch-row[data-l="' + wrong + '"]', e => e.classList.contains('tried')) && /2 tries left/.test(await page.$eval('#view-bar', e => e.innerText)), 'MCQ wrong → "Not yet — 2 tries left", the letter crossed out');
        await (await cur.$('.ch-row[data-l="' + key + '"] .ch')).click();
      }
      await page.click('#btn-check');
      await page.waitForFunction(() => /Fixed/.test(document.querySelector('#view-bar').innerText));
      fixed++;
      await shot(page, 'e2e_fix');
      break;
    }
    check(fixed === 1, 'right answer → "✓ Fixed" (the key itself never sent)');
    await page.click('#btn-view-back');
    await page.waitForSelector('#score-best');
    const bs2 = await page.$eval('#score-best .v', e => e.textContent);
    check(Number(bs2.split('/')[0]) === Number(ft.split('/')[0]) + 1, 'Best Score after the fix: ' + bs2 + ' (First Try still ' + await page.$eval('#score-first .v', e => e.textContent) + ')');
    await page.click('#res-home');
    await page.waitForSelector('#history');
    check(await page.$eval('#assigned', e => /Nothing from your teacher/.test(e.innerText)), 'home: "Assigned by your teacher" (empty for now)');
    check(/Mixed Practice/.test(await page.$eval('#mixed-card', e => e.innerText)) && (await page.$$('#mixed-card [data-mn]')).length === 3, 'home: "Mixed Practice" card with 5 / 10 / 20');
    check(/\d+ questions? to review/.test(await page.$eval('#review-card', e => e.innerText)), 'home: Review card "n questions to review"');
    await shot(page, 'e2e_home2');
    const hist = await page.$eval('#history', e => e.innerText);
    check(/Linear functions/.test(hist) && hist.includes(ft), 'home history: the set with its First Try');

    console.log('review area');
    await page.click('#btn-review');
    await page.waitForSelector('#btn-begin');
    check((await page.$eval('#tb-title', e => e.textContent)) === 'Review', 'Review mini-set opens ("Review")');

    console.log('payloads');
    const bad = E.st.rpcLog.filter(r => /"key"|"accepted"|key_source|"tags"|drive_id|transcription_notes/.test(r.res));
    check(!bad.length, 'no key / accepted / tags / drive id in ' + E.st.rpcLog.length + ' server→browser payloads' + (bad.length ? ' → ' + bad.map(b => b.fn).join(',') : ''));
    englishOnly(E);
  } catch (e) { console.error(e); check(false, 'exception: ' + e.message); }
  await E.close();
  process.exit(summary() ? 1 : 0);
})();
