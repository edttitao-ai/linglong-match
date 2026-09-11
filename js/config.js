/* 玲珑消 · config.js — 全局常量与数值表（无 DOM 依赖） */
(function (global) {
  'use strict';
  const LL = (global.LL = global.LL || {});

  /* 六种基础块：色相 + 轮廓双重区分（读盘友好） */
  const TILE_INFO = [
    { id: 'jade',    name: '玉璧', en: 'Jade',    main: '#2FA98C', light: '#93E2C6', dark: '#12523F', glow: 'rgba(47,169,140,0.55)' },
    { id: 'lantern', name: '灯笼', en: 'Lantern', main: '#D9453C', light: '#F79C90', dark: '#8C1F1F', glow: 'rgba(217,69,60,0.55)' },
    { id: 'coin',    name: '铜钱', en: 'Coin',    main: '#D9A63C', light: '#F6DC8E', dark: '#8A5E14', glow: 'rgba(217,166,60,0.55)' },
    { id: 'fan',     name: '折扇', en: 'Fan',     main: '#4A6FB5', light: '#A0BBEA', dark: '#27406E', glow: 'rgba(74,111,181,0.55)' },
    { id: 'lotus',   name: '莲花', en: 'Lotus',   main: '#E28BA8', light: '#F9C9D8', dark: '#A34E6D', glow: 'rgba(226,139,168,0.55)' },
    { id: 'sachet',  name: '香囊', en: 'Sachet',  main: '#8A5FB0', light: '#C9A7E6', dark: '#543673', glow: 'rgba(138,95,176,0.55)' }
  ];

  /* 特殊块：风符（横 / 竖整行清除）· 惊雷（3×3）· 太极（同色全消） */
  const SPECIAL = { NONE: 0, WIND_H: 1, WIND_V: 2, THUNDER: 3, TAIJI: 4 };
  const SPECIAL_INFO = {
    1: { name: '横风符', en: 'Wind Rune' },
    2: { name: '竖风符', en: 'Wind Rune' },
    3: { name: '惊雷',   en: 'Thunder' },
    4: { name: '太极',   en: 'Taiji' }
  };

  /* 障碍：霜（1 层）· 石锁（2 层）· 藤蔓（锁住块，不可交换） */
  const OBST = { NONE: 0, FROST: 1, STONE: 2, VINE: 3 };
  const OBST_INFO = {
    1: { hp: 1, name: '霜',   en: 'Frost' },
    2: { hp: 2, name: '石锁', en: 'Stone Lock' },
    3: { hp: 1, name: '藤蔓', en: 'Vine' }
  };

  const CFG = {
    ROWS: 8,
    COLS: 8,
    TILE_INFO: TILE_INFO,
    TILE_KINDS: TILE_INFO.length,
    SPECIAL: SPECIAL,
    SPECIAL_INFO: SPECIAL_INFO,
    OBST: OBST,
    OBST_INFO: OBST_INFO,

    /* 计分 */
    SCORE_TILE: 20,            // 每消除一块
    SCORE_SPECIAL_CREATE: 50,  // 生成一个特殊块
    SCORE_SPECIAL_FIRE: 100,   // 引爆一个特殊块
    SCORE_MOVE_LEFT: 50,       // 胜利时每剩余一步折算
    CASCADE_STEP: 0.5,         // 每层连锁 +50%
    CASCADE_CAP: 4,            // 连锁倍率上限

    /* 动画时长（毫秒） */
    ANIM: {
      swap: 150,
      revert: 180,
      clear: 230,
      fallBase: 110,
      fallPerRow: 24,
      fallMax: 330,
      shuffle: 460,
      banner: 720,
      result: 520
    },
    CASCADE_SPEEDUP: 0.9,   // 每层连锁动画提速
    MIN_TIME_SCALE: 0.6,
    HINT_DELAY: 5200,       // 空闲多久给出提示
    ACCEL_SCALE: 3.2,       // 点击加速倍率

    STORAGE_KEY: 'linglong.progress.v1',
    SETTINGS_KEY: 'linglong.settings.v1'
  };

  LL.CFG = CFG;
})(typeof globalThis !== 'undefined' ? globalThis : this);
