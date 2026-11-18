// #70 clean-up: no narrator text left (Minh: "people should use the product without reading instructions") and the set time
// = Σ (time to the final answer − time outside the window), each question capped at 20 min ("capped" on hover).
const fs = require('fs'), path = require('path');
const { makeGas } = require('./server');
const H = require('./h'); const { check } = H;
const SRC = path.join(__dirname, '..', 'src');
const all = fs.readdirSync(SRC).filter(f => /\.(html|gs)$/.test(f)).map(f => fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n');
const GONE = ['Enter your student code to start', 'Your teacher gives you the code', 'You stay signed in on this device', 'Tick skills to give them in one assignment',
  'Change anything, then Assign', 'weakest skills that count most', 'answers in the last', 'This week: +', 'Read the question twice', 'Practise for speed',
  'Time = time to your final answer', 'What your teacher saw', 'Tip:', 'The app makes the sign-in code', 'Copy it now and give it to the student',
  'Questions students asked you about', 'Untimed, like practice. Tick topics', 'Not enough answers yet to recommend skills', 'Nobody in this list has done this question',
  'Pick another period above', 'Questions you miss (or that take you long) come here', 'You can go back to any question in this', 'Need to stop for today?',
  'You can take a break and start', 'Take your time. Your answers are saved as you go', 'Your practice now starts at the right level',
  'Your teacher will go over the results with you', 'Good sets in a row', 'Level per skill', "'Timing: '", "'<p class=\"t-line\">Mistake types: '", 'Slow / rushed', 'Placement tests</h2>'];
console.log('[no narrator text]');
GONE.forEach(t => check(all.indexOf(t) < 0, 'gone: "' + t + '"'));
check(!/prefers-color-scheme/.test(all), 'light only: no dark theme anywhere');

console.log('[set time: away removed, 20-min cap]');
{
  const G = makeGas(), C = G.ctx;
  const t = C.setTimeOf_([{ time_try1_sec: 300 }, { time_try1_sec: 26754, away_sec: 26000 }, { time_try1_sec: 3000 }, { time_try1_sec: 20, away_sec: 50 }]);
  check(t.min === Math.round((300 + 754 + 1200 + 0) / 6) / 10 && t.capped === 1, 'Σ (time − away), capped at 20 min each: ' + t.min + ' min, 1 capped');
  C.appendObjects_('Sets', [{ set_id: 'S-20261118-FX-T01-90', student_code: 'FX-T01', kind: 'practice', skill: 'H.B', n: 2, qids: 'a,b', status: 'submitted', created_at: '2026-11-18 10:00:00', submitted_at: '2026-11-18 10:30:00', first_try: 1, best_score: 1, time_used_min: 472.5 }]);
  C.appendObjects_('Responses', [{ set_id: 'S-20261118-FX-T01-90', student_code: 'FX-T01', qid: 'a', order: 1, skill: 'H.B', try1_correct: 1, time_try1_sec: 28000, away_sec: 100, submitted_at: '2026-11-18 10:30:00' },
                                 { set_id: 'S-20261118-FX-T01-90', student_code: 'FX-T01', qid: 'b', order: 2, skill: 'H.B', try1_correct: 0, time_try1_sec: 90, submitted_at: '2026-11-18 10:30:00' }]);
  G.fresh();
  const p = G.call('studentProfile', ['TEACH-FX-9', 'FX-T01']), row = p.sets.find(x => x.set_id === 'S-20261118-FX-T01-90');
  check(row.time_min === 21.5 && row.capped === 1 && p.totals.time_min === 21.5, 'profile Sets: the 472.5-min set now 21.5 min (capped), the total too');
  const r = G.call('teacherResult', ['TEACH-FX-9', 'S-20261118-FX-T01-90']);
  check(r.pace.time_min === 21.5 && r.pace.capped === 1, 'Result (teacher): the same corrected time');
}
process.exit(H.summary() ? 1 : 0);
