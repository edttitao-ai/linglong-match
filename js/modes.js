/* 玲珑消 · modes.js — 无尽模式与限时挑战的关卡构造
 *
 * 两种模式都复用战役的全部玩法（同一套棋盘 / 特殊块 / 障碍 / 解析器），
 * 只是换掉「结束条件」与「胜负判定」：
 *   · 无尽：一盘一目标，达标即进入下一盘（剩余步数结转），步数耗尽即结束；
 *           每 3 盘加一种颜色、每 3 盘多给 2 步，障碍从第 2 盘开始出现。
 *   · 限时：60 秒内尽可能多得分，不计步数；按分数给三档金币。
 */
(function (global) {
  'use strict';
  const LL = (global.LL = global.LL || {});
  const CFG = LL.CFG;
  const U = LL.U;

  const M = {
    endless: {
      startMoves: 15,
      movesEvery: 3,
      movesStep: 2,
      /* 目标分按颜色分层线性增长：颜色越多越难凑分，所以换色的那一盘要把目标拉回来一点，
       * 但每一层的起点都高于上一层的终点，保证目标整体单调递增（否则玩家会以为出了 bug）。
       * 数值由 node tools/balance.cjs --endless 实测校准。 */
      /* 只用到 5 色：实测 6 色会让得分能力掉到 5 色的六成，难度直接断崖
       * （无尽靠障碍与目标增长来升级，而不是靠加颜色） */
      tiers: [
        { colors: 4, stages: 4, start: 3000, step: 450 },
        { colors: 5, stages: Infinity, start: 4450, step: 450 }
      ],
      carryCap: 5,          // 结转步数上限（既奖励精通，又不让前期优势无限滚雪球）
      coinsPerStage: 6,
      coinsCap: 60,
      maxColors: 6,
      colorEvery: 4,        // 每 4 盘多一种颜色
      obstStart: 3
    },
    timed: {
      seconds: 60,
      colors: 5,
      tiers: [3000, 6000, 9000],
      coins: [15, 30, 50]
    }
  };

  /* 无尽模式第 N 盘：颜色数、步数、目标分、障碍布局都由盘次决定 */
  function endlessLevel(stage) {
    const e = M.endless;
    /* 找到当前盘次所属的颜色层，并按该层的起点/步长算目标分 */
    let tier = e.tiers[0], offset = stage - 1;
    for (let i = 0; i < e.tiers.length; i++) {
      const t = e.tiers[i];
      const len = t.stages === Infinity ? Infinity : t.stages;
      if (offset < len) { tier = t; break; }
      offset -= len;
    }
    const colors = tier.colors;
    const moves = e.startMoves + Math.floor((stage - 1) / e.movesEvery) * e.movesStep;
    const target = Math.round((tier.start + offset * tier.step) / 50) * 50;
    const rnd = U.rng(LL.Daily.hash('linglong-endless-' + stage));

    let layout = null;
    if (stage >= e.obstStart) {
      /* 障碍随盘次缓慢增加，但绝不满盘：最多 12 格 */
      const count = Math.min(10, 4 + Math.floor((stage - e.obstStart) / 3) * 2);
      layout = LL.Daily.buildLayout
        ? LL.Daily.buildLayout(rnd, count, stage % 3 === 0)
        : null;
    }
    const def = {
      id: 'endless-' + stage,
      endless: true,
      stage: stage,
      colors: colors,
      moves: moves,
      objectives: [{ type: 'score', target: target }],
      stars: [target, Math.round(target * 1.25), Math.round(target * 1.6)],
      layout: layout
    };
    def.clearTotal = layout ? layout.join('').split('').filter(function (ch) {
      return ch === '*' || ch === '#' || ch === 'v';
    }).length : 0;
    return def;
  }

  /* 限时挑战：一套固定盘面规则，只比分数 */
  function timedLevel() {
    const t = M.timed;
    return {
      id: 'timed',
      timed: true,
      seconds: t.seconds,
      colors: t.colors,
      moves: 999,                       // 步数不参与判定，仅占位
      objectives: [{ type: 'score', target: t.tiers[0] }],
      stars: t.tiers.slice(),
      layout: null
    };
  }

  function timedCoins(score) {
    const t = M.timed;
    let coins = 0;
    for (let i = 0; i < t.tiers.length; i++) if (score >= t.tiers[i]) coins = t.coins[i];
    return coins;
  }

  function endlessCoins(stage) {
    const e = M.endless;
    return Math.min(e.coinsCap, Math.max(0, stage - 1) * e.coinsPerStage);
  }

  LL.Modes = {
    CFG: M,
    endlessLevel: endlessLevel,
    timedLevel: timedLevel,
    timedCoins: timedCoins,
    endlessCoins: endlessCoins
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
