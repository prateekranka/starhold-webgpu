#!/usr/bin/env bash
# Astra runner for Starhold. Codex ChatGPT-subscription, Pro account.
# Usage: tasks/astra-run.sh <plan|coder> <brief-file> <logfile> [extra codex args...]
#   plan  -> gpt-6-astra, reasoning high, fast mode   (world planning)
#   coder -> gpt-6-astra, reasoning medium, fast mode (implementation)
# Fresh context every run by construction (codex exec starts a new session).
set -euo pipefail

ROLE="${1:?role plan|coder}"
BRIEF="${2:?brief file}"
LOG="${3:?log file}"
shift 3 || true

ROOT="$HOME/Cowork/starhold"
# Account selection: default = Plus account home (this exercise runs on Plus quota only).
CODEX_HOME_DIR="${STARHOLD_CODEX_HOME:-$HOME/.codex-linux}"
CODEX_BIN="${CODEX_BIN:-$HOME/.local/codex-154/node_modules/.bin/codex}"

case "$ROLE" in
  plan)  MODEL="gpt-6-astra"; EFFORT="high";   FAST="true" ;;
  coder) MODEL="gpt-6-astra"; EFFORT="medium"; FAST="true" ;;
  *) echo "role must be plan|coder" >&2; exit 2 ;;
esac

[[ -x "$CODEX_BIN" ]] || { echo "missing codex binary at $CODEX_BIN" >&2; exit 1; }
[[ -f "$CODEX_HOME_DIR/auth.json" ]] || { echo "missing $CODEX_HOME_DIR/auth.json" >&2; exit 1; }

mkdir -p "$(dirname "$LOG")"
echo "STARHOLD-ASTRA role=$ROLE model=$MODEL effort=$EFFORT fast=$FAST $(date -Is)" | tee -a "$LOG"

CODEX_HOME="$CODEX_HOME_DIR" "$CODEX_BIN" exec \
  --dangerously-bypass-approvals-and-sandbox \
  --skip-git-repo-check \
  --cd "$ROOT" \
  -m "$MODEL" \
  -c "model_reasoning_effort=\"$EFFORT\"" \
  -c "features.fast_mode=$FAST" \
  "$@" \
  "$(cat "$BRIEF")" 2>&1 | tee -a "$LOG"
exit "${PIPESTATUS[0]}"
