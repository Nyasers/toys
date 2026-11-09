// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Nyasers

/** 三个页面共用的东西：主题、颜色、选择器、PWA。 */
export { ThemeProvider, useTheme, readPalette, AUTO_THEME } from './theme.tsx';
export type { Palette, ThemePref } from './theme.tsx';
export { ThemeSelect } from './ThemeSelect.tsx';
export { THEME_IDS, THEME_LABELS, LIGHT_THEME, DARK_THEME, isThemeId } from './themes.ts';
export { parseColor, flatten, mix, over, toCss, toHex, toHexA, relativeLuminance } from './colors.ts';
export type { RGBA } from './colors.ts';
export { registerServiceWorker, watchInstall } from './pwa.ts';
export type { InstallPrompt } from './pwa.ts';
