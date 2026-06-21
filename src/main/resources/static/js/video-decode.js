(function () {
  'use strict';

  const CHARS =
    ' .·\'`,:;!i1lI|\\/[]{}()jfLrtxnuvczXYUCJZF0*+#MW@$&%同羽whileforifelseasyncawait';

  let player = null;

  function createPlayer(canvas, video) {
    const ctx = canvas.getContext('2d');
    const sample = document.createElement('canvas');
    const sampleCtx = sample.getContext('2d', { willReadFrequently: true });
    let running = false;
    let frameId = null;
    let lastTs = 0;
    let cellW = 12;
    let cellH = 16;

    function applyDensity() {
      const mobile = window.matchMedia('(max-width: 768px)').matches;
      cellW = mobile ? 14 : 12;
      cellH = mobile ? 18 : 16;
    }

    applyDensity();
    window.addEventListener('resize', applyDensity);

    function boost(v) {
      return Math.min(255, Math.floor(v * 1.15 + 18));
    }

    function charForLum(lum) {
      const idx = Math.min(CHARS.length - 1, Math.floor((lum / 255) * (CHARS.length - 1)));
      return CHARS[idx];
    }

    function renderFrame() {
      if (!running) return;

      const w = canvas.width;
      const h = canvas.height;
      const cols = Math.max(1, Math.floor(w / cellW));
      const rows = Math.max(1, Math.floor(h / cellH));
      sample.width = cols;
      sample.height = rows;

      try {
        sampleCtx.drawImage(video, 0, 0, cols, rows);
      } catch (e) {
        running = false;
        return;
      }

      const data = sampleCtx.getImageData(0, 0, cols, rows).data;
      ctx.fillStyle = '#0a0e17';
      ctx.fillRect(0, 0, w, h);
      ctx.font = `${cellH}px "JetBrains Mono", monospace`;
      ctx.textBaseline = 'top';

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = (y * cols + x) * 4;
          const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
          if (lum < 14) continue;
          ctx.fillStyle = `rgb(${boost(data[i])},${boost(data[i + 1])},${boost(data[i + 2])})`;
          ctx.fillText(charForLum(lum), x * cellW, y * cellH);
        }
      }

      frameId = requestAnimationFrame(renderFrame);
    }

    return {
      start() {
        if (running) return;
        running = true;
        lastTs = 0;
        video.muted = false;
        video.volume = 1;
        video.removeAttribute('muted');
        video.currentTime = 0;
        video.play().catch(() => {});
        renderFrame();
      },
      stop() {
        running = false;
        if (frameId) {
          cancelAnimationFrame(frameId);
          frameId = null;
        }
        video.pause();
        video.muted = true;
      },
    };
  }

  function ensureModal() {
    let modal = document.getElementById('video-decode-modal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'video-decode-modal';
    modal.className = 'video-decode-modal';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="video-decode-backdrop"></div>
      <div class="video-decode-panel" role="dialog" aria-modal="true" aria-label="ASCII 视频解码">
        <div class="video-decode-header">
          <h3 id="video-decode-title">ASCII 解码播放</h3>
          <button type="button" class="video-decode-close" aria-label="关闭">✕</button>
        </div>
        <canvas id="video-decode-canvas" class="video-decode-canvas"></canvas>
        <video id="video-decode-source" class="video-decode-source" playsinline></video>
        <p class="video-decode-hint">字符画实时解码 · 播放 MP4 原声 · 点击关闭或按 Esc 退出</p>
      </div>
    `;
    document.body.appendChild(modal);

    const close = () => {
      if (player) player.stop();
      modal.hidden = true;
      document.body.classList.remove('video-decode-open');
    };

    modal.querySelector('.video-decode-backdrop').addEventListener('click', close);
    modal.querySelector('.video-decode-close').addEventListener('click', close);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.hidden) close();
    });

    return modal;
  }

  function openDecode(url, title) {
    const modal = ensureModal();
    const canvas = document.getElementById('video-decode-canvas');
    const video = document.getElementById('video-decode-source');
    const titleEl = document.getElementById('video-decode-title');

    if (player) player.stop();

    titleEl.textContent = title || 'ASCII 解码播放';
    canvas.width = Math.min(window.innerWidth - 48, 720);
    canvas.height = Math.round(canvas.width * 9 / 16);

    video.src = url;
    video.load();

    modal.hidden = false;
    document.body.classList.add('video-decode-open');

    const onReady = () => {
      video.removeEventListener('loadeddata', onReady);
      player = createPlayer(canvas, video);
      player.start();
    };
    if (video.readyState >= 2) {
      player = createPlayer(canvas, video);
      player.start();
    } else {
      video.addEventListener('loadeddata', onReady);
    }
  }

  window.BlogVideoDecode = { open: openDecode };
})();
