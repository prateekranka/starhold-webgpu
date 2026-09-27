# starhold-animation HOWTO

## 1. Resolve the asset contract

Read the asset's contract before touching motion. Confirm:

- body plan;
- gameplay speed/role;
- required states;
- attack/contact/release timing;
- socket positions;
- terminal-state requirements;
- animation-specific thresholds.

If the contract is missing, stop and add it through `starhold-asset` first.

## 2. Choose the gait from the body plan

For quadrupeds, start from an explicit phase pattern rather than random leg offsets.

Ash Jackal's current reference gait uses diagonal pairs:

```text
front-left + rear-right
front-right + rear-left
```

Other units may deliberately use a four-beat walk, bound or different support pattern, but record that decision in the contract/candidate intent.

## 3. Make locomotion agree with gameplay movement

Use the simulation movement speed as the external truth. Tune animation cycle/stride so planted contacts read correctly at that speed.

Review at normal gameplay scale. If the feet/legs visually skate even though the enlarged animation looks attractive, fix the motion.

## 4. Author actions around authoritative events

For a ranged attack:

1. anticipation/draw;
2. full aim/commit;
3. release on the simulation-owned release event;
4. recovery.

The renderer may show the nocked arrow before release. It must not spawn a second decorative flying projectile after the authoritative projectile exists.

For melee/contact actions, align the strike pose to the authoritative damage/contact event using the same principle.

## 5. Add hit and terminal presentation

A hit should create readable directional or body recoil without changing simulation ownership/position.

Death/wreck should:

- lower/collapse the silhouette;
- stop returning toward idle;
- remain stable once settled;
- preserve enough identity to understand what died.

## 6. Add gates

Measure only things the contract can defend. For example:

- support count at sampled locomotion phases;
- world/root position stability;
- socket origin across facings;
- release/no-release presentation difference;
- distinct idle/move/attack/wreck geometry;
- terminal wreck height;
- bounds over all required states.

## 7. Review in two places

**Forge:** presentation, facings, native-scale readability, phase scrubbing.

**Encounter Lab:** real movement, real release/contact, projectile/effect origin, obstruction/target behavior.

Passing Forge alone is insufficient for gameplay timing.

## 8. Verify

Run the narrow tests first, then the full floor:

```sh
npm run test:workshop
npm run verify:workshop
npm run test:workshop:browser
```

## Review checklist

Before calling an animation candidate ready for human review:

- does the gait communicate the unit's mass/role?
- do planted contacts stay believable at gameplay speed?
- is the weapon/action readable at native scale?
- does the authoritative gameplay event occur at the visually expected moment?
- does the terminal state stay terminal?
