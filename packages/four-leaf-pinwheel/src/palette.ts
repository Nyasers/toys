// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Nyasers

/*
 * palette.ts —— 配色，跟随 Hana 主题。
 *
 * 四片叶子的色相从主题强调色出发绕一圈（+90° 一步），四片合起来正好闭合。
 * 饱和度与明度也来自主题，只做一次收敛与背景补偿：
 * 主题色直接铺满叶片会过艳，深色底上又需要更亮一档。
 *
 * Canvas 读不到 CSS 变量，所以这里把 var() 解析成数值再交给绘制。
 * 主题变了由页面调 refreshPalette()，重读一次即可，不进每帧循环。
 */

import { parseColor, relativeLuminance, type RGBA } from '@toys/ui';

/** 叶片数量。变换栈的份数、配色表的长度都取自这里。 */
export const BLADE_COUNT = 4;

/** 一片叶子的基色（HSL，分量是 0..360 / 0..100 / 0..100）。 */
export interface BladeColor {
  hue: number;
  sat: number;
  light: number;
}

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/** RGB → HSL。灰阶没有色相，回落到 200（偏蓝）。 */
function toHsl(c: RGBA): { h: number; s: number; l: number } {
  const max = Math.max(c.r, c.g, c.b);
  const min = Math.min(c.r, c.g, c.b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 200, s: 0, l: l * 100 };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === c.r) h = ((c.g - c.b) / d) % 6;
  else if (max === c.g) h = (c.b - c.r) / d + 2;
  else h = (c.r - c.g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: s * 100, l: l * 100 };
}

/** 无 DOM 时的兜底（首帧之前）：青 → 蓝 → 品红 → 紫。 */
const FALLBACK_COLORS: readonly BladeColor[] = [
  { hue: 188, sat: 62, light: 66 },
  { hue: 216, sat: 62, light: 60 },
  { hue: 322, sat: 60, light: 62 },
  { hue: 264, sat: 58, light: 64 },
];

interface BladePalette {
  colors: readonly BladeColor[];
  backdrop: string;
  ink: RGBA;
  accent: RGBA;
}

const FALLBACK: BladePalette = {
  colors: FALLBACK_COLORS,
  backdrop: 'rgba(4, 6, 13, 0.30)',
  ink: { r: 0.91, g: 0.94, b: 1, a: 1 },
  accent: { r: 0.44, g: 0.83, b: 1, a: 1 },
};

let current: BladePalette = FALLBACK;

/** 从当前主题读一次配色。主题切换后调用。 */
export function refreshPalette(): void {
  const styles = getComputedStyle(document.documentElement);
  const read = (name: string): string => styles.getPropertyValue(name).trim();

  const accent = parseColor(read('--accent'));
  const bg = parseColor(read('--bg'));
  const ink = parseColor(read('--text'));

  // 深底上的叶子要更亮一档，浅底上要比底色更深一档；饱和度统一压到 45–72，
  // 主题色原样铺开会过艳（尤其 dark 主题的强调色本身就很亮）。
  const dark = relativeLuminance(bg) < 0.5;
  const fit = (c: RGBA): BladeColor => {
    const hsl = toHsl(c);
    return {
      hue: hsl.h,
      sat: clamp(hsl.s, 42, 72),
      light: dark ? clamp(hsl.l + 4, 50, 74) : clamp(hsl.l - 6, 36, 58),
    };
  };

  const a = fit(accent);
  current = {
    // 四片从强调色出发绕一圈：同色族，相邻叶片的色相相差 90°，视觉上闭合。
    // 不直接用 coral / green 是因为它们的色相往往与 accent 的补色撞在一起（两片同色）。
    colors: [0, 90, 180, 270].map((offset) => ({ ...a, hue: (a.hue + offset) % 360 })),
    backdrop: `rgba(${Math.round(bg.r * 255)}, ${Math.round(bg.g * 255)}, ${Math.round(bg.b * 255)}, 0.30)`,
    ink,
    accent,
  };
}

/** 当前配色。绘制时每次调用，避免持有过期引用。 */
export const bladeColors = (): readonly BladeColor[] => current.colors;

/** 清屏 / 拖影的底色。 */
export const backdropColor = (): string => current.backdrop;

const rgbaOf = (c: RGBA, a: number): string =>
  `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${a})`;

/** 参考层线条 / 轴心用的墨色，带透明度。 */
export const softInk = (alpha: number): string => rgbaOf(current.ink, alpha);

/** 强调色的半透明版本。 */
export const softAccent = (alpha: number): string => rgbaOf(current.accent, alpha);

/** 叶片渐变的色标：[位置, 明度偏移, 饱和度系数, 透明度]。 */
const STOPS: ReadonlyArray<readonly [number, number, number, number]> = [
  [0.0, 15, 1.04, 0.95],
  [0.42, 2, 1.0, 0.92],
  [1.0, -16, 0.9, 0.8],
];

/**
 * 沿叶片中轴建一条线性渐变。
 * 坐标系由调用方负责（叶片总是画在「从原点指向 +x」的局部系里）。
 */
export function bladeGradient(
  ctx: CanvasRenderingContext2D,
  len: number,
  color: BladeColor,
): CanvasGradient {
  const g = ctx.createLinearGradient(0, 0, len, 0);
  for (const [at, dLight, satScale, alpha] of STOPS) {
    const light = clamp(color.light + dLight, 0, 92);
    g.addColorStop(at, `hsla(${color.hue}, ${color.sat * satScale}%, ${light}%, ${alpha})`);
  }
  return g;
}

/** 叶脉与轮廓的描边色：同一色相的更亮版本。 */
export function bladeStroke(color: BladeColor, alpha: number): string {
  return `hsla(${color.hue}, ${Math.min(color.sat + 12, 82)}%, ${clamp(color.light + 26, 0, 94)}%, ${alpha})`;
}
