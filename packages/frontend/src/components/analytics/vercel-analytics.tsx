'use client';
import { Analytics, type BeforeSendEvent } from '@vercel/analytics/next';
import { isInstalled } from '@/components/pwa/pwa';
import { PUBLIC_PAGES } from '@/lib/site';
import { vercelPageUrl } from './analytics.rules';

const PUBLIC_PATHS = PUBLIC_PAGES.map((p) => p.path);

/** Every event passes here first: off the public site, or in the installed app, it is dropped. */
const beforeSend = (event: BeforeSendEvent): BeforeSendEvent | null => {
  const url = vercelPageUrl(event.url, PUBLIC_PATHS, isInstalled());
  return url ? { ...event, url } : null;
};

/**
 * Vercel Web Analytics: cookieless page views for the public pages of the cloud edition on Vercel. Same reach as
 * Google Analytics (public pages, sign-in and sign-up; never the app), but no cookies, so it needs no consent banner.
 */
export function VercelAnalytics() {
  return <Analytics beforeSend={beforeSend} />;
}
