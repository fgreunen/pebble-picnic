# Physics review — Pebble Picnic 1.3.0

## 12 October 2026 — movable silver metal

The former static obstacles now use finite-health dynamic `metal`: density .0065 (35.4% above stone), HP 120 (33.3% above stone), threshold 6.2. For equal 40×40 bodies hit by the same 8-mass probe at normalized speed 14, stone moved 285.34px and lost 54.71% of its health; metal moved 243.37px and lost 40.82%. A speed-22 real contact destroyed metal and emitted one break. Small/resting contacts remain harmless; metal drop damage follows the existing landing rule. Silver creases/cracks derive from health and restore with Undo.

Only the ground body is static in all five levels. Physical roof/ramp supports and broader foundations preserve stable starts; the seesaw joint references the movable metal base rather than a world anchor. Base removal releases the joint and wakes the beam; Undo restores shared body/constraint references and exact continuation. Fixed scenery rope anchors retain the existing hanging-bridge behavior.

Final frozen integrated results (temporary artifact: `test-results/2026-10-12T15-53-02-491Z-12680-20d4e4/results.json`), SHA-256 `0e6d5d64bffee72cad612dd7da3bbe5327d7cbc259bf35b9f4a85853bde5bcfa`: all 16 audit controls passed within 119 gameplay checks. Current audit (temporary artifact: `tests/physics-report.json`): two-minute drift .087913px with no damage, 100 seeded games/577 shots/53 explosions/max 33 bodies; all nominal finite-ammo routes win and recovery samples score 7/9,5/9,5/9,9/9,6/9. Full type-specific and alternate route regressions also pass. Older measurements below describe the prior build.

## Earlier 11 October evidence

Final 11 October 2026 audit: **16/16 physics controls pass** inside the 115-check integrated run, plus 5 new landing controls and 5 ball-route checks. Frozen input hash `24f9f66d07205da1db8bb8a6039fe9d99d892e9f8f93ea09e8b4f27463f8f261`; historical audit retained with that run's frozen snapshot. All five levels had real winning replays within finite ammunition.

## Rules and fixes

The game uses vendored Matter.js 0.20.0, a fixed 120Hz step, gravity, contact rotation, friction, restitution and momentum transfer. Sleeping keeps intact structures quiet; significant contact and support removal wake them. Removing a support traverses touching dynamic bounds through every floor, waking roofs/pods/balls without applying artificial impulses. Static ground is excluded. Direct and stacked regressions reproduce the formerly floating objects and now fall normally.

Damage requires incoming normal contact speed above a material threshold and sufficient effective impact energy, including rotation at the contact point. Separating overlaps and harmless/resting contact cause zero damage. Incoming normalized velocity is captured before solving for both new and continuing contacts; controlled damage agrees at 60/120/240Hz. Cracks and splinters derive from actual accumulated health.

T23 adds **15% landing damage** only when the damaged body's incoming vertical speed exceeds its material threshold and the surface normal points upward (normalY<−0.55). Side hits keep the original damage. A controlled copy with only that multiplier restored to1 supplies the baseline; identical geometry/time/contact rules are used. Ground, platform and piece landings, tiny drops and a sleeping support-removal cascade pass.

| Material/object |90px fall, before → after |180px fall, before → after |
| --- | ---: | ---: |
| Wood40px square |4.8165 →5.5390 |16.8120 →19.3338 |
| Glass40px square |4.6671 →5.3671 |12.9660 →14.9110 |
| Stone40px square |1.7230 →1.9814 |17.5864 →20.2244 |
| Target pod, radius23px |9.8000 →11.2700 |26.2552 →30.1935 |

These are first-hit game damage units, including possible overkill. Half-pixel drops and extended resting contacts cause zero damage. Larger drops remain more damaging and material health/thresholds remain distinct.

T20 route controls show the special strengths without changing projectile balance: ordinary direct shelter shots work where excess bounce misses; bouncy `[-64,-16]` collects the raised pod9/9 sampled aims versus0/9 ordinary; heavy tips a stone counterweight about80px versus0.11px ordinary; a bomb rolls/rests in the pocket and bursts exactly3000ms after launch. Full alternative shelter, seesaw and bomb-free bridge sequences also win.

Ordinary, heavy and bouncy balls never explode. After 350ms of very low linear/angular motion, they fade for 350ms and leave the physics world; renewed motion cancels retirement. Bombs instead explode exactly **3000ms of active real time after launch**, even when sleeping or offscreen. Collisions cannot trigger/reset the fuse. Map/hidden-tab pause stops the clock; slow motion does not lengthen it. Earlier bombs continue after reload, and final-shot loss waits for pending fuses.

Golden crates retain impact triggering: normal closing speed ≥8 and effective energy ≥24 game units. Each queues once; nearby strong blasts can queue other crates. Bombs/crates add radial impulse inside175px, with distance falloff, inverse-mass response and velocity increment capped at10. Blasts can damage nearby pieces/targets. Chains terminate; no new rigid-body debris is spawned.

Two determinism fixes matter for quality: copy rope/pivot attachment vectors per load because Matter rotates them in place; preserve the whole engine graph for undo, including contact warm-start impulses, stable body IDs and aliases. Rebuilding only poses produced a different next collision; exact live-scene replay now matches positions, velocities, damage and collection outcomes after undo/relaunch.

## Measurements

| Control | Final result |
| --- | --- |
| Elastic contact momentum | Relative error2.13×10⁻¹⁴ |
| Nominal elastic energy |4.192% lost, no gain; passes explicit5% game-solver tolerance |
| Inelastic contact |37.92% of starting energy retained |
| Free flight after1s |Discrete-step error2.68×10⁻¹¹px; continuous-parabola deviation4.17px |
| Controlled incoming contact at60/120/240Hz |Speed10 and damage13.0070457 at every rate |
| Five intact stacks, two minutes after waking |Maximum drift0.015503px; zero resting damage/spontaneous explosions |
|20px static obstacle, maximum launch speed |Ball remains on the incoming side at five starting offsets; no impact detonation |
|100 seeded stress games |578 resolved shots,61 explosions, at most31 bodies; no non-finite states or unresolved shots |
| Physics-only cost, final parallel audit |99th percentile0.1173ms; maximum3.74ms in sample under concurrent suite load |

Recorded nominal routes finish in1/2/4/2/2 shots; the heavy counterweight alternative finishes in2. Fixed recovery sequences under ±2px aim changes win7/9,7/9,9/9,7/9,7/9 cases, within3/5/6/7/8 available shots. New architecture blocked older routes; fixtures were revised after diagnosis and independently replayed by the final audit. A45px counterweight caused0.125px settling drift;30px weights restore0.0155px maximum drift while retaining the heavy advantage.

## Reproduce and interpret

```powershell
Set-Location D:\codex\gameboy
npm test
npm run physics:check
```

[tools/physics-sandbox.cjs](tools/physics-sandbox.cjs) supplies production rigs. Final reports/logs: `test-results/2026-10-11T17-27-45-651Z-17924-ad0f17`. Timing is local, approximate and physics-only, not browser FPS. The new preview uses the same fixed-step flight equation and actual rotated projectile polygon, stopping before contact with current obstacle geometry. It leaves rebounds and future moving-obstacle positions to live physics. [TESTING.md](TESTING.md) records browser/launcher evidence and [TEST_PERFORMANCE.md](TEST_PERFORMANCE.md) records orchestration.

This is an approximate arcade solver. Conservation controls disable drag, breakage and blasts; gameplay intentionally dissipates/adds energy. Even restitution1 is not perfectly elastic. Sleeping remains part of production stability. An earlier 1.2.0 diagnostic with sleeping disabled tipped its seesaw; that unsupported configuration was not rechecked on the new layout. Current production wake/sleep stability passes. Blasts are bounded gameplay forces. Real speaker loudness and touchscreen play remain unverified.
