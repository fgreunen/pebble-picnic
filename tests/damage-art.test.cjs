const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const art = require('../src/damage-art.js');

// Capture actual drawing primitives and styles, not a second damage algorithm.
function render(data) {
  const commands = [], points = [], stack = [];
  const ctx = { globalAlpha: 1, lineWidth: 1, strokeStyle: 'initial', fillStyle: 'initial', lineCap: 'butt', lineJoin: 'miter' };
  const state = () => [ctx.globalAlpha, ctx.lineWidth, ctx.strokeStyle, ctx.fillStyle, ctx.lineCap, ctx.lineJoin];
  ctx.save = () => stack.push(state());
  ctx.restore = () => {
    const saved = stack.pop();
    ['globalAlpha', 'lineWidth', 'strokeStyle', 'fillStyle', 'lineCap', 'lineJoin'].forEach((key, i) => { ctx[key] = saved[i]; });
  };
  for (const name of ['beginPath', 'closePath', 'moveTo', 'lineTo', 'stroke', 'fill']) {
    ctx[name] = (...args) => {
      commands.push([name, ...args, ...state()]);
      if (name === 'moveTo' || name === 'lineTo') points.push(args);
    };
  }
  art.draw(ctx, data);
  assert.deepEqual(state(), [1, 1, 'initial', 'initial', 'butt', 'miter'], 'drawing state must be restored');
  assert.equal(stack.length, 0);
  return { commands, points };
}
const piece = { kind: 'piece', material: 'wood', width: 120, height: 24, seed: 7, hp: 26, maxHp: 26 };
assert.equal(render(piece).commands.length, 0, 'intact pieces have no marks');
for (const kind of ['target', 'pebble', 'ground', 'decoration']) {
  assert.equal(render({ ...piece, kind, hp: 1 }).commands.length, 0, `${kind} must have no damage artwork`);
}
for (const invalid of [{ hp: NaN }, { maxHp: 0 }, { width: Infinity }, { height: 0 }]) {
  assert.equal(render({ ...piece, hp: 1, ...invalid }).commands.length, 0);
}
console.log('PASS intact, non-obstacle and invalid damage states draw no marks');
const lightly = render({ ...piece, hp: 24 }).commands;
const middle = render({ ...piece, hp: 13 }).commands;
const nearBroken = render({ ...piece, hp: 2 }).commands;
assert(lightly.length > 0, 'light damage is visible');
assert(middle.length > lightly.length, 'mid damage adds branches and surface shading');
assert(nearBroken.length > middle.length, 'near-breaking damage adds cracks and splinters');
console.log('PASS progressive structural damage increases visible cracks and shading');
assert.deepEqual(render({ ...piece, hp: 13 }).commands, middle, 'repeated render is deterministic');
assert.notDeepEqual(render({ ...piece, hp: 13, seed: 8 }).commands, middle, 'seeds vary crack placement');
const restored = { ...piece, hp: 13 };
render({ ...restored, hp: 1 });
assert.deepEqual(render(restored).commands, middle, 'restored health restores original marks');
assert.equal(render({ ...restored, hp: 26 }).commands.length, 0, 'retry clears marks');
console.log('PASS seeded artwork is deterministic and restores from health alone');
for (const material of ['wood', 'glass', 'stone', 'metal']) {
  for (const kind of ['piece', 'platform', 'crate']) {
    for (const [width, height] of [[120, 24], [24, 120], [50, 50], [10, 10]]) {
      for (const seed of [0, 7, 99, -1]) {
        const data = { ...piece, material, kind, width, height, seed, hp: 1 };
        const result = render(data);
        assert(result.points.length > 0);
        for (const [x, y] of result.points) {
          // The maximum stroke radius is 1.05px; at least 2px of margin
          // protects every mark, including small bodies' rounded corners.
          assert(Number.isFinite(x) && Number.isFinite(y));
          assert(Math.abs(x) <= width / 2 - 2 && Math.abs(y) <= height / 2 - 2,
            `${material} ${width}x${height}: damage escaped silhouette at ${x},${y}`);
        }
      }
    }
  }
}
const browser = {};
console.log('PASS wood, glass, stone and metal damage marks stay inside every tested silhouette');
vm.runInNewContext(fs.readFileSync(require.resolve('../src/damage-art.js'), 'utf8'), browser);
assert.equal(typeof browser.PicnicDamage.draw, 'function', 'offline browser global exists');
console.log('PASS offline browser export is available');
console.log('\n5 damage art checks passed.');
