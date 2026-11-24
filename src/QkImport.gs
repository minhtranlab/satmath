/* ============================== #74 QK's difficulty re-rating of the whole library → Item_Overrides ==============================
 * Source: the private library folder on Drive, file QK71_levels.csv (= qa/QK71/QK_difficulty_final.csv, column `final`, e.g. E2;
 * Minh's choice 19 Nov 10:00). Runs as a step of the Sheet update, ONCE (Script property qk_import_QK71):
 *   - one Item_Overrides row per qid (set_by "QK", note "QK71", last write wins, the old level in old_* and in the log);
 *   - rows a teacher set by hand (set_by "teacher") are never overwritten; Placement items (in_placement = Y) are skipped;
 *   - the Questions tab (cb_difficulty = College Board's label) and the Drive JSON are not touched.
 * QK_IMPORT_MODE_ 'dry' = compute and write the report only; 'apply' = write the rows (then the report).
 * The report (counts + live pool per skill × difficulty before > after + the cells under 10) is the step's line in the update notes
 * (Settings › code_version). The script has Drive read-only: nothing is written to Drive. */
var QK_IMPORT_ = { tag: 'QK71', file: 'QK71_levels.csv', prop: 'qk_import_QK71' };
/* #98: more level files, applied in this order, each ONCE (own script property); a later file wins for the same qid (rows are
   updated in place: one Item_Overrides row per qid). QK98 = final_level of the QK checks #93d–#93i (+ Minh's choices);
   QK93h = the version-B clean-up (an exact-copy B gets the level of its A item). */
var QK_IMPORTS_ = [QK_IMPORT_,
  { tag: 'QK98', file: 'QK98_levels.csv', prop: 'qk_import_QK98' },
  { tag: 'QK93h', file: 'QK93h_levels.csv', prop: 'qk_import_QK93h' },
  { tag: 'QK99', file: 'QK99_levels.csv', prop: 'qk_import_QK99' }];               // #99: final_level of QK #93j + #93k (OLDP9–OLDP12; OLDP13 already in its file)
var QK_IMPORT_MODE_ = 'apply';

/** Pure part (tests run it on a copy): csv = [{qid, final, in_placement}] → { plan, report }. Reads the tabs, writes nothing. */
function qkImportPlan_(csv, imp) {
  imp = imp || QK_IMPORT_;
  var qs = readTableSheet_('Questions').rows, byQ = {};
  qs.forEach(function (r) { byQ[String(r.qid).replace(/^'/, '')] = r; });
  var ov = readTableSheet_('Item_Overrides'), ovBy = {};
  ov.rows.forEach(function (r) { ovBy[String(r.qid).replace(/^'/, '').trim()] = r; });
  var live = {}; readTableSheet_('Batches').rows.forEach(function (r) { live[String(r.batch)] = isYes_(r.live); });
  var isLive = function (r) { return String(r.status || 'live').toLowerCase() === 'live' && String(r.version || 'A').toUpperCase() !== 'B' && live[String(r.batch)]; };
  var effNow = function (q) { var o = ovBy[q], d = o && /^[EMH]$/.test(String(o.difficulty).toUpperCase()) ? String(o.difficulty).toUpperCase() : String(byQ[q].difficulty || '').toUpperCase(); return d; };
  var n = { rows: csv.length, add: 0, update: 0, same: 0, teacher: 0, placement: 0, unknown: 0, bad: 0 }, plan = [], want = {};
  csv.forEach(function (c) {
    var q = String(c.qid || '').trim(), m = /^([EMH])([123])$/.exec(String(c.final || '').trim().toUpperCase());
    if (!m) { n.bad++; return; }
    if (String(c.in_placement || '').toUpperCase() === 'Y') { n.placement++; return; }
    if (!byQ[q]) { n.unknown++; return; }
    var o = ovBy[q];
    if (o && String(o.set_by) === 'teacher') { n.teacher++; return; }
    var d = m[1], l = Number(m[2]);
    if (o && String(o.difficulty).toUpperCase() === d && Number(o.level) === l && String(o.note) === imp.tag) { n.same++; return; }
    var oldD = o ? String(o.difficulty || '').toUpperCase() : String(byQ[q].difficulty || '').toUpperCase();
    var oldL = o ? Number(o.level) || '' : Number(byQ[q].level) || '';
    plan.push({ qid: q, code: clean_(byQ[q].code), d: d, l: l, oldD: oldD, oldL: oldL, row: o ? o._row : 0, log: o ? String(o.log || '') : '' });
    want[q] = d; if (o) n.update++; else n.add++;
  });
  // live pool per skill × difficulty, before → after
  var t = {};
  qs.forEach(function (r) {
    if (!isLive(r)) return;
    var q = String(r.qid).replace(/^'/, ''), k = clean_(r.skill); if (!k) return;
    t[k] = t[k] || { skill: k, name: skillName_(k) || k, before: { E: 0, M: 0, H: 0 }, after: { E: 0, M: 0, H: 0 } };
    var b = effNow(q), a = want[q] || b;
    if (t[k].before[b] !== undefined) t[k].before[b]++;
    if (t[k].after[a] !== undefined) t[k].after[a]++;
  });
  var table = Object.keys(t).sort().map(function (k) { return t[k]; }), low = [];
  table.forEach(function (r) { ['E', 'M', 'H'].forEach(function (d) { if (r.after[d] < 10) low.push(r.skill + ' ' + d + ' ' + r.after[d]); }); });
  return { plan: plan, report: { tag: imp.tag, counts: n, table: table, low: low } };
}

/** Writes the plan: changed rows in place (one block write), new rows appended (one block). */
function qkImportApply_(plan, imp) {
  imp = imp || QK_IMPORT_;
  var at = nowIso_(), day = at.slice(0, 16);
  var tb = readTableSheet_('Item_Overrides'), H = tb.headers, sh = tb.sh;
  var col = function (h) { return H.indexOf(h); };
  var upd = plan.filter(function (p) { return p.row; }), add = plan.filter(function (p) { return !p.row; });
  if (upd.length) {
    var last = sh.getLastRow(), vals = sh.getRange(2, 1, last - 1, H.length).getValues();
    upd.forEach(function (p) {
      var v = vals[p.row - 2];
      v[col('difficulty')] = p.d; v[col('level')] = p.l; v[col('old_difficulty')] = p.oldD; v[col('old_level')] = p.oldL;
      v[col('set_by')] = 'QK'; v[col('set_at')] = at; v[col('note')] = imp.tag;
      v[col('log')] = (p.log ? p.log + '\n' : '') + day + ' ' + imp.tag + ': ' + p.oldD + p.oldL + ' → ' + p.d + p.l;
    });
    sh.getRange(2, 1, vals.length, H.length).setValues(vals);
  }
  if (add.length) appendObjects_('Item_Overrides', add.map(function (p) {
    return { qid: txt_(p.qid), code: txt_(p.code), difficulty: p.d, level: p.l, old_difficulty: p.oldD, old_level: p.oldL, set_by: 'QK', set_at: at,
             note: imp.tag, log: day + ' ' + imp.tag + ': ' + p.oldD + p.oldL + ' → ' + p.d + p.l };
  }));
  tabChanged_('Item_Overrides'); _ovr = null; _qrows = null; _plForms = null;
  return { updated: upd.length, added: add.length };
}

/** The update step: every level file in QK_IMPORTS_ order (each once). */
function qkLevelsImportAll_() {
  return QK_IMPORTS_.map(function (imp) { return qkLevelsImport_(imp); }).join(' · ');
}
/** One level file. */
function qkLevelsImport_(imp) {
  imp = imp || QK_IMPORT_;
  var t = imp.tag.toLowerCase();
  if (typeof PropertiesService === 'undefined') return t + ': no script properties here';
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty(imp.prop)) return t + ': already imported (' + props.getProperty(imp.prop) + ')';
  var folder, it;
  try { folder = DriveApp.getFolderById(LIBRARY_FOLDER_ID); it = folder.getFilesByName(imp.file); } catch (e) { return t + ': library folder not readable'; }
  if (!it.hasNext()) return t + ': no file';
  var rows = Utilities.parseCsv(it.next().getBlob().getDataAsString('UTF-8')), h = rows[0];
  var csv = rows.slice(1).map(function (r) { var o = {}; h.forEach(function (k, i) { o[k] = r[i]; }); return o; });
  var P = qkImportPlan_(csv, imp), rep = P.report;
  rep.mode = QK_IMPORT_MODE_; rep.at = nowIso_();
  if (QK_IMPORT_MODE_ === 'apply') { rep.written = qkImportApply_(P.plan, imp); props.setProperty(imp.prop, rep.at + ' · ' + JSON.stringify(rep.written)); }
  var c = rep.counts;
  var tab = rep.table.map(function (r) { return r.skill + ' ' + ['E', 'M', 'H'].map(function (d) { return d + r.before[d] + '>' + r.after[d]; }).join(' '); }).join('; ');
  return t + ' ' + rep.mode + ': +' + c.add + ' new, ' + c.update + ' changed, ' + c.same + ' same, ' + c.teacher + ' teacher kept, ' + c.placement + ' placement skipped, ' + c.unknown + ' unknown, ' + c.bad + ' bad' +
    ' | live pool before>after: ' + tab + ' | under 10: ' + (rep.low.join(', ') || 'none');
}
