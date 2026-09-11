/* 玲珑消 · game.js — 关卡会话：状态机、回合驱动、胜负判定、表现层特效编排 */
(function (global) {
  'use strict';
  const LL = (global.LL = global.LL || {});
  const CFG = LL.CFG;
  const U = LL.U;
  const B = LL.Board;
  const R = LL.Resolver;
  const SK = LL.Skills;
  const Hint = LL.Hint;
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
      this.start(level, idx);
    },

    /* 无尽模式：一盘一目标，达标进入下一盘（剩余步数结转，上限 5 步） */
    startEndless(stage, carry) {
      stage = Math.max(1, stage || 1);
      const def = LL.Modes.endlessLevel(stage);
      this.endlessStage = stage;
      this.start(def, -1);
      if (carry > 0) {
        this.movesLeft += carry;
        LL.HUD.setMoves(this.movesLeft);
      }
    },

    /* 限时挑战：60 秒内尽可能多得分 */
    startTimed() {
      const def = LL.Modes.timedLevel();
      this.timeLeft = def.seconds;
      this.start(def, -1);
    },

    /* 每日挑战：日期种子生成，同一天所有人同一盘；不限尝试次数 */
    startDaily() {
      const key = LL.Progress.todayKey();
      LL.Progress.data.daily.plays = (LL.Progress.data.daily.plays || 0) + 1;
      LL.Progress.save();
      this.start(LL.Daily.build(key), -1);
    },

    start(level, idx) {
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

      /* 开局道具：装填的在本局开始时消耗并立即生效 */
      this.boostersUsed = [];
      const boosters = LL.Progress.armedList();
      for (let i = 0; i < boosters.length; i++) {
        const id = boosters[i];
        if (!LL.Progress.useBooster(id)) continue;
        this.boostersUsed.push(id);
        if (id === 'moves') this.movesLeft += CFG.BOOSTERS.moves.amount;
        else if (id === 'wind') this.placeStartingWind(this.board);
        else if (id === 'shuffle') B.shuffleBoard(this.board);
      }

      this.selected = null;
      this.hover = null;
      this.hint = null;
      this.idleT = 0;
      this.lastResult = null;
      this.pendingRevive = null;
      this.reviveUsed = 0;          /* 本次挑战内的续步次数（每次开始关卡重置） */

      /* 灵力：只能玩出来的局内力量（见 skills.js 与 README「局内技能」） */
      this.qi = SK.qiStartFor(level);
      this.qiScale = SK.qiScaleFor(level);
      this.aim = null;              /* 瞄准态：{ id, cost, stage:'cell'|'color', cell } */
      this.skillsUsed = 0;
      this.lastStandUsed = 0;
      this.pendingLastStand = null;

      this.endless = !!level.endless;
      this.timed = !!level.timed;
      this.endlessStage = level.stage || this.endlessStage || 1;
      this.timeLeft = level.seconds || 0;
      this.maxCascade = 0;
      LL.Anim.reset();
      LL.HUD.setup(level, this.obstTotal);
      LL.HUD.setScore(0);
      LL.HUD.setMoves(this.movesLeft);
      LL.HUD.updateObjectives(this.progressList());
      LL.UI.buildSkillBar();
      this.state = 'intro';
      this.introT = 1500;
      LL.HUD.banner(
        I18N.levelTitle(level),
        this.objectiveSummary() + this.boosterNote(),
        1700
      );
      LL.UI.showScreen('game');
    },

    restart() { if (this.level) this.start(this.level, this.levelIndex); },

    nextLevel() {
      const nxt = this.levelIndex + 1;
      if (this.levelIndex < 0) { LL.UI.toTitle(); return; }   /* 每日挑战没有「下一关」 */
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
        aim: this.aim,
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

    /* 点击路由：瞄准态走技能，其余走原有的「选格 → 相邻交换」。
     * 返回 true 表示这次点击已被消化（拖动不必再接管）。 */
    tapCell(cell) {
      this.notifyInput();
      if (!this.canInput()) return true;
      if (this.aim) { this.aimTap(cell); return true; }
      if (!cell) { this.selected = null; return true; }
      const sel = this.selected;
      if (sel && sel.r === cell.r && sel.c === cell.c) { this.selected = null; return true; }
      if (sel && Math.abs(sel.r - cell.r) + Math.abs(sel.c - cell.c) === 1) {
        this.attemptSwap(sel, cell);
        return true;
      }
      this.setSelected(cell);
      return false;   /* 只是选中：允许继续拖成一格交换 */
    },

    /* 拖动路由：瞄准态一律不响应拖动，避免放技能时误触交换 */
    dragTo(from, cell) {
      if (this.aim || !this.canInput() || !from || !cell) return false;
      if (Math.abs(from.r - cell.r) + Math.abs(from.c - cell.c) !== 1) return false;
      this.selected = null;
      return this.attemptSwap(from, cell);
    },

    /* ---------------- 局内技能（灵力） ----------------
     * 四个技能都不消耗步数，代价只有灵力；灵力只能靠玩出来（见 skills.js）。
     * 释放后走的是 Resolver 的正常回合流水线，所以连锁、计分、任务统计全都自动生效。 */

    useSkill(id) {
      if (!this.canInput()) return false;
      const d = SK.def(id);
      if (!d) return false;
      const c = SK.canUse(this.board, this.qi, id);
      if (!c.ok) {
        LL.Audio.play('invalid');
        if (c.reason === 'qi') {
          LL.UI.skillNote(I18N.t('skillNoQi', { n: Math.ceil(c.cost - this.qi) }));
        }
        return false;
      }
      if (d.aim === 'none') { this.castSkill(id, null, -1, c.cost); return true; }
      /* 再次点击同一个技能 = 取消瞄准 */
      if (this.aim && this.aim.id === id) { this.cancelAim(); return true; }
      this.aim = { id: id, cost: c.cost, stage: 'cell', cell: null };
      this.selected = null;
      LL.Audio.play('click', { rate: 1.1 });
      /* 提示直接说「这一下会发生什么」，而不是笼统的「选目标」——
       * 技能的作用必须在出手之前就说清楚，否则玩家只能盲点。 */
      LL.UI.skillNote(I18N.t('skill_' + id + '_use'));
      LL.UI.buildSkillBar();
      return true;
    },

    cancelAim() {
      if (!this.aim) return false;
      this.aim = null;
      LL.Audio.play('click', { rate: 0.9 });
      LL.UI.buildSkillBar();
      return true;
    },

    /* 瞄准态里点棋盘：先选格，灵犀一点再补一步选色 */
    aimTap(cell) {
      const aim = this.aim;
      if (!aim || !cell) return;
      if (!SK.validTarget(this.board, cell, aim.id)) {
        LL.Audio.play('invalid');
        LL.UI.skillNote(I18N.t('skillBadTarget'));
        return;
      }
      if (aim.id === 'color') {
        aim.cell = { r: cell.r, c: cell.c };
        aim.stage = 'color';
        LL.Audio.play('click', { rate: 1.16 });
        LL.UI.skillNote(I18N.t('skillPickColor') + ' · ' + I18N.t('skillAimHint'));
        LL.UI.buildSkillBar();
        return;
      }
      this.castSkill(aim.id, cell, -1, aim.cost);
    },

    /* 真正释放：扣灵力 → 出特效 → 交给 Resolver 走完整回合
     * 换天是唯一的例外：它不消除任何东西，所以不走消除流水线（见下面的分支）。 */
    castSkill(id, cell, color, cost) {
      if (this.state !== 'playing') return false;
      if (cost > this.qi) { LL.Audio.play('invalid'); return false; }
      const plan = (id === 'color' || id === 'swap') ? null : SK.plan(this.board, id, cell);
      if (id === 'color' && !SK.recolor(this.board, cell, color)) {
        LL.Audio.play('invalid');
        return false;
      }
      this.qi -= cost;
      this.aim = null;
      this.skillsUsed++;
      LL.Progress.bumpStat('skillsUsed', 1);
      LL.Audio.play('skill_' + id, { vol: 0.95 });
      this.skillFx(id, cell, color);
      LL.UI.buildSkillBar();

      this.selected = null;
      this.hint = null;
      this.idleT = 0;
      this.state = 'resolving';

      /* 换天：只把盘子重排一遍，不炸不消，所以走「死局洗牌」那条路
       *（R.shuffle + shuffle 动画），而不是 beginSkill 的消除流程。
       * 早先这里漏了这个分支，plan 又是 null，于是落进了「匹配扫描」——
       * 扣了灵力、特效也放了，盘面却纹丝不动：玩家看到的就是「这个技能没效果」。
       * 它同样不吃步数，动画放完直接交回操作。 */
      if (id === 'swap') {
        const self = this;
        const sev = R.shuffle(this.rs);
        LL.Anim.play(sev, function () {
          if (sev.needsShuffleAfter) R.shuffle(self.rs);   /* 极端情况：洗牌后仍无解，重铺 */
          self.state = 'playing';
          self.notifyInput();
        });
        return true;
      }

      if (plan) R.beginSkill(this.rs, plan);
      else R.beginScan(this.rs);      /* 灵犀一点：改完色让正常匹配扫描接着跑 */
      this.next();
      return true;
    },

    /* 每一次消除都涨灵力；满槽后溢出折算成分数（避免「不敢花就浪费」） */
    addQi(ev) {
      const mult = SK.gainMult(this.movesLeft, this.timed) * (this.qiScale || 1);
      const amount = SK.gain(ev, mult);
      if (amount <= 0) return;
      const res = SK.addQi(this.qi, amount);
      this.qi = res.qi;
      if (res.score > 0) this.score += res.score;
      LL.UI.updateQi(res.gained, res.score);
    },

    /* 技能起手特效：技能要有分量，所以起手就是大动静 */
    skillFx(id, cell, color) {
      const Anim = LL.Anim, Render = LL.Render;
      const p = cell
        ? Render.cellXY(cell.r, cell.c)
        : { x: Render.W / 2, y: Render.geom.by + Render.geom.board / 2 };
      const cx = Render.W / 2, cy = Render.geom.by + Render.geom.board * 0.42;

      if (id === 'hammer') {
        Anim.burst(p.x, p.y, { count: 16, colors: ['#fff3c4', '#ffd27a', '#ffffff'], shape: 'spark', speedMax: 360 });
        Anim.burst(p.x, p.y, { count: 8, colors: ['#ffffff', '#d8e6ee'], shape: 'shard', speedMax: 210 });
        Anim.addShake(0.45);
        Anim.addFlash(0.2);
      } else if (id === 'cross') {
        Anim.lineFx({ x: Render.geom.bx, y: p.y },
          { x: Render.geom.bx + Render.geom.board, y: p.y }, { color: 'rgba(255,242,206,0.95)', width: 20 });
        Anim.lineFx({ x: p.x, y: Render.geom.by },
          { x: p.x, y: Render.geom.by + Render.geom.board }, { color: 'rgba(255,242,206,0.95)', width: 20 });
        Anim.burst(p.x, p.y, { count: 22, colors: ['#fff3c4', '#ffb45e', '#ffffff'], shape: 'spark', speedMax: 430 });
        Anim.addShake(0.72);
        Anim.addFlash(0.34);
      } else if (id === 'color') {
        const info = CFG.TILE_INFO[color] || CFG.TILE_INFO[0];
        Anim.burst(p.x, p.y, { count: 14, colors: [info.light, info.main, '#ffffff'], shape: 'ring', speedMax: 90 });
        Anim.burst(p.x, p.y, { count: 16, colors: [info.light, '#ffffff'], shape: 'spark', speedMax: 300 });
        Anim.addShake(0.18);
        Anim.addFlash(0.14);
      } else if (id === 'swap') {
        Anim.burst(cx, cy, { count: 24, colors: ['#fff3c4', '#9fd8ff', '#ffffff'], shape: 'spark', speedMax: 380 });
        Anim.burst(cx, cy, { count: 10, colors: ['#ffffff', '#e8dcff'], shape: 'ring', speedMax: 120 });
        Anim.addShake(0.42);
        Anim.addFlash(0.22);
      }
      Anim.text(cx, cy - 30, I18N.t('skill_' + id), { size: 34, color: '#8a3a1c', life: 980, stroke: '#fff8e6' });
    },

    /* 技能栏第一次出现时教一次。
     * 技能再强，玩家不知道它干什么就等于没有——所以第一次拿到必须先讲清楚，
     * 之后靠「长按图标看说明」自助查（见 UI.bindSkillSlot）。 */
    maybeShowSkillIntro() {
      if (!SK.order().length) return false;
      if (LL.Progress.hasSeen('skills')) return false;
      /* 不在「看过」时立刻落盘：关闭教学面板才算看过，中途刷新还能再看到 */
      LL.UI.showSkillIntro();
      return true;
    },

    /* 教学是「停下来说明」：读说明的时候对局不该继续跑。
     * 限时模式尤其明显——不然玩家一边看演示一边掉时间。
     * 不给它单独的状态机分支：canInput() 只认 playing，所以教学态天然不可操作。 */
    holdForIntro() {
      if (this.state !== 'playing' && this.state !== 'intro') return false;
      this.prevState = this.state;
      this.state = 'skillintro';
      return true;
    },

    releaseIntro() {
      if (this.state !== 'skillintro') return false;
      this.state = this.prevState === 'intro' ? 'playing' : (this.prevState || 'playing');
      this.prevState = null;
      this.notifyInput();
      return true;
    },

    /* ---------------- 绝处逢生 ----------------
     * 步数耗尽且目标未完成时，先给一次「花灵力换步」的机会（不走金币、不破铁律），
     * 灵力不够才轮到金币续步那条路——把「要输了」改写成「花掉攒的大招」。 */

    useLastStand() {
      const o = this.pendingLastStand;
      if (!o) return false;
      this.pendingLastStand = null;
      this.qi -= o.cost;
      this.lastStandUsed = (this.lastStandUsed || 0) + 1;
      this.movesLeft += o.moves;
      LL.Progress.bumpStat('lastStands', 1);
      LL.UI.hideLastStand();
      LL.HUD.setMoves(this.movesLeft);
      this.state = 'playing';
      LL.Audio.play('star', { rate: 1.02, vol: 0.95 });
      LL.Anim.addFlash(0.26);
      LL.HUD.banner(I18N.t('lastStandTitle'), '+' + o.moves + ' ' + I18N.t('moves'), 1500);
      LL.UI.buildSkillBar();
      this.notifyInput();
      return true;
    },

    declineLastStand() {
      this.pendingLastStand = null;
      LL.UI.hideLastStand();
      if (this.endless) this.runOver();
      else this.lose();
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
      /* 顺手统计每日任务需要的量：消除色块 / 破障 / 引爆 / 连锁 */
      const qev = { collected: {}, obstaclesBroken: 0, specialsFired: (ev.fires || []).length, cascade: ev.cascade || 0 };
      for (let i = 0; i < ev.cells.length; i++) {
        const t = ev.cells[i].t;
        if (t >= 0) {
          this.collected[t] = (this.collected[t] || 0) + 1;
          qev.collected[t] = (qev.collected[t] || 0) + 1;
        }
      }
      for (let i = 0; i < ev.obstacles.length; i++) {
        if (ev.obstacles[i].broken) { this.obstCleared++; qev.obstaclesBroken++; }
      }
      if (ev.cascade > (this.maxCascade || 0)) this.maxCascade = ev.cascade;
      LL.Progress.addQuestProgress(qev);
      /* 成就用的累计统计 */
      LL.Progress.bumpStat('specialsFired', qev.specialsFired);
      LL.Progress.bumpStat('obstaclesBroken', qev.obstaclesBroken);
      LL.Progress.setStatMax('maxCascade', ev.cascade || 0);
      this.addQi(ev);
    },

    /* 开局道具的横幅提示文案 */
    boosterNote() {
      if (!this.boostersUsed || !this.boostersUsed.length) return '';
      const self = this;
      const names = this.boostersUsed.map(function (id) { return I18N.t('boost_' + id); });
      return '　·　' + I18N.t('boostUsed') + ' ' + names.join('、');
    },

    /* 风符：落在盘心，颜色取不会立刻形成三连的一种（落点可预期，避免「道具白瞎」） */
    placeStartingWind(board) {
      const S = CFG.SPECIAL;
      const r = (board.R / 2) | 0, c = (board.C / 2) | 0;
      for (let t = 0; t < board.colors; t++) {
        board.cells[r][c] = B.tile(t, 0);
        if (B.findMatches(board).length === 0) {
          board.cells[r][c] = B.tile(t, S.WIND_H);
          return { r: r, c: c };
        }
      }
      board.cells[r][c] = B.tile(0, S.WIND_H);
      return { r: r, c: c };
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
      if (this.timed) {          /* 限时模式只看时间，目标分只是奖励档位 */
        this.state = 'playing';
        return;
      }
      if (this.objectivesDone()) {
        if (this.endless) this.endlessAdvance();
        else this.win();
      } else if (this.movesLeft <= 0) {
        /* 绝处逢生：先给一次「花灵力换步」的机会，灵力不够才走金币续步 / 结算 */
        const offer = SK.lastStandOffer(this.qi, this.lastStandUsed);
        if (offer) {
          this.pendingLastStand = offer;
          this.state = 'laststand';
          LL.UI.showLastStand(offer, this.progressRatio());
          return;
        }
        if (this.endless) this.runOver();
        else this.lose();
      } else {
        this.state = 'playing';
      }
    },

    /* 无尽模式达标：结转剩余步数（上限 carryCap），稍后开下一盘 */
    endlessAdvance() {
      const cap = LL.Modes.CFG.endless.carryCap;
      const carry = Math.min(cap, this.movesLeft);
      this.state = 'between';
      LL.Progress.recordEndless(this.endlessStage, this.score);
      LL.Audio.play('win');
      LL.Anim.addFlash(0.18);
      LL.HUD.banner(
        I18N.t('endlessStageClear', { n: this.endlessStage }),
        carry > 0 ? I18N.t('endlessCarry', { n: carry }) : '',
        1500
      );
      const self = this;
      this.resultTimer = setTimeout(function () {
        if (self.state === 'between') self.startEndless(self.endlessStage + 1, carry);
      }, 1100);
    },

    /* 一次挑战结束（无尽 / 限时）：结算金币与最佳纪录 */
    runOver() {
      this.state = 'over';
      LL.Audio.play('lose');
      const isEndless = this.endless;
      const coins = isEndless ? LL.Modes.endlessCoins(this.endlessStage) : LL.Modes.timedCoins(this.score);
      const rec = isEndless
        ? LL.Progress.recordEndless(this.endlessStage, this.score)
        : LL.Progress.recordTimed(this.score);
      const payout = LL.Progress.addCoins(coins);
      LL.Progress.save();
      const unlockedAch = LL.Progress.checkAchievements();
      this.lastResult = {
        win: false,
        achievements: unlockedAch,
        mode: isEndless ? 'endless' : 'timed',
        score: this.score,
        stage: this.endlessStage,
        best: rec.best,
        isBest: rec.isBest,
        level: this.level,
        levelIndex: -1,
        coins: payout.added, coinsCapped: payout.capped, replay: false,
        coinTotal: LL.Progress.data.coins
      };
      const self = this;
      this.resultTimer = setTimeout(function () {
        if (self.state === 'over') LL.UI.showResult(self.lastResult);
      }, 900);
    },

    /* 模式重开（无尽回到第 1 盘，限时重新计时） */
    restartRun() {
      if (this.endless) this.startEndless(1);
      else if (this.timed) this.startTimed();
      else this.restart();
    },

    /* 目标完成度（0~1，多目标取平均）——续步只在快接近目标时才提供 */
    progressRatio() {
      const list = this.progressList();
      if (!list.length) return 0;
      let sum = 0;
      for (let i = 0; i < list.length; i++) {
        const o = list[i];
        sum += o.target > 0 ? Math.min(1, o.cur / o.target) : 1;
      }
      return sum / list.length;
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
      const starIdx = Math.max(0, Math.min(2, stars - 1));
      const isDaily = !!this.level.daily;
      let coins = 0, milestone = 0, rec = null, prevStars = 0, dailyFirst = false;
      let dailyNewBest = false, dailyBest = 0;
      let payout = { added: 0, capped: false };

      if (isDaily) {
        /* 每日挑战：首通 40 金币，达 2 星再 +30（时间节流，不占每日上限）；
         * 重复通关按 30% 星级金币计，且占用每日上限 */
        const prevBest = LL.Progress.data.daily.best || 0;
        const drec = LL.Progress.recordDaily(this.level.dayKey, stars, this.score);
        prevStars = drec.prevStars;
        dailyFirst = drec.firstClear;
        dailyNewBest = this.score > prevBest;
        dailyBest = Math.max(prevBest, this.score);
        if (dailyFirst) {
          coins = LL.Daily.FIRST_CLEAR_COINS + (stars >= 2 ? LL.Daily.STAR_BONUS_COINS : 0);
          payout = LL.Progress.addCoins(coins, false);
        } else {
          coins = Math.round(CFG.ECON.STAR_COINS[starIdx] * CFG.ECON.REPLAY_RATE);
          payout = LL.Progress.addCoins(coins);
        }
      } else {
        /* 战役：首通按星级全额，重玩旧关只按 30% 产出（防止刷旧关） */
        prevStars = LL.Progress.starsOf(this.level.id);
        const starsBefore = LL.Progress.totalStars();
        const base = CFG.ECON.STAR_COINS[starIdx];
        const rate = prevStars > 0 ? CFG.ECON.REPLAY_RATE : 1;
        coins = Math.round(base * rate);
        rec = LL.Progress.record(this.level.id, stars, this.score);
        const starsAfter = LL.Progress.totalStars();
        milestone = Math.floor(starsAfter / CFG.ECON.MILESTONE_EVERY) -
          Math.floor(starsBefore / CFG.ECON.MILESTONE_EVERY);
        if (milestone > 0) coins += CFG.ECON.MILESTONE_COINS * milestone;
        payout = LL.Progress.addCoins(coins);
      }
      LL.Progress.save();

      /* 每日任务：通关 / 星级 / 未续步通关 */
      const questsBefore = LL.Progress.questState().claimable;
      LL.Progress.addQuestProgress({ win: true, stars: stars, revived: (this.reviveUsed || 0) > 0 });
      const questsAfter = LL.Progress.questState().claimable;
      const unlockedAch = LL.Progress.checkAchievements();

      this.lastResult = {
        win: true, score: this.score, stars: stars,
        questsNew: Math.max(0, questsAfter - questsBefore),
        achievements: unlockedAch,
        level: this.level, levelIndex: this.levelIndex,
        daily: isDaily, dailyFirst: dailyFirst,
        newBest: isDaily ? dailyNewBest : rec.newBest,
        unlockedNext: rec ? rec.unlockedNext : false,
        best: isDaily ? dailyBest : LL.Progress.bestOf(this.level.id),
        isLast: !isDaily && this.levelIndex >= LL.LEVELS.length - 1,
        coins: payout.added, coinsWanted: coins, coinsCapped: payout.capped,
        milestone: milestone, milestoneCoins: CFG.ECON.MILESTONE_COINS,
        replay: !isDaily && prevStars > 0,
        coinTotal: LL.Progress.data.coins
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
        isLast: this.levelIndex >= LL.LEVELS.length - 1,
        coinTotal: LL.Progress.data.coins
      };
      const offer = this.reviveOffer();
      if (offer) {
        this.pendingRevive = offer;
        this.resultTimer = setTimeout(function () {
          if (self.state === 'lost') LL.UI.showRevive(offer);
        }, 950);
      } else {
        this.resultTimer = setTimeout(function () {
          if (self.state === 'lost') LL.UI.showResult(self.lastResult);
        }, 900);
      }
    },

    /* ---------------- 续步救援 ----------------
     * 只把「差一点」变成继续玩：完成度不足、或买不起时不推销，
     * 同一次挑战内第 3 次直接免费送（怜悯机制，避免逼氪感）。 */

    reviveOffer() {
      const R = CFG.ECON.REVIVE;
      if (this.progressRatio() < R.minProgress) return null;
      const used = this.reviveUsed || 0;
      const free = (used + 1) >= R.freeFrom;
      const cost = free ? 0 : (R.cost + R.step * used);
      if (!free && LL.Progress.data.coins < cost) return null;
      return { cost: cost, free: free, moves: R.moves, used: used, ratio: this.progressRatio() };
    },

    revive() {
      const offer = this.pendingRevive;
      if (!offer) return false;
      if (offer.cost > 0 && !LL.Progress.spendCoins(offer.cost)) return false;
      this.pendingRevive = null;
      this.reviveUsed = (this.reviveUsed || 0) + 1;
      LL.Progress.addRevive(this.level.id);
      LL.Progress.bumpStat('revives', 1);
      this.movesLeft += offer.moves;
      LL.HUD.setMoves(this.movesLeft);
      this.state = 'playing';
      LL.UI.hideRevive();
      LL.Audio.play('star', { rate: 1.05, vol: 0.9 });
      LL.HUD.banner('+' + offer.moves + ' ' + I18N.t('moves'), I18N.t('reviveGo'), 1400);
      this.notifyInput();
      return true;
    },

    declineRevive() {
      this.pendingRevive = null;
      LL.UI.hideRevive();
      LL.UI.showResult(this.lastResult);
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
        if (this.introT <= 0) {
          this.state = 'playing';
          this.notifyInput();
          this.maybeShowSkillIntro();
        }
      }

      /* 限时模式：只在玩家可操作时走表，连锁动画不吞时间 */
      if (this.timed && this.state === 'playing') {
        this.timeLeft -= dt / 1000;
        LL.HUD.setTimeLeft(this.timeLeft);
        if (this.timeLeft <= 0) {
          this.timeLeft = 0;
          LL.HUD.setTimeLeft(0);
          this.runOver();
          return;
        }
      }

      if (this.state === 'playing') {
        this.idleT += dt;
        if (!this.hint && !this.aim && this.idleT > CFG.HINT_DELAY) {
          /* 提示要给「最优解」，不是「扫到的第一个三连」——
           * 玩家卡了这么久，说明他在找最优走法，此时指一个没营养的位置是在帮倒忙。
           * 评判标准与平衡模拟器共用一份（见 hint.js）。 */
          const pick = Hint.best(this.board, this.level);
          if (pick) {
            this.hint = { a: pick.a, b: pick.b, why: pick.why, score: pick.score };
            this.hintTipT = CFG.HINT_TIP_DELAY;
          }
        }
        /* 还没动手就再补一句「为什么推荐它」，讲清收益点而不只是画个框 */
        if (this.hint && this.hint.why && this.idleT > CFG.HINT_DELAY) {
          this.hintTipT -= dt;
          if (this.hintTipT <= 0) {
            this.hintTipT = CFG.HINT_TIP_EVERY;
            const mid = LL.Render.cellXY(this.hint.a.r, this.hint.a.c);
            const mid2 = LL.Render.cellXY(this.hint.b.r, this.hint.b.c);
            LL.Anim.text((mid.x + mid2.x) / 2, (mid.y + mid2.y) / 2 - LL.Render.geom.cell * 0.7,
              I18N.t(Hint.reasonKey(this.hint.why)),
              { size: 20, color: '#5E4A22', life: 1600, stroke: '#FFF8E6' });
          }
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
        /* 限时模式的格子里显示的是秒数，不能再用步数覆盖（否则每帧被刷回占位值） */
        if (!this.timed) LL.HUD.setMoves(Math.max(0, this.movesLeft));
      }
    },

    draw() {
      LL.Render.draw(this.view());
    }
  };

  LL.Game = Game;
})(typeof globalThis !== 'undefined' ? globalThis : this);
