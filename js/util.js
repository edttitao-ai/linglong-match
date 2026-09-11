/* 玲珑消 · util.js — 基础工具：数学、缓动、随机、DOM 与存储助手
 * 无 DOM 依赖的部分可在 Node 下加载（自检脚本用）。
 */
(function (global) {
  'use strict';
  const LL = (global.LL = global.LL || {});

  const U = {
    clamp(v, a, b) { return v < a ? a : (v > b ? b : v); },
    lerp(a, b, t) { return a + (b - a) * t; },
    dist(x1, y1, x2, y2) { const dx = x2 - x1, dy = y2 - y1; return Math.sqrt(dx * dx + dy * dy); },

    /* ---- 缓动 ---- */
    easeLinear: t => t,
    easeOutQuad: t => t * (2 - t),
    easeOutCubic: t => 1 - Math.pow(1 - t, 3),
    easeInQuad: t => t * t,
    easeInCubic: t => t * t * t,
    easeOutBack: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    easeOutElastic: t => { if (t === 0 || t === 1) return t; const c4 = (2 * Math.PI) / 3; return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1; },
    easeInOutQuad: t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),

    /* ---- 随机（xorshift32，可复现） ---- */
    rng(seed) {
      let s = (seed >>> 0) || 0x9e3779b9;
      return function () {
        s ^= s << 13; s >>>= 0;
        s ^= s >>> 17;
        s ^= s << 5; s >>>= 0;
        return s / 4294967296;
      };
    },
    randInt(rnd, n) { return (rnd() * n) | 0; },
    randRange(rnd, a, b) { return a + rnd() * (b - a); },
    pick(rnd, arr) { return arr[(rnd() * arr.length) | 0]; },
    shuffleArr(arr, rnd) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = (rnd() * (i + 1)) | 0;
        const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
      }
      return arr;
    },

    /* ---- DOM（浏览器环境） ---- */
    hasDOM: typeof document !== 'undefined',
    $(sel, root) { return (root || document).querySelector(sel); },
    $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); },
    on(el, ev, fn, opt) { el.addEventListener(ev, fn, opt || false); return fn; },
    el(tag, cls, text) {
      const e = document.createElement(tag);
      if (cls) e.className = cls;
      if (text != null) e.textContent = text;
      return e;
    },
    show(node, on) { if (node) node.classList.toggle('hidden', !on); },

    /* ---- localStorage（带降级） ---- */
    store: {
      get(key, def) {
        try {
          const v = global.localStorage && global.localStorage.getItem(key);
          return v == null ? def : JSON.parse(v);
        } catch (e) { return def; }
      },
      set(key, val) {
        try { global.localStorage && global.localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* 隐私模式忽略 */ }
      },
      del(key) {
        try { global.localStorage && global.localStorage.removeItem(key); } catch (e) { /* 忽略 */ }
      }
    },

    /* ---- 简单对象池 ---- */
    pool(factory, reset, size) {
      const free = [];
      for (let i = 0; i < (size || 0); i++) free.push(factory());
      return {
        get() { return free.length ? free.pop() : factory(); },
        put(o) { if (reset) reset(o); if (free.length < 512) free.push(o); }
      };
    }
  };

  /* 数字千分位（用于分数显示） */
  U.fmt = function (n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };

  LL.U = U;
})(typeof globalThis !== 'undefined' ? globalThis : this);
