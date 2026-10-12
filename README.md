# Pebble Picnic

An original offline slingshot playground: five adventure levels across gardens, the beach and snowy hills, plus five short Quick play scenes. Knock down movable structures and collect the green star pods. Ramps, dominoes, a seesaw, hanging bridges and golden chain-reaction crates make later levels more interesting.

## Launch on Windows

**Double-click `PLAY.cmd`.** Alternatively, open `index.html` with Chrome or Edge. No installation, account, server or internet is needed. Keep `index.html`, `styles.css`, `src` and `vendor` together when copying the game to another PC.

Refresh an already open game tab to load this update.

## Controls

- **Mouse aim and fire:** hold the loaded ball, drag backward, then release. The outlined dots show flight up to the first obstacle; the orange endpoint marks where the preview stops. Rebounds and moving debris are handled by the live physics. Pull farther for a stronger shot, brighter power bar and rising sling sound.
- **Easy Mode:** click **↙ Mouse** to switch to **⌨ Easy**. **↑/↓** raise/lower the angle, **→/←** increase/decrease power, and **Space** fires. Tap for a small change or hold an arrow for a smooth adjustment. The angle, power and trajectory stay visible; the last aim survives shots and undo. A slight downward angle allows ground rebounds. Holding Space fires once. Click the canvas after using a menu/button to resume keyboard control; focused buttons keep their normal keyboard behavior. Switching input modes keeps the scene and ammunition.
- **Cancel:** Esc, right-click, or **Cancel aim**. Cancelling uses no ammunition. In Easy Mode, an arrow or canvas click resumes the saved aim.
- **Choose a ball:** use the icons at bottom right. Orange pebbles are balanced; blue heavy balls push harder; purple bouncy balls rebound more. Dark bombs explode **3 seconds after release**, even when stopped. Their shrinking ring and countdown show the fuse; impacts never reset it. Only the last two adventure levels provide a bomb, one each.
- **Dress your pebble:** choose a smile, wink, bow or cap from the large pictures above the stage. Decorations keep the same ball type, strength and ammunition. The chosen look survives retry, Undo and reopening when storage is available; balls already flying keep their own decoration. Choosing a picture cancels a current pull safely.
- **Retry:** R or ↻. Retries are unlimited.
- **Undo:** U or ↶ restores the scene, ammunition and player turn just before the last shot, including earlier moving balls. One undo is available per launch; retry/level changes clear it. You can also undo from the result popup.
- **Adventure trail / Quick play:** Levels has two large tabs. Adventure keeps the five original picnics; Quick play offers a tall glass stack, three big dominoes, a beach ball pile and two rolling-fruit scenes. Every level is open. Next picnic continues within the chosen group; **Again!** immediately replays the current short scene from either the toolbar or the result popup. Short scenes have finite ordinary pebbles with spare shots for corrections.
- **Sound:** M or the music button. Sound starts after interaction and can be muted.
- **Reduced motion:** the ✦/◇ button disables camera shake, slow motion and extra travelling-star animation.
- **Shared play:** click **1P** to switch to **2P · Team**. This restarts the current level. Players alternate launches using a shared ammo pool; the colour/icon badge shows whose turn it is. Cancelling keeps the same player. Click again to return to solo.

Ball choices reward different routes: ordinary pebbles can shoot through the shelter doorway in level 2; bouncy balls rebound from the ground into its raised target. Heavy balls tip the stone counterweights in level 3. In level 4, a bomb can roll into the metal pocket and wait for its fuse. Each changed level also has alternative winning approaches; special balls are useful without enforcing one sequence.

Collect all green stars to win. Wood is balanced, glass is light and fragile, stone is heavy and durable, and silver metal is a step heavier and tougher than stone. Every structure piece can move and break, including the silver foundations, ramps and supports. Cracks, dents and splinters show accumulated damage. Downward landings take slightly more damage; resting and gentle contact remain harmless. Ordinary balls transfer momentum and never explode; after resting for a moment they fade out. Golden starburst crates burst on hard impacts and can trigger nearby crates.

Struck blocks show brief surprised eyes and gentle boing sounds; a ground miss sprouts a little flower. Some blocks hide a duck or bunny that greets you when its cover moves away. Replaying chooses among prepared hiding places; Undo restores the same animal and place. Large blue outlined bubbles pop when a ball or falling piece touches them. In the fruit scenes, nudge the wooden arrow stopper to send an apple or orange rolling down the silver ramp toward a picnic basket. Bubbles, animals, fruit and beach balls are optional extras: the green star pods alone decide the win. These extras never spend additional ammunition, and Undo/retry restore their state.

The next ball is ready when the previous one becomes slow/stops/disappears, or after **2 seconds**, whichever comes first. Old balls and falling structures keep moving while you aim again. The final shot waits for pending bombs and the scene to settle, with a 14-second active-time cap. A victory stays visible for at least **1.7 seconds**, extending while debris moves to a maximum of 4.5 seconds before the popup. Opening the map or hiding the browser tab pauses play, including bomb timers.

Stickers, decoration, mute, motion and input-mode preferences are saved locally when storage is available. Browsers can restrict local-file storage; gameplay still works, with stickers retained for the current session. There is no saved in-progress shot or saved angle/power across reopening.

## Optional development and tests

Node.js is only needed for development. No `npm install` is required.

```powershell
Set-Location D:\codex\gameboy
npm test
npm run physics:check
```

`npm test` freezes a SHA-256-verified copy and runs eleven independent suites in parallel: physics acceptance, input handlers, physics audit, gameplay upgrades, bomb/cleanup/undo lifecycle, damage art, Easy Mode/trajectory, landing damage, projectile routes, toddler interactions and quick-scene routes. Logs and the input identity are saved under `test-results`. `npm run test:serial` uses the same coverage sequentially; `npm run test:benchmark` compares both on the same snapshot. See `TESTING.md`, `PHYSICS_REVIEW.md` and `TEST_PERFORMANCE.md` for evidence and limits.

For browser testing:

```powershell
node tools/serve.cjs
```

Open [http://127.0.0.1:8080](http://127.0.0.1:8080). Ctrl+C stops the server. It binds only to this PC and is unnecessary for normal offline play.

Adventure winning routes are in `tests/solutions.json`; Quick play routes are in `tests/quick-solutions.json`. Entries are `{ type, pull: [x, y], wait }` in game pixels/milliseconds. They use the same simulator and real finite ammo as gameplay; unused recovery shots are skipped after a win. Routes wait for a collapse, although normal play allows faster follow-up shots.

`node tools/find-solutions.cjs` performs a bounded real-physics search; append zero-based level indexes to restrict it. `node tools/robust-solutions.cjs` searches recovery shots against small aim variations; `--quick` stops once seven of nine sampled variations win, while the default seeks nine. **Both intentionally rewrite fixtures.** Finish a search before running tests and avoid editing physics while it runs. The game never reads these fixtures or automatically aims.

Art and sound are procedural; sticker glyphs use the installed system emoji font. Matter.js is vendored under MIT. See `ATTRIBUTION.md`. Real touchscreen play and speaker loudness remain unverified; automated checks do not substitute for human enjoyment testing.
