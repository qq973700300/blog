(function () {
  'use strict';

  /* 按视觉密度从暗到亮排列，越亮用越「密」的字符 */
  const CHARS_BY_LUM =
    ' .·\'`,:;!i1lI|\\/[]{}()jfLrtxnuvczXYUCJZF0*+#MW@$&%同羽whileforifelseasyncawait';

  class ProceduralSource {
    constructor() {
      this.canvas = document.createElement('canvas');
      this.canvas.width = 360;
      this.canvas.height = 202;
      this.ctx = this.canvas.getContext('2d');
      this.t = 0;
    }

    tick(dt) {
      this.t += dt;
      const w = this.canvas.width;
      const h = this.canvas.height;
      const ctx = this.ctx;
      const t = this.t;

      ctx.fillStyle = '#050810';
      ctx.fillRect(0, 0, w, h);

      for (let i = 0; i < 5; i++) {
        const px = w * (0.2 + 0.15 * i) + Math.sin(t * 1.4 + i * 1.7) * 40;
        const py = h * 0.55 + Math.cos(t * 2.1 + i * 0.9) * 25;
        const r = 28 + Math.sin(t + i) * 8;
        const g = ctx.createRadialGradient(px, py, 0, px, py, r * 2.2);
        const colors = ['#00f5ff', '#ff2d95', '#b44dff', '#39ff14', '#ffe600'];
        g.addColorStop(0, colors[i] + 'cc');
        g.addColorStop(0.45, colors[i] + '44');
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, py, r * 2.2, 0, Math.PI * 2);
        ctx.fill();
      }

      for (let d = 0; d < 3; d++) {
        const bx = w * (0.25 + d * 0.25) + Math.sin(t * 3 + d * 2) * 18;
        const by = h * 0.42 + Math.abs(Math.sin(t * 4 + d)) * 35;
        ctx.fillStyle = d === 0 ? '#00f5ff' : d === 1 ? '#ff2d95' : '#ffe600';
        ctx.fillRect(bx - 8, by, 16, 28);
        ctx.beginPath();
        ctx.arc(bx, by - 10, 11, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.strokeStyle = 'rgba(0, 245, 255, 0.25)';
      ctx.lineWidth = 2;
      for (let x = 0; x < w; x += 24) {
        ctx.beginPath();
        ctx.moveTo(x, h * 0.78 + Math.sin(t * 2 + x * 0.05) * 6);
        ctx.lineTo(x + 12, h * 0.78 + Math.sin(t * 2 + x * 0.05 + 1) * 6);
        ctx.stroke();
      }
    }
  }

  class AsciiVideo {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.video = document.getElementById('ascii-video-source');
      this.sample = document.createElement('canvas');
      this.sampleCtx = this.sample.getContext('2d', { willReadFrequently: true });
      this.procedural = new ProceduralSource();
      this.useProcedural = true;
      this.running = false;
      this.frameId = null;
      this.lastProc = 0;
      this.cellW = 12;
      this.cellH = 16;
      this.lumChars = CHARS_BY_LUM;
      this._warmedFor = null;

      this._bindVideo();
      this._applyDensity();
      window.addEventListener('resize', () => this._applyDensity());
    }

    _applyDensity() {
      const mobile = window.matchMedia('(max-width: 768px)').matches;
      const lowEnd = window.matchMedia('(max-width: 480px)').matches;
      this.cellW = lowEnd ? 16 : mobile ? 14 : 12;
      this.cellH = lowEnd ? 20 : mobile ? 18 : 16;
    }

    _bindVideo() {
      if (!this.video) return;
      this.video.addEventListener('loadeddata', () => {
        this.useProcedural = false;
      }, { passive: true });
      this.video.addEventListener('error', () => {
        this.useProcedural = true;
      }, { passive: true });
    }

    _boost(v) {
      return Math.min(255, Math.floor(v * 1.15 + 18));
    }

    _charForLum(lum) {
      const idx = Math.min(this.lumChars.length - 1, Math.floor((lum / 255) * (this.lumChars.length - 1)));
      return this.lumChars[idx];
    }

    _sourceReady() {
      if (this.useProcedural) return true;
      return this.video && this.video.readyState >= 2 && !this.video.error;
    }

    _drawSource(dt) {
      if (this.useProcedural || !this.video || this.video.error) {
        this.procedural.tick(dt);
        return this.procedural.canvas;
      }
      return this.video;
    }

    _paintFrame(targetCtx, w, h, dt) {
      const cols = Math.max(1, Math.floor(w / this.cellW));
      const rows = Math.max(1, Math.floor(h / this.cellH));

      this.sample.width = cols;
      this.sample.height = rows;

      const source = this._drawSource(dt);
      try {
        this.sampleCtx.drawImage(source, 0, 0, cols, rows);
      } catch (e) {
        this.useProcedural = true;
        this.procedural.tick(dt);
        this.sampleCtx.drawImage(this.procedural.canvas, 0, 0, cols, rows);
      }

      const data = this.sampleCtx.getImageData(0, 0, cols, rows).data;

      targetCtx.fillStyle = '#0a0e17';
      targetCtx.fillRect(0, 0, w, h);
      targetCtx.font = `${this.cellH}px "JetBrains Mono", monospace`;
      targetCtx.textBaseline = 'top';

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = (y * cols + x) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const lum = r * 0.299 + g * 0.587 + b * 0.114;
          if (lum < 14) continue;

          targetCtx.fillStyle = `rgb(${this._boost(r)},${this._boost(g)},${this._boost(b)})`;
          targetCtx.fillText(this._charForLum(lum), x * this.cellW, y * this.cellH);
        }
      }
    }

    _renderFrame(dt) {
      if (!this.running) return;

      const w = this.canvas.width;
      const h = this.canvas.height;
      this._paintFrame(this.ctx, w, h, dt);

      this.frameId = requestAnimationFrame((ts) => {
        const delta = this.lastProc ? (ts - this.lastProc) / 1000 : 0.016;
        this.lastProc = ts;
        this._renderFrame(Math.min(delta, 0.05));
      });
    }

    /** 视频就绪后在离屏 canvas 预跑一帧，预热字体/解码/绘制，不影响代码雨 */
    async warmFirstFrame() {
      const mediaV = window.blogMediaVersion ? window.blogMediaVersion() : '1';
      if (this._warmedFor === mediaV) return;

      if (document.fonts && document.fonts.ready) {
        try {
          await document.fonts.ready;
        } catch (e) {
          /* ignore */
        }
      }

      const video = this.video;
      if (!video || video.error || this.useProcedural) return;

      if (video.readyState < 2) {
        await new Promise((resolve) => {
          const done = () => {
            video.removeEventListener('loadeddata', done);
            video.removeEventListener('error', done);
            resolve();
          };
          video.addEventListener('loadeddata', done, { passive: true });
          video.addEventListener('error', done, { passive: true });
        });
      }

      if (!video.videoWidth || video.error) return;

      this._applyDensity();
      const w = this.canvas.width || window.innerWidth;
      const h = this.canvas.height || window.innerHeight;
      if (w < 1 || h < 1) return;

      const off = document.createElement('canvas');
      off.width = w;
      off.height = h;
      const offCtx = off.getContext('2d');
      if (!offCtx) return;

      try {
        this._paintFrame(offCtx, w, h, 0.016);
        this._warmedFor = mediaV;
      } catch (e) {
        /* ignore warmup failure */
      }
    }

    start() {
      if (this.running || !this.canvas) return;
      this.running = true;
      this.lastProc = 0;
      document.body.classList.add('ascii-video-active');
      this._renderFrame(0.016);
    }

    stop() {
      this.running = false;
      if (this.frameId) {
        cancelAnimationFrame(this.frameId);
        this.frameId = null;
      }
      document.body.classList.remove('ascii-video-active');
    }

    isRunning() {
      return this.running;
    }

    setUseProcedural(value) {
      this.useProcedural = !!value;
    }
  }

  const canvas = document.getElementById('code-rain');
  if (!canvas) return;

  const player = new AsciiVideo(canvas);
  window.BlogAsciiVideo = player;

  document.addEventListener('blog:music-playing', (e) => {
    if (!document.body.classList.contains('boot-done')) return;
    if (e.detail && e.detail.playing) {
      if (window.CodeRain) window.CodeRain.stop();
      player.start();
    } else {
      player.stop();
      if (window.CodeRain) window.CodeRain.start();
    }
  });
})();
