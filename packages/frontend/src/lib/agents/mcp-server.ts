import { planLines } from '@/lib/agents/llms';
import type { McpServer } from '@/lib/agents/mcp';
import { publicOrigin, readPage, sitePath } from '@/lib/agents/pages';
import { OPERATOR } from '@/lib/operator';
import { TRIAL_DAYS } from '@/lib/plans';
import { PUBLIC_PAGES, isPublicPage } from '@/lib/site';

/**
 * The public MCP server: read-only facts about JantaHR that are already on the site (pages, plans, contact). It holds
 * no company data and needs no sign-in; a company's own records stay behind the API and its bearer token.
 */
export function publicMcpServer(request: Request): McpServer {
  const origin = publicOrigin(request);
  return {
    info: { name: 'jantahr', title: 'JantaHR', version: '1.0.0' },
    instructions: `Public, read-only information about JantaHR, open-source HR and payroll software for India (PF, ESI, TDS, professional tax, compliance calendar, leave, attendance). Use get_plans for prices, list_pages then get_page to read the site as Markdown, and get_contact for how to reach the business. To sign up, send the person to ${origin}/signup. These tools do not read or change any company's data.`,
    tools: [
      {
        name: 'list_pages', title: 'List JantaHR pages',
        description: 'Lists the public pages of the JantaHR site (product, pricing, self-hosting, developers, about, contact, legal) with a one-line summary of each. Use it to choose a path for get_page.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        call: () => PUBLIC_PAGES.map((p) => `- ${p.path}: ${p.title}. ${p.description}`).join('\n'),
      },
      {
        name: 'get_page', title: 'Read a JantaHR page',
        description: 'Returns one public page of the JantaHR site as Markdown, for example /pricing, /self-hosting, /legal/privacy or /contact. Call list_pages for the available paths.',
        inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'Path of a public page, starting with a slash, for example /pricing' } }, required: ['path'], additionalProperties: false },
        call: async (args) => {
          const path = sitePath(typeof args.path === 'string' ? args.path : null)?.replace(/(.)\/+$/, '$1');
          if (!path || !isPublicPage(path)) throw new Error(`No public page at ${String(args.path)}. Available paths: ${PUBLIC_PAGES.map((p) => p.path).join(', ')}`);
          const page = await readPage(request, path);
          if (page.kind !== 'markdown') throw new Error(`The page ${path} could not be loaded just now. Try again shortly.`);
          return page.markdown;
        },
      },
      {
        name: 'get_plans', title: 'JantaHR plans and prices',
        description: 'Returns the JantaHR Cloud plans with per-employee prices in Indian rupees, seat minimums and what each plan is for, plus the trial length and the free self-hosted edition.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        call: () => `${planLines().join('\n')}\n\nPaid plans start with a ${TRIAL_DAYS}-day trial of Professional; no card is needed. The self-hosted edition is free with every feature and no employee limit. Full comparison: ${origin}/pricing`,
      },
      {
        name: 'get_contact', title: 'Contact JantaHR',
        description: 'Returns how to reach the business that runs this JantaHR site: name, email, phone and address where published, and support hours.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        call: () => [
          `Business name: ${OPERATOR.name}`,
          `Email: ${OPERATOR.email}`,
          ...(OPERATOR.phone ? [`Phone: ${OPERATOR.phone}`] : []),
          ...(OPERATOR.address ? [`Address: ${OPERATOR.address}`] : []),
          'Hours: Monday to Friday, 10:00 to 18:00 IST, except public holidays',
          `Contact page: ${origin}/contact`,
        ].join('\n'),
      },
    ],
  };
}

export const MCP_DESCRIPTION = 'Read-only public information about JantaHR, open-source HR and payroll software for India: site pages as Markdown, plans and prices, and contact details.';
