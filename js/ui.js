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
        checkinDot: $('#checkinDot')
      };

      /* 标题页 */
      U.on($('#btnPlay'), 'click', function () {
        LL.Audio.play('click');
        const idx = Math.max(0, LL.Progress.continueLevel() - 1);
        LL.Game.startLevel(idx);
      });
      U.on($('#btnLevels'), 'click', function () { LL.Audio.play('click'); self.toMap(); });
      U.on($('#btnSet'), 'click', function () { LL.Audio.play('click'); self.showSettings('title'); });

      /* 每日挑战 / 签到 */
      U.on($('#btnDaily'), 'click', function () { LL.Audio.play('click'); self.showDaily(); });
      U.on($('#btnDailyClose'), 'click', function () { LL.Audio.play('click'); self.hideDaily(); });
      U.on($('#btnDailyPlay'), 'click', function () {
        LL.Audio.play('click');
        self.hideDaily();
        LL.Game.startDaily();
      });
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
      U.on(this.els.btnResNext, 'click', function () { LL.Audio.play('click'); self.hideResult(); LL.Game.nextLevel(); });
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
      }
      if (name !== 'game' && name !== 'settings') U.show(this.els.settings, false);
      U.show(this.els.hud, name === 'game');
      if (name === 'game') LL.HUD.hideBanner();
      if (name === 'map') this.buildMap();
      if (name !== 'daily') U.show(this.els.daily, false);
      if (name !== 'checkin') U.show(this.els.checkin, false);
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
        row.appendChild(U.el('span', 's-reward', '+' + U.fmt(reward)));
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
      this.els.resTitle.textContent = win ? I18N.t('win') : I18N.t('lose');
      const tips = I18N.t(win ? 'winTips' : 'loseTips');
      const tipList = Array.isArray(tips) ? tips : [tips];
      this.els.resTip.textContent = tipList[(Math.random() * tipList.length) | 0];
      this.els.resScore.textContent = U.fmt(data.score);
      this.els.resBest.textContent = I18N.t('bestScore') + ' ' + U.fmt(data.best || 0);
      U.show(this.els.resBadge, !!data.newBest);
      if (data.newBest) this.els.resBadge.textContent = I18N.t('newBest');

      /* 金币与备注 */
      U.show(this.els.resCoinRow, !!win);
      if (win) this.els.resCoins.textContent = '+' + U.fmt(data.coins || 0);
      const notes = [];
      if (data.milestone > 0) notes.push(I18N.t('milestoneNote', { n: U.fmt(data.milestoneCoins * data.milestone) }));
      if (data.coinsCapped) notes.push(I18N.t('coinsCapped'));
      if (data.replay) notes.push(I18N.t('replayNote'));
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

      this.els.btnResNext.textContent = data.isLast ? I18N.t('toMap') : I18N.t('next');
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
