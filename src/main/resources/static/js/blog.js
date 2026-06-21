(function () {
  'use strict';

  const list = document.getElementById('article-list');

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  fetch('/api/articles')
    .then((r) => r.json())
    .then((articles) => {
      if (!articles.length) {
        list.innerHTML = '<p class="article-empty">还没有文章，敬请期待</p>';
        return;
      }
      list.innerHTML = articles.map((a) => `
        <a class="article-card" href="/blog/articles/${encodeURIComponent(a.slug)}" style="border-color:${a.accentColor}33">
          <h2 style="color:${a.accentColor}">${escapeHtml(a.title)}</h2>
          <p>${escapeHtml(a.summary)}</p>
          <div class="article-meta">
            <span>${a.publishedAt}</span>
            <span class="article-read">阅读 →</span>
          </div>
        </a>
      `).join('');
    })
    .catch(() => {
      list.innerHTML = '<p class="article-empty">加载失败，请稍后再试</p>';
    });
})();
