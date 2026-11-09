// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Nyasers

/// <reference types="node" />

/*
 * vite-plugin.ts —— 构建期把上游 locale 里的主题显示名摘出来。
 *
 * 显示名在 submodule 里（vendor/openhanako/desktop/src/locales/zh.json 的
 * settings.appearance）。这里只摘清单里那几条，整个 locale 文件不进产物。
 *
 * 上游改了 key、删了条目或搬了文件，构建直接抛错中断——显示名不静默回落到 id。
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { THEME_IDS, THEME_LABEL_KEYS } from './theme-map.ts';

const here = dirname(fileURLToPath(import.meta.url));
const LOCALE = resolve(here, '../../../vendor/openhanako/desktop/src/locales/zh.json');

const VIRTUAL = 'virtual:toys-theme-labels';
const RESOLVED = `\0${VIRTUAL}`;

export function themeLabels(): Plugin {
  return {
    name: 'toys:theme-labels',
    resolveId(id) {
      return id === VIRTUAL ? RESOLVED : null;
    },
    load(id) {
      if (id !== RESOLVED) return null;

      const locale = JSON.parse(readFileSync(LOCALE, 'utf8')) as {
        settings?: { appearance?: Record<string, string> };
      };
      const appearance = locale.settings?.appearance ?? {};
      const labels: Record<string, string> = {};
      const missing: string[] = [];

      for (const id of THEME_IDS) {
        const key = THEME_LABEL_KEYS[id];
        const label = key === undefined ? undefined : appearance[key];
        if (typeof label === 'string' && label.length > 0) labels[id] = label;
        else missing.push(`${id} → appearance.${key ?? '(未登记)'}`);
      }

      if (missing.length > 0) {
        throw new Error(`[toys] 上游 locale 里没有这些主题名：${missing.join('、')}`);
      }

      return `export const THEME_LABELS = ${JSON.stringify(labels, null, 2)};\n`;
    },
  };
}
