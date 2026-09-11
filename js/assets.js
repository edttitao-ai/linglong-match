/* 玲珑消 · assets.js — 素材清单与预加载（图片走 <img>，音效走 HTMLAudio，兼容 file:// 直开） */
(function (global) {
  'use strict';
  const LL = (global.LL = global.LL || {});

  const IMG_DIR = 'assets/img/';
  const SFX_DIR = 'assets/sfx/';

  /* 图片清单：键名 → 文件名（缺失时渲染层自动降级为程序化图形） */
  const IMAGES = {
    tile_jade: 'tile_jade.svg',
    tile_lantern: 'tile_lantern.svg',
    tile_coin: 'tile_coin.svg',
    tile_fan: 'tile_fan.svg',
    tile_lotus: 'tile_lotus.svg',
    tile_sachet: 'tile_sachet.svg',
    sp_wind_h: 'sp_wind_h.svg',
    sp_wind_v: 'sp_wind_v.svg',
    sp_thunder: 'sp_thunder.svg',
    sp_taiji: 'sp_taiji.svg',
    ob_frost: 'ob_frost.svg',
    ob_stone: 'ob_stone.svg',
    ob_vine: 'ob_vine.svg',
    ui_star: 'ui_star.svg',
    ui_star_off: 'ui_star_off.svg',
    ui_lock: 'ui_lock.svg',
    ui_pause: 'ui_pause.svg',
    ui_sound: 'ui_sound.svg',
    ui_mute: 'ui_mute.svg',
    ui_back: 'ui_back.svg',
    ui_cloud: 'ui_cloud.svg',
    ui_corner_tl: 'ui_corner_tl.svg',
    ui_corner_tr: 'ui_corner_tr.svg',
    ui_corner_bl: 'ui_corner_bl.svg',
    ui_corner_br: 'ui_corner_br.svg',
    bg_paper: 'bg_paper.svg',
    board_frame: 'board_frame.svg'
  };

  /* 音效清单；连锁音是 7 个独立的音高文件（A 五声音阶逐层上行），不用变速播放 */
  const SFX = {
    swap: 'swap.wav',
    match1: 'match1.wav',
    match2: 'match2.wav',
    match3: 'match3.wav',
    match4: 'match4.wav',
    match5: 'match5.wav',
    match6: 'match6.wav',
    match7: 'match7.wav',
    wind: 'wind.wav',
    thunder: 'thunder.wav',
    taiji: 'taiji.wav',
    brk: 'break.wav',
    shuffle: 'shuffle.wav',
    win: 'win.wav',
    lose: 'lose.wav',
    click: 'click.wav',
    star: 'star.wav',
    invalid: 'invalid.wav'
  };

  const A = {
    images: {},       // key -> HTMLImageElement
    failed: {},       // key -> true（加载失败，走降级绘制）
    sfxPath: {},      // key -> 相对路径
    loadedCount: 0,
    totalCount: 0,
    ready: false,

    path(name) { return IMG_DIR + (IMAGES[name] || name); },
    sfx(name) { return SFX_DIR + (SFX[name] || name); },
    img(name) { return this.failed[name] ? null : this.images[name]; },

    loadAll(onProgress) {
      const keys = Object.keys(IMAGES);
      this.totalCount = keys.length;
      this.loadedCount = 0;
      const self = this;
      return new Promise(function (resolve) {
        let pending = keys.length;
        if (!pending) { self.ready = true; resolve(self); return; }
        keys.forEach(function (key) {
          const image = new Image();
          self.images[key] = image;
          const done = function (okFlag) {
            if (!okFlag) self.failed[key] = true;
            self.loadedCount++;
            if (onProgress) onProgress(self.loadedCount / self.totalCount, key);
            if (--pending === 0) { self.ready = true; resolve(self); }
          };
          image.onload = function () { done(true); };
          image.onerror = function () { done(false); };
          image.src = self.path(key);
        });
      });
    },

    /* 音效路径表（file:// 下用 <audio> 播放，不受 CORS 限制） */
    initSfx() {
      const self = this;
      Object.keys(SFX).forEach(function (k) { self.sfxPath[k] = self.sfx(k); });
      return this.sfxPath;
    }
  };

  A.IMAGE_LIST = Object.keys(IMAGES);
  A.SFX_LIST = Object.keys(SFX);

  LL.Assets = A;
})(typeof globalThis !== 'undefined' ? globalThis : this);
