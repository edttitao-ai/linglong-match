"""玲珑消 · tools/slice_sheet.py — 把 AI 生成的素材表切成一个个带透明通道的 PNG。

素材表有两种来路，脚本都要能吃：
  · 带 alpha 的表（Agnes 直接给透明底）→ 用 alpha 找网格缝隙
  · 纯 RGB 的表（背景是纯黑或纯色）→ 先从四边泛洪抠底，再按抠出的掩码分格

为什么不用 cv2/scipy：本机只保证有 numpy + Pillow。泛洪用 numpy 的迭代膨胀实现，
比逐像素 BFS 快，也不引入新依赖。

用法：
    python tools/slice_sheet.py <sheet.png> <out_dir> <名字1,名字2,...> [--size=256] [--pad=3]

名字按"从左到右、从上到下"的顺序对应每个图标；写 `-` 表示这一格跳过（模型多画了东西时用）。
每个图标会被裁到内容包围盒、补成正方形（不拉伸变形）、再缩到 --size，保证游戏里画出来一样大。
"""
import os
import sys

import numpy as np
from PIL import Image


def parse_args(argv):
    if len(argv) < 4:
        raise SystemExit(__doc__)
    src, out_dir, names = argv[1], argv[2], argv[3].split(',')
    opts = {'size': 256, 'pad': 3, 'open': 0}
    for a in argv[4:]:
        if a.startswith('--size='):
            opts['size'] = int(a.split('=', 1)[1])
        elif a.startswith('--pad='):
            opts['pad'] = int(a.split('=', 1)[1])
        elif a.startswith('--open='):
            opts['open'] = int(a.split('=', 1)[1])
    return src, out_dir, names, opts


def alpha_from_rgb(arr, thresh=40, open_px=0):
    """纯色底抠图：返回布尔掩码（True = 内容）。

    背景判定三条一起用，避免把深色但属于内容的像素误抠：
      1) 三通道都低于 thresh（近黑）；
      2) 与四角采样出的底色足够接近；
      3) 再从四边泛洪，只有与边缘连通的背景才算背景——图标内部的深色区域不会被掏空。

    open_px > 0 时，额外挖掉**被围住的**大块近黑区域（先腐蚀再膨胀 = 形态学开运算，
    只有比 open_px*2 还大的黑块会留下）。霜环、藤蔓环这类空心素材中间是透出黑底的洞，
    不与四边连通，光靠泛洪抠不掉，会变成一块不透明的黑斑。
    """
    h, w, _ = arr.shape
    dark = arr.max(axis=2) < thresh

    corners = np.stack([arr[2, 2], arr[2, w - 3], arr[h - 3, 2], arr[h - 3, w - 3]])
    base = np.median(corners, axis=0)
    near = np.abs(arr - base).max(axis=2) < thresh
    cand = dark & near

    seed = np.zeros((h, w), bool)
    seed[0, :] = seed[-1, :] = True
    seed[:, 0] = seed[:, -1] = True
    bg = seed & cand
    while True:
        grow = bg.copy()
        grow[1:, :] |= bg[:-1, :]
        grow[:-1, :] |= bg[1:, :]
        grow[:, 1:] |= bg[:, :-1]
        grow[:, :-1] |= bg[:, 1:]
        grow &= cand
        if grow.sum() == bg.sum():
            break
        bg = grow

    if open_px > 0:
        shrunk = cand.copy()
        for _ in range(open_px):                       # 腐蚀：细小的黑色细节（描边、锁孔）会消失
            s = shrunk.copy()
            s[1:, :] &= shrunk[:-1, :]
            s[:-1, :] &= shrunk[1:, :]
            s[:, 1:] &= shrunk[:, :-1]
            s[:, :-1] &= shrunk[:, 1:]
            shrunk = s
        holes = shrunk.copy()
        for _ in range(open_px):                       # 膨胀回原尺寸：只剩"够大"的黑块
            g = holes.copy()
            g[1:, :] |= holes[:-1, :]
            g[:-1, :] |= holes[1:, :]
            g[:, 1:] |= holes[:, :-1]
            g[:, :-1] |= holes[:, 1:]
            holes = g & cand
        bg = bg | holes
    return ~bg


def bands(profile, min_len=2):
    out, start = [], None
    for i, v in enumerate(profile):
        if v and start is None:
            start = i
        elif not v and start is not None:
            out.append((start, i))
            start = None
    if start is not None:
        out.append((start, len(profile)))
    return [b for b in out if b[1] - b[0] >= min_len]


def collect_cells(mask, min_side):
    """按行投影分带、带内再按列分带，收集所有够大的单元格。

    分带只依赖投影，噪点（抠底残留的光晕碎点）会切出假的行/列；
    所以这里先收集全部格子，再按几何位置重新排序，最后丢掉太小的格子——
    顺序由位置决定，不由投影带决定。
    """
    cells = []
    for r0, r1 in bands(mask.any(axis=1)):
        row = mask[r0:r1]
        for c0, c1 in bands(row.any(axis=0)):
            sub = row[:, c0:c1]
            ys, xs = np.where(sub)
            top, bot = r0 + int(ys.min()), r0 + int(ys.max()) + 1
            left, right = c0 + int(xs.min()), c0 + int(xs.max()) + 1
            if max(right - left, bot - top) < min_side:
                continue
            cells.append((top, left, bot, right))

    cells.sort(key=lambda b: (b[0], b[1]))
    rows, cur = [], []
    for b in cells:
        if cur and b[0] > cur[0][0] + (cur[0][2] - cur[0][0]) * 0.5:
            rows.append(sorted(cur, key=lambda x: x[1]))
            cur = []
        cur.append(b)
    if cur:
        rows.append(sorted(cur, key=lambda x: x[1]))
    return [b for row in rows for b in row]


def to_square(im, pad, size):
    """补成正方形（居中留白，不拉伸），再缩放到 size。"""
    w, h = im.size
    side = max(w, h) + pad * 2
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    canvas.paste(im, ((side - w) // 2, (side - h) // 2))
    return canvas.resize((size, size), Image.LANCZOS)


def main():
    src, out_dir, names, opts = parse_args(sys.argv)
    im = Image.open(src)
    has_alpha = im.mode in ('RGBA', 'LA') and np.array(im.getchannel('A')).min() < 16
    rgb = im.convert('RGB')
    arr = np.array(rgb).astype(int)

    mask = np.array(im.getchannel('A')) > 24 if has_alpha else alpha_from_rgb(arr, open_px=opts['open'])
    print('%s  %s  抠底方式：%s' % (os.path.basename(src), '%dx%d' % im.size,
                                   '用自带 alpha' if has_alpha
                                   else '按纯色底泛洪' + ('（挖空洞 %dpx）' % opts['open'] if opts['open'] else '')))

    rgba = np.dstack([arr.astype(np.uint8), (mask * 255).astype(np.uint8)])
    os.makedirs(out_dir, exist_ok=True)

    min_side = max(48, im.size[0] // 40)
    cells = collect_cells(mask, min_side)
    kept, boxes = 0, []
    for idx, (top, left, bot, right) in enumerate(cells):
        name = names[idx] if idx < len(names) else 'extra%d' % idx
        if name == '-':
            continue
        piece = Image.fromarray(rgba[top:bot, left:right], 'RGBA')
        to_square(piece, opts['pad'], opts['size']).save(os.path.join(out_dir, name + '.png'))
        kept += 1
        boxes.append((name, right - left, bot - top))

    for name, w, h in boxes:
        print('  %-20s 原图 %4dx%-4d → %dpx 方形' % (name, w, h, opts['size']))
    print('共 %d 格（已滤掉小于 %dpx 的碎点），导出 %d 个 → %s'
          % (len(cells), min_side, kept, out_dir))


if __name__ == '__main__':
    main()
