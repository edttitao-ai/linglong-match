/* 玲珑消 · lang/zh.js — 中文文案 */
(function (global) {
  'use strict';
  const LL = (global.LL = global.LL || {});
  LL.LANG = LL.LANG || {};
  LL.LANG.zh = {
    /* 标题页 */
    title: '玲珑消',
    subtitle: '三 消 · 国 风',
    play: '开始游戏',
    levels: '关卡选择',
    settings: '设置',
    titleHint: '点击或拖动相邻两块交换，凑齐三连即可消除',
    loading: '正在备料…',

    /* HUD */
    moves: '剩余步数',
    score: '得分',
    objectives: '本关目标',
    objScore: '得分达到',
    objCollect: '收集{name}',
    objClear: '清除全部障碍',
    objDone: '已完成',
    levelName: '第 {n} 关 · {name}',
    pause: '暂停',
    soundOn: '音效开',
    soundOff: '音效关',

    /* 关卡地图 */
    selectLevel: '选择关卡',
    locked: '未解锁',
    continue: '继续',
    totalStars: '共 {n} 星',
    back: '返回',

    /* 对局中 */
    paused: '已暂停',
    resume: '继续',
    retry: '重玩本关',
    toMap: '关卡地图',
    next: '下一关',
    win: '过关！',
    lose: '步数用尽',
    finalScore: '本关得分',
    bestScore: '最高分',
    newBest: '新纪录！',
    starGot: '获得 {n} 星',
    cascade: '连锁 ×{n}',
    keyPause: '暂停',
    keyMute: '静音',
    keyRetry: '重玩',
    keySpeed: '加速',
    nice: '漂亮！',
    shuffle: '无子可动 · 重新洗牌',
    hurryNone: '',
    hint: '试试这里',

    /* 结算文案 */
    winTips: ['玲珑在手，妙不可言', '一气呵成，酣畅淋漓', '方寸之间，尽显从容'],
    loseTips: ['再试一次，必有妙手', '差之毫厘，再来一局', '换个思路，柳暗花明'],

    /* 每日挑战 */
    weekdays: ['日', '一', '二', '三', '四', '五', '六'],
    dailyTitle: '每日挑战',
    dailyPlay: '开始挑战',
    dailyReplay: '再挑战一次',
    dailyHint: '每天一局，同一天所有人同一盘面；首次通关得 {n} 金币，两星以上再 +{m}',
    dailyClearedToday: '今日已通关（{n} 星）',
    dailyNotYet: '今日尚未通关',
    dailyTimes: '已挑战 {n} 次',
    dailyBest: '最佳 {n} 分',
    dailyMonthDone: '本月通关 {n} 天',

    /* 每日任务 */
    questTitle: '每日任务',
    quest_winLevels: '通过 {n} 关',
    quest_collectColor: '收集{name} {n} 个',
    quest_breakObstacles: '破除 {n} 个障碍',
    quest_cascade: '打出一次 {n} 连锁',
    quest_fireSpecials: '引爆特殊块 {n} 次',
    quest_stars: '获得 {n} 颗星',
    quest_noReviveWins: '不使用续步通关 {n} 次',
    questReroll: '换一个',
    questClaim: '领取',
    questClaimed: '已领取',
    questDone: '可领取',
    questBonus: '全部完成额外奖励',
    questAll: '一键领取',
    questNoReroll: '今日换牌已用完',
    questNew: '有任务可领取',
    questGot: '任务奖励 +{n} 金币',

    /* 开局道具 */
    boostTitle: '开局道具',
    boost_moves: '+3 步',
    boost_wind: '风符',
    boost_shuffle: '重排',
    boostUsed: '本局生效',
    boostHint: '点击装填，开局自动生效；同类只能带 1 件',
    boostEmpty: '没有库存 · 点击购买',
    boostBuyAsk: '花 {n} 金币购买「{name}」并装填？',
    boostNotEnough: '金币不足（还差 {n}）',
    boostStock: '库存 ×{n}',
    boostBuyShort: '购买',

    /* 连续签到 */
    checkinTitle: '连续签到',
    checkinShort: '签到',
    streakDay: '第 {n} 天',
    streakClaimed: '已领',
    streakToday: '待领',
    streakFuture: '未到',
    streakTotal: '累计签到 {n} 天 · 最长连签 {m} 天',
    streakNext: '下一个累计奖励：{n} 天',
    streakPaused: '漏签一天，进度暂停（不算断签）',
    streakAllDone: '本月循环已满，明天开启新一轮',
    claim: '领取',
    claimed: '今日已领',
    claimGot: '签到成功 · +{n} 金币',
    claimMilestone: '累计 {n} 天 · 额外 +{m} 金币',

    /* 金币与续步 */
    coins: '金币',
    coinsEarned: '获得金币',
    coinsCapped: '（今日金币已达上限）',
    coinLeftToday: '今日还可获得 {n} 金币',
    milestoneNote: '星数里程碑 · 额外 +{n} 金币',
    replayNote: '重玩关卡金币按 30% 计',
    reviveTitle: '差一点就过了！',
    reviveMsg: '本局目标已完成 {n}%，再给你 {m} 步，继续冲一次？',
    reviveCost: '花费 {n} 金币',
    reviveFree: '这次免费送你',
    reviveBuy: '续步 · {n} 金币',
    reviveBuyFree: '免费续步',
    reviveGo: '继续！',
    reviveNo: '放弃本局',
    reviveNotEnough: '金币不足（还差 {n}）',

    /* 设置 */
    volume: '音量',
    sound: '音效',
    on: '开',
    off: '关',
    language: '语言',
    resetProgress: '清除进度',
    resetConfirm: '确定要清除全部关卡进度吗？此操作不可撤销。',
    yes: '确定',
    no: '取消',
    close: '关闭',

    /* 其它 */
    level: '第 {n} 关',
    tapToStart: '点击任意处继续',
    specialWind: '风符：清除整行或整列',
    specialThunder: '惊雷：炸开周围三乘三',
    specialTaiji: '太极：清除全部同色块',
    obstFrost: '霜：消除其上的块即可破除',
    obstStone: '石锁：需消除两次',
    obstVine: '藤蔓：锁住块，不可交换'
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
