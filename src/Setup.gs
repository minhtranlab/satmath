/**
 * SAT Math Lib — the Sheet's tabs and columns (spec v1.1 §10). The per-deploy update (Update.gs) creates missing tabs and
 * appends missing columns at the END of row 1; it never moves, renames or deletes anything Minh typed.
 * Editor-only functions refuse to run when called through the web app (requireEditor_).
 */

var TABS_ = [
  ['README', null],
  ['Settings', ['key', 'value', 'meaning']],
  ['Students', ['student_code', 'name', 'active', 'classes', 'created_in', 'created_at', 'note']],
  ['Classes', ['class_id', 'name', 'student_codes', 'active', 'created_in', 'note']],
  ['Sets', ['set_id', 'student_code', 'kind', 'skill', 'assignment_id', 'n', 'qids', 'level_at_start', 'slots', 'created_at',
            'submitted_at', 'status', 'first_try', 'best_score', 'n_blank', 'time_used_min', 'sittings', 'current_q', 'last_saved_at',
            'events_saved', 'state_json', 'copy_token', 'progress', 'hidden', 'device',
            'time_answer_min', 'time_check_min', 'time_blank_min', 'away_n', 'away_sec', 'away_at', 'subskill']],
  ['Responses', ['set_id', 'student_code', 'qid', 'order', 'skill', 'subskill', 'difficulty', 'level', 'try1_answer', 'try1_correct',
                 'final_answer', 'best_correct', 'n_tries', 'locked', 'fixed_at', 'n_changes', 'change_pattern', 'eliminated', 'ever_marked',
                 'visits', 'time_try1_sec', 'time_total_sec', 'pace_ratio', 'calc_used', 'ref_used', 'profile', 'flags', 'mistake_type',
                 'mistake_note', 'tagged_at', 'tagged_in', 'asked', 'ask_note', 'ask_at', 'ask_status', 'resolved_at', 'submitted_at', 'ask_code',
                 'time_answer_sec', 'away_n', 'away_sec', 'resolved_by']],
  ['Tries', ['set_id', 'student_code', 'qid', 'try_no', 'answer', 'correct', 'time_sec', 'at']],
  ['Review', ['student_code', 'qid', 'reason', 'from_set', 'added_at', 'status', 'n_served', 'cleared_at', 'cleared_by']],
  ['Levels', ['student_code', 'skill', 'level', 'recent_pct', 'good_streak', 'n_items', 'last_set_id', 'updated_at', 'history']],
  ['Assignments', ['assignment_id', 'title', 'target_type', 'target_id', 'topics', 'qids', 'available_from', 'due', 'status',
                   'created_at', 'created_in', 'note', 'kind', 'form']],
  ['Skill_Profile', ['skill', 'name', 'allowed', 'weight', 'max_set', 'note']],
  ['Placement_Forms', ['form', 'domain', 'slot', 'level', 'skill', 'code', 'qid', 'note']],
  ['Item_Overrides', ['qid', 'code', 'difficulty', 'level', 'old_difficulty', 'old_level', 'set_by', 'set_at', 'note', 'log']],
  ['Placements', ['set_id', 'student_code', 'form', 'assignment_id', 'finished_at', 'n_items', 'n_right', 'time_min', 'alg', 'adv', 'psd', 'geo',
                  'skill_levels', 'teach_first', 'path', 'prev_set_id']],
  ['Modules', ['set_id', 'student_code', 'assignment_id', 'test_id', 'mode', 'module', 'n', 'levels', 'subs', 'stats', 'raw', 'by_domain', 'route', 'cb_raw',
               'score_lo', 'score_hi', 'score_mid', 'built_at', 'finished_at']],
  ['Item_Forms', ['qid', 'form', 'fig', 'words']],
  ['Skill_Summary', ['student_code', 'skill', 'subskill', 'n_seen', 'n_try1', 'n_try1_right', 'try1_pct', 'best_pct', 'last5_pct',
                     'avg_pace_ratio', 'n_fast_wrong', 'n_slow_wrong', 'n_slow_right', 'n_blank', 'top_mistake_type', 'n_untagged',
                     'n_asked_open', 'last_practised', 'verdict']],
  ['Questions', ['qid', 'batch', 'version', 'version_of', 'type', 'domain', 'skill', 'subskill', 'subskill2', 'difficulty', 'level',
                 'twin_group', 'key', 'accepted', 'key_source', 'cb_question_id', 'status', 'flags', 'tag_status', 'added_at', 'note', 'code', 'key_file', 'accepted_file']],
  ['Batches', ['batch', 'title', 'source_type', 'n_items', 'n_live', 'n_E', 'n_M', 'n_H', 'uploaded_at', 'live', 'file_id', 'note']],
  ['Skills', ['domain', 'domain_name', 'skill', 'skill_name', 'subskill', 'subskill_name', 'order', 'active']],
  ['Events', ['set_id', 't_ms', 'qid', 'type', 'value', 'logged_at']],
  ['Dictionary', ['tab', 'column', 'meaning', 'example']]
];

/** Editor-only guard (Test Zone): the web app runs "as Me", so a caller through it has an EMPTY active user while the
 *  effective user is the owner → blocked. In the editor both are the owner (or both empty) → allowed. */
function requireEditor_() {
  var a = '', e = '';
  try { a = String(Session.getActiveUser().getEmail() || ''); } catch (x) {}
  try { e = String(Session.getEffectiveUser().getEmail() || ''); } catch (x) {}
  if (e && a.toLowerCase() !== e.toLowerCase()) throw new Error('Run this function from the Apps Script editor.');
}
function checkSheet() { requireEditor_(); console.log(checkSheet_()); }
function syncLibrary() { requireEditor_(); _forceFresh = true; console.log(syncLibrary_()); }

/** Create missing tabs (with header row), append missing columns. A new, empty spreadsheet's "Sheet1" becomes README. */
function ensureTabs_() {
  var ss = ss_(), made = [], cols = 0;
  var s1 = ss.getSheetByName('Sheet1') || ss.getSheetByName('Trang tính1');
  if (s1 && !ss.getSheetByName('README') && s1.getLastRow() === 0) { s1.setName('README'); made.push('README (was Sheet1)'); }
  TABS_.forEach(function (t, i) {
    var sh = ss.getSheetByName(t[0]);
    if (!sh) { sh = ss.insertSheet(t[0]); made.push(t[0]); }
    if (!t[1]) return;
    var have = sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); }) : [];
    var miss = t[1].filter(function (h) { return have.indexOf(h) < 0; });
    if (!miss.length) return;
    ensureGrid_(sh, 2, have.length + miss.length);
    sh.getRange(1, have.length + 1, 1, miss.length).setValues([miss]).setFontWeight('bold');
    try { sh.setFrozenRows(1); } catch (e) {}
    cols += miss.length;
  });
  return 'tabs: ' + (made.length ? 'created ' + made.join(', ') : 'all there') + (cols ? ' · columns added: ' + cols : '');
}

var SETTINGS_MIGRATE_ = { standin_min: { from: 10, to: 3 } };
/** Settings rows the code needs (value only when the row is new; Minh's values are never changed). */
function ensureSettingsRows_() {
  var t = readTable_('Settings'), have = {};
  t.rows.forEach(function (r) { have[String(r.key).trim()] = r; });
  var add = [], moved = [];
  // one-time changes of a default that was never edited (the old default is still there): standin_min 10 → 3 (bug #28)
  Object.keys(SETTINGS_MIGRATE_).forEach(function (k) {
    var m = SETTINGS_MIGRATE_[k], r = have[k];
    if (r && String(r.value).trim() === String(m.from)) { updateRow_('Settings', r._row, { value: m.to }); moved.push(k + ' ' + m.from + '→' + m.to); }
  });
  Object.keys(SETTINGS_DEFAULTS_).forEach(function (k) {
    if (have[k]) { if (SETTING_MEANINGS_[k] && String(have[k].meaning) !== SETTING_MEANINGS_[k]) updateRow_('Settings', have[k]._row, { meaning: SETTING_MEANINGS_[k] }); return; }
    var v = SETTINGS_DEFAULTS_[k];
    add.push({ key: k, value: (typeof v === 'number' ? v : txt_(v)), meaning: SETTING_MEANINGS_[k] || '' });
  });
  appendObjects_('Settings', add);
  _settings = null;
  return 'settings: ' + (add.length ? add.length + ' rows added' : 'all there') + (moved.length ? ', changed: ' + moved.join(', ') : '');
}

/** Read-only check: every tab + its columns; Questions vs Batches. */
function checkSheet_() {
  var ss = ss_(), problems = [];
  TABS_.forEach(function (t) {
    var sh = ss.getSheetByName(t[0]);
    if (!sh) { problems.push('missing tab ' + t[0]); return; }
    if (!t[1]) return;
    var have = headers_(t[0]);
    t[1].forEach(function (h) { if (have.indexOf(h) < 0) problems.push(t[0] + ': missing column ' + h); });
  });
  try {
    var b = {}; readTable_('Batches').rows.forEach(function (r) { b[String(r.batch)] = 1; });
    var orphan = readTable_('Questions').rows.filter(function (r) { return !b[String(r.batch)]; }).length;
    if (orphan) problems.push(orphan + ' Questions rows whose batch is not in Batches');
    var codes = {}; readTable_('Students').rows.forEach(function (r) { var c = normCode_(r.student_code); if (c && codes[c]) problems.push('student code twice: ' + c); codes[c] = 1; });
  } catch (e) { problems.push('check failed: ' + e.message); }
  return problems.length ? 'checkSheet → ' + problems.length + ' problem(s): ' + problems.join('; ') : 'checkSheet: all good';
}
