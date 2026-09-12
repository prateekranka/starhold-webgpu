#!/usr/bin/env python3
"""Plus-account quota watchdog: prints state; exit 1 when the 5h window is exhausted."""
import base64, json, os, time, urllib.request, urllib.error

store = json.load(open(os.path.expanduser("~/.hermes/auth.json")))
entry = next(e for e in store["credential_pool"]["openai-codex"] if e.get("label") == "chatgpt-plus")
tok = entry["access_token"]
p = tok.split(".")[1]; p += "=" * (-len(p) % 4)
acc = json.loads(base64.urlsafe_b64decode(p))["https://api.openai.com/auth"]["chatgpt_account_id"]

req = urllib.request.Request(
    "https://chatgpt.com/backend-api/codex/usage",
    headers={"Authorization": f"Bearer {tok}", "chatgpt-account-id": acc,
             "User-Agent": "codex-cli/0.154.0", "Accept": "application/json"})
with urllib.request.urlopen(req, timeout=30) as r:
    d = json.loads(r.read().decode())

rl = d.get("rate_limit", {})
pw = rl.get("primary_window") or {}
sw = rl.get("secondary_window") or {}
used = pw.get("used_percent", 0)
allowed = rl.get("allowed", False)
reset_in = pw.get("reset_after_seconds", 0)
print(f"plus: allowed={allowed} primary_used={used}% reset_in={reset_in/60:.0f}min "
      f"weekly_used={sw.get('used_percent')}%")
if not allowed or used >= 100:
    print("QUOTA EXHAUSTED — stop the loop")
    raise SystemExit(1)
print("quota available")
