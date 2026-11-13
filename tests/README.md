# Test harness
Runs the real `src/` server code in an in-memory Apps Script + Sheet mock (`gas.js`), and the real client in Chromium (`h.js`, `server.js`).
Library = `fixtures/library` (made-up batch FX1, regenerate with `python3 make_fixtures.py`). `bash run_ci.sh` = everything CI runs.
