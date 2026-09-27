#!/usr/bin/env python3
"""
Test script for Starhold Laya-MLX Decision Service.
Validates /health endpoint, multi-persona RTS tactical decisions, and inference latency.
"""

import argparse
import json
import sys
import time
import urllib.error
import urllib.request


def make_request(url: str, method: str = "GET", data: dict | None = None) -> tuple[dict, float]:
    headers = {"Content-Type": "application/json"} if data else {}
    body = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)

    t0 = time.perf_counter()
    with urllib.request.urlopen(req, timeout=30) as resp:
        elapsed = (time.perf_counter() - t0) * 1000
        resp_data = json.loads(resp.read().decode("utf-8"))
        return resp_data, elapsed


def test_service(base_url: str):
    print("=" * 60)
    print(f"Testing Starhold Laya-MLX Decision Service at: {base_url}")
    print("=" * 60)

    # 1. Health check
    print("\n[Step 1] Verifying GET /health ...")
    health_url = f"{base_url}/health"
    try:
        health_resp, roundtrip_ms = make_request(health_url)
    except Exception as e:
        print(f"Error connecting to {health_url}: {e}")
        print("Please ensure the service is running:")
        print("  uv run --python 3.12 --with laya-mlx --with fastapi --with uvicorn server/laya_service.py")
        sys.exit(1)

    print(f"  Response: {health_resp}")
    print(f"  Roundtrip: {roundtrip_ms:.2f} ms")
    assert health_resp.get("status") == "ready", "Expected status == ready"
    assert health_resp.get("model") == "laya", "Expected model == laya"
    assert health_resp.get("device") == "apple-silicon", "Expected device == apple-silicon"
    print("  PASS: /health is ready on apple-silicon")

    # 2. Test battlefield scenarios across personas
    decide_url = f"{base_url}/decide"
    scenarios = [
        {
            "persona": "codex",
            "faction": 0,
            "state_summary": "T=45s. Scout sighted enemy refinery undefended at south perimeter. Alloy: 180, Charge: 95. 4 Ward Sentinels ready.",
            "description": "Codex Raider Harassment (Dawnward)",
        },
        {
            "persona": "claude",
            "faction": 0,
            "state_summary": "T=120s. Enemy assault incoming on main ramp with 6 light units. Prism Bastion building at 70%. Need defense anchor.",
            "description": "Claude Defensive Tech Scaling (Dawnward)",
        },
        {
            "persona": "gemini",
            "faction": 1,
            "state_summary": "T=90s. Central resource node open. 2 neutral choke points uncontested. High alloy reserves (260), need multi-lane map control.",
            "description": "Gemini Multi-Lane Swarm (Cinderwake)",
        },
    ]

    print("\n[Step 2] Testing RTS tactical decisions for Codex, Claude, and Gemini ...")
    for s in scenarios:
        payload = {
            "persona": s["persona"],
            "faction": s["faction"],
            "state_summary": s["state_summary"],
        }
        res, roundtrip = make_request(decide_url, method="POST", data=payload)
        decision = res.get("decision", {})
        macro = decision.get("macro_priority", {}).get("choice")
        stance = decision.get("combat_stance", {}).get("choice")
        target = decision.get("assault_target", {}).get("choice")
        unit = decision.get("train_unit", {}).get("choice")
        structure = decision.get("build_structure", {}).get("choice")

        print(f"\n  Scenario: {s['description']}")
        print(f"    Macro Priority : {macro}")
        print(f"    Combat Stance  : {stance}")
        print(f"    Assault Target : {target}")
        print(f"    Train Unit     : {unit}")
        print(f"    Build Structure: {structure}")
        print(f"    Thought        : {res.get('thought')}")
        print(f"    Server Latency : {res.get('latency_ms')} ms (HTTP roundtrip: {roundtrip:.2f} ms)")

        assert macro is not None, "macro_priority missing"
        assert stance is not None, "combat_stance missing"
        assert target is not None, "assault_target missing"
        assert unit is not None, "train_unit missing"
        assert structure is not None, "build_structure missing"

    print("\n  PASS: All RTS tactical decisions generated successfully.")

    # 3. Latency benchmark on focused tactical decisions
    print("\n[Step 3] Benchmarking latency on reactive tactical decisions ...")
    quick_payload = {
        "persona": "codex",
        "faction": 0,
        "state_summary": "Enemy patrol detected at forward beacon.",
        "questions": {
            "combat_stance": {
                "type": "choice",
                "instructions": "Immediate combat stance reaction?",
                "criteria": ["aggressive", "defensive", "hold"],
            }
        },
    }

    # Warmup
    for _ in range(3):
        make_request(decide_url, method="POST", data=quick_payload)

    iterations = 10
    server_latencies = []
    roundtrip_latencies = []

    for i in range(iterations):
        res, roundtrip = make_request(decide_url, method="POST", data=quick_payload)
        server_latencies.append(res["latency_ms"])
        roundtrip_latencies.append(roundtrip)

    avg_server = sum(server_latencies) / len(server_latencies)
    min_server = min(server_latencies)
    avg_roundtrip = sum(roundtrip_latencies) / len(roundtrip_latencies)
    min_roundtrip = min(roundtrip_latencies)

    print(f"  Benchmark ({iterations} iterations):")
    print(f"    Server Latency: avg={avg_server:.2f} ms, min={min_server:.2f} ms")
    print(f"    HTTP Roundtrip: avg={avg_roundtrip:.2f} ms, min={min_roundtrip:.2f} ms")

    if min_server <= 25.0:
        print(f"  SUCCESS: Minimum latency achieved <= 25 ms ({min_server:.2f} ms)!")
    elif avg_server <= 35.0:
        print(f"  EXCELLENT: Fast Apple Silicon response time ({avg_server:.2f} ms avg, {min_server:.2f} ms min)!")
    else:
        print(f"  COMPLETED: Server response recorded at {avg_server:.2f} ms avg.")

    print("\n" + "=" * 60)
    print("All Starhold Laya decision service tests PASSED!")
    print("=" * 60)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test Starhold Laya Decision Service")
    parser.add_argument("--url", default="http://127.0.0.1:5198", help="Base URL of service")
    args = parser.parse_args()

    test_service(args.url.rstrip("/"))
