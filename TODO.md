# Pebble Picnic — requested improvements

Completed 11 October 2026, version1.3.0. All T1–T23 implemented and verified: 115 gameplay checks pass on the final frozen build, plus nine runner checks. Browser/launcher observations and practical limits are in TESTING.md; the tested identity and timing are in TEST_PERFORMANCE.md.

T1–T30 are complete. T25–T30 passed focused browser play/presentation checks at normal and 700×820 sizes and the final 12 October 2026 automated checks (154/154 plus nine runner checks). See PROGRESS.md and TESTING.md for evidence and practical limits.

## Gameplay and pacing

- [x] **T1 — Let the collapse finish before showing the victory popup.**
  Keep rendering and simulating after the final star is collected. Leave the game visible for about 1–2 seconds, and allow more time when objects are still visibly falling. Bound the extra wait so rolling debris cannot hide the result indefinitely. Restarting or selecting a level must cancel any pending popup.
  **Acceptance:** a dramatic final collapse stays visible before the popup; a quiet win still shows the result promptly; changing levels during the delay never shows an old result.
  **Files:** `src/game.js`, outcome events in `src/physics.js`.

- [x] **T3 — Retain ordinary balls and make bombs a separate, scarce type.**
  Restore ordinary balls that transfer momentum without exploding. Use limited explosive balls on selected complex or difficult levels, rather than making every ball explosive. Give bombs a distinct silhouette and appearance, such as a round casing with a short fuse, and show the loaded type clearly. Bomb timing follows the later T12 amendment: a fixed launch fuse replaces the original hard-impact requirement.
  **Merged suggestion:** after the ordinary-ball/bomb pair works, add heavy and super-bouncy non-explosive variants, with large icons for choosing among the types available in a level. Let the bomb fulfil the wider-burst role, balancing its radius and strength against scarce ammunition. Type selection must not replenish ammo or turn an ordinary ball into a free bomb.
  **Acceptance:** ordinary balls, including heavy/bouncy variants, never explode; bombs burst once on the fixed T12 timer; early levels remain playable using ordinary balls; bomb availability and the next ball type are easy to see. Heavy and bouncy variants have noticeably different behaviour and readable silhouettes. Verify every level within its actual allowance and projectile choices.
  **Files:** projectile creation/collision handling in `src/physics.js`, ammunition definitions in `src/levels.js`, projectile and counter rendering in `src/game.js`.

- [x] **T5 — Make the next ball ready sooner.**
  When another shot is available, reload as soon as the launched ball stops or moves very slowly, or after 2 seconds from release, whichever happens first. Base early reloading on the ball's motion, rather than waiting for the whole structure to settle. Continue simulating previous balls and falling objects while the player aims or fires again.
  **Acceptance:** a stationary/slow ball allows an early follow-up; a rolling or flying ball never blocks another available shot beyond 2 seconds; overlapping shots remain safe. Preserve sensible final-shot loss detection, late target collection, and the delayed victory presentation in T1.
  **Files:** shot lifecycle in `src/physics.js`, input eligibility and skip control in `src/game.js`.

## Feel and presentation

- [x] **T4 — Make pulling the sling feel smooth and increasingly powerful.**
  Add an animation that follows pull distance and a continuous rising tension sound. Increase the power bar's visual intensity as the pull grows, using colour/glow and smooth transitions. Keep the trajectory guide and mouse response precise. Avoid abrupt sound jumps or distracting flashing.
  **Acceptance:** short and full pulls visibly and audibly differ; increasing/decreasing pull feels continuous; release, cancel, retry, level changes and mute stop the tension sound cleanly. Muted gameplay remains fully usable.
  **Files:** pointer handlers, sling drawing and audio in `src/game.js`; power-bar styling in `styles.css`.

- [x] **T2 — Remove the spare-ball log beside the sling.**
  Remove the log and its row of spare balls. Retain the loaded ball in the sling and the top-right remaining-shot counter.
  **Acceptance:** there is no duplicate ammunition display beside the sling; the top-right counter still updates correctly on launch, cancel and retry.
  **Files:** scene decoration/spare-ball drawing in `src/game.js`.

- [x] **T7 — Remove the hanging flags.**
  Remove the decorative bunting from the middle of the canvas.
  **Acceptance:** the launch path and background are clear, with no hanging flags; existing scenery and aiming remain intact.
  **Files:** bunting drawing in `src/game.js`.

- [x] **T8 — Make big impacts more spectacular.**
  Add a brief slow-motion moment on a large impact or bomb burst, subtle camera shake, and collected stars that fly toward the score. Provide a reduced-motion option that disables shake and unnecessary motion. Coordinate this with T1 so the final collapse remains visible.
  **Acceptance:** major impacts feel stronger than small contacts; the effect has a short, bounded duration and cannot stack indefinitely; simulation stays stable. Camera motion does not misalign mouse aiming. Reloading still observes T5's 2-second limit in real time, and mute/reduced-motion settings work offline.
  **Files:** event effects, animation timing and camera transforms in `src/game.js`, settings UI in `index.html`/`styles.css`.

## Level design

- [x] **T6 — Build larger, more interesting later levels.**
  Add more individual obstacles and deliberate architecture, especially in later levels: connected towers, bridges, supports and layouts that invite chain reactions. Merge the playground-structure idea here: ramps, seesaws, hanging bridges and domino towers should offer different solutions, not just more blocks. Preserve an approachable first level and gradual difficulty. If necessary, zoom out or enlarge the world to fit the structures, while keeping projectiles and targets readable.
  **Acceptance:** later levels have visibly richer layouts and multiple meaningful ways to attack them; structures remain stable before launch; every level is winnable with its normal/bomb allowance. If the camera or world scale changes, verify pointer coordinates, aiming, out-of-bounds handling and smaller-window readability. Collapsed scenes remain responsive.
  **Files:** `src/levels.js`, world bounds in `src/physics.js`, canvas/camera transforms in `src/game.js`.

- [x] **T9 — Add clearly marked chain-reaction crates.**
  Introduce golden crates with a simple burst symbol. A sufficiently hard impact triggers a single cheerful burst that pushes nearby pieces and can trigger other crates. Introduce them sparingly in later levels, after ordinary balls and limited bombs are balanced.
  **Acceptance:** resting/gentle contact cannot trigger a crate; each crate bursts only once; chains terminate with bounded forces/effects and stay responsive. Children can identify the special object visually. Include a winnable chain-reaction level and recheck stack stability and normal-ball solutions.
  **Files:** special obstacle definitions in `src/levels.js`, impact/blast handling in `src/physics.js`, crate rendering/effects in `src/game.js`.

## Adventure and shared play

- [x] **T10 — Add a cheerful adventure map and completion stickers.**
  Present levels along a simple trail through garden, beach and snowy-hill themes. Award a sticker for completing each level, and save earned stickers locally without accounts. Use original procedural scenery and large visual level buttons. Keep quick retry and direct level selection available.
  **Acceptance:** progress and the next level are easy to see with little reading; earned stickers survive reopening the offline game; unavailable storage does not prevent play. The map and themed levels work without internet and remain readable in smaller windows.
  **Files:** level metadata in `src/levels.js`, level-selection/progress UI in `src/game.js`, `index.html` and `styles.css`.

- [x] **T11 — Add local two-player cooperative turns.**
  Let siblings play on the same PC, alternating shots from a shared allowance. Show whose turn it is with a clear colour/icon and a short handover cue when the next ball is ready. Keep the existing solo mode available.
  **Acceptance:** turns advance only after a real launch, not after cancelling; both players share the same targets and limited ammo; quick reload and moving debris still work. Retry resets the turn order, level progression stays clear, and the whole mode runs offline on one mouse.
  **Files:** turn/mode state and UI in `src/game.js`, `index.html` and `styles.css`; shared shot lifecycle in `src/physics.js` as needed.

## Suggested implementation order

1. T2 and T7: small visual removals with an immediately runnable checkpoint.
2. T1 and T5: pacing and shot lifecycle; check late collisions and outcome timing together.
3. T3 core pair: separate ordinary balls from scarce bombs before rebalancing levels.
4. T4: smooth pull animation, sound and power feedback.
5. T6: expand later levels against the ordinary-ball/bomb rules and verify all seven specific requests.
6. T8 and remaining T3 variants: impact feedback, heavy/bouncy choices and reduced motion; revisit affected level balance.
7. T9: one clear chain-reaction level built on the richer structures; test bounded chains.
8. T10, then T11: adventure map/stickers and local cooperative turns.

The six earlier ideas are covered by T8 (spectacular impacts), T3 (projectile choices), T6 (playground structures), T9 (special crates), T10 (map/stickers) and T11 (shared turns). T3 and T6 extend existing tasks instead of creating duplicate work.

After each meaningful checkpoint, update `PROGRESS.md` and mark only verified items complete here. Run relevant automated checks and playtest changed interactions; finish with `npm test`. Fixtures now use finite typed ammo; timed-bomb/retirement changes require deliberate rechecking. Do not regenerate fixtures merely to hide a regression.

## Run and verification commands

- Play offline: double-click `PLAY.cmd` (no setup or internet required).
- Full automated checks: `Set-Location D:\codex\gameboy`, then `npm test`.
- Physics audit: `npm run physics:check`.
- Optional browser playtest server: `node tools/serve.cjs`, then open `http://127.0.0.1:8080`; Ctrl+C stops the server.

Current verification and exact snapshot identity are recorded in `PROGRESS.md`, `TESTING.md` and `TEST_PERFORMANCE.md`. The original 48-check impact-bomb baseline is superseded by T12.

## Additional requests — 11 October 2026

T12 supersedes the original impact-triggered bomb rule. All amendments below passed the final integrated checks; gameplay remains fully local.

- [x] **T12 — Explode bombs on a fixed timer after launch.**
  Start a fixed fuse interval when the bomb is launched. Collisions must not trigger an explosion or restart the timer; the bomb explodes once when the interval expires, including when it has come to rest.
  **Acceptance:** early impacts, repeated contacts and stopping do not change the launch-to-explosion interval; bombs never explode on impact. Update the earlier impact-based bomb tests and expectations to match this rule.

- [x] **T13 — Fix balls remaining suspended after their supports are destroyed.**
  Investigate and reproduce balls stuck in the air after the scaffold below them is destroyed. Ensure support removal wakes affected resting/sleeping balls and lets gravity move them normally.
  **Acceptance:** balls resting on destroyed supports resume falling, including in stacked structures and chain reactions; intact supported structures remain stable.

- [x] **T14 — Halve the vibration.**
  Reduce the intensity of the game's vibration/camera-shake feedback by 50%, including bomb and major-impact effects. Preserve the reduced-motion setting.
  **Acceptance:** the same impact produces half the previous vibration intensity, and reduced motion still disables it.

- [x] **T15 — Speed up testing and reduce idle waits.**
  Identify unnecessary waits between test steps/runs and shorten or remove them without weakening verification. Use independent parallel test batches, multithreading/multiprocessing, or testing subagents where useful. If testing runs while code is being changed, give it a fixed/frozen code snapshot so edits cannot interfere, and record which version was tested. Recheck the final integrated version before declaring a task verified.
  **Acceptance:** document the test-time improvement and the commands used; retain meaningful coverage and reliable results while making better use of available compute.

- [x] **T16 — Fizzle out stopped ordinary balls.**
  Once a launched non-bomb ball comes to a stop, give it a short fizzle-out effect and remove it from the scene and physics simulation. Apply this to ordinary, heavy and bouncy balls. A stopped bomb remains until its launch-based timer expires and then explodes, as specified in T12.
  **Acceptance:** stopped non-bomb projectiles disappear instead of accumulating in the scene; moving balls continue normally; bombs still explode once on schedule. Cleanup must preserve ammunition accounting, target collection and win/loss timing.

## Selected suggestions — 11 October 2026

- [x] **T17 — Show a visible bomb fuse and countdown.**
  Add a shrinking fuse or countdown ring so players can judge when a launched bomb will explode. Include fuse timing in the aiming preview, without starting the actual countdown until launch. Keep the indicator synchronized with T12's fixed launch-based timer.
  **Acceptance:** the remaining fuse time is easy to read while a bomb moves or rests; impacts do not reset it; the indicator reaches zero when the bomb explodes. The aiming preview communicates the fuse duration before release.

- [x] **T18 — Undo the last shot.**
  Add an undo control that restores the scene and ammunition to just before the most recent launch, allowing players to try another approach without restarting the level. Restore the relevant gameplay state together, including object positions and motion, damage, active bomb timers, targets, score, selected projectile and cooperative player turn.
  **Acceptance:** undo works after an ordinary shot or bomb explosion, including when earlier projectiles were still moving at launch. It restores the correct ammunition and scene without duplicating objects, rewards or effects; repeated use cannot create extra ammunition. Retry and level changes clear the previous level's undo state, and pending win/loss effects cannot leak into the restored scene.

- [x] **T19 — Make structural damage clearly visible.**
  Show progressive cracks, splinters and slight visual deformation on damaged supports and obstacles so players can identify pieces close to breaking and plan the next shot. Tie the feedback to actual accumulated damage and keep object silhouettes readable.
  **Acceptance:** intact, damaged and nearly broken pieces are visibly distinguishable; damage feedback updates after impacts and blasts, resets on retry, and is restored correctly by T18's undo. Visual damage must not misrepresent collision geometry or obscure aiming and targets.

## Next gameplay improvements — 11 October 2026

- [x] **T20 — Give each ball a clearer reason to be chosen.**
  Extend T3's existing projectile differences through level layouts that reward choosing the right ball: for example, a bouncy ball can rebound beneath an overhang, a heavy ball can tip a counterweight, and a timed bomb can roll into a pocket before exploding. Keep ordinary pebbles useful for straightforward shots. Preserve alternative solutions while making each type's strengths noticeably rewarding; keep the first level approachable and ammunition finite.
  **Acceptance:** demonstrate a useful situation for each existing projectile type, with a clear advantage from its physical behaviour. Changed levels remain winnable within their actual ammo allowances and support alternative approaches rather than requiring a prescribed ball sequence. Verify the intended routes in simulation and focused playtests; bombs retain their fixed three-second launch fuse.
  **Files:** primarily `src/levels.js`; projectile balance in `src/physics.js` only if needed, plus affected level tests and deliberately rechecked solution fixtures.

- [x] **T21 — Add Easy Mode with keyboard slingshot controls.**
  Provide an optional Easy Mode for children who struggle with mouse dragging. Keep the same game layout, level arrangements, physics, ammunition, projectile behaviour and outcomes; change only how the slingshot is controlled. Retain the existing mouse mode and use a compact mode toggle and control hints within the current interface.
  **Controls:** Right increases power and Left decreases it; Up raises the launch angle and Down lowers it. Space fires the selected ball when the sling is ready. Convert angle and power into the existing pull/launch path so equivalent mouse and keyboard shots behave identically.
  **Suggested refinements:** keep the trajectory preview and power indicator visible while aiming; show a simple angle indicator. Use small adjustments for taps and gentle, consistent adjustment while an arrow is held. Retain the last angle and power after a shot or Undo so children can correct their aim without starting over. Start with a usable forward aim and keep adjustments within the existing launch limits.
  **Acceptance:** the slingshot can be aimed and fired without dragging; changing power does not change the chosen angle and vice versa within valid launch limits. One Space press launches at most one ball, even if held through reload. Switching controls or cancelling input never launches a ball, consumes ammo, advances a co-op turn or resets the scene. Clear held keys on focus loss, pause, retry and mode changes; prevent gameplay keys from scrolling the page while controlling the sling, without hijacking focused menus/buttons. Check readiness, undo, co-op, bomb timing and mouse-mode regression; verify equivalent shots use the same physics and inspect the controls in a real browser, including a smaller window.
  **Files:** `src/game.js`, `index.html`, `styles.css`, input/UI tests and player controls in `README.md`; reuse `src/physics.js` launch rules.

- [x] **T22 — Make the aiming trajectory more obvious.**
  Make the predicted flight path easier for children to see and follow, using larger, higher-contrast dots or a clearer line with a contrasting outline. Keep targets and obstacles readable. Apply the improvement to mouse aiming and T21's keyboard Easy Mode, updating the guide as power and angle change.
  **Acceptance:** the trajectory is clearly visible against all level backgrounds, including in a smaller window and with reduced motion enabled. It reflects the current aim and launch behaviour, and its visible endpoint does not imply a predicted path through an obstacle. Verify visibility and aiming in a real browser.
  **Files:** aiming-preview rendering in `src/game.js`, plus relevant UI checks.

- [x] **T23 — Increase fall damage slightly.**
  Modestly increase the damage taken by target pods and breakable structure pieces when they fall and land on the ground, platforms or other pieces. Tune landing impacts specifically so knocking out supports produces more satisfying collapses, while preserving material differences and stable resting stacks.
  **Acceptance:** representative falls cause slightly more damage than the current baseline, with larger impacts still more damaging than small drops. Resting contact and gentle settling remain harmless; intact levels remain stable before launch. Check isolated drop cases, support-removal cascades and level solvability with actual ammunition. Record the chosen tuning and before/after damage evidence; diagnose changed routes before deliberately updating fixtures.
  **Files:** collision damage in `src/physics.js`, affected physics/regression tests and deliberately rechecked solution fixtures.

## Additional request — 12 October 2026

- [x] **T24 — Replace permanent obstacles with movable, breakable silver metal.**
  Replace the green unbreakable foundations, ramps and supports with metallic silver objects using a new material one step heavier and tougher than stone. All visible structure pieces should move under force and break after sufficient damage. Adapt formerly fixed supports so the five levels remain stable and winnable with their existing finite ammunition; keep the first level approachable. Attach the seesaw pivot to its physical base so moving or breaking the base affects the beam.
  **Acceptance:** metal is visibly silver and distinguishable from stone, has greater density and durability, moves less under equal impacts but can still move and break, and shows health-based damage. No permanent obstacle bodies remain. Support removal and Undo preserve the full scene and constraints. All five levels remain stable before launch and winnable within their allowances; verify changed routes and browser presentation.
  **Files:** `src/levels.js`, `src/physics.js`, `src/game.js`, `src/damage-art.js`, UI legend, affected tests and deliberately verified solution fixtures.

## Selected toddler-play suggestions — 12 October 2026

The user selected ideas 2, 3, 5, 6 and 8 from the first suggestion round, then "Rolling fruit surprises" from the second round, and subsequently requested implementation of all remaining TODOs. All six are implemented and verified with local procedural art/audio, finite typed ammunition, mute/reduced-motion support, pause, Undo and reset. Normal and small-window browser checks passed; evidence is in TESTING.md.

- [x] **T25 — Add funny reactions to shots.**
  Give struck blocks brief surprised eyes and impacts gentle, varied "boing" sounds. Let a missed shot landing on the ground sprout a small decorative flower so unsuccessful shots can still be amusing. Keep reactions short and clearly connected to the shot.
  **Acceptance:** block hits and ground misses produce distinct, readable reactions without changing damage, collision shapes or ammunition. Limit overlapping effects and sounds; preserve the trajectory, targets and existing damage artwork. Mute/reduced motion work, and Undo, retry and level changes clear reactions belonging to the discarded shot or scene.
  **Files:** presentation/audio in `src/game.js`; existing physics events, with additions in `src/physics.js` only where needed.

- [x] **T26 — Reveal peekaboo animals behind blocks.**
  Hide a friendly duck or bunny behind selected structures. When covering blocks fall away, reveal the animal with a wave or short dance. Offer a few prepared hiding places on replays, keeping each attempt's placement stable through Undo.
  **Acceptance:** animals begin hidden and reveal once when their cover is removed; they remain friendly decorations, with no rescue requirement or effect on winning. They do not obscure aiming or targets. Retry/level changes reset the reveal, Undo restores it consistently, and reduced motion uses a simple visible greeting.
  **Files:** hiding-place metadata in `src/levels.js`; reveal state and art in `src/game.js`, with simulation support in `src/physics.js` if needed.

- [x] **T27 — Add big, easy bonus balloons or bubbles.**
  Place a few large, clearly visible balloons or bubbles where balls or falling pieces can touch and pop them. Give each pop a gentle visual/audio response. Make them optional extras so popping even one can feel rewarding.
  **Acceptance:** each extra pops once per attempt, is easy to hit and is visually distinct from required star pods. Leaving extras unpopped cannot prevent a win or consume extra ammunition. Extras do not block shots or alter the established structure balance; Undo restores popped extras and retry restores the scene. Verify muted and reduced-motion presentation.
  **Files:** placements in `src/levels.js`, contact/pop rules in `src/physics.js`, rendering/audio in `src/game.js`.

- [x] **T28 — Add tiny "one good shot" levels.**
  Add a small set of short, optional scenes such as a tall stack, three oversized dominoes or a pile of beach balls. Make the satisfying collapse easy to trigger with one well-placed ordinary shot, allow finite spare shots for corrections, and provide a large "Again!" button. Retain access to the existing adventure levels.
  **Acceptance:** each new scene starts stable, supports a forgiving range of successful aims and is winnable within its stated ammunition. Children can replay the same scene with one clear action; no extra menu sequence is required. The new scenes work with mouse and keyboard Easy Mode, Undo and shared turns, and remain readable in smaller windows. Verify winning routes and focused browser play.
  **Files:** scenes/ammunition in `src/levels.js`; selection/replay UI in `src/game.js`, `index.html` and `styles.css`; affected level/route checks.

- [x] **T29 — Let children choose their pebble's face or hat.**
  Offer a few large visual choices before play, such as funny faces or small hats. Apply the selected decoration to the loaded and launched balls while retaining each projectile type's recognisable colour and silhouette.
  **Acceptance:** choices are cosmetic and never change physics, ball type or ammunition. Selection is usable without reading and does not accidentally launch a shot. Faces/hats remain legible at play size and leave the bomb fuse/countdown and aiming guide clear; the choice survives retry and Undo. Use local assets or procedural art.
  **Files:** cosmetic state/art and picker in `src/game.js`, `index.html` and `styles.css`.

- [x] **T30 — Add rolling fruit surprises.**
  Add simple scenes where knocking away a stopper sends oversized apples rolling down a ramp into a picnic basket. Use playful fruit variations, such as oranges, watermelons or giant peas, across scenes. Make the stopper easy to recognise and the rolling sequence satisfying to watch.
  **Acceptance:** fruit stays in place until its stopper is displaced, then rolls visibly toward the basket under normal physics. The setup is stable before launch and easy to trigger with the available finite ammunition. Fruit is distinct from required star pods, and missing the basket does not add a new loss condition. Pause, Undo and retry preserve or restore the stopper, fruit and basket state consistently; verify the sequence in simulation and focused browser play.
  **Files:** layouts/fruit metadata in `src/levels.js`, fruit bodies and interactions in `src/physics.js`, fruit/basket art and feedback in `src/game.js`; affected level and lifecycle checks.
