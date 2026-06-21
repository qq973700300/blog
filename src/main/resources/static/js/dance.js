(function () {
  'use strict';

  /* ---- 代码雨 ---- */
  const canvas = document.getElementById('code-rain');
  const ctx = canvas.getContext('2d');

  const chars = '01{}[]<>/\\|@#$%&*+=~同羽whileforifelsefunctionclassreturnasyncawait';
  const fontSize = 14;
  let columns = 0;
  let drops = [];
  let cleanLevel = 0;
  let rainTimer = null;

  function startRain() {
    if (rainTimer) return;
    rainTimer = setInterval(drawRain, 50);
  }

  function stopRain() {
    if (rainTimer) {
      clearInterval(rainTimer);
      rainTimer = null;
    }
  }

  window.CodeRain = {
    start: startRain,
    stop: stopRain,
  };

  document.addEventListener('bug-hunt:clean-level', (e) => {
    cleanLevel = Math.max(0, Math.min(1, Number(e.detail) || 0));
    const canvas = document.getElementById('code-rain');
    if (canvas) {
      canvas.style.opacity = String(0.35 + cleanLevel * 0.4);
    }
  });

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    columns = Math.floor(canvas.width / fontSize);
    drops = Array.from({ length: columns }, () => Math.random() * -50);
  }

  function drawRain() {
    const trailAlpha = 0.08 - cleanLevel * 0.035;
    ctx.fillStyle = `rgba(10, 14, 23, ${Math.max(0.03, trailAlpha)})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = fontSize + 'px monospace';

    const neonCutoff = 0.85 - cleanLevel * 0.22;
    const midCutoff = 0.55 - cleanLevel * 0.18;

    for (let i = 0; i < columns; i++) {
      const char = chars[Math.floor(Math.random() * chars.length)];
      const x = i * fontSize;
      const y = drops[i] * fontSize;

      const brightness = Math.random();
      if (brightness > 0.95 - cleanLevel * 0.08) {
        ctx.fillStyle = '#ff2d95';
      } else if (brightness > neonCutoff) {
        ctx.fillStyle = cleanLevel > 0.55 ? '#39ff14' : '#00f5ff';
      } else if (brightness > midCutoff) {
        ctx.fillStyle = cleanLevel > 0.25 ? '#2a5a6a' : '#1a3a2a';
      } else {
        ctx.fillStyle = cleanLevel > 0.5 ? '#1a4a3a' : '#0d2818';
      }

      ctx.fillText(char, x, y);

      if (y > canvas.height && Math.random() > 0.975) {
        drops[i] = 0;
      }
      drops[i]++;
    }
  }

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  startRain();

  /* ---- 节拍指示器 ---- */
  const dots = document.querySelectorAll('.beat-dot');
  const heights = [12, 20, 28, 20, 12, 24, 16, 32];
  let beatIndex = 0;
  let visualTimer = null;

  function pulseBeat() {
    dots.forEach(d => d.classList.remove('active'));
    dots.forEach((dot, i) => {
      dot.style.height = heights[(beatIndex + i) % heights.length] + 'px';
      if (i === beatIndex % dots.length) {
        dot.classList.add('active');
      }
    });
    beatIndex++;

    if (beatIndex % 4 === 1) {
      stage.classList.add('beat-hit');
      setTimeout(() => stage.classList.remove('beat-hit'), 80);
    }

    document.body.classList.toggle('on-beat', true);
    requestAnimationFrame(() => document.body.classList.toggle('on-beat', false));
  }

  function startVisualBeat() {
    stopVisualBeat();
    const interval = 60000 / 128;
    visualTimer = setInterval(pulseBeat, interval);
    pulseBeat();
  }

  function stopVisualBeat() {
    if (visualTimer) {
      clearInterval(visualTimer);
      visualTimer = null;
    }
  }

  /* ---- 音乐控制 ---- */
  const playBtn = document.getElementById('play-btn');
  const musicControls = document.getElementById('music-controls');
  const hint = document.getElementById('music-hint');
  const stage = document.querySelector('.stage');

  const music = new DanceMusic();

  let isPlaying = false;

  async function tryStartPlayback() {
    if (isPlaying) return;

    music.unlockFromGesture();

    if (window.BlogMediaLoader) {
      await window.BlogMediaLoader.load();
    }

    const state = music.tryPlayVideoSync();

    if (state === 'playing') {
      startVisualBeat();
      setPlayingUI();
      return;
    }

    if (state === 'loading') {
      music.onMp3Started(() => {
        startVisualBeat();
        setPlayingUI();
      });
      hint.textContent = '视频启动中...';
      hint.style.opacity = '1';
      startVisualBeat();
      return;
    }

    hint.textContent = '播放失败，请再点一次 ▶';
    hint.style.opacity = '1';
    startVisualBeat();
  }

  function setPlayingUI() {
    isPlaying = true;
    musicControls.classList.add('playing');
    playBtn.classList.add('playing');
    playBtn.querySelector('.play-icon').textContent = '⏸';
    playBtn.querySelector('.play-label').textContent = '暂停';
    hint.textContent = '♪ 视频原声';
    hint.style.opacity = '0.7';
    document.dispatchEvent(new CustomEvent('blog:music-playing', { detail: { playing: true } }));
  }

  function setStoppedUI() {
    isPlaying = false;
    musicControls.classList.remove('playing');
    playBtn.classList.remove('playing');
    playBtn.querySelector('.play-icon').textContent = '▶';
    playBtn.querySelector('.play-label').textContent = '播放';
    hint.textContent = '点击 ▶ 让代码跳起来 · 连按空格有彩蛋 · 点红色 bug 除虫';
    hint.style.opacity = '1';
    document.dispatchEvent(new CustomEvent('blog:music-playing', { detail: { playing: false } }));
    startVisualBeat();
  }

  function toggleMusic() {
    if (isPlaying) {
      music.stop();
      setStoppedUI();
    } else {
      tryStartPlayback();
    }
  }

  playBtn.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    toggleMusic();
  });

  document.addEventListener('blog:unlock-audio', () => music.unlockFromGesture());

  startVisualBeat();
})();
