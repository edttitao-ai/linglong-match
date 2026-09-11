/* 玲珑消 · progress.js — 关卡进度与设置持久化（localStorage） */
(function (global) {
  'use strict';
  const LL = (global.LL = global.LL || {});
  const CFG = LL.CFG;
  const U = LL.U;

  const DEFAULT_DATA = {
    stars: {}, best: {}, unlocked: 1, plays: 0,
    coins: 0,
    day: { key: '', earned: 0 },   // 当日金币产出（受上限约束）
    revive: {}                      // 每关累计使用过的续步次数
  };
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

    /* ---------------- 金币 ---------------- */

    /* 本地日期键（每日上限、签到、每日挑战都以它为准） */
    todayKey(d) {
      const dt = d || new Date();
      const m = dt.getMonth() + 1;
      const day = dt.getDate();
      return dt.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
    },

    /* 跨天则重置当日产出计数 */
    ensureDay() {
      const key = this.todayKey();
      if (this.data.day.key !== key) {
        this.data.day = { key: key, earned: 0 };
        this.save();
      }
      return key;
    },

    coinsLeftToday() {
      this.ensureDay();
      return Math.max(0, CFG.ECON.DAY_CAP - this.data.day.earned);
    },

    /* 加金币（受每日上限约束）；返回 { added, capped } */
    addCoins(n, countTowardCap) {
      if (n <= 0) return { added: 0, capped: false };
      this.ensureDay();
      let added = n;
      let capped = false;
      if (countTowardCap !== false) {
        const left = this.coinsLeftToday();
        if (n > left) { added = left; capped = true; }
        this.data.day.earned += added;
      }
      this.data.coins += added;
      this.save();
      return { added: added, capped: capped };
    },

    spendCoins(n) {
      if (this.data.coins < n) return false;
      this.data.coins -= n;
      this.save();
      return true;
    },

    /* ---------------- 续步（救援） ---------------- */

    reviveCountOf(id) { return this.data.revive[id] || 0; },
    addRevive(id) {
      this.data.revive[id] = this.reviveCountOf(id) + 1;
      this.save();
      return this.data.revive[id];
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
