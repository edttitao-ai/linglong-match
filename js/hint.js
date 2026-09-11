/* 玲珑消 · hint.js — 「哪一步最好」的唯一判定（无 DOM，可在 Node 下加载）
 *
 * 起因：空闲提示原先取的是 B.findAllMoves 的第一个元素，也就是「从左上角扫到的
 * 第一个能凑成三连的位置」——对正在找最优解的玩家来说，这是在帮倒忙。
 *
 * 这里把 tools/balance.cjs 里那个已经被数值验证过的贪心玩家打分抽出来，
 * 做成游戏与工具共用的一份判定：**提示的最优解**和**模拟器认为的最优解**
 * 从此是同一个标准，不会各说各话。
 *
 * 打分口径（一步贪心，不做全盘搜索）：组合爆破 / 太极 > 引爆已有特殊块 >
 * 破障 > 收集目标色 > 生成特殊块 > 单纯消块。选它是为了和关卡数值验证对齐——
 * 如果这里偷偷变聪明，balance.cjs 的胜率就不再代表真实难度了。
 */
(function (global) {
  'use strict';
  const LL = (global.LL = global.LL || {});
  const B = LL.Board;
  const SP = LL.Special;
  const CFG = LL.CFG;
  const S = CFG.SPECIAL;

  /* 权重：走法的价值 ≈ 它实际会清掉的东西的价值。
   * 「组合 / 太极」不靠匹配消除，所以不能拍一个固定加分——早先给的是 +55/+60，
   * 结果「清三行三列」这种大爆破会输给一次带收集加成的普通三连（33+26=59），
   * 提示于是推荐那个没营养的走法。现在改成让 Special 算出真实的爆破范围再估值。 */
  const W = {
    perTile: 11,      // 每清掉一块
    perSpecial: 30,   // 生成一个特殊块
    perCollect: 26,   // 清掉一个本关要收集的颜色
    perObstacle: 34,  // 波及一个障碍
    perFire: 40       // 触发一次连锁引爆（在爆破范围已计入之外，再给一点顺位加权）
  };

  /* 这一步实际会清掉哪些格：交给 Special 算，不在提示里另写一套规则 */
  function planOf(board, move) {
    if (move.kind === 'special' || move.kind === 'taiji') {
      const combo = SP.planCombo(board, move.a, move.b);
      if (combo) return SP.buildComboClear(board, combo);
      return null;
    }
    B.swapTiles(board, move.a, move.b);
    const groups = B.findMatches(board);
    const plan = groups.length ? SP.planMatches(board, groups, [move.b, move.a]) : null;
    B.swapTiles(board, move.a, move.b);
    return plan;
  }

  /* 给一步走法打分。返回 { score, why }——why 是分项明细，
   * 提示系统拿最大的那一项当「为什么推荐这一步」讲给玩家听。 */
  function score(board, move, level) {
    const why = { combo: 0, taiji: 0, tiles: 0, specials: 0, collect: 0, obstacles: 0, fire: 0 };
    const plan = planOf(board, move);
    if (!plan) {
      /* 组合意外构不成（理论上不该发生）：给个最低分，别让提示推荐它 */
      return { score: 0, why: why };
    }

    const obj = (level && level.objectives) || [];
    let tiles = 0, collect = 0, obstacles = 0;
    plan.keys.forEach(function (k) {
      const r = B.rowOf(board, k), c = B.colOf(board, k);
      const tl = board.cells[r][c];
      if (!tl) return;
      tiles++;
      for (let j = 0; j < obj.length; j++) {
        const o = obj[j];
        if (o.type === 'collect' && o.color === tl.t) collect += W.perCollect;
      }
      if (board.obst[r][c]) obstacles += W.perObstacle;
    });

    why.tiles = tiles * W.perTile;
    why.specials = (plan.spawns ? plan.spawns.length : 0) * W.perSpecial;
    why.collect = collect;
    why.obstacles = obstacles;
    why.fire = (plan.fires ? plan.fires.length : 0) * W.perFire;
    /* 组合/太极本身单列一项，好让提示能直说「这一步能组合爆破」 */
    if (move.kind === 'special') why.combo = 1;
    if (move.kind === 'taiji') why.taiji = 1;

    const total = why.tiles + why.specials + why.collect + why.obstacles + why.fire;
    /* combo/taiji 的标记项只是「理由标签」，不参与算分（爆破范围已经计过价了），
     * 但要保证它们在同分时排在前面——大爆破往往同时满足多个目标。 */
    return { score: total + (move.kind === 'special' ? 1 : move.kind === 'taiji' ? 2 : 0), why: why };
  }

  /* 全部可行走法按分数降序（同分保持扫描顺序，所以结果是确定的）。
   * limit 传 0 表示要全部。 */
  function rank(board, level, limit) {
    const moves = B.findAllMoves(board, 0);
    const out = [];
    for (let i = 0; i < moves.length; i++) {
      const r = score(board, moves[i], level);
      out.push({ a: moves[i].a, b: moves[i].b, kind: moves[i].kind, score: r.score, why: r.why });
    }
    out.sort(function (x, y) { return y.score - x.score; });
    return limit > 0 ? out.slice(0, limit) : out;
  }

  /* 最优的一步（没有可行走法时返回 null） */
  function best(board, level) {
    const list = rank(board, level, 1);
    return list.length ? list[0] : null;
  }

  /* 把分项明细翻成一句理由：取贡献最大的一项。
   * 返回 i18n 的键，文案在 lang/*.js 里——这样中英都能讲清楚为什么推荐这一步。 */
  const REASONS = [
    ['taiji', 'hintTaiji'],
    ['combo', 'hintCombo'],
    ['fire', 'hintFire'],
    ['obstacles', 'hintObstacle'],
    ['collect', 'hintCollect'],
    ['specials', 'hintSpecial'],
    ['tiles', 'hintTiles']
  ];

  function reasonKey(why) {
    if (!why) return 'hintTiles';
    let bestKey = 'hintTiles', bestVal = 0;
    for (let i = 0; i < REASONS.length; i++) {
      const v = why[REASONS[i][0]] || 0;
      if (v > bestVal) { bestVal = v; bestKey = REASONS[i][1]; }
    }
    return bestKey;
  }

  LL.Hint = {
    W: W,
    score: score,
    rank: rank,
    best: best,
    reasonKey: reasonKey
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
