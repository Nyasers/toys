// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Nyasers

/*
 * geometry.ts —— 叶片的参数化。
 *
 * 一片叶子由三件事决定：中轴曲线、宽度分布、以及把宽度从「长度」换算到
 * 「角宽」的那一步除法。这里只做纯计算，不接触 DOM 与 Canvas。
 */

export type Shape = 'leaf' | 'sail' | 'blade';

/** 二维点。用元组而非对象：顶点数组会被逐帧重建，元组省一层间接。 */
export type Vec2 = [number, number];

export interface Outline {
  outer: Vec2[];
  inner: Vec2[];
}

/** 轮廓采样段数。再多也只是把直线段磨得更细，肉眼在 72 段上已分不出。 */
const SEGMENTS = 72;

/** 根部半径偏移，相对叶片长度。给轮毂留出起点，避免四片叶子挤在原点。 */
const ROOT = 0.10;

/**
 * 半宽沿中轴的分布，按最大半宽归一。
 *
 * 换一条曲线就换一种叶形，顶点生成代码一行都不用动：
 *   leaf  花瓣 —— 中段最宽，两端收尖
 *   sail  帆形 —— 一条边贴中轴，另一条鼓出去，像折起来的纸风车
 *   blade 刀片 —— 根部就有宽度，越往外越窄
 */
export function widthProfile(shape: Shape, t: number): number {
  if (shape === 'leaf') return Math.pow(Math.sin(Math.PI * t), 1.05);
  if (shape === 'sail') return Math.pow(Math.sin(Math.PI * t), 0.45) * (0.45 + 0.75 * t);
  return (Math.pow(0.35 + 0.65 * t, 0.8) * Math.pow(1 - t, 0.45)) / 0.54;
}

/** 中轴半径 r(t)：从根部伸到叶尖。指数略小于 1，让叶尖更饱满。 */
export function spineRadius(len: number, t: number): number {
  return len * (ROOT + (1 - ROOT) * Math.pow(t, 0.95));
}

/** 中轴偏角 φ(t)：先甩出去再收回来，bendRad 就是「旋扭」旋钮。两端为 0。 */
export function spineAngle(bendRad: number, t: number): number {
  return bendRad * Math.sin(Math.PI * t);
}

/**
 * 生成一片叶子的闭合轮廓。
 *
 * 宽度按「长度」给（hw = len · halfWidth），再除以 r 换算成角宽 Δ = w / r。
 * 直接把宽度定义成角宽会让物理宽度随半径膨胀，叶尖胖得离谱 —— 叶子会变成
 * 四叶草。这是这个实验里真实返工过的一处。
 * 外缘取 φ+Δ、内缘取 φ−Δ，两端自动收拢成尖，不需要额外封口。
 */
export function bladeOutline(
  shape: Shape,
  len: number,
  bendRad: number,
  halfWidth: number,
): Outline {
  const outer: Vec2[] = [];
  const inner: Vec2[] = [];
  const hw = len * halfWidth;

  for (let k = 0; k <= SEGMENTS; k++) {
    const t = k / SEGMENTS;
    const r = spineRadius(len, t);
    const phi = spineAngle(bendRad, t);
    const bulge = widthProfile(shape, t);

    let dOut: number;
    let dIn: number;
    if (shape === 'sail') {
      dOut = (hw * bulge * 0.95) / r;
      dIn = (-hw * 0.10 * bulge) / r;
    } else {
      const d = (hw * bulge) / r;
      dOut = d;
      dIn = -d;
    }

    outer.push([r * Math.cos(phi + dOut), r * Math.sin(phi + dOut)]);
    inner.push([r * Math.cos(phi + dIn), r * Math.sin(phi + dIn)]);
  }

  return { outer, inner };
}

/** 绕原点旋转一组顶点。四片叶子共用同一份轮廓，靠它复制。 */
export function rotate(points: Vec2[], angle: number): Vec2[] {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return points.map(([x, y]): Vec2 => [x * c - y * s, x * s + y * c]);
}

/**
 * 把角度归一化到 (−π, π]。
 *
 * atan2 的值域是 (−π, π]，鼠标穿过正左方时返回值从 +π 跳到 −π，
 * 差值一下子变成 −2π —— 拖拽必须过这一步，否则风车会瞬间倒转半圈。
 */
export function wrapPi(angle: number): number {
  const TAU = Math.PI * 2;
  let d = angle;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
}
