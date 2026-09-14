"""玲珑消 · tools/brighten_ui.py — 把界面的"面"整体抬亮一档（用户反馈：整体偏暗）。

思路：暗是暗在**层次没拉开**——面板面只比背景亮一点点，整屏挤在很窄的一段暗色里。
所以这里只抬"面"，不动两类东西：
  · 阴影（rgba(0,0,0,…)）—— 抬了会发灰、失去"漆"的深度；
  · 蒙版（弹层遮罩、棋盘外压暗）—— 它们的作用是把背景压下去衬托前景。
金色、朱砂、文字色同理不动（它们本来就够亮，动了一整套配色就偏了）。

用法：
    python tools/brighten_ui.py --check     # 只报告
    python tools/brighten_ui.py             # 就地改
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

TARGETS = ['css/base.css', 'css/ui.css', 'css/anim.css', 'js/render.js']

# 面：旧 → 新（按亮度抬一档，色相不变；括号里是 sRGB 相对亮度的大致档位）
MAP = {
    '#05070D': '#080F1C',   # 页面底 7 → 14
    '#070B14': '#0C1626',   # 最低面 9 → 18
    '#0B1120': '#131E33',   # 板面 17 → 30
    '#0E1526': '#16203A',   # 次低面
    '#141B2C': '#1F2A42',   # 卡面 27 → 43
    '#16203A': '#25334F',   # 高面 31 → 52
    '#182240': '#243152',   # 副面板
    '#222E4C': '#2E3D62',   # 已抬过的再抬（幂等保护：重复跑不会一直变亮）
}
# 画布里的面（render.js 的棋盘底板与井格）：alpha 保留
RGBA_MAP = {
    'rgba(22,32,58,': 'rgba(34,47,78,',
    'rgba(10,16,30,': 'rgba(18,27,46,',
    'rgba(21,28,46,': 'rgba(31,42,66,',
}

HEX = re.compile(r'#[0-9A-Fa-f]{6}\b')


def target_path(rel):
    if rel not in TARGETS:
        raise SystemExit('不在白名单里的文件：' + str(rel))
    path = (ROOT / rel).resolve()
    if path.parent not in ((ROOT / 'css').resolve(), (ROOT / 'js').resolve()):
        raise SystemExit('拒绝操作 css/ 与 js/ 之外的文件：' + rel)
    return path


def main():
    check = '--check' in sys.argv
    total = 0
    for rel in TARGETS:
        path = target_path(rel)
        src = path.read_text(encoding='utf-8')
        out = HEX.sub(lambda m: MAP.get(m.group(0).upper(), m.group(0)), src)
        for a, b in RGBA_MAP.items():
            out = out.replace(a, b)
        n = sum(1 for a, b in zip(HEX.finditer(src), HEX.finditer(out)) if a.group(0) != b.group(0))
        n += sum(src.count(a) for a in RGBA_MAP)
        total += n
        if not check and out != src:
            path.write_text(out, encoding='utf-8')
        print('  %-16s %s %d 处' % (rel, '将替换' if check else '已替换', n))
    print('\n共 %d 处' % total)


if __name__ == '__main__':
    main()
