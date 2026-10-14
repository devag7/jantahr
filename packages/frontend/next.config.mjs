// One Vercel project serves the web app and the API (root vercel.json), so they share one set of environment
// variables. The web app reads the public values the API already has; nothing secret is mapped here.
const fromShared = {
  // the public address of the web app, for canonical links, the sitemap and structured data; Vercel knows its own
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? process.env.FRONTEND_URL
    ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined),
  // the API is routed at /api on the same domain; elsewhere it is a separate origin
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? (process.env.VERCEL ? '/api' : undefined),
  NEXT_PUBLIC_EDITION: process.env.NEXT_PUBLIC_EDITION ?? process.env.EDITION,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_PUBLIC_URL ?? process.env.SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY,
  // who runs this hosted edition (contact and policy pages): the same seller the API prints on GST invoices
  NEXT_PUBLIC_OPERATOR_NAME: process.env.NEXT_PUBLIC_OPERATOR_NAME ?? process.env.BILLING_SELLER_NAME,
  NEXT_PUBLIC_OPERATOR_ADDRESS: process.env.NEXT_PUBLIC_OPERATOR_ADDRESS ?? process.env.BILLING_SELLER_ADDRESS,
  // the operator's own website, linked from the footer and contact page
  NEXT_PUBLIC_OPERATOR_URL: process.env.NEXT_PUBLIC_OPERATOR_URL ?? process.env.OPERATOR_URL,
  // a GSTIN means the seller is GST-registered: only then do prices and policies mention GST
  NEXT_PUBLIC_OPERATOR_GSTIN: process.env.NEXT_PUBLIC_OPERATOR_GSTIN ?? process.env.BILLING_SELLER_GSTIN,
  NEXT_PUBLIC_SALES_EMAIL: process.env.NEXT_PUBLIC_SALES_EMAIL ?? process.env.SUPPORT_EMAIL,
  NEXT_PUBLIC_SUPPORT_PHONE: process.env.NEXT_PUBLIC_SUPPORT_PHONE ?? process.env.SUPPORT_PHONE,
};

// The public site exists only in the cloud edition. There, a request that names text/markdown in Accept is answered by
// /agent-markdown (the page as Markdown, or a Markdown 404), and pages are marked as varying by Accept. Pages only:
// not the API, Next's assets, the handler itself, the MCP endpoints, or anything with a file extension.
const isCloud = fromShared.NEXT_PUBLIC_EDITION === 'cloud';
const PAGE = '/:path((?!api/|_next/|agent-markdown|mcp$|\\.well-known/|.*\\.[a-zA-Z0-9]+$).*)';

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    if (!isCloud) return [];
    return { beforeFiles: [{ source: PAGE, has: [{ type: 'header', key: 'accept', value: '(.*)text/markdown(.*)' }], destination: '/agent-markdown?path=/:path' }] };
  },
  // browsers ask for /favicon.ico on pages that declare no icon (raw JSON, text files); the icon is an SVG
  async redirects() {
    return [{ source: '/favicon.ico', destination: '/icon.svg', permanent: true }];
  },
  async headers() {
    if (!isCloud) return [];
    // Next names its own request headers in Vary; they are repeated for hosts where this value replaces Next's
    return [{ source: PAGE, headers: [{ key: 'Vary', value: 'RSC, Next-Router-State-Tree, Next-Router-Prefetch, Accept' }] }];
  },
  reactStrictMode: true,
  output: 'standalone',
  poweredByHeader: false,
  // Product screenshots are pre-sized WebP files in public/. Serve them as they are: the image optimiser route
  // (/_next/image) is not available when the app runs as a Vercel service, and self-hosted installs need no sharp.
  images: { unoptimized: true },
  env: Object.fromEntries(Object.entries(fromShared).filter(([, value]) => value !== undefined)),
};

export default nextConfig;
