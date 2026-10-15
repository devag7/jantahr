import type { Metadata } from 'next';
import { ContactLine, LegalPage } from '@/components/marketing/legal-page';
import { OPERATOR } from '@/lib/operator';
import { REPO_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'JantaHR developer resources',
  description: 'JantaHR for developers and AI agents: source code, the REST API with its OpenAPI specification and authentication, the MCP server, and the machine-readable files this site publishes.',
  alternates: { canonical: '/developers' },
};

const link = 'text-primary hover:underline';
const code = 'rounded bg-card px-1.5 py-0.5 text-caption';

export default function DevelopersPage() {
  return (
    <LegalPage
      title="JantaHR developer resources"
      nav="Developers"
      dated={false}
      intro="Everything a developer or an AI agent needs to build on JantaHR: where the code is, how the API is called and authenticated, and the machine-readable descriptions of this site."
      sections={[
        ['JantaHR source code', (
          <p key="s24">The API (NestJS, Prisma, Postgres), the web app (Next.js) and the mobile app (Expo) are in one repository under AGPL-3.0: <a className={link} href={REPO_URL}>github.com/devag7/jantahr</a>. Contribution notes are in <a className={link} href={`${REPO_URL}/blob/main/CONTRIBUTING.md`}>CONTRIBUTING.md</a>, and the legal basis for each statutory rule is in <a className={link} href={`${REPO_URL}/blob/main/docs/legal-2026.md`}>docs/legal-2026.md</a>.</p>
        )],
        ['JantaHR API', (
          <p key="s27">The web and mobile apps use a JSON REST API, served on this site under <code className={code}>/api</code>. <a className={link} href="/api/health">/api/health</a> reports whether it is up. Requests and responses are JSON, and every error has the same shape. Calls are limited to 300 a minute from one address.</p>
        )],
        ['JantaHR OpenAPI specification', (
          <p key="s30">The API is described in OpenAPI 3.0 at <a className={link} href="/openapi.json">/openapi.json</a>. It is generated from the routes and their validation rules, so it always matches the running API: each operation has an operationId, typed parameters, a request schema and the role or plan feature it needs. Handlers do not declare what they return, so success responses are described as JSON without a fixed shape. Running the API locally also gives a browsable Swagger page at <code className={code}>/docs</code>.</p>
        )],
        ['JantaHR API authentication', (
          <p key="s33">Every API call carries a Supabase Auth access token as a bearer token: <code className={code}>Authorization: Bearer &lt;access token&gt;</code>. A person signs in with email and password, a magic link or Google, with two-factor where they have enrolled it, and the API maps that sign-in to their JantaHR account, company and role. There are no long-lived API keys, so an integration acts as a signed-in user and can do only what that user&apos;s role allows.</p>
        )],
        ['JantaHR MCP server', (
          <p key="s36">A Model Context Protocol server is available at <code className={code}>/mcp</code> over the Streamable HTTP transport, with a discovery document at <a className={link} href="/.well-known/mcp">/.well-known/mcp</a>. It needs no sign-in and is read-only: its tools return this site&apos;s pages as Markdown, the plans and prices, and contact details. It does not read or change company data.</p>
        )],
        ['For AI agents', (
          <p key="s39"><a className={link} href="/llms.txt">/llms.txt</a> describes when to use JantaHR and lists every public page. Each page is also served as Markdown when a request sends <code className={code}>Accept: text/markdown</code>, and <a className={link} href="/sitemap.xml">/sitemap.xml</a> lists the same pages for crawlers.</p>
        )],
        ['Self-hosting JantaHR', (
          <p key="s42">One command starts the product with a complete Supabase stack on Docker. Start with the <a className={link} href="/self-hosting">self-hosting page</a>, then the full guide in <a className={link} href={`${REPO_URL}/blob/main/deploy/self-hosted/README.md`}>deploy/self-hosted/README.md</a>.</p>
        )],
        ['Security reports', (
          <p key="s45">Please report vulnerabilities privately, as described in <a className={link} href={`${REPO_URL}/blob/main/SECURITY.md`}>SECURITY.md</a>, not in a public issue.</p>
        )],
      ]}
    >
      <ContactLine email={OPERATOR.email} />
    </LegalPage>
  );
}
