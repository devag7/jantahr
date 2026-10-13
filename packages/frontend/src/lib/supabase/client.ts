import { createBrowserClient } from '@supabase/ssr';
import { createClient as createPlainClient } from '@supabase/supabase-js';
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

let emailFlow: SupabaseClient | null = null;

/**
 * A second, stateless client used only to ask Supabase Auth to send an email (sign-up confirmation, sign-in link,
 * password reset). The main client uses PKCE, whose emailed links only complete in the browser that requested them:
 * opened from a mail app or another device they fail with "PKCE code verifier not found". Requests made through this
 * client produce links that carry the session back in the URL fragment, which the callback page accepts in any browser.
 */
export function createEmailFlowClient(): SupabaseClient {
  if (!supabaseConfigured) throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: sign-in uses Supabase Auth.');
  emailFlow ??= createPlainClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { flowType: 'implicit', persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return emailFlow;
}

/** The access token of the current Supabase session (refreshed by supabase-js when it is close to expiry). */
export async function accessToken(): Promise<string | null> {
  if (typeof window === 'undefined' || !supabaseConfigured) return null;
  const { data } = await createClient().auth.getSession();
  return data.session?.access_token ?? null;
}
