/* 玲珑消 · progress.js — 关卡进度与设置持久化（localStorage） */
(function (global) {
  'use strict';
  const LL = (global.LL = global.LL || {});
  const CFG = LL.CFG;
  const U = LL.U;

  const DEFAULT_DATA = { stars: {}, best: {}, unlocked: 1, plays: 0 };
  const DEFAULT_SET = { volume: 0.8, muted: false, lang: 'zh' };

  function load(key, def) {
    const raw = U.store.get(key, null);
    if (!raw || typeof raw !== 'object') return JSON.parse(JSON.stringify(def));
    const out = JSON.parse(JSON.stringify(def));
    for (const k in raw) if (Object.prototype.hasOwnProperty.call(raw, k)) out[k] = raw[k];
    return out;
  }

  const P = {
    data: load(CFG.STORAGE_KEY, DEFAULT_DATA),
    settings: load(CFG.SETTINGS_KEY, DEFAULT_SET),

    save() { U.store.set(CFG.STORAGE_KEY, this.data); },
    saveSettings() { U.store.set(CFG.SETTINGS_KEY, this.settings); },

    starsOf(id) { return this.data.stars[id] || 0; },
    bestOf(id) { return this.data.best[id] || 0; },
    isUnlocked(id) { return id <= this.data.unlocked; },
    totalStars() {
      let n = 0;
      const levelCount = (LL.LEVELS || []).length;
      for (let i = 1; i <= levelCount; i++) n += this.starsOf(i);
      return n;
    },
    maxStars() { return (LL.LEVELS || []).length * 3; },

    /* 通关记录；返回 { newBest, starsGained, unlockedNext } */
    record(id, stars, score) {
      const prevStars = this.starsOf(id);
      const prevBest = this.bestOf(id);
      if (stars > prevStars) this.data.stars[id] = stars;
      const newBest = score > prevBest;
      if (newBest) this.data.best[id] = score;
      const levelCount = (LL.LEVELS || []).length;
      let unlockedNext = false;
      if (id >= this.data.unlocked && id < levelCount) {
        this.data.unlocked = id + 1;
        unlockedNext = true;
      }
      this.data.plays = (this.data.plays || 0) + 1;
      this.save();
      return {
        newBest: newBest && prevBest > 0 ? true : newBest,
        starsGained: Math.max(0, stars - prevStars),
        unlockedNext: unlockedNext
      };
    },

    resetAll() {
      this.data = JSON.parse(JSON.stringify(DEFAULT_DATA));
      this.save();
    },

    /* 上次进度：返回可继续的关卡号 */
    continueLevel() { return Math.min(this.data.unlocked, (LL.LEVELS || []).length); }
  };

  LL.Progress = P;
})(typeof globalThis !== 'undefined' ? globalThis : this);
