/* 玲珑消 · daily.js — 每日挑战的确定性关卡生成
 *
 * 同一天在所有设备上生成完全相同的盘面（日期字符串 → FNV-1a 哈希 → U.rng 种子），
 * 因此离线也能有「今天大家打的是同一局」的共识感；不限尝试次数，但只记首通。
 * 复杂度按星期排布：周一最温和，周日是全清障的硬仗。
 */
(function (global) {
  'use strict';
  const LL = (global.LL = global.LL || {});
  const CFG = LL.CFG;
  const U = LL.U;

  const WEEK_ZH = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const WEEK_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MON_ZH = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  const MON_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /* FNV-1a：把日期字符串变成稳定的 32 位种子 */
  function hash(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function dateOf(dayKey) {
    const p = dayKey.split('-');
    return new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
  }

  /* 障碍配比：周日以霜为主（一次即破），避免 2 层的石锁堆积把清障关变成硬墙 */
  function pickKind(rnd, frostHeavy) {
    const x = rnd();
    if (frostHeavy) {
      if (x < 0.74) return '*';
      if (x < 0.92) return '#';
      return 'v';
    }
    if (x < 0.64) return '*';
    if (x < 0.92) return '#';
    return 'v';
  }

  /* 成簇放置障碍：比纯随机更好看，也更容易形成「一处处啃」的节奏。
   * 数量按当天目标类型决定——清障关才铺得多，分数/收集关只撒一点做变化。 */
  function makeLayout(rnd, count, frostHeavy) {
    const R = CFG.ROWS, C = CFG.COLS;
    const grid = [];
    for (let r = 0; r < R; r++) grid.push(new Array(C).fill('.'));
    let placed = 0, guard = 0;
    while (placed < count && guard++ < 500) {
      /* 七成落在盘面中部：贴边的障碍很难被消到，容易把难度推到「靠运气」 */
      const inner = rnd() < 0.7;
      const r = inner ? (1 + ((rnd() * (R - 2)) | 0)) : ((rnd() * R) | 0);
      const c = inner ? (1 + ((rnd() * (C - 2)) | 0)) : ((rnd() * C) | 0);
      if (grid[r][c] !== '.') continue;
      grid[r][c] = pickKind(rnd, frostHeavy);
      placed++;
      const r2 = Math.min(R - 1, r + ((rnd() * 2) | 0));
      const c2 = Math.min(C - 1, c + ((rnd() * 2) | 0));
      if (placed < count && grid[r2][c2] === '.') {
        grid[r2][c2] = pickKind(rnd, frostHeavy);
        placed++;
      }
    }
    return grid.map(function (row) { return row.join(''); });
  }

  function countObstacles(layout) {
    let n = 0;
    for (let r = 0; r < layout.length; r++) {
      for (let c = 0; c < layout[r].length; c++) {
        const ch = layout[r].charAt(c);
        if (ch === '*' || ch === '#' || ch === 'v') n++;
      }
    }
    return n;
  }

  /* 生成某一天的关卡定义（形状与 levels.js 的条目一致，另加 daily/dayKey 标记） */
  function build(dayKey) {
    const seed = hash('linglong-daily-' + dayKey);
    const rnd = U.rng(seed);
    const date = dateOf(dayKey);
    const dow = date.getDay();
    const moves = 18 + ((rnd() * 5) | 0);                 // 18–22
    const isClearDay = (dow === 0 || dow === 5 || dow === 6);
    /* 清障关固定 5 色：6 色时凑不出足够的指定位置，清障会退化成「靠运气」 */
    const colors = isClearDay ? 5 : ((dow % 2 === 0) ? 6 : 5);

    /* 障碍数量与目标类型挂钩（数值由 tools/balance.cjs --daily 抽查校准）：
     * 清障关铺得少而专注，分数/收集关只撒一点做变化 */
    let obstCount, frostHeavy = false, objectives;
    if (dow === 0) {
      obstCount = 11 + ((rnd() * 2) | 0);                 // 周日：主打清障，以霜为主
      frostHeavy = true;
      objectives = [{ type: 'clear' }];
    } else if (dow === 5 || dow === 6) {
      obstCount = 9;                                       // 周五/六：分数 + 少量清障
      objectives = [{ type: 'score', target: 2300 + ((rnd() * 500) | 0) }, { type: 'clear' }];
    } else if (dow === 3 || dow === 4) {
      obstCount = 6;                                       // 周三/四：收集为主
      const c1 = (rnd() * colors) | 0;
      const c2 = (c1 + 1 + ((rnd() * (colors - 1)) | 0)) % colors;
      const many = colors >= 6 ? 17 : 24;
      objectives = [{ type: 'collect', color: c1, count: many + ((rnd() * 3) | 0) }];
      if (rnd() < 0.55) objectives.push({ type: 'collect', color: c2, count: many - 5 });
    } else {
      obstCount = 6;                                       // 周一/二：纯分数
      objectives = [{ type: 'score', target: (colors >= 6 ? 3400 : 5100) + ((rnd() * 700) | 0) }];
    }

    const layout = makeLayout(rnd, obstCount, frostHeavy);
    const clearTotal = countObstacles(layout);
    objectives.forEach(function (o) { if (o.type === 'clear') o.count = clearTotal; });

    const scoreBase = Math.round(moves * 190);
    const stars = [Math.round(scoreBase * 0.72), scoreBase, Math.round(scoreBase * 1.35)];
    const m = date.getMonth(), d = date.getDate();

    return {
      id: 'daily-' + dayKey,
      dayKey: dayKey,
      daily: true,
      colors: colors,
      moves: moves,
      objectives: objectives,
      stars: stars,
      layout: layout,
      clearTotal: clearTotal,
      name: (m + 1) + '月' + d + '日 · ' + WEEK_ZH[dow],
      nameEn: MON_EN[m] + ' ' + d + ' · ' + WEEK_EN[dow]
    };
  }

  /* 每日挑战奖励：首通 40 金币，达 2 星及以上再 +30（不占每日产出上限） */
  const FIRST_CLEAR_COINS = 40;
  const STAR_BONUS_COINS = 30;

  LL.Daily = {
    hash: hash,
    build: build,
    dateOf: dateOf,
    buildLayout: makeLayout,       /* 供无尽模式复用同一套障碍生成 */
    countObstacles: countObstacles,
    FIRST_CLEAR_COINS: FIRST_CLEAR_COINS,
    STAR_BONUS_COINS: STAR_BONUS_COINS
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
