const assert = require('node:assert/strict');
const P = require('../src/physics.js'), M = require('../vendor/matter.min.js');
let passed = 0;
function test(name, fn) { fn(); passed++; console.log(`PASS ${name}`); }
function ticks(w, n) { for (let i = 0; i < n; i++) w.step(); }
test('a rolling projectile reloads by two seconds and remains physical', () => {
  const w = new P.GameWorld(); w.launch(-16, 8); const ball = w.activeProjectile;
  ball.collisionFilter.mask = 0;
  M.Events.on(w.engine, 'afterUpdate', () => { M.Body.setPosition(ball, { x: 400, y: 350 }); M.Body.setVelocity(ball, { x: 5, y: 0 }); });
  ticks(w, 241); assert.equal(w.state, 'ready'); assert.ok(w.bodies().includes(ball));
  assert.ok(w.realElapsed >= 2000 && w.realElapsed < 2010);
  assert.ok(w.launch(-16, 8)); assert.equal(w.shotsLeft, 1);
});
test('a stopped ball reloads before the surrounding debris settles', () => {
  const w = new P.GameWorld(); w.launch(-16, 8); const ball = w.activeProjectile;
  const plank = w.bodies().find(b => b.game.kind === 'piece');
  M.Body.setPosition(ball, { x: 350, y: 580 }); M.Sleeping.set(ball, true);
  M.Body.setPosition(plank, { x: 950, y: 150 }); M.Sleeping.set(plank, false); M.Body.setVelocity(plank, { x: 3, y: 0 });
  ticks(w, 20); assert.equal(w.state, 'ready'); assert.ok(w.realElapsed < 2000); assert.ok(w.moving());
});
test('real-time reload is independent of slow-motion simulation', () => {
  const w = new P.GameWorld(); w.launch(-80, 16);
  for (let i = 0; i < 20; i++) { w.step(0); w.advanceRealTime(100); }
  assert.equal(w.state, 'ready'); assert.ok(w.elapsed < 200); assert.equal(w.realElapsed, 2000);
});
test('the final shot waits for late collisions and has a bounded timeout', () => {
  const w = new P.GameWorld(); w.shotsLeft = 1; w.launch(-16, 8); const ball = w.activeProjectile;
  ball.collisionFilter.mask = 0;
  M.Events.on(w.engine, 'afterUpdate', () => { M.Body.setPosition(ball, { x: 400, y: 350 }); M.Body.setVelocity(ball, { x: 5, y: 0 }); });
  ticks(w, 241); assert.equal(w.state, 'flying'); ticks(w, 1450); assert.equal(w.state, 'lost');
});
const { rig, piece, pebble, steps, finite } = require('../tools/physics-sandbox.cjs');
const { createHost } = require('./ui-host.cjs');
test('ordinary balls transfer momentum without exploding at bomb-strength impacts', () => {
  for (const type of ['pebble', 'heavy', 'bouncy']) {
    const r = rig(), block = r.add(piece(500, 300, 'stone')), ball = r.add(pebble(454, 300, { projectileType: type }));
    M.Body.setVelocity(ball, { x: 14, y: 0 }); steps(r.world, 20);
    assert.equal(r.world.explosions, 0); assert.ok(r.world.bodies().includes(ball)); assert.ok(block.position.x > 502);
  }
});
test('projectile selection respects inventory and bombs are scarce in later levels', () => {
  assert.ok(P.levels.slice(0, 3).every(l => !l.ammo.bomb));
  assert.ok(P.levels.slice(3, 5).every(l => l.ammo.bomb === 1));
  assert.ok(P.levels.filter(l => l.quick).every(l => !l.ammo.bomb));
  const w = new P.GameWorld(4), initial = w.shotsLeft;
  assert.equal(w.selectProjectile('invalid'), false); assert.ok(w.selectProjectile('bomb'));
  assert.ok(w.launch(-60, 20)); assert.equal(w.ammo.bomb, 0); assert.equal(w.shotsLeft, initial - 1);
  ticks(w, 241); if (w.state === 'ready') { assert.equal(w.selectProjectile('bomb'), false); assert.ok(w.ammo[w.selectedType] > 0); }
  const mass = {};
  for (const type of ['pebble', 'heavy', 'bouncy']) { const q = new P.GameWorld(4); q.launch(-40, 16, type); mass[type] = q.activeProjectile.mass; }
  assert.ok(mass.heavy > mass.pebble * 2); assert.ok(mass.bouncy < mass.pebble);
  assert.ok(P.projectiles.bouncy.restitution > P.projectiles.pebble.restitution);
});
test('bouncy balls rebound substantially higher than ordinary pebbles', () => {
  const peaks = {};
  for (const type of ['pebble', 'bouncy']) {
    const w = new P.GameWorld(4); w.launch(-16, 8, type); const b = w.activeProjectile;
    M.Body.setPosition(b, { x: 380, y: 540 }); M.Body.setVelocity(b, { x: 0, y: 10 }); M.Body.setAngularVelocity(b, 0);
    let hit = false, peak = 0;
    for (let i = 0; i < 200; i++) { w.step(); if (b.position.y > 575) hit = true; if (hit) peak = Math.max(peak, P.FLOOR - 20 - b.position.y); }
    peaks[type] = peak;
  }
  assert.ok(peaks.bouncy > peaks.pebble * 2, JSON.stringify(peaks));
});
test('gentle contact leaves a golden crate intact; hard contact starts a bounded chain', () => {
  const mild = rig(), safe = mild.add(piece(500, 300, 'wood', { kind: 'crate', width: 42, height: 42 })), soft = mild.add(pebble(459, 300, { projectileType: 'pebble' }));
  M.Body.setVelocity(soft, { x: .5, y: 0 }); steps(mild.world, 20); assert.equal(mild.world.explosions, 0); assert.ok(mild.world.bodies().includes(safe));
  const r = rig(), crates = [500, 565, 630].map(x => r.add(piece(x, 300, 'wood', { kind: 'crate', width: 42, height: 42 })));
  const ball = r.add(pebble(454, 300, { projectileType: 'pebble' })); M.Body.setVelocity(ball, { x: 14, y: 0 }); steps(r.world, 40);
  assert.equal(r.world.explosions, 3); assert.ok(crates.every(c => !r.world.bodies().includes(c))); assert.ok(finite(r.world));
  steps(r.world, 120); assert.equal(r.world.explosions, 3);
});
test('broken bridge pieces release their constraints', () => {
  const w = new P.GameWorld(3), ropes = M.Composite.allConstraints(w.engine.world), deck = ropes[0].bodyA;
  assert.equal(ropes.length, 2); w.destroy(deck); assert.equal(M.Composite.allConstraints(w.engine.world).length, 0);
  ticks(w, 120); assert.ok(finite(w));
});
test('removing a support wakes its resting pod instead of leaving it floating', () => {
  const w = new P.GameWorld(), beam = w.bodies().find(b => b.game.kind === 'piece' && b.game.width === 160), pod = w.targets().find(b => b.position.y < 500);
  const y = pod.position.y; assert.ok(pod.isSleeping); w.destroy(beam); assert.equal(pod.isSleeping, false);
  ticks(w, 60); assert.ok(pod.position.y > y + 30); assert.ok(finite(w));
});
test('support removal propagates wake-up through every floor of a sleeping tower', () => {
  const w = new P.GameWorld(2), beams = w.bodies().filter(b => b.game.kind === 'piece' && b.game.width === 158).sort((a, b) => b.position.y - a.position.y);
  const roof = beams[1], pod = w.targets().find(b => b.position.y < 400), y = roof.position.y;
  assert.ok(roof.isSleeping && pod.isSleeping); w.destroy(beams[0]);
  assert.equal(roof.isSleeping, false); assert.equal(pod.isSleeping, false);
  // The upper legs land on the lower posts after the missing 20px beam drops.
  ticks(w, 60); assert.ok(roof.position.y > y + 10); assert.ok(finite(w));
});
test('rope simulation cannot mutate level definitions or change the next retry', () => {
  const original = JSON.stringify(P.levels), w = new P.GameWorld(3);
  const poses = () => w.bodies().map(b => [b.position.x, b.position.y, b.angle]);
  const initial = poses(); w.launch(-96, 24, 'heavy'); ticks(w, 1200);
  assert.equal(JSON.stringify(P.levels), original);
  w.load(3); poses().forEach((p, i) => p.forEach((v, j) => assert.ok(Math.abs(v - initial[i][j]) < 1e-7, 'Retry starts with the same geometry')));
});
test('victory waits at least 1.7 seconds and preserves the visible collapse', () => {
  const h = createHost(); h.world.targets().forEach(b => h.world.destroy(b)); h.frames(.1);
  assert.equal(h.state().state, 'won'); assert.equal(h.get('outcome').hidden, true);
  h.frames(1.4); assert.equal(h.get('outcome').hidden, true); h.frames(3.2); assert.equal(h.get('outcome').hidden, false);
});
test('late collection while aiming cancels the pull and tension without spending ammo', () => {
  const h = createHost(); h.grab(); assert.ok(h.window.picnic.diagnostics().tensionActive);
  h.world.targets().forEach(b => h.world.destroy(b)); h.frames(.1);
  assert.equal(h.state().shotsLeft, 3); assert.equal(h.window.picnic.getPull().dragging, false); assert.equal(h.window.picnic.diagnostics().tensionActive, false);
});
test('moving debris extends victory presentation, with a 4.5-second bound', () => {
  const h = createHost(), w = h.world; w.targets().forEach(b => w.destroy(b));
  const b = w.bodies().find(b => !b.isStatic); b.collisionFilter.mask = 0;
  M.Events.on(w.engine, 'afterUpdate', () => { M.Sleeping.set(b, false); M.Body.setPosition(b, { x: 600, y: 250 }); M.Body.setVelocity(b, { x: 5, y: 0 }); });
  h.frames(2); assert.equal(h.get('outcome').hidden, true); h.frames(2.7); assert.equal(h.get('outcome').hidden, false);
});
test('restart and level selection cancel stale victory popups', () => {
  for (const action of ['restart', 'select']) {
    const h = createHost(); h.world.targets().forEach(b => h.world.destroy(b)); h.frames(.1);
    if (action === 'restart') h.get('restart-button').click(); else { h.get('levels-button').click(); h.chooseLevel(2); }
    h.frames(5); assert.equal(h.get('outcome').hidden, true); assert.equal(h.state().state, 'ready');
  }
});
test('pull feedback increases continuously and cancels/stops on mute and navigation', () => {
  const h = createHost(); h.grab(); const small = h.audioEvents.at(-2); h.move(-96, 0); const large = h.audioEvents.at(-2);
  assert.ok(large > small); assert.ok(h.window.picnic.diagnostics().tensionActive); assert.ok(parseFloat(h.get('power-fill').style.width) > 99);
  h.get('mute-button').click(); assert.equal(h.window.picnic.diagnostics().tensionActive, false);
  h.get('mute-button').click(); assert.equal(h.window.picnic.diagnostics().tensionActive, true);
  h.window.emit('keydown', { key: 'Escape' }); assert.equal(h.window.picnic.diagnostics().tensionActive, false);
  h.grab(); h.get('levels-button').click(); assert.equal(h.window.picnic.diagnostics().tensionActive, false); assert.equal(h.state().shotsLeft, 3);
});
test('release, blur and retry stop pull audio without leaving a stuck oscillator', () => {
  for (const action of ['release', 'blur', 'retry']) {
    const h = createHost(); h.grab(); h.move(-70, 10);
    if (action === 'release') h.release(); else if (action === 'blur') h.window.emit('blur'); else h.get('retry-button').click();
    assert.equal(h.window.picnic.diagnostics().tensionActive, false);
  }
});
test('cooperative turns advance on launches only, share ammo and reset on retry', () => {
  const h = createHost(); h.get('mode-button').click(); assert.ok(h.window.picnic.diagnostics().coop);
  h.grab(); h.window.emit('keydown', { key: 'Escape' }); assert.equal(h.window.picnic.diagnostics().turn, 1);
  h.grab(); h.release(-16, 8); assert.equal(h.window.picnic.diagnostics().turn, 2); assert.equal(h.state().shotsLeft, 2);
  h.frames(2.2); assert.equal(h.state().state, 'ready'); assert.ok(h.get('turn-badge').textContent.includes('Player 2'));
  h.grab(); h.release(-16, 8); assert.equal(h.window.picnic.diagnostics().turn, 1); assert.equal(h.state().shotsLeft, 1);
  h.get('retry-button').click(); assert.equal(h.window.picnic.diagnostics().turn, 1); assert.equal(h.state().shotsLeft, 3);
  h.get('mode-button').click(); assert.equal(h.window.picnic.diagnostics().coop, false);
});
test('stickers and motion preferences survive reload; blocked storage still permits play', () => {
  const storage = new Map(), h = createHost({ storage }); h.world.targets().forEach(b => h.world.destroy(b)); h.frames(.1);
  h.get('motion-button').click(); const next = createHost({ storage }); next.get('levels-button').click();
  assert.ok(next.window.picnic.diagnostics().completed.includes(0)); assert.ok(next.get('sticker-album').innerHTML.includes('🌼'));
  assert.ok(next.window.picnic.diagnostics().reducedMotion);
  const blocked = createHost({ storageBlocked: true }); blocked.grab(); blocked.release(); assert.equal(blocked.state().shotsLeft, 2);
});
test('reduced motion disables impact time scaling and mute preserves physics', () => {
  const h = createHost(); h.world.emit('hit', { strength: 14, material: 'wood' }); assert.ok(h.window.picnic.diagnostics().slowMotion);
  h.get('motion-button').click(); assert.equal(h.window.picnic.diagnostics().slowMotion, false);
  h.world.emit('hit', { strength: 14, material: 'wood' }); assert.equal(h.window.picnic.diagnostics().slowMotion, false);
  h.get('mute-button').click(); h.grab(); h.release(-16, 8); h.frames(2.2); assert.equal(h.state().state, 'ready');
});
console.log(`\n${passed} upgrade checks passed.`);
