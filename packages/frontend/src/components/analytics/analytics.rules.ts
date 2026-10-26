/**
 * Which pages Google Analytics may see, and the visitor's stored answer. No imports: the component and the tests
 * both load it.
 */

/** Sign-in and sign-up count as public: they are where the site leads. Links that carry tokens (reset, callback) do not. */
const MEASURED_AUTH = ['/login', '/signup'];

/**
 * The public site only (`publicPaths` is PUBLIC_PAGES). Inside the app (employee records, payroll) nothing is sent,
 * even after a visitor allowed it on the home page.
 */
export const isMeasuredPage = (path: string, publicPaths: readonly string[]) => {
  const p = path.replace(/\/+$/, '') || '/';
  return publicPaths.includes(p) || MEASURED_AUTH.includes(p);
};

export type AnalyticsChoice = 'granted' | 'denied';
export const asChoice = (v: unknown): AnalyticsChoice | null => (v === 'granted' || v === 'denied' ? v : null);

/**
 * The page view Vercel Web Analytics may record (cookieless, see the privacy notice): the address without its query
 * string or fragment, on a public page, outside the installed app. null drops the event, so nothing from inside the
 * app (employee records, payroll) is ever sent.
 */
export function vercelPageUrl(url: string, publicPaths: readonly string[], installed: boolean): string | null {
  if (installed) return null;
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  if (!isMeasuredPage(u.pathname, publicPaths)) return null;
  return `${u.origin}${u.pathname}`;
}
