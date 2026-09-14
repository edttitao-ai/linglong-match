# 开发与工具

> 本文是 [README](../README.md) 的详解分册，讲的是设计与实现；想快速上手直接看 README。

## ⚙️ 技术实现

- **零依赖 · 零构建 · 零外部素材包**：全部为经典 `<script>` 顺序加载，**不使用 ES modules、不发起
  `fetch`/`XHR`**——这正是 `file://` 双击直开也能正常工作的原因。图片走 `new Image()` 相对路径，
  音效走 `HTMLAudioElement`（媒体元素不受 `file://` 的 CORS 限制）。
- **Canvas 2D + DOM 混合**：棋盘、粒子、飘字、震屏由 Canvas 绘制；HUD、关卡地图、面板用 DOM，
  二者通过状态对象单向传递。
- **逻辑与表现分离**：`board.js` / `special.js` / `resolver.js` / `skills.js` 不碰任何 DOM，
  可在 Node 下直接加载，因此核心规则可以被自动化测试覆盖；表现层只读取「事件时间轴」做插值回放。
- **一次算完、逐帧回放**：一回合的完整步骤（交换 → 组合爆破 → 匹配 ↔ 下落 → 结束）由解析器
  一次性算完并产出带时长的事件流，UI 按事件播放动画，输入在结算期间被锁定（快速连点不会破坏状态）。
  技能走的是**同一条流水线**（`Resolver.beginSkill` / `beginScan`），所以计分、连锁、任务与成就统计
  全部自动生效，表现层不需要为技能开任何后门。
- **性能**：粒子与飘字走对象池，Canvas 按 devicePixelRatio 缩放，固定步长更新 + 插值渲染。
  实测单帧 `update + draw` 成本 **0.92 ms**（1280×720，满盘精灵与阴影），60fps 余量充足。
- **响应式**：宽屏时信息栏在左侧一列，手机竖屏时自动变为顶部信息条，棋盘始终居中并等比缩放。
  技能栏是棋盘下方的悬浮条，它会把自己的高度通过 `Render.setBottomInset()` 告诉渲染层，
  棋盘据此上移——窄屏、横屏、矮屏都不会压住最后一行。

### 目录结构

```
linglong-match/
├── index.html              # 页面骨架 + 全部 DOM 覆盖层
├── css/                    # base（变量与布局）/ ui（面板与地图）/ anim（界面动画）
├── js/
│   ├── util.js  config.js             # 工具、全局常量与数值表
│   ├── board.js special.js resolver.js skills.js hint.js skilldemo.js
│   │                                  # 纯逻辑：棋盘 / 特殊块 / 回合状态机 / 局内技能与灵力 / 最优走法判定
│   │                                  # skilldemo 是技能说明里的演示动画（自己的 rAF，暂停时也能跑）
│   ├── levels.js daily.js quests.js modes.js achievements.js
│   │                                  # 70 关数据 / 每日挑战 / 每日任务 / 无尽·限时 / 成就·画卷
│   ├── progress.js                    # 存档：星级 / 金币 / 签到 / 任务 / 各模式纪录 / 统计
│   ├── anim.js fx.js                  # 时间轴与粒子 / 技能与特殊块的演出特效
│   ├── render.js                      # Canvas 绘制
│   ├── input.js hud.js ui.js game.js  # 输入 / HUD / 界面流转 / 关卡会话
│   ├── assets.js audio.js i18n.js     # 素材加载 / 音效 / 文案
│   └── main.js                        # 引导与主循环
├── lang/                   # 中文 / English 文案
├── assets/img/             # 59 个素材：方块/特殊块/障碍/技能/UI 小图标是 256px PNG（AI 生成后切图），
│                           #   棋盘框/纸底/远山/云纹/卷轴/成就徽记 仍是矢量 SVG
├── assets/sfx/             # 22 个 WAV 音效
├── tools/                  # 自检、平衡验证、浏览器冒烟、音效体检、素材生成与换色脚本
└── screenshots/
```

## 🧪 开发者工具

```bash
node tools/selftest.cjs --turns=20000   # 逻辑自检：210 项断言 + 两万回合随机模拟
node tools/balance.cjs --runs=200       # 关卡平衡：贪心玩家模拟，输出胜率与星级建议
node tools/balance.cjs --level=20       # 只跑第 20 关
node tools/balance.cjs --from=51 --to=70 # 只跑一批（标定新关卡时用，不必每次跑完 70 关）
node tools/balance.cjs --daily --days=21 # 每日挑战抽查：连看三周的胜率分布，防止出现「靠运气」的日子
node tools/balance.cjs --skills --weaken=35 # 局内技能回归：同一个种子跑两遍（关技能 / 开技能），
                                        # --weaken=35 模拟「35% 走法乱下」的玩家，回答「技能能不能救回卡关的人」
node tools/balance.cjs --skills=max     # 技能收益上界：灵力全砸移山，测难度天花板会不会塌
node tools/browser_test.cjs             # 无头浏览器冒烟：点遍所有按钮 + 图片体检 + 脚本化演练四个技能 + 布局检查
node tools/browser_test.cjs --w=430 --h=800 --shot=out.png
node tools/browser_test.cjs --shot=achievements.png --shot-screen=achievements
                                        # --shot-screen 先切到指定界面再截图；--eval='<js>' 可先注入一段调试脚本
node tools/check_sfx.cjs                # 音效体检：峰值电平是否符合设计、连锁音高是否单调递增
python tools/serve.py                   # 本地开发服务器（禁缓存，改完刷新即生效）
node tools/gen_tiles.mjs                # 重新生成全部 SVG 精灵
python tools/gen_sfx.py                 # 重新合成全部 WAV 音效
python tools/slice_sheet.py <表.png> <输出目录> 名字1,名字2,... --size=256
                                        # 把 AI 生成的素材表切成一个个透明 PNG（纯色底自动抠、可 --open=N 挖掉
                                        #   空心素材中间的洞、自动补成正方形）；方块/技能/UI 图标就是这么来的
python tools/restyle_dark.py --check    # 把矢量外圈（棋盘框/纸底/远山/云纹/卷轴/徽记）换成深色配色；先 --check 看会改哪些
python tools/restyle_css.py --check     # 把样式里的字面色按"色相家族 + 透明度"换肤（面板面/描边/投影/高光）
```

改完特效后：直接打开 `tools/fx_preview.html`（或截一张 `fx_preview.png`），
八个特效的五帧切片会一次画出来——比在对局里撞时机截图靠谱。

- **自检覆盖**：棋盘生成不变量（无初始三连、必有可行走法）· 随机回合模拟（棋盘永远填满、
  回合结束后无残留三连、特殊块与障碍数据合法）· 特殊块生成规则（4 连 / L·T / 5 连）·
  组合效果范围（十字、5×5、三行三列、同色全消、全屏）· 障碍分层与藤蔓重力分段 ·
  死局洗牌必定产出可玩棋盘 · 70 关数据合法性（含「收集目标颜色必须在该关色池内」这类容易写错的检查）·
  局内技能（四个技能的计划与落点、灵力收支与溢出、背水一战倍率、绝处逢生门槛与次数、
  技能资产与中英文案齐全、**技能回合带出连锁不崩**）·
  空闲提示（`Hint.best` 与暴力取最大一致、同盘面结果稳定、有两颗特殊块时推荐组合、
  有太极时推荐太极、理由取最大项、理由文案中英齐全）·
  **素材完整性**（源码里写死的键 / 配表声明的图标 / 磁盘文件，三方对账，并反向查「生成了却没人用的孤儿图」）·
  **弹层叠放次序**（每个弹层都要在 z-index 梯子上占一格，并校验「确认框最高」「技能说明高于暂停」这类关系）·
  **文案完整性**（源码里写死的 `I18N.t('key')`、拼接键（技能/成就/道具/任务种类）、`index.html` 的
  `data-i18n` 属性，三类来源都对着中英词典核一遍，并检查中英键数一致——
  缺键不会报错，只会静静地把键名本身显示给玩家）。
- **平衡验证**：用一个会优先照顾目标、破障与特殊块的贪心玩家跑满每关若干局，
  输出胜率、平均剩余步数与得分分位数，并给出二星 / 三星阈值建议。当前 70 关的胜率曲线为：
  第一章 ~100%（教学）→ 第二章 71–100% → 第三章 49–99% → 第四章 33–77% →
  第五~六章 46–83% → 第七~八章 44–84%。
  加了 `--skills` 之后，同一个种子会跑两遍做对照，逐关给出「技能前后」的胜率与三星率变化。
- **浏览器冒烟**：内置 http 服务 + Chrome DevTools Protocol（Node 22+ 自带 WebSocket，
  不引入 puppeteer）。它会把每个界面上的按钮都点一遍收集报错，做图片体检，
  **按真实节奏**分步演练四个技能（每步之间等动画收束，因为 `canInput()` 在结算期间会挡住第二次技能），
  用真实指针与**真实触摸事件**验证新手教学只弹一次、长按出说明卡且不误放技能、短按正常出手，
  **用像素级采样确认演示窗口真的在画**（canvas 存在不等于有内容——这里抓到过一次「帧循环在跑但 ctx 是空的」），
  并检查教学面板在一屏内放得下、技能栏没有压住棋盘最后一行——宽屏 / 窄屏 / 矮屏三种尺寸。

### 调试参数

| 参数 | 作用 |
|---|---|
| `index.html?debug=1` | 左上角显示 FPS、粒子数、当前步骤与状态 |
| `index.html?level=15` | 直接进入第 15 关（调试与分享用） |
| `index.html?screen=map` | 直接打开关卡地图（调试与截图用） |
| `index.html?screen=settings` | 直接打开设置面板 |

## 🚧 后续可做

- 障碍扩展：会蔓延的藤蔓、需要特定颜色破除的封印
- 关卡目标扩展：护送掉落物到底部、限定时间内连击数
- 背景音乐（可用 `gen_sfx.py` 的五声音阶琶音扩展成循环段落）
- 若需要外链分享，可在 `?level=N` 深链基础上加成绩参数

---

