// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Nyasers

/*
 * main.ts —— 装配与主循环。
 *
 * 把 DOM 契约（index.html 的 id）、Scene、Motion 接到一起。
 * 这里是唯一的 rAF 起点，也是唯一读写拖拽状态的地方。
 */

import { DEFAULT_PARAMS, MAX_DRAG_SPEED, Motion, type Params } from './model';
import { Scene } from './scene';
import { wrapPi } from './geometry';
import { refreshPalette } from './palette';
import {
  applyUrlOverrides,
  assertContract,
  readBootOptions,
  reflect,
  updateReadout,
  wire,
  type UiState,
} from './ui';

const TAU = Math.PI * 2;

/** 拖拽换算成角速度的系数：把「每帧的弧度增量」放大成「每秒」。 */
const DRAG_SPEED_SCALE = 60;

/** 挂载后交给外部的句柄。 */
export interface PinwheelHandle {
  /** 主题变了：重读色板并立刻重绘一帧。 */
  refresh: () => void;
  /** 停掉主循环。 */
  dispose: () => void;
}

/** 挂载风车。DOM 由 React 渲染（id 就是契约），这里接上 Scene 与主循环。 */
export function mountPinwheel(): PinwheelHandle {
  try {
    return main();
  } catch (err) {
    const fatal = document.getElementById('fatal');
    const msg = err instanceof Error ? err.message : String(err);
    if (fatal) {
      fatal.hidden = false;
      const p = document.getElementById('fatalText');
      if (p) p.textContent = msg;
    }
    console.error('[pinwheel]', err);
    return { refresh: () => {}, dispose: () => {} };
  }
}

function main(): PinwheelHandle {
  assertContract();

  // 首帧之前先读一次主题色：Canvas 拿不到 CSS 变量。
  refreshPalette();

  const canvas = document.getElementById('cv') as HTMLCanvasElement;
  const stage = document.getElementById('stage')!;
  const scene = new Scene(canvas);
  const motion = new Motion();

  const boot = readBootOptions();
  if (boot.hideUi) document.body.classList.add('no-ui');

  const state: UiState = {
    params: { ...DEFAULT_PARAMS } as Params,
    flags: {
      grid: true,
      envelope: true,
      trails: false,
      demo: false,
      paused: false,
      mode: '2d',
    },
  };

  applyUrlOverrides(state);

  const drawNow = (): void => {
    scene.draw({
      shape: state.params.shape,
      bendDeg: state.params.bendDeg,
      width: state.params.width,
      angle: motion.angle,
      tiltDeg: state.params.tiltDeg,
      mode: state.flags.mode,
      demo: state.flags.demo,
      grid: state.flags.grid,
      envelope: state.flags.envelope,
      trails: state.flags.trails,
    });
    updateReadout(motion.degrees, state.params.rev, state.params.width);
  };

  const resize = (): void => {
    scene.resize();
    drawNow();
  };

  /* ---- 拖拽：手动旋转 + 惯性 ---- */
  let dragging = false;
  let prevAngle = 0;

  const pointerAngle = (e: PointerEvent): number => {
    const r = canvas.getBoundingClientRect();
    return Math.atan2(
      e.clientY - (r.top + r.height / 2),
      e.clientX - (r.left + r.width / 2),
    );
  };

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('grabbing');
    dragging = true;
    motion.dragSpeed = 0;
    prevAngle = pointerAngle(e);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const a = pointerAngle(e);
    // 过 wrapPi：atan2 在 ±π 处跳变，不过这一步风车会瞬间倒转半圈
    const d = wrapPi(a - prevAngle);
    prevAngle = a;
    motion.drag(d);
    motion.dragSpeed = d * DRAG_SPEED_SCALE;
  });

  const endDrag = (): void => {
    if (!dragging) return;
    dragging = false;
    canvas.classList.remove('grabbing');
    motion.dragSpeed = Math.max(-MAX_DRAG_SPEED, Math.min(MAX_DRAG_SPEED, motion.dragSpeed));
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  /* ---- 主循环 ---- */
  let last = 0;
  let disposed = false;
  const frame = (now: number): void => {
    if (disposed) return;
    if (!last) last = now;
    const dt = (now - last) / 1000;
    last = now;

    motion.tick({ dt, paused: state.flags.paused, dragSpeed: motion.dragSpeed, dragging }, state.params.rev);
    drawNow();
    requestAnimationFrame(frame);
  };

  wire(state, {
    onResize: resize,
    onFrameRequest: () => {
      // 从暂停恢复时重置时间基准，避免 dt 累积出一大跳
      last = 0;
    },
  });
  reflect(state);

  resize();

  if (boot.fixedTurns !== null) {
    // 固定相位：画一帧就停，供离屏截图取到确定的画面
    motion.angle = boot.fixedTurns * TAU;
    drawNow();
  } else {
    requestAnimationFrame(frame);
  }

  // 舞台尺寸由 CSS 决定，这里只保证画布跟着它走
  stage.dataset.ready = '1';

  return {
    refresh: () => {
      refreshPalette();
      drawNow();
    },
    dispose: () => {
      disposed = true;
    },
  };
}

