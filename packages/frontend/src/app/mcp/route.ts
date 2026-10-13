import { mcpNoStream, mcpOptions, mcpPost } from '@/lib/agents/mcp-http';

export const dynamic = 'force-dynamic';

/** The public MCP server (Streamable HTTP). See src/lib/agents/mcp-server.ts for what it offers. */
export const POST = mcpPost;
export const GET = mcpNoStream;
export const DELETE = mcpNoStream;
export const OPTIONS = mcpOptions;
