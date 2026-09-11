/* 玲珑消 · render.js — Canvas 绘制层
 * 负责：宣纸棋盘底、格位、块精灵（缺素材时程序化降级）、特殊块徽记、
 *       障碍覆盖、选中/提示高亮、粒子、飘字、闪白与震屏、调试面板。
 */
(function (global) {
  'use strict';
  const LL = (global.LL = global.LL || {});
  const CFG = LL.CFG;
  const U = LL.U;
  const S = CFG.SPECIAL;
  const O = CFG.OBST;
  const A = LL.Assets;
  const Anim = LL.Anim;

  const FONT = '"KaiTi","STKaiti","Kaiti SC","Noto Serif SC","Songti SC",serif';

  const Render = {
    canvas: null,
    ctx: null,
    dpr: 1,
    W: 0, H: 0,
    bottomInset: 0,
    geom: { board: 0, cell: 0, bx: 0, by: 0 },
    time: 0,
    _fps: 0,
    _frames: 0,
    _fpsT: 0,
    debug: false,
    boardSuppress: null,

    init(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.debug = /[?&]debug=1/.test(global.location ? global.location.search : '');
      this.resize();
      const self = this;
      if (typeof global.addEventListener !== 'undefined') {
        global.addEventListener('resize', function () { self.resize(); });
        global.addEventListener('orientationchange', function () { setTimeout(function () { self.resize(); }, 120); });
      }
    },

    resize() {
      if (!this.canvas) return;
      const parent = this.canvas.parentElement;
      const rect = parent ? parent.getBoundingClientRect() : { width: global.innerWidth, height: global.innerHeight };
      const w = Math.max(240, Math.floor(rect.width));
      const h = Math.max(240, Math.floor(rect.height));
      this.dpr = Math.min(2.5, global.devicePixelRatio || 1);
      this.W = w;
      this.H = h;
      this.canvas.width = Math.floor(w * this.dpr);
      this.canvas.height = Math.floor(h * this.dpr);
      this.canvas.style.width = w + 'px';
      this.canvas.style.height = h + 'px';
      this.layout();
    },

    layout() {
      /* 棋盘占较短边的 78%，四周留出装饰外框的位置；
       * 底部技能栏（bottomInset）会占掉一条，尺寸与居中都要避开它。
       * inset 为 0 时与原公式完全一致。 */
      const inset = this.bottomInset || 0;
      const short = Math.min(this.W, Math.max(160, this.H - inset));
      const board = Math.max(160, Math.floor(short * 0.78));
      const cell = board / CFG.COLS;
      this.geom = {
        board: cell * CFG.ROWS,
        cell: cell,
        bx: Math.round((this.W - cell * CFG.COLS) / 2),
        by: Math.round(Math.max(2, (this.H - inset - cell * CFG.ROWS) / 2))
      };
    },

    /* 底部保留区（技能栏高度）：技能栏是 DOM，棋盘是画布，只有把高度告诉渲染层
     * 才能保证最后一行不被盖住。值真的变了才重排，避免每帧抖动。 */
    setBottomInset(px) {
      const v = Math.max(0, Math.round(px || 0));
      if (v === this.bottomInset) return;
      this.bottomInset = v;
      this.layout();
    },

    cellXY(r, c) {
      const g = this.geom;
      return { x: g.bx + (c + 0.5) * g.cell, y: g.by + (r + 0.5) * g.cell };
    },

    pointToCell(x, y) {
      const g = this.geom;
      const c = Math.floor((x - g.bx) / g.cell);
      const r = Math.floor((y - g.by) / g.cell);
      if (r < 0 || r >= CFG.ROWS || c < 0 || c >= CFG.COLS) return null;
      return { r: r, c: c };
    },

    rectOf(r, c) {
      const g = this.geom;
      return { x: g.bx + c * g.cell, y: g.by + r * g.cell, w: g.cell, h: g.cell };
    },

    /* ================= 主绘制 ================= */

    draw(view) {
      const ctx = this.ctx;
      if (!ctx) return;
      this.time += 1 / 60;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, this.W, this.H);
      if (!view || !view.board) return;

      const shakeX = (Math.random() - 0.5) * Anim.shake * 22;
      const shakeY = (Math.random() - 0.5) * Anim.shake * 22;
      ctx.save();
      ctx.translate(shakeX, shakeY);

      this.drawPanel(ctx);
      this.drawFrame(ctx);
      this.drawWells(ctx);

      const cur = Anim.cur;
      const p = Anim.progress();
      ctx.save();
      ctx.beginPath();
      ctx.rect(this.geom.bx - 2, this.geom.by - 2, this.geom.board + 4, this.geom.board + 4);
      ctx.clip();
      this.drawTiles(ctx, view, cur, p);
      ctx.restore();

      this.drawObstacles(ctx, view.board, cur, p);
      this.drawHints(ctx, view, cur);
      this.drawParticles(ctx);
      this.drawTexts(ctx);
      ctx.restore();

      if (Anim.flash > 0) {
        ctx.save();
        ctx.globalAlpha = Anim.flash;
        ctx.fillStyle = '#fffdf5';
        ctx.fillRect(0, 0, this.W, this.H);
        ctx.restore();
      }
      if (this.debug) this.drawDebug(ctx, view);
    },

    drawPanel(ctx) {
      const g = this.geom;
      const r = g.cell * 0.42;
      ctx.save();
      ctx.beginPath();
      this.roundRect(ctx, g.bx - g.cell * 0.3, g.by - g.cell * 0.3, g.board + g.cell * 0.6, g.board + g.cell * 0.6, r);
      const grd = ctx.createLinearGradient(g.bx, g.by, g.bx, g.by + g.board);
      grd.addColorStop(0, 'rgba(255,252,242,0.80)');
      grd.addColorStop(1, 'rgba(246,238,220,0.74)');
      ctx.fillStyle = grd;
      ctx.shadowColor = 'rgba(90,64,32,0.22)';
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 6;
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.strokeStyle = 'rgba(150,110,60,0.28)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    },

    drawFrame(ctx) {
      const img = A.img('board_frame');
      if (!img) return;
      const g = this.geom;
      const m = g.cell * 0.95;
      ctx.save();
      ctx.globalAlpha = 0.95;
      ctx.drawImage(img, g.bx - m, g.by - m, g.board + m * 2, g.board + m * 2);
      ctx.restore();
    },

    drawWells(ctx) {
      const g = this.geom;
      const rr = g.cell * 0.22;
      ctx.save();
      for (let r = 0; r < CFG.ROWS; r++) {
        for (let c = 0; c < CFG.COLS; c++) {
          const rc = this.rectOf(r, c);
          const pad = g.cell * 0.055;
          ctx.beginPath();
          this.roundRect(ctx, rc.x + pad, rc.y + pad, rc.w - pad * 2, rc.h - pad * 2, rr);
          ctx.fillStyle = ((r + c) % 2 === 0) ? 'rgba(140,110,70,0.055)' : 'rgba(140,110,70,0.028)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(140,110,70,0.10)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
      ctx.restore();
    },

    /* ---------- 块 ---------- */

    drawTiles(ctx, view, cur, p) {
      const board = view.board;
      const g = this.geom;
      let swapA = null, swapB = null, revertA = null, revertB = null;
      let falls = null, shuffles = null, shuffleAlpha = 1, spawnedKeys = null;
      if (cur && cur.ev.kind === 'clear') {
        spawnedKeys = new Set();
        cur.ev.spawned.forEach(function (sp) { spawnedKeys.add(sp.r + ':' + sp.c); });
      }
      if (cur) {
        const ev = cur.ev;
        if (ev.kind === 'swap') {
          swapA = ev.a; swapB = ev.b;
        } else if (ev.kind === 'revert') {
          revertA = ev.a; revertB = ev.b;
        } else if (ev.kind === 'fall') {
          falls = new Map();
          const push = function (m) { falls.set(m.toR + ':' + m.col, m); };
          ev.moves.forEach(push);
          ev.spawns.forEach(push);
        } else if (ev.kind === 'shuffle' && !ev.regen) {
          shuffles = new Map();
          ev.moves.forEach(function (m) { shuffles.set(m.toR + ':' + m.toC, m); });
        } else if (ev.kind === 'shuffle' && ev.regen) {
          shuffleAlpha = 1 - U.easeInQuad(p);
        }
      }

      for (let r = 0; r < board.R; r++) {
        for (let c = 0; c < board.C; c++) {
          const key = r + ':' + c;
          const tile = board.cells[r][c];
          const pt = this.cellXY(r, c);

          if (swapA && ((swapA.r === r && swapA.c === c) || (swapB.r === r && swapB.c === c))) {
            const from = (swapA.r === r && swapA.c === c) ? swapB : swapA;
            const fp = this.cellXY(from.r, from.c);
            const tt = U.easeOutQuad(p);
            const sx = U.lerp(fp.x, pt.x, tt), sy = U.lerp(fp.y, pt.y, tt);
            if (tile) this.drawTile(ctx, tile, sx, sy, 1, 1);
            continue;
          }
          if (revertA && ((revertA.r === r && revertA.c === c) || (revertB.r === r && revertB.c === c))) {
            const other = (revertA.r === r && revertA.c === c) ? revertB : revertA;
            const op = this.cellXY(other.r, other.c);
            const k = Math.sin(p * Math.PI) * 0.32;
            if (tile) this.drawTile(ctx, tile, U.lerp(pt.x, op.x, k), U.lerp(pt.y, op.y, k), 1, 1);
            continue;
          }
          if (falls && falls.has(key)) {
            const m = falls.get(key);
            const tt = U.easeOutQuad(p);
            const fromY = this.geom.by + (m.fromR + 0.5) * g.cell;
            const yy = U.lerp(fromY, pt.y, tt);
            const squash = p > 0.82 ? 1 - 0.14 * (1 - (p - 0.82) / 0.18) : 1;
            if (tile) this.drawTile(ctx, tile, pt.x, yy, 1, 1, { scaleY: squash });
            continue;
          }
          if (shuffles && shuffles.has(key)) {
            const m = shuffles.get(key);
            const from = this.cellXY(m.fromR, m.fromC);
            const tt = U.easeInOutQuad(p);
            if (tile) this.drawTile(ctx, tile, U.lerp(from.x, pt.x, tt), U.lerp(from.y, pt.y, tt), 1, 1);
            continue;
          }
          /* 新生成的特殊块由 clear 分支单独弹入，主导航不重复绘制 */
          if (spawnedKeys && spawnedKeys.has(key)) continue;
          if (tile) this.drawTile(ctx, tile, pt.x, pt.y, 1, shuffleAlpha);
        }
      }

      /* 消除中的残影 */
      if (cur && cur.ev.kind === 'clear') {
        const ev = cur.ev;
        const tt = U.easeInQuad(p);
        for (let i = 0; i < ev.cells.length; i++) {
          const cell = ev.cells[i];
          const pt = this.cellXY(cell.r, cell.c);
          const sc = 1 + 0.30 * Math.sin(Math.min(1, p * 1.6) * Math.PI) - 0.55 * tt;
          this.drawTile(ctx, { t: cell.t, s: cell.s }, pt.x, pt.y, Math.max(0, sc), 1 - tt);
        }
        /* 新生成的特殊块弹入 */
        for (let i = 0; i < ev.spawned.length; i++) {
          const sp = ev.spawned[i];
          const pt = this.cellXY(sp.r, sp.c);
          const sc = U.easeOutBack(Math.min(1, p * 1.35));
          this.drawTile(ctx, { t: sp.t, s: sp.s }, pt.x, pt.y, Math.max(0.05, sc), 1);
        }
      }
    },

    /* 单个块（含特殊块徽记）；alpha<1 时半透明；scaleY 用于落地挤压 */
    drawTile(ctx, tile, x, y, scale, alpha, opt) {
      const g = this.geom;
      const size = g.cell * 0.86 * (scale == null ? 1 : scale);
      if (size <= 0.5 || alpha <= 0.02) return;
      opt = opt || {};
      const sy = opt.scaleY || 1;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.translate(x, y);
      if (sy !== 1) ctx.scale(1, sy);

      const info = CFG.TILE_INFO[tile.t];
      const img = (tile.t >= 0 && info) ? A.img('tile_' + info.id) : null;

      if (tile.t < 0) {
        /* 无色的太极底：水墨圆盘 */
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.44, 0, Math.PI * 2);
        const grd = ctx.createRadialGradient(-size * 0.12, -size * 0.14, size * 0.06, 0, 0, size * 0.46);
        grd.addColorStop(0, 'rgba(255,255,255,0.98)');
        grd.addColorStop(1, 'rgba(58,52,44,0.92)');
        ctx.fillStyle = grd;
        ctx.fill();
        ctx.strokeStyle = 'rgba(40,34,28,0.85)';
        ctx.lineWidth = Math.max(1.4, size * 0.035);
        ctx.stroke();
      } else if (img) {
        ctx.drawImage(img, -size / 2, -size / 2, size, size);
      } else {
        this.drawFallbackTile(ctx, tile.t, info, size);
      }

      /* 特殊块徽记 */
      if (tile.s !== S.NONE) this.drawBadge(ctx, tile, size);
      ctx.restore();
    },

    drawBadge(ctx, tile, size) {
      const map = { 1: 'sp_wind_h', 2: 'sp_wind_v', 3: 'sp_thunder', 4: 'sp_taiji' };
      const img = A.img(map[tile.s]);
      const bs = size * (tile.s === S.TAIJI ? 0.92 : 0.72);
      ctx.save();
      if (tile.s === S.TAIJI) {
        ctx.rotate(this.time * 0.9);
      } else {
        const pulse = 1 + 0.05 * Math.sin(this.time * 4.2);
        ctx.scale(pulse, pulse);
      }
      ctx.globalAlpha *= 0.96;
      ctx.shadowColor = tile.s === S.TAIJI ? 'rgba(120,90,200,0.75)' : 'rgba(255,215,120,0.85)';
      ctx.shadowBlur = size * 0.35;
      if (img) {
        ctx.drawImage(img, -bs / 2, -bs / 2, bs, bs);
      } else {
        ctx.fillStyle = '#fff3d0';
        ctx.beginPath();
        ctx.arc(0, 0, bs * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#6b4a1c';
        ctx.font = 'bold ' + Math.round(bs * 0.5) + 'px ' + FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(tile.s === S.TAIJI ? '极' : (tile.s === S.THUNDER ? '雷' : '风'), 0, bs * 0.04);
      }
      ctx.restore();
    },

    /* 素材缺失时的程序化块：圆角方牌 + 中心符号 */
    drawFallbackTile(ctx, t, info, size) {
      const h = size * 0.5;
      ctx.beginPath();
      this.roundRect(ctx, -h, -h, size, size, size * 0.24);
      const grd = ctx.createLinearGradient(-h, -h, h, h);
      grd.addColorStop(0, info.light);
      grd.addColorStop(1, info.main);
      ctx.fillStyle = grd;
      ctx.fill();
      ctx.strokeStyle = info.dark;
      ctx.lineWidth = Math.max(1.5, size * 0.045);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(-size * 0.14, -size * 0.16, size * 0.16, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.42)';
      ctx.fill();
      ctx.fillStyle = info.dark;
      ctx.font = 'bold ' + Math.round(size * 0.42) + 'px ' + FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(info.name.charAt(0), 0, size * 0.03);
    },

    /* ---------- 障碍 ---------- */

    drawObstacles(ctx, board, cur, p) {
      const g = this.geom;
      const clearMap = (cur && cur.ev.kind === 'clear') ? (function () {
        const m = new Map();
        cur.ev.obstacles.forEach(function (o) { m.set(o.r + ':' + o.c, o); });
        return m;
      })() : null;

      for (let r = 0; r < board.R; r++) {
        for (let c = 0; c < board.C; c++) {
          const ob = board.obst[r][c];
          const rc = this.rectOf(r, c);
          const key = r + ':' + c;
          const hit = clearMap && clearMap.get(key);
          if (!ob && !hit) continue;
          const kind = ob ? ob.k : hit.k;
          const hp = ob ? ob.hp : 0;
          let alpha = 1;
          let scale = 1;
          if (hit && hit.broken && !ob) {
            /* 刚被破除：放大淡出 */
            scale = 1 + 0.35 * U.easeOutCubic(p);
            alpha = 1 - U.easeOutQuad(p);
          } else if (hit && !hit.broken) {
            /* 掉了 1 层：闪一下 */
            alpha = 1 - 0.35 * Math.sin(p * Math.PI);
          }
          const imgKey = kind === O.FROST ? 'ob_frost' : (kind === O.STONE ? 'ob_stone' : 'ob_vine');
          const img = A.img(imgKey);
          ctx.save();
          ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
          ctx.translate(rc.x + rc.w / 2, rc.y + rc.h / 2);
          ctx.scale(scale, scale);
          const s = g.cell * 1.0;
          if (img) {
            ctx.drawImage(img, -s / 2, -s / 2, s, s);
          } else {
            this.drawFallbackObstacle(ctx, kind, s, hp);
          }
          if (kind === O.STONE && hp === 1 && ob) {
            /* 已受损的石锁：加一道裂纹 */
            ctx.strokeStyle = 'rgba(60,50,40,0.55)';
            ctx.lineWidth = Math.max(1.2, s * 0.03);
            ctx.beginPath();
            ctx.moveTo(-s * 0.12, -s * 0.34);
            ctx.lineTo(s * 0.06, -s * 0.06);
            ctx.lineTo(-s * 0.08, s * 0.12);
            ctx.lineTo(s * 0.10, s * 0.34);
            ctx.stroke();
          }
          ctx.restore();
        }
      }
    },

    drawFallbackObstacle(ctx, kind, s, hp) {
      const h = s * 0.46;
      if (kind === O.FROST) {
        ctx.beginPath();
        this.roundRect(ctx, -h, -h, s * 0.92, s * 0.92, s * 0.16);
        ctx.fillStyle = 'rgba(198,232,246,0.62)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = Math.max(1.4, s * 0.035);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(120,170,200,0.6)';
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.moveTo(i * s * 0.22, -h * 0.75);
          ctx.lineTo(i * s * 0.22 + s * 0.06, h * 0.75);
          ctx.stroke();
        }
      } else if (kind === O.STONE) {
        ctx.beginPath();
        this.roundRect(ctx, -h, -h, s * 0.92, s * 0.92, s * 0.14);
        ctx.fillStyle = 'rgba(112,104,96,0.9)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(58,50,44,0.9)';
        ctx.lineWidth = Math.max(1.6, s * 0.04);
        ctx.stroke();
        ctx.fillStyle = 'rgba(230,226,216,0.85)';
        const d = s * 0.3;
        [[-d, -d], [d, -d], [-d, d], [d, d]].forEach(function (pt) {
          ctx.beginPath();
          ctx.arc(pt[0], pt[1], s * 0.055, 0, Math.PI * 2);
          ctx.fill();
        });
      } else {
        ctx.strokeStyle = 'rgba(60,110,58,0.92)';
        ctx.lineWidth = Math.max(2.4, s * 0.075);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-h, -h * 0.5);
        ctx.quadraticCurveTo(0, h * 0.1, h, -h * 0.45);
        ctx.moveTo(-h * 0.9, h * 0.35);
        ctx.quadraticCurveTo(0, -h * 0.2, h * 0.9, h * 0.4);
        ctx.stroke();
        ctx.fillStyle = 'rgba(86,140,72,0.92)';
        [[-h * 0.5, -h * 0.1], [h * 0.35, h * 0.1], [h * 0.55, -h * 0.3]].forEach(function (pt) {
          ctx.beginPath();
          ctx.ellipse(pt[0], pt[1], s * 0.09, s * 0.05, 0.6, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    },

    /* ---------- 高亮 ---------- */

    drawHints(ctx, view, cur) {
      const g = this.geom;
      const busy = !!cur;
      if (view.selected && !busy) {
        const rc = this.rectOf(view.selected.r, view.selected.c);
        const pulse = 0.55 + 0.45 * Math.sin(this.time * 5.5);
        ctx.save();
        ctx.beginPath();
        this.roundRect(ctx, rc.x + 2, rc.y + 2, rc.w - 4, rc.h - 4, g.cell * 0.26);
        ctx.strokeStyle = 'rgba(196,90,58,' + (0.5 + 0.35 * pulse) + ')';
        ctx.lineWidth = Math.max(2, g.cell * 0.055);
        ctx.shadowColor = 'rgba(214,120,60,0.7)';
        ctx.shadowBlur = 12;
        ctx.stroke();
        ctx.restore();
      }
      if (view.hint && !busy) {
        const pulse = 0.5 + 0.5 * Math.sin(this.time * 4);
        const cells = [view.hint.a, view.hint.b];
        ctx.save();
        for (let i = 0; i < cells.length; i++) {
          const rc = this.rectOf(cells[i].r, cells[i].c);
          ctx.beginPath();
          this.roundRect(ctx, rc.x + 3, rc.y + 3, rc.w - 6, rc.h - 6, g.cell * 0.26);
          ctx.strokeStyle = 'rgba(70,140,200,' + (0.33 + 0.45 * pulse) + ')';
          ctx.lineWidth = Math.max(2, g.cell * 0.045);
          ctx.shadowColor = 'rgba(90,160,220,0.8)';
          ctx.shadowBlur = 10 + 6 * pulse;
          ctx.stroke();
        }
        ctx.restore();
      }
      if (view.hover && !busy && (!view.selected || view.hover.r !== view.selected.r || view.hover.c !== view.selected.c)) {
        const rc = this.rectOf(view.hover.r, view.hover.c);
        ctx.save();
        ctx.beginPath();
        this.roundRect(ctx, rc.x + 3, rc.y + 3, rc.w - 6, rc.h - 6, g.cell * 0.26);
        ctx.strokeStyle = 'rgba(120,96,60,0.28)';
        ctx.lineWidth = Math.max(1.4, g.cell * 0.03);
        ctx.stroke();
        ctx.restore();
      }
      if (view.aim && !busy) this.drawAim(ctx, view.aim, g);
    },

    /* 技能瞄准：合法目标格加一层朱砂底纹，悬停格再叠一圈强描边。
     * 目的是让「现在点哪儿」一眼可见，而不是靠玩家猜规则。
     * 到了选色阶段（灵犀一点第二步）就不再铺底纹了——格子已经选好，
     * 再满屏标一遍「哪些格能改」只会把已选的那一格埋掉。 */
    drawAim(ctx, aim, g) {
      const b = LL.Game.board;
      if (!b) return;
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 5);
      const picking = aim.stage === 'color';
      ctx.save();
      if (!picking) {
        for (let r = 0; r < b.R; r++) {
          for (let c = 0; c < b.C; c++) {
            if (!LL.Skills.validTarget(b, { r: r, c: c }, aim.id)) continue;
            const rc = this.rectOf(r, c);
            ctx.beginPath();
            this.roundRect(ctx, rc.x + 3, rc.y + 3, rc.w - 6, rc.h - 6, g.cell * 0.26);
            ctx.fillStyle = 'rgba(217,72,60,0.13)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(217,72,60,0.34)';
            ctx.lineWidth = Math.max(1.2, g.cell * 0.028);
            ctx.stroke();
          }
        }
      }
      if (aim.cell) {
        const rc = this.rectOf(aim.cell.r, aim.cell.c);
        ctx.beginPath();
        this.roundRect(ctx, rc.x + 2, rc.y + 2, rc.w - 4, rc.h - 4, g.cell * 0.26);
        ctx.strokeStyle = 'rgba(217,72,60,' + (0.6 + 0.35 * pulse) + ')';
        ctx.lineWidth = Math.max(2.5, g.cell * 0.07);
        ctx.shadowColor = 'rgba(217,72,60,0.75)';
        ctx.shadowBlur = 14;
        ctx.stroke();
      }
      ctx.restore();
    },

    /* ---------- 粒子与飘字 ---------- */

    drawParticles(ctx) {
      const list = Anim.particles;
      ctx.save();
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        const life = Math.max(0, p.life / p.maxLife);
        ctx.globalAlpha = life * p.alpha;
        if (p.shape === 'spark') {
          ctx.fillStyle = p.color;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (0.4 + 0.6 * life), 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        } else if (p.shape === 'ring') {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = Math.max(1.5, p.size * 0.22 * life);
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (1 + 3.2 * (1 - life)), 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          const w = p.size, h = p.size * 0.62;
          ctx.beginPath();
          this.roundRect(ctx, -w / 2, -h / 2, w, h, Math.min(w, h) * 0.3);
          ctx.fill();
          ctx.restore();
        }
      }
      ctx.restore();
    },

    drawTexts(ctx) {
      const list = Anim.texts;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let i = 0; i < list.length; i++) {
        const t = list[i];
        const life = Math.max(0, t.life / t.maxLife);
        if (t.line) {
          ctx.save();
          ctx.globalAlpha = life * 0.9;
          ctx.strokeStyle = t.color;
          ctx.lineWidth = t.width * life;
          ctx.lineCap = 'round';
          ctx.shadowColor = t.color;
          ctx.shadowBlur = 16;
          ctx.beginPath();
          ctx.moveTo(t.x, t.y);
          ctx.lineTo(t.x2, t.y2);
          ctx.stroke();
          ctx.restore();
          continue;
        }
        ctx.globalAlpha = Math.min(1, life * 1.6);
        let size = t.size;
        let scale = 1;
        if (t.banner) {
          const inT = Math.min(1, (1 - life) * 5);
          scale = U.easeOutBack(inT) * (0.9 + 0.1 * life);
        }
        ctx.save();
        ctx.translate(t.x, t.y);
        ctx.scale(scale, scale);
        ctx.font = t.weight + ' ' + size + 'px ' + FONT;
        ctx.lineWidth = Math.max(3, size * 0.16);
        ctx.strokeStyle = t.stroke;
        ctx.lineJoin = 'round';
        ctx.strokeText(t.str, 0, 0);
        if (t.banner) {
          const grd = ctx.createLinearGradient(0, -size * 0.7, 0, size * 0.7);
          grd.addColorStop(0, '#b8342c');
          grd.addColorStop(1, '#7a4a1f');
          ctx.fillStyle = grd;
        } else {
          ctx.fillStyle = t.color;
        }
        ctx.fillText(t.str, 0, 0);
        ctx.restore();
      }
      ctx.restore();
    },

    drawDebug(ctx, view) {
      const g = this.geom;
      ctx.save();
      ctx.font = '12px monospace';
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(6, 6, 190, 68);
      ctx.fillStyle = '#9df29d';
      ctx.fillText('FPS ' + this._fps.toFixed(0) + '  parts ' + Anim.particles.length, 12, 22);
      ctx.fillText('cell ' + g.cell.toFixed(1) + '  board ' + g.board.toFixed(0), 12, 38);
      ctx.fillText('state ' + (view.state || '-') + '  step ' + (Anim.cur ? Anim.cur.ev.kind : '-'), 12, 54);
      ctx.fillText('scale ' + (Anim.cur ? Anim.speed.toFixed(1) : '-'), 12, 68);
      ctx.restore();
    },

    tickFps(dt) {
      this._frames++;
      this._fpsT += dt;
      if (this._fpsT >= 500) {
        this._fps = this._frames * 1000 / this._fpsT;
        this._frames = 0;
        this._fpsT = 0;
      }
    },

    roundRect(ctx, x, y, w, h, r) {
      const rr = Math.min(r, w / 2, h / 2);
      ctx.moveTo(x + rr, y);
      ctx.lineTo(x + w - rr, y);
      ctx.arcTo(x + w, y, x + w, y + rr, rr);
      ctx.lineTo(x + w, y + h - rr);
      ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
      ctx.lineTo(x + rr, y + h);
      ctx.arcTo(x, y + h, x, y + h - rr, rr);
      ctx.lineTo(x, y + rr);
      ctx.arcTo(x, y, x + rr, y, rr);
      ctx.closePath();
    }
  };

  LL.Render = Render;
})(typeof globalThis !== 'undefined' ? globalThis : this);
