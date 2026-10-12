// One Vercel project serves the web app and the API (root vercel.json), so they share one set of environment
// variables. The web app reads the public values the API already has; nothing secret is mapped here.
const fromShared = {
  // the API is routed at /api on the same domain; elsewhere it is a separate origin
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? (process.env.VERCEL ? '/api' : undefined),
  NEXT_PUBLIC_EDITION: process.env.NEXT_PUBLIC_EDITION ?? process.env.EDITION,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_PUBLIC_URL ?? process.env.SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY,
  // who runs this hosted edition (contact and policy pages): the same seller the API prints on GST invoices
  NEXT_PUBLIC_OPERATOR_NAME: process.env.NEXT_PUBLIC_OPERATOR_NAME ?? process.env.BILLING_SELLER_NAME,
  NEXT_PUBLIC_OPERATOR_ADDRESS: process.env.NEXT_PUBLIC_OPERATOR_ADDRESS ?? process.env.BILLING_SELLER_ADDRESS,
  NEXT_PUBLIC_SALES_EMAIL: process.env.NEXT_PUBLIC_SALES_EMAIL ?? process.env.SUPPORT_EMAIL,
  NEXT_PUBLIC_SUPPORT_PHONE: process.env.NEXT_PUBLIC_SUPPORT_PHONE ?? process.env.SUPPORT_PHONE,
};

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  poweredByHeader: false,
  // Product screenshots are pre-sized WebP files in public/. Serve them as they are: the image optimiser route
  // (/_next/image) is not available when the app runs as a Vercel service, and self-hosted installs need no sharp.
  images: { unoptimized: true },
  env: Object.fromEntries(Object.entries(fromShared).filter(([, value]) => value !== undefined)),
};

export default nextConfig;
