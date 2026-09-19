# Working on Starhold

Game development standards and instructions for AI agents, integrating the **Dimillian/Evergrow** tooling-first simulation architecture and **TheOrcDev** production skills.

## Core Directives

1. **Simulation is Authoritative (`sim/src/lib.rs`)**:
   - The browser UI and WebGPU renderer read state and forward commands; they **never** compute game rules or mutate state directly.
   - Fixed 60 Hz simulation accumulator.
   - Deterministic tripwires: Showcase mode at t=108s must remain `{"n":55,"alloy":247,"charge":199,"hash":"20b89f84"}`. Two matches in the same run must produce identical hashes.

2. **WebGPU Isometric Renderer (`src/renderer.ts`)**:
   - Strict 32-color palette quantization.
   - All world geometry and units are generated procedurally with pixel-exact silhouettes. No raster sprite sheets loaded for world entities.
   - Maintain 60+ fps across desktop and mobile viewports (p95 ≤ 20 ms).

3. **Evergrow Tooling & Design QA Standards**:
   - **Tool before tuning**: Complex systems (skill trees, combat, unit rosters) must be backed by headless probes (`scripts/*probe.mjs`) and dev labs (`lab.html`) before balance passes.
   - **Dev-only isolation**: Dev tools and labs must be excluded from `dist/` production builds.
   - **Visual Truth & Evidence**: Compare visual implementations side by side with target concepts. Turn qualitative critique into measurable numbers (e.g. contrast ratios, route continuity, hit bounds).
   - **Verification Harness**: Run gate tests via `scripts/capture.mjs` across viewports: Desktop (960×540), Phone Landscape (844×390), Tablet (1024×768), Phone Portrait (390×844), and iPad Portrait (768×1024).

4. **The Orc Dev Workflow Skills**:
   - **Plan Slicing (`cut-it`)**: Slice complex plans into ordered, verifiable, self-contained implementation phases.
   - **Decisive Review (`war-boss-review`)**: Evaluate changes bluntly against hard requirements (KILL IT / WEAK / WAAAGH-WORTHY).
   - **Asset & Animation Standards (`game-dev/*`)**: Rigorous reference packs, normalized transforms, clear silhouette contracts, and reimport verification.

5. **Interface & Mobile Parity**:
   - Minimum 44×44 px touch targets for all interactive controls.
   - Bar elements must never be squeezed below their own content.
   - Landscape is the primary gameplay mode; portrait viewports display the rotate advisory.

6. **User Communication (ASD-STE100 Simplified Technical English)**:
   - Only ever talk to the user in ASD-STE100 Simplified Technical English (STE).
   - The user is a beginner in programming.
   - Explain all concepts simply.
   - Use short and clear sentences (maximum 20 words for instructions).
   - Do not use complex programming jargon without simple explanation.
