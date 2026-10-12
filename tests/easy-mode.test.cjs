'use strict';
const assert = require('node:assert/strict');
const { createHost } = require('./ui-host.cjs');
const P = require('../src/physics.js'), M = require('../vendor/matter.min.js');
let passed = 0;
function test(name, fn) { fn(); passed++; console.log(`PASS ${name}`); }
const aim = h => h.window.picnic.getAim();
const key = (h, k, options = {}) => h.window.emit('keydown', { key: k, ...options });
const up = (h, k) => h.window.emit('keyup', { key: k });
const tap = (h, k) => { key(h, k); up(h, k); };
const easy = h => h.get('easy-button').click();
function near(a, b) { assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`); }
test('Easy Mode starts with a valid forward aim and visible angle/power', () => {
  const h = createHost(); easy(h); const a = aim(h), p = h.window.picnic.getPull();
  assert.ok(a.easy && a.aiming); assert.ok(p.x <= -8 && Math.hypot(p.x, p.y) >= 12);
  assert.equal(h.get('power-wrap').hidden, false); assert.equal(h.get('angle-readout').hidden, false);
  assert.ok(h.get('control-hints').innerHTML.includes('Space')); assert.equal(h.state().shotsLeft, 3);
});
test('tap changes angle and power independently, and limits remain launchable', () => {
  const h = createHost(); easy(h); const initial = aim(h);
  tap(h, 'ArrowRight'); near(aim(h).angle, initial.angle); near(aim(h).power, initial.power + 2);
  tap(h, 'ArrowUp'); near(aim(h).power, initial.power + 2); near(aim(h).angle, initial.angle + 1);
  for (let i = 0; i < 100; i++) { tap(h, 'ArrowUp'); tap(h, 'ArrowLeft'); }
  assert.equal(aim(h).angle, 70); assert.equal(aim(h).power, 25);
  const p = h.window.picnic.getPull(); assert.ok(p.x <= -8); assert.ok(Math.hypot(p.x, p.y) <= P.MAX_PULL);
  for (let i = 0; i < 100; i++) { tap(h, 'ArrowDown'); tap(h, 'ArrowRight'); }
  assert.equal(aim(h).angle, -15); assert.equal(aim(h).power, 96);
  assert.ok(h.window.picnic.getPull().y >= -25); assert.ok(h.window.picnic.getPull().y < 0, 'ground-rebound shots are accessible');
});
test('holding arrows adjusts smoothly by elapsed time, independent of OS repeats', () => {
  const h = createHost(); easy(h); const before = aim(h).angle;
  key(h, 'ArrowDown'); const tapAngle = aim(h).angle; h.frames(.2); near(aim(h).angle, tapAngle);
  key(h, 'ArrowDown', { repeat: true }); h.frames(.5); assert.ok(aim(h).angle < tapAngle - 8);
  assert.equal(aim(h).power, Math.hypot(32, 56)); up(h, 'ArrowDown'); const stopped = aim(h).angle; h.frames(1); near(aim(h).angle, stopped);
  assert.ok(before - stopped < 15);
});
test('equivalent keyboard and mouse pulls launch the same body and velocity', () => {
  const k = createHost(), mouse = createHost(); easy(k); tap(k, 'ArrowLeft'); tap(k, 'ArrowDown');
  const p = k.window.picnic.getPull(); tap(k, ' '); mouse.grab(); mouse.release(p.x, p.y);
  const a = k.world.activeProjectile, b = mouse.world.activeProjectile;
  near(a.position.x, b.position.x); near(a.position.y, b.position.y);
  near(M.Body.getVelocity(a).x, M.Body.getVelocity(b).x); near(M.Body.getVelocity(a).y, M.Body.getVelocity(b).y);
  near(a.angularVelocity, b.angularVelocity); assert.equal(k.state().shotsLeft, mouse.state().shotsLeft);
});
test('held Space cannot launch another shot through reload, even nonrepeat duplicate events', () => {
  const h = createHost(); easy(h); for (let i = 0; i < 100; i++) tap(h, 'ArrowLeft');
  key(h, ' '); const count = h.state().shotsLeft; h.frames(2.2); assert.equal(h.state().state, 'ready');
  key(h, ' ', { repeat: true }); key(h, ' '); assert.equal(h.state().shotsLeft, count);
  up(h, ' '); key(h, ' '); assert.equal(h.state().shotsLeft, count - 1);
});
test('Space pressed in flight does not queue a launch on readiness', () => {
  const h = createHost(); easy(h); tap(h, ' '); key(h, ' '); const shots = h.state().shotsLeft;
  h.frames(2.2); key(h, ' ', { repeat: true }); assert.equal(h.state().shotsLeft, shots); up(h, ' ');
});
test('undo retains last aim, exact ammo and cooperative player turn', () => {
  const h = createHost(); h.get('mode-button').click(); easy(h); tap(h, 'ArrowDown'); tap(h, 'ArrowRight');
  const before = aim(h); tap(h, ' '); assert.equal(h.window.picnic.diagnostics().turn, 2); h.frames(.4); tap(h, 'u');
  near(aim(h).angle, before.angle); near(aim(h).power, before.power);
  assert.equal(h.state().shotsLeft, 3); assert.equal(h.window.picnic.diagnostics().turn, 1); assert.ok(aim(h).aiming);
});
test('cancel and input-mode changes preserve scene/ammo/turn; arrows resume the saved aim', () => {
  const h = createHost(); h.get('mode-button').click(); easy(h); tap(h, 'ArrowRight'); const saved = aim(h), poses = JSON.stringify(h.world.bodies().map(b => b.position));
  tap(h, 'Escape'); assert.ok(!aim(h).aiming); assert.equal(h.get('power-wrap').hidden, true);
  tap(h, 'ArrowDown'); assert.ok(aim(h).aiming); near(aim(h).power, saved.power);
  easy(h); h.grab(); easy(h); h.release(); assert.equal(h.state().shotsLeft, 3);
  assert.equal(h.window.picnic.diagnostics().turn, 1); assert.equal(JSON.stringify(h.world.bodies().map(b => b.position)), poses);
});
test('focus loss, pause, retry and mode changes clear held keys and stop tension', () => {
  for (const action of [h => h.window.emit('blur'), h => h.get('levels-button').click(), h => h.get('restart-button').click(), h => easy(h), h => { h.document.hidden = true; h.document.emit('visibilitychange'); }]) {
    const h = createHost(); easy(h); key(h, 'ArrowRight'); action(h); assert.equal(aim(h).held.length, 0);
    assert.equal(h.window.picnic.diagnostics().tensionActive, false); const power = aim(h).power; h.frames(.8); near(aim(h).power, power);
    key(h, ' ', { repeat: true }); assert.equal(h.state().shotsLeft, 3);
  }
});
test('gameplay arrows/Space prevent scrolling, while focused controls/menus keep native keys', () => {
  const h = createHost(); easy(h); let prevented = 0;
  tap(h, 'ArrowRight'); key(h, 'ArrowLeft', { preventDefault: () => prevented++ }); up(h, 'ArrowLeft'); assert.equal(prevented, 1);
  const before = aim(h).angle, shots = h.state().shotsLeft;
  for (const tagName of ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'A']) {
    key(h, 'ArrowUp', { target: { tagName }, preventDefault: () => prevented++ }); key(h, ' ', { target: { tagName }, preventDefault: () => prevented++ });
  }
  near(aim(h).angle, before); assert.equal(h.state().shotsLeft, shots); assert.equal(prevented, 1);
  h.get('levels-button').click(); key(h, 'ArrowUp', { preventDefault: () => prevented++ }); near(aim(h).angle, before); assert.equal(prevented, 1);
});
test('moving focus from the canvas to a button stops held adjustments and tension', () => {
  for (const focus of [h => h.canvas.emit('blur'), h => h.document.emit('focusin', { target: { tagName: 'BUTTON' } })]) {
    const h = createHost(); easy(h); key(h, 'ArrowRight'); h.frames(.3); focus(h);
    const power = aim(h).power; h.frames(.8); near(aim(h).power, power);
    assert.equal(aim(h).held.length, 0); assert.equal(h.window.picnic.diagnostics().tensionActive, false);
  }
});
test('Easy Mode bomb uses the same launch-based three-second fuse, with no aiming countdown', () => {
  const h = createHost(); h.chooseLevel(4); h.chooseType('bomb'); easy(h); h.frames(4); assert.equal(h.state().bombs.length, 0);
  tap(h, ' '); const ball = h.world.activeProjectile; assert.equal(ball.game.detonateAt - ball.game.launchedAt, 3000);
  h.frames(2.9); assert.equal(h.state().explosions, 0); h.frames(.12); assert.ok(h.state().explosions >= 1);
});
test('keyboard preference persists, and blocked storage leaves both controls usable', () => {
  const h = createHost(); easy(h); const reopened = createHost({ storage: h.storage }); assert.equal(aim(reopened).easy, true);
  const blocked = createHost({ storageBlocked: true }); easy(blocked); tap(blocked, ' '); assert.equal(blocked.state().shotsLeft, 2);
});
test('outlined trajectory is drawn in mouse and keyboard mode, including reduced motion', () => {
  for (const keyboard of [false, true]) {
    const h = createHost({ recordDrawing: true }); if (keyboard) easy(h); else h.grab();
    h.get('motion-button').click(); h.frames(.05);
    assert.ok(h.drawCalls.some(c => c[0] === 'arc' && c[3] === 6.5));
    assert.ok(h.drawCalls.some(c => c[0] === 'arc' && c[3] === 4.2));
  }
});
test('predicted free flight matches fixed-step launch positions for every type', () => {
  for (const type of Object.keys(P.projectiles)) {
    const w = new P.GameWorld(4); assert.ok(w.launch(-70, 40, type)); const ball = w.activeProjectile; ball.collisionFilter.mask = 0;
    const path = P.predictTrajectory(-70, 40, type); const pose = { ...ball.position };
    assert.ok(path.length > 120); near(path[0].x, pose.x); near(path[0].y, pose.y);
    for (let tick = 1; tick <= 100; tick++) { w.step(); near(path[tick].x, ball.position.x); near(path[tick].y, ball.position.y); }
    assert.deepEqual(P.predictTrajectory(-70, 40, type), path, 'repeat preview is deterministic');
  }
});
test('trajectory endpoint stops before a thin obstacle and respects heavy ball radius', () => {
  const wall = M.Bodies.rectangle(450, 350, 8, 700, { isStatic: true });
  const paths = ['pebble', 'heavy'].map(type => P.predictTrajectory(-96, 10, type, [wall]));
  for (const p of paths) { assert.ok(p.length > 8); assert.ok(p.every(v => v.x < 450 - 4 - 18)); }
  assert.ok(paths[1].at(-1).x <= paths[0].at(-1).x);
  assert.equal(M.Composite.allBodies(new P.GameWorld().engine.world).some(b => b === wall), false);
});
console.log(`\n${passed} Easy Mode and trajectory checks passed (real-browser visibility checked separately).`);
