# toys

一些自己写来玩的小东西。每个都是独立包、独立构建的单页，约定同一条：无框架、无运行时依赖，Vite + TypeScript，产物是一个可以直接双击打开的 html。

仓库在这里，页面也在这里：一个站点，按 path 分区。

| 子路径 | 项目 | 它讲的事 |
|---|---|---|
| [/aaclock/](https://nyasers.github.io/toys/aaclock/) | [AAClock](aaclock/) | 反走样：同一套几何、两条采样路径、一个能看设备像素的放大镜 |
| [/four-leaf-pinwheel/](https://nyasers.github.io/toys/four-leaf-pinwheel/) | [四叶风车](four-leaf-pinwheel/) | 图形学流水线：参数化 → 变换 → 时间 → 投影消隐 |

根上的 [index.html](index.html) 是目录页，只负责链到这两个子路径。

## 结构

```
index.html                目录页（部署在站点根）
scripts/assemble-site.mjs 把各子包的 dist 搬到 _site/<path>
aaclock/                  反走样时钟
four-leaf-pinwheel/       四叶风车
```

每个子目录仍是一个完整的包：自己的 `index.html`、`src/`、`vite.config.ts`、`package.json`。它们互不引用，可以单独构建、单独把 `dist` 拿出来用。

## 本地

```bash
git submodule update --init --depth 1   # aaclock 的主题资源取自 submodule
pnpm install
pnpm dev                                # 两个玩具并行起开发服务器（5180 / 5181）
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
pnpm --filter aaclock build:standalone
pnpm --filter four-leaf-pinwheel dev
```

## 部署

推 `master` 即发布。[`.github/workflows/pages.yml`](.github/workflows/pages.yml) 负责：

1. checkout（含 submodule）→ `pnpm install --frozen-lockfile`
2. `pnpm site`：递归构建每个子包的单文件压缩产物，再组装成 `_site/`
3. 上传 `_site` 到 GitHub Pages

所以加一个玩具的步骤是：新建子目录、登记进 `pnpm-workspace.yaml`、把它的 `dist` 加进 `scripts/assemble-site.mjs` 的清单、在根 `index.html` 里加一条。子路径就是它的目录名，`vite` 的 `base` 保持相对路径 `./` 即可，不需要为部署路径改任何配置。

## 许可

[Mozilla Public License 2.0](LICENSE)，全仓库一份。

This Source Code Form is "Incompatible With Secondary Licenses", as defined by the Mozilla Public License, v. 2.0.
