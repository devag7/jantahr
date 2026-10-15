// Captures every marketing page and the main product screens at 1440, 1024 and 390 wide, in light and dark, and
// reports horizontal overflow and console errors for each. Used for docs/ui-audit.md (before/after pairs).
//   OUT=/tmp/ui-before node scripts/ui-screens.mjs
// Needs the web app (WEB, default http://localhost:3000, cloud edition) and the API on a freshly seeded demo company,
// and a local Chrome (CHROME). ONLY=marketing|product limits the run; WIDTHS=390 or THEMES=light narrows it.
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const WEB = process.env.WEB || 'http://localhost:3000';
const API = process.env.API || 'http://localhost:3002';
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = process.env.OUT || 'ui-screens';
// the seed's demo passwords
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@123';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'Demo@1234';
const WIDTHS = (process.env.WIDTHS || '1440,1024,390').split(',').map(Number);
const THEMES = (process.env.THEMES || 'light,dark').split(',');
const ONLY = process.env.ONLY || '';
fs.mkdirSync(OUT, { recursive: true });

const MARKETING = [
  ['home', '/'], ['pricing', '/pricing'], ['self-hosting', '/self-hosting'], ['developers', '/developers'], ['about', '/about'],
  ['contact', '/contact'], ['terms', '/legal/terms'], ['privacy', '/legal/privacy'], ['refunds', '/legal/refunds'],
  ['shipping', '/legal/shipping'], ['not-found', '/this-page-does-not-exist'],
];

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
const report = [];

async function newPage(context, theme) {
  const page = await context.newPage();
  await page.evaluateOnNewDocument((t) => {
    try { localStorage.setItem('jantahr:tour:off', '1'); localStorage.setItem('theme', t); } catch { /* opaque origin */ }
  }, theme);
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }]);
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${String(e.message).slice(0, 300)}`));
  return { page, errors };
}

/** Elements that reach past the right edge of the viewport: the cause of horizontal scrolling. */
const overflowProbe = () => {
  const width = document.documentElement.clientWidth;
  const culprits = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width && r.right > width + 1 && getComputedStyle(el).position !== 'fixed') {
      // report the outermost offender only
      if (!culprits.some((c) => c.el.contains(el))) culprits.push({ el, right: Math.round(r.right) });
    }
  }
  return {
    scrollWidth: document.documentElement.scrollWidth, width,
    culprits: culprits.slice(0, 6).map(({ el, right }) => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).slice(0, 4).join('.') : ''} right=${right} "${(el.innerText || '').trim().slice(0, 40)}"`),
  };
};

async function shoot({ page, errors }, name, url, width, theme, waitText) {
  errors.length = 0;
  await page.setViewport({ width, height: width < 640 ? 844 : 900, deviceScaleFactor: 1 });
  await page.goto(`${WEB}${url}`, { waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {});
  if (waitText) await page.waitForFunction((t) => document.body.innerText.includes(t), { timeout: 20000 }, waitText).catch(() => errors.push(`never showed "${waitText}"`));
  await page.waitForFunction(() => !document.querySelector('.animate-pulse, [aria-busy="true"]'), { timeout: 15000 }).catch(() => errors.push('skeletons still showing after 15s'));
  await page.evaluate(() => document.fonts.ready);
  // scroll through once so lazy images load and scroll-driven animations finish, then back to the top
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += Math.round(innerHeight * 0.8)) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); }
    scrollTo(0, 0);
  });
  await new Promise((r) => setTimeout(r, 900));
  const overflow = await page.evaluate(overflowProbe);
  const file = `${name}-${width}-${theme}.webp`;
  await page.screenshot({ path: path.join(OUT, file), type: 'webp', quality: 60, fullPage: true, captureBeyondViewport: true });
  const entry = { name, url, width, theme, file, overflow: overflow.scrollWidth > overflow.width ? overflow : null, errors: [...errors] };
  report.push(entry);
  console.log(`${file}${entry.overflow ? `  OVERFLOW ${overflow.scrollWidth}>${overflow.width}` : ''}${errors.length ? `  ${errors.length} console error(s)` : ''}`);
}

async function signIn(context, theme, email, password) {
  const tab = await newPage(context, theme);
  await tab.page.setViewport({ width: 1440, height: 900 });
  await tab.page.goto(`${WEB}/login`, { waitUntil: 'networkidle2' });
  await tab.page.type('#email', email);
  await tab.page.type('#password', password);
  await tab.page.click('form button[type=submit]');
  await tab.page.waitForFunction(() => location.pathname.startsWith('/dashboard'), { timeout: 60000 });
  return tab;
}

/** Ids for the detail screens (an employee and a payroll run of the demo company): EMPLOYEE_ID and RUN_ID. */
const ids = { employee: process.env.EMPLOYEE_ID, run: process.env.RUN_ID };

for (const theme of THEMES) {
  if (ONLY !== 'product') {
    const context = await browser.createBrowserContext();
    const tab = await newPage(context, theme);
    for (const [name, url] of MARKETING) for (const w of WIDTHS) await shoot(tab, `m-${name}`, url, w, theme);
    await context.close();
  }
  if (ONLY !== 'marketing') {
    const admin = await signIn(await browser.createBrowserContext(), theme, 'admin@jantahr.com', ADMIN_PASSWORD);
    if (!ids.run) {
      // the latest payroll run: open it the way a person would, from the runs list
      await admin.page.goto(`${WEB}/hr/payroll`, { waitUntil: 'networkidle2' });
      await admin.page.waitForSelector('tbody tr', { timeout: 30000 }).catch(() => {});
      await Promise.all([admin.page.waitForFunction(() => location.pathname.startsWith('/hr/payroll/runs/'), { timeout: 30000 }).catch(() => {}), admin.page.click('tbody tr').catch(() => {})]);
      ids.run = await admin.page.evaluate(() => location.pathname.split('/runs/')[1]);
    }
    const PRODUCT = [
      ['dashboard', '/dashboard', 'Good'], ['employees', '/hr/employees', 'Employees'],
      ...(ids.employee ? [['employee-detail', `/hr/employees/${ids.employee}`, '']] : []),
      ['attendance', '/hr/attendance', 'Attendance'], ['leave', '/hr/leave', 'Leave'], ['payroll', '/hr/payroll', 'Payroll'],
      ...(ids.run ? [['payroll-run', `/hr/payroll/runs/${ids.run}`, 'Net pay']] : []),
      ['payroll-setup', '/hr/payroll/setup', ''], ['compliance', '/hr/compliance', 'Compliance'], ['approvals', '/approvals', 'Approvals'],
      ['settings', '/hr/settings', 'Settings'], ['billing', '/hr/billing', 'Billing'],
    ];
    for (const [name, url, text] of PRODUCT) for (const w of WIDTHS) await shoot(admin, `p-${name}`, url, w, theme, text);
    const employee = await signIn(await browser.createBrowserContext(), theme, 'employee@jantahr.com', DEMO_PASSWORD);
    for (const [name, url, text] of [['ess-dashboard', '/dashboard', 'Good'], ['payslips', '/me/payslips', 'Payslips']]) {
      for (const w of WIDTHS) await shoot(employee, `p-${name}`, url, w, theme, text);
    }
  }
}

fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
await browser.close();
console.log(`\n${report.length} screenshots, ${report.filter((r) => r.overflow).length} with horizontal overflow, ${report.filter((r) => r.errors.length).length} with console errors`);
