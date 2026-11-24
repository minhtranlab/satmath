// #98 several level files in one update step (QK71 done before → QK98 → QK93h), each ONCE, on a copy (the test Sheet):
// order kept (a later file wins for the same qid, row updated in place: one Item_Overrides row per qid), notes = the file's tag,
// teacher rows kept, Placement items skipped, a missing file says so, the next deploy says "already imported".
const { makeGas } = require('./server');
const H = require('./h'); const { check } = H;
const G = makeGas(), C = G.ctx, props = { qk_import_QK71: '2026-11-19 11:46:30 · {"updated":0,"added":2100}' };
const hb = C.livePool_().filter(r => r.skill === 'H.B').map(r => r.qid), qb = C.livePool_().filter(r => r.skill === 'Q.B').map(r => r.qid);
G.call('setItemLevel', ['TEACH-FX-9', hb[0], 'E', 1, 'teacher by hand']); G.fresh();                       // must stay
C.appendObjects_('Item_Overrides', [{ qid: hb[1], difficulty: 'M', level: 2, set_by: 'QK', note: 'QK95', log: 'old QK95 row' }]); G.fresh();
const files = {
  'QK98_levels.csv': 'qid,final,in_placement\n' + hb.slice(0, 4).map(q => q + ',H2,N').join('\n') + '\n' + qb[0] + ',M1,Y\n',
  'QK93h_levels.csv': 'qid,final,in_placement\n' + hb[3] + ',E3,N\n' + hb[4] + ',M3,N\n'
};
const asked = [];
C.PropertiesService = { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = v; } }) };
C.DriveApp = { getFolderById: () => ({ getFilesByName: n => { asked.push(n); let done = !files[n]; return { hasNext: () => !done, next: () => { done = true; return { getBlob: () => ({ getDataAsString: () => files[n] }) }; } }; } }) };
C.Utilities.parseCsv = t => t.trim().split('\n').map(l => l.split(','));
C.QK_IMPORT_MODE_ = 'apply';
const out = C.qkLevelsImportAll_(); G.fresh();
const parts = out.split(/ · (?=qk\d)/);
check(parts.length === 3 && /^qk71: already imported/.test(parts[0]) && /^qk98 apply: \+2 new, 1 changed, 0 same, 1 teacher kept, 1 placement skipped/.test(parts[1]) && /^qk93h apply: \+1 new, 1 changed/.test(parts[2]),
  'one step, three files in order: ' + parts.map(p => p.slice(0, 70)).join(' | '));
check(asked.join(',') === 'QK98_levels.csv,QK93h_levels.csv', 'QK71 is not read again; QK98 then QK93h');
const ov = C.readTableSheet_('Item_Overrides').rows, by = q => ov.filter(r => String(r.qid).replace(/^'/, '') === q);
check(new Set(ov.map(r => String(r.qid))).size === ov.length, 'one row per qid (' + ov.length + ' rows)');
check(by(hb[0])[0].set_by === 'teacher' && by(hb[0])[0].difficulty === 'E', 'the teacher row stays');
check(by(hb[1])[0].note === 'QK98' && by(hb[1])[0].difficulty === 'H' && +by(hb[1])[0].level === 2 && /old QK95 row\n.* QK98: M2 → H2/.test(by(hb[1])[0].log), 'an older row is updated in place (old level in the log)');
check(by(hb[3])[0].note === 'QK93h' && by(hb[3])[0].difficulty === 'E' && +by(hb[3])[0].level === 3 && /QK98: .* → H2\n.* QK93h: H2 → E3/.test(by(hb[3])[0].log), 'the later file wins for the same qid (QK98 H2 → QK93h E3, both in the log)');
check(by(hb[4])[0].note === 'QK93h' && by(hb[4])[0].difficulty === 'M' && !by(qb[0]).length, 'QK93h adds its own rows; the Placement item gets no row');
check(props.qk_import_QK98 && props.qk_import_QK93h, 'each file is marked done');
const eff = q => C.questionRows_().find(r => r.qid === q);
check(eff(hb[3]).difficulty === 'E' && +eff(hb[3]).level === 3 && eff(hb[2]).difficulty === 'H', 'the app reads the final levels');
const again = C.qkLevelsImportAll_();
check(again.split(/ · (?=qk\d)/).every(p => /already imported/.test(p)), 'next deploy: all three already imported');
delete props.qk_import_QK98; files['QK98_levels.csv'] = undefined;
check(/qk98: no file/.test(C.qkLevelsImportAll_()), 'a missing file is reported, nothing else happens');
process.exit(H.summary() ? 1 : 0);
