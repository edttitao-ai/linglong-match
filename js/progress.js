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
    daily: { cleared: {}, best: 0, plays: 0 },
    quests: { day: '', list: [], progress: [], claimed: [], rerolls: 0, bonusClaimed: false },
    endless: { bestStage: 0, bestScore: 0, weekKey: '', weekBest: 0, runs: 0 },
    timed: { best: 0, runs: 0 },
    stats: { maxCascade: 0, specialsFired: 0, obstaclesBroken: 0, revives: 0, skillsUsed: 0, lastStands: 0 },
    achievements: {},
    boosters: { moves: 0, wind: 0, shuffle: 0 },
    armed: { moves: false, wind: false, shuffle: false }
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
      const reward = CFG.STREAK.REWARDS[idx - 1] || {};
      const coins = reward.coins || 0;
      /* 签到奖励由时间节流，不占每日产出上限 */
      const got = this.addCoins(coins, false);
      const items = [];
      if (reward.booster) { this.addBooster(reward.booster, 1); items.push(reward.booster); }
      (reward.boosters || []).forEach(function (id) { this.addBooster(id, 1); items.push(id); }, this);
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
      return { dayIndex: idx, coins: got.added, boosters: items, milestone: bonus, total: s.total, best: s.best };
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

    /* ---------------- 统计与成就 ---------------- */

    bumpStat(key, n) {
      const s = this.data.stats || (this.data.stats = {});
      if (!n || n < 0) return;
      s[key] = (s[key] || 0) + n;
    },

    setStatMax(key, v) {
      const s = this.data.stats || (this.data.stats = {});
      if (v > (s[key] || 0)) s[key] = v;
    },

    /* 检查并解锁成就；返回新解锁的 [{id, coins}] 并自动发金币 */
    checkAchievements() {
      const got = LL.Achievements.newlyUnlocked(this);
      if (!got.length) return [];
      const out = [];
      const now = Date.now();
      const self = this;
      got.forEach(function (a) {
        self.data.achievements[a.id] = now;
        self.addCoins(a.coins, false);      /* 成就一次性，不占每日上限 */
        out.push({ id: a.id, coins: a.coins });
      });
      this.save();
      return out;
    },

    achievementOf(id) { return this.data.achievements[id] || 0; },
    achievementCount() {
      let n = 0;
      const got = this.data.achievements || {};
      for (const k in got) if (Object.prototype.hasOwnProperty.call(got, k) && got[k]) n++;
      return n;
    },

    /* ---------------- 无尽 / 限时 ---------------- */

    /* 本周键（用于「本周最佳」，不比真人榜但能跟自己比） */
    weekKey(d) {
      const dt = d || new Date();
      const days = Math.floor(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()) / 86400000);
      return String(Math.floor(days / 7));
    },

    recordEndless(stage, score) {
      const e = this.data.endless;
      const wk = this.weekKey();
      if (e.weekKey !== wk) { e.weekKey = wk; e.weekBest = 0; }
      const isBest = stage > (e.bestStage || 0) ||
        (stage === (e.bestStage || 0) && score > (e.bestScore || 0));
      const bestStage = Math.max(e.bestStage || 0, stage);
      const bestScore = Math.max(e.bestScore || 0, score);
      e.bestStage = bestStage;
      e.bestScore = bestScore;
      e.weekBest = Math.max(e.weekBest || 0, stage);
      e.runs = (e.runs || 0) + 1;
      this.save();
      return { bestStage: bestStage, bestScore: bestScore, weekBest: e.weekBest, isBest: isBest };
    },

    recordTimed(score) {
      const t = this.data.timed;
      const isBest = score > (t.best || 0);
      t.best = Math.max(t.best || 0, score);
      t.runs = (t.runs || 0) + 1;
      this.save();
      return { best: t.best, isBest: isBest };
    },

    /* ---------------- 每日任务 ---------------- */

    /* 跨天重排任务；同一天重新打开还是同一组 */
    ensureQuests() {
      const today = this.ensureDay();
      const q = this.data.quests;
      if (q.day === today && q.list && q.list.length) return q;
      q.day = today;
      q.list = LL.Quests.generate(today, 0);
      q.progress = q.list.map(function () { return 0; });
      q.claimed = q.list.map(function () { return false; });
      q.rerolls = CFG.QUESTS.rerolls;
      q.bonusClaimed = false;
      this.save();
      return q;
    },

    questState() {
      const q = this.ensureQuests();
      const done = q.list.map(function (item, i) { return q.progress[i] >= item.target; });
      const allClaimed = q.claimed.every(function (v) { return v; });
      return {
        day: q.day, list: q.list, progress: q.progress, claimed: q.claimed,
        done: done, rerolls: q.rerolls, bonusClaimed: q.bonusClaimed,
        allDone: done.every(Boolean), allClaimed: allClaimed,
        claimable: done.filter(function (v, i) { return v && !q.claimed[i]; }).length,
        bonusClaimable: done.every(Boolean) && !q.bonusClaimed
      };
    },

    /* 进度累加（只作用于未领取的任务） */
    addQuestProgress(ev) {
      const q = this.ensureQuests();
      let changed = false;
      for (let i = 0; i < q.list.length; i++) {
        if (q.claimed[i]) continue;
        const cur = q.progress[i] || 0;
        if (cur >= q.list[i].target) continue;
        const next = LL.Quests.apply(cur, q.list[i], ev);
        if (next !== cur) { q.progress[i] = next; changed = true; }
      }
      if (changed) this.save();
      return changed;
    },

    /* 领取单条任务奖励；返回 { coins } 或 null */
    claimQuest(i) {
      const q = this.ensureQuests();
      if (q.claimed[i] || (q.progress[i] || 0) < q.list[i].target) return null;
      q.claimed[i] = true;
      const coins = CFG.QUESTS.reward[q.list[i].tier] || 20;
      this.addCoins(coins, false);          /* 任务按天节流，不占每日产出上限 */
      this.save();
      return { coins: coins };
    },

    /* 全部完成后的额外奖励 */
    claimQuestBonus() {
      const q = this.ensureQuests();
      const st = this.questState();
      if (!st.bonusClaimable) return null;
      q.bonusClaimed = true;
      this.addCoins(CFG.QUESTS.allDoneBonus, false);
      this.save();
      return { coins: CFG.QUESTS.allDoneBonus };
    },

    /* 换一条同难度的其他任务（每天限次） */
    rerollQuest(i) {
      const q = this.ensureQuests();
      if (q.rerolls <= 0 || q.claimed[i]) return null;
      const old = q.list[i];
      if ((q.progress[i] || 0) >= old.target) return null;   /* 已完成的不能换 */
      q.list[i] = LL.Quests.reroll(old, q.day, i);
      q.progress[i] = 0;
      q.rerolls--;
      this.save();
      return q.list[i];
    },

    /* ---------------- 开局道具 ---------------- */

    boosterCount(id) { return (this.data.boosters && this.data.boosters[id]) || 0; },
    addBooster(id, n) {
      const b = this.data.boosters || (this.data.boosters = {});
      b[id] = (b[id] || 0) + (n || 1);
      this.save();
      return b[id];
    },
    useBooster(id) {
      const b = this.data.boosters || {};
      if (!b[id] || b[id] <= 0) return false;
      b[id]--;
      if (b[id] === 0 && this.data.armed) this.data.armed[id] = false;
      this.save();
      return true;
    },
    /* 直接花金币买一件（买完自动装填） */
    buyBooster(id) {
      const info = CFG.BOOSTERS[id];
      if (!info || this.data.coins < info.cost) return null;
      this.spendCoins(info.cost);
      this.addBooster(id, 1);
      this.armBooster(id, true);
      return { coins: info.cost, count: this.boosterCount(id) };
    },
    armedList() {
      const a = this.data.armed || {};
      const self = this;
      return CFG.BOOSTERS.order.filter(function (id) { return a[id] && self.boosterCount(id) > 0; });
    },
    armBooster(id, on) {
      const a = this.data.armed || (this.data.armed = {});
      a[id] = !!on && this.boosterCount(id) > 0;
      this.save();
      return a[id];
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
