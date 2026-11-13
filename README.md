# SAT Math Lib

Private SAT Math practice library for Minh's students: a student signs in with a code, picks one College Board skill and
5 / 10 / 20 questions, works with no timer (time per question is recorded), submits, sees **First Try** / **Best Score**
and the questions by skill. Correct answers are never shown to students; there are no explanations (the tutor explains).
Spec: `02_SPEC.md` v1.1 in the project folder (not in this repo). Engine and look copied from
[minhtranlab/testzone](https://github.com/minhtranlab/testzone) @ 423d809 (v1.13) — no shared code link.

**This repo is PUBLIC: code only.** Question text, figures, answer keys, rationales, student data, codes and tokens never
go in here (CI `tests/no_leak_test.js` checks every file). Tests use the made-up fixture batch `FX1` only.

## Where things are
| What | Where |
|---|---|
| Web app | Google Apps Script bound to the Sheet "SAT Math Lib – Data" (`1kvaTZbsSU6ZpI7B6pbYiuQklau2qot8l1bmT_Rc8l2g`), runs as minhtranipad@gmail.com, access: anyone |
| Question library (private) | Drive folder "SAT Math Lib - Library" `1kv4i4SLgFFJDOBztZdYt6OFN3EPsQI81` (inside "SAT Math Lib" `1FRwte-8UFn8kBuB8kKWMCJb88zb7Emn2`): `questions/<BATCH>.json` + `figures/<BATCH>/*.png` |
| Code | `src/` — `Code.gs` (web app, auth, sets, grading, result, teacher) · `Library.gs` (Drive library, figures, Questions/Batches/Skills sync) · `Select.gs` (choosing questions, home data) · `Report.gs` (result page) · `TimeNorm.gs` · `Setup.gs` (tabs + columns) · `SheetText.gs` · `Update.gs` (per-deploy Sheet update) · `Skills.gs` + `TimeNorms.gs` (generated) · `Index/Client/Styles.html` |
| Tests | `tests/run_ci.sh` (what CI runs): `no_leak_test` · `spr_test` · `set_test` (server, Apps Script mock) · `e2e_test` (Chromium) |
| Tools | `tools/build_library.py` (check a batch) · `tools/upload_library.mjs` (batch → Drive) · `tools/build_skills.py` (taxonomy → Skills.gs) · `tools/build_time_norms.py` |

## How to ship
Push to `main` → GitHub Action: tests → `clasp push --force` → new version of the same web-app deployment (`.deployment`;
the link never changes) → `<web app>?update=1` runs the Sheet update once for this commit (Update.gs: tabs, settings,
README/Dictionary, Time_Norms, Skills, library sync, check). `.deployment` empty = tests only, nothing deployed.
Secret `CLASPRC_JSON` = clasp login of minhtranipad@gmail.com (scopes: script projects / deployments / web-app deploy, drive.file, email).

## Add a batch of questions (no code change)
```
python3 tools/build_library.py "<project folder>/data/library" HM3          # 0 errors needed
node tools/upload_library.mjs "<project folder>/data/library" HM3           # PNGs + JSON → Drive (uses ~/.clasprc.json)
```
Then the next deploy (or Apps Script editor → `syncLibrary`) adds the Batches row (live = No) and the Questions rows.
Minh sets `Batches.live = Yes` → served. A key typed in `Questions.key` wins over the file; `status = hold` pulls one question.

## Taxonomy changes
`python3 tools/build_skills.py "<project folder>/taxonomy/sml_skills.csv" "<project folder>/reuse/taxonomy/sat_skills.csv"` → commit `src/Skills.gs`.

## If the Google login expires (Action says `invalid_grant`)
A chat does the two-step clasp login (link → Minh presses Allow → pastes back the `http://localhost:8888/?…` address),
then the new `.clasprc.json` content goes into the repo secret `CLASPRC_JSON` (repo → Settings → Secrets and variables → Actions).
