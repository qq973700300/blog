(function () {
  'use strict';

  const loginSection = document.getElementById('admin-login');
  const dashboard = document.getElementById('admin-dashboard');
  const loginForm = document.getElementById('admin-login-form');
  const passwordInput = document.getElementById('admin-password');
  const loginStatus = document.getElementById('admin-login-status');
  const logoutBtn = document.getElementById('admin-logout-btn');
  const videoListEl = document.getElementById('admin-video-list');
  const messageListEl = document.getElementById('admin-message-list');
  const tabs = document.querySelectorAll('.admin-tab');
  const videosPanel = document.getElementById('admin-videos-panel');
  const messagesPanel = document.getElementById('admin-messages-panel');

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

  function formatTime(iso) {
    return iso.slice(0, 16).replace('T', ' ');
  }

  function setLoginStatus(msg, isError) {
    if (!loginStatus) return;
    loginStatus.textContent = msg;
    loginStatus.classList.toggle('error', !!isError);
  }

  function api(path, options) {
    return fetch(path, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...(options && options.headers) },
      ...options,
    }).then(async (res) => {
      if (!res.ok) {
        let msg = '请求失败';
        try {
          const body = await res.json();
          if (body.message) msg = body.message;
        } catch (err) {
          /* ignore */
        }
        const error = new Error(msg);
        error.status = res.status;
        throw error;
      }
      if (res.status === 204) return null;
      const text = await res.text();
      return text ? JSON.parse(text) : null;
    });
  }

  function showDashboard() {
    loginSection.hidden = true;
    dashboard.hidden = false;
    loadVideos();
  }

  function showLogin() {
    loginSection.hidden = false;
    dashboard.hidden = true;
    if (passwordInput) passwordInput.value = '';
  }

  function switchTab(name) {
    tabs.forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.tab === name);
    });
    videosPanel.hidden = name !== 'videos';
    messagesPanel.hidden = name !== 'messages';
    if (name === 'messages') loadMessages();
  }

  function renderVideos(videos) {
    if (!videoListEl) return;
    if (!videos.length) {
      videoListEl.innerHTML = '<p class="video-empty">暂无上传视频</p>';
      return;
    }
    videoListEl.innerHTML = videos.map((v) => {
      const status = v.status || 'READY';
      const statusText = status === 'READY' ? formatSize(v.sizeBytes)
        : status === 'PROCESSING' ? '压缩中'
          : (v.statusMessage || '失败');
      return `
        <div class="admin-row">
          <div class="admin-row-info">
            <strong>${escapeHtml(v.originalFilename)}</strong>
            <span class="admin-row-meta">
              #${v.id} · ${escapeHtml(v.uploaderNickname)} · ${escapeHtml(statusText)} · ${escapeHtml(formatTime(v.uploadedAt))}
            </span>
          </div>
          <button type="button" class="admin-delete-btn" data-kind="video" data-id="${v.id}">删除</button>
        </div>
      `;
    }).join('');
    bindDeleteButtons(videoListEl);
  }

  function renderMessages(messages) {
    if (!messageListEl) return;
    if (!messages.length) {
      messageListEl.innerHTML = '<p class="video-empty">暂无留言</p>';
      return;
    }
    messageListEl.innerHTML = messages.map((m) => `
      <div class="admin-row">
        <div class="admin-row-info">
          <strong style="color:${escapeHtml(m.color)}">${escapeHtml(m.nickname)}</strong>
          <span class="admin-row-meta">${escapeHtml(m.content)} · ${escapeHtml(formatTime(m.createdAt))}</span>
        </div>
        <button type="button" class="admin-delete-btn" data-kind="message" data-id="${m.id}">删除</button>
      </div>
    `).join('');
    bindDeleteButtons(messageListEl);
  }

  function bindDeleteButtons(container) {
    container.querySelectorAll('.admin-delete-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const kind = btn.dataset.kind;
        const id = btn.dataset.id;
        const label = kind === 'video' ? '这条视频' : '这条留言';
        if (!window.confirm(`确定删除${label}？此操作不可恢复。`)) return;
        btn.disabled = true;
        api(`/api/admin/${kind === 'video' ? 'videos' : 'messages'}/${id}`, { method: 'DELETE' })
          .then(() => {
            if (kind === 'video') loadVideos();
            else loadMessages();
          })
          .catch((err) => {
            alert(err.message || '删除失败');
            btn.disabled = false;
          });
      });
    });
  }

  function loadVideos() {
    api('/api/admin/videos')
      .then(renderVideos)
      .catch((err) => {
        if (err.status === 401) showLogin();
        else if (videoListEl) videoListEl.innerHTML = '<p class="video-empty">加载失败</p>';
      });
  }

  function loadMessages() {
    api('/api/admin/messages')
      .then(renderMessages)
      .catch((err) => {
        if (err.status === 401) showLogin();
        else if (messageListEl) messageListEl.innerHTML = '<p class="video-empty">加载失败</p>';
      });
  }

  function checkSession() {
    api('/api/admin/session')
      .then((data) => {
        if (!data.configured) {
          setLoginStatus('服务器未配置管理密码（BLOG_ADMIN_PASSWORD）', true);
          return;
        }
        if (data.authenticated) showDashboard();
        else showLogin();
      })
      .catch(() => showLogin());
  }

  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      setLoginStatus('登录中…', false);
      api('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ password: passwordInput.value }),
      })
        .then(() => {
          setLoginStatus('', false);
          showDashboard();
        })
        .catch((err) => setLoginStatus(err.message || '登录失败', true));
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      api('/api/admin/logout', { method: 'POST' })
        .finally(showLogin);
    });
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  checkSession();
})();
