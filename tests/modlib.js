// #101 a temp library = tests/fixtures/library + the made-up module bank FX6 (tests/fixtures/library_mod), so other suites never see FX6.
const fs = require('fs'), path = require('path'), os = require('os');
function modLib() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sml-modlib-'));
  fs.cpSync(path.join(__dirname, 'fixtures', 'library'), dir, { recursive: true });
  fs.copyFileSync(path.join(__dirname, 'fixtures', 'library_mod', 'questions', 'FX6.json'), path.join(dir, 'questions', 'FX6.json'));
  return dir;
}
module.exports = { modLib };
