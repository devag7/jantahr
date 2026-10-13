import { handleMcpPayload, mcpServerCard } from '@/lib/agents/mcp';
import { MCP_DESCRIPTION, publicMcpServer } from '@/lib/agents/mcp-server';
import { publicOrigin } from '@/lib/agents/pages';
import { isCloudWeb } from '@/lib/edition';

// the server is public and holds nothing private, so any origin may call it
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Accept, Mcp-Protocol-Version, Mcp-Session-Id', 'Access-Control-Max-Age': '86400' };
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...CORS, ...headers } });
const absent = () => new Response(null, { status: 404 });

/** POST: one JSON-RPC message or a batch, answered as JSON (Streamable HTTP without a stream). */
export async function mcpPost(request: Request) {
  if (!isCloudWeb) return absent();
  let payload: unknown;
  try { payload = await request.json(); } catch { return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, 400); }
  const { status, body } = await handleMcpPayload(payload, publicMcpServer(request));
  return body === null ? new Response(null, { status, headers: CORS }) : json(body, status);
}

/** GET on the MCP endpoint: this server opens no event stream, which the transport signals with 405. */
export function mcpNoStream() {
  if (!isCloudWeb) return absent();
  return json({ jsonrpc: '2.0', id: null, error: { code: -32000, message: 'This server does not offer an event stream. Send JSON-RPC messages with POST.' } }, 405, { Allow: 'POST, OPTIONS' });
}

/** GET on /.well-known/mcp: the discovery document. */
export function mcpCard(request: Request) {
  if (!isCloudWeb) return absent();
  const origin = publicOrigin(request);
  return json(mcpServerCard(publicMcpServer(request), `${origin}/mcp`, { description: MCP_DESCRIPTION, documentation: `${origin}/developers` }), 200, { 'Cache-Control': 'public, max-age=0, s-maxage=3600' });
}

export const mcpOptions = () => (isCloudWeb ? new Response(null, { status: 204, headers: CORS }) : absent());
