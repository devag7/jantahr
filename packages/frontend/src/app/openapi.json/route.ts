import { API_BASE_URL } from '@/lib/constants';
import { isCloudWeb } from '@/lib/edition';

export const dynamic = 'force-dynamic';

/**
 * /openapi.json at the site root, where agents and tools look for it. The document itself is built by the API from
 * its own routes (packages/backend/src/openapi) and served at <api>/openapi.json; this passes it through unchanged.
 */
export async function GET(request: Request) {
  if (!isCloudWeb) return new Response(null, { status: 404 });
  // the API is a path on this site ("/api" on Vercel) or an origin of its own
  const source = `${API_BASE_URL.startsWith('/') ? new URL(request.url).origin : ''}${API_BASE_URL.replace(/\/+$/, '')}/openapi.json`;
  try {
    const upstream = await fetch(source, { headers: { accept: 'application/json' }, cache: 'no-store' });
    if (!upstream.ok) throw new Error(`status ${upstream.status}`);
    return new Response(await upstream.text(), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=0, s-maxage=300' } });
  } catch {
    return Response.json({ statusCode: 503, error: 'Service Unavailable', message: 'The API description could not be loaded just now.' }, { status: 503 });
  }
}
