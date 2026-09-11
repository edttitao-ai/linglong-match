/* 玲珑消 · skills.js — 局内技能「灵力」：收支规则与消除计划（无 DOM，可在 Node 下加载）
 *
 * 为什么要有这个系统：单纯三消时玩家在局内没有任何能动性——卡住了只能眼看盘面
 * 恶化，唯一的两条路（金币续步、开局道具）一条是认输后的补救、一条要求提前买好。
 * 灵力把「我攒了一手，现在放」还给玩家：能自救、有铺垫、放出来好看。
 *
 * 铁律（见 README）：金币只能买「重试的机会」，不能买「永久的强」。
 * 所以灵力**只能玩出来、不能买**——它是「这一局」的临时力量，不进经济系统，
 * 也不影响关卡数值验证（要调整体强度请改 CFG.QI / 关卡上的 skills 覆写）。
 *
 * 本文件只做「计划」（算清要消除哪些格、要花多少灵力、能涨多少灵力），
 * 真正的状态修改统一交给 Board.applyClear / Board.shuffleBoard / Resolver.beginSkill。
 */
(function (global) {
  'use strict';
  const LL = (global.LL = global.LL || {});
  const CFG = LL.CFG;
  const B = LL.Board;
  const SP = LL.Special;
  const S = CFG.SPECIAL;

  /* ---------------- 定义与取用 ---------------- */

  function def(id) { return CFG.SKILLS[id] || null; }

  function order() { return CFG.SKILLS.order.slice(); }

  /* 关卡可以覆写灵力的起步值与整体倍率——这是调数值时的唯一杠杆，
   * 不用去动关卡设计本身（见 README「局内技能」）。 */
  function qiStartFor(level) {
    const o = level && level.skills;
    return o && o.qiStart != null ? o.qiStart : CFG.QI.START;
  }

  function qiScaleFor(level) {
    const o = level && level.skills;
    return o && o.qiScale != null ? o.qiScale : 1;
  }

  /* ---------------- 灵力收支 ---------------- */

  /* 本回合灵力获取倍率：背水一战期间翻倍（限时模式没有步数概念，恒为 1） */
  function gainMult(movesLeft, timed) {
    if (timed) return 1;
    return movesLeft <= CFG.QI.LAST_STAND_AT ? CFG.QI.LAST_STAND_MULT : 1;
  }

  /* 一次消除事件能涨多少灵力（纯函数，ev 就是 Resolver 的 clear 事件）
   *
   * 关键约束：**技能自己买来的消除不返灵力**（ev.skill）。
   * 否则移山清 15 格返 15 点、连锁再返一波，最贵的技能会接近自给自足——
   * 上界回归实测过：不设这条时全 30 关胜率被推到 100%，难度直接塌陷。
   * 但技能引发的**连锁**照常返灵力，所以「大招接连锁」依然爽，只是需要挑时机。 */
  function gain(ev, mult) {
    const Q = CFG.QI;
    let q = ev.skill ? 0 : (ev.cells ? ev.cells.length : 0) * Q.PER_TILE;
    if (ev.cascade >= 2) q += (ev.cascade - 1) * Q.PER_CASCADE;
    if (ev.obstacles) {
      for (let i = 0; i < ev.obstacles.length; i++) if (ev.obstacles[i].broken) q += Q.PER_OBSTACLE;
    }
    q += (ev.fires ? ev.fires.length : 0) * Q.PER_FIRE;
    if (ev.cause === 'combo') q += Q.PER_COMBO;
    return Math.round(q * (mult || 1));
  }

  /* 入账：满槽后的溢出折算成分数，避免「不敢花就浪费」的负罪感 */
  function addQi(qi, amount) {
    const room = Math.max(0, CFG.QI.MAX - qi);
    const gained = Math.min(room, Math.max(0, amount));
    const overflow = Math.max(0, amount) - gained;
    return { qi: qi + gained, gained: gained, overflow: overflow, score: overflow * CFG.QI.OVERFLOW_SCORE };
  }

  function isFull(qi) { return qi >= CFG.QI.MAX; }

  /* ---------------- 技能可用性 ---------------- */

  /* 实际价格：换天在盘面已无解时免费 */
  function cost(board, id) {
    const d = def(id);
    if (!d) return Infinity;
    if (d.freeWhenStuck && board && !B.hasValidMove(board)) return 0;
    return d.cost;
  }

  /* 返回 { ok, cost, reason }；reason: 'unknown' | 'qi' | 'busy' */
  function canUse(board, qi, id, busy) {
    const d = def(id);
    if (!d) return { ok: false, cost: Infinity, reason: 'unknown' };
    if (busy) return { ok: false, cost: cost(board, id), reason: 'busy' };
    const c = cost(board, id);
    if (qi < c) return { ok: false, cost: c, reason: 'qi' };
    return { ok: true, cost: c };
  }

  /* 目标格是否合法：锤子要砸得到东西、十字总归有东西可炸、改色只认普通块 */
  function validTarget(board, cell, id) {
    if (!board || !cell || !B.inB(board, cell.r, cell.c)) return false;
    const r = cell.r, c = cell.c;
    if (!board.playable[r][c]) return false;
    const tl = board.cells[r][c];
    if (id === 'color') return !!tl && tl.s === S.NONE;   /* 特殊块/太极不接受改色 */
    if (id === 'hammer') return !!tl || !!board.obst[r][c]; /* 空格又无障可破时不浪费灵力 */
    if (id === 'cross') return true;
    return false;
  }

  /* ---------------- 四个技能的消除计划 ---------------- */

  /* 如意锤：目标格砸两下（第一下清块、第二下补在障碍上，所以能一次破开石锁），
   * 被波及的特殊块照常引爆、只吃一下。 */
  function planHammer(board, cell) {
    const k = B.key(board, cell.r, cell.c);
    const exp = SP.expandClear(board, new Set([k]), new Set());
    return {
      keys: exp.set, fires: exp.fires, spawns: null,
      secondHit: [k], cause: def('hammer').cause
    };
  }

  /* 移山：以目标格为中心的整行 + 整列十字爆破，并链式引爆波及到的特殊块 */
  function planCross(board, cell) {
    const base = new Set();
    for (let c = 0; c < board.C; c++) {
      if (board.playable[cell.r][c] && board.cells[cell.r][c]) base.add(B.key(board, cell.r, c));
    }
    for (let r = 0; r < board.R; r++) {
      if (board.playable[r][cell.c] && board.cells[r][cell.c]) base.add(B.key(board, r, cell.c));
    }
    const exp = SP.expandClear(board, base, new Set());
    return { keys: exp.set, fires: exp.fires, spawns: null, cause: def('cross').cause };
  }

  /* 灵犀一点：把一格改成指定颜色。这里只改颜色，随后由 Resolver 走一遍正常的
   * 匹配扫描——所以它凑出的三连会自然连锁、自然生成特殊块，而不是凭空消除。 */
  function recolor(board, cell, color) {
    const tl = board && board.cells[cell.r][cell.c];
    if (!tl || tl.s !== S.NONE) return false;
    if (color < 0 || color >= board.colors) return false;
    tl.t = color;
    return true;
  }

  /* 技能 → 计划（供 Resolver.beginSkill 使用）；'swap' 不走消除，返回 null */
  function plan(board, id, cell) {
    if (id === 'hammer') return planHammer(board, cell);
    if (id === 'cross') return planCross(board, cell);
    return null;
  }

  /* ---------------- 绝处逢生 ---------------- */

  /* 步数耗尽且目标未完成时，花灵力换步数（不走金币）。返回 null 表示不提供。 */
  function lastStandOffer(qi, used) {
    const L = CFG.LAST_STAND;
    if ((used || 0) >= L.max) return null;
    if (qi < L.cost) return null;
    return { cost: L.cost, moves: L.moves, used: used || 0 };
  }

  LL.Skills = {
    def: def,
    order: order,
    qiStartFor: qiStartFor,
    qiScaleFor: qiScaleFor,
    gainMult: gainMult,
    gain: gain,
    addQi: addQi,
    isFull: isFull,
    cost: cost,
    canUse: canUse,
    validTarget: validTarget,
    planHammer: planHammer,
    planCross: planCross,
    recolor: recolor,
    plan: plan,
    lastStandOffer: lastStandOffer
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
