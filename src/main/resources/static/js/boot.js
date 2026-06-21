(function () {
  'use strict';

  const BOOT_LINES = [
    { text: '> booting xiewenwen.xyz ...', delay: 0, pause: 420 },
    { text: '> loading dance.module ........ OK', delay: 0, pause: 380 },
    { text: '> loading music.module ........ OK', delay: 0, pause: 380 },
    { text: '> loading blog-engine ....... OK', delay: 0, pause: 380 },
    { text: '> initializing code-rain ...... OK', delay: 0, pause: 420 },
    { text: '> tip: 连按空格 · 摇一摇有彩蛋 🐧', delay: 0, pause: 520, cls: 'boot-tip' },
    { text: '> tip: 代码雨里的红色 bug，点它除虫 🐛', delay: 0, pause: 480, cls: 'boot-tip' },
    { text: '> 按 Enter 或点击屏幕进入 ↵', delay: 0, pause: 0, cls: 'boot-enter' },
  ];

  const screen = document.getElementById('boot-screen');
  const output = document.getElementById('boot-output');
  const cursor = document.querySelector('.boot-cursor');
  if (!screen || !output) return;

  let lineIndex = 0;
  let charIndex = 0;
  let currentLine = null;
  let finished = false;
  let typingTimer = null;

  function enterSite() {
    if (screen.classList.contains('hide')) return;
    clearTimeout(typingTimer);
    clearTimeout(autoEnterTimer);
    finished = true;
    sessionStorage.setItem('blog_boot_done', '1');
    document.dispatchEvent(new CustomEvent('blog:unlock-audio'));
    document.dispatchEvent(new CustomEvent('blog:ready'));
    screen.classList.add('hide');
    document.body.classList.remove('booting');
    document.body.classList.add('boot-done');
    setTimeout(() => screen.remove(), 700);
  }

  let autoEnterTimer = null;

  function scheduleAutoEnter() {
    autoEnterTimer = setTimeout(() => {
      if (!document.body.classList.contains('boot-done')) {
        enterSite();
      }
    }, 1200);
  }

  function typeNextChar() {
    if (!currentLine) return;

    if (charIndex < currentLine.text.length) {
      output.lastElementChild.textContent += currentLine.text[charIndex];
      charIndex++;
      typingTimer = setTimeout(typeNextChar, 12 + Math.random() * 16);
      return;
    }

    lineIndex++;
    if (lineIndex < BOOT_LINES.length) {
      typingTimer = setTimeout(startLine, currentLine.pause);
    } else {
      finished = true;
      cursor.classList.add('blink');
      scheduleAutoEnter();
    }
  }

  function startLine() {
    currentLine = BOOT_LINES[lineIndex];
    const line = document.createElement('div');
    if (currentLine.cls) line.className = currentLine.cls;
    output.appendChild(line);
    charIndex = 0;
    typeNextChar();
  }

  screen.addEventListener('click', enterSite);
  document.addEventListener('keydown', (e) => {
    if (!document.body.classList.contains('boot-done') &&
        (e.key === 'Enter' || e.key === 'Escape')) {
      enterSite();
    }
  });

  if (sessionStorage.getItem('blog_boot_done')) {
    enterSite();
  } else {
    startLine();
  }
})();
