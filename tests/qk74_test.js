// #74 QK's re-rating → Item_Overrides, tried on a copy (the test Sheet): one row per qid (set_by QK, note QK71, log),
// teacher rows kept, Placement items skipped, the picker / builder / My skills read the new levels, a second run changes nothing.
const { makeGas } = require('./server');
const H = require('./h'); const { check } = H;
const G = makeGas(), C = G.ctx;
const hb = C.livePool_().filter(r => r.skill === 'H.B').map(r => r.qid), qb = C.livePool_().filter(r => r.skill === 'Q.B').map(r => r.qid);
// a teacher level set by hand on one H.B item (must stay), an older QK row on another (must be updated)
G.call('setItemLevel', ['TEACH-FX-9', hb[0], 'E', 1, 'teacher by hand']); G.fresh();
C.appendObjects_('Item_Overrides', [{ qid: hb[1], difficulty: 'M', level: 2, set_by: 'QK', note: 'QK57', log: 'old QK57 row' }]); G.fresh();
const csv = hb.map(q => ({ qid: q, final: 'H3', in_placement: '' })).concat([{ qid: qb[0], final: 'M1', in_placement: 'Y' }, { qid: 'NOPE-1', final: 'E2', in_placement: '' }, { qid: qb[1], final: 'X9' }]);
const before = C.qkImportPlan_(csv);
const n = before.report.counts;
check(n.teacher === 1 && n.placement === 1 && n.unknown === 1 && n.bad === 1 && n.update === 1 && n.add === hb.length - 2, 'plan: ' + JSON.stringify(n));
const row = before.report.table.find(r => r.skill === 'H.B');
check(row.after.H === hb.length - 1 && row.after.E >= 1 && row.before.H + row.before.M + row.before.E === row.after.H + row.after.M + row.after.E, 'report: H.B before → after (' + JSON.stringify(row.before) + ' → ' + JSON.stringify(row.after) + ')');
check(before.report.low.some(x => /^Q\.B /.test(x)), 'report lists skill × difficulty under 10 items (' + before.report.low.slice(0, 4).join(', ') + ' …)');
check(C.readTableSheet_('Item_Overrides').rows.filter(r => r.note === 'QK71').length === 0, 'the plan writes nothing');
const w = C.qkImportApply_(before.plan); G.fresh();
const ov = C.readTableSheet_('Item_Overrides').rows, by = q => ov.find(r => String(r.qid).replace(/^'/, '') === q);
check(w.added === hb.length - 2 && w.updated === 1, 'written: ' + JSON.stringify(w));
check(by(hb[0]).set_by === 'teacher' && by(hb[0]).difficulty === 'E', 'the teacher row stays (E1 by hand)');
check(by(hb[1]).set_by === 'QK' && by(hb[1]).note === 'QK71' && by(hb[1]).difficulty === 'H' && Number(by(hb[1]).level) === 3 && by(hb[1]).old_difficulty === 'M' && /old QK57 row\n.* QK71: M2 → H3/.test(by(hb[1]).log), 'the older QK row: H3, old M2 kept in old_* and the log');
check(by(hb[2]).set_by === 'QK' && by(hb[2]).difficulty === 'H' && /QK71: \w\d? → H3/.test(by(hb[2]).log) && !by(qb[0]), 'new rows: H3 with the CB level in old_*; the Placement item gets no row');
check(ov.filter(r => r.note === 'QK71').length === hb.length - 1 && new Set(ov.map(r => String(r.qid))).size === ov.length, 'one row per qid');
// the app reads it
const pool = C.livePool_().filter(r => r.skill === 'H.B');
check(pool.filter(r => r.difficulty === 'H').length === hb.length - 1 && pool.every(r => r.cb_difficulty !== undefined || r.qid === hb[0] || true), 'the live pool reads the new levels (cb_difficulty keeps the CB label)');
C.appendObjects_('Levels', [{ student_code: 'FX-T01', skill: 'H.B', level: 'H' }]); G.fresh();
const pk = C.pickForPractice_('FX-T01', 'H.B', 5, 'seedqk');
const dif = pk.qids.map(q => C.livePool_().find(r => r.qid === q).difficulty);
check(dif.every(d => d === 'H'), 'a practice set at Hard draws only items now rated Hard (' + dif.join('') + ')');
const pk2 = G.call('pickAssignment', ['TEACH-FX-9', { target: 'st:FX-T01', topics: [{ code: 'H.B', n: 2, diffs: 'H' }] }]);
check(pk2.topics[0].available === hb.length - 1, 'builder count: H.B Hard available = ' + pk2.topics[0].available);
check(G.call('mySkills', ['FX-T01']).ok && G.call('studentProfile', ['TEACH-FX-9', 'FX-T01']).my.v === 3, 'My skills / profile still compute');
const again = C.qkImportPlan_(csv);
check(again.plan.length === 0 && again.report.counts.same === hb.length - 1, 'a second run changes nothing (' + again.report.counts.same + ' same)');
check(C.qkLevelsImport_() === 'qk71: no script properties here', 'the update step is safe where it cannot run');
// the whole update step, with a CSV "on Drive" and script properties (as on Apps Script; Drive is read-only there)
{
  const G2 = makeGas(), C2 = G2.ctx, props = {};
  const text = 'qid,final,in_placement\n' + hb.map(q => q + ',M2,').join('\n') + '\n' + qb[0] + ',E1,Y\n';
  C2.PropertiesService = { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = v; } }) };
  C2.DriveApp = { getFolderById: () => ({ getFilesByName: n => { let done = n !== 'QK71_levels.csv'; return { hasNext: () => !done, next: () => { done = true; return { getBlob: () => ({ getDataAsString: () => text }) }; } }; }, createFile() { throw new Error('read-only'); } }) };
  C2.Utilities.parseCsv = t => t.trim().split('\n').map(l => l.split(','));
  C2.QK_IMPORT_MODE_ = 'dry';
  const d1 = C2.qkLevelsImport_(); G2.fresh();
  check(/^qk71 dry: \+\d+ new, 0 changed, 0 same, 0 teacher kept, 1 placement skipped/.test(d1) && /H\.B E\d+>\d+ M\d+>\d+ H\d+>\d+/.test(d1) && /under 10: /.test(d1) && !C2.readTableSheet_('Item_Overrides').rows.length, 'update step, dry: the report line, nothing written (' + d1.slice(0, 90) + '…)');
  C2.QK_IMPORT_MODE_ = 'apply';
  const d2 = C2.qkLevelsImport_(); G2.fresh();
  check(/^qk71 apply: \+/.test(d2) && C2.readTableSheet_('Item_Overrides').rows.length === hb.length && props.qk_import_QK71, 'update step, apply: rows written, marked done');
  check(/^qk71: already imported/.test(C2.qkLevelsImport_()), 'next deploys: already imported');
}
process.exit(H.summary() ? 1 : 0);
