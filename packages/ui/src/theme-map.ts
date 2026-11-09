// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Nyasers

/*
 * theme-map.ts —— 主题 id 与上游 locale key 的对应表（纯数据）。
 *
 * 单独放一个文件，是为了让 vite 插件（Node 环境）也能读它：
 * themes.ts 里带 CSS import，Node 直接 import 会失败。
 *
 * id 与 key 不是同一套命名（kebab-case 对 camelCase，且个别主题并不规则对应），
 * 因此在这里一一写明，不做字符串推导。
 */

/** 主题 id，按字典序，也是上游主题 CSS 的文件名。 */
export const THEME_IDS: readonly string[] = [
  'absolutely',
  'contemplation',
  'coral',
  'deep-think',
  'delve',
  'grass-aroma',
  'high-contrast',
  'midnight',
  'midnight-contrast',
  'new-warm-paper',
  'warm-paper',
];

/** 主题 id → 上游 locales/zh.json 的 appearance 区块里的 key。 */
export const THEME_LABEL_KEYS: Readonly<Record<string, string>> = {
  absolutely: 'absolutely',
  contemplation: 'contemplation',
  coral: 'coral',
  'deep-think': 'deepThink',
  delve: 'delve',
  'grass-aroma': 'grassAroma',
  'high-contrast': 'highContrast',
  midnight: 'midnight',
  'midnight-contrast': 'midnightContrast',
  'new-warm-paper': 'newWarmPaper',
  'warm-paper': 'warmPaper',
};
