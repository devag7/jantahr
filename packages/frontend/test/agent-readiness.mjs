// End-to-end checks of what AI agents and crawlers read on the cloud edition's public site: Markdown negotiation,
// the Markdown 404, llms.txt, the sitemap, robots.txt, page metadata, JSON-LD and the MCP server.
// Run against a built app:  NEXT_PUBLIC_EDITION=cloud npm run build && PORT=3111 npm start &
//                           BASE=http://localhost:3111 npm run test:agents
import assert from 'node:assert/strict';

const BASE = (process.env.BASE || 'http://localhost:3000').replace(/\/+$/, '');
const PAGES = ['/', '/pricing', '/self-hosting', '/developers', '/about', '/contact', '/legal/terms', '/legal/privacy', '/legal/refunds', '/legal/shipping'];
let failed = 0;

async function check(name, fn) {
  try { await fn(); console.log(`ok    ${name}`); } catch (e) { failed += 1; console.log(`FAIL  ${name}\n      ${String(e.message).split('\n').join('\n      ')}`); }
}
const get = (path, accept, init = {}) => fetch(`${BASE}${path}`, { redirect: 'follow', ...init, headers: { ...(accept ? { accept } : {}), ...init.headers } });
const type = (res) => (res.headers.get('content-type') ?? '').toLowerCase();
const varies = (res) => (res.headers.get('vary') ?? '').toLowerCase().split(',').map((s) => s.trim()).includes('accept');
const rpc = (path, body) => fetch(`${BASE}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) });

await check('home: Accept: text/markdown gets Markdown with Vary: Accept', async () => {
  const res = await get('/', 'text/markdown');
  const body = await res.text();
  assert.equal(res.status, 200);
  assert.ok(type(res).startsWith('text/markdown'), `content-type ${type(res)}`);
  assert.ok(varies(res), `vary ${res.headers.get('vary')}`);
  assert.match(body, /^# Payroll that keeps up with Indian law\./);
  assert.ok(!/<\/?(div|section|script|p)\b/i.test(body), 'HTML left in the Markdown');
  assert.match(body, /\[Start free trial\]\([^)]*\/signup\)/);
});

await check('home: Accept: text/html still gets HTML', async () => {
  const res = await get('/', 'text/html');
  assert.equal(res.status, 200);
  assert.ok(type(res).startsWith('text/html'), `content-type ${type(res)}`);
  assert.match(await res.text(), /<!DOCTYPE html>/i);
  // `next start` writes its own Vary over the middleware's, so this half is enforced only where asked (the deployed site)
  if (!varies(res)) { if (process.env.STRICT_VARY) assert.fail(`vary ${res.headers.get('vary')}`); console.log(`note  HTML response does not list Accept in Vary here: ${res.headers.get('vary')}`); }
});

await check('home: a browser Accept header gets HTML', async () => {
  const res = await get('/', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8');
  assert.ok(type(res).startsWith('text/html'));
});

await check('home: canonical, lang, og:image, og:type and a title that names the product', async () => {
  const html = await (await get('/', 'text/html')).text();
  assert.match(html, /<html[^>]*\blang="en"/);
  assert.match(html, /<link rel="canonical" href="https?:\/\/[^"]+\/?"/);
  assert.match(html, /<meta property="og:type" content="website"/);
  assert.match(html, /<meta property="og:image" content="https?:\/\/[^"]+overview\.webp"/);
  assert.match(html, /<title>JantaHR: HR and payroll software for India<\/title>/);
});

await check('home: JSON-LD with Organization (contactPoint) and SoftwareApplication (offers)', async () => {
  const html = await (await get('/', 'text/html')).text();
  const raw = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html);
  assert.ok(raw, 'no JSON-LD script');
  const data = JSON.parse(raw[1]);
  assert.equal(data['@context'], 'https://schema.org');
  const org = data['@graph'].find((n) => n['@type'] === 'Organization');
  const app = data['@graph'].find((n) => n['@type'] === 'SoftwareApplication');
  assert.ok(org.name && org.url && org.description);
  assert.ok(org.contactPoint.email && org.contactPoint.contactType);
  assert.ok(app.name && app.description && app.url && app.offers.length >= 2);
  assert.ok(app.offers.every((o) => o.priceCurrency === 'INR' && /^\d+\.\d\d$/.test(o.price)));
  if (process.env.EXPECT_ADDRESS) assert.equal(org.address['@type'], 'PostalAddress');
});

await check('404: Markdown body with the 404 status when Markdown is asked for', async () => {
  const res = await get('/__agent-404-probe-x1', 'text/markdown');
  const body = await res.text();
  assert.equal(res.status, 404);
  assert.ok(type(res).startsWith('text/markdown'), `content-type ${type(res)}`);
  assert.ok(varies(res), `vary ${res.headers.get('vary')}`);
  assert.ok(body.length >= 20);
  assert.match(body, /\/llms\.txt\)/);
  assert.match(body, /\/sitemap\.xml\)/);
});

await check('404: HTML page with the 404 status for everyone else', async () => {
  const res = await get('/__agent-404-probe-x1', 'text/html');
  assert.equal(res.status, 404);
  assert.ok(type(res).startsWith('text/html'));
});

for (const path of PAGES) {
  await check(`${path}: HTML and Markdown versions`, async () => {
    const html = await get(path, 'text/html');
    assert.equal(html.status, 200);
    assert.ok(type(html).startsWith('text/html'));
    const md = await get(path, 'text/markdown');
    const body = await md.text();
    assert.equal(md.status, 200);
    assert.ok(type(md).startsWith('text/markdown'), `content-type ${type(md)}`);
    assert.match(body, /^# \S/);
    assert.ok(body.length >= 500, `only ${body.length} characters`);
  });
}

await check('app pages are untouched: /login answers a Markdown request with its usual HTML', async () => {
  const res = await get('/login', 'text/markdown');
  assert.equal(res.status, 200);
  assert.ok(type(res).startsWith('text/html'));
});

await check('/llms.txt: summary, when-to-use guidance and links', async () => {
  const res = await get('/llms.txt');
  const body = await res.text();
  assert.equal(res.status, 200);
  assert.ok(/^text\/(markdown|plain)/.test(type(res)));
  assert.match(body, /^# JantaHR\n\n> /);
  for (const heading of ['## When to use JantaHR', '## When not to use JantaHR', '## How an agent should use JantaHR', '## Developer resources', '## Optional']) assert.ok(body.includes(heading), `missing ${heading}`);
  assert.match(body, /\/mcp\b/);
  assert.match(body, /- \[JantaHR pricing\]\(https?:\/\/[^)]+\/pricing\): /);
});

await check('/sitemap.xml: every public page with a lastmod date', async () => {
  const res = await get('/sitemap.xml');
  const body = await res.text();
  assert.equal(res.status, 200);
  assert.ok(type(res).includes('xml'), `content-type ${type(res)}`);
  assert.match(body, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/);
  const locs = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  assert.deepEqual(locs.sort(), [...PAGES].sort());
  assert.equal([...body.matchAll(/<lastmod>\d{4}-\d\d-\d\dT[^<]+<\/lastmod>/g)].length, PAGES.length);
});

await check('/robots.txt: allows crawling, keeps the API out, names the sitemap', async () => {
  const body = await (await get('/robots.txt')).text();
  assert.match(body, /User-Agent: \*/i);
  assert.match(body, /Disallow: \/api\//);
  assert.match(body, /Sitemap: https?:\/\/\S+\/sitemap\.xml/);
});

await check('/.well-known/mcp: discovery document', async () => {
  for (const path of ['/.well-known/mcp', '/.well-known/mcp/server-card.json']) {
    const res = await get(path, 'application/json');
    assert.equal(res.status, 200);
    assert.ok(type(res).startsWith('application/json'));
    const card = await res.json();
    assert.equal(card.transport.type, 'streamable-http');
    assert.match(card.transport.endpoint, /\/mcp$/);
    assert.ok(card.tools.some((t) => t.name === 'get_plans'));
  }
});

for (const endpoint of ['/mcp', '/.well-known/mcp']) {
  await check(`MCP handshake at ${endpoint}: initialize, initialized, tools/list, tools/call`, async () => {
    const init = await rpc(endpoint, { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'agent-readiness', version: '1.0.0' } } });
    assert.equal(init.status, 200);
    assert.ok(type(init).startsWith('application/json'));
    const hello = await init.json();
    assert.equal(hello.result.protocolVersion, '2025-06-18');
    assert.equal(hello.result.serverInfo.name, 'jantahr');
    assert.ok(hello.result.capabilities.tools);
    const ready = await rpc(endpoint, { jsonrpc: '2.0', method: 'notifications/initialized' });
    assert.equal(ready.status, 202);
    assert.equal(await ready.text(), '');
    const tools = (await (await rpc(endpoint, { jsonrpc: '2.0', id: 2, method: 'tools/list' })).json()).result.tools;
    assert.deepEqual(tools.map((t) => t.name).sort(), ['get_contact', 'get_page', 'get_plans', 'list_pages']);
    const plans = (await (await rpc(endpoint, { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'get_plans', arguments: {} } })).json()).result;
    assert.equal(plans.isError, false);
    assert.match(plans.content[0].text, /\*\*Standard\*\* \(₹59 per employee a month/);
  });
}

await check('MCP: get_page returns a page as Markdown and refuses anything else', async () => {
  const page = (await (await rpc('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'get_page', arguments: { path: '/pricing' } } })).json()).result;
  assert.equal(page.isError, false);
  assert.match(page.content[0].text, /^# Pay per employee\./);
  for (const path of ['/dashboard', 'https://example.com/', '//example.com/x', '/api/health']) {
    const refused = (await (await rpc('/mcp', { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'get_page', arguments: { path } } })).json()).result;
    assert.equal(refused.isError, true, `served ${path}`);
  }
});

await check('MCP: no event stream on GET (405), parse errors answered as JSON-RPC', async () => {
  const stream = await get('/mcp', 'text/event-stream');
  assert.equal(stream.status, 405);
  assert.match(stream.headers.get('allow') ?? '', /POST/);
  const bad = await fetch(`${BASE}/mcp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{not json' });
  assert.equal(bad.status, 400);
  assert.equal((await bad.json()).error.code, -32700);
});

console.log(failed ? `\n${failed} check(s) failed` : '\nAll agent-readiness checks passed');
process.exit(failed ? 1 : 0);
