'use client';
import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { isInstalled } from '@/components/pwa/pwa';
import { PUBLIC_PAGES } from '@/lib/site';
import { asChoice, isMeasuredPage, type AnalyticsChoice } from './analytics.rules';

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
const CHOICE = 'jantahr:analytics';
const OPEN = 'jantahr:analytics-settings';
const PUBLIC_PATHS = PUBLIC_PAGES.map((p) => p.path);

type GaWindow = Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };

/** Opens the banner again (footer "Cookie settings"), so an answer can be changed. */
export const openAnalyticsSettings = () => window.dispatchEvent(new Event(OPEN));

let loaded = false;
/** Loads gtag.js once, after the visitor allowed it: nothing from Google loads before that. */
function loadGtag(id: string) {
  if (loaded) return;
  loaded = true;
  const w = window as GaWindow;
  w.dataLayer = w.dataLayer || [];
  // gtag reads the arguments object itself, not an array
  w.gtag = function gtag() { w.dataLayer!.push(arguments); }; // eslint-disable-line prefer-rest-params
  w.gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
  w.gtag('js', new Date());
  // page views are sent below, for public pages only, without the query string; cookies stay on this host
  w.gtag('config', id, { send_page_view: false, cookie_domain: location.hostname, allow_google_signals: false, allow_ad_personalization_signals: false });
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.appendChild(s);
}

/** Removes the _ga cookies after a visitor says no (they exist only if they had said yes before). */
function clearCookies() {
  for (const c of document.cookie.split(';')) {
    const name = c.split('=')[0].trim();
    if (!name.startsWith('_ga')) continue;
    for (const domain of ['', `; domain=${location.hostname}`]) document.cookie = `${name}=; max-age=0; path=/${domain}`;
  }
}

/**
 * Google Analytics for the public site of the cloud edition, only with the visitor's consent (DPDP Act): a banner
 * asks once, "No thanks" is as easy as "Allow", and the footer's Cookie settings reopens it. Never inside the app or
 * the installed app, and never without NEXT_PUBLIC_GA_MEASUREMENT_ID.
 */
export function SiteAnalytics() {
  const path = usePathname() ?? '/';
  const [choice, setChoice] = React.useState<AnalyticsChoice | null>(null);
  const [asking, setAsking] = React.useState(false);
  const [app, setApp] = React.useState(true); // assume the installed app until the first effect knows

  React.useEffect(() => {
    let stored: AnalyticsChoice | null = null;
    try { stored = asChoice(localStorage.getItem(CHOICE)); } catch { /* storage blocked: ask, and keep nothing */ }
    setChoice(stored);
    setAsking(stored === null);
    setApp(isInstalled());
    const open = () => setAsking(true);
    window.addEventListener(OPEN, open);
    return () => window.removeEventListener(OPEN, open);
  }, []);

  const measured = !!GA_ID && !app && isMeasuredPage(path, PUBLIC_PATHS);
  React.useEffect(() => {
    if (!GA_ID) return;
    const send = measured && choice === 'granted';
    // gtag stays loaded after a public page loaded it; this official switch stops it sending anything elsewhere
    (window as unknown as Record<string, boolean>)[`ga-disable-${GA_ID}`] = !send;
    if (!send) return;
    loadGtag(GA_ID);
    (window as GaWindow).gtag!('event', 'page_view', { page_location: location.origin + path, page_title: document.title });
  }, [measured, choice, path]);

  if (!measured || !asking) return null;
  const answer = (c: AnalyticsChoice) => {
    try { localStorage.setItem(CHOICE, c); } catch { /* fine: it asks again next visit */ }
    if (c === 'denied') clearCookies();
    setChoice(c);
    setAsking(false);
  };
  return (
    <div role="region" aria-label="Cookies" className="frosted fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-50 mx-auto max-w-[560px] rounded-lg border p-4 sm:left-auto sm:right-4 sm:mx-0">
      <p className="text-caption">
        May we use Google Analytics cookies to count visits to these public pages? It helps us see which pages are useful.
        No ads, and nothing from inside the app. <Link href="/legal/privacy" className="text-primary underline underline-offset-2">Privacy notice</Link>
      </p>
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="outline" className="flex-1 sm:flex-none" onClick={() => answer('denied')}>No thanks</Button>
        <Button size="sm" className="flex-1 sm:flex-none" onClick={() => answer('granted')}>Allow</Button>
      </div>
    </div>
  );
}

/** Footer link that reopens the banner. */
export function CookieSettingsButton({ className }: { className?: string }) {
  if (!GA_ID) return null;
  return <button type="button" className={className} onClick={openAnalyticsSettings}>Cookie settings</button>;
}
