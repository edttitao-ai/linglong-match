/* 玲珑消 · anim.js — 事件时间轴 + 粒子/飘字/震屏/闪白
 * 表现层只读取 Anim.cur（当前事件与播放进度）来插值绘制，
 * 逻辑层与表现层因此完全解耦。
 */
(function (global) {
  'use strict';
  const LL = (global.LL = global.LL || {});
  const U = LL.U;
  const CFG = LL.CFG;

  const MAX_PARTICLES = 420;

  const Anim = {
    cur: null,          // { ev, t, dur }
    onDone: null,
    speed: 1,
    time: 0,            // 全局时钟（秒），用于持续动画（太极旋转等）
    particles: [],
    texts: [],
    shake: 0,
    flash: 0,
    pPool: [],

    reset() {
      this.cur = null;
      this.onDone = null;
      this.speed = 1;
      this.particles.length = 0;
      this.texts.length = 0;
      this.shake = 0;
      this.flash = 0;
    },

    isBusy() { return !!this.cur; },
    progress() { return this.cur ? U.clamp(this.cur.t / this.cur.dur, 0, 1) : 1; },

    play(ev, onDone) {
      this.cur = { ev: ev, t: 0, dur: Math.max(60, ev.dur || 200) };
      this.onDone = onDone || null;
      this.speed = 1;
    },

    /* 点击加速当前步骤 */
    accel() {
      if (this.cur) this.speed = Math.max(this.speed, CFG.ACCEL_SCALE);
    },

    update(dt) {
      this.time += dt / 1000;
      if (this.cur) {
        this.cur.t += dt * this.speed;
        if (this.cur.t >= this.cur.dur) {
          const ev = this.cur.ev, cb = this.onDone;
          this.cur = null;
          this.onDone = null;
          if (cb) cb(ev);
        }
      }
      this.updateEffects(dt);
    },

    /* ---------- 特效 ---------- */

    updateEffects(dt) {
      const s = dt / 1000;
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.life -= dt;
        if (p.life <= 0) {
          this.particles.splice(i, 1);
          if (this.pPool.length < 256) this.pPool.push(p);
          continue;
        }
        p.x += p.vx * s;
        p.y += p.vy * s;
        p.vy += p.g * s;
        p.vx *= (1 - 1.6 * s);
        p.rot += p.vr * s;
      }
      for (let i = this.texts.length - 1; i >= 0; i--) {
        const t = this.texts[i];
        t.life -= dt;
        if (t.life <= 0) { this.texts.splice(i, 1); continue; }
        t.y += t.vy * s;
        t.vy *= (1 - 0.9 * s);
      }
      if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 0.0022);
      if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 0.004);
    },

    addShake(power) { this.shake = Math.min(1.1, this.shake + power); },
    addFlash(a) { this.flash = Math.min(0.85, this.flash + a); },

    spawnParticle() {
      if (this.pPool.length) return this.pPool.pop();
      return { x: 0, y: 0, vx: 0, vy: 0, g: 0, life: 0, maxLife: 1, size: 6, color: '#fff', shape: 'shard', rot: 0, vr: 0, alpha: 1 };
    },

    /* 碎裂 / 星火爆发 */
    burst(x, y, opt) {
      opt = opt || {};
      const n = opt.count || 8;
      const colors = opt.colors || [opt.color || '#ffffff'];
      for (let i = 0; i < n; i++) {
        if (this.particles.length >= MAX_PARTICLES) {
          const dropped = this.particles.shift();
          if (dropped && this.pPool.length < 256) this.pPool.push(dropped);
        }
        const p = this.spawnParticle();
        const a = opt.angle == null ? (Math.random() * Math.PI * 2) : opt.angle + (Math.random() - 0.5) * (opt.spread || 1);
        const sp = U.randRange(Math.random, opt.speedMin || 40, opt.speedMax || 190);
        p.x = x; p.y = y;
        p.vx = Math.cos(a) * sp;
        p.vy = Math.sin(a) * sp - (opt.lift || 0);
        p.g = opt.g == null ? 420 : opt.g;
        p.maxLife = p.life = U.randRange(Math.random, opt.lifeMin || 280, opt.lifeMax || 640);
        p.size = U.randRange(Math.random, opt.sizeMin || 3, opt.sizeMax || 9);
        p.color = colors[(Math.random() * colors.length) | 0];
        p.shape = opt.shape || 'shard';
        p.rot = Math.random() * Math.PI;
        p.vr = U.randRange(Math.random, -9, 9);
        p.alpha = opt.alpha == null ? 1 : opt.alpha;
        this.particles.push(p);
      }
    },

    /* 飘字 */
    text(x, y, str, opt) {
      opt = opt || {};
      this.texts.push({
        x: x + (opt.dx || 0), y: y + (opt.dy || 0),
        vy: opt.vy == null ? -46 : opt.vy,
        life: opt.life || 900, maxLife: opt.life || 900,
        str: str,
        size: opt.size || 26,
        color: opt.color || '#7a4a1f',
        weight: opt.weight || 'bold',
        banner: !!opt.banner,
        stroke: opt.stroke || 'rgba(255,250,238,0.92)',
        scale: opt.scale || 1
      });
    },

    /* 一条横向能量线（风符）与光圈（惊雷 / 太极） */
    lineFx(from, to, opt) {
      opt = opt || {};
      this.texts.push({
        x: from.x, y: from.y, x2: to.x, y2: to.y,
        vy: 0, life: opt.life || 360, maxLife: opt.life || 360,
        str: '', size: 0, line: true, color: opt.color || 'rgba(255,255,255,0.9)',
        width: opt.width || 14
      });
    }
  };

  LL.Anim = Anim;
})(typeof globalThis !== 'undefined' ? globalThis : this);
