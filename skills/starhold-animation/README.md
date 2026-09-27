# starhold-animation

A playbook for animation and action presentation that remains synchronized with Starhold gameplay.

## What this skill is for

Use it for:

- unit locomotion/gaits;
- idle secondary motion;
- attack anticipation/release/recovery;
- hit/recoil;
- death/wreck presentation;
- weapon/effect sockets;
- animation-specific quality gates.

## Current reference: Ash Jackal

Ash Jackal is a four-legged mechanical centaur archer. Its rendering and gameplay already demonstrate key rules:

- diagonal-pair locomotion;
- an authoritative bow release point;
- simulation-owned release timing rather than a decorative autonomous arrow;
- separate draw/release/recovery presentation;
- a terminal wreck silhouette.

## OrcDev-inspired principles adapted to procedural WebGPU

The upstream creature/rig workflows emphasize contact-driven locomotion, measurable screening gates and independent review. Starhold applies the same ideas without assuming Blender bones or FBX clips.

### Navigation root vs presentation motion

Gameplay position/yaw remain authoritative. Animation offsets should not secretly move the actor's simulation coordinates.

### Locomotion should agree with movement

A gait must communicate the unit's actual role and speed. Planted legs should read as planted; swing legs should lift and return smoothly. Do not hide bad contact by speeding up the entire animation independently of gameplay movement.

### Actions have phases

Attacks should read as:

```text
anticipation -> committed action/release -> recovery
```

The authoritative gameplay event should line up with the presentation release/contact phase.

### Terminal states stay terminal

A wreck/death state must not visually drift back toward idle. The final silhouette should settle and remain readable.

### Gates screen, humans approve

Numeric/mechanical gates catch drift, impossible geometry and timing mismatches. They do not decide whether an action has enough character or faction identity.

## Suggested Starhold gates

Depending on the unit:

- planted-foot/leg drift within the asset contract;
- root/simulation position unchanged by presentation-only motion;
- loop seam below the chosen gameplay-scale tolerance;
- required support count during locomotion;
- floor/terrain penetration within tolerance;
- weapon/contact socket matches authoritative event origin;
- no duplicate decorative projectile at release;
- attack phase reaches a distinct anticipation and recovery pose;
- wreck/death remains terminal.

Thresholds belong in the asset contract and should not be loosened simply to get green tests.

See [`HOWTO.md`](HOWTO.md).
