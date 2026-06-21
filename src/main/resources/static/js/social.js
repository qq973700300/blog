(function () {
  'use strict';

  const MOODS = [
    { key: 'CODING', label: '写码中', icon: '💻' },
    { key: 'SLACKING', label: '摸鱼中', icon: '🐟' },
    { key: 'TEA', label: '喝茶中', icon: '🍵' },
    { key: 'DANCING', label: '跳舞中', icon: '💃' },
  ];

  const ACHIEVEMENT_ICONS = {
    DEBUT: '🎭',
    CHATTERBOX: '💬',
    CLAP_MASTER: '👏',
    TEA_SOUL: '🍵',
    DANCE_KING: '💃',
    ON_STAGE: '🌟',
    BUG_MASTER: '🐛',
  };

  const LOCAL_ACHIEVEMENTS = {
    BUG_MASTER: {
      key: 'BUG_MASTER',
      title: '除虫大师',
      description: '30 秒内消灭 15 只 bug',
    },
  };

  function getLocalAchievements() {
    const list = [];
    if (localStorage.getItem('blog_local_ach_bug_master') === '1') {
      list.push(LOCAL_ACHIEVEMENTS.BUG_MASTER);
    }
    return list;
  }

  function mergeAchievements(serverList) {
    const local = getLocalAchievements();
    const server = serverList || [];
    const seen = new Set(local.map((a) => a.key));
    return local.concat(server.filter((a) => !seen.has(a.key)));
  }

  const panel = document.getElementById('social-panel');
  const toggle = document.getElementById('social-toggle');
  const highFiveBtn = document.getElementById('high-five-btn');
  const highFiveCount = document.getElementById('high-five-count');
  const messageForm = document.getElementById('message-form');
  const nicknameInput = document.getElementById('msg-nickname');
  const contentInput = document.getElementById('msg-content');
  const danmakuLayer = document.getElementById('danmaku-layer');
  const moodBars = document.getElementById('mood-bars');
  const leaderboardBox = document.getElementById('leaderboard-box');
  const achievementBox = document.getElementById('achievement-box');

  let shownIds = new Set();
  let danmakuQueue = [];
  let danmakuTimer = null;

  function api(path, options) {
    return fetch('/api/social' + path, options).then((r) => {
      if (!r.ok) throw new Error('request failed');
      return r.json();
    });
  }

  function getNickname() {
    return nicknameInput.value.trim();
  }

  function loadNickname() {
    const saved = localStorage.getItem('blog_nickname');
    if (saved) nicknameInput.value = saved;
  }

  function consumeArticleShare() {
    const pending = localStorage.getItem('blog_pending_msg');
    const openSocial = localStorage.getItem('blog_open_social');
    if (pending && contentInput) {
      contentInput.value = pending.slice(0, 40);
      localStorage.removeItem('blog_pending_msg');
    }
    if (openSocial === '1' && panel && toggle) {
      panel.classList.add('open');
      toggle.classList.add('active');
      localStorage.removeItem('blog_open_social');
      if (contentInput) contentInput.focus();
    }
  }

  function saveNickname() {
    localStorage.setItem('blog_nickname', nicknameInput.value.trim());
  }

  function requireNickname() {
    const nick = getNickname();
    if (!nick) {
      showToast('请先填写昵称再互动 🎭');
      nicknameInput.focus();
      return null;
    }
    return nick;
  }

  function showToast(text) {
    const t = document.createElement('div');
    t.className = 'social-toast';
    t.textContent = text;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 400);
    }, 2800);
  }

  function showAchievements(list) {
    if (!list || !list.length) return;
    list.forEach((a, i) => {
      setTimeout(() => {
        const icon = ACHIEVEMENT_ICONS[a.key] || '🏅';
        showToast(`${icon} 成就解锁：${a.title}`);
      }, i * 600);
    });
    loadAchievements();
  }

  function renderMoods(moods) {
    if (!moodBars || !moods) return;
    const total = Object.values(moods).reduce((a, b) => a + b, 0) || 1;
    moodBars.innerHTML = MOODS.map((m) => {
      const count = moods[m.key] || 0;
      const pct = Math.round((count / total) * 100);
      return `<div class="mood-row">
        <button type="button" class="mood-btn" data-mood="${m.key}">${m.icon} ${m.label}</button>
        <div class="mood-track"><div class="mood-fill" style="width:${pct}%"></div></div>
        <span class="mood-num">${count}</span>
      </div>`;
    }).join('');

    moodBars.querySelectorAll('.mood-btn').forEach((btn) => {
      btn.addEventListener('click', () => voteMood(btn.dataset.mood));
    });
  }

  function renderLeaderboard(board) {
    if (!leaderboardBox || !board) return;

    const msgRows = (board.messageKings || []).map((e, i) =>
      `<li><span class="lb-rank">${i + 1}</span><span class="lb-name">${escapeHtml(e.nickname)}</span><span class="lb-score">${e.messages} 条</span></li>`
    ).join('') || '<li class="lb-empty">暂无留言王</li>';

    const clapRows = (board.clapKings || []).map((e, i) =>
      `<li><span class="lb-rank">${i + 1}</span><span class="lb-name">${escapeHtml(e.nickname)}</span><span class="lb-score">${e.highFives} 掌</span></li>`
    ).join('') || '<li class="lb-empty">暂无击掌王</li>';

    leaderboardBox.innerHTML = `
      <div class="lb-col">
        <h4>💬 留言王</h4>
        <ol>${msgRows}</ol>
      </div>
      <div class="lb-col">
        <h4>👏 击掌王</h4>
        <ol>${clapRows}</ol>
      </div>`;
  }

  function renderAchievements(list) {
    if (!achievementBox) return;
    const merged = mergeAchievements(list);
    if (!merged.length) {
      achievementBox.innerHTML = '<p class="ach-empty">还没有成就，快去互动吧</p>';
      return;
    }
    achievementBox.innerHTML = merged.map((a) => {
      const icon = ACHIEVEMENT_ICONS[a.key] || '🏅';
      return `<span class="ach-badge" title="${escapeHtml(a.description)}">${icon} ${escapeHtml(a.title)}</span>`;
    }).join('');
  }

  function updateStats(stats) {
    highFiveCount.textContent = `今日击掌 ${stats.highFiveCount}`;
    renderMoods(stats.moods);
    window.__blogStats = stats;
  }

  function handleActionResult(result) {
    if (result.stats) updateStats(result.stats);
    if (result.leaderboard) renderLeaderboard(result.leaderboard);
    showAchievements(result.newAchievements);
  }

  function spawnDanmaku(msg) {
    if (!danmakuLayer || shownIds.has(msg.id)) return;
    shownIds.add(msg.id);

    const el = document.createElement('div');
    el.className = 'danmaku-item';
    el.style.color = msg.color;
    el.style.top = 8 + Math.random() * 72 + '%';
    el.style.animationDuration = 9 + Math.random() * 7 + 's';
    el.innerHTML = `<span class="dm-nick">${escapeHtml(msg.nickname)}</span><span class="dm-text">${escapeHtml(msg.content)}</span>`;
    danmakuLayer.appendChild(el);
    setTimeout(() => el.remove(), 16000);
  }

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function queueDanmaku(messages) {
    messages.forEach((m) => {
      if (!shownIds.has(m.id)) danmakuQueue.push(m);
    });
    if (!danmakuTimer) drainDanmaku();
  }

  function drainDanmaku() {
    if (danmakuQueue.length === 0) {
      danmakuTimer = null;
      return;
    }
    const msg = danmakuQueue.shift();
    spawnDanmaku(msg);
    danmakuTimer = setTimeout(drainDanmaku, 1800 + Math.random() * 1200);
  }

  function loadAchievements() {
    const nick = getNickname();
    if (!nick) {
      renderAchievements([]);
      return;
    }
    api('/achievements?nickname=' + encodeURIComponent(nick))
      .then((list) => renderAchievements(list))
      .catch(() => renderAchievements([]));
  }

  function refresh(retries) {
    const left = retries == null ? 3 : retries;
    return Promise.all([
      api('/stats').then(updateStats),
      api('/messages').then(queueDanmaku),
      api('/leaderboard').then(renderLeaderboard),
    ])
      .then(() => loadAchievements())
      .catch(() => {
        if (left > 0) {
          setTimeout(() => refresh(left - 1), 1500);
        }
      });
  }

  function highFive() {
    const nickname = requireNickname();
    if (!nickname) return;

    saveNickname();
    highFiveBtn.classList.add('bump');
    setTimeout(() => highFiveBtn.classList.remove('bump'), 300);

    api('/high-five', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname }),
    })
      .then(handleActionResult)
      .catch(() => {});
  }

  function voteMood(mood) {
    const nickname = requireNickname();
    if (!nickname) return;

    saveNickname();
    api('/mood', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mood, nickname }),
    })
      .then(handleActionResult)
      .catch(() => {});
  }

  function postMessage(e) {
    e.preventDefault();
    saveNickname();
    const nickname = getNickname();
    const content = contentInput.value.trim();
    if (!nickname || !content) return;

    api('/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname, content }),
    })
      .then((result) => {
        contentInput.value = '';
        spawnDanmaku(result.message);
        handleActionResult(result);
        if (window.BlogDancers) window.BlogDancers.refresh();
      })
      .catch(() => {});
  }

  function togglePanel() {
    if (!panel || !toggle) return;
    panel.classList.toggle('open');
    toggle.classList.toggle('active');
  }

  function bindEvents() {
    if (!toggle || !panel) return;

    toggle.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (!document.body.classList.contains('boot-done')) return;
      togglePanel();
    });

    if (nicknameInput) nicknameInput.addEventListener('change', loadAchievements);
    document.addEventListener('blog:local-achievement', loadAchievements);
    if (highFiveBtn) highFiveBtn.addEventListener('click', highFive);
    if (messageForm) messageForm.addEventListener('submit', postMessage);
  }

  function startSocial() {
    bindEvents();
    loadNickname();
    consumeArticleShare();
    refresh();
    setInterval(refresh, 30000);
  }

  if (document.body.classList.contains('boot-done')) {
    startSocial();
  } else {
    document.addEventListener('blog:ready', startSocial, { once: true });
  }

  window.BlogSocial = { refresh, getStats: () => window.__blogStats };
})();
