// End-to-end checks of the public site's UI as served (HTML and CSS, no browser): the landing page's sections,
// image loading, share cards, the pricing comparison, the contact form, the 404 and per-page metadata.
// Run against a built cloud edition:  BASE=http://localhost:3111 npm run test:site
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const BASE = (process.env.BASE || 'http://localhost:3000').replace(/\/+$/, '');
const PAGES = ['/', '/pricing', '/self-hosting', '/developers', '/about', '/contact', '/legal/terms', '/legal/privacy', '/legal/refunds', '/legal/shipping', '/legal/delete-account'];
const PLANS = readFileSync(new URL('../src/lib/plans/plans.generated.ts', import.meta.url), 'utf8');
let failed = 0;

async function check(name, fn) {
  try { await fn(); console.log(`ok    ${name}`); } catch (e) { failed += 1; console.log(`FAIL  ${name}\n      ${String(e.message).split('\n').slice(0, 6).join('\n      ')}`); }
}
const html = async (path) => { const r = await fetch(`${BASE}${path}`, { headers: { accept: 'text/html' } }); return { status: r.status, body: await r.text() }; };
const count = (s, re) => (s.match(re) ?? []).length;
const jsonLd = (body) => [...body.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
const unescape = (s) => s.replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

const home = (await html('/')).body;

await check('home: product tour is an accessible tab list of four views', async () => {
  assert.match(home, /role="tablist"[^>]*aria-label="Product tour"/);
  for (const label of ['Overview', 'Payroll', 'Compliance', 'Mobile']) assert.match(home, new RegExp(`role="tab"[^>]*>${label}<`));
});

await check('home: only the first tour image is in the HTML, eager and high priority, with a srcset', async () => {
  const tour = home.slice(home.indexOf('aria-label="Product tour"'), home.indexOf('aria-label="At a glance"'));
  const imgs = tour.match(/<img [^>]+>/g) ?? [];
  assert.equal(imgs.length, 1, `${imgs.length} images server-rendered in the tour`);
  assert.match(imgs[0], /fetchpriority="high"|fetchPriority="high"/i);
  assert.match(imgs[0], /srcset="\/marketing\/overview-640\.webp 640w/i);
});

await check('home: every screenshot below the fold is lazy and has a srcset and alt text', async () => {
  const rest = home.slice(home.indexOf('aria-label="At a glance"'));
  const imgs = rest.match(/<img [^>]+>/g) ?? [];
  assert.ok(imgs.length >= 4, `${imgs.length} images`);
  for (const img of imgs) {
    assert.match(img, /loading="lazy"/);
    assert.match(img, /srcset="/i);
    assert.match(img, /alt="[^"]{20,}"/);
    assert.match(img, /width="\d+"[^>]*height="\d+"|height="\d+"[^>]*width="\d+"/);
  }
});

await check('home: trust strip has four plain facts and the rules date matches the law section', async () => {
  const strip = home.slice(home.indexOf('aria-label="At a glance"'), home.indexOf('id="compliance"'));
  assert.equal(count(strip, /<li /g), 4);
  const date = /Rules current to ([A-Z][a-z]+ \d{4})/.exec(strip)?.[1];
  assert.ok(date, 'no rules date');
  assert.ok(home.includes(`notified up to <!-- -->${date}`) || home.includes(`notified up to ${date}`), 'law section shows a different date');
});

await check('home: one module cell per gated module, labelled with a plan that exists', async () => {
  const grid = home.slice(home.indexOf('id="modules"'), home.indexOf('From sign-up to payslips'));
  assert.equal(count(grid, /<li /g), 6);
  for (const m of grid.matchAll(/([A-Z][a-z]+) plan and above/g)) assert.ok(PLANS.includes(`"name": "${m[1]}"`), `${m[1]} is not a plan`);
  assert.match(grid, /Every plan, including Free/);
});

await check('home: steps are named by their verbs, with no "Step 1" labels', async () => {
  for (const s of ['Create your workspace', 'Import employees', 'Run payroll']) assert.ok(home.includes(s), s);
  assert.doesNotMatch(home, /Step \d/);
});

await check('home: FAQPage JSON-LD lists exactly the questions shown on the page', async () => {
  const faq = jsonLd(home).find((d) => d['@type'] === 'FAQPage');
  assert.ok(faq, 'no FAQPage');
  assert.equal(faq.mainEntity.length, 5);
  for (const q of faq.mainEntity) assert.ok(unescape(home).includes(q.name), `"${q.name}" is not on the page`);
});

await check('home: pricing teaser shows the catalogue prices', async () => {
  for (const [name, paise] of [...PLANS.matchAll(/"name": "(\w+)"[\s\S]*?"ANNUAL": (\d+)/g)].map((m) => [m[1], Number(m[2])])) {
    if (paise > 0) assert.ok(home.includes(`₹${Math.round(paise / 100)}`), `${name} price missing`);
  }
});

await check('CSS: the scroll reveal never hides a screenshot (no opacity in its keyframes)', async () => {
  const css = await Promise.all([...home.matchAll(/href="(\/_next\/static\/css\/[^"]+\.css)"/g)].map((m) => fetch(`${BASE}${m[1]}`).then((r) => r.text())));
  const reveal = /@keyframes jh-reveal\s*\{([\s\S]*?)\}\s*\}/.exec(css.join('\n'))?.[1];
  assert.ok(reveal, 'jh-reveal keyframes not found');
  assert.doesNotMatch(reveal, /opacity/);
});

await check('footer: the email is one link that may wrap only as a last resort', async () => {
  const footer = home.slice(home.lastIndexOf('<footer'));
  assert.doesNotMatch(footer, /break-all/);
  assert.match(footer, /href="mailto:[^"]+"[^>]*class="[^"]*\[overflow-wrap:anywhere\]/);
});

await check('nav: the current page is marked and phones get a menu button', async () => {
  const { body } = await html('/pricing');
  assert.match(body, /aria-current="page"[^>]*href="\/pricing"|href="\/pricing"[^>]*aria-current="page"/);
  assert.match(body, /aria-label="Open menu"/);
});

await check('pricing: comparison is a table with scoped headers, plus per-plan cards for phones', async () => {
  const { body } = await html('/pricing');
  assert.match(body, /<caption class="sr-only">Features in each plan<\/caption>/);
  assert.ok(count(body, /<th scope="col"/g) >= 5);
  assert.ok(count(body, /aria-label="\w+ plan"/g) >= 4);
  assert.match(body, /id="employees"[^>]*inputMode="numeric"|inputMode="numeric"[^>]*id="employees"/i);
});

await check('contact: a form with labelled fields in order and a hidden honeypot', async () => {
  const { body } = await html('/contact');
  const ids = [...body.matchAll(/<label[^>]*for="contact-(\w+)"/g)].map((m) => m[1]);
  assert.deepEqual(ids, ['name', 'email', 'company', 'phone', 'topic', 'message', 'website']);
  assert.match(body, /aria-hidden="true" class="absolute left-\[-9999px\]/);
  assert.match(body, /href="\/legal\/privacy"/);
});

await check('404: status 404, branded, with the ways back', async () => {
  const { status, body } = await html('/no-such-page-anywhere');
  assert.equal(status, 404);
  assert.match(body, /This page does not exist\./);
  for (const href of ['/', '/pricing', '/login']) assert.match(body, new RegExp(`href="${href}"`));
  assert.match(body, /name="robots" content="noindex/);
});

await check('long-form pages: 70 character measure and underlined inline links', async () => {
  for (const path of ['/legal/terms', '/about', '/developers']) {
    const { body } = await html(path);
    assert.match(body, /<article class="mx-auto max-w-\[70ch\]/, path);
    assert.doesNotMatch(body.slice(body.indexOf('<article'), body.indexOf('</article>')), /class="text-primary hover:underline"/, path);
  }
});

await check('metadata: every public page has its own title and description', async () => {
  const seen = { title: new Set(), description: new Set() };
  for (const path of PAGES) {
    const { body } = await html(path);
    const title = /<title>([^<]+)<\/title>/.exec(body)?.[1];
    const description = /<meta name="description" content="([^"]+)"/.exec(body)?.[1];
    assert.ok(title && description, `${path} lacks a title or description`);
    assert.ok(!seen.title.has(title), `${path} repeats the title "${title}"`);
    assert.ok(!seen.description.has(description), `${path} repeats its description`);
    seen.title.add(title); seen.description.add(description);
  }
});

await check('share cards: / and /pricing have their own 1200 x 630 PNG', async () => {
  const urls = [];
  for (const path of ['/', '/pricing']) {
    const { body } = await html(path);
    const url = unescape(/<meta property="og:image" content="([^"]+)"/.exec(body)?.[1] ?? '');
    assert.ok(url, `${path} has no og:image`);
    urls.push(url);
    const png = Buffer.from(await (await fetch(url.replace(/^https?:\/\/[^/]+/, BASE))).arrayBuffer());
    assert.equal(png.subarray(1, 4).toString(), 'PNG', `${path} share image is not a PNG`);
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1200, 630]);
  }
  assert.notEqual(urls[0], urls[1]);
});

console.log(failed ? `\n${failed} check(s) failed` : '\nAll site UI checks passed');
process.exit(failed ? 1 : 0);
