// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Nyasers

/*
 * ui.ts —— DOM 契约的读写。
 *
 * index.html 里的 id 是这一层与页面之间的唯一约定。控件绑定、读数更新、
 * URL 参数解析都收在这里，渲染与状态不知道 DOM 的存在。
 */

import type { Params } from './model';
import type { Shape } from './geometry';

/** 叶形的展示名与轮换顺序。 */
export const SHAPES: ReadonlyArray<readonly [Shape, string]> = [
  ['leaf', '花瓣'],
  ['sail', '帆形'],
  ['blade', '刀片'],
];

export function shapeLabel(shape: Shape): string {
  const found = SHAPES.find(([k]) => k === shape);
  return found ? found[1] : SHAPES[0]![1];
}

/** 视图开关。与几何参数分开：它们只影响画什么，不影响画成什么样。 */
export interface ViewFlags {
  grid: boolean;
  envelope: boolean;
  trails: boolean;
  demo: boolean;
  paused: boolean;
  mode: '2d' | '3d';
}

export interface UiState {
  params: Params;
  flags: ViewFlags;
}

/** 按 id 取元素，取不到就抛错 —— 契约缺失要在启动时暴露，不能拖到某一帧。 */
function need<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`index.html 缺少 #${id}`);
  return el as T;
}

function text(id: string, value: string): void {
  need(id).textContent = value;
}

/**
 * 把滑块的 input 事件接到「格式化后写读数 + 回写参数」。
 * 初始化时立刻跑一次，让页面上的读数与参数初值一致。
 */
function bindRange(
  id: string,
  outId: string,
  format: (v: number) => string,
  apply: (v: number) => void,
): void {
  const el = need<HTMLInputElement>(id);
  const sync = (): void => {
    const v = parseFloat(el.value);
    text(outId, format(v));
    apply(v);
  };
  el.addEventListener('input', sync);
  sync();
}

function bindToggle(id: string, onChange: (el: HTMLButtonElement) => void): void {
  const el = need<HTMLButtonElement>(id);
  el.addEventListener('click', () => onChange(el));
}

/** 解析 URL 参数。带 ?t= 时固定相位，供离屏截图取到确定的画面。 */
export interface BootOptions {
  /** 固定旋转相位（圈数）；null 表示走动画。 */
  fixedTurns: number | null;
  /** 隐藏全部界面，只留画布。 */
  hideUi: boolean;
}

export function readBootOptions(): BootOptions {
  const q = new URLSearchParams(location.search);
  const t = q.get('t');
  return {
    fixedTurns: t === null ? null : parseFloat(t),
    hideUi: q.get('ui') === '0',
  };
}

/** 把 URL 参数覆盖到状态上，返回是否命中。 */
export function applyUrlOverrides(state: UiState): void {
  const q = new URLSearchParams(location.search);

  const shape = q.get('shape');
  if (shape && SHAPES.some(([k]) => k === shape)) {
    state.params.shape = shape as Shape;
  }

  const mode = q.get('mode');
  if (mode === '3d' || mode === '2d') state.flags.mode = mode;

  if (q.get('demo') === '1') state.flags.demo = true;

  const w = q.get('w');
  if (w !== null && Number.isFinite(parseFloat(w))) state.params.width = parseFloat(w);

  const bend = q.get('bend');
  if (bend !== null && Number.isFinite(parseFloat(bend))) {
    state.params.bendDeg = parseFloat(bend);
  }
}

/**
 * 把状态写回 DOM 控件。
 * URL 覆盖之后调用，让滑块位置与读数跟上被改过的值。
 */
export function reflect(state: UiState): void {
  const set = (id: string, value: string): void => {
    const el = need<HTMLInputElement>(id);
    el.value = value;
  };

  set('s-rev', String(state.params.rev));
  set('s-bend', String(state.params.bendDeg));
  set('s-width', String(state.params.width));
  set('s-tilt', String(state.params.tiltDeg));

  text('v-rev', `${state.params.rev.toFixed(2)} 圈/秒`);
  text('v-bend', `${state.params.bendDeg}°`);
  text('v-width', state.params.width.toFixed(2));
  text('v-tilt', `${state.params.tiltDeg}°`);

  text('b-shape', `叶形：${shapeLabel(state.params.shape)}`);
  text('b-mode', `模式：${state.flags.mode.toUpperCase()}`);

  need('grp-3d').style.display = state.flags.mode === '3d' ? '' : 'none';

  press('b-grid', state.flags.grid);
  press('b-env', state.flags.envelope);
  press('b-trail', state.flags.trails);
  press('b-demo', state.flags.demo);
  press('b-pause', state.flags.paused);
}

/** 同步一个开关按钮的按下态与文字。 */
function press(id: string, on: boolean): void {
  const el = need<HTMLButtonElement>(id);
  el.classList.toggle('on', on);
  el.setAttribute('aria-pressed', String(on));
}

/** 接线：把页面控件接到状态上。 */
export function wire(
  state: UiState,
  hooks: {
    onResize: () => void;
    onFrameRequest: () => void;
  },
): void {
  bindRange('s-rev', 'v-rev', (v) => `${v.toFixed(2)} 圈/秒`, (v) => {
    state.params.rev = v;
  });
  bindRange('s-bend', 'v-bend', (v) => `${v}°`, (v) => {
    state.params.bendDeg = v;
  });
  bindRange('s-width', 'v-width', (v) => v.toFixed(2), (v) => {
    state.params.width = v;
  });
  bindRange('s-tilt', 'v-tilt', (v) => `${v}°`, (v) => {
    state.params.tiltDeg = v;
  });

  bindToggle('b-shape', (el) => {
    const i = SHAPES.findIndex(([k]) => k === state.params.shape);
    const next = SHAPES[(i + 1) % SHAPES.length]!;
    state.params.shape = next[0];
    el.textContent = `叶形：${next[1]}`;
  });

  bindToggle('b-mode', (el) => {
    state.flags.mode = state.flags.mode === '2d' ? '3d' : '2d';
    el.textContent = `模式：${state.flags.mode.toUpperCase()}`;
    need('grp-3d').style.display = state.flags.mode === '3d' ? '' : 'none';
    if (state.flags.mode === '3d') {
      // 拖影与单叶分解都只在 2D 下有意义
      state.flags.trails = false;
      state.flags.demo = false;
      press('b-trail', false);
      press('b-demo', false);
    }
  });

  bindToggle('b-pause', (el) => {
    state.flags.paused = !state.flags.paused;
    el.textContent = state.flags.paused ? '继续' : '暂停';
    press('b-pause', state.flags.paused);
    hooks.onFrameRequest();
  });

  bindToggle('b-grid', () => {
    state.flags.grid = !state.flags.grid;
    press('b-grid', state.flags.grid);
  });
  bindToggle('b-env', () => {
    state.flags.envelope = !state.flags.envelope;
    press('b-env', state.flags.envelope);
  });
  bindToggle('b-trail', () => {
    state.flags.trails = !state.flags.trails;
    press('b-trail', state.flags.trails);
  });
  bindToggle('b-demo', () => {
    state.flags.demo = !state.flags.demo;
    press('b-demo', state.flags.demo);
    if (state.flags.demo && state.flags.mode === '3d') {
      state.flags.mode = '2d';
      text('b-mode', '模式：2D');
      need('grp-3d').style.display = 'none';
    }
  });

  window.addEventListener('resize', hooks.onResize);
}

/** 更新右上角读数。 */
export function updateReadout(angleDeg: number, rev: number, width: number): void {
  text('ro-a', `${angleDeg.toFixed(1)}°`);
  text('ro-w', `${(rev * 360).toFixed(1)} °/s`);
  text('ro-s', width.toFixed(2));
}

/** 需要读数元素存在的调用方可以用它做启动自检。 */
export function assertContract(): void {
  for (const id of ['ro-a', 'ro-w', 'ro-s', 'cv', 'stage']) need(id);
}
