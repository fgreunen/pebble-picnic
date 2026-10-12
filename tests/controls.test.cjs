// Integration tests of the production input/UI handlers in a minimal DOM host.
// Complements actual browser playtests; does not claim to test browser rendering.
'use strict';
const vm = require('node:vm'), fs = require('node:fs'), assert = require('node:assert/strict');
const P = require('../src/physics.js'), M = require('../vendor/matter.min.js');
class Node {
  constructor(id = '') { this.id = id; this.hidden = true; this.style = {}; this.listeners = {}; this.attrs = {}; this.children = {}; this.captured = new Set(); }
  addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }
  emit(name, data = {}) { const e = { button: 0, pointerId: 1, preventDefault() {}, ...data }; (this.listeners[name] || []).forEach(fn => fn(e)); }
  setAttribute(k, v) { this.attrs[k] = v; }
  querySelector(name) { return this.children[name] ||= new Node(name); }
  focus() {}
  click() { if (this.onclick) this.onclick({}); }
  setPointerCapture(id) { this.captured.add(id); }
  hasPointerCapture(id) { return this.captured.has(id); }
  releasePointerCapture(id) { this.captured.delete(id); this.emit('lostpointercapture', { pointerId: id }); }
  getBoundingClientRect() { return { left: 0, top: 0, width: 1280, height: 720 }; }
  getContext() { return drawing; }
}
const drawing = new Proxy({ createLinearGradient: () => ({ addColorStop() {} }) }, { get: (o, k) => k in o ? o[k] : () => {} });
const nodes = new Map();
const get = id => { if (!nodes.has(id)) nodes.set(id, new Node(id)); return nodes.get(id); };
const window = new Node('window'), document = new Node('document');
document.hidden = false; document.getElementById = get; document.createElement = () => new Node();
window.devicePixelRatio = 1;
let frame;
const context = { PicnicPhysics: P, PicnicDamage: require('../src/damage-art.js'), Matter: M, window, document, localStorage: { getItem: () => null, setItem() {} },
  requestAnimationFrame: fn => { frame = fn; }, console, Math, Set };
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname, '../src/game.js'), 'utf8'), context);
const canvas = get('game'), state = () => window.picnic.snapshot();
const start = (x = -65, y = 25) => canvas.emit('pointerdown', { clientX: P.SLING.x + x, clientY: P.SLING.y + y });
// Production hit area is deliberately generous, but starts must still be near the pebble.
const grab = () => start(-30, 20);
const release = (x = -80, y = 16) => canvas.emit('pointerup', { clientX: P.SLING.x + x, clientY: P.SLING.y + y });
let passed = 0;
function test(name, fn) { fn(); passed++; console.log(`PASS ${name}`); }
function reset() { get('restart-button').click(); }
test('off-pebble mouse clicks and secondary-button presses do not aim', () => {
  canvas.emit('pointerdown', { clientX: 850, clientY: 400 }); assert.equal(window.picnic.getPull().dragging, false);
  canvas.emit('pointerdown', { button: 2, clientX: 190, clientY: 458 }); assert.equal(state().shotsLeft, 3);
});
test('grab immediately updates power; move clamps power and shows aiming UI', () => {
  grab(); assert.equal(window.picnic.getPull().dragging, true); assert.equal(get('power-wrap').hidden, false);
  assert.ok(parseFloat(get('power-fill').style.width) > 0 && parseFloat(get('power-fill').style.width) < 100);
  canvas.emit('pointermove', { clientX: -300, clientY: 800 });
  assert.ok(Math.hypot(window.picnic.getPull().x, window.picnic.getPull().y) <= 96.001);
  assert.ok(Math.abs(parseFloat(get('power-fill').style.width) - 100) < .001);
});
test('Escape cancels a stretched aim with no shot or projectile', () => {
  window.emit('keydown', { key: 'Escape' }); release();
  assert.equal(window.picnic.getPull().dragging, false); assert.equal(state().shotsLeft, 3); assert.equal(state().state, 'ready');
});
test('right-button down and context-menu cancellation both preserve ammunition', () => {
  grab(); canvas.emit('mousedown', { button: 2 }); release(); assert.equal(state().shotsLeft, 3);
  grab(); canvas.emit('contextmenu'); release(); assert.equal(state().shotsLeft, 3);
});
test('pointer cancellation, lost capture, blur and cancel button prevent release', () => {
  for (const name of ['pointercancel', 'lostpointercapture']) { grab(); canvas.emit(name); release(); assert.equal(state().shotsLeft, 3); }
  grab(); window.emit('blur'); release(); assert.equal(state().shotsLeft, 3);
  grab(); get('cancel-button').click(); release(); assert.equal(state().shotsLeft, 3);
});
test('a fast release reads its final position, launches once and blocks a second grab', () => {
  grab(); release(); assert.equal(state().shotsLeft, 2); assert.equal(state().state, 'flying');
  grab(); release(); assert.equal(state().shotsLeft, 2); assert.equal(window.picnic.getPull().dragging, false);
});
test('quick restart works in flight and keyboard retry restores ammunition', () => {
  reset(); assert.equal(state().shotsLeft, 3); assert.equal(state().state, 'ready');
  grab(); release(); window.emit('keydown', { key: 'r' }); assert.equal(state().shotsLeft, 3);
});
test('level picker shows all five levels, cancels aim and loads selected level', () => {
  grab(); get('levels-button').click(); assert.equal(window.picnic.getPull().dragging, false);
  assert.equal(get('level-picker').hidden, false); assert.ok(get('level-grid').innerHTML.includes(P.levels[4].name));
  get('level-grid').onclick({ target: { closest: () => ({ dataset: { level: '4' } }) } });
  assert.equal(state().level, 4); assert.equal(state().shotsLeft, 8); assert.equal(state().targets, 7);
});
test('mute control and M shortcut update state without touching gameplay', () => {
  get('mute-button').click(); assert.equal(window.picnic.diagnostics().muted, true);
  assert.equal(get('mute-button').attrs['aria-pressed'], 'true');
  window.emit('keydown', { key: 'm' }); assert.equal(window.picnic.diagnostics().muted, false); assert.equal(state().shotsLeft, 8);
});
test('resize and one render frame complete without exceptions', () => {
  window.emit('resize'); frame(10); frame(27); assert.ok(window.picnic.diagnostics().pixelWidth > 0);
});
console.log(`\n${passed} input/UI integration checks passed (minimal DOM; browser layout/audio require separate inspection).`);
