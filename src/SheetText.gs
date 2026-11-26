/**
 * SAT Math Lib — texts written into the Sheet on every deploy (README, Dictionary, Settings meanings). English only.
 * Edit them HERE (the Sheet copies are overwritten by the next deploy).
 */
var SETTING_MEANINGS_ = {
  app_name: 'Name shown in the app.',
  teacher_code: 'Code for teacher mode (type it in the normal sign-in box). Empty = teacher mode off. Never write it anywhere else.',
  desmos_api_key: 'Desmos API key (empty = Desmos demo key, testing only).',
  autosave_sec: 'Seconds between automatic saves while a student works.',
  set_sizes: 'Set sizes a student can choose.',
  mcq_max_tries: 'Multiple-choice: tries in total (first + fixes) before the question is locked.',
  good_set_pct: 'A practice set is "good" when First Try is at least this share (2 good sets in a row → level up).',
  weak_set_pct: 'A practice set is "weak" when First Try is below this share (→ level down).',
  recent_window: 'How many latest first tries of a skill make the recent accuracy.',
  recent_decay: 'Weight of each older answer in the recent accuracy (newest = 1).',
  missed_share: 'Share of a set used to re-check sub-skills the student missed.',
  probes_per_set: 'Questions per set from a sub-skill the student has never tried.',
  standin_min: 'Practice only: below this many live Easy + Medium items in a skill, Hard levels 1/2/3 stand in for Easy/Medium/Hard (3 since 13 Nov: with College Board items every skill has real E/M). Assignments never use stand-ins.',
  strong_r: 'Recent accuracy at level Hard from which Hard level-3 items are picked first.',
  block_days: 'A question answered in the last N days is not served again (unless nothing else is left).',
  retry_wait_days: 'A missed question may come back after this many days.',
  progress_dot_min: 'Answers needed before a progress dot gets a colour.',
  dot_green: 'Progress dot green from this accuracy.',
  dot_amber: 'Progress dot amber from this accuracy (below = red).',
  guess_min_time_sec: 'An answer given in less time than this is flagged GUESS_LIKELY (time to the final answer).',
  away_min_sec: 'Leaving the set window for less than this many seconds is not recorded (all sets).',
  away_flag_sec: 'Placement test: a question left for at least this many seconds and then answered right gets ⚠ for the teacher (a sign, not proof).',
  away_notice_placement: 'Yes = the Placement test tells the student it notes leaving the window (start screen + a calm note on return). Practice never shows a message.',
  fast_ratio: 'Fallback when no Time_Norms row fits: time below this × 120 s = rushed.',
  slow_ratio: 'Fallback when no Time_Norms row fits: time above this × 120 s = slow.',
  mistake_placeholder: 'First line of the mistake-type dropdown.',
  mistake_types: 'Mistake types for the teacher, separated by ";" (order = dropdown order).',
  ask_note_max: 'Max characters of a student\'s "Ask teacher" note.',
  pl_easy_fast_sec: 'Placement: an Easy item right within this many seconds = "fast" (shown to the teacher only).',
  pl_easy_max_sec: 'Placement: an Easy item right within this many seconds = 1 step up; slower = slow (half a step).',
  pl_medium_fast_sec: 'Placement: Medium "fast" up to this many seconds.',
  pl_medium_max_sec: 'Placement: a Medium item right within this many seconds = 1 step up; slower = half a step.',
  pl_hard_fast_sec: 'Placement: Hard "fast" up to this many seconds (time recorded only; at Hard any right counts).',
  pl_hard_max_sec: 'Placement: Hard "normal" up to this many seconds (time recorded only).',
  pl_spr_extra_sec: 'Placement: extra seconds for a grid-in (typed answer) in every band.',
  pl_slow_credit: 'Placement: a slow right answer counts this much of a step (1 step = one level up).',
  pl_max_per_domain: 'Placement: most items per domain (then the highest level passed decides).',
  pl_easy_cap: 'Placement: after this many Easy items without moving up, the domain stops (Weak).',
  pl_strong_run: 'Placement: Hard items right in a row for Strong.',
  pl_wrong_stop: 'Placement: the domain stops at the Nth wrong answer at the same level.',
  pl_pattern: 'Placement: order of the domains (repeats; ALG turns go to ADV once Algebra is done).',
  pl_adv_medium_if: 'Placement: Advanced Math starts at Medium when the Algebra result is this level (H = Strong).',
  mod_minutes: 'Real-test module: minutes per module (timer; at 0:00 the module is submitted).',
  mod_gridin_slots: 'Real-test module: positions of the grid-in (typed answer) questions (6 of 22 ≈ 25 %, College Board positions).',
  mod_route_raw: 'Full test (Module 1 + 2): Module 1 right answers needed for the harder Module 2 (fewer → the easier one).',
  mod_levels_m1: 'Module 1: one entry per question in order, "target allowed" (levels E1–E3, M1–M3, H1–H3); the count = questions per module.',
  mod_levels_m2h: 'Module 2 (harder): one entry per question, "target allowed".',
  mod_levels_m2e: 'Module 2 (easier): one entry per question, "target allowed".',
  mod_bands_m1: 'Module 1: domains per band of positions (H Algebra, P Advanced Math, Q Problem-Solving and Data, S Geometry and Trig).',
  mod_bands_m2h: 'Module 2 (harder): domains per band of positions.',
  mod_bands_m2e: 'Module 2 (easier): domains per band of positions.',
  mod_gridin_domains: 'Real-test module: wished domains of the grid-in questions (when the library has them).',
  mod_skill_caps: 'Real-test module: most questions of one College Board skill ("other" = every skill not listed).',
  mod_sub_cap: 'Real-test module: most questions of one sub-skill (and never two in a row).',
  mod_min_skills: 'Real-test module: aim for at least this many different skills.',
  mod_min_forms: 'Real-test module: aim for at least this many ways of asking (question forms).',
  mod_form_cap: 'Real-test module: most questions asked the same way (and never 3 in a row).',
  mod_min_figures: 'Real-test module: aim for at least this many questions with a figure or table (early in the module).',
  mod_exclude_cb_pt: 'Yes = real-test modules never use the 432 College Board practice-test items (students often take those tests in Bluebook).',
  mod_level_step: 'Score estimate: ability distance between two neighbour levels (E1 … H3) in the difficulty adjustment.',
  mod_prior_sd: 'Score estimate: how far the ability may go from the middle (keeps all-right / all-wrong finite).',
  mod_range_one: 'Score estimate: ± points shown for one module alone.',
  mod_range_full: 'Score estimate: ± points shown for Module 1 + Module 2.',
  mod_easy_cap: 'Score estimate: highest middle of the range after an easier Module 2.',
  mod_hard_floor: 'Score estimate: lowest middle of the range after a harder Module 2 (full test).',
  code_version: 'Code version + commit whose Sheet update has run (set automatically after each deploy).'
};

var README_ROWS_ = [
  ['SAT Math Lib – Data', ''],
  ['What this is', 'The database of the SAT Math Lib app. The app writes most tabs itself. Question text, figures and keys are NOT here: they are in the private Drive folder "SAT Math Lib - Library".'],
  ['Students', 'One row per student: code (what they type to sign in), name, active (Yes/No).'],
  ['Sets', 'One row per practice set / assignment / review set: questions, status, First Try, Best Score, time.'],
  ['Responses', 'One row per set × question: answer, right/wrong, time, profile (RIGHT, SLOW_RIGHT, FAST_WRONG …), mistake type, ask-teacher note.'],
  ['Questions', 'One row per library question (no text): skill, sub-skill, difficulty, key, status. A key typed here wins over the library file. status = hold → never served.'],
  ['Batches', 'One row per library file. live = Yes → its questions are served; a new batch starts as No.'],
  ['Skills', 'The skill list (domain → College Board skill → sub-skill), written from the taxonomy on each deploy.'],
  ['Settings', 'Numbers and options the app reads (meaning next to each).'],
  ['Time_Norms', 'Normal time per question (seconds) by difficulty and type; below "fast" = rushed, above "slow" = slow. Editable.'],
  ['Levels', 'One row per student × College Board skill: the practice level (E / M / H, start M), recent accuracy, good sets in a row. 2 good sets → up, 1 weak set → down. Students never see it.'],
  ['Review', 'One row per question in a student\'s Review list (wrong / blank / slow on the first try). It leaves after one clean try in Review (status cleared).'],
  ['Tries', 'Every answer check: try 1 at submit, then each "Fix wrong answers" check (multiple choice: 3 tries in total, then locked; grid-in: no limit).'],
  ['Item_Overrides', 'A question harder or easier than its label: one row per question (qid) with the level to use (difficulty E/M/H + level 1-3). The app reads it instead of the Questions tab everywhere (practice, Mixed, the builder, labels, time norms) — not for the Placement forms. Set from the go-over screen (set_by = teacher) or by a batch (e.g. set_by = QK). Last write wins; log keeps the history. Delete a row to go back to the College Board level.'],
  ['Skill_Profile', 'One row per skill: which difficulties exist on the real SAT (allowed), how often it comes up (weight = % of Mixed Practice items), max_set (practice by skill offers only this many). Edit freely; the app reads it at once.'],
  ['Placement_Forms', 'The placement test: one row per form (A first time, B retake) × domain × slot (E1–E3, M1–M4, H1–H4) with the question code. Edit a code here to swap an item.'],
  ['Placements', 'One row per finished placement test: level per domain (H Strong, M Medium, E Weak, <E below Easy), level per tested skill, "teach first" skills, the path.'],
  ['Modules', 'One row per real-test module a student got (Module 1, Module 2 easier / harder): its questions\' levels, the substitutions the builder made, raw score, route, and on the last module of a test the score range (estimate, not a College Board score).'],
  ['Item_Forms', 'Written by every deploy: the way each question asks (form), figure / table, words — the real-test module builder reads it (no question text here).'],
  ['Gridin_Keys', 'Written by every deploy: live grid-in questions whose key cannot be typed in the answer box (5 characters, 6 with "-"), or with accepted forms the SAT rule does not count. Fix them in the library; the app shows only typeable answers.'],
  ['Gridin_Regrade', 'Written by every deploy: past grid-in answers whose grade changes under the official SAT entry rules (#108), and whether the change was applied.'],
  ['Other tabs', 'Classes, Assignments (kind placement = a placement test, kind module = a real-test module), Skill_Summary: filled by the app (teacher page).'],
  ['Dictionary', 'Every column of every tab explained.']
];

var DICT_ = {
  Students: { student_code: 'Code the student types to sign in (unique).', name: 'Name shown in the app.', active: 'Yes = can sign in.', classes: 'Classes of the student (filled by the app).', created_in: 'app / sheet', created_at: 'When the student was added.', note: 'Free text.' },
  Sets: { set_id: 'S-<date>-<code>-<n>.', kind: 'practice / mixed / assignment / review / placement / module (real-test module)', skill: 'College Board skill code of a practice set.', n: 'Questions in the set.', qids: 'The questions, in order.', status: 'in_progress / submitted / abandoned', first_try: 'Right on the first try.', best_score: 'Right on any try (first try + fixed later).', time_used_min: 'Minutes on the questions (time away not counted).', time_answer_min: 'Minutes until each final answer was chosen (all questions).', time_check_min: 'Minutes on answered questions after their final answer (checking).', time_blank_min: 'Minutes on questions left blank.', away_n: 'Times the student left the set window (≥ away_min_sec).', away_sec: 'Seconds away from the window in total.', away_at: 'Questions open when the student left, e.g. Q7, Q12.', state_json: 'Saved answers (used to resume).', progress: 'Live progress, e.g. "3/10 answered · Q4".' },
  Responses: { ask_code: 'Short code of a question the student asked about (students never see codes; this is for you).', try1_answer: 'Answer on the first try.', try1_correct: '1 right / 0 wrong / blank.', best_correct: '1 = right on some try.', time_try1_sec: 'Seconds to the final answer in the set (first try): revisits after it without a change do not count.', time_answer_sec: 'Same: seconds to the final answer (0 = blank). Rushed / Slow and the Placement time bands use it.', time_total_sec: 'All seconds on the question (incl. checking after the answer, Fix tries).', away_n: 'Times the student left the window on this question.', away_sec: 'Seconds away on this question.', profile: 'RIGHT, SLOW_RIGHT, FAST_WRONG (rushed), SLOW_WRONG (didn\'t know), WRONG, BLANK — from Time_Norms.', flags: 'CHANGED_R_TO_W, CHANGED_W_TO_R, GUESS_LIKELY, ELIM_KEY, IDLE_LIKELY, LEFT_THEN_RIGHT (Placement: left the window ≥ away_flag_sec, then right).', mistake_type: 'Teacher\'s mistake type (dropdown).', asked: 'Yes = the student asked the teacher about this question.' },
  Questions: { qid: '<batch>-<number> (College Board: CB-<id>).', code: 'Short question code (E326, M12, H604): shown small on the question; use it in the teaching PDF.', key_file: 'The key as the library file gave it last time (a different key typed in `key` = yours, and it wins).', accepted_file: 'Same for the grid-in accepted forms.', batch: 'Library file.', skill: 'Official College Board skill (separate from sub-skill).', subskill: 'Sub-skill code (taxonomy).', difficulty: 'E / M / H.', level: '1–3 inside a difficulty.', key: 'App key (typed here = wins over the file).', accepted: 'Grid-in: every accepted form, separated by |.', status: 'live / hold / excluded / candidate.' },
  Levels: { level: 'E / M / H — which difficulty mix the next practice set of this skill gets.', recent_pct: 'Weighted accuracy of the latest 10 first tries in the skill (0–1).', good_streak: 'Good practice sets in a row (≥ good_set_pct).', history: 'Level changes, e.g. "M→H 14 Nov".' },
  Review: { reason: 'wrong / blank / slow (first try).', status: 'open / cleared.', n_served: 'Times served in a Review set.', cleared_by: 'pass (one clean try) / teacher.' },
  Tries: { try_no: '1 = the submitted answer; 2, 3 … = fixes.', correct: '1 right / 0 wrong.', time_sec: 'Seconds for this try.' },
  Item_Overrides: { difficulty: 'E, M or H to use for this question.', level: '1, 2 or 3 inside the difficulty.', old_difficulty: 'The level before the last change (CB or an earlier override).', set_by: 'teacher, QK, …', log: 'History: date · who · old → new.' },
  Skill_Profile: { allowed: 'Difficulties that exist on the SAT for this skill (E,M,H). No E: an Easy slot gets Medium level 1. No H: a Hard slot gets the hardest Medium (+ the few Hard items).', weight: 'Share of Mixed Practice items (%, the app scales the column to 100).', max_set: 'Practice by skill offers only this many questions (empty = 5/10/20).' },
  Placement_Forms: { form: 'A (first placement) or B (retake).', domain: 'ALG Algebra · ADV Advanced Math · PSD Problem-Solving and Data · GEO Geometry and Trig.', slot: 'E1–E3 Easy, M1–M4 Medium, H1–H4 Hard (H4: Advanced Math only).', code: 'Short code of the question (the app finds the qid).', qid: 'Library qid (used when it exists).' },
  Placements: { alg: 'Algebra result: H Strong · M Medium · E Weak · <E below Easy.', skill_levels: 'Level per tested skill (written to Levels).', teach_first: 'The 3 tested skills to teach first.', path: 'Every item in order: domain, slot, F right in time / S slow right / W wrong.', prev_set_id: 'The placement before this one (retake comparison).' },
  Gridin_Keys: { problem: 'key_untypeable = the key does not fit the box; accepted_untypeable = forms too long; accepted_display_only = a listed form the rule marks wrong (a short rounded decimal); no_typeable_answer = nothing typeable is right.', show_answer: 'What Show answer prints (typeable forms only).' },
  Gridin_Regrade: { student: 'Student name.', what: 'first try / best after Fix / Fix try N.', was: 'Grade stored before.', now: 'Grade by the SAT rule.', applied: 'yes = the stored grade was corrected; no = logged only (dry run, placement or real-test module).' },
  Modules: { test_id: 'Set id of the first module of the test (Module 1 + Module 2 share it).', mode: 'What the teacher assigned: M1, M2E, M2H or FULL (Module 1 + adaptive Module 2).',
             module: 'M1 / M2E (easier Module 2) / M2H (harder Module 2).', levels: 'Level of each question in order.', subs: 'Where the builder had to substitute (one line per slot).',
             stats: 'Skills, question forms, figures, grid-ins, domains of the module.', raw: 'Right answers in this module.', route: 'Module 2 the student got (M2E / M2H).',
             cb_raw: 'The College Board raw score (0–54) the estimate uses (raw scaled to 54 + difficulty adjustment).', score_lo: 'Score range (estimate), lower end.', score_hi: 'Score range, upper end.', score_mid: 'Middle of the range.' },
  Batches: { live: 'Yes = served to students.', n_live: 'Questions with status live.', file_id: 'Drive file id of the batch JSON.' }
};
function syncSheetTexts_() {
  var sh = ss_().getSheetByName('README');
  if (sh) {
    sh.getRange(1, 1, Math.max(sh.getLastRow(), 1), 2).clearContent();
    ensureGrid_(sh, README_ROWS_.length + 2, 2);
    sh.getRange(1, 1, README_ROWS_.length, 2).setValues(README_ROWS_);
    try { sh.getRange(1, 1).setFontWeight('bold'); sh.getRange(2, 1, README_ROWS_.length - 1, 1).setFontWeight('bold'); sh.setColumnWidth(1, 160); sh.setColumnWidth(2, 760); sh.getRange(1, 2, README_ROWS_.length, 1).setWrap(true); } catch (e) {}
  }
  var rows = [];
  TABS_.forEach(function (t) { if (!t[1]) return; t[1].forEach(function (c) { rows.push({ tab: t[0], column: c, meaning: (DICT_[t[0]] || {})[c] || '', example: '' }); }); });
  rewriteTable_('Dictionary', function () { return false; }, rows);
  return 'texts: README + Dictionary (' + rows.length + ' columns)';
}
