/* 玲珑消 · quests.js — 每日任务：按日期确定的 3 条任务 + 进度统计 + 领取
 *
 * 设计约束（见 README「留存系统」）：
 *   · 每天 3 条，易 / 中 / 难各一，完成率目标约 90% / 65% / 40%
 *   · 三条都能在正常通关中顺手完成，不需要专门的模式，合计 15~25 分钟
 *   · 与日期绑定（同一天重新打开还是同一组任务），每天 1 次免费换牌
 */
(function (global) {
  'use strict';
  const LL = (global.LL = global.LL || {});
  const CFG = LL.CFG;
  const U = LL.U;

  /* 任务类型：target 按难度取值；kind 决定进度从哪个事件累加 */
  const POOL = [
    { kind: 'winLevels', tier: 'easy', target: 2 },
    { kind: 'winLevels', tier: 'medium', target: 3 },
    { kind: 'winLevels', tier: 'hard', target: 4 },
    { kind: 'collectColor', tier: 'easy', target: 30 },
    { kind: 'collectColor', tier: 'medium', target: 45 },
    { kind: 'collectColor', tier: 'hard', target: 60 },
    { kind: 'breakObstacles', tier: 'easy', target: 8 },
    { kind: 'breakObstacles', tier: 'medium', target: 14 },
    { kind: 'breakObstacles', tier: 'hard', target: 20 },
    { kind: 'cascade', tier: 'easy', target: 4 },
    { kind: 'cascade', tier: 'medium', target: 5 },
    { kind: 'cascade', tier: 'hard', target: 6 },
    { kind: 'fireSpecials', tier: 'easy', target: 6 },
    { kind: 'fireSpecials', tier: 'medium', target: 10 },
    { kind: 'fireSpecials', tier: 'hard', target: 16 },
    { kind: 'stars', tier: 'easy', target: 4 },
    { kind: 'stars', tier: 'medium', target: 6 },
    { kind: 'stars', tier: 'hard', target: 8 },
    { kind: 'noReviveWins', tier: 'easy', target: 1 },
    { kind: 'noReviveWins', tier: 'medium', target: 2 },
    { kind: 'noReviveWins', tier: 'hard', target: 3 }
  ];

  const TIERS = ['easy', 'medium', 'hard'];

  function daySeed(dayKey, salt) {
    return LL.Daily.hash('linglong-quests-' + dayKey + '-' + (salt || 0));
  }

  /* 生成某天的任务组：三条分别取自易/中/难，且**种类互不相同**
   * （同一天出现两条「不使用续步通关」会显得敷衍）；颜色类任务的颜色也由种子决定 */
  function generate(dayKey, salt) {
    const rnd = U.rng(daySeed(dayKey, salt));
    const out = [];
    const used = [];
    TIERS.forEach(function (tier) {
      let cands = POOL.filter(function (q) { return q.tier === tier && used.indexOf(q.kind) < 0; });
      if (!cands.length) cands = POOL.filter(function (q) { return q.tier === tier; });
      const pick = cands[(rnd() * cands.length) | 0];
      used.push(pick.kind);
      const q = { kind: pick.kind, tier: tier, target: pick.target };
      if (pick.kind === 'collectColor') q.color = (rnd() * CFG.TILE_KINDS) | 0;
      out.push(q);
    });
    return out;
  }

  /* 重新抽一条同难度的其他任务（换牌用） */
  function reroll(quest, dayKey, salt) {
    const rnd = U.rng(daySeed(dayKey, (salt || 0) + 1) ^ (LL.Daily.hash(quest.kind + quest.tier)));
    const cands = POOL.filter(function (q) {
      return q.tier === quest.tier && q.kind !== quest.kind;
    });
    const pick = cands[(rnd() * cands.length) | 0];
    const q = { kind: pick.kind, tier: pick.tier, target: pick.target };
    if (pick.kind === 'collectColor') q.color = (rnd() * CFG.TILE_KINDS) | 0;
    return q;
  }

  /* 任务名与进度文案（数值在 i18n 里拼） */
  function describe(q, I18N) {
    const p = { n: q.target };
    if (q.kind === 'collectColor') p.name = I18N.tileName(q.color);
    return I18N.t('quest_' + q.kind, p);
  }

  function progressText(q, cur, I18N) {
    return Math.min(cur, q.target) + ' / ' + q.target;
  }

  /* 进度累加：cur 是当前值，ev 是游戏事件；返回新的当前值 */
  function apply(cur, q, ev) {
    switch (q.kind) {
      case 'winLevels':
        return cur + (ev.win ? 1 : 0);
      case 'stars':
        return cur + (ev.win ? (ev.stars || 0) : 0);
      case 'noReviveWins':
        return cur + (ev.win && !ev.revived ? 1 : 0);
      case 'cascade':
        return ev.cascade ? Math.max(cur, ev.cascade) : cur;
      case 'collectColor':
        return cur + ((ev.collected && ev.collected[q.color]) || 0);
      case 'breakObstacles':
        return cur + (ev.obstaclesBroken || 0);
      case 'fireSpecials':
        return cur + (ev.specialsFired || 0);
      default:
        return cur;
    }
  }

  LL.Quests = {
    POOL: POOL,
    generate: generate,
    reroll: reroll,
    describe: describe,
    progressText: progressText,
    apply: apply,
    daySeed: daySeed
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
