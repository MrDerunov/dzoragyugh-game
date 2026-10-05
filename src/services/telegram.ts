import type { HapticKind, TelegramContext } from './types';

interface TelegramWebAppLike {
  ready?: () => void;
  expand?: () => void;
  initData?: string;
  initDataUnsafe?: { user?: { first_name?: string; last_name?: string } };
  HapticFeedback?: {
    impactOccurred?: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred?: (type: 'error' | 'success' | 'warning') => void;
  };
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebAppLike };
  }
}

const SCRIPT_URL = 'https://telegram.org/js/telegram-web-app.js';
let sdkPromise: Promise<boolean> | null = null;

/** Похоже на Telegram WebView? */
function looksLikeTelegram(): boolean {
  if (/telegram/i.test(navigator.userAgent)) return true;
  const params = new URLSearchParams(window.location.search);
  return params.has('tgWebAppData') || params.has('tgWebAppPlatform');
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Не удалось загрузить Telegram SDK'));
    document.head.appendChild(s);
  });
}

async function loadSdk(): Promise<boolean> {
  if (!sdkPromise) {
    sdkPromise = (async () => {
      if (!looksLikeTelegram()) return false;
      try {
        await loadScript(SCRIPT_URL);
        return Boolean(window.Telegram?.WebApp);
      } catch {
        return false;
      }
    })();
  }
  return sdkPromise;
}

/**
 * DEV MODE: вне Telegram возвращает { available: false } — игра работает
 * как обычный сайт (см. геймдизайн, §65).
 */
export async function initTelegram(): Promise<TelegramContext> {
  const ok = await loadSdk();
  if (!ok) return { available: false };

  const wa = window.Telegram?.WebApp;
  try {
    wa?.ready?.();
    wa?.expand?.();
  } catch {
    /* не критично */
  }

  const user = wa?.initDataUnsafe?.user;
  const userName = user
    ? [user.first_name, user.last_name].filter(Boolean).join(' ').trim()
    : undefined;

  return {
    available: true,
    userName,
    initData: typeof wa?.initData === 'string' ? wa.initData : undefined,
  };
}

export function tgHaptic(kind: HapticKind): void {
  try {
    const h = window.Telegram?.WebApp?.HapticFeedback;
    if (!h) return;
    if (kind === 'error') h.notificationOccurred?.('error');
    else if (kind === 'success') h.notificationOccurred?.('success');
    else if (kind === 'warning') h.notificationOccurred?.('warning');
    else if (kind === 'medium') h.impactOccurred?.('medium');
    else h.impactOccurred?.('light');
  } catch {
    /* haptics не критичны */
  }
}

export function tgReady(): void {
  try { window.Telegram?.WebApp?.ready?.(); } catch { /* ignore */ }
}

export function tgExpand(): void {
  try { window.Telegram?.WebApp?.expand?.(); } catch { /* ignore */ }
}
