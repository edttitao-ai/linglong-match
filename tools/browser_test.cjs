/* 玲珑消 · tools/browser_test.cjs — 无头浏览器冒烟测试（零依赖：内置 http + CDP over WebSocket）
 *
 *   node tools/browser_test.cjs                    1280×800 横屏
 *   node tools/browser_test.cjs --w=430 --h=800    窄屏
 *   node tools/browser_test.cjs --shot=out.png     存一张截图
 *   node tools/browser_test.cjs --keep             跑完不关浏览器（调试用）
 *
 * 做四件事：
 *   1. 把所有界面上的按钮全部点一遍，收集 console 报错与未捕获异常
 *   2. 脚本化演练四个技能 + 绝处逢生，校验灵力收支与盘面不变量
 *   3. 用真实指针事件过一遍棋盘输入（验证 input.js → Game.tapCell 的路由）
 *   4. 检查技能栏没有盖住棋盘最后一行，并可选截图
 *
 * 为什么不用 puppeteer：本项目零依赖、零构建，工具也不该引入外部包。
 * Node 22+ 自带 WebSocket 客户端，够直接讲 CDP。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const getArg = function (name, def) {
  const m = args.find(function (a) { return a.indexOf('--' + name + '=') === 0; });
  return m ? m.split('=')[1] : def;
};
const W = parseInt(getArg('w', '1280'), 10);
const H = parseInt(getArg('h', '800'), 10);
const SHOT = getArg('shot', '');
const KEEP = args.indexOf('--keep') >= 0;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.wav': 'audio/wav',
  '.png': 'image/png', '.json': 'application/json; charset=utf-8'
};

/* ---------- 静态服务器（避免 file:// 的各种限制） ---------- */
function startServer() {
  return new Promise(function (resolve) {
    const srv = http.createServer(function (req, res) {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const full = path.join(ROOT, p);
      if (full.indexOf(ROOT) !== 0 || !fs.existsSync(full) || fs.statSync(full).isDirectory()) {
        res.writeHead(404); res.end('not found'); return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
      fs.createReadStream(full).pipe(res);
    });
    srv.listen(0, '127.0.0.1', function () { resolve(srv); });
  });
}

/* ---------- 找浏览器 ---------- */
function findChrome() {
  const cands = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  ];
  for (let i = 0; i < cands.length; i++) if (cands[i] && fs.existsSync(cands[i])) return cands[i];
  return null;
}

function fetchJson(url) {
  return new Promise(function (resolve, reject) {
    http.get(url, function (res) {
      let body = '';
      res.on('data', function (d) { body += d; });
      res.on('end', function () { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

function waitFor(fn, timeout, label) {
  const t0 = Date.now();
  return new Promise(function (resolve, reject) {
    (function poll() {
      Promise.resolve(fn()).then(function (v) {
        if (v) return resolve(v);
        if (Date.now() - t0 > timeout) return reject(new Error('超时：' + label));
        setTimeout(poll, 150);
      }, function () {
        if (Date.now() - t0 > timeout) return reject(new Error('超时：' + label));
        setTimeout(poll, 150);
      });
    })();
  });
}

/* ---------- CDP 小客户端 ---------- */
function connect(wsUrl) {
  return new Promise(function (resolve, reject) {
    const ws = new WebSocket(wsUrl);
    let seq = 0;
    const pending = new Map();
    const errors = [];

    const api = {
      errors: errors,
      send: function (method, params) {
        return new Promise(function (res, rej) {
          const id = ++seq;
          pending.set(id, { res: res, rej: rej });
          ws.send(JSON.stringify({ id: id, method: method, params: params || {} }));
        });
      },
      evaluate: function (expr, awaitPromise) {
        return api.send('Runtime.evaluate', {
          expression: expr, returnByValue: true, awaitPromise: !!awaitPromise, userGesture: true
        }).then(function (r) {
          if (r.exceptionDetails) {
            throw new Error('页面内异常：' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text));
          }
          return r.result ? r.result.value : undefined;
        });
      },
      close: function () { try { ws.close(); } catch (e) { /* 忽略 */ } }
    };

    ws.onerror = function (e) { reject(new Error('WebSocket 连接失败')); };
    ws.onopen = function () { resolve(api); };
    ws.onmessage = function (ev) {
      let m;
      try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.id && pending.has(m.id)) {
        const p = pending.get(m.id);
        pending.delete(m.id);
        if (m.error) p.rej(new Error(m.method + ' ' + JSON.stringify(m.error)));
        else p.res(m.result);
        return;
      }
      if (m.method === 'Runtime.exceptionThrown') {
        const d = m.params.exceptionDetails;
        errors.push('未捕获异常：' + (d.exception && d.exception.description || d.text));
      } else if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'assert')) {
        errors.push('console.error：' + m.params.args.map(function (a) { return a.value != null ? a.value : a.description; }).join(' '));
      } else if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
        errors.push('日志错误：' + m.params.entry.text);
      }
    };
  });
}

/* ---------- 页面内脚本 ---------- */

/* 把每个界面的按钮都点一遍；返回点击次数与出错点 */
const CLICK_ALL = `(function () {
  var U = LL.U, log = [];
  var screens = ['title', 'map', 'daily', 'quests', 'checkin', 'settings'];
  var n = 0;
  function clickVisible(root) {
    var list = (root || document).querySelectorAll('button:not(.hidden)');
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (el.disabled) continue;
      if (el.offsetParent === null && el.getClientRects().length === 0) continue;
      try { el.click(); n++; } catch (e) { log.push(el.id + ':' + e.message); }
    }
  }
  for (var s = 0; s < screens.length; s++) {
    LL.UI.showScreen(screens[s]);
    clickVisible(document);
    LL.UI.hideOverlays && LL.UI.hideOverlays();
  }
  /* 对局内的按钮 */
  LL.Game.startLevel(0); LL.Game.introT = 0; LL.Game.state = 'playing';
  LL.UI.showScreen('game');
  clickVisible(document.getElementById('hud'));
  clickVisible(document.getElementById('skillBar'));
  LL.Game.pause(); clickVisible(document.getElementById('pause')); LL.Game.resume();
  LL.UI.showScreen('title');
  return { clicks: n, log: log };
})()`;

/* 技能演练拆成多步：每步之间必须等动画跑完（state 回到 playing）。
 * 不能在一个 evaluate 里连着放两个技能——第二次会被 canInput() 挡掉，
 * 因为真实节奏下那时还在 resolving。按真实节奏测才有意义。
 *
 * 断言分工：浏览器这边只查「技能真的生效了、灵力不越界、界面跟着变」，
 * 精确的灵力收支算式交给 tools/selftest.cjs 第 9 节（那边棋盘完全可控）。
 * 原因：技能引发的连锁会回灵力，浏览器里没法把回灵量框成常数。 */
const DRILL_SETUP = `(function () {
  var G = LL.Game, CFG = LL.CFG, SK = LL.Skills;
  window.__t = { steps: [], fail: [] };
  window.__ck = function (cond, msg) {
    __t.steps.push((cond ? 'ok  ' : 'FAIL ') + msg);
    if (!cond) __t.fail.push(msg);
  };
  LL.UI.hideOverlays();
  G.startLevel(18); G.introT = 0; G.state = 'playing';
  var b = G.board, stone = null, plain = null;
  for (var r = 0; r < b.R; r++) for (var c = 0; c < b.C; c++) {
    if (!stone && b.obst[r][c] && b.obst[r][c].k === CFG.OBST.STONE) stone = { r: r, c: c };
    if (!plain && SK.validTarget(b, { r: r, c: c }, 'color')) plain = { r: r, c: c };
  }
  __t.stone = stone; __t.plain = plain; __t.moves0 = G.movesLeft;
  __ck(G.qi === SK.qiStartFor(G.level), '开局灵力 = qiStartFor(level)（' + G.qi + '）');
  __ck(!!stone, '第 19 关存在石锁（测试前提）');
  return true;
})()`;

const DRILL_STEPS = [
  {
    label: '如意锤 · 瞄准',
    expr: `(function () {
      var G = LL.Game;
      G.qi = 120;
      __ck(G.useSkill('hammer') && !!G.aim && G.aim.id === 'hammer', '如意锤进入瞄准态');
      __ck(!!document.querySelector('.skill-slot.armed'), '技能栏高亮成瞄准态');
      __t.qiBefore = G.qi;
      __t.cells0 = G.board.cells[__t.stone.r][__t.stone.c] ? 1 : 0;
      return true;
    })()`
  },
  {
    label: '如意锤 · 结算',
    expr: `(function () {
      var G = LL.Game, cost = LL.CFG.SKILLS.hammer.cost;
      G.tapCell(__t.stone);
      __ck(!G.aim, '命中后自动退出瞄准态');
      /* 单格锤击的回灵上限 = 破障 6 + 引爆 5，所以扣费一定落在 [cost, cost-11] 区间 */
      __ck(G.qi <= __t.qiBefore - cost + 11 && G.qi >= __t.qiBefore - cost,
        '如意锤扣 ' + cost + ' 灵力（' + __t.qiBefore + '→' + G.qi + '，破障回灵已计入）');
      __ck(G.movesLeft === __t.moves0, '如意锤不消耗步数');
      __ck(G.board.obst[__t.stone.r][__t.stone.c] === null, '石锁被一锤破开（2 点伤害）');
      return true;
    })()`
  },
  {
    label: '瞄准态取消',
    expr: `(function () {
      var G = LL.Game;
      G.qi = 120;
      G.useSkill('hammer');
      __ck(!!G.aim, '再次进入瞄准态');
      __ck(!!document.querySelector('.skill-slot.armed'), '技能栏同步高亮');
      G.cancelAim();
      __ck(!G.aim, 'cancelAim 退出瞄准态');
      __ck(G.qi === 120, '取消不退灵力');
      __ck(!document.querySelector('.skill-slot.armed'), '技能栏取消高亮');
      return true;
    })()`
  },
  {
    label: '灵力不足被拒',
    expr: `(function () {
      var G = LL.Game;
      G.qi = 10;
      LL.UI.buildSkillBar();   /* 直接改 qi 绕过了游戏自己的刷新路径，这里手动同步一次 UI */
      __ck(G.useSkill('cross') === false, '灵力不足时放不出技能');
      __ck(!G.aim, '灵力不足时不进入瞄准态');
      __ck(G.qi === 10, '失败不扣灵力');
      __ck(!!document.querySelector('.skill-slot.empty'), '买不起的技能槽显示为空态');
      return true;
    })()`
  },
  {
    label: '移山 · 十字爆破',
    expr: `(function () {
      var G = LL.Game;
      G.qi = 120;
      var before = G.qi;
      __ck(G.useSkill('cross') && G.aim.id === 'cross', '移山进入瞄准态');
      __t.rowCells = 0;
      for (var c = 0; c < G.board.C; c++) if (G.board.cells[3][c]) __t.rowCells++;
      G.tapCell({ r: 3, c: 3 });
      __ck(G.qi < before && G.qi <= LL.CFG.QI.MAX, '移山扣灵力且不越上限（' + before + '→' + G.qi + '）');
      __ck(G.movesLeft === __t.moves0, '移山不消耗步数');
      __ck(__t.rowCells >= 8, '测试前提：第 4 行本来有 ' + __t.rowCells + ' 格可清');
      return true;
    })()`
  },
  {
    label: '灵犀一点 · 选格选色',
    expr: `(function () {
      var G = LL.Game;
      G.qi = 120;
      var before = G.qi;
      __ck(G.useSkill('color') && G.aim.id === 'color', '灵犀一点进入瞄准态');
      G.tapCell(__t.plain);
      __ck(!!G.aim && G.aim.stage === 'color', '选格后进入选色阶段');
      var dots = document.querySelectorAll('#colorRing .color-dot').length;
      __ck(dots === G.board.colors, '选色环只列本关存在的颜色（' + dots + '/' + G.board.colors + '）');
      __t.colorCell = { r: __t.plain.r, c: __t.plain.c };
      G.castSkill('color', __t.plain, 1, G.aim.cost);
      var tl = G.board.cells[__t.colorCell.r][__t.colorCell.c];
      __ck(!tl || tl.t === 1 || G.state === 'resolving', '目标格已变成所选颜色（或随即被连锁消掉）');
      __ck(G.qi < before && G.qi <= LL.CFG.QI.MAX, '改色扣灵力且不越上限（' + before + '→' + G.qi + '）');
      __ck(G.movesLeft === __t.moves0, '灵犀一点不消耗步数');
      return true;
    })()`
  },
  {
    label: '换天 · 全盘重排',
    expr: `(function () {
      var G = LL.Game, cost = LL.CFG.SKILLS.swap.cost;
      G.qi = 120;
      var before = G.qi;
      G.useSkill('swap');
      __ck(!G.aim && G.qi === before - cost, '换天扣 ' + cost + ' 灵力且不需要瞄准');
      __ck(G.movesLeft === __t.moves0, '换天不消耗步数');
      return true;
    })()`
  },
  {
    label: '绝处逢生 · 灵力换步数',
    expr: `(function () {
      var G = LL.Game, LS = LL.CFG.LAST_STAND;
      G.qi = 120; G.movesLeft = 0; G.lastStandUsed = 0; G.state = 'playing';
      G.finishTurnInner();
      __ck(!!G.pendingLastStand, '步数耗尽且灵力充足时提供绝处逢生');
      __ck(G.state === 'laststand', '进入绝处逢生态');
      __ck(!document.getElementById('lastStand').classList.contains('hidden'), '绝处逢生面板已弹出');
      var before = G.qi, coins = LL.Progress.data.coins;
      G.useLastStand();
      __ck(G.movesLeft === LS.moves, '换到 +' + LS.moves + ' 步');
      __ck(G.qi === before - LS.cost, '扣灵力');
      __ck(LL.Progress.data.coins === coins, '不花金币（守住铁律）');
      __ck(G.state === 'playing', '回到可操作状态');
      __ck(document.getElementById('lastStand').classList.contains('hidden'), '面板已收起');
      return true;
    })()`
  },
  {
    label: '绝处逢生 · 次数与门槛',
    expr: `(function () {
      var G = LL.Game;
      G.qi = 120; G.movesLeft = 0;
      G.finishTurnInner();
      if (G.pendingLastStand) G.useLastStand();
      G.movesLeft = 0;
      G.finishTurnInner();
      __ck(!G.pendingLastStand, '达到次数上限后不再提供（防连锁循环）');
      if (G.state === 'laststand') G.useLastStand();
      G.qi = LL.CFG.LAST_STAND.cost - 1; G.movesLeft = 0; G.lastStandUsed = 0;
      G.finishTurnInner();
      __ck(!G.pendingLastStand, '灵力不够时不提供（不推销）');
      return true;
    })()`
  },
  {
    label: '技能不吃步数（源码级）',
    expr: `(function () {
      __ck(String(LL.Game.attemptSwap).indexOf('movesLeft--') >= 0, '扣步数在 attemptSwap 里');
      __ck(String(LL.Game.castSkill).indexOf('movesLeft') < 0, 'castSkill 完全不碰步数');
      __ck(String(LL.Game.useLastStand).indexOf('spendCoins') < 0, '绝处逢生不花钱');
      __ck(String(LL.Game.castSkill).indexOf('spendCoins') < 0, '技能不花金币（灵力只能玩出来）');
      return true;
    })()`
  }
];

const BOARD_INVARIANTS = `(function () {
  var B = LL.Board, b = LL.Game.board, bad = [];
  for (var r = 0; r < b.R; r++) for (var c = 0; c < b.C; c++) {
    if (b.playable[r][c] && !b.cells[r][c]) bad.push('空格 ' + r + ',' + c);
  }
  if (B.findMatches(b).length) bad.push('残留三连');
  return bad;
})()`;

/* 布局检查：geom 是画布局部坐标，技能栏是页面坐标，
 * 必须先把棋盘底换算成页面坐标再比，否则窄屏下会得到一个假通过。 */
const LAYOUT_CHECK = `(function () {
  var bar = document.getElementById('skillBar');
  var cv = document.getElementById('game');
  var cr = cv.getBoundingClientRect();
  var g = LL.Render.geom;
  var r = bar.getBoundingClientRect();
  var boardTop = cr.top + g.by;
  var boardBottom = boardTop + g.board;
  return {
    visible: !bar.classList.contains('hidden'),
    canvas: { top: Math.round(cr.top), h: Math.round(cr.height), w: Math.round(cr.width) },
    board: { top: Math.round(boardTop), bottom: Math.round(boardBottom), size: Math.round(g.board) },
    bar: { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height) },
    gapBelowBoard: Math.round(r.top - boardBottom),
    gapAboveBoard: Math.round(boardTop - cr.top),
    inset: LL.Render.bottomInset,
    slots: bar.querySelectorAll('.skill-slot').length,
    qiText: (document.getElementById('qiValue') || {}).textContent,
    withinCanvas: boardBottom <= cr.bottom + 1 && boardTop >= cr.top - 1 && r.bottom <= cr.bottom + 1
  };
})()`;

const STATE_DUMP = `(function () {
  return { state: LL.Game.state, qi: Math.round(LL.Game.qi), moves: LL.Game.movesLeft,
           score: LL.Game.score, level: LL.Game.level && LL.Game.level.id,
           aim: LL.Game.aim && LL.Game.aim.id };
})()`;

/* ---------- 主流程 ---------- */
(async function main() {
  const chrome = findChrome();
  if (!chrome) { console.error('找不到 Chrome / Edge，无法做浏览器测试'); process.exit(1); }

  const srv = await startServer();
  const port = srv.address().port;
  const base = 'http://127.0.0.1:' + port;
  const dbgPort = 9222 + Math.floor(Math.random() * 300);
  const profile = path.join(require('os').tmpdir(), 'linglong-test-' + process.pid);

  const child = spawn(chrome, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--mute-audio', '--hide-scrollbars',
    '--window-size=' + W + ',' + H,
    '--user-data-dir=' + profile,
    '--remote-debugging-port=' + dbgPort,
    'about:blank'
  ], { stdio: 'ignore' });

  let cdp = null;
  const cleanup = function () {
    if (cdp) cdp.close();
    try { child.kill(); } catch (e) { /* 忽略 */ }
    try { srv.close(); } catch (e) { /* 忽略 */ }
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) { /* 忽略 */ }
  };

  try {
    await waitFor(function () { return fetchJson('http://127.0.0.1:' + dbgPort + '/json/version').catch(function () { return null; }); },
      20000, '等待浏览器调试端口');
    const list = await fetchJson('http://127.0.0.1:' + dbgPort + '/json/list');
    const page = list.find(function (t) { return t.type === 'page'; });
    if (!page) throw new Error('没有可用的页面 target');
    cdp = await connect(page.webSocketDebuggerUrl);
    await cdp.send('Runtime.enable');
    await cdp.send('Log.enable');
    await cdp.send('Page.enable');

    await cdp.send('Page.navigate', { url: base + '/index.html' });
    await waitFor(function () {
      /* 标题页还没有棋盘（Game.board === null），所以只等资源加载完成 */
      return cdp.evaluate('!!(window.LL && LL.Game && LL.Assets && LL.Assets.ready)');
    }, 25000, '等待游戏加载完成').catch(function (e) {
      return cdp.evaluate('({readyState: document.readyState, hasLL: !!window.LL, keys: window.LL ? Object.keys(LL).join(",") : "", titleHidden: (document.getElementById("title")||{}).className})')
        .then(function (d) {
          throw new Error(e.message + '｜页面状态 ' + JSON.stringify(d) +
            '｜报错 ' + (cdp.errors.join(' / ') || '无'));
        });
    });

    const results = [];
    const report = function (label, ok, detail) {
      results.push({ label: label, ok: ok, detail: detail });
      console.log((ok ? '  ✓ ' : '  ✗ ') + label + (detail ? '  ' + detail : ''));
    };

    console.log('玲珑消 · 无头浏览器测试（' + W + '×' + H + '）\n');

    /* 1. 全按钮冒烟 */
    console.log('[1] 界面按钮冒烟');
    const c = await cdp.evaluate(CLICK_ALL);
    await waitFor(function () { return cdp.evaluate(STATE_DUMP).then(function (s) { return s.state === 'playing' || s.state === 'idle'; }); },
      8000, '点击后回到稳定状态').catch(function () { /* 状态机可能停在中间，不致命 */ });
    report('点击 ' + c.clicks + ' 个按钮无 JS 异常', c.log.length === 0, c.log.slice(0, 3).join(' | '));

    /* 2. 技能演练（分步执行，每步之间等动画收束） */
    console.log('\n[2] 技能与灵力演练（第 19 关 · 石锁盘面）');
    await cdp.send('Page.navigate', { url: base + '/index.html?level=19' });
    await waitFor(function () {
      return cdp.evaluate('!!(window.LL && LL.Game && LL.Assets.ready && LL.Game.level && LL.Game.level.id === 19)');
    }, 20000, '第 19 关就绪');

    const waitPlayable = function () {
      return waitFor(function () {
        return cdp.evaluate('(LL.Game.state === "playing" && !LL.Anim.cur) ? true : (LL.Anim.cur ? false : (LL.Game.state === "lost" || LL.Game.state === "won" || LL.Game.state === "over"))');
      }, 20000, '等待动画收束');
    };
    await waitPlayable();
    await cdp.evaluate('LL.Game.state = "playing"');
    await cdp.evaluate(DRILL_SETUP);
    for (let i = 0; i < DRILL_STEPS.length; i++) {
      const step = DRILL_STEPS[i];
      try {
        await cdp.evaluate(step.expr);
      } catch (e) {
        await cdp.evaluate('__ck(false, ' + JSON.stringify('[步骤异常] ' + step.label + '：' + e.message) + ')');
      }
      if (step.label.indexOf('绝处逢生') < 0 && step.label.indexOf('取消') < 0 && step.label.indexOf('不足') < 0) {
        await waitPlayable().catch(function () { /* 该步可能本该结束回合，交给最后的不变量检查 */ });
        await cdp.evaluate('if (LL.Game.state !== "playing") { LL.Game.state = "playing"; }');
      }
    }
    const drill = await cdp.evaluate('({ steps: __t.steps, fail: __t.fail })');
    drill.steps.forEach(function (s) { if (s.indexOf('ok  ') !== 0) console.log('  ✗ ' + s.slice(5)); });
    report('技能演练 ' + (drill.steps.length - drill.fail.length) + '/' + drill.steps.length + ' 项',
      drill.fail.length === 0, drill.fail.slice(0, 3).join(' | '));

    /* 3. 盘面不变量 */
    await waitFor(function () {
      return cdp.evaluate('LL.Game.state === "playing" || LL.Game.state === "lost" || LL.Game.state === "won" || LL.Game.state === "over"');
    }, 12000, '技能带来的连锁全部收束').catch(function () { /* 超时也继续检查 */ });
    const inv = await cdp.evaluate(BOARD_INVARIANTS);
    report('技能之后盘面无空格、无残留三连', inv.length === 0, inv.slice(0, 3).join(' | '));

    /* 4. 真实指针事件：点棋盘 → input.js → Game.tapCell → 选中 */
    console.log('\n[3] 真实指针输入');
    await cdp.evaluate('LL.Game.state = "playing"; LL.Game.aim = null; LL.Game.selected = null; true');
    const cellInfo = await cdp.evaluate('(function(){var g=LL.Render.geom;var r=document.getElementById("game").getBoundingClientRect();return {x:r.left+g.bx+g.cell*2.5,y:r.top+g.by+g.cell*2.5,hits:(document.elementFromPoint(r.left+g.bx+g.cell*2.5,r.top+g.by+g.cell*2.5)||{}).id,canInput:LL.Game.canInput()};})()');
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: cellInfo.x, y: cellInfo.y });
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: cellInfo.x, y: cellInfo.y, button: 'left', clickCount: 1, buttons: 1 });
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: cellInfo.x, y: cellInfo.y, button: 'left', clickCount: 1, buttons: 0 });
    await new Promise(function (r) { setTimeout(r, 250); });
    const sel = await cdp.evaluate('LL.Game.selected ? LL.Game.selected.r + "," + LL.Game.selected.c : null');
    const st4 = await cdp.evaluate(STATE_DUMP);
    report('指针点击棋盘被识别为选格（格 2,2）', sel === '2,2',
      'selected=' + sel + ' · 命中元素 ' + cellInfo.hits + ' · canInput ' + cellInfo.canInput + ' · state ' + st4.state);

    /* 5. 技能栏不盖棋盘 */
    console.log('\n[4] 布局');
    const lay = await cdp.evaluate(LAYOUT_CHECK);
    report('技能栏可见且有 4 个技能槽', lay.visible && lay.slots === 4, '槽位 ' + lay.slots + ' · 灵力 ' + lay.qiText);
    report('棋盘最后一行未被技能栏遮挡', lay.gapBelowBoard > 0,
      '棋盘 ' + lay.board.top + '~' + lay.board.bottom + '（' + lay.board.size + 'px）· 技能栏 ' +
      lay.bar.top + '~' + lay.bar.bottom + ' · 栏在棋盘下方 ' + lay.gapBelowBoard + 'px · inset ' + lay.inset);
    report('棋盘与技能栏都收在画布内', lay.withinCanvas,
      '画布 top ' + lay.canvas.top + ' h ' + lay.canvas.h + ' · 棋盘上方留白 ' + lay.gapAboveBoard + 'px');

    /* 6. 截图 */
    if (SHOT) {
      const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
      const out = path.isAbsolute(SHOT) ? SHOT : path.join(ROOT, SHOT);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, Buffer.from(shot.data, 'base64'));
      console.log('\n  截图 → ' + out);
    }

    /* 7. 运行期报错 */
    const errs = cdp.errors.slice();
    report('全程无 console 报错 / 未捕获异常', errs.length === 0, errs.slice(0, 4).join(' | '));

    const failed = results.filter(function (r) { return !r.ok; });
    console.log('\n' + '─'.repeat(56));
    console.log('通过 ' + (results.length - failed.length) + '/' + results.length + ' 项');
    if (failed.length) {
      console.log('\n失败明细：');
      failed.forEach(function (f) { console.log('  ✗ ' + f.label + (f.detail ? '  ' + f.detail : '')); });
    }
    if (!KEEP) cleanup();
    process.exit(failed.length ? 1 : 0);
  } catch (e) {
    console.error('\n测试中断：' + e.message);
    if (cdp) console.error('页面报错：' + cdp.errors.slice(0, 6).join('\n'));
    cleanup();
    process.exit(1);
  }
})();
