(function () {
  'use strict';

  /**
   * 首页视频：与博客一致，直接流式播放 URL，不再整段 fetch 下载。
   * 浏览器边缓冲边播放，重复访问可走 HTTP/磁盘缓存。
   */
  let readyFor = null;

  function version() {
    return window.blogMediaVersion ? window.blogMediaVersion() : '1';
  }

  function videoUrl() {
    return window.blogMediaUrl ? window.blogMediaUrl('/video/ascii.mp4') : '/video/ascii.mp4';
  }

  function getVideo() {
    return document.getElementById('ascii-video-source');
  }

  function isLoaded() {
    return readyFor === version();
  }

  function ensureSrc() {
    const video = getVideo();
    if (!video) return null;

    if (video.dataset.blobUrl) {
      URL.revokeObjectURL(video.dataset.blobUrl);
      delete video.dataset.blobUrl;
    }

    const url = videoUrl();
    if (video.src !== url) {
      video.src = url;
      video.load();
    }

    video.preload = 'auto';
    return video;
  }

  function warmUp() {
    const video = ensureSrc();
    if (!video) return;

    video.addEventListener('loadeddata', () => {
      readyFor = version();
      if (window.BlogAsciiVideo) {
        window.BlogAsciiVideo.setUseProcedural(false);
        const run = () => window.BlogAsciiVideo.warmFirstFrame();
        if (window.requestIdleCallback) {
          requestIdleCallback(run, { timeout: 2500 });
        } else {
          setTimeout(run, 80);
        }
      }
    }, { once: true, passive: true });

    video.addEventListener('error', () => {
      readyFor = version();
      if (window.BlogAsciiVideo) {
        window.BlogAsciiVideo.setUseProcedural(true);
      }
    }, { once: true, passive: true });
  }

  /** 兼容旧调用：不再阻塞下载，仅确保 src 正确 */
  async function load() {
    ensureSrc();
    readyFor = version();
  }

  async function prefetch() {
    warmUp();
  }

  /**
   * 页面加载后立即预缓冲（不等开机动画结束），
   * 用户进站点 ▶ 时视频更可能已 ready。
   */
  function scheduleWarmUp() {
    warmUp();
  }

  window.BlogMediaLoader = {
    load,
    prefetch,
    isLoaded,
    isLoading: () => false,
  };

  scheduleWarmUp();
})();
