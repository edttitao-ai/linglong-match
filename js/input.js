/* 玲珑消 · input.js — 鼠标 / 触摸统一输入（点选交换 + 拖拽滑动 + 长按提示加速） */
(function (global) {
  'use strict';
  const LL = (global.LL = global.LL || {});
  const U = LL.U;

  const Input = {
    canvas: null,
    down: false,
    dragFrom: null,
    dragHandled: false,

    init(canvas) {
      this.canvas = canvas;
      const self = this;
      const pos = function (e) {
        const r = canvas.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
      };

      U.on(canvas, 'pointerdown', function (e) {
        Audio_unlock();
        const p = pos(e);
        const cell = LL.Render.pointToCell(p.x, p.y);
        const Game = LL.Game;
        Game.notifyInput();
        if (!Game.canInput()) {
          /* 结算动画中点击 = 加速 */
          if (Game.state === 'resolving') LL.Anim.accel();
          return;
        }
        if (!cell) return;
        e.preventDefault();
        self.down = true;
        self.dragFrom = cell;
        self.dragHandled = false;
        Game.setHover(cell);
        const sel = Game.selected;
        if (sel && sel.r === cell.r && sel.c === cell.c) {
          Game.setSelected(null);
          self.dragHandled = true;
        } else if (sel && (Math.abs(sel.r - cell.r) + Math.abs(sel.c - cell.c) === 1)) {
          Game.attemptSwap(sel, cell);
          self.dragHandled = true;
          self.down = false;
        } else {
          Game.setSelected(cell);
        }
      }, { passive: false });

      U.on(canvas, 'pointermove', function (e) {
        const p = pos(e);
        const cell = LL.Render.pointToCell(p.x, p.y);
        const Game = LL.Game;
        if (!self.down) {
          Game.setHover(cell);
          return;
        }
        if (!self.dragHandled && self.dragFrom && cell) {
          const d = Math.abs(cell.r - self.dragFrom.r) + Math.abs(cell.c - self.dragFrom.c);
          if (d === 1) {
            Game.setSelected(null);
            Game.attemptSwap(self.dragFrom, cell);
            self.dragHandled = true;
          } else if (d > 1) {
            self.dragHandled = true;   /* 拖过头：本次手势作废 */
          }
        }
      });

      const end = function () { self.down = false; self.dragFrom = null; self.dragHandled = false; };
      U.on(canvas, 'pointerup', end);
      U.on(canvas, 'pointercancel', end);
      U.on(canvas, 'pointerleave', function () { LL.Game.setHover(null); });

      /* 触屏滚动与长按菜单屏蔽 */
      U.on(canvas, 'touchstart', function (e) { if (e.cancelable) e.preventDefault(); }, { passive: false });
      U.on(canvas, 'contextmenu', function (e) { e.preventDefault(); });

      /* 键盘快捷键 */
      U.on(global, 'keydown', function (e) {
        const Game = LL.Game;
        const k = e.key ? e.key.toLowerCase() : '';
        if (k === 'escape' || k === 'p') {
          if (Game.state === 'playing' || Game.state === 'paused') LL.UI.togglePause();
        } else if (k === 'm') {
          LL.UI.toggleMute();
        } else if (k === 'r' && (Game.state === 'playing' || Game.state === 'paused')) {
          Game.restart();
        } else if (k === ' ') {
          if (Game.state === 'resolving') LL.Anim.accel();
          e.preventDefault();
        }
      });
    }
  };

  function Audio_unlock() { if (LL.Audio) LL.Audio.unlock(); }

  LL.Input = Input;
})(typeof globalThis !== 'undefined' ? globalThis : this);
