(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PicnicDamage = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Only existing health and stable piece seeds affect the artwork. Restoring a
  // shot therefore restores its marks without another snapshot or random state.
  function draw(ctx, data) {
    if (!data || !['piece', 'platform', 'crate'].includes(data.kind) ||
        !Number.isFinite(data.hp) || !Number.isFinite(data.maxHp) || data.maxHp <= 0 ||
        !Number.isFinite(data.width) || !Number.isFinite(data.height) ||
        data.width < 10 || data.height < 10 || data.hp >= data.maxHp) return;
    const damage = Math.max(0, Math.min(1, 1 - data.hp / data.maxHp));
    const wood = data.material === 'wood', glass = data.material === 'glass', metal = data.material === 'metal';
    const wide = data.width >= data.height;
    // Coordinates below follow the long axis. A generous inset also preserves
    // the base artwork's rounded corners and keeps stroke widths inside them.
    const length = (wide ? data.width : data.height) / 2 - 4;
    const breadth = (wide ? data.height : data.width) / 2 - 4;
    let seed = (Number.isFinite(data.seed) ? data.seed : 0) >>> 0;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const point = (a, b) => wide ? [a, b] : [b, a];
    const path = points => {
      ctx.beginPath();
      points.forEach(([a, b], i) => { const [x, y] = point(a, b); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
    };
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';

    // A shallow, uneven surface crease reads as a dent without moving the outer
    // contour (or promising a gap that the collision body does not have).
    if (damage > .2) {
      const dent = length * (.18 + random() * .12);
      path([[-dent, -breadth * .8], [dent * .8, -breadth * .68],
        [dent, -breadth * .35 + damage * breadth * .15], [-dent * .6, -breadth * .4]]);
      ctx.closePath(); ctx.fillStyle = glass ? '#467f8626' : metal ? '#34465338' : '#493e3026';
      ctx.globalAlpha = damage; ctx.fill();
      path([[-dent, -breadth * .8], [dent * .8, -breadth * .68]]);
      ctx.strokeStyle = metal ? '#f5f9ff' : '#fff9db'; ctx.lineWidth = .8; ctx.globalAlpha = damage * .65; ctx.stroke();
    } else {
      random(); // Preserve the crack layout as damage crosses the dent threshold.
    }

    const count = damage > .68 ? 3 : damage > .3 ? 2 : 1;
    for (let i = 0; i < 3; i++) {
      const centre = (i - 1) * length * .52 + (random() - .5) * length * .15;
      const bend = (random() - .5) * Math.min(12, length * .17);
      const reach = breadth * (.28 + damage * .64);
      if (i >= count) continue;
      const points = [[centre - bend, -reach], [centre + bend, -reach * .38],
        [centre - bend * .4, reach * .08], [centre + bend * .7, reach * .5], [centre - bend, reach]];
      path(points); ctx.strokeStyle = glass ? '#386f7d' : wood ? '#70452c' : '#4e5c62';
      ctx.lineWidth = .9 + damage * 1.2; ctx.globalAlpha = .32 + damage * .6; ctx.stroke();
      path(points.map(([a, b]) => [a + .9, b]));
      ctx.strokeStyle = glass ? '#f1fff7' : metal ? '#f5f9ff' : '#ffe7b0'; ctx.lineWidth = .7; ctx.globalAlpha = damage * .65; ctx.stroke();
      if (damage > .3) {
        path([[centre - bend * .4, reach * .08], [centre + length * .13, -reach * .15],
          [centre + length * .2, -reach * .5]]);
        ctx.strokeStyle = glass ? '#386f7d' : wood ? '#70452c' : '#4e5c62';
        ctx.lineWidth = .8 + damage * .5; ctx.globalAlpha = .25 + damage * .6; ctx.stroke();
      }
      if (wood && damage > .5) {
        // Small pale slivers sit in the split rather than flying off the body.
        const splinter = Math.min(length * .12, 9) * damage;
        path([[centre, reach * .35], [centre + splinter, reach * .2], [centre + splinter * .45, reach * .48]]);
        ctx.closePath(); ctx.fillStyle = '#ffe2a0'; ctx.globalAlpha = .4 + damage * .4; ctx.fill();
      }
    }
    ctx.restore();
  }
  return { draw };
});
