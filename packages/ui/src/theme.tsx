// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Nyasers

/*
 * theme.tsx —— 全站主题：偏好解析、应用到 documentElement、给渲染器读色板。
 *
 * 主题定义来自上游 CSS（见 themes.ts）。这里只决定"用哪一份"：
 * localStorage 的显式选择 > 系统明暗。选择「自动」时跟随 prefers-color-scheme。
 *
 * 三件事分得很清：
 *   1. data-theme 落在 documentElement 上，主题 CSS 的 [data-theme] 块随之生效；
 *   2. colorScheme 由底色亮度判定，原生控件与滚动条跟着走；
 *   3. Canvas / WebGL 拿不到 CSS 变量，所以另外提供 readPalette() 读一次计算样式。
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { DARK_THEME, LIGHT_THEME, isThemeId } from './themes.ts';
import { flatten, parseColor, relativeLuminance, type RGBA } from './colors.ts';

/** 选择器里的「自动」项，与主题 id 同一个命名空间。 */
export const AUTO_THEME = 'auto';
export type ThemePref = string;

const STORAGE_KEY = 'toys:theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

interface ThemeContextValue {
  /** 用户选择：'auto' 或某个主题 id。 */
  pref: ThemePref;
  /** 实际生效的主题 id。 */
  resolved: string;
  setPref: (pref: ThemePref) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * 初值：URL 的 ?theme= 优先（方便分享某个主题），其次 localStorage，最后自动。
 * 未知取值一律忽略，不静默替换成别的主题。
 */
function readInitial(): ThemePref {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('theme');
    if (fromUrl === AUTO_THEME || (fromUrl !== null && isThemeId(fromUrl))) return fromUrl;
  } catch {
    // location 不可用时当作没有参数
  }
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? AUTO_THEME;
  } catch {
    // 隐私模式下 localStorage 会直接抛：当作没选过。
    return AUTO_THEME;
  }
}

function resolvePref(pref: ThemePref, systemDark: boolean): string {
  if (pref === AUTO_THEME) return systemDark ? DARK_THEME : LIGHT_THEME;
  return isThemeId(pref) ? pref : systemDark ? DARK_THEME : LIGHT_THEME;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(readInitial);
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia(DARK_QUERY).matches,
  );

  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY);
    const onChange = (): void => setSystemDark(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const resolved = resolvePref(pref, systemDark);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset['theme'] = resolved;
    const bg = parseColor(getComputedStyle(root).getPropertyValue('--bg'));
    root.style.colorScheme = relativeLuminance(bg) < 0.5 ? 'dark' : 'light';
  }, [resolved]);

  const setPref = useCallback((next: ThemePref) => {
    setPrefState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // 存不下就算了：本次切换照样生效。
    }
  }, []);

  const value = useMemo(() => ({ pref, resolved, setPref }), [pref, resolved, setPref]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme 必须在 ThemeProvider 内使用');
  return value;
}

/* ── 给 Canvas / WebGL 读的色板 ─────────────────────────── */

/** 渲染器需要的一组颜色（见各页的 README）。 */
export interface Palette {
  bg: RGBA;
  card: RGBA;
  edge: RGBA;
  ink: RGBA;
  inkSoft: RGBA;
  muted: RGBA;
  accent: RGBA;
  coral: RGBA;
  /** `--shadow` 的 rgb；`a` 是不透明度，作为投影的独立强度系数。 */
  shadow: RGBA;
}

const TRANSPARENT: RGBA = { r: 0, g: 0, b: 0, a: 0 };

/**
 * 从当前计算样式读一次色板。只在主题变化时调用，不进渲染循环。
 * `--border` 常是 rgba()：先与 `--bg` 合成成实色再交给 GL。
 */
export function readPalette(): Palette {
  const styles = getComputedStyle(document.documentElement);
  const raw = (name: string): string => styles.getPropertyValue(name).trim();

  const bg = parseColor(raw('--bg'));
  const ink = parseColor(raw('--text'));
  const inkSoft = parseColor(raw('--text-light'), ink);

  return {
    bg,
    card: parseColor(raw('--bg-card'), bg),
    edge: flatten(parseColor(raw('--border'), TRANSPARENT), bg),
    ink,
    inkSoft,
    muted: parseColor(raw('--text-muted'), inkSoft),
    accent: parseColor(raw('--accent'), ink),
    coral: parseColor(raw('--coral'), parseColor(raw('--accent'), ink)),
    shadow: parseColor(raw('--shadow'), TRANSPARENT),
  };
}
