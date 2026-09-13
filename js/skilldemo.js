/* 玲珑消 · skilldemo.js — 技能演示动画（技能说明面板里那个小窗口）
 *
 * 只写文字说明，玩家还是不知道「移山」到底清成什么样、如意锤砸下去会怎样。
 * 这里用真的块精灵 + 迷你棋盘，把四个技能各演一遍：看一遍比读三行字快得多。
 *
 * 与对局渲染完全没有关系：自己的 rAF、自己的迷你粒子、自己的时间轴，
 * 只在说明面板打开时运行——所以**暂停状态下也能动**
 *（对局主循环 Game.update 在 paused 时会直接 return，借不到它的帧）。
 *
 * 每个技能一段 2.8 秒的循环：起手 → 命中 → 余波 → 复位。
 * 播完一轮通过 onCycle 回调通知 UI，由 UI 决定是自动播下一个还是停在玩家选的那个。
 */
(function (global) {
  'use strict';
  const LL = (global.LL = global.LL || {});
  const U = LL.U;
  const CFG = LL.CFG;

  const COLS = 7, ROWS = 5;
  const CYCLE = 2.8;                 /* 一个技能的演示时长（秒） */

  let canvas = null, ctx = null, dpr = 1, W = 0, H = 0;
  let raf = 0, last = 0, t = 0, skill = 'hammer';
  let onCycle = null, cycleFired = false;
  let particles = [];
  const imgs = {};                   /* 精灵缓存：块 / 障碍 / 技能图标 */

  /* ---------------- 迷你棋盘 ---------------- */

  /* 固定种子：每次打开看到的是同一盘，不会因为随机而看不懂在演什么 */
  function rng() {
    let s = 0x2f6e2b1;
    return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }

  function makeGrid(fill) {
    const rnd = rng();
    const g = [];
    for (let r = 0; r < ROWS; r++) {
      const row = [];
      for (let c = 0; c < COLS; c++) row.push(fill ? fill(r, c, rnd) : ((rnd() * 4) | 0));
      g.push(row);
    }
    return g;
  }

  /* 每个技能的初始盘面：要让「这一下会发生什么」一眼看出来 */
  const SCENES = {
    hammer: function () {
      return {
        grid: makeGrid(function (r, c, rnd) { return (r + c + ((rnd() * 2) | 0)) % 4; }),
        target: { r: 2, c: 3 },
        lock: { r: 2, c: 3 },        /* 目标格压着一个石锁：破障 2 点的意义在这儿 */
        cleared: {},                 /* 已消失的格 key -> 进度 */
        falling: null
      };
    },
    cross: function () {
      return {
        grid: makeGrid(function (r, c, rnd) { return (r * 2 + c + ((rnd() * 2) | 0)) % 4; }),
        target: { r: 2, c: 3 },
        cleared: {},
        falling: null
      };
    },
    color: function () {
      /* 第 2 行摆成 玉 灯 玉：中间那格换成同色就成三连 */
      const g = makeGrid(function (r, c, rnd) { return (r + c + ((rnd() * 2) | 0)) % 4; });
      g[2][2] = 0; g[2][3] = 1; g[2][4] = 0;
      return { grid: g, target: { r: 2, c: 3 }, painted: 0, cleared: {}, falling: null };
    },
    swap: function () {
      const g = makeGrid(null);
      /* 给每块安排一个打乱后的落点：沿弧线飞过去就是「全盘重排」 */
      const flat = [];
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) flat.push({ r: r, c: c, t: g[r][c] });
      for (let i = flat.length - 1; i > 0; i--) {
        const j = (rng() * (i + 1)) | 0;
        const tmp = flat[i].t; flat[i].t = flat[j].t; flat[j].t = tmp;
      }
      const to = {};
      flat.forEach(function (cell) { to[cell.r + ',' + cell.c] = cell.t; });
      return { grid: g, target: { r: 2, c: 3 }, to: to, cleared: {}, falling: null };
    }
  };

  let scene = null;

  function reset(id) {
    skill = id;
    scene = SCENES[id] ? SCENES[id]() : SCENES.hammer;
    t = 0;
    cycleFired = false;
    particles = [];
  }

  /* ---------------- 精灵 ---------------- */

  function sprite(key) {
    if (imgs[key] !== undefined) return imgs[key];
    imgs[key] = LL.Assets.img(key) || null;
    return imgs[key];
  }

  function tileSprite(t) {
    const info = CFG.TILE_INFO[t];
    return info ? sprite('tile_' + info.id) : null;
  }

  /* ---------------- 绘制工具 ---------------- */

  function cellSize() { return Math.min(H / ROWS, W / COLS); }

  function cellXY(r, c) {
    const s = cellSize();
    const bw = s * COLS, bh = s * ROWS;
    return { x: (W - bw) / 2 + (c + 0.5) * s, y: (H - bh) / 2 + (r + 0.5) * s, s: s };
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    const rr = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function drawTile(x, y, s, colorIdx, opt) {
    opt = opt || {};
    const a = opt.alpha == null ? 1 : opt.alpha;
    if (a <= 0.01) return;
    const sc = opt.scale == null ? 1 : opt.scale;
    const size = s * 0.86 * sc;
    const info = CFG.TILE_INFO[colorIdx] || CFG.TILE_INFO[0];
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(x, y);
    if (opt.rot) ctx.rotate(opt.rot);
    const img = tileSprite(colorIdx);
    if (img && img.complete && img.naturalWidth) {
      ctx.drawImage(img, -size / 2, -size / 2, size, size);
    } else {
      /* 素材没就绪时的降级：同色圆角块，保证演示窗口不会是空的 */
      roundRect(-size / 2, -size / 2, size, size, size * 0.24);
      ctx.fillStyle = info.main;
      ctx.fill();
      ctx.strokeStyle = info.dark;
      ctx.lineWidth = Math.max(1, size * 0.06);
      ctx.stroke();
    }
    if (opt.glow) {
      roundRect(-size / 2, -size / 2, size, size, size * 0.24);
      ctx.strokeStyle = 'rgba(255,246,196,' + (0.85 * opt.glow) + ')';
      ctx.lineWidth = Math.max(2, size * 0.09);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawLock(x, y, s, alpha) {
    const img = sprite('ob_stone');
    const size = s * 0.98;
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    if (img && img.complete && img.naturalWidth) ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
    else {
      roundRect(x - size / 2, y - size / 2, size, size, size * 0.18);
      ctx.strokeStyle = 'rgba(150,142,130,0.95)';
      ctx.lineWidth = Math.max(2, size * 0.13);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawIcon(key, x, y, size, alpha, rot) {
    const img = sprite(key);
    if (!img || !img.complete || !img.naturalWidth) return;
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    ctx.drawImage(img, -size / 2, -size / 2, size, size);
    ctx.restore();
  }

  /* 迷你粒子：命中时的碎屑，数量很小，不进对象池。
   * 用固定种子而不是 Math.random：一来跟项目里其它随机源一样可复现，
   * 二来演示每轮长得一模一样，玩家才能盯着同一段动画看明白。 */
  let fxRnd = U.rng(0x5eed);

  function burst(x, y, n, colors, speed) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + fxRnd() * 0.5;
      const v = speed * (0.5 + fxRnd() * 0.7);
      particles.push({
        x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.25,
        life: 0.42 + fxRnd() * 0.36, age: 0, size: 1.6 + fxRnd() * 2.6,
        color: colors[(fxRnd() * colors.length) | 0]
      });
    }
  }

  function tickParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.age += dt;
      if (p.age >= p.life) { particles.splice(i, 1); continue; }
      p.vy += 260 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  function drawParticles() {
    ctx.save();
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const k = 1 - p.age / p.life;
      ctx.globalAlpha = k;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * k, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /* 高亮描边：告诉玩家「现在动的是这一格/这一行」 */
  function highlight(r, c, k, color) {
    const p = cellXY(r, c);
    const half = p.s * 0.44;
    ctx.save();
    ctx.globalAlpha = Math.min(1, k);
    roundRect(p.x - half, p.y - half, half * 2, half * 2, p.s * 0.24);
    ctx.strokeStyle = color || 'rgba(217,72,60,0.95)';
    ctx.lineWidth = Math.max(2, p.s * 0.08);
    ctx.stroke();
    ctx.restore();
  }

  /* 落子：格子清掉之后上面的块往下补，演示里只做一列一格的补偿，够表达就行 */
  function fallColumn(grid, cleared, col, dt, speed) {
    const order = [];
    for (let r = ROWS - 1; r >= 0; r--) if (!cleared[r + ',' + col]) order.push(r);
    let write = ROWS - 1;
    for (let i = 0; i < order.length; i++) {
      if (order[i] !== write) {
        grid[write][col] = grid[order[i]][col];
        grid[order[i]][col] = null;
      }
      write--;
    }
    for (let r = write; r >= 0; r--) {
      grid[r][col] = null;
      cleared['__spawn_' + r + '_' + col] = 0;   /* 由绘制阶段补新块 */
    }
    return dt * speed;
  }

  /* ---------------- 四个技能的时间轴 ---------------- */

  function drawHammer(dt) {
    const p = cellXY(scene.target.r, scene.target.c);
    const hit = U.clamp((t - 0.75) / 0.2, 0, 1);

    drawBoardBase(dt);
    /* 目标格：石锁 + 起手呼吸 */
    if (hit <= 0) {
      drawLock(p.x, p.y, p.s, 1);
      highlight(scene.target.r, scene.target.c, 0.4 + 0.6 * Math.sin(t * 12), 'rgba(217,72,60,0.95)');
    }
    if (hit > 0 && hit < 0.55) drawLock(p.x, p.y, p.s * (1 + hit * 0.55), 1 - hit * 1.8);
    if (hit > 0.35) drawFalling(dt);
    /* 锤影落下 / 白闪裂纹 / 冲击环 + 石屑都交给对局那套特效画——
     * 演示要让人看到"放技能时屏幕上会发生什么"，两边各画一套迟早会走样 */
    LL.FX.drawKind(ctx, 'hammer', fxPhase(0.75), { x: p.x, y: p.y, cell: p.s });
    tickParticles(dt);
    drawParticles();
  }

  function drawCross(dt) {
    const T = scene.target;
    drawBoardBase(dt);
    const aim = U.clamp(t / 0.55, 0, 1);
    const sweep = U.clamp((t - 0.55) / 0.3, 0, 1);
    const hit = U.clamp((t - 0.85) / 0.2, 0, 1);

    if (hit <= 0) {
      highlight(T.r, T.c, 0.4 + 0.6 * Math.sin(t * 12), 'rgba(217,72,60,0.95)');
      /* 十字逐格点亮，像一道扫过去的光 */
      if (t > 0.55) {
        for (let c = 0; c < COLS; c++) {
          const d = Math.abs(c - T.c) / COLS;
          if (sweep > d) highlight(T.r, c, (1 - d) * 0.9, 'rgba(201,162,39,0.95)');
        }
        for (let r = 0; r < ROWS; r++) {
          const d = Math.abs(r - T.r) / ROWS;
          if (sweep > d) highlight(r, T.c, (1 - d) * 0.9, 'rgba(201,162,39,0.95)');
        }
      }
    }
    if (hit > 0) {
      /* 两条光带由 fx.js 的移山来画；这里只留"逐格点亮"的扫光，那是讲清范围的关键 */
      LL.FX.drawKind(ctx, 'cross', fxPhase(0.85), boardRect({
        x: cellXY(T.r, T.c).x, y: cellXY(T.r, T.c).y, cell: p0().s,
        cells: (function () {
          const out = [];
          for (let c = 0; c < COLS; c++) if (c !== T.c) { const q = cellXY(T.r, c); out.push({ x: q.x, y: q.y }); }
          for (let r = 0; r < ROWS; r++) if (r !== T.r) { const q = cellXY(r, T.c); out.push({ x: q.x, y: q.y }); }
          return out;
        })()
      }));
    }
    if (hit > 0.3) drawFalling(dt);
    tickParticles(dt);
    drawParticles();
  }
  function p0() { return cellXY(0, 0); }

  /* 演示的时间轴（秒）→ 特效进度：让特效的命中帧（p=0.3）正落在演示的动作时刻，
   * 之后按 0.7/s 收尾，两边的节奏才对得上 */
  function fxPhase(hitT) {
    if (t < hitT) return U.clamp((t / hitT) * 0.3, 0, 1);
    return U.clamp(0.3 + (t - hitT) * 0.7, 0, 1);
  }

  /* 迷你棋盘的外框（fx.js 的横竖光带要按棋盘尺寸走） */
  function boardRect(o) {
    const s0 = p0();
    o.bx = s0.x - s0.s / 2;
    o.by = s0.y - s0.s / 2;
    o.w = s0.s * COLS;
    o.h = s0.s * ROWS;
    return o;
  }

  /* 只取特效的后半段：演示里的"选色飞入""整盘飞位"本身就是教学内容，
   * 让特效前段（飞入的光点、化墨的黑罩）盖上去，反而把要讲的东西遮了 */
  function fxTail(kind, from, hitT, o) {
    const p = fxPhase(hitT);
    if (p >= from) LL.FX.drawKind(ctx, kind, p, o);
  }

  function drawColor(dt) {
    const T = scene.target;
    drawBoardBase(dt);
    const pick = U.clamp((t - 0.6) / 0.5, 0, 1);      /* 颜色飞入 */
    const match = U.clamp((t - 1.15) / 0.3, 0, 1);     /* 三连消除 */
    const paint = U.clamp((t - 0.95) / 0.25, 0, 1);    /* 变色进度 */

    /* 第 2 行: 玉 灯 玉 —— 中间那格是「就差这一块」 */
    if (match <= 0) highlight(T.r, T.c, 0.4 + 0.6 * Math.sin(t * 12), 'rgba(217,72,60,0.95)');

    /* 选色环：候选画的是**块图标本身**，不是纯色点。
     * 玩家认的是「莲花 / 铜钱」，不是「粉色 / 黄色」——图标自带轮廓，跟棋盘上的东西一一对应，
     * 一看就知道「选它会把格子变成什么样」。 */
    if (t > 0.35 && match <= 0) {
      const colors = [0, 1, 2];
      const cw = H * 0.2;
      const total = colors.length * cw + (colors.length - 1) * cw * 0.4;
      const y = H - cw * 0.62;
      colors.forEach(function (ci, i) {
        const x = (W - total) / 2 + i * cw * 1.4 + cw / 2;
        const chosen = ci === 0;
        const k = chosen ? U.clamp((t - 0.45) / 0.3, 0, 1) : 0.45;
        ctx.save();
        ctx.globalAlpha = k;
        if (chosen) {
          ctx.beginPath();
          ctx.arc(x, y, cw * 0.55, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255,246,214,0.9)';
          ctx.fill();
          ctx.strokeStyle = '#C9A227';
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }
        ctx.restore();
        drawTile(x, y, cw, ci, { alpha: k, scale: chosen ? 1 : 0.88 });
        /* 选中的那一块飞向目标格：整块图标飞过去，不是一团颜色 */
        if (chosen && pick > 0 && pick < 1) {
          const p = cellXY(T.r, T.c);
          drawTile(U.lerp(x, p.x, U.easeOutCubic(pick)), U.lerp(y, p.y, U.easeOutCubic(pick)),
            cw * 0.9, 0, { alpha: 0.92 });
        }
      });
    }

    /* 变色：灯 → 玉 的十字淡入 */
    if (paint > 0 && match <= 0) {
      const p = cellXY(T.r, T.c);
      const size = p.s * 0.86;
      drawTile(p.x, p.y, p.s, 1, { alpha: 1 - paint });      /* 旧色淡出 */
      drawTile(p.x, p.y, p.s, 0, { alpha: paint });          /* 新色淡入 */
      if (paint > 0 && paint < 0.3) burst(p.x, p.y, 8, [CFG.TILE_INFO[0].light, '#ffffff'], 90);
    }
    if (match > 0 && match < 0.6) {
      if (particles.length < 3) {
        for (let c = 2; c <= 4; c++) { const q = cellXY(2, c); burst(q.x, q.y, 6, [CFG.TILE_INFO[0].light, CFG.TILE_INFO[0].main], 110); }
      }
    }
    if (match > 0.4) drawFalling(dt);
    /* 定色那一下的彩墨绽开与金环来自对局特效；只取后半段，
     * 因为前段"飞入的光点"会和这里"整块图标飞过去"的画法重样 */
    const tp = cellXY(T.r, T.c);
    fxTail('color', 0.3, 0.95, { x: tp.x, y: tp.y, cell: tp.s, color: CFG.TILE_INFO[0].main });
    tickParticles(dt);
    drawParticles();
  }

  function drawSwap(dt) {
    const move = U.clamp((t - 0.5) / 1.0, 0, 1);
    const k = U.easeInOutQuad(move);
    const bounce = move > 0 && move < 1 ? Math.sin(move * Math.PI) : 0;

    if (move <= 0) {
      drawBoardBase(dt);
      const a = U.clamp(t / 0.5, 0, 1);
      drawIcon('ui_skill_swap', W / 2, H / 2, Math.min(W, H) * 0.42, a * 0.9, Math.sin(t * 3) * 0.12);
      return;
    }
    /* 全盘重排：每块沿着一条弧线飞到自己的新位置 */
    const s = cellSize();
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const from = cellXY(r, c);
        const toT = scene.to[r + ',' + c];
        const fromT = scene.grid[r][c];
        /* 起点位置：新位置的块从哪来（反向查）——直接用原盘面同格的颜色做起点即可 */
        const px = from.x, py = from.y;
        const q = cellXY(r, c);
        const arc = Math.sin(k * Math.PI) * s * 0.35 * ((r + c) % 2 ? 1 : -1);
        drawTile(px + arc, py - arc, s, move < 0.5 ? fromT : toT, { alpha: 1, scale: 1 + bounce * 0.08, rot: (1 - k) * 0.3 });
        void q;
      }
    }
    /* 收束的金环交给对局特效；**不取前段**——前段是"整盘化墨"的黑罩，
     * 而这里正在教"每块沿弧线飞到新位置"，盖住就白演了 */
    fxTail('swap', 0.58, 1.5, { x: W / 2, y: H / 2, cell: cellSize() });
    tickParticles(dt);
    drawParticles();
  }

  /* 通用底：画出所有还在场上的块 */
  function drawBoardBase(dt) {
    const s = cellSize();
    const cleared = scene.cleared;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const key = r + ',' + c;
        if (cleared[key] != null) continue;
        const t2 = scene.grid[r][c];
        if (t2 == null) continue;
        const p = cellXY(r, c);
        const fade = cleared[key];
        drawTile(p.x, p.y, s, t2, { alpha: fade == null ? 1 : fade });
      }
    }
    /* 正在补位的空格：画一个淡淡的底槽，避免出现「洞」 */
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = 'rgba(122,92,52,0.22)';
    ctx.lineWidth = 1;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (scene.grid[r][c] != null) continue;
        const p = cellXY(r, c);
        roundRect(p.x - s * 0.43, p.y - s * 0.43, s * 0.86, s * 0.86, s * 0.2);
        ctx.stroke();
        void dt;
      }
    }
    ctx.restore();
  }

  /* 补位：把空列压实并让块落下来，然后复位到「已经填满」的稳定态 */
  function drawFalling(dt) {
    const cleared = scene.cleared;
    const s = cellSize();
    for (let c = 0; c < COLS; c++) fallColumn(scene.grid, cleared, c, dt, 1);
    /* 新块从上方落下：这里用从上一个位置滑入的近似，视觉上够用 */
    for (const key in cleared) {
      if (key.indexOf('__spawn_') === 0) {
        const parts = key.split('_');
        const r = parseInt(parts[2], 10), c = parseInt(parts[3], 10);
        const p = cellXY(r, c);
        if (scene.grid[r][c] == null) scene.grid[r][c] = ((r * 3 + c * 5) % 4);
        drawTile(p.x, p.y - s * 0.6, s, scene.grid[r][c], { alpha: 0.9 });
        delete cleared[key];
      }
    }
    for (const k in cleared) delete cleared[k];
    void s;
  }

  const RENDER = { hammer: drawHammer, cross: drawCross, color: drawColor, swap: drawSwap };

  /* ---------------- 主循环 ---------------- */

  function resize() {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(2.5, global.devicePixelRatio || 1);
    W = Math.max(120, Math.round(rect.width));
    H = Math.max(70, Math.round(rect.height));
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function frame(now) {
    raf = global.requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    t += dt;
    if (t >= CYCLE) {
      if (!cycleFired) {
        cycleFired = true;
        if (onCycle) onCycle(skill);
      }
      reset(skill);
      return;
    }
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    const fn = RENDER[skill] || drawHammer;
    /* 命中时的轻微震屏：只在演示窗口里抖，不涉及对局 */
    const shake = (skill === 'hammer' && t > 0.75 && t < 0.95) ||
                  (skill === 'cross' && t > 0.85 && t < 1.1) ? 1 : 0;
    ctx.save();
    if (shake) ctx.translate((fxRnd() - 0.5) * 4, (fxRnd() - 0.5) * 4);
    fn(dt);
    ctx.restore();
  }

  const SkillDemo = {
    CYCLE: CYCLE,

    /* 打开演示：canvas 由调用方给，onCycle 在一轮播完时回调。
     * 顺序要紧：close() 会把 ctx 置空（表示「已停」），所以必须先 close 再 resize
     * ——resize() 才是取回 ctx 的地方。反过来的话帧循环会一直空转、什么都没画出来。 */
    open(cv, id, cb) {
      this.close();
      canvas = cv;
      onCycle = cb || null;
      resize();
      reset(id || 'hammer');
      last = (global.performance && performance.now) ? performance.now() : Date.now();
      raf = global.requestAnimationFrame(frame);
      return true;
    },

    /* 换一个技能演（会从头播） */
    show(id) {
      if (!canvas) return false;
      reset(id);
      last = (global.performance && performance.now) ? performance.now() : Date.now();
      return true;
    },

    close() {
      if (raf) global.cancelAnimationFrame(raf);
      raf = 0;
      ctx = null;
    },

    current() { return skill; },
    isRunning() { return !!raf; },
    resize: resize
  };

  LL.SkillDemo = SkillDemo;
})(typeof globalThis !== 'undefined' ? globalThis : this);
