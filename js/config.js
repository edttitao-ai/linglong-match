/* 玲珑消 · config.js — 全局常量与数值表（无 DOM 依赖） */
(function (global) {
  'use strict';
  const LL = (global.LL = global.LL || {});

  /* 六种基础块：色相 + 轮廓双重区分（读盘友好） */
  const TILE_INFO = [
    { id: 'jade',    name: '玉璧', en: 'Jade',    main: '#2FA98C', light: '#93E2C6', dark: '#12523F', glow: 'rgba(47,169,140,0.55)' },
    { id: 'lantern', name: '灯笼', en: 'Lantern', main: '#D9453C', light: '#F79C90', dark: '#8C1F1F', glow: 'rgba(217,69,60,0.55)' },
    { id: 'coin',    name: '铜钱', en: 'Coin',    main: '#D9A63C', light: '#F6DC8E', dark: '#8A5E14', glow: 'rgba(217,166,60,0.55)' },
    { id: 'fan',     name: '折扇', en: 'Fan',     main: '#4A6FB5', light: '#A0BBEA', dark: '#27406E', glow: 'rgba(74,111,181,0.55)' },
    { id: 'lotus',   name: '莲花', en: 'Lotus',   main: '#E28BA8', light: '#F9C9D8', dark: '#A34E6D', glow: 'rgba(226,139,168,0.55)' },
    { id: 'sachet',  name: '香囊', en: 'Sachet',  main: '#8A5FB0', light: '#C9A7E6', dark: '#543673', glow: 'rgba(138,95,176,0.55)' }
  ];

  /* 特殊块：风符（横 / 竖整行清除）· 惊雷（3×3）· 太极（同色全消） */
  const SPECIAL = { NONE: 0, WIND_H: 1, WIND_V: 2, THUNDER: 3, TAIJI: 4 };
  const SPECIAL_INFO = {
    1: { name: '横风符', en: 'Wind Rune' },
    2: { name: '竖风符', en: 'Wind Rune' },
    3: { name: '惊雷',   en: 'Thunder' },
    4: { name: '太极',   en: 'Taiji' }
  };

  /* 障碍：霜（1 层）· 石锁（2 层）· 藤蔓（锁住块，不可交换） */
  const OBST = { NONE: 0, FROST: 1, STONE: 2, VINE: 3 };
  const OBST_INFO = {
    1: { hp: 1, name: '霜',   en: 'Frost' },
    2: { hp: 2, name: '石锁', en: 'Stone Lock' },
    3: { hp: 1, name: '藤蔓', en: 'Vine' }
  };

  const CFG = {
    ROWS: 8,
    COLS: 8,
    TILE_INFO: TILE_INFO,
    TILE_KINDS: TILE_INFO.length,
    SPECIAL: SPECIAL,
    SPECIAL_INFO: SPECIAL_INFO,
    OBST: OBST,
    OBST_INFO: OBST_INFO,

    /* 计分 */
    SCORE_TILE: 20,            // 每消除一块
    SCORE_SPECIAL_CREATE: 50,  // 生成一个特殊块
    SCORE_SPECIAL_FIRE: 100,   // 引爆一个特殊块
    SCORE_MOVE_LEFT: 50,       // 胜利时每剩余一步折算
    CASCADE_STEP: 0.5,         // 每层连锁 +50%
    CASCADE_CAP: 4,            // 连锁倍率上限

    /* 动画时长（毫秒） */
    ANIM: {
      swap: 150,
      revert: 180,
      clear: 230,
      fallBase: 110,
      fallPerRow: 24,
      fallMax: 330,
      shuffle: 460,
      banner: 720,
      result: 520
    },
    CASCADE_SPEEDUP: 0.9,   // 每层连锁动画提速
    MIN_TIME_SCALE: 0.6,
    HINT_DELAY: 5200,       // 空闲多久给出提示（高亮最优的一步）
    HINT_TIP_DELAY: 6500,   // 再等这么久还没动手，就补一句「为什么推荐它」
    HINT_TIP_EVERY: 7000,   // 之后每隔这么久重复一次，别让那句话永久消失
    ACCEL_SCALE: 3.2,       // 点击加速倍率

    /* 经济与留存系统
     * 铁律：金币只能买「重试的机会」，不能买「永久的强」——否则关卡数值验证全部作废。 */
    ECON: {
      STAR_COINS: [10, 20, 35],   // 1/2/3 星通关的金币
      REPLAY_RATE: 0.3,           // 重玩已通关的关卡只按 30% 产出（防刷）
      DAY_CAP: 250,               // 每日金币产出上限（防通胀）
      MILESTONE_EVERY: 10,        // 每累计 N 星
      MILESTONE_COINS: 100,       // 给一次里程碑奖励
      REVIVE: {
        cost: 120,                // 首次续步价格
        step: 60,                 // 同一次挑战内每多买一次加价
        moves: 5,                 // 续步给多少步
        minProgress: 0.7,         // 目标完成度低于此值时不提供（不骗人）
        freeFrom: 3               // 第 3 次直接送（怜悯机制）
      }
    },

    /* 连续登录：7 天一个循环，第 7 天奖励约等于常规日的 3 倍（目标梯度）
     * 断签不立刻归零——漏 1 天原地暂停、漏 2 天才重来（铁律反而赶人） */
    STREAK: {
      /* 第 7 天 = 150 金币 + 三件套各 1，约等于常规日的 3 倍（目标梯度） */
      REWARDS: [
        { coins: 20 },
        { booster: 'moves' },
        { coins: 40 },
        { booster: 'wind' },
        { coins: 60 },
        { booster: 'shuffle' },
        { coins: 150, boosters: ['moves', 'wind', 'shuffle'] }
      ],
      TOTAL_MILESTONES: { 7: 100, 30: 300, 100: 800 }   // 永不重置的累计轨道
    },

    /* 开局道具：满配三件合计约 4~5 步，控制在第四章步数的 15%~25%——
     * 超过 30% 关卡设计就失去意义（见 README「留存系统」）。 */
    BOOSTERS: {
      order: ['moves', 'wind', 'shuffle'],
      moves: { cost: 80, amount: 3, icon: 'ui_boost_moves' },
      wind: { cost: 120, icon: 'ui_boost_wind' },
      shuffle: { cost: 60, icon: 'ui_boost_shuffle' }
    },

    /* 局内技能「灵力」：**只能玩出来，不能买**——守住上面那条铁律。
     *
     * 定价基准（实测来的，不是拍的）：
     * 一关的灵力总收入约 230~350（每消除一块 +1，加上连锁/破障/引爆的加成），
     * 所以想让「一关大概放 2~3 次技能」，技能价格就必须在 70~160 这一档。
     * 早先价格是 25~60，等于一关能放 4~5 次大招——实测「无脑砸移山」把 70 关的
     * 平均胜率从 70% 推到 99.8%，难度直接没了。改价之后同理回归。
     * 上限 180 = 存得住一次最贵的技能 + 一点零头，存不住两次。 */
    QI: {
      MAX: 240,
      START: 90,            // 开局赠送：一进场就能放一次（便宜的两个之一）
      PER_TILE: 1,          // 每消除一块
      PER_CASCADE: 6,       // 连锁每多一层（第 2 层起）
      PER_OBSTACLE: 6,      // 每破一个障碍
      PER_FIRE: 5,          // 每引爆一个特殊块
      PER_COMBO: 15,        // 每触发一次特殊块组合
      OVERFLOW_SCORE: 2,    // 满槽后每点灵力折算的分数（避免「不敢花就浪费」）
      LAST_STAND_AT: 3,     // 剩余步数 ≤ 此值进入背水一战
      LAST_STAND_MULT: 2    // 背水一战期间灵力获取倍率：把绝境变成高潮
    },

    /* 四个局内技能：一律**不消耗步数**，代价只有灵力
     * 价格按「这一下值多少」定：换天是解围不是输出所以最便宜，
     * 移山一下清十几格还顺带破障，所以最贵。
     * 移山定到 220 是因为它在清障关里一次能打掉整条路径上的障碍——按 160 定价时，
     * 「无脑砸移山」仍然能把 13 个清障关推过「太简单」线。
     * aim：none 直接放 · cell 选一格 · color 选一格再选色
     * swap（换天）在盘面已无解时免费——不让你因为没灵力而卡死 */
    SKILLS: {
      order: ['hammer', 'swap', 'color', 'cross'],
      hammer: { cost: 100, aim: 'cell',  icon: 'ui_skill_hammer', cause: 'skill_hammer' },
      swap:   { cost: 70,  aim: 'none',  icon: 'ui_skill_swap',   cause: 'skill_swap', freeWhenStuck: true },
      color:  { cost: 130, aim: 'color', icon: 'ui_skill_color',  cause: 'skill_color' },
      cross:  { cost: 220, aim: 'cell',  icon: 'ui_skill_cross',  cause: 'skill_cross' }
    },

    /* 绝处逢生：步数耗尽且目标未完成时，花灵力换步数——不走金币，不破铁律。
     * 它才是真正的反流失闸门（技能是稀缺的战术资源，这里才是保底），
     * 所以定价要「存得出来」：满槽时一定拿得出。max 防极端连锁下的循环。 */
    LAST_STAND: { cost: 120, moves: 3, max: 2 },

    /* 每日任务：3 条，易/中/难各一；三条合计应在 15~25 分钟内可清完 */
    QUESTS: {
      count: 3,
      reward: { easy: 20, medium: 28, hard: 35 },
      allDoneBonus: 60,
      rerolls: 1
    },

    STORAGE_KEY: 'linglong.progress.v1',
    SETTINGS_KEY: 'linglong.settings.v1'
  };

  LL.CFG = CFG;
})(typeof globalThis !== 'undefined' ? globalThis : this);
