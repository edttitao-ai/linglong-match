"""玲珑消 · tools/restyle_dark.py — 把旧"宣纸浅色"素材的 SVG 改成 A 方案「玄漆描金」配色。

只动 assets/img 下那批**矢量外圈**（棋盘框、纸底、远山、云纹、四角、卷轴、成就徽记），
方块/技能/UI 小图标已经是 AI 生成的位图，不走这里。

三条原则：
  1. 表里没有的颜色一律报错退出——宁可漏改被发现，也不要静默留下旧色。
  2. 深色描边不能简单映射成亮金，否则徽记的内部结构会糊成一片：暗描边→暗金，主体→中金，高光→亮金。
  3. 只替换颜色值，不改结构；大小写不敏感（board_frame.svg 里是小写）。

用法：
    python tools/restyle_dark.py --check     # 只报告，不写文件
    python tools/restyle_dark.py             # 就地改色
"""
import re
import sys
from pathlib import Path

BASE = (Path(__file__).resolve().parent.parent / 'assets' / 'img').resolve()

TARGETS = (['board_frame.svg', 'bg_paper.svg', 'bg_mountains.svg', 'ui_cloud.svg']
           + ['ui_corner_%s.svg' % s for s in ('tl', 'tr', 'bl', 'br')]
           + ['scroll_l%d.svg' % i for i in range(1, 6)]
           + sorted(p.name for p in BASE.glob('ach_*.svg')))

# 旧色 → 新色
MAP = {
    # 宣纸与浅底 → 漆底与暗面
    '#F3E8D1': '#0F1728',
    '#FBF6EA': '#141B2C',
    '#FFFCF0': '#182240',
    # 玉青（浅色纸感）→ 深底上的玉青，保持可辨
    '#7E9A82': '#3E7C68',
    '#4A6B52': '#2A5A4A',
    '#2F4A3A': '#17342A',
    '#22382C': '#10241E',
    '#3A3226': '#6A5A32',
    # 金色族：暗金 → 中金 → 亮金，保持三级层次
    '#C9A227': '#C9A44C',
    '#8A6A3A': '#C9A44C',   # 棋盘框的描线要够亮才压得住深底
    '#8A5F18': '#A8812C',   # 徽记主体
    '#4A4038': '#5C4310',   # 徽记暗描边
    '#4A3F2E': '#5C4310',
    '#6D5C42': '#B08C3C',
    '#7A6A52': '#D8C48A',
    '#B7A583': '#E8D9A8',
    '#E8C86A': '#E8C877',
    '#D99A24': '#D9A63C',
    '#8A5C12': '#8A6A24',
    '#8A5E14': '#8A6A24',
    # 朱砂略提亮，深底上不发闷
    '#B8342C': '#C0392B',
    '#8E231D': '#A82C22',
}

HEX = re.compile(r'#([0-9A-Fa-f]{6})\b')

# 新配色自身的颜色：重跑时不该被当成"未登记"报出来
NEW = {'#0F1728', '#141B2C', '#182240', '#0B1120', '#070B14', '#16203A', '#05070D',
       '#3E7C68', '#2A5A4A', '#17342A', '#10241E', '#6A5A32', '#C9A44C', '#A8812C',
       '#5C4310', '#B08C3C', '#D8C48A', '#E8D9A8', '#E8C877', '#D9A63C', '#8A6A24',
       '#C0392B', '#6FBFA0', '#4E9A7E', '#2E6B58', '#1E4A3C', '#8A7A46', '#A82C22',
       '#24485A', '#17323F', '#0E2130',
       # 徽记里的浅色点缀（石灰色、米白、奶白）：深底上本来就看得清，保持原样
       '#CFD6DC', '#E2DCD0', '#FFF3C4', '#FFF6E2', '#FFFFFF'}

# 卷轴是"点亮一层亮一层"的展示画，深底上要够亮才看得出层次，
# 所以山体用比 bg_mountains 更亮的玉青（同名颜色在背景里要压暗、在这里要提亮，只能分文件）
SCROLL_MAP = {
    '#3E7C68': '#6FBFA0',
    '#2A5A4A': '#4E9A7E',
    '#17342A': '#2E6B58',
    '#10241E': '#1E4A3C',
    '#6A5A32': '#8A7A46',
}


# 远山是标题页/地图的底纹，深底上要退成"夜山"：偏蓝、压暗，别保留玉青的饱和度，
# 否则整块绿在深蓝底上会显脏（同一批颜色在卷轴里反而要提亮，所以分文件处理）
MOUNTAIN_MAP = {
    '#3E7C68': '#24485A',
    '#2A5A4A': '#17323F',
    '#17342A': '#0E2130',
}


def palette_for(name):
    if name.startswith('scroll_l'):
        return dict(MAP, **SCROLL_MAP)
    if name.startswith('bg_mountains'):
        return dict(MAP, **MOUNTAIN_MAP)
    return MAP


def asset_file(name):
    """白名单文件名 → 路径。名字先去掉目录成分，再确认父目录就是 assets/img。"""
    safe = Path(name).name
    if safe != name or safe not in TARGETS:
        raise SystemExit('不在白名单里的文件名：' + str(name))
    path = (BASE / safe).resolve()
    if path.parent != BASE:
        raise SystemExit('拒绝操作 assets/img 之外的文件：' + safe)
    return path


def main():
    check = '--check' in sys.argv
    unknown = set()
    changed = []
    for name in TARGETS:
        path = asset_file(name)
        if not path.is_file():
            print('  缺文件：' + name)
            continue
        table = palette_for(name)
        src = path.read_text(encoding='utf-8')
        hits = set('#' + h.upper() for h in HEX.findall(src))
        unknown.update(c for c in hits if c not in table and c not in NEW)
        out = HEX.sub(lambda m: table.get('#' + m.group(1).upper(), m.group(0)), src)
        if out != src:
            changed.append(name)
            if not check:
                path.write_text(out, encoding='utf-8')
        print('  %-22s %s' % (name, ('改色 ' + ','.join(sorted(hits))) if out != src else '无需改'))
    print('\n%s %d 个文件' % ('将改色' if check else '已改色', len(changed)))
    if unknown:
        raise SystemExit('有未登记的颜色，请先补进 MAP：' + ', '.join(sorted(unknown)))


if __name__ == '__main__':
    main()
