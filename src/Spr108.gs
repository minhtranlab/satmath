/**
 * #108 grid-in answers by the official SAT entry rules (Test Zone #52) — two Sheet-update steps, safe to repeat:
 *  1. gridinKeyCheck_: every LIVE grid-in question whose key cannot be typed in the answer box (more than 5 characters, 6 with
 *     "-"), or whose accepted list has forms the new rule no longer counts (a short rounded decimal) → tab Gridin_Keys (rewritten
 *     each run). Data is not changed: 📥 Intake / ✅ QK fix the library.
 *  2. gridinRegrade_: every past grid-in answer graded again with the new rule (first try, best after Fix, each Fix try) →
 *     tab Gridin_Regrade (one row per change, rewritten each run). GRIDIN_APPLY_ = false: a dry run (nothing else changes);
 *     true: Responses try1_correct / best_correct, Tries.correct and the set's First Try / Best Score are corrected for
 *     practice / mixed / review / assignment sets. Placement and real-test module sets are only logged (their routing and
 *     score were decided at the time), and Levels are never replayed.
 * New sets use the new rule from this version on (isCorrect_ → sprCorrect_).
 */
var GRIDIN_APPLY_ = false;

function gridinRoom_(k) { return String(k).charAt(0) === '-' ? 6 : 5; }
function gridinFits_(k) { k = String(k); return /^-?[0-9.\/]+$/.test(k) && k.length <= gridinRoom_(k) && !!sprParse_(k); }

function gridinKeyCheck_() {
  var rows = questionRows_().filter(function (r) { return String(r.type) === 'spr' && clean_(r.status) === 'live'; });
  var qs = libQuestions_(rows.map(function (r) { return String(r.qid); })), byQ = {};
  rows.forEach(function (r) { byQ[String(r.qid)] = r; });
  var out = [], nKey = 0;
  qs.forEach(function (q) {
    var keys = keyList_(q).map(function (k) { return String(k).trim().replace(/−/g, '-'); }).filter(String);
    var main = String(Array.isArray(q.key) ? q.key[0] : q.key).trim().replace(/−/g, '-'), show = sprShow_(keys), probs = [];
    if (!gridinFits_(main)) { probs.push('key_untypeable'); nKey++; }
    var tooLong = keys.filter(function (k) { return k !== main && !gridinFits_(k); });
    if (tooLong.length) probs.push('accepted_untypeable: ' + tooLong.join(' | '));
    var nowWrong = keys.filter(function (k) { return gridinFits_(k) && !sprCorrect_(k, keys); });
    if (nowWrong.length) probs.push('accepted_display_only: ' + nowWrong.join(' | '));
    if (!show.length || show.some(function (k) { return !gridinFits_(k) || !sprCorrect_(k, keys); })) probs.push('no_typeable_answer');
    if (!probs.length) return;
    var r = byQ[q.qid] || {};
    out.push({ qid: q.qid, code: txt_(clean_(r.code)), batch: txt_(clean_(r.batch)), key: txt_(main), accepted: txt_(keys.join('|')),
               problem: probs.join('; '), show_answer: txt_(show.join(' or ')), checked_at: nowIso_() });
  });
  rewriteTable_('Gridin_Keys', function () { return false; }, out);
  return 'grid-in keys: ' + qs.length + ' live, ' + nKey + ' key(s) cannot be typed, ' + out.length + ' row(s) in Gridin_Keys';
}

function gridinRegrade_() {
  var qtype = {}; questionRows_().forEach(function (r) { qtype[String(r.qid)] = String(r.type); });
  var resp = readTable_('Responses').rows.filter(function (r) { return qtype[String(r.qid)] === 'spr'; });
  if (!resp.length) { rewriteTable_('Gridin_Regrade', function () { return false; }, []); return 'grid-in re-grade: no answers'; }
  var qids = {}; resp.forEach(function (r) { qids[String(r.qid)] = 1; });
  var Q = {}; libQuestions_(Object.keys(qids)).forEach(function (q) { Q[q.qid] = q; });
  var sets = {}; readTable_('Sets').rows.forEach(function (s) { sets[String(s.set_id)] = s; });
  var names = {}; readTable_('Students').rows.forEach(function (s) { names[normCode_(s.student_code)] = clean_(s.name); });
  var tries = {}; readTable_('Tries').rows.forEach(function (t) { if (qtype[String(t.qid)] === 'spr') (tries[t.set_id + '|' + t.qid] = tries[t.set_id + '|' + t.qid] || []).push(t); });
  var log = [], fNew = {}, touchedSets = {}, n = { rw: 0, wr: 0, best: 0, tries: 0 }, who = {}, apply = GRIDIN_APPLY_, now = nowIso_();
  var corr = function (q, a) { a = clean_(a); return a === '' ? '' : (isCorrect_(q, a) ? 1 : 0); };
  var bit = function (v) { v = clean_(v); return v === '' ? '' : Number(v) === 1 ? 1 : 0; };
  resp.forEach(function (r) {
    var q = Q[String(r.qid)]; if (!q) return;
    var s = sets[String(r.set_id)] || {}, kind = clean_(s.kind), frozen = kind === 'placement' || kind === 'module';
    var name = names[normCode_(r.student_code)] || '(unknown)', base = { student: txt_(name), kind: kind, qid: r.qid, code: txt_(clean_(q.code || '')), submitted_at: txt_(clean_(r.submitted_at)) };
    var t1o = bit(r.try1_correct), t1n = corr(q, r.try1_answer), f = {};
    if (t1o !== '' && t1n !== '' && t1o !== t1n) {
      log.push(gridinLog_(base, 'first try', r.try1_answer, t1o, t1n, apply && !frozen)); if (t1n) n.wr++; else n.rw++;
      who[name] = (who[name] || 0) + 1; f.try1_correct = t1n;
    }
    var tl = tries[r.set_id + '|' + r.qid] || [], anyTry = false;
    tl.forEach(function (t) {
      var o = bit(t.correct), nw = corr(q, t.answer);
      if (nw === 1) anyTry = true;
      if (o === '' || nw === '' || o === nw || Number(t.try_no) === 1) return;    // try 1 = the first try (logged above)
      log.push(gridinLog_(base, 'Fix try ' + t.try_no, t.answer, o, nw, apply && !frozen)); n.tries++;
      if (apply && !frozen) updateRow_('Tries', t._row, { correct: nw });
    });
    if (apply && !frozen) tl.forEach(function (t) { if (Number(t.try_no) === 1 && t1n !== '' && bit(t.correct) !== t1n) updateRow_('Tries', t._row, { correct: t1n }); });
    var bo = bit(r.best_correct), bn = (t1n === 1 || anyTry || corr(q, r.final_answer) === 1) ? 1 : 0;
    if (bo !== '' && bo !== bn) { log.push(gridinLog_(base, 'best after Fix', r.final_answer, bo, bn, apply && !frozen)); n.best++; f.best_correct = bn; if (!bn) f.fixed_at = ''; }
    if (apply && !frozen && Object.keys(f).length) { updateRow_('Responses', r._row, f); fNew[r._row] = f; touchedSets[String(r.set_id)] = 1; }
  });
  if (apply && Object.keys(touchedSets).length) {
    var all = readTable_('Responses').rows, val = function (x, k) { var f = fNew[x._row]; return Number(f && k in f ? f[k] : x[k]) === 1; };
    Object.keys(touchedSets).forEach(function (sid) {
      var s = sets[sid]; if (!s || !s._row) return;
      var rs = all.filter(function (x) { return String(x.set_id) === sid; });
      updateRow_('Sets', s._row, { first_try: rs.filter(function (x) { return val(x, 'try1_correct'); }).length, best_score: rs.filter(function (x) { return val(x, 'best_correct'); }).length });
    });
  }
  rewriteTable_('Gridin_Regrade', function () { return false; }, log);
  var byWho = Object.keys(who).sort().map(function (k) { return k + ' ' + who[k]; }).join(', ');
  return 'grid-in re-grade (' + (apply ? 'applied' : 'dry run') + '): ' + resp.length + ' grid-in answers, first try ' + n.rw + ' right→wrong + ' + n.wr + ' wrong→right' +
         (byWho ? ' (' + byWho + ')' : '') + ', best ' + n.best + ', Fix tries ' + n.tries + (apply ? ', ' + Object.keys(touchedSets).length + ' set(s) corrected' : '');
}
function gridinLog_(base, what, answer, o, nw, applied) {
  var r = {}; Object.keys(base).forEach(function (k) { r[k] = base[k]; });
  r.what = what; r.answer = txt_(clean_(answer)); r.was = o ? 'right' : 'wrong'; r.now = nw ? 'right' : 'wrong'; r.applied = applied ? 'yes' : 'no';
  return r;
}
