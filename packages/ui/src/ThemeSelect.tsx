// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Nyasers

/*
 * ThemeSelect.tsx —— 主题选择器。
 *
 * 原生 select：键盘、触屏、读屏都不用另写一遍，样式跟着主题 token 走。
 * 首项是"自动"（跟随系统明暗），后面是上游的全部主题。
 */

import { AUTO_THEME, useTheme } from './theme.tsx';
import { THEME_IDS, THEME_LABELS } from './themes.ts';

export interface ThemeSelectProps {
  className?: string;
  /** 无障碍名，默认"主题"。 */
  label?: string;
}

export function ThemeSelect({ className, label = '主题' }: ThemeSelectProps) {
  const { pref, setPref } = useTheme();

  return (
    <select
      className={['toys-theme-select', className].filter(Boolean).join(' ')}
      aria-label={label}
      value={pref}
      onChange={(ev) => setPref(ev.currentTarget.value)}
    >
      <option value={AUTO_THEME}>自动</option>
      {THEME_IDS.map((id) => (
        <option key={id} value={id}>
          {THEME_LABELS[id] ?? id}
        </option>
      ))}
    </select>
  );
}
