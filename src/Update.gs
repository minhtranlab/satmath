/**
 * SAT Math Lib — Sheet update after a new version (Test Zone pattern). Runs once per deploy (stamp = APP_VERSION +
 * APP_BUILD, the commit id the Action writes into Code.gs). Each step is safe to repeat:
 *   ensureTabs_ → ensureSettingsRows_ → syncSheetTexts_ → ensureTimeNorms_ → syncSkills_ → syncLibrary_ → syncStudents_ (codes,
 *   classes mirror) → syncTaggedReview_ (Sheet tags → Review) → ensureMistakeDropdown_ → checkSheet_
 * Then Settings row `code_version` = the stamp (its meaning cell = when it ran + a one-line result).
 * Who starts it: 1. the GitHub Action, right after the deploy, opens <web app URL>?update=1 (doGet);
 *                2. fallback: run updateAfterNewVersion in the Apps Script editor (also the one-time authorization).
 * The ?update=1 answer is one line of status text: no Sheet data ever goes back to the caller.
 */
var UPDATE_SETTING = 'code_version';
var UPDATE_PREFIX = 'SAT Math Lib update: ';

function stamp_() { return APP_VERSION + ' · ' + APP_BUILD; }

function runUpdateIfNeeded_() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return UPDATE_PREFIX + 'busy (another update is running) · ' + stamp_();
  try {
    if (String(currentStamp_().value) === stamp_()) return UPDATE_PREFIX + 'already up to date · ' + stamp_();
    return UPDATE_PREFIX + doUpdate_().status + ' · ' + stamp_();
  } finally { lock.releaseLock(); }
}

/** Editor (owner): always runs. Also the function Minh runs once to give the app its permissions. */
function updateAfterNewVersion() {
  requireEditor_();
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var r = doUpdate_();
    console.log(r.line);
    try { SpreadsheetApp.getActive().toast(r.line, 'SAT Math Lib ' + APP_VERSION, 10); } catch (e) {}
  } finally { lock.releaseLock(); }
}

function currentStamp_() {
  try {
    var row = readTable_('Settings').rows.filter(function (r) { return String(r.key).trim() === UPDATE_SETTING; })[0];
    return row || { _row: 0, value: '' };
  } catch (e) { return { _row: 0, value: '' }; }
}

function doUpdate_() {
  var steps = [['tabs', ensureTabs_], ['settings', ensureSettingsRows_], ['texts', syncSheetTexts_], ['time norms', ensureTimeNorms_],
               ['skills', syncSkills_], ['library', syncLibrary_], ['students', syncStudents_], ['tags', syncTaggedReview_],
               ['dropdown', ensureMistakeDropdown_], ['check', checkSheet_]];
  var notes = [], failed = 0, log = [];
  steps.forEach(function (s) {
    try { var msg = String(s[1]() || ''); log.push('[' + s[0] + '] ' + msg); notes.push(msg); }
    catch (err) { failed++; notes.push(s[0] + ' FAILED'); log.push('[' + s[0] + '] FAILED: ' + (err && err.stack || err)); }
  });
  console.log('UPDATE ' + stamp_() + '\n' + log.join('\n'));
  var line = nowIso_() + ' · ' + notes.join(' · ');
  if (!failed) writeStamp_(line);   // a failed step leaves the old stamp → the next ping / editor run tries again
  return { status: failed ? 'FAILED (' + failed + ' step(s), see Apps Script Executions log)' : 'done', line: line };
}

function writeStamp_(line) {
  var cur = currentStamp_();
  var fields = { key: UPDATE_SETTING, value: txt_(stamp_()), meaning: SETTING_MEANINGS_.code_version + ' Last run: ' + line.slice(0, 1500) };
  if (cur._row) updateRow_('Settings', cur._row, fields); else appendObjects_('Settings', [fields]);
}
