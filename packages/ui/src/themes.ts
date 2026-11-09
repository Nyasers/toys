// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Nyasers

/*
 * themes.ts —— 主题 CSS 的入口与清单。
 *
 * 主题 CSS 是上游仓库的数据，不是本仓库的数据：文件在根 vendor/openhanako
 * （submodule，pin 在 v0.450.0），这里只做逐个显式 import。
 * 不 glob 目录：上游那份目录里还有本项目不消费的字体样式与字体文件。
 */

/// <reference path="./virtual.d.ts" />

import '../../../vendor/openhanako/desktop/src/themes/absolutely.css';
import '../../../vendor/openhanako/desktop/src/themes/contemplation.css';
import '../../../vendor/openhanako/desktop/src/themes/coral.css';
import '../../../vendor/openhanako/desktop/src/themes/deep-think.css';
import '../../../vendor/openhanako/desktop/src/themes/delve.css';
import '../../../vendor/openhanako/desktop/src/themes/grass-aroma.css';
import '../../../vendor/openhanako/desktop/src/themes/high-contrast.css';
import '../../../vendor/openhanako/desktop/src/themes/midnight.css';
import '../../../vendor/openhanako/desktop/src/themes/midnight-contrast.css';
import '../../../vendor/openhanako/desktop/src/themes/new-warm-paper.css';
import '../../../vendor/openhanako/desktop/src/themes/warm-paper.css';

import { THEME_LABELS } from 'virtual:toys-theme-labels';
import { THEME_IDS } from './theme-map.ts';

/** 跟随系统时用的两个主题：与宿主的默认搭配一致（暖纸 / 青夜）。 */
export const LIGHT_THEME = 'warm-paper';
export const DARK_THEME = 'midnight';

export { THEME_IDS, THEME_LABELS };

/** id 是否在本项目消费的清单里。 */
export const isThemeId = (id: string): boolean => THEME_IDS.includes(id);
