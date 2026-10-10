// One Vercel project serves the web app and the API (root vercel.json), so they share one set of environment
// variables. The web app reads the public values the API already has; nothing secret is mapped here.
const fromShared = {
  // the API is routed at /api on the same domain; elsewhere it is a separate origin
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? (process.env.VERCEL ? '/api' : undefined),
  NEXT_PUBLIC_EDITION: process.env.NEXT_PUBLIC_EDITION ?? process.env.EDITION,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_PUBLIC_URL ?? process.env.SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY,
};

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  poweredByHeader: false,
  env: Object.fromEntries(Object.entries(fromShared).filter(([, value]) => value !== undefined)),
};

export default nextConfig;
