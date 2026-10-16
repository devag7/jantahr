// Phone audit of the signed-in app (docs/design-system.md rules 11, 12 and 14): every page in the navigation, for
// four roles, at a phone size with touch input, as the Android app and the iPhone web app show it. Reports, per page:
//   - horizontal overflow (the page scrolls sideways)
//   - tap areas under 44 x 44, by tapping 21px from the centre of each small control (a clipped or covered
//     area fails; controls inside tables and inline text links are exempt, as rule 11 allows)
//   - en or em dashes in visible text
//   pnpm --filter jantahr-frontend exec node scripts/phone-audit.mjs
// Needs the web app (WEB, default http://localhost:3000, cloud edition) and the API on a freshly seeded demo company,
// and a local Chrome (CHROME). W and H set the viewport (default 360 x 740); REPORT writes the JSON report to a file.
// Exits 1 when any page fails. Keep ROUTES in step with components/layout/nav.constants.ts.
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const WEB = process.env.WEB || 'http://localhost:3000';
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const W = Number(process.env.W || 360);
const H = Number(process.env.H || 740);
// the seed's demo passwords
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@123';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'Demo@1234';
const ROLES = [['employee@jantahr.com', DEMO_PASSWORD], ['manager@jantahr.com', DEMO_PASSWORD], ['hr@jantahr.com', DEMO_PASSWORD], ['admin@jantahr.com', ADMIN_PASSWORD]];
const ROUTES = [
  '/dashboard', '/me/attendance', '/me/leave', '/me/payslips', '/me/tax', '/me/expenses', '/me/performance', '/me/helpdesk',
  '/me/policies', '/me/privacy', '/me/profile', '/directory', '/org-chart', '/approvals', '/team', '/hr/employees',
  '/hr/attendance', '/hr/leave', '/hr/lifecycle', '/hr/performance', '/hr/recruitment', '/hr/payroll', '/hr/payroll/setup',
  '/hr/payroll/statutory', '/hr/compliance', '/hr/reports', '/hr/insights', '/hr/privacy', '/hr/billing', '/hr/settings',
];

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
const results = [];
for (const [email, password] of ROLES) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setUserAgent('Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36');
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  // as the Android app: no product tour, no purchase screens
  await page.evaluateOnNewDocument(() => {
    try { localStorage.setItem('jantahr:tour:off', '1'); sessionStorage.setItem('jantahr:android-app', '1'); } catch { /* opaque origin */ }
  });
  await page.goto(`${WEB}/login`, { waitUntil: 'networkidle0' });
  await page.type('#email', email);
  await page.type('#password', password);
  await page.click('form button[type=submit]');
  await page.waitForFunction(() => !location.pathname.startsWith('/login'), { timeout: 90000 });
  const role = email.split('@')[0];
  for (const route of ROUTES) {
    try { await page.goto(`${WEB}${route}`, { waitUntil: 'networkidle0', timeout: 60000 }); } catch { /* pages that poll never go idle */ }
    await page.waitForFunction(() => !document.querySelector('.animate-pulse, [aria-busy="true"]'), { timeout: 20000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 600));
    const r = await page.evaluate(() => {
      const shown = (e) => { const s = getComputedStyle(e); const b = e.getBoundingClientRect(); return s.visibility !== 'hidden' && s.display !== 'none' && b.width > 0 && b.height > 0; };
      const small = [];
      for (const e of document.querySelectorAll('a[href], button, [role=button], [role=tab], [role=radio], [role=checkbox], [role=switch], input:not([type=hidden]), select, textarea, summary')) {
        if (!shown(e) || e.closest('td, th, .sr-only')) continue;
        if (e.matches('input[type=checkbox], input[type=radio]') && e.closest('label')) continue;
        if (e.tagName === 'A' && getComputedStyle(e).display === 'inline' && e.closest('p')) continue;
        const own = e.getBoundingClientRect();
        const box = e.closest('label') && e.matches('[role=checkbox], [role=switch], [role=radio]') ? e.closest('label').getBoundingClientRect() : own;
        if (box.height >= 43.5 && box.width >= 43.5) continue;
        e.scrollIntoView({ block: 'center', inline: 'center' });
        const c = e.getBoundingClientRect();
        const cx = c.left + c.width / 2;
        const cy = c.top + c.height / 2;
        const points = [...(box.height < 43.5 ? [[cx, cy - 21], [cx, cy + 21]] : []), ...(box.width < 43.5 ? [[cx - 21, cy], [cx + 21, cy]] : [])]
          .filter(([x, y]) => x > 0 && y > 0 && x < innerWidth && y < innerHeight);
        const reached = points.every(([x, y]) => { const t = document.elementFromPoint(x, y); return t && (t === e || e.contains(t)); });
        if (!reached) small.push(`${(e.getAttribute('aria-label') || e.innerText || e.getAttribute('placeholder') || e.tagName).trim().replace(/\s+/g, ' ').slice(0, 32)} ${Math.round(box.width)}x${Math.round(box.height)}`);
      }
      const dashes = [...document.body.innerText.matchAll(/.{0,25}[–—].{0,25}/g)].map((m) => m[0]).slice(0, 3);
      return { path: location.pathname, overflow: document.documentElement.scrollWidth - innerWidth, small, dashes };
    });
    if (r.path !== route) continue; // the role is sent elsewhere
    results.push({ role, route, overflow: r.overflow, small: r.small, dashes: r.dashes });
  }
  await context.close();
}
await browser.close();

if (process.env.REPORT) fs.writeFileSync(process.env.REPORT, JSON.stringify(results, null, 2));
const failing = results.filter((x) => x.overflow > 1 || x.small.length || x.dashes.length);
for (const x of failing) console.log(`fail  ${x.role} ${x.route}: ${[x.overflow > 1 ? `overflows by ${x.overflow}px` : '', ...x.small.map((s) => `tap area ${s}`), ...x.dashes.map((d) => `dash in "${d}"`)].filter(Boolean).join('; ')}`);
console.log(`${results.length} pages at ${W} x ${H}: ${failing.length} failing`);
process.exit(failing.length ? 1 : 0);
