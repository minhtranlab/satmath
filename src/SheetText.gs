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
  standin_min: 'Below this many live Easy + Medium items in a skill, Hard levels 1/2/3 stand in for Easy/Medium/Hard.',
  strong_r: 'Recent accuracy at level Hard from which Hard level-3 items are picked first.',
  block_days: 'A question answered in the last N days is not served again (unless nothing else is left).',
  retry_wait_days: 'A missed question may come back after this many days.',
  progress_dot_min: 'Answers needed before a progress dot gets a colour.',
  dot_green: 'Progress dot green from this accuracy.',
  dot_amber: 'Progress dot amber from this accuracy (below = red).',
  guess_min_time_sec: 'An answer given in less time than this is flagged GUESS_LIKELY.',
  fast_ratio: 'Fallback when no Time_Norms row fits: time below this × 120 s = rushed.',
  slow_ratio: 'Fallback when no Time_Norms row fits: time above this × 120 s = slow.',
  mistake_placeholder: 'First line of the mistake-type dropdown.',
  mistake_types: 'Mistake types for the teacher, separated by ";" (order = dropdown order).',
  ask_note_max: 'Max characters of a student\'s "Ask teacher" note.',
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
  ['Other tabs', 'Classes, Assignments, Skill_Summary: filled by later versions of the app (teacher page).'],
  ['Dictionary', 'Every column of every tab explained.']
];

var DICT_ = {
  Students: { student_code: 'Code the student types to sign in (unique).', name: 'Name shown in the app.', active: 'Yes = can sign in.', classes: 'Classes of the student (filled by the app).', created_in: 'app / sheet', created_at: 'When the student was added.', note: 'Free text.' },
  Sets: { set_id: 'S-<date>-<code>-<n>.', kind: 'practice / assignment / review', skill: 'College Board skill code of a practice set.', n: 'Questions in the set.', qids: 'The questions, in order.', status: 'in_progress / submitted / abandoned', first_try: 'Right on the first try.', best_score: 'Right on any try (first try + fixed later).', time_used_min: 'Minutes on the questions (time away not counted).', state_json: 'Saved answers (used to resume).', progress: 'Live progress, e.g. "3/10 answered · Q4".' },
  Responses: { try1_answer: 'Answer on the first try.', try1_correct: '1 right / 0 wrong / blank.', best_correct: '1 = right on some try.', time_try1_sec: 'Seconds on the question (first try).', profile: 'RIGHT, SLOW_RIGHT, FAST_WRONG (rushed), SLOW_WRONG (didn\'t know), WRONG, BLANK — from Time_Norms.', flags: 'CHANGED_R_TO_W, CHANGED_W_TO_R, GUESS_LIKELY, ELIM_KEY, IDLE_LIKELY.', mistake_type: 'Teacher\'s mistake type (dropdown).', asked: 'Yes = the student asked the teacher about this question.' },
  Questions: { qid: '<batch>-<number> (College Board: CB-<id>).', code: 'Short question code (E326, M12, H604): shown small on the question; use it in the teaching PDF.', key_file: 'The key as the library file gave it last time (a different key typed in `key` = yours, and it wins).', accepted_file: 'Same for the grid-in accepted forms.', batch: 'Library file.', skill: 'Official College Board skill (separate from sub-skill).', subskill: 'Sub-skill code (taxonomy).', difficulty: 'E / M / H.', level: '1–3 inside a difficulty.', key: 'App key (typed here = wins over the file).', accepted: 'Grid-in: every accepted form, separated by |.', status: 'live / hold / excluded / candidate.' },
  Levels: { level: 'E / M / H — which difficulty mix the next practice set of this skill gets.', recent_pct: 'Weighted accuracy of the latest 10 first tries in the skill (0–1).', good_streak: 'Good practice sets in a row (≥ good_set_pct).', history: 'Level changes, e.g. "M→H 14 Nov".' },
  Review: { reason: 'wrong / blank / slow (first try).', status: 'open / cleared.', n_served: 'Times served in a Review set.', cleared_by: 'pass (one clean try) / teacher.' },
  Tries: { try_no: '1 = the submitted answer; 2, 3 … = fixes.', correct: '1 right / 0 wrong.', time_sec: 'Seconds for this try.' },
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
