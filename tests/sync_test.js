// Library re-sync (made-up fixtures): a rebuilt batch file reaches the Sheet — key fixed by Intake, item turned into a
// version-B candidate, item gone from its file — while a key Minh typed and a status "hold" he set stay.
const fs = require('fs'), os = require('os'), path = require('path');
const { makeGas, LIB } = require('./server');
let F = 0, P = 0; const check = (c, m) => { if (c) { P++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ FAIL: ' + m); } };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'smllib-'));
fs.cpSync(LIB, tmp, { recursive: true });
const G = makeGas({ libDir: tmp }), C = G.ctx;
const row = id => { G.fresh(); return C.readTable_('Questions').rows.find(r => r.qid === id); };
check(String(row('FX1-002').key_file).replace(/^'/, '') === 'B', 'new rows remember the file key (key_file)');
// Minh types a key on FX1-001 and puts FX1-006 on hold
C.updateRow_('Questions', row('FX1-001')._row, { key: 'A' });
C.updateRow_('Questions', row('FX1-006')._row, { status: 'hold' });
// Intake rebuilds FX1: key of 002 fixed to C, 001's file key changed to D, 008 → version B, 007 dropped, 003 re-tagged
const f = path.join(tmp, 'questions', 'FX1.json'), d = JSON.parse(fs.readFileSync(f, 'utf8'));
const q = id => d.questions.find(x => x.qid === id);
q('FX1-002').key = 'C'; q('FX1-001').key = 'D'; q('FX1-006').key = 'A';
Object.assign(q('FX1-008'), { version: 'B', version_of: 'FX1-002', status: 'candidate' });
q('FX1-003').tags.subskill = 'H.B.4';
d.questions = d.questions.filter(x => x.qid !== 'FX1-007');
fs.writeFileSync(f, JSON.stringify(d));
G.cache.clear(); G.fresh(); C._libIdx = null; C._batch = {};
const msg = C.syncLibrary_();
console.log('  · ' + msg);
check(String(row('FX1-002').key).replace(/^\'/, '') === 'C', 'Intake fixed a key → the Sheet key follows (it was an untouched copy)');
check(C.libQuestions_(['FX1-002'])[0].key === 'C', 'the app grades with the fixed key');
check(String(row('FX1-001').key).replace(/^\'/, '') === 'A' && C.libQuestions_(['FX1-001'])[0].key === 'A', 'a key Minh typed stays and wins');
check(row('FX1-008').version === 'B' && row('FX1-008').status === 'candidate', 'item turned into version B → candidate (never served in practice)');
check(row('FX1-007').status === 'excluded' && /not in file/.test(row('FX1-007').note), 'item gone from its file → excluded');
check(row('FX1-006').status === 'hold', 'status "hold" Minh set stays');
check(String(row('FX1-003').subskill).replace(/^\'/, '') === 'H.B.4', 'tags refreshed from the file');
const m2 = C.syncLibrary_();
check(/rows refreshed from files: 0/.test(m2), 'second sync: nothing to change');
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
