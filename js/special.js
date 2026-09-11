/* 玲珑消 · special.js — 特殊块规则：生成判定、爆破范围、连锁引爆、组合效果
 * 依赖 board.js 的访问函数；本文件只做「计划」（算出要消除哪些格），
 * 真正的状态修改统一由 Board.applyClear 完成。
 */
(function (global) {
  'use strict';
  const LL = (global.LL = global.LL || {});
  const CFG = LL.CFG;
  const B = LL.Board;
  const S = CFG.SPECIAL;

  /* 组 → 生成哪种特殊块 */
  function decideSpecialFor(group) {
    if (group.maxRun >= 5) return S.TAIJI;
    if (group.hasH && group.hasV) return S.THUNDER;
    if (group.maxRun === 4) {
      let dir = 'h';
      for (let i = 0; i < group.runs.length; i++) {
        if (group.runs[i].len >= 4) dir = group.runs[i].dir;
      }
      return dir === 'h' ? S.WIND_H : S.WIND_V;
    }
    return S.NONE;
  }

  /* 特殊块落点：优先玩家 swap 的目标格，其次 L/T 交点，再次最长连线中点 */
  function pickSpawnCell(b, group, preferred) {
    const has = function (r, c) { return group.cells.has(B.key(b, r, c)); };
    const free = function (r, c) { const tl = b.cells[r][c]; return !!(tl && tl.s === 0 && tl.t >= 0); };

    if (preferred) {
      for (let i = 0; i < preferred.length; i++) {
        const p = preferred[i];
        if (has(p.r, p.c) && free(p.r, p.c)) return p;
      }
    }
    if (group.hasH && group.hasV) {
      const keys = Array.from(group.cells);
      for (let i = 0; i < keys.length; i++) {
        const r = B.rowOf(b, keys[i]), c = B.colOf(b, keys[i]);
        let inH = false, inV = false;
        for (let j = 0; j < group.runs.length; j++) {
          const run = group.runs[j];
          const hit = run.dir === 'h'
            ? (run.r === r && c >= run.c0 && c <= run.c1)
            : (run.c === c && r >= run.r0 && r <= run.r1);
          if (hit) { if (run.dir === 'h') inH = true; else inV = true; }
        }
        if (inH && inV && free(r, c)) return { r: r, c: c };
      }
    }
    for (let j = 0; j < group.runs.length; j++) {
      const run = group.runs[j];
      if (run.len !== group.maxRun) continue;
      const mid = run.dir === 'h'
        ? { r: run.r, c: ((run.c0 + run.c1) / 2) | 0 }
        : { r: ((run.r0 + run.r1) / 2) | 0, c: run.c };
      if (free(mid.r, mid.c)) return mid;
    }
    const keys = Array.from(group.cells);
    for (let i = 0; i < keys.length; i++) {
      const r = B.rowOf(b, keys[i]), c = B.colOf(b, keys[i]);
      if (free(r, c)) return { r: r, c: c };
    }
    return null;
  }

  /* 单块爆破范围（返回 [r,c] 列表） */
  function blastCells(b, r, c, s) {
    const out = [];
    if (s === S.WIND_H) {
      for (let cc = 0; cc < b.C; cc++) if (b.playable[r][cc] && b.cells[r][cc]) out.push([r, cc]);
    } else if (s === S.WIND_V) {
      for (let rr = 0; rr < b.R; rr++) if (b.playable[rr][c] && b.cells[rr][c]) out.push([rr, c]);
    } else if (s === S.THUNDER) {
      for (let rr = r - 1; rr <= r + 1; rr++) {
        for (let cc = c - 1; cc <= c + 1; cc++) {
          if (B.inB(b, rr, cc) && b.playable[rr][cc] && b.cells[rr][cc]) out.push([rr, cc]);
        }
      }
    } else if (s === S.TAIJI) {
      const t = dominantColor(b);
      if (t >= 0) {
        for (let rr = 0; rr < b.R; rr++) {
          for (let cc = 0; cc < b.C; cc++) {
            const tl = b.cells[rr][cc];
            if (tl && tl.t === t) out.push([rr, cc]);
          }
        }
      }
    }
    return out;
  }

  /* 场上数量最多的颜色（太极被波及时的清场色） */
  function dominantColor(b) {
    const cnt = new Array(b.colors).fill(0);
    for (let r = 0; r < b.R; r++) {
      for (let c = 0; c < b.C; c++) {
        const tl = b.cells[r][c];
        if (tl && tl.t >= 0) cnt[tl.t]++;
      }
    }
    let best = -1, n = 0;
    for (let t = 0; t < cnt.length; t++) if (cnt[t] > n) { n = cnt[t]; best = t; }
    return best;
  }

  /* 连锁引爆：从 baseKeys 出发，凡落在集合里的特殊块都会炸开并继续扩散
   * skip：这些格的块本回合不引爆（新生成的特殊块，或组合里已单独处理的两块） */
  function expandClear(b, baseKeys, skip) {
    const set = new Set();
    const queue = [];
    const fires = [];
    const push = function (k) { if (!set.has(k)) { set.add(k); queue.push(k); } };
    baseKeys.forEach(push);
    for (let i = 0; i < queue.length; i++) {
      const k = queue[i];
      if (skip && skip.has(k)) continue;
      const r = B.rowOf(b, k), c = B.colOf(b, k);
      const tl = b.cells[r][c];
      if (tl && tl.s !== S.NONE) {
        fires.push({ r: r, c: c, s: tl.s, t: tl.t });
        const blast = blastCells(b, r, c, tl.s);
        for (let j = 0; j < blast.length; j++) push(B.key(b, blast[j][0], blast[j][1]));
      }
    }
    return { set: set, fires: fires };
  }

  /* 普通匹配 → 消除计划 */
  function planMatches(b, groups, preferred) {
    const spawns = [];
    const spawnKeys = new Set();
    const base = new Set();
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      const sp = decideSpecialFor(g);
      let cell = null;
      if (sp !== S.NONE) cell = pickSpawnCell(b, g, preferred);
      if (cell) {
        spawns.push({ r: cell.r, c: cell.c, t: sp === S.TAIJI ? -1 : g.color, s: sp });
        spawnKeys.add(B.key(b, cell.r, cell.c));
      }
      g.cells.forEach(function (k) { if (!spawnKeys.has(k)) base.add(k); });
    }
    const exp = expandClear(b, base, spawnKeys);
    return { keys: exp.set, spawns: spawns, fires: exp.fires };
  }

  /* ---------- 组合（两颗特殊块 / 太极与任意块，交换即触发） ---------- */

  /* 交换已经应用后调用；a、b2 为交换的两格，b2 是被拖动块的落点（组合中心） */
  function planCombo(b, a, b2) {
    const t1 = b.cells[a.r][a.c], t2 = b.cells[b2.r][b2.c];
    if (!t1 || !t2) return null;
    const s1 = t1.s, s2 = t2.s;
    if (s1 === S.TAIJI && s2 === S.TAIJI) return { kind: 'taiji_taiji', a: a, b: b2 };
    if (s1 === S.TAIJI || s2 === S.TAIJI) {
      const other = s1 === S.TAIJI ? t2 : t1;
      const otherS = s1 === S.TAIJI ? s2 : s1;
      if (otherS === S.WIND_H || otherS === S.WIND_V) return { kind: 'taiji_wind', a: a, b: b2, color: other.t };
      if (otherS === S.THUNDER) return { kind: 'taiji_thunder', a: a, b: b2, color: other.t };
      return { kind: 'taiji_color', a: a, b: b2, color: other.t };
    }
    if (s1 !== S.NONE && s2 !== S.NONE) {
      const wind = function (s) { return s === S.WIND_H || s === S.WIND_V; };
      if (wind(s1) && wind(s2)) return { kind: 'wind_wind', a: a, b: b2 };
      if (wind(s1) && s2 === S.THUNDER || wind(s2) && s1 === S.THUNDER) return { kind: 'wind_thunder', a: a, b: b2 };
      if (s1 === S.THUNDER && s2 === S.THUNDER) return { kind: 'thunder_thunder', a: a, b: b2 };
    }
    return null;
  }

  /* 组合 → 消除计划（含随后被波及的特殊块连锁） */
  function buildComboClear(b, combo) {
    const base = new Set();
    const skip = new Set();
    const fires = [];
    const addKey = function (r, c) {
      if (B.inB(b, r, c) && b.playable[r][c] && b.cells[r][c]) base.add(B.key(b, r, c));
    };
    const addRow = function (r) { for (let c = 0; c < b.C; c++) addKey(r, c); };
    const addCol = function (c) { for (let r = 0; r < b.R; r++) addKey(r, c); };
    const addBox = function (r, c, rad) {
      for (let rr = r - rad; rr <= r + rad; rr++) for (let cc = c - rad; cc <= c + rad; cc++) addKey(rr, cc);
    };
    const eachColorCell = function (color, fn) {
      for (let r = 0; r < b.R; r++) for (let c = 0; c < b.C; c++) {
        const tl = b.cells[r][c];
        if (tl && tl.t === color) fn(r, c);
      }
    };
    const ka = B.key(b, combo.a.r, combo.a.c);
    const kb = B.key(b, combo.b.r, combo.b.c);
    skip.add(ka); skip.add(kb);

    const tA = b.cells[combo.a.r][combo.a.c], tB = b.cells[combo.b.r][combo.b.c];
    const reportFire = function (cell, tl) { if (tl && tl.s !== S.NONE) fires.push({ r: cell.r, c: cell.c, s: tl.s, t: tl.t }); };
    reportFire(combo.a, tA);
    reportFire(combo.b, tB);

    switch (combo.kind) {
      case 'taiji_taiji':
        for (let r = 0; r < b.R; r++) for (let c = 0; c < b.C; c++) addKey(r, c);
        break;
      case 'taiji_color':
        addKey(combo.a.r, combo.a.c); addKey(combo.b.r, combo.b.c);
        eachColorCell(combo.color, function (r, c) { addKey(r, c); });
        break;
      case 'taiji_wind':
        addKey(combo.a.r, combo.a.c); addKey(combo.b.r, combo.b.c);
        eachColorCell(combo.color, function (r, c) {
          addKey(r, c); addRow(r); addCol(c);
          fires.push({ r: r, c: c, s: S.WIND_H, t: combo.color, virtual: true });
        });
        break;
      case 'taiji_thunder':
        addKey(combo.a.r, combo.a.c); addKey(combo.b.r, combo.b.c);
        eachColorCell(combo.color, function (r, c) {
          addKey(r, c); addBox(r, c, 1);
          fires.push({ r: r, c: c, s: S.THUNDER, t: combo.color, virtual: true });
        });
        break;
      case 'wind_wind':
        addRow(combo.b.r); addCol(combo.b.c);
        break;
      case 'wind_thunder':
        addRow(combo.b.r - 1); addRow(combo.b.r); addRow(combo.b.r + 1);
        addCol(combo.b.c - 1); addCol(combo.b.c); addCol(combo.b.c + 1);
        break;
      case 'thunder_thunder':
        addBox(combo.b.r, combo.b.c, 2);
        break;
      default: break;
    }

    const exp = expandClear(b, base, skip);
    /* 组合自身的两块（以及太极转化的虚拟爆破点）也算引爆，供表现层使用 */
    const allFires = fires.concat(exp.fires);
    return { keys: exp.set, fires: allFires, spawns: null };
  }

  LL.Special = {
    decideSpecialFor: decideSpecialFor,
    pickSpawnCell: pickSpawnCell,
    blastCells: blastCells,
    dominantColor: dominantColor,
    expandClear: expandClear,
    planMatches: planMatches,
    planCombo: planCombo,
    buildComboClear: buildComboClear
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
