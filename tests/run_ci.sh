#!/usr/bin/env bash
# Every suite that runs on made-up fixtures (= what the GitHub Action runs before deploying). Stops at the first failure.
set -euo pipefail
cd "$(dirname "$0")"
bash setup.sh
run() { echo "::group::$*"; env "$@"; echo "::endgroup::"; }
run node no_leak_test.js      # repo holds no question data / keys / secrets
run node spr_test.js          # grid-in grading rules
run node set_test.js          # Sheet update, library loader, login, home, set, whitelist, figures, submit, result, review, teacher
run node practice_test.js     # adaptive selection + Levels, fix tries, Review, Ask teacher, short codes
run node e2e_test.js          # browser: sign in → home → start 5 → answer → submit → result → review; wrong code; no key in payloads
echo "ALL SUITES PASSED"
