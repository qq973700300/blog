/* 反方向钟（复古挂钟风格）—— 用于开机加载界面
   - 罗马数字与指针均逆时针运行，走的仍是真实时刻
   - 纯 Canvas 无依赖；body 加 boot-done 后自动停止渲染释放资源 */
(function () {
  'use strict';

  function init(canvas, sizePx) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = sizePx;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let stopped = false;

    function draw(now) {
      if (stopped) return;
      /* 进站后停止渲染 */
      if (document.body.classList.contains('boot-done')) { stopped = true; return; }

      const cx = size / 2, cy = size / 2;
      const R = size / 2 - 20;
      ctx.clearRect(0, 0, size, size);

      /* 表盘底（复古米白羊皮纸） */
      const g = ctx.createRadialGradient(cx, cy - R * 0.15, R * 0.1, cx, cy, R);
      g.addColorStop(0, '#f3ecdc');
      g.addColorStop(0.75, '#e8ddc6');
      g.addColorStop(1, '#d9cbb0');
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();

      /* 加厚金属边框（银灰渐变，双环造型） */
      const bezelW = Math.max(12, size * 0.055);
      const bezelGrad = ctx.createLinearGradient(0, 0, size, size);
      bezelGrad.addColorStop(0, '#e2e8f2');
      bezelGrad.addColorStop(0.35, '#9aa5ba');
      bezelGrad.addColorStop(0.65, '#d7deea');
      bezelGrad.addColorStop(1, '#7e889d');
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.lineWidth = bezelW;
      ctx.strokeStyle = bezelGrad;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, R - bezelW / 2 - 1, 0, Math.PI * 2);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(20, 28, 42, 0.8)';
      ctx.stroke();

      /* 刻度 */
      for (let i = 0; i < 60; i++) {
        const major = i % 5 === 0;
        const a = -i * (Math.PI * 2 / 60) - Math.PI / 2;
        const r1 = R - bezelW / 2 - (major ? 18 : 9);
        const r2 = R - bezelW / 2 - 4;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
        ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
        ctx.lineWidth = major ? 2.5 : 1;
        ctx.strokeStyle = major ? 'rgba(58, 51, 42, 0.85)' : 'rgba(58, 51, 42, 0.35)';
        ctx.stroke();
      }

      /* 罗马数字（逆时针排布：I 在左，XII 在上） */
      const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
      ctx.font = '600 ' + Math.round(size * 0.055) + 'px "JetBrains Mono", "Times New Roman", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let n = 1; n <= 12; n++) {
        const a = -n * (Math.PI * 2 / 12) - Math.PI / 2 + Math.PI * 2 / 12;
        const r = R - bezelW / 2 - 38;
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        ctx.fillStyle = 'rgba(58, 51, 42, 0.92)';
        ctx.fillText(ROMAN[n], x, y);
      }

      /* 当前时刻（逆转显示） */
      const ms = now.getMilliseconds();
      const s = now.getSeconds() + ms / 1000;
      const m = now.getMinutes() + s / 60;
      const h = (now.getHours() % 12) + m / 60;

      hand(-h * (Math.PI * 2 / 12) - Math.PI / 2, R * 0.5, 7, '#332c22');
      hand(-m * (Math.PI * 2 / 60) - Math.PI / 2, R * 0.72, 5, '#332c22');
      secondHand(-s * (Math.PI * 2 / 60) - Math.PI / 2, R * 0.85, '#8f3a2c');

      function hand(angle, len, baseW, color) {
        const tail = len * 0.2;
        const bx = Math.cos(angle), by = Math.sin(angle);
        const px = -by, py = bx;
        ctx.beginPath();
        ctx.moveTo(cx - bx * tail + px * baseW * 0.45, cy - by * tail + py * baseW * 0.45);
        ctx.lineTo(cx + bx * len * 0.92, cy + by * len * 0.92);
        ctx.lineTo(cx + bx * len, cy + by * len);
        ctx.lineTo(cx - bx * tail - px * baseW * 0.45, cy - by * tail - py * baseW * 0.45);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
      }

      function secondHand(angle, len, color) {
        const tail = len * 0.22;
        const bx = Math.cos(angle), by = Math.sin(angle);
        ctx.beginPath();
        ctx.moveTo(cx - bx * tail, cy - by * tail);
        ctx.lineTo(cx + bx * len, cy + by * len);
        ctx.lineCap = 'round';
        ctx.lineWidth = 1.8;
        ctx.strokeStyle = color;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx - bx * tail * 0.55, cy - by * tail * 0.55, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      }

      /* 黄铜中心铆钉 */
      const pinGrad = ctx.createRadialGradient(cx - 1.5, cy - 1.5, 1, cx, cy, 6);
      pinGrad.addColorStop(0, '#e8d9a8');
      pinGrad.addColorStop(0.6, '#b89a5e');
      pinGrad.addColorStop(1, '#7a6238');
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fillStyle = pinGrad;
      ctx.fill();
    }

    (function loop() {
      if (stopped) return;
      draw(new Date());
      requestAnimationFrame(loop);
    })();

    return function stop() { stopped = true; };
  }

  window.ReverseClock = { init: init };
})();
