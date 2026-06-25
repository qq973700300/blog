(function () {
  'use strict';

  function mediaVersion() {
    return window.__BLOG_MEDIA_V || '1';
  }

  function appVersion() {
    return window.__BLOG_APP_V || '1';
  }

  function mediaUrl(path) {
    const sep = path.indexOf('?') >= 0 ? '&' : '?';
    return path + sep + 'v=' + encodeURIComponent(mediaVersion());
  }

  function appDownloadUrl(path) {
    const sep = path.indexOf('?') >= 0 ? '&' : '?';
    return path + sep + 'v=' + encodeURIComponent(appVersion());
  }

  function applyToElements() {
    const video = document.getElementById('ascii-video-source');
    if (video && !video.dataset.blobUrl) {
      const url = mediaUrl('/video/ascii.mp4');
      let source = video.querySelector('source');
      if (!source) {
        source = document.createElement('source');
        source.type = 'video/mp4';
        video.appendChild(source);
      }
      if (source.getAttribute('src') !== url) {
        source.src = url;
        video.load();
      }
    }

    const downloadBtn = document.getElementById('download-btn');
    if (downloadBtn) {
      const base = downloadBtn.getAttribute('href') || '/downloads/flymusic.apk';
      const path = base.split('?')[0];
      downloadBtn.href = appDownloadUrl(path);
    }
  }

  window.blogMediaUrl = mediaUrl;
  window.blogMediaVersion = mediaVersion;
  window.blogAppDownloadUrl = appDownloadUrl;
  applyToElements();
})();
