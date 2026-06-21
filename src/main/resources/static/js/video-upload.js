(function () {
  'use strict';

  const listEl = document.getElementById('video-list');
  const form = document.getElementById('video-upload-form');
  const fileInput = document.getElementById('video-file');
  const nickInput = document.getElementById('video-nickname');
  const statusEl = document.getElementById('video-upload-status');
  const progressWrap = document.getElementById('video-upload-progress');
  const progressFill = document.getElementById('video-upload-fill');
  const progressPct = document.getElementById('video-upload-pct');

  const MAX_BYTES = 500 * 1024 * 1024;
  const POLL_MS = 3000;
  let pollTimer = null;

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function setStatus(msg, isError) {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.classList.toggle('error', !!isError);
  }

  function setProgress(ratio) {
    const pct = Math.round(ratio * 100);
    if (progressFill) progressFill.style.width = pct + '%';
    if (progressPct) progressPct.textContent = pct + '%';
    if (progressWrap) progressWrap.hidden = ratio <= 0 || ratio >= 1;
  }

  function statusLabel(v) {
    const status = v.status || 'READY';
    if (status === 'PROCESSING') return '压缩中…';
    if (status === 'FAILED') return v.statusMessage || '压缩失败';
    return null;
  }

  function isReady(v) {
    const status = v.status || 'READY';
    return status === 'READY' && v.url;
  }

  function renderAction(v) {
    if (isReady(v)) {
      return `<button type="button" class="video-decode-btn" data-url="${escapeHtml(v.url)}" data-title="${escapeHtml(v.originalFilename)}">
          ASCII 解码播放
        </button>`;
    }
    if (v.status === 'PROCESSING') {
      return '<span class="video-status-badge processing">压缩中…</span>';
    }
    return `<span class="video-status-badge failed">${escapeHtml(statusLabel(v))}</span>`;
  }

  function renderList(videos) {
    if (!listEl) return;
    if (!videos.length) {
      listEl.innerHTML = '<p class="video-empty">还没有上传的视频，来当第一个舞者吧</p>';
      schedulePoll(videos);
      return;
    }
    listEl.innerHTML = videos.map((v) => {
      const badge = statusLabel(v);
      const status = v.status || 'READY';
      const sizeHint = status === 'READY'
        ? formatSize(v.sizeBytes)
        : formatSize(v.sizeBytes) + ' 原片';
      return `
      <div class="video-item${status === 'PROCESSING' ? ' is-processing' : ''}${status === 'FAILED' ? ' is-failed' : ''}">
        <div class="video-item-info">
          <strong>${escapeHtml(v.originalFilename)}</strong>
          <span class="video-item-meta">
            ${escapeHtml(v.uploaderNickname)} · ${sizeHint} · ${escapeHtml(v.uploadedAt.slice(0, 16).replace('T', ' '))}
            ${badge && v.status !== 'PROCESSING' ? ' · ' + escapeHtml(badge) : ''}
          </span>
        </div>
        ${renderAction(v)}
      </div>
    `;
    }).join('');

    listEl.querySelectorAll('.video-decode-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (window.BlogVideoDecode) {
          window.BlogVideoDecode.open(btn.dataset.url, btn.dataset.title);
        }
      });
    });

    schedulePoll(videos);
  }

  function schedulePoll(videos) {
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
    const hasProcessing = videos.some((v) => v.status === 'PROCESSING');
    if (hasProcessing) {
      pollTimer = setTimeout(loadVideos, POLL_MS);
    }
  }

  function loadVideos() {
    fetch('/api/videos')
      .then((r) => r.json())
      .then(renderList)
      .catch(() => {
        if (listEl) listEl.innerHTML = '<p class="video-empty">加载视频列表失败</p>';
      });
  }

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const file = fileInput.files && fileInput.files[0];
      const nickname = nickInput.value.trim();

      if (!nickname) {
        setStatus('请填写昵称', true);
        return;
      }
      if (!file) {
        setStatus('请选择视频文件', true);
        return;
      }
      if (file.size > MAX_BYTES) {
        setStatus('视频不能超过 500MB', true);
        return;
      }
      if (!file.type.startsWith('video/')) {
        setStatus('仅支持视频文件', true);
        return;
      }

      const fd = new FormData();
      fd.append('nickname', nickname);
      fd.append('file', file);

      setStatus('上传中…', false);
      setProgress(0.01);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/videos/upload');
      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) {
          setProgress(ev.loaded / ev.total);
        }
      };
      xhr.onload = () => {
        setProgress(1);
        if (xhr.status >= 200 && xhr.status < 300) {
          let body = null;
          try {
            body = JSON.parse(xhr.responseText);
          } catch (err) {
            /* ignore */
          }
          if (body && body.status === 'PROCESSING') {
            setStatus('上传成功！正在压缩至 50MB 以下（24fps），完成后即可播放', false);
          } else {
            setStatus('上传成功！可以 ASCII 解码播放了', false);
          }
          fileInput.value = '';
          loadVideos();
        } else {
          let msg = '上传失败';
          try {
            const body = JSON.parse(xhr.responseText);
            if (body.message) msg = body.message;
          } catch (err) {
            /* ignore */
          }
          setStatus(msg, true);
        }
        setTimeout(() => setProgress(0), 600);
      };
      xhr.onerror = () => {
        setStatus('网络错误，请重试', true);
        setProgress(0);
      };
      xhr.send(fd);
    });
  }

  loadVideos();
})();
