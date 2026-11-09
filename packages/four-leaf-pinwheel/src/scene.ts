// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Nyasers

/*
 * scene.ts —— 绘制。
 *
 * 三种画法共用同一份叶片轮廓：
 *   2D   变换栈复制 —— 只转坐标系，顶点一个都不改
 *   3D   挤出 + 透视投影 + 画家算法 —— 沿 Z 拉出厚度，按深度排序定遮挡
 *   demo 单叶分解 —— 把一片叶子单独拆开，画出中轴与宽度剖面
 * 参考层（极坐标网格、包络星形）与轮毂在三种画法之外单独绘制。
 */

import {
  BLADE_COUNT,
  bladeGradient,
  bladeStroke,
  HUES,
} from './palette';
import {
  bladeOutline,
  rotate,
  spineAngle,
  spineRadius,
  type Outline,
  type Shape,
  type Vec2,
} from './geometry';

const TAU = Math.PI * 2;

/** 画布底色。拖影模式用它做半透明覆盖，残影才留得下来。 */
const BACKDROP = 'rgba(4,6,13,0.30)';

/** 3D 挤出的切片数。层数越多边缘越平滑，代价是每帧排序的项数线性增长。 */
const SLICES = 18;

/** 3D 视角俯仰角（弧度）。固定值：俯仰由 UI 的滑块单独提供。 */
const DEFAULT_TILT_DEG = 58;

/** 挤出半厚度与焦距，都相对叶片长度。焦距越小透视越夸张。 */
const HALF_THICKNESS = 0.055;
const FOCAL_RATIO = 3.4;

/** 渲染需要的全部参数。与 UI 状态分离：这里只有绘制关心的东西。 */
export interface SceneParams {
  shape: Shape;
  bendDeg: number;
  width: number;
  angle: number;
  tiltDeg: number;
  mode: '2d' | '3d';
  demo: boolean;
  grid: boolean;
  envelope: boolean;
  trails: boolean;
}

/** 投影后的点：[屏幕 x, 屏幕 y, 相机空间深度]。 */
type Projected = [number, number, number];

export class Scene {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly canvas: HTMLCanvasElement;

  /** 逻辑尺寸（CSS 像素）。 */
  private w = 0;
  private h = 0;
  private cx = 0;
  private cy = 0;
  /** 基准半径与叶片长度。 */
  private r = 0;
  private len = 0;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('无法取得 2D 绘图上下文');
    this.canvas = canvas;
    this.ctx = ctx;
  }

  /**
   * 按视口重算尺寸并处理设备像素比。
   * dpr 封顶 2：再高的倍率在视觉上没有收益，只让每帧多填几倍像素。
   */
  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const side = Math.min(window.innerWidth, window.innerHeight);

    this.w = side;
    this.h = side;
    this.canvas.style.width = `${side}px`;
    this.canvas.style.height = `${side}px`;
    this.canvas.width = Math.round(side * dpr);
    this.canvas.height = Math.round(side * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.cx = side / 2;
    this.cy = side / 2;
    this.r = side * 0.37;
    this.len = this.r * 0.94;
  }

  /** 叶片长度，供 UI 之外的调用方读取。 */
  get bladeLength(): number {
    return this.len;
  }

  /** 画一帧。 */
  draw(p: SceneParams): void {
    if (p.demo && p.mode === '2d') {
      this.drawDemo(p);
      return;
    }
    if (p.mode === '3d') this.draw3D(p);
    else this.draw2D(p);
  }

  /* ---------------------------------------------------------------- *
   * 背景与参考层
   * ---------------------------------------------------------------- */

  /**
   * 铺底。拖影模式只盖一层半透明底色而不擦除，
   * 上一帧的残影于是留在画布上 —— 这一层同时也就是「拖影」的实现。
   */
  private backdrop(trails: boolean): void {
    if (trails) {
      this.ctx.fillStyle = BACKDROP;
      this.ctx.fillRect(0, 0, this.w, this.h);
    } else {
      this.ctx.clearRect(0, 0, this.w, this.h);
    }
  }

  /** 极坐标网格：同心圆是等半径采样，径向线是等角采样。 */
  private grid(): void {
    const { ctx } = this;
    ctx.save();
    ctx.translate(this.cx, this.cy);
    ctx.lineWidth = 1;

    ctx.strokeStyle = 'rgba(150,180,255,0.11)';
    for (let i = 1; i <= 4; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, (this.r * i) / 4, 0, TAU);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(150,180,255,0.07)';
    for (let a = 0; a < 12; a++) {
      const th = (a * TAU) / 12;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(th) * this.r, Math.sin(th) * this.r);
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * 包络：四叶尖连成的正方形，加一个内外半径交替的星形。
   * 星形的内半径 0.40 是四叶外形的天然内切位置，画出来正好卡在叶间的凹处。
   */
  private envelope(angle: number): void {
    const { ctx } = this;
    const tipR = this.len;
    const innerR = this.len * 0.4;

    ctx.save();
    ctx.translate(this.cx, this.cy);
    ctx.rotate(angle);
    ctx.lineWidth = 1;

    ctx.beginPath();
    for (let i = 0; i < BLADE_COUNT; i++) {
      const th = (i * Math.PI) / 2;
      const x = Math.cos(th) * tipR;
      const y = Math.sin(th) * tipR;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.setLineDash([5, 6]);
    ctx.strokeStyle = 'rgba(111,211,255,0.32)';
    ctx.stroke();

    ctx.beginPath();
    for (let i = 0; i < BLADE_COUNT; i++) {
      const a = (i * Math.PI) / 2;
      const b = a + Math.PI / 4;
      ctx.lineTo(Math.cos(a) * tipR, Math.sin(a) * tipR);
      ctx.lineTo(Math.cos(b) * innerR, Math.sin(b) * innerR);
    }
    ctx.closePath();
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.stroke();
    ctx.restore();
  }

  /** 轮毂：径向渐变的光晕加一个实心点。 */
  private hub(): void {
    const { ctx } = this;
    ctx.save();
    ctx.translate(this.cx, this.cy);

    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, this.r * 0.16);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.35, 'rgba(180,225,255,0.55)');
    g.addColorStop(1, 'rgba(120,180,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, this.r * 0.16, 0, TAU);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(0, 0, this.r * 0.022, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  /* ---------------------------------------------------------------- *
   * 轮廓路径
   * ---------------------------------------------------------------- */

  /**
   * 把内外缘串成一条闭合路径：外缘正着走，内缘倒着走回来。
   * proj 为空时按平面点处理；3D 用投影函数把 [x,y,z] 压成屏幕坐标。
   */
  private trace(outline: Outline, proj?: (p: Vec2, z: number) => Projected, z = 0): void {
    const { ctx } = this;
    ctx.beginPath();

    const first = outline.outer[0]!;
    const a0 = proj ? proj(first, z) : ([first[0], first[1]] as const);
    ctx.moveTo(a0[0], a0[1]);

    for (let i = 1; i < outline.outer.length; i++) {
      const p = outline.outer[i]!;
      const q = proj ? proj(p, z) : ([p[0], p[1]] as const);
      ctx.lineTo(q[0], q[1]);
    }
    for (let i = outline.inner.length - 1; i >= 0; i--) {
      const p = outline.inner[i]!;
      const q = proj ? proj(p, z) : ([p[0], p[1]] as const);
      ctx.lineTo(q[0], q[1]);
    }
    ctx.closePath();
  }

  /* ---------------------------------------------------------------- *
   * 2D：变换栈复制
   * ---------------------------------------------------------------- */

  private draw2D(p: SceneParams): void {
    const { ctx } = this;
    this.backdrop(p.trails);
    if (p.grid) this.grid();
    if (p.envelope) this.envelope(p.angle);

    const outline = bladeOutline(p.shape, this.len, p.bendDeg * (Math.PI / 180), p.width);

    ctx.save();
    ctx.translate(this.cx, this.cy);
    ctx.lineJoin = 'round';

    for (let i = 0; i < BLADE_COUNT; i++) {
      ctx.save();
      // 变换栈：只转坐标系，outline 的顶点一个都没改
      ctx.rotate(p.angle + (i * Math.PI) / 2);
      const hue = HUES[i]!;

      this.trace(outline);
      ctx.fillStyle = bladeGradient(ctx, this.len, hue);
      ctx.shadowColor = `hsla(${hue + 10}, 100%, 62%, 0.55)`;
      ctx.shadowBlur = 26;
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = bladeStroke(hue, 0.85);
      ctx.stroke();

      this.spine(p.bendDeg);
      ctx.restore();
    }
    ctx.restore();
    this.hub();
  }

  /** 叶脉：中轴线。有了它，「旋扭」这件事在画面上才看得见。 */
  private spine(bendDeg: number): void {
    const { ctx } = this;
    const bendRad = bendDeg * (Math.PI / 180);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let k = 1; k <= 32; k++) {
      const t = k / 32;
      const r = this.len * Math.pow(t, 0.92);
      const phi = bendRad * Math.sin(Math.PI * t);
      ctx.lineTo(r * Math.cos(phi), r * Math.sin(phi));
    }
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.stroke();
  }

  /* ---------------------------------------------------------------- *
   * demo：单叶分解
   * ---------------------------------------------------------------- */

  private drawDemo(p: SceneParams): void {
    const { ctx } = this;
    this.backdrop(p.trails);
    if (p.grid) this.grid();

    const bendRad = p.bendDeg * (Math.PI / 180);
    const outline = bladeOutline(p.shape, this.len, bendRad, p.width);
    const hue = HUES[0]!;

    ctx.save();
    ctx.translate(this.cx, this.cy);
    ctx.lineJoin = 'round';

    this.trace(outline);
    ctx.fillStyle = bladeGradient(ctx, this.len, hue);
    ctx.fill();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = bladeStroke(hue, 0.85);
    ctx.stroke();

    // 中轴：r(t) 与 φ(t) 叠出来的那条曲线
    ctx.beginPath();
    const root = spineRadius(this.len, 0);
    ctx.moveTo(root, 0);
    for (let k = 1; k <= 48; k++) {
      const t = k / 48;
      const r = spineRadius(this.len, t);
      const phi = spineAngle(bendRad, t);
      ctx.lineTo(r * Math.cos(phi), r * Math.sin(phi));
    }
    ctx.setLineDash([6, 5]);
    ctx.lineWidth = 1.3;
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.stroke();
    ctx.setLineDash([]);

    // 宽度剖面：每一条横线就是一个 t 处的 ±Δ(t)
    const last = outline.outer.length - 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.42)';
    ctx.lineWidth = 1;
    for (let k = 1; k < 10; k++) {
      const i = Math.round((k / 10) * last);
      const o = outline.outer[i]!;
      const n = outline.inner[i]!;
      ctx.beginPath();
      ctx.moveTo(o[0], o[1]);
      ctx.lineTo(n[0], n[1]);
      ctx.stroke();
    }
    ctx.restore();
    this.hub();
  }

  /* ---------------------------------------------------------------- *
   * 3D：挤出 + 透视投影 + 画家算法
   * ---------------------------------------------------------------- */

  private draw3D(p: SceneParams): void {
    const { ctx } = this;
    this.backdrop(p.trails);
    if (p.grid) this.grid();

    const bendRad = p.bendDeg * (Math.PI / 180);
    const outline = bladeOutline(p.shape, this.len, bendRad, p.width);

    // 四片叶子的顶点：叶基角直接烘进顶点，后续只做整体旋转
    const blades = HUES.slice(0, BLADE_COUNT).map((hue, i) => {
      const base = (i * Math.PI) / 2;
      return {
        hue,
        outer: rotate(outline.outer, base),
        inner: rotate(outline.inner, base),
      };
    });

    const tilt = (p.tiltDeg || DEFAULT_TILT_DEG) * (Math.PI / 180);
    const halfThick = this.len * HALF_THICKNESS;
    const focal = this.len * FOCAL_RATIO;

    const ca = Math.cos(p.angle);
    const sa = Math.sin(p.angle);
    const ct = Math.cos(tilt);
    const st = Math.sin(tilt);

    /**
     * 相机在 z = −focal 处朝 +z 看：先绕 Z 自转，再绕 X 倾斜，最后透视除法。
     * k = focal / (focal + Z) 就是透视的全部秘密 —— Z 越大 k 越小，画出来越小。
     */
    const project = (x: number, y: number, z: number): Projected => {
      const X = x * ca - y * sa;
      const Y0 = x * sa + y * ca;
      const Y = Y0 * ct - z * st;
      const Z = Y0 * st + z * ct;
      const k = focal / (focal + Z);
      return [this.cx + X * k, this.cy + Y * k, Z];
    };

    // 收集所有「叶片 × 切片」的多边形，按平均深度从远到近排序
    interface Face {
      pts: Projected[];
      depth: number;
      hue: number;
      /** −1（最后）… +1（最前），用来算明暗。 */
      depthN: number;
      front: boolean;
    }
    const faces: Face[] = [];

    for (let s = 0; s <= SLICES; s++) {
      const z = -halfThick + (2 * halfThick * s) / SLICES;
      const depthN = (2 * s) / SLICES - 1;

      for (const b of blades) {
        let zsum = 0;
        let n = 0;
        const pts: Projected[] = [];

        for (const q of b.outer) {
          const r = project(q[0], q[1], z);
          pts.push(r);
          zsum += r[2];
          n++;
        }
        for (let i = b.inner.length - 1; i >= 0; i--) {
          const q = b.inner[i]!;
          const r = project(q[0], q[1], z);
          pts.push(r);
          zsum += r[2];
          n++;
        }

        faces.push({ pts, depth: zsum / n, hue: b.hue, depthN, front: s === SLICES });
      }
    }

    // 画家算法：远的先画，近的盖住远的。
    // 它只对「能排出全局顺序」的结构有效 —— 两个面互相穿插时排序会失效。
    faces.sort((a, b) => b.depth - a.depth);

    ctx.save();
    ctx.lineJoin = 'round';
    for (const f of faces) {
      const t = (f.depthN + 1) / 2; // 0 背面 … 1 正面
      const lum = 26 + 42 * t;
      const alpha = 0.42 + 0.56 * t;

      ctx.beginPath();
      ctx.moveTo(f.pts[0]![0], f.pts[0]![1]);
      for (let i = 1; i < f.pts.length; i++) ctx.lineTo(f.pts[i]![0], f.pts[i]![1]);
      ctx.closePath();

      ctx.fillStyle = `hsla(${f.hue + 10 * (1 - t)}, 88%, ${lum}%, ${alpha})`;
      ctx.fill();

      // 只在最前面一层描边：18 层各描一次会把轮廓糊成毛刺
      if (f.front) {
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = `hsla(${f.hue + 24}, 100%, 84%, 0.9)`;
        ctx.stroke();
      }
    }
    ctx.restore();

    const hub = project(0, 0, 0);
    const g = ctx.createRadialGradient(hub[0], hub[1], 0, hub[0], hub[1], this.r * 0.15);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(140,200,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(hub[0], hub[1], this.r * 0.15, 0, TAU);
    ctx.fill();
  }
}
