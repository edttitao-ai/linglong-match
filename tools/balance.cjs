/* 玲珑消 · tools/balance.cjs — 关卡平衡验证
 *
 *   node tools/balance.cjs                 每关 200 局
 *   node tools/balance.cjs --runs=600      自定义局数
 *   node tools/balance.cjs --level=15      只看某一关（详细输出）
 *   node tools/balance.cjs --skills        局内技能（灵力）回归：对比开技能前后的胜率
 *   node tools/balance.cjs --skills=max    收益上界：灵力一律砸在最贵的移山上
 *
 * 用一个「贪心玩家」模拟真实打法：优先选能完成当前目标、能生成特殊块、
 * 能引爆特殊块、能破障的走法，并在同分走法间随机。统计胜率与得分分布，
 * 给出二星 / 三星分数建议值。
 */
'use strict';
const path = require('path');

['util.js', 'config.js', 'board.js', 'special.js', 'resolver.js', 'skills.js', 'levels.js', 'daily.js', 'modes.js'].forEach(function (f) {
  require(path.join(__dirname, '..', 'js', f));
});
const LL = globalThis.LL;
const U = LL.U, B = LL.Board, SP = LL.Special, R = LL.Resolver, CFG = LL.CFG, SK = LL.Skills;
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

/* 用 --weaken=N 模拟「手比较生的玩家」：N% 的走法随机下，
 * 用来回答真正的问题——技能能不能把快要流失的玩家救回来。 */
const WEAKEN = (getArg('weaken', 0) || 0) / 100;

function chooseMove(b, level, rnd) {
  const moves = B.findAllMoves(b, 0);
  if (!moves.length) return null;
  if (WEAKEN > 0 && rnd() < WEAKEN) return moves[(rnd() * moves.length) | 0];
  let best = null, bestScore = -Infinity;
  for (let i = 0; i < moves.length; i++) {
    const sc = scoreMove(b, moves[i], level, rnd);
    if (sc > bestScore) { bestScore = sc; best = moves[i]; }
  }
  return best;
}

/* ---------- 单局模拟 ---------- */

const SKILL_ARG = args.find(function (a) { return a.indexOf('--skills') === 0; });
const SKILL_MODE = !!SKILL_ARG;                       /* --skills 或 --skills=max */
const SKILL_MAX = SKILL_ARG === '--skills=max';       /* 上界：只放最贵的移山 */

/* 技能的「最值钱目标格」：看它覆盖到的障碍 / 目标色 / 特殊块有多少 */
function skillTarget(b, level, id, rnd) {
  let best = null, bestV = -1;
  for (let r = 0; r < b.R; r++) {
    for (let c = 0; c < b.C; c++) {
      if (!SK.validTarget(b, { r: r, c: c }, id)) continue;
      let v = 0;
      if (id === 'cross') {
        for (let cc = 0; cc < b.C; cc++) v += cellValue(b, level, r, cc);
        for (let rr = 0; rr < b.R; rr++) v += cellValue(b, level, rr, c);
      } else {
        v += cellValue(b, level, r, c);
      }
      v += rnd() * 4;                       /* 同分随机，避免每次砸同一格 */
      if (v > bestV) { bestV = v; best = { r: r, c: c }; }
    }
  }
  return best;
}

function cellValue(b, level, r, c) {
  let v = 0;
  const tl = b.cells[r][c];
  if (b.obst[r][c]) v += 4;
  if (tl && tl.s !== S.NONE) v += 3;
  if (tl) {
    for (let i = 0; i < level.objectives.length; i++) {
      const o = level.objectives[i];
      if (o.type === 'collect' && o.color === tl.t) v += 3;
    }
  }
  return v;
}

/* 目标完成度（0~1）：技能该不该出手，取决于「进度是不是落后于步数」 */
function progressRatio(level, score, cleared, collected) {
  const objs = level.objectives || [];
  if (!objs.length) return 1;
  let sum = 0;
  for (let i = 0; i < objs.length; i++) {
    const o = objs[i];
    let cur = 0, tgt = 1;
    if (o.type === 'score') { cur = score; tgt = o.target; }
    else if (o.type === 'collect') { cur = collected[o.color] || 0; tgt = o.count; }
    else { cur = cleared; tgt = o.count || level.clearTotal || 1; }
    sum += tgt > 0 ? Math.min(1, cur / tgt) : 1;
  }
  return sum / objs.length;
}

/* 一局的技能策略：返回 { id, cell, color } 或 null
 *
 * 真实玩家的用法是「落后了才出手」，不是「攒够就放」——
 * 只有进度明显落后于已用步数时才花灵力，所以它主要是把「本来要输的局」救回来，
 * 而不是把「本来能赢的局」提前结束（后者会让通关分变低、三星反而更难）。 */
function pickSkill(b, level, st, rnd) {
  if (!st.on) return null;
  const qi = st.qi;

  /* 盘面已无解：换天免费，白捡 */
  if (!B.hasValidMove(b)) return { id: 'swap', cell: null };

  /* 上界模式：不管落后与否，够移山就砸（最坏情况，用来测难度天花板） */
  if (SKILL_MAX) {
    if (qi < CFG.SKILLS.cross.cost) return null;
    const cell = skillTarget(b, level, 'cross', rnd);
    return cell ? { id: 'cross', cell: cell } : null;
  }

  if (!st.behind) return null;     /* 进度不落后就不动灵力 */

  /* 收集目标还差得远：用灵犀一点把一格改成目标色 */
  if (qi >= CFG.SKILLS.color.cost) {
    for (let i = 0; i < level.objectives.length; i++) {
      const o = level.objectives[i];
      if (o.type !== 'collect') continue;
      const cur = st.collected[o.color] || 0;
      if (cur >= o.count * 0.6) continue;
      const cell = anyPlainCell(b, rnd);
      if (cell) return { id: 'color', cell: cell, color: o.color };
      break;
    }
  }
  /* 障碍还多 / 局面吃紧：移山或如意锤砸最值钱的一格 */
  if (qi >= CFG.SKILLS.cross.cost) {
    const cell = skillTarget(b, level, 'cross', rnd);
    if (cell) return { id: 'cross', cell: cell };
  }
  if (qi >= CFG.SKILLS.hammer.cost) {
    const cell = skillTarget(b, level, 'hammer', rnd);
    if (cell) return { id: 'hammer', cell: cell };
  }
  return null;
}

function anyPlainCell(b, rnd) {
  for (let t = 0; t < 40; t++) {
    const r = (rnd() * b.R) | 0, c = (rnd() * b.C) | 0;
    if (SK.validTarget(b, { r: r, c: c }, 'color')) return { r: r, c: c };
  }
  return null;
}

/* 释放技能并跑完整个回合（技能不吃步数，所以只加消除不扣 moves） */
function castSkill(rs, b, plan, level, st) {
  if (plan.id === 'color') {
    if (!SK.recolor(b, plan.cell, plan.color)) return false;
    R.beginScan(rs);
  } else {
    if (!R.beginSkill(rs, SK.plan(b, plan.id, plan.cell)).ok) return false;
  }
  let ev, guard = 0;
  while ((ev = R.step(rs)) && guard++ < 500) {
    if (ev.kind === 'clear') {
      st.score += ev.score;
      st.qi = SK.addQi(st.qi, SK.gain(ev, SK.gainMult(st.moves, !!level.timed))).qi;
      for (let j = 0; j < ev.cells.length; j++) {
        if (ev.cells[j].t >= 0) st.collected[ev.cells[j].t] = (st.collected[ev.cells[j].t] || 0) + 1;
      }
      for (let j = 0; j < ev.obstacles.length; j++) if (ev.obstacles[j].broken) st.obstCleared++;
    }
    if (ev.kind === 'turnEnd') break;
  }
  return true;
}

function playGame(level, seed, useSkills) {
  const rnd = U.rng(seed);
  const b = B.create({ colors: level.colors, layout: level.layout, rnd: rnd });
  const rs = R.create(b);
  const collected = {};
  let obstCleared = 0, score = 0, moves = level.moves, maxCascade = 0, guard = 0;
  /* 灵力账户：技能是净增益，所以要单独记账（见 README「局内技能」）
   * useSkills 默认跟随命令行开关，对比回归时会显式传 false / true。 */
  const st = {
    qi: SK.qiStartFor(level), score: 0, collected: collected, obstCleared: 0,
    moves: moves, skills: 0, on: useSkills == null ? SKILL_MODE : !!useSkills
  };

  function done() {
    /* 技能清掉的障碍与分数也要算进目标，否则清障关会被判成永远打不完 */
    const cleared = obstCleared + st.obstCleared;
    const total = score + st.score;
    return level.objectives.every(function (o) {
      if (o.type === 'score') return total >= o.target;
      if (o.type === 'collect') return (collected[o.color] || 0) >= o.count;
      return cleared >= (o.count || level.clearTotal || 0);
    });
  }

  while (moves > 0 && !done() && guard++ < 400) {
    st.moves = moves;
    /* 「落后」= 目标完成度明显低于已消耗的步数比例 */
    st.progress = progressRatio(level, score + st.score, obstCleared + st.obstCleared, collected);
    st.behind = st.progress + 0.12 < 1 - moves / level.moves;
    const cast = pickSkill(b, level, st, rnd);
    if (cast) {
      const cost = SK.cost(b, cast.id);
      if (cost <= st.qi && castSkill(rs, b, cast, level, st)) {
        st.qi -= cost;
        st.skills++;
        continue;                     /* 技能不吃步数 */
      }
    }
    const mv = chooseMove(b, level, rnd);
    if (!mv) { R.shuffle(rs); if (!B.hasValidMove(b)) break; continue; }
    const res = R.runTurn(rs, mv.a, mv.b);
    if (!res.ok) continue;
    moves--;
    for (let i = 0; i < res.events.length; i++) {
      const ev = res.events[i];
      if (ev.kind !== 'clear') continue;
      score += ev.score;
      st.qi = SK.addQi(st.qi, SK.gain(ev, SK.gainMult(moves, !!level.timed))).qi;
      for (let j = 0; j < ev.cells.length; j++) if (ev.cells[j].t >= 0) collected[ev.cells[j].t] = (collected[ev.cells[j].t] || 0) + 1;
      for (let j = 0; j < ev.obstacles.length; j++) if (ev.obstacles[j].broken) obstCleared++;
      if (ev.cascade > maxCascade) maxCascade = ev.cascade;
    }
    if (!B.hasValidMove(b)) { R.shuffle(rs); if (!B.hasValidMove(b)) break; }
  }

  const win = done();
  const total = score + st.score;
  const fullScore = win ? total + moves * CFG.SCORE_MOVE_LEFT : total;
  return { win: win, score: fullScore, rawScore: total, movesLeft: moves, cleared: obstCleared + st.obstCleared, maxCascade: maxCascade, skills: st.skills };
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

/* ---------- 局内技能（灵力）回归 ----------
 * node tools/balance.cjs --skills        「会用技能的贪心玩家」
 * node tools/balance.cjs --skills=max    收益上界：灵力一律砸在最贵的移山上
 *
 * 技能不消耗步数，所以它只增不减胜率。这里要确认两件事：
 *   1. 低胜率关卡被抬起来（让「难度过大」不再是劝退点）；
 *   2. 没有任何关卡越过「太简单」红线——难度没有塌陷。
 * 同一个种子跑两遍（关技能 / 开技能），逐关对比，排除运气干扰。 */
if (SKILL_MODE) {
  const before = [], after = [];
  const lvList = LL.LEVELS;
  for (let li = 0; li < lvList.length; li++) {
    const lv = lvList[li];
    let w0 = 0, w1 = 0, s0 = 0, s1 = 0, skillSum = 0, score0 = 0, score1 = 0, mv0 = 0, mv1 = 0;
    for (let i = 0; i < RUNS; i++) {
      const seed = 1000 + li * 7919 + i * 13;
      const r0 = playGame(lv, seed, false);
      if (r0.win) w0++;
      if (r0.score >= lv.stars[2]) s0++;
      score0 += r0.score; mv0 += r0.movesLeft;
      const r1 = playGame(lv, seed, true);
      if (r1.win) w1++;
      if (r1.score >= lv.stars[2]) s1++;
      score1 += r1.score; mv1 += r1.movesLeft;
      skillSum += r1.skills;
    }
    before.push({ id: lv.id, win: w0 / RUNS, three: s0 / RUNS, score: score0 / RUNS, mv: mv0 / RUNS });
    after.push({ id: lv.id, win: w1 / RUNS, three: s1 / RUNS, score: score1 / RUNS, mv: mv1 / RUNS, skills: skillSum / RUNS });
  }
  console.log('局内技能回归（每关 ' + RUNS + ' 局，同种子对照）' + (SKILL_MAX ? ' · 上界模式：灵力全砸移山' : ' · 策略模式：会用技能') + '\n');
  console.log('关卡  胜率(无→有)      变化     三星率(无→有)  平均分(无→有)       剩余步(无→有)  放技能');
  let tooEasy = [], rescued = 0;
  for (let i = 0; i < before.length; i++) {
    const b0 = before[i], a0 = after[i];
    const d = a0.win - b0.win;
    if (a0.win > 0.995 && b0.win <= 0.995) tooEasy.push(a0.id);
    if (b0.win < 0.5 && a0.win >= 0.5) rescued++;
    console.log(
      String(b0.id).padStart(3) + '   ' +
      ((b0.win * 100).toFixed(0) + '%→' + (a0.win * 100).toFixed(0) + '%').padStart(11) + '  ' +
      ((d >= 0 ? '+' : '') + (d * 100).toFixed(1)).padStart(8) + 'pt  ' +
      ((b0.three * 100).toFixed(0) + '%→' + (a0.three * 100).toFixed(0) + '%').padStart(11) + '  ' +
      ((b0.score / 1000).toFixed(1) + 'k→' + (a0.score / 1000).toFixed(1) + 'k').padStart(12) + '  ' +
      ((b0.mv.toFixed(1) + '→' + a0.mv.toFixed(1))).padStart(11) + '  ' +
      a0.skills.toFixed(1).padStart(5)
    );
  }
  const avg0 = before.reduce(function (a, x) { return a + x.win; }, 0) / before.length;
  const avg1 = after.reduce(function (a, x) { return a + x.win; }, 0) / after.length;
  console.log('\n平均胜率 ' + (avg0 * 100).toFixed(1) + '% → ' + (avg1 * 100).toFixed(1) + '%');
  console.log('原本偏难（<50%）被救回 50% 以上的关卡：' + rescued + ' 关');
  console.log('技能让难度塌陷（跨过 99.5% 红线）的关卡：' + (tooEasy.length ? tooEasy.join(' / ') : '无 ✓'));
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
