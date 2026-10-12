# Verification — Pebble Picnic 1.3.0

## 12 October 2026 — T25–T30 toddler play (complete)

Implementation and browser acceptance are complete. Final `npm test` exited 0: **154/154 gameplay checks**, eleven suites, **24.80s**. Input SHA-256 `1072d4ff374ae53c09a75b52ed94f504c1dee88c2726cc21cb518e10534a5e17` (38 inputs); [frozen results and logs](test-results/2026-10-12T16-30-05-823Z-16640-e97c95/results.json). Source/copy/after manifests match and the matching audit was published. This supersedes the 18.92s checkpoint before the small-window result-card fix. `node tools/test-runner.test.cjs` separately passes **9/9** on unchanged runner code. No adventure fixture regenerated; original five layouts and ammo remain unchanged.

The new toddler suite passes 16 checks: actual gentle block reaction without damage, one flower per ground miss, optional bubble contact without forces and once-only pops, 20 real forgiving bubble aims, short shattered-piece reactions, peekaboo reveal/replay/Undo, cosmetic cancellation and per-ball/persistent selection, exact equivalent decorated bomb motion/fuses, Quick play/Adventure navigation, one-action replay, Easy/co-op/Undo, mute/reduced motion/pause, bounded audio/effects and blocked storage. The new quick-scene suite passes 19 checks: initial cover metadata, all five additions' awake stability and exact Undo/finite wins, 15 forgiving one-shot sample wins for the trio, visible beach-ball movement, two ordinary-shot fruit routes, once-only basket feedback, stopper-only gravity rolls and wins without a basket reward.

Simulation measurements: awake ten-second settling maxima are stack/dominoes **0px**, beach balls **4.915px**, apple **3.212px**, orange **2.709px**, with no health/target loss. Actual production launch routes move the stoppers **214.7/313.2px** and roll fruit **201/312px** into the basket. Removing only the stopper produces **729/761px** gravity-driven rolls. The first three scenes win all five center/±3px axial one-shot samples, using one of three ordinary balls. Apple/orange fixtures win within two of four balls. Existing adventure two-minute drift/finite stress and alternative routes also pass.

Independent read-only Sol 6.1/high review passes **13 focused probes** on a frozen implementation checkpoint, with no actionable defect ([review](test-results/toddler-review/reviewer/REVIEW.md)); subsequent bounded shattered-piece faces and group progression are included in the final integrated tests. Scene implementation/testing helper used Sol 6.1/medium and independent frozen inputs.

Browser continuation used the approved localhost-only server and Codex in-app browser, with **975×948** normal and **700×820** small viewports. Actual mouse input wins Tall tumble `[-40,8]`, dominoes `[-40,40]` and the beach-ball pile `[-88,16]` in one ordinary shot with two spares. The pile visibly tumbles. Easy keyboard taps produce an equivalent ~11°/40px Tall tumble win, including muted/reduced-motion/shared turns; result Undo restores Player 1, ammo and hidden animal. Both apple/orange stopper shots visibly move their covers and roll fruit toward the basket, followed by a spare `[-40,-16]` pod shot for a two-shot win. Fruit Again resets to four balls, the intact stopper and initial fruit. Exact basket-entry behavior is established by the simulations above, not measured from screen pixels.

Visual feedback checks: miss flower and Undo cleanup, brief surprised eyes on falling glass, duck/bunny reveal and greeting, large outlined optional bubbles. First tumble `[-48,56]` visibly pops its bubble while required stars stay **0/2**, and Undo restores the bubble and ammo. Bow/cap remain visible on ordinary balls; wink preserves blue heavy/purple bouncy silhouettes; a cap leaves the bomb's fuse, static **3s** preview and launched **2** countdown clear. Choosing a new look in flight does not spend ammo; Undo retains the selected look and restores the bomb inventory. Mute/reduced-motion controls and artwork remain usable. No horizontal overflow; final console warn/error capture empty. Speaker loudness/audible enjoyment and touch retain the established practical limits; production-host tests cover sound gain/variation/timing/mute/cleanup.

The small result card initially clipped Undo. `styles.css` now compacts it at ≤900px and bounds its height with scrolling for tighter sizes. All three actions fit at 700×820; DOM bounds confirm Undo is wholly inside the canvas. [Compact result](toddler-result-small.jpg), [fruit preview](toddler-preview.jpg). The temporary successful browser tab was closed, viewport override reset, solo/mouse/sound/full-motion/smile settings restored, and preview server stopped. All T25–T30 are checked off; no remaining implementation or verification work. Earlier browser evidence below applies to earlier builds.

## 12 October 2026 — T24 silver metal

Final `npm test` exited 0: **119/119 gameplay checks**, nine suites, **11.89s**. Input SHA-256 `0e6d5d64bffee72cad612dd7da3bbe5327d7cbc259bf35b9f4a85853bde5bcfa` (35 inputs); [frozen results and logs](test-results/2026-10-12T15-53-02-491Z-12680-20d4e4/results.json). Source/copy/after manifests match, and the matching audit was published. Four added core checks establish that every obstacle is dynamic with finite health, metal moves/takes proportionally less damage than same-size stone, strong real collisions can break it, and breaking its base releases the seesaw with exact Undo restoration. Metal is included in damage-art bounds and controlled landing/resting checks.

All five levels remain stable and winnable with unchanged finite ammo. Final audit: maximum two-minute awakened drift **.087913px**, no resting damage; 100 seeded games, 577 shots, 53 explosions, maximum 33 bodies. Nominal fixture shots **1/3/5/7/2**, ±2px recovery wins **7/9,5/9,5/9,9/9,6/9**. Dedicated ordinary-only, bouncy, heavy, bomb-pocket and bomb-free alternatives pass in simulation; the existing three-second bomb fuse is unchanged. The new physical supports necessitated deliberate route/fixture revisions.

Chrome at `http://127.0.0.1:8080` using the same source files: actual heavy mouse shot moved/collapsed silver roof/supports and showed damage; Undo restored scene and ammunition. Metallic gradients/edges distinguish metal from stone against garden, beach and snow. Normal viewport and **700×820** checked, no horizontal overflow, metal legend fits, console warnings/errors empty. [Preview](metal-preview.png) saved; viewport reset and temporary server stopped. Existing real-touchscreen/speaker limits remain; full alternate sequences were checked in simulation, not all replayed in the browser. Independent read-only runtime review found no actionable defect and additionally checked continuation after Undo of a moving, partly damaged metal base.

## Earlier 11 October evidence

Final integrated check, 11 October 2026: **115/115 gameplay checks pass** across nine parallel suites. `npm test` exited0 in 10.89s and published the matching audit. Nine separate test-runner checks also pass. This includes T20–T23 and the final compact Easy Mode HUD.

Input SHA-256: `24f9f66d07205da1db8bb8a6039fe9d99d892e9f8f93ea09e8b4f27463f8f261` (35 inputs). Snapshot, complete stdout/stderr and results: [final run](test-results/2026-10-11T17-27-45-651Z-17924-ad0f17/results.json). Source/copy hashes matched before and after verification; the snapshot remained unchanged. Subsequent edits only update evidence/TODO/PROGRESS outside the tested input set.

## Automated coverage

| Suite | Checks | Coverage |
| --- | ---: | --- |
| `tests/physics.test.cjs` | 26 | Five distinct adventure levels, dynamic/breakable metal and pivot/Undo, material differences, sleeping/woken stability, actual winning replays, harmless/strong contact, gravity/rotation/friction/bounce, bounds, final-shot timeout, win/loss/retry, collapsed-scene cost, offline files and launcher |
| `tests/controls.test.cjs` | 10 | Production pointer handlers, aim/power clamping, fast release, cancellation (Escape/right button/context menu/blur/lost capture), shot accounting, retry/menu/mute/resize |
| `tests/physics-audit.test.cjs` | 16 | Momentum/energy/gravity controls, drag/rotation, separating-contact rejection, damage sampling across rates, contact momentum before timed bombs, local bounded blasts, thin obstacles, two-minute stability, 45 aim variations, 100 seeded stress games |
| `tests/upgrade.test.cjs` | 21 | Quick reload, active-real-time deadlines, late/final shots, typed finite ammo and bounce, crate chains, released constraints, direct/multifloor support wake, immutable level/retry geometry, delayed/stale outcomes, pull audio cleanup, co-op and storage |
| `tests/lifecycle.test.cjs` | 15 | Fixed bombs despite repeated/hard/resting contacts, final/offscreen bombs, reload/slow motion/pause/reset, static fuse preview/live count, half shake/reduced motion, ball retirement/wake, complete undo and exact live-contact continuation, turn/reward rollback, no duplicate ammo |
| `tests/damage-art.test.cjs` | 5 | Progressive marks, intact/invalid states, deterministic HP restoration, material/shape silhouette bounds, offline export |
| `tests/easy-mode.test.cjs` | 16 | Independent keyboard angle/power, bounds/downward rebounds, taps/holds, exact mouse equivalence, no repeated/queued Space, focus/pause cleanup, cancel/switch/undo/co-op, fuse/storage, outlined guide, exact fixed-step free flight and collision clipping |
| `tests/landing-damage.test.cjs` | 5 | Controlled unscaled baseline versus tuned drops, material differences, platforms/pieces, unchanged side hits, harmless tiny drops/resting contact, support-removal cascade |
| `tests/projectile-routes.test.cjs` | 5 | Four physical advantages, 9/9 forgiving bounce samples and full alternative winning routes with real finite ammo |
| `tests/toddler-play.test.cjs` | 16 | Reactions/flowers, optional bubble overlap/real routes, animals, cosmetics, replay/navigation, mute/reduced motion, pause/Undo, shared/Easy input, bounded feedback/storage |
| `tests/quick-scenes.test.cjs` | 19 | Unchanged Adventure layouts, optional metadata, five quick scenes' awake stability, finite winning routes/exact Undo, forgiving one-shot trio, gravity-driven fruit release/catch/optional win |

All tests use production rules and vendored Matter.js. UI-host checks exercise actual handlers and drawing calls but do not establish browser rendering or audible quality. `node tools/test-runner.test.cjs` separately passes nine snapshot-race/process-isolation/scheduling/failure/publication checks. No packages are required.

Recorded nominal levels win in **1,2,4,2,2 shots**, within allowances **3,5,6,7,8**; the special counterweight route also wins level 3 in two heavy shots. With recovery shots and ±2px changes to every aim, sampled wins are **7/9,7/9,9/9,7/9,7/9**. This bounded sample does not promise arbitrary-angle wins. Changed geometry intentionally invalidated earlier routes; failures were diagnosed, recovery fixtures deliberately searched and then independently replayed. No assertions were weakened. Fixtures wait six simulated seconds per shot; normal reload is earlier.

## Actual browser and launcher

Version1.3.0 was inspected at the normal 975×948 viewport and 700×820, with no horizontal overflow. Actual keyboard/buttons/mouse verified:

- Arrow taps independently change angle/power; a held arrow changes smoothly; Escape hides the aim without using ammo. Holding Space 2.4s through reload consumes just one ball. The tuned initial keyboard shot wins level 1; result undo restores ammo/scene. Focused-button Space toggles its button without launching.
- Co-op keyboard cancel keeps Player 1; launching switches to Player 2; U restores Player 1 and all 7 balls. Switching input modes preserves the scene. Reload retains the selected input-mode preference.
- Rebound shelter: the first sensitive pull missed in the small window; the revised bouncy `[-64,-16]` collects the sheltered star. The new test verifies9/9 ±2px successes versus 0/9 with ordinary balls.
- Heavy `[-96,24]` tilts the stone-weight seesaw visibly and collects 3/5 stars. Bomb `[-96,24]` rolls toward the pocket, shows countdown1 while the next ball is ready, then bursts and raises collection from2/7 to 5/7. Undo restores the initial scene.
- Guide visible on garden, beach and snow, with reduced motion and in the small window. The final compact keyboard HUD sits at the ground line in700px layout, leaving low targets readable. [Final preview](easy-mode-preview.png).
- Final console capture: no warnings/errors. Mouse mode, solo, sound enabled and full motion restored; viewport override reset; tab left at level 1 ready to play.

Earlier version 1.2.0 browser observations (1265×712 and 700×820) remain useful historical evidence for existing features. Those handlers also pass the current integrated suites:

- Ordinary-ball collapse and collection, delayed win popup (hidden at final collection, then visible), progression to level 2, and restart.
- A bomb with a static `3s` preview, live shrinking ring/count, timed disappearance/collapse, score update and reloading. A short bomb shot still showed `1` while the next ordinary ball was already available. Saved [fuse-preview.png](fuse-preview.png).
- Undo after a bomb collapse; keyboard undo restores shared ammunition and Player 1; undo from a win and from a loss restores stars/ammo and closes the result. A repeated undo is disabled. Three deliberate misses show loss; retry restores all shots.
- Ordinary missed balls disappear after stopping; sound/motion controls and their saved states; cooperative handover; themed map and saved stickers. Final settings restored to solo, sound enabled and full motion.
- Progressive damage gallery: intact, 75%, 50% and 10% health on all three materials visibly differ without changing outer silhouettes. Saved [damage-preview.png](damage-preview.png); inspect locally at `/tools/damage-gallery.html` when serving.
- Final console capture has no warnings/errors. Finished scene: [upgrade-preview.png](upgrade-preview.png). Original real-browser Escape cancellation was observed earlier; current cancellation variants also pass production-handler checks.

The latest `cmd.exe /c D:\codex\gameboy\PLAY.cmd` from `D:\codex` exited0. Earlier inspection confirmed the correct default-browser local-file title/URL. File-page inspection is restricted by automation; detailed UI checks use identical files via localhost. Offline-reference and launcher-path tests pass. No server is required through PLAY.cmd.

## Reproduce and limits

```powershell
Set-Location D:\codex\gameboy
npm test
npm run physics:check
```

`npm test` runs all eleven suites on a verified snapshot in parallel. Use `npm run test:serial` for a sequential fallback. Current timing and the historical scheduling comparison are in [TEST_PERFORMANCE.md](TEST_PERFORMANCE.md). Physics measurements and limits: [PHYSICS_REVIEW.md](PHYSICS_REVIEW.md).

Real touchscreen input, speaker loudness and simultaneous left/right mouse chords remain unverified physically. The chord handlers are integration-tested. Later levels have automated complete winning replays and actual browser interaction/collapse checks, rather than manual browser completion of every level. Physics is an approximate 2D arcade solver; intentional friction, breakage and blasts alter energy. Human enjoyment/difficulty still benefits from playing with the children.
