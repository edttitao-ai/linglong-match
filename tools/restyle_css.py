"""玲珑消 · tools/restyle_css.py — 把 UI 样式里的字面色从"宣纸浅色"改成 A 方案「玄漆描金」。

为什么按"家族规则"而不是逐条查表：ui.css 里有 118 种字面颜色，一大半是同一个色相、
只是透明度不同（面板面、内高光、投影、描边）。逐条查表既写不全也维护不动；
按色相家族 + 透明度分流，规则少且下次换肤还能用。

规则顺序（先命中先算）：
  1. 纯白             → 深底上最多只留一点点高光
  2. 暖白（纸面）     → 不透明的当深面，半透明的当暖光
  3. 中性深色（墨）   → 深底上要反过来当浅色文字
  4. 朱砂红           → 保持红，只调饱和
  5. 暖深棕           → 透明度小的当金线，大的当黑影
  6. 冷色/绿/橙/紫    → 是特效颜色（霜、藤、雷电），原样保留
  7. 其余             → 原样保留并打印，人工复核

用法：
    python tools/restyle_css.py --check     # 只报告
    python tools/restyle_css.py             # 就地改
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

TARGETS = ['css/base.css', 'css/ui.css', 'css/anim.css']

FILES = [p.name for p in (ROOT / 'css').glob('*.css')]

PAT = re.compile(r'#[0-9A-Fa-f]{3,8}\b|rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([0-9.]+)\s*)?\)')

# 少数几个色相相同但语义不同的，直接查表（金色三级 + 朱砂三级）
EXACT = {
    '#C9A227': '#C9A44C',
    '#E8C86A': '#E8C877',
    '#8A5F18': '#8A6A24',
    '#B8342C': '#C0392B',
    '#D9483C': '#D9503C',
    '#8E231D': '#7E241C',
    '#2B2620': '#F0DFAE',
    '#6B5B45': '#C9A44C',
    '#4E7C4A': '#3E7C68',
    '#6E9C6A': '#5AA07C',
    '#2E4E7E': '#3A5E96',
    '#C8B08A': '#8A6A24',
    '#6B4B2A': '#2A2016',
    '#8A6236': '#3E2F1E',
    '#4A3320': '#16110A',
    '#F2E6CF': '#0B1120',
    '#FBF6EA': '#16203A',
    '#E8D9BC': '#070B14',
    '#FDF8EC': '#141B2C',
    '#FFFDF6': '#141B2C',
    '#FFF8EC': '#16203A',
    '#FFF8E2': '#16203A',
    '#FBEBC0': '#1C2740',
    '#D9A63C': '#D9A63C',
    '#F6DC8E': '#F6DC8E',
    '#FFD873': '#FFD873',
    # 零散的一次性色（旧配色里各自只用一次，按语义归到最接近的金 / 暗面）
    '#8A5A22': '#8A6A24',
    '#7A5A2E': '#B08C3C',
    '#9A7142': '#C9A44C',
    '#5C3F22': '#5C4310',
    '#5C3A12': '#5C4310',
    '#4A3208': '#5C4310',
    '#96271F': '#A82C22',
    '#E0B94C': '#E0C46A',
    '#F2D27A': '#F2D98F',
    '#F7E7AE': '#F7E7C0',
    '#FFF7DE': '#1B2440',
    '#FFF3E2': '#16203A',
    '#FFF3EC': '#16203A',
    '#FFF6E2': '#16203A',
    '#FBF3E0': '#141B2C',
    '#F1E4C8': '#182238',
    '#F9DED4': '#2A1C24',
    # 冷色强调（蓝 / 紫 / 淡金高光）保持不变
    '#6FA8D8': '#6FA8D8',
    '#8F7AD6': '#8F7AD6',
    '#FBEAAD': '#FBEAAD',
}

# 新配色自身的颜色：重跑脚本时不该被当成"未归类"报出来
NEW = set(v.upper() for v in EXACT.values()) | {
    '#0B1120', '#16203A', '#070B14', '#141B2C', '#F0DFAE', '#2A2016', '#3E2F1E', '#16110A',
    '#C0392B', '#D9503C', '#7E241C', '#E8C877', '#3E7C68', '#5AA07C', '#3A5E96', '#05070D',
    '#C9A44C', '#8A6A24', '#1C2740', '#182238', '#1B2440', '#20142A', '#B08C3C', '#5C4310',
}

kept = {}


def remap(m):
    s = m.group(0)
    if s.startswith('#'):
        up = s.upper()
        if up in EXACT:
            return EXACT[up]
        if up not in NEW:
            kept[up] = kept.get(up, 0) + 1
        return s
    r, g, b = int(m.group(1)), int(m.group(2)), int(m.group(3))
    a = float(m.group(4)) if m.group(4) else 1.0
    key = 'rgba(%d,%d,%d,a)' % (r, g, b)

    if r >= 250 and g >= 250 and b >= 250:                      # 1 纯白
        return 'rgba(255,255,255,%.3f)' % (min(0.12, a * 0.14) if a >= 0.5 else min(0.16, a * 0.65))
    if r >= 235 and g >= 225 and b >= 195:                      # 2 暖白 / 纸面
        if a >= 0.5:
            return 'rgba(21,28,46,%.3f)' % min(0.96, a)
        return 'rgba(240,223,174,%.3f)' % min(0.18, a * 0.7)
    if abs(r - g) <= 16 and abs(g - b) <= 16 and 24 <= max(r, g, b) <= 100:   # 3 墨
        return 'rgba(240,223,174,%.3f)' % a
    if r >= 140 and r - g >= 55 and r - b >= 55:                # 4 朱砂
        return 'rgba(192,57,43,%.3f)' % a
    if r >= g >= b and max(r, g, b) < 235:                      # 5 暖深棕
        if a <= 0.26:
            return 'rgba(201,164,76,%.3f)' % min(0.34, a * 1.15)
        return 'rgba(0,0,0,%.3f)' % min(0.9, a * 1.2)
    kept[key] = kept.get(key, 0) + 1                            # 6/7 特效色与其余
    return s


def css_file(rel):
    """白名单里的 css 文件 → 路径，并确认父目录就是 css/。"""
    if rel not in ['css/' + n for n in FILES]:
        raise SystemExit('不在白名单里的样式文件：' + str(rel))
    path = (ROOT / rel).resolve()
    if path.parent != (ROOT / 'css').resolve():
        raise SystemExit('拒绝操作 css/ 之外的文件：' + rel)
    return path


def main():
    check = '--check' in sys.argv
    total = 0
    for rel in TARGETS:
        path = css_file(rel)
        src = path.read_text(encoding='utf-8')
        out = PAT.sub(remap, src)
        n = sum(1 for a, b in zip(PAT.finditer(src), PAT.finditer(out)) if a.group(0) != b.group(0))
        total += n
        if not check and out != src:
            path.write_text(out, encoding='utf-8')
        print('  %-16s 替换 %d 处' % (rel, n))
    print('\n%s 共 %d 处' % ('将替换' if check else '已替换', total))
    if kept:
        print('\n原样保留的颜色（特效色 / 未归类，需人工确认）：')
        for k, v in sorted(kept.items(), key=lambda kv: -kv[1]):
            print('  %3d  %s' % (v, k))


if __name__ == '__main__':
    main()
