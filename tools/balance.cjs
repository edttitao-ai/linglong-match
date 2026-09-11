/* 玲珑消 · tools/balance.cjs — 关卡平衡验证
 *
 *   node tools/balance.cjs                 每关 200 局
 *   node tools/balance.cjs --runs=600      自定义局数
 *   node tools/balance.cjs --level=15      只看某一关（详细输出）
 *
 * 用一个「贪心玩家」模拟真实打法：优先选能完成当前目标、能生成特殊块、
 * 能引爆特殊块、能破障的走法，并在同分走法间随机。统计胜率与得分分布，
 * 给出二星 / 三星分数建议值。
 */
'use strict';
const path = require('path');

['util.js', 'config.js', 'board.js', 'special.js', 'resolver.js', 'levels.js', 'daily.js', 'modes.js'].forEach(function (f) {
  require(path.join(__dirname, '..', 'js', f));
});
const LL = globalThis.LL;
const U = LL.U, B = LL.Board, SP = LL.Special, R = LL.Resolver, CFG = LL.CFG;
const S = CFG.SPECIAL;

const args = process.argv.slice(2);
const getArg = (name, def) => {
  const m = args.find(a => a.indexOf('--' + name + '=') === 0);
  return m ? parseInt(m.split('=')[1], 10) : def;
};
const RUNS = getArg('runs', 200);
const ONLY = getArg('level', 0);

/* ---------- 贪心玩家 ---------- */

function scoreMove(b, mv, level, rnd) {
  let sc = 0;
  if (mv.kind === 'special') sc += 55;      /* 双特殊块组合：收益最高 */
  else if (mv.kind === 'taiji') sc += 60;   /* 太极与任意块 */

  B.swapTiles(b, mv.a, mv.b);
  const groups = B.findMatches(b);
  let tiles = 0, specials = 0, valuable = 0;
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    tiles += g.cells.size;
    if (SP.decideSpecialFor(g) !== S.NONE) specials++;
    g.cells.forEach(function (k) {
      const r = B.rowOf(b, k), c = B.colOf(b, k);
      const tl = b.cells[r][c];
      if (!tl) return;
      for (let j = 0; j < level.objectives.length; j++) {
        const o = level.objectives[j];
        if (o.type === 'collect' && o.color === tl.t) valuable += 26;
      }
      if (b.obst[r][c]) valuable += 34;               /* 破障优先 */
      if (tl.s !== S.NONE) sc += 40;                  /* 引爆已有特殊块 */
    });
  }
  /* 特殊块落点也计入目标价值 */
  B.swapTiles(b, mv.a, mv.b);
  sc += tiles * 11 + specials * 30 + valuable + rnd() * 14;
  return sc;
}

function chooseMove(b, level, rnd) {
  const moves = B.findAllMoves(b, 0);
  if (!moves.length) return null;
  let best = null, bestScore = -Infinity;
  for (let i = 0; i < moves.length; i++) {
    const sc = scoreMove(b, moves[i], level, rnd);
    if (sc > bestScore) { bestScore = sc; best = moves[i]; }
  }
  return best;
}

/* ---------- 单局模拟 ---------- */

function playGame(level, seed) {
  const rnd = U.rng(seed);
  const b = B.create({ colors: level.colors, layout: level.layout, rnd: rnd });
  const rs = R.create(b);
  const collected = {};
  let obstCleared = 0, score = 0, moves = level.moves, maxCascade = 0, guard = 0;

  function done() {
    return level.objectives.every(function (o) {
      if (o.type === 'score') return score >= o.target;
      if (o.type === 'collect') return (collected[o.color] || 0) >= o.count;
      return obstCleared >= (o.count || level.clearTotal || 0);
    });
  }

  while (moves > 0 && !done() && guard++ < 400) {
    const mv = chooseMove(b, level, rnd);
    if (!mv) { R.shuffle(rs); if (!B.hasValidMove(b)) break; continue; }
    const res = R.runTurn(rs, mv.a, mv.b);
    if (!res.ok) continue;
    moves--;
    for (let i = 0; i < res.events.length; i++) {
      const ev = res.events[i];
      if (ev.kind !== 'clear') continue;
      score += ev.score;
      for (let j = 0; j < ev.cells.length; j++) if (ev.cells[j].t >= 0) collected[ev.cells[j].t] = (collected[ev.cells[j].t] || 0) + 1;
      for (let j = 0; j < ev.obstacles.length; j++) if (ev.obstacles[j].broken) obstCleared++;
      if (ev.cascade > maxCascade) maxCascade = ev.cascade;
    }
    if (!B.hasValidMove(b)) { R.shuffle(rs); if (!B.hasValidMove(b)) break; }
  }

  const win = done();
  const fullScore = win ? score + moves * CFG.SCORE_MOVE_LEFT : score;
  return { win: win, score: fullScore, rawScore: score, movesLeft: moves, cleared: obstCleared, maxCascade: maxCascade };
}

/* ---------- 统计输出 ---------- */

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)));
  return sorted[i];
}

/* ---------- 无尽模式抽查 ----------
 * node tools/balance.cjs --endless --stages=20
 * 目标：前几盘 80%+ 通过，中段 60~80%，后段 40~60% —— 让「撑到第几盘」有意义 */
if (args.indexOf('--endless') >= 0) {
  const maxStage = getArg('stages', 20);
  console.log('无尽模式抽查（贪心玩家，每盘 ' + RUNS + ' 局）\n');
  console.log('盘次  色 步  目标      障碍  通过率   平均剩余步');
  let sum = 0;
  for (let s = 1; s <= maxStage; s++) {
    const lv = LL.Modes.endlessLevel(s);
    let win = 0, left = 0;
    for (let k = 0; k < RUNS; k++) {
      const r = playGame(lv, 3000 + s * 131 + k * 17);
      if (r.win) { win++; left += r.movesLeft; }
    }
    const rate = win / RUNS;
    sum += rate;
    console.log(
      String(s).padStart(3) + '   ' + lv.colors + '  ' + String(lv.moves).padStart(2) + '  ' +
      String(lv.objectives[0].target).padStart(6) + '  ' + String(lv.clearTotal).padStart(4) + '  ' +
      (rate * 100).toFixed(1).padStart(5) + '%  ' + (win ? (left / win).toFixed(1).padStart(6) : '   -  ')
    );
  }
  console.log('\n平均通过率 ' + (sum / maxStage * 100).toFixed(1) + '%');
  process.exit(0);
}

/* ---------- 每日挑战抽查 ----------
 * node tools/balance.cjs --daily            只看今天
 * node tools/balance.cjs --daily --days=14  连看两周（检查难度波动）
 * 每日挑战应当「有挑战但可完成」，胜率目标区间 55%~85% */
const dailyMode = args.indexOf('--daily') >= 0;
if (dailyMode) {
  const days = getArg('days', 1);
  const base = new Date();
  console.log('每日挑战抽查（贪心玩家，每关 ' + RUNS + ' 局）\n');
  console.log('日期              色 步 目标                             胜率    平均剩余步');
  let sum = 0, n = 0, worst = 1;
  for (let i = 0; i < days; i++) {
    const d = new Date(base.getTime() + i * 86400000);
    const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const lv = LL.Daily.build(key);
    let win = 0, left = 0;
    for (let k = 0; k < RUNS; k++) {
      const r = playGame(lv, 5000 + i * 977 + k * 31);
      if (r.win) { win++; left += r.movesLeft; }
    }
    const rate = win / RUNS;
    sum += rate; n++;
    worst = Math.min(worst, rate);
    const objText = lv.objectives.map(function (o) {
      if (o.type === 'score') return '分' + o.target;
      if (o.type === 'collect') return '收' + CFG.TILE_INFO[o.color].name + '×' + o.count;
      return '清障×' + o.count;
    }).join('+');
    console.log(
      key + '  ' + lv.name.slice(-2) + '  ' + String(lv.colors) + '  ' + String(lv.moves).padStart(2) + '  ' +
      objText.padEnd(32, ' ') + ' ' + (rate * 100).toFixed(1).padStart(5) + '%  ' +
      (win ? (left / win).toFixed(1).padStart(6) : '   -  ') +
      (rate < 0.5 ? '  ← 偏难' : (rate > 0.95 ? '  ← 偏易' : ''))
    );
  }
  const avg = sum / n;
  console.log('\n平均胜率 ' + (avg * 100).toFixed(1) + '%，最低 ' + (worst * 100).toFixed(1) + '%' +
    (avg >= 0.55 && avg <= 0.9 ? '  ✓ 落在合理区间' : '  ✗ 需要调整生成参数'));
  process.exit(0);
}

const levels = LL.LEVELS.filter(function (lv) { return !ONLY || lv.id === ONLY; });
console.log('每关模拟 ' + RUNS + ' 局（贪心玩家），共 ' + levels.length + ' 关\n');
console.log('关卡  名称        颜色 步数 目标                        胜率   平均剩余步  得分P20/P55/P85        建议二星/三星');

const advice = [];
for (let li = 0; li < levels.length; li++) {
  const lv = levels[li];
  const wins = [], all = [];
  let winCount = 0, movesLeftSum = 0;
  for (let i = 0; i < RUNS; i++) {
    const r = playGame(lv, 1000 + li * 7919 + i * 13);
    all.push(r.score);
    if (r.win) { winCount++; wins.push(r.score); movesLeftSum += r.movesLeft; }
  }
  wins.sort(function (a, b) { return a - b; });
  all.sort(function (a, b) { return a - b; });
  const winRate = winCount / RUNS;
  const objText = lv.objectives.map(function (o) {
    if (o.type === 'score') return '分数' + o.target;
    if (o.type === 'collect') return '收集' + CFG.TILE_INFO[o.color].name + '×' + o.count;
    return '清障×' + o.count;
  }).join('+');
  /* 二星约四成胜局可达、三星约前两成胜局可达 */
  const p20 = percentile(wins, 0.20), p55 = percentile(wins, 0.50), p85 = percentile(wins, 0.80);
  const s2 = Math.round(p55 / 100) * 100, s3 = Math.round(p85 / 100) * 100;
  advice.push({ id: lv.id, winRate: winRate, s2: s2, s3: s3, p20: p20 });
  console.log(
    String(lv.id).padStart(3) + '   ' +
    (LL.I18N ? '' : '') + lv.name.padEnd(10, '　') + ' ' +
    String(lv.colors) + '   ' + String(lv.moves).padStart(2) + '   ' +
    objText.padEnd(26, ' ') + ' ' +
    (winRate * 100).toFixed(1).padStart(5) + '%  ' +
    (winCount ? (movesLeftSum / winCount).toFixed(1).padStart(6) : '   -  ') + '     ' +
    String(p20).padStart(6) + '/' + String(p55).padStart(6) + '/' + String(p85).padStart(6) + '   ' +
    String(s2).padStart(6) + '/' + String(s3).padStart(6)
  );
}

/* 胜率体检 */
const bad = advice.filter(function (a) { return a.winRate < 0.35 || a.winRate > 0.995; });
console.log('\n' + '─'.repeat(100));
if (bad.length) {
  console.log('需要调整的关卡（胜率 <35% 太难，或 ≈100% 太易）：');
  bad.forEach(function (a) { console.log('  第 ' + a.id + ' 关：胜率 ' + (a.winRate * 100).toFixed(1) + '%'); });
} else {
  console.log('全部关卡胜率落在合理区间（35% ~ 100%）。');
}
console.log('\n建议星级阈值（可直接回填 levels.js 的 stars 字段，格式 [par, 二星, 三星]）：');
advice.forEach(function (a) {
  console.log('  { id: ' + String(a.id).padStart(2) + ', stars: [' + a.p20 + ', ' + a.s2 + ', ' + a.s3 + '] },');
});
