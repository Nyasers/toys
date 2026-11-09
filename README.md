# toys

一些自己写来玩的小东西。每个都是独立包、独立构建的单页，约定同一条：React 19 + TypeScript + Vite，无 UI 框架运行时依赖，配色全部走 Hana 主题 token。

仓库在这里，页面也在这里：一个站点，按 path 分区，装得上桌面，断网也能开。

| 子路径 | 项目 | 它讲的事 |
|---|---|---|
| [/anti-aliasing-clock/](https://nyasers.github.io/toys/anti-aliasing-clock/) | [AAClock](packages/anti-aliasing-clock/) | 反走样：同一套几何、两条采样路径、一个能看设备像素的放大镜 |
| [/four-leaf-pinwheel/](https://nyasers.github.io/toys/four-leaf-pinwheel/) | [四叶风车](packages/four-leaf-pinwheel/) | 图形学流水线：参数化 → 变换 → 时间 → 投影消隐 |

根上是目录页，只负责链到这些子路径。

## 结构

```
packages/
  home/                    目录页（部署在站点根）
  ui/                      三页共用：主题、色板、选择器、PWA
  anti-aliasing-clock/     反走样时钟
  four-leaf-pinwheel/      四叶风车
scripts/assemble-site.mjs  组装 _site，生成 manifest 与 service worker
vendor/openhanako/         主题 CSS 与主题名（submodule，pin 在 v0.450.0）
```

每个 `packages/<name>/` 是一个完整的包：自己的 `index.html`、`src/`、`vite.config.ts`、`package.json`。它们互不引用，可以单独构建、单独把 `dist/index.html` 拿出来双击打开。

源码收在 `packages/` 下，发布路径去掉这一层：包目录名就是站点子路径。

## 主题

配色不是本仓库的数据。11 套主题的 CSS 与中文名都来自 [liliMozi/openhanako](https://github.com/liliMozi/openhanako)（Hana 的桌面端），以 submodule 引用；`packages/ui/src/themes.ts` 逐个显式 import，`vite-plugin.ts` 在构建期从上游 locale 摘出显示名，上游改了 key 就直接中断构建，不静默回落到 id。

页面只消费 `--bg` / `--bg-card` / `--text` / `--accent` / `--border` 这些变量，不自己造色。选择存在 `localStorage`（`toys:theme`），首项「自动」跟随 `prefers-color-scheme`；也可以用 `?theme=warm-paper` 这种 URL 参数直接指定。

Canvas 与 WebGL 读不到 CSS 变量，所以两处各在读主题时取一次计算样式，之后只在主题变化时重读，不进渲染循环。

## 本地

```bash
git submodule update --init --depth 1   # 主题资源
pnpm install
pnpm dev                                # 三个页面并行起开发服务器（5180 / 5181 / 5182）
```

构建：

```bash
pnpm build                    # 全部子包：多文件、不压缩
pnpm build:minify             # 全部子包：多文件、压缩
pnpm build:standalone         # 全部子包：单文件 dist/index.html，不压缩
pnpm build:standalone:minify  # 全部子包：单文件、压缩
pnpm site                     # 构建单文件压缩版 + 组装 _site（线上那一份）
```

只做其中一个：

```bash
pnpm --filter anti-aliasing-clock build:standalone
pnpm --filter four-leaf-pinwheel dev
```

## 部署

推 `master` 即发布。[`.github/workflows/pages.yml`](.github/workflows/pages.yml) 负责：

1. checkout（含 submodule）→ `pnpm install --frozen-lockfile`
2. `pnpm site`：递归构建每个子包的单文件压缩产物，再组装成 `_site/`
3. 上传 `_site` 到 GitHub Pages

加一个玩具：在 `packages/` 下新建包、登记进 `pnpm-workspace.yaml` 的 `packages/*`、把它的目录名加进 [`scripts/assemble-site.mjs`](scripts/assemble-site.mjs) 的清单、在目录页的 `TOYS` 里加一条。子路径由清单里的 `path` 决定，`vite` 的 `base` 保持相对路径 `./` 即可。

## PWA

`pnpm site` 在组装时顺手生成三样东西，都在站点根：

- `manifest.webmanifest`：名字、图标、`display: standalone`
- `sw.js`：预缓存全部产物（页面、manifest、图标），**缓存版本取自产物内容的指纹**，任何一页改了版本号就变，旧缓存随新 worker 激活清掉
- `icon.svg`：图标

三个页面各自注册同一个 `sw.js`（scope 是站点根），所以装一次，离线时三个页面都能开。开发环境不注册，避免缓存挡住热更新。

## 许可

[Mozilla Public License 2.0](LICENSE)，全仓库一份。

This Source Code Form is "Incompatible With Secondary Licenses", as defined by the Mozilla Public License, v. 2.0.
