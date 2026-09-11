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
    { id: 30, name: '玲珑归元', nameEn: 'Linglong Complete', colors: 6, moves: 24, objectives: [{ type: 'score', target: 4600 }, { type: 'clear' }], stars: [4940, 5600, 6800], layout: LAYOUTS.finale, ...BOOST_QI }
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
