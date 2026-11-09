// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Nyasers

/*
 * 组装站点目录：每个玩具一个子路径，产物互不覆盖。
 *
 * 源码都在 packages/ 下，发布路径去掉这一层：包目录名就是站点子路径。
 * 这里只做搬运：把根 index.html 与各子包的 dist 拷进 _site/<path>，
 * 不在这一步构建，也不改写产物。
 */

import { cp, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const out = join(root, '_site');

/** 子包目录（相对 packages/）与它发布到的子路径。 */
const toys = [
  { dir: 'anti-aliasing-clock', path: 'anti-aliasing-clock' },
  { dir: 'four-leaf-pinwheel', path: 'four-leaf-pinwheel' },
];

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await cp(join(root, 'index.html'), join(out, 'index.html'));

for (const toy of toys) {
  await cp(join(root, 'packages', toy.dir, 'dist'), join(out, toy.path), { recursive: true });
  console.log(`packages/${toy.dir}/dist → _site/${toy.path}`);
}
