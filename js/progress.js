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
    revive: {},                     // 每关累计使用过的续步次数
    streak: { count: 0, lastDay: '', best: 0, total: 0 },
    daily: { cleared: {}, best: 0, plays: 0 }
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

    /* ---------------- 连续登录 ---------------- */

    /* 两个日期键相差几天（用 UTC 计算，避开夏令时） */
    dayDiff(a, b) {
      const pa = a.split('-'), pb = b.split('-');
      const ta = Date.UTC(+pa[0], +pa[1] - 1, +pa[2]);
      const tb = Date.UTC(+pb[0], +pb[1] - 1, +pb[2]);
      return Math.round((tb - ta) / 86400000);
    },

    /* 今天该领第几天？不产生副作用，供 UI 预显示 */
    streakStatus() {
      const today = this.ensureDay();
      const s = this.data.streak;
      if (!s.lastDay) return { claimed: false, dayIndex: 1, total: s.total || 0, best: s.best || 0 };
      if (s.lastDay === today) return { claimed: true, dayIndex: s.count, total: s.total || 0, best: s.best || 0 };
      const gap = this.dayDiff(s.lastDay, today);
      if (gap < 0) return { claimed: true, dayIndex: s.count, clockBack: true, total: s.total || 0, best: s.best || 0 };
      let idx;
      if (gap === 1) idx = (s.count % 7) + 1;         // 连续签到
      else if (gap === 2) idx = Math.max(1, s.count); // 漏一天：原地暂停
      else idx = 1;                                    // 断签两天以上：重新开始
      return { claimed: false, dayIndex: idx, total: s.total || 0, best: s.best || 0, paused: gap === 2 };
    },

    claimStreak() {
      const st = this.streakStatus();
      if (st.claimed) return null;
      const s = this.data.streak;
      const idx = st.dayIndex;
      const coins = CFG.STREAK.REWARDS[idx - 1] || 0;
      /* 签到奖励由时间节流，不占每日产出上限 */
      const got = this.addCoins(coins, false);
      s.count = idx;
      s.lastDay = this.todayKey();
      s.total = (s.total || 0) + 1;
      s.best = Math.max(s.best || 0, idx);
      let bonus = 0;
      const ms = CFG.STREAK.TOTAL_MILESTONES;
      for (const k in ms) {
        if (Object.prototype.hasOwnProperty.call(ms, k) && s.total === +k) bonus += ms[k];
      }
      if (bonus > 0) this.addCoins(bonus, false);
      this.save();
      return { dayIndex: idx, coins: got.added, milestone: bonus, total: s.total, best: s.best };
    },

    /* ---------------- 每日挑战 ---------------- */

    dailyStars(dayKey) { return this.data.daily.cleared[dayKey] || 0; },

    /* 记录一次每日挑战通关；返回 { firstClear, prevStars } */
    recordDaily(dayKey, stars, score) {
      const d = this.data.daily;
      const prevStars = d.cleared[dayKey] || 0;
      const firstClear = prevStars === 0;
      if (stars > prevStars) d.cleared[dayKey] = stars;
      d.best = Math.max(d.best || 0, score);
      d.plays = (d.plays || 0) + 1;
      this.save();
      return { firstClear: firstClear, prevStars: prevStars };
    },

    /* 本月完成情况：返回 [{ dayKey, day, stars }] */
    dailyMonth(year, month) {
      const out = [];
      const days = new Date(year, month, 0).getDate();
      for (let d = 1; d <= days; d++) {
        const key = year + '-' + (month < 10 ? '0' : '') + month + '-' + (d < 10 ? '0' : '') + d;
        out.push({ dayKey: key, day: d, stars: this.dailyStars(key) });
      }
      return out;
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
