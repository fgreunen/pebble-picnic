'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const P = require('../src/physics.js');
const M = require('../vendor/matter.min.js');
const routes = require('./quick-solutions.json');
let passed = 0;
function test(name, fn) { fn(); passed++; console.log(`PASS ${name}`); }
function ticks(w, count) { for (let i = 0; i < count; i++) w.step(); }
function fire(w, shot) { assert.equal(w.launch(...shot.pull, shot.type), true); ticks(w, Math.round(shot.wait / P.STEP)); }
function scene(w) {
  return { state: w.state, ammo: w.ammo, shots: w.shotsLeft, hits: w.hits, caught: w.fruitCaught, bubbles: w.bubbles,
    bodies: w.bodies().map(b => ({ id: b.id, position: b.position, previous: b.positionPrev, angle: b.angle,
      velocity: b.velocity, angularVelocity: b.angularVelocity, sleeping: b.isSleeping, game: b.game })) };
}
test('adventure physics layouts and finite inventories remain unchanged', () => {
  const data = P.levels.slice(0, 5).map(({ pieces, ammo }) => ({ pieces, ammo }));
  assert.equal(crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex'), '9fae3b22c8cc593b5f978bb9aba5fbcffdb449a3458af40841e8873381ac63b4');
  assert.equal(P.levels.length, 10);
  P.levels.slice(5).forEach(l => { assert.equal(l.quick, true); assert.ok(l.ammo.pebble >= 3); assert.equal(l.shots, l.ammo.pebble); });
});
test('prepared animal choices begin inside their covering geometry and optional bubbles are large', () => {
  for (const l of P.levels) {
    if (l.peekaboos) {
      assert.ok(l.peekaboos.length >= 2);
      for (const animal of l.peekaboos) {
        assert.ok(['duck', 'bunny'].includes(animal.animal)); assert.ok(animal.cover.length);
        assert.ok(animal.cover.some(i => {
          const p = l.pieces[i], a = p.angle || 0, dx = animal.x - p.x, dy = animal.y - p.y;
          return Math.abs(dx * Math.cos(a) + dy * Math.sin(a)) <= p.w / 2 &&
            Math.abs(-dx * Math.sin(a) + dy * Math.cos(a)) <= p.h / 2;
        }));
      }
    }
    (l.bubbles || []).forEach(b => { assert.ok(b.radius >= 32); });
  }
});
for (let index = 5; index < P.levels.length; index++) {
  test(`${P.levels[index].name}: ten seconds of awake stability without damage or collection`, () => {
    const w = new P.GameWorld(index), initial = w.bodies().filter(b => !b.isStatic).map(b => ({ b, x: b.position.x, y: b.position.y, hp: b.game.hp }));
    const targetCount = w.targets().length;
    w.hits = 1; initial.forEach(p => M.Sleeping.set(p.b, false)); ticks(w, 1200);
    const drift = Math.max(...initial.map(p => Math.hypot(p.b.position.x - p.x, p.b.position.y - p.y)));
    assert.ok(drift < 6, `Prepared awake setup drifted ${drift}px`);
    initial.forEach(p => assert.equal(p.b.game.hp, p.hp));
    assert.equal(w.hits, 1); assert.equal(w.targets().length, targetCount); assert.equal(w.state, 'ready');
    assert.equal(w.fruitCaught, 0);
    console.log(`  maximum awake settling: ${drift.toFixed(3)}px`);
  });
  test(`${P.levels[index].name}: finite ordinary route wins and Undo restores exact scene`, () => {
    const w = new P.GameWorld(index), saved = JSON.stringify(scene(w));
    fire(w, routes[index][0]); assert.equal(w.undo(), true);
    assert.equal(JSON.stringify(scene(w)), saved); assert.equal(w.undo(), false);
    routes[index].forEach(shot => fire(w, shot));
    assert.equal(w.state, 'won'); assert.equal(w.targets().length, 0);
    assert.equal(w.shotsLeft, w.level.shots - routes[index].length);
    assert.ok(w.bodies().every(b => [b.position.x, b.position.y, b.angle].every(Number.isFinite)));
  });
}
for (const index of [5, 6, 7]) {
  test(`${P.levels[index].name}: five forgiving one-shot ordinary aims`, () => {
    const shot = routes[index][0];
    for (const [dx, dy] of [[0, 0], [-3, 0], [3, 0], [0, -3], [0, 3]]) {
      const w = new P.GameWorld(index);
      const balls = w.bodies().filter(b => b.game.kind === 'fruit').map(b => ({ b, x: b.position.x, y: b.position.y }));
      fire(w, { ...shot, pull: [shot.pull[0] + dx, shot.pull[1] + dy] });
      assert.equal(w.state, 'won', `offset ${dx},${dy}`); assert.equal(w.launches, 1);
      assert.equal(w.shotsLeft, 2);
      if (index === 7) assert.ok(balls.some(p => Math.hypot(p.b.position.x - p.x, p.b.position.y - p.y) > 50), 'The beach ball pile visibly tumbles');
    }
  });
}
for (const index of [8, 9]) {
  test(`${P.levels[index].name}: real stopper shot releases fruit toward basket`, () => {
    const events = [], w = new P.GameWorld(index, e => events.push(e));
    const fruit = w.bodies().find(b => b.game.kind === 'fruit'), stopper = w.bodies().find(b => b.game.stopper);
    const x = fruit.position.x, stopX = stopper.position.x, hp = fruit.game.hp;
    assert.ok(fruit.circleRadius >= 32); assert.equal(fruit.isStatic, false); assert.equal(fruit.density, .0018);
    assert.equal(fruit.restitution, .25); assert.equal(fruit.friction, .035);
    ticks(w, 1200); assert.ok(Math.abs(fruit.position.x - x) < 1);
    fire(w, routes[index][0]);
    const travel = fruit.position.x - x;
    assert.ok(travel > 100, `fruit traveled ${travel}px`);
    assert.ok(!w.bodies().includes(stopper) || stopper.position.x - stopX > 28);
    assert.equal(fruit.game.hp, hp); assert.equal(w.fruitCaught, 1);
    assert.equal(events.filter(e => e.type === 'fruit').length, 1);
    ticks(w, 1200); assert.equal(events.filter(e => e.type === 'fruit').length, 1);
    console.log(`  stopper displaced ${(stopper.position.x - stopX).toFixed(1)}px; fruit rolled ${travel.toFixed(1)}px`);
  });
  test(`${P.levels[index].name}: removing only stopper lets gravity roll, while missing basket never blocks win`, () => {
    const w = new P.GameWorld(index), fruit = w.bodies().find(b => b.game.kind === 'fruit'), x = fruit.position.x;
    w.removeBody(w.bodies().find(b => b.game.stopper)); ticks(w, 1200);
    assert.ok(fruit.position.x - x > 100); assert.equal(w.state, 'ready');
    const miss = new P.GameWorld(index); fire(miss, { type: 'pebble', pull: [-40, -16], wait: 10000 });
    assert.equal(miss.state, 'won'); assert.equal(miss.fruitCaught, 0);
    miss.load(index); assert.equal(miss.fruitCaught, 0); assert.equal(miss.shotsLeft, 4);
    assert.ok(miss.bodies().some(b => b.game.stopper));
  });
}
console.log(`\n${passed} quick scene checks passed.`);
