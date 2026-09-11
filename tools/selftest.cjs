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
 *   7. 关卡数据合法性
 *   8. 模块 API 完整性
 *   9. 局内技能与灵力（四个技能的消除计划、灵力收支、绝处逢生、回合流水线）
 */
'use strict';
const path = require('path');

/* 以 CommonJS 方式加载浏览器脚本（它们挂在 globalThis.LL 上）。
 * 文案文件也一起加载：这样第 9 节的「资产与文案齐全」才能真的查到字典。 */
['util.js', 'config.js', 'board.js', 'special.js', 'resolver.js', 'skills.js', 'skilldemo.js', 'levels.js',
  '../lang/zh.js', '../lang/en.js',
  'i18n.js', 'progress.js', 'quests.js', 'daily.js', 'modes.js', 'achievements.js',
  'anim.js', 'assets.js', 'audio.js', 'render.js', 'hud.js', 'input.js', 'game.js', 'ui.js'].forEach(function (f) {
  require(path.join(__dirname, '..', 'js', f));
});
/* 说明：上面这些文件在 Node 下只会定义对象，不会碰 DOM（DOM 访问都在函数体内），
 * 因此可以安全加载，用来做「引用的方法是否存在」这类静态检查。
 * main.js 会立即执行 boot()，故意不加载。 */
const LL = globalThis.LL;
const CFG = LL.CFG, U = LL.U, B = LL.Board, SP = LL.Special, R = LL.Resolver, SK = LL.Skills;
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
      'buildAchievementsPane', 'buildMap', 'updateSoundBtn', 'syncSettingsUI',
      'showSkillIntro', 'hideSkillIntro', 'buildSkillIntro', 'showSkillTip', 'hideSkillTip', 'bindSkillSlot'],
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
      'hasSeen', 'markSeen',
      'weekKey', 'recordEndless', 'recordTimed', 'bumpStat', 'setStatMax', 'checkAchievements',
      'achievementOf', 'achievementCount'],
    Board: ['create', 'canSwap', 'swapTiles', 'findMatches', 'matchThrough', 'findAllMoves',
      'hasValidMove', 'applyClear', 'applyGravity', 'shuffleBoard'],
    Special: ['decideSpecialFor', 'pickSpawnCell', 'blastCells', 'expandClear', 'planMatches',
      'planCombo', 'buildComboClear'],
    Resolver: ['create', 'beginTurn', 'beginSkill', 'beginScan', 'step', 'runTurn', 'shuffle'],
    Skills: ['def', 'order', 'qiStartFor', 'qiScaleFor', 'gainMult', 'gain', 'addQi', 'isFull',
      'cost', 'canUse', 'validTarget', 'planHammer', 'planCross', 'recolor', 'plan', 'lastStandOffer'],
    SkillDemo: ['open', 'show', 'close', 'current', 'isRunning', 'resize'],
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

/* ---------- 9. 局内技能与灵力 ---------- */
section('9. 局内技能与灵力');
{
  const QI = CFG.QI, LS = CFG.LAST_STAND;

  /* 9a. 数据表本身要自洽：价格与开局赠送、上限与技能价格的关系站得住 */
  const order = SK.order();
  eq(order.length, CFG.SKILLS.order.length, '技能数量与配置一致');
  let costProblems = [];
  order.forEach(function (id) {
    const d = SK.def(id);
    if (!d) { costProblems.push(id + ' 未定义'); return; }
    if (!(d.cost > 0)) costProblems.push(id + ' 价格非正');
    if (d.aim !== 'none' && d.aim !== 'cell' && d.aim !== 'color') costProblems.push(id + ' 目标类型非法：' + d.aim);
  });
  eq(costProblems.length, 0, '技能配置合法' + (costProblems.length ? '：' + costProblems.join(' | ') : ''));
  ok(QI.START >= Math.min.apply(null, order.map(function (id) { return SK.def(id).cost; })),
    '开局赠送的灵力至少够放一次最便宜的技能（保证一进场就能体验）');
  ok(QI.MAX >= CFG.SKILLS.cross.cost, '灵力上限至少够放一次最贵的技能');
  ok(QI.MAX < CFG.SKILLS.cross.cost * 4, '灵力上限存不住四次大招（上限必须有意义）');
  ok(LS.cost >= CFG.SKILLS.cross.cost, '绝处逢生的代价不低于一次移山');

  /* 9b. 如意锤：只打一格，但能一锤破开石锁（2 点破障），且第二击不重复计格 */
  const hb = B.create({ colors: 5, rnd: U.rng(41) });
  hb.obst[4][4] = { k: O.STONE, hp: CFG.OBST_INFO[2].hp };
  const hp = SK.planHammer(hb, { r: 4, c: 4 });
  eq(hp.keys.size, 1, '如意锤只锁定一格');
  eq(hp.secondHit.length, 1, '如意锤带一次追加击打');
  const hrs = R.create(hb);
  ok(R.beginSkill(hrs, hp).ok, '如意锤回合可以发起');
  const hev = R.step(hrs);
  eq(hev && hev.kind, 'clear', '如意锤首个事件是消除');
  eq(hev && hev.skill, true, '技能消除事件带 skill 标记（表现层据此走技能特效）');
  eq(hev && hev.cause, 'skill_hammer', '如意锤事件的 cause 正确');
  ok(hb.obst[4][4] === null, '石锁被一锤破开（2 点伤害）');
  eq(hev.obstacles.filter(function (o) { return o.broken; }).length, 1, '破障只计一次');
  eq(hev.cells.length, 1, '只清除目标格，第二击不重复计格');
  let hGuard = 0, hLast = hev;
  while (hLast && hLast.kind !== 'turnEnd' && hGuard++ < 300) hLast = R.step(hrs);
  ok(hLast && hLast.kind === 'turnEnd', '如意锤回合能正常收束');
  eq(B.findMatches(hb).length, 0, '如意锤回合结束后无残留三连');
  let hEmpty = true;
  for (let r = 0; r < hb.R; r++) for (let c = 0; c < hb.C; c++) if (hb.playable[r][c] && !hb.cells[r][c]) hEmpty = false;
  ok(hEmpty, '如意锤回合结束后棋盘无空格');

  /* 9c. 移山：十字覆盖整行 + 整列 */
  const cb = B.create({ colors: 5, rnd: U.rng(43) });
  const cp = SK.planCross(cb, { r: 2, c: 5 });
  eq(cp.keys.size, cb.R + cb.C - 1, '移山覆盖整行整列（' + (cb.R + cb.C - 1) + ' 格）');
  const crs = R.create(cb);
  R.beginSkill(crs, cp);
  const cev = R.step(crs);
  eq(cev && cev.cause, 'skill_cross', '移山事件的 cause 正确');
  ok(cev.cells.length >= cb.R + cb.C - 1 - 2, '移山确实清掉了十字上的格子');
  let cGuard = 0, cLast = cev;
  while (cLast && cLast.kind !== 'turnEnd' && cGuard++ < 400) cLast = R.step(crs);
  ok(cLast && cLast.kind === 'turnEnd', '移山回合能正常收束');
  eq(B.findMatches(cb).length, 0, '移山回合结束后无残留三连');

  /* 9d. 灵犀一点：改色只认普通块，改完色由匹配扫描自然连锁 */
  const rb = B.create({ colors: 4, rnd: U.rng(47) });
  /* 造一个「差一块」的局面：某行两个同色隔一格 */
  rb.cells[0][0] = B.tile(1, 0); rb.cells[0][1] = B.tile(2, 0); rb.cells[0][2] = B.tile(1, 0);
  rb.cells[0][3] = B.tile(3, 0); rb.cells[1][0] = B.tile(2, 0); rb.cells[1][1] = B.tile(3, 0);
  rb.cells[1][2] = B.tile(0, 0); rb.cells[1][3] = B.tile(2, 0);
  ok(SK.recolor(rb, { r: 0, c: 1 }, 1), '改色成功');
  eq(rb.cells[0][1].t, 1, '目标格颜色已改变');
  ok(!SK.recolor(rb, { r: 0, c: 1 }, 99), '越界颜色被拒绝');
  rb.cells[2][2] = B.tile(0, S.THUNDER);
  ok(!SK.recolor(rb, { r: 2, c: 2 }, 1), '特殊块不接受改色（否则会变成无法理解的组合）');
  eq(SK.validTarget(rb, { r: 2, c: 2 }, 'color'), false, '特殊块不是灵犀一点的合法目标');
  eq(SK.validTarget(rb, { r: 2, c: 2 }, 'hammer'), true, '特殊块可以是如意锤的目标（引爆它）');
  /* 改色后接入匹配扫描：刚凑出的三连必须真的被消掉 */
  const rrs = R.create(rb);
  ok(R.beginScan(rrs).ok, '匹配扫描回合可以发起');
  const rev = R.step(rrs);
  ok(rev && rev.kind === 'clear' && rev.cells.length >= 3, '改色凑出的三连被正常结算（连锁）');

  /* 9e. 伤害类技能的引爆链：目标格上的特殊块必须照常炸开 */
  const wb = B.create({ colors: 5, rnd: U.rng(53) });
  wb.cells[3][3] = B.tile(2, S.WIND_H);
  const wp = SK.planHammer(wb, { r: 3, c: 3 });
  eq(wp.keys.size, wb.C, '锤到横风符会引爆整行');
  eq(wp.fires.length, 1, '引爆记录里有横风符');
  const cro = B.create({ colors: 5, rnd: U.rng(59) });
  cro.cells[3][3] = B.tile(2, S.WIND_H);
  cro.cells[5][3] = B.tile(2, S.THUNDER);
  const xx = SK.planCross(cro, { r: 3, c: 3 });
  ok(xx.fires.length >= 2, '移山会沿着十字链式引爆多个特殊块（实际 ' + xx.fires.length + '）');

  /* 9e-2. 技能回合之后的连锁不能崩：技能没有交换的两格（a/b 为 null），
   * 匹配生成落点偏好必须容忍这一点（这里曾因 [null,null] 抛 TypeError）。 */
  let cascadeRuns = 0, cascadeCrash = null;
  for (let seed = 0; seed < 40; seed++) {
    const sb = B.create({ colors: 4, rnd: U.rng(900 + seed) });
    const srs = R.create(sb);
    /* 用移山清掉十字，最容易在重力后带出连锁 */
    try {
      R.beginSkill(srs, SK.planCross(sb, { r: (seed % 8), c: ((seed * 3) % 8) }));
      let g = 0, ev = null, sawCascade = false;
      while ((ev = R.step(srs)) && g++ < 500) {
        if (ev.kind === 'clear' && ev.cascade >= 2) sawCascade = true;
        if (ev.kind === 'turnEnd') break;
      }
      if (sawCascade) cascadeRuns++;
      ok(!!ev && ev.kind === 'turnEnd', '技能回合 ' + seed + ' 能收束到 turnEnd');
    } catch (e) {
      cascadeCrash = seed + ': ' + e.message;
      break;
    }
  }
  eq(cascadeCrash, null, '技能回合带出连锁不会崩' + (cascadeCrash ? '（种子 ' + cascadeCrash + '）' : ''));
  ok(cascadeRuns > 0, '确实构造出了技能后的连锁场景（' + cascadeRuns + '/40 局）');

  /* 9f. 灵力收支：公式、上限、溢出转分、背水一战倍率 */
  eq(SK.gain({ cells: new Array(10).fill({ t: 0 }), obstacles: [{ broken: true }, { broken: false }], fires: [{}], cascade: 2 }, 1),
    QI.PER_TILE * 10 + QI.PER_CASCADE + QI.PER_OBSTACLE + QI.PER_FIRE, '灵力获取公式（消块/连锁/破障/引爆）');
  eq(SK.gain({ cells: [], obstacles: [], fires: [], cascade: 1, cause: 'combo' }, 1), QI.PER_COMBO, '组合额外给灵力');
  eq(SK.gain({ cells: new Array(5).fill({ t: 0 }), obstacles: [], fires: [], cascade: 1 }, 2),
    QI.PER_TILE * 5 * 2, '倍率生效');
  ok(SK.gainMult(QI.LAST_STAND_AT, false) === QI.LAST_STAND_MULT, '步数见底时灵力获取翻倍（背水一战）');
  eq(SK.gainMult(QI.LAST_STAND_AT + 1, false), 1, '步数充裕时不翻倍');
  eq(SK.gainMult(1, true), 1, '限时模式没有步数概念，不翻倍');
  const a1 = SK.addQi(QI.MAX - 10, 25);
  eq(a1.qi, QI.MAX, '灵力不会超过上限');
  eq(a1.overflow, 15, '溢出量正确');
  eq(a1.score, 15 * QI.OVERFLOW_SCORE, '溢出按比例折算成分数');
  const a2 = SK.addQi(0, 5);
  eq(a2.qi, 5, '未满槽时不溢出');
  ok(SK.isFull(QI.MAX) && !SK.isFull(QI.MAX - 1), '满槽判定');

  /* 9g. 可用性：灵力不够不放、无路可走时换天免费 */
  const ub = B.create({ colors: 5, rnd: U.rng(61) });
  eq(SK.canUse(ub, 0, 'hammer').reason, 'qi', '灵力不足时不放技能');
  eq(SK.canUse(ub, 0, 'hammer').ok, false, '灵力不足时 ok=false');
  ok(SK.canUse(ub, QI.MAX, 'cross').ok, '灵力充足时可用');
  eq(SK.canUse(ub, QI.MAX, 'nope').reason, 'unknown', '未知技能被拒绝');
  /* 一个人为造出的死局（拉丁方）：换天应当免费 */
  const dead = B.create({ colors: 4, rnd: U.rng(67) });
  for (let r = 0; r < dead.R; r++) for (let c = 0; c < dead.C; c++) dead.cells[r][c] = B.tile((r + c) % 4, 0);
  eq(B.hasValidMove(dead), false, '造出的盘面确实无解');
  eq(SK.cost(dead, 'swap'), 0, '无路可走时换天免费（不让你因为没灵力卡死）');
  eq(SK.cost(dead, 'hammer'), CFG.SKILLS.hammer.cost, '其它技能不跟着免费');
  ok(SK.canUse(dead, 0, 'swap').ok, '没灵力也能用免费的换天');

  /* 9h. 目标格合法性 */
  const tb = B.create({ colors: 5, rnd: U.rng(71) });
  tb.obst[6][6] = { k: O.FROST, hp: 1 };
  tb.cells[6][6] = null;
  eq(SK.validTarget(tb, { r: 6, c: 6 }, 'hammer'), true, '空格上的障碍可以是锤子目标（破障）');
  tb.cells[6][6] = null;
  eq(SK.validTarget(tb, { r: 6, c: 6 }, 'color'), false, '空格不能改色');
  eq(SK.validTarget(tb, { r: 99, c: 0 }, 'cross'), false, '棋盘外不是合法目标');
  tb.playable[7][7] = false;
  eq(SK.validTarget(tb, { r: 7, c: 7 }, 'cross'), false, '不可玩格不是合法目标');

  /* 9i. 绝处逢生：灵力够才提供，次数有上限 */
  eq(SK.lastStandOffer(LS.cost - 1, 0), null, '灵力不够时不提供绝处逢生');
  const lso = SK.lastStandOffer(LS.cost, 0);
  ok(lso && lso.cost === LS.cost && lso.moves === LS.moves, '绝处逢生换步数正确');
  eq(SK.lastStandOffer(QI.MAX, LS.max), null, '达到次数上限后不再提供（防连锁循环）');

  /* 9j. 技能回合不消耗步数：Game 侧只扣灵力，movesLeft 由 attemptSwap 独占 */
  const gsrc = require('fs').readFileSync(path.join(__dirname, '..', 'js', 'game.js'), 'utf8');
  ok(gsrc.indexOf('castSkill') >= 0 && gsrc.indexOf('this.movesLeft--') >= 0,
    'Game 里扣步数只出现在 attemptSwap 一处');
  eq((gsrc.match(/this\.movesLeft--/g) || []).length, 1, '扣步数只发生一次（技能一律不吃步数）');

  /* 9k. 技能资产与文案齐全（图标 + 音效 + 中英文案）
   * 每个技能都要有「名字 / 一句话效果 / 瞄准提示」三份文案：
   * 第一次用的人只能靠这三条知道技能是干什么的，缺一条就等于没有说明。 */
  const imgKeys = LL.Assets.IMAGE_LIST || [];
  const sfxKeys = LL.Assets.SFX_LIST || [];
  const zhDict = (LL.LANG && LL.LANG.zh) || {};
  const enDict = (LL.LANG && LL.LANG.en) || {};
  const missAssets = [];
  order.forEach(function (id) {
    const d = SK.def(id);
    if (imgKeys.indexOf(d.icon) < 0) missAssets.push('图标 ' + d.icon);
    if (sfxKeys.indexOf('skill_' + id) < 0) missAssets.push('音效 skill_' + id);
    ['skill_' + id, 'skill_' + id + '_d', 'skill_' + id + '_use'].forEach(function (k) {
      if (!zhDict[k]) missAssets.push('中文案 ' + k);
      if (!enDict[k]) missAssets.push('英文案 ' + k);
    });
  });
  ['skillAimHint', 'skillBadTarget', 'skillNoQi', 'skillPickColor', 'qi', 'skillOverflow',
    'lastStandTitle', 'lastStandMsg', 'lastStandYes', 'lastStandCost',
    'skill_intro_title', 'skill_intro_lead', 'skill_intro_ok', 'skillHelp',
    'skillTipCost', 'skillTipFree'].forEach(function (k) {
      if (!zhDict[k]) missAssets.push('中文案 ' + k);
      if (!enDict[k]) missAssets.push('英文案 ' + k);
    });
  eq(missAssets.length, 0, '技能资产与文案齐全' + (missAssets.length ? '：' + missAssets.join(' | ') : ''));

  /* 9m. 新手教学的「看过」标记：首次弹一次，之后不再打扰 */
  const seenBak = LL.Progress.data.seen;
  LL.Progress.data.seen = {};
  eq(LL.Progress.hasSeen('skills'), false, '新存档未看过技能教学');
  LL.Progress.markSeen('skills');
  eq(LL.Progress.hasSeen('skills'), true, '标记后为已看过');
  LL.Progress.data.seen = undefined;
  eq(LL.Progress.hasSeen('skills'), false, '老存档缺 seen 字段时不报错（惰性建键）');
  LL.Progress.markSeen('skills');
  eq(LL.Progress.hasSeen('skills'), true, '缺字段也能补上');
  LL.Progress.data.seen = seenBak;

  /* 9n. 技能的名字/效果/提示三类文案都不该带占位符——
   * 它们拼进说明卡与教学面板时不做参数替换，漏一个就会把「{n}」原样显示给玩家。 */
  const badPlaceholder = [];
  order.forEach(function (id) {
    ['skill_' + id, 'skill_' + id + '_d', 'skill_' + id + '_use'].forEach(function (k) {
      [['zh', zhDict[k]], ['en', enDict[k]]].forEach(function (pair) {
        if (pair[1] && /\{[a-z]+\}/.test(pair[1])) badPlaceholder.push(pair[0] + ' ' + k);
      });
    });
  });
  eq(badPlaceholder.length, 0, '技能名称/效果/提示文案不含未替换占位符' +
    (badPlaceholder.length ? '：' + badPlaceholder.join(' | ') : ''));

  /* 9l. 技能图标文件真的存在（生成脚本跑过） */
  const imgDir = path.join(__dirname, '..', 'assets', 'img');
  const missFile = order.filter(function (id) {
    return !require('fs').existsSync(path.join(imgDir, SK.def(id).icon + '.svg'));
  });
  eq(missFile.length, 0, '技能图标文件已生成' + (missFile.length ? '：' + missFile.join(' | ') : ''));
}

/* ---------- 10. 素材完整性 ----------
 * 起因：成就列表一直用 LL.Assets.path('ui_medal')，但 ui_medal 从没登记进 IMAGES，
 * path() 于是退回原名、拼出 assets/img/ui_medal（没有 .svg）→ 12 行成就全是 404。
 * 这类问题语法检查、模块契约都抓不到，只有把「代码里的键 ↔ 清单 ↔ 磁盘文件」三方对起来才看得见。 */
section('10. 素材完整性');
{
  const fsMod = require('fs');
  const imgDir = path.join(__dirname, '..', 'assets', 'img');
  const sfxDir = path.join(__dirname, '..', 'assets', 'sfx');
  const jsDir = path.join(__dirname, '..', 'js');

  const imgList = LL.Assets.IMAGE_LIST || [];
  const sfxList = LL.Assets.SFX_LIST || [];
  const has = function (arr, k) { return arr.indexOf(k) >= 0; };

  /* 10a. 代码里写死的 Assets.path('xxx') 键都要在清单里。
   * 只收「纯字面量」调用（右引号后紧跟右括号）——像 path('tile_' + info.id) 这种
   * 拼出来的键在 10f 里按前缀单独校验。 */
  const literalKeys = [];
  const keyRe = /LL\.Assets\.path\(\s*'([^']+)'\s*\)/g;
  fsMod.readdirSync(jsDir).forEach(function (file) {
    if (file === 'main.js') return;
    const src = fsMod.readFileSync(path.join(jsDir, file), 'utf8');
    let m;
    while ((m = keyRe.exec(src))) literalKeys.push({ key: m[1], file: file });
  });
  const badLiteral = literalKeys.filter(function (x) { return !has(imgList, x.key); });
  eq(badLiteral.length, 0, '源码里写死的素材键都已登记' +
    (badLiteral.length ? '：' + badLiteral.map(function (x) { return x.key + '(' + x.file + ')'; }).slice(0, 6).join(' | ') : '') +
    '（共检查 ' + literalKeys.length + ' 处）');

  /* 10f. 拼接出来的键按前缀family校验：路径拼 'tile_' + id 之类必须每种都存在 */
  const expectedDyn = [];
  CFG.TILE_INFO.forEach(function (t) { expectedDyn.push('tile_' + t.id); });
  expectedDyn.push('ui_star', 'ui_star_off', 'ob_stone', 'ui_lock');
  const badDyn = expectedDyn.filter(function (k) { return !has(imgList, k); });
  eq(badDyn.length, 0, '拼接用的素材键（tile_* 等）都已登记' +
    (badDyn.length ? '：' + badDyn.slice(0, 6).join(' | ') : '') + '（共 ' + expectedDyn.length + ' 个）');

  /* 10b. 配表里声明的图标键也要在清单里（技能 / 开局道具 / 成就） */
  const tableIcons = [];
  SK.order().forEach(function (id) { tableIcons.push({ key: SK.def(id).icon, from: 'SKILLS.' + id }); });
  CFG.BOOSTERS.order.forEach(function (id) { tableIcons.push({ key: CFG.BOOSTERS[id].icon, from: 'BOOSTERS.' + id }); });
  LL.Achievements.LIST.forEach(function (a) { tableIcons.push({ key: a.icon, from: 'ACH.' + a.id }); });
  const badTable = tableIcons.filter(function (x) { return !x.key || !has(imgList, x.key); });
  eq(badTable.length, 0, '配表声明的图标都已登记' +
    (badTable.length ? '：' + badTable.map(function (x) { return x.from + '→' + x.key; }).slice(0, 6).join(' | ') : '') +
    '（共检查 ' + tableIcons.length + ' 个）');

  /* 10c. 清单里每张图都真的在磁盘上（生成脚本改了名/漏跑都能查到） */
  const missFile = imgList.filter(function (k) { return !fsMod.existsSync(path.join(imgDir, LL.Assets.IMAGES[k])); });
  eq(missFile.length, 0, '清单里的图片文件都存在' +
    (missFile.length ? '：' + missFile.slice(0, 6).join(' | ') : '') + '（共 ' + imgList.length + ' 张）');

  /* 10d. 音效清单同理 */
  const missSfx = sfxList.filter(function (k) { return !fsMod.existsSync(path.join(sfxDir, LL.Assets.SFX[k])); });
  eq(missSfx.length, 0, '清单里的音效文件都存在' +
    (missSfx.length ? '：' + missSfx.slice(0, 6).join(' | ') : '') + '（共 ' + sfxList.length + ' 个）');

  /* 10e. 反向检查：磁盘上生成的图不能有「没人登记也没人引用」的孤儿。
   * 在 index.html / css 里写死路径的（背景、卷轴层、云纹）列入白名单。 */
  const hardcoded = {};
  const idxSrc = fsMod.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const cssSrc = fsMod.readdirSync(path.join(__dirname, '..', 'css')).map(function (f) {
    return fsMod.readFileSync(path.join(__dirname, '..', 'css', f), 'utf8');
  }).join('\n');
  const hardRe = /assets\/img\/([A-Za-z0-9_]+)\.svg/g;
  let hm;
  while ((hm = hardRe.exec(idxSrc))) hardcoded[hm[1]] = true;
  while ((hm = hardRe.exec(cssSrc))) hardcoded[hm[1]] = true;
  const registeredFiles = {};
  imgList.forEach(function (k) { registeredFiles[String(LL.Assets.IMAGES[k]).replace('.svg', '')] = true; });
  const orphans = fsMod.readdirSync(imgDir).filter(function (f) {
    if (f.slice(-4) !== '.svg') return false;
    const base = f.replace('.svg', '');
    return !registeredFiles[base] && !hardcoded[base];
  });
  eq(orphans.length, 0, '生成的图没有孤儿（要么登记进清单、要么在页面里写死路径）' +
    (orphans.length ? '：' + orphans.slice(0, 8).join(' | ') : ''));
}

/* ---------- 11. 弹层叠放次序 ----------
 * 起因：技能说明面板 `#skillIntro` 加进 DOM 时没进 z-index 梯子，于是落到 .overlay
 * 的默认层 50，被暂停面板（55）盖在下面——从暂停里点「技能说明」，面板在底下弹出来，
 * 玩家只看到暂停面板。所有 .overlay 都是同一个 z-index，DOM 顺序救不了。
 * 所以：能叠在别的弹层上面的，必须显式在梯子上占一格。 */
section('11. 弹层叠放次序');
{
  const fsMod = require('fs');
  const htmlSrc = fsMod.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const cssSrc = fsMod.readFileSync(path.join(__dirname, '..', 'css', 'ui.css'), 'utf8');

  const overlays = [];
  const ovRe = /<div id="([A-Za-z0-9_]+)" class="overlay/g;
  let m;
  while ((m = ovRe.exec(htmlSrc))) overlays.push(m[1]);
  ok(overlays.length >= 10, '找到 ' + overlays.length + ' 个弹层');

  /* 解析每个 #id { ... } 块里的 z-index（写成几行也认） */
  const ladder = {};
  const blockRe = /#([A-Za-z0-9_]+)\s*\{([^}]*)\}/g;
  while ((m = blockRe.exec(cssSrc))) {
    const z = /z-index:\s*(\d+)/.exec(m[2]);
    if (z && ladder[m[1]] == null) ladder[m[1]] = parseInt(z[1], 10);
  }

  /* 「整屏页面」彼此互斥、永远不会同时出现，留在默认层 50 是对的；
   * 其余弹层都可能叠在别人身上，必须显式排级。 */
  const BASE_LAYER = ['title', 'map', 'daily', 'quests', 'checkin'];
  const missing = overlays.filter(function (id) {
    return BASE_LAYER.indexOf(id) < 0 && ladder[id] == null;
  });
  eq(missing.length, 0, '除基础整屏页外的弹层都在 z-index 梯子上' +
    (missing.length ? '：' + missing.join(' | ') + '（会落到默认层 50，被别的弹层盖住）' : '') +
    '（弹层 ' + overlays.length + ' 个 / 梯子 ' + Object.keys(ladder).filter(function (k) { return overlays.indexOf(k) >= 0; }).length + ' 级）');

  /* 梯子上的 id 要能对上真实存在的元素——防手滑写成 #skillintro 这种不生效的规则。
   * 非弹层的层（常驻 HUD）白名单放行；以后新增同类规则要在这里登记，是刻意的摩擦。 */
  const NON_OVERLAY = ['hud'];
  const ghost = Object.keys(ladder).filter(function (k) {
    return overlays.indexOf(k) < 0 && NON_OVERLAY.indexOf(k) < 0;
  });
  eq(ghost.length, 0, '梯子上的 id 都对得上真实弹层' +
    (ghost.length ? '：' + ghost.join(' | ') + '（写成不存在的 id 等于没写）' : ''));

  /* 梯子自洽：确认框永远最上（任何面板都能弹确认框），
   * 技能说明要能盖过暂停（它是从暂停里打开的）。 */
  const others = Object.keys(ladder).filter(function (k) { return k !== 'confirm'; });
  const maxOther = Math.max.apply(null, others.map(function (k) { return ladder[k]; }));
  ok(ladder.confirm > maxOther, '确认框在梯子最上层（' + ladder.confirm + ' > ' + maxOther + '）');
  ok(ladder.skillIntro > ladder.pause,
    '技能说明高于暂停面板（' + ladder.skillIntro + ' > ' + ladder.pause + '）——它就是从暂停里打开的');
  ok(ladder.skillIntro < ladder.confirm, '技能说明低于确认框');
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
