# 玲珑消 · Linglong Match

[![engine](https://img.shields.io/badge/engine-Canvas_2D_+_Vanilla_JS-green)](docs/development.md)
[![deps](https://img.shields.io/badge/dependencies-zero-blue)](docs/development.md)
[![levels](https://img.shields.io/badge/levels-70-orange)](docs/gameplay.md)
[![i18n](https://img.shields.io/badge/i18n-中文_/_English-orange)](./lang)
[![license](https://img.shields.io/badge/license-MIT-lightgrey)](#-许可)

> 纯原生 Canvas 打造的国风三消。**零依赖、零构建、零外部素材包 —— 双击 `index.html` 即玩，完全离线。**

玉璧、灯笼、铜钱、折扇、莲花、香囊 —— 在玄漆描金的盘面与云纹之间交换相邻两块，凑齐三连即可消除；
连锁、风符、惊雷与太极会让同一张棋盘反复长出新解法。卡住时你也不必干瞪眼：攒下的灵力可以换成一记
如意锤、一次十字爆破、一回全盘重排，或者把某一格点成你要的颜色。

| 标题 | 对局 | 关卡地图 |
|---|---|---|
| ![标题](screenshots/title.png) | ![对局](screenshots/level15.png) | ![关卡地图](screenshots/map.png) |

| 局内技能 | 技能说明（带演示） | 手机竖屏 |
|---|---|---|
| ![技能栏](screenshots/skills-wide.png) | ![技能说明](screenshots/skill-intro.png) | ![手机竖屏](screenshots/mobile.png) |

## 🎮 怎么玩

**打开**：直接双击 `index.html`（`file://` 直开已实测）。想用本地服务器也行：`python -m http.server` 后访问 `index.html`。

| 操作 | 方式 |
|---|---|
| 交换块 | 点击两块相邻的块，或直接按住拖动一格 |
| 释放技能 | 点技能栏图标（或键盘 `1~4`），再点棋盘选目标；灵犀一点还要选一个颜色 |
| 查看技能说明 | 鼠标悬停技能图标，或触屏长按；也可从暂停面板打开完整说明 |
| 取消技能 | 再点一次该技能，或按 `Esc` |
| 加速动画 | 结算动画进行时点击棋盘任意处（最高 3.2 倍速） |
| 暂停 / 静音 / 重玩 / 加速 | `Esc` · `M` · `R` · `空格` |

**规则要点**

- 三连即消；**四连**生成风符（清整行或整列）、**五连**生成太极（清同色）、**L / T 形**生成惊雷（炸 3×3）。
  两颗特殊块交换会合成更强的组合效果。
- 关卡目标三种：得分达标 · 收集指定色 · 清除障碍（霜 / 石锁 / 藤蔓）。步数耗尽未达标即失败。
- 连锁有倍率，连锁越长分越高；棋盘再无可行交换时自动洗牌，不会卡死。
- **灵力**是攒出来的，只能玩出来不能买：消除、连锁、破障、引爆都会涨。四个技能都不消耗步数。
- 进度存在本机（localStorage），星级与解锁可随时回看；中英双语在设置里切换。

## ✨ 有什么

- **70 关八章**：得分 → 收集 → 清障 → 混合 → 双目标 → 收官 → 缠斗 → 无双，障碍与目标逐章叠上来。
- **四种局内技能**：如意锤 · 换天 · 灵犀一点 · 移山 —— 不消耗步数，用省下的灵力换一次翻盘。
- **每日挑战 · 每日任务 · 连续签到**：离线可用的时间锚点，日期种子保证同一天所有玩家拿到同一张盘。
- **无尽模式 · 限时挑战**：一盘接一盘的无尽爬塔，和 60 秒抢分的限时关。
- **成就与画卷**：13 枚成就徽记，累计星数还会逐层点亮一幅五层水墨画卷。

更细的规则、数值与系统说明见 **[docs/gameplay.md](docs/gameplay.md)**。

## 🛠 开发

- **技术立场**：零依赖、零构建，经典 `<script>` 顺序加载（不用 ES modules），所以 `file://` 双击能直接跑；
  逻辑层（棋盘 / 特殊块 / 回合流水线）不碰 DOM，可以在 Node 里直接跑测试。
- **四个自检工具**：`selftest.cjs`（210 条断言 + 两万回合随机模拟）· `browser_test.cjs`（无头浏览器把按钮点一遍、
  演练技能、查布局）· `balance.cjs`（贪心玩家模拟关卡胜率与星级阈值）· `check_sfx.cjs`（音效峰值与音高体检）。
- **素材与配色都是可复现的**：方块 / 技能图标由 AI 生图后切图（`tools/slice_sheet.py`），
  矢量外圈与样式由脚本换色（`tools/restyle_dark.py` / `restyle_css.py`），音效由 Python 标准库合成（`gen_sfx.py`）。

```bash
node tools/selftest.cjs          # 逻辑自检
node tools/balance.cjs --runs=200  # 关卡平衡
node tools/browser_test.cjs      # 浏览器冒烟
```

实现细节、目录结构、工具全表与调试参数见 **[docs/development.md](docs/development.md)**；
界面 / 特效 / 音效 / 素材的设计取舍见 **[docs/design.md](docs/design.md)**。

## 📄 许可

[MIT](./LICENSE) © 2026 Linglong Match contributors

素材与代码均为本项目自产：SVG 精灵、AI 生成并后期处理的位图、WAV 音效都由仓库内的脚本产出，
不含任何第三方素材。
