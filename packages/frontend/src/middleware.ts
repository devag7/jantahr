import { NextResponse, type NextRequest } from 'next/server';
import { AGENT_PATH_HEADER, prefersMarkdown, varyAccept } from '@/lib/agents/negotiate';
import { isCloudWeb } from '@/lib/edition';

/**
 * Markdown for agents (cloud edition's public site). A request that names text/markdown ahead of text/html is answered
 * by /agent-markdown, which serves the page as Markdown, or a Markdown 404 for a path that does not exist. Everyone
 * else gets the page as before, marked `Vary: Accept` so a cache never hands one audience the other's version.
 */
export function middleware(request: NextRequest) {
  if (!isCloudWeb || (request.method !== 'GET' && request.method !== 'HEAD')) return NextResponse.next();
  if (prefersMarkdown(request.headers.get('accept'))) {
    const url = request.nextUrl.clone();
    url.pathname = '/agent-markdown';
    url.search = '';
    // a rewritten request keeps its original address, so the path travels in a header the handler reads
    const headers = new Headers(request.headers);
    headers.set(AGENT_PATH_HEADER, request.nextUrl.pathname);
    return NextResponse.rewrite(url, { request: { headers } });
  }
  const response = NextResponse.next();
  // Next names its own request headers in Vary; they are repeated here for hosts where this value replaces Next's
  response.headers.set('Vary', varyAccept('RSC, Next-Router-State-Tree, Next-Router-Prefetch'));
  return response;
}

// pages only: not the API, Next's own assets, the Markdown handler itself, or anything with a file extension
export const config = { matcher: ['/((?!api/|_next/|agent-markdown|mcp$|\\.well-known/|.*\\.[a-zA-Z0-9]+$).*)'] };
