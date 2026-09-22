"""
Starhold Native Apple Silicon Laya-MLX Decision Service
FastAPI service exposing real-time RTS decision intelligence powered by laya-mlx.
"""

from contextlib import asynccontextmanager
from typing import Any, Dict, Literal, Optional
import os
import time

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

try:
    import laya_mlx as laya
except ImportError:
    import laya

# Global agent handle loaded on startup
agent = None

PERSONA_PROFILES: Dict[str, Dict[str, str]] = {
    "codex": {
        "title": "Aggressive Raider",
        "doctrine": "Aggressive raider doctrine: high attack tempo, relentless harassment, fast flanking, and decisive frontline pressure.",
        "macro_inst": "As aggressive raider Codex, what strategic macro move maintains relentless pressure?",
        "unit_inst": "What combat unit should Codex train to sustain raiding momentum for faction {faction_name}?",
        "build_inst": "What structure should Codex erect to fuel military conquest for faction {faction_name}?",
        "stance_inst": "What combat stance maximizes offensive aggression and target elimination?",
        "assault_inst": "What primary assault vector inflicts maximum disruption on the enemy?",
    },
    "claude": {
        "title": "Defensive Tech Scaling",
        "doctrine": "Defensive tech scaling doctrine: secure economic foundations, bastion defensive posture, tech progression, and disciplined counter-punches.",
        "macro_inst": "As defensive tech commander Claude, what macro priority secures economic and tech advantage?",
        "unit_inst": "What unit should Claude train for steady defensive fortification and scaling for faction {faction_name}?",
        "build_inst": "What structure should Claude construct to fortify defenses and advance tech tier for faction {faction_name}?",
        "stance_inst": "What combat stance ensures survivability and structured defensive response?",
        "assault_inst": "What assault destination safely secures key positions or preserves forces?",
    },
    "gemini": {
        "title": "Multi-Lane Swarm",
        "doctrine": "Multi-lane swarm doctrine: broad perimeter control, rapid resource expansion, synchronized multi-lane pressure, and overwhelming swarm numbers.",
        "macro_inst": "As multi-lane swarm strategist Gemini, what macro decision best drives multi-front expansion?",
        "unit_inst": "What swarm unit should Gemini train to saturate lanes and overwhelm the foe for faction {faction_name}?",
        "build_inst": "What structure should Gemini construct to support mass production and map control for faction {faction_name}?",
        "stance_inst": "What combat stance facilitates multi-point skirmishing and dynamic map coverage?",
        "assault_inst": "What target expands swarm presence across multiple tactical lanes?",
    },
}

FACTION_UNITS = {
    0: ["riveter", "pack_beetle", "ward_sentinel", "sunlance", "harbor_skiff", "prism_cantor", "star_ram"],
    1: ["ashhand", "chain_mule", "hookguard", "ash_jackal", "sootwing", "brandcaller", "cinder_strider"],
}

FACTION_STRUCTURES = {
    0: ["charter_keep", "freight_court", "heliowell", "hearth_pods", "muster_hall", "starforge", "prism_bastion", "sky_wharf"],
    1: ["pyre_ark", "scrap_maw", "ember_siphon", "soot_nests", "fang_yard", "chainworks", "hook_spire", "rift_mooring"],
}

FACTION_NAMES = {
    0: "Dawnward Compact",
    1: "Cinderwake Reavers",
}


def build_default_questions(persona: str, faction: int) -> Dict[str, Any]:
    profile = PERSONA_PROFILES.get(persona, PERSONA_PROFILES["codex"])
    faction_name = FACTION_NAMES.get(faction, "Dawnward Compact")
    units = FACTION_UNITS.get(faction, FACTION_UNITS[0])
    structures = FACTION_STRUCTURES.get(faction, FACTION_STRUCTURES[0])

    return {
        "macro_priority": {
            "type": "choice",
            "instructions": profile["macro_inst"],
            "criteria": [
                "expand_economy",
                "tech_up",
                "train_army",
                "harass_scout",
                "all_in_attack",
                "fortify_defense",
            ],
        },
        "train_unit": {
            "type": "choice",
            "instructions": profile["unit_inst"].format(faction_name=faction_name),
            "criteria": units,
        },
        "build_structure": {
            "type": "choice",
            "instructions": profile["build_inst"].format(faction_name=faction_name),
            "criteria": structures,
        },
        "combat_stance": {
            "type": "choice",
            "instructions": profile["stance_inst"],
            "criteria": ["aggressive", "defensive", "hold"],
        },
        "assault_target": {
            "type": "choice",
            "instructions": profile["assault_inst"],
            "criteria": [
                "scout_forward",
                "neutral_resource_node",
                "enemy_flank",
                "enemy_main_base",
                "retreat_to_base",
            ],
        },
    }


def compose_thought(persona: str, faction: int, decision: Dict[str, Any]) -> str:
    profile = PERSONA_PROFILES.get(persona, PERSONA_PROFILES["codex"])
    faction_name = FACTION_NAMES.get(faction, "Dawnward Compact")

    macro = decision.get("macro_priority", {}).get("choice", "balanced_operations")
    stance = decision.get("combat_stance", {}).get("choice", "adaptive")
    assault = decision.get("assault_target", {}).get("choice", "key_objective")
    unit = decision.get("train_unit", {}).get("choice")
    structure = decision.get("build_structure", {}).get("choice")

    details = []
    if unit:
        details.append(f"training {unit}")
    if structure:
        details.append(f"constructing {structure}")
    detail_str = f" by {', '.join(details)}" if details else ""

    if "macro_priority" in decision:
        return (
            f"Commander {persona.title()} ({profile['title']}) ordered {macro} with {stance} stance "
            f"directed toward {assault}{detail_str} for {faction_name}."
        )

    # Custom questions fallback
    top_answers = [f"{k}={v.get('choice', v)}" for k, v in list(decision.items())[:3]]
    return f"Commander {persona.title()} ({profile['title']}) resolved strategic queries: {', '.join(top_answers)}."


class DecideRequest(BaseModel):
    persona: Literal["codex", "claude", "gemini"] = "codex"
    faction: int = Field(default=0, ge=0, le=1)
    state_summary: str
    questions: Optional[Dict[str, Any]] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global agent
    # Load model on startup
    agent = laya.load("convaiinnovations/laya")
    # Warmup prediction so MLX graph compiles before incoming traffic
    warmup_state = "Warmup state for Starhold match"
    warmup_questions = {
        "macro_priority": {
            "type": "choice",
            "instructions": "Warmup tactical choice",
            "criteria": ["expand_economy", "tech_up", "train_army"],
        }
    }
    try:
        agent.predict(warmup_state, warmup_questions)
    except Exception as e:
        print(f"Warning during agent warmup: {e}")
    yield


app = FastAPI(
    title="Starhold Laya-MLX RTS Decision Service",
    description="Native Apple Silicon MLX inference service for Starhold AI commanders.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {
        "status": "ready",
        "model": "laya",
        "device": "apple-silicon",
    }


@app.post("/decide")
def decide(req: DecideRequest):
    global agent
    if agent is None:
        raise HTTPException(status_code=503, detail="Laya model is not yet loaded.")

    persona = req.persona.lower()
    profile = PERSONA_PROFILES.get(persona, PERSONA_PROFILES["codex"])
    faction_name = FACTION_NAMES.get(req.faction, "Dawnward Compact")

    # Inject commander persona doctrine and faction context into the battlefield summary
    context = (
        f"Commander: {persona.title()} ({profile['title']}). "
        f"Doctrine: {profile['doctrine']} "
        f"Faction: {faction_name} (ID: {req.faction}). "
        f"Battlefield: {req.state_summary}"
    )

    questions = req.questions if req.questions else build_default_questions(persona, req.faction)

    t0 = time.perf_counter()
    res = agent.predict(context, questions)
    elapsed_time = round((time.perf_counter() - t0) * 1000, 2)

    answers = res.get("answers", {})
    thought = compose_thought(persona, req.faction, answers)

    return {
        "decision": answers,
        "latency_ms": elapsed_time,
        "persona": persona,
        "thought": thought,
    }


if __name__ == "__main__":
    import argparse
    import uvicorn

    parser = argparse.ArgumentParser(description="Starhold Laya Decision Service")
    parser.add_argument("--host", default=os.environ.get("HOST", "127.0.0.1"), help="Host to bind")
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", 5198)), help="Port to bind")
    args = parser.parse_args()

    uvicorn.run(app, host=args.host, port=args.port, log_level="info")
