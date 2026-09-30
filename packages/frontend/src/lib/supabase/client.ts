import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

// From the Supabase `supabase-client-nextjs` library block. Supabase Auth is JantaHR's only identity provider, so
// every build needs NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.
export const supabaseConfigured = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

let client: SupabaseClient | null = null;

export function createClient(): SupabaseClient {
  if (!supabaseConfigured) throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: sign-in uses Supabase Auth.');
  client ??= createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
  return client;
}

/** The access token of the current Supabase session (refreshed by supabase-js when it is close to expiry). */
export async function accessToken(): Promise<string | null> {
  if (typeof window === 'undefined' || !supabaseConfigured) return null;
  const { data } = await createClient().auth.getSession();
  return data.session?.access_token ?? null;
}
