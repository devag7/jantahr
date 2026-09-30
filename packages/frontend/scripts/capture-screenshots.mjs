// Captures the product screenshots used by the marketing pages, the website and the README.
//   pnpm --filter jantahr-frontend screenshots
// Needs the web app (WEB, default http://localhost:3000) and API running on a freshly seeded demo company, and a local
// Chrome (CHROME, default the macOS path). Writes to public/marketing/ and ../../website/assets/.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const WEB = process.env.WEB || 'http://localhost:3000';
const API = process.env.API || 'http://localhost:3010';
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const here = path.dirname(fileURLToPath(import.meta.url));
const outDirs = [path.join(here, '../public/marketing'), path.join(here, '../../../website/assets')];

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });

/** A signed-in page: goes through the real sign-in form, so it works with any Supabase Auth backend. */
async function signedIn(email, password, width, height) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 2 });
  await page.goto(`${WEB}/login`, { waitUntil: 'networkidle0' });
  await page.type('#email', email);
  await page.type('#password', password);
  await page.click('form button[type=submit]');
  await page.waitForFunction(() => /Good (morning|afternoon|evening)/.test(document.body.innerText), { timeout: 60000 });
  return page;
}

/** Waits until the page shows `text` and every skeleton is gone, so no placeholder ends up in the image. */
async function capture(page, url, text, name) {
  if (url) await page.goto(`${WEB}${url}`, { waitUntil: 'networkidle0' });
  await page.waitForFunction((t) => document.body.innerText.includes(t), { timeout: 60000 }, text);
  // loaded = no skeleton placeholders left (the app polls, so the network is never fully idle)
  await page.waitForFunction(() => !document.querySelector('.animate-pulse, [aria-busy="true"]'), { timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1200));
  await page.evaluate(() => document.fonts.ready);
  const image = await page.screenshot({ type: 'webp', quality: 82 });
  if (image.length < 30_000) throw new Error(`${name}: image looks empty (${image.length} bytes)`);
  for (const dir of outDirs) fs.writeFileSync(path.join(dir, `${name}.webp`), image);
  console.log(`  ${name}.webp ${Math.round(image.length / 1024)} KB`);
}

const hr = await signedIn('hr@jantahr.com', 'Demo@1234', 1440, 900);
await capture(hr, '/dashboard', 'Statutory deadlines', 'overview');
await capture(hr, '/hr/compliance', 'Compliance calendar', 'compliance');

const payroll = await signedIn('payroll@jantahr.com', 'Demo@1234', 1200, 750);
await payroll.goto(`${WEB}/hr/payroll`, { waitUntil: 'networkidle0' });
await payroll.waitForSelector('tbody tr', { timeout: 60000 });
await Promise.all([payroll.waitForFunction(() => location.pathname.startsWith('/hr/payroll/runs/'), { timeout: 60000 }), payroll.click('tbody tr')]);
await capture(payroll, null, 'Net pay', 'payroll');

const phone = await signedIn('employee@jantahr.com', 'Demo@1234', 390, 780);
await capture(phone, '/dashboard', 'Vikram', 'mobile');
await browser.close();
console.log('done');
