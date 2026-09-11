/* 玲珑消 · levels.js — 30 关关卡数据
 *
 * 字段：
 *   colors       使用前 N 种基础块（4~6）
 *   moves        限定步数
 *   objectives   { type:'score',   target }                得分达标
 *                { type:'collect', color, count }          收集指定色块
 *                { type:'clear' }                          清除全部障碍（总数由 layout 推出）
 *   stars        [二星分, 三星分]；一星 = 过关
 *   layout       8 行 × 8 列：'.' 空 · '*' 霜 · '#' 石锁 · 'v' 藤蔓
 *   skills       可选，覆写本关的灵力起步值 / 倍率（见 README「局内技能」）
 *
 * 数值由 tools/balance.cjs 模拟验证后微调，保证「有挑战但可完成」。
 * skills 只加在模拟胜率明显偏低的关卡上：那是玩家流失的地方，灵力的边际价值最高。
 */
(function (global) {
  'use strict';
  const LL = (global.LL = global.LL || {});

  /* 偏难关卡的灵力加成：多给 15 点（约半次技能机会）。
   * 只动「新系统给多少」，不动 moves / objectives / stars 这些已校准的难度参数，
   * 所以既有的关卡数值验证依然成立。 */
  const BOOST_QI = { skills: { qiStart: 45 } };

  /* 常用障碍布局 */
  const LAYOUTS = {
    frostCross: [
      '........',
      '...**...',
      '..*..*..',
      '.*....*.',
      '.*....*.',
      '..*..*..',
      '...**...',
      '........'
    ],
    frostBlock: [
      '........',
      '........',
      '..****..',
      '..****..',
      '..****..',
      '..****..',
      '........',
      '........'
    ],
    stoneRow: [
      '........',
      '........',
      '........',
      '..####..',
      '..####..',
      '........',
      '........',
      '........'
    ],
    stoneCorners: [
      '##......',
      '##......',
      '........',
      '........',
      '........',
      '........',
      '......##',
      '......##'
    ],
    vineBand: [
      '........',
      '........',
      '.v.v.v.v',
      '........',
      '........',
      '.v.v.v.v',
      '........',
      '........'
    ],
    vineRing: [
      '........',
      '..vvvv..',
      '..v..v..',
      '..v..v..',
      '..v..v..',
      '..v..v..',
      '..vvvv..',
      '........'
    ],
    mixedA: [
      '..*..*..',
      '........',
      '..#..#..',
      '........',
      '........',
      '..#..#..',
      '........',
      '..v..v..'
    ],
    mixedB: [
      '.*....*.',
      '........',
      '..####..',
      '..v..v..',
      '..v..v..',
      '........',
      '........',
      '.*....*.'
    ],
    mixedC: [
      '...##...',
      '...##...',
      '..*..*..',
      '.v....v.',
      '.v....v.',
      '..*..*..',
      '........',
      '........'
    ],
    finale: [
      '...##...',
      '...##...',
      '........',
      '..*..*..',
      '..*..*..',
      '........',
      '..v..v..',
      '..v..v..'
    ],
    /* ---- 第五章之后新增：让第四十关以后还有「没见过的盘面」 ---- */
    /* 藤格：藤蔓铺成网格，交换处处受限，但重力只被竖线切开 */
    vineLattice: [
      '..v..v..',
      '........',
      '..v..v..',
      '........',
      '........',
      '..v..v..',
      '........',
      '..v..v..'
    ],
    /* 石带：两道横墙，把盘面分成上中下三层 */
    stoneBands: [
      '........',
      '..####..',
      '........',
      '........',
      '........',
      '........',
      '..####..',
      '........'
    ],
    /* 霜藤交错：四角对角的霜与藤，中间留出大片活动区 */
    frostVine: [
      '..*..*..',
      '..v..v..',
      '........',
      '.*......',
      '......*.',
      '........',
      '..v..v..',
      '..*..*..'
    ],
    /* 银钩：两枚 L 形石钩斜对角相望。同样利用「成簇好打」——一次三连能啃掉钩子上的好几块。 */
    hooks: [
      '..##....',
      '...#....',
      '........',
      '........',
      '........',
      '........',
      '....#...',
      '....##..'
    ],
    /* ---- 第七、八章新增 ---- */
    /* 霜簇：四片霜排成两个 2×2，成簇摆法对高阶关同样适用 */
    frostCluster: [
      '........',
      '..**....',
      '..**....',
      '........',
      '........',
      '....**..',
      '....**..',
      '........'
    ],
    /* 藤柱：三对竖藤把盘面切成四段，重力分段最碎的一张图 */
    vineColumns: [
      '..v..v..',
      '..v..v..',
      '..v..v..',
      '........',
      '........',
      '..v..v..',
      '..v..v..',
      '..v..v..'
    ],
    /* 双垒：两座 2×2 石垒上下错开，比四角摊开好打得多 */
    twinBlocks: [
      '........',
      '..##....',
      '..##....',
      '........',
      '........',
      '....##..',
      '....##..',
      '........'
    ],
    /* 石十字：12 个石锁连成一片十字，一次三连能同时啃掉好几块——量大但好打 */
    crossStone: [
      '........',
      '........',
      '...##...',
      '..####..',
      '..####..',
      '...##...',
      '........',
      '........'
    ],
    /* 藤石相间：两座石垒配两条竖藤 */
    stoneVineMix: [
      '..v.....',
      '..##....',
      '..##....',
      '..v.....',
      '....v...',
      '....##..',
      '....##..',
      '....v...'
    ],
    /* 铁壁：两座 2×2 石垒斜对角摆开（收官关用）。
     * 摆布局时按「打击次数」估难度（石锁 2 次、霜 1 次），而且**成簇比摊开好打**——
     * 一次三连能同时啃掉挤在一起的好几个。第一版把 4 个石锁摊在四个角，
     * 同样 8 次打击，胜率只有 29%；改成两座石垒后回到合理区间。 */
    bastion: [
      '..##....',
      '..##....',
      '........',
      '........',
      '........',
      '........',
      '....##..',
      '....##..'
    ],
    /* 藤墙：两列藤蔓把盘面竖切成三段，重力分段最明显的一张图 */
    vineWalls: [
      '...vv...',
      '...vv...',
      '...vv...',
      '........',
      '........',
      '...vv...',
      '...vv...',
      '...vv...'
    ]
  };

  const LEVELS = [
    /* ---- 第一章 · 得分（4~5 色，熟悉规则） ---- */
    { id: 1,  name: '初入玲珑', nameEn: 'First Steps',   colors: 4, moves: 20, objectives: [{ type: 'score', target: 2400 }], stars: [3380, 3900, 5200] },
    { id: 2,  name: '玉璧生辉', nameEn: 'Jade Gleam',    colors: 4, moves: 20, objectives: [{ type: 'score', target: 3400 }], stars: [4415, 5200, 6900] },
    { id: 3,  name: '莲灯初上', nameEn: 'Lantern Light', colors: 4, moves: 20, objectives: [{ type: 'collect', color: 0, count: 24 }], stars: [3475, 4800, 6700] },
    { id: 4,  name: '铜钱串串', nameEn: 'String of Coins', colors: 4, moves: 18, objectives: [{ type: 'score', target: 4400 }], stars: [5300, 6300, 7800] },
    { id: 5,  name: '五色斑斓', nameEn: 'Five Hues',     colors: 5, moves: 18, objectives: [{ type: 'score', target: 5200 }], stars: [5505, 5700, 6300] },
    { id: 6,  name: '扇底生风', nameEn: 'Breeze of Fans', colors: 5, moves: 18, objectives: [{ type: 'collect', color: 1, count: 24 }], stars: [3400, 4300, 5500] },

    /* ---- 第二章 · 收集（双目标登场） ---- */
    { id: 7,  name: '香囊暗解', nameEn: 'Sachet Whispers', colors: 5, moves: 18, objectives: [{ type: 'score', target: 5600 }], stars: [5970, 6200, 6900] },
    { id: 8,  name: '金玉满堂', nameEn: 'Gold and Jade',  colors: 5, moves: 18, objectives: [{ type: 'collect', color: 2, count: 24 }], stars: [3245, 4100, 5200] },
    { id: 9,  name: '并蒂双莲', nameEn: 'Twin Lotus',    colors: 5, moves: 18, objectives: [{ type: 'collect', color: 0, count: 18 }, { type: 'collect', color: 1, count: 18 }], stars: [2995, 3800, 5000] },
    { id: 10, name: '珠玉在前', nameEn: 'Gems Aplenty',  colors: 5, moves: 19, objectives: [{ type: 'score', target: 6000 }], stars: [6330, 6800, 7400] },
    { id: 11, name: '紫气东来', nameEn: 'Purple Mist',   colors: 5, moves: 18, objectives: [{ type: 'collect', color: 4, count: 26 }], stars: [3630, 4600, 5700] },
    { id: 12, name: '扇舞回风', nameEn: 'Fan Dance',     colors: 5, moves: 18, objectives: [{ type: 'collect', color: 3, count: 26 }], stars: [3515, 4500, 5600] },
    { id: 13, name: '流苏结彩', nameEn: 'Tassels',       colors: 5, moves: 18, objectives: [{ type: 'score', target: 6800 }], stars: [7135, 7500, 8000] },
    { id: 14, name: '四色交辉', nameEn: 'Four Radiances', colors: 5, moves: 20, objectives: [{ type: 'collect', color: 2, count: 16 }, { type: 'collect', color: 4, count: 16 }], stars: [2840, 3500, 4600] },

    /* ---- 第三章 · 清障（霜 → 石锁 → 藤蔓） ---- */
    { id: 15, name: '薄霜初降', nameEn: 'First Frost',   colors: 5, moves: 22, objectives: [{ type: 'clear' }], stars: [3585, 5000, 7000], layout: LAYOUTS.frostCross },
    { id: 16, name: '霜重露寒', nameEn: 'Heavy Frost',   colors: 5, moves: 20, objectives: [{ type: 'clear' }], stars: [2880, 3800, 5300], layout: LAYOUTS.frostBlock },
    { id: 17, name: '寒玉生烟', nameEn: 'Cold Jade',     colors: 5, moves: 20, objectives: [{ type: 'score', target: 6400 }, { type: 'clear' }], stars: [6770, 7100, 7700], layout: LAYOUTS.frostCross },
    { id: 18, name: '石锁重重', nameEn: 'Stone Locks',   colors: 5, moves: 19, objectives: [{ type: 'clear' }], stars: [2925, 4100, 5800], layout: LAYOUTS.stoneRow },
    { id: 19, name: '四角磐石', nameEn: 'Cornerstones',  colors: 5, moves: 26, objectives: [{ type: 'clear' }], stars: [6420, 8100, 11600], layout: LAYOUTS.stoneCorners, ...BOOST_QI },
    { id: 20, name: '石上生花', nameEn: 'Flowers on Stone', colors: 5, moves: 20, objectives: [{ type: 'collect', color: 4, count: 20 }, { type: 'clear' }], stars: [3595, 4800, 6300], layout: LAYOUTS.stoneRow },
    { id: 21, name: '藤蔓缠绕', nameEn: 'Vine Tangle',   colors: 5, moves: 20, objectives: [{ type: 'clear' }], stars: [3680, 5300, 7400], layout: LAYOUTS.vineBand },
    { id: 22, name: '藤影环廊', nameEn: 'Vine Corridor', colors: 5, moves: 22, objectives: [{ type: 'clear' }], stars: [4645, 6100, 8200], layout: LAYOUTS.vineRing },

    /* ---- 第四章 · 混合与收官（6 色，步数收紧） ---- */
    { id: 23, name: '六合同风', nameEn: 'Six Harmonies', colors: 6, moves: 20, objectives: [{ type: 'score', target: 4600 }], stars: [4775, 5200, 5800], ...BOOST_QI },
    { id: 24, name: '双色争艳', nameEn: 'Duelling Hues', colors: 6, moves: 19, objectives: [{ type: 'collect', color: 0, count: 16 }, { type: 'collect', color: 3, count: 16 }], stars: [2485, 3200, 4200] },
    { id: 25, name: '霜石交加', nameEn: 'Frost and Stone', colors: 6, moves: 23, objectives: [{ type: 'clear' }], stars: [3085, 4300, 5300], layout: LAYOUTS.mixedA, ...BOOST_QI },
    { id: 26, name: '三花聚顶', nameEn: 'Three Blossoms', colors: 6, moves: 19, objectives: [{ type: 'collect', color: 1, count: 14 }, { type: 'collect', color: 4, count: 14 }, { type: 'collect', color: 5, count: 14 }], stars: [2690, 3400, 4300] },
    { id: 27, name: '金石为开', nameEn: 'Iron Will',     colors: 6, moves: 24, objectives: [{ type: 'score', target: 4200 }, { type: 'clear' }], stars: [4530, 5200, 6200], layout: LAYOUTS.mixedB, ...BOOST_QI },
    { id: 28, name: '拨云见日', nameEn: 'Clouds Part',   colors: 6, moves: 22, objectives: [{ type: 'clear' }], stars: [2945, 3800, 5000], layout: LAYOUTS.mixedC, ...BOOST_QI },
    { id: 29, name: '玲珑百转', nameEn: 'Kaleidoscope',  colors: 6, moves: 21, objectives: [{ type: 'collect', color: 2, count: 10 }, { type: 'clear' }], stars: [2960, 3800, 4800], layout: LAYOUTS.vineBand, ...BOOST_QI },
    { id: 30, name: '玲珑归元', nameEn: 'Linglong Complete', colors: 6, moves: 24, objectives: [{ type: 'score', target: 4600 }, { type: 'clear' }], stars: [4940, 5600, 6800], layout: LAYOUTS.finale, ...BOOST_QI },

    /* ---- 第五章 · 双目标与缠绕（每关两个目标，逼你在两件事之间分配步数） ---- */
    { id: 31, name: '双鲤戏珠', nameEn: 'Twin Carps',    colors: 6, moves: 24, objectives: [{ type: 'score', target: 4200 }, { type: 'collect', color: 1, count: 18 }], stars: [4445, 4700, 5200], layout: LAYOUTS.mixedA },
    { id: 32, name: '藤萝密布', nameEn: 'Vine Lattice',  colors: 6, moves: 25, objectives: [{ type: 'clear' }], stars: [3080, 4600, 5800], layout: LAYOUTS.vineLattice },
    { id: 33, name: '石破天惊', nameEn: 'Stone Breaker', colors: 6, moves: 26, objectives: [{ type: 'score', target: 4200 }, { type: 'clear' }], stars: [4625, 5000, 5800], layout: LAYOUTS.stoneBands },
    { id: 34, name: '霜华满地', nameEn: 'Frost Bloom',   colors: 6, moves: 23, objectives: [{ type: 'collect', color: 2, count: 20 }, { type: 'collect', color: 4, count: 18 }], stars: [3355, 3900, 4700], layout: LAYOUTS.frostCross },
    { id: 35, name: '珠联璧合', nameEn: 'Paired Gems',   colors: 6, moves: 25, objectives: [{ type: 'score', target: 4400 }, { type: 'collect', color: 0, count: 20 }], stars: [4670, 4900, 5400], layout: LAYOUTS.frostVine },
    { id: 36, name: '层峦叠嶂', nameEn: 'Ridges',        colors: 6, moves: 27, objectives: [{ type: 'clear' }], stars: [3360, 4500, 5900], layout: LAYOUTS.vineWalls },
    { id: 37, name: '玉树琼枝', nameEn: 'Jade Branches', colors: 6, moves: 26, objectives: [{ type: 'collect', color: 5, count: 22 }, { type: 'clear' }], stars: [4040, 5000, 5800], layout: LAYOUTS.frostVine },
    { id: 38, name: '星罗棋布', nameEn: 'Starry Spread', colors: 6, moves: 25, objectives: [{ type: 'score', target: 4400 }, { type: 'clear' }], stars: [4770, 5100, 6200], layout: LAYOUTS.vineLattice },
    { id: 39, name: '云开月明', nameEn: 'Moon Revealed', colors: 6, moves: 24, objectives: [{ type: 'collect', color: 3, count: 22 }, { type: 'collect', color: 1, count: 16 }], stars: [3375, 3900, 5000], layout: LAYOUTS.stoneBands },
    { id: 40, name: '万象更新', nameEn: 'All Renewed',   colors: 6, moves: 27, objectives: [{ type: 'score', target: 4400 }, { type: 'clear' }], stars: [4770, 5200, 6300], layout: LAYOUTS.mixedB },

    /* ---- 第六章 · 收官（三目标登场，盘面与步数都压到最紧） ---- */
    { id: 41, name: '百转千回', nameEn: 'Endless Turns', colors: 6, moves: 26, objectives: [{ type: 'score', target: 4800 }, { type: 'collect', color: 4, count: 20 }], stars: [5005, 5300, 5700], layout: LAYOUTS.vineRing },
    { id: 42, name: '铁画银钩', nameEn: 'Iron Strokes',  colors: 6, moves: 30, objectives: [{ type: 'clear' }], stars: [3440, 4800, 5900], layout: LAYOUTS.hooks },
    { id: 43, name: '锦绣河山', nameEn: 'Fair Land',     colors: 6, moves: 27, objectives: [{ type: 'score', target: 4800 }, { type: 'collect', color: 0, count: 22 }], stars: [5085, 5400, 5700], layout: LAYOUTS.mixedC },
    { id: 44, name: '海阔天空', nameEn: 'Wide Horizon',  colors: 6, moves: 27, objectives: [{ type: 'collect', color: 1, count: 18 }, { type: 'collect', color: 3, count: 18 }, { type: 'clear' }], stars: [3685, 4500, 5600], layout: LAYOUTS.stoneBands },
    { id: 45, name: '玲珑剔透', nameEn: 'Crystal Clear', colors: 6, moves: 28, objectives: [{ type: 'score', target: 5000 }, { type: 'clear' }], stars: [5525, 5800, 6600], layout: LAYOUTS.vineLattice },
    { id: 46, name: '炉火纯青', nameEn: 'Refined',       colors: 6, moves: 27, objectives: [{ type: 'collect', color: 2, count: 24 }, { type: 'clear' }], stars: [3755, 4800, 5800], layout: LAYOUTS.mixedC },
    { id: 47, name: '出神入化', nameEn: 'Transcendent',  colors: 6, moves: 28, objectives: [{ type: 'score', target: 5000 }, { type: 'collect', color: 5, count: 20 }, { type: 'clear' }], stars: [5320, 5600, 6400], layout: LAYOUTS.frostVine },
    { id: 48, name: '天工开物', nameEn: 'Craft of Heaven', colors: 6, moves: 25, objectives: [{ type: 'collect', color: 0, count: 20 }, { type: 'collect', color: 3, count: 20 }, { type: 'collect', color: 5, count: 20 }], stars: [3930, 4400, 4900], layout: LAYOUTS.mixedA },
    { id: 49, name: '九九归一', nameEn: 'All Returns One', colors: 6, moves: 28, objectives: [{ type: 'score', target: 5200 }, { type: 'clear' }], stars: [5490, 5900, 6500], layout: LAYOUTS.finale },
    { id: 50, name: '玲珑无双', nameEn: 'Unrivalled',    colors: 6, moves: 32, objectives: [{ type: 'score', target: 4200 }, { type: 'collect', color: 2, count: 22 }, { type: 'clear' }], stars: [4755, 5300, 6700], layout: LAYOUTS.bastion },

    /* ---- 第七章 · 缠斗（障碍加量，成簇摆法；两个目标同时施压） ---- */
    { id: 51, name: '双峰对峙', nameEn: 'Twin Peaks',    colors: 6, moves: 25, objectives: [{ type: 'score', target: 5000 }, { type: 'clear' }], stars: [5240, 5500, 6100], layout: LAYOUTS.frostCluster },
    { id: 52, name: '藤罗深锁', nameEn: 'Vine Lock',     colors: 6, moves: 27, objectives: [{ type: 'clear' }], stars: [4095, 5100, 6000], layout: LAYOUTS.vineColumns },
    { id: 53, name: '石径通幽', nameEn: 'Stone Path',    colors: 6, moves: 28, objectives: [{ type: 'collect', color: 0, count: 24 }, { type: 'clear' }], stars: [4085, 5100, 6000], layout: LAYOUTS.stoneVineMix },
    { id: 54, name: '霜石交辉', nameEn: 'Frost and Stone', colors: 6, moves: 28, objectives: [{ type: 'score', target: 4800 }, { type: 'clear' }], stars: [5150, 5400, 5800], layout: LAYOUTS.twinBlocks },
    { id: 55, name: '三英聚首', nameEn: 'Threefold',     colors: 6, moves: 24, objectives: [{ type: 'collect', color: 1, count: 22 }, { type: 'collect', color: 3, count: 22 }, { type: 'collect', color: 5, count: 22 }], stars: [4005, 4800, 5700], layout: LAYOUTS.frostCross },
    { id: 56, name: '曲径回廊', nameEn: 'Winding Corridor', colors: 6, moves: 29, objectives: [{ type: 'score', target: 4800 }, { type: 'clear' }], stars: [5330, 5900, 7000], layout: LAYOUTS.vineColumns },
    { id: 57, name: '双辉并耀', nameEn: 'Twin Radiance', colors: 6, moves: 26, objectives: [{ type: 'collect', color: 2, count: 26 }, { type: 'collect', color: 4, count: 26 }], stars: [4165, 5000, 5900], layout: LAYOUTS.frostCluster },
    { id: 58, name: '石上流泉', nameEn: 'Spring on Stone', colors: 6, moves: 29, objectives: [{ type: 'score', target: 5000 }, { type: 'collect', color: 4, count: 22 }, { type: 'clear' }], stars: [5445, 5800, 6200], layout: LAYOUTS.stoneVineMix },
    { id: 59, name: '层见叠出', nameEn: 'Layer on Layer', colors: 6, moves: 22, objectives: [{ type: 'clear' }], stars: [2840, 3600, 4500], layout: LAYOUTS.crossStone },
    { id: 60, name: '万象森罗', nameEn: 'Myriad Forms',  colors: 6, moves: 28, objectives: [{ type: 'score', target: 5000 }, { type: 'collect', color: 3, count: 20 }, { type: 'collect', color: 0, count: 20 }], stars: [5210, 5600, 6000], layout: LAYOUTS.vineRing },

    /* ---- 第八章 · 无双（三目标成为常态，盘面与步数都到顶） ---- */
    { id: 61, name: '铁壁重围', nameEn: 'Iron Siege',    colors: 6, moves: 23, objectives: [{ type: 'clear' }], stars: [3185, 4000, 4800], layout: LAYOUTS.crossStone },
    { id: 62, name: '藤网密织', nameEn: 'Vine Web',      colors: 6, moves: 30, objectives: [{ type: 'collect', color: 1, count: 22 }, { type: 'clear' }], stars: [4460, 5300, 6800], layout: LAYOUTS.vineColumns },
    { id: 63, name: '玉润珠圆', nameEn: 'Polished Jade', colors: 6, moves: 29, objectives: [{ type: 'score', target: 5400 }, { type: 'collect', color: 0, count: 20 }, { type: 'clear' }], stars: [5680, 6000, 6200], layout: LAYOUTS.frostCluster },
    { id: 64, name: '风霜并至', nameEn: 'Wind and Frost', colors: 6, moves: 30, objectives: [{ type: 'collect', color: 2, count: 24 }, { type: 'collect', color: 4, count: 24 }, { type: 'clear' }], stars: [4245, 5200, 6400], layout: LAYOUTS.twinBlocks },
    { id: 65, name: '千岩万壑', nameEn: 'A Thousand Cliffs', colors: 6, moves: 25, objectives: [{ type: 'score', target: 5000 }, { type: 'clear' }], stars: [5310, 5500, 6100], layout: LAYOUTS.crossStone },
    { id: 66, name: '众彩纷呈', nameEn: 'Many Hues',     colors: 6, moves: 28, objectives: [{ type: 'collect', color: 1, count: 26 }, { type: 'collect', color: 3, count: 26 }, { type: 'collect', color: 5, count: 26 }], stars: [5140, 5700, 6300], layout: LAYOUTS.vineLattice },
    { id: 67, name: '云蒸霞蔚', nameEn: 'Rising Clouds', colors: 6, moves: 32, objectives: [{ type: 'score', target: 5200 }, { type: 'collect', color: 5, count: 22 }, { type: 'clear' }], stars: [5565, 5900, 6400], layout: LAYOUTS.stoneVineMix },
    { id: 68, name: '金声玉振', nameEn: 'Golden Tone',   colors: 6, moves: 28, objectives: [{ type: 'collect', color: 2, count: 30 }, { type: 'clear' }], stars: [4670, 5400, 6900], layout: LAYOUTS.twinBlocks },
    { id: 69, name: '百炼成钢', nameEn: 'Forged',        colors: 6, moves: 24, objectives: [{ type: 'collect', color: 0, count: 20 }, { type: 'clear' }], stars: [3810, 4500, 5300], layout: LAYOUTS.crossStone },
    { id: 70, name: '天外有天', nameEn: 'Beyond the Heavens', colors: 6, moves: 30, objectives: [{ type: 'score', target: 5400 }, { type: 'collect', color: 2, count: 26 }, { type: 'clear' }], stars: [5705, 6100, 6600], layout: LAYOUTS.crossStone }
  ];

  /* 清障关的障碍总数 */
  LEVELS.forEach(function (lv) {
    lv.clearTotal = 0;
    if (lv.layout) {
      for (let r = 0; r < lv.layout.length; r++) {
        for (let c = 0; c < lv.layout[r].length; c++) {
          const ch = lv.layout[r].charAt(c);
          if (ch === '*' || ch === '#' || ch === 'v') lv.clearTotal++;
        }
      }
    }
    lv.objectives.forEach(function (o) { if (o.type === 'clear') o.count = lv.clearTotal; });
  });

  LL.LEVELS = LEVELS;
  LL.LAYOUTS = LAYOUTS;
})(typeof globalThis !== 'undefined' ? globalThis : this);
