/* 玲珑消 · tools/selftest.cjs — 逻辑内核自检
 *
 * 用法：
 *   node tools/selftest.cjs              默认 20000 次随机回合
 *   node tools/selftest.cjs --turns=100000
 *
 * 覆盖：
 *   1. 棋盘生成不变量（无初始三连、必有可行走法）
 *   2. 随机回合模拟不变量（棋盘填满、回合结束后无残留三连、特殊块/障碍数据合法）
 *   3. 特殊块生成规则（4 连 / L/T / 5 连）
 *   4. 组合效果范围（风+风 / 雷+雷 / 太极与任意 / 太极+太极 / 风+雷）
 *   5. 障碍规则（霜 / 石锁分层、藤蔓锁定与重力分段）
 *   6. 死局洗牌必定产出可玩棋盘
 */
'use strict';
const path = require('path');

/* 以 CommonJS 方式加载浏览器脚本（它们挂在 globalThis.LL 上） */
['util.js', 'config.js', 'board.js', 'special.js', 'resolver.js', 'levels.js',
  'i18n.js', 'progress.js', 'quests.js', 'daily.js', 'modes.js', 'achievements.js',
  'anim.js', 'assets.js', 'audio.js', 'render.js', 'hud.js', 'input.js', 'game.js', 'ui.js'].forEach(function (f) {
  require(path.join(__dirname, '..', 'js', f));
});
/* 说明：上面这些文件在 Node 下只会定义对象，不会碰 DOM（DOM 访问都在函数体内），
 * 因此可以安全加载，用来做「引用的方法是否存在」这类静态检查。
 * main.js 会立即执行 boot()，故意不加载。 */
const LL = globalThis.LL;
const CFG = LL.CFG, U = LL.U, B = LL.Board, SP = LL.Special, R = LL.Resolver;
const S = CFG.SPECIAL, O = CFG.OBST;

/* ---------- 断言 ---------- */
let passed = 0, failed = 0;
const failures = [];
function ok(cond, msg) {
  if (cond) { passed++; return true; }
  failed++;
  if (failures.length < 30) failures.push(msg);
  return false;
}
function eq(a, b, msg) { return ok(a === b, msg + '（实际 ' + a + '，期望 ' + b + '）'); }
function section(name) { console.log('\n■ ' + name); }

/* ---------- 构造工具 ---------- */
/* 统计某格所在横/竖连线的同色长度 */
function runLen(b, r, c, horiz) {
  const t = B.typeAt(b, r, c);
  if (t < 0) return 0;
  let n = 1;
  if (horiz) {
    for (let cc = c - 1; cc >= 0 && B.typeAt(b, r, cc) === t; cc--) n++;
    for (let cc = c + 1; cc < b.C && B.typeAt(b, r, cc) === t; cc++) n++;
  } else {
    for (let rr = r - 1; rr >= 0 && B.typeAt(b, rr, c) === t; rr--) n++;
    for (let rr = r + 1; rr < b.R && B.typeAt(b, rr, c) === t; rr++) n++;
  }
  return n;
}

/* 用 (r + 2c) % colors 铺底，再覆盖指定格；
 * 之后修补非目标格，保证场上只剩测试刻意构造的连线。 */
function buildBoard(colors, overrides, layout) {
  const rnd = U.rng(12345);
  const b = B.create({ colors: colors, rnd: rnd, layout: layout });
  for (let r = 0; r < b.R; r++) {
    for (let c = 0; c < b.C; c++) {
      if (b.playable[r][c]) b.cells[r][c] = B.tile((r + 2 * c) % colors, 0);
    }
  }
  const protectedKeys = new Set();
  (overrides || []).forEach(function (o) {
    protectedKeys.add(o.r * b.C + o.c);
    if (o.tile === null) b.cells[o.r][o.c] = null;
    else b.cells[o.r][o.c] = B.tile(o.t, o.s != null ? o.s : 0);
    if (o.obst) b.obst[o.r][o.c] = { k: o.obst, hp: CFG.OBST_INFO[o.obst].hp };
  });
  /* 修补：非保护区里若出现 3 连（被覆盖格意外延长），换成不连的颜色 */
  for (let iter = 0; iter < 12; iter++) {
    let changed = false;
    for (let r = 0; r < b.R; r++) {
      for (let c = 0; c < b.C; c++) {
        if (protectedKeys.has(r * b.C + c) || !b.cells[r][c]) continue;
        if (runLen(b, r, c, true) < 3 && runLen(b, r, c, false) < 3) continue;
        const cur = b.cells[r][c].t;
        for (let nt = 0; nt < b.colors; nt++) {
          if (nt === cur) continue;
          b.cells[r][c] = B.tile(nt, b.cells[r][c].s);
          if (runLen(b, r, c, true) < 3 && runLen(b, r, c, false) < 3) { changed = true; break; }
        }
      }
    }
    if (!changed) break;
  }
  return b;
}
function keysOf(list) { return new Set(list.map(function (p) { return p[0] * 8 + p[1]; })); }
function hasKey(set, r, c) { return set.has(r * 8 + c); }

/* ---------- 1. 棋盘生成不变量 ---------- */
section('1. 棋盘生成不变量（无初始三连 + 必有可行走法）');
let genBad = 0;
for (let i = 0; i < 2000; i++) {
  const colors = 4 + (i % 3);
  const b = B.create({ colors: colors, rnd: U.rng(1000 + i) });
  if (B.findMatches(b).length !== 0) genBad++;
  if (B.findAllMoves(b, 1).length === 0) genBad++;
  for (let r = 0; r < b.R; r++) for (let c = 0; c < b.C; c++) {
    if (!b.cells[r][c]) genBad++;   /* 生成后不允许空格 */
  }
}
eq(genBad, 0, '2000 个随机棋盘全部满足生成不变量');

/* ---------- 2. 随机回合模拟 ---------- */
section('2. 随机回合模拟不变量');
const argTurns = (function () {
  const m = process.argv.find(function (a) { return a.indexOf('--turns=') === 0; });
  return m ? parseInt(m.split('=')[1], 10) : 20000;
})();

const stats = { turns: 0, clears: 0, tilesCleared: 0, specialsMade: 0, specialsFired: 0, obstBroken: 0, shuffles: 0, maxCascade: 0, combos: 0 };
const LAYOUTS = [
  null,
  null,
  ['........', '........', '...**...', '........', '........', '...**...', '........', '........'],
  ['........', '..####..', '........', '........', '........', '..v..v..', '........', '........'],
  ['..*..*..', '........', '..v..v..', '........', '........', '.#....#.', '........', '........']
];
let simErrors = [];
for (let seed = 0; seed < 20; seed++) {
  const colors = 4 + (seed % 3);
  const rnd = U.rng(90000 + seed * 7);
  const layout = LAYOUTS[seed % LAYOUTS.length];
  const b = B.create({ colors: colors, rnd: rnd, layout: layout });
  const rs = R.create(b);
  const target = Math.floor(argTurns / 20);
  for (let n = 0; n < target; n++) {
    let moves = B.findAllMoves(b, 0);
    if (moves.length === 0) {
      R.shuffle(rs);
      stats.shuffles++;
      moves = B.findAllMoves(b, 0);
      if (moves.length === 0) simErrors.push('洗牌后依然无可行走法 seed=' + seed);
    }
    const mv = moves[(rnd() * moves.length) | 0];
    const res = R.runTurn(rs, mv.a, mv.b);
    if (!res.ok) { simErrors.push('随机走法被拒绝 seed=' + seed + ' n=' + n + ' ' + res.reason); continue; }
    stats.turns++;
    for (let i = 0; i < res.events.length; i++) {
      const ev = res.events[i];
      if (ev.kind === 'clear') {
        stats.clears++;
        stats.tilesCleared += ev.cells.length;
        stats.specialsMade += ev.spawned.length;
        stats.specialsFired += ev.fires.length;
        for (let j = 0; j < ev.obstacles.length; j++) if (ev.obstacles[j].broken) stats.obstBroken++;
        if (ev.cause === 'combo') stats.combos++;
        if (ev.cascade > stats.maxCascade) stats.maxCascade = ev.cascade;
      }
      if (ev.kind === 'turnEnd' && ev.maxCascade > stats.maxCascade) stats.maxCascade = ev.maxCascade;
    }
    /* 回合结束后的不变量 */
    for (let r = 0; r < b.R; r++) {
      for (let c = 0; c < b.C; c++) {
        if (b.playable[r][c] && !b.cells[r][c]) { simErrors.push('回合结束后出现空格 (' + r + ',' + c + ') seed=' + seed); }
        const tl = b.cells[r][c];
        if (tl) {
          if (tl.t < 0 && tl.s !== S.TAIJI) simErrors.push('非法无色块 s=' + tl.s);
          if (tl.s === S.TAIJI && tl.t !== -1) simErrors.push('太极必须无色');
          if (tl.t >= b.colors) simErrors.push('颜色下标越界 ' + tl.t);
        }
        const ob = b.obst[r][c];
        if (ob) {
          const maxHp = CFG.OBST_INFO[ob.k].hp;
          if (ob.hp <= 0 || ob.hp > maxHp) simErrors.push('障碍血量非法 k=' + ob.k + ' hp=' + ob.hp);
        }
      }
    }
    if (B.findMatches(b).length !== 0) simErrors.push('回合结束后残留三连 seed=' + seed + ' n=' + n);
  }
}
eq(simErrors.length, 0, '随机回合模拟无错误' + (simErrors.length ? '：' + simErrors.slice(0, 5).join(' | ') : ''));
ok(stats.turns >= argTurns * 0.95, '完成回合数 ' + stats.turns);
ok(stats.specialsMade > 0, '随机模拟生成过特殊块（' + stats.specialsMade + ' 个）');
ok(stats.specialsFired > 0, '随机模拟引爆过特殊块（' + stats.specialsFired + ' 次）');
ok(stats.obstBroken > 0, '随机模拟破除过障碍（' + stats.obstBroken + ' 个）');
console.log('  回合 ' + stats.turns + ' · 消除波次 ' + stats.clears + ' · 消块 ' + stats.tilesCleared +
  ' · 特殊块生成 ' + stats.specialsMade + ' · 引爆 ' + stats.specialsFired + ' · 破障 ' + stats.obstBroken +
  ' · 洗牌 ' + stats.shuffles + ' · 最大连锁 ' + stats.maxCascade);

/* ---------- 3. 特殊块生成规则 ---------- */
section('3. 特殊块生成规则');
{
  /* 横向 4 连 → 横风符 */
  const b = buildBoard(5, [
    { r: 3, c: 1, t: 0 }, { r: 3, c: 2, t: 0 }, { r: 3, c: 3, t: 0 }, { r: 3, c: 4, t: 0 }
  ]);
  const groups = B.findMatches(b);
  eq(groups.length, 1, '横向 4 连被识别为 1 组');
  eq(groups[0].maxRun, 4, '最长连线为 4');
  const plan = SP.planMatches(b, groups, null);
  eq(plan.spawns.length, 1, '生成 1 个特殊块');
  eq(plan.spawns[0].s, S.WIND_H, '横向 4 连生成横风符');
  ok(!plan.keys.has(plan.spawns[0].r * 8 + plan.spawns[0].c), '特殊块落点不在消除集合内');
  eq(plan.keys.size, 3, '其余 3 格被消除');
}
{
  /* 竖向 4 连 → 竖风符 */
  const b = buildBoard(5, [
    { r: 1, c: 3, t: 1 }, { r: 2, c: 3, t: 1 }, { r: 3, c: 3, t: 1 }, { r: 4, c: 3, t: 1 }
  ]);
  const plan = SP.planMatches(b, B.findMatches(b), null);
  eq(plan.spawns[0].s, S.WIND_V, '竖向 4 连生成竖风符');
}
{
  /* L 形 → 惊雷（落在交点） */
  const b = buildBoard(5, [
    { r: 3, c: 1, t: 2 }, { r: 3, c: 2, t: 2 }, { r: 3, c: 3, t: 2 },
    { r: 4, c: 3, t: 2 }, { r: 5, c: 3, t: 2 }
  ]);
  const groups = B.findMatches(b);
  eq(groups.length, 1, 'L 形被聚为 1 组');
  ok(groups[0].hasH && groups[0].hasV, 'L 形同时含横竖连线');
  const plan = SP.planMatches(b, groups, null);
  eq(plan.spawns[0].s, S.THUNDER, 'L 形生成惊雷');
  eq(plan.spawns[0].r + ',' + plan.spawns[0].c, '3,3', '惊雷落在交点');
}
{
  /* 直线 5 连 → 太极（无色） */
  const b = buildBoard(5, [
    { r: 3, c: 1, t: 3 }, { r: 3, c: 2, t: 3 }, { r: 3, c: 3, t: 3 }, { r: 3, c: 4, t: 3 }, { r: 3, c: 5, t: 3 }
  ]);
  const plan = SP.planMatches(b, B.findMatches(b), null);
  eq(plan.spawns[0].s, S.TAIJI, '5 连生成太极');
  eq(plan.spawns[0].t, -1, '太极无色');
}
{
  /* 特殊块被卷入匹配 → 连锁引爆整行 */
  const b = buildBoard(5, [
    { r: 3, c: 1, t: 4, s: S.WIND_H }, { r: 3, c: 2, t: 4 }, { r: 3, c: 3, t: 4 }
  ]);
  const plan = SP.planMatches(b, B.findMatches(b), null);
  ok(plan.fires.length >= 1, '卷进匹配的风符被引爆');
  for (let c = 0; c < 8; c++) ok(plan.keys.has(3 * 8 + c), '引爆后整行 ' + c + ' 被清除');
}
{
  /* 太极不参与颜色匹配 */
  const b = buildBoard(5, [
    { r: 3, c: 3, t: -1, s: S.TAIJI }, { r: 3, c: 4, t: -1, s: S.TAIJI }, { r: 3, c: 5, t: -1, s: S.TAIJI }
  ]);
  eq(B.findMatches(b).length, 0, '太极不参与匹配');
}

/* ---------- 4. 组合效果 ---------- */
section('4. 组合效果范围');
{
  /* 风 + 风 = 十字 */
  const b = buildBoard(5, [
    { r: 3, c: 3, t: 0, s: S.WIND_H }, { r: 3, c: 4, t: 1, s: S.WIND_V }
  ]);
  const rs = R.create(b);
  const res = R.runTurn(rs, { r: 3, c: 3 }, { r: 3, c: 4 });
  ok(res.ok, '风+风 交换被接受');
  const clearEv = res.events.find(function (e) { return e.kind === 'clear'; });
  ok(!!clearEv && clearEv.cause === 'combo', '触发组合爆破');
  const keys = clearEv.cells.map(function (x) { return x.r * 8 + x.c; });
  let allRow = true, allCol = true;
  for (let c = 0; c < 8; c++) if (keys.indexOf(3 * 8 + c) < 0) allRow = false;
  for (let r = 0; r < 8; r++) if (keys.indexOf(r * 8 + 4) < 0) allCol = false;
  ok(allRow && allCol, '十字清除第 3 行与第 4 列');
}
{
  /* 雷 + 雷 = 5×5 */
  const b = buildBoard(5, [
    { r: 3, c: 3, t: 0, s: S.THUNDER }, { r: 3, c: 4, t: 1, s: S.THUNDER }
  ]);
  const rs = R.create(b);
  const res = R.runTurn(rs, { r: 3, c: 3 }, { r: 3, c: 4 });
  const clearEv = res.events.find(function (e) { return e.kind === 'clear'; });
  const keys = new Set(clearEv.cells.map(function (x) { return x.r * 8 + x.c; }));
  let inside = 0;
  for (let r = 1; r <= 5; r++) for (let c = 2; c <= 6; c++) if (keys.has(r * 8 + c)) inside++;
  eq(inside, 25, '雷+雷 清除 5×5 共 25 格');
}
{
  /* 风 + 雷 = 三行三列 */
  const b = buildBoard(6, [
    { r: 4, c: 3, t: 0, s: S.WIND_H }, { r: 4, c: 4, t: 1, s: S.THUNDER }
  ]);
  const rs = R.create(b);
  const res = R.runTurn(rs, { r: 4, c: 3 }, { r: 4, c: 4 });
  const clearEv = res.events.find(function (e) { return e.kind === 'clear'; });
  const keys = new Set(clearEv.cells.map(function (x) { return x.r * 8 + x.c; }));
  let rows = 0, cols = 0;
  for (let r = 0; r < 8; r++) { let full = true; for (let c = 0; c < 8; c++) if (!keys.has(r * 8 + c)) { full = false; break; } if (full) rows++; }
  for (let c = 0; c < 8; c++) { let full = true; for (let r = 0; r < 8; r++) if (!keys.has(r * 8 + c)) { full = false; break; } if (full) cols++; }
  eq(rows, 3, '风+雷 清除 3 行');
  eq(cols, 3, '风+雷 清除 3 列');
}
{
  /* 太极 + 普通块 = 同色全消 */
  const b = buildBoard(5, [
    { r: 3, c: 3, t: -1, s: S.TAIJI },
    { r: 3, c: 4, t: 2 },
    { r: 0, c: 0, t: 2 }, { r: 6, c: 6, t: 2 }, { r: 1, c: 5, t: 2 }
  ]);
  /* 交换会先把 (3,4) 的同色块换到 (3,3)：清除目标 = 交换后的全部同色格 */
  const wantSet = new Set();
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const tl = b.cells[r][c];
    if (tl && tl.t === 2) wantSet.add(r * 8 + c);
  }
  wantSet.delete(3 * 8 + 4);
  wantSet.add(3 * 8 + 3);
  const rs = R.create(b);
  const res = R.runTurn(rs, { r: 3, c: 3 }, { r: 3, c: 4 });
  const clearEv = res.events.find(function (e) { return e.kind === 'clear'; });
  const keys = new Set(clearEv.cells.map(function (x) { return x.r * 8 + x.c; }));
  let missing = 0;
  wantSet.forEach(function (k) { if (!keys.has(k)) missing++; });
  eq(missing, 0, '太极清除全部同色块（' + wantSet.size + ' 格）');
  ok(keys.has(3 * 8 + 4), '太极自身也被消耗');
}
{
  /* 太极 + 太极 = 全屏清除 */
  const b = buildBoard(5, [
    { r: 3, c: 3, t: -1, s: S.TAIJI }, { r: 3, c: 4, t: -1, s: S.TAIJI }
  ]);
  const rs = R.create(b);
  const res = R.runTurn(rs, { r: 3, c: 3 }, { r: 3, c: 4 });
  const clearEv = res.events.find(function (e) { return e.kind === 'clear'; });
  eq(clearEv.cells.length, 64, '太极+太极 清除全屏 64 格');
}
{
  /* 不成立的三消交换必须被拒绝且棋盘不变 */
  const b = buildBoard(5, []);
  const before = B.toAscii(b);
  const rs = R.create(b);
  /* 找一对交换后不成三连的相邻格 */
  let found = null;
  for (let r = 0; r < 8 && !found; r++) for (let c = 0; c < 7 && !found; c++) {
    const r2 = R.create(b);
    const t = R.beginTurn(r2, { r: r, c: c }, { r: r, c: c + 1 });
    if (!t.ok) found = { r: r, c: c };
  }
  ok(!!found, '存在被拒绝的三消交换');
  if (found) {
    const rs2 = R.create(b);
    const out = R.beginTurn(rs2, { r: found.r, c: found.c }, { r: found.r, c: found.c + 1 });
    ok(!out.ok, '无效交换被拒绝');
    eq(B.toAscii(b), before, '无效交换后棋盘保持不变');
  }
}

/* ---------- 5. 障碍规则 ---------- */
section('5. 障碍规则');
{
  /* 霜：1 层，消除其上的块即破除 */
  const b = buildBoard(5, [{ r: 3, c: 3, t: 0, obst: O.FROST }]);
  const res = B.applyClear(b, new Set([3 * 8 + 3]), null);
  eq(res.obstacles.length, 1, '霜被记录');
  ok(res.obstacles[0].broken, '霜一次清除即破除');
  ok(!b.obst[3][3], '霜已从棋盘移除');
}
{
  /* 石锁：2 层 */
  const b = buildBoard(5, [{ r: 3, c: 3, t: 0, obst: O.STONE }]);
  B.applyClear(b, new Set([3 * 8 + 3]), null);
  ok(b.obst[3][3] && b.obst[3][3].hp === 1, '石锁第一次被击中剩 1 层');
  b.cells[3][3] = B.tile(0, 0);
  const res2 = B.applyClear(b, new Set([3 * 8 + 3]), null);
  ok(res2.obstacles[0].broken, '石锁第二次被击中破除');
}
{
  /* 藤蔓：不可交换、不参与重排移动、重力在其处分段 */
  const b = buildBoard(5, [{ r: 4, c: 3, t: 0, obst: O.VINE }]);
  eq(B.canSwap(b, 4, 3, 4, 4), false, '藤蔓锁住的块不可交换');
  eq(B.canSwap(b, 4, 3, 3, 3), false, '藤蔓锁住的块不可交换（纵向）');
  const lockedTile = b.cells[4][3];
  /* 清掉藤蔓下方的三格，触发重力 */
  for (let r = 5; r <= 7; r++) b.cells[r][3] = null;
  const above = b.cells[3][3];
  B.applyGravity(b);
  ok(b.cells[4][3] === lockedTile, '藤蔓块不会下落');
  ok(b.cells[3][3] === above, '藤蔓上方的块不会穿过藤蔓');
  ok(b.cells[5][3] && b.cells[6][3] && b.cells[7][3], '藤蔓下方分段被补满');
}
{
  /* 藤蔓可被引爆清除 */
  const b = buildBoard(5, [{ r: 3, c: 3, t: 0, obst: O.VINE }]);
  B.applyClear(b, new Set([3 * 8 + 3]), null);
  ok(!b.obst[3][3], '藤蔓随其上块被消除而破除');
}
{
  /* 洗牌不会移动藤蔓锁住的块 */
  const b = buildBoard(5, [{ r: 2, c: 2, t: 1, obst: O.VINE }]);
  const locked = b.cells[2][2];
  for (let i = 0; i < 30; i++) B.shuffleBoard(b);
  ok(b.cells[2][2] === locked, '洗牌后藤蔓块仍在原位');
}

/* ---------- 6. 死局洗牌 ---------- */
section('6. 死局洗牌');
{
  /* 构造一张绝无可行走法的棋盘：拉丁方 (r+c)%4 */
  const b = buildBoard(4, []);
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) b.cells[r][c] = B.tile((r + c) % 4, 0);
  eq(B.hasValidMove(b), false, '拉丁方棋盘确实无可行走法');
  const rnd = U.rng(777);
  b.rnd = rnd;
  let allOk = true;
  for (let i = 0; i < 300; i++) {
    const res = B.shuffleBoard(b);
    if (B.findMatches(b).length !== 0 || !B.hasValidMove(b)) allOk = false;
    void res;
  }
  ok(allOk, '300 次洗牌后棋盘均可玩且无三连');
}

/* ---------- 7. 关卡数据合法性 ---------- */
section('7. 关卡数据合法性');
{
  const levels = LL.LEVELS || [];
  eq(levels.length, 30, '共 30 关');
  const problems = [];
  levels.forEach(function (lv, i) {
    if (lv.id !== i + 1) problems.push('第 ' + lv.id + ' 关编号不连续');
    if (!(lv.colors >= 4 && lv.colors <= CFG.TILE_INFO.length)) problems.push('第 ' + lv.id + ' 关颜色数非法：' + lv.colors);
    if (!(lv.moves >= 10 && lv.moves <= 40)) problems.push('第 ' + lv.id + ' 关步数不合理：' + lv.moves);
    if (!(lv.stars && lv.stars.length === 3)) problems.push('第 ' + lv.id + ' 关星级阈值缺失');
    if (!lv.objectives || !lv.objectives.length) problems.push('第 ' + lv.id + ' 关缺少目标');
    (lv.objectives || []).forEach(function (o) {
      if (o.type === 'collect') {
        if (!(o.color >= 0 && o.color < lv.colors)) problems.push('第 ' + lv.id + ' 关要收集的颜色 ' + o.color + ' 不存在（本关仅 ' + lv.colors + ' 色）');
        if (!(o.count > 0 && o.count <= 40)) problems.push('第 ' + lv.id + ' 关收集数量不合理：' + o.count);
      } else if (o.type === 'score') {
        if (!(o.target > 0)) problems.push('第 ' + lv.id + ' 关分数目标非法');
      } else if (o.type === 'clear') {
        if (!(lv.clearTotal > 0)) problems.push('第 ' + lv.id + ' 关清障目标但布局里没有障碍');
        if (o.count !== lv.clearTotal) problems.push('第 ' + lv.id + ' 关清障数量与布局不符');
      } else {
        problems.push('第 ' + lv.id + ' 关出现未知目标类型：' + o.type);
      }
    });
    if (lv.stars[1] < lv.stars[0] || lv.stars[2] < lv.stars[1]) problems.push('第 ' + lv.id + ' 关星级阈值未递增');
    if (lv.layout) {
      if (lv.layout.length !== CFG.ROWS) problems.push('第 ' + lv.id + ' 关布局行数不是 ' + CFG.ROWS);
      lv.layout.forEach(function (row) {
        if (row.length !== CFG.COLS) problems.push('第 ' + lv.id + ' 关布局列数不是 ' + CFG.COLS);
      });
    }
  });
  eq(problems.length, 0, '关卡数据校验' + (problems.length ? '：' + problems.slice(0, 6).join(' | ') : ''));
  /* 清障关的障碍都要能被正常生成 */
  const b = B.create({ colors: 5, rnd: U.rng(3), layout: LL.LEVELS[14].layout });
  let obstCount = 0;
  for (let r = 0; r < b.R; r++) for (let c = 0; c < b.C; c++) if (b.obst[r][c]) obstCount++;
  eq(obstCount, LL.LEVELS[14].clearTotal, '第 15 关障碍数与 clearTotal 一致');
}

/* ---------- 8. 模块 API 完整性 ---------- */
section('8. 模块 API 完整性（源码引用的方法必须存在）');
{
  /* 起因：一次编辑用「暂停方法」所在段落当替换锚点，却没把方法写回去，
   * 于是 LL.UI.showPause 消失 —— 点暂停会把状态置为 paused 却弹不出面板，界面卡死。
   * 这类问题语法检查抓不到，所以在这里静态扫一遍所有 LL.X.y( 引用。 */
  const fsMod = require('fs');
  const dir = path.join(__dirname, '..', 'js');
  const missing = [];
  fsMod.readdirSync(dir).forEach(function (file) {
    if (file === 'main.js') return;
    const src = fsMod.readFileSync(path.join(dir, file), 'utf8');
    const re = /LL\.([A-Z][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;
    let m;
    while ((m = re.exec(src))) {
      const mod = LL[m[1]];
      if (!mod) { missing.push(file + ': LL.' + m[1] + ' 模块不存在'); continue; }
      if (typeof mod[m[2]] !== 'function') missing.push(file + ': LL.' + m[1] + '.' + m[2] + ' 不存在');
    }
  });
  const uniq = Array.from(new Set(missing));
  eq(uniq.length, 0, '源码引用的模块方法都存在' + (uniq.length ? '：' + uniq.slice(0, 6).join(' ｜ ') : ''));

  /* 上面那种扫描只看「调用点」，抓不到「方法被删、调用它的地方也一起没了」。
   * 所以再列一份显式契约：这些方法必须存在（删掉或改名都会在这里报出来）。
   * 新增方法不用维护这份表，只有删除/改名才会触发失败。 */
  const REQUIRED = {
    UI: ['init', 'showScreen', 'hideOverlays', 'toTitle', 'toMap', 'showResult', 'hideResult',
      'showPause', 'hidePause', 'togglePause', 'showSettings', 'hideSettings', 'confirm',
      'applySettings', 'applyLang', 'setLoadProgress', 'updateCoins', 'updateBadges',
      'showRevive', 'hideRevive', 'refreshReviveCost', 'showDaily', 'hideDaily', 'buildDaily',
      'showCheckin', 'hideCheckin', 'buildCheckin', 'claimStreak', 'streakRewardLabel',
      'showQuests', 'hideQuests', 'buildQuests', 'claimQuest', 'claimAllQuests', 'rerollQuest',
      'buildBoostBar', 'onBoosterTap', 'boostNote', 'showTab', 'buildEndlessPane', 'buildTimedPane',
      'buildAchievementsPane', 'buildMap', 'updateSoundBtn', 'syncSettingsUI'],
    HUD: ['init', 'setup', 'setScore', 'setMoves', 'setTimeLeft', 'updateObjectives', 'banner', 'hideBanner'],
    Game: ['init', 'startLevel', 'startDaily', 'startEndless', 'startTimed', 'start', 'restart',
      'restartRun', 'nextLevel', 'update', 'draw', 'view', 'canInput', 'setSelected', 'setHover',
      'notifyInput', 'attemptSwap', 'pause', 'resume', 'togglePause', 'revive', 'declineRevive',
      'reviveOffer', 'progressRatio', 'progressList', 'objectivesDone', 'starsFor', 'applyClear',
      'finishTurn', 'finishTurnInner', 'endlessAdvance', 'runOver', 'win', 'lose',
      'placeStartingWind', 'boosterNote'],
    Progress: ['save', 'starsOf', 'bestOf', 'isUnlocked', 'totalStars', 'record', 'resetAll',
      'continueLevel', 'todayKey', 'ensureDay', 'coinsLeftToday', 'addCoins', 'spendCoins',
      'reviveCountOf', 'addRevive', 'streakStatus', 'claimStreak', 'dailyStars', 'recordDaily',
      'dailyMonth', 'ensureQuests', 'questState', 'addQuestProgress', 'claimQuest', 'claimQuestBonus',
      'rerollQuest', 'boosterCount', 'addBooster', 'useBooster', 'buyBooster', 'armedList', 'armBooster',
      'weekKey', 'recordEndless', 'recordTimed', 'bumpStat', 'setStatMax', 'checkAchievements',
      'achievementOf', 'achievementCount'],
    Board: ['create', 'canSwap', 'swapTiles', 'findMatches', 'matchThrough', 'findAllMoves',
      'hasValidMove', 'applyClear', 'applyGravity', 'shuffleBoard'],
    Special: ['decideSpecialFor', 'pickSpawnCell', 'blastCells', 'expandClear', 'planMatches',
      'planCombo', 'buildComboClear'],
    Resolver: ['create', 'beginTurn', 'step', 'runTurn', 'shuffle'],
    Daily: ['build', 'hash', 'buildLayout'],
    Quests: ['generate', 'reroll', 'describe', 'progressText', 'apply'],
    Modes: ['endlessLevel', 'timedLevel', 'timedCoins', 'endlessCoins'],
    Achievements: ['context', 'newlyUnlocked', 'scrollTier', 'nextScrollGoal']
  };
  const badApi = [];
  Object.keys(REQUIRED).forEach(function (mod) {
    const target = LL[mod];
    if (!target) { badApi.push(mod + ' 模块不存在'); return; }
    REQUIRED[mod].forEach(function (m) {
      if (typeof target[m] !== 'function') badApi.push(mod + '.' + m);
    });
  });
  eq(badApi.length, 0, '模块契约方法齐全' + (badApi.length ? '，缺失：' + badApi.slice(0, 8).join(' ｜ ') : ''));
}

/* ---------- 汇总 ---------- */
console.log('\n' + '─'.repeat(56));
console.log('通过 ' + passed + ' 项，失败 ' + failed + ' 项');
if (failed) {
  console.log('\n失败明细：');
  failures.forEach(function (f) { console.log('  ✗ ' + f); });
  process.exit(1);
}
console.log('全部自检通过 ✓');
