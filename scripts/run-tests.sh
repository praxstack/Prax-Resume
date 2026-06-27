#!/usr/bin/env bash
# run-tests.sh — canonical test entrypoint for the Prax-Resume repo.
# Verifies the CURRENT canonical resume against the AGENTS.md contract.
# Exit 0 = pass, 1 = violation. Wired as `npm test`.
#
# Scope note: this checks the actively-maintained resume only — NOT every
# historical variant. Older files (Ex-SDE anonymized, Apr-2026) intentionally
# differ (e.g. the Ex-SDE set omits the canonical email by design) and are not
# regression targets. To check a specific file: node scripts/verify-resume.mjs "<file>"
set -uo pipefail
cd "$(dirname "$0")/.."

# The canonical resume under active maintenance. Override with $RESUME_FILE.
CANON="${RESUME_FILE:-Prakhar Shekhar Parthasarthi Resume - v3.html}"

if [ ! -f "$CANON" ]; then
  echo "run-tests: canonical resume not found: $CANON"; exit 2
fi

echo "=== Prax-Resume contract test — canonical resume ==="
echo ">>> $CANON"
node scripts/verify-resume.mjs "$CANON"
RC=$?
echo
if [ "$RC" -eq 0 ]; then echo "PASS — canonical resume meets all AGENTS.md contracts"; else echo "FAIL — contract violation in canonical resume"; fi
exit $RC
