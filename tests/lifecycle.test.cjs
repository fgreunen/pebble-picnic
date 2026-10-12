'use strict';
const assert = require('node:assert/strict');
const { P, M, rig, piece, pebble, steps, finite } = require('../tools/physics-sandbox.cjs');
const { createHost } = require('./ui-host.cjs');
let passed = 0;
function test(name, fn) { fn(); passed++; console.log(`PASS ${name}`); }
function near(a, b, eps = 1e-7) { assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`); }
function pose(w) { return w.bodies().map(b => ({ game: { ...b.game }, x: b.position.x, y: b.position.y, angle: b.angle, v: M.Body.getVelocity(b), av: M.Body.getAngularVelocity(b), sleeping: b.isSleeping })); }
function samePose(w, expected) {
  const actual = pose(w); assert.equal(actual.length, expected.length);
  actual.forEach((b, i) => { const e = expected[i]; assert.deepEqual(b.game, e.game); near(b.x, e.x); near(b.y, e.y); near(b.angle, e.angle); near(b.v.x, e.v.x); near(b.v.y, e.v.y); near(b.av, e.av); assert.equal(b.sleeping, e.sleeping); });
}
test('hard, gentle and repeated contacts never trigger or reset a bomb fuse', () => {
  for (const speed of [.6, 14]) {
    const r = rig(), block = r.add(piece(500, 300, 'stone')), ball = r.add(pebble(454, 300));
    M.Body.setVelocity(ball, { x: speed, y: 0 }); steps(r.world, 30);
    assert.equal(r.world.explosions, 0); assert.equal(ball.game.detonateAt, P.BOMB_FUSE);
    r.world.advanceRealTime(P.BOMB_FUSE - r.world.realTime - .01); assert.equal(r.world.explosions, 0);
    r.world.advanceRealTime(.01); assert.equal(r.world.explosions, 1); assert.ok(!r.world.bodies().includes(ball));
    r.world.advanceRealTime(6000); steps(r.world, 100); assert.equal(r.world.explosions, 1); assert.ok(finite(r.world));
    if (speed > 10) assert.ok(block.position.x > 505, 'Contact transfers momentum before timed explosion');
  }
});
test('actual launch starts the fuse, and a stopped final bomb cannot lose before exploding', () => {
  const w = new P.GameWorld(4), events = []; w.onEvent = e => events.push(e.type);
  w.realTime = 1200; w.shotsLeft = 1; assert.ok(w.launch(-16, 8, 'bomb')); const b = w.activeProjectile;
  assert.equal(b.game.launchedAt, 1200); assert.equal(b.game.detonateAt, 4200);
  M.Body.setPosition(b, { x: 350, y: 580 }); M.Sleeping.set(b, true);
  steps(w, 250); assert.equal(w.state, 'flying'); assert.ok(w.bodies().includes(b));
  w.advanceRealTime(4200 - w.realTime); assert.equal(w.explosions, 1); assert.notEqual(w.state, 'lost');
  steps(w, 200); assert.equal(w.state, 'lost'); assert.equal(events.filter(e => e === 'explode').length, 1);
});
test('fuses continue after quick reload and use active real time during slow motion', () => {
  const w = new P.GameWorld(4); w.launch(-80, 16, 'bomb'); const b = w.activeProjectile; b.collisionFilter.mask = 0;
  for (let i = 0; i < 20; i++) { w.step(0); w.advanceRealTime(100); }
  assert.equal(w.state, 'ready'); assert.ok(w.elapsed < 200); assert.equal(w.explosions, 0);
  w.advanceRealTime(999); assert.ok(w.bodies().includes(b)); w.advanceRealTime(1); assert.equal(w.explosions, 1);
});
test('aiming, the level map and hidden tabs do not burn a fuse; retry clears bombs', () => {
  const h = createHost(); h.chooseLevel(4); h.chooseType('bomb'); h.grab(); h.frames(4);
  assert.equal(h.state().bombs.length, 0); h.release(-16, 8); const b = h.world.activeProjectile;
  h.frames(.5); const left = b.game.detonateAt - h.world.realTime;
  h.get('levels-button').click(); h.frames(5); near(b.game.detonateAt - h.world.realTime, left);
  h.get('close-levels').click(); h.document.hidden = true; h.document.emit('visibilitychange'); h.frames(5); near(b.game.detonateAt - h.world.realTime, left);
  h.document.hidden = false; h.document.emit('visibilitychange'); h.frames(1); assert.equal(h.world.explosions, 0);
  h.get('restart-button').click(); h.frames(4); assert.equal(h.state().bombs.length, 0); assert.equal(h.world.explosions, 0);
});
test('offscreen bombs still detonate once on schedule', () => {
  const w = new P.GameWorld(4); w.launch(-16, 8, 'bomb'); const b = w.activeProjectile;
  M.Body.setPosition(b, { x: 1800, y: 500 }); steps(w, 10); assert.ok(w.bodies().includes(b));
  w.advanceRealTime(P.BOMB_FUSE - w.realTime); assert.equal(w.explosions, 1); assert.ok(!w.bodies().includes(b));
});
test('fuse artwork shows a static 3s preview and the live countdown after launch', () => {
  const h = createHost({ recordDrawing: true }); h.chooseLevel(4); h.chooseType('bomb'); h.grab(); h.frames(4);
  assert.ok(h.drawCalls.some(c => c[0] === 'fillText' && c[1] === '3s')); assert.equal(h.state().bombs.length, 0);
  h.release(-16, 8); const b = h.world.activeProjectile; M.Body.setPosition(b, { x: 350, y: 580 }); M.Sleeping.set(b, true);
  h.drawCalls.length = 0; h.frames(1.1); assert.ok(h.drawCalls.some(c => c[0] === 'fillText' && c[1] === '2'));
  h.drawCalls.length = 0; h.frames(1); assert.ok(h.drawCalls.some(c => c[0] === 'fillText' && c[1] === '1'));
  h.frames(1); assert.equal(h.world.explosions, 1); assert.ok(!h.world.bodies().includes(b));
});
test('camera shake has half the original amplitude and is absent with reduced motion', () => {
  const h = createHost({ recordDrawing: true }); h.grab(); h.release(-16, 8); h.world.emit('hit', { strength: 14, material: 'wood' });
  h.drawCalls.length = 0; h.frames(1 / 60);
  const shake = h.drawCalls.find(c => c[0] === 'translate' && Math.abs(c[1]) > 0 && Math.abs(c[1]) <= 1.5 && Math.abs(c[2]) <= 1);
  assert.ok(shake); near(shake[1], Math.sin(71 / 60) * 1.5); near(shake[2], Math.cos(63 / 60));
  h.get('motion-button').click(); h.drawCalls.length = 0; h.world.emit('hit', { strength: 14, material: 'wood' }); h.frames(1 / 60);
  assert.ok(!h.drawCalls.some(c => c[0] === 'translate' && Math.abs(c[1]) > 0 && Math.abs(c[1]) <= 1.5 && Math.abs(c[2]) <= 1));
});
test('resting ordinary, heavy and bouncy balls fizzle and leave physics without spending ammo', () => {
  for (const type of ['pebble', 'heavy', 'bouncy']) {
    const w = new P.GameWorld(4); w.launch(-16, 8, type); const b = w.activeProjectile, shots = w.shotsLeft;
    M.Sleeping.set(b, true); w.advanceRealTime(P.REST_DELAY); assert.equal(b.game.fizzleAt, w.realTime); assert.ok(w.bodies().includes(b));
    w.advanceRealTime(P.FIZZLE_TIME - .01); assert.ok(w.bodies().includes(b)); w.advanceRealTime(.01); assert.ok(!w.bodies().includes(b)); assert.equal(w.shotsLeft, shots);
  }
});
test('moving balls stay physical and a waking ball cancels its fizzle', () => {
  const w = new P.GameWorld(); w.launch(-70, 16); const b = w.activeProjectile;
  w.advanceRealTime(2000); assert.ok(w.bodies().includes(b)); assert.equal(b.game.fizzleAt, undefined);
  M.Sleeping.set(b, true); w.advanceRealTime(350); assert.ok(b.game.fizzleAt !== undefined);
  M.Sleeping.set(b, false); M.Body.setVelocity(b, { x: 2, y: 0 }); w.advanceRealTime(1000);
  assert.equal(b.game.fizzleAt, undefined); assert.ok(w.bodies().includes(b));
});
test('retiring a resting ball wakes another ball supported on it', () => {
  const r = rig({ gravity: 1, sleeping: true }), lower = r.add(pebble(500, 560, { projectileType: 'pebble' })), upper = r.add(pebble(500, 520, { projectileType: 'bomb' }));
  M.Sleeping.set(lower, true); M.Sleeping.set(upper, true);
  r.world.advanceRealTime(350); r.world.advanceRealTime(350); assert.equal(upper.isSleeping, false);
  const y = upper.position.y; steps(r.world, 30); assert.ok(upper.position.y > y + 20);
});
test('undo after a bomb explosion restores exact poses, health, ammo and rope attachments', () => {
  const w = new P.GameWorld(3), before = pose(w), ammo = { ...w.ammo };
  assert.ok(!w.undo()); w.selectProjectile('bomb'); w.launch(-96, 24); steps(w, 720); assert.ok(w.explosions > 0);
  assert.ok(w.undo()); samePose(w, before); assert.deepEqual(w.ammo, ammo); assert.equal(w.selectedType, 'bomb'); assert.equal(w.state, 'ready'); assert.equal(w.shotsLeft, 7);
  assert.equal(M.Composite.allConstraints(w.engine.world).length, 2); assert.equal(w.explosions, 0); assert.ok(!w.undo());
  steps(w, 120); assert.ok(finite(w)); assert.equal(w.hits, 0);
});
test('undo includes earlier moving balls, partial damage and remaining bomb timers', () => {
  const w = new P.GameWorld(4); w.launch(-16, 8, 'bomb'); const b = w.activeProjectile;
  b.collisionFilter.mask = 0; w.advanceRealTime(2100); assert.equal(w.state, 'ready');
  const plank = w.bodies().find(b => b.game.kind === 'piece'); plank.game.hp *= .4;
  w.selectProjectile('heavy');
  const before = pose(w), timer = b.game.detonateAt - w.realTime, ammo = { ...w.ammo };
  w.launch(-70, 16, 'heavy'); steps(w, 500); assert.ok(w.explosions > 0); w.undo();
  samePose(w, before); assert.deepEqual(w.ammo, ammo); assert.equal(w.selectedType, 'heavy');
  const old = w.bodies().find(b => b.game.projectileType === 'bomb'); near(old.game.detonateAt - w.realTime, timer);
  w.advanceRealTime(timer - .01); assert.equal(w.explosions, 0); w.advanceRealTime(.01); assert.equal(w.explosions, 1);
});
test('undo restores cooperative turn and removes only the reward earned by the undone shot', () => {
  const h = createHost(); h.get('mode-button').click(); h.grab(); h.release(-32, 56); h.frames(8);
  assert.equal(h.state().state, 'won'); assert.ok(h.window.picnic.diagnostics().completed.includes(0));
  h.get('outcome-undo').click(); assert.equal(h.state().state, 'ready'); assert.equal(h.state().shotsLeft, 3); assert.equal(h.window.picnic.diagnostics().turn, 1);
  assert.equal(h.window.picnic.diagnostics().completed.includes(0), false); assert.equal(h.get('outcome').hidden, true); assert.equal(h.get('undo-button').disabled, true);
  h.frames(5); assert.equal(h.get('outcome').hidden, true); assert.ok(!h.world.undo());
  // A previously earned sticker survives undo on a replay.
  h.world.targets().forEach(b => h.world.destroy(b)); h.frames(.1); h.get('retry-button').click(); h.grab(); h.release(-16, 8); h.get('undo-button').click();
  assert.ok(h.window.picnic.diagnostics().completed.includes(0));
});
test('undo preserves live contact impulses and the result of repeating a shot', () => {
  // First tumble is deliberately unchanged by later ball-specific architecture.
  const control = new P.GameWorld(0), replay = new P.GameWorld(0);
  for (const w of [control, replay]) { w.launch(-96, 24); steps(w, 250); assert.equal(w.state, 'ready'); assert.ok(w.moving()); }
  replay.launch(-80, 16); replay.undo();
  // Same live contacts must continue identically, even though the undo engine is
  // a different private graph and global Matter IDs have advanced meanwhile.
  samePose(replay, pose(control));
  for (const w of [control, replay]) w.launch(-80, 16);
  steps(control, 1200); steps(replay, 1200);
  samePose(replay, pose(control)); assert.equal(replay.state, control.state); assert.equal(replay.targets().length, control.targets().length);
});
test('retry, level changes, invalid pulls and repeated undo cannot create ammunition', () => {
  const h = createHost(); h.grab(); h.release(-16, 8); h.window.emit('keydown', { key: 'u' }); assert.equal(h.state().shotsLeft, 3);
  h.window.emit('keydown', { key: 'u' }); assert.equal(h.state().shotsLeft, 3); assert.equal(h.world.launch(0, 0), false); assert.equal(h.world.undoState, null);
  h.grab(); h.release(-16, 8); h.get('restart-button').click(); assert.ok(!h.world.undo());
  h.grab(); h.release(-16, 8); h.chooseLevel(4); assert.ok(!h.world.undo()); assert.equal(h.state().shotsLeft, 8);
});
console.log(`\n${passed} lifecycle checks passed.`);
