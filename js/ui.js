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
        mapCoins: $('#mapCoins')
      };

      /* 标题页 */
      U.on($('#btnPlay'), 'click', function () {
        LL.Audio.play('click');
        const idx = Math.max(0, LL.Progress.continueLevel() - 1);
        LL.Game.startLevel(idx);
      });
      U.on($('#btnLevels'), 'click', function () { LL.Audio.play('click'); self.toMap(); });
      U.on($('#btnSet'), 'click', function () { LL.Audio.play('click'); self.showSettings('title'); });

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
      this.updateCoins();
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
