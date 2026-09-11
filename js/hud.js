/* 玲珑消 · hud.js — 对局 HUD（步数 / 得分 / 目标进度 / 横幅） */
(function (global) {
  'use strict';
  const LL = (global.LL = global.LL || {});
  const U = LL.U;
  const I18N = LL.I18N;
  const CFG = LL.CFG;

  const HUD = {
    els: {},
    objRefs: [],
    prevMoves: 0,
    bannerTimer: 0,

    init() {
      const $ = U.$;
      this.els = {
        root: $('#hud'),
        levelName: $('#hudLevelName'),
        obj: $('#hudObj'),
        moves: $('#hudMoves'),
        score: $('#hudScore'),
        movesBox: $('#hudMovesBox'),
        banner: $('#banner'),
        bannerMain: $('#bannerMain'),
        bannerSub: $('#bannerSub')
      };
    },

    /* 按关卡重建目标列表 */
    setup(level, clearTotal) {
      const obj = this.els.obj;
      if (!obj) return;
      obj.innerHTML = '';
      this.objRefs = [];
      const self = this;
      (level.objectives || []).forEach(function (o) {
        const item = U.el('div', 'obj');
        const icon = U.el('div', 'obj-icon');
        if (o.type === 'score') {
          icon.innerHTML = '<img src="' + LL.Assets.path('ui_star') + '" alt="">';
          icon.classList.add('star');
        } else if (o.type === 'collect') {
          const info = CFG.TILE_INFO[o.color];
          icon.innerHTML = '<img src="' + LL.Assets.path('tile_' + info.id) + '" alt="">';
        } else {
          icon.innerHTML = '<img src="' + LL.Assets.path('ob_stone') + '" alt="">';
        }
        const body = U.el('div', 'obj-body');
        const text = U.el('div', 'obj-text');
        const bar = U.el('div', 'obj-bar');
        const fill = U.el('i');
        bar.appendChild(fill);
        body.appendChild(text);
        body.appendChild(bar);
        item.appendChild(icon);
        item.appendChild(body);
        obj.appendChild(item);
        self.objRefs.push({ o: o, text: text, fill: fill, item: item, last: -1 });
      });
      if (self.els.levelName) {
        self.els.levelName.textContent = I18N.t('levelName', { n: level.id, name: I18N.levelName(level) });
      }
      this.prevMoves = -1;
      this._lastMoves = null;
      this._lastScore = null;
    },

    setScore(n) {
      if (!this.els.score || n === this._lastScore) return;
      this._lastScore = n;
      this.els.score.textContent = U.fmt(n);
    },

    setMoves(n) {
      if (!this.els.moves || n === this._lastMoves) return;
      this._lastMoves = n;
      this.els.moves.textContent = n;
      if (this.prevMoves >= 0 && n < this.prevMoves) {
        this.els.moves.classList.remove('pulse');
        void this.els.moves.offsetWidth;
        this.els.moves.classList.add('pulse');
      }
      this.prevMoves = n;
      if (this.els.movesBox) this.els.movesBox.classList.toggle('low', n <= 5);
    },

    /* 目标进度文字 / 进度条 */
    updateObjectives(progress) {
      for (let i = 0; i < this.objRefs.length; i++) {
        const ref = this.objRefs[i];
        const p = progress[i];
        const pct = p.target > 0 ? U.clamp(p.cur / p.target, 0, 1) : 1;
        const done = p.cur >= p.target;
        let label;
        if (ref.o.type === 'score') label = I18N.t('objScore') + ' ' + U.fmt(Math.min(p.cur, p.target)) + ' / ' + U.fmt(p.target);
        else if (ref.o.type === 'collect') label = I18N.t('objCollect', { name: I18N.tileName(ref.o.color) }) + ' ' + Math.min(p.cur, p.target) + '/' + p.target;
        else label = I18N.t('objClear') + ' ' + Math.min(p.cur, p.target) + '/' + p.target;
        const key = pct * 1000 + (done ? 1 : 0);
        if (key !== ref.last) {
          ref.last = key;
          ref.text.textContent = done ? label + ' · ' + I18N.t('objDone') : label;
          ref.fill.style.width = (pct * 100).toFixed(1) + '%';
          ref.item.classList.toggle('done', done);
        }
      }
    },

    banner(main, sub, dur) {
      const b = this.els.banner;
      if (!b) return;
      this.els.bannerMain.textContent = main || '';
      this.els.bannerSub.textContent = sub || '';
      b.classList.remove('show');
      b.style.animationDuration = (dur || 1500) + 'ms';
      void b.offsetWidth;
      b.classList.add('show');
      clearTimeout(this.bannerTimer);
      this.bannerTimer = setTimeout(function () { b.classList.remove('show'); }, dur || 1500);
    },

    hideBanner() {
      if (this.els.banner) this.els.banner.classList.remove('show');
    }
  };

  LL.HUD = HUD;
})(typeof globalThis !== 'undefined' ? globalThis : this);
