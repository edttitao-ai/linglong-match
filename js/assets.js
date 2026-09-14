/* 玲珑消 · assets.js — 素材清单与预加载（图片走 <img>，音效走 HTMLAudio，兼容 file:// 直开） */
(function (global) {
  'use strict';
  const LL = (global.LL = global.LL || {});

  const IMG_DIR = 'assets/img/';
  const SFX_DIR = 'assets/sfx/';

  /* 图片清单：键名 → 文件名（缺失时渲染层自动降级为程序化图形）
   * A 方案「玄漆描金」起，方块/技能/UI 小图标是 AI 生成的 256px PNG（tools/slice_sheet.py 切出），
   * 外圈矢量（棋盘框、纸底、远山、云纹、卷轴、成就徽记）仍是 SVG，配色由 tools/restyle_dark.py 换成深色。*/
  const IMAGES = {
    tile_jade: 'tile_jade.png',
    tile_lantern: 'tile_lantern.png',
    tile_coin: 'tile_coin.png',
    tile_fan: 'tile_fan.png',
    tile_lotus: 'tile_lotus.png',
    tile_sachet: 'tile_sachet.png',
    /* 风符只有一张素材：横竖两个键指向同一个文件，竖版在 render.js 里旋转 90° */
    sp_wind_h: 'sp_wind.png',
    sp_wind_v: 'sp_wind.png',
    sp_thunder: 'sp_thunder.png',
    sp_taiji: 'sp_taiji.png',
    ob_frost: 'ob_frost.png',
    ob_stone: 'ob_stone.png',
    ob_stone_2: 'ob_stone_2.png',
    ob_vine: 'ob_vine.png',
    /* 上面四个是盘面上的“覆盖层”（霜、藤蔓中间是空的，好透出底下的方块）；
     * 下面三个是整块牌版本，给 HUD 目标卡、技能说明这类单独露脸的场合用 */
    ob_frost_card: 'ob_frost_card.png',
    ob_stone_card: 'ob_stone_card.png',
    ob_vine_card: 'ob_vine_card.png',
    ui_star: 'ui_star.png',
    ui_star_off: 'ui_star_off.png',
    ui_lock: 'ui_lock.png',
    ui_coin: 'ui_coin.png',
    ui_boost_moves: 'ui_boost_moves.png',
    ui_boost_wind: 'ui_boost_wind.png',
    ui_boost_shuffle: 'ui_boost_shuffle.png',
    ui_skill_hammer: 'ui_skill_hammer.png',
    ui_skill_swap: 'ui_skill_swap.png',
    ui_skill_color: 'ui_skill_color.png',
    ui_skill_cross: 'ui_skill_cross.png',
    ui_medal: 'ui_medal.png',
    ui_pause: 'ui_pause.png',
    ui_sound: 'ui_sound.png',
    ui_mute: 'ui_mute.png',
    ui_back: 'ui_back.png',
    ui_cloud: 'ui_cloud.svg',
    ui_corner_tl: 'ui_corner_tl.svg',
    ui_corner_tr: 'ui_corner_tr.svg',
    ui_corner_bl: 'ui_corner_bl.svg',
    ui_corner_br: 'ui_corner_br.svg',
    bg_paper: 'bg_paper.svg',
    bg_mountains: 'bg_mountains.svg',
    board_frame: 'board_frame.svg',
    /* 标题页主视觉：白玉描金玲珑球（tools 里那套脚本生成的，球心圆窗留给标题） */
    title_ball: 'title_ball.png',
    scroll_l1: 'scroll_l1.svg',
    scroll_l2: 'scroll_l2.svg',
    scroll_l3: 'scroll_l3.svg',
    scroll_l4: 'scroll_l4.svg',
    scroll_l5: 'scroll_l5.svg',
    /* 成就徽记：键名 = 'ach_' + Achievements.LIST 里的 id（由自检第 10 节守门） */
    ach_firstStar: 'ach_firstStar.svg',
    ach_starsQuarter: 'ach_starsQuarter.svg',
    ach_starsHalf: 'ach_starsHalf.svg',
    ach_starsMost: 'ach_starsMost.svg',
    ach_starsAll: 'ach_starsAll.svg',
    ach_allClear: 'ach_allClear.svg',
    ach_cascade8: 'ach_cascade8.svg',
    ach_specials100: 'ach_specials100.svg',
    ach_obst200: 'ach_obst200.svg',
    ach_daily7: 'ach_daily7.svg',
    ach_streak7: 'ach_streak7.svg',
    ach_endless10: 'ach_endless10.svg',
    ach_timed8k: 'ach_timed8k.svg'
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
    invalid: 'invalid.wav',
    /* 局内技能：四个技能各有一条起手音，听感要明显区别于普通消除 */
    skill_hammer: 'skill_hammer.wav',
    skill_swap: 'skill_swap.wav',
    skill_color: 'skill_color.wav',
    skill_cross: 'skill_cross.wav'
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
  /* 清单本体也暴露出来：自检要做「代码里的键 ↔ 清单 ↔ 磁盘文件」三方对账 */
  A.IMAGES = IMAGES;
  A.SFX = SFX;

  LL.Assets = A;
})(typeof globalThis !== 'undefined' ? globalThis : this);
