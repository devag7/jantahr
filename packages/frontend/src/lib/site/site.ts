/**
 * The public site of the cloud edition: its address and the pages anyone may read. One list feeds the sitemap,
 * llms.txt, the Markdown versions served to agents and the MCP server, so a new public page is added here once.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/+$/, '');
export const REPO_URL = 'https://github.com/devag7/jantahr';
export const SITE_NAME = 'JantaHR';
export const SITE_TITLE = 'JantaHR: HR and payroll software for India';
export const SITE_DESCRIPTION = 'India-first HR & payroll: PF, ESI, TDS, PT, leave, attendance and self-service in one place.';
export const SITE_IMAGE = '/marketing/overview.webp';

export const absoluteUrl = (path: string) => `${SITE_URL}${path === '/' ? '/' : path}`;

export interface PublicPage { path: string; title: string; description: string; group: 'product' | 'company' | 'developers' | 'legal' }

export const PUBLIC_PAGES: PublicPage[] = [
  { path: '/', title: 'JantaHR home', description: 'What JantaHR does: monthly payroll with PF, ESI, TDS and professional tax, a compliance calendar, and employee self-service.', group: 'product' },
  { path: '/pricing', title: 'JantaHR pricing', description: 'Plans and per-employee prices in rupees, what each plan includes, the free plan and the trial.', group: 'product' },
  { path: '/self-hosting', title: 'Self-hosting JantaHR', description: 'Run the complete product on your own servers with Docker and Supabase: what is in the stack and the three setup steps.', group: 'product' },
  { path: '/developers', title: 'JantaHR developer resources', description: 'Source code, REST API and authentication, the MCP server, and the machine-readable files this site publishes.', group: 'developers' },
  { path: '/about', title: 'About JantaHR', description: 'What JantaHR is, who it is for, how the open-source and cloud editions relate, and who runs this site.', group: 'company' },
  { path: '/contact', title: 'Contact JantaHR', description: 'Business name, email, hours and how to raise billing, privacy and grievance requests.', group: 'company' },
  { path: '/legal/terms', title: 'JantaHR terms of service', description: 'The agreement for using JantaHR Cloud.', group: 'legal' },
  { path: '/legal/privacy', title: 'JantaHR privacy notice', description: 'What personal data is processed, why, where it is stored, and rights under the DPDP Act 2023.', group: 'legal' },
  { path: '/legal/refunds', title: 'JantaHR cancellation and refunds', description: 'How to cancel a plan and when a payment is refunded.', group: 'legal' },
  { path: '/legal/shipping', title: 'JantaHR shipping and delivery', description: 'JantaHR is software delivered online: when access starts after payment.', group: 'legal' },
];

export const isPublicPage = (path: string) => PUBLIC_PAGES.some((p) => p.path === (path.replace(/\/+$/, '') || '/'));
