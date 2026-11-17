#!/usr/bin/env bash
# Harness inputs (git-ignored): MathJax (npm) + the Desmos script. Uses only the made-up fixture library (tests/fixtures/library).
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p .work
{ [ -d node_modules/mathjax ] && [ -d node_modules/mathquill ] && [ -d node_modules/jquery ]; } || npm install --no-audit --no-fund >/dev/null
[ -s desmos.js ] || curl -sSfL -o desmos.js "https://www.desmos.com/api/v1.12/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fda6"
echo "harness ready"
