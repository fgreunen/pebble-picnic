# Development reference

Read the sections relevant to the task. [AGENTS.md](AGENTS.md) contains the short standing instructions; this file provides implementation context. Reviewed against the code on 11 October 2026 while another chat was actively editing it. This is not a fresh gameplay test report.

## Context and document ownership

| Resource | Purpose |
| --- | --- |
| [TODO.md](TODO.md) | Requested behavior, task IDs, acceptance criteria and completion status. Read later amendments when requirements conflict. |
| [PROGRESS.md](PROGRESS.md) | Active work, dated handoffs, verification results and next action. Preserve other chats' entries. |
| [README.md](README.md) | Player controls, offline launch and development entry points. |
| [TESTING.md](TESTING.md) / [PHYSICS_REVIEW.md](PHYSICS_REVIEW.md) | Historical test/browser evidence and physics limitations; check which version each result covers. |
| [PLAN.md](PLAN.md) | Original approach and earlier milestones; not the current completion ledger. |

Avoid copying the whole backlog or test totals into more documents. When changing behavior, update the relevant player guidance and record new evidence with its scope. A newer section saying verification is pending takes precedence over an older successful run. Session IDs, browser tabs and running-process notes must be checked before reuse; they are not durable resources.

Start new Codex chats from the project root. At review time this folder had no Git repository. Without a detected project root, instruction discovery checks only the current directory; placing the chat in `src/` can miss the root guide. Existing chats should explicitly read the new instructions. See the [official AGENTS.md loading rules](https://learn.chatgpt.com/docs/agent-configuration/agents-md).

## Architecture and useful entry points

| File | Responsibility and useful symbols |
| --- | --- |
| `index.html`, `styles.css`, `PLAY.cmd` | DOM IDs, overlays, responsive layout, accessibility and local-file launch. Script order: Matter, levels, physics, damage art, game. |
| `src/levels.js` | Data/builders for pieces, targets, ramps, pivots, ropes, themes, stickers and typed ammunition. `shots` is derived from the ammo inventory. Browser export `PicnicLevels`; CommonJS export for Node. |
| `src/physics.js` | `GameWorld`: `load`, `launch`, `selectProjectile`, `step`, `advanceRealTime`, `resolve`, collision damage, blasts, removal and events. Exports `PicnicPhysics` / CommonJS. No DOM dependency. |
| `src/game.js` | Browser IIFE: pointer/keyboard handlers, `event`, `load`, `loop`, `drawBody`, `aim`, procedural art/audio, UI and persistence. Uses production `GameWorld`. |
| `src/damage-art.js` | Deterministic local-coordinate cracks/splinters/shading derived from body HP, material and seed; no separate mutable state. |
| `tools/test-runner.cjs` | SHA-256-verified frozen snapshots, parallel/serial suite processes, isolated logs, guarded audit publication; `--compare` benchmarks identical inputs. |
| `vendor/` | Matter.js 0.20.0 and its license. Tune application behavior outside the minified vendor. |
| `tests/ui-host.cjs` | `createHost()` runs production UI with a minimal DOM/audio host; `frames(seconds)` advances a synthetic clock. |
| `tools/physics-sandbox.cjs` | Production-engine rigs and helpers: `rig`, `piece`, `pebble`, `steps`, `fire`, `finite`, momentum and energy measurements. |

### Physics and lifecycle details

- The logical canvas is 1280 x 720; `point()` maps browser coordinates into it and `resize()` manages pixel density. Keep input mapping, rendering, bounds and aiming consistent if dimensions change.
- Production steps are fixed at `STEP = 1000 / 120` ms. Matter's normalized velocity accessors use pixels per 1/60 second; do not mix them with raw position deltas when calculating damage. `beforeSolve` captures incoming linear/angular velocity because collision callbacks occur on different sides of resolution.
- Browser `loop()` calls `world.step(0)` for simulation, then `advanceRealTime()` once per active frame. Direct `step()` calls in tests advance both clocks by default. Avoid double-counting real time or tying reload deadlines to slow motion. Map-open and hidden-tab behavior also need coverage when adding timers.
- `ready` means another launch is permitted, not that all objects have stopped. Old projectiles/debris continue to simulate; `activeProjectile` tracks only the latest shot and can become null while older balls remain. Implement per-ball fuse/cleanup behavior on the actual bodies, not solely that pointer.
- Removal goes through `removeBody()` to release constraints and wake affected sleeping structures. Destruction and blasts are queued around the physics update. Preserve single collection/explosion events and bounded chain reactions.
- Physics owns `ready`/`flying`/`won`/`lost`; presentation separately delays the victory popup. Retry/level changes must cancel delayed results, aim/audio and transient effects. Storage failures must leave gameplay usable.
- `window.picnic` exposes read-only diagnostics. `GameWorld.snapshot()` reports counters; `capture()` privately copies the complete Matter engine graph, preserving contact caches and aliases. One consumed `undoState` restores it with owned handlers rebound once, plus clocks/ammo. The UI restores turn/stickers and clears stale effects/results. Rebuilding just the bodies caused a proven continuation regression.
- Bombs use a fixed 3000ms active-real-time deadline, independent of contacts and slow motion; last-shot loss waits for pending bombs. Ordinary/heavy/bouncy balls fade after 350ms resting and remove after another 350ms; movement cancels retirement. Both run on the bodies, including older shots after reload.

### Changes from the earlier baseline

- T12's timer replaces impact-bomb logic; T9 crates still trigger on strong impacts. Sandbox `pebble()` defaults to a bomb with deadline 3000; pass the type explicitly or use `GameWorld.launch()` for inventory/material tests.
- Damage art replaces the old single crack and derives entirely from health so retry/undo restore it automatically.
- Easy Mode converts independent angle (−15° to70°) and pull distance (25–96px) to the existing launch path. Clear held keys on canvas/window focus loss, focus into controls, pauses and resets; repeated Space never queues another shot. Keep last aim through shots/undo and focused controls' native keys.
- `predictTrajectory()` uses cached detached Matter polygons and production fixed-step Verlet/air drag. It stops before contact in the current scene and predicts free flight only, without rebounds or future obstacle movement. Landing damage uses a1.15 multiplier only for downward contacts above the original material threshold; lateral impacts stay unchanged.
- Connected AABB wake traversal handles support removal through sleeping floors without applying forces. Normal sleeping stability differs from deliberately disabling sleep: the balanced seesaw can tip in that unsupported diagnostic configuration.
- Matter rotates constraint attachment vectors in place. Copy level-definition vectors per world; otherwise repeated retries/search replays mutate levels and disagree.
- T24 replaces the former fixed green platforms with movable, breakable silver `metal` pieces (density .0065, HP 120, damage threshold 6.2 versus stone .0048/90/5.6). Only the ground body is static in playable levels. Ramp feet and shelter supports are physical pieces; the seesaw's `pivot.support` names an earlier piece's `id`, binding its joint to that body so moving/breaking the base affects the beam. Preserve shared constraint/body references through Undo.
- T25–T30 append five `quick` scenes after the five adventure levels. Fruit uses dynamic circles with `game.kind = 'fruit'`, no breakage/retirement, and normal gravity. `checkExtras()` tests optional bubble overlap without creating collision bodies and marks centered basket-zone entries once; both rewards stay independent of `targets()`/outcomes. Bubble arrays/counts and fruit flags are captured with the engine for Undo. UI reactions use active `world.realTime`; launched decorations belong to bodies, while the selected decoration persists separately. Prepared animals reference piece seeds; replay cycles hiding places and UI Undo restores the same placement/reveal. Flowers and shattered-piece faces are bounded and restored from the prelaunch UI snapshot; new sounds are capped and stopped on discarded scenes, map, hidden tab and mute.

## Tests and command side effects

Run commands from the project root. `package.json` is the source of truth for npm scripts; no build step or dependency install is required.

| Command | Use | Writes |
| --- | --- | --- |
| `node tests/controls.test.cjs` | Pointer capture, cancellation, fast release, retry, selection and basic UI handlers | None |
| `node tests/upgrade.test.cjs` | Reload/timing, typed ammo, crates, supports, victory UI, audio lifecycle, co-op and storage | None |
| `node tests/physics.test.cjs` | Levels, stability, nominal winning routes, outcomes, bounds and offline references | None |
| `npm run physics:check` | Isolated physics controls, long stability, aim perturbations and seeded stress | `tests/physics-report.json` after success |
| `node tests/lifecycle.test.cjs` | Timed bombs, pause/fuse UI, half shake, retirement and exact undo continuation | None |
| `node tests/damage-art.test.cjs` | Progressive health artwork, deterministic restoration and silhouette bounds | None |
| `node tests/easy-mode.test.cjs` | Keyboard/mouse equivalence, held/focused input, undo and collision-clipped trajectory | None |
| `node tests/landing-damage.test.cjs` | Controlled baseline/drop comparisons, harmless settling and support cascades | None |
| `node tests/projectile-routes.test.cjs` | Ordinary/bouncy/heavy/bomb advantages and full alternative winning routes | None |
| `node tests/toddler-play.test.cjs` | Cosmetic cancellation, optional bubble/reaction/animal/fruit feedback, pause, Undo, shared/Easy input | None |
| `node tests/quick-scenes.test.cjs` | Quick-scene awake stability, forgiving one-shot routes, normal-physics fruit release/catch, exact Undo | None |
| `node tools/test-runner.test.cjs` | Snapshot races, isolated children, scheduling, timeout/failure and publication guards | Synthetic `test-results` artifacts |
| `npm test` | All eleven suites in parallel against frozen inputs; no inter-suite sleeps | `test-results` logs/manifests; matching successful audit report |
| `npm run test:serial` / `npm run test:benchmark` | Sequential fallback / same-snapshot serial-parallel comparison | Isolated logs and guarded audit report |
| `npm run serve` | Local browser inspection on `127.0.0.1:8080` | No files; occupies the port until stopped |
| `node tools/probe-physics.cjs` | Diagnostic contact cases and fixture perturbations | None |
| `node tools/find-solutions.cjs 4` | Bounded winning-route search for zero-based level 4 | `tests/solutions.json` |
| `node tools/robust-solutions.cjs 4` | Recovery-shot search across small aim variations | `tests/solutions.json` |
| `node tools/solve.cjs 4` | Compatibility alias for `find-solutions.cjs` | `tests/solutions.json` |

The custom suites execute directly with Node and throw on failure; they are not a configured test framework with per-test filtering. Use standalone suite commands during iteration. A failed audit can leave an old report on disk, so the file's existence is not evidence that the current run passed.

Fixture entries are `{ type, pull: [x, y], wait }`; pull is in game pixels and wait in simulated milliseconds. Adventure fixtures live in `tests/solutions.json`; optional Quick play fixtures are independently maintained in `tests/quick-solutions.json`. Historical five-level audit/route loops intentionally cover Adventure; the quick-scene suite checks the additions, with <6px of harmless awake settling allowed for round fruit/piles. `fire()` advances ticks synchronously and allows collapse time after early reload. A 6000 ms fixture wait is not a six-second wall-clock sleep. Measure elapsed execution time before optimizing. Search cost comes from replaying many candidate sequences; select only affected levels and keep search separate from normal verification.

For physics/rule changes, start with the regression suite and affected rigs, then run all suites once on the final integrated version. For UI changes, use the host tests plus a focused real-browser check of changed controls/layout, including a smaller window. For pure documentation, inspect content and links. Never weaken a stability assertion or replace a losing fixture before understanding whether the change is intended.

Browser evidence should identify the build, viewport, interaction and observed result. Host tests cannot prove rendering, touch input or audible quality. Prefer actual controls for playtests and diagnostics for observation. Stop only servers/processes owned by your task, and restore settings changed by a test when appropriate.

## Parallel work and subagents

For this small codebase, start with a lead plus one or two helpers when work can proceed independently. A useful arrangement is:

| Role | Assignment | Ownership |
| --- | --- | --- |
| Lead | Implement the feature, decide interfaces, integrate fixes and maintain the handoff | Related runtime files and final integration |
| Tester | Reproduce the original bug; at a checkpoint, test a frozen build and return failures with reproduction steps | Separate snapshot, logs and explicitly assigned test files |
| Reviewer | Independently examine lifecycle edge cases and missing acceptance coverage | Read-only source review; return actionable findings with file/function references |

Keep small edits or changes tightly coupled within `physics.js` under one implementation owner. Do not assign a separate agent to every TODO when those tasks touch the same lifecycle. For example, keep timed bombs and projectile retirement together; a helper can review slow-motion/pause/final-shot interactions while another tests completed checkpoints. Visible fuse UI can be delegated once its physics contract is agreed. Use the model defaults below when the available delegation tool supports selecting them.

Give each helper the task ID, exact requirement, input version/path, allowed files, prohibited shared writes, expected checks and required return format. Ask for concrete failing cases rather than a general assurance that the feature looks good. Return a compact summary: version, commands/exit codes, findings, changed files and remaining uncertainty. The lead should keep working on independent work, then resolve findings and verify the integrated result before marking completion.

Parallel shell processes are enough to run independent test suites; an agent is useful when results require investigation or judgment. Avoid having multiple agents repeat the same full suite or run competing fixture searches. Start with two helpers and measure useful turnaround; more agents can add coordination and token cost. OpenAI recommends bounded tasks and particular care with concurrent writes; see [official subagent guidance](https://learn.chatgpt.com/docs/agent-configuration/subagents).

### Model defaults

These project defaults balance task complexity and turnaround; they have not been benchmarked on this game. Follow an explicit user model choice when supplied.

| Delegated work | Model | Reasoning effort |
| --- | --- | --- |
| Narrow read-only code scans, locating callers, summarizing test failures | `gpt-6-luna` | `high` |
| Bounded implementation, reproductions and regression-test design | `gpt-6.1-sol` | `medium` |
| Independent review of timing, state restoration, sleeping/supports and interactions | `gpt-6.1-sol` | `high` |
| Escalation for an unresolved physics/lifecycle problem after focused investigation | `gpt-6-astra` | `high` |

Use a shell process for simply executing a known suite. Keep implementation and difficult failure analysis with Sol; Luna's assignment should remain narrow. Escalate based on unresolved evidence, not merely because a larger model exists. Check available model/effort options in the current tool; if a recommended setting is unavailable, inherit the parent and note that in the handoff. Do not change the user's global Codex configuration for these defaults.

When selecting a model explicitly, also set the intended reasoning effort. If the spawn tool requires a fresh context for overrides, provide the requirement, relevant instruction/file paths, snapshot identity, ownership and expected output in its initial brief. Inherited full-history contexts can instead retain the parent's model when the tool requires that. Record actual model/effort alongside results, and adjust future choices using observed quality and elapsed time. See [OpenAI model selection guidance](https://developers.openai.com/api/docs/guides/model-selection) and the subagent documentation linked above.

### Freeze inputs when testing overlaps editing

1. At a coherent checkpoint, use an isolated checkout if Git is available, including the intended uncommitted changes explicitly. Otherwise copy `src`, `vendor`, `tests`, `tools`, `index.html`, `styles.css`, `PLAY.cmd` and `package.json` to a unique `test-results/<task>-<checkpoint>/` directory. Include these instructions or their relevant excerpts for the tester.
2. Ensure source/fixture writers are idle during copying, or compare source SHA-256 manifests before/after and against the copy; retry if any input changed. Record the snapshot path and hashes. A revision alone does not identify uncommitted edits.
3. Run each selected suite in a separate Node process against that snapshot. Keep production inputs frozen and output files/logs isolated. Only one audit writes each report path. Search tools in different processes still rewrite the entire fixture file even when they target different levels: give each search its own copy and let one owner merge reviewed level entries.
4. Record which build passed and compare it with the final integrated inputs. Rerun checks affected by later edits and complete the final full run. A pass on an older snapshot is not a pass on new code. Do not copy a snapshot wholesale over another chat's working files.

Suggested request for a substantial gameplay change:

> Implement T12 and T16. Use up to two subagents where work can proceed independently: one for reproduction and testing on frozen checkpoints, and one for independent lifecycle review. Keep runtime edits with the lead, give each helper explicit file ownership and a tested-version identifier, and continue independent work while checks run. Reconcile findings and verify the final integrated code. Preserve other chats' work and update TODO/PROGRESS with evidence.

## Cross-chat handoff

Before substantial edits, add or update a small dated entry in `PROGRESS.md` naming the owner (chat title/ID or a unique task label), scope, files and any long-running jobs. A claimed file with an active writer needs coordinated ownership; continue on independent files meanwhile. Reread immediately before updating shared docs, and patch only your entry. Claims are coordination notes, not filesystem locks; do not assume an old entry still has a live owner.

Use this compact shape at a checkpoint or completion:

```text
Date / owner / task IDs / active or complete:
Files owned or changed:
Behavior and decisions:
Verification: exact commands, outcomes, tested snapshot/revision+changes:
Remaining issues / next action:
Running jobs: owner, command, cwd, log, status (or none):
```

Keep `AGENTS.md` limited to durable rules and pointers. Put transient status in `PROGRESS.md`, requirements in `TODO.md`, and fresh test evidence in the relevant verification document. Updating these records is how a later chat can continue without relying on the original conversation.
