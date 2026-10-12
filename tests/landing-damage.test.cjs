'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs');
const { P, M, piece, steps, finite } = require('../tools/physics-sandbox.cjs');
// Controlled baseline: identical production code with only the landing tuning
// returned to 1. No geometry, contact rules, thresholds or timesteps change.
const baselineModule = { exports: {} };
const source = fs.readFileSync(require.resolve('../src/physics.js'), 'utf8').replace(/const LANDING_DAMAGE_SCALE = [\d.]+;/, 'const LANDING_DAMAGE_SCALE = 1;');
new Function('require', 'module', source)(p => p.includes('matter') ? M : P.levels, baselineModule);
const Baseline = baselineModule.exports;
let passed = 0; const measurements = [];
function test(name, fn) { fn(); passed++; console.log(`PASS ${name}`); }
function drop(Physics, material, height, surface = 'ground', sideways = false) {
  const events = [], w = new Physics.GameWorld(0, e => events.push(e));
  M.Composite.clear(w.engine.world, false); M.Engine.clear(w.engine); w.engine.enableSleeping = false;
  w.engine.gravity.y = sideways ? 0 : 1; w.state = 'flying'; w.shotsLeft = 2; w.hits = 1;
  const floor = M.Bodies.rectangle(sideways ? 800 : 650, sideways ? 350 : 650, sideways ? 100 : 1000, sideways ? 1000 : 100, { isStatic: surface !== 'piece', density: .008, friction: .6, restitution: .1 });
  floor.game = { kind: surface, material: 'stone', hp: 100000, maxHp: 100000, lastHit: -1000 };
  const falling = material === 'target' ? M.Bodies.circle(650, 580 - height, 23, { ...P.materials.target, frictionAir: .002 }) : piece(sideways ? 710 : 650, sideways ? 350 : 580 - height, material, { frictionAir: .002 });
  if (material === 'target') falling.game = { kind: 'target', material, hp: 4, maxHp: 4, lastHit: -1000 };
  if (sideways) M.Body.setVelocity(falling, { x: height, y: 0 });
  const sentinel = M.Bodies.circle(1200, 100, 23, { isStatic: true }); sentinel.game = { kind: 'target', hp: 1e9 };
  M.Composite.add(w.engine.world, [floor, falling, sentinel]);
  if (surface === 'piece') {
    M.Body.setMass(floor, 500); floor.frictionAir = 0;
    const base = M.Bodies.rectangle(650, 750, 1000, 100, { isStatic: true }); base.game = { kind: 'ground' };
    M.Composite.add(w.engine.world, base);
  }
  for (let i = 0; i < 220 && !events.some(e => e.type === 'hit' && e.material === material); i++) w.step();
  const hit = events.find(e => e.type === 'hit' && e.material === material);
  return { hit, damage: hit ? hit.damage : 0, w, falling };
}
test('representative wood, glass, stone, metal and pod falls take 15% more landing damage', () => {
  for (const material of ['wood', 'glass', 'stone', 'metal', 'target']) for (const height of [90, 180]) {
    const old = drop(Baseline, material, height), current = drop(P, material, height);
    assert.ok(old.hit && current.hit, `${material}/${height} produces a measurable landing`);
    assert.ok(current.hit.landing); assert.ok(Math.abs(current.damage / old.damage - 1.15) < 1e-8);
    measurements.push({ material, height, before: +old.damage.toFixed(4), after: +current.damage.toFixed(4) });
    assert.ok(finite(current.w));
  }
});
test('larger falls cause more damage while material durability remains distinct', () => {
  for (const material of ['wood', 'glass', 'stone', 'metal', 'target']) {
    assert.ok(drop(P, material, 180).damage > drop(P, material, 90).damage);
  }
  const glass = drop(P, 'glass', 90), stone = drop(P, 'stone', 90);
  assert.ok(glass.damage / P.materials.glass.hp > stone.damage / P.materials.stone.hp);
});
test('landing bonus applies to platforms and other pieces, with unchanged side-impact damage', () => {
  for (const surface of ['platform', 'piece']) {
    const before = drop(Baseline, 'wood', 70, surface), after = drop(P, 'wood', 70, surface);
    assert.ok(after.hit && after.hit.landing); assert.ok(Math.abs(after.damage / before.damage - 1.15) < 1e-8);
  }
  const before = drop(Baseline, 'stone', 10, 'platform', true), after = drop(P, 'stone', 10, 'platform', true);
  assert.ok(after.hit && !after.hit.landing); assert.ok(Math.abs(before.damage - after.damage) < 1e-8);
});
test('tiny drops and extended resting contact remain harmless', () => {
  for (const material of ['wood', 'glass', 'stone', 'metal', 'target']) {
    const d = drop(P, material, .5); assert.equal(d.damage, 0); steps(d.w, 1000);
    assert.equal(d.falling.game.hp, d.falling.game.maxHp); assert.ok(finite(d.w));
  }
});
test('removing supports wakes a sleeping cascade and landing damage collects falling pods', () => {
  const events = [], w = new P.GameWorld(0, e => events.push(e));
  const ground = w.bodies().find(b => b.game.kind === 'ground'); M.Composite.clear(w.engine.world, false); M.Engine.clear(w.engine); M.Composite.add(w.engine.world, ground);
  const support = piece(650, 500, 'stone', { width: 40, height: 200 }), roof = piece(650, 390, 'wood', { width: 80, height: 20 });
  const pod = M.Bodies.circle(650, 357, 23, { ...P.materials.target, frictionAir: .002 }); pod.game = { kind: 'target', material: 'target', hp: 4, maxHp: 4, lastHit: -1000 };
  M.Composite.add(w.engine.world, [support, roof, pod]); [support, roof, pod].forEach(b => M.Sleeping.set(b, true));
  w.initialTargets = 1; w.launches = 1; w.removeBody(support); assert.equal(roof.isSleeping, false); assert.equal(pod.isSleeping, false);
  steps(w, 600); assert.ok(!w.bodies().includes(roof) || roof.position.y > 430);
  assert.equal(w.targets().length, 0); assert.ok(events.some(e => e.type === 'hit' && e.landing)); assert.ok(finite(w));
});
console.log('Landing damage measurements:', JSON.stringify(measurements));
console.log(`\n${passed} landing-damage checks passed.`);
