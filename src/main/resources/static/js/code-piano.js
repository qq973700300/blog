(function () {
  'use strict';

  const CHAR_NOTES = {
    '{': 196.0, '}': 220.0, '(': 246.94, ')': 261.63,
    '[': 293.66, ']': 329.63, ';': 349.23, ':': 369.99,
    ',': 392.0, '.': 415.3, '=': 440.0, '+': 466.16,
    '-': 493.88, '*': 523.25, '/': 554.37, '\\': 587.33,
    '<': 622.25, '>': 659.25, '|': 698.46, '&': 739.99,
    '#': 783.99, '@': 830.61, '$': 880.0, '%': 932.33,
    '!': 987.77, '?': 1046.5,
    '0': 261.63, '1': 277.18, '2': 293.66, '3': 311.13,
    '4': 329.63, '5': 349.23, '6': 369.99, '7': 392.0,
    '8': 415.3, '9': 440.0,
  };

  const DEFAULT_NOTE = 440.0;
  const STEP_MS = 110;

  class CodePiano {
    constructor() {
      this.ctx = null;
      this.playing = false;
    }

    ensureCtx() {
      if (!this.ctx) {
        this.ctx = new AudioContext();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return this.ctx;
    }

    playTone(freq, start, duration) {
      const ctx = this.ensureCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.14, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration + 0.02);
    }

    noteForChar(ch) {
      if (CHAR_NOTES[ch] !== undefined) return CHAR_NOTES[ch];
      const lower = ch.toLowerCase();
      if (lower >= 'a' && lower <= 'z') {
        return 220 + (lower.charCodeAt(0) - 97) * 18;
      }
      return DEFAULT_NOTE;
    }

    playCode(text) {
      if (this.playing || !text) return;
      this.playing = true;

      const ctx = this.ensureCtx();
      const chars = text.replace(/\s+/g, ' ').trim().slice(0, 120);
      let t = ctx.currentTime + 0.05;

      for (const ch of chars) {
        if (ch === ' ' || ch === '\n' || ch === '\t') {
          t += STEP_MS * 0.35 / 1000;
          continue;
        }
        this.playTone(this.noteForChar(ch), t, 0.09);
        t += STEP_MS / 1000;
      }

      setTimeout(() => {
        this.playing = false;
      }, (chars.length * STEP_MS) + 200);
    }

    attachTo(container) {
      if (!container) return;
      container.querySelectorAll('pre').forEach((pre) => {
        if (pre.closest('.code-block-wrap')) return;

        const wrap = document.createElement('div');
        wrap.className = 'code-block-wrap';
        pre.parentNode.insertBefore(wrap, pre);
        wrap.appendChild(pre);

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'code-piano-btn';
        btn.setAttribute('aria-label', '弹一弹这段代码');
        btn.title = '弹一弹这段代码';
        btn.textContent = '🎹';
        btn.addEventListener('click', () => {
          btn.classList.add('playing');
          const code = pre.querySelector('code');
          this.playCode(code ? code.textContent : pre.textContent);
          setTimeout(() => btn.classList.remove('playing'), 400);
        });
        wrap.appendChild(btn);
      });
    }
  }

  window.BlogCodePiano = new CodePiano();
})();
