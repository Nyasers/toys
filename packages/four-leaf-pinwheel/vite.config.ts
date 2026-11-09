// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Nyasers

import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import { themeLabels } from '@toys/ui/vite';
import { minify as minifyHtml } from 'html-minifier-terser';

/**
 * 独立单文件构建：把 JS 与 CSS 内联进 index.html，产物只剩一个 html。
 *
 * 走 Vite 自己的 bundle 对象（generateBundle），不读磁盘、不引依赖。
 * module 脚本里一旦出现 `</script>` 会提前关掉标签，这里统一转义。
 */
function inlineStandalone(): Plugin {
  return {
    name: 'pinwheel:inline-standalone',
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

/**
 * HTML 压缩：交给 html-minifier-terser，只开折空白与去注释。
 * 内联的 script / style 不动——模块脚本是已经压过的 JS，动它就是动行为。
 *
 * 许可声明必须留下：MPL 的 Exhibit A 要求源码形态随分发附带声明，
 * 单文件产物就是这个项目的源码形态。
 */
function minifyHtmlOutput(): Plugin {
  return {
    name: 'pinwheel:minify-html',
    enforce: 'post',
    async generateBundle(_options, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type === 'asset' && file.fileName.endsWith('.html')) {
          file.source = await minifyHtml(String(file.source), {
            collapseWhitespace: true,
            removeComments: false,
          });
        }
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  // mode 就是构建变体：默认（多文件、不压缩）/ minify / standalone / standalone-minify。
  // 开关只在这里声明一处，不依赖 CLI 与配置文件的优先级。
  const standalone = mode === 'standalone' || mode === 'standalone-minify';
  const minify = mode === 'minify' || mode === 'standalone-minify';
  return {
    // base 用相对路径：产物可以直接从 file:// 打开，也可以挂在任意子路径下。
    base: './',
    build: {
      target: 'es2022',
      assetsInlineLimit: 0,
      // 两种构建都落在 dist，且每次都清空重建：产物永远是刚构建出来的那一份，
      // 也不会留下上一版的残骸。代价是后一次构建会抹掉前一次。
      outDir: 'dist',
      emptyOutDir: true,
      // 默认不压缩：产物是拿来读的；需要压缩走 --mode minify。
      minify: minify && 'oxc',
      cssMinify: minify,
      // 内联之后没有可预加载的独立资源。
      modulePreload: !standalone,
    },
    // 插件顺序即执行顺序：内联 → 压 HTML。
    plugins: [
      themeLabels(),
      ...(standalone ? [inlineStandalone()] : []),
      ...(minify ? [minifyHtmlOutput()] : []),
    ],
    server: {
      port: 5181,
    },
  };
});
