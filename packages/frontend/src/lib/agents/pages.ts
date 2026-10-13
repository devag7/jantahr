import { htmlToMarkdown } from '@/lib/agents/html-to-markdown';
import { SITE_URL, isPublicPage } from '@/lib/site';

/** The address agents should see in links: the configured site address, or the one the request arrived on. */
export const publicOrigin = (request: Request) => (process.env.NEXT_PUBLIC_SITE_URL ? SITE_URL : new URL(request.url).origin);

/** A path on this site and nothing else: no scheme, no host, no backslashes. */
export function sitePath(raw: string | null | undefined): string | null {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || /[\\\s]/.test(raw)) return null;
  try {
    const url = new URL(raw, 'http://site.invalid');
    return url.host === 'site.invalid' ? url.pathname : null;
  } catch { return null; }
}

export const notFoundMarkdown = (path: string, origin: string) => `# 404: page not found

There is no page at \`${path.replace(/`/g, '')}\` on JantaHR. The address may be mistyped, or the page may have moved.

Where to go instead:

- [JantaHR home](${origin}/)
- [Every public page, with a one-line summary (llms.txt)](${origin}/llms.txt)
- [Sitemap](${origin}/sitemap.xml)
- [Pricing](${origin}/pricing)
- [Contact](${origin}/contact)
`;

/** Fetches a page of this site as HTML, from the address the request came in on and then from the configured one. */
async function fetchHtml(request: Request, path: string): Promise<Response | null> {
  const origins = Array.from(new Set([new URL(request.url).origin, SITE_URL]));
  for (const origin of origins) {
    try {
      return await fetch(`${origin}${path}`, { headers: { accept: 'text/html', 'user-agent': 'JantaHR-markdown/1.0' }, redirect: 'manual', cache: 'no-store' });
    } catch { /* try the next address */ }
  }
  return null;
}

export type PageResult =
  | { kind: 'markdown'; markdown: string }
  | { kind: 'not-found' }
  | { kind: 'redirect'; status: number; location: string }
  | { kind: 'other'; response: Response }
  | { kind: 'unreachable' };

/** A page as Markdown when it is one of the public pages; otherwise what the site answers for that path. */
export async function readPage(request: Request, path: string): Promise<PageResult> {
  const upstream = await fetchHtml(request, path);
  if (!upstream) return { kind: 'unreachable' };
  if (upstream.status === 404) return { kind: 'not-found' };
  const location = upstream.headers.get('location');
  if (upstream.status >= 300 && upstream.status < 400 && location) return { kind: 'redirect', status: upstream.status, location };
  if (!upstream.ok || !isPublicPage(path) || !(upstream.headers.get('content-type') ?? '').includes('text/html')) return { kind: 'other', response: upstream };
  const origin = publicOrigin(request);
  const body = htmlToMarkdown(await upstream.text(), { baseUrl: `${origin}${path}` });
  return { kind: 'markdown', markdown: `${body}\n---\n\nSource: ${origin}${path === '/' ? '/' : path} · [All public pages](${origin}/llms.txt) · [Sitemap](${origin}/sitemap.xml)\n` };
}
