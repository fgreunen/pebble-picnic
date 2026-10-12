(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../vendor/matter.min.js'), require('./levels.js'));
  else root.PicnicPhysics = factory(root.Matter, root.PicnicLevels);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Matter, levels) {
  'use strict';
  const { Engine, Bodies, Body, Composite, Events, Sleeping, Constraint } = Matter;
  const STEP = 1000 / 120, WIDTH = 1280, HEIGHT = 720, FLOOR = 600;
  const SLING = { x: 190, y: 458 }, MAX_PULL = 96, LAUNCH_SCALE = 0.235;
  const BLAST = Object.freeze({ threshold: 8, minEnergy: 24, radius: 175, impulse: 65, maxVelocityDelta: 10 });
  const BOMB_FUSE = 3000, REST_DELAY = 350, FIZZLE_TIME = 350;
  const LANDING_DAMAGE_SCALE = 1.15;
  const projectiles = Object.freeze({
    pebble: { name: 'Pebble', icon: '●', density: .006, radius: 20, restitution: .36, friction: .55, color: '#e6875e' },
    heavy: { name: 'Heavy', icon: '◆', density: .012, radius: 22, restitution: .16, friction: .65, color: '#758ca7' },
    bouncy: { name: 'Bouncy', icon: '◉', density: .0045, radius: 20, restitution: .82, friction: .08, color: '#ab79bf' },
    bomb: { name: 'Bomb', icon: '✹', density: .006, radius: 20, restitution: .3, friction: .55, color: '#455467' }
  });
  const materials = {
    // Speeds use Matter's normalized pixels per 1/60 second, consistently at every contact.
    wood: { density: 0.0021, hp: 26, threshold: 3.6, friction: 0.6, restitution: 0.12 },
    glass: { density: 0.0012, hp: 10, threshold: 2.6, friction: 0.5, restitution: 0.14 },
    stone: { density: 0.0048, hp: 90, threshold: 5.6, friction: 0.7, restitution: 0.08 },
    metal: { density: 0.0065, hp: 120, threshold: 6.2, friction: 0.7, restitution: 0.08 },
    target: { density: 0.0018, hp: 4, threshold: 2.6, friction: 0.75, restitution: 0.1 },
    fruit: { density: .0018, hp: 100, threshold: Infinity, friction: .035, restitution: .25 }
  };
  function clampPull(x, y) {
    // A backward pull always sends the pebble right; a tiny forward release cancels.
    x = Math.min(0, x); y = Math.max(-25, y);
    const length = Math.hypot(x, y);
    const factor = length > MAX_PULL ? MAX_PULL / length : 1;
    return { x: x * factor, y: y * factor };
  }
  function velocityForPull(x, y) {
    const p = clampPull(x, y);
    return { x: -p.x * LAUNCH_SCALE, y: -p.y * LAUNCH_SCALE };
  }
  const trajectoryProbes = new Map();
  function predictTrajectory(x, y, type = 'pebble', obstacles = []) {
    const pull = clampPull(x, y), spec = projectiles[type] || projectiles.pebble;
    const v = velocityForPull(pull.x, pull.y), half = STEP / (1000 / 60);
    let px = SLING.x + pull.x, py = SLING.y + pull.y, vx = v.x * half, vy = v.y * half;
    // A probe uses the projectile's actual polygon, including its rotation. It is
    // never added to the engine; flight uses the same Verlet step and air drag.
    if (!trajectoryProbes.has(type)) trajectoryProbes.set(type, Bodies.circle(px, py, spec.radius));
    const probe = trajectoryProbes.get(type), points = [{ x: px, y: py, tick: 0 }];
    Body.setPosition(probe, { x: px, y: py }); Body.setAngle(probe, 0);
    let angular = -.025 * half;
    for (let tick = 1; tick <= Math.floor(BOMB_FUSE / STEP); tick++) {
      vx *= 1 - .001 * half; vy = vy * (1 - .001 * half) + .001 * STEP ** 2;
      px += vx; py += vy; angular *= 1 - .001 * half;
      Body.setPosition(probe, { x: px, y: py }); Body.rotate(probe, angular);
      if (QueryCollides(probe, obstacles) || px > WIDTH + 20 || py > HEIGHT + 20) break;
      points.push({ x: px, y: py, tick });
    }
    return points;
  }
  function QueryCollides(probe, obstacles) { return Matter.Query.collides(probe, obstacles).length > 0; }
  class GameWorld {
    constructor(levelIndex = 0, onEvent = () => {}) {
      this.onEvent = onEvent;
      this.load(levelIndex);
    }
    load(index) {
      if (this.engine) { Events.off(this.engine); Composite.clear(this.engine.world, false); Engine.clear(this.engine); }
      this.levelIndex = Math.max(0, Math.min(levels.length - 1, index));
      this.level = levels[this.levelIndex];
      this.engine = Engine.create({ enableSleeping: true, positionIterations: 10, velocityIterations: 8, constraintIterations: 2 });
      this.engine.gravity.y = 1;
      this.state = 'ready'; this.shotsLeft = this.level.shots;
      this.ammo = { ...this.level.ammo || { pebble: this.level.shots } }; this.selectedType = Object.keys(this.ammo).find(t => this.ammo[t] > 0);
      this.elapsed = 0; this.realElapsed = 0; this.realTime = 0; this.quiet = 0; this.time = 0; this.activeProjectile = null; this.launches = 0; this.undoState = null;
      this.pending = new Set(); this.damageEnabled = false; this.hits = 0;
      this.blasts = new Map(); this.preImpact = new Map(); this.explosions = 0;
      this.bubbles = (this.level.bubbles || []).map(p => ({ ...p, popped: false }));
      this.fruitCaught = 0;
      const ground = Bodies.rectangle(640, FLOOR + 50, 1900, 100, { isStatic: true, friction: 0.8, restitution: 0.1, label: 'ground' });
      ground.game = { kind: 'ground' };
      Composite.add(this.engine.world, ground);
      const bodiesById = new Map();
      this.level.pieces.forEach((p, i) => {
        const kind = p.target ? 'target' : p.fruit ? 'fruit' : p.crate ? 'crate' : 'piece';
        const material = p.target ? 'target' : p.fruit ? 'fruit' : p.material || 'wood';
        const m = materials[material];
        const opts = { density: m.density, friction: m.friction, frictionStatic: 1, restitution: m.restitution,
          frictionAir: 0.002, sleepThreshold: 70, angle: p.angle || 0, label: kind };
        if (p.group) opts.collisionFilter = { group: p.group };
        const b = p.target || p.fruit ? Bodies.circle(p.x, p.y, p.fruit ? p.radius || 34 : 23, opts) : Bodies.rectangle(p.x, p.y, p.w, p.h, opts);
        b.game = { kind, material, hp: m.hp, maxHp: m.hp, width: p.w, height: p.h, seed: i, lastHit: -1000,
          ...(p.fruit ? { fruit: p.fruit, radius: p.radius || 34, caught: false } : {}), ...(p.stopper ? { stopper: true } : {}) };
        Composite.add(this.engine.world, b);
        if (p.id) bodiesById.set(p.id, b);
        // Matter rotates attachment vectors in place. Each run owns its copies;
        // never let a previous collapse change the hand-designed level data.
        if (p.pivot) {
          const support = p.pivot.support ? bodiesById.get(p.pivot.support) : null;
          const pointB = support ? { x: p.pivot.x - support.position.x, y: p.pivot.y - support.position.y } : { x: p.pivot.x, y: p.pivot.y };
          Composite.add(this.engine.world, Constraint.create({ bodyA: b, ...(support ? { bodyB: support } : {}), pointB, length: 0, stiffness: 1, damping: .15, render: { visible: false } }));
        }
        if (p.ropes) p.ropes.forEach(r => Composite.add(this.engine.world, Constraint.create({ bodyA: b, pointA: { ...r.local }, pointB: { ...r.anchor }, length: r.length, stiffness: .95, damping: .15 })));
      });
      this.bindEvents();
      // Warm the stack with damage disabled, then sleep it. All supports remain movable.
      for (let i = 0; i < 240; i++) Engine.update(this.engine, STEP);
      this.bodies().filter(b => !b.isStatic).forEach(b => Sleeping.set(b, true));
      this.initialTargets = this.targets().length;
      this.damageEnabled = true;
      return this;
    }
    bindEvents() {
      // collisionStart happens before resolution and collisionActive after it. Sample
      // normalized incoming velocities once, before the solver, for both event types.
      Events.on(this.engine, 'beforeSolve', () => {
        this.preImpact.clear();
        for (const b of this.bodies()) {
          const v = b.isStatic || b.isSleeping ? { x: 0, y: 0 } : Body.getVelocity(b);
          this.preImpact.set(b, { x: v.x, y: v.y, w: b.isStatic || b.isSleeping ? 0 : Body.getAngularVelocity(b),
            px: b.position.x, py: b.position.y });
        }
      });
      Events.on(this.engine, 'collisionStart collisionActive', e => this.collisions(e.pairs));
    }
    bodies() { return Composite.allBodies(this.engine.world); }
    targets() { return this.bodies().filter(b => b.game && b.game.kind === 'target' && !this.pending.has(b)); }
    emit(type, detail = {}) { this.onEvent({ type, ...detail }); }
    capture() {
      // Keep Matter's whole object graph, including contact warm-start impulses,
      // stable IDs and cross-references. Recreating bodies alone changes the next
      // collision when an earlier shot is still moving at this checkpoint.
      const copies = new Map();
      const copy = value => {
        if (value === null || typeof value !== 'object') return value;
        if (copies.has(value)) return copies.get(value);
        const result = Array.isArray(value) ? [] : {};
        copies.set(value, result);
        for (const key of Object.keys(value)) result[key] = copy(value[key]);
        return result;
      };
      const scalar = ['state', 'shotsLeft', 'selectedType', 'elapsed', 'realElapsed', 'realTime', 'quiet', 'time', 'launches', 'hits', 'explosions', 'initialTargets', 'damageEnabled', 'fruitCaught'];
      const state = Object.fromEntries(scalar.map(k => [k, this[k]]));
      state.ammo = { ...this.ammo }; state.engine = copy(this.engine);
      state.bubbles = copy(this.bubbles);
      state.active = copy(this.activeProjectile); state.pending = [...this.pending].map(copy);
      state.blasts = [...this.blasts].map(([b, origin]) => [copy(b), copy(origin)]);
      return state;
    }
    undo() {
      const state = this.undoState; if (!state) return false;
      this.undoState = null;
      Events.off(this.engine); Composite.clear(this.engine.world, false); Engine.clear(this.engine);
      this.engine = state.engine; Events.off(this.engine);
      for (const k of ['state', 'shotsLeft', 'selectedType', 'elapsed', 'realElapsed', 'realTime', 'quiet', 'time', 'launches', 'hits', 'explosions', 'initialTargets', 'damageEnabled', 'fruitCaught']) this[k] = state[k];
      this.ammo = { ...state.ammo };
      this.bubbles = state.bubbles;
      this.activeProjectile = state.active; this.pending = new Set(state.pending);
      this.blasts = new Map(state.blasts); this.preImpact = new Map();
      this.bindEvents(); this.emit('undo'); return true;
    }
    selectProjectile(type) {
      if (this.state !== 'ready' || !projectiles[type] || !(this.ammo[type] > 0)) return false;
      this.selectedType = type; return true;
    }
    launch(x, y, type = this.selectedType) {
      if (this.state !== 'ready' || this.shotsLeft <= 0) return false;
      if (!projectiles[type] || !(this.ammo[type] > 0)) return false;
      const pull = clampPull(x, y);
      if (Math.hypot(pull.x, pull.y) < 12 || pull.x > -8) return false;
      this.undoState = this.capture();
      const spec = projectiles[type];
      const pebble = Bodies.circle(SLING.x + pull.x, SLING.y + pull.y, spec.radius, {
        density: spec.density, restitution: spec.restitution, friction: spec.friction, frictionAir: 0.001, sleepThreshold: 55, label: type
      });
      pebble.game = { kind: 'pebble', projectileType: type, launchedAt: this.realTime,
        ...(type === 'bomb' ? { detonateAt: this.realTime + BOMB_FUSE } : { restElapsed: 0 }) };
      Composite.add(this.engine.world, pebble);
      Body.setVelocity(pebble, velocityForPull(pull.x, pull.y));
      Body.setAngularVelocity(pebble, -0.025);
      this.activeProjectile = pebble; this.shotsLeft--; this.ammo[type]--; this.selectedType = type;
      this.elapsed = 0; this.realElapsed = 0; this.quiet = 0; this.launches++;
      this.state = 'flying'; this.emit('launch', { projectileType: type });
      return true;
    }
    collisions(pairs) {
      if (!this.damageEnabled || this.state === 'ready' && this.launches === 0 && this.hits === 0) return;
      for (const pair of pairs) {
        const a = pair.bodyA, b = pair.bodyB;
        for (const ball of [a, b]) if (ball.game && ball.game.kind === 'pebble') {
          const other = ball === a ? b : a;
          if (other.game && ['piece', 'crate', 'target', 'fruit'].includes(other.game.kind)) ball.game.touchedStructure = true;
          if (other.game && other.game.kind === 'ground' && !ball.game.touchedStructure && !ball.game.groundGreeted) {
            ball.game.groundGreeted = true;
            this.emit('flower', { x: Math.max(240, Math.min(WIDTH - 35, ball.position.x)), y: FLOOR });
          }
        }
        const n = pair.collision.normal;
        let speed = 0, mass = 0, energy = 0;
        const points = pair.collision.supports.slice(0, pair.collision.supportCount || 1);
        for (const point of points) {
          const at = body => {
            const v = this.preImpact.get(body);
            if (!v) return { x: 0, y: 0, rx: 0, ry: 0 };
            const rx = point.x - v.px, ry = point.y - v.py;
            return { x: v.x - v.w * ry, y: v.y + v.w * rx, rx, ry };
          };
          const av = at(a), bv = at(b);
          // Matter's normal points from B to A: only negative relative normal
          // velocity is an incoming impact. Separating/bouncing apart is harmless.
          const closing = Math.max(0, -((av.x - bv.x) * n.x + (av.y - bv.y) * n.y));
          const inverse = a.inverseMass + b.inverseMass +
            (av.rx * n.y - av.ry * n.x) ** 2 * a.inverseInertia +
            (bv.rx * n.y - bv.ry * n.x) ** 2 * b.inverseInertia;
          const effectiveMass = inverse > 0 ? 1 / inverse : 0;
          const impactEnergy = .5 * effectiveMass * closing ** 2;
          if (impactEnergy > energy) { speed = closing; mass = effectiveMass; energy = impactEnergy; }
        }
        for (const body of [a, b]) {
          if (body.game && ['piece', 'crate'].includes(body.game.kind) && speed > 1.5 && this.realTime >= (body.game.reactionUntil || 0)) {
            body.game.reactionUntil = this.realTime + 650;
            this.emit('reaction', { x: body.position.x, y: body.position.y, seed: body.game.seed, strength: speed });
          }
          if (body.game && body.game.kind === 'crate' && !body.game.exploded && speed >= BLAST.threshold && energy >= BLAST.minEnergy) this.queueCrate(body);
        }
        for (const body of [a, b]) {
          const data = body.game;
          if (!data || body.isStatic || !['piece', 'target'].includes(data.kind) || this.pending.has(body)) continue;
          const m = materials[data.material];
          if (speed <= m.threshold || this.time - data.lastHit < 150) continue;
          const incoming = this.preImpact.get(body), other = body === a ? b : a;
          const outwardY = body === a ? n.y : -n.y;
          // Only the downward-moving object landing on a surface gets a modest
          // bonus. Side hits, upward contacts and harmless settling keep the old rule.
          const landing = outwardY < -.55 && incoming && incoming.y > m.threshold && other.game && other.game.kind !== 'pebble';
          const damage = (speed - m.threshold) ** 2 * mass * 0.18 * (landing ? LANDING_DAMAGE_SCALE : 1);
          if (damage < 0.5) continue;
          data.hp -= damage; data.lastHit = this.time; this.hits++;
          this.emit('hit', { x: body.position.x, y: body.position.y, strength: speed, material: data.material, damage, landing: !!landing });
          if (data.hp <= 0) this.pending.add(body);
        }
      }
    }
    queueCrate(body) {
      if (body.game.exploded) return;
      body.game.exploded = true;
      this.blasts.set(body, { x: body.position.x, y: body.position.y, strength: 12, crate: true });
    }
    removeBody(body) {
      for (const c of Composite.allConstraints(this.engine.world)) if (c.bodyA === body || c.bodyB === body) Composite.remove(this.engine.world, c);
      Composite.remove(this.engine.world, body);
      // Removing a support produces no impulse to wake sleeping roofs above it.
      // Traverse touching bounds through the whole connected structure. Static
      // ground is excluded, so unrelated towers need not wake. This is only a
      // conservative wake-up pass; Matter still calculates every force/contact.
      const bodies = this.bodies().filter(b => !b.isStatic), queue = [body], visited = new Set(queue);
      while (queue.length) {
        const bounds = queue.pop().bounds;
        for (const other of bodies) if (!visited.has(other) && other.bounds.max.x >= bounds.min.x - 5 && other.bounds.min.x <= bounds.max.x + 5 &&
          other.bounds.max.y >= bounds.min.y - 5 && other.bounds.min.y <= bounds.max.y + 5) {
          visited.add(other); Sleeping.set(other, false); queue.push(other);
        }
      }
    }
    explode(ball, origin) {
      // Timed bombs and impact crates add finite radial impulse. Heavier objects
      // receive less velocity; contact resolution still transfers ordinary momentum.
      this.removeBody(ball); this.explosions++;
      for (const b of this.bodies()) {
        if (b.isStatic || b === ball || this.pending.has(b)) continue;
        const dx = b.position.x - origin.x, dy = b.position.y - origin.y, distance = Math.hypot(dx, dy);
        if (distance >= BLAST.radius) continue;
        const falloff = 1 - distance / BLAST.radius;
        const dv = Math.min(BLAST.maxVelocityDelta, BLAST.impulse * falloff * b.inverseMass);
        const nx = distance > .001 ? dx / distance : 0, ny = distance > .001 ? dy / distance : -1;
        const v = Body.getVelocity(b);
        Sleeping.set(b, false);
        Body.setVelocity(b, { x: v.x + nx * dv, y: v.y + ny * dv });
        const d = b.game;
        if (d && d.kind === 'crate' && dv >= 3.5) this.queueCrate(b);
        if (!d || !['piece', 'target'].includes(d.kind)) continue;
        const threshold = materials[d.material].threshold;
        const damage = Math.max(0, .5 * b.mass * (dv ** 2 - threshold ** 2) * .36);
        if (damage < .5) continue;
        d.hp -= damage; d.lastHit = this.time; this.hits++;
        if (d.hp <= 0) this.pending.add(b);
      }
      this.emit('explode', { ...origin, radius: BLAST.radius });
    }
    destroy(body) {
      const data = body.game;
      this.removeBody(body);
      this.emit(data.kind === 'target' ? 'collect' : 'break', { x: body.position.x, y: body.position.y, material: data.material });
    }
    moving() { return this.bodies().some(b => !b.isStatic && !b.isSleeping && (Body.getSpeed(b) > .65 || Math.abs(Body.getAngularVelocity(b)) > .055)); }
    pendingBombs() { return this.bodies().some(b => b.game.projectileType === 'bomb' && !b.game.exploded && Number.isFinite(b.game.detonateAt)); }
    flushChanges() {
      // New chain entries are visited; each crate is queued at most once.
      for (const [ball, origin] of this.blasts) this.explode(ball, origin);
      this.blasts.clear();
      for (const body of this.pending) if (this.bodies().includes(body)) this.destroy(body);
      this.pending.clear();
    }
    checkWin() {
      if (this.state !== 'won' && this.state !== 'lost' && this.targets().length === 0) { this.state = 'won'; this.emit('win'); return true; }
      return this.state === 'won';
    }
    checkExtras() {
      if (!this.launches) return;
      const bodies = this.bodies().filter(b => !b.isStatic);
      for (const bubble of this.bubbles || []) {
        if (bubble.popped) continue;
        // Pure overlap query: optional bubbles add no bodies, contacts or forces.
        const touching = bodies.some(b => {
          if (bubble.x + bubble.radius < b.bounds.min.x || bubble.x - bubble.radius > b.bounds.max.x || bubble.y + bubble.radius < b.bounds.min.y || bubble.y - bubble.radius > b.bounds.max.y) return false;
          if (Matter.Vertices.contains(b.vertices, bubble)) return true;
          return b.vertices.some((v, i) => {
            const end = b.vertices[(i + 1) % b.vertices.length], dx = end.x - v.x, dy = end.y - v.y;
            const t = Math.max(0, Math.min(1, ((bubble.x - v.x) * dx + (bubble.y - v.y) * dy) / (dx * dx + dy * dy || 1)));
            return Math.hypot(v.x + dx * t - bubble.x, v.y + dy * t - bubble.y) <= bubble.radius;
          });
        });
        if (touching) { bubble.popped = true; this.emit('pop', { x: bubble.x, y: bubble.y }); }
      }
      const basket = this.level.basket;
      if (basket) for (const b of bodies) if (b.game.kind === 'fruit' && !b.game.caught &&
        Math.abs(b.position.x - basket.x) <= basket.w / 2 && Math.abs(b.position.y - basket.y) <= basket.h / 2) {
        b.game.caught = true; this.fruitCaught++; this.emit('fruit', { x: b.position.x, y: b.position.y, fruit: b.game.fruit });
      }
    }
    advanceRealTime(ms) {
      if (!(ms >= 0 && Number.isFinite(ms))) return;
      this.realTime += ms;
      for (const b of this.bodies()) {
        const d = b.game;
        if (d.kind !== 'pebble') continue;
        if (d.projectileType === 'bomb') {
          if (!d.exploded && this.realTime + 1e-6 >= d.detonateAt) {
            d.exploded = true; this.blasts.set(b, { x: b.position.x, y: b.position.y, strength: 12 });
          }
        } else {
          const resting = b.isSleeping || (Body.getSpeed(b) < .3 && Math.abs(Body.getAngularVelocity(b)) < .035);
          d.restElapsed = resting ? (d.restElapsed || 0) + ms : 0;
          if (!resting) delete d.fizzleAt;
          if (resting && d.restElapsed >= REST_DELAY && d.fizzleAt === undefined) {
            d.fizzleAt = this.realTime; this.emit('fizzle', { x: b.position.x, y: b.position.y });
          }
          if (d.fizzleAt !== undefined && this.realTime - d.fizzleAt + 1e-6 >= FIZZLE_TIME) this.removeBody(b);
        }
      }
      this.flushChanges(); this.checkWin();
      if (this.state !== 'flying') return;
      this.realElapsed += ms;
      if (this.shotsLeft > 0 && this.realElapsed >= 2000) this.resolve();
      else if (this.shotsLeft === 0 && this.realElapsed >= 14000 && !this.pendingBombs()) this.resolve();
    }
    step(realMs = STEP) {
      this.time += STEP;
      Engine.update(this.engine, STEP);
      this.checkExtras();
      this.flushChanges();
      for (const b of this.bodies()) {
        if (b.isStatic) continue;
        // A pod knocked off the visible picnic has been collected; never ask a child
        // to hit an invisible target behind the sling or beyond the right edge.
        if (b.game.kind === 'target' && (b.position.x < SLING.x + 25 || b.position.x > WIDTH - 23)) {
          this.destroy(b); continue;
        }
        if (b.position.x < -180 || b.position.x > WIDTH + 220 || b.position.y > HEIGHT + 120) {
          if (b.game.kind === 'target') this.destroy(b);
          else if (b.game.projectileType !== 'bomb') this.removeBody(b);
        }
      }
      this.checkWin();
      if (this.state === 'flying') {
        this.elapsed += STEP;
        const moving = this.moving();
        this.quiet = moving ? 0 : this.quiet + STEP;
        const gone = !this.bodies().includes(this.activeProjectile), ball = this.activeProjectile;
        const slow = gone || ball.isSleeping || (Body.getSpeed(ball) < .6 && Math.abs(Body.getAngularVelocity(ball)) < .08);
        if (this.shotsLeft > 0 && (gone || this.elapsed > 120 && slow)) this.resolve();
        else if (this.shotsLeft === 0 && !this.pendingBombs() && ((this.elapsed > 1000 && this.quiet > 650) || (gone && !moving))) this.resolve();
      }
      this.advanceRealTime(realMs);
    }
    resolve() {
      if (this.state !== 'flying') return;
      if (this.shotsLeft === 0 && this.pendingBombs()) return;
      this.activeProjectile = null;
      if (this.targets().length === 0) { this.state = 'won'; this.emit('win'); }
      else if (this.shotsLeft <= 0) { this.state = 'lost'; this.emit('lose'); }
      else { this.state = 'ready'; if (!this.ammo[this.selectedType]) this.selectedType = Object.keys(this.ammo).find(t => this.ammo[t] > 0); this.emit('ready'); }
    }
    snapshot() {
      return { level: this.levelIndex, state: this.state, shotsLeft: this.shotsLeft, targets: this.targets().length,
        hits: this.hits, explosions: this.explosions, elapsed: this.elapsed, realElapsed: this.realElapsed,
        realTime: this.realTime, ammo: { ...this.ammo }, selectedType: this.selectedType, launches: this.launches, bodies: this.bodies().length, canUndo: !!this.undoState,
        bubbles: (this.bubbles || []).map(b => ({ ...b })), fruitCaught: this.fruitCaught,
        bombs: this.bodies().filter(b => b.game.projectileType === 'bomb').map(b => Math.max(0, b.game.detonateAt - this.realTime)) };
    }
  }
  return { GameWorld, levels, materials, projectiles, clampPull, velocityForPull, predictTrajectory, STEP, WIDTH, HEIGHT, FLOOR, SLING, MAX_PULL, BLAST, BOMB_FUSE, REST_DELAY, FIZZLE_TIME, LANDING_DAMAGE_SCALE };
});
