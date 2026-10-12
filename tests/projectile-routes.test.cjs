'use strict';
// Production-world routes; pulls are pixels from sling (190,458), waits are simulated ms.
// These also provide repeatable mouse/Easy Mode playtest instructions.
const assert = require('node:assert/strict');
const { P, M, fire, steps, finite } = require('../tools/physics-sandbox.cjs');
const shot = (type, x, y) => ({ type, pull: [x, y], wait: 6000 });
const routes = {
  shelterBounce: [shot('bouncy', -64, -16), shot('pebble', -40, 72), shot('heavy', -88, 16), shot('pebble', -40, 48), shot('pebble', -88, 24)],
  shelterDirect: [shot('pebble', -40, 72), shot('pebble', -96, -24), shot('pebble', -40, 48)],
  counterweight: [shot('heavy', -96, 24), shot('heavy', -96, 8)],
  counterweightAlternative: require('./solutions.json')[2],
  bombPocket: [shot('bomb', -96, 24), shot('heavy', -32, 72), shot('pebble', -96, -24)],
  bridgeWithoutBomb: [shot('heavy', -80, 32), shot('heavy', -88, 8), shot('pebble', -32, 64)]
};
function run(level, sequence) {
  const w = new P.GameWorld(level);
  for (const s of sequence) if (w.state === 'ready') fire(w, s);
  assert.ok(finite(w)); assert.equal(w.state, 'won'); assert.equal(w.targets().length, 0);
  assert.ok(w.shotsLeft >= 0); for (const n of Object.values(w.ammo)) assert.ok(n >= 0);
  return w;
}
function main() {
  let passed = 0;
  const test = (name, fn) => { fn(); passed++; console.log(`PASS ${name}`); };
  test('ordinary pebbles clear the first level and the shelter without scarce balls', () => {
    run(0, require('./solutions.json')[0]);
    const ordinary = new P.GameWorld(1), bouncy = new P.GameWorld(1);
    fire(ordinary, shot('pebble', -96, -24)); fire(bouncy, shot('bouncy', -96, -24));
    assert.equal(ordinary.targets().some(b => b.game.seed === 3), false);
    assert.equal(bouncy.targets().some(b => b.game.seed === 3), true, 'Excess rebound is less useful for this direct doorway shot');
    run(1, routes.shelterDirect);
  });
  test('a ground rebound reaches the shelter target; the same ordinary pull stays too low', () => {
    const w = new P.GameWorld(1); w.launch(-64, -16, 'bouncy'); const ball = w.activeProjectile;
    let groundContact = false, reboundTarget = false;
    M.Events.on(w.engine, 'collisionStart', ({ pairs }) => {
      for (const pair of pairs) {
        if (pair.bodyA !== ball && pair.bodyB !== ball) continue;
        const other = pair.bodyA === ball ? pair.bodyB : pair.bodyA;
        if (other.game.kind === 'ground') groundContact = true;
        if (groundContact && other.game.seed === 3) reboundTarget = true;
      }
    });
    steps(w, 720); assert.ok(reboundTarget); assert.equal(w.targets().some(b => b.game.seed === 3), false);
    const ordinary = new P.GameWorld(1); fire(ordinary, shot('pebble', -64, -16));
    assert.ok(ordinary.targets().some(b => b.game.seed === 3));
    for (const dx of [-2, 0, 2]) for (const dy of [-2, 0, 2]) {
      const tolerant = new P.GameWorld(1); fire(tolerant, shot('bouncy', -64 + dx, -16 + dy));
      assert.equal(tolerant.targets().some(b => b.game.seed === 3), false, 'Rebound doorway tolerates small aim adjustments');
    }
    run(1, routes.shelterBounce);
  });
  test('heavy momentum tips the stone counterweights much farther than the same ordinary shot', () => {
    const outcomes = ['heavy', 'pebble'].map(type => {
      const w = new P.GameWorld(2), weights = w.bodies().filter(b => b.game.material === 'stone' && !b.isStatic);
      const starts = weights.map(b => b.position.y); let drop = 0, directContact = false;
      w.launch(-96, 24, type); const ball = w.activeProjectile;
      M.Events.on(w.engine, 'collisionStart', ({pairs}) => { if (pairs.some(p => p.bodyA === ball && weights.includes(p.bodyB) || p.bodyB === ball && weights.includes(p.bodyA))) directContact = true; });
      for (let i = 0; i < 720; i++) { w.step(); weights.forEach((b, j) => { drop = Math.max(drop, b.position.y - starts[j]); }); }
      return { drop, directContact, left: w.targets().length };
    });
    assert.ok(outcomes[0].directContact); assert.ok(outcomes[0].drop > 60); assert.ok(outcomes[1].drop < 10);
    assert.ok(outcomes[0].left < outcomes[1].left);
    run(2, routes.counterweight); run(2, routes.counterweightAlternative);
  });
  test('a bomb rolls into the pocket, waits at rest, then bursts once at its launch fuse', () => {
    const events = [], w = new P.GameWorld(3, e => events.push({ ...e, at: w.realTime }));
    w.launch(-96, 24, 'bomb'); const ball = w.activeProjectile; let rolling = false;
    for (let i = 0; i < 359; i++) {
      w.step();
      if (ball.position.x > 900 && ball.position.y > 560 && ball.velocity.x > .5) rolling = true;
    }
    assert.ok(rolling); assert.ok(w.bodies().includes(ball)); assert.ok(ball.position.x > 950 && ball.position.x < 1000);
    assert.ok(ball.position.y > 570); assert.ok(ball.speed < .1);
    const earlierBursts = w.explosions; w.step();
    assert.equal(w.explosions, earlierBursts + 1); assert.equal(w.bodies().includes(ball), false);
    const burst = events.filter(e => e.type === 'explode').at(-1);
    assert.ok(Math.abs(burst.at - P.BOMB_FUSE) < .01); steps(w, 360);
    const ordinary = new P.GameWorld(3); fire(ordinary, shot('pebble', -96, 24));
    assert.ok(w.targets().length + 2 <= ordinary.targets().length);
    run(3, routes.bombPocket);
  });
  test('the bridge remains winnable without using its bomb', () => {
    const w = run(3, routes.bridgeWithoutBomb); assert.equal(w.ammo.bomb, 1);
  });
  console.log(`\n${passed} projectile route checks passed.`);
}
if (require.main === module) main();
module.exports = { routes };
