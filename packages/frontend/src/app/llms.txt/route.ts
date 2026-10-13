import { buildLlmsTxt } from '@/lib/agents/llms';
import { publicOrigin } from '@/lib/agents/pages';
import { isCloudWeb } from '@/lib/edition';

export const dynamic = 'force-dynamic';

/** /llms.txt for the cloud edition's public site. The self-hosted build has no public site to describe. */
export function GET(request: Request) {
  if (!isCloudWeb) return new Response(null, { status: 404 });
  return new Response(buildLlmsTxt(publicOrigin(request)), { headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Cache-Control': 'public, max-age=0, s-maxage=3600' } });
}
