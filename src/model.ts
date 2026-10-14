// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Nyasers

/*
 * model.ts —— 状态与时间。
 *
 * 角度是唯一被时间推动的量，其余都是参数。这里不接触 DOM，也不画东西，
 * 只回答「下一帧的角度是多少」。
 */

import type { Shape } from './geometry';

const TAU = Math.PI * 2;

/** 拖拽惯性衰减的时间常数：每秒衰减到 6%。 */
const INERTIA_DECAY = 0.06;

/** 单帧时间上限（秒）。 */
const MAX_DT = 0.1;

/** 拖拽产生的角速度上限（弧度/秒），防止甩出一个看不清的速度。 */
export const MAX_DRAG_SPEED = 14;

export interface Params {
  shape: Shape;
  /** 目标转速，圈/秒。 */
  rev: number;
  /** 叶片旋扭量，度。 */
  bendDeg: number;
  /** 叶片最大半宽，相对叶片长度。 */
  width: number;
  /** 3D 视角俯仰，度。 */
  tiltDeg: number;
}

export const DEFAULT_PARAMS: Params = {
  shape: 'leaf',
  rev: 0.3,
  bendDeg: 18,
  width: 0.26,
  tiltDeg: 58,
};

/** 一次帧推进需要的输入。 */
export interface TickInput {
  /** 与上一帧的时间差（秒）。 */
  dt: number;
  paused: boolean;
  /** 手动拖拽产生的瞬时角速度（弧度/秒），松手后按指数衰减。 */
  dragSpeed: number;
  dragging: boolean;
}

export class Motion {
  /** 当前旋转角（弧度）。 */
  angle = 0;

  /** 手动拖拽的角速度，松手后衰减到零，之后回落到设定转速。 */
  dragSpeed = 0;

  /**
   * 推进一帧，返回新的角度。
   *
   * dt 要封顶：浏览器在标签页不可见时会暂停 rAF，切回来时 dt 可能是几十秒，
   * 不设上限会让风车一次性转过好几圈。
   */
  tick(input: TickInput, rev: number): number {
    let dt = input.dt;
    if (dt > MAX_DT) dt = MAX_DT;

    if (!input.paused) {
      if (!input.dragging && Math.abs(input.dragSpeed) > 1e-4) {
        // 惯性：按时间常数衰减。写成 pow(decay, dt) 而不是每帧乘常数，
        // 60Hz 与 144Hz 屏幕上的手感才会一致。
        this.angle += input.dragSpeed * dt;
        this.dragSpeed *= Math.pow(INERTIA_DECAY, dt);
      } else {
        this.angle += rev * TAU * dt;
      }
    }
    return this.angle;
  }

  /** 拖拽中直接叠加角度增量。 */
  drag(delta: number): void {
    this.angle += delta;
  }

  /** 把角度归一到 [0, 360)，供读数显示。 */
  get degrees(): number {
    const deg = (this.angle * 180) / Math.PI;
    return ((deg % 360) + 360) % 360;
  }
}
