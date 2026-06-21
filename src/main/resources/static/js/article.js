(function () {
  'use strict';

  const root = document.getElementById('article-root');

  function getSlug() {
    const parts = window.location.pathname.split('/').filter(Boolean);
    const idx = parts.indexOf('articles');
    return idx >= 0 ? decodeURIComponent(parts[idx + 1] || '') : '';
  }

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function renderMarkdown(md) {
    const blocks = md.split(/\n\n+/);
    return blocks.map((block) => {
      block = block.trim();
      if (!block) return '';

      if (block.startsWith('```')) {
        const code = block.replace(/^```[^\n]*\n?/, '').replace(/```$/, '');
        return `<pre><code>${escapeHtml(code)}</code></pre>`;
      }
      if (block.startsWith('## ')) {
        return `<h2>${inline(block.slice(3))}</h2>`;
      }
      if (block.startsWith('### ')) {
        return `<h3>${inline(block.slice(4))}</h3>`;
      }
      if (block.startsWith('> ')) {
        return `<blockquote>${inline(block.replace(/^> /gm, ''))}</blockquote>`;
      }
      if (block.startsWith('|')) {
        const rows = block.split('\n').filter((r) => r.trim());
        const bodyRows = rows.slice(2);
        const head = rows[0].split('|').filter(Boolean).map((c) => `<th>${inline(c.trim())}</th>`).join('');
        const body = bodyRows.map((row) => {
          const cells = row.split('|').filter(Boolean).map((c) => `<td>${inline(c.trim())}</td>`).join('');
          return `<tr>${cells}</tr>`;
        }).join('');
        return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
      }
      if (block.startsWith('- ')) {
        const items = block.split('\n').map((li) => `<li>${inline(li.replace(/^- /, ''))}</li>`).join('');
        return `<ul>${items}</ul>`;
      }
      return `<p>${inline(block.replace(/\n/g, '<br>'))}</p>`;
    }).join('\n');
  }

  function inline(text) {
    return escapeHtml(text)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
  }

  function pickShareQuote(article) {
    const plain = article.content
      .replace(/```[\s\S]*?```/g, '')
      .replace(/^#+\s/gm, '')
      .replace(/^>\s/gm, '')
      .replace(/\*\*/g, '')
      .replace(/`/g, '')
      .replace(/\n+/g, ' ')
      .trim();
    const snippet = plain.slice(0, 36).trim();
    return snippet ? '读完《' + article.title + '》：' + snippet : '刚读完《' + article.title + '》';
  }

  function setupVictoryDancer(article) {
    if (document.getElementById('article-victory')) return;

    const quote = pickShareQuote(article);
    const panel = document.createElement('aside');
    panel.id = 'article-victory';
    panel.className = 'article-victory hidden';
    panel.innerHTML =
      '<div class="victory-dancer" aria-hidden="true">' +
      '  <svg viewBox="0 0 48 72" class="victory-svg">' +
      '    <ellipse cx="24" cy="68" rx="14" ry="3" fill="rgba(0,0,0,0.25)"/>' +
      '    <rect x="16" y="26" width="16" height="20" rx="4" fill="#00f5ff"/>' +
      '    <circle cx="24" cy="14" r="11" fill="#ffe600"/>' +
      '    <circle cx="20" cy="13" r="1.8" fill="#0a0e17"/>' +
      '    <circle cx="28" cy="13" r="1.8" fill="#0a0e17"/>' +
      '    <path d="M19 16 Q24 22 29 16" stroke="#0a0e17" stroke-width="1.2" fill="none"/>' +
      '  </svg>' +
      '</div>' +
      '<p class="victory-title">读完了！</p>' +
      '<p class="victory-hint">把感受发到首页互动墙</p>' +
      '<button type="button" class="victory-share-btn">发射弹幕 🚀</button>';

    document.body.appendChild(panel);

    const sentinel = document.createElement('div');
    sentinel.className = 'article-end-sentinel';
    sentinel.setAttribute('aria-hidden', 'true');
    root.appendChild(sentinel);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            panel.classList.remove('hidden');
            panel.classList.add('show');
          }
        });
      },
      { root: null, threshold: 0.6 }
    );
    observer.observe(sentinel);

    panel.querySelector('.victory-share-btn').addEventListener('click', () => {
      localStorage.setItem('blog_pending_msg', quote.slice(0, 40));
      localStorage.setItem('blog_open_social', '1');
      window.location.href = '/';
    });
  }

  function enhanceArticle(article) {
    const body = root.querySelector('.article-body');
    if (!body) return;
    if (window.BlogCodePiano) {
      window.BlogCodePiano.attachTo(body);
    }
    setupVictoryDancer(article);
  }

  const slug = getSlug();
  if (!slug) {
    root.innerHTML = '<p class="article-error">文章不存在</p>';
    return;
  }

  fetch('/api/articles/' + encodeURIComponent(slug))
    .then((r) => {
      if (!r.ok) throw new Error('not found');
      return r.json();
    })
    .then((article) => {
      document.title = article.title + ' · 同羽';
      root.innerHTML =
        '<h1 style="color:' + escapeHtml(article.accentColor) + '">' + escapeHtml(article.title) + '</h1>' +
        '<div class="article-meta"><span>' + escapeHtml(article.publishedAt) + '</span>' +
        '<span>' + escapeHtml(article.summary) + '</span></div>' +
        '<div class="article-body">' + renderMarkdown(article.content) + '</div>';
      enhanceArticle(article);
    })
    .catch(() => {
      root.innerHTML =
        '<p class="article-error">文章不存在或加载失败<br>' +
        '<a href="/blog" style="color:#00f5ff">返回博客列表</a></p>';
    });
})();
