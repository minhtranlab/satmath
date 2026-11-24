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
run node goover66_test.js    # #66 the time next to every R / S badge (Result, Sets, What to go over, Grid, Details), go-over data in memory
run node goover68_test.js    # #68 mistake type in the go-over top bar (one student / class popover, keys 1–7), a tag resolves the Ask, Notes open in math
run node myskills70_test.js  # My skills v3 (#68 D, #69, #70): position + Placement baseline, gains, focus, lists, Practise, top bar, History, teacher view, masked codes
run node clean70_test.js     # #70 no narrator text, light only, set time = Σ (time − away) with a 20-min cap
run node minor71_test.js     # #71 sign-in, equal map blocks, Recommended = Focus, Assignment tab (edit / cancel / delete), Ask backfill
run node logo73_test.js      # #73 the new logo: site favicons, web app favicon, header marks, sign-in mark
run node qk74_test.js        # #74 QK re-rating → Item_Overrides on a copy: teacher rows kept, Placement skipped, picker/builder read it, idempotent
run node qk98_test.js        # #98 several level files in one update step (QK98 → QK93h), each once, later file wins, one row per qid
run node refresh97_test.js    # #97 teacher Refresh (student + class view, fresh read, tab/scroll kept) + logo = home, no "Classes" link
run node module101_test.js   # #101 real-test module: builder = #102 blueprint (levels, grid-ins, domains, caps, forms), unseen + no CB practice-test item, substitutions logged, score + routes, full test flow, teacher views, Levels
run node module104_test.js   # #104 a module = the same report as any assignment (+ score on top): blocks, slow / rush per cell, teacher times, Fix / Ask / go-over / tags across both modules, My mistakes
run node e2e_module_test.js  # #101 browser: assign Full → Module 1 timed → Module 2 starts by itself (harder) → range + domains + Go over → teacher; phone: time runs out → submitted
echo "ALL SUITES PASSED"
