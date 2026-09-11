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

  /* 画卷层与星数门槛 */
  const SCROLL_TIERS = [10, 25, 45, 65, 90];

  const LIST = [
    { id: 'firstStar', coins: 30, check: function (c) { return c.stars >= 1; } },
    { id: 'stars10', coins: 50, check: function (c) { return c.stars >= 10; } },
    { id: 'stars30', coins: 80, check: function (c) { return c.stars >= 30; } },
    { id: 'stars60', coins: 120, check: function (c) { return c.stars >= 60; } },
    { id: 'stars90', coins: 200, check: function (c) { return c.stars >= 90; } },
    { id: 'cascade8', coins: 60, check: function (c) { return c.stats.maxCascade >= 8; } },
    { id: 'specials100', coins: 60, check: function (c) { return c.stats.specialsFired >= 100; } },
    { id: 'obst200', coins: 60, check: function (c) { return c.stats.obstaclesBroken >= 200; } },
    { id: 'daily7', coins: 80, check: function (c) { return c.dailyDays >= 7; } },
    { id: 'streak7', coins: 80, check: function (c) { return c.streakBest >= 7; } },
    { id: 'endless10', coins: 100, check: function (c) { return c.endlessBest >= 10; } },
    { id: 'timed8k', coins: 100, check: function (c) { return c.timedBest >= 8000; } }
  ];

  /* 汇总判定上下文 */
  function context(data) {
    let stars = 0;
    for (const k in data.stars) {
      if (Object.prototype.hasOwnProperty.call(data.stars, k)) stars += data.stars[k];
    }
    let dailyDays = 0;
    for (const k in data.daily.cleared) {
      if (Object.prototype.hasOwnProperty.call(data.daily.cleared, k) && data.daily.cleared[k] > 0) dailyDays++;
    }
    return {
      stars: stars,
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
