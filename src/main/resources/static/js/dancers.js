(function () {
  'use strict';

  const MAX_GUEST = 3;
  /* 留言：左上、右中、右下；左下固定代码 */
  const GUEST_SLOTS = [0, 3, 5];

  const DANCE_POS = [
    { top: '10%', left: '5%' },
    { top: '5%', right: '8%' },
    { top: '45%', left: '15%' },
    { top: '40%', right: '12%' },
    { bottom: '8%', left: '30%' },
    { bottom: '12%', right: '25%' },
  ];

  const CODE_SNIPPETS = [
    '<span class="kw">while</span>(alive) {\n  <span class="fn">code</span>.<span class="fn">dance</span>();\n}',
    '<span class="kw">const</span> <span class="fn">beat</span> = () =>\n  move(<span class="str">"sync"</span>);',
    '<span class="kw">def</span> <span class="fn">groove</span>(bpm=<span class="num">128</span>):\n    <span class="kw">yield</span> <span class="str">"🎵"</span>',
    '<span class="kw">public void</span> <span class="fn">dance</span>() {\n  rhythm.<span class="fn">start</span>();\n}',
    '<span class="cm">// 每一行代码，都是一支舞</span>\nblog.<span class="fn">write</span>(<span class="str">"hello"</span>);',
    '{ [ <span class="op">&lt;</span> <span class="num">42</span> <span class="op">&gt;</span> ] }',
  ];

  const stage = document.getElementById('dancers-stage');
  if (!stage) return;

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function renderCodeDancer(el, index) {
    el.classList.remove('guest-dancer');
    el.classList.add('code-dancer');
    el.style.borderColor = '';
    el.style.background = '';
    el.style.boxShadow = '';
    el.innerHTML = CODE_SNIPPETS[index];
    el.removeAttribute('title');
  }

  function renderGuestDancer(el, guest) {
    el.classList.add('guest-dancer');
    el.classList.remove('code-dancer');
    el.style.borderColor = guest.color + '55';
    el.style.background = guest.color + '10';
    el.style.boxShadow = `0 0 20px ${guest.color}33`;
    el.innerHTML =
      `<span class="cm">// ${escapeHtml(guest.nickname)}</span>\n` +
      `<span class="guest-msg">${escapeHtml(guest.content)}</span>`;
    el.title = `${guest.nickname}: ${guest.content}`;
  }

  function renderDancers(dancers) {
    const guests = (dancers || []).slice(0, MAX_GUEST);
    let guestIdx = 0;

    stage.innerHTML = '';

    for (let i = 0; i < 6; i++) {
      const el = document.createElement('div');
      const pos = DANCE_POS[i];
      el.className = `dancer dancer-${i + 1}`;

      Object.entries(pos).forEach(([k, v]) => {
        el.style[k] = v;
      });

      const isGuestSlot = GUEST_SLOTS.includes(i);
      if (isGuestSlot && guestIdx < guests.length) {
        renderGuestDancer(el, guests[guestIdx++]);
      } else {
        renderCodeDancer(el, i);
      }

      stage.appendChild(el);
    }
  }

  function refreshDancers() {
    fetch('/api/social/dancers')
      .then((r) => r.json())
      .then(renderDancers)
      .catch(() => renderDancers([]));
  }

  document.addEventListener('DOMContentLoaded', refreshDancers);
  setInterval(refreshDancers, 20000);

  window.BlogDancers = { refresh: refreshDancers };
})();
