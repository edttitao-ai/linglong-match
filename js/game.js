/* 玲珑消 · game.js — 关卡会话：状态机、回合驱动、胜负判定、表现层特效编排 */
(function (global) {
  'use strict';
  const LL = (global.LL = global.LL || {});
  const CFG = LL.CFG;
  const U = LL.U;
  const B = LL.Board;
  const R = LL.Resolver;
  const S = CFG.SPECIAL;
  const O = CFG.OBST;
  const I18N = LL.I18N;

  const Game = {
    board: null,
    rs: null,
    level: null,
    levelIndex: 0,
    state: 'idle',          /* idle | intro | playing | resolving | won | lost | paused */
    prevState: null,
    score: 0,
    displayScore: 0,
    movesLeft: 0,
    collected: {},
    obstCleared: 0,
    obstTotal: 0,
    selected: null,
    hover: null,
    hint: null,
    idleT: 0,
    introT: 0,
    lastResult: null,
    resultTimer: 0,

    /* ---------------- 生命周期 ---------------- */

    init(canvas) {
      LL.Render.init(canvas);
      LL.Input.init(canvas);
    },

    startLevel(idx) {
      const level = LL.LEVELS[idx];
      if (!level) return;
      clearTimeout(this.resultTimer);
      this.level = level;
      this.levelIndex = idx;
      this.board = B.create({ colors: level.colors, layout: level.layout, rnd: Math.random });
      this.rs = R.create(this.board);
      this.score = 0;
      this.displayScore = 0;
      this.movesLeft = level.moves;
      this.collected = {};
      this.obstCleared = 0;
      this.obstTotal = level.clearTotal || 0;
      this.selected = null;
      this.hover = null;
      this.hint = null;
      this.idleT = 0;
      this.lastResult = null;
      LL.Anim.reset();
      LL.HUD.setup(level, this.obstTotal);
      LL.HUD.setScore(0);
      LL.HUD.setMoves(this.movesLeft);
      LL.HUD.updateObjectives(this.progressList());
      this.state = 'intro';
      this.introT = 1500;
      LL.HUD.banner(
        I18N.t('levelName', { n: level.id, name: I18N.levelName(level) }),
        this.objectiveSummary(),
        1700
      );
      LL.UI.showScreen('game');
    },

    restart() { this.startLevel(this.levelIndex); },

    nextLevel() {
      const nxt = this.levelIndex + 1;
      if (nxt < LL.LEVELS.length) {
        LL.UI.hideOverlays();
        this.startLevel(nxt);
      } else {
        LL.UI.toMap();
      }
    },

    objectiveSummary() {
      const self = this;
      return (this.level.objectives || []).map(function (o) {
        if (o.type === 'score') return I18N.t('objScore', { n: U.fmt(o.target) });
        if (o.type === 'collect') return I18N.t('objCollect', { name: I18N.tileName(o.color) }) + ' ×' + o.count;
        return I18N.t('objClear') + ' ×' + self.obstTotal;
      }).join('　·　');
    },

    /* ---------------- 状态查询 ---------------- */

    canInput() { return this.state === 'playing'; },

    view() {
      return {
        board: this.board,
        selected: this.selected,
        hover: this.hover,
        hint: this.hint,
        state: this.state
      };
    },

    progressList() {
      const self = this;
      return (this.level ? this.level.objectives : []).map(function (o) {
        if (o.type === 'score') return { cur: self.score, target: o.target };
        if (o.type === 'collect') return { cur: self.collected[o.color] || 0, target: o.count };
        return { cur: self.obstCleared, target: self.obstTotal };
      });
    },

    objectivesDone() {
      const list = this.progressList();
      for (let i = 0; i < list.length; i++) if (list[i].cur < list[i].target) return false;
      return list.length > 0;
    },

    starsFor(score) {
      const st = this.level.stars || [];
      let n = 1;
      if (score >= (st[1] || Infinity)) n++;
      if (score >= (st[2] || Infinity)) n++;
      return n;
    },

    /* ---------------- 输入回调 ---------------- */

    notifyInput() {
      this.idleT = 0;
      if (this.hint) this.hint = null;
    },

    setSelected(cell) {
      this.selected = cell;
      this.notifyInput();
    },

    setHover(cell) { this.hover = cell; },

    attemptSwap(a, b) {
      if (!this.canInput()) return false;
      const res = R.beginTurn(this.rs, a, b);
      if (!res.ok) {
        LL.Anim.play({ kind: 'revert', a: a, b: b, dur: CFG.ANIM.revert });
        LL.Audio.play('invalid');            /* 闷、短、下行的否定音 */
        return false;
      }
      this.movesLeft--;
      this.state = 'resolving';
      this.selected = null;
      this.hint = null;
      this.idleT = 0;
      LL.Audio.play('swap', { jitter: true });
      const self = this;
      LL.Anim.play(res.event, function () { self.next(); });
      return true;
    },

    /* ---------------- 回合驱动 ---------------- */

    next() {
      if (!this.rs) return;
      const ev = R.step(this.rs);
      if (!ev) { this.state = 'playing'; return; }
      this.handleEvent(ev);
    },

    handleEvent(ev) {
      const self = this;
      if (ev.kind === 'clear') {
        this.applyClear(ev);
        this.spawnClearEffects(ev);
        LL.Anim.play(ev, function () { self.next(); });
      } else if (ev.kind === 'fall') {
        LL.Anim.play(ev, function () { self.next(); });
      } else if (ev.kind === 'turnEnd') {
        this.finishTurn(ev);
      } else {
        LL.Anim.play(ev, function () { self.next(); });
      }
    },

    applyClear(ev) {
      this.score += ev.score;
      for (let i = 0; i < ev.cells.length; i++) {
        const t = ev.cells[i].t;
        if (t >= 0) this.collected[t] = (this.collected[t] || 0) + 1;
      }
      for (let i = 0; i < ev.obstacles.length; i++) if (ev.obstacles[i].broken) this.obstCleared++;
    },

    /* 特效与音效编排 */
    spawnClearEffects(ev) {
      const Anim = LL.Anim, Audio = LL.Audio, Render = LL.Render;
      let cx = 0, cy = 0;
      for (let i = 0; i < ev.cells.length; i++) {
        const p = Render.cellXY(ev.cells[i].r, ev.cells[i].c);
        cx += p.x; cy += p.y;
        const info = CFG.TILE_INFO[ev.cells[i].t];
        if (info) {
          Anim.burst(p.x, p.y, {
            count: ev.cells.length > 10 ? 2 : 4,
            color: info.main,
            colors: [info.main, info.light],
            lifeMin: 260, lifeMax: 620,
            sizeMin: 4, sizeMax: 11
          });
        }
      }
      if (ev.cells.length) { cx /= ev.cells.length; cy /= ev.cells.length; }

      /* 破坏障碍 */
      if (ev.obstacles.length) {
        for (let i = 0; i < ev.obstacles.length; i++) {
          const ob = ev.obstacles[i];
          const p = Render.cellXY(ob.r, ob.c);
          if (ob.broken) {
            Anim.burst(p.x, p.y, { count: 10, colors: ['#cfd6dc', '#8d949b', '#f4efe2'], shape: 'shard', speedMax: 230 });
            Audio.play('brk', { jitter: true, vol: 0.9 });
          } else {
            Anim.burst(p.x, p.y, { count: 5, colors: ['#ffffff', '#d8e6ee'], speedMax: 140 });
          }
        }
      }

      /* 特殊块引爆 */
      const seen = {};
      for (let i = 0; i < ev.fires.length; i++) {
        const f = ev.fires[i];
        const p = Render.cellXY(f.r, f.c);
        if (f.s === S.WIND_H) {
          Anim.lineFx({ x: Render.geom.bx, y: p.y }, { x: Render.geom.bx + Render.geom.board, y: p.y }, { color: 'rgba(255,246,214,0.95)' });
          Anim.burst(p.x, p.y, { count: 8, colors: ['#fff3c4', '#9fd8ff'], shape: 'spark', speedMax: 260 });
          if (!seen.wind) { Audio.play('wind'); seen.wind = 1; Anim.addShake(0.22); }
        } else if (f.s === S.WIND_V) {
          Anim.lineFx({ x: p.x, y: Render.geom.by }, { x: p.x, y: Render.geom.by + Render.geom.board }, { color: 'rgba(255,246,214,0.95)' });
          Anim.burst(p.x, p.y, { count: 8, colors: ['#fff3c4', '#9fd8ff'], shape: 'spark', speedMax: 260 });
          if (!seen.wind) { Audio.play('wind'); seen.wind = 1; Anim.addShake(0.22); }
        } else if (f.s === S.THUNDER) {
          Anim.burst(p.x, p.y, { count: 10, colors: ['#fff6d0', '#ffd27a'], shape: 'ring', speedMax: 60 });
          Anim.burst(p.x, p.y, { count: 14, colors: ['#fff3c4', '#ffb45e'], shape: 'spark', speedMax: 330 });
          if (!seen.thunder) { Audio.play('thunder'); seen.thunder = 1; Anim.addShake(0.5); Anim.addFlash(0.22); }
        } else if (f.s === S.TAIJI) {
          Anim.burst(p.x, p.y, { count: 12, colors: ['#e8dcff', '#ffffff', '#8f7ad6'], shape: 'ring', speedMax: 80 });
          Anim.burst(p.x, p.y, { count: 18, colors: ['#efe6ff', '#c9b6ff', '#ffffff'], shape: 'spark', speedMax: 380 });
          if (!seen.taiji) { Audio.play('taiji'); seen.taiji = 1; Anim.addShake(0.6); Anim.addFlash(0.34); }
        }
      }

      /* 分数飘字与连锁横幅 */
      if (ev.score > 0) {
        Anim.text(cx, cy, '+' + U.fmt(ev.score), { size: 24, color: '#8a4a1c', life: 880 });
      }
      if (ev.cascade >= 2) {
        Anim.text(Render.W / 2, Render.geom.by + Render.geom.board * 0.42,
          I18N.t('cascade', { n: ev.cascade }), { banner: true, size: 46, life: 900 });
        Anim.addShake(0.12 + Math.min(0.25, ev.cascade * 0.05));
      }
      if (ev.cause === 'match') Audio.playCascade(ev.cascade);
    },

    finishTurn(ev) {
      const self = this;
      if (ev.needsShuffle) {
        const sev = R.shuffle(this.rs);
        LL.HUD.banner(I18N.t('shuffle'), '', 1200);
        LL.Audio.play('shuffle');
        LL.Anim.play(sev, function () {
          if (sev.needsShuffleAfter) {
            /* 极端情况：洗牌后仍无解，直接重铺 */
            R.shuffle(self.rs);
          }
          self.finishTurnInner();
        });
      } else {
        this.finishTurnInner();
      }
    },

    finishTurnInner() {
      LL.HUD.updateObjectives(this.progressList());
      if (this.objectivesDone()) {
        this.win();
      } else if (this.movesLeft <= 0) {
        this.lose();
      } else {
        this.state = 'playing';
      }
    },

    win() {
      this.state = 'won';
      const bonus = this.movesLeft * CFG.SCORE_MOVE_LEFT;
      const self = this;
      if (bonus > 0) {
        this.score += bonus;
        LL.Anim.text(LL.Render.W / 2, LL.Render.geom.by + LL.Render.geom.board * 0.58,
          '+' + U.fmt(bonus) + '  (' + I18N.t('moves') + ' × ' + this.movesLeft + ')',
          { size: 22, color: '#3d7a4a', life: 1100 });
      }
      LL.Audio.play('win');
      LL.Anim.addFlash(0.2);
      const stars = this.starsFor(this.score);
      const rec = LL.Progress.record(this.level.id, stars, this.score);
      this.lastResult = {
        win: true, score: this.score, stars: stars,
        level: this.level, levelIndex: this.levelIndex,
        newBest: rec.newBest, unlockedNext: rec.unlockedNext,
        best: LL.Progress.bestOf(this.level.id),
        isLast: this.levelIndex >= LL.LEVELS.length - 1
      };
      this.resultTimer = setTimeout(function () {
        if (self.state === 'won') LL.UI.showResult(self.lastResult);
      }, 1050);
    },

    lose() {
      this.state = 'lost';
      LL.Audio.play('lose');
      const self = this;
      this.lastResult = {
        win: false, score: this.score, stars: 0,
        level: this.level, levelIndex: this.levelIndex,
        best: LL.Progress.bestOf(this.level.id),
        isLast: this.levelIndex >= LL.LEVELS.length - 1
      };
      this.resultTimer = setTimeout(function () {
        if (self.state === 'lost') LL.UI.showResult(self.lastResult);
      }, 900);
    },

    /* ---------------- 暂停 ---------------- */

    pause() {
      if (this.state !== 'playing' && this.state !== 'resolving' && this.state !== 'intro') return;
      this.prevState = this.state;
      this.state = 'paused';
      LL.UI.showPause();
    },

    resume() {
      if (this.state !== 'paused') return;
      this.state = this.prevState || 'playing';
      LL.UI.hidePause();
      this.notifyInput();
    },

    togglePause() {
      if (this.state === 'paused') this.resume();
      else this.pause();
    },

    /* ---------------- 主循环 ---------------- */

    update(dt) {
      LL.Render.tickFps(dt);
      if (this.state === 'paused') return;
      LL.Anim.update(dt);

      if (this.state === 'intro') {
        this.introT -= dt;
        if (this.introT <= 0) { this.state = 'playing'; this.notifyInput(); }
      }

      if (this.state === 'playing') {
        this.idleT += dt;
        if (!this.hint && this.idleT > CFG.HINT_DELAY) {
          const moves = B.findAllMoves(this.board, 1);
          if (moves.length) this.hint = { a: moves[0].a, b: moves[0].b };
        }
      }

      /* 分数滚动 */
      if (Math.abs(this.score - this.displayScore) > 0.6) {
        this.displayScore += (this.score - this.displayScore) * Math.min(1, dt * 0.009);
      } else {
        this.displayScore = this.score;
      }
      if (this.board) {
        LL.HUD.setScore(Math.round(this.displayScore));
        LL.HUD.setMoves(Math.max(0, this.movesLeft));
      }
    },

    draw() {
      LL.Render.draw(this.view());
    }
  };

  LL.Game = Game;
})(typeof globalThis !== 'undefined' ? globalThis : this);
