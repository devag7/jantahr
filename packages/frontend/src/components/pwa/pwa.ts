'use client';

/** Chrome's install prompt event, which is not in the DOM typings. */
export interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();

/** Called once from the root layout: registers the service worker and keeps the install prompt for later. */
export function startPwa() {
  if (typeof window === 'undefined') return;
  if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => { /* the app works without it */ });
  }
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // offer it from the account menu instead of Chrome's own banner
    deferred = e as InstallPromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener('appinstalled', () => { deferred = null; listeners.forEach((l) => l()); });
}

export const installPrompt = () => deferred;
export function onInstallPromptChange(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Already running as an installed app (home screen, Android app or desktop app window). */
export const isInstalled = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);

export const isIos = () =>
  typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

export const isAndroid = () => typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
