'use strict';
const assert = require('node:assert/strict');
const P = require('../src/physics.js'), M = require('../vendor/matter.min.js');
const { createHost } = require('./ui-host.cjs');
const { steps, fire } = require('../tools/physics-sandbox.cjs');
let passed = 0;
function test(name, fn) { fn(); passed++; console.log(`PASS ${name}`); }
const diagnostics = h => h.window.picnic.diagnostics();
const face = (h, value) => h.get('face-picker').onclick({ target: { closest: () => ({ dataset: { face: value } }) } });
const pose = w => w.bodies().map(b => ({ kind: b.game.kind, position: b.position, velocity: b.velocity, angle: b.angle, hp: b.game.hp }));

test('a real gentle block strike reacts without changing health or ammo beyond the launch', () => {
  const events = [], w = new P.GameWorld(0, e => events.push(e));
  assert.ok(w.launch(-16, 8));
  const piece = w.bodies().find(b => b.game.kind === 'piece');
  M.Body.setPosition(w.activeProjectile, { x: piece.position.x - 31, y: piece.position.y });
  M.Body.setVelocity(w.activeProjectile, { x: 2, y: 0 });
  M.Body.setAngularVelocity(w.activeProjectile, 0); steps(w, 8);
  assert.ok(events.some(e => e.type === 'reaction')); assert.ok(piece.game.reactionUntil > w.realTime);
  assert.equal(piece.game.hp, piece.game.maxHp); assert.equal(w.shotsLeft, 2);
  w.undo(); assert.equal(w.bodies().some(b => b.game.reactionUntil), false);
});
test('a ground miss flowers once; a shot touching a structure does not flower', () => {
  for (const touched of [false, true]) {
    const events = [], w = new P.GameWorld(0, e => events.push(e)); w.launch(-16, 0);
    const b = w.activeProjectile; b.game.touchedStructure = touched;
    M.Body.setPosition(b, { x: 400, y: 575 }); M.Body.setVelocity(b, { x: 0, y: 4 });
    steps(w, 180); assert.equal(events.filter(e => e.type === 'flower').length, touched ? 0 : 1);
  }
});
test('flower presentation pauses, rolls back on Undo and resets on retry', () => {
  const h = createHost(); h.grab(); h.release(-16, 0); h.frames(1.5);
  assert.equal(diagnostics(h).flowers.length, 1);
  const before = h.state().realTime; h.get('levels-button').click(); h.frames(2);
  assert.equal(h.state().realTime, before); assert.equal(diagnostics(h).flowers.length, 1);
  h.get('close-levels').click(); h.get('undo-button').click(); assert.equal(diagnostics(h).flowers.length, 0);
  h.grab(); h.release(-16, 0); h.frames(1.5); h.get('restart-button').click();
  assert.equal(diagnostics(h).flowers.length, 0);
});
test('noncolliding bubbles pop once on a projectile touch and restore with Undo/retry', () => {
  const events = [], w = new P.GameWorld(0, e => events.push(e));
  const count = w.bodies().length, bubble = w.bubbles[0];
  w.launch(-16, 8); M.Body.setPosition(w.activeProjectile, { x: bubble.x, y: bubble.y });
  M.Body.setVelocity(w.activeProjectile, { x: 0, y: 0 }); steps(w, 4);
  assert.equal(w.bubbles[0].popped, true); assert.equal(events.filter(e => e.type === 'pop').length, 1);
  assert.equal(w.targets().length, 2); assert.equal(w.bodies().length, count + 1); assert.equal(w.shotsLeft, 2);
  w.undo(); assert.equal(w.bubbles[0].popped, false); assert.equal(w.bodies().length, count);
  w.load(0); assert.equal(w.bubbles[0].popped, false);
});
test('a falling piece can pop a bubble without any change to its simulated motion', () => {
  const a = new P.GameWorld(0), b = new P.GameWorld(0);
  a.launch(-16, 8); b.launch(-16, 8);
  const block = a.bodies().find(p => p.game.kind === 'piece');
  a.bubbles = [{ x: block.position.x, y: block.position.y, radius: 38, popped: false }]; b.bubbles = [];
  steps(a, 240); steps(b, 240);
  assert.equal(a.bubbles[0].popped, true); assert.deepEqual(pose(a), pose(b));
  assert.equal(a.hits, b.hits); assert.equal(a.shotsLeft, b.shotsLeft);
});
test('leaving optional bubbles unpopped still permits a normal adventure win', () => {
  const w = new P.GameWorld(0); w.bubbles = [{ x: 1200, y: 100, radius: 38, popped: false }];
  fire(w, require('./solutions.json')[0][0]); assert.equal(w.state, 'won'); assert.equal(w.bubbles[0].popped, false);
});
test('large bubbles reward five forgiving real ordinary aims in adventure and quick scenes', () => {
  for (const [level, pull] of [[0, [-48, 56]], [5, [-56, 48]], [6, [-40, 48]], [7, [-56, 48]]]) {
    for (const [dx, dy] of [[0, 0], [-3, 0], [3, 0], [0, -3], [0, 3]]) {
      const w = new P.GameWorld(level); fire(w, { type: 'pebble', pull: [pull[0] + dx, pull[1] + dy], wait: 10000 });
      assert.equal(w.bubbles[0].popped, true, `level ${level}, offset ${dx},${dy}`);
      assert.equal(w.launches, 1); assert.equal(w.shotsLeft, 2);
    }
  }
});
test('immediately shattered blocks keep a short bounded face and Undo clears it', () => {
  const h = createHost(); h.grab(); h.release(-16, 0);
  const block = h.world.bodies().find(b => b.game.kind === 'piece');
  h.world.emit('reaction', { x: block.position.x, y: block.position.y, seed: block.game.seed }); h.world.destroy(block);
  h.frames(.1); assert.equal(diagnostics(h).reactions, 1);
  h.get('levels-button').click(); h.frames(1); assert.equal(diagnostics(h).reactions, 1);
  h.get('close-levels').click(); h.get('undo-button').click(); assert.equal(diagnostics(h).reactions, 0);
});
test('peekaboo starts hidden, greets once after a real cover shot and Undo restores placement', () => {
  const h = createHost(); h.chooseLevel(5); const before = JSON.stringify(diagnostics(h).animals);
  assert.equal(diagnostics(h).animals[0].revealed, false);
  h.grab(); h.release(-40, 8); h.frames(3);
  assert.equal(diagnostics(h).animals[0].revealed, true);
  const sounds = diagnostics(h).effectSounds; h.frames(2); assert.equal(diagnostics(h).effectSounds, sounds);
  h.get('undo-button').click(); assert.equal(JSON.stringify(diagnostics(h).animals), before);
  h.get('again-button').click(); assert.equal(diagnostics(h).animals[0].revealed, false);
  assert.notEqual(JSON.stringify(diagnostics(h).animals), before, 'Replay chooses the next prepared place');
});
test('cosmetic picker cancels mouse aim without consuming ammo or advancing a shared turn', () => {
  const h = createHost(); h.get('mode-button').click(); h.grab(); h.move(-80, 16); face(h, 'bow');
  h.release(-80, 16); assert.equal(h.state().launches, 0); assert.equal(h.state().shotsLeft, 3);
  assert.equal(diagnostics(h).turn, 1); assert.equal(h.window.picnic.getPull().dragging, false);
  h.grab(); h.release(-16, 0); assert.equal(h.world.activeProjectile.game.cosmetic, 'bow');
  face(h, 'cap'); assert.equal(h.world.activeProjectile.game.cosmetic, 'bow');
  h.get('undo-button').click(); assert.equal(diagnostics(h).cosmetic, 'cap'); assert.equal(h.state().shotsLeft, 3);
  h.get('restart-button').click(); assert.equal(diagnostics(h).cosmetic, 'cap');
  assert.equal(diagnostics(createHost({ storage: h.storage })).cosmetic, 'cap');
});
test('cosmetics do not change flight, fuse timers, selected type or finite inventory', () => {
  const a = createHost(), b = createHost(); a.chooseLevel(3); b.chooseLevel(3);
  a.chooseType('bomb'); b.chooseType('bomb'); face(a, 'cap'); face(b, 'wink');
  a.grab(); b.grab(); a.release(-80, 16); b.release(-80, 16); a.frames(2); b.frames(2);
  assert.deepEqual(pose(a.world), pose(b.world)); assert.deepEqual(a.state(), b.state());
  assert.equal(a.state().bombs.length, 1); assert.ok(a.state().bombs[0] > 0);
});
test('Quick play and Adventure tabs preserve all levels and Again is one action', () => {
  const h = createHost(); h.get('levels-button').click();
  assert.ok(h.get('level-grid').innerHTML.includes('Snowy grand picnic')); assert.ok(!h.get('level-grid').innerHTML.includes('Tall tumble'));
  h.get('quick-tab').click(); assert.ok(h.get('level-grid').innerHTML.includes('Tall tumble'));
  assert.ok(h.get('level-grid').innerHTML.includes('Rainbow fruit roll'));
  h.chooseLevel(5); assert.equal(h.get('again-button').hidden, false);
  h.grab(); h.release(-40, 8); h.frames(6); assert.equal(h.state().state, 'won');
  assert.equal(h.get('retry-button').textContent, '↻ Again!'); h.get('retry-button').click();
  assert.equal(h.state().level, 5); assert.equal(h.state().shotsLeft, 3); assert.equal(h.state().canUndo, false);
  h.chooseLevel(4); assert.equal(h.get('again-button').hidden, true);
  h.get('next-button').click(); assert.equal(h.get('level-picker').hidden, false); assert.equal(h.state().level, 4);
});
test('quick scenes share the Easy launch path and Undo restores shared turns', () => {
  const h = createHost(); h.chooseLevel(5); h.get('mode-button').click(); h.get('easy-button').click();
  h.window.emit('keydown', { key: ' ', code: 'Space' }); assert.equal(h.state().launches, 1);
  assert.equal(diagnostics(h).turn, 2); h.frames(2.5); h.window.emit('keydown', { key: ' ', repeat: true });
  assert.equal(h.state().launches, 1); h.get('undo-button').click(); assert.equal(diagnostics(h).turn, 1);
  assert.equal(h.state().shotsLeft, 3); assert.equal(h.window.picnic.getAim().easy, true);
});
test('mute, reduced motion and map pause cover new feedback and fruit state', () => {
  const h = createHost({ recordDrawing: true }); h.get('mute-button').click(); h.get('motion-button').click(); h.chooseLevel(8);
  h.grab(); h.release(-80, 16); h.frames(4);
  assert.equal(diagnostics(h).effectSounds, 0); assert.equal(diagnostics(h).slowMotion, false);
  assert.ok(h.drawCalls.some(c => c[0] === 'fillText' && c[1] === '↗'));
  const saved = JSON.stringify(pose(h.world)); const clock = h.state().realTime;
  h.get('levels-button').click(); h.frames(4); assert.equal(JSON.stringify(pose(h.world)), saved); assert.equal(h.state().realTime, clock);
  h.get('close-levels').click(); h.get('undo-button').click(); assert.equal(h.state().fruitCaught, 0);
  assert.equal(h.state().shotsLeft, 4); assert.equal(h.world.bodies().some(b => b.game.stopper), true);
});
test('reaction sound overlap is bounded and discarded feedback stops on Undo and reset', () => {
  const h = createHost(); h.grab(); h.release(-16, 0);
  for (let i = 0; i < 100; i++) h.world.emit('pop', { x: 700, y: 300 });
  assert.ok(diagnostics(h).effectSounds <= 24); assert.ok(diagnostics(h).particles <= 260);
  h.get('undo-button').click(); assert.equal(diagnostics(h).effectSounds, 0);
  h.grab(); h.release(-16, 0); h.get('restart-button').click(); assert.equal(diagnostics(h).effectSounds, 0);
});
test('blocked local storage still permits cosmetic choice and quick replay', () => {
  const h = createHost({ storageBlocked: true }); face(h, 'wink'); h.chooseLevel(9); h.get('again-button').click();
  assert.equal(diagnostics(h).cosmetic, 'wink'); assert.equal(h.state().shotsLeft, 4);
});
console.log(`\n${passed} toddler play checks passed.`);
