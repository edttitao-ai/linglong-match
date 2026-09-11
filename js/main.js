/* 玲珑消 · main.js — 引导与主循环 */
(function (global) {
  'use strict';
  const LL = global.LL;
  const U = LL.U;

  function boot() {
    const settings = LL.Progress.settings;
    LL.I18N.setLang(settings.lang || 'zh');

    LL.HUD.init();
    LL.UI.init();
    LL.Game.init(U.$('#game'));
    LL.Assets.initSfx();
    LL.I18N.apply(document);

    LL.UI.showScreen('loading');
    LL.UI.setLoadProgress(0);

    LL.Assets.loadAll(function (p) {
      LL.UI.setLoadProgress(p);
    }).then(function () {
      LL.Audio.init(LL.Assets.sfxPath, settings);
      LL.UI.applySettings();
      LL.UI.setLoadProgress(1);
      LL.UI.showScreen('title');
      startLoop();
      applyDeepLink();
    });

    /* 首次交互解锁音频（浏览器自动播放策略） */
    document.addEventListener('pointerdown', function () { LL.Audio.unlock(); }, { once: true });
    document.addEventListener('keydown', function () { LL.Audio.unlock(); }, { once: true });
  }

  /* 深链：index.html?level=15 直接进入第 15 关；?screen=map|settings 直接打开某个界面
   *（调试与截图用，不影响正常流程） */
  function applyDeepLink() {
    const href = String((global.location && global.location.href) || '');
    if (href.indexOf('screen=map') >= 0) { LL.UI.toMap(); return; }
    if (href.indexOf('screen=settings') >= 0) { LL.UI.showSettings('title'); return; }
    const marker = 'level=';
    const at = href.indexOf(marker);
    if (at < 0) return;
    let digits = '';
    for (let i = at + marker.length; i < href.length; i++) {
      const ch = href.charAt(i);
      if (ch >= '0' && ch <= '9') digits += ch;
      else break;
    }
    const n = digits ? parseInt(digits, 10) : 0;
    if (n >= 1 && n <= LL.LEVELS.length) {
      LL.Game.startLevel(n - 1);
      LL.Game.introT = 0;
      LL.Game.state = 'playing';
    }
  }

  function startLoop() {
    let last = (global.performance && performance.now) ? performance.now() : Date.now();
    function frame(now) {
      let dt = now - last;
      last = now;
      if (dt > 64) dt = 64;        /* 切后台回来不跳帧 */
      LL.Game.update(dt);
      LL.Game.draw();
      global.requestAnimationFrame(frame);
    }
    global.requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
