// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Nyasers

/*
 * 组装站点目录：目录页在根，每个玩具一个子路径，产物互不覆盖。
 *
 * 源码都在 packages/ 下，发布路径去掉这一层：包目录名就是站点子路径。
 * 这一步还生成 PWA 的三件套：manifest、service worker（含预缓存清单）、图标。
 *
 * 缓存版本取自产物内容的指纹：任何一页改了，版本号就变，旧缓存随新 worker 激活清掉。
 */

import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const root = process.cwd();
const out = join(root, '_site');

/** 子包目录（相对 packages/）与它发布到的子路径。 */
const TOYS = [
  { dir: 'anti-aliasing-clock', path: 'anti-aliasing-clock' },
  { dir: 'four-leaf-pinwheel', path: 'four-leaf-pinwheel' },
];

/* ── 搬运 ───────────────────────────────────────────────── */

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

// 目录页在站点根：它的构建已经是单文件，不会在根上留下 assets/。
await cp(join(root, 'packages', 'home', 'dist'), out, { recursive: true });
console.log('packages/home/dist → _site/');

for (const toy of TOYS) {
  await cp(join(root, 'packages', toy.dir, 'dist'), join(out, toy.path), { recursive: true });
  console.log(`packages/${toy.dir}/dist → _site/${toy.path}`);
}

/* ── 文件清单 ───────────────────────────────────────────── */

/** 递归列出文件，路径一律用 `/`（这是写进 sw 的字符串，不能跟着平台变）。 */
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

const all = await walk(out);
const relative = all.map((file) => '/' + file.slice(out.length + 1).split('\\').join('/'));

const digest = createHash('sha256');
for (const file of all.sort()) {
  const info = await stat(file);
  digest.update(file.slice(out.length));
  digest.update(String(info.size));
  digest.update(await readFile(file));
}
const version = digest.digest('hex').slice(0, 10);

/* ── PWA ────────────────────────────────────────────────── */

const ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#1b1a18"/>
  <circle cx="256" cy="256" r="132" fill="none" stroke="#f4f3ee" stroke-width="26"/>
  <path d="M256 256V150" stroke="#f4f3ee" stroke-width="24" stroke-linecap="round"/>
  <path d="M256 256l74 44" stroke="#b5846e" stroke-width="20" stroke-linecap="round"/>
  <circle cx="256" cy="256" r="16" fill="#b5846e"/>
</svg>
`;

await writeFile(join(out, 'icon.svg'), ICON);

const manifest = {
  name: 'toys',
  short_name: 'toys',
  description: '一些小玩具：每个都能直接打开，也顺便讲清一件事。',
  lang: 'zh-CN',
  start_url: './',
  scope: './',
  display: 'standalone',
  background_color: '#1b1a18',
  theme_color: '#1b1a18',
  icons: [
    { src: './icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    { src: './icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
  ],
};

await writeFile(join(out, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2) + '\n');

const precache = [...relative, '/manifest.webmanifest', '/icon.svg'].sort();

const sw = `// 由 scripts/assemble-site.mjs 生成，不要手改。版本：${version}
const CACHE = 'toys-${version}';
const ASSETS = ${JSON.stringify(precache, null, 2)};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // 导航请求走网络优先：发布新版本后刷新就能拿到，不用等旧缓存过期。
  // 断网时回退到缓存里的同一页，再不行回退到站点根的目录页。
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() =>
          caches
            .match(request, { ignoreSearch: true })
            .then((hit) => hit || caches.match('/')),
        ),
    );
    return;
  }

  // 其余资源缓存优先：文件名带指纹，更新靠新的 worker 换缓存。
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});
`;

await writeFile(join(out, 'sw.js'), sw);

console.log(`PWA: manifest + sw.js（版本 ${version}，预缓存 ${precache.length} 个文件）`);
