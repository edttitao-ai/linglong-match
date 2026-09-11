/* 玲珑消 · resolver.js — 回合解析状态机（无 DOM，可在 Node 下加载）
 *
 * 一次完整回合的步骤序列：
 *   交换(swap) → [组合爆破(clear,cause=combo)] → 匹配(clear) ↔ 下落(fall) … → 回合结束(turnEnd)
 * 技能回合（beginSkill / beginScan）走的是同一条流水线：先用技能算好的计划消一次，
 * 再进入上面的「匹配 ↔ 下落」循环——所以分数、连锁、任务与成就统计全都自动生效。
 * 表现层每播完一个事件的动画就调用一次 step() 取下一个事件；
 * 自检脚本可以连续调用 step() 直到返回 turnEnd，无需任何动画。
 */
(function (global) {
  'use strict';
  const LL = (global.LL = global.LL || {});
  const CFG = LL.CFG;
  const B = LL.Board;
  const SP = LL.Special;
  const S = CFG.SPECIAL;

  function create(board) {
    return { b: board, turn: null };
  }

  function cascadeMult(n) {
    return Math.min(1 + CFG.CASCADE_STEP * (n - 1), CFG.CASCADE_CAP);
  }

  /* 尝试发起一次交换；返回 { ok, event? , reason? } */
  function beginTurn(rs, a, b2) {
    if (rs.turn) return { ok: false, reason: 'busy' };
    const b = rs.b;
    if (!B.canSwap(b, a.r, a.c, b2.r, b2.c)) return { ok: false, reason: 'invalid' };
    B.swapTiles(b, a, b2);
    const combo = SP.planCombo(b, a, b2);
    let ok = !!combo;
    if (!ok) ok = B.matchThrough(b, [a, b2]);
    if (!ok) {
      B.swapTiles(b, a, b2);
      return { ok: false, reason: 'nomatch' };
    }
    rs.turn = newTurn();
    rs.turn.a = { r: a.r, c: a.c };
    rs.turn.b = { r: b2.r, c: b2.c };
    rs.turn.combo = combo;
    return { ok: true, event: { kind: 'swap', a: a, b: b2, combo: combo ? combo.kind : null, dur: CFG.ANIM.swap } };
  }

  /* 发起一次技能回合：把技能算好的消除计划塞进回合累加器，之后完全复用 step()
   * 的 clear → fall → 连锁匹配流水线，所以分数、连锁、任务与成就统计全部自动生效。
   * plan = { keys:Set, fires:[], spawns:[]|null, secondHit:[key]|null, cause } */
  function beginSkill(rs, plan) {
    if (rs.turn) return { ok: false, reason: 'busy' };
    rs.turn = newTurn();
    rs.turn.skill = {
      keys: plan.keys || null,
      fires: plan.fires || [],
      spawns: plan.spawns || null,
      secondHit: plan.secondHit || null,
      cause: plan.cause || 'skill'
    };
    return { ok: true };
  }

  /* 只做一次匹配扫描（不改盘面）：灵犀一点改完色后用它接着跑连锁 */
  function beginScan(rs) {
    if (rs.turn) return { ok: false, reason: 'busy' };
    rs.turn = newTurn();
    return { ok: true };
  }

  function tally(rs, res, plan, mult) {
    const tn = rs.turn;
    let gained = 0;
    for (let i = 0; i < res.cells.length; i++) {
      const cell = res.cells[i];
      gained += CFG.SCORE_TILE;
      tn.cleared++;
      if (cell.t >= 0) tn.collected[cell.t] = (tn.collected[cell.t] || 0) + 1;
    }
    gained += res.spawned.length * CFG.SCORE_SPECIAL_CREATE;
    gained += plan.fires.length * CFG.SCORE_SPECIAL_FIRE;
    gained = Math.round(gained * mult);
    tn.score += gained;
    tn.specialsMade += res.spawned.length;
    tn.specialsFired += plan.fires.length;
    for (let i = 0; i < res.obstacles.length; i++) if (res.obstacles[i].broken) tn.obstaclesCleared++;
    return gained;
  }

  /* 空回合累加器：技能回合与匹配扫描共用（技能不消耗步数，所以没有 a/b 两格） */
  function newTurn() {
    return {
      a: null, b: null, combo: null, skill: null,
      cascade: 0, needFall: false, score: 0,
      collected: {}, cleared: 0, obstaclesCleared: 0,
      maxCascade: 0, specialsMade: 0, specialsFired: 0
    };
  }

  function fallDuration(g) {
    let maxD = 1;
    for (let i = 0; i < g.moves.length; i++) maxD = Math.max(maxD, Math.abs(g.moves[i].toR - g.moves[i].fromR));
    for (let i = 0; i < g.spawns.length; i++) maxD = Math.max(maxD, g.spawns[i].toR - g.spawns[i].fromR);
    return Math.min(CFG.ANIM.fallBase + CFG.ANIM.fallPerRow * maxD, CFG.ANIM.fallMax);
  }

  function step(rs) {
    const b = rs.b, tn = rs.turn;
    if (!tn) return null;

    /* 0) 技能消除（灵力）：计划由 skills.js 算好，这里只负责应用并接入流水线 */
    if (tn.skill) {
      const sk = tn.skill;
      tn.skill = null;
      if (sk.keys && sk.keys.size) {
        tn.cascade = 1;
        const mult = cascadeMult(1);
        const res = B.applyClear(b, sk.keys, sk.spawns);
        /* 第二次击打只落在目标格上（如意锤的 2 点破障）：
         * 格子不会重复入列，障碍则可能先裂再碎，表现层两种都能画。 */
        if (sk.secondHit) {
          const again = B.applyClear(b, sk.secondHit, null);
          for (let i = 0; i < again.obstacles.length; i++) res.obstacles.push(again.obstacles[i]);
        }
        const gained = tally(rs, res, sk, mult);
        tn.needFall = true;
        tn.maxCascade = Math.max(tn.maxCascade, 1);
        return {
          kind: 'clear', cause: sk.cause, skill: true, cells: res.cells, obstacles: res.obstacles,
          spawned: res.spawned, fires: sk.fires, score: gained, mult: mult, cascade: 1,
          dur: CFG.ANIM.clear
        };
      }
      /* keys 为空：本次技能不消除任何格，继续往下走匹配扫描 */
    }

    /* 1) 组合爆破 */
    if (tn.combo) {
      const plan = SP.buildComboClear(b, tn.combo);
      tn.combo = null;
      tn.cascade = 1;
      const mult = cascadeMult(1);
      const res = B.applyClear(b, plan.keys, plan.spawns);
      const gained = tally(rs, res, plan, mult);
      tn.needFall = true;
      tn.maxCascade = Math.max(tn.maxCascade, 1);
      return {
        kind: 'clear', cause: 'combo', cells: res.cells, obstacles: res.obstacles,
        spawned: res.spawned, fires: plan.fires, score: gained, mult: mult, cascade: 1,
        dur: CFG.ANIM.clear
      };
    }

    /* 2) 下落与补充 */
    if (tn.needFall) {
      tn.needFall = false;
      const g = B.applyGravity(b);
      return { kind: 'fall', moves: g.moves, spawns: g.spawns, dur: fallDuration(g) };
    }

    /* 3) 匹配消除 */
    const groups = B.findMatches(b);
    if (groups.length) {
      tn.cascade++;
      const mult = cascadeMult(tn.cascade);
      /* 技能回合没有交换的两格（a/b 为 null），此时不指定生成落点偏好 */
      const plan = SP.planMatches(b, groups, tn.b ? [tn.b, tn.a] : null);
      const res = B.applyClear(b, plan.keys, plan.spawns);
      const gained = tally(rs, res, plan, mult);
      tn.needFall = true;
      tn.maxCascade = Math.max(tn.maxCascade, tn.cascade);
      return {
        kind: 'clear', cause: 'match', cells: res.cells, obstacles: res.obstacles,
        spawned: res.spawned, fires: plan.fires, score: gained, mult: mult, cascade: tn.cascade,
        dur: Math.max(120, Math.round(CFG.ANIM.clear * Math.pow(CFG.CASCADE_SPEEDUP, tn.cascade - 1)))
      };
    }

    /* 4) 回合结束 */
    rs.turn = null;
    return {
      kind: 'turnEnd',
      score: tn.score,
      collected: tn.collected,
      cleared: tn.cleared,
      obstaclesCleared: tn.obstaclesCleared,
      maxCascade: tn.maxCascade,
      specialsMade: tn.specialsMade,
      specialsFired: tn.specialsFired,
      needsShuffle: !B.hasValidMove(b)
    };
  }

  /* 整段跑完一个回合（自检 / 平衡脚本用） */
  function runTurn(rs, a, b2, maxSteps) {
    const start = beginTurn(rs, a, b2);
    if (!start.ok) return { ok: false, reason: start.reason, events: [] };
    const events = [start.event];
    const cap = maxSteps || 400;
    for (let i = 0; i < cap; i++) {
      const ev = step(rs);
      if (!ev) break;
      events.push(ev);
      if (ev.kind === 'turnEnd') break;
    }
    return { ok: true, events: events };
  }

  /* 死局洗牌；返回给表现层的洗牌事件 */
  function shuffle(rs) {
    const r = B.shuffleBoard(rs.b);
    return { kind: 'shuffle', moves: r.moves, regen: r.regen, dur: CFG.ANIM.shuffle, needsShuffleAfter: !B.hasValidMove(rs.b) };
  }

  LL.Resolver = {
    create: create,
    beginTurn: beginTurn,
    beginSkill: beginSkill,
    beginScan: beginScan,
    step: step,
    runTurn: runTurn,
    shuffle: shuffle,
    cascadeMult: cascadeMult
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
