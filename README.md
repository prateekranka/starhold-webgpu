# Starhold foundation

Raw Rust/WASM simulation and a raw WebGPU isometric colony renderer. Build with
`npm run build`; the orchestrator owns browser capture and runtime validation.
Default seed is 73129; `?seed=123` overrides it. Simulation begins at tick zero.

The initial colony includes the Keep, Court, Well, first Bastion, four queued
construction sites, nineteen colony units, twelve ore props and two service
motes. Builder pairs pre-position at the first sites and relay to the next pair;
construction advances only with both assigned workers on the apron. Raids start
at 36 seconds and repeat every 30 seconds. Projectiles move in simulation and
apply damage on arrival. Packed selection is backed by stable simulation slots.

The 480×270 canvas is nearest-neighbor scaled in integer steps when space allows.
Geometry, bitmap HUD and controls are drawn into the same palette-quantized
WebGPU frame. Transparent DOM buttons supply accessible hit targets. Ray picking
uses the submitted component boxes and terrain occlusion. GPU command objects
are created as required by WebGPU; application instance arrays, uniform data,
command submission list and entity-memory view are reused. Bitmap HUD geometry
is rebuilt only when its displayed values change.

The binding exports and `window.__APP` are implemented. Three additive read-only
exports provide the heightfield (`sim_terrain_ptr`, 1024 f32 values in row-major
order), `sim_alloy` and `sim_charge`. They do not change the entity stride/layout.

## Scope of this pass

Implemented: initial construction sequence, moving miners and carriers, mining
and drop-off counters, charge generation, infantry patrols, skiff circulation,
raider approach/retreat, projectile combat, staged voxel buildings, shadows,
crystals, smoke, cloth, motes, camera controls, selection and bitmap inspection.

Follow-up work: full obstacle-aware navigation and traffic avoidance; physical
ore depletion/renewal and complete resource reservation/delivery accounting;
Wharf and later expansion/refurbishment; accurate per-weapon combat timings,
arcing siege shells, death/salvage and replacement/repair economy; detailed
architectural silhouettes, terrain ramps, ellipsoidal shadows, hidden-selection
chevrons and the complete environmental motion inventory. Current route segments
are direct waypoint movement and may cross obstacles or height steps. Defensive
units recover at zero HP as a foundation placeholder. This is an approximation
of the target composition, not a claim of visual parity.

Compilation succeeds via `npm run build`. No servers, browser tests, screenshots,
capture runs or performance measurements were performed by this coding pass.
