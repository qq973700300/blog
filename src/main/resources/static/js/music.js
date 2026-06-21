(function () {
  'use strict';

  /** 控制首页 MP4 视频播放（含原声），不再使用独立 bgm.mp3 */
  class DanceMusic {
    constructor() {
      this.playing = false;
      this.videoEl = null;
      this.onStartedCb = null;
    }

    _ensureVideo() {
      if (this.videoEl) return this.videoEl;
      this.videoEl = document.getElementById('ascii-video-source');
      if (this.videoEl) {
        this.videoEl.addEventListener('playing', () => {
          if (!this.playing) {
            this.playing = true;
            if (this.onStartedCb) {
              const cb = this.onStartedCb;
              this.onStartedCb = null;
              cb();
            }
          }
        }, { passive: true });
      }
      return this.videoEl;
    }

    unlockFromGesture() {
      this._ensureVideo();
    }

    onMp3Started(cb) {
      this.onStartedCb = cb;
    }

    /**
     * 在用户手势的同步栈里调用，取消静音并播放 MP4。
     * 返回 playing | loading | error
     */
    tryPlayVideoSync() {
      const video = this._ensureVideo();
      if (!video || video.error) return 'error';

      if (!video.paused && this.playing) {
        return 'playing';
      }

      video.muted = false;
      video.volume = 1;
      video.defaultMuted = false;
      video.removeAttribute('muted');
      video.currentTime = 0;

      try {
        const ret = video.play();
        if (ret) {
          ret.catch(() => {
            if (this.playing && video.paused) {
              this.playing = false;
            }
          });
        }
      } catch (err) {
        return 'error';
      }

      if (!video.paused) {
        this.playing = true;
        if (this.onStartedCb) {
          const cb = this.onStartedCb;
          this.onStartedCb = null;
          cb();
        }
        return 'playing';
      }

      return 'loading';
    }

    /** @deprecated 兼容旧调用 */
    tryPlayMp3Sync() {
      return this.tryPlayVideoSync();
    }

    stop() {
      this.playing = false;
      const video = this._ensureVideo();
      if (video) {
        video.pause();
      }
    }

    setVolume(v) {
      const video = this._ensureVideo();
      if (video) {
        video.volume = v;
      }
    }
  }

  window.DanceMusic = DanceMusic;
})();
