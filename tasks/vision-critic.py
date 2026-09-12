#!/usr/bin/env python3
"""Independent blind vision critic via the raw DeepSeek chat-completions API.

Usage:  python3 tasks/vision-critic.py 'PROMPT' img1.png [img2.png ...]

Why this exists: the OpenCode CLI `-f` attach path does not deliver images to
DeepSeek vision models, and cursor-agent named models are plan-gated. This hits
the API directly, which does deliver images.

Reads DEEPSEEK_API_KEY from ~/.hermes/.env. Never prints the key.
Exit 0 on a verdict, 1 on transport/API failure, 2 on a refusal to answer.
"""
import base64
import json
import os
import pathlib
import sys
import urllib.error
import urllib.request

API = "https://api.deepseek.com/chat/completions"
MODEL = os.environ.get("VISION_MODEL", "deepseek-v4-flash")


def api_key() -> str:
    env = pathlib.Path.home() / ".hermes" / ".env"
    if env.exists():
        for line in env.read_text().splitlines():
            line = line.strip()
            if line.startswith("DEEPSEEK_API_KEY="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    key = os.environ.get("DEEPSEEK_API_KEY", "")
    if not key:
        sys.exit("no DEEPSEEK_API_KEY found")
    return key


def data_url(path: str) -> str:
    raw = pathlib.Path(path).read_bytes()
    kind = "image/png" if raw[:4] == b"\x89PNG" else "image/jpeg"
    return f"data:{kind};base64,{base64.b64encode(raw).decode()}"


def main() -> int:
    if len(sys.argv) < 3:
        sys.exit("usage: vision-critic.py 'PROMPT' img1.png [img2.png ...]")
    prompt, images = sys.argv[1], sys.argv[2:]

    content = [{"type": "text", "text": prompt}]
    for img in images:
        content.append({"type": "image_url", "image_url": {"url": data_url(img)}})

    body = json.dumps({
        "model": MODEL,
        "messages": [{"role": "user", "content": content}],
        "max_tokens": int(os.environ.get("VISION_MAX_TOKENS", "8000")),
    }).encode()

    req = urllib.request.Request(API, data=body, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("Authorization", f"Bearer {api_key()}")
    req.add_header("User-Agent", "curl/8.5.0")

    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            payload = json.load(resp)
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode(errors="replace")[:600]
        print(f"HTTP {exc.code}: {detail}", file=sys.stderr)
        return 1
    except Exception as exc:  # noqa: BLE001 - report any transport failure
        print(f"transport failure: {exc}", file=sys.stderr)
        return 1

    choice = payload.get("choices", [{}])[0]
    text = (choice.get("message") or {}).get("content") or ""
    if not text.strip():
        reason = choice.get("finish_reason")
        print(f"empty content (finish_reason={reason})", file=sys.stderr)
        return 2
    print(text.strip())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
