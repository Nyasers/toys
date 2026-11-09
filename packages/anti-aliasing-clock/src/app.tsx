// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Nyasers

/*
 * app.tsx —— 页面外壳。
 *
 * 只做三件事：把 DOM 契约渲染出来（id / data-* 与 README §8 一致）、
 * 在挂载后把时钟内核接上去、把主题变化转成一次色板重读。
 *
 * 时钟的状态与渲染都在 main.ts 里，不经过 React：这里不订阅任何状态，
 * 挂载一次之后 DOM 完全归内核所有。
 */

import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider, ThemeSelect, registerServiceWorker } from '@toys/ui';
import { mountClock } from './main';
import '@toys/ui/styles.css';
import './styles.css';

function ClockPage() {
  useEffect(() => {
    registerServiceWorker('../sw.js');
    const clock = mountClock();
    // 主题变了才重读一次 CSS 变量：WebGL 读不到 var()。
    const observer = new MutationObserver(() => clock.applyPalette());
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => {
      observer.disconnect();
      clock.dispose();
    };
  }, []);

  return (
    <>
      <div className="app">
        <header className="bar">
          <div className="brand">
            <a className="toys-back" href="../">
              ← toys
            </a>
            <h1>反走样时钟</h1>
            <span className="tag mono">ANTI-ALIASED CLOCK</span>
          </div>
          <div className="readout">
            <span className="clock mono" id="clockText">
              --:--:--.---
            </span>
            <span className="stat mono" id="statsText" />
          </div>
        </header>

        <section className="stage">
          <div className="dial" id="dial">
            <canvas id="glCanvas" />
            <canvas className="overlay" id="overlayCanvas" />
            <div className="loupe" id="loupe">
              <canvas id="loupeCanvas" width={152} height={152} />
              <div className="loupe-meta mono">
                <span id="loupeHex">#000000</span>
                <span id="loupeCoord">0,0</span>
              </div>
            </div>
          </div>
        </section>

        <div className="bottom">
          <div className="hint-row">
            <p className="hint">
              拖动调指针 · 滚轮调倍率 · <kbd>1</kbd>–<kbd>9</kbd> 超采样 · <kbd>0</kbd> 解析覆盖 ·{' '}
              <kbd>B</kbd> 混合空间 · <kbd>T</kbd> 秒针运动 · <kbd>F</kbd> 覆盖场 · <kbd>V</kbd>{' '}
              放大镜 · <kbd>G</kbd> 网格 · <kbd>Space</kbd> 暂停 · <kbd>R</kbd> 校准 · <kbd>H</kbd>{' '}
              收起面板
            </p>

            <button
              type="button"
              className="chip console-collapse"
              id="collapseBtn"
              title="收起参数面板"
              aria-label="收起参数面板"
            >
              <svg width="10" height="6" viewBox="0 0 10 6" aria-hidden="true">
                <path
                  d="M1 1l4 4 4-4"
                  stroke="currentColor"
                  fill="none"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          <footer className="console" id="console">
            <div className="group">
              <span className="label">空间采样</span>
              <div className="seg" id="modeSeg" role="radiogroup" aria-label="空间采样">
                <button type="button" data-analytic="0" aria-pressed="true">
                  超采样
                </button>
                <button type="button" data-analytic="1" aria-pressed="false">
                  解析覆盖
                </button>
              </div>
            </div>

            <div className="group" id="samplesGroup">
              <span className="label">
                每像素样本 <b className="mono" id="samplesValue">1×1</b>
              </span>
              <input
                type="range"
                id="samples"
                min="1"
                max="9"
                step="1"
                defaultValue="1"
                aria-label="每像素采样格"
              />
            </div>

            <div className="group">
              <span className="label">混合空间</span>
              <div className="seg" id="gammaSeg" role="radiogroup" aria-label="混合空间">
                <button type="button" data-linear="0" aria-pressed="true">
                  sRGB
                </button>
                <button type="button" data-linear="1" aria-pressed="false">
                  线性光
                </button>
              </div>
            </div>

            <div className="group">
              <span className="label">秒针运动</span>
              <div className="seg" id="tickSeg" role="radiogroup" aria-label="秒针运动">
                <button type="button" data-tick="continuous" aria-pressed="true">
                  连续
                </button>
                <button type="button" data-tick="step" aria-pressed="false">
                  跳秒
                </button>
              </div>
            </div>

            <div className="group">
              <span className="label">视图</span>
              <div className="chips">
                <button type="button" className="chip" id="fieldBtn" aria-pressed="false">
                  覆盖场
                </button>
                <button type="button" className="chip" id="loupeBtn" aria-pressed="false">
                  放大镜
                </button>
                <button type="button" className="chip" id="gridBtn" aria-pressed="false">
                  网格
                </button>
                <button type="button" className="chip" id="pauseBtn" aria-pressed="false">
                  暂停
                </button>
                <button type="button" className="chip" id="resetBtn" title="校准回真实时间">
                  校准
                </button>
              </div>
            </div>

            <div className="group">
              <span className="label">时区</span>
              <select id="timezoneSelect" aria-label="时区" />
            </div>

            <div className="group">
              <span className="label">主题</span>
              <ThemeSelect />
            </div>
          </footer>
        </div>

        <button
          type="button"
          className="chip expand-handle"
          id="expandBtn"
          title="展开参数面板"
          aria-label="展开参数面板"
          hidden
        >
          <svg width="10" height="6" viewBox="0 0 10 6" aria-hidden="true">
            <path
              d="M1 5l4-4 4 4"
              stroke="currentColor"
              fill="none"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      <div className="fatal" id="fatal" hidden>
        <h2>无法初始化</h2>
        <p id="fatalText" />
        <p className="fatal-help">
          这个页面用 WebGL2 画钟面。打不开通常是这几种情况：浏览器或 App 内置的 WebView 不支持
          WebGL2（换 Chrome / Safari 打开一般就好）；硬件加速被关掉；省电模式把 GPU 渲染停了。
        </p>
        <a className="toys-back" href="../">
          ← 返回 toys
        </a>
      </div>
    </>
  );
}

function mount(): void {
  const host = document.getElementById('root');
  if (!host) throw new Error('页面缺少 #root');
  createRoot(host).render(
    <ThemeProvider>
      <ClockPage />
    </ThemeProvider>,
  );
}

mount();
