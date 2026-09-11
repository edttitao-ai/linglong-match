/* 玲珑消 · audio.js — 音效播放（HTMLAudioElement 池 + 变调）
 * 说明：file:// 直开时 <audio> 不受 CORS 限制，故不使用 fetch + AudioContext。
 * 首次用户交互后解锁（浏览器自动播放策略）。
 */
(function (global) {
  'use strict';
  const LL = (global.LL = global.LL || {});

  const POOL_SIZE = 3;

  const Audio = {
    pools: {},
    unlocked: false,
    volume: 0.8,
    muted: false,
    ready: false,

    init(paths, settings) {
      this.volume = settings && typeof settings.volume === 'number' ? settings.volume : 0.8;
      this.muted = !!(settings && settings.muted);
      if (typeof global.Audio === 'undefined' && typeof document === 'undefined') return;
      for (const name in paths) {
        if (!Object.prototype.hasOwnProperty.call(paths, name)) continue;
        const pool = [];
        for (let i = 0; i < POOL_SIZE; i++) {
          try {
            const a = new global.Audio(paths[name]);
            a.preload = 'auto';
            pool.push({ el: a, busy: false, until: 0 });
          } catch (e) { /* 忽略 */ }
        }
        this.pools[name] = pool;
      }
      this.ready = true;
    },

    unlock() {
      if (this.unlocked) return;
      this.unlocked = true;
      /* 播放一次极短音以解锁（音量置 0，无感） */
      for (const name in this.pools) {
        const pool = this.pools[name];
        if (pool && pool[0]) {
          try {
            pool[0].el.volume = 0;
            const p = pool[0].el.play();
            if (p && p.then) p.then(function () { pool[0].el.pause(); pool[0].el.volume = 0.8; }, function () {});
          } catch (e) { /* 忽略 */ }
          break;
        }
      }
    },

    setVolume(v) { this.volume = Math.max(0, Math.min(1, v)); },
    setMuted(m) { this.muted = !!m; },

    /* name: 音效键；opt: { rate 播放速率, vol 相对音量, jitter 随机音高抖动 } */
    play(name, opt) {
      if (!this.ready || this.muted || this.volume <= 0) return;
      const pool = this.pools[name];
      if (!pool || !pool.length) return;
      opt = opt || {};
      const now = (global.performance && performance.now) ? performance.now() : Date.now();
      let slot = null;
      for (let i = 0; i < pool.length; i++) {
        if (!pool[i].busy) { slot = pool[i]; break; }
      }
      if (!slot) {
        /* 全忙则抢最早的一个 */
        slot = pool[0];
        for (let i = 1; i < pool.length; i++) if (pool[i].until < slot.until) slot = pool[i];
      }
      const el = slot.el;
      let rate = opt.rate || 1;
      if (opt.jitter) rate *= 0.96 + Math.random() * 0.08;   /* ±4% 抗重复疲劳 */
      try {
        el.pause();
        el.currentTime = 0;
        el.playbackRate = rate;
        el.volume = Math.max(0, Math.min(1, this.volume * (opt.vol == null ? 1 : opt.vol)));
        const p = el.play();
        slot.busy = true;
        slot.until = now + 900;
        const clear = function () { slot.busy = false; };
        if (p && p.then) p.then(function () { setTimeout(clear, 900); }, clear);
        else setTimeout(clear, 900);
      } catch (e) { slot.busy = false; }
    },

    /* 连锁音：match1–match7 是五声音阶上逐层升高的独立音高文件，
     * 第 7 层封顶后不再升高（避免超过 2 kHz 变尖），音量由文件本身设定 */
    playCascade(n) {
      const idx = Math.max(1, Math.min(7, n));
      this.play('match' + idx, { jitter: true, vol: 0.95 });
    }
  };

  LL.Audio = Audio;
})(typeof globalThis !== 'undefined' ? globalThis : this);
