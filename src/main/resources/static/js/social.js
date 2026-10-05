(function () {
  'use strict';

  const listEl = document.getElementById('gb-list');
  const messageForm = document.getElementById('message-form');
  const nicknameInput = document.getElementById('msg-nickname');
  const contentInput = document.getElementById('msg-content');
  const imageInput = document.getElementById('gb-image-input');
  const imageBtn = document.getElementById('gb-image-btn');
  const voiceBtn = document.getElementById('gb-voice-btn');
  const voiceStatus = document.getElementById('gb-voice-status');
  const attachmentsBox = document.getElementById('gb-attachments');
  const imagePreview = document.getElementById('gb-image-preview');
  const voicePreview = document.getElementById('gb-voice-preview');

  let pendingImageUrl = null;
  let pendingVoiceUrl = null;
  let mediaRecorder = null;
  let recording = false;
  let voiceBusy = false;

  function api(path, options) {
    return fetch('/api/social' + path, options).then((r) => {
      if (!r.ok) {
        return r.text().then((t) => {
          throw new Error(t || 'request failed');
        });
      }
      return r.json();
    });
  }

  function getNickname() {
    return nicknameInput.value.trim();
  }

  function saveNickname() {
    localStorage.setItem('blog_nickname', nicknameInput.value.trim());
  }

  function requireNickname() {
    const nick = getNickname();
    if (!nick) {
      showToast('先填个昵称吧 🎭');
      nicknameInput.focus();
      return null;
    }
    return nick;
  }

  function showToast(text) {
    const t = document.createElement('div');
    t.className = 'social-toast';
    t.textContent = text;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 400);
    }, 2800);
  }

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : s;
    return d.innerHTML;
  }

  function fmtTime(iso) {
    try {
      const d = new Date(iso);
      const pad = (n) => String(n).padStart(2, '0');
      return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch (e) {
      return '';
    }
  }

  const hub = document.getElementById('screen-hub');

  function scrollToBoard(focusContent) {
    if (hub) {
      hub.scrollIntoView({ behavior: 'smooth' });
    }
    setTimeout(() => {
      (focusContent ? contentInput : nicknameInput).focus();
    }, 600);
  }

  function consumeArticleShare() {
    const pending = localStorage.getItem('blog_pending_msg');
    const openSocial = localStorage.getItem('blog_open_social');
    if (pending && contentInput) {
      contentInput.value = pending.slice(0, 40);
      localStorage.removeItem('blog_pending_msg');
    }
    if (openSocial === '1') {
      localStorage.removeItem('blog_open_social');
      scrollToBoard(true);
    }
  }

  function renderMessage(msg) {
    const item = document.createElement('div');
    item.className = 'gb-item';
    let inner = `<div class="gb-head">
      <span class="gb-nick" style="color:${escapeHtml(msg.color || '#00f5ff')}">${escapeHtml(msg.nickname)}</span>
      <span class="gb-time">${escapeHtml(fmtTime(msg.createdAt))}</span>
    </div>`;
    if (msg.content) {
      inner += `<p class="gb-text">${escapeHtml(msg.content)}</p>`;
    }
    if (msg.imageUrl) {
      inner += `<img class="gb-img" src="${escapeHtml(msg.imageUrl)}" alt="留言图片" loading="lazy">`;
    }
    if (msg.voiceUrl) {
      inner += `<button type="button" class="gb-voice" data-src="${escapeHtml(msg.voiceUrl)}">▶ 播放语音</button>`;
    }
    item.innerHTML = inner;
    return item;
  }

  function renderList(messages) {
    if (!listEl) return;
    if (!messages || !messages.length) {
      listEl.innerHTML = '<p class="gb-empty">还没有留言，来抢沙发 ~</p>';
      return;
    }
    listEl.innerHTML = '';
    messages.forEach((m) => listEl.appendChild(renderMessage(m)));
  }

  function loadMessages() {
    api('/messages')
      .then((list) => renderList(list))
      .catch(() => {
        if (listEl && !listEl.children.length) {
          listEl.innerHTML = '<p class="gb-empty">留言加载失败，稍后再试</p>';
        }
      });
  }

  function refreshAttachments() {
    const has = pendingImageUrl || pendingVoiceUrl;
    attachmentsBox.hidden = !has;
    imagePreview.innerHTML = pendingImageUrl
      ? `<img src="${escapeHtml(pendingImageUrl)}" alt="待发送图片"><button type="button" class="gb-chip-x" id="gb-image-x">✕</button>`
      : '';
    voicePreview.innerHTML = pendingVoiceUrl
      ? `🎤 语音已就绪<button type="button" class="gb-chip-x" id="gb-voice-x">✕</button>`
      : '';
    const ix = document.getElementById('gb-image-x');
    const vx = document.getElementById('gb-voice-x');
    if (ix) ix.addEventListener('click', () => { pendingImageUrl = null; imageInput.value = ''; refreshAttachments(); });
    if (vx) vx.addEventListener('click', () => { pendingVoiceUrl = null; refreshAttachments(); });
  }

  function uploadFile(file, kind) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('kind', kind);
    return fetch('/api/social/upload', { method: 'POST', body: fd }).then((r) => {
      if (!r.ok) {
        return r.text().then((t) => { throw new Error(t || 'upload failed'); });
      }
      return r.json();
    });
  }

  function pickImage() {
    imageInput.click();
  }

  function onImagePicked() {
    const file = imageInput.files && imageInput.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('图片不能超过 5MB');
      imageInput.value = '';
      return;
    }
    imageBtn.disabled = true;
    uploadFile(file, 'image')
      .then((res) => {
        pendingImageUrl = res.url;
        refreshAttachments();
      })
      .catch((err) => showToast('图片上传失败：' + err.message))
      .finally(() => {
        imageBtn.disabled = false;
        imageInput.value = '';
      });
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
  }

  function toggleRecord() {
    if (recording) {
      stopRecording();
      return;
    }
    if (!navigator.mediaDevices || !window.MediaRecorder) {
      showToast('当前浏览器不支持录音');
      return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        const chunks = [];
        mediaRecorder = new MediaRecorder(stream);
        recording = true;
        voiceBtn.classList.add('recording');
        voiceBtn.textContent = '⏹';
        voiceStatus.textContent = '录音中...';
        mediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size) chunks.push(e.data);
        };
        mediaRecorder.onstop = () => {
          recording = false;
          voiceBtn.classList.remove('recording');
          voiceBtn.textContent = '🎤';
          voiceStatus.textContent = '';
          stream.getTracks().forEach((t) => t.stop());
          if (voiceBusy) return;
          const blob = new Blob(chunks, { type: mediaRecorder.mimeType || 'audio/webm' });
          if (blob.size > 2 * 1024 * 1024) {
            showToast('语音太长，请控制在 2MB 内');
            return;
          }
          voiceBusy = true;
          uploadFile(blob, 'voice')
            .then((res) => {
              pendingVoiceUrl = res.url;
              refreshAttachments();
            })
            .catch((err) => showToast('语音上传失败：' + err.message))
            .finally(() => { voiceBusy = false; });
        };
        mediaRecorder.start();
      })
      .catch(() => showToast('无法访问麦克风，请检查权限'));
  }

  function postMessage(e) {
    e.preventDefault();
    const nickname = requireNickname();
    if (!nickname) return;
    const content = contentInput.value.trim();
    if (!content && !pendingImageUrl && !pendingVoiceUrl) {
      showToast('写点内容，或附上图片/语音');
      return;
    }
    saveNickname();
    const sendBtn = messageForm.querySelector('.gb-send');
    sendBtn.disabled = true;
    api('/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname, content, imageUrl: pendingImageUrl, voiceUrl: pendingVoiceUrl }),
    })
      .then(() => {
        contentInput.value = '';
        pendingImageUrl = null;
        pendingVoiceUrl = null;
        refreshAttachments();
        loadMessages();
      })
      .catch((err) => showToast('发送失败：' + err.message))
      .finally(() => { sendBtn.disabled = false; });
  }

  function bindEvents() {
    if (messageForm) messageForm.addEventListener('submit', postMessage);
    if (imageBtn) imageBtn.addEventListener('click', pickImage);
    if (imageInput) imageInput.addEventListener('change', onImagePicked);
    if (voiceBtn) voiceBtn.addEventListener('click', toggleRecord);

    if (listEl) {
      listEl.addEventListener('click', (e) => {
        const voiceBtnEl = e.target.closest('.gb-voice');
        if (voiceBtnEl) {
          toggleVoicePlayback(voiceBtnEl);
          return;
        }
        const img = e.target.closest('.gb-img');
        if (img) openLightbox(img.src);
      });
    }

    document.addEventListener('blog:local-achievement', () => showToast('🐛 成就解锁：除虫大师'));
  }

  function toggleVoicePlayback(btn) {
    const src = btn.dataset.src;
    let audio = btn._audio;
    if (!audio) {
      audio = new Audio(src);
      btn._audio = audio;
      audio.addEventListener('ended', () => {
        btn.textContent = '▶ 播放语音';
        btn.classList.remove('playing');
      });
    }
    if (audio.paused) {
      document.querySelectorAll('.gb-voice.playing').forEach((other) => {
        if (other !== btn) {
          other._audio && other._audio.pause();
          other.textContent = '▶ 播放语音';
          other.classList.remove('playing');
        }
      });
      audio.play();
      btn.textContent = '⏸ 暂停';
      btn.classList.add('playing');
    } else {
      audio.pause();
      btn.textContent = '▶ 播放语音';
      btn.classList.remove('playing');
    }
  }

  function openLightbox(src) {
    const box = document.createElement('div');
    box.className = 'gb-lightbox';
    box.innerHTML = `<img src="${escapeHtml(src)}" alt="图片放大">`;
    box.addEventListener('click', () => box.remove());
    document.body.appendChild(box);
  }

  function startSocial() {
    bindEvents();
    const saved = localStorage.getItem('blog_nickname');
    if (saved) nicknameInput.value = saved;
    consumeArticleShare();
    loadMessages();
    setInterval(loadMessages, 30000);
  }

  if (document.body.classList.contains('boot-done')) {
    startSocial();
  } else {
    document.addEventListener('blog:ready', startSocial, { once: true });
  }

  window.BlogSocial = { refresh: loadMessages };
})();
