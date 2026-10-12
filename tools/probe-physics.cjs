'use strict';
const { M, P, rig, piece, pebble, steps, fire } = require('./physics-sandbox.cjs');
// Keep this probe for transparent reproduction of the audit's baseline defects.
for (const direction of ['approaching', 'separating']) {
  const r = rig(), block = r.add(piece(500, 300, 'stone')), ball = r.add(pebble(478, 300));
  M.Body.setVelocity(ball, { x: direction === 'approaching' ? 12 : -12, y: 0 });
  steps(r.world, 1);
  console.log(JSON.stringify({ case: direction, hpLost: block.game.maxHp - block.game.hp, hits: r.events.filter(e => e.type === 'hit').length, explosions: r.events.filter(e => e.type === 'explode').length }));
}
for (let level = 0; level < 5; level++) {
  const sequence = require('../tests/solutions.json')[level];
  let wins = 0;
  for (const dx of [-2, 0, 2]) for (const dy of [-2, 0, 2]) {
    const w = new P.GameWorld(level);
    for (const shot of sequence) { if (w.state === 'won' || w.state === 'lost') break; fire(w, { ...shot, pull: [shot.pull[0] + dx, shot.pull[1] + dy] }); }
    if (w.state === 'won') wins++;
  }
  console.log(JSON.stringify({ level: level + 1, smallAimVariationsWon: wins, trials: 9 }));
}
