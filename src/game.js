(() => {
  'use strict';
  const P = PicnicPhysics, { SLING, MAX_PULL, WIDTH, HEIGHT, FLOOR } = P;
  const $ = id => document.getElementById(id);
  const canvas = $('game'), ctx = canvas.getContext('2d');
  let world, pull = { x: 0, y: 0 }, dragging = false, pointerId = null;
  let particles = [], shockwaves = [], trails = [], frameTime = 0, accumulator = 0, clock = 0, lastUI = '';
  let muted = false, audio = null, completed = new Set(), reducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  let coop = false, turn = 1, handover = 0, tension = null, flyingStars = [], slowUntil = 0, shakeUntil = 0, impactCooldown = 0;
  let pendingWin = null, undoUI = null;
  let flowers = [], animals = [], reactions = [], cosmetic = 'smile', pickerGroup = 'adventure';
  const attempts = new Map(), cosmetics = ['smile', 'wink', 'bow', 'cap'], effectAudio = new Set();
  let easy = false, keyboardAiming = true, aimAngle = Math.atan2(56, 32) * 180 / Math.PI, aimPower = Math.hypot(32, 56);
  const heldArrows = new Set(); let spaceDown = false, holdAge = 0;
  try {
    muted = localStorage.getItem('picnic-muted') === 'true';
    const stored = JSON.parse(localStorage.getItem('picnic-completed') || '[]');
    if (Array.isArray(stored)) completed = new Set(stored.filter(i => Number.isInteger(i) && i >= 0 && i < P.levels.length));
    const motion = localStorage.getItem('picnic-reduced-motion'); if (motion !== null) reducedMotion = motion === 'true';
    easy = localStorage.getItem('picnic-easy') === 'true';
    const face = localStorage.getItem('picnic-face'); if (cosmetics.includes(face)) cosmetic = face;
  } catch (_) { /* File URLs can disable storage. */ }
  function save() { try { localStorage.setItem('picnic-muted', muted); localStorage.setItem('picnic-completed', JSON.stringify([...completed])); localStorage.setItem('picnic-reduced-motion', reducedMotion); localStorage.setItem('picnic-easy', easy); localStorage.setItem('picnic-face', cosmetic); } catch (_) {} }
  function keyboardPull() { const a = aimAngle * Math.PI / 180; return { x: -Math.cos(a) * aimPower, y: Math.sin(a) * aimPower }; }
  function aiming() { return world && world.state === 'ready' && $('level-picker').hidden && $('outcome').hidden && !document.hidden && (dragging || easy && keyboardAiming); }
  function clearKeys() { heldArrows.clear(); spaceDown = false; holdAge = 0; }
  function syncKeyboardAim() {
    if (easy && !dragging) pull = aiming() ? keyboardPull() : { x: 0, y: 0 };
    $('angle-value').textContent = `${Math.round(aimAngle)}°`;
    if (aiming()) powerFeedback();
  }
  function adjustAim(angle, power) {
    // The slight downward range permits ground rebounds without exceeding the
    // mouse sling's -25px vertical limit, even at maximum power.
    aimAngle = Math.max(-15, Math.min(70, aimAngle + angle));
    aimPower = Math.max(25, Math.min(MAX_PULL, aimPower + power));
    keyboardAiming = true; syncKeyboardAim(); updateUI();
  }
  function focusedControl(e) {
    const target = e.target || document.activeElement;
    return !!(target && target !== canvas && (target.isContentEditable || /^(BUTTON|INPUT|SELECT|TEXTAREA|A)$/.test(target.tagName || '') || target.closest && target.closest('button,input,select,textarea,a,[contenteditable="true"]')));
  }
  function wakeAudio() {
    if (muted) return;
    try { if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === 'suspended') audio.resume().catch(() => {}); } catch (_) {}
  }
  function tone(freq, duration, kind = 'sine', gain = 0.06, delay = 0, end = freq) {
    if (muted || !audio || audio.state !== 'running') return;
    const t = audio.currentTime + delay, osc = audio.createOscillator(), volume = audio.createGain();
    osc.type = kind; osc.frequency.setValueAtTime(freq, t); osc.frequency.exponentialRampToValueAtTime(Math.max(30, end), t + duration);
    volume.gain.setValueAtTime(0.001, t); volume.gain.exponentialRampToValueAtTime(gain, t + 0.012); volume.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(volume); volume.connect(audio.destination); osc.start(t); osc.stop(t + duration + 0.02);
    effectAudio.add(osc); osc.onended = () => { effectAudio.delete(osc); osc.disconnect(); volume.disconnect(); };
    if (effectAudio.size > 24) { const oldest = effectAudio.values().next().value; try { oldest.stop(); } catch (_) {} effectAudio.delete(oldest); }
  }
  function stopEffectsAudio() { for (const osc of effectAudio) { try { osc.stop(); } catch (_) {} } effectAudio.clear(); }
  function stopTension() {
    if (!tension) return;
    const old = tension; tension = null;
    try { old.gain.gain.cancelScheduledValues(audio.currentTime); old.gain.gain.setTargetAtTime(.0001, audio.currentTime, .015); old.osc.stop(audio.currentTime + .08); old.osc.onended = () => { old.osc.disconnect(); old.gain.disconnect(); }; } catch (_) {}
  }
  function powerFeedback() {
    const power = Math.min(1, Math.hypot(pull.x, pull.y) / MAX_PULL), fill = $('power-fill');
    fill.style.width = `${power * 100}%`;
    fill.style.background = `rgb(${Math.round(222 + power * 25)},${Math.round(166 - power * 58)},${Math.round(100 - power * 38)})`;
    fill.style.boxShadow = `0 0 ${power * 17}px rgba(244,125,59,${power * .65})`;
    if ((!dragging && !(easy && heldArrows.size)) || muted || !audio) return;
    try {
      if (!tension) {
        const osc = audio.createOscillator(), gain = audio.createGain(); osc.type = 'sine'; gain.gain.value = .0001;
        osc.connect(gain); gain.connect(audio.destination); osc.start(); tension = { osc, gain };
      }
      tension.osc.frequency.setTargetAtTime(150 + power ** 1.5 * 520, audio.currentTime, .045);
      tension.gain.gain.setTargetAtTime(.012 + power ** 2 * .035, audio.currentTime, .045);
    } catch (_) {}
  }
  function impact() {
    if (reducedMotion || clock < impactCooldown) return;
    slowUntil = clock + .32; shakeUntil = clock + .22; impactCooldown = clock + .9;
  }
  let lastSound = -100;
  function clearTransientEffects() {
    particles = []; shockwaves = []; trails = []; flyingStars = [];
    slowUntil = 0; shakeUntil = 0; impactCooldown = 0; accumulator = 0;
    stopEffectsAudio(); lastSound = -100;
  }
  function event(e) {
    if (e.type === 'undo') {
      cancel(); pendingWin = null; $('outcome').hidden = true; $('level-picker').hidden = true;
      clearTransientEffects();
      if (undoUI) { turn = undoUI.turn; completed = new Set(undoUI.completed); flowers = undoUI.flowers; animals = undoUI.animals; reactions = undoUI.reactions; save(); }
      undoUI = null; handover = coop ? clock + 1.2 : 0; lastUI = '';
      $('live-status').textContent = 'Last shot undone. Try another angle!';
    }
    if (e.type === 'fizzle') burst(e.x, e.y, '#f5deb1', 5);
    if (e.type === 'explode') {
      impact();
      burst(e.x, e.y, '#e8a35d', 32);
      shockwaves.push({ x: e.x, y: e.y, radius: e.radius, life: .42 });
      if (shockwaves.length > 12) shockwaves.shift();
      tone(150, .24, 'triangle', .085, 0, 45); tone(740, .14, 'sine', .035, .02, 380);
    }
    if (['collect', 'break'].includes(e.type)) burst(e.x, e.y, e.type === 'collect' ? '#e1b24d' : e.material === 'glass' ? '#9bd3d8' : e.material === 'metal' ? '#c3ccd4' : '#c99865', e.type === 'collect' ? 23 : 13);
    if (e.type === 'launch') {
      undoUI = { turn, completed: [...completed], flowers: flowers.map(f => ({ ...f })), animals: animals.map(a => ({ ...a, cover: a.cover.map(c => ({ ...c })) })), reactions: reactions.map(r => ({ ...r })) };
      world.activeProjectile.game.cosmetic = cosmetic;
      tone(210, 0.17, 'triangle', 0.075, 0, 650); trails = [];
      stopTension();
      if (coop) { turn = turn === 1 ? 2 : 1; handover = 0; }
    }
    if (e.type === 'ready' || e.type === 'undo') keyboardAiming = true;
    if (e.type === 'ready' && coop) handover = clock + 1.2;
    if (e.type === 'hit' && e.strength >= 11) impact();
    if (e.type === 'reaction') {
      reactions.push({ x: e.x, y: e.y, seed: e.seed, born: world.realTime }); if (reactions.length > 8) reactions.shift();
      if (world.realTime - lastSound > 100) {
        const f = [280, 340, 420][Math.abs(e.seed || 0) % 3]; tone(f, .17, 'sine', .026, 0, f * .55); lastSound = world.realTime;
      }
    }
    if (e.type === 'flower') { flowers.push({ x: e.x, y: e.y, born: world.realTime }); if (flowers.length > 8) flowers.shift(); }
    if (e.type === 'pop' || e.type === 'fruit') { burst(e.x, e.y, e.type === 'pop' ? '#85cdda' : '#efab6c', 8); tone(e.type === 'pop' ? 640 : 510, .13, 'sine', .026, 0, 820); }
    if (e.type === 'collect') { tone(660, 0.17); tone(990, 0.22, 'sine', 0.05, 0.08); if (!reducedMotion) { flyingStars.push({ x: e.x, y: e.y, age: 0 }); if (flyingStars.length > 20) flyingStars.shift(); } }
    if (e.type === 'win') {
      cancel();
      completed.add(world.levelIndex); save();
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.28, 'triangle', 0.055, i * 0.11));
      for (let i = 0; i < 6; i++) burst(350 + i * 120, 200 - (i % 2) * 60, ['#e7aa5f', '#7ba77a', '#8bbec7'][i % 3], 18);
      pendingWin = { level: world.levelIndex, age: 0 };
    }
    if (e.type === 'lose') { cancel(); tone(340, 0.17, 'sine', 0.05); tone(280, 0.2, 'sine', 0.04, 0.16); showOutcome(false); }
    syncKeyboardAim(); updateUI();
  }
  function load(index) {
    cancel(); pendingWin = null; undoUI = null; $('level-picker').hidden = true; $('outcome').hidden = true;
    clearTransientEffects();
    if (world) world.load(index); else world = new P.GameWorld(index, event);
    turn = 1; handover = 0; lastUI = '';
    flowers = []; animals = []; reactions = [];
    const places = world.level.peekaboos || [], attempt = attempts.get(world.levelIndex) || 0;
    attempts.set(world.levelIndex, attempt + 1);
    if (places.length) {
      const place = places[attempt % places.length];
      animals.push({ ...place, revealed: false, revealedAt: 0, cover: place.cover.map(seed => {
        const b = world.bodies().find(b => b.game.seed === seed);
        return { seed, x: b.position.x, y: b.position.y, distance: Math.max(28, Math.min(b.game.width, b.game.height) * .6) };
      }) });
    }
    $('again-button').hidden = !world.level.quick;
    $('retry-button').textContent = world.level.quick ? '↻ Again!' : '↻ Play again';
    $('level-number').textContent = String(index + 1).padStart(2, '0'); $('level-name').textContent = world.level.name;
    $('live-status').textContent = `${world.level.name}. ${world.initialTargets} star pods. ${world.shotsLeft} balls.`;
    keyboardAiming = true; syncKeyboardAim(); updateUI();
    buildBackground();
  }
  function updateUI() {
    if (!world) return;
    const key = `${world.state}/${world.shotsLeft}/${world.targets().length}/${dragging}/${world.selectedType}/${coop}/${turn}/${clock < handover}/${!!world.undoState}/${easy}/${aiming()}`;
    if (key === lastUI) return;
    lastUI = key;
    $('undo-button').disabled = !world.undoState; $('outcome-undo').disabled = !world.undoState;
    $('shot-counter').innerHTML = Object.entries(world.level.ammo).map(([type, count]) => Array.from({ length: count }, (_, i) => `<span class="shot-dot ${type} ${i >= world.ammo[type] ? 'used' : ''}" title="${P.projectiles[type].name}"></span>`).join('')).join('');
    $('shot-counter').setAttribute('aria-label', `${world.shotsLeft} ${world.shotsLeft === 1 ? 'ball' : 'balls'} left`);
    $('target-counter').textContent = `${world.initialTargets - world.targets().length} / ${world.initialTargets}`;
    $('play-hint').hidden = dragging || ['won', 'lost'].includes(world.state);
    $('play-hint').querySelector('strong').textContent = world.state === 'flying' ? 'Watch the tumble…' : easy ? '↑ ↓ Aim · ← → Power' : 'Pull back. Let go!';
    $('play-hint').querySelector('small').textContent = world.state === 'flying' ? 'The next ball will be ready soon' : easy ? 'Space to launch · Esc to cancel' : world.launches === 0 ? world.level.hint : 'Knock down the green star pods';
    $('power-wrap').hidden = !aiming(); $('angle-readout').hidden = !easy;
    $('cancel-hint').textContent = easy ? 'Space to launch · Esc to cancel' : 'Esc / right-click to cancel';
    $('ammo-picker').hidden = ['won', 'lost'].includes(world.state);
    $('ammo-picker').innerHTML = Object.keys(world.level.ammo).map(type => `<button class="ammo-choice ${type} ${world.selectedType === type ? 'selected' : ''}" data-type="${type}" aria-label="${P.projectiles[type].name}, ${world.ammo[type]} left" aria-pressed="${world.selectedType === type}" ${world.state !== 'ready' || dragging || !world.ammo[type] ? 'disabled' : ''}><span class="ammo-icon ${type}" aria-hidden="true">${P.projectiles[type].icon}</span><small>${P.projectiles[type].name}</small><b>${world.ammo[type]}</b></button>`).join('');
    $('turn-badge').hidden = !coop || ['won', 'lost'].includes(world.state);
    $('turn-badge').textContent = `${world.state === 'flying' ? 'Next: ' : ''}${turn === 1 ? '●' : '◆'} Player ${turn}${clock < handover ? ' · Your turn!' : ''}`;
    $('turn-badge').style.background = turn === 1 ? '#ffe3c3' : '#d8e7fa';
  }
  function showOutcome(won) {
    $('outcome-icon').textContent = won ? '★' : '↻';
    $('outcome-eyebrow').textContent = won ? 'PICNIC PERFECT' : 'ONE MORE LITTLE TRY';
    $('outcome-title').textContent = won ? 'All stars collected!' : 'Give it another go!';
    $('outcome-text').textContent = won ? (world.levelIndex === P.levels.findLastIndex(l => !l.quick) ? 'You finished the whole picnic trail. Hooray!' : 'What a lovely little tumble.') : 'Try a different angle. You can do it.';
    $('next-button').hidden = !won;
    $('next-button').textContent = nextLevel() === -1 ? 'Choose a picnic ▦' : 'Next picnic →';
    $('outcome').hidden = false; $('skip-button').hidden = true;
    $('live-status').textContent = won ? 'All stars collected! Level complete.' : 'No balls left. Try again.';
    (world.level.quick || !won ? $('retry-button') : $('next-button')).focus({ preventScroll: true });
  }
  function nextLevel() { return P.levels.findIndex((l, i) => i > world.levelIndex && !!l.quick === !!world.level.quick); }
  function renderLevels() {
    $('adventure-tab').setAttribute('aria-pressed', String(pickerGroup === 'adventure'));
    $('quick-tab').setAttribute('aria-pressed', String(pickerGroup === 'quick'));
    $('level-grid').setAttribute('data-group', pickerGroup);
    $('level-grid').innerHTML = P.levels.map((l, i) => ({ l, i })).filter(({ l }) => !!l.quick === (pickerGroup === 'quick')).map(({ l, i }) => `<button class="level-choice ${l.theme} ${i === world.levelIndex ? 'current' : ''}" data-level="${i}"><span class="trail-number">${i + 1}</span><span class="mini-scene" aria-hidden="true">${l.sticker}</span>${completed.has(i) ? '<span class="badge" aria-label="Completed">★</span>' : ''}<strong>${l.name}</strong><small>${l.quick ? 'Quick play' : l.theme === 'snow' ? 'Snowy hills' : l.theme === 'beach' ? 'Sunny shore' : 'Garden'} · ${l.shots} balls · ${l.pieces.filter(p => p.target).length} stars</small></button>`).join('');
  }
  function chooseLevels() {
    cancel();
    stopEffectsAudio(); pickerGroup = world.level.quick ? 'quick' : 'adventure';
    $('sticker-album').innerHTML = P.levels.map((l, i) => `<span class="sticker ${completed.has(i) ? 'earned' : ''}" title="${completed.has(i) ? l.name : 'Complete this stop to earn a sticker'}">${completed.has(i) ? l.sticker : '☆'}</span>`).join('');
    renderLevels();
    $('level-picker').hidden = false;
    $('close-levels').focus({ preventScroll: true });
  }
  function cancel() {
    stopTension();
    clearKeys(); keyboardAiming = false;
    dragging = false; pull = { x: 0, y: 0 };
    if (pointerId !== null && canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
    pointerId = null; updateUI();
  }
  const point = e => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * WIDTH / r.width, y: (e.clientY - r.top) * HEIGHT / r.height }; };
  canvas.addEventListener('pointerdown', e => {
    if (e.button !== 0 || dragging || world.state !== 'ready' || !$('level-picker').hidden) return;
    if (easy) { clearKeys(); keyboardAiming = true; canvas.focus({ preventScroll: true }); syncKeyboardAim(); updateUI(); return; }
    const p = point(e);
    if (Math.hypot(p.x - SLING.x, p.y - SLING.y) > 62) return;
    wakeAudio(); dragging = true; pointerId = e.pointerId;
    canvas.setPointerCapture(pointerId); canvas.focus({ preventScroll: true });
    pull = P.clampPull(p.x - SLING.x, p.y - SLING.y); e.preventDefault(); updateUI();
    powerFeedback();
  });
  canvas.addEventListener('pointermove', e => {
    if (!dragging || e.pointerId !== pointerId) return;
    const p = point(e); pull = P.clampPull(p.x - SLING.x, p.y - SLING.y);
    powerFeedback();
  });
  canvas.addEventListener('pointerup', e => {
    if (!dragging || e.pointerId !== pointerId) return;
    // Read release coordinates too, so a fast pull between animation frames works.
    const p = point(e), finalPull = P.clampPull(p.x - SLING.x, p.y - SLING.y);
    cancel(); world.launch(finalPull.x, finalPull.y); updateUI();
  });
  canvas.addEventListener('pointercancel', cancel);
  canvas.addEventListener('lostpointercapture', () => { if (dragging) cancel(); });
  // On Windows, catch the right button as it goes down, before a chorded
  // pointer release can be mistaken for a launch by a browser/input driver.
  canvas.addEventListener('mousedown', e => { if (e.button === 2) { e.preventDefault(); cancel(); } });
  canvas.addEventListener('contextmenu', e => { e.preventDefault(); cancel(); });
  canvas.addEventListener('focus', () => { if (easy) { keyboardAiming = true; syncKeyboardAim(); updateUI(); } });
  canvas.addEventListener('blur', () => { if (easy) { clearKeys(); stopTension(); } });
  document.addEventListener('focusin', e => { if (focusedControl(e)) { clearKeys(); stopTension(); } });
  window.addEventListener('blur', cancel);
  document.addEventListener('visibilitychange', () => { cancel(); accumulator = 0; frameTime = 0; stopEffectsAudio(); });
  $('cancel-button').onclick = cancel;
  $('restart-button').onclick = $('retry-button').onclick = () => { wakeAudio(); load(world.levelIndex); };
  $('again-button').onclick = () => { wakeAudio(); load(world.levelIndex); canvas.focus({ preventScroll: true }); };
  function undoShot() { wakeAudio(); cancel(); if (world.undo()) canvas.focus({ preventScroll: true }); updateUI(); }
  $('undo-button').onclick = undoShot; $('outcome-undo').onclick = undoShot;
  $('levels-button').onclick = chooseLevels;
  $('adventure-tab').onclick = () => { pickerGroup = 'adventure'; renderLevels(); };
  $('quick-tab').onclick = () => { pickerGroup = 'quick'; renderLevels(); };
  $('face-picker').onclick = e => {
    const b = e.target.closest('[data-face]'); if (!b || !cosmetics.includes(b.dataset.face)) return;
    cancel(); cosmetic = b.dataset.face; save(); updateFaces(); keyboardAiming = true; syncKeyboardAim(); updateUI();
  };
  $('close-levels').onclick = () => { clearKeys(); $('level-picker').hidden = true; keyboardAiming = true; syncKeyboardAim(); updateUI(); canvas.focus({ preventScroll: true }); };
  $('level-grid').onclick = e => { const b = e.target.closest('[data-level]'); if (b) { wakeAudio(); load(Number(b.dataset.level)); canvas.focus({ preventScroll: true }); } };
  $('next-button').onclick = () => { const next = nextLevel(); if (next === -1) chooseLevels(); else load(next); };
  $('skip-button').onclick = () => { world.resolve(); updateUI(); };
  $('ammo-picker').onclick = e => { const b = e.target.closest('[data-type]'); if (b && !dragging) { world.selectProjectile(b.dataset.type); updateUI(); } };
  $('mode-button').onclick = () => { coop = !coop; $('mode-button').textContent = coop ? '2P · Team' : '1P'; $('mode-button').setAttribute('aria-pressed', String(coop)); load(world.levelIndex); };
  function updateControls() {
    $('power-wrap').setAttribute('data-easy', String(easy));
    $('easy-button').textContent = easy ? '⌨ Easy' : '↙ Mouse';
    $('easy-button').setAttribute('aria-pressed', String(easy));
    $('easy-button').setAttribute('aria-label', easy ? 'Use mouse slingshot controls' : 'Use Easy Mode keyboard slingshot controls');
    $('control-hints').innerHTML = easy ? '<kbd>↑ ↓</kbd> Angle <i>·</i> <kbd>← →</kbd> Power <i>·</i> <kbd>Space</kbd> Fire <i>·</i> <kbd>Esc</kbd> Cancel <i>·</i> <kbd>U</kbd> Undo' : '<kbd>↙</kbd> Drag & release <i>·</i> <kbd>Esc</kbd> Cancel <i>·</i> <kbd>R</kbd> Retry <i>·</i> <kbd>U</kbd> Undo';
  }
  $('easy-button').onclick = () => { cancel(); easy = !easy; keyboardAiming = true; updateControls(); save(); syncKeyboardAim(); updateUI(); canvas.focus({ preventScroll: true }); };
  function updateMotion() { $('motion-button').textContent = reducedMotion ? '◇' : '✦'; $('motion-button').setAttribute('aria-pressed', String(reducedMotion)); $('motion-button').setAttribute('aria-label', reducedMotion ? 'Enable full animation' : 'Reduce motion'); document.documentElement && document.documentElement.setAttribute('data-reduced-motion', String(reducedMotion)); }
  $('motion-button').onclick = () => { reducedMotion = !reducedMotion; slowUntil = 0; shakeUntil = 0; flyingStars = []; updateMotion(); save(); };
  function updateMute() { $('mute-button').textContent = muted ? '♪̸' : '♫'; $('mute-button').setAttribute('aria-label', muted ? 'Turn sound on' : 'Turn sound off'); $('mute-button').setAttribute('aria-pressed', String(muted)); }
  function toggleMute() { muted = !muted; if (muted) { stopTension(); stopEffectsAudio(); if (audio) audio.suspend().catch(() => {}); } else { wakeAudio(); if (dragging) powerFeedback(); tone(600, 0.12); } updateMute(); save(); }
  $('mute-button').onclick = toggleMute;
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); cancel(); if (!$('level-picker').hidden) $('close-levels').click(); }
    if (focusedControl(e)) return;
    if (easy && $('level-picker').hidden && $('outcome').hidden && !document.hidden && (e.key.startsWith('Arrow') || e.key === ' ' || e.code === 'Space')) {
      e.preventDefault();
      if (e.repeat) return;
      if (e.key === ' ' || e.code === 'Space') {
        if (spaceDown) return; spaceDown = true;
        if (world.state === 'ready') { wakeAudio(); keyboardAiming = true; const shot = keyboardPull(); world.launch(shot.x, shot.y); syncKeyboardAim(); updateUI(); }
      } else if (world.state === 'ready' && !heldArrows.has(e.key)) {
        heldArrows.add(e.key); holdAge = 0; wakeAudio();
        adjustAim(e.key === 'ArrowUp' ? 1 : e.key === 'ArrowDown' ? -1 : 0, e.key === 'ArrowRight' ? 2 : e.key === 'ArrowLeft' ? -2 : 0);
      }
      return;
    }
    if (e.repeat) return;
    if (e.key.toLowerCase() === 'r') load(world.levelIndex);
    if (e.key.toLowerCase() === 'm') toggleMute();
    if (e.key.toLowerCase() === 'u') undoShot();
  });
  window.addEventListener('keyup', e => {
    heldArrows.delete(e.key); if (e.key === ' ' || e.code === 'Space') spaceDown = false;
    if (!heldArrows.size) { holdAge = 0; stopTension(); }
  });
  function circle(x, y, r, color) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); }
  function roundRect(x, y, w, h, r, color, stroke = null) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fillStyle = color; ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); } }
  function star(x, y, r, color, rotation = 0) {
    ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5 + rotation, radius = i % 2 ? r * 0.47 : r; const px = x + Math.cos(a) * radius, py = y + Math.sin(a) * radius; if (!i) ctx.moveTo(px, py); else ctx.lineTo(px, py); } ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  }
  function cloud(x, y, s) { ctx.save(); ctx.translate(x, y); ctx.scale(s, s); circle(0, 0, 22, '#f8fbed'); circle(27, -9, 32, '#f8fbed'); circle(59, 0, 24, '#f8fbed'); roundRect(-15, 0, 89, 20, 12, '#f8fbed'); ctx.restore(); }
  const background = document.createElement('canvas'); background.width = WIDTH; background.height = HEIGHT;
  function buildBackground() {
    // Cache the procedural scenery once; physics is the only busy work per frame.
    const b = background.getContext('2d');
    const grad = b.createLinearGradient(0, 0, 0, FLOOR); grad.addColorStop(0, '#edf5e6'); grad.addColorStop(1, '#dfecd4'); b.fillStyle = grad; b.fillRect(0, 0, WIDTH, HEIGHT);
    b.fillStyle = '#f1e8b4'; b.beginPath(); b.arc(1060, 185, 61, 0, Math.PI * 2); b.fill();
    const hill = (color, y, points) => { b.fillStyle = color; b.beginPath(); b.moveTo(0, FLOOR); b.lineTo(0, y); points.forEach(p => b.bezierCurveTo(...p)); b.lineTo(WIDTH, FLOOR); b.closePath(); b.fill(); };
    hill('#cbdfc3', 480, [[180, 370, 290, 315, 440, 430], [610, 510, 700, 270, 900, 358], [1080, 280, 1150, 400, 1280, 410]]);
    hill('#bad3aa', 518, [[150, 455, 225, 470, 385, 535], [585, 560, 800, 412, 965, 466], [1100, 515, 1180, 450, 1280, 480]]);
    hill('#a8c58e', 574, [[210, 533, 330, 558, 530, 580], [750, 538, 980, 530, 1280, 580]]);
    b.fillStyle = '#bccd98'; b.fillRect(0, FLOOR, WIDTH, HEIGHT - FLOOR); b.fillStyle = '#8baa72'; b.fillRect(0, FLOOR, WIDTH, 7);
    b.fillStyle = '#cad7aa'; for (let i = 0; i < 90; i++) { const x = (i * 173 + 32) % WIDTH, y = 625 + (i * 41) % 89; b.beginPath(); b.ellipse(x, y, 2.5, 1.5, 0, 0, 7); b.fill(); }
    // Small distant trees, flowers and a path keep the stage warm and uncluttered.
    for (const [x, y, s] of [[57, 545, .75], [380, 570, .42], [1168, 553, .65], [1225, 568, .48]]) {
      b.fillStyle = '#859d6f'; b.fillRect(x - 4 * s, y - 70 * s, 8 * s, 70 * s); b.fillStyle = '#8fac7c';
      for (const [dx, dy, r] of [[0, -100, 36], [-20, -75, 28], [24, -70, 31]]) { b.beginPath(); b.arc(x + dx * s, y + dy * s, r * s, 0, 7); b.fill(); }
    }
    b.strokeStyle = '#97ae7e'; b.lineWidth = 2;
    for (let i = 0; i < 14; i++) { const x = (i * 227 + 314) % WIDTH, y = 604; b.beginPath(); b.moveTo(x, y); b.lineTo(x - 3, y - 12); b.moveTo(x, y); b.lineTo(x + 4, y - 8); b.stroke(); b.fillStyle = i % 2 ? '#f2e7b9' : '#e9c48f'; b.beginPath(); b.arc(x - 3, y - 12, 3, 0, 7); b.fill(); }
    const theme = world ? world.level.theme : 'garden';
    if (theme !== 'garden') {
      const sky = b.createLinearGradient(0, 0, 0, FLOOR); sky.addColorStop(0, theme === 'beach' ? '#daeff3' : '#e0eafa'); sky.addColorStop(1, '#faf8ee'); b.fillStyle = sky; b.fillRect(0, 0, WIDTH, HEIGHT);
      b.fillStyle = theme === 'beach' ? '#f5dea1' : '#f6dfb2'; b.beginPath(); b.arc(1080, 170, 55, 0, Math.PI * 2); b.fill();
      if (theme === 'beach') {
        b.fillStyle = '#a7d4d6'; b.fillRect(0, 440, WIDTH, 180);
        for (let i = 0; i < 6; i++) { b.strokeStyle = '#d8eeee'; b.lineWidth = 3; b.beginPath(); b.moveTo(0, 467 + i * 20); b.bezierCurveTo(350, 455 + i * 20, 870, 485 + i * 20, WIDTH, 461 + i * 20); b.stroke(); }
        b.fillStyle = '#e9d7ad'; b.fillRect(0, FLOOR, WIDTH, HEIGHT - FLOOR); b.fillStyle = '#d7be8d'; b.fillRect(0, FLOOR, WIDTH, 6);
        for (let i = 0; i < 25; i++) { b.fillStyle = i % 2 ? '#d3b999' : '#f7e9d1'; b.beginPath(); b.ellipse((i * 157 + 32) % WIDTH, 620 + i % 5 * 17, 5, 3, i, 0, 7); b.fill(); }
      } else {
        b.fillStyle = '#c4d2e6'; b.beginPath(); b.moveTo(0, FLOOR); b.lineTo(250, 260); b.lineTo(560, FLOOR); b.lineTo(925, 240); b.lineTo(WIDTH, FLOOR); b.fill();
        b.fillStyle = '#f7fafc'; b.beginPath(); b.moveTo(191, 339); b.lineTo(250, 260); b.lineTo(321, 339); b.lineTo(264, 320); b.fill();
        b.beginPath(); b.moveTo(843, 320); b.lineTo(925, 240); b.lineTo(1009, 320); b.lineTo(915, 294); b.fill();
        b.fillStyle = '#edf4fa'; b.fillRect(0, FLOOR, WIDTH, HEIGHT - FLOOR); b.fillStyle = '#c6d6e5'; b.fillRect(0, FLOOR, WIDTH, 6);
        for (const x of [40, 420, 1215]) { b.fillStyle = '#90aeab'; b.beginPath(); b.moveTo(x, 445); b.lineTo(x - 36, 580); b.lineTo(x + 36, 580); b.fill(); b.fillStyle = '#f1f7f6'; b.beginPath(); b.moveTo(x, 445); b.lineTo(x - 18, 510); b.lineTo(x + 18, 510); b.fill(); }
      }
    }
  }
  function drawSling(back) {
    ctx.lineCap = 'round';
    if (back) {
      ctx.fillStyle = '#82966a'; ctx.beginPath(); ctx.ellipse(190, FLOOR + 4, 53, 10, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = '#8f6849'; ctx.lineWidth = 18; ctx.beginPath(); ctx.moveTo(190, 598); ctx.lineTo(192, 502); ctx.lineTo(173, 453); ctx.stroke();
      ctx.strokeStyle = '#ad8357'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(188, 586); ctx.lineTo(188, 505); ctx.lineTo(171, 460); ctx.stroke();
    }
    const loaded = world.state === 'ready', pos = loaded ? { x: SLING.x + pull.x, y: SLING.y + pull.y } : SLING;
    const power = dragging ? Math.hypot(pull.x, pull.y) / MAX_PULL : 0;
    ctx.strokeStyle = power > .7 ? '#a96943' : '#695446'; ctx.lineWidth = 5 - power * 1.2; ctx.beginPath(); ctx.moveTo(back ? 173 : 207, 453); ctx.lineTo(pos.x, pos.y + 4); ctx.stroke();
    if (!back) { ctx.strokeStyle = '#9b744f'; ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(194, 509); ctx.lineTo(208, 453); ctx.stroke(); ctx.strokeStyle = '#cfac79'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(195, 499); ctx.lineTo(207, 462); ctx.stroke(); }
  }
  function updateFaces() {
    $('face-picker').innerHTML = cosmetics.map((face, i) => `<button class="face-choice" data-face="${face}" aria-label="${['Smile', 'Wink', 'Bow', 'Cap'][i]} decoration" aria-pressed="${cosmetic === face}"><span aria-hidden="true">${['☺', '😉', '🎀', '🧢'][i]}</span></button>`).join('');
  }
  function pebble(x, y, angle = 0, type = 'pebble', loaded = false, remaining = P.BOMB_FUSE, face = cosmetic) {
    const spec = P.projectiles[type] || P.projectiles.pebble, power = loaded && dragging ? Math.hypot(pull.x, pull.y) / MAX_PULL : 0;
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    if (power) { ctx.globalAlpha = power * .2; circle(0, 0, 28 + power * 15, '#ffb754'); ctx.globalAlpha = 1; }
    if (loaded && !reducedMotion) ctx.scale(1 - power * .1, 1 + power * .1);
    circle(0, 0, spec.radius, spec.color); circle(-5, -6, 11, type === 'bomb' ? '#68788b' : type === 'heavy' ? '#9badc3' : type === 'bouncy' ? '#c5a0d5' : '#ee9a70');
    ctx.strokeStyle = type === 'pebble' ? '#bb6b4c' : '#526574'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, spec.radius - 1, 0, 7); ctx.stroke();
    if (type === 'bomb') {
      const fuse = Math.max(0, Math.min(1, remaining / P.BOMB_FUSE));
      roundRect(-5, -25, 10, 8, 2, '#c6af7b'); ctx.strokeStyle = '#a68d59'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, -23); ctx.quadraticCurveTo(3 * fuse, -23 - 14 * fuse, 13 * fuse, -23 - 8 * fuse); ctx.stroke(); star(13 * fuse, -23 - 8 * fuse, 5, '#f5c569');
    }
    if (type === 'heavy') { ctx.strokeStyle = '#d8e2ee'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-10, 8); ctx.lineTo(0, 15); ctx.lineTo(10, 8); ctx.stroke(); }
    if (type === 'bouncy') { ctx.strokeStyle = '#f8e3ff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 17, .2, 1.1); ctx.arc(0, 0, 17, 2, 2.9); ctx.stroke(); }
    circle(-6, -2, 2.2, '#3e4e3f');
    if (face === 'wink') { ctx.strokeStyle = '#3e4e3f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(3, -2); ctx.lineTo(9, -2); ctx.stroke(); } else circle(6, -2, 2.2, '#3e4e3f');
    ctx.strokeStyle = '#694a3c'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(0, 3, 5, .2, Math.PI - .2); ctx.stroke();
    if (face === 'bow') { ctx.fillStyle = '#e85f92'; ctx.beginPath(); ctx.moveTo(-13, -16); ctx.lineTo(-22, -22); ctx.lineTo(-22, -10); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(-13, -16); ctx.lineTo(-5, -22); ctx.lineTo(-5, -10); ctx.closePath(); ctx.fill(); circle(-13, -16, 3, '#b63a6c'); }
    if (face === 'cap') { roundRect(-22, -20, 16, 7, 4, '#438eaa', '#286b86'); roundRect(-25, -14, 21, 3, 1, '#70bdce'); }
    ctx.restore();
    if (type === 'bomb') {
      const ratio = Math.max(0, Math.min(1, remaining / P.BOMB_FUSE));
      ctx.save(); ctx.strokeStyle = '#b2834166'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 29, 0, Math.PI * 2); ctx.stroke();
      if (ratio > 0) { ctx.strokeStyle = ratio < .34 ? '#e88552' : '#f4c14e'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, 29, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio); ctx.stroke(); }
      roundRect(x - 17, y - 65, 34, 23, 8, '#fff7d9', '#c59a51'); ctx.fillStyle = '#684d2e'; ctx.font = 'bold 16px "Segoe UI", sans-serif'; ctx.textAlign = 'center'; ctx.fillText(`${Math.ceil(remaining / 1000)}${loaded ? 's' : ''}`, x, y - 48); ctx.restore();
    }
  }
  function drawBody(b) {
    const d = b.game; if (!d || d.kind === 'ground') return;
    if (d.kind === 'pebble') {
      ctx.save(); if (d.fizzleAt !== undefined) ctx.globalAlpha = Math.max(0, 1 - (world.realTime - d.fizzleAt) / P.FIZZLE_TIME);
      pebble(b.position.x, b.position.y, b.angle, d.projectileType, false, Math.max(0, d.detonateAt - world.realTime), d.cosmetic || cosmetic); ctx.restore(); return;
    }
    ctx.save(); ctx.translate(b.position.x, b.position.y); ctx.rotate(b.angle);
    if (d.kind === 'fruit') {
      const r = d.radius, colors = { apple: '#e36d53', orange: '#f3a444', watermelon: '#81b85b', pea: '#85bd65', beachball: '#f5cf68' };
      circle(0, 0, r, colors[d.fruit]); ctx.strokeStyle = '#fff3c9'; ctx.lineWidth = 4;
      if (d.fruit === 'watermelon' || d.fruit === 'beachball') for (const x of [-r * .5, 0, r * .5]) { ctx.beginPath(); ctx.moveTo(x, -r * .8); ctx.quadraticCurveTo(x + 10, 0, x, r * .8); ctx.strokeStyle = d.fruit === 'watermelon' ? '#4d914f' : x === 0 ? '#df7f71' : '#68b5c8'; ctx.stroke(); }
      circle(-r * .3, -r * .3, r * .2, '#fff7d955');
      if (d.fruit !== 'beachball') { roundRect(-2, -r - 5, 5, 11, 2, '#7d684a'); ctx.fillStyle = '#629951'; ctx.beginPath(); ctx.ellipse(10, -r + 1, 10, 5, -.4, 0, 7); ctx.fill(); }
      circle(-8, -1, 2.5, '#3f5747'); circle(8, -1, 2.5, '#3f5747'); ctx.strokeStyle = '#3f5747'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 4, 7, .2, Math.PI - .2); ctx.stroke();
    } else if (d.kind === 'target') {
      circle(0, 0, 27 + (reducedMotion ? 0 : Math.sin(clock * 2.5 + d.seed) * 1.5), '#e8efca55'); circle(0, 0, 23, '#76a679');
      ctx.strokeStyle = '#507d5a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, 22, 0, 7); ctx.stroke();
      circle(-5, -6, 12, '#87b787'); star(0, -1, 13, '#ffeb9a'); circle(-8, 12, 1.6, '#355e45'); circle(8, 12, 1.6, '#355e45');
    } else {
      const w = d.width, h = d.height;
      if (d.kind === 'crate') {
        roundRect(-w / 2, -h / 2, w, h, 5, '#efbd55', '#ae833e');
        ctx.strokeStyle = '#fff0b5'; ctx.lineWidth = 3; ctx.strokeRect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10);
        circle(0, 0, 5, '#fff8d8'); ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ctx.moveTo(Math.cos(a) * 8, Math.sin(a) * 8); ctx.lineTo(Math.cos(a) * 15, Math.sin(a) * 15); } ctx.stroke();
      } else if (d.material === 'metal') {
        const silver = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
        silver.addColorStop(0, '#f3f6f8'); silver.addColorStop(.25, '#c3ccd4');
        silver.addColorStop(.48, '#edf1f4'); silver.addColorStop(.58, '#a6b2bd'); silver.addColorStop(1, '#87949f');
        roundRect(-w / 2, -h / 2, w, h, 5, silver, '#64727e');
        roundRect(-w / 2 + 2, -h / 2 + 2, w - 4, 3, 2, '#f8fafb');
      } else if (d.material === 'wood') {
        roundRect(-w / 2, -h / 2, w, h, 3, '#cd9b66', '#a4794e');
        ctx.strokeStyle = '#b88854'; ctx.lineWidth = 1.5;
        for (let i = -1; i <= 1; i++) { ctx.beginPath(); if (w > h) { ctx.moveTo(-w / 2 + 8, i * 5); ctx.bezierCurveTo(-15, i * 5 + 3, 15, i * 5 - 3, w / 2 - 8, i * 5); } else { ctx.moveTo(i * 5, -h / 2 + 8); ctx.bezierCurveTo(i * 5 + 3, -10, i * 5 - 3, 10, i * 5, h / 2 - 8); } ctx.stroke(); }
        circle(w > h ? -w / 2 + 9 : 0, w > h ? 0 : -h / 2 + 9, 2, '#97714c'); circle(w > h ? w / 2 - 9 : 0, w > h ? 0 : h / 2 - 9, 2, '#97714c');
      } else if (d.material === 'glass') {
        roundRect(-w / 2, -h / 2, w, h, 3, '#9ed1d3b8', '#65a4ad');
        ctx.strokeStyle = '#e1f3eacc'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-w / 2 + 5, h / 2 - 5); ctx.lineTo(Math.min(w / 2 - 5, -w / 2 + 17), -h / 2 + 5); ctx.stroke();
      } else {
        roundRect(-w / 2, -h / 2, w, h, 4, '#929ea0', '#6d7b7e'); ctx.fillStyle = '#a9b4b2'; ctx.fillRect(-w / 2 + 4, -h / 2 + 4, w - 8, 3);
        for (let i = 0; i < 4; i++) circle(-w / 3 + i * w / 5, (i % 2 ? 1 : -1) * h / 5, 1.5, '#788789');
      }
      PicnicDamage.draw(ctx, d);
      if (d.stopper) { circle(0, 0, Math.min(w, h) * .32, '#fff1b5'); ctx.fillStyle = '#a16b47'; ctx.font = `bold ${Math.max(13, Math.min(w, h) * .48)}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText('↗', 0, 5); }
      if (world.realTime < (d.reactionUntil || 0)) {
        const r = Math.max(2, Math.min(5, h * .22, w * .13)), gap = Math.min(10, w * .22);
        circle(-gap, 0, r + 1, '#fffbea'); circle(gap, 0, r + 1, '#fffbea'); circle(-gap, 0, r * .5, '#344e45'); circle(gap, 0, r * .5, '#344e45');
      }
    }
    ctx.restore();
  }
  function aim() {
    if (!aiming()) return;
    const path = P.predictTrajectory(pull.x, pull.y, world.selectedType, world.bodies());
    // Constant contrast and size in every theme. The path stops before contact;
    // rebounds and moving obstacles are intentionally left to the live physics.
    for (let i = 8; i < path.length; i += 8) {
      const p = path[i]; circle(p.x, p.y, 6.5, '#fffdf2'); circle(p.x, p.y, 4.2, '#315548');
    }
    const end = path[path.length - 1];
    if (path.length > 8) { circle(end.x, end.y, 8, '#fffdf2'); circle(end.x, end.y, 5.5, '#ce713e'); }
    ctx.strokeStyle = '#fff9e4'; ctx.lineWidth = 2; ctx.setLineDash([4, 5]); ctx.beginPath(); ctx.arc(SLING.x + pull.x, SLING.y + pull.y, 29, 0, 7); ctx.stroke(); ctx.setLineDash([]);
  }
  function burst(x, y, color, count) {
    if (reducedMotion) count = Math.min(5, count);
    for (let i = 0; i < count; i++) { const a = i * 2.39996, s = 45 + i % 6 * 21; particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 65, life: .7 + (i % 5) * .12, max: 1.2, color, size: 3 + i % 4 }); }
    if (particles.length > 260) particles.splice(0, particles.length - 260);
  }
  function updateAnimals() {
    if (!world.launches) return;
    for (const a of animals) if (!a.revealed && a.cover.every(c => {
      const b = world.bodies().find(b => b.game.seed === c.seed);
      return !b || Math.hypot(b.position.x - c.x, b.position.y - c.y) > c.distance;
    })) {
      a.revealed = true; a.revealedAt = world.realTime;
      tone(a.animal === 'duck' ? 480 : 580, .16, 'sine', .024, 0, 700);
      $('live-status').textContent = `Peekaboo! A friendly ${a.animal}!`;
    }
  }
  function drawExtras() {
    reactions = reactions.filter(r => world.realTime - r.born < 650);
    // Pieces that shatter in the same tick still leave a brief surprised face.
    for (const r of reactions) if (!world.bodies().some(b => b.game.seed === r.seed)) {
      circle(r.x - 7, r.y, 5, '#fffbea'); circle(r.x + 7, r.y, 5, '#fffbea');
      circle(r.x - 7, r.y, 2, '#344e45'); circle(r.x + 7, r.y, 2, '#344e45'); circle(r.x, r.y + 9, 3, '#344e45');
    }
    const basket = world.level.basket;
    if (basket) {
      const { x, y, w, h } = basket;
      ctx.strokeStyle = '#ab7a4c'; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(x, y - h / 2 + 6, w * .4, h * .5, 0, Math.PI, Math.PI * 2); ctx.stroke();
      roundRect(x - w / 2, y - h / 2 + 12, w, h - 12, 12, '#dfb57788', '#a77849');
      ctx.strokeStyle = '#a7784977'; ctx.lineWidth = 2;
      for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(x - w / 2 + i * w / 5, y - h / 2 + 14); ctx.lineTo(x - w / 2 + i * w / 5, y + h / 2 - 3); ctx.stroke(); }
      if (world.fruitCaught) star(x, y, 14, '#fff0a3');
    }
    flowers = flowers.filter(f => world.realTime - f.born < 6000);
    for (const f of flowers) {
      const grow = reducedMotion ? 1 : Math.min(1, (world.realTime - f.born) / 350);
      ctx.save(); ctx.translate(f.x, f.y); ctx.scale(grow, grow);
      ctx.strokeStyle = '#5d9c69'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -22); ctx.stroke();
      for (let i = 0; i < 5; i++) circle(Math.cos(i * Math.PI * .4) * 7, -23 + Math.sin(i * Math.PI * .4) * 7, 5, '#ed9db1');
      circle(0, -23, 4, '#ffed94'); ctx.restore();
    }
    for (const a of animals) if (a.revealed) {
      const waving = !reducedMotion && world.realTime - a.revealedAt < 1400;
      ctx.save(); ctx.translate(a.x, a.y + (waving ? Math.sin((world.realTime - a.revealedAt) / 110) * 3 : 0));
      if (a.animal === 'bunny') { ctx.fillStyle = '#fff0de'; ctx.beginPath(); ctx.ellipse(-8, -27, 6, 18, -.2, 0, 7); ctx.ellipse(8, -27, 6, 18, .2, 0, 7); ctx.fill(); }
      circle(0, 0, 21, a.animal === 'duck' ? '#f4d777' : '#fff0de'); circle(0, -14, 16, a.animal === 'duck' ? '#f9e696' : '#fff6e8');
      circle(-6, -16, 2.3, '#3a5648'); circle(6, -16, 2.3, '#3a5648');
      if (a.animal === 'duck') roundRect(-8, -10, 16, 6, 3, '#e8a45b'); else circle(0, -8, 3, '#df93a2');
      ctx.strokeStyle = a.animal === 'duck' ? '#e0b85d' : '#d7bba0'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(27, waving ? -12 + Math.sin(world.realTime / 80) * 7 : -10); ctx.stroke(); ctx.restore();
    }
    for (const b of world.bubbles) if (!b.popped) {
      circle(b.x, b.y, b.radius, '#c1eff647'); ctx.strokeStyle = '#fffdf5'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#559eb3'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(b.x, b.y, b.radius - 3, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#fffdf5'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(b.x - 3, b.y - 3, b.radius * .63, Math.PI, Math.PI * 1.45); ctx.stroke();
    }
  }
  function draw(dt) {
    ctx.clearRect(0, 0, WIDTH, HEIGHT); ctx.drawImage(background, 0, 0);
    cloud(270, 184, .8); cloud(560, 133, .55); cloud(871, 226, .65);
    ctx.save();
    if (!reducedMotion && clock < shakeUntil && world.state === 'flying' && !dragging) ctx.translate(Math.sin(clock * 71) * 1.5, Math.cos(clock * 63));
    drawExtras(); drawSling(true); aim();
    for (const rope of Matter.Composite.allConstraints(world.engine.world)) {
      if (!rope.bodyA || !rope.pointA || rope.length === 0) continue;
      const b = rope.bodyA, p = rope.pointA;
      ctx.strokeStyle = '#7d8c72'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(b.position.x + p.x, b.position.y + p.y); ctx.lineTo(rope.pointB.x, rope.pointB.y); ctx.stroke(); circle(rope.pointB.x, rope.pointB.y, 6, '#a5b393');
    }
    const projectile = world.activeProjectile;
    if (projectile && world.bodies().includes(projectile)) { trails.push({ x: projectile.position.x, y: projectile.position.y, life: .7 }); if (trails.length > 50) trails.shift(); }
    trails.forEach((p, i) => { p.life -= dt; circle(p.x, p.y, 2, `rgba(225,150,99,${Math.max(0, p.life / .7) * i / trails.length * .45})`); });
    trails = trails.filter(p => p.life > 0);
    world.bodies().forEach(drawBody);
    if (world.state === 'ready') pebble(SLING.x + pull.x, SLING.y + pull.y, -pull.y / 200, world.selectedType, true);
    drawSling(false);
    for (const wave of shockwaves) {
      wave.life -= dt;
      const progress = Math.min(1, 1 - wave.life / .42);
      ctx.globalAlpha = Math.max(0, wave.life / .42) * (reducedMotion ? .25 : 1);
      circle(wave.x, wave.y, 22 + wave.radius * progress * .75, '#ffdfa14a');
      ctx.strokeStyle = '#fff1c9'; ctx.lineWidth = 7 * (1 - progress) + 1;
      ctx.beginPath(); ctx.arc(wave.x, wave.y, 20 + wave.radius * progress, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1; shockwaves = shockwaves.filter(wave => wave.life > 0);
    for (const p of particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 250 * dt; ctx.globalAlpha = Math.max(0, Math.min(1, p.life / .45)); star(p.x, p.y, p.size, p.color, p.life * 2); }
    ctx.globalAlpha = 1; particles = particles.filter(p => p.life > 0);
    if (world.state === 'ready' && !easy && !dragging && world.hits === 0) {
      ctx.strokeStyle = '#6c8d5a'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(160, 428); ctx.quadraticCurveTo(118, 405, 100, 448); ctx.lineTo(101, 435); ctx.moveTo(100, 448); ctx.lineTo(113, 442); ctx.stroke();
      ctx.font = '600 14px "Segoe UI", sans-serif'; ctx.fillStyle = '#6c8d5a'; ctx.textAlign = 'center'; ctx.fillText('pull!', 115, 398);
    }
    ctx.restore();
    for (const s of flyingStars) { s.age += dt; const t = Math.min(1, s.age / .65), e = 1 - (1 - t) ** 3; star(s.x + (WIDTH - 95 - s.x) * e, s.y + (55 - s.y) * e - Math.sin(t * Math.PI) * 100, 12 * (1 - t * .4), '#f3bf4e', t * 3); }
    flyingStars = flyingStars.filter(s => s.age < .65);
  }
  function resize() {
    const scale = Math.min(2, window.devicePixelRatio || 1) * canvas.getBoundingClientRect().width / WIDTH;
    canvas.width = Math.round(WIDTH * scale); canvas.height = Math.round(HEIGHT * scale);
    ctx.setTransform(canvas.width / WIDTH, 0, 0, canvas.height / HEIGHT, 0, 0);
  }
  function loop(t) {
    const realDt = frameTime ? Math.max(0, (t - frameTime) / 1000) : 0;
    const dt = Math.min(realDt, .05); frameTime = t; clock += realDt;
    if ($('level-picker').hidden && !document.hidden) {
      if (easy && heldArrows.size && world.state === 'ready') {
        const previous = holdAge; holdAge += dt;
        const heldDt = Math.max(0, holdAge - .22) - Math.max(0, previous - .22);
        if (heldDt > 0) adjustAim(((heldArrows.has('ArrowUp') ? 1 : 0) - (heldArrows.has('ArrowDown') ? 1 : 0)) * 24 * heldDt,
          ((heldArrows.has('ArrowRight') ? 1 : 0) - (heldArrows.has('ArrowLeft') ? 1 : 0)) * 36 * heldDt);
      }
      accumulator += dt * 1000 * (!reducedMotion && clock < slowUntil ? .4 : 1);
      let steps = 0; while (accumulator >= P.STEP && steps++ < 6) { world.step(0); accumulator -= P.STEP; }
      world.advanceRealTime(realDt * 1000);
      updateAnimals();
      if (steps > 6) accumulator = 0;
      if (pendingWin) {
        pendingWin.age += realDt;
        if (pendingWin.level === world.levelIndex && pendingWin.age >= 1.7 && (!world.moving() || pendingWin.age >= 4.5)) {
          pendingWin = null; showOutcome(true);
        }
      }
    }
    $('skip-button').hidden = true;
    syncKeyboardAim(); updateUI(); draw(dt); requestAnimationFrame(loop);
  }
  updateMute(); updateMotion(); updateControls(); updateFaces(); load(0); resize(); window.addEventListener('resize', resize); requestAnimationFrame(loop);
  // Read-only diagnostics for playtests; normal controls use exactly the same simulator.
  window.picnic = Object.freeze({ snapshot: () => world.snapshot(), getPull: () => ({ ...pull, dragging }),
    getAim: () => ({ easy, angle: aimAngle, power: aimPower, aiming: aiming(), held: [...heldArrows], spaceDown }),
    diagnostics: () => ({ audioState: audio ? audio.state : 'not-started', muted, reducedMotion, coop, turn, tensionActive: !!tension,
      slowMotion: clock < slowUntil, pendingWinAge: pendingWin && pendingWin.age, completed: [...completed], particles: particles.length, pixelWidth: canvas.width,
      cosmetic, effectSounds: effectAudio.size, flowers: flowers.map(f => ({ ...f })), animals: animals.map(a => ({ animal: a.animal, x: a.x, y: a.y, revealed: a.revealed })), reactions: reactions.length }) });
})();
