#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node --import tsx --test scripts/tests/subject-merge-decisions.test.ts
npm run check
npm run build
echo "Code checks passed. Database and browser tests are still required."
