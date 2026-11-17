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
run node teacher_test.js      # teacher page: students + codes, classes, assignments, What to go over order, tags → Review, asks, profile
run node mixed_test.js        # Mixed Practice, new students start Easy, codes teacher-only
run node placement_test.js    # placement: routing = routing.py (718 paths), schedule sim (8–24), Settings, server flow, retake B
run node profile_test.js      # Skill_Profile: no-Easy / no-Hard skills, rare skills (5 only), Mixed weights over 1,000 items, builder notes
run node sync_test.js         # a rebuilt batch reaches the Sheet (fixed key, version B, dropped item); Minh's own edits stay
run node e2e_test.js          # browser: sign in → home → start 5 → answer → submit → result → review; wrong code; no key in payloads
run node e2e_teacher_test.js  # browser: teacher page from sign-in to profile
run node e2e_placement_test.js # browser: assign placement → one question at a time → result → teacher report
run node site_test.js         # GitHub Pages wrapper: only the app link, noindex; laptop + phone student and teacher sign-in
run node calc_test.js         # browser: calculator panel on laptop + phone (drag, resize, expand, close, window resize)
run node speed_test.js        # speed: tab snapshots (write / hand edit / race), write queue (order, retry, rollback, no loss), < 0.3 s clicks, archive
run node nav_test.js          # Back / Backspace / Exit, home order, placement one key at a time + instant next, Fix instant, result 2×2, assign from profile
run node fix47_test.js        # Reference sheet in every set kind + viewer; default 5; unfinished set → Continue / "Start a new set instead" (abandoned)
run node pace48_test.js       # time to the final answer (revisit / change / blank), pace + placement bands from it; leave-window log (practice silent, placement note, ⚠)
run node goover50_test.js    # #50 go over on the test screen (key only on Show answer), level boxes → Item_Overrides read everywhere, Undo, iPad
run node goover62_test.js    # #62 teacher tools: Notes pad (MathQuill, copy rich + plain), pen on the question (4 colours, gone on the next question), instant Show answer
echo "ALL SUITES PASSED"
