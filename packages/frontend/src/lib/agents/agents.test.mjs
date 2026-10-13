// Unit tests for the agent-facing helpers. Run with `npm test` (Node's own runner; the .ts files have no imports).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { htmlToMarkdown } from './html-to-markdown.ts';
import { buildJsonLd, jsonLdScript } from './json-ld.ts';
import { handleMcpMessage, handleMcpPayload, mcpServerCard } from './mcp.ts';
import { prefersMarkdown, varyAccept } from './negotiate.ts';

test('prefersMarkdown: only when Markdown is named and ranks at least as high as HTML', () => {
  assert.equal(prefersMarkdown('text/markdown'), true);
  assert.equal(prefersMarkdown('text/markdown, text/html;q=0.9, */*;q=0.1'), true);
  assert.equal(prefersMarkdown('text/html;q=0.8, Text/Markdown;q=0.8'), true);
  assert.equal(prefersMarkdown('text/html, text/markdown;q=0.5'), false);
  assert.equal(prefersMarkdown('text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'), false);
  assert.equal(prefersMarkdown('*/*'), false);
  assert.equal(prefersMarkdown('text/markdown;q=0'), false);
  assert.equal(prefersMarkdown(''), false);
  assert.equal(prefersMarkdown(null), false);
});

test('varyAccept: adds Accept once and keeps what is there', () => {
  assert.equal(varyAccept(null), 'Accept');
  assert.equal(varyAccept('RSC, Next-Router-State-Tree'), 'RSC, Next-Router-State-Tree, Accept');
  assert.equal(varyAccept('accept, RSC'), 'accept, RSC');
  assert.equal(varyAccept('*'), '*');
});

test('htmlToMarkdown: keeps <main>, drops chrome, scripts and decoration', () => {
  const md = htmlToMarkdown(`<html><body><header><nav><a href="/login">Sign in</a></nav></header>
    <main><h1 class="x">Payroll that keeps up<br class="hidden"/> with Indian law.</h1>
    <p>PF, ESI &amp; TDS<!-- --> every month.</p><script>alert(1)</script>
    <span aria-hidden="true">+<span>nested</span></span><svg aria-hidden="true"><path/></svg></main>
    <footer>Copyright</footer></body></html>`);
  assert.equal(md, '# Payroll that keeps up with Indian law.\n\nPF, ESI & TDS every month.\n');
});

test('htmlToMarkdown: links, images, lists, code and definition lists', () => {
  const md = htmlToMarkdown(`<main><h2>Three steps.</h2>
    <p>See <a class="c" href="/pricing">pricing</a> or <a href="mailto:a@b.in">write</a>. Back up <code>KEY</code>.</p>
    <img alt="Overview" src="/marketing/overview.webp" width="10"/>
    <ul><li>One</li><li><strong>Two</strong></li></ul>
    <ol><li><p>First</p><pre><code>cd deploy
./jantahr.sh up  # web</code></pre></li><li>Second</li></ol>
    <dl><div><dt>Email</dt><dd><a href="mailto:x@y.in">x@y.in</a></dd></div></dl></main>`, { baseUrl: 'https://example.in/self-hosting' });
  assert.match(md, /^## Three steps\.$/m);
  assert.match(md, /See \[pricing\]\(https:\/\/example\.in\/pricing\) or \[write\]\(mailto:a@b\.in\)\. Back up `KEY`\./);
  assert.match(md, /!\[Overview\]\(https:\/\/example\.in\/marketing\/overview\.webp\)/);
  assert.match(md, /\)\n\n- One\n- \*\*Two\*\*\n\n1\. First/);
  assert.match(md, /^1\. First\n\n```\ncd deploy\n\.\/jantahr\.sh up {2}# web\n```/m);
  assert.match(md, /^2\. Second$/m);
  assert.match(md, /^2\. Second\n\n- \*\*Email\*\*: \[x@y\.in\]\(mailto:x@y\.in\)$/m);
});

test('htmlToMarkdown: text that only CSS keeps apart, controls and awkward link targets', () => {
  const md = htmlToMarkdown(`<main><p><span>₹49</span><span class="ml-1">per employee a month</span></p>
    <div><button role="radio">Monthly</button><button role="radio">Yearly</button></div>
    <div><a href="/signup">Start free trial</a><a href="/pricing">See pricing</a></div>
    <a href="mailto:sales@x.in?subject=JantaHR Enterprise">Contact sales</a>
    <ol><li><p>1. Get the code</p></li><li><p>2. Start</p></li></ol></main>`);
  assert.match(md, /^₹49 per employee a month$/m);
  assert.equal(/Monthly|Yearly/.test(md), false);
  assert.match(md, /^\[Start free trial\]\(\/signup\) \[See pricing\]\(\/pricing\)$/m);
  assert.match(md, /\[Contact sales\]\(mailto:sales@x\.in\?subject=JantaHR%20Enterprise\)/);
  assert.match(md, /^1\. Get the code\n2\. Start$/m);
});

test('htmlToMarkdown: tables, labelled icons and disclosure headings', () => {
  const md = htmlToMarkdown(`<main><details><summary>Compare<span aria-hidden="true">+</span></summary>
    <table><thead><tr><th>Feature</th><th>Free</th><th>Standard</th></tr></thead>
    <tbody><tr><td>Payroll</td><td><span class="sr-only">Not included</span></td><td><svg aria-label="Included"><path/></svg></td></tr></tbody></table></details></main>`);
  assert.match(md, /^\*\*Compare\*\*\n\n\| Feature/m);
  assert.match(md, /\| Feature \| Free \| Standard \|\n\| --- \| --- \| --- \|\n\| Payroll \| Not included \| Included \|/);
});

const jsonLdInput = {
  siteUrl: 'https://hr.example.in', description: 'HR and payroll', repoUrl: 'https://github.com/x/y', image: '/marketing/overview.webp',
  operator: { name: 'JantaHR', address: '', email: 'sales@example.in', phone: '', gstin: '' },
  plans: [{ name: 'Free', summary: 'Core', pricePaise: { MONTHLY: 0, ANNUAL: 0 } }, { name: 'Standard', summary: 'Payroll', pricePaise: { MONTHLY: 5900, ANNUAL: 4900 } }, { name: 'Enterprise', summary: 'Custom', pricePaise: null }],
};

test('buildJsonLd: organisation, site and product, with prices from the plans', () => {
  const graph = buildJsonLd(jsonLdInput)['@graph'];
  const [org, site, app] = graph;
  assert.deepEqual(graph.map((n) => n['@type']), ['Organization', 'WebSite', 'SoftwareApplication']);
  assert.equal(org.url, 'https://hr.example.in/');
  assert.equal(org.contactPoint.email, 'sales@example.in');
  assert.equal(org.contactPoint.contactType, 'customer support');
  assert.equal(site.publisher['@id'], org['@id']);
  assert.deepEqual(app.offers.map((o) => [o.name, o.price, o.priceCurrency]), [['Free', '0.00', 'INR'], ['Standard', '59.00', 'INR']]);
});

test('buildJsonLd: address, phone and GSTIN appear only when the deployment sets them', () => {
  const bare = buildJsonLd(jsonLdInput)['@graph'][0];
  assert.equal('address' in bare, false);
  assert.equal('telephone' in bare, false);
  assert.equal('taxID' in bare, false);
  assert.equal('legalName' in bare, false);
  const full = buildJsonLd({ ...jsonLdInput, operator: { name: 'Janta Software LLP', address: '1 MG Road, Bengaluru 560001', email: 'a@b.in', phone: '+91 80 0000 0000', gstin: '29ABCDE1234F1Z5' } })['@graph'][0];
  assert.deepEqual(full.address, { '@type': 'PostalAddress', streetAddress: '1 MG Road, Bengaluru 560001', addressCountry: 'IN' });
  assert.equal(full.contactPoint.telephone, '+91 80 0000 0000');
  assert.equal(full.legalName, 'Janta Software LLP');
});

test('jsonLdScript: a value cannot close the script tag', () => {
  const out = jsonLdScript({ name: '</script><script>alert(1)</script>' });
  assert.equal(out.includes('<'), false);
  assert.equal(JSON.parse(out).name, '</script><script>alert(1)</script>');
});

const server = {
  info: { name: 'jantahr', title: 'JantaHR', version: '1.0.0' },
  instructions: 'Read-only.',
  tools: [
    { name: 'echo', title: 'Echo', description: 'Returns its input.', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] }, call: (a) => `you said ${a.text}` },
    { name: 'boom', title: 'Boom', description: 'Always fails.', inputSchema: { type: 'object', properties: {} }, call: () => { throw new Error('No such page'); } },
  ],
};
const rpc = (method, params, id = 1) => ({ jsonrpc: '2.0', id, method, ...(params ? { params } : {}) });

test('MCP: initialize agrees a protocol version and declares tools', async () => {
  const known = await handleMcpMessage(rpc('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 't', version: '1' } }), server);
  assert.equal(known.result.protocolVersion, '2025-03-26');
  assert.deepEqual(known.result.capabilities, { tools: { listChanged: false } });
  assert.equal(known.result.serverInfo.name, 'jantahr');
  const unknown = await handleMcpMessage(rpc('initialize', { protocolVersion: '1999-01-01' }), server);
  assert.equal(unknown.result.protocolVersion, '2025-06-18');
});

test('MCP: tools/list and tools/call', async () => {
  const list = await handleMcpMessage(rpc('tools/list'), server);
  assert.deepEqual(list.result.tools.map((t) => t.name), ['echo', 'boom']);
  assert.equal(list.result.tools[0].inputSchema.type, 'object');
  assert.equal('call' in list.result.tools[0], false);
  const ok = await handleMcpMessage(rpc('tools/call', { name: 'echo', arguments: { text: 'hi' } }, 'a'), server);
  assert.deepEqual(ok, { jsonrpc: '2.0', id: 'a', result: { content: [{ type: 'text', text: 'you said hi' }], isError: false } });
  const missing = await handleMcpMessage(rpc('tools/call', { name: 'echo', arguments: {} }), server);
  assert.equal(missing.result.isError, true);
  const failed = await handleMcpMessage(rpc('tools/call', { name: 'boom' }), server);
  assert.deepEqual(failed.result, { content: [{ type: 'text', text: 'No such page' }], isError: true });
  const none = await handleMcpMessage(rpc('tools/call', { name: 'nope' }), server);
  assert.equal(none.error.code, -32602);
});

test('MCP: errors, notifications and batches follow JSON-RPC', async () => {
  assert.equal((await handleMcpMessage(rpc('resources/list'), server)).error.code, -32601);
  assert.equal((await handleMcpMessage({ hello: 1 }, server)).error.code, -32600);
  assert.deepEqual((await handleMcpMessage(rpc('ping'), server)).result, {});
  assert.deepEqual(await handleMcpPayload({ jsonrpc: '2.0', method: 'notifications/initialized' }, server), { status: 202, body: null });
  const batch = await handleMcpPayload([rpc('ping', undefined, 1), { jsonrpc: '2.0', method: 'notifications/initialized' }, rpc('tools/list', undefined, 2)], server);
  assert.equal(batch.status, 200);
  assert.deepEqual(batch.body.map((r) => r.id), [1, 2]);
  assert.equal((await handleMcpPayload([], server)).status, 400);
  assert.equal((await handleMcpPayload('nonsense', server)).status, 400);
});

test('MCP: the discovery document names the endpoint and the tools', () => {
  const card = mcpServerCard(server, 'https://hr.example.in/mcp', { description: 'Public info' });
  assert.deepEqual(card.transport, { type: 'streamable-http', endpoint: 'https://hr.example.in/mcp' });
  assert.equal(card.authentication.required, false);
  assert.deepEqual(card.tools.map((t) => t.name), ['echo', 'boom']);
});
