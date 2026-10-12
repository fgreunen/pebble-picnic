# Development

Plain JavaScript, Canvas, Web Audio and vendored Matter.js. Open `PLAY.cmd` or `index.html` to play; Node is development-only. No build or dependency installation.

## Working loop

1. Read the current [handoff](PROGRESS.md) and only the relevant requirements in [TODO.md](TODO.md), including later amendments. T12 supersedes T3's impact-triggered bombs.
2. Make a focused change. Run the affected standalone suite below while iterating; run `npm test` once on the final integrated code.
3. For UI changes, check the affected interaction in a real browser, including a smaller window. Host tests prove state/event behavior, not visual or audible quality.
4. Record changed files, exact checks, tested identity, remaining issues and owned running jobs in PROGRESS. Update player guidance or requirements only when they change. Do not repeat the same evidence across documents.

[README.md](README.md) is for players. [TESTING.md](TESTING.md), [PHYSICS_REVIEW.md](PHYSICS_REVIEW.md), [TEST_PERFORMANCE.md](TEST_PERFORMANCE.md), [PLAN.md](PLAN.md) and [handoff history](docs/history/PROGRESS-2026-10-12.md) are historical references; consult them when relevant, not on every task. Old pass counts and browser sessions are not current verification.

## Code map

| File | Responsibility |
| --- | --- |
| `src/physics.js` | DOM-free `GameWorld`: load/launch, typed ammo, damage/blasts, removal, events, clocks and Undo. Browser `PicnicPhysics` and CommonJS exports. |
| `src/levels.js` | Layouts, materials, constraints, themes, extras and ammo; `shots` derives from inventory. Browser `PicnicLevels` and CommonJS exports. |
| `src/game.js` | Input, Canvas art, audio, UI, persistence and presentation effects. `window.picnic` exposes read-only diagnostics. |
| `src/damage-art.js` | Deterministic cracks/splinters/shading from material, seed and HP; no mutable state. |
| `index.html`, `styles.css`, `PLAY.cmd` | UI, responsive layout and offline launch. Script order: Matter, levels, physics, damage art, game. |
| `tests/ui-host.cjs` | Minimal DOM/audio host executing production game code; `frames(seconds)` uses a synthetic clock. |
| `tools/physics-sandbox.cjs` | Production-engine test rigs: `rig`, `piece`, `pebble`, `steps`, `fire`, `finite`. |
| `tools/test-runner.cjs` | Verified frozen inputs, parallel/serial suite processes and guarded audit publication. |
| `tools/artifacts.cjs` | Project-specific output directory under the system temp folder. |

Keep rules in physics, data in levels and browser work in game. Preserve exports, script order and vendor attribution. Avoid adding layers, dependencies or files solely to shorten an existing file.

## Behavior traps

- The logical canvas is 1280×720. `point()` maps pointer coordinates; `resize()` manages pixel density. Camera effects must not change aim coordinates.
- Physics steps are `1000 / 120` ms. Matter velocity accessors normalize to pixels per 1/60 second; raw position deltas are different. `beforeSolve` captures incoming linear/angular motion for collision damage.
- The browser calls `world.step(0)` for simulation and `advanceRealTime()` once per active frame. Direct test `step()` advances both clocks by default. Do not double-count time or tie reload/fuses to slow motion. Map/hidden-tab pauses must stop active time.
- `ready` permits a new shot while earlier projectiles/debris keep moving. `activeProjectile` is only the latest shot and may be null while older balls remain. Per-ball timers belong to bodies.
- Bombs explode once after 3000ms active real time, independent of contact; final loss waits for pending bombs. Ordinary/heavy/bouncy balls retire after 350ms resting plus 350ms fading; motion cancels retirement. Cancellation never spends ammo or advances a turn.
- `removeBody()` releases constraints and wakes connected sleeping structures. Queue destruction/blasts around updates; keep collection, explosions and chains bounded. Only the ground is static. Copy level constraint vectors because Matter mutates them. A seesaw pivot may attach to a physical support; preserve those shared references.
- Physics owns ready/flying/won/lost; presentation separately delays victory. Load/Undo share transient-effect cleanup, but Undo restores its UI snapshot and load resets the scene. Preserve pause/reset input/audio cleanup and storage-failure tolerance.
- `capture()` copies the full Matter engine graph, including contact caches and aliases; `undo()` consumes one snapshot and rebinds handlers once. Rebuilding only bodies caused a proven continuation regression. Restore clocks, ammo, damage, bomb deadlines, extras and UI rewards/turn together.
- Easy Mode maps angle −15°…70° and pull 25…96px through the same launch path as the mouse. Keep angle/power independent, saved aim through Undo, native focused-control keys, and one shot per Space press. Clear held input on focus loss, pause and resets.
- `predictTrajectory()` models fixed-step free flight with detached Matter polygons; it stops before current obstacles and does not predict rebounds or future debris motion. Landing damage's 1.15 multiplier applies only to downward contacts above the original threshold.
- Quick scenes follow the five adventure levels. Fruit is dynamic and never breaks/retires; optional bubbles have no collision bodies. Extras never gate victory. Animals reference piece seeds, replay cycles prepared places, and UI Undo restores the placement/reveal. Flowers/reactions/sounds are bounded.

## Checks and side effects

Run from the project root. Suites are standalone Node scripts that throw on failure; there is no test-framework filter. Use `node tests/<name>.test.cjs`:

| Suite name | Coverage |
| --- | --- |
| `controls` | Pointer capture, cancellation, fast release, retry/selection |
| `upgrade` | Reload/outcome timing, ammo, crates, supports, co-op, storage/audio |
| `physics` | Levels, stability, winning routes, outcomes, bounds, offline references |
| `lifecycle` | Timed bombs, pause, retirement, exact Undo continuation |
| `damage-art` | Health-based art, determinism and silhouette bounds |
| `easy-mode` | Keyboard/mouse equivalence, held/focused input, trajectory |
| `landing-damage` | Drops, harmless settling and support cascades |
| `projectile-routes` | Useful ball choices and alternative winning routes |
| `toddler-play` | Cosmetics, reactions/extras, pause, Undo, shared/Easy input |
| `quick-scenes` | Awake stability, forgiving routes, fruit and exact Undo |
| `physics-audit` | Isolated physics, long stability, aim perturbations, seeded stress; writes a temporary audit report |

`npm test` runs all eleven suites in parallel against SHA-256-verified copies. All generated output lives outside the repository, under `os.tmpdir()/pebble-picnic/<project-id>/`: runs in `test-results`, browser captures in `screenshots`, and the latest audit in `physics-report.json`. Print the actual directory with `node -e "console.log(require('./tools/artifacts.cjs')())"`; every run prints its full result path. Temporary files can be cleared by the operating system and are not durable evidence in Git.

Successful unchanged runs discard their copied inputs; failures, changed inputs and `npm test -- --keep-snapshot` retain copies in temp. `snapshotRetained` in `results.json` records this. Standalone suites other than the audit write no files. The audit uses the same temp directory; the runner sets `PICNIC_AUDIT_REPORT` to isolate each batch. `--publish-report` updates the latest temporary audit only after verifying matching inputs.

`node tools/test-runner.test.cjs` checks snapshot races, scheduling, failures/timeouts, publication and retention in synthetic workspaces; successful runs remove their own workspace. Use `npm run test:serial` for sequential execution or `npm run test:benchmark` to compare modes on identical inputs. No inter-suite sleeps are needed.

Commit source, required local game assets, solution fixtures and useful documentation. Keep raw browser captures, logs, generated reports, snapshots and other disposable output in temp. A deliberately selected, stable image under `docs/images/` may be committed when it is part of the public documentation; keep its raw capture in temp and do not use the repository as a screenshot archive. Existing development screenshots and old runs were moved to temp on 12 October 2026; historical references identify their original names. Git ignore rules guard against reintroducing them.

For focused frozen checks use `node tools/test-runner.cjs --suite tests/lifecycle.test.cjs`; use standalone commands for ordinary iteration. `npm run physics:check` runs the audit alone. An old report on disk is not proof of a new pass.

`npm run serve` starts the optional browser server at [http://127.0.0.1:8080](http://127.0.0.1:8080). Stop only a server owned by your task and restore test settings when appropriate.

## Fixtures and diagnostics

Adventure routes: `tests/solutions.json`; Quick play: `tests/quick-solutions.json`. Entries are `{ type, pull: [x, y], wait }` in pixels and simulated milliseconds. A 6000ms wait does not sleep for six real seconds. Audit/route loops covering five levels intentionally cover Adventure; the quick suite covers additions, allowing <6px harmless awake settling. Deliberately disabling sleep can tip the balanced seesaw; that is not normal production behavior.

`node tools/probe-physics.cjs` runs diagnostics without writes. `node tools/find-solutions.cjs 4` searches zero-based level 4; `node tools/solve.cjs 4` is its compatibility alias. `node tools/robust-solutions.cjs 4` searches recovery shots (`--quick` accepts seven of nine variations instead of seeking nine). Both search tools rewrite the entire Adventure fixture file. Give searches isolated copies and one fixture owner. Diagnose failures before changing routes or stability assertions; never regenerate fixtures just to pass tests.

## Shared work

For substantial independent work, use one or two helpers with bounded goals and explicit file ownership; keep small/tightly coupled edits with the lead. Use parallel processes for routine commands. Suggested models: Luna/high for narrow read-only scans; Sol 6.1/medium for implementation or regression design; Sol 6.1/high for independent review. Escalate to Astra/high only for unresolved physics/lifecycle reasoning. Follow user choices and available model support.

Record ownership in PROGRESS before substantial edits; reread shared files before patching and preserve others' entries. Tests overlapping edits must use frozen inputs; the runner already handles copying and source/copy hash checks. Helpers report the input identity, commands/results, findings and files changed. Verify final integrated inputs after later edits. Do not assume Git exists or restore a snapshot wholesale over someone else's files.
