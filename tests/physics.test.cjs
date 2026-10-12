'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const P = require('../src/physics.js');
const M = require('../vendor/matter.min.js');
const solutions = require('./solutions.json');
let passed = 0;
function test(name, fn) { fn(); passed++; console.log(`PASS ${name}`); }
function ticks(w, count) { for (let i = 0; i < count; i++) w.step(); }
const { fire, rig, piece, pebble, steps } = require('../tools/physics-sandbox.cjs');
test('all five hand-designed levels are present with distinct layouts', () => {
  const adventure = P.levels.filter(l => !l.quick);
  assert.equal(adventure.length, 5); assert.equal(new Set(adventure.map(l => JSON.stringify(l.pieces))).size, 5);
  assert.deepEqual(adventure.map(l => l.shots), [3, 5, 6, 7, 8]);
  assert.ok(P.materials.glass.density < P.materials.wood.density);
  assert.ok(P.materials.wood.density < P.materials.stone.density);
  assert.ok(P.materials.glass.hp < P.materials.wood.hp && P.materials.wood.hp < P.materials.stone.hp);
  assert.ok(P.materials.metal.density > P.materials.stone.density);
  assert.ok(P.materials.metal.hp > P.materials.stone.hp);
});
test('every level obstacle has finite health and movable mass, including silver metal', () => {
  let metalCount = 0;
  for (let level = 0; level < P.levels.length; level++) {
    assert.ok(P.levels[level].pieces.every(p => !p.platform), 'No permanent platform definitions');
    const w = new P.GameWorld(level);
    for (const b of w.bodies()) {
      if (b.game.kind === 'ground') continue;
      assert.equal(b.isStatic, false); assert.ok(Number.isFinite(b.mass) && b.mass > 0);
      assert.ok(Number.isFinite(b.game.hp) && b.game.hp > 0);
      if (b.game.material === 'metal') { metalCount++; assert.equal(b.game.kind, 'piece'); }
    }
  }
  assert.ok(metalCount >= 7, 'Former foundations, ramps and supports use metal');
});
test('equal impacts move and damage metal less than same-size stone', () => {
  const outcomes = ['stone', 'metal'].map(material => {
    const r = rig(), block = r.add(piece(500, 300, material)), ball = r.add(pebble(454, 300));
    ball.game.kind = 'probe'; M.Body.setMass(ball, 8); M.Body.setVelocity(ball, { x: 14, y: 0 });
    steps(r.world, 60);
    assert.ok(r.world.bodies().includes(block));
    return { mass: block.mass, displacement: block.position.x - 500, damage: 1 - block.game.hp / block.game.maxHp };
  });
  const [stone, metal] = outcomes;
  assert.ok(metal.mass > stone.mass); assert.ok(metal.displacement > 5 && metal.displacement < stone.displacement);
  assert.ok(metal.damage > 0 && metal.damage < stone.damage);
});
test('a strong real collision can destroy metal and emits one break', () => {
  const r = rig(), block = r.add(piece(500, 300, 'metal')), ball = r.add(pebble(454, 300));
  ball.game.kind = 'probe'; M.Body.setMass(ball, 8); M.Body.setVelocity(ball, { x: 22, y: 0 });
  steps(r.world, 80);
  assert.equal(r.world.bodies().includes(block), false);
  assert.equal(r.events.filter(e => e.type === 'break' && e.material === 'metal').length, 1);
});
test('breaking the metal seesaw base releases its beam; undo restores their shared pivot', () => {
  const w = new P.GameWorld(2), joint = M.Composite.allConstraints(w.engine.world).find(c => c.bodyB && c.bodyB.game.material === 'metal');
  assert.ok(joint, 'Pivot must attach to the movable base');
  const base = joint.bodyB, beam = joint.bodyA, before = { x: base.position.x, y: base.position.y, beamY: beam.position.y };
  assert.ok(w.launch(-16, 8)); base.game.hp = 0; w.destroy(base);
  assert.equal(M.Composite.allConstraints(w.engine.world).includes(joint), false);
  assert.equal(beam.isSleeping, false); steps(w, 120);
  assert.ok(beam.position.y > before.beamY + 10, 'No floating beam after its base breaks');
  assert.equal(w.undo(), true);
  const restored = M.Composite.allConstraints(w.engine.world).find(c => c.bodyB && c.bodyB.game.material === 'metal');
  assert.ok(restored); assert.ok(w.bodies().includes(restored.bodyB)); assert.ok(w.bodies().includes(restored.bodyA));
  assert.equal(restored.bodyB.game.hp, P.materials.metal.hp);
  assert.equal(restored.bodyB.position.x, before.x); assert.equal(restored.bodyB.position.y, before.y);
  assert.equal(restored.bodyA.position.y, before.beamY); assert.equal(w.undo(), false);
});
for (let level = 0; level < 5; level++) {
  test(`level ${level + 1}: stable stacks, including after supports wake`, () => {
    const w = new P.GameWorld(level);
    const initial = w.bodies().filter(b => !b.isStatic).map(b => ({ b, x: b.position.x, y: b.position.y, a: b.angle, hp: b.game.hp }));
    const count = w.targets().length;
    ticks(w, 960);
    assert.equal(w.hits, 0); assert.equal(w.targets().length, count);
    // Permit damage and wake real bodies: stability must not depend on a permanently frozen stack.
    w.hits = 1; initial.forEach(p => M.Sleeping.set(p.b, false)); ticks(w, 1200);
    initial.forEach(p => {
      assert.ok(Math.hypot(p.b.position.x - p.x, p.b.position.y - p.y) < 1, 'Less than 1 pixel drift in ten seconds');
      assert.ok(Math.abs(p.b.angle - p.a) < .01); assert.equal(p.b.game.hp, p.hp, 'Resting contact cannot damage pieces');
    });
    assert.equal(w.hits, 1); assert.equal(w.state, 'ready'); assert.equal(w.targets().length, count);
  });
  test(`level ${level + 1}: real physics winning sequence within shot allowance`, () => {
    const w = new P.GameWorld(level), events = [];
    w.onEvent = e => events.push(e.type);
    for (const pull of solutions[level]) { if (w.state === 'ready') fire(w, pull); }
    assert.equal(w.state, 'won'); assert.equal(w.targets().length, 0);
    assert.ok(solutions[level].length <= P.levels[level].shots);
    assert.equal(events.filter(e => e === 'win').length, 1);
    assert.equal(events.filter(e => e === 'collect').length, w.initialTargets);
    assert.ok(events.includes('break'), 'Structure pieces must break from real impacts');
    assert.equal(w.launch(-80, 16), false, 'No shots after winning');
    assert.equal(w.bodies().some(b => !Number.isFinite(b.position.x) || !Number.isFinite(b.angle)), false);
  });
}
test('clamped power, invalid pulls and launch lock preserve ammunition', () => {
  assert.ok(Math.hypot(...Object.values(P.clampPull(-300, 400))) <= P.MAX_PULL + .001);
  const w = new P.GameWorld();
  for (const p of [[0, 0], [50, 0], [-5, 30]]) assert.equal(w.launch(...p), false);
  assert.equal(w.shotsLeft, 3);
  assert.equal(w.launch(-70, 20), true); assert.equal(w.shotsLeft, 2);
  assert.equal(w.launch(-70, 20), false); assert.equal(w.shotsLeft, 2);
});
test('a gentle pebble bump causes no damage', () => {
  const w = new P.GameWorld();
  w.launch(-16, 0);
  const pillar = w.bodies().find(b => b.game.kind === 'piece');
  const hp = pillar.game.hp;
  M.Body.setPosition(w.activeProjectile, { x: pillar.position.x - 33, y: pillar.position.y });
  M.Body.setVelocity(w.activeProjectile, { x: .5, y: 0 });
  M.Body.setAngularVelocity(w.activeProjectile, 0);
  ticks(w, 20);
  assert.equal(pillar.game.hp, hp);
  assert.equal(w.hits, 0);
});
test('strong collision transfers momentum, rotates pieces and triggers a collapse', () => {
  const w = new P.GameWorld(), events = [];
  w.onEvent = e => events.push(e.type);
  const blocks = w.bodies().filter(b => b.game.kind === 'piece');
  const positions = blocks.map(b => ({ x: b.position.x, y: b.position.y }));
  w.launch(-80, 16);
  let rotated = false, displaced = false;
  for (let i = 0; i < 650; i++) {
    w.step(); blocks.forEach((b, n) => {
      if (Math.abs(b.angle) > .08) rotated = true;
      if (Math.hypot(b.position.x - positions[n].x, b.position.y - positions[n].y) > 25) displaced = true;
    });
  }
  assert.ok(rotated); assert.ok(displaced); assert.ok(events.includes('hit')); assert.ok(events.includes('break'));
});
test('a projectile bounces and loses energy through friction', () => {
  const w = new P.GameWorld(); w.launch(-16, 8);
  const p = w.activeProjectile; let upward = false, touchedGround = false;
  for (let i = 0; i < 1000; i++) { w.step(); if (p.position.y > P.FLOOR - 23) touchedGround = true; if (touchedGround && p.velocity.y < -.3) upward = true; }
  assert.ok(upward); assert.ok(p.speed < .2);
});
test('a removed projectile resolves, then the next pebble is available', () => {
  const w = new P.GameWorld(); w.launch(-16, 8);
  M.Body.setPosition(w.activeProjectile, { x: 1600, y: 350 });
  ticks(w, 10); assert.equal(w.state, 'ready'); assert.equal(w.shotsLeft, 2);
  assert.equal(w.launch(-16, 8), true);
});
test('a perpetually moving final projectile reaches the hard 14-second shot limit', () => {
  const w = new P.GameWorld(); w.shotsLeft = 1; w.launch(-16, 8); const p = w.activeProjectile;
  p.collisionFilter.mask = 0;
  M.Events.on(w.engine, 'afterUpdate', () => {
    M.Body.setPosition(p, { x: 400, y: 100 }); M.Body.setVelocity(p, { x: 5, y: 0 });
  });
  ticks(w, 1690); assert.equal(w.state, 'lost'); assert.ok(w.realElapsed >= 14000 && w.realElapsed < 14010);
});
test('misses exhaust ammunition, show loss once, and restart restores the level', () => {
  const events = [], w = new P.GameWorld(0, e => events.push(e.type));
  for (let i = 0; i < 3; i++) fire(w, [-16, 8]);
  assert.equal(w.state, 'lost'); assert.equal(w.shotsLeft, 0); assert.equal(w.targets().length, 2);
  ticks(w, 200); assert.equal(events.filter(e => e === 'lose').length, 1);
  w.load(0); assert.equal(w.state, 'ready'); assert.equal(w.shotsLeft, 3); assert.equal(w.targets().length, 2);
  w.load(4); assert.equal(w.levelIndex, 4); assert.equal(w.shotsLeft, 8); assert.equal(w.targets().length, 7);
});
test('winning on the final pebble takes precedence over loss', () => {
  const w = new P.GameWorld();
  for (let i = 0; i < w.level.shots - 1; i++) fire(w, [-16, 8]);
  fire(w, solutions[0][0]);
  assert.equal(w.shotsLeft, 0); assert.equal(w.state, 'won');
});
test('targets knocked out of view are collected instead of becoming unreachable', () => {
  const w = new P.GameWorld(); w.launch(-16, 8);
  const targets = w.targets(); M.Body.setPosition(targets[0], { x: 1290, y: 400 });
  M.Body.setPosition(targets[1], { x: 200, y: 500 }); w.step();
  assert.equal(w.targets().length, 0); assert.equal(w.state, 'won');
});
test('collapsed scene is bounded and inexpensive to update', () => {
  const w = new P.GameWorld(4); solutions[4].forEach(p => { if (w.state === 'ready') fire(w, p); });
  assert.ok(w.bodies().length < 30);
  const t = performance.now(); ticks(w, 3600); const ms = performance.now() - t;
  assert.ok(ms < 6000, `30 seconds of simulated collapsed scene took ${Math.round(ms)}ms`);
  console.log(`  30 simulated seconds: ${Math.round(ms)} ms, ${w.bodies().length} bodies`);
});
test('runtime references are local and the Windows launcher uses its own directory', () => {
  const root = path.resolve(__dirname, '..'), html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m => m[1]).filter(r => !r.startsWith('data:'));
  for (const ref of refs) { assert.equal(/^https?:/.test(ref), false); assert.ok(fs.existsSync(path.join(root, ref)), ref); }
  const js = fs.readFileSync(path.join(root, 'src/game.js'), 'utf8');
  assert.equal(/\bfetch\s*\(|XMLHttpRequest|WebSocket|https?:\/\//.test(js), false);
  assert.ok(fs.readFileSync(path.join(root, 'PLAY.cmd'), 'utf8').includes('%~dp0index.html'));
  assert.ok(fs.readFileSync(path.join(root, 'vendor/MATTER-LICENSE.txt'), 'utf8').includes('Permission is hereby granted'));
});
console.log(`\n${passed} checks passed. Physics-only: browser controls/audio/layout are checked separately.`);
