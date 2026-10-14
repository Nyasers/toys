// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Nyasers

/*
 * palette.ts —— 配色。
 *
 * 四片叶子的色相绕一圈：青 → 蓝 → 紫 → 品红，回到起点时视觉上闭合。
 * 叶片渐变沿中轴从浅到深，让「旋扭」在单色下也读得出来。
 */

/** 四片叶子的色相，按叶序排列。 */
export const HUES = [188, 216, 264, 322] as const;

/** 叶片数量。变换栈的份数、色相表的长度都取自这里。 */
export const BLADE_COUNT = HUES.length;

/** 叶片渐变的色标：[位置, 色相偏移, 饱和度, 明度, 透明度]。 */
const STOPS: ReadonlyArray<readonly [number, number, number, number, number]> = [
  [0.0, 0, 96, 82, 0.97],
  [0.42, 14, 90, 64, 0.93],
  [1.0, 34, 88, 46, 0.82],
];

/**
 * 沿叶片中轴建一条线性渐变。
 * 坐标系由调用方负责（叶片总是画在「从原点指向 +x」的局部系里）。
 */
export function bladeGradient(
  ctx: CanvasRenderingContext2D,
  len: number,
  hue: number,
): CanvasGradient {
  const g = ctx.createLinearGradient(0, 0, len, 0);
  for (const [at, dh, sat, light, alpha] of STOPS) {
    g.addColorStop(at, `hsla(${hue + dh}, ${sat}%, ${light}%, ${alpha})`);
  }
  return g;
}

/** 叶脉与轮廓的描边色：同一色相的更亮版本。 */
export function bladeStroke(hue: number, alpha: number): string {
  return `hsla(${hue + 20}, 100%, 86%, ${alpha})`;
}
