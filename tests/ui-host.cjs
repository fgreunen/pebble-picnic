// Production UI in a small DOM/audio host. Rendering and audible quality still
// require real browser inspection; this host verifies event/state lifecycle.
const vm = require('node:vm'), fs = require('node:fs'), path = require('node:path');
const P = require('../src/physics.js'), M = require('../vendor/matter.min.js');
function createHost({ storage = new Map(), storageBlocked = false, recordDrawing = false } = {}) {
  const drawCalls = [];
  const drawing = new Proxy({ createLinearGradient: () => ({ addColorStop() {} }) }, { get: (o, k) => k in o ? o[k] : (...args) => { if (recordDrawing) drawCalls.push([k, ...args]); } });
  class Node {
    constructor(id = '') { this.id = id; this.hidden = true; this.style = {}; this.listeners = {}; this.attrs = {}; this.children = {}; this.captured = new Set(); }
    addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }
    emit(name, data = {}) { const e = { button: 0, pointerId: 1, preventDefault() {}, ...data }; (this.listeners[name] || []).forEach(fn => fn(e)); }
    setAttribute(k, v) { this.attrs[k] = v; }
    querySelector(name) { return this.children[name] ||= new Node(name); }
    focus() {} click() { if (this.onclick) this.onclick({}); }
    setPointerCapture(id) { this.captured.add(id); }
    hasPointerCapture(id) { return this.captured.has(id); }
    releasePointerCapture(id) { this.captured.delete(id); this.emit('lostpointercapture', { pointerId: id }); }
    getBoundingClientRect() { return { left: 0, top: 0, width: 1280, height: 720 }; }
    getContext() { return drawing; }
  }
  const audioEvents = [];
  const param = () => ({ value: 0, setValueAtTime(v) { this.value = v; }, exponentialRampToValueAtTime(v) { this.value = v; }, setTargetAtTime(v) { this.value = v; audioEvents.push(v); }, cancelScheduledValues() {} });
  class AudioContext {
    constructor() { this.currentTime = 0; this.state = 'running'; this.destination = {}; }
    createOscillator() { return { frequency: param(), connect() {}, disconnect() {}, start() {}, stop() {} }; }
    createGain() { return { gain: param(), connect() {}, disconnect() {} }; }
    resume() { this.state = 'running'; return Promise.resolve(); }
    suspend() { this.state = 'suspended'; return Promise.resolve(); }
  }
  const nodes = new Map(), get = id => { if (!nodes.has(id)) nodes.set(id, new Node(id)); return nodes.get(id); };
  const window = new Node('window'), document = new Node('document');
  document.hidden = false; document.getElementById = get; document.createElement = () => new Node(); document.documentElement = new Node('html');
  window.devicePixelRatio = 1; window.AudioContext = AudioContext; window.matchMedia = () => ({ matches: false });
  let frame, world;
  class HostWorld extends P.GameWorld { constructor(...args) { super(...args); world = this; } }
  const context = { PicnicPhysics: { ...P, GameWorld: HostWorld }, PicnicDamage: require('../src/damage-art.js'), Matter: M, window, document,
    localStorage: { getItem(k) { if (storageBlocked) throw new Error('Storage blocked'); return storage.get(k) ?? null; }, setItem(k, v) { if (storageBlocked) throw new Error('Storage blocked'); storage.set(k, String(v)); } },
    requestAnimationFrame: fn => { frame = fn; }, console, Math, Set };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/game.js'), 'utf8'), context);
  const canvas = get('game'); let time = 100;
  const api = { get, canvas, window, document, storage, audioEvents, drawCalls, get world() { return world; }, state: () => window.picnic.snapshot(),
    grab: () => canvas.emit('pointerdown', { clientX: P.SLING.x - 30, clientY: P.SLING.y + 20 }),
    move: (x, y) => canvas.emit('pointermove', { clientX: P.SLING.x + x, clientY: P.SLING.y + y }),
    release: (x = -80, y = 16) => canvas.emit('pointerup', { clientX: P.SLING.x + x, clientY: P.SLING.y + y }),
    frames(seconds) { for (let i = 0; i < Math.ceil(seconds * 60); i++) { time += 1000 / 60; frame(time); } },
    chooseLevel(i) { get('level-grid').onclick({ target: { closest: () => ({ dataset: { level: String(i) } }) } }); },
    chooseType(type) { get('ammo-picker').onclick({ target: { closest: () => ({ dataset: { type } }) } }); }
  };
  frame(time); return api;
}
module.exports = { createHost };
