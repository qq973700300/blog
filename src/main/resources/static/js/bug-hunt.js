(function () {
  'use strict';

  const ROUND_MS = 30000;
  const ACH_THRESHOLD = 15;
  const STORAGE_UNLOCKED = 'blog_local_ach_bug_master';
  const STORAGE_BEST = 'blog_bug_best_round';
  const STORAGE_TOTAL = 'blog_bug_total';

  const BUG_LABELS = ['bug', 'Bug', 'BUG'];
  const IDLE_MAX_BUGS = 2;
  const ROUND_MAX_BUGS = 5;

  let layer = null;
  let hud = null;
  let roundActive = false;
  let roundEnd = 0;
  let roundScore = 0;
  let spawnTimer = null;
  let roundTimer = null;
  let hudTimer = null;
  let decayTimer = null;
  let cleanLevel = 0;
  let bugId = 0;

  function ensureLayer() {
    if (layer) return layer;
    layer = document.getElementById('bug-hunt-layer');
    if (!layer) {
      layer = document.createElement('div');
      layer.id = 'bug-hunt-layer';
      layer.setAttribute('aria-hidden', 'true');
      document.body.appendChild(layer);
    }
    return layer;
  }

  function createHud() {
    if (hud) return;
    hud = document.createElement('div');
    hud.id = 'bug-hunt-hud';
    hud.className = 'bug-hunt-hud hidden';
    hud.innerHTML =
      '<span class="bug-hud-label">除虫中</span>' +
      '<span class="bug-hud-score">0</span>' +
      '<span class="bug-hud-timer">30s</span>';
    document.body.appendChild(hud);
  }

  function setCleanLevel(level) {
    cleanLevel = Math.max(0, Math.min(1, level));
    document.dispatchEvent(new CustomEvent('bug-hunt:clean-level', { detail: cleanLevel }));
  }

  function updateHud() {
    if (!hud) return;
    const scoreEl = hud.querySelector('.bug-hud-score');
    const timerEl = hud.querySelector('.bug-hud-timer');
    if (scoreEl) scoreEl.textContent = String(roundScore);
    if (timerEl && roundActive) {
      const left = Math.max(0, Math.ceil((roundEnd - Date.now()) / 1000));
      timerEl.textContent = left + 's';
    }
  }

  function showHud() {
    if (!hud) return;
    hud.classList.remove('hidden');
  }

  function hideHud() {
    if (!hud) return;
    hud.classList.add('hidden');
  }

  function countBugs() {
    return layer ? layer.querySelectorAll('.rain-bug').length : 0;
  }

  function spawnBug() {
    if (!document.body.classList.contains('boot-done')) return;
    const max = roundActive ? ROUND_MAX_BUGS : IDLE_MAX_BUGS;
    if (countBugs() >= max) return;

    ensureLayer();
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'rain-bug';
    el.textContent = BUG_LABELS[Math.floor(Math.random() * BUG_LABELS.length)];
    el.style.left = 4 + Math.random() * 92 + '%';
    el.style.animationDuration = (3.8 + Math.random() * 2.8) + 's';
    el.style.animationDelay = Math.random() * 0.4 + 's';
    el.dataset.bugId = String(++bugId);

    el.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      squashBug(el);
    });

    layer.appendChild(el);
    setTimeout(() => {
      if (el.isConnected) el.remove();
    }, 7500);
  }

  function scheduleSpawn() {
    clearTimeout(spawnTimer);
    const delay = roundActive ? 900 + Math.random() * 700 : 2200 + Math.random() * 1800;
    spawnTimer = setTimeout(() => {
      spawnBug();
      scheduleSpawn();
    }, delay);
  }

  function startRound() {
    if (roundActive) return;
    roundActive = true;
    roundScore = 0;
    roundEnd = Date.now() + ROUND_MS;
    showHud();
    updateHud();
    setCleanLevel(0);

    clearInterval(hudTimer);
    hudTimer = setInterval(updateHud, 200);

    clearTimeout(roundTimer);
    roundTimer = setTimeout(endRound, ROUND_MS);
  }

  function endRound() {
    roundActive = false;
    clearInterval(hudTimer);
    clearTimeout(roundTimer);
    hudTimer = null;
    roundTimer = null;

    const score = roundScore;
    hideHud();
    showRoundToast(score);
    recordStats(score);
    scheduleCleanDecay();
  }

  function scheduleCleanDecay() {
    clearTimeout(decayTimer);
    decayTimer = setTimeout(() => {
      setCleanLevel(0);
    }, 12000);
  }

  function recordStats(score) {
    const total = parseInt(localStorage.getItem(STORAGE_TOTAL) || '0', 10) + score;
    localStorage.setItem(STORAGE_TOTAL, String(total));

    const best = parseInt(localStorage.getItem(STORAGE_BEST) || '0', 10);
    if (score > best) {
      localStorage.setItem(STORAGE_BEST, String(score));
    }

    if (score >= ACH_THRESHOLD && localStorage.getItem(STORAGE_UNLOCKED) !== '1') {
      localStorage.setItem(STORAGE_UNLOCKED, '1');
      showAchievementToast();
      document.dispatchEvent(new CustomEvent('blog:local-achievement'));
    }
  }

  function squashBug(el) {
    if (!el.isConnected) return;

    if (!roundActive) startRound();

    roundScore += 1;
    setCleanLevel(Math.min(1, roundScore / ACH_THRESHOLD));
    updateHud();

    el.classList.add('squashed');
    spawnSquashFx(el);
    setTimeout(() => el.remove(), 220);
  }

  function spawnSquashFx(el) {
    const rect = el.getBoundingClientRect();
    const pop = document.createElement('span');
    pop.className = 'bug-squash-pop';
    pop.textContent = '+1';
    pop.style.left = rect.left + rect.width / 2 + 'px';
    pop.style.top = rect.top + 'px';
    document.body.appendChild(pop);
    setTimeout(() => pop.remove(), 700);
  }

  function showRoundToast(score) {
    const toast = document.createElement('div');
    toast.className = 'bug-round-toast';
    const best = parseInt(localStorage.getItem(STORAGE_BEST) || '0', 10);
    let msg = '本轮消灭 ' + score + ' 只 bug';
    if (score >= ACH_THRESHOLD) {
      msg += ' · 代码雨焕然一新！';
    } else if (score > 0) {
      msg += ' · 再练 ' + Math.max(0, ACH_THRESHOLD - score) + ' 只解锁除虫大师';
    } else {
      msg = '时间到！下次看准红色 bug 再点';
    }
    if (score > 0 && score === best) {
      msg += ' · 新纪录！';
    }
    toast.textContent = msg;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 400);
    }, 3200);
  }

  function showAchievementToast() {
    const toast = document.createElement('div');
    toast.className = 'bug-ach-toast';
    toast.innerHTML = '<span class="bug-ach-icon">🐛</span><span>成就解锁：除虫大师</span>';
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 400);
    }, 3600);
  }

  function start() {
    ensureLayer();
    createHud();
    scheduleSpawn();
  }

  if (document.body.classList.contains('boot-done')) {
    start();
  } else {
    document.addEventListener('blog:ready', start, { once: true });
  }

  window.BlogBugHunt = {
    getBestRound: () => parseInt(localStorage.getItem(STORAGE_BEST) || '0', 10),
    hasAchievement: () => localStorage.getItem(STORAGE_UNLOCKED) === '1',
  };
})();
