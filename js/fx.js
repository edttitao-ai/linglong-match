/* 玲珑消 · fx.js — 技能与特殊块的演出特效（分阶段、可复用）
 *
 * 和 Anim.burst 的分工：
 *   Anim.burst 是"一炸就散"的即时粒子，适合消除碎屑；
 *   这里管的是**有节奏的演出**——如意锤要"锤影落下 → 白闪与裂纹 → 冲击环 → 余烬"四段，
 *   太极要"法阵展开 → 吸色 → 墨瀑 → 淡金"四段。这种带阶段的东西用一次性爆发画不出来。
 *
 * 两条约定（方案图里定死的）：
 *   1. 打击类（锤 / 移山 / 惊雷）走"白闪 + 冲击环 + 震屏"；变化类（换天 / 灵犀 / 太极）走
 *      "墨影旋流 + 金环收束"、不震屏——否则连放两个技能时画面会晕。
 *   2. 特效只画棋盘图层内、不盖 HUD，且必须在时长内收干净，不留残影。
 *
 * 坐标一律用**像素**（cell 是格子边长），所以技能说明面板的迷你画布也能直接调 drawKind 复用。
 */
(function (global) {
  'use strict';
  const LL = (global.LL = global.LL || {});
  const CFG = LL.CFG;

  const GOLD = '#C9A44C', GOLD_HI = '#E8C877', GOLD_PALE = '#F0DFAE';
  const CINNABAR = '#C0392B', PURPLE = '#8F7AD6';
  const FONT = '"PingFang SC","Microsoft YaHei UI","Microsoft YaHei",sans-serif';

  /* 固定种子的伪随机：同一个特效每次画出来一模一样，
   * 否则"截图对比"和"回放同一个盘面"都会对不上 */
  function rnd(seed) { const x = Math.sin(seed * 127.1) * 43758.5453; return x - Math.floor(x); }

  /* ---------------- 绘制原语 ---------------- */
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function glow(ctx, x, y, r, color, a) {
    if (a <= 0 || r <= 0) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill(); ctx.restore();
  }
  function ring(ctx, x, y, r, w, color, a) {
    if (a <= 0 || r <= 0) return;
    ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = color; ctx.lineWidth = w;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.stroke(); ctx.restore();
  }
  function bar(ctx, x1, y1, x2, y2, w, color, a) {
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = color; ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
  }
  function shard(ctx, x, y, s, color, a, rot) {
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.rotate(rot || 0);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.7, s * 0.6);
    ctx.lineTo(-s * 0.5, s * 0.4); ctx.closePath(); ctx.fill(); ctx.restore();
  }

  /* ---------------- 八个特效 ----------------
   * 每个函数签名统一： (ctx, o, p)
   *   o = { x, y, cell, ... }  目标格中心的像素坐标与格子边长
   *   p = 0..1                 演出进度
   */

  /* 如意锤：准星 → 锤影落下 → 白闪裂纹 → 冲击环 + 石屑 */
  function hammer(ctx, o, p) {
    const c = o.cell, x = o.x, y = o.y;
    if (p < 0.4) {
      const k = p / 0.4;
      ctx.save(); ctx.globalAlpha = 0.9 - k * 0.35;
      ctx.strokeStyle = GOLD_HI; ctx.lineWidth = Math.max(1.6, c * 0.045);
      roundRect(ctx, x - c * 0.42, y - c * 0.42, c * 0.84, c * 0.84, c * 0.14); ctx.stroke();
      ctx.restore();
      const hy = y - c * 1.5 + (y - c * 0.1 - (y - c * 1.5)) * k * k;
      const hs = c * 1.05;
      const img = LL.Assets && LL.Assets.img('ui_skill_hammer');
      ctx.save();
      ctx.translate(x, hy); ctx.rotate(-0.18);
      if (img && img.width) ctx.drawImage(img, -hs / 2, -hs / 2, hs, hs);
      ctx.restore();
    }
    if (p >= 0.3 && p < 0.66) {
      const k = (p - 0.3) / 0.36;
      glow(ctx, x, y, c * 0.95 * (0.6 + k), 'rgba(255,248,224,.95)', 1 - k);
      ctx.save(); ctx.globalAlpha = 0.9 * (1 - k);
      ctx.strokeStyle = GOLD_PALE; ctx.lineWidth = Math.max(1.6, c * 0.05);
      for (let i = 0; i < 4; i++) {
        const a = i * 1.5708 + 0.6;
        ctx.beginPath(); ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(a) * c * 0.6, y + Math.sin(a) * c * 0.6); ctx.stroke();
      }
      ctx.restore();
    }
    if (p >= 0.34) {
      const k = (p - 0.34) / 0.66;
      ring(ctx, x, y, c * (0.45 + k * 1.25), Math.max(1, c * 0.09 * (1 - k)), GOLD_HI, 0.85 * (1 - k));
      for (let i = 0; i < 12; i++) {
        const a = rnd(i + 3) * 6.28, d = c * (0.45 + k * 1.6) * (0.6 + rnd(i) * 0.6);
        shard(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d - k * c * 0.3,
              Math.max(1, c * 0.075 * (1 - k)), i % 3 ? GOLD_HI : '#B9AFA0', (1 - k) * 0.95, a);
      }
    }
  }

  /* 换天：整盘化墨 → 墨点旋流 → 金环扫过（不震屏） */
  function swap(ctx, o, p) {
    const x = o.x, y = o.y, w = o.w, h = o.h, c = o.cell;
    const cx = x + w / 2, cy = y + h / 2;
    if (p < 0.24) {
      ctx.save(); ctx.globalAlpha = 0.9 * (p / 0.24);
      ctx.fillStyle = '#05070D'; ctx.fillRect(x, y, w, h);
      ctx.restore();
      return;
    }
    if (p < 0.58) {
      const k = (p - 0.24) / 0.34;
      ctx.save(); ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#05070D'; ctx.fillRect(x, y, w, h);
      ctx.restore();
      const n = Math.min(60, Math.round((w * h) / (c * c) * 0.9));
      for (let i = 0; i < n; i++) {
        const a0 = rnd(i) * 6.28;
        const rr = c * 0.5 + rnd(i + 7) * Math.max(w, h) * 0.45;
        const a = a0 + k * 3.4;
        const d = rr * (1 - k * 0.7);
        const px = cx + Math.cos(a) * d, py = cy + Math.sin(a) * d * 0.86;
        ctx.save(); ctx.globalAlpha = 0.35 + 0.6 * (1 - k);
        ctx.fillStyle = i % 5 === 0 ? GOLD_HI : '#7FA6C8';
        ctx.beginPath(); ctx.arc(px, py, c * (0.035 + (1 - k) * 0.05), 0, 6.28); ctx.fill();
        ctx.restore();
      }
      ring(ctx, cx, cy, Math.min(w, h) * (0.2 + k * 0.42), Math.max(1, c * 0.03), GOLD, 0.5 * (1 - k));
      return;
    }
    const k = (p - 0.58) / 0.42;
    ring(ctx, cx, cy, Math.min(w, h) * (0.18 + k * 0.46), Math.max(1, c * 0.045 * (1 - k)), GOLD_HI, 0.7 * (1 - k));
    glow(ctx, cx, cy, Math.max(w, h) * 0.42, 'rgba(232,200,119,.45)', Math.max(0, 1 - k * 1.4));
  }

  /* 灵犀一点：光点飞入 → 彩墨绽开 → 金环定色（不震屏） */
  function color(ctx, o, p) {
    const c = o.cell, x = o.x, y = o.y, tc = o.color || '#E28BA8';
    if (p < 0.3) {
      const k = p / 0.3;
      const sx = x - c * 1.5 * (1 - k), sy = y - c * 1.3 * (1 - k);
      /* 光点要够大够亮：这是"技能从哪儿来"的唯一提示，太小会看不见 */
      glow(ctx, sx, sy, c * 0.62, tc, 0.95);
      glow(ctx, sx, sy, c * 0.34, '#FFFFFF', 0.95);
      ctx.save(); ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(240,223,174,.85)'; ctx.lineWidth = Math.max(2, c * 0.06);
      roundRect(ctx, x - c * 0.42, y - c * 0.42, c * 0.84, c * 0.84, c * 0.14); ctx.stroke();
      ctx.restore();
      return;
    }
    const k = Math.min(1, (p - 0.3) / 0.4);
    glow(ctx, x, y, c * (0.3 + k * 0.8), tc, 0.55 * (1 - k * 0.5));
    for (let i = 0; i < 14; i++) {
      const a = rnd(i + 11) * 6.28, d = c * (0.15 + k * 0.9);
      ctx.save(); ctx.globalAlpha = 0.78 * (1 - k * 0.6);
      ctx.fillStyle = i % 4 === 0 ? GOLD_HI : tc;
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d, c * 0.11, c * 0.055, a, 0, 6.28);
      ctx.fill(); ctx.restore();
    }
    if (k > 0.6) {
      const kk = (k - 0.6) / 0.4;
      ring(ctx, x, y, c * (0.3 + kk * 0.6), Math.max(1.4, c * 0.05), GOLD_HI, 0.85 * (1 - kk));
    }
  }

  /* 移山：十字准星 → 竖光劈下 → 横光扫过（白闪）→ 碎块浮起飞散 */
  function cross(ctx, o, p) {
    const c = o.cell, x = o.x, y = o.y;
    const bx = o.bx, by = o.by, bw = o.w, bh = o.h;
    if (p < 0.16) {
      ctx.save(); ctx.globalAlpha = 0.9;
      ctx.strokeStyle = GOLD_HI; ctx.lineWidth = Math.max(1.4, c * 0.035);
      ctx.setLineDash([c * 0.14, c * 0.14]);
      ctx.beginPath();
      ctx.moveTo(x, by + 4); ctx.lineTo(x, by + bh - 4);
      ctx.moveTo(bx + 4, y); ctx.lineTo(bx + bw - 4, y); ctx.stroke();
      ctx.restore();
      return;
    }
    if (p < 0.38) {
      const k = (p - 0.16) / 0.22;
      const half = bh * (0.1 + k * 0.55);
      bar(ctx, x, y - half, x, y + half, c * 0.13, GOLD_HI, 0.95);
      glow(ctx, x, y, c * (0.6 + k * 1.1), 'rgba(240,223,174,.85)', 0.9 - k * 0.4);
      return;
    }
    if (p < 0.52) {
      const k = (p - 0.38) / 0.14;
      const half = bw * (0.15 + k * 0.75);
      bar(ctx, x, by + 4, x, by + bh - 4, c * 0.08, GOLD_HI, 0.6 * (1 - k * 0.5));
      bar(ctx, x - half, y, x + half, y, c * 0.15, GOLD_PALE, 0.98);
      glow(ctx, x, y, c * 1.5, 'rgba(255,248,224,.9)', 0.95 - k * 0.4);
      return;
    }
    const k = (p - 0.52) / 0.48;
    const cells = o.cells || [];
    for (let i = 0; i < cells.length; i++) {
      const p2 = cells[i];
      for (let j = 0; j < 2; j++) {
        const a = rnd(i * 3 + j) * 6.28;
        const d = k * c * 1.1 * (0.4 + rnd(i + j) * 0.7);
        shard(ctx, p2.x + Math.cos(a) * d, p2.y + Math.sin(a) * d - k * c * 0.35,
              Math.max(1, c * 0.08 * (1 - k)), j ? GOLD_HI : GOLD_PALE, (1 - k) * 0.9, a);
      }
    }
    bar(ctx, x - bw * 0.6 * k, y, x + bw * 0.6 * k, y, Math.max(1, c * 0.05), GOLD_HI, 0.5 * (1 - k));
    bar(ctx, x, y - bh * 0.6 * k, x, y + bh * 0.6 * k, Math.max(1, c * 0.05), GOLD_HI, 0.4 * (1 - k));
  }

  /* 风符：风头沿线推进，沿途方块被吹成金屑 */
  function wind(ctx, o, p) {
    const c = o.cell;
    const bx = o.bx, by = o.by, bw = o.w, bh = o.h;
    const v = !!o.vertical;
    const head = p;
    const hx = v ? o.x : bx + bw * head;
    const hy = v ? by + bh * head : o.y;
    if (p < 1) {
      glow(ctx, hx, hy, c * 0.7, 'rgba(232,200,119,.85)', 0.9);
      ctx.save(); ctx.globalAlpha = 0.95;
      ctx.strokeStyle = GOLD_PALE; ctx.lineWidth = Math.max(1.6, c * 0.05);
      for (let i = 0; i < 3; i++) {
        const off = (i - 1) * c * 0.14;
        ctx.beginPath();
        if (v) ctx.arc(hx + off, hy, c * (0.26 - i * 0.05), 0.5, 2.6);
        else ctx.arc(hx, hy + off, c * (0.26 - i * 0.05), 2.1, 4.2);
        ctx.stroke();
      }
      ctx.restore();
    }
    const n = 8;
    for (let i = 0; i < n; i++) {
      const along = rnd(i) * Math.max(0.05, head);
      const px = v ? o.x + (rnd(i + 4) - 0.5) * c * 1.6 : bx + bw * along;
      const py = v ? by + bh * along : o.y + (rnd(i + 4) - 0.5) * c * 1.6;
      shard(ctx, px, py, Math.max(1, c * 0.06), i % 3 ? GOLD_HI : GOLD_PALE, 0.8, rnd(i) * 6.28);
    }
  }

  /* 惊雷：紫云压顶 → 落雷（主干 + 分叉）→ 冲击波 + 电弧 */
  function thunder(ctx, o, p) {
    const c = o.cell, x = o.x, y = o.y;
    if (p < 0.24) {
      const k = p / 0.24;
      glow(ctx, x, y - c * 0.7, c * 0.9, 'rgba(143,122,214,.55)', 0.5 + k * 0.4);
      ctx.save(); ctx.globalAlpha = 0.85;
      ctx.strokeStyle = PURPLE; ctx.lineWidth = Math.max(1.6, c * 0.045);
      roundRect(ctx, x - c * 1.5, y - c * 1.5, c * 3, c * 3, c * 0.2); ctx.stroke();
      ctx.restore();
      return;
    }
    if (p < 0.46) {
      const k = (p - 0.24) / 0.22;
      glow(ctx, x, y, c * (0.6 + k * 0.9), 'rgba(200,180,255,.9)', 0.95);
      ctx.save(); ctx.strokeStyle = '#F2ECFF'; ctx.lineWidth = Math.max(2, c * 0.07);
      ctx.globalAlpha = 0.95;
      ctx.beginPath();
      ctx.moveTo(x + c * 0.12, y - c * 1.5);
      ctx.lineTo(x - c * 0.1, y - c * 0.7); ctx.lineTo(x + c * 0.08, y - c * 0.45);
      ctx.lineTo(x, y); ctx.stroke();
      ctx.lineWidth = Math.max(1, c * 0.035); ctx.globalAlpha = 0.7;
      for (let i = 0; i < 4; i++) {
        const a = -0.5 + i * 0.45;
        ctx.beginPath(); ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(a) * c * 0.8, y + Math.sin(a) * c * 0.6); ctx.stroke();
      }
      ctx.restore();
      return;
    }
    const k = (p - 0.46) / 0.54;
    glow(ctx, x, y, c * 2 * (0.4 + k), 'rgba(255,255,255,.9)', Math.max(0, 0.95 - k * 1.5));
    ring(ctx, x, y, c * (0.45 + k * 1.7), Math.max(1, c * 0.1 * (1 - k)), '#C9B6FF', 0.9 * (1 - k));
    ring(ctx, x, y, c * (0.28 + k * 1.15), Math.max(1, c * 0.05 * (1 - k)), '#FFFFFF', 0.7 * (1 - k));
    for (let i = 0; i < 14; i++) {
      const a = rnd(i + 21) * 6.28, d = c * (0.5 + k * 1.6);
      bar(ctx, x + Math.cos(a) * d * 0.6, y + Math.sin(a) * d * 0.6,
          x + Math.cos(a) * d, y + Math.sin(a) * d, Math.max(1, c * 0.03), '#E4DAFF', (1 - k) * 0.8);
    }
  }

  /* 太极：法阵由小长到满 → 墨瀑冲场 → 淡金收（末段必须淡出，否则连用两次会叠影） */
  function taiji(ctx, o, p) {
    const c = o.cell, x = o.x, y = o.y;
    const grow = Math.min(1, p / 0.4);
    const fade = 1 - Math.max(0, p - 0.62) / 0.38;
    const R = c * 1.7 * (0.25 + 1.15 * grow);
    ctx.save();
    /* 法阵不能压太实：底下的方块还要看得见（这是"吸色"不是"盖布"） */
    ctx.globalAlpha = (0.16 + 0.34 * grow) * Math.max(0, fade);
    ctx.translate(x, y); ctx.rotate(p * 2.2);
    ctx.fillStyle = '#F4EFE2';
    ctx.beginPath(); ctx.arc(0, 0, R, -1.5708, 1.5708);
    ctx.arc(0, R / 2, R / 2, 1.5708, -1.5708, true);
    ctx.arc(0, -R / 2, R / 2, 1.5708, -1.5708); ctx.fill();
    ctx.fillStyle = '#12161F';
    ctx.beginPath(); ctx.arc(0, 0, R, 1.5708, 4.7124);
    ctx.arc(0, -R / 2, R / 2, -1.5708, 1.5708, true);
    ctx.arc(0, R / 2, R / 2, -1.5708, 1.5708); ctx.fill();
    ctx.fillStyle = '#F4EFE2'; ctx.beginPath(); ctx.arc(0, -R / 2, R * 0.13, 0, 6.28); ctx.fill();
    ctx.fillStyle = '#12161F'; ctx.beginPath(); ctx.arc(0, R / 2, R * 0.13, 0, 6.28); ctx.fill();
    ctx.restore();
    if (p > 0.5) {
      const k = (p - 0.5) / 0.5;
      ctx.save();
      ctx.globalAlpha = 0.45 * (1 - k * 0.7);
      ctx.fillStyle = '#05070D';
      for (let i = 0; i < 5; i++) {
        const yy = o.by + ((y - o.by) + i * c * 0.5) * 0.35 + k * o.h * 1.1;
        ctx.fillRect(o.bx, yy % (o.by + o.h) - c * 0.12, o.w, c * 0.11);
      }
      ctx.restore();
      glow(ctx, x, y, Math.max(o.w, o.h) * 0.5, 'rgba(240,223,174,.75)', Math.max(0, 0.8 - k * 0.9));
    }
  }

  /* 连锁金印：朱砂底 + 描金边，从上方砸下（文案由调用方给，别在这里写死中文） */
  function seal(ctx, o, p) {
    const c = o.cell;
    const drop = Math.min(1, p / 0.35);
    const out = Math.max(0, (p - 0.7) / 0.3);
    const y = o.y - (1 - drop) * (1 - drop) * c * 2.4;
    ctx.save();
    ctx.globalAlpha = Math.min(1, drop * 1.6) * (1 - out);
    ctx.translate(o.x, y - out * c * 0.4);
    ctx.rotate(-0.12);
    const w = c * 1.9, h = c * 0.86;
    ctx.fillStyle = CINNABAR; roundRect(ctx, -w / 2, -h / 2, w, h, h * 0.22); ctx.fill();
    ctx.strokeStyle = GOLD_HI; ctx.lineWidth = Math.max(1.4, c * 0.045);
    roundRect(ctx, -w / 2, -h / 2, w, h, h * 0.22); ctx.stroke();
    ctx.fillStyle = GOLD_PALE;
    ctx.font = 'bold ' + Math.round(h * 0.52) + 'px ' + FONT;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(o.label || ('×' + (o.n || 2)), 0, h * 0.04);
    ctx.restore();
  }

  const DRAW = { hammer: hammer, swap: swap, color: color, cross: cross,
                 wind: wind, thunder: thunder, taiji: taiji, seal: seal };

  /* ---------------- 特效队列 ---------------- */
  const FX = {
    list: [],

    /* 起一个特效。opt 至少要给像素坐标与格子边长；震屏与闪白按 CFG.FX 表自动带上，
     * 调用方不要再自己 addShake，否则两处叠加会震过头。 */
    spawn(kind, opt) {
      if (!DRAW[kind] || !CFG.FX) return null;
      const e = { kind: kind, opt: opt || {}, t: 0, dur: CFG.FX.dur[kind] || 500 };
      this.list.push(e);
      const Anim = LL.Anim;
      if (Anim) {
        const sh = CFG.FX.shake[kind] || 0;
        const fl = CFG.FX.flash[kind] || 0;
        if (sh > 0) Anim.addShake(sh);
        if (fl > 0) Anim.addFlash(fl);
      }
      return e;
    },

    update(dt) {
      for (let i = this.list.length - 1; i >= 0; i--) {
        const e = this.list[i];
        e.t += dt;
        if (e.t >= e.dur) this.list.splice(i, 1);
      }
    },

    draw(ctx) {
      for (let i = 0; i < this.list.length; i++) {
        const e = this.list[i];
        DRAW[e.kind](ctx, e.opt, Math.min(1, e.t / e.dur));
      }
    },

    /* 给别处复用（技能说明面板的迷你画布）：自己给坐标与进度 */
    drawKind(ctx, kind, p, o) { if (DRAW[kind]) DRAW[kind](ctx, o, p); },

    clear() { this.list.length = 0; }
  };

  LL.FX = FX;
})(typeof globalThis !== 'undefined' ? globalThis : this);
