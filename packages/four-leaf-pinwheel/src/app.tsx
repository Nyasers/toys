// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Nyasers

/*
 * app.tsx —— 页面外壳。
 *
 * DOM 契约与 README 里那张 id 表一致，React 只渲染一次；挂载之后画布、读数与
 * 控件状态都由 main.ts / ui.ts 接管，不再经过 React。
 */

import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider, ThemeSelect, registerServiceWorker } from '@toys/ui';
import { mountPinwheel } from './main';
import '@toys/ui/styles.css';
import './styles.css';

function PinwheelPage() {
  useEffect(() => {
    registerServiceWorker('../sw.js');
    const pinwheel = mountPinwheel();
    // 主题变了才重读一次颜色：Canvas 读不到 var()。
    const observer = new MutationObserver(() => pinwheel.refresh());
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => {
      observer.disconnect();
      pinwheel.dispose();
    };
  }, []);

  return (
    <>
      <div id="stage">
        <canvas id="cv" />
      </div>

      <div className="hud" id="title">
        <h1>四 叶 风 车</h1>
        <p>极坐标参数化 · 变换栈 · 时间驱动 · 挤出与透视投影</p>
        <p className="links">
          <a className="toys-back" href="../">
            ← toys
          </a>
          <a
            href="https://github.com/Nyasers/toys/tree/master/packages/four-leaf-pinwheel"
            target="_blank"
            rel="noopener"
          >
            github.com/Nyasers/toys
          </a>
          <ThemeSelect />
        </p>
      </div>

      <div className="hud" id="readout">
        <div className="row">
          旋转角 <b id="ro-a">0.0°</b>
        </div>
        <div className="row">
          角速度 <b id="ro-w">108.0 °/s</b>
        </div>
        <div className="row">
          叶宽 <b id="ro-s">0.26</b>
        </div>
      </div>

      <div className="hud" id="panel">
        <div className="grp">
          <label>
            转速 <b id="v-rev">0.30 圈/秒</b>
          </label>
          <input id="s-rev" type="range" min="0" max="2" step="0.01" defaultValue="0.3" aria-label="转速" />
        </div>
        <div className="grp">
          <label>
            叶片旋扭 <b id="v-bend">18°</b>
          </label>
          <input id="s-bend" type="range" min="-40" max="40" step="1" defaultValue="18" aria-label="叶片旋扭" />
        </div>
        <div className="grp">
          <label>
            叶片宽度 <b id="v-width">0.26</b>
          </label>
          <input id="s-width" type="range" min="0.08" max="0.46" step="0.01" defaultValue="0.26" aria-label="叶片宽度" />
        </div>
        <div className="grp" id="grp-3d">
          <label>
            视角俯仰 <b id="v-tilt">58°</b>
          </label>
          <input id="s-tilt" type="range" min="0" max="78" step="1" defaultValue="58" aria-label="视角俯仰" />
        </div>
        <div className="grp btns">
          <button type="button" id="b-shape">
            叶形：花瓣
          </button>
          <button type="button" id="b-mode">
            模式：2D
          </button>
          <button type="button" id="b-pause">
            暂停
          </button>
        </div>
        <div className="grp btns" style={{ marginBottom: 0 }}>
          <button type="button" id="b-grid" className="on">
            极坐标网格
          </button>
          <button type="button" id="b-env" className="on">
            包络星形
          </button>
          <button type="button" id="b-trail">
            拖影
          </button>
          <button type="button" id="b-demo">
            单叶分解
          </button>
        </div>
      </div>

      <div id="hint">拖动风车可手动旋转，松手后带着惯性继续转</div>

      <div className="fatal" id="fatal" hidden>
        <h2>无法初始化</h2>
        <p id="fatalText" />
      </div>
    </>
  );
}

function mount(): void {
  const host = document.getElementById('root');
  if (!host) throw new Error('页面缺少 #root');
  createRoot(host).render(
    <ThemeProvider>
      <PinwheelPage />
    </ThemeProvider>,
  );
}

mount();
