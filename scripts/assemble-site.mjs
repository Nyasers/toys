// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Nyasers

/*
 * 组装站点目录：每个玩具一个子路径，产物互不覆盖。
 *
 * 只做搬运：把根 index.html 与各子包的 dist 拷进 _site/<path>，
 * 不在这一步构建，也不改写产物。
 */

import { cp, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const out = join(root, '_site');

/** 子包目录与它发布到的子路径。 */
const toys = [
  { dir: 'aaclock', path: 'aaclock' },
  { dir: 'four-leaf-pinwheel', path: 'four-leaf-pinwheel' },
];

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await cp(join(root, 'index.html'), join(out, 'index.html'));

for (const toy of toys) {
  await cp(join(root, toy.dir, 'dist'), join(out, toy.path), { recursive: true });
  console.log(`${toy.dir}/dist → _site/${toy.path}`);
}
