#!/usr/bin/env python3
"""Dump all rate-limit buckets for each openai-codex account (no secrets)."""
import base64, json, os, time, urllib.request, urllib.error

store = json.load(open(os.path.expanduser("~/.hermes/auth.json")))

def jwt(tok):
    p = tok.split(".")[1]; p += "=" * (-len(p) % 4)
    return json.loads(base64.urlsafe_b64decode(p))

for e in store["credential_pool"]["openai-codex"]:
    tok = e.get("access_token") or ""
    a = jwt(tok).get("https://api.openai.com/auth", {})
    req = urllib.request.Request(
        "https://chatgpt.com/backend-api/codex/usage",
        headers={"Authorization": f"Bearer {tok}",
                 "chatgpt-account-id": a.get("chatgpt_account_id", ""),
                 "User-Agent": "codex-cli/0.154.0", "Accept": "application/json"})
    print(f"\n== {e.get('label')} ==")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            d = json.loads(r.read().decode())
        print("plan:", d.get("plan_type"), "| user:", d.get("email"))
        for key in ("rate_limit",):
            rl = d.get(key) or {}
            for w in ("primary_window", "secondary_window"):
                pw = rl.get(w)
                if pw:
                    print(f"  {key}.{w}: used={pw.get('used_percent')}% window={pw.get('limit_window_seconds')}s "
                          f"reset_in={pw.get('reset_after_seconds')}s -> {time.strftime('%a %H:%M', time.localtime(pw.get('reset_at',0)))}")
            print(f"  {key}: allowed={rl.get('allowed')} limit_reached={rl.get('limit_reached')}")
        for extra in d.get("additional_rate_limits") or []:
            print("  additional:", json.dumps(extra)[:220])
    except urllib.error.HTTPError as ex:
        print("  HTTP", ex.code, ex.read().decode(errors="replace")[:200])
    except Exception as ex:
        print("  ERROR", ex)
