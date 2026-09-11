/* 玲珑消 · ui.js — 界面流转：标题 / 关卡地图 / 暂停 / 结算 / 设置 / 确认框 */
(function (global) {
  'use strict';
  const LL = (global.LL = global.LL || {});
  const U = LL.U;
  const I18N = LL.I18N;
  const CFG = LL.CFG;

  const UI = {
    els: {},
    confirmCb: null,
    settingsFrom: 'title',

    init() {
      const $ = U.$;
      const self = this;
      this.els = {
        loading: $('#loading'),
        loadBar: $('#loadBar'),
        loadText: $('#loadText'),
        title: $('#title'),
        map: $('#map'),
        pause: $('#pause'),
        result: $('#result'),
        settings: $('#settings'),
        confirm: $('#confirm'),
        confirmText: $('#confirmText'),
        hud: $('#hud'),
        mapGrid: $('#mapGrid'),
        mapStars: $('#mapStars'),
        resTitle: $('#resTitle'),
        resTip: $('#resTip'),
        resStars: $('#resStars'),
        resScore: $('#resScore'),
        resBest: $('#resBest'),
        resBadge: $('#resBadge'),
        btnResNext: $('#btnResNext'),
        banner: $('#banner'),
        revive: $('#revive'),
        reviveMsg: $('#reviveMsg'),
        reviveCost: $('#reviveCost'),
        btnReviveYes: $('#btnReviveYes'),
        resCoins: $('#resCoins'),
        resCoinRow: $('#resCoinRow'),
        resNote: $('#resNote'),
        titleCoins: $('#titleCoins'),
        mapCoins: $('#mapCoins'),
        daily: $('#daily'),
        dailyState: $('#dailyState'),
        dailyCal: $('#dailyCal'),
        dailyNote: $('#dailyNote'),
        btnDailyPlay: $('#btnDailyPlay'),
        dailyDot: $('#dailyDot'),
        checkin: $('#checkin'),
        streakRows: $('#streakRows'),
        streakTotal: $('#streakTotal'),
        claimNote: $('#claimNote'),
        btnClaim: $('#btnClaim'),
        checkinDot: $('#checkinDot'),
        quests: $('#quests'),
        questRows: $('#questRows'),
        questBonus: $('#questBonus'),
        btnQuestAll: $('#btnQuestAll'),
        questDot: $('#questDot'),
        boostSlots: $('#boostSlots'),
        boostNote: $('#boostNote'),
        mapTabs: $('#mapTabs'),
        paneCampaign: $('#paneCampaign'),
        paneEndless: $('#paneEndless'),
        paneTimed: $('#paneTimed'),
        endlessStats: $('#endlessStats'),
        timedStats: $('#timedStats'),
        paneAchievements: $('#paneAchievements'),
        scrollArt: $('#scrollArt'),
        scrollTitle: $('#scrollTitle'),
        scrollHint: $('#scrollHint'),
        achHead: $('#achHead'),
        achList: $('#achList'),
        skillBar: $('#skillBar'),
        qiFill: $('#qiFill'),
        qiValue: $('#qiValue'),
        qiGain: $('#qiGain'),
        skillSlots: $('#skillSlots'),
        colorRing: $('#colorRing'),
        skillNote: $('#skillNote'),
        lastStand: $('#lastStand'),
        lastStandMsg: $('#lastStandMsg'),
        lastStandCost: $('#lastStandCost'),
        btnLastStandYes: $('#btnLastStandYes')
      };

      /* 标题页 */
      U.on($('#btnPlay'), 'click', function () {
        LL.Audio.play('click');
        const idx = Math.max(0, LL.Progress.continueLevel() - 1);
        LL.Game.startLevel(idx);
      });
      U.on($('#btnLevels'), 'click', function () { LL.Audio.play('click'); self.toMap(); });

      /* 关卡地图的模式分页 */
      U.$$('#mapTabs button').forEach(function (btn) {
        U.on(btn, 'click', function () { self.showTab(btn.getAttribute('data-tab')); });
      });
      U.on($('#btnEndlessStart'), 'click', function () {
        LL.Audio.play('click');
        LL.Game.startEndless(1);
      });
      U.on($('#btnTimedStart'), 'click', function () {
        LL.Audio.play('click');
        LL.Game.startTimed();
      });
      U.on($('#btnSet'), 'click', function () { LL.Audio.play('click'); self.showSettings('title'); });

      /* 每日挑战 / 签到 */
      U.on($('#btnDaily'), 'click', function () { LL.Audio.play('click'); self.showDaily(); });
      U.on($('#btnDailyClose'), 'click', function () { LL.Audio.play('click'); self.hideDaily(); });
      U.on($('#btnDailyPlay'), 'click', function () {
        LL.Audio.play('click');
        self.hideDaily();
        LL.Game.startDaily();
      });
      /* 每日任务 */
      U.on($('#btnQuests'), 'click', function () { LL.Audio.play('click'); self.showQuests(); });
      U.on($('#btnQuestsClose'), 'click', function () { LL.Audio.play('click'); self.hideQuests(); });
      U.on($('#btnQuestAll'), 'click', function () { self.claimAllQuests(); });

      U.on($('#btnCheckin'), 'click', function () { LL.Audio.play('click'); self.showCheckin(); });
      U.on($('#btnCheckinClose'), 'click', function () { LL.Audio.play('click'); self.hideCheckin(); });
      U.on($('#btnClaim'), 'click', function () { self.claimStreak(); });

      /* 关卡地图 */
      U.on($('#btnMapBack'), 'click', function () { LL.Audio.play('click'); self.showScreen('title'); });

      /* HUD */
      U.on($('#btnPause'), 'click', function () { LL.Audio.play('click'); LL.Game.pause(); });
      U.on($('#btnSound'), 'click', function () { self.toggleMute(); });

      /* 暂停面板 */
      U.on($('#btnResume'), 'click', function () { LL.Audio.play('click'); LL.Game.resume(); });
      U.on($('#btnPauseRetry'), 'click', function () { LL.Audio.play('click'); self.hidePause(); LL.Game.restart(); });
      U.on($('#btnPauseMap'), 'click', function () { LL.Audio.play('click'); self.hidePause(); self.toMap(); });
      U.on($('#btnPauseSet'), 'click', function () { LL.Audio.play('click'); self.showSettings('pause'); });

      /* 结算面板 */
      U.on($('#btnResRetry'), 'click', function () { LL.Audio.play('click'); self.hideResult(); LL.Game.restart(); });
      U.on(this.els.btnResNext, 'click', function () {
        LL.Audio.play('click');
        self.hideResult();
        const last = LL.Game.lastResult;
        if (last && last.mode) LL.Game.restartRun();   /* 无尽 / 限时：再来一局 */
        else LL.Game.nextLevel();
      });
      U.on($('#btnResMap'), 'click', function () { LL.Audio.play('click'); self.hideResult(); self.toMap(); });

      /* 设置面板 */
      U.on($('#setVolume'), 'input', function (e) {
        LL.Progress.settings.volume = e.target.value / 100;
        LL.Audio.setVolume(LL.Progress.settings.volume);
        LL.Progress.saveSettings();
      });
      U.on($('#setMute'), 'click', function () { self.toggleMute(); });
      U.on($('#setLang'), 'click', function () {
        LL.Progress.settings.lang = (LL.Progress.settings.lang === 'zh') ? 'en' : 'zh';
        LL.Progress.saveSettings();
        LL.Audio.play('click');
        self.applyLang();
      });
      U.on($('#btnReset'), 'click', function () {
        self.confirm(I18N.t('resetConfirm'), function () {
          LL.Progress.resetAll();
          self.buildMap();
          LL.HUD.setup(LL.Game.level || LL.LEVELS[0], 0);
          LL.Audio.play('click');
        });
      });
      U.on($('#btnSetClose'), 'click', function () { LL.Audio.play('click'); self.hideSettings(); });

      /* 失败救援（续步） */
      U.on($('#btnReviveYes'), 'click', function () {
        if (!LL.Game.revive()) {
          self.updateCoins();
          self.refreshReviveCost();
        }
      });
      U.on($('#btnReviveNo'), 'click', function () {
        LL.Audio.play('click');
        LL.Game.declineRevive();
      });

      /* 绝处逢生（灵力换步数） */
      U.on($('#btnLastStandYes'), 'click', function () {
        LL.Game.useLastStand();
      });
      U.on($('#btnLastStandNo'), 'click', function () {
        LL.Audio.play('click');
        LL.Game.declineLastStand();
      });
      /* 窄屏横竖屏切换时技能栏高度会变，棋盘保留区要跟着重算 */
      U.on(global, 'resize', function () { self.syncBoardInset(); });

      /* 确认框 */
      U.on($('#btnConfirmYes'), 'click', function () {
        LL.Audio.play('click');
        const cb = self.confirmCb; self.confirmCb = null;
        U.show(self.els.confirm, false);
        if (cb) cb();
      });
      U.on($('#btnConfirmNo'), 'click', function () {
        LL.Audio.play('click');
        self.confirmCb = null;
        U.show(self.els.confirm, false);
      });

      this.buildMap();
      this.updateSoundBtn();
    },

    /* ---------- 屏幕切换 ---------- */

    showScreen(name) {
      U.show(this.els.loading, name === 'loading');
      U.show(this.els.title, name === 'title');
      U.show(this.els.map, name === 'map');
      if (name !== 'game') {
        U.show(this.els.pause, false);
        U.show(this.els.result, false);
        U.show(this.els.revive, false);
        U.show(this.els.lastStand, false);
      }
      if (name !== 'game' && name !== 'settings') U.show(this.els.settings, false);
      U.show(this.els.hud, name === 'game');
      U.show(this.els.skillBar, name === 'game');
      if (name === 'game') { LL.HUD.hideBanner(); this.syncBoardInset(); }
      if (name === 'map') { this.buildMap(); this.buildBoostBar(); }
      if (name !== 'daily') U.show(this.els.daily, false);
      if (name !== 'checkin') U.show(this.els.checkin, false);
      if (name !== 'quests') U.show(this.els.quests, false);
      this.updateCoins();
      this.updateBadges();
      /* 信息栏的显隐会改变棋盘可用区域，必须重新排版画布 */
      LL.Render.resize();
    },

    hideOverlays() {
      U.show(this.els.pause, false);
      U.show(this.els.result, false);
      U.show(this.els.settings, false);
      U.show(this.els.map, false);
      U.show(this.els.title, false);
      U.show(this.els.loading, false);
      U.show(this.els.hud, true);
      LL.Render.resize();
    },

    toMap() {
      LL.Game.state = 'idle';
      LL.HUD.hideBanner();
      U.show(this.els.hud, false);
      this.showScreen('map');
      this.buildBoostBar();
    },

    /* ---------- 关卡地图 ---------- */

    buildMap() {
      const grid = this.els.mapGrid;
      if (!grid) return;
      grid.innerHTML = '';
      const current = LL.Progress.continueLevel();
      const self = this;
      LL.LEVELS.forEach(function (lv, i) {
        const unlocked = LL.Progress.isUnlocked(lv.id);
        const stars = LL.Progress.starsOf(lv.id);
        const isCurrent = unlocked && lv.id === current;
        const cls = 'lv-card' + (unlocked ? '' : ' locked') +
          (stars > 0 ? ' done' : '') + (isCurrent ? ' current' : '');
        const btn = U.el('button', cls);
        const no = U.el('div', 'lv-no', String(lv.id));
        const nm = U.el('div', 'lv-name', I18N.levelName(lv));
        const st = U.el('div', 'lv-stars');
        for (let s = 1; s <= 3; s++) {
          const img = document.createElement('img');
          img.src = LL.Assets.path(s <= stars ? 'ui_star' : 'ui_star_off');
          img.alt = '';
          st.appendChild(img);
        }
        btn.appendChild(no);
        btn.appendChild(nm);
        btn.appendChild(st);
        if (isCurrent) btn.appendChild(U.el('div', 'lv-badge', I18N.t('continue')));
        if (unlocked) {
          btn.addEventListener('click', function () {
            LL.Audio.play('click');
            LL.Game.startLevel(i);
          });
        } else {
          btn.disabled = true;
          btn.setAttribute('aria-label', I18N.t('locked'));
          const lk = U.el('div', 'lv-lock');
          lk.innerHTML = '<img src="' + LL.Assets.path('ui_lock') + '" alt="">';
          btn.appendChild(lk);
        }
        grid.appendChild(btn);
      });
      if (this.els.mapStars) {
        this.els.mapStars.textContent = I18N.t('totalStars', {
          n: LL.Progress.totalStars() + ' / ' + LL.Progress.maxStars()
        });
      }
      void self;
    },

    /* ---------- 金币显示 ---------- */

    updateCoins() {
      const n = LL.Progress.data.coins || 0;
      [this.els.titleCoins, this.els.mapCoins].forEach(function (pill) {
        if (!pill) return;
        const b = pill.querySelector('b');
        if (b) b.textContent = U.fmt(n);
      });
    },

    /* ---------- 关卡地图的模式分页 ---------- */

    showTab(tab) {
      const panes = {
        campaign: this.els.paneCampaign, endless: this.els.paneEndless,
        timed: this.els.paneTimed, achievements: this.els.paneAchievements
      };
      U.$$('#mapTabs button').forEach(function (btn) {
        btn.classList.toggle('on', btn.getAttribute('data-tab') === tab);
      });
      for (const k in panes) {
        if (panes[k]) U.show(panes[k], k === tab);
      }
      if (tab === 'endless') this.buildEndlessPane();
      if (tab === 'timed') this.buildTimedPane();
      if (tab === 'achievements') this.buildAchievementsPane();
      if (tab === 'campaign') this.buildBoostBar();
    },

    /* ---------- 成就与画卷 ---------- */

    buildAchievementsPane() {
      const P = LL.Progress;
      const A = LL.Achievements;
      const stars = P.totalStars();
      const tier = A.scrollTier(stars);

      /* 画卷：按星数逐层显现 */
      U.$$('#scrollArt img').forEach(function (img) {
        const n = parseInt(img.getAttribute('data-tier'), 10);
        img.classList.toggle('on', n <= tier);
      });
      this.els.scrollTitle.textContent = I18N.t('scrollTitle');
      const next = A.nextScrollGoal(stars);
      this.els.scrollHint.textContent = next
        ? I18N.t('scrollHint', { n: stars, m: next - stars })   /* m 是「还差多少」，不是门槛值 */
        : I18N.t('scrollDone', { n: stars });

      const got = P.achievementCount();
      this.els.achHead.textContent = I18N.t('achHead', { n: got, m: A.LIST.length });
      const list = this.els.achList;
      list.innerHTML = '';
      A.LIST.forEach(function (a) {
        const on = !!P.achievementOf(a.id);
        const row = U.el('div', 'ach-row' + (on ? ' on' : ''));
        row.innerHTML =
          '<img class="ach-icon" src="' + LL.Assets.path(a.icon || 'ui_medal') + '" alt="">' +
          '<div class="ach-body"><div class="ach-name">' + I18N.t('ach_' + a.id) + '</div>' +
          '<div class="ach-desc">' + I18N.t('ach_' + a.id + '_d') + '</div></div>' +
          '<div class="ach-coin">' + (on ? I18N.t('achGot') : '+' + a.coins) + '</div>';
        list.appendChild(row);
      });
    },

    buildEndlessPane() {
      const e = LL.Progress.data.endless || {};
      const self = this;
      const rows = [
        [I18N.t('bestStage'), (e.bestStage || 0) + ' ' + I18N.t('stageUnit')],
        [I18N.t('bestScore'), U.fmt(e.bestScore || 0)],
        [I18N.t('weekBest'), (Math.max(0, e.weekBest || 0)) + ' ' + I18N.t('stageUnit')],
        [I18N.t('runsCount'), String(e.runs || 0)]
      ];
      this.els.endlessStats.innerHTML = rows.map(function (r) {
        return '<div class="ms-row"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>';
      }).join('');
      void self;
    },

    buildTimedPane() {
      const t = LL.Progress.data.timed || {};
      const tiers = LL.Modes.CFG.timed;
      const rows = [
        [I18N.t('bestScore'), U.fmt(t.best || 0)],
        [I18N.t('runsCount'), String(t.runs || 0)],
        [I18N.t('timedTiers'), tiers.tiers.map(function (v, i) {
          return U.fmt(v) + ' → ' + tiers.coins[i];
        }).join('　')]
      ];
      this.els.timedStats.innerHTML = rows.map(function (r) {
        return '<div class="ms-row"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>';
      }).join('');
    },

    /* ---------- 暂停 ---------- */

    showPause() { U.show(this.els.pause, true); },
    hidePause() { U.show(this.els.pause, false); },

    togglePause() {
      if (LL.Game.state === 'paused') LL.Game.resume();
      else LL.Game.pause();
    },

    /* ---------- 每日任务 ---------- */

    showQuests() {
      this.buildQuests();
      U.show(this.els.quests, true);
    },

    hideQuests() { U.show(this.els.quests, false); },

    buildQuests() {
      const P = LL.Progress;
      const st = P.questState();
      const rows = this.els.questRows;
      if (!rows) return;
      const self = this;
      rows.innerHTML = '';
      st.list.forEach(function (q, i) {
        const cur = st.progress[i] || 0;
        const done = st.done[i], claimed = st.claimed[i];
        const row = U.el('div', 'quest-row' + (done ? ' done' : '') + (claimed ? ' claimed' : ''));
        const head = U.el('div', 'q-head');
        head.appendChild(U.el('span', 'q-name', LL.Quests.describe(q, I18N)));
        head.appendChild(U.el('span', 'q-reward', '+' + (LL.CFG.QUESTS.reward[q.tier] || 20)));
        row.appendChild(head);

        const bar = U.el('div', 'q-bar');
        const fill = U.el('i');
        fill.style.width = (q.target ? Math.min(100, cur / q.target * 100) : 0).toFixed(0) + '%';
        if (done) fill.className = 'full';
        bar.appendChild(fill);
        row.appendChild(bar);

        const foot = U.el('div', 'q-foot');
        foot.appendChild(U.el('span', 'q-prog', LL.Quests.progressText(q, cur, I18N)));
        if (claimed) {
          foot.appendChild(U.el('span', 'q-state ok', I18N.t('questClaimed')));
        } else if (done) {
          const btn = U.el('button', 'q-claim', I18N.t('questClaim'));
          btn.type = 'button';
          btn.addEventListener('click', function () { self.claimQuest(i); });
          foot.appendChild(btn);
        } else {
          const rb = U.el('button', 'q-reroll', I18N.t('questReroll'));
          rb.type = 'button';
          rb.disabled = st.rerolls <= 0;
          rb.classList.toggle('disabled', st.rerolls <= 0);
          rb.addEventListener('click', function () { self.rerollQuest(i); });
          foot.appendChild(rb);
        }
        row.appendChild(foot);
        rows.appendChild(row);
      });

      this.els.questBonus.textContent = I18N.t('questBonus') + ' +' + LL.CFG.QUESTS.allDoneBonus +
        (st.bonusClaimed ? '　·　' + I18N.t('questClaimed') : '') +
        (st.rerolls > 0 ? '　·　' + I18N.t('questReroll') + ' ×' + st.rerolls : '');
      const anyClaimable = st.claimable > 0 || st.bonusClaimable;
      U.show(this.els.btnQuestAll, anyClaimable);
      this.els.btnQuestAll.textContent = I18N.t('questAll');
    },

    claimQuest(i) {
      const got = LL.Progress.claimQuest(i);
      if (got) {
        LL.Audio.play('star', { rate: 1.06, vol: 0.85 });
        this.updateCoins();
      }
      this.buildQuests();
      this.updateBadges();
    },

    claimAllQuests() {
      const st = LL.Progress.questState();
      let total = 0;
      st.list.forEach(function (q, i) {
        const r = LL.Progress.claimQuest(i);
        if (r) total += r.coins;
      });
      const b = LL.Progress.claimQuestBonus();
      if (b) total += b.coins;
      if (total > 0) {
        LL.Audio.play('star', { rate: 1.06, vol: 0.9 });
        this.updateCoins();
      }
      this.buildQuests();
      this.updateBadges();
    },

    rerollQuest(i) {
      const q = LL.Progress.rerollQuest(i);
      if (q) LL.Audio.play('click', { rate: 1.05 });
      else LL.Audio.play('invalid');
      this.buildQuests();
      this.updateBadges();
    },

    /* ---------- 开局道具 ---------- */

    buildBoostBar() {
      const slots = this.els.boostSlots;
      if (!slots) return;
      const P = LL.Progress;
      const self = this;
      slots.innerHTML = '';
      LL.CFG.BOOSTERS.order.forEach(function (id) {
        const info = LL.CFG.BOOSTERS[id];
        const count = P.boosterCount(id);
        const armed = !!(P.data.armed && P.data.armed[id]) && count > 0;
        const slot = U.el('button',
          'boost-slot' + (armed ? ' armed' : '') + (count > 0 ? '' : ' empty'));
        slot.type = 'button';
        slot.innerHTML =
          '<img src="' + LL.Assets.path(info.icon) + '" alt="">' +
          '<span class="b-name">' + I18N.t('boost_' + id) + '</span>' +
          '<span class="b-count">' + (count > 0 ? '×' + count : I18N.t('boostBuyShort')) + '</span>';
        slot.title = count > 0 ? I18N.t('boostStock', { n: count }) : I18N.t('boostEmpty');
        slot.addEventListener('click', function () { self.onBoosterTap(id); });
        slots.appendChild(slot);
      });
    },

    onBoosterTap(id) {
      const P = LL.Progress;
      const info = LL.CFG.BOOSTERS[id];
      const count = P.boosterCount(id);
      if (count <= 0) {
        if (P.data.coins < info.cost) {
          LL.Audio.play('invalid');
          this.boostNote(I18N.t('boostNotEnough', { n: U.fmt(info.cost - P.data.coins) }));
          return;
        }
        const self = this;
        LL.Audio.play('click');
        this.confirm(I18N.t('boostBuyAsk', { n: U.fmt(info.cost), name: I18N.t('boost_' + id) }), function () {
          const r = P.buyBooster(id);
          if (r) {
            LL.Audio.play('star', { rate: 1.15, vol: 0.8 });
            self.buildBoostBar();
            self.updateCoins();
          }
        });
        return;
      }
      const on = !(P.data.armed && P.data.armed[id]);
      P.armBooster(id, on);
      LL.Audio.play('click', { rate: on ? 1.12 : 0.92 });
      this.buildBoostBar();
    },

    boostNote(text) {
      const el = this.els.boostNote;
      if (!el) return;
      el.textContent = text;
      U.show(el, true);
      clearTimeout(this._boostNoteTimer);
      this._boostNoteTimer = setTimeout(function () { U.show(el, false); }, 2200);
    },

    /* ---------- 局内技能（灵力） ---------- */

    /* 技能栏是 DOM、棋盘是画布：把栏高告诉渲染层，棋盘最后一行才不会被盖住 */
    syncBoardInset() {
      const bar = this.els.skillBar;
      if (!bar) return;
      LL.Render.setBottomInset(bar.offsetHeight + 16);
    },

    /* 可用/不可用是唯一需要重建 DOM 的变化，其余（灵力数字、进度条）原地更新即可 */
    skillSig() {
      const Game = LL.Game;
      return LL.Skills.order().map(function (id) {
        return LL.Skills.canUse(Game.board, Game.qi, id).ok ? '1' : '0';
      }).join('');
    },

    buildSkillBar() {
      const bar = this.els.skillBar;
      if (!bar) return;
      const Game = LL.Game;
      const SK = LL.Skills;
      const self = this;
      const max = CFG.QI.MAX;
      const qi = Game.qi || 0;

      bar.classList.toggle('full', qi >= max);
      if (this.els.qiFill) this.els.qiFill.style.width = Math.round(Math.min(1, qi / max) * 100) + '%';
      if (this.els.qiValue) this.els.qiValue.textContent = String(Math.round(qi));

      const slots = this.els.skillSlots;
      if (slots) {
        const aim = Game.aim;
        slots.innerHTML = '';
        SK.order().forEach(function (id) {
          const info = SK.def(id);
          const c = SK.canUse(Game.board, qi, id);
          const btn = U.el('button',
            'skill-slot' + (aim && aim.id === id ? ' armed' : (c.ok ? ' ready' : ' empty')));
          btn.type = 'button';
          btn.innerHTML =
            '<img src="' + LL.Assets.path(info.icon) + '" alt="">' +
            '<span class="s-cost">' + (c.cost === 0 ? I18N.t('skillFree') : c.cost) + '</span>';
          btn.title = I18N.t('skill_' + id) + ' · ' + c.cost;
          btn.addEventListener('click', function () { self.onSkillTap(id); });
          slots.appendChild(btn);
        });
      }

      /* 灵犀一点的第二步：选色环 */
      const ring = this.els.colorRing;
      if (ring) {
        const picking = !!(Game.aim && Game.aim.stage === 'color');
        U.show(ring, picking);
        if (picking) this.buildColorRing();
      }
      this._skillSig = this.skillSig();
      this.syncBoardInset();
    },

    /* 只列出本关实际存在的颜色——选了盘上没有的颜色等于白扔灵力 */
    buildColorRing() {
      const ring = this.els.colorRing;
      if (!ring) return;
      const self = this;
      const n = (LL.Game.board && LL.Game.board.colors) || CFG.TILE_KINDS;
      ring.innerHTML = '';
      for (let t = 0; t < n; t++) {
        const info = CFG.TILE_INFO[t];
        const dot = U.el('button', 'color-dot');
        dot.type = 'button';
        dot.style.background = 'radial-gradient(circle at 34% 30%, ' + info.light + ', ' + info.main + ')';
        dot.title = I18N.tileName(t);
        dot.addEventListener('click', function () { self.pickColor(t); });
        ring.appendChild(dot);
      }
    },

    pickColor(t) {
      const aim = LL.Game.aim;
      if (!aim || aim.stage !== 'color' || !aim.cell) return;
      LL.Game.castSkill('color', aim.cell, t, aim.cost);
    },

    onSkillTap(id) { LL.Game.useSkill(id); },

    /* 灵力入账的轻量更新：每次消除都会走到这里，所以不重建 DOM */
    updateQi(gained, overflowScore) {
      const bar = this.els.skillBar;
      if (!bar) return;
      const Game = LL.Game;
      const max = CFG.QI.MAX;
      const qi = Game.qi || 0;
      bar.classList.toggle('full', qi >= max);
      if (this.els.qiFill) this.els.qiFill.style.width = Math.round(Math.min(1, qi / max) * 100) + '%';
      if (this.els.qiValue) this.els.qiValue.textContent = String(Math.round(qi));

      const g = this.els.qiGain;
      if (g) {
        g.textContent = overflowScore > 0
          ? I18N.t('skillOverflow', { n: U.fmt(overflowScore) })
          : '+' + gained;
        g.classList.remove('pop');
        void g.offsetWidth;              /* 强制回流以重启动画 */
        g.classList.add('pop');
      }
      if (this.skillSig() !== this._skillSig) this.buildSkillBar();
    },

    skillNote(text) {
      const el = this.els.skillNote;
      if (!el || !text) return;
      el.textContent = text;
      U.show(el, true);
      clearTimeout(this._skillNoteTimer);
      this._skillNoteTimer = setTimeout(function () { U.show(el, false); }, 2200);
    },

    /* ---------- 绝处逢生 ---------- */

    showLastStand(offer) {
      const el = this.els.lastStand;
      if (!el) return;
      if (this.els.lastStandMsg) {
        this.els.lastStandMsg.textContent = I18N.t('lastStandMsg', { n: offer.cost, m: offer.moves });
      }
      if (this.els.lastStandCost) {
        this.els.lastStandCost.textContent = I18N.t('lastStandCost',
          { n: offer.cost, m: Math.round((LL.Game.qi || 0) - offer.cost) });
      }
      if (this.els.btnLastStandYes) {
        this.els.btnLastStandYes.textContent = I18N.t('lastStandYes', { n: offer.cost, m: offer.moves });
      }
      LL.Audio.play('star', { rate: 0.94, vol: 0.9 });
      U.show(el, true);
    },

    hideLastStand() { U.show(this.els.lastStand, false); },

    /* ---------- 每日挑战 ---------- */

    toTitle() {
      LL.Game.state = 'idle';
      LL.HUD.hideBanner();
      U.show(this.els.hud, false);
      this.showScreen('title');
    },

    showDaily() {
      this.buildDaily();
      U.show(this.els.daily, true);
    },

    hideDaily() { U.show(this.els.daily, false); },

    buildDaily() {
      const P = LL.Progress;
      const today = P.todayKey();
      const stars = P.dailyStars(today);
      const d = P.data.daily || {};
      const st = this.els.dailyState;
      st.innerHTML = '';
      const line = U.el('div', 'daily-line' + (stars > 0 ? ' done' : ''),
        stars > 0 ? I18N.t('dailyClearedToday', { n: stars }) : I18N.t('dailyNotYet'));
      st.appendChild(line);
      st.appendChild(U.el('div', 'daily-sub',
        I18N.t('dailyTimes', { n: d.plays || 0 }) + '　·　' + I18N.t('dailyBest', { n: U.fmt(d.best || 0) })));

      /* 本月日历：每格显示日期 + 三颗小点表示星级 */
      const now = new Date();
      const year = now.getFullYear(), month = now.getMonth() + 1;
      const cells = P.dailyMonth(year, month);
      const cal = this.els.dailyCal;
      cal.innerHTML = '';
      const wd = I18N.t('weekdays');
      for (let i = 0; i < 7; i++) cal.appendChild(U.el('div', 'cal-w', wd[i] || ''));
      const firstDow = new Date(year, month - 1, 1).getDay();
      for (let i = 0; i < firstDow; i++) cal.appendChild(U.el('div', 'cal-cell empty'));
      let doneDays = 0;
      cells.forEach(function (c) {
        if (c.stars > 0) doneDays++;
        const cls = 'cal-cell' + (c.dayKey === today ? ' today' : '') +
          (c.stars > 0 ? ' done' : '') + (c.stars === 0 && c.dayKey > today ? ' future' : '');
        const cell = U.el('div', cls);
        cell.appendChild(U.el('b', null, String(c.day)));
        const dots = U.el('i', 'cal-stars');
        for (let s = 1; s <= 3; s++) dots.appendChild(U.el('s', s <= c.stars ? 'on' : null));
        cell.appendChild(dots);
        cal.appendChild(cell);
      });

      this.els.dailyNote.textContent =
        I18N.t('dailyMonthDone', { n: doneDays }) + '　·　' +
        I18N.t('dailyHint', { n: LL.Daily.FIRST_CLEAR_COINS, m: LL.Daily.STAR_BONUS_COINS });
      this.els.btnDailyPlay.textContent = stars > 0 ? I18N.t('dailyReplay') : I18N.t('dailyPlay');
    },

    /* ---------- 连续签到 ---------- */

    showCheckin() {
      this.buildCheckin();
      U.show(this.els.checkin, true);
    },

    hideCheckin() { U.show(this.els.checkin, false); },

    /* 签到奖励现在是「金币 + 道具」的混合结构，不能直接当数字格式化（会变成 +NaN） */
    streakRewardLabel(reward) {
      if (!reward) return '';
      if (typeof reward === 'number') return '+' + U.fmt(reward);
      const parts = [];
      if (reward.coins) parts.push('+' + U.fmt(reward.coins));
      if (reward.booster) parts.push(I18N.t('boost_' + reward.booster));
      if (reward.boosters && reward.boosters.length) parts.push(I18N.t('boostBundle', { n: reward.boosters.length }));
      return parts.join('　');
    },

    buildCheckin() {
      const P = LL.Progress;
      const st = P.streakStatus();
      const rows = this.els.streakRows;
      rows.innerHTML = '';
      /* 未签到时，今天这一格之前的都算已领（漏签一天会停在同一天，不算断） */
      const claimedUpTo = st.dayIndex - 1;
      for (let i = 1; i <= LL.CFG.STREAK.REWARDS.length; i++) {
        const reward = LL.CFG.STREAK.REWARDS[i - 1];
        let state;
        if (st.claimed) state = i <= st.dayIndex ? 'done' : 'future';
        else state = i <= claimedUpTo ? 'done' : (i === st.dayIndex ? 'today' : 'future');
        const row = U.el('div', 'streak-row ' + state);
        row.appendChild(U.el('span', 's-day', I18N.t('streakDay', { n: i })));
        row.appendChild(U.el('span', 's-reward', this.streakRewardLabel(reward)));
        row.appendChild(U.el('span', 's-state', I18N.t(
          state === 'done' ? 'streakClaimed' : (state === 'today' ? 'streakToday' : 'streakFuture'))));
        rows.appendChild(row);
      }
      const nxt = [7, 30, 100].filter(function (n) { return n > (st.total || 0); })[0];
      this.els.streakTotal.textContent =
        I18N.t('streakTotal', { n: st.total || 0, m: st.best || 0 }) +
        (nxt ? '　·　' + I18N.t('streakNext', { n: nxt }) : '') +
        (st.paused ? '　·　' + I18N.t('streakPaused') : '');
      this.els.btnClaim.textContent = st.claimed ? I18N.t('claimed') : I18N.t('claim');
      this.els.btnClaim.disabled = !!st.claimed;
      this.els.btnClaim.classList.toggle('disabled', !!st.claimed);
      U.show(this.els.claimNote, false);
    },

    claimStreak() {
      const got = LL.Progress.claimStreak();
      if (!got) return;
      LL.Audio.play('star', { rate: 1.08, vol: 0.9 });
      this.els.claimNote.textContent = I18N.t('claimGot', { n: U.fmt(got.coins) }) +
        (got.milestone ? '　·　' + I18N.t('claimMilestone', { n: got.total, m: U.fmt(got.milestone) }) : '');
      U.show(this.els.claimNote, true);
      this.buildCheckin();
      U.show(this.els.claimNote, true);
      this.updateCoins();
      this.updateBadges();
    },

    /* 标题页上的小红点：有可领的签到 / 今日每日挑战尚未通关 */
    updateBadges() {
      const P = LL.Progress;
      const st = P.streakStatus();
      U.show(this.els.checkinDot, !st.claimed);
      U.show(this.els.dailyDot, P.dailyStars(P.todayKey()) === 0);
      const qs = P.questState();
      U.show(this.els.questDot, qs.claimable > 0 || qs.bonusClaimable);
    },

    /* ---------- 失败救援（续步） ---------- */

    showRevive(offer) {
      if (!offer) return;
      this.els.reviveMsg.textContent = I18N.t('reviveMsg', {
        n: Math.round(offer.ratio * 100), m: offer.moves
      });
      this.refreshReviveCost(offer);
      U.show(this.els.revive, true);
      this.updateCoins();
    },

    refreshReviveCost(offer) {
      const o = offer || LL.Game.pendingRevive;
      if (!o) return;
      const coins = LL.Progress.data.coins || 0;
      if (o.free) {
        this.els.reviveCost.textContent = I18N.t('reviveFree');
        this.els.btnReviveYes.textContent = I18N.t('reviveBuyFree');
      } else {
        this.els.reviveCost.textContent = I18N.t('reviveCost', { n: U.fmt(o.cost) }) +
          '　·　' + I18N.t('coins') + ' ' + U.fmt(coins);
        this.els.btnReviveYes.textContent = I18N.t('reviveBuy', { n: U.fmt(o.cost) });
      }
      this.els.btnReviveYes.disabled = !o.free && coins < o.cost;
      this.els.btnReviveYes.classList.toggle('disabled', this.els.btnReviveYes.disabled);
    },

    hideRevive() { U.show(this.els.revive, false); },

    /* ---------- 结算 ---------- */

    showResult(data) {
      if (!data) return;
      const self = this;
      const win = data.win;
      const mode = data.mode || null;
      if (mode === 'endless') {
        this.els.resTitle.textContent = I18N.t('endlessOver');
        this.els.resTip.textContent = I18N.t('endlessOverTip', { n: data.stage });
      } else if (mode === 'timed') {
        this.els.resTitle.textContent = I18N.t('timedOver');
        this.els.resTip.textContent = I18N.t('timedOverTip');
      } else {
        this.els.resTitle.textContent = win ? I18N.t('win') : I18N.t('lose');
        const tips = I18N.t(win ? 'winTips' : 'loseTips');
        const tipList = Array.isArray(tips) ? tips : [tips];
        this.els.resTip.textContent = tipList[(Math.random() * tipList.length) | 0];
      }
      U.show(this.els.resStars, !mode);
      this.els.resScore.textContent = U.fmt(data.score);
      this.els.resBest.textContent = mode === 'endless'
        ? I18N.t('bestStage') + ' ' + (data.best || 0) + ' ' + I18N.t('stageUnit')
        : I18N.t('bestScore') + ' ' + U.fmt(data.best || 0);
      U.show(this.els.resBadge, !!data.newBest);
      if (data.newBest) this.els.resBadge.textContent = I18N.t('newBest');

      /* 金币与备注 */
      U.show(this.els.resCoinRow, !!(win || (data.coins > 0)));
      this.els.resCoins.textContent = '+' + U.fmt(data.coins || 0);
      const notes = [];
      if (data.milestone > 0) notes.push(I18N.t('milestoneNote', { n: U.fmt(data.milestoneCoins * data.milestone) }));
      if (data.coinsCapped) notes.push(I18N.t('coinsCapped'));
      if (data.replay) notes.push(I18N.t('replayNote'));
      if (mode === 'endless') notes.push(I18N.t('endlessCoinNote', { n: LL.Modes.CFG.endless.coinsPerStage }));
      if (mode === 'timed') notes.push(I18N.t('timedCoinNote', { n: LL.Modes.CFG.timed.coins.join(' / ') }));
      if (notes.length) {
        this.els.resNote.textContent = notes.join('　·　');
        U.show(this.els.resNote, true);
      } else {
        U.show(this.els.resNote, false);
      }
      this.updateCoins();

      /* 视觉的逐颗点亮由 CSS 的 animation-delay 负责（0 / .12s / .24s），
       * 这里只负责让音效跟着同一节奏响起 */
      const starEls = U.$$('.res-star', this.els.resStars);
      starEls.forEach(function (el, i) {
        el.classList.toggle('on', i < data.stars);
      });
      for (let i = 0; i < data.stars; i++) {
        setTimeout(function () {
          LL.Audio.play('star', { rate: 1 + i * 0.05, vol: 0.9 });
        }, 300 + i * 120);
      }

      this.els.btnResNext.textContent = mode ? I18N.t('playAgain')
        : (data.isLast ? I18N.t('toMap') : I18N.t('next'));
      U.show(this.els.result, true);
      void self;
    },

    hideResult() { U.show(this.els.result, false); },

    /* ---------- 设置 ---------- */

    showSettings(from) {
      this.settingsFrom = from || 'title';
      U.show(this.els.settings, true);
      this.syncSettingsUI();
    },

    hideSettings() {
      U.show(this.els.settings, false);
    },

    syncSettingsUI() {
      const s = LL.Progress.settings;
      const vol = U.$('#setVolume');
      if (vol) vol.value = Math.round(s.volume * 100);
      const mute = U.$('#setMute');
      if (mute) mute.textContent = s.muted ? I18N.t('off') : I18N.t('on');
      const lang = U.$('#setLang');
      if (lang) lang.textContent = s.lang === 'en' ? 'English' : '中文';
      this.updateSoundBtn();
    },

    updateSoundBtn() {
      const btn = U.$('#btnSound');
      const icon = U.$('#btnSoundIcon');
      const s = LL.Progress.settings;
      const silent = s.muted || s.volume <= 0;
      if (icon) icon.src = LL.Assets.path(silent ? 'ui_mute' : 'ui_sound');
      if (btn) {
        btn.title = silent ? I18N.t('soundOff') : I18N.t('soundOn');
        btn.setAttribute('aria-label', btn.title);
      }
    },

    toggleMute() {
      const s = LL.Progress.settings;
      s.muted = !s.muted;
      LL.Audio.setMuted(s.muted);
      LL.Progress.saveSettings();
      this.syncSettingsUI();
      if (!s.muted) LL.Audio.play('click');
    },

    /* ---------- 确认框 ---------- */

    confirm(text, onYes) {
      this.confirmCb = onYes;
      this.els.confirmText.textContent = text;
      U.$('#btnConfirmYes').textContent = I18N.t('yes');
      U.$('#btnConfirmNo').textContent = I18N.t('no');
      U.show(this.els.confirm, true);
    },

    /* ---------- 语言 ---------- */

    applyLang() {
      I18N.setLang(LL.Progress.settings.lang || 'zh');
      this.buildMap();
      this.syncSettingsUI();
      if (LL.Game.level) {
        LL.HUD.setup(LL.Game.level, LL.Game.obstTotal);
        LL.HUD.updateObjectives(LL.Game.progressList());
      }
      if (LL.Game.lastResult && !U.$('#result').classList.contains('hidden')) {
        this.showResult(LL.Game.lastResult);
      }
    },

    applySettings() {
      const s = LL.Progress.settings;
      LL.Audio.setVolume(s.volume);
      LL.Audio.setMuted(s.muted);
      this.syncSettingsUI();
    },

    setLoadProgress(p, label) {
      if (this.els.loadBar) this.els.loadBar.style.width = Math.round(p * 100) + '%';
      if (this.els.loadText && label) this.els.loadText.textContent = I18N.t('loading') + ' ' + Math.round(p * 100) + '%';
    }
  };

  LL.UI = UI;
})(typeof globalThis !== 'undefined' ? globalThis : this);
