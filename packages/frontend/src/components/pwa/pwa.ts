'use client';

/** Chrome's install prompt event, which is not in the DOM typings. */
export interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | null = null;

/** Called once from the root layout: registers the service worker and keeps the install prompt for later. */
export function startPwa() {
  if (typeof window === 'undefined') return;
  inAndroidApp(); // remember it before client-side navigation drops ?source=android-app
  if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => { /* the app works without it */ });
  }
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // offer it from the account menu instead of Chrome's own banner
    deferred = e as InstallPromptEvent;
  });
  window.addEventListener('appinstalled', () => { deferred = null; });
}

export const installPrompt = () => deferred;

/** Already running as an installed app (home screen, Android app or desktop app window). */
export const isInstalled = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);

export const isIos = () =>
  typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

export const isAndroid = () => typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);

const ANDROID_APP_KEY = 'jantahr:android-app';

/**
 * Running inside the Google Play app (the Trusted Web Activity). Google Play's payments policy does not allow
 * buying the subscription there through Razorpay, so plan purchase and upgrade prompts are hidden in it.
 * The app opens with `?source=android-app` and Chrome sets the referrer to `android-app://<package>`; either is
 * remembered for the tab's session, which the Play app does not share with ordinary Chrome tabs.
 */
export function inAndroidApp() {
  if (typeof window === 'undefined') return false;
  try {
    if (sessionStorage.getItem(ANDROID_APP_KEY)) return true;
    const pkg = process.env.NEXT_PUBLIC_ANDROID_PACKAGE_NAME;
    const launched = new URLSearchParams(window.location.search).get('source') === 'android-app' || (!!pkg && document.referrer.startsWith(`android-app://${pkg}`));
    if (launched) sessionStorage.setItem(ANDROID_APP_KEY, '1');
    return launched;
  } catch {
    return false;
  }
}
