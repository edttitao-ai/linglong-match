"""玲珑消 · tools/split_readme.py — 把过长的 README 拆成「精简首页 + docs/ 详解」。

README 是给玩家看的门面，不是开发笔记。所以：
  · 玩家要的（这是什么游戏 / 怎么玩 / 怎么跑 / 截图）留在 README；
  · 设计与工程的细节（技术实现、工具、自检覆盖、界面与音效设计、平衡方法论）原样搬进 docs/，
    README 只留链接——内容不丢，只是不再挡在门口。

脚本只负责「搬家」：按行区间把原文切出来，把顶级标题降一级（`## X` → `# X`）并加上返回链接。
新 README 是重写的，不在这里生成。

用法：
    python tools/split_readme.py --check     # 只报告会切出什么
    python tools/split_readme.py             # 写 docs/*.md
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
README = ROOT / 'README.md'

# 目标文件 → [(起始标题, 结束标题)]；区间按标题切，不写死行号（改 README 也不会切歪）
PLAN = {
    'docs/gameplay.md': [('## 🎯 这是个什么游戏', '## 🎮 快速开始'),
                         ('## 🗺️ 关卡设计', '## 🚧 后续可做')],
    'docs/development.md': [('## ⚙️ 技术实现', '## 🎨 界面设计'),
                            ('## 🚧 后续可做', '## License')],
    'docs/design.md': [('## 🎨 界面设计', '## 🗺️ 关卡设计')],
}
HEAD = {
    'docs/gameplay.md': '玩法与系统',
    'docs/development.md': '开发与工具',
    'docs/design.md': '设计与素材',
}


def sections(lines):
    """标题（含 `## ` 前缀）→ (起, 止)；止 = 下一个同级标题的位置。"""
    marks = []
    for i, ln in enumerate(lines):
        m = re.match(r'^## \S', ln)
        if m:
            marks.append((ln.rstrip('\n'), i))
    out = {}
    for idx, (title, start) in enumerate(marks):
        end = marks[idx + 1][1] if idx + 1 < len(marks) else len(lines)
        out[title] = (start, end)
    return out


def main():
    check = '--check' in sys.argv
    lines = README.read_text(encoding='utf-8').splitlines(keepends=True)
    sec = sections(lines)
    for rel, spans in PLAN.items():
        body = []
        for a, b in spans:
            if a not in sec:
                raise SystemExit('找不到段落：' + a)
            body.extend(lines[sec[a][0]:sec[b][0]] if b in sec else lines[sec[a][0]:])
        text = ''.join(body)   # 标题层级原样保留：分册自己的 H1 在上，段落仍是 H2/H3
        head = ('# %s\n\n> 本文是 [README](../README.md) 的详解分册，讲的是设计与实现；'
                '想快速上手直接看 README。\n\n' % HEAD[rel])
        target = (ROOT / rel).resolve()
        if target.parent != (ROOT / 'docs').resolve():
            raise SystemExit('拒绝操作 docs/ 之外的文件：' + rel)
        n = text.count('\n')
        print('  %-22s %3d 行' % (rel, n))
        if not check:
            target.parent.mkdir(exist_ok=True)
            (target).write_text(head + text, encoding='utf-8')


if __name__ == '__main__':
    main()
