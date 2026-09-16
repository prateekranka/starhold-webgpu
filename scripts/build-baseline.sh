#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
BASE=a52203db04807f9226d76546c807eb8145e99dd5
if ! git cat-file -e "$BASE:sim/Cargo.toml" 2>/dev/null; then
  echo 'The pinned baseline is missing from this checkout. Fetch repository history before verification.' >&2
  exit 1
fi
DIR=$(mktemp -d)
trap 'rm -rf "$DIR"' EXIT
git archive "$BASE" sim | tar -x -C "$DIR"
cargo build --manifest-path "$DIR/sim/Cargo.toml" --release --target wasm32-unknown-unknown
mkdir -p workshop-evidence
cp "$DIR/sim/target/wasm32-unknown-unknown/release/starhold_sim.wasm" workshop-evidence/baseline.wasm
