// Browser suite, placement test (made-up FX4 forms): teacher assigns a Placement test → the student starts it from the
// Assigned card → one question at a time (no Back, no question list, "time is recorded"), a skipped question asks first,
// leave + come back resumes at the current question → result = Strong / Medium / Weak per area only → teacher report
// (areas, teach first, items + time bands, question panel with the key). No key or short code ever reaches the student.
const fs = require('fs'), path = require('path');
const { setup, shot, englishOnly, login, waitMath, check, summary, sleep } = require('./h');

(async () => {
  const E = await setup();
  const G = () => E.st.gas;
  try {
    const forms = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'placement_forms_fx4.json'), 'utf8'));
    G().ctx.appendObjects_('Placement_Forms', forms.map(r => ({ form: r[0], domain: r[1], slot: r[2], level: r[3], skill: r[4], code: r[5], qid: '' }))); G().fresh();
    const slotOf = {}; forms.forEach(r => { slotOf[r[6]] = r[1] + ' ' + r[2]; });
    const Q = {}; G().table('Questions').forEach(r => { Q[r.qid] = r; });
    const key = id => String(Q[id].key).replace(/^'/, '');

    console.log('teacher assigns a placement test');
    const { page: tp } = await E.newPage('desktop1280');
    await login(tp, E.url, 'TEACH-FX-9');
    await tp.waitForSelector('#t-students');
    await tp.click('.t-nav [data-go="build"]');
    await tp.waitForSelector('#b-kind-pl');
    await tp.click('#b-kind-pl');
    await tp.selectOption('#b-to', 'st:FX-T01');
    check(await tp.$eval('#b-title', e => e.value) === 'Placement test' && /15–24 questions/.test(await tp.$eval('#b-sub', e => e.textContent)), 'builder: "Placement test" switch, title + what it does');
    check((await tp.$$eval('#b-form option', a => a.map(o => o.value))).join(',') === 'auto,A,B', 'form: Auto (A first time, B retake) · A · B');
    await shot(tp, 'e2e_pl_builder');
    await tp.click('#b-plpub');
    await tp.waitForSelector('.t-asgpl');
    check(/Placement test · form auto/.test(await tp.$eval('.t-asgpl', e => e.innerText)), 'assignments tab: the placement test, form auto, not started');

    console.log('student: one question at a time');
    const { page } = await E.newPage('desktop1280');
    await login(page, E.url, 'FX-T01');
    await page.waitForSelector('#placement-card');
    check(/About 15–24 questions, one at a time · no timer/.test(await page.$eval('#placement-card', e => e.innerText)), 'Assigned card: "Placement test · about 15–24 questions, one at a time · no timer"');
    await shot(page, 'e2e_pl_home');
    await page.click('#placement-card .hz-btn');
    await page.waitForSelector('#btn-begin');
    const dir = await page.$eval('#v-directions', e => e.innerText);
    check(/8–24\s*questions/.test(dir) && /time on each question is recorded/.test(dir) && /cannot go back/.test(dir), 'directions: 8–24 questions, "take your time — the time is recorded", no going back');
    await shot(page, 'e2e_pl_directions');
    await page.click('#btn-begin');
    await page.waitForSelector('#qwrap .q.on'); await waitMath(page);
    check(await page.$eval('#nav-label', e => e.textContent) === 'Question 1' && !(await page.isVisible('#btn-back')) && !(await page.isVisible('#qwrap .q.on .q-mark')), '"Question 1" (no total), no Back, no Mark for Review');
    await page.click('#btn-nav'); await sleep(200);
    check(!(await page.$eval('#nav-pop', e => e.classList.contains('on'))), 'the question list does not open');
    await shot(page, 'e2e_pl_q1');
    const answer = async (right) => {
      const box = await page.$('#qwrap .q.on'), qid = await box.getAttribute('data-qid'), k = key(qid);
      const spr = await box.$('.spr-in');
      if (spr) { await spr.fill(right ? k : '999'); await spr.press('Tab'); await sleep(250); }
      else await (await box.$('.ch-row[data-l="' + (right ? k : ['A', 'B', 'C', 'D'].find(l => l !== k)) + '"] .ch')).click();
      return qid;
    };
    const next = async () => {
      const before = await page.$eval('#nav-label', e => e.textContent);
      await page.click('#btn-next');
      await page.waitForFunction(b => (document.querySelector('#nav-label') || {}).textContent !== b || document.querySelector('#pl-doms'), before, { timeout: 20000 });
      await sleep(150);
    };
    const seen = [];
    seen.push(await answer(true)); await next();
    seen.push(await answer(true)); await next();
    // a question without an answer: asked first
    const q3 = await page.$eval('#qwrap .q.on', e => e.getAttribute('data-qid'));
    await page.click('#btn-next');
    await page.waitForSelector('#modal-root.on');
    check(/Go on without an answer\?/.test(await page.$eval('#modal-root', e => e.innerText)), 'Next with no answer → "Go on without an answer?"');
    await shot(page, 'e2e_pl_skip');
    await page.click('#modal-root .btns button:first-child'); await sleep(200);
    check(await page.$eval('#qwrap .q.on', e => e.getAttribute('data-qid')) === q3, '"Answer it" → stays on the question');
    seen.push(await answer(true)); await next();
    // leave + come back: resumes at the current question
    const cur = await page.$eval('#qwrap .q.on', e => e.getAttribute('data-qid'));
    await page.click('#tool-more'); await page.waitForSelector('#mm-save', { state: 'visible' });
    await page.click('#mm-save'); await page.waitForSelector('#placement-card');
    await page.waitForFunction(() => /3\s*answered/i.test(document.querySelector('#placement-card').innerText), null, { timeout: 10000 }).catch(() => {});
    check(/3\s*answered/i.test(await page.$eval('#placement-card', e => e.innerText)) && /Continue/.test(await page.$eval('#placement-card .hz-btn', e => e.textContent)), 'More → Save and continue later → home: focus card "Continue", ring "3 answered"');
    await page.click('#placement-card .hz-btn');
    await page.waitForSelector('#v-directions.on, #v-question.on');
    if (await page.$('#v-directions.on')) { check(true, 'continue → directions again (Begin)'); await page.click('#v-directions.on #btn-begin'); }
    await page.waitForSelector('#qwrap .q.on'); await waitMath(page);
    check(await page.$eval('#qwrap .q.on', e => e.getAttribute('data-qid')) === cur && await page.$eval('#nav-label', e => e.textContent) === 'Question 4', 'continue → back at question 4 (' + slotOf[cur] + ')');
    for (let i = 0; i < 30 && !(await page.$('#pl-doms')); i++) { seen.push(await answer(true)); await next(); }
    await page.waitForSelector('#pl-doms');
    const words = await page.$$eval('#pl-doms .pl-dom b', a => a.map(x => x.textContent));
    check(seen.length === 15 && words.join(',') === 'Strong,Strong,Strong,Strong', 'all right: ' + seen.length + ' questions → Strong in the 4 areas');
    const res = await page.$eval('#result-body', e => e.innerText);
    check(!/[EMH]96\d\d|✓|✗|Answer/.test(res), 'result: areas only — no codes, no right/wrong per question');
    await shot(page, 'e2e_pl_result');
    await page.click('#res-home'); await page.waitForSelector('#history');
    check(!(await page.$('#placement-card')) && /Placement test/.test(await page.$eval('#history', e => e.innerText)), 'home: card gone, "Placement test" in History');
    const leak = E.st.rpcLog.filter(r => r.fn !== 'teacherHome' && !/^(placementReport|teacher|questionPanel|classView|assignmentTree|publishAssignment|studentProfile)/.test(r.fn))
      .filter(r => /\\?"(key|accepted|rationale_html|tags)\\?"\s*:/.test(r.res) || /\\?"code\\?"\s*:\s*\\?"[EMH]\d/.test(r.res));
    check(!leak.length, 'no key / short code in ' + E.st.rpcLog.filter(r => /^(getSet|placementNext|homeData|getResult|autosave|startAssignment)$/.test(r.fn)).length + ' student payloads' + (leak.length ? ' — ' + leak[0].fn : ''));

    console.log('teacher report');
    await tp.click('.t-nav [data-go="home"]'); await tp.waitForSelector('#t-students');
    await tp.click('#t-students [data-prof="FX-T01"]');
    await tp.waitForSelector('.t-plsum [data-plrep]');
    check(/Strong/.test(await tp.$eval('.t-plsum', e => e.innerText)), 'profile: "Placement tests" table (form A, Strong ×4)');
    await tp.click('.t-plsum [data-plrep]');
    await tp.waitForSelector('#pl-items');
    const rep = await tp.$eval('#t-body', e => e.innerText);
    check(/Form A/.test(rep) && /15 questions/.test(rep) && (rep.match(/Practice starts: Hard/g) || []).length === 4, 'report: form A · 15 questions · practice starts Hard in the 4 areas');
    check((await tp.$$('#pl-items tr[data-q]')).length === 15 && /fast|normal/.test(rep) && /Nothing below Strong/.test(rep), 'every question with code, slot, time band; teach first: nothing below Strong');
    await shot(tp, 'e2e_pl_report');
    await tp.click('#pl-items tr[data-q]');
    await tp.waitForSelector('#scr-test.going #go-show');
    check(!(await tp.$('#scr-test .ch.rv-key')) && (await tp.$$('.go-box')).length === 9 && await tp.$('.go-note'), 'a question of the report opens on the test screen: no key, 9 level boxes, the Placement note');
    await tp.click('#go-show'); await tp.waitForSelector('.go-key');
    check(/Correct answer/.test(await tp.$eval('#fb-go', e => e.textContent)), 'Show answer → the correct answer (teacher only)');
    await shot(tp, 'e2e_pl_panel');
    await tp.click('#btn-view-back'); await tp.waitForSelector('#pl-items');

    console.log('#63 Sets list: Result … Go over, Placement too');
    { // a practice set too, so the list has both kinds
      const g = G(); g.fresh(); const sp = g.call('startPractice', ['FX-T01', 'H.B', 5]); g.fresh();
      const t = g.call('getSet', ['FX-T01', sp.set_id, {}]), ans = {}, evs = [{ part: 'P', t_ms: 0, qid: null, type: 'part_start', value: 'P' }]; let tt = 0;
      t.questions.forEach((q, i) => { evs.push({ part: 'P', t_ms: tt, qid: q.qid, type: 'q_enter', value: i + 1 }); tt += 30000; ans[q.qid] = i ? key(q.qid) : (Q[q.qid].type === 'spr' ? '999' : ['A', 'B', 'C', 'D'].find(l => l !== key(q.qid))); evs.push({ part: 'P', t_ms: tt - 500, qid: q.qid, type: 'select', value: ans[q.qid] }); evs.push({ part: 'P', t_ms: tt, qid: q.qid, type: 'q_leave', value: null }); });
      g.fresh(); g.call('submit', ['FX-T01', sp.set_id, { state: { v: 1, current_part: 'P', phase: 'review', part_starts: { P: Date.now() - 300000 }, ended: {}, parts: { P: { cur: 0, ans, elim: {}, mark: {}, ask: {}, hl: {} } } }, events: evs, ev_from: 0, copy: t.copy }]); g.fresh();
    }
    await tp.click('#pl-prof'); await tp.waitForSelector('#t-sets');
    await tp.click('.t-nav [data-go="home"]'); await tp.waitForSelector('#t-students'); await tp.click('#t-students [data-prof="FX-T01"]');
    await tp.waitForFunction(() => document.querySelectorAll('#t-sets [data-sgo]').length >= 1 && document.querySelectorAll('#t-sets [data-plgo]').length >= 1, null, { timeout: 20000 });
    const gap = await tp.evaluate(() => { const one = (a, b) => { const x = document.querySelector(a).getBoundingClientRect(), y = document.querySelector(b).getBoundingClientRect(); return { gap: Math.round(y.left - x.right), h: Math.round(x.height) }; };
      return { practice: one('#t-sets [data-res]', '#t-sets [data-sgo]'), placement: one('#t-sets [data-plrep]', '#t-sets [data-plgo]'), labels: [...document.querySelectorAll('#t-sets .t-rowbtns')].map(e => e.innerText.replace(/\s+/g, ' ')) }; });
    check(gap.practice.gap >= 20 && gap.placement.gap >= 20 && gap.practice.h >= 34 && gap.labels.every(l => l === 'Result Go over'), 'Sets list: "Result" and "Go over" are two buttons ' + gap.practice.gap + ' px apart, ' + gap.practice.h + ' px tall — practice AND placement rows (' + JSON.stringify(gap.labels) + ')');
    await tp.$eval('#t-sets', e => e.scrollIntoView({ block: 'center' })); await sleep(200);
    await shot(tp, 'go63_sets_laptop');
    await tp.$eval('#t-sets [data-plrep]', e => e.click()); await tp.waitForSelector('#pl-items');
    check(/Placement test/.test(await tp.$eval('#t-body h1', e => e.textContent)), 'Placement "Result" → the placement report (2×2 areas, unchanged)');
    await tp.click('#pl-prof'); await tp.waitForSelector('#t-sets [data-plgo]');
    E.st.rpcLog = [];
    await tp.$eval('#t-sets [data-plgo]', e => e.click());
    await tp.waitForSelector('#scr-test.going #go-show'); await waitMath(tp);
    check(/of 15/.test(await tp.$eval('#nav-label', e => e.textContent)) && !!(await tp.$('#go-wrong')) && !(await tp.$('#scr-test .ch.rv-key')), 'Placement "Go over" → the test screen over its 15 questions in order (Wrong only box; nothing wrong here → all), no key on screen');
    await tp.click('#go-stu'); await tp.waitForFunction(() => /\d+:\d\d/.test(document.querySelector('#go-strip').innerText));
    await tp.click('#go-show'); await tp.waitForSelector('.go-key');
    check(true, 'Student\'s answer + Show answer work on Placement questions');
    await tp.click('#btn-view-back'); await tp.waitForSelector('#t-sets');
    check(true, 'Back → the profile');
    await tp.$eval('#t-sets [data-sgo]', e => e.click());
    await tp.waitForSelector('#scr-test.going #go-show');
    check(await tp.$eval('#go-wrong', e => e.checked) && /of 1\b/.test(await tp.$eval('#nav-label', e => e.textContent)), 'Practice "Go over" → the test screen too, Wrong only ON (1 wrong of 5)');
    await tp.click('#btn-view-back'); await tp.waitForSelector('#t-sets');
    const ip = (await E.newPage('ipad')).page;
    await login(ip, E.url, 'TEACH-FX-9'); await ip.waitForSelector('#t-students'); await ip.tap('#t-students [data-prof="FX-T01"]');
    await ip.waitForSelector('#t-sets [data-plgo]'); await ip.$eval('#t-sets', e => e.scrollIntoView({ block: 'center' })); await sleep(300);
    const ipFit = await ip.evaluate(() => { const b = document.querySelector('#t-sets [data-sgo]').getBoundingClientRect(); return b.right <= innerWidth + 1 && b.height >= 34; });
    check(ipFit, 'iPad: the two buttons fit and are ≥ 34 px tall');
    await shot(ip, 'go63_sets_ipad');
    await ip.context().close();
    englishOnly(E);
  } catch (e) { console.error(e); check(false, 'exception: ' + e.message); }
  await E.close();
  process.exit(summary() ? 1 : 0);
})();
