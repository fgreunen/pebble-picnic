(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PicnicLevels = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const block = (x, y, w, h, material = 'wood', extra = {}) => ({ x, y, w, h, material, ...extra });
  const target = (x, y) => ({ x, y, target: true });
  const crate = (x, base = 600) => block(x, base - 21, 42, 42, 'wood', { crate: true });
  function tower(x, base, floors, width, height, legs = 'wood', roof = 'wood') {
    const pieces = [];
    for (let row = 0; row < floors; row++) {
      pieces.push(block(x - width / 2, base - height / 2, 22, height, row ? 'glass' : legs),
        block(x + width / 2, base - height / 2, 22, height, row ? 'glass' : legs),
        block(x, base - height - 10, width + 46, 20, row ? 'wood' : roof), target(x, base - 24));
      base -= height + 20;
    }
    pieces.push(target(x, base - 24)); return pieces;
  }
  const bridge = (x, y, w) => block(x, y, w, 18, 'wood', { ropes: [-1, 1].map(s => ({
    local: { x: s * (w / 2 - 10), y: 0 }, anchor: { x: x + s * (w / 2 - 10), y: y - 130 }, length: 130
  })) });
  const dominoes = (start, count) => Array.from({ length: count }, (_, i) => block(start + i * 35, 550 + (i % 2) * 10, 18, 100 - (i % 2) * 20, i % 2 ? 'wood' : 'glass'));
  const ramp = block(555, 581, 135, 18, 'metal', { angle: -.2 });
  const levels = [{
    name: 'First tumble', subtitle: 'A little pull. A big adventure.', theme: 'garden', sticker: '🌼',
    ammo: { pebble: 3 }, hint: 'Pull back and let go!',
    pieces: [block(780, 550, 24, 100), block(900, 550, 24, 100), block(840, 489, 160, 22), target(840, 576), target(840, 456)]
  }, {
    name: 'Double delight', subtitle: 'A bounce shelter, a tower and a domino trail.', theme: 'garden', sticker: '🦋',
    ammo: { pebble: 3, heavy: 1, bouncy: 1 }, hint: 'Bounce low into the shelter — or aim through its doorway!',
    // The roof balances on two movable posts behind the open rebound doorway.
    pieces: [block(800, 440, 220, 20, 'metal'),
      block(855, 525, 20, 150, 'glass'),
      block(735, 565, 85, 70, 'metal'), target(735, 507), target(975, 576),
      ...dominoes(900, 2),
      ...tower(1090, 600, 1, 100, 110, 'glass'), block(800, 525, 20, 150, 'metal')]
  }, {
    name: 'Seesaw shore', subtitle: 'A glass tower and a balanced playground.', theme: 'beach', sticker: '🐚',
    ammo: { pebble: 3, heavy: 2, bouncy: 1 }, hint: 'A heavy ball tips the stone counterweights. Pebbles can topple the tower!',
    pieces: [ramp, ...tower(780, 600, 2, 112, 95), ...dominoes(910, 2),
      // A broad foot steadies the movable pivot; its collision group leaves the beam free to tilt.
      block(1090, 569, 140, 62, 'metal', { id: 'seesaw-base', group: -3 }),
      block(1090, 529, 180, 18, 'wood', { pivot: { x: 1090, y: 529, support: 'seesaw-base' }, group: -3 }),
      block(1030, 510, 30, 20, 'stone'), block(1150, 510, 30, 20, 'stone'),
      target(1030, 477), target(1150, 477), block(609, 589.5, 24, 21, 'metal')]
  }, {
    name: 'Bridge builders', subtitle: 'Two towers, a hanging bridge and a golden surprise.', theme: 'beach', sticker: '⛵',
    ammo: { pebble: 4, heavy: 2, bomb: 1 }, hint: 'Roll the timed bomb into the metal pocket. Or break the bridge supports!',
    pieces: [...tower(690, 600, 2, 90, 80), ...tower(1110, 600, 2, 90, 95, 'glass', 'stone'),
      bridge(890, 430, 180), target(890, 398), ...dominoes(815, 3), crate(965),
      block(1015, 560, 40, 80, 'metal')]
  }, {
    name: 'Snowy grand picnic', subtitle: 'A terraced castle, a bridge and a chain reaction.', theme: 'snow', sticker: '❄️',
    ammo: { pebble: 4, heavy: 2, bouncy: 1, bomb: 1 }, hint: 'Golden crates can start a chain reaction!',
    pieces: [{ ...ramp, x: 520, w: 95 }, ...tower(685, 600, 2, 105, 100),
      block(1100, 570, 275, 60, 'metal'), ...tower(1080, 540, 2, 105, 100, 'wood', 'stone'),
      bridge(880, 455, 145), target(880, 423), ...dominoes(810, 3), crate(940), crate(990, 540),
      block(558, 590.75, 24, 18.5, 'metal')]
  }];
  // Optional decorations never change the five adventure layouts or inventories.
  levels[0].peekaboos = [{ animal: 'duck', x: 780, y: 550, cover: [0] }, { animal: 'bunny', x: 900, y: 550, cover: [1] }];
  levels[1].peekaboos = [{ animal: 'bunny', x: 735, y: 565, cover: [2] }, { animal: 'duck', x: 855, y: 540, cover: [1] }];
  levels[0].bubbles = [{ x: 1030, y: 380, radius: 38 }];
  levels[2].bubbles = [{ x: 1190, y: 320, radius: 40 }];
  levels.push({
    name: 'Tall tumble', subtitle: 'One little nudge!', quick: true, theme: 'garden', sticker: '🌻',
    ammo: { pebble: 3 }, hint: 'Nudge the tall glass stack.',
    pieces: [block(660, 550, 46, 100, 'glass'), block(660, 460, 46, 80, 'glass'), block(660, 385, 46, 70, 'glass'), target(660, 327)],
    peekaboos: [{ animal: 'duck', x: 660, y: 550, cover: [0] }, { animal: 'bunny', x: 660, y: 460, cover: [1] }],
    bubbles: [{ x: 880, y: 350, radius: 40 }]
  }, {
    name: 'Three big dominoes', subtitle: 'Tip, tip, tumble!', quick: true, theme: 'garden', sticker: '🍄',
    ammo: { pebble: 3 }, hint: 'Tap the first domino.',
    pieces: [block(620, 520, 28, 160, 'glass'), block(685, 520, 28, 160, 'glass'), block(750, 520, 28, 160, 'glass'), target(750, 417)],
    peekaboos: [{ animal: 'bunny', x: 620, y: 540, cover: [0] }, { animal: 'duck', x: 750, y: 540, cover: [2] }],
    bubbles: [{ x: 870, y: 390, radius: 40 }]
  }, {
    name: 'Beach ball party', subtitle: 'A big bouncy pile.', quick: true, theme: 'beach', sticker: '🏖️',
    ammo: { pebble: 3 }, hint: 'Send the beach balls tumbling!',
    pieces: [{ x: 650, y: 564, fruit: 'beachball', radius: 36 }, { x: 722, y: 564, fruit: 'beachball', radius: 36 },
      { x: 686, y: 502, fruit: 'beachball', radius: 36 }, target(686, 443),
      block(602, 576, 24, 48), block(770, 576, 24, 48)],
    bubbles: [{ x: 930, y: 350, radius: 42 }]
  });
  function fruitScene(name, theme, sticker, fruits) {
    return {
      name, subtitle: 'Tap the stopper. Watch them roll!', quick: true, theme, sticker,
      ammo: { pebble: 4 }, hint: 'Knock away the wooden stopper.', basket: { x: 995, y: 563, w: 180, h: 74 },
      pieces: [block(800, 551, 360, 18, 'metal', { angle: .18 }),
        block(650, 566.5, 30, 67, 'metal'), block(930, 592, 30, 16, 'metal'),
        block(756, 496, 52, 70, 'wood', { stopper: true, id: 'fruit-stopper' }),
        ...fruits, target(570, 576)],
      peekaboos: [{ animal: 'duck', x: 756, y: 496, cover: [3] }, { animal: 'bunny', x: 650, y: 570, cover: [1] }],
      bubbles: [{ x: 1100, y: 350, radius: 40 }]
    };
  }
  levels.push(fruitScene('Apple picnic', 'garden', '🍎', [{ x: 699, y: 490, fruit: 'apple', radius: 34 }]));
  levels.push(fruitScene('Rainbow fruit roll', 'beach', '🍊', [{ x: 699, y: 488, fruit: 'orange', radius: 36 }]));
  levels.forEach(l => { l.shots = Object.values(l.ammo).reduce((a, b) => a + b, 0); });
  return levels;
});
