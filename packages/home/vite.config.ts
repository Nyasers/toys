// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Nyasers

import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import { themeLabels } from '@toys/ui/vite';

/**
 * 自包含构建：把 JS 与 CSS 内联进 index.html。
 *
 * 目录页是站点入口，多出来的 assets/ 会和子页面的产物混在同一层目录里；
 * 内联之后根上只有 index.html 一个文件，站点结构更好读。
 */
function inlineStandalone(): Plugin {
  return {
    name: 'home:inline-standalone',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const htmlKey = Object.keys(bundle).find((key) => key.endsWith('.html'));
      const htmlFile = htmlKey ? bundle[htmlKey] : undefined;
      if (!htmlFile || htmlFile.type !== 'asset') return;

      let html = String(htmlFile.source);

      html = html.replace(/<script[^>]*src="([^"]+)"[^>]*><\/script>/g, (match, src: string) => {
        const key = src.replace(/^\.\//, '');
        const chunk = bundle[key];
        if (!chunk || chunk.type !== 'chunk') return match;
        delete bundle[key];
        const code = chunk.code.replace(/<\/script>/g, '<\\/script>');
        return `<script type="module">\n${code}\n</script>`;
      });

      html = html.replace(
        /<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g,
        (match, href: string) => {
          const key = href.replace(/^\.\//, '');
          const asset = bundle[key];
          if (!asset || asset.type !== 'asset') return match;
          delete bundle[key];
          return `<style>\n${String(asset.source)}\n</style>`;
        },
      );

      htmlFile.source = html;
    },
  };
}

export default defineConfig(({ mode }) => {
  const standalone = mode === 'standalone' || mode === 'standalone-minify';
  const minify = mode === 'minify' || mode === 'standalone-minify';

  return {
    // base 用相对路径：站点挂在哪一层子路径下都能直接打开。
    base: './',
    build: {
      target: 'es2022',
      outDir: 'dist',
      emptyOutDir: true,
      minify: minify && 'oxc',
      cssMinify: minify,
      modulePreload: !standalone,
    },
    plugins: [themeLabels(), ...(standalone ? [inlineStandalone()] : [])],
    server: {
      port: 5182,
    },
  };
});
