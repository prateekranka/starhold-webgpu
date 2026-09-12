#!/usr/bin/env bash
# Build the Rust simulation crate to wasm32-unknown-unknown and stage it in public/.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CRATE="$ROOT/sim"

[[ -f "$CRATE/Cargo.toml" ]] || { echo "no sim crate at $CRATE" >&2; exit 1; }

# rustup/cargo may live outside the non-interactive PATH.
if ! command -v cargo >/dev/null 2>&1; then
  if [[ -f "$HOME/.cargo/env" ]]; then
    # shellcheck disable=SC1091
    source "$HOME/.cargo/env"
  fi
fi
command -v cargo >/dev/null 2>&1 || { echo "cargo not found" >&2; exit 1; }

cd "$CRATE"
cargo build --release --target wasm32-unknown-unknown

WASM=$(ls -t target/wasm32-unknown-unknown/release/*.wasm 2>/dev/null | head -1 || true)
[[ -n "$WASM" ]] || { echo "no .wasm produced" >&2; exit 1; }

mkdir -p "$ROOT/public"
cp "$WASM" "$ROOT/public/sim.wasm"
echo "staged $(basename "$WASM") ($(stat -c%s "$WASM") bytes) -> public/sim.wasm"
