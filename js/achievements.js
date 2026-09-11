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

  /* 画卷层与星数门槛。
   * 上限跟着关卡数走：50 关 × 3 星 = 150 星，所以门槛整体上移——
   * 原本按 30 关（90 星）配的 [10,25,45,65,90] 在 50 关下会早早全开，沉淀感就没了。 */
  const SCROLL_TIERS = [15, 40, 75, 115, 150];

  /* 徽记图形与成就一一对应（icon 键必须登记在 js/assets.js 的 IMAGES 里，
   * 少了就会被 tools/selftest.cjs 第 10 节的素材完整性检查拦下）。
   * 设计意图：未解锁时列表会降饱和到 50% 透明，所以每枚徽记靠轮廓区分，不靠颜色。
   * 星级门槛同样按 150 星上限重新分布：20 / 50 / 90 / 120 四档 + 满星。 */
  const LIST = [
    { id: 'firstStar', icon: 'ach_firstStar', coins: 30, check: function (c) { return c.stars >= 1; } },
    { id: 'stars20', icon: 'ach_stars20', coins: 50, check: function (c) { return c.stars >= 20; } },
    { id: 'stars50', icon: 'ach_stars50', coins: 90, check: function (c) { return c.stars >= 50; } },
    { id: 'stars90', icon: 'ach_stars90', coins: 140, check: function (c) { return c.stars >= 90; } },
    { id: 'stars120', icon: 'ach_stars120', coins: 200, check: function (c) { return c.stars >= 120; } },
    { id: 'allClear', icon: 'ach_allClear', coins: 260, check: function (c) { return c.clearedLevels >= c.levelCount; } },
    { id: 'cascade8', icon: 'ach_cascade8', coins: 60, check: function (c) { return c.stats.maxCascade >= 8; } },
    { id: 'specials100', icon: 'ach_specials100', coins: 60, check: function (c) { return c.stats.specialsFired >= 100; } },
    { id: 'obst200', icon: 'ach_obst200', coins: 60, check: function (c) { return c.stats.obstaclesBroken >= 200; } },
    { id: 'daily7', icon: 'ach_daily7', coins: 80, check: function (c) { return c.dailyDays >= 7; } },
    { id: 'streak7', icon: 'ach_streak7', coins: 80, check: function (c) { return c.streakBest >= 7; } },
    { id: 'endless10', icon: 'ach_endless10', coins: 100, check: function (c) { return c.endlessBest >= 10; } },
    { id: 'timed8k', icon: 'ach_timed8k', coins: 100, check: function (c) { return c.timedBest >= 8000; } }
  ];

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
    context: context,
    newlyUnlocked: newlyUnlocked,
    scrollTier: scrollTier,
    nextScrollGoal: nextScrollGoal
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
