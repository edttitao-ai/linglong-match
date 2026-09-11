/* 玲珑消 · achievements.js — 成就（长期目标感）与画卷（星星的可视化沉淀）
 *
 * 成就只读取已有数据（星级 / 统计 / 各模式最佳），不额外维护状态机；
 * 玩家不需要盯着它们，达成了会在结算后自动解锁并发金币。
 * 画卷则是把「累计星数」变成看得见的画面：5 层水墨按星数逐层显现。
 */
(function (global) {
  'use strict';
  const LL = (global.LL = global.LL || {});
  const CFG = LL.CFG;

  /* 星级门槛按「满星上限的比例」定义，不写死数字。
   * 关卡从 30 → 50 → 70 一路加过来，写死的门槛每加一次都要重排一遍，
   * 连成就 id 和图标文件名都得跟着改（stars20 → stars50 → …），纯属自找麻烦。
   * 换成比例后，加关卡只需要确认新门槛是否还合理，id / 图标 / 文案键都不用动。
   * 描述里的数字用 {n} 传进去（见 needOf），所以文案也只有一份。 */
  const LEVEL_COUNT = (LL.LEVELS || []).length;
  const MAX_STARS = LEVEL_COUNT * 3;
  const starPct = function (f) { return Math.round(MAX_STARS * f / 5) * 5; };
  const STAR_TIERS = [
    { id: 'starsQuarter', icon: 'ach_starsQuarter', coins: 50, at: starPct(0.25) },
    { id: 'starsHalf', icon: 'ach_starsHalf', coins: 90, at: starPct(0.5) },
    { id: 'starsMost', icon: 'ach_starsMost', coins: 140, at: starPct(0.75) },
    { id: 'starsAll', icon: 'ach_starsAll', coins: 200, at: MAX_STARS }
  ];

  /* 画卷层同理：按上限的百分比取，最后一层留给「满星」 */
  const SCROLL_TIERS = [starPct(0.10), starPct(0.28), starPct(0.52), starPct(0.78), MAX_STARS];

  /* 徽记图形与成就一一对应（icon 键必须登记在 js/assets.js 的 IMAGES 里，
   * 少了就会被 tools/selftest.cjs 第 10 节的素材完整性检查拦下）。
   * 设计意图：未解锁时列表会降饱和到 50% 透明，所以每枚徽记靠轮廓区分，不靠颜色。 */
  const LIST = [
    { id: 'firstStar', icon: 'ach_firstStar', coins: 30, need: 1, check: function (c) { return c.stars >= 1; } },
    { id: 'allClear', icon: 'ach_allClear', coins: 260, need: LEVEL_COUNT, check: function (c) { return c.clearedLevels >= c.levelCount; } },
    { id: 'cascade8', icon: 'ach_cascade8', coins: 60, check: function (c) { return c.stats.maxCascade >= 8; } },
    { id: 'specials100', icon: 'ach_specials100', coins: 60, check: function (c) { return c.stats.specialsFired >= 100; } },
    { id: 'obst200', icon: 'ach_obst200', coins: 60, check: function (c) { return c.stats.obstaclesBroken >= 200; } },
    { id: 'daily7', icon: 'ach_daily7', coins: 80, check: function (c) { return c.dailyDays >= 7; } },
    { id: 'streak7', icon: 'ach_streak7', coins: 80, check: function (c) { return c.streakBest >= 7; } },
    { id: 'endless10', icon: 'ach_endless10', coins: 100, check: function (c) { return c.endlessBest >= 10; } },
    { id: 'timed8k', icon: 'ach_timed8k', coins: 100, check: function (c) { return c.timedBest >= 8000; } }
  ];

  /* 星级成就插在「第一颗星」与「通关全部」之间，顺序上读起来是递进的 */
  STAR_TIERS.forEach(function (t, i) {
    LIST.splice(1 + i, 0, {
      id: t.id, icon: t.icon, coins: t.coins, need: t.at,
      check: function (c) { return c.stars >= t.at; }
    });
  });

  /* 成就描述里要填的数字（星级门槛 / 通关关卡数） */
  function needOf(a) { return a && a.need != null ? a.need : 0; }

  /* 汇总判定上下文 */
  function context(data) {
    let stars = 0, clearedLevels = 0;
    const levels = LL.LEVELS || [];
    for (const k in data.stars) {
      if (Object.prototype.hasOwnProperty.call(data.stars, k)) stars += data.stars[k];
    }
    /* 「通关」以拿到过星为准（1 星即通关）；关卡数从 LL.LEVELS 取，加关卡不用改这里 */
    for (let i = 0; i < levels.length; i++) {
      if ((data.stars[levels[i].id] || 0) > 0) clearedLevels++;
    }
    let dailyDays = 0;
    for (const k in data.daily.cleared) {
      if (Object.prototype.hasOwnProperty.call(data.daily.cleared, k) && data.daily.cleared[k] > 0) dailyDays++;
    }
    return {
      stars: stars,
      clearedLevels: clearedLevels,
      levelCount: levels.length,
      stats: data.stats || {},
      dailyDays: dailyDays,
      streakBest: (data.streak && data.streak.best) || 0,
      endlessBest: (data.endless && data.endless.bestStage) || 0,
      timedBest: (data.timed && data.timed.best) || 0
    };
  }

  /* 返回本次新解锁的成就 id 列表（不做发奖，发奖在 Progress 里） */
  function newlyUnlocked(progress) {
    const ctx = context(progress.data);
    const got = progress.data.achievements || {};
    const out = [];
    LIST.forEach(function (a) {
      if (!got[a.id] && a.check(ctx)) out.push(a);
    });
    return out;
  }

  /* 画卷当前应显示到第几层（0~5） */
  function scrollTier(stars) {
    let n = 0;
    for (let i = 0; i < SCROLL_TIERS.length; i++) if (stars >= SCROLL_TIERS[i]) n = i + 1;
    return n;
  }

  function nextScrollGoal(stars) {
    for (let i = 0; i < SCROLL_TIERS.length; i++) {
      if (stars < SCROLL_TIERS[i]) return SCROLL_TIERS[i];
    }
    return 0;
  }

  LL.Achievements = {
    LIST: LIST,
    SCROLL_TIERS: SCROLL_TIERS,
    MAX_STARS: MAX_STARS,
    LEVEL_COUNT: LEVEL_COUNT,
    context: context,
    newlyUnlocked: newlyUnlocked,
    scrollTier: scrollTier,
    nextScrollGoal: nextScrollGoal,
    needOf: needOf
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
