// The repo is PUBLIC: fail if question data, answer keys, figures or secrets slip in.
// Scans every file git would publish (tracked + new files that are not git-ignored).
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const files = execSync('git ls-files -z --cached --others --exclude-standard', { cwd: ROOT }).toString().split('\0').filter(Boolean)
  .filter(f => fs.existsSync(path.join(ROOT, f)));
const DESMOS_DEMO_KEY = 'dcb31709b452b1cf9dc26972add0fda6'; // Desmos's public demo key (documented by Desmos), not Minh's key
const problems = [];
const bad = (f, why) => problems.push(f + ': ' + why);

for (const f of files) {
  const inFixtures = f.startsWith('tests/fixtures/');
  // 1. paths that must never be in the repo
  if (/^(data|dist|Materials|Sample Test|qa|reports)\//.test(f)) bad(f, 'project-folder data path');
  if (/(^|\/)Data_[^/]*\.gs$/.test(f)) bad(f, 'built form data file (questions + keys)');
  if (/(^|\/)Questions_[^/]*\.csv$/.test(f)) bad(f, 'Questions export (keys)');
  if (/(^|\/)questions\.json$/.test(f) && !inFixtures) bad(f, 'question bank outside tests/fixtures');
  if (/(^|\/)questions\/[^/]+\.json$/.test(f) && !inFixtures) bad(f, 'library batch file outside tests/fixtures');
  if (/^(taxonomy|sources|design)\//.test(f)) bad(f, 'project-folder path');
  const siteIcon = /^site\/icon-\d+\.png$/.test(f) && fs.statSync(path.join(ROOT, f)).size < 10000; // #25: the nice link's home-screen icon only
  if (/\.(png|jpe?g|gif|webp|pdf)$/i.test(f) && !inFixtures && !siteIcon) bad(f, 'image/PDF outside tests/fixtures');
  if (/(^|\/)\.clasprc\.json$|creds?\.json$|\.pem$|\.p12$/.test(f)) bad(f, 'credentials file');
  if (/\.json$/.test(f) && /^(APCAB|SAT|HM\d|CB)/.test(path.basename(f))) bad(f, 'library / form JSON (Drive file) in the repo');
  if (/\.(png|jpe?g|gif|webp|pdf)$/i.test(f)) continue;

  const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
  // 2. fixtures must be the made-up mock forms only
  if (inFixtures && /\.json$/.test(f) && /"questions"/.test(s)) {
    const j = JSON.parse(s);
    if (!/^FX/.test(String(j.batch)) || (j.questions || []).some(q => !/^FX/.test(String(q.qid)))) bad(f, 'fixture batch / qids must start with FX (made-up items only)');
  }
  // watermarks / source names of the real material
  if (/dsatuz|stewiesat|flashsat|@DSAT/i.test(s) && !['tests/no_leak_test.js', 'tools/build_library.py'].includes(f)) bad(f, 'source / watermark name');
  // 2b. the GitHub Pages wrapper (#39): only index.html + icons; it loads the app, it never carries data
  if (f.startsWith('site/')) {
    if (!/^site\/(index\.html|icon\.svg)$/.test(f)) bad(f, 'site/ holds only index.html + icons');
    if (/stem_html|passage_html|"key"\s*:|data:image\/|TEST-[A-Z0-9]{6}/.test(s)) bad(f, 'question data / key / figure / student code on the Pages site');
    if ((s.match(/https?:\/\/[^\s"'<>)]+/g) || []).some(u => !/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$|^http:\/\/www\.w3\.org\//.test(u))) bad(f, 'the Pages site loads something other than the app link');
  }
  // 3. source shipped to Apps Script: no embedded form data
  if (f.startsWith('src/')) {
    if (/\\?"key\\?"\s*:\s*\\?["\[]/.test(s)) bad(f, 'answer key field ("key": …) in shipped source');
    if (/function FORM_\w+_\(\)\s*\{\s*return JSON\.parse/.test(s)) bad(f, 'embedded form data');
    if (/data:image\/[a-z]+;base64,[A-Za-z0-9+\/=]{2000,}/.test(s)) bad(f, 'embedded figure (base64 image)');
    if (/"stem_html"|\\"stem_html\\"/.test(s)) bad(f, 'question stem in shipped source');
  }
  // 4. secrets anywhere
  if (/\b1\/\/0[A-Za-z0-9_-]{20,}/.test(s)) bad(f, 'Google refresh token');
  if (/\bya29\.[A-Za-z0-9_-]{20,}/.test(s)) bad(f, 'Google access token');
  if (/\b(ghp|gho|ghs|ghu)_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}/.test(s)) bad(f, 'GitHub token');
  if (/"refresh_token"\s*:\s*"[^"]{10,}/.test(s)) bad(f, 'refresh_token value');
  if (/GOCSPX-[A-Za-z0-9_-]{10,}/.test(s)) bad(f, 'OAuth client secret');
  for (const m of s.match(/\b[0-9a-f]{32}\b/g) || []) if (m !== DESMOS_DEMO_KEY) bad(f, '32-hex string (API key?) ' + m.slice(0, 6) + '…');
  // 5. nothing big (form data is big)
  if (s.length > 400 * 1024 && !inFixtures) bad(f, 'file > 400 KB');
}

// 6. Apps Script refuses two files with the same name (Teacher.gs + Teacher.html → clasp push fails)
const srcNames = {};
fs.readdirSync(path.join(__dirname, '..', 'src')).forEach(n => { const b = n.replace(/\.(gs|html|js)$/, ''); if (/\.(gs|html|js)$/.test(n)) { if (srcNames[b]) problems.push('src/' + n + ': same name as src/' + srcNames[b] + ' (Apps Script refuses it)'); srcNames[b] = n; } });
console.log(`no_leak_test: ${files.length} files scanned`);
if (problems.length) { console.log('FAIL\n  ' + problems.join('\n  ')); process.exit(1); }
console.log('PASS: no question data, keys, figures or secrets');
