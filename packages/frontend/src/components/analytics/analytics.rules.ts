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
