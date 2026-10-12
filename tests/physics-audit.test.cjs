'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), { performance } = require('node:perf_hooks');
const artifactDirectory = require('../tools/artifacts.cjs');
const { M, P, rig, piece, pebble, steps, fire, finite, momentum, energy } = require('../tools/physics-sandbox.cjs');
let passed = 0;
const metrics = {};
function test(name, fn) { fn(); passed++; console.log(`PASS ${name}`); }
function inertBall(r, x, y, velocity, mass = 5, restitution = 1) {
  const b = r.add(pebble(x, y, { restitution, friction: 0, frictionStatic: 0 }));
  b.game.kind = 'probe'; M.Body.setMass(b, mass); M.Body.setVelocity(b, velocity); return b;
}
test('isolated elastic collision conserves momentum and bounds energy error', () => {
  const r = rig();
  const a = inertBall(r, 400, 300, { x: 10, y: 0 }, 5), b = inertBall(r, 480, 300, { x: -2, y: 0 }, 9);
  const beforeP = momentum([a, b]), beforeE = energy([a, b]);
  steps(r.world, 50);
  const afterP = momentum([a, b]), afterE = energy([a, b]);
  const momentumError = Math.hypot(afterP.x - beforeP.x, afterP.y - beforeP.y) / Math.max(1, Math.hypot(beforeP.x, beforeP.y));
  const energyError = Math.abs(afterE - beforeE) / beforeE;
  metrics.elastic = { momentumError, energyError };
  assert.ok(momentumError < .005, `Momentum error ${momentumError}`);
  // Matter is an iterative game solver: permit <=5% numerical dissipation,
  // while separately disallowing artificial energy gain above 1%.
  assert.ok(energyError < .05, `Energy error ${energyError}`);
  assert.ok(afterE <= beforeE * 1.01, 'Passive contact must not create energy');
  assert.ok(a.velocity.x < b.velocity.x, 'Bodies separate after collision');
});
test('inelastic collision dissipates energy without generating momentum', () => {
  const r = rig(), a = inertBall(r, 400, 300, { x: 10, y: 0 }, 5, .2), b = inertBall(r, 480, 300, { x: 0, y: 0 }, 9, .2);
  const e = energy([a, b]), p = momentum([a, b]); steps(r.world, 50);
  metrics.inelasticEnergyRatio = energy([a, b]) / e;
  assert.ok(metrics.inelasticEnergyRatio < .6); assert.ok(Math.abs(momentum([a, b]).x - p.x) < .01);
});
test('free flight follows gravity with consistent normalized velocity', () => {
  const r = rig({ gravity: 1 }), ball = inertBall(r, 400, 100, { x: 8, y: -2 });
  steps(r.world, 120);
  const n = 120, halfStep = P.STEP / (1000 / 60), rawAcceleration = .001 * P.STEP ** 2;
  const expectedY = 100 + n * -2 * halfStep + rawAcceleration * n * (n + 1) / 2;
  const continuousY = 100 - 2 * 60 + .5 * 1000;
  metrics.gravity = { expectedY, actualY: ball.position.y, positionError: Math.abs(ball.position.y - expectedY),
    continuousY, continuousPositionError: Math.abs(ball.position.y - continuousY) };
  assert.ok(metrics.gravity.positionError < .01); assert.ok(Math.abs(ball.position.x - 880) < .01);
  assert.ok(metrics.gravity.continuousPositionError < 4.2, 'Bound the fixed-step integration error after one second');
});
test('air resistance dissipates energy monotonically in free flight', () => {
  const r = rig(), b = inertBall(r, 300, 200, { x: 4, y: 0 }); b.frictionAir = .01;
  let previous = energy([b]);
  for (let i = 0; i < 120; i++) { r.world.step(); const e = energy([b]); assert.ok(e <= previous + 1e-8); previous = e; }
  assert.ok(b.speed < 3);
});
test('an off-center impact transfers angular momentum into rotation', () => {
  const r = rig(), plank = r.add(piece(600, 300, 'stone', { width: 24, height: 120, friction: 0, restitution: .1 }));
  plank.game.kind = 'probe';
  const a = inertBall(r, 540, 265, { x: 8, y: 0 }, 5, .1);
  const p = momentum([a, plank]); steps(r.world, 30);
  assert.ok(Math.abs(plank.angle) > .03); assert.ok(Math.abs(plank.angularVelocity) > .002);
  assert.ok(Math.abs(momentum([a, plank]).x - p.x) < .05);
});
test('separating overlaps cannot cause damage or explode a pebble', () => {
  const r = rig(), block = r.add(piece(500, 300, 'stone')), ball = r.add(pebble(478, 300));
  M.Body.setVelocity(ball, { x: -12, y: 0 }); steps(r.world, 1);
  assert.equal(block.game.hp, block.game.maxHp); assert.equal(r.events.filter(e => e.type === 'explode').length, 0);
  assert.equal(r.events.filter(e => e.type === 'hit').length, 0);
});
test('incoming damage speed is consistent at 60, 120 and 240 Hz', () => {
  const speeds = [], damage = [];
  for (const hz of [60, 120, 240]) {
    const r = rig(), block = r.add(piece(500, 300, 'stone')), ball = r.add(pebble(461, 300));
    ball.game.kind = 'probe'; M.Body.setVelocity(ball, { x: 10, y: 0 });
    for (let tick = 0; tick < 30 && !r.events.some(e => e.type === 'hit'); tick++) M.Engine.update(r.world.engine, 1000 / hz);
    const hit = r.events.find(e => e.type === 'hit'); assert.ok(hit, `${hz} Hz contact`);
    speeds.push(hit.strength); damage.push(block.game.maxHp - block.game.hp);
  }
  assert.ok(Math.max(...speeds) - Math.min(...speeds) < .001);
  assert.ok(Math.max(...damage) - Math.min(...damage) < .01);
  metrics.contactRateConsistency = { ratesHz: [60, 120, 240], speeds, damage };
});
test('a harmless structure touch does not explode or damage it', () => {
  const r = rig(), block = r.add(piece(500, 300, 'wood')), ball = r.add(pebble(461, 300));
  M.Body.setVelocity(ball, { x: .6, y: 0 }); steps(r.world, 10);
  assert.equal(block.game.hp, block.game.maxHp); assert.equal(r.events.filter(e => e.type === 'explode').length, 0);
  assert.ok(r.world.bodies().includes(ball));
});
test('glancing fast motion with low normal impact does not explode', () => {
  const r = rig(), wall = r.add(piece(500, 300, 'stone', { isStatic: true, height: 400, kind: 'platform' })), ball = r.add(pebble(461, 250));
  M.Body.setVelocity(ball, { x: .5, y: 18 }); steps(r.world, 2);
  assert.ok(r.world.bodies().includes(ball)); assert.equal(r.world.explosions, 0); assert.ok(wall.isStatic);
});
test('a hard obstacle hit transfers momentum; the bomb waits for its fixed fuse', () => {
  const r = rig(), block = r.add(piece(500, 300, 'stone')), ball = r.add(pebble(454, 300));
  M.Body.setVelocity(ball, { x: 14, y: 0 }); steps(r.world, 20);
  assert.equal(r.world.explosions, 0); assert.ok(r.world.bodies().includes(ball)); assert.ok(block.position.x > 505);
  r.world.advanceRealTime(P.BOMB_FUSE - r.world.realTime);
  assert.equal(r.events.filter(e => e.type === 'explode').length, 1); assert.equal(r.world.explosions, 1);
  assert.equal(r.world.bodies().includes(ball), false);
  assert.ok(finite(r.world));
});
test('ground bounces remain intact even at high speed', () => {
  const r = rig({ gravity: 1 }), floor = r.add(M.Bodies.rectangle(600, 650, 1000, 100, { isStatic: true, restitution: .1 }));
  floor.game = { kind: 'ground' }; const ball = r.add(pebble(500, 540)); M.Body.setVelocity(ball, { x: 0, y: 14 });
  steps(r.world, 35); assert.equal(r.world.explosions, 0); assert.ok(r.world.bodies().includes(ball));
});
test('blast impulse is finite, local, and moves heavier bodies less', () => {
  const r = rig(), near = r.add(piece(570, 300, 'stone', { height: 20, width: 20 })), far = r.add(piece(900, 300, 'stone'));
  const heavy = r.add(piece(430, 300, 'stone', { height: 20, width: 20 })); M.Body.setMass(heavy, near.mass * 4);
  const ball = r.add(pebble(500, 300)); r.world.explode(ball, { x: 500, y: 300, strength: 14 });
  assert.ok(Math.abs(near.velocity.x) > Math.abs(heavy.velocity.x)); assert.equal(far.speed, 0);
  assert.ok(near.speed <= P.BLAST.maxVelocityDelta + 1e-6); assert.ok(finite(r.world));
});
test('maximum-power projectiles cannot tunnel through 20px obstacles', () => {
  for (const offset of [0, 2, 4, 6, 8]) {
    const r = rig(), wall = r.add(piece(500, 300, 'stone', { width: 20, height: 180, isStatic: true, kind: 'platform' }));
    const ball = r.add(pebble(430 + offset, 300)); M.Body.setVelocity(ball, { x: P.MAX_PULL * .235, y: 0 });
    steps(r.world, 15); assert.equal(r.world.explosions, 0); assert.ok(wall.isStatic);
    assert.ok(ball.position.x < 500 - 10 + 1, 'Ball stays on the incoming side of the thin wall');
  }
});
test('all five stacks remain stable for two minutes after waking', () => {
  let maxDrift = 0;
  for (let level = 0; level < 5; level++) {
    const w = new P.GameWorld(level), original = w.bodies().filter(b => !b.isStatic).map(b => ({ b, x: b.position.x, y: b.position.y, hp: b.game.hp }));
    w.hits = 1; original.forEach(p => M.Sleeping.set(p.b, false)); steps(w, 14400);
    original.forEach(p => { maxDrift = Math.max(maxDrift, Math.hypot(p.b.position.x - p.x, p.b.position.y - p.y)); assert.equal(p.b.game.hp, p.hp); });
    assert.equal(w.explosions, 0); assert.equal(w.hits, 1); assert.equal(w.state, 'ready'); assert.ok(finite(w));
  }
  metrics.twoMinuteStackDriftPx = maxDrift; assert.ok(maxDrift < .1);
});
// Replays and robustness checks below intentionally exercise full production gameplay.
test('all levels win with verified fixtures and modest aim perturbations', () => {
  const solutions = require('./solutions.json'); metrics.aimTolerance = [];
  for (let level = 0; level < 5; level++) {
    let wins = 0, total = 0;
    for (const dx of [-2, 0, 2]) for (const dy of [-2, 0, 2]) {
      const w = new P.GameWorld(level);
      for (const shot of solutions[level]) { if (w.state !== 'ready') break; fire(w, { ...shot, pull: [shot.pull[0] + dx, shot.pull[1] + dy] }); }
      total++; if (w.state === 'won') wins++; assert.ok(finite(w));
    }
    const w = new P.GameWorld(level); for (const pull of solutions[level]) { if (w.state === 'ready') fire(w, pull); }
    assert.equal(w.state, 'won', `Level ${level + 1} nominal fixture`);
    metrics.aimTolerance.push({ level: level + 1, wins, total, nominalShots: w.level.shots - w.shotsLeft });
    assert.ok(wins >= 5, `Level ${level + 1} only won ${wins}/9 perturbations`);
  }
});
test('100 seeded random multi-shot games stay finite and resolve every shot', () => {
  let seed = 0x5049434e; const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  let shots = 0, maxBodies = 0, maxStepMs = 0, explosions = 0; const timings = [];
  const start = performance.now();
  for (let run = 0; run < 100; run++) {
    const w = new P.GameWorld(run % 5);
    while (w.state === 'ready') {
      const angle = -.2 + random() * 1.2, power = 20 + random() * 76;
      w.launch(-Math.cos(angle) * power, Math.sin(angle) * power); shots++;
      let tick = 0;
      while (w.state === 'flying' && tick++ < 1700) {
        const t = performance.now(); w.step(); const ms = performance.now() - t;
        timings.push(ms); maxStepMs = Math.max(maxStepMs, ms);
        assert.ok(finite(w)); maxBodies = Math.max(maxBodies, w.bodies().length);
      }
      assert.notEqual(w.state, 'flying'); assert.ok(w.shotsLeft >= 0); assert.ok(w.targets().length <= w.initialTargets);
    }
    explosions += w.explosions;
  }
  timings.sort((a, b) => a - b);
  metrics.randomStress = { games: 100, shots, explosions, maxBodies, maxStepMs,
    p99StepMs: timings[Math.floor(timings.length * .99)], durationMs: performance.now() - start };
  assert.ok(maxBodies < 40); assert.ok(explosions > 0);
});
const report = process.env.PICNIC_AUDIT_REPORT || path.join(artifactDirectory(), 'physics-report.json');
fs.mkdirSync(path.dirname(report), { recursive: true });
fs.writeFileSync(report, JSON.stringify({ checksPassed: passed, metrics }, null, 2) + '\n');
console.log(`\n${passed} physicist-style sandbox checks passed. Metrics: ${report}`);
