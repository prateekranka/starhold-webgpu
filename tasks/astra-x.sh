#!/usr/bin/env bash
# Astra xhigh runner for Starhold targeted tasks. Codex ChatGPT-subscription, Plus account.
# Usage: tasks/astra-x.sh <brief-file> <logfile> [extra codex args...]
# Fresh context every run (codex exec starts a new session). Standard mode.
set -euo pipefail

BRIEF="${1:?brief file}"
LOG="${2:?log file}"
shift 2 || true

ROOT="$HOME/Cowork/starhold"
CODEX_HOME_DIR="${STARHOLD_CODEX_HOME:-$HOME/.codex-linux}"
CODEX_BIN="${CODEX_BIN:-$HOME/.local/codex-154/node_modules/.bin/codex}"
MODEL="${STARHOLD_ASTRA_MODEL:-gpt-6-astra}"
EFFORT="${STARHOLD_ASTRA_EFFORT:-xhigh}"

[[ -x "$CODEX_BIN" ]] || { echo "missing codex binary at $CODEX_BIN" >&2; exit 1; }
[[ -f "$CODEX_HOME_DIR/auth.json" ]] || { echo "missing $CODEX_HOME_DIR/auth.json" >&2; exit 1; }

mkdir -p "$(dirname "$LOG")"
echo "STARHOLD-ASTRA-X model=$MODEL effort=$EFFORT $(date -Is)" | tee -a "$LOG"

CODEX_HOME="$CODEX_HOME_DIR" "$CODEX_BIN" exec \
  --dangerously-bypass-approvals-and-sandbox \
  --skip-git-repo-check \
  --cd "$ROOT" \
  -m "$MODEL" \
  -c "model_reasoning_effort=\"$EFFORT\"" \
  -c "features.fast_mode=false" \
  "$@" \
  "$(cat "$BRIEF")" 2>&1 | tee -a "$LOG"
exit "${PIPESTATUS[0]}"
