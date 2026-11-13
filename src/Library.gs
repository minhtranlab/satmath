/**
 * SAT Math Lib — the question library (private, on Drive) + its Sheet tabs.
 *
 * Drive layout (folder LIBRARY_FOLDER_ID, "SAT Math Lib - Library", not shared):
 *   questions/<BATCH>.json        one file per batch (schema: Intake's data/library/SCHEMA.md) — text only, keys included
 *   figures/<BATCH>/<qid>_f<n>.png the figure images; each figure in the JSON carries its Drive file id (drive_id),
 *                                  written by tools/upload_library.mjs
 * Server only: batch text and figure bytes are cached in CacheService (chunks ≤ 90 000 chars, 6 h, keyed by file id +
 * last-updated time). A question reaches a browser only inside getSet / getFigures / getReview of a signed-in student's
 * own set, through clientQuestion_() (Code.gs) — never the key, accepted forms, tags, source, rationale.
 *
 * Sheet tabs kept in step with the library by syncLibrary_ (every deploy + menu):
 *   Batches   one row per batch file (live = No for a new batch: Minh switches it on)
 *   Questions one row per question, NO text: tags, key (the Sheet key wins over the file), status (live / hold / excluded / candidate)
 *   Skills    the taxonomy (Skills.gs, generated from taxonomy/sml_skills.csv): domain → CB skill → sub-skill
 * `skill` (official CB skill) and `subskill` are separate fields everywhere; a skill is never derived from a sub-skill code.
 */

var LIB_QUESTIONS_FOLDER = 'questions';
var LIB_FIGURES_FOLDER = 'figures';
var CACHE_CHUNK = 90000;

/* ---------------- cache helpers ---------------- */
function cacheGetBig_(base) {
  var cache = CacheService.getScriptCache(), n = Number(cache.get(base + '_n'));
  if (!(n > 0)) return null;
  var keys = []; for (var i = 0; i < n; i++) keys.push(base + '_' + i);
  var got = cache.getAll(keys), parts = [];
  for (var j = 0; j < n; j++) { if (got[keys[j]] == null) return null; parts.push(got[keys[j]]); }
  return parts.join('');
}
function cachePutBig_(base, text) {
  var put = {}, k = 0;
  for (var p = 0; p < text.length; p += CACHE_CHUNK) put[base + '_' + (k++)] = text.slice(p, p + CACHE_CHUNK);
  put[base + '_n'] = String(k);
  try { CacheService.getScriptCache().putAll(put, 21600); } catch (e) { console.warn('cache put failed: ' + e); }
}

/* ---------------- library index + batch files ---------------- */

/** {BATCH: 'fileId|lastUpdatedMs'} for every questions/<BATCH>.json. Cached 10 min (an empty or failed read never is). */
var _libIdx = null;
function libIndex_(fresh) {
  if (_libIdx && !fresh) return _libIdx;
  var cache = CacheService.getScriptCache();
  if (!fresh) { var hit = cache.get('sml_lib_idx'); if (hit) { var h = JSON.parse(hit); if (h && Object.keys(h).length) return (_libIdx = h); } }
  var idx = {}, ok = false;
  try {
    var root = DriveApp.getFolderById(LIBRARY_FOLDER_ID);
    var fit = root.getFoldersByName(LIB_QUESTIONS_FOLDER);
    while (fit.hasNext()) {
      var it = fit.next().getFiles();
      while (it.hasNext()) {
        var f = it.next(), m = /^([A-Za-z0-9][A-Za-z0-9_-]*)\.json$/.exec(f.getName());
        if (!m || f.isTrashed()) continue;
        var t = f.getLastUpdated().getTime();
        if (!idx[m[1]] || t > Number(idx[m[1]].split('|')[1])) idx[m[1]] = f.getId() + '|' + t;
      }
    }
    ok = true;
  } catch (err) { console.error('LIBRARY FOLDER NOT READABLE: ' + err); }
  if (!ok || !Object.keys(idx).length) return idx;
  cache.put('sml_lib_idx', JSON.stringify(idx), 600);
  return (_libIdx = idx);
}

/** Parsed batch file (server only). */
var _batch = {};
function libBatch_(batch) {
  if (Object.prototype.hasOwnProperty.call(_batch, batch)) return _batch[batch];
  var ref = libIndex_()[batch];
  if (!ref) return (_batch[batch] = null);
  var base = 'sml_b_' + ref.replace(/[^A-Za-z0-9]/g, '_');
  var text = cacheGetBig_(base);
  if (text === null) {
    text = DriveApp.getFileById(ref.split('|')[0]).getBlob().getDataAsString('UTF-8');
    cachePutBig_(base, text);
  }
  var data = JSON.parse(text);
  if (String(data.batch) !== batch) throw new Error('Library file ' + batch + '.json holds batch ' + data.batch);
  return (_batch[batch] = data);
}

/** Questions by qid, in the given order, keys from the Questions tab where Minh typed one (Sheet wins). Unknown qids are skipped. */
function libQuestions_(qids) {
  var rows = questionRows_(), byQ = {};
  rows.forEach(function (r) { byQ[String(r.qid)] = r; });
  var need = {};
  qids.forEach(function (q) { var r = byQ[q]; if (r) (need[String(r.batch)] = need[String(r.batch)] || {})[q] = 1; });
  var found = {};
  Object.keys(need).forEach(function (b) {
    var data = libBatch_(b);
    if (!data) { console.error('LIBRARY: batch file ' + b + '.json not found'); return; }
    (data.questions || []).forEach(function (q) { if (need[b][q.qid]) found[q.qid] = q; });
  });
  return qids.filter(function (q) { return found[q]; }).map(function (qid) {
    var q = JSON.parse(JSON.stringify(found[qid])), r = byQ[qid], k = sheetKey_(r, q);
    if (k) { q.key_data = q.key; q.key = k.key; if (k.accepted) q.accepted = k.accepted; }
    return q;
  });
}
/** The Questions-tab key of one row when it differs from the file: MCQ = letter; SPR = key + accepted list ("a|b|c"). */
function sheetKey_(r, q) {
  var v = r ? r.key : '';
  if (v === '' || v === null || v === undefined) return null;
  if (Object.prototype.toString.call(v) === '[object Date]') { console.warn('Questions key of ' + r.qid + ' is a date (type an apostrophe first) — file key used'); return null; }
  var key = String(v).replace(/^'/, '').trim();
  if ((q.type || 'mcq') === 'mcq') { key = key.toUpperCase(); return key === String(q.key).toUpperCase() ? null : { key: key }; }
  var acc = String(r.accepted || '').replace(/^'/, '').split('|').map(function (x) { return x.trim(); }).filter(String);
  if (key === String(q.key) && (!acc.length || acc.join('|') === (q.accepted || []).join('|'))) return null;
  return { key: key, accepted: acc.length ? acc : [key] };
}

/** data: URI of one figure (Drive bytes, cached). Fixture/test files may carry src inline. */
function figSrc_(f) {
  if (f.src) return f.src;
  if (!f.drive_id) return '';
  var base = 'sml_f_' + String(f.drive_id).replace(/[^A-Za-z0-9]/g, '_');
  var hit = cacheGetBig_(base);
  if (hit !== null) return hit;
  try {
    var blob = DriveApp.getFileById(String(f.drive_id)).getBlob();
    var uri = 'data:' + (blob.getContentType() || 'image/png') + ';base64,' + Utilities.base64Encode(blob.getBytes());
    cachePutBig_(base, uri);
    return uri;
  } catch (e) { console.error('FIGURE NOT READABLE ' + f.drive_id + ': ' + e); return ''; }
}

/* ---------------- Questions / Batches rows ---------------- */
var _qrows = null, _batchLive = null;
function questionRows_() { if (!_qrows) _qrows = readTable_('Questions').rows; return _qrows; }
function batchLive_() {
  if (_batchLive) return _batchLive;
  _batchLive = {};
  readTable_('Batches').rows.forEach(function (r) { _batchLive[String(r.batch)] = isYes_(r.live); });
  return _batchLive;
}
/** Questions a student can be served: status live, version A, batch live. */
function livePool_() {
  var live = batchLive_();
  return questionRows_().filter(function (r) {
    var st = String(r.status || 'live').toLowerCase();
    return st === 'live' && String(r.version || 'A').toUpperCase() !== 'B' && live[String(r.batch)];
  });
}

/* ---------------- skills (Skills.gs) ---------------- */
var _skillIdx = null;
function skillIdx_() {
  if (_skillIdx) return _skillIdx;
  var o = { skill: {}, sub: {}, domain: {} };
  (typeof SKILLS_ !== 'undefined' ? SKILLS_ : []).forEach(function (r) {
    o.domain[r.domain] = r.domain_name;
    o.skill[r.skill] = r.skill_name;
    if (r.subskill) o.sub[r.subskill] = r.subskill_name;
  });
  return (_skillIdx = o);
}
function skillName_(code) { return skillIdx_().skill[String(code)] || ''; }
function subskillName_(code) { return skillIdx_().sub[String(code)] || String(code || ''); }
function domainName_(code) { return skillIdx_().domain[String(code)] || String(code || ''); }

/* ---------------- sync: library → Batches + Questions, taxonomy → Skills ---------------- */

var QUESTION_COLS_FROM_FILE_ = ['batch', 'version', 'version_of', 'type', 'domain', 'skill', 'subskill', 'subskill2', 'difficulty', 'level',
                                'twin_group', 'key', 'accepted', 'key_source', 'cb_question_id', 'flags', 'tag_status'];
function questionRowFromFile_(batch, q) {
  var t = q.tags || {}, src = q.source || {};
  var st = String(q.status || 'keep').toLowerCase();
  return {
    qid: q.qid, batch: batch, version: q.version || 'A', version_of: q.version_of || '', type: q.type || 'mcq',
    domain: t.domain || '', skill: txt_(t.skill || ''), subskill: txt_(t.subskill || ''), subskill2: txt_(t.subskill2 || ''),
    difficulty: t.difficulty || '', level: t.level || '', twin_group: q.twin_group || '',
    key: txt_(q.key), accepted: txt_((q.accepted || []).join('|')), key_source: txt_(q.key_source || ''),
    cb_question_id: txt_(src.cb_question_id || ''), status: st === 'candidate' ? 'candidate' : st === 'excluded' ? 'excluded' : 'live',
    flags: (q.flags || []).join(','), tag_status: t.tag_status || '', added_at: nowIso_(), note: ''
  };
}

/** Appends Questions rows for new qids and a Batches row per new batch; refreshes batch counts. Existing Questions rows are
 *  never overwritten (Minh's keys / status kept): differences with the file are only reported in the log. */
function syncLibrary_() {
  _libIdx = null; try { CacheService.getScriptCache().remove('sml_lib_idx'); } catch (e) {}
  var idx = libIndex_(true), batches = Object.keys(idx).sort();
  if (!batches.length) return 'library: no batch files on Drive yet';
  var qt = readTable_('Questions'), have = {};
  qt.rows.forEach(function (r) { have[String(r.qid)] = r; });
  var add = [], diffs = [], counts = {};
  batches.forEach(function (b) {
    var data;
    try { data = libBatch_(b); } catch (e) { diffs.push(b + ': ' + e.message); return; }
    if (!data) return;
    var c = counts[b] = { title: data.title || b, source_type: data.source_type || '', n: 0, E: 0, M: 0, H: 0 };
    (data.questions || []).forEach(function (q) {
      if (!q || !q.qid) return;
      c.n++;
      var d = String((q.tags || {}).difficulty || '').toUpperCase(); if (c[d] !== undefined) c[d]++;
      var row = questionRowFromFile_(b, q), old = have[q.qid];
      if (!old) { add.push(row); have[q.qid] = row; return; }
      ['skill', 'subskill', 'difficulty', 'type'].forEach(function (k) {
        var a = String(old[k]).replace(/^'/, ''), f = String(row[k]).replace(/^'/, '');
        if (f && a !== f) diffs.push(q.qid + '.' + k + ': Sheet ' + a + ' / file ' + f);
      });
    });
  });
  appendObjects_('Questions', add);
  _qrows = null;
  // Batches: new rows (live = No), counts refreshed on existing rows (live kept)
  var bt = readTable_('Batches'), bRows = {};
  bt.rows.forEach(function (r) { bRows[String(r.batch)] = r; });
  var nLive = {};
  readTable_('Questions').rows.forEach(function (r) { if (String(r.status || 'live') === 'live') nLive[String(r.batch)] = (nLive[String(r.batch)] || 0) + 1; });
  var newB = [];
  Object.keys(counts).forEach(function (b) {
    var c = counts[b], f = { batch: b, title: c.title, source_type: c.source_type, n_items: c.n, n_live: nLive[b] || 0, n_E: c.E, n_M: c.M, n_H: c.H,
                             uploaded_at: fmtDate_(new Date(Number(idx[b].split('|')[1])), 'yyyy-MM-dd HH:mm'), file_id: idx[b].split('|')[0] };
    if (bRows[b]) updateRow_('Batches', bRows[b]._row, f);
    else { f.live = 'No'; f.note = 'new batch: set live = Yes to serve it'; newB.push(f); }
  });
  appendObjects_('Batches', newB);
  _batchLive = null;
  if (diffs.length) console.warn('LIBRARY vs Questions tab (Sheet kept):\n' + diffs.slice(0, 200).join('\n'));
  return 'library: ' + batches.length + ' batch file(s), questions added: ' + add.length + (newB.length ? ', new batches: ' + newB.map(function (x) { return x.batch; }).join(' ') + ' (live = No)' : '') +
         (diffs.length ? ', ' + diffs.length + ' difference(s) Sheet vs file (log)' : '');
}

/** Skills tab = Skills.gs (taxonomy). `active` typed by Minh is kept per sub-skill. */
function syncSkills_() {
  var t = readTable_('Skills'), act = {};
  t.rows.forEach(function (r) { act[String(r.subskill || r.skill)] = r.active; });
  var rows = (typeof SKILLS_ !== 'undefined' ? SKILLS_ : []).map(function (r, i) {
    var k = r.subskill || r.skill;
    return { domain: r.domain, domain_name: r.domain_name, skill: txt_(r.skill), skill_name: r.skill_name, subskill: txt_(r.subskill),
             subskill_name: r.subskill_name, order: i + 1, active: act[k] === undefined || act[k] === '' ? 'Yes' : act[k] };
  });
  rewriteTable_('Skills', function () { return false; }, rows);
  _skillIdx = null;
  return 'skills: ' + rows.length + ' rows';
}

/** Rewrite a script-built tab: keep rows where keep(row) is true, then add newObjs (Test Zone, safe order). */
function rewriteTable_(name, keep, newObjs) {
  var t = readTable_(name), headers = t.headers;
  var kept = t.rows.filter(keep).map(function (o) { return headers.map(function (h) { return keepCell_(h in o ? o[h] : ''); }); });
  var all = kept.concat(rowsFor_(headers, newObjs)), sh = t.sh, oldLast = sh.getLastRow();
  if (all.length) { ensureGrid_(sh, 1 + all.length, headers.length); sh.getRange(2, 1, all.length, headers.length).setValues(all); }
  var newLast = 1 + all.length;
  if (oldLast > newLast) sh.getRange(newLast + 1, 1, oldLast - newLast, headers.length).clearContent();
}
