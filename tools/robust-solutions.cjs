// Bounded typed-ammo recovery search. Rewrites fixtures only after a winning
// nominal route is retained; evaluates nine real +/-2px replays per candidate.
const fs = require('node:fs'), path = require('node:path');
const { P, fire } = require('./physics-sandbox.cjs');
const file = path.join(__dirname, '../tests/solutions.json'), solutions = JSON.parse(fs.readFileSync(file, 'utf8'));
const candidates = [];
for (let x = -96; x <= -16; x += 8) for (let y = -24; y <= 72; y += 8) candidates.push([x, y]);
function assess(level, sequence) {
  let wins = 0, targets = 0, health = 0, nominalWon = false;
  for (const dx of [-2, 0, 2]) for (const dy of [-2, 0, 2]) {
    const w = new P.GameWorld(level);
    for (const shot of sequence) {
      if (w.state !== 'ready' || !(w.ammo[shot.type] > 0)) break;
      fire(w, { ...shot, pull: [shot.pull[0] + dx, shot.pull[1] + dy] });
    }
    if (w.state === 'won') wins++;
    if (dx === 0 && dy === 0) nominalWon = w.state === 'won';
    targets += w.targets().length; health += w.targets().reduce((s, b) => s + b.game.hp, 0);
  }
  return { wins, nominalWon, score: (nominalWon ? 1000000 : 0) + wins * 10000 - targets * 100 - health };
}
const targetWins = process.argv.includes('--quick') ? 7 : 9;
const requested = process.argv.slice(2).filter(s => !s.startsWith('--'));
const indexes = requested.length ? requested.map(Number) : solutions.map((_, i) => i);
for (const level of indexes) {
  let sequence = solutions[level], result = assess(level, sequence);
  while (result.wins < targetWins && sequence.length < P.levels[level].shots) {
    const left = { ...P.levels[level].ammo }; sequence.forEach(s => left[s.type]--);
    let best = null;
    for (const type of Object.keys(left).filter(t => left[t] > 0)) {
      for (const pull of candidates) {
        const shot = { type, pull, wait: 6000 }, candidate = assess(level, [...sequence, shot]);
        if (!best || candidate.score > best.result.score) best = { shot, result: candidate };
        if (best.result.wins >= targetWins && best.result.nominalWon) break;
      }
      if (best && best.result.wins >= targetWins && best.result.nominalWon) break;
    }
    if (!best || !best.result.nominalWon) throw new Error(`No retained nominal win for level ${level + 1}`);
    sequence = [...sequence, best.shot]; result = best.result;
    console.log(JSON.stringify({ level: level + 1, sequence, ...result }));
  }
  solutions[level] = sequence; fs.writeFileSync(file, JSON.stringify(solutions, null, 2) + '\n');
  console.log(`Level ${level + 1}: ${result.wins}/9 small aim variations, ${sequence.length} allowed shots`);
}
