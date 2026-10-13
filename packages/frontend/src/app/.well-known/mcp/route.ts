import { mcpCard, mcpOptions, mcpPost } from '@/lib/agents/mcp-http';

export const dynamic = 'force-dynamic';

/** MCP discovery: GET describes the server and where it is; POST speaks the protocol here too, for clients that probe this address. */
export const GET = mcpCard;
export const POST = mcpPost;
export const OPTIONS = mcpOptions;
