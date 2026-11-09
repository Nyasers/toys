// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Nyasers

/*
 * app.tsx —— 目录页。
 *
 * 只做入口该做的事：列出每个玩具、给一个主题选择器、在浏览器允许时给一个安装按钮。
 * 玩具本身是独立页面，这里不加载它们的代码。
 */

import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ThemeProvider,
  ThemeSelect,
  registerServiceWorker,
  watchInstall,
  type InstallPrompt,
} from '@toys/ui';
import '@toys/ui/styles.css';
import './styles.css';

interface Toy {
  /** 子路径，也是包目录名。 */
  id: string;
  no: string;
  name: string;
  desc: string;
  tags: string;
}

const TOYS: readonly Toy[] = [
  {
    id: 'anti-aliasing-clock',
    no: '01',
    name: 'AAClock',
    desc: '反走样时钟。同一套几何、两条采样路径，加一个能看设备像素的放大镜。',
    tags: 'WEBGL2 · SDF · 解析覆盖 vs 超采样',
  },
  {
    id: 'four-leaf-pinwheel',
    no: '02',
    name: '四叶风车',
    desc: '极坐标参数化、变换栈复制、时间驱动旋转，再挤出厚度做透视投影。',
    tags: 'CANVAS 2D · 参数曲线 · 画家算法',
  },
];

function Home() {
  const [install, setInstall] = useState<InstallPrompt>({
    canInstall: false,
    prompt: async () => false,
  });

  useEffect(() => {
    registerServiceWorker('./sw.js');
    return watchInstall(setInstall);
  }, []);

  return (
    <main>
      <header>
        <div className="head-row">
          <h1>toys</h1>
          <div className="head-tools">
            {install.canInstall && (
              <button type="button" className="toys-install" onClick={() => void install.prompt()}>
                安装到桌面
              </button>
            )}
            <ThemeSelect />
          </div>
        </div>
        <p>写来玩的小东西。每个都能直接打开，也顺便把一件事讲清楚。</p>
      </header>

      <hr className="rule" />

      <ul className="toys">
        {TOYS.map((toy) => (
          <li key={toy.id}>
            <a className="toy" href={`./${toy.id}/`}>
              <span className="no">{toy.no}</span>
              <span className="name">{toy.name}</span>
              <span className="desc">{toy.desc}</span>
              <span className="tags">{toy.tags}</span>
              <span className="go" aria-hidden="true">
                →
              </span>
            </a>
          </li>
        ))}
      </ul>

      <footer>
        <span>MPL-2.0</span>
        <a href="https://github.com/Nyasers/toys">源代码</a>
      </footer>
    </main>
  );
}

function mount(): void {
  const host = document.getElementById('root');
  if (!host) throw new Error('页面缺少 #root');
  createRoot(host).render(
    <ThemeProvider>
      <Home />
    </ThemeProvider>,
  );
}

mount();
