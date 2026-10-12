// Isolated test rigs use the production simulator and vendored engine.
// No level files or global engine settings are modified.
'use strict';
const M = require('../vendor/matter.min.js');
const P = require('../src/physics.js');
function rig({ gravity = 0, sleeping = false } = {}) {
  const events = [], world = new P.GameWorld(0, e => events.push(e));
  M.Composite.clear(world.engine.world, false); M.Engine.clear(world.engine);
  world.engine.gravity.y = gravity; world.engine.enableSleeping = sleeping;
  world.state = 'flying'; world.shotsLeft = 2; world.hits = 1;
  // A distant sentinel keeps the gameplay loop active; never participates in collisions.
  const sentinel = M.Bodies.circle(1200, 100, 23, { isStatic: true });
  sentinel.game = { kind: 'target', material: 'target', hp: 1e9, maxHp: 1e9, lastHit: -1000 };
  M.Composite.add(world.engine.world, sentinel);
  return { world, events, add(body) { M.Composite.add(world.engine.world, body); return body; } };
}
function piece(x, y, material = 'wood', options = {}) {
  const m = P.materials[material], width = options.width || 40, height = options.height || 40;
  const body = M.Bodies.rectangle(x, y, width, height, { density: m.density, friction: m.friction,
    restitution: m.restitution, frictionAir: 0, ...options });
  body.game = { kind: options.kind || 'piece', material, hp: m.hp, maxHp: m.hp, width, height, lastHit: -1000 };
  return body;
}
function pebble(x, y, options = {}) {
  const body = M.Bodies.circle(x, y, 20, { density: .006, friction: .55, restitution: .36, frictionAir: 0, ...options });
  const type = options.projectileType || 'bomb';
  body.game = { kind: 'pebble', projectileType: type, launchedAt: 0, ...(type === 'bomb' ? { detonateAt: P.BOMB_FUSE } : { restElapsed: 0 }) }; return body;
}
function steps(world, count) { for (let i = 0; i < count; i++) world.step(); }
function fire(world, shot) {
  const pull = Array.isArray(shot) ? shot : shot.pull, type = Array.isArray(shot) ? world.selectedType : shot.type;
  if (!world.launch(...pull, type)) throw new Error(`Invalid launch ${pull}/${type} in ${world.state}`);
  let ticks = 0;
  // Recorded routes wait for the collapse but the production game offers reload sooner.
  const waitTicks = Math.round((shot.wait || 6000) / P.STEP);
  while (ticks < waitTicks || world.state === 'flying') { world.step(); if (++ticks > 1700) break; }
  if (world.state === 'flying') throw new Error('Unresolved shot');
  return ticks;
}
function finite(world) {
  return world.bodies().every(b => [b.position.x, b.position.y, b.angle, b.velocity.x, b.velocity.y, b.angularVelocity].every(Number.isFinite));
}
function momentum(bodies) { return bodies.reduce((p, b) => ({ x: p.x + b.mass * M.Body.getVelocity(b).x, y: p.y + b.mass * M.Body.getVelocity(b).y }), { x: 0, y: 0 }); }
function energy(bodies) { return bodies.reduce((s, b) => { const v = M.Body.getVelocity(b), w = M.Body.getAngularVelocity(b); return s + .5 * b.mass * (v.x ** 2 + v.y ** 2) + .5 * b.inertia * w ** 2; }, 0); }
module.exports = { M, P, rig, piece, pebble, steps, fire, finite, momentum, energy };
