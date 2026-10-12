// Bounded real-physics search for new level/ammo designs; no target shortcuts.
const fs = require('node:fs'), path = require('node:path');
const { P, fire } = require('./physics-sandbox.cjs');
const candidates = [];
for (let x = -96; x <= -16; x += 8) for (let y = -24; y <= 72; y += 8) candidates.push([x, y]);
function replay(level, shots) {
  const w = new P.GameWorld(level);
  for (const shot of shots) if (w.state === 'ready') fire(w, shot);
  return w;
}
const fixtures = JSON.parse(fs.readFileSync(path.join(__dirname, '../tests/solutions.json'), 'utf8'));
const indexes = process.argv.length === 2 ? P.levels.map((_, i) => i) : process.argv.slice(2).map(Number);
for (const level of indexes) {
  let shots = [];
  for (let i = 0; i < P.levels[level].shots; i++) {
    const current = replay(level, shots), options = [];
    for (const type of Object.keys(current.ammo).filter(t => current.ammo[t] > 0)) for (const pull of candidates) {
      const shot = { type, pull, wait: 6000 }, w = replay(level, [...shots, shot]);
      const hp = w.targets().reduce((s, b) => s + b.game.hp, 0);
      const cost = type === 'bomb' ? 250 : type === 'pebble' ? 0 : 20;
      const score = w.targets().length * 10000 + hp * 100 + w.bodies().filter(b => b.game.kind === 'piece').length * 5 + cost;
      options.push({ shot, w, score });
    }
    options.sort((a, b) => a.score - b.score);
    const best = options[0]; shots.push(best.shot);
    console.log(JSON.stringify({ level: level + 1, shots, state: best.w.state, targets: best.w.targets().map(b => ({ x: Math.round(b.position.x), y: Math.round(b.position.y), hp: b.game.hp })) }));
    if (best.w.state === 'won') { fixtures[level] = shots; fs.writeFileSync(path.join(__dirname, '../tests/solutions.json'), JSON.stringify(fixtures, null, 2) + '\n'); break; }
    if (best.w.state === 'lost') { console.log(`NO SOLUTION: level ${level + 1}`); process.exitCode = 1; break; }
  }
}
