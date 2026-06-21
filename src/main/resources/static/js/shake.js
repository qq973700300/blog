(function () {
  'use strict';

  const PARTICLES = ['🍃', '🍵', '🐧', '☕', '✨', '🫖'];
  const COOLDOWN_MS = 4000;
  const SPACE_THRESHOLD = 6;
  const SPACE_WINDOW_MS = 1200;
  const SHAKE_THRESHOLD = 14;

  let lastTrigger = 0;
  let spaceTimes = [];
  let lastAccel = { x: 0, y: 0, z: 0 };

  const hint = document.getElementById('music-hint');
  const stage = document.querySelector('.stage');

  function canTrigger() {
    return Date.now() - lastTrigger > COOLDOWN_MS;
  }

  function spawnParticles(count) {
    const layer = document.getElementById('party-layer') || createLayer();

    for (let i = 0; i < count; i++) {
      const p = document.createElement('span');
      p.className = 'party-particle';
      p.textContent = PARTICLES[Math.floor(Math.random() * PARTICLES.length)];
      p.style.left = 40 + Math.random() * 20 + '%';
      p.style.top = 35 + Math.random() * 25 + '%';
      p.style.setProperty('--dx', (Math.random() - 0.5) * 280 + 'px');
      p.style.setProperty('--dy', -80 - Math.random() * 220 + 'px');
      p.style.setProperty('--rot', (Math.random() - 0.5) * 540 + 'deg');
      p.style.animationDelay = Math.random() * 0.25 + 's';
      layer.appendChild(p);
      setTimeout(() => p.remove(), 1800);
    }
  }

  function createLayer() {
    const layer = document.createElement('div');
    layer.id = 'party-layer';
    layer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(layer);
    return layer;
  }

  function showPenguin() {
    const pop = document.createElement('div');
    pop.className = 'penguin-pop';
    pop.innerHTML = '<span class="penguin-emoji">🐧</span><span class="penguin-text">来杯好茶摇一摇！</span>';
    document.body.appendChild(pop);
    setTimeout(() => pop.classList.add('show'), 10);
    setTimeout(() => {
      pop.classList.remove('show');
      setTimeout(() => pop.remove(), 500);
    }, 1600);
  }

  function triggerParty(source) {
    if (!canTrigger() || !document.body.classList.contains('boot-done')) return;
    lastTrigger = Date.now();

    document.body.classList.add('shake-party');
    stage.classList.add('mega-bounce');
    spawnParticles(18);
    showPenguin();

    if (hint) {
      hint.textContent = source === 'shake' ? '📱 摇得好！好茶配好舞' : '🎉 空格摇茶模式 ON';
      hint.style.color = 'var(--neon-yellow)';
      setTimeout(() => {
        hint.style.color = '';
      }, 2000);
    }

    setTimeout(() => document.body.classList.remove('shake-party'), 500);
    setTimeout(() => stage.classList.remove('mega-bounce'), 700);
  }

  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || e.repeat) return;
    if (!document.body.classList.contains('boot-done')) return;

    const now = Date.now();
    spaceTimes = spaceTimes.filter((t) => now - t < SPACE_WINDOW_MS);
    spaceTimes.push(now);

    if (spaceTimes.length >= SPACE_THRESHOLD) {
      spaceTimes = [];
      triggerParty('space');
    }
  });

  if (window.DeviceMotionEvent) {
    window.addEventListener('devicemotion', (e) => {
      const a = e.accelerationIncludingGravity;
      if (!a) return;

      const dx = Math.abs(a.x - lastAccel.x);
      const dy = Math.abs(a.y - lastAccel.y);
      const dz = Math.abs(a.z - lastAccel.z);
      lastAccel = { x: a.x, y: a.y, z: a.z };

      if (dx + dy + dz > SHAKE_THRESHOLD) {
        triggerParty('shake');
      }
    });
  }
})();
