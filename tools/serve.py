#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""玲珑消 · tools/serve.py — 本地开发用静态服务器（禁用缓存）

    python tools/serve.py [端口] [根目录]      # 默认 8901 + 当前目录

为什么不直接用 `python -m http.server`：它不发送 Cache-Control，浏览器会按
Last-Modified 做启发式缓存，改完 JS/CSS 刷新可能仍是旧文件，排查起来很费时间。
这个服务器给所有响应加 no-store，改完刷新即生效。

游戏本身不需要服务器：直接双击 index.html 也能玩（见 README）。
"""

import functools
import http.server
import os
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, fmt, *args):
        # 只打印错误，避免刷屏
        if args and str(args[1]).startswith(('4', '5')):
            super().log_message(fmt, *args)


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8901
    root = sys.argv[2] if len(sys.argv) > 2 else os.getcwd()
    handler = functools.partial(NoCacheHandler, directory=root)
    server = http.server.ThreadingHTTPServer(('127.0.0.1', port), handler)
    print('serving %s at http://127.0.0.1:%d/ (no-cache)' % (root, port))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
