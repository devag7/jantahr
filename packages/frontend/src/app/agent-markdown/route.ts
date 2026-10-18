import { prefersMarkdown } from '@/lib/agents/negotiate';
import { fetchHtml, notFoundMarkdown, publicOrigin, readPage, sitePath } from '@/lib/agents/pages';
import { isCloudWeb } from '@/lib/edition';

export const dynamic = 'force-dynamic';

const markdown = (body: string, status = 200) => new Response(body, {
  status,
  headers: { 'Content-Type': 'text/markdown; charset=utf-8', Vary: 'Accept', 'Cache-Control': 'public, max-age=0, must-revalidate', 'X-Robots-Tag': 'noindex' },
});

/**
 * The Markdown side of content negotiation. A rewrite (next.config.mjs) sends a request here when its Accept header
 * names text/markdown: a public page comes back as Markdown, a path that does not exist as a Markdown 404, and an app
 * page (sign-in, dashboard) exactly as the site would have served it. The rewrite cannot weigh q-values, so a request
 * that ranks HTML above Markdown is given the HTML page here.
 */
export async function GET(request: Request) {
  if (!isCloudWeb) return new Response(null, { status: 404 });
  const origin = publicOrigin(request);
  const url = new URL(request.url);
  // a rewritten request may show its original address or the rewritten one, depending on the host
  const asked = url.searchParams.get('path') ?? url.pathname;
  const path = sitePath(asked);
  if (!path || path.startsWith('/agent-markdown')) return markdown(notFoundMarkdown(origin), 404);

  if (!prefersMarkdown(request.headers.get('accept'))) {
    const html = await fetchHtml(request, path);
    if (html) return new Response(html.body, { status: html.status, headers: { 'Content-Type': html.headers.get('content-type') ?? 'text/html; charset=utf-8', Vary: 'Accept', ...(html.headers.get('location') ? { Location: html.headers.get('location')! } : {}) } });
  }

  const page = await readPage(request, path);
  switch (page.kind) {
    case 'markdown': return markdown(page.markdown);
    case 'not-found': return markdown(notFoundMarkdown(origin), 404);
    case 'redirect': return new Response(null, { status: page.status, headers: { Location: page.location, Vary: 'Accept' } });
    case 'unreachable': return markdown(`# Temporarily unavailable\n\nThis page could not be loaded as Markdown just now. Try again, or read [llms.txt](${origin}/llms.txt).\n`, 503);
    case 'other': {
      const headers = new Headers({ 'Content-Type': page.response.headers.get('content-type') ?? 'text/html; charset=utf-8', Vary: 'Accept' });
      return new Response(page.response.body, { status: page.response.status, headers });
    }
  }
}
