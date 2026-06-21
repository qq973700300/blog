(function () {
  'use strict';

  const output = document.getElementById('lost-output');
  const form = document.getElementById('lost-form');
  const input = document.getElementById('lost-cmd');
  const dancer = document.getElementById('lost-dancer');

  const COMMANDS = {
    help: [
      '可用命令：',
      '  help   — 显示本帮助',
      '  home   — 回首页',
      '  dance  — 让迷路舞者跳一下',
      '  tea    — 来杯好茶 🐧',
      '  blog   — 去博客列表',
    ],
    home: ['正在导航到首页舞台...', '→ /'],
    dance: ['舞者：好吧，原地蹦两下 💃', '(点击地图按钮真的回家)'],
    tea: ['🐧 企鹅送来一杯热茶', '喝完就有力气找到回家的路了'],
    blog: ['博客在这边 → /blog'],
  };

  function appendLine(text, cls) {
    const line = document.createElement('div');
    if (cls) line.className = cls;
    line.textContent = text;
    output.appendChild(line);
    output.scrollTop = output.scrollHeight;
  }

  function runCommand(raw) {
    const cmd = raw.trim().toLowerCase();
    if (!cmd) return;

    appendLine('> ' + raw, 'lost-echo');

    if (cmd === 'home') {
      COMMANDS.home.forEach((l) => appendLine(l, 'lost-reply'));
      setTimeout(() => { window.location.href = '/'; }, 600);
      return;
    }
    if (cmd === 'blog') {
      COMMANDS.blog.forEach((l) => appendLine(l, 'lost-reply'));
      setTimeout(() => { window.location.href = '/blog'; }, 600);
      return;
    }
    if (cmd === 'dance') {
      dancer.classList.add('dancing');
      COMMANDS.dance.forEach((l) => appendLine(l, 'lost-reply'));
      setTimeout(() => dancer.classList.remove('dancing'), 1200);
      return;
    }
    if (cmd === 'tea') {
      dancer.classList.add('tea-time');
      COMMANDS.tea.forEach((l) => appendLine(l, 'lost-reply'));
      setTimeout(() => dancer.classList.remove('tea-time'), 1600);
      return;
    }
    if (COMMANDS[cmd]) {
      COMMANDS[cmd].forEach((l) => appendLine(l, 'lost-reply'));
      return;
    }

    appendLine('未知命令: ' + cmd + '（试试 help）', 'lost-error');
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const value = input.value;
    input.value = '';
    runCommand(value);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === '?' && !e.ctrlKey && !e.metaKey && document.activeElement !== input) {
      runCommand('help');
    }
  });
})();
