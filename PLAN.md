# Plan — Pebble Picnic

## Approach
Build an original, cheerful slingshot game with HTML Canvas, plain JavaScript, and a vendored copy of Matter.js 0.20.0 (MIT). All runtime files are local. `PLAY.cmd` opens `index.html` in the default browser; no server, account, or install is required to play. Node.js is used only for development tests.

## Milestones
1. **Foundation:** write this plan, vendor the physics engine/license, create an offline launcher and a runnable first level.
2. **Complete loop:** mouse/pointer drag, clamped power, trajectory, cancel, impact damage, stable movable structures, limited shots, bounded shot resolution, win/loss, retry.
3. **Content:** five distinct hand-designed levels with wood/glass/stone, gradual difficulty, selection/progression, cheerful original procedural art and optional synthesized audio.
4. **Verification:** deterministic physics tests, real browser playtest, focused fixes, launcher/offline checks, concise README and final progress record. Stop adding scope when acceptance criteria pass.

## Acceptance criteria
- Pull a loaded pebble backward and release to launch; Escape/right-click cancels without using a shot.
- Aim preview, shot indicators, marked star targets, obvious outcome controls; resize correctly and support mouse/touch pointers.
- Gravity, rotation, friction, bouncing, momentum transfer, individual collapsible pieces, materially different density and durability.
- Gentle/resting contact causes no damage; structures remain stable before the first shot.
- Every shot ends after settling, leaving bounds, or a maximum duration, including the final shot; each level has a reproducible winning shot sequence within its allowance.
- At least five distinct levels; retry, restart, selection and progression work; collapsed scenes stay responsive.
- All runtime dependencies/assets are local, attributed, and playable without internet. Document exact run/test commands and distinguish automated checks from observed UI tests.

## Bounded testing
Test each meaningful milestone. Use deterministic Node simulations for physics, stability, outcomes and winning trajectories. Use an actual browser for controls, rendering, sound/mute, resize, navigation and launch. Fix observed failures and rerun affected checks; avoid open-ended polish.

## Follow-up: physics quality and impact explosions
1. Build an isolated Node physics sandbox and measure momentum/energy, gravity, friction, collision damage direction, thin obstacles, long resting stability and small aim variations.
2. Fix demonstrated physics issues. Normalize pre-impact velocity consistently and ensure separating contacts cannot damage pieces.
3. Add cheerful pebble explosions on sufficiently hard structure impacts, with bounded blast momentum, visible feedback and harmless-contact/ground-bounce exclusions.
4. Run physics, input and sandbox suites; verify all five levels remain winnable and publish a concise PHYSICS_REVIEW.md with quantitative evidence and limits. Keep offline launch unchanged.

## Requested improvement milestones
See TODO.md for T1–T19 and their acceptance criteria. T12's fixed timer supersedes the earlier impact-bomb rule above.
1. Remove duplicate scene decorations; improve win/reload pacing and pull feedback.
2. Separate finite ordinary/heavy/bouncy/bomb ammo; expand the five layouts, chain crates, themed map, stickers and co-op turns.
3. Add a three-second active-time bomb fuse/countdown, support wake-up, ordinary-ball cleanup, half-strength shake, exact last-shot undo and health-based damage art.
4. Freeze test inputs, run independent suites in parallel, compare timings on one snapshot, recheck winning routes and browser controls, finish evidence and launch guidance. PROGRESS.md records the current checkpoint; mark TODOs only after verification.

## T20–T23 continuation
1. Add independent angle/power keyboard controls through the existing launch API, preserving mouse controls, focus safety, cancellation and last aim.
2. Draw a high-contrast trajectory using production fixed-step flight integration, stopping at the first obstacle contact.
3. Increase downward landing damage by a small measured factor; retain harmless-contact thresholds and audit stability/cascades.
4. Give each ball a useful route in existing levels, verify alternatives and finite ammo, then run the final frozen suite and browser checks at two sizes. Update launch/player instructions and checkpoint evidence.
