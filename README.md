# SAT Math Lib

Private SAT Math practice library for Minh's students: a student signs in with a code, picks one College Board skill and
5 / 10 / 20 questions, works with no timer (time per question is recorded), submits, sees **First Try** / **Best Score**
and the questions by skill. Correct answers are never shown to students; there are no explanations (the tutor explains).
Spec: `02_SPEC.md` v1.1 in the project folder (not in this repo). Engine and look copied from
[minhtranlab/testzone](https://github.com/minhtranlab/testzone) @ 423d809 (v1.13) — no shared code link.

**This repo is PUBLIC: code only.** Question text, figures, answer keys, rationales, student data, codes and tokens never
go in here (CI `tests/no_leak_test.js` checks every file). Tests use the made-up fixture batch `FX1` only.

## Link for students and the teacher
**https://minhtranlab.github.io/satmath/** — the same app as the script.google.com link (that one keeps working). Students type their code; the teacher types the teacher code on the same screen.
- `site/` = the GitHub Pages page (Test Zone way): it only shows the Apps Script web app full screen (iframe); no question data, keys or codes; `noindex, nofollow`. Published to the `gh-pages` branch by `bash tools/publish_site.sh` after `site/` changes. Checked by `tests/site_test.js` + `no_leak_test.js`.

## Where things are
| What | Where |
|---|---|
| Web app | Google Apps Script bound to the Sheet "SAT Math Lib – Data" (`1kvaTZbsSU6ZpI7B6pbYiuQklau2qot8l1bmT_Rc8l2g`), runs as minhtranipad@gmail.com, access: anyone. Script ID `1Cn9_HJQDGdDYIu9uM7_X5-EUQGUPoUR7YyEAnGEj56yAoXwgGAgCbxtF` (`.clasp.json`), web-app deployment in `.deployment` → link `https://script.google.com/macros/s/<.deployment>/exec` |
| Question library (private) | Drive folder "SAT Math Lib - Library" `1kv4i4SLgFFJDOBztZdYt6OFN3EPsQI81` (inside "SAT Math Lib" `1FRwte-8UFn8kBuB8kKWMCJb88zb7Emn2`): `questions/<BATCH>.json` + `figures/<BATCH>/*.png` |
| Code | `src/` — `Code.gs` (web app, auth, sets, grading, result, teacher) · `Library.gs` (Drive library, figures, Questions/Batches/Skills sync) · `Select.gs` (choosing questions, home data) · `Report.gs` (result page) · `Teacher.gs` + `TeacherPage.html` (teacher page) · `TimeNorm.gs` · `Setup.gs` (tabs + columns) · `SheetText.gs` · `Update.gs` (per-deploy Sheet update) · `Skills.gs` + `TimeNorms.gs` (generated) · `Index/Client/Styles.html` |
| Tests | `tests/run_ci.sh` (what CI runs): `no_leak_test` · `spr_test` · `set_test` (server, Apps Script mock) · `e2e_test` (Chromium) |
| Tools | `tools/build_library.py` (check a batch) · `tools/upload_library.mjs` (batch → Drive) · `tools/build_skills.py` (taxonomy → Skills.gs) · `tools/build_time_norms.py` |

## How to ship
Push to `main` → GitHub Action: tests → `clasp push --force` → new version of the same web-app deployment (`.deployment`;
the link never changes) → `<web app>?update=1` runs the Sheet update once for this commit (Update.gs: tabs, settings,
README/Dictionary, Time_Norms, Skills, library sync, check). `.deployment` empty = tests only, nothing deployed.
Secret `CLASPRC_JSON` = clasp login of minhtranipad@gmail.com (scopes: script projects / deployments / web-app deploy, drive.file, email).

Note: the script was made with the Apps Script API `projects.create` + `parentId` = Sheet ID (clasp 3.4.1 `create --type sheets` ignores `--parentId` and makes a new Sheet).

## Deploy by hand (fallback only — the secret `CLASPRC_JSON` is set since 2026-11-13, so a push to main deploys by itself)
If the secret is missing or expired the Action only runs the tests; then a chat deploys from a clone of this repo:
`node tools/clasp_login.mjs start` → Minh opens the link, Allow, pastes back the `http://localhost:8888/?…` address →
`node tools/clasp_login.mjs finish '<address>'` → `npx @google/clasp@3.4.1 push --force` →
`npx @google/clasp@3.4.1 create-deployment --deploymentId "$(cat .deployment)" --description "<commit> <message>"` →
`curl -sL "https://script.google.com/macros/s/$(cat .deployment)/exec?update=1"` (must answer `SAT Math Lib update: done` or `already up to date`).
To switch auto-deploy on: Minh (Mac, Node installed) runs `npx -y @google/clasp@3.4.1 login`, then `pbcopy < ~/.clasprc.json`, and pastes it as repo
secret `CLASPRC_JSON` (Settings → Secrets and variables → Actions). Chats cannot set Actions secrets (blocked through the proxy).

## Library state (14 Nov 2026)
Live: College Board 1,921 version-A items (ALG, ADV, PSD, GEO × E/M/H) + Hard Math HM1 100 · HM2 64 · HM3 57 version-A items = 2,142.
Version B items (HM twins / variants, E413) stay `candidate` — never in practice sets or assignments (Review will use them later).

## Placement test (v0.5, 14 Nov 2026)
- Blueprint v2.2 (🧭 Skills, approved by Minh): `src/Placement.gs` ports `taxonomy/placement/routing.py`; every rule number is a Settings row (`pl_*`).
- The items of forms A / B live in the Sheet tab `Placement_Forms` (form, domain, slot, code) — swap an item by editing its code there.
- Results: tab `Placements` (one row per finished test) + the tested skills' rows in `Levels`; untested skills start at the domain level.
- Tests: `tests/placement_test.js` replays all 718 paths of `placement_paths.csv` and simulates whole tests (min 8 · max 24).

## Skill profiles (v0.5.1, 14 Nov 2026)
- Sheet tab `Skill_Profile` (one row per CB skill; Minh edits it): `allowed` difficulties, `weight` (% of Mixed Practice items), `max_set`.
- No Easy (S.C, S.D): an Easy slot gets Medium level 1. No Hard (Q.D, Q.E): a Hard slot gets the hardest Medium or a real Hard item.
- Mixed Practice: skills with unfixed wrong answers first, then by weight: the 4 areas 35/35/15/15 in every set, skills inside an area by D'Hondt over their weights (a rare skill waits its turn) (`src/Profile.gs`). Review + Placement unchanged.

## Fixes 16 Nov (v0.7.1)
- Reference panel: the SAT Math sheet for `reference_sheet` 'sat_math' or 'sat' (one constant in Client.html), in every set kind and in the review / Fix viewer.
- Sizes: 5 by default (Practice by skill, Mixed). A skill (or Mixed) with an unfinished set shows "Continue N-question set" + "Start a new set instead" (asks; then `startPractice` / `startMixed` with `opts.replace` = that set → status `abandoned`, not graded, not in the history). If the page was old and the server still has an unfinished set of another size, the page asks; it never opens it silently.

## Navigation, home, instant next (v0.7, 14 Nov 2026)
- Every screen is a `#hash` entry (home · set · result · view · t-<teacher screen>). Browser Back / the phone back gesture goes up one level and never leaves the app; inside a set, a test or Fix it asks "Save and leave?". Backspace outside a text box does nothing. Exit (top left in every set) = save + home at once.
- Student home: Assigned focus card (mockup B) with Pick up beside it → Practise by skill → Mixed Practice → Review → History.
- Placement test (option B): `getSet` / `placementNext` / `placementPeek` (read-only, faster; only the item the server itself decides) send `pl` = the current item's key ONLY (`encKey_`: JSON → XOR set|qid → hex) + the items each outcome leads to (F / S / W, content + figures, no keys). The browser decides and shows the next item at once; `placementNext` re-grades (truth) and returns `match: false` + its item when it decides another way (the browser swaps it). Answers go through the write queue and are retried until they arrive.
- Fix: `getFix` sends the key of the first open question, `fixKey` the key of the question opened next (one at a time); Check shows right / wrong at once, `checkTry` records it (truth).
- Teacher profile: Recommended assignment (3 weakest skills × 4: Weak → Easy + Medium, Medium → Medium + Hard; + their Review list) → one click (`publishAssignment` with `auto_pick`); per skill "Assign"; tick skills → one assignment; builder "Also add their Review list".

## Speed (v0.6, 14 Nov 2026)
- Reads come from per-tab snapshots in CacheService (`smlv_<tab>` version + `smlv__epoch`, head `smlh_<tab>` + chunks `smlt_<tab>_<token>_i`, 15 min; all usual tabs fetched in one cache round trip). Every write through `appendObjects_` / `updateRow_` changes the tab's version; a hand edit in the Sheet does too (`onEdit`). A deploy flushes all (`cache` update step). Writes still read the Sheet for exact row numbers.
- `?perf=1` on the exec URL: timings only (no data), at most once per 20 s.
- Edited the Sheet with another tool (Sheets API, a script)? Those fire no `onEdit`: open `<exec URL>?flush=1` (drops every snapshot) or wait ≤ 15 min.
- Browser: teacher screens are cached and refreshed quietly; class screens and the profiles of an open class are fetched ahead; changes show at once and are saved by a queue (in order, one retry, put back + message if refused, warns before closing the tab).
- Classes: Archive (active = No, its open assignments closed) / Show archived / Restore. Inactive students hidden unless "Show inactive".

## Add a batch of questions (no code change)
```
python3 tools/build_library.py "<project folder>/data/library" HM3          # 0 errors needed
node tools/upload_library.mjs "<project folder>/data/library" HM3           # PNGs + JSON → Drive (uses ~/.clasprc.json)
```
Then the next deploy (or Apps Script editor → `syncLibrary`) adds the Batches row (live = No) and the Questions rows.
Minh sets `Batches.live = Yes` → served. A key typed in `Questions.key` wins over the file; `status = hold` pulls one question.
Re-uploading a rebuilt batch (Intake fixed a key, turned an item into version B, dropped one) refreshes its Questions rows at the next
update: Intake-owned columns follow the file; `key` / `accepted` follow it while they still equal `key_file` / `accepted_file` (= untouched);
a key Minh typed and a status `hold` / `excluded` he set stay. An item gone from its file becomes `excluded`.

## Taxonomy changes
`python3 tools/build_skills.py "<project folder>/taxonomy/sml_skills.csv" "<project folder>/reuse/taxonomy/sat_skills.csv"` → commit `src/Skills.gs`.

## If the Google login expires (Action says `invalid_grant`)
A chat does the two-step clasp login (link → Minh presses Allow → pastes back the `http://localhost:8888/?…` address),
then the new `.clasprc.json` content goes into the repo secret `CLASPRC_JSON` (repo → Settings → Secrets and variables → Actions).
