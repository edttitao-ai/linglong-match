/* 玲珑消 · board.js — 棋盘核心逻辑（无 DOM，可在 Node 下加载）
 *
 * 数据模型：
 *   board.cells[r][c] = { t, s } | null    t: 颜色下标（-1 = 无色的太极），s: 特殊块类型
 *   board.obst[r][c]  = { k, hp } | null   k: 障碍类型（霜 / 石锁 / 藤蔓）
 *   board.playable[r][c] = bool            预留：false 为不可玩格（挖洞棋盘）
 *
 * 约定：
 *   - 只有 t >= 0 的块参与颜色匹配；太极（s = TAIJI，t = -1）不参与。
 *   - 藤蔓（VINE）锁住的块不可交换、不可下落，重力在藤蔓处分段。
 *   - 本文件所有函数直接修改传入的 board，不产生 DOM 依赖。
 */
(function (global) {
  'use strict';
  const LL = (global.LL = global.LL || {});
  const CFG = LL.CFG;
  const S = CFG.SPECIAL;
  const O = CFG.OBST;

  /* ============ 基础访问 ============ */

  function tile(t, s) { return { t: t, s: s || 0 }; }
  function inB(b, r, c) { return r >= 0 && r < b.R && c >= 0 && c < b.C; }
  function key(b, r, c) { return r * b.C + c; }
  function rowOf(b, k) { return (k / b.C) | 0; }
  function colOf(b, k) { return k % b.C; }
  function at(b, r, c) { return inB(b, r, c) ? b.cells[r][c] : null; }
  /* 用于匹配的颜色；空 / 太极返回 -1 */
  function typeAt(b, r, c) {
    const tl = at(b, r, c);
    return tl && tl.t >= 0 ? tl.t : -1;
  }
  function isLocked(b, r, c) {
    const ob = b.obst[r][c];
    return !!(ob && ob.k === O.VINE);
  }
  function hasTile(b, r, c) { return !!b.cells[r][c]; }

  /* ============ 生成 ============ */

  function safeType(b, r, c) {
    /* 避开会立刻形成三连的颜色（只看已填的左邻与上邻） */
    const bad = [];
    const t1 = typeAt(b, r, c - 1), t2 = typeAt(b, r, c - 2);
    if (t1 >= 0 && t1 === t2) bad.push(t1);
    const u1 = typeAt(b, r - 1, c), u2 = typeAt(b, r - 2, c);
    if (u1 >= 0 && u1 === u2) bad.push(u1);
    for (let i = 0; i < 40; i++) {
      const t = (b.rnd() * b.colors) | 0;
      if (bad.indexOf(t) < 0) return t;
    }
    return (b.rnd() * b.colors) | 0;
  }

  function fillAll(b) {
    for (let r = 0; r < b.R; r++) {
      for (let c = 0; c < b.C; c++) {
        if (!b.playable[r][c]) { b.cells[r][c] = null; continue; }
        b.cells[r][c] = tile(safeType(b, r, c), 0);
      }
    }
  }

  function parseLayout(b, layout) {
    for (let r = 0; r < Math.min(b.R, layout.length); r++) {
      const row = layout[r] || '';
      for (let c = 0; c < Math.min(b.C, row.length); c++) {
        const ch = row.charAt(c);
        if (ch === '*') b.obst[r][c] = { k: O.FROST, hp: CFG.OBST_INFO[O.FROST].hp };
        else if (ch === '#') b.obst[r][c] = { k: O.STONE, hp: CFG.OBST_INFO[O.STONE].hp };
        else if (ch === 'v') b.obst[r][c] = { k: O.VINE, hp: CFG.OBST_INFO[O.VINE].hp };
        else if (ch === 'x') b.playable[r][c] = false;
      }
    }
  }

  function create(opts) {
    opts = opts || {};
    const R = opts.rows || CFG.ROWS;
    const C = opts.cols || CFG.COLS;
    const b = {
      R: R, C: C,
      colors: opts.colors || 5,
      rnd: opts.rnd || Math.random,
      cells: [], obst: [], playable: []
    };
    for (let r = 0; r < R; r++) {
      b.cells.push(new Array(C).fill(null));
      b.obst.push(new Array(C).fill(null));
      b.playable.push(new Array(C).fill(true));
    }
    if (opts.layout) parseLayout(b, opts.layout);
    fillAll(b);
    /* 保证：无初始三连、至少有一手可走 */
    let guard = 0;
    while (guard++ < 80 && (findMatches(b).length > 0 || findAllMoves(b, 1).length === 0)) fillAll(b);
    return b;
  }

  /* ============ 交换 ============ */

  function canSwap(b, r1, c1, r2, c2) {
    if (!inB(b, r1, c1) || !inB(b, r2, c2)) return false;
    const d = Math.abs(r1 - r2) + Math.abs(c1 - c2);
    if (d !== 1) return false;
    if (!b.playable[r1][c1] || !b.playable[r2][c2]) return false;
    if (!hasTile(b, r1, c1) || !hasTile(b, r2, c2)) return false;
    if (isLocked(b, r1, c1) || isLocked(b, r2, c2)) return false;
    return true;
  }

  function swapTiles(b, a, c) {
    const t = b.cells[a.r][a.c];
    b.cells[a.r][a.c] = b.cells[c.r][c.c];
    b.cells[c.r][c.c] = t;
  }

  /* ============ 匹配检测 ============ */

  function runCellEach(run, fn) {
    if (run.dir === 'h') { for (let c = run.c0; c <= run.c1; c++) fn(run.r, c); }
    else { for (let r = run.r0; r <= run.r1; r++) fn(r, run.c); }
  }
  function cellInRun(run, r, c) {
    if (run.dir === 'h') return run.r === r && c >= run.c0 && c <= run.c1;
    return run.c === c && r >= run.r0 && r <= run.r1;
  }

  /* 找出全部 >=3 的连线，并按共享格聚成组（组内可能同时含横竖连线 → L/T 形） */
  function findMatches(b) {
    const runs = [];
    const R = b.R, C = b.C;
    for (let r = 0; r < R; r++) {
      let c = 0;
      while (c < C) {
        const t = typeAt(b, r, c);
        if (t < 0 || !b.playable[r][c]) { c++; continue; }
        let c2 = c + 1;
        while (c2 < C && typeAt(b, r, c2) === t) c2++;
        if (c2 - c >= 3) runs.push({ dir: 'h', r: r, c0: c, c1: c2 - 1, len: c2 - c });
        c = c2;
      }
    }
    for (let c = 0; c < C; c++) {
      let r = 0;
      while (r < R) {
        const t = typeAt(b, r, c);
        if (t < 0 || !b.playable[r][c]) { r++; continue; }
        let r2 = r + 1;
        while (r2 < R && typeAt(b, r2, c) === t) r2++;
        if (r2 - r >= 3) runs.push({ dir: 'v', c: c, r0: r, r1: r2 - 1, len: r2 - r });
        r = r2;
      }
    }

    /* 按共享格把连线并成组 */
    const cellRuns = new Map();
    runs.forEach(function (run, i) {
      runCellEach(run, function (r, c) {
        const k = key(b, r, c);
        if (!cellRuns.has(k)) cellRuns.set(k, []);
        cellRuns.get(k).push(i);
      });
    });
    const used = new Array(runs.length).fill(false);
    const groups = [];
    for (let i = 0; i < runs.length; i++) {
      if (used[i]) continue;
      const stack = [i];
      used[i] = true;
      const g = { runs: [], cells: new Set(), maxRun: 0, hasH: false, hasV: false, color: -1 };
      while (stack.length) {
        const j = stack.pop();
        const run = runs[j];
        g.runs.push(run);
        if (run.len > g.maxRun) g.maxRun = run.len;
        if (run.dir === 'h') g.hasH = true; else g.hasV = true;
        runCellEach(run, function (r, c) {
          const k = key(b, r, c);
          g.cells.add(k);
          if (g.color < 0) { const tl = b.cells[r][c]; if (tl && tl.t >= 0) g.color = tl.t; }
          const list = cellRuns.get(k);
          for (let n = 0; n < list.length; n++) {
            if (!used[list[n]]) { used[list[n]] = true; stack.push(list[n]); }
          }
        });
      }
      groups.push(g);
    }
    return groups;
  }

  /* 局部匹配检测：只检查给定格所在横竖连线是否 >=3（用于交换合法性判定） */
  function matchThrough(b, cells) {
    for (let i = 0; i < cells.length; i++) {
      const r = cells[i].r, c = cells[i].c;
      const t = typeAt(b, r, c);
      if (t < 0) continue;
      let n = 1;
      for (let cc = c - 1; cc >= 0 && typeAt(b, r, cc) === t; cc--) n++;
      for (let cc = c + 1; cc < b.C && typeAt(b, r, cc) === t; cc++) n++;
      if (n >= 3) return true;
      n = 1;
      for (let rr = r - 1; rr >= 0 && typeAt(b, rr, c) === t; rr--) n++;
      for (let rr = r + 1; rr < b.R && typeAt(b, rr, c) === t; rr++) n++;
      if (n >= 3) return true;
    }
    return false;
  }

  /* ============ 可行走法 ============ */

  /* 枚举全部合法交换；limit > 0 时提前返回。
   * kind: 'match' 交换后成三连 / 'special' 双特殊块组合 / 'taiji' 太极与任意块 */
  function findAllMoves(b, limit) {
    const out = [];
    for (let r = 0; r < b.R; r++) {
      for (let c = 0; c < b.C; c++) {
        if (!b.playable[r][c] || !hasTile(b, r, c)) continue;
        for (let d = 0; d < 2; d++) {
          const r2 = r + (d === 1 ? 1 : 0), c2 = c + (d === 0 ? 1 : 0);
          if (!inB(b, r2, c2)) continue;
          if (!canSwap(b, r, c, r2, c2)) continue;
          const t1 = b.cells[r][c], t2 = b.cells[r2][c2];
          if (t1.s !== 0 && t2.s !== 0) {
            out.push({ a: { r: r, c: c }, b: { r: r2, c: c2 }, kind: 'special' });
          } else if (t1.s === S.TAIJI || t2.s === S.TAIJI) {
            out.push({ a: { r: r, c: c }, b: { r: r2, c: c2 }, kind: 'taiji' });
          } else {
            const A = { r: r, c: c }, Bp = { r: r2, c: c2 };
            swapTiles(b, A, Bp);
            const ok = matchThrough(b, [A, Bp]);
            swapTiles(b, A, Bp);
            if (ok) out.push({ a: A, b: Bp, kind: 'match' });
          }
          if (limit > 0 && out.length >= limit) return out;
        }
      }
    }
    return out;
  }

  function hasValidMove(b) { return findAllMoves(b, 1).length > 0; }

  /* ============ 消除应用 ============ */

  /* keys: Set/数组（格子 key）；spawns: [{r,c,t,s}]
   * 返回 { cells:[{r,c,t,s}], obstacles:[{r,c,k,hp,broken}], spawned:[{r,c,t,s}] } */
  function applyClear(b, keys, spawns) {
    const out = { cells: [], obstacles: [], spawned: [] };
    const list = (keys instanceof Set) ? Array.from(keys) : keys;
    for (let i = 0; i < list.length; i++) {
      const k = list[i];
      const r = rowOf(b, k), c = colOf(b, k);
      const tl = b.cells[r][c];
      if (tl) { out.cells.push({ r: r, c: c, t: tl.t, s: tl.s }); b.cells[r][c] = null; }
      const ob = b.obst[r][c];
      if (ob) {
        ob.hp--;
        if (ob.hp <= 0) {
          out.obstacles.push({ r: r, c: c, k: ob.k, hp: 0, broken: true });
          b.obst[r][c] = null;
        } else {
          out.obstacles.push({ r: r, c: c, k: ob.k, hp: ob.hp, broken: false });
        }
      }
    }
    if (spawns) {
      for (let i = 0; i < spawns.length; i++) {
        const sp = spawns[i];
        b.cells[sp.r][sp.c] = tile(sp.t, sp.s);
        out.spawned.push({ r: sp.r, c: sp.c, t: sp.t, s: sp.s });
      }
    }
    return out;
  }

  /* ============ 重力与补充 ============ */

  function randFillType(b) { return (b.rnd() * b.colors) | 0; }

  function compactSegment(b, c, top, bottom, moves, spawns) {
    if (top > bottom) return;
    let write = bottom;
    for (let r = bottom; r >= top; r--) {
      const tl = b.cells[r][c];
      if (tl) {
        if (write !== r) {
          b.cells[write][c] = tl;
          b.cells[r][c] = null;
          moves.push({ col: c, fromR: r, toR: write, t: tl.t, s: tl.s });
        }
        write--;
      }
    }
    /* 顶部空位补新块，从分段上方落入 */
    const n = write - top + 1;
    for (let r = write, i = 0; r >= top; r--, i++) {
      const tl = tile(randFillType(b), 0);
      b.cells[r][c] = tl;
      spawns.push({ col: c, fromR: top - 1 - i, toR: r, t: tl.t, s: 0 });
    }
  }

  /* 逐列下落：藤蔓格（以及不可玩格）是屏障，把列切成若干段分别压实 */
  function applyGravity(b) {
    const moves = [], spawns = [];
    for (let c = 0; c < b.C; c++) {
      let segEnd = b.R - 1;
      for (let r = b.R - 1; r >= -1; r--) {
        const barrier = (r >= 0) && (isLocked(b, r, c) || !b.playable[r][c]);
        if (r < 0 || barrier) {
          compactSegment(b, c, r + 1, segEnd, moves, spawns);
          segEnd = r - 1;
        }
      }
    }
    return { moves: moves, spawns: spawns };
  }

  /* ============ 洗牌（死局处理） ============ */

  /* 返回 { moves:[{fromR,fromC,toR,toC,t,s}], regen:bool } */
  function shuffleBoard(b) {
    const freeKeys = [];
    for (let r = 0; r < b.R; r++) {
      for (let c = 0; c < b.C; c++) {
        if (b.playable[r][c] && !isLocked(b, r, c)) freeKeys.push(key(b, r, c));
      }
    }
    const tiles = freeKeys.map(function (k) { return b.cells[rowOf(b, k)][colOf(b, k)]; });
    const before = tiles.slice();
    for (let attempt = 0; attempt < 400; attempt++) {
      LL.U.shuffleArr(tiles, b.rnd);
      for (let i = 0; i < freeKeys.length; i++) {
        b.cells[rowOf(b, freeKeys[i])][colOf(b, freeKeys[i])] = tiles[i];
      }
      if (findMatches(b).length === 0 && hasValidMove(b)) {
        return { moves: buildShuffleMoves(b, freeKeys, before, tiles), regen: false };
      }
    }
    /* 兜底：整片重铺（保留障碍与藤蔓块） */
    const lockedTiles = {};
    for (let r = 0; r < b.R; r++) {
      for (let c = 0; c < b.C; c++) {
        if (isLocked(b, r, c) && b.cells[r][c]) lockedTiles[key(b, r, c)] = b.cells[r][c];
      }
    }
    let guard = 0;
    do {
      fillAll(b);
      for (const k in lockedTiles) {
        b.cells[rowOf(b, +k)][colOf(b, +k)] = lockedTiles[k];
      }
      guard++;
    } while (guard < 80 && findMatches(b).length > 0);
    const moves = [];
    for (let i = 0; i < freeKeys.length; i++) {
      const r = rowOf(b, freeKeys[i]), c = colOf(b, freeKeys[i]);
      moves.push({ fromR: r, fromC: c, toR: r, toC: c, t: b.cells[r][c].t, s: b.cells[r][c].s, faded: true });
    }
    return { moves: moves, regen: true };
  }

  /* 依据「洗牌前后同一块对象」建立位移表 */
  function buildShuffleMoves(b, freeKeys, before, after) {
    const posBefore = new Map();
    for (let i = 0; i < freeKeys.length; i++) posBefore.set(before[i], { r: rowOf(b, freeKeys[i]), c: colOf(b, freeKeys[i]) });
    const moves = [];
    for (let i = 0; i < freeKeys.length; i++) {
      const from = posBefore.get(after[i]);
      const to = { r: rowOf(b, freeKeys[i]), c: colOf(b, freeKeys[i]) };
      if (from && (from.r !== to.r || from.c !== to.c)) {
        moves.push({ fromR: from.r, fromC: from.c, toR: to.r, toC: to.c, t: after[i].t, s: after[i].s });
      }
    }
    return moves;
  }
  /* ============ 调试输出 ============ */

  function toAscii(b) {
    let s = '';
    for (let r = 0; r < b.R; r++) {
      for (let c = 0; c < b.C; c++) {
        const tl = b.cells[r][c];
        if (!tl) s += '.';
        else if (tl.s === S.TAIJI) s += 'Y';
        else if (tl.s === S.THUNDER) s += 'R';
        else if (tl.s === S.WIND_H || tl.s === S.WIND_V) s += 'W';
        else s += String(tl.t);
      }
      s += '\n';
    }
    return s;
  }

  LL.Board = {
    tile: tile, inB: inB, key: key, rowOf: rowOf, colOf: colOf,
    at: at, typeAt: typeAt, hasTile: hasTile, isLocked: isLocked,
    create: create, fillAll: fillAll, safeType: safeType,
    canSwap: canSwap, swapTiles: swapTiles,
    findMatches: findMatches, matchThrough: matchThrough,
    findAllMoves: findAllMoves, hasValidMove: hasValidMove,
    applyClear: applyClear, applyGravity: applyGravity, shuffleBoard: shuffleBoard,
    toAscii: toAscii
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
