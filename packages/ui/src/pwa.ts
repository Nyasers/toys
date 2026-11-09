// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Nyasers

/*
 * pwa.ts —— service worker 注册与"安装到桌面"的入口。
 *
 * sw.js 与 manifest 由 scripts/assemble-site.mjs 在构建后生成，放在站点根，
 * 所以各页注册时传的是"从当前页到站点根的相对路径"（目录页 './sw.js'，
 * 子页面 '../sw.js'）。
 *
 * 开发环境不注册：SW 会缓存产物，热更新会看到旧代码。
 */

export interface InstallPrompt {
  /** 浏览器给了一次安装机会时才有值。 */
  canInstall: boolean;
  /** 触发安装；用户拒绝或已完成时返回 false。 */
  prompt: () => Promise<boolean>;
}

export function registerServiceWorker(href: string): void {
  if (!('serviceWorker' in navigator)) return;
  if (import.meta.env?.DEV) return;

  window.addEventListener('load', () => {
    const url = new URL(href, document.baseURI);
    navigator.serviceWorker.register(url, { scope: new URL('.', url).pathname }).catch((err) => {
      // 注册失败不影响页面本身，只是没有离线能力。
      console.warn('[toys] service worker 注册失败', err);
    });
  });
}

/**
 * 订阅安装能力的变化。`beforeinstallprompt` 只发一次，且只在满足安装条件时发出；
 * 已经安装（standalone）时永远不发。
 */
export function watchInstall(onChange: (state: InstallPrompt) => void): () => void {
  let event: Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> } =
    null as never;

  const emit = (): void =>
    onChange({
      canInstall: event !== null,
      prompt: async () => {
        if (!event) return false;
        event.prompt();
        const choice = await event.userChoice;
        event = null as never;
        emit();
        return choice.outcome === 'accepted';
      },
    });

  const onBeforeInstall = (ev: Event): void => {
    ev.preventDefault();
    event = ev as typeof event;
    emit();
  };

  const onInstalled = (): void => {
    event = null as never;
    emit();
  };

  window.addEventListener('beforeinstallprompt', onBeforeInstall);
  window.addEventListener('appinstalled', onInstalled);
  emit();

  return () => {
    window.removeEventListener('beforeinstallprompt', onBeforeInstall);
    window.removeEventListener('appinstalled', onInstalled);
  };
}
