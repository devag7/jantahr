/**
 * A small Model Context Protocol server core: JSON-RPC 2.0 over the Streamable HTTP transport, stateless, tools only.
 * It knows the protocol and nothing about JantaHR; the route passes in the tools. No imports: the tests load it too.
 * Spec: https://modelcontextprotocol.io/specification/2025-06-18/basic/transports
 */

export const MCP_PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
export const MCP_DEFAULT_VERSION = '2025-06-18';

export interface McpTool {
  name: string;
  title: string;
  description: string;
  inputSchema: { type: 'object'; properties: Record<string, unknown>; required?: string[]; additionalProperties?: boolean };
  /** Returns the text shown to the model. Throw an Error with a message the model can act on. */
  call: (args: Record<string, unknown>) => Promise<string> | string;
}

export interface McpServer {
  info: { name: string; title: string; version: string };
  instructions: string;
  tools: McpTool[];
}

type Id = string | number | null;
interface Reply { jsonrpc: '2.0'; id: Id; result?: unknown; error?: { code: number; message: string } }

const fail = (id: Id, code: number, message: string): Reply => ({ jsonrpc: '2.0', id, error: { code, message } });
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Handles one JSON-RPC message. Notifications (no id) get no reply: null. */
export async function handleMcpMessage(message: unknown, server: McpServer): Promise<Reply | null> {
  if (!isObject(message) || message.jsonrpc !== '2.0' || typeof message.method !== 'string') return fail(null, -32600, 'Invalid Request');
  const hasId = typeof message.id === 'string' || typeof message.id === 'number';
  if (!hasId) return null;
  const id = message.id as string | number;
  const params = isObject(message.params) ? message.params : {};
  const ok = (result: unknown): Reply => ({ jsonrpc: '2.0', id, result });

  switch (message.method) {
    case 'initialize': {
      const asked = typeof params.protocolVersion === 'string' ? params.protocolVersion : '';
      return ok({
        protocolVersion: MCP_PROTOCOL_VERSIONS.includes(asked) ? asked : MCP_DEFAULT_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: server.info,
        instructions: server.instructions,
      });
    }
    case 'ping':
      return ok({});
    case 'tools/list':
      return ok({ tools: server.tools.map(({ name, title, description, inputSchema }) => ({ name, title, description, inputSchema, annotations: { readOnlyHint: true, openWorldHint: false } })) });
    case 'tools/call': {
      const tool = server.tools.find((t) => t.name === params.name);
      if (!tool) return fail(id, -32602, `Unknown tool: ${String(params.name)}`);
      const args = isObject(params.arguments) ? params.arguments : {};
      const missing = (tool.inputSchema.required ?? []).filter((key) => args[key] === undefined || args[key] === null || args[key] === '');
      if (missing.length) return ok({ content: [{ type: 'text', text: `Missing required argument: ${missing.join(', ')}` }], isError: true });
      try {
        return ok({ content: [{ type: 'text', text: await tool.call(args) }], isError: false });
      } catch (e) {
        return ok({ content: [{ type: 'text', text: e instanceof Error ? e.message : 'The tool failed.' }], isError: true });
      }
    }
    default:
      return fail(id, -32601, `Method not found: ${message.method}`);
  }
}

/**
 * Handles a POST body: one message or a batch. `body: null` means the input held only notifications or responses, which
 * the transport answers with 202 Accepted and no body.
 */
export async function handleMcpPayload(payload: unknown, server: McpServer): Promise<{ status: number; body: unknown }> {
  if (Array.isArray(payload)) {
    if (!payload.length) return { status: 400, body: fail(null, -32600, 'Invalid Request') };
    const replies = (await Promise.all(payload.map((m) => handleMcpMessage(m, server)))).filter((r): r is Reply => r !== null);
    return replies.length ? { status: 200, body: replies } : { status: 202, body: null };
  }
  const reply = await handleMcpMessage(payload, server);
  if (!reply) return { status: 202, body: null };
  return { status: reply.error && reply.id === null ? 400 : 200, body: reply };
}

/** Discovery document served at /.well-known/mcp: where the server is and what it offers, without a handshake. */
export function mcpServerCard(server: McpServer, endpoint: string, more: { description: string; documentation?: string }) {
  return {
    $schema: 'https://static.modelcontextprotocol.io/schemas/mcp-server-card/v1.json',
    version: '1.0',
    protocolVersion: MCP_DEFAULT_VERSION,
    serverInfo: server.info,
    description: more.description,
    ...(more.documentation ? { documentationUrl: more.documentation } : {}),
    transport: { type: 'streamable-http', endpoint },
    capabilities: { tools: { listChanged: false } },
    authentication: { required: false, schemes: [] as string[] },
    instructions: server.instructions,
    tools: server.tools.map(({ name, title, description, inputSchema }) => ({ name, title, description, inputSchema })),
  };
}
