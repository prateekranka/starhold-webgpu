#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
cargo build --manifest-path sim/Cargo.toml --release --target wasm32-unknown-unknown --features workshop --target-dir sim/target/workshop
mkdir -p tools
cp sim/target/workshop/wasm32-unknown-unknown/release/starhold_sim.wasm tools/sim.workshop.wasm
node --input-type=module <<'JS'
import {execFileSync} from 'node:child_process';
import {writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
let revision='unknown',dirty=true;
try{revision=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();dirty=!!execFileSync('git',['status','--porcelain','--untracked-files=no'],{encoding:'utf8'}).trim();}catch{}
writeFileSync('tools/revision.json',JSON.stringify({revision,dirty,builtAt:new Date().toISOString(),wasmSHA256:createHash('sha256').update(readFileSync('tools/sim.workshop.wasm')).digest('hex')},null,2));
JS
